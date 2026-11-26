// Flight physics for the courier plane "Kestrel": throttle, pitch, bank and
// heading, with stall, wind drift and a fair landing model. Pure numbers in,
// new state out — no drawing here, so the model can be tested on its own.
import { CONFIG } from './config.js';
import { terrainHeight } from './terrain.js';

export function createPlane(mission) {
  const s = CONFIG.start;
  return {
    x: s.x, z: s.z, alt: s.alt,
    heading: s.heading, pitch: 0, bank: 0,
    speed: 0, throttle: 0,
    verticalSpeed: 0,
    fuel: mission.fuel, damage: 0,
    onGround: true, landed: false, crashed: false,
    crashCooldown: 0,
    windPush: 0,
  };
}

// One physics step. `input` is { pitch: -1..1, roll: -1..1, throttle: -1..1,
// brake: bool } where pitch +1 is nose-up. Returns events for sound/score.
export function stepPlane(p, input, mission, dt) {
  const events = [];
  const wind = mission.wind * 14; // m/s crosswind from the sea (west).
  p.crashCooldown = Math.max(0, (p.crashCooldown || 0) - dt);

  // Throttle: keys and mouse wheel both feed the same lever.
  p.throttle = Math.max(0, Math.min(1, p.throttle + input.throttle * CONFIG.throttleStep * dt));
  const targetSpeed = p.throttle * CONFIG.maxSpeed;
  // Speed chases the throttle target, faster when diving, slower climbing.
  const accel = 14 + Math.max(0, -p.pitch) * 10 - Math.max(0, p.pitch) * 8;
  p.speed += Math.max(-accel, Math.min(accel, targetSpeed - p.speed)) * dt * 0.9;
  if (input.brake) p.speed = Math.max(0, p.speed - 26 * dt);

  // Bank follows the roll input; heading follows the bank.
  const bankTarget = input.roll * CONFIG.maxBank;
  p.bank += (bankTarget - p.bank) * Math.min(1, dt * 3.2);
  p.heading += -p.bank * CONFIG.turnRate * dt * (0.4 + 0.6 * (p.speed / CONFIG.maxSpeed));
  // Pitch follows the stick, softened at very low speed.
  const pitchAuthority = Math.min(1, p.speed / 45);
  const pitchTarget = input.pitch * CONFIG.maxPitch * pitchAuthority;
  p.pitch += (pitchTarget - p.pitch) * Math.min(1, dt * 2.6);

  // Vertical speed: pitch lifts, speed feeds it, slow flight sinks.
  const lift = Math.sin(p.pitch) * p.speed;
  const sink = p.speed < CONFIG.minSpeed + 6 ? CONFIG.gravitySink * (1 - p.speed / (CONFIG.minSpeed + 6)) : 0;
  p.verticalSpeed = lift - sink;
  p.alt += p.verticalSpeed * dt;

  // Forward motion + crosswind drift.
  const dx = Math.sin(p.heading) * p.speed * dt + wind * dt;
  const dz = Math.cos(p.heading) * p.speed * dt;
  p.x += dx; p.z += dz;
  p.windPush = wind;

  // Fuel: throttle burns it; running dry means gliding home on fumes.
  const burn = (CONFIG.fuelBurnIdle + (CONFIG.fuelBurn - CONFIG.fuelBurnIdle) * p.throttle) * dt;
  p.fuel = Math.max(0, p.fuel - burn);
  if (p.fuel <= 0 && p.throttle > 0) { p.throttle = 0; events.push('fuel-empty'); }

  // Ground contact.
  const ground = terrainHeight(p.x, p.z);
  const clearance = p.alt - ground;
  if (clearance <= 0) {
    p.alt = ground;
    if (p.onGround && p.speed < 12) {
      p.onGround = true; // rolling on the strip / field.
    } else if (p.onGround) {
      p.onGround = true;
    } else {
      // Airborne contact: judge it as a landing or a crash.
      const runway = CONFIG.runway;
      const along = Math.cos(runway.heading) * (p.z - runway.z) + Math.sin(runway.heading) * (p.x - runway.x);
      const across = -Math.sin(runway.heading) * (p.z - runway.z) + Math.cos(runway.heading) * (p.x - runway.x);
      const onStrip = Math.abs(along) < runway.length / 2 && Math.abs(across) < runway.width / 2;
      const gentle = p.verticalSpeed > -4.5 && Math.abs(p.bank) < 0.35 && p.speed < 52 && p.speed > 18;
      if (onStrip && gentle) {
        p.landed = true; p.onGround = true;
        events.push(Math.abs(p.verticalSpeed) < 2 && Math.abs(across) < 8 ? 'perfect-landing' : 'landing');
      } else if (p.crashCooldown <= 0) {
        // A strike costs damage once, then a short grace period so one
        // hillside does not kill the plane in a single bounce.
        p.damage += CONFIG.damagePerHit;
        p.crashCooldown = 1.5;
        events.push('crash-hit');
        if (p.damage >= 100) { p.crashed = true; events.push('crashed'); }
        else { p.speed *= 0.4; p.alt = ground + 2; }
      } else {
        p.alt = ground + 2;
      }
    }
  } else if (clearance > 1.5) {
    p.onGround = false;
  }

  // Stall warning: slow, nose-high flight.
  if (!p.onGround && p.speed < CONFIG.minSpeed + 4) events.push('stall');
  // Keep the plane inside the charted island.
  const R = CONFIG.worldSize / 2;
  p.x = Math.max(-R, Math.min(R, p.x));
  p.z = Math.max(-R, Math.min(R, p.z));
  return events;
}

export function planeState(p) {
  return {
    altitudeFt: Math.round(p.alt * 3.28084),
    speedKt: Math.round(p.speed * 1.94384),
    headingDeg: Math.round(((p.heading * 180 / Math.PI) % 360 + 360) % 360),
    verticalFpm: Math.round(p.verticalSpeed * 196.85),
  };
}
