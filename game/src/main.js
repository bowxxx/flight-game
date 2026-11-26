// Bootstrap: canvas setup, the frame loop, menu input and the screenshot
// modes (?shot=start|play|land|over) the maker uses for the dossier shots.
// The loop is fixed-step physics at 60 Hz with render interpolation skipped
// for simplicity — the frame rate is the physics rate, clamped to 0.05 s.
import { CONFIG, MISSIONS } from './config.js';
import { createGame, startMission, updateGame, endGame, missionCardAt, showBanner } from './game.js';
import { createInput, readStick, consumePress } from './input.js';
import { renderFrame } from './render.js';
import { createAudio, startAudio, updateAudio, playClick, toggleMute } from './audio.js';
import { terrainHeight } from './terrain.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const input = createInput(canvas);
const audio = createAudio();
const game = createGame();

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const params = new URLSearchParams(location.search);
const shot = params.get('shot') || '';

// Deterministic staged scenes for screenshots: put the plane somewhere
// photogenic, with the HUD lit and a ring or the runway ahead.
function applyShotScene() {
  if (!shot) return;
  if (shot === 'start') {
    game.mode = 'title';
    game.selectedMission = 0;
    // Title backdrop: the plane holds over the bay, coast and city ahead.
    const p = game.plane;
    p.x = -600; p.z = 800; p.alt = 200; p.heading = 0.8; p.pitch = 0.05;
  } else if (shot === 'play') {
    startMission(game, 0, audio);
    // Over the open sea west of the bay, ring 4 dead ahead, coast beyond.
    // NOTE: startMission replaces game.plane, so take the fresh object.
    const p = game.plane;
    p.x = -600; p.z = -100; p.alt = 230; p.heading = 2.94; p.pitch = 0.04;
    p.speed = 72; p.throttle = 0.75; p.bank = -0.15; p.onGround = false;
    game.score = 750; game.ringsPassed = 3; game.nextRing = 3;
    game.rings[0].passed = true; game.rings[1].passed = true; game.rings[2].passed = true;
    game.time = 61; game.timeLeft = 179;
    showBanner(game, 'RING 3 — +250 pts', 3);
    game.bannerUntil = 9999;
  } else if (shot === 'land') {
    startMission(game, 1, audio);
    // Final approach: 1100 m out, 70 m above the field, runway 36 ahead.
    const p = game.plane;
    p.x = 420; p.z = 1500; p.alt = 180;
    p.heading = 0; p.pitch = -0.03; p.speed = 48; p.throttle = 0.35; p.onGround = false;
    game.rings.forEach((r) => { r.passed = true; });
    game.ringsPassed = 5; game.nextRing = 5;
    game.score = 2250; game.time = 132; game.timeLeft = 168;
    showBanner(game, 'ALL RINGS! Now land on runway 36', 4);
    game.bannerUntil = 9999;
  } else if (shot === 'over') {
    startMission(game, 0, audio);
    const p = game.plane;
    p.x = -400; p.z = 800; p.alt = 220; p.heading = 0.6; p.pitch = 0.04;
    game.score = 3850; game.ringsPassed = 8; game.nextRing = 8;
    game.rings.forEach((r) => { r.passed = true; });
    game.time = 188; game.timeLeft = 52;
    endGame(game, 'complete', 'MISSION COMPLETE', 'All eight rings threaded and the Kestrel home on runway 36.');
  }
  window.__shotMode = game.mode;
}

function handleMenuInput(w, h) {
  if (consumePress(input, 'mission-1')) { game.selectedMission = 0; playClick(audio); }
  if (consumePress(input, 'mission-2')) { game.selectedMission = 1; playClick(audio); }
  if (consumePress(input, 'mission-3')) { game.selectedMission = 2; playClick(audio); }
  if (consumePress(input, 'click')) {
    const idx = missionCardAt(game, input.mouse.x * w, input.mouse.y * h, w, h);
    if (idx >= 0) { game.selectedMission = idx; playClick(audio); }
    else { startAudio(audio); startMission(game, game.selectedMission, audio); }
  }
  if (consumePress(input, 'confirm')) { startAudio(audio); startMission(game, game.selectedMission, audio); }
}

function handlePlayInput() {
  if (consumePress(input, 'pause')) { game.mode = 'paused'; return; }
  if (consumePress(input, 'restart')) { startMission(game, game.selectedMission, audio); return; }
  if (consumePress(input, 'mute')) { toggleMute(audio); return; }
  const stick = readStick(input);
  updateGame(game, stick, 1 / 60, audio);
  updateAudio(audio, game.plane, true);
}

let last = performance.now();
let frames = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const w = window.innerWidth, h = window.innerHeight;
  if (game.mode === 'title') handleMenuInput(w, h);
  else if (game.mode === 'play') handlePlayInput();
  else if (game.mode === 'paused') {
    if (consumePress(input, 'pause')) game.mode = 'play';
    if (consumePress(input, 'restart')) startMission(game, game.selectedMission, audio);
  } else if (game.mode === 'over') {
    if (consumePress(input, 'restart') || consumePress(input, 'confirm')) startMission(game, game.selectedMission, audio);
    if (consumePress(input, 'click')) startMission(game, game.selectedMission, audio);
  }
  if (consumePress(input, 'mute')) toggleMute(audio);
  // Live status line for screen readers.
  if (frames % 30 === 0) {
    statusEl.textContent = game.mode === 'play'
      ? `Flying ${game.mission.name}: score ${game.score}, rings ${game.ringsPassed} of ${game.rings.length}, fuel ${Math.round(game.plane.fuel)} percent.`
      : `Skyward Run, ${game.mode}.`;
  }
  renderFrame(ctx, w, h, game, now / 1000);
  frames++;
  if (frames === 3) window.__shotReady = true;
  requestAnimationFrame(frame);
}

applyShotScene();
if (!shot) window.__shotReady = true;
requestAnimationFrame(frame);
