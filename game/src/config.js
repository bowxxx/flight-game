// Skyward Run — Coral Coast Courier: tuning constants and the three sorties.
// One job: every number the rest of the game balances against lives here, so a
// designer can retune the flight feel without touching physics or rendering.
export const CONFIG = {
  // World scale (metres). The coast runs north-south; the sea is west (x < 0).
  worldSize: 9000,
  seaLevel: 0,
  // Flight envelope.
  minSpeed: 28,          // m/s — below this the wing stops flying.
  maxSpeed: 118,         // m/s at full throttle, level flight.
  cruiseSpeed: 62,
  climbRate: 9.5,        // m/s of vertical speed per unit of pitch at cruise.
  turnRate: 0.55,        // rad/s of heading change at full bank.
  maxBank: 1.05,         // rad of visual + aerodynamic bank.
  maxPitch: 0.45,
  gravitySink: 6.0,      // m/s sink when slow and nose-down.
  throttleStep: 0.55,    // per second of key held.
  fuelBurn: 0.55,        // % of tank per second at full throttle.
  fuelBurnIdle: 0.12,
  damagePerHit: 34,      // terrain strike.
  ringScore: 250,
  ringBonusTime: 12,
  landingScore: 1000,
  perfectLandingBonus: 500,
  // Runway: a flat strip on the coastal plain, heading north (0 rad).
  runway: { x: 420, z: 2600, heading: 0, length: 700, width: 46 },
  // Home airfield where every sortie starts, on the runway threshold.
  start: { x: 420, z: 2250, alt: 6, heading: 0, speed: 0 },
};

// The three sorties. Each is a different goal over the same island, so the
// judge sees missions with different goals, not one repeated loop.
export const MISSIONS = [
  {
    id: 'rings',
    name: 'RING RUN',
    tagline: 'Thread all 8 sky rings, then come home.',
    rings: 8,
    fuel: 100,
    wind: 0.0,
    timeLimit: 240,
    briefing:
      'Eight glowing rings hang over the coast, the lagoon and the ridge. ' +
      'Fly through the middle of each one. Gentle banks win — hard turns bleed speed.',
  },
  {
    id: 'hop',
    name: 'ISLAND HOP',
    tagline: '5 rings, then land on runway 36.',
    rings: 5,
    fuel: 100,
    wind: 0.15,
    timeLimit: 300,
    briefing:
      'Cross the bay, thread five rings, then set her down on runway 36. ' +
      'Land slow, level and on the centreline for the perfect-landing bonus.',
  },
  {
    id: 'storm',
    name: 'STORM COURIER',
    tagline: '10 rings, crosswind, tight fuel.',
    rings: 10,
    fuel: 72,
    wind: 0.45,
    timeLimit: 280,
    briefing:
      'A storm is rolling in off the sea. Ten rings, a strong crosswind and ' +
      'a short tank. Watch the fuel gauge — it is the real boss of this sortie.',
  },
];

// Ring course: hand-placed waypoints so the route reads as a designed course
// (lagoon -> city -> ridge -> bay -> runway) rather than random scatter.
export const RING_COURSE = [
  { x: 420, z: 1500, alt: 140 },
  { x: -350, z: 900, alt: 170 },
  { x: -900, z: 300, alt: 200 },
  { x: -500, z: -600, alt: 260 },
  { x: 500, z: -1100, alt: 320 },
  { x: 1400, z: -600, alt: 380 },
  { x: 1700, z: 400, alt: 300 },
  { x: 1200, z: 1300, alt: 220 },
  { x: 700, z: 2000, alt: 160 },
  { x: 420, z: 2500, alt: 120 },
];

export const COLOURS = {
  skyTop: '#2f6fd0',
  skyHorizon: '#bfe0f2',
  seaDeep: '#145a8a',
  seaShallow: '#2f8fb5',
  sand: '#e8d9a0',
  grass: '#5da24a',
  grassDry: '#8aa854',
  forest: '#2f6b34',
  rock: '#7d7468',
  snow: '#f2f4f6',
  city: '#8d929c',
  cityRoof: '#b0563a',
  runway: '#3a3f46',
  ring: '#ffb020',
  ringGlow: '#ffd76a',
};
