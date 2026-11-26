// Procedural Coral Coast: the island the game flies over, generated from a
// fixed seed so every pilot flies the same recognisable terrain — sea to the
// west, a sandy coast, a river plain with a little city, and a snowy ridge
// to the east. No images: every colour is computed from height and place.
import { CONFIG, COLOURS } from './config.js';

// Tiny deterministic RNG (mulberry32) so the island never changes shape.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth value noise on a grid, bilinearly interpolated.
function makeNoise(seed, cell) {
  const rng = makeRng(seed);
  const grid = new Map();
  const corner = (ix, iz) => {
    const key = ix + ',' + iz;
    if (!grid.has(key)) grid.set(key, rng());
    return grid.get(key);
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, z) => {
    const gx = x / cell, gz = z / cell;
    const ix = Math.floor(gx), iz = Math.floor(gz);
    const fx = smooth(gx - ix), fz = smooth(gz - iz);
    const a = corner(ix, iz), b = corner(ix + 1, iz);
    const c = corner(ix, iz + 1), d = corner(ix + 1, iz + 1);
    return (a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz) * 2 - 1;
  };
}

const n1 = makeNoise(1337, 900);
const n2 = makeNoise(4242, 320);
const n3 = makeNoise(9001, 110);

// The river: a sine bend running from the ridge down to the sea.
export function riverX(z) {
  return 950 + 260 * Math.sin(z * 0.00045) + 120 * Math.sin(z * 0.0013 + 2.0);
}
export function nearRiver(x, z) {
  return Math.abs(x - riverX(z)) < 55;
}

// Height in metres above sea level at world (x, z).
export function terrainHeight(x, z) {
  // Coast: land rises as x grows east of the shoreline near x = -650.
  const coast = (x + 650) / 900;
  let h = coast * 90;
  h += n1(x, z) * 55 + n2(x, z) * 26 + n3(x, z) * 9;
  // Eastern ridge: big mountains for x beyond 1500, capped so the far
  // edge of the chart never becomes a wall of impossible height.
  const ridge = Math.min(1.3, Math.max(0, (x - 1400) / 900));
  h += ridge * ridge * 200 + n2(x * 1.7, z * 1.7) * 40 * ridge;
  // Flatten the airfield shelf around the runway so landings are fair.
  const rw = CONFIG.runway;
  const dRun = Math.hypot(x - rw.x, z - rw.z);
  const flat = Math.max(0, 1 - dRun / 900);
  h = h * (1 - flat) + 18 * flat;
  // River carves a shallow valley.
  const dRiver = Math.abs(x - riverX(z));
  if (dRiver < 160) h -= (1 - dRiver / 160) * 14;
  return h;
}

export function terrainType(x, z) {
  const h = terrainHeight(x, z);
  if (h < 2) return 'sea';
  if (h < 7) return 'sand';
  if (nearRiver(x, z) && h < 60) return 'river';
  if (h > 380) return 'snow';
  if (h > 220) return 'rock';
  if (n2(x * 2.1, z * 2.1) > 0.35 && h > 40) return 'forest';
  if (n1(x * 0.7 + 40, z * 0.7) > 0.1) return 'dry';
  return 'grass';
}

export function terrainColour(x, z) {
  const t = terrainType(x, z);
  const shade = 0.92 + 0.16 * n3(x * 3.0, z * 3.0);
  const base = {
    sea: COLOURS.seaDeep, sand: COLOURS.sand, river: COLOURS.seaShallow,
    grass: COLOURS.grass, dry: COLOURS.grassDry, forest: COLOURS.forest,
    rock: COLOURS.rock, snow: COLOURS.snow,
  }[t];
  return shadeColour(base, shade);
}

function shadeColour(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

// The little city beside the airfield: fixed boxes the renderer draws in 3D.
export function buildCity() {
  const rng = makeRng(777);
  const boxes = [];
  for (let i = 0; i < 42; i++) {
    const x = 700 + rng() * 700;
    const z = 1900 + rng() * 1100;
    const w = 26 + rng() * 34;
    const d = 26 + rng() * 34;
    const h = 14 + rng() * rng() * 66;
    boxes.push({ x, z, w, d, h, roof: rng() > 0.6 });
  }
  // A lighthouse on the point, west of the bay — a landmark pilots steer by.
  boxes.push({ x: -620, z: 700, w: 18, d: 18, h: 52, roof: false, lighthouse: true });
  return boxes;
}

// Distant mountain silhouettes for the horizon backdrop (angle -> height).
export function horizonRidge(angle) {
  return 0.5 + 0.5 * n1(Math.cos(angle) * 900, Math.sin(angle) * 900);
}
