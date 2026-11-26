// Game state: modes, missions, rings, scoring and endings. This is the
// referee — it owns the score, the clock and what "done" means, and leaves
// physics to plane.js and pixels to render.js.
import { CONFIG, MISSIONS, RING_COURSE } from './config.js';
import { createPlane, stepPlane } from './plane.js';
import { playRing, playLanding, playCrash, playWarning } from './audio.js';

export function createGame() {
  return {
    mode: 'title',           // title | play | paused | over
    selectedMission: 0,
    mission: MISSIONS[0],
    plane: createPlane(MISSIONS[0]),
    rings: [],
    nextRing: 0,
    ringsPassed: 0,
    score: 0,
    bestScore: 0,
    time: 0,
    timeLeft: MISSIONS[0].timeLimit,
    banner: '',
    bannerUntil: 0,
    outcome: '',
    endTitle: '',
    endLine: '',
    warnCooldown: 0,
  };
}

export function startMission(game, index, audio) {
  const mission = MISSIONS[index];
  game.mission = mission;
  game.selectedMission = index;
  game.plane = createPlane(mission);
  game.rings = RING_COURSE.slice(0, mission.rings).map((r) => ({
    x: r.x, z: r.z, alt: r.alt, radius: 30, passed: false,
  }));
  game.nextRing = 0;
  game.ringsPassed = 0;
  game.score = 0;
  game.time = 0;
  game.timeLeft = mission.timeLimit;
  game.mode = 'play';
  game.outcome = '';
  game.banner = mission.name + ' — ' + mission.tagline;
  game.bannerUntil = 4;
}

export function showBanner(game, text, seconds = 2.5) {
  game.banner = text;
  game.bannerUntil = game.time + seconds;
}

function ringHit(plane, ring) {
  const dx = plane.x - ring.x, dz = plane.z - ring.z, dy = plane.alt - ring.alt;
  const lateral = Math.hypot(dx, dz);
  // Passing through the hoop: close in the ring's plane and near its height.
  return lateral < ring.radius * 0.75 && Math.abs(dy) < ring.radius * 0.8;
}

export function endGame(game, outcome, title, line) {
  game.mode = 'over';
  game.outcome = outcome;
  game.endTitle = title;
  game.endLine = line;
  if (game.score > game.bestScore) game.bestScore = game.score;
}

export function updateGame(game, stick, dt, audio) {
  if (game.mode !== 'play') return;
  game.time += dt;
  game.timeLeft = game.mission.timeLimit - game.time;
  game.warnCooldown = Math.max(0, game.warnCooldown - dt);

  const events = stepPlane(game.plane, stick, game.mission, dt);
  const p = game.plane;

  for (const ev of events) {
    if (ev === 'stall' && p.pitch > 0.05 && game.warnCooldown <= 0) {
      showBanner(game, 'STALL! Push the nose down, add throttle', 1.2);
      playWarning(audio);
      game.warnCooldown = 1.5;
    }
    if (ev === 'fuel-empty') showBanner(game, 'FUEL EMPTY — gliding! Find the runway', 3);
    if (ev === 'crash-hit') {
      playCrash(audio);
      showBanner(game, `TERRAIN STRIKE! Damage ${Math.round(p.damage)}%`, 2);
      if (p.damage >= 100) {
        endGame(game, 'crashed', 'CRASHED', 'The Kestrel came down hard on Coral Coast. The island keeps its secrets.');
        return;
      }
    }
    if (ev === 'landing' || ev === 'perfect-landing') {
      const perfect = ev === 'perfect-landing';
      const bonus = perfect ? CONFIG.landingScore + CONFIG.perfectLandingBonus : CONFIG.landingScore;
      game.score += bonus;
      playLanding(audio, perfect);
      const ringsDone = game.ringsPassed >= game.rings.length;
      if (ringsDone || game.mission.id === 'hop') {
        endGame(game, 'complete', perfect ? 'PERFECT LANDING!' : 'MISSION COMPLETE',
          perfect
            ? 'Wheels down on the centreline, feather-light. The crowd at Coral Field cheers.'
            : 'Wheels down on runway 36. The Kestrel is home, and so are you.');
      } else {
        showBanner(game, `LANDED — ${bonus} pts! Take off again to finish the rings`, 3);
      }
      return;
    }
  }

  // Rings: only the next one in the course counts, in order.
  const ring = game.rings[game.nextRing];
  if (ring && !p.onGround && ringHit(p, ring)) {
    ring.passed = true;
    game.ringsPassed++;
    game.nextRing++;
    const speedBonus = Math.round(Math.max(0, (p.speed - 45)) * 2);
    game.score += CONFIG.ringScore + speedBonus;
    playRing(audio);
    if (game.nextRing >= game.rings.length) {
      showBanner(game, `ALL RINGS! Now land on runway 36 — ${CONFIG.landingScore} pts waiting`, 4);
    } else {
      showBanner(game, `RING ${game.ringsPassed} — +${CONFIG.ringScore + speedBonus} pts`, 2);
    }
  }

  // Out of fuel while airborne and sinking is a slow emergency, not a crash:
  // the clock decides. Running out of time ends the sortie.
  if (game.timeLeft <= 0) {
    endGame(game, 'timeout', 'OUT OF TIME',
      `The sortie window closed with ${game.ringsPassed}/${game.rings.length} rings flown.`);
    return;
  }
  if (p.fuel <= 0 && p.onGround && p.speed < 2 && game.ringsPassed < game.rings.length) {
    endGame(game, 'fuel', 'OUT OF FUEL',
      'The tank ran dry on the ground, short of the rings. Refuel and fly again.');
    return;
  }
  if (p.crashed) {
    endGame(game, 'crashed', 'CRASHED', 'The Kestrel came down hard on Coral Coast.');
  }
}

// Title-screen mission picking by click position (cards are drawn in render.js).
export function missionCardAt(game, mx, my, w, h) {
  const cardW = 300, gap = 24, total = MISSIONS.length * cardW + (MISSIONS.length - 1) * gap;
  const x0 = w / 2 - total / 2;
  const y = 258, cardH = 150;
  if (my < y || my > y + cardH) return -1;
  for (let i = 0; i < MISSIONS.length; i++) {
    const x = x0 + i * (cardW + gap);
    if (mx >= x && mx <= x + cardW) return i;
  }
  return -1;
}
