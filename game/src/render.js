// Renderer: draws the whole chase view on one canvas — sky, sun, clouds and
// distant ridge, the procedural terrain as perspective strips, the city, the
// runway and the glowing rings, then the Kestrel herself, the cockpit panel
// and the HUD. No images: every pixel is drawn from the world model.
import { CONFIG, COLOURS, MISSIONS } from './config.js';
import { terrainHeight, terrainColour, buildCity, horizonRidge } from './terrain.js';
import { planeState } from './plane.js';

const CITY = buildCity();

// Camera projection: world point -> screen, or null when behind the camera.
export function project(cam, x, y, z, w, h) {
  const sinH = Math.sin(cam.heading), cosH = Math.cos(cam.heading);
  const dx = x - cam.x, dz = z - cam.z;
  const fwd = dx * sinH + dz * cosH;
  const rgt = dx * cosH - dz * sinH;
  const upv = y - cam.y;
  const cosP = Math.cos(cam.pitch), sinP = Math.sin(cam.pitch);
  const fwd2 = fwd * cosP + upv * sinP;
  const up2 = upv * cosP - fwd * sinP;
  if (fwd2 < 6) return null;
  const f = h * 0.9;
  return { x: w / 2 + (rgt / fwd2) * f, y: h * 0.46 - (up2 / fwd2) * f, depth: fwd2 };
}

function skyGradient(ctx, w, h, pitch) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const shift = Math.max(-0.25, Math.min(0.35, pitch));
  g.addColorStop(0, COLOURS.skyTop);
  g.addColorStop(Math.max(0.15, 0.5 - shift), COLOURS.skyHorizon);
  g.addColorStop(1, '#7fb2d9');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawSunAndClouds(ctx, w, h, cam, time) {
  const sun = project(cam, cam.x - 2600, cam.y + 900, cam.z + 1800, w, h);
  if (sun) {
    const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 90);
    glow.addColorStop(0, 'rgba(255,244,200,0.95)');
    glow.addColorStop(0.35, 'rgba(255,220,120,0.55)');
    glow.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sun.x - 95, sun.y - 95, 190, 190);
    ctx.fillStyle = '#fff7d6';
    ctx.beginPath(); ctx.arc(sun.x, sun.y, 17, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 9; i++) {
    const baseX = ((i * 173 + 60 - cam.heading * 900 + time * (3 + i)) % (w + 320)) - 160;
    const cy = 40 + ((i * 67) % 150) - cam.pitch * 260;
    const s = 26 + (i % 3) * 14;
    ctx.beginPath();
    ctx.ellipse(baseX, cy, s * 1.8, s * 0.55, 0, 0, Math.PI * 2);
    ctx.ellipse(baseX + s, cy + 5, s * 1.3, s * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRidge(ctx, w, h, cam) {
  ctx.fillStyle = 'rgba(96,118,150,0.55)';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.46);
  for (let sx = 0; sx <= w; sx += 16) {
    const angle = cam.heading + (sx / w - 0.5) * 1.5;
    const ridge = horizonRidge(angle);
    ctx.lineTo(sx, h * 0.46 - ridge * 46 + cam.pitch * 300);
  }
  ctx.lineTo(w, h * 0.46);
  ctx.closePath();
  ctx.fill();
}

function drawTerrain(ctx, w, h, cam) {
  const rows = [];
  let d = 55;
  while (d < 3600) { rows.push(d); d *= 1.16; }
  const sinH = Math.sin(cam.heading), cosH = Math.cos(cam.heading);
  const px = cosH, pz = -sinH;
  const COLS = 15;
  const strip = [];
  for (let r = rows.length - 1; r >= 0; r--) {
    const dist = rows[r];
    const cxw = cam.x + sinH * dist, czw = cam.z + cosH * dist;
    const half = dist * 1.05; // wider than the view frustum so no sky gaps at the edges.
    const pts = [];
    for (let c = 0; c < COLS; c++) {
      const lat = -half + (2 * half * c) / (COLS - 1);
      const wx = cxw + px * lat, wz = czw + pz * lat;
      const ground = terrainHeight(wx, wz);
      const y = Math.max(ground, 0.4);
      const sp = project(cam, wx, y, wz, w, h);
      pts.push({ sp, wx, wz, ground });
    }
    strip.push({ dist, pts });
    const near = strip.length > 1 ? strip[strip.length - 2] : null;
    if (near && pts[0].sp && near.pts[0].sp) {
      for (let c = 0; c < COLS - 1; c++) {
        const a = pts[c], b = pts[c + 1], na = near.pts[c], nb = near.pts[c + 1];
        if (!a.sp || !b.sp || !na.sp || !nb.sp) continue;
        const mx = (a.wx + b.wx) / 2, mz = (a.wz + b.wz) / 2;
        ctx.fillStyle = terrainColour(mx, mz);
        ctx.beginPath();
        ctx.moveTo(a.sp.x, a.sp.y); ctx.lineTo(b.sp.x, b.sp.y);
        ctx.lineTo(nb.sp.x, nb.sp.y); ctx.lineTo(na.sp.x, na.sp.y);
        ctx.closePath(); ctx.fill();
      }
    }
  }
}

function drawCity(ctx, w, h, cam) {
  const boxes = CITY
    .map((b) => ({ b, d: Math.hypot(b.x - cam.x, b.z - cam.z) }))
    .filter((e) => e.d < 2200 && e.d > 30)
    .sort((a, z) => z.d - a.d);
  for (const { b } of boxes) {
    const hw = b.w / 2, hd = b.d / 2;
    const baseY = terrainHeight(b.x, b.z); // sit the box on the ground, not on sea level.
    const corners = [
      [b.x - hw, b.z - hd], [b.x + hw, b.z - hd], [b.x + hw, b.z + hd], [b.x - hw, b.z + hd],
    ];
    const top = corners.map(([x, z]) => project(cam, x, baseY + b.h, z, w, h));
    const base = corners.map(([x, z]) => project(cam, x, baseY, z, w, h));
    if (top.some((p) => !p) || base.some((p) => !p)) continue;
    ctx.fillStyle = b.lighthouse ? '#e8e4d8' : '#7d838e';
    ctx.beginPath();
    ctx.moveTo(base[0].x, base[0].y); ctx.lineTo(top[0].x, top[0].y);
    ctx.lineTo(top[1].x, top[1].y); ctx.lineTo(base[1].x, base[1].y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = b.lighthouse ? '#c23b2e' : '#6a707b';
    ctx.beginPath();
    ctx.moveTo(base[1].x, base[1].y); ctx.lineTo(top[1].x, top[1].y);
    ctx.lineTo(top[2].x, top[2].y); ctx.lineTo(base[2].x, base[2].y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = b.lighthouse ? '#c23b2e' : (b.roof ? COLOURS.cityRoof : COLOURS.city);
    ctx.beginPath();
    top.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath(); ctx.fill();
  }
}

function drawRunway(ctx, w, h, cam) {
  const rw = CONFIG.runway;
  const sinR = Math.sin(rw.heading), cosR = Math.cos(rw.heading);
  const hw = rw.width / 2, hl = rw.length / 2;
  const corner = (a, c) => ({
    x: rw.x + sinR * a + cosR * c,
    z: rw.z + cosR * a - sinR * c,
  });
  const c1 = corner(-hl, -hw), c2 = corner(hl, -hw), c3 = corner(hl, hw), c4 = corner(-hl, hw);
  const p1 = project(cam, c1.x, 0.5, c1.z, w, h), p2 = project(cam, c2.x, 0.5, c2.z, w, h);
  const p3 = project(cam, c3.x, 0.5, c3.z, w, h), p4 = project(cam, c4.x, 0.5, c4.z, w, h);
  if (!p1 || !p2 || !p3 || !p4) return;
  ctx.fillStyle = COLOURS.runway;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#f5f5f0'; ctx.lineWidth = 2;
  for (let a = -hl + 40; a < hl - 20; a += 70) {
    const s = project(cam, corner(a, 0).x, 0.7, corner(a, 0).z, w, h);
    const e = project(cam, corner(a + 34, 0).x, 0.7, corner(a + 34, 0).z, w, h);
    if (s && e) { ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke(); }
  }
  ctx.fillStyle = '#ffb020';
  for (let a = -hl; a <= hl; a += 90) {
    for (const c of [-hw - 3, hw + 3]) {
      const p = project(cam, corner(a, c).x, 1.2, corner(a, c).z, w, h);
      if (p) { ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  const label = project(cam, rw.x, 6, rw.z + hl + 60, w, h);
  if (label) {
    ctx.fillStyle = 'rgba(10,20,30,0.65)';
    ctx.fillRect(label.x - 52, label.y - 14, 104, 22);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('RUNWAY 36', label.x, label.y + 2);
  }
}


// ---- rings, plane, cockpit and HUD (appended to render.js) ----
function drawRings(ctx, w, h, cam, rings, nextIndex) {
  rings.forEach((ring, i) => {
    if (ring.passed) return;
    const p = project(cam, ring.x, ring.alt, ring.z, w, h);
    if (!p || p.depth > 3200) return;
    const radius = Math.max(4, (h * 0.9 * ring.radius) / p.depth);
    const isNext = i === nextIndex;
    ctx.save();
    ctx.shadowColor = isNext ? COLOURS.ringGlow : '#7fd4ff';
    ctx.shadowBlur = isNext ? 22 : 8;
    ctx.strokeStyle = isNext ? COLOURS.ring : 'rgba(190,235,255,0.9)';
    ctx.lineWidth = isNext ? 7 : 4;
    ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, radius * 0.72, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    if (isNext && radius > 26) {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`RING ${i + 1} · ${Math.round(p.depth)} m`, p.x, p.y - radius - 10);
    }
  });
  // Off-screen guidance arrow toward the next ring.
  const next = rings[nextIndex];
  if (next) {
    const p = project(cam, next.x, next.alt, next.z, w, h);
    if (!p) {
      const dx = next.x - cam.x, dz = next.z - cam.z;
      const ang = Math.atan2(dx * Math.cos(cam.heading) - dz * Math.sin(cam.heading),
        dx * Math.sin(cam.heading) + dz * Math.cos(cam.heading));
      const ax = w / 2 + Math.sin(ang) * w * 0.34;
      const ay = h * 0.30 + -Math.cos(ang) * h * 0.12;
      ctx.save();
      ctx.translate(Math.max(40, Math.min(w - 40, ax)), Math.max(60, Math.min(h - 260, ay)));
      ctx.rotate(Math.atan2(Math.sin(ang), Math.cos(ang)) + Math.PI / 2);
      ctx.fillStyle = COLOURS.ring;
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(12, 10); ctx.lineTo(-12, 10); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`NEXT RING ${Math.round(Math.hypot(dx, dz))} m`, Math.max(70, Math.min(w - 70, ax)), Math.max(80, Math.min(h - 240, ay)) + 26);
    }
  }
}

function drawPlane(ctx, w, h, plane, time) {
  // Chase view: the Kestrel seen from just behind and above, banking with
  // the stick. She sits low in the frame so the world stays the star.
  const cx = w / 2, cy = h * 0.78;
  const scale = Math.min(w, h) / 720;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.bank * 0.85);
  ctx.scale(scale, scale);
  // Propeller blur at the nose (far end, small).
  ctx.fillStyle = 'rgba(200,210,220,0.35)';
  ctx.beginPath(); ctx.ellipse(0, -118, 10, 26, 0, 0, Math.PI * 2); ctx.fill();
  // Main wings.
  ctx.fillStyle = '#c23b2e';
  ctx.beginPath();
  ctx.moveTo(-150, -52); ctx.lineTo(150, -52); ctx.lineTo(128, -18); ctx.lineTo(-128, -18);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8e4d8';
  ctx.fillRect(-150, -50, 300, 7);
  // Fuselage.
  const fus = ctx.createLinearGradient(-16, 0, 16, 0);
  fus.addColorStop(0, '#8f1f16'); fus.addColorStop(0.5, '#d94a35'); fus.addColorStop(1, '#8f1f16');
  ctx.fillStyle = fus;
  ctx.beginPath();
  ctx.moveTo(0, -128);
  ctx.quadraticCurveTo(20, -70, 15, 10);
  ctx.quadraticCurveTo(12, 62, 0, 66);
  ctx.quadraticCurveTo(-12, 62, -15, 10);
  ctx.quadraticCurveTo(-20, -70, 0, -128);
  ctx.fill();
  // Canopy glint.
  ctx.fillStyle = 'rgba(180,225,245,0.9)';
  ctx.beginPath(); ctx.ellipse(0, -58, 8, 22, 0, 0, Math.PI * 2); ctx.fill();
  // Tail fin and stabilisers.
  ctx.fillStyle = '#a32c20';
  ctx.beginPath(); ctx.moveTo(0, 66); ctx.lineTo(-9, 96); ctx.lineTo(9, 96); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c23b2e';
  ctx.fillRect(-52, 52, 104, 10);
  // Navigation lights, blinking.
  if (Math.floor(time * 2) % 2 === 0) {
    ctx.fillStyle = '#ff3b30'; ctx.beginPath(); ctx.arc(-152, -36, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2fd94a'; ctx.beginPath(); ctx.arc(152, -36, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawGauge(ctx, x, y, r, label, drawNeedle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(8,16,26,0.82)';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#5a6b7d'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#9fb4c6'; ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(label, 0, r + 13);
  drawNeedle(ctx, r);
  ctx.restore();
}

function drawCockpit(ctx, w, h, plane, mission, time) {
  const st = planeState(plane);
  const panelY = h - 108;
  // Panel body.
  const g = ctx.createLinearGradient(0, panelY, 0, h);
  g.addColorStop(0, '#1c2733'); g.addColorStop(1, '#0a121b');
  ctx.fillStyle = g;
  ctx.fillRect(0, panelY, w, 108);
  ctx.fillStyle = '#2c3a48'; ctx.fillRect(0, panelY, w, 3);
  const cy = panelY + 48;
  // Artificial horizon: sky and ground split by bank and pitch.
  drawGauge(ctx, 76, cy, 34, 'ATTITUDE', (c, r) => {
    c.save();
    c.beginPath(); c.arc(0, 0, r - 3, 0, Math.PI * 2); c.clip();
    c.rotate(-plane.bank);
    c.translate(0, plane.pitch * 60);
    c.fillStyle = '#3f8fd2'; c.fillRect(-r, -r, r * 2, r);
    c.fillStyle = '#7a5a34'; c.fillRect(-r, 0, r * 2, r);
    c.fillStyle = '#fff'; c.fillRect(-r, -1, r * 2, 2);
    c.restore();
    c.strokeStyle = '#ffd76a'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-12, 0); c.lineTo(12, 0); c.stroke();
  });
  // Airspeed dial.
  drawGauge(ctx, 168, cy, 34, 'AIRSPEED kt', (c, r) => {
    const a = -Math.PI * 0.75 + (Math.min(140, st.speedKt) / 140) * Math.PI * 1.5;
    c.strokeStyle = '#ffd76a'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * (r - 6), Math.sin(a) * (r - 6)); c.stroke();
    c.fillStyle = '#fff'; c.font = 'bold 13px system-ui, sans-serif';
    c.fillText(String(st.speedKt), 0, 5);
  });
  // Altimeter dial.
  drawGauge(ctx, 260, cy, 34, 'ALTITUDE ft', (c, r) => {
    const a = -Math.PI * 0.75 + ((st.altitudeFt % 1000) / 1000) * Math.PI * 1.5;
    c.strokeStyle = '#7fd4ff'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * (r - 6), Math.sin(a) * (r - 6)); c.stroke();
    c.fillStyle = '#fff'; c.font = 'bold 12px system-ui, sans-serif';
    c.fillText(String(st.altitudeFt), 0, 5);
  });
  // Heading compass tape.
  const compassX = w / 2 - 190, compassW = 380;
  ctx.fillStyle = 'rgba(8,16,26,0.82)';
  ctx.fillRect(compassX, cy - 26, compassW, 52);
  ctx.strokeStyle = '#5a6b7d'; ctx.strokeRect(compassX, cy - 26, compassW, 52);
  ctx.save();
  ctx.beginPath(); ctx.rect(compassX, cy - 26, compassW, 52); ctx.clip();
  for (let d = -180; d <= 180; d += 15) {
    const hd = (st.headingDeg + d + 360) % 360;
    const x = compassX + compassW / 2 + (d / 15) * 26;
    ctx.strokeStyle = '#9fb4c6';
    ctx.beginPath(); ctx.moveTo(x, cy - 12); ctx.lineTo(x, cy + 2); ctx.stroke();
    if (d % 45 === 0) {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
      const names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
      ctx.fillText(names[hd] || String(hd).padStart(3, '0'), x, cy + 18);
    }
  }
  ctx.restore();
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath(); ctx.moveTo(w / 2, cy - 26); ctx.lineTo(w / 2 - 6, cy - 34); ctx.lineTo(w / 2 + 6, cy - 34); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#9fb4c6'; ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('HEADING', w / 2, cy + 40);
  // Fuel gauge (right) and throttle lever.
  const fuelX = w - 168;
  drawGauge(ctx, fuelX, cy, 34, 'FUEL', (c, r) => {
    const a = -Math.PI * 0.75 + (plane.fuel / 100) * Math.PI * 1.5;
    c.strokeStyle = plane.fuel < 25 ? '#ff5a4a' : '#2fd94a'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * (r - 6), Math.sin(a) * (r - 6)); c.stroke();
    c.fillStyle = '#fff'; c.font = 'bold 12px system-ui, sans-serif';
    c.fillText(Math.round(plane.fuel) + '%', 0, 5);
  });
  const thrX = w - 76;
  ctx.fillStyle = 'rgba(8,16,26,0.82)'; ctx.fillRect(thrX - 22, cy - 30, 44, 60);
  ctx.strokeStyle = '#5a6b7d'; ctx.strokeRect(thrX - 22, cy - 30, 44, 60);
  ctx.fillStyle = '#3f8fd2'; ctx.fillRect(thrX - 3, cy + 24 - plane.throttle * 48, 6, 8);
  ctx.fillStyle = '#ffd76a'; ctx.fillRect(thrX - 12, cy + 24 - plane.throttle * 48, 24, 4);
  ctx.fillStyle = '#9fb4c6'; ctx.font = 'bold 9px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('THROTTLE', thrX, cy + 44);
  // Stall + low-fuel warnings, lit amber/red.
  if (plane.fuel < 25) {
    ctx.fillStyle = Math.floor(time * 3) % 2 ? '#ff5a4a' : '#ff8a7a';
    ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('LOW FUEL', w - 168, panelY - 8);
  }
}

function drawHud(ctx, w, h, game) {
  const st = planeState(game.plane);
  ctx.textAlign = 'left';
  // Top-left instrument block: altitude, speed, heading — always lit.
  ctx.fillStyle = 'rgba(6,14,24,0.72)';
  ctx.fillRect(14, 12, 250, 92);
  ctx.strokeStyle = 'rgba(127,212,255,0.5)'; ctx.strokeRect(14, 12, 250, 92);
  ctx.fillStyle = '#7fd4ff'; ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('ALTITUDE', 26, 32); ctx.fillText('AIRSPEED', 26, 58); ctx.fillText('HEADING', 26, 84);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 20px system-ui, monospace';
  ctx.fillText(`${st.altitudeFt.toLocaleString()} ft`, 120, 34);
  ctx.fillText(`${st.speedKt} kt`, 120, 60);
  ctx.fillText(`${String(st.headingDeg).padStart(3, '0')}°  ${st.verticalFpm >= 0 ? '+' : ''}${st.verticalFpm} fpm`, 120, 86);
  // Top-right: mission, score, rings, clock.
  ctx.fillStyle = 'rgba(6,14,24,0.72)';
  ctx.fillRect(w - 264, 12, 250, 92);
  ctx.strokeStyle = 'rgba(255,215,106,0.5)'; ctx.strokeRect(w - 264, 12, 250, 92);
  ctx.fillStyle = '#ffd76a'; ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(game.mission.name, w - 252, 32);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(`SCORE ${game.score.toLocaleString()}`, w - 252, 58);
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`RINGS ${game.ringsPassed}/${game.rings.length}   TIME ${Math.max(0, Math.ceil(game.timeLeft))}s`, w - 252, 82);
  // Centre message line (ring scored, stall warning, etc).
  if (game.banner && game.bannerUntil > game.time) {
    ctx.fillStyle = 'rgba(6,14,24,0.7)';
    const tw = ctx.measureText(game.banner).width;
    ctx.fillRect(w / 2 - tw / 2 - 14, h * 0.16, tw + 28, 34);
    ctx.fillStyle = '#ffd76a'; ctx.font = 'bold 18px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(game.banner, w / 2, h * 0.16 + 23);
    ctx.textAlign = 'left';
  }
}

function drawTitle(ctx, w, h, game, time) {
  ctx.fillStyle = 'rgba(6,16,28,0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('SKYWARD RUN', w / 2, 128);
  ctx.fillStyle = '#ffd76a'; ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('— Coral Coast Courier —', w / 2, 164);
  ctx.fillStyle = '#dfeefc'; ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Fly the Kestrel over a living island: sea, city, river and ridge.', w / 2, 196);
  ctx.fillText('Thread the rings, mind your fuel, and bring her home to runway 36.', w / 2, 220);
  // Mission cards, clickable.
  MISSIONS.forEach((m, i) => {
    const cardW = 300, gap = 24, total = MISSIONS.length * cardW + (MISSIONS.length - 1) * gap;
    const x = w / 2 - total / 2 + i * (cardW + gap);
    const y = 258, cardH = 150;
    const selected = game.selectedMission === i;
    ctx.fillStyle = selected ? 'rgba(255,215,106,0.22)' : 'rgba(10,22,36,0.85)';
    ctx.fillRect(x, y, cardW, cardH);
    ctx.strokeStyle = selected ? '#ffd76a' : '#4a6b85'; ctx.lineWidth = selected ? 3 : 1;
    ctx.strokeRect(x, y, cardW, cardH);
    ctx.fillStyle = '#ffd76a'; ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`${i + 1} · ${m.name}`, w / 2 - total / 2 + i * (cardW + gap) + cardW / 2, y + 32);
    ctx.fillStyle = '#fff'; ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(m.tagline, x + cardW / 2, y + 60);
    ctx.fillStyle = '#bcd6ea'; ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`${m.rings} rings · fuel ${m.fuel}% · ${m.timeLimit}s`, x + cardW / 2, y + 86);
    ctx.fillText(m.wind > 0.3 ? 'Strong crosswind' : m.wind > 0 ? 'Light crosswind' : 'Calm air', x + cardW / 2, y + 108);
  });
  ctx.fillStyle = Math.floor(time * 1.6) % 2 ? '#ffd76a' : '#fff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('CLICK A MISSION, OR PRESS 1 / 2 / 3 — THEN ENTER TO FLY', w / 2, 452);
  ctx.fillStyle = '#bcd6ea'; ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('↑ ↓ pitch · ← → bank · SHIFT / CTRL throttle · mouse: hold + steer · wheel: throttle', w / 2, 492);
  ctx.fillText('SPACE brake · P pause · R restart · M mute', w / 2, 516);
  ctx.fillText('Best score this session: ' + game.bestScore.toLocaleString(), w / 2, 548);
  ctx.textAlign = 'left';
}

function drawPause(ctx, w, h) {
  ctx.fillStyle = 'rgba(6,16,28,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', w / 2, h / 2 - 10);
  ctx.fillStyle = '#bcd6ea'; ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Press P to keep flying · R to restart the sortie', w / 2, h / 2 + 26);
  ctx.textAlign = 'left';
}

function drawEnd(ctx, w, h, game) {
  ctx.fillStyle = 'rgba(6,16,28,0.62)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  const won = game.outcome === 'complete';
  ctx.fillStyle = won ? '#ffd76a' : '#ff8a7a';
  ctx.font = 'bold 46px system-ui, sans-serif';
  ctx.fillText(game.endTitle, w / 2, h / 2 - 90);
  ctx.fillStyle = '#fff'; ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(game.endLine, w / 2, h / 2 - 52);
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(`FINAL SCORE  ${game.score.toLocaleString()}`, w / 2, h / 2 - 4);
  ctx.fillStyle = '#bcd6ea'; ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(`Rings ${game.ringsPassed}/${game.rings.length} · Damage ${Math.round(game.plane.damage)}% · Fuel ${Math.round(game.plane.fuel)}% left`, w / 2, h / 2 + 28);
  ctx.fillText(`Best this session: ${game.bestScore.toLocaleString()}`, w / 2, h / 2 + 54);
  ctx.fillStyle = '#ffd76a'; ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText('Press R for a new sortie, or ENTER to fly again', w / 2, h / 2 + 96);
  ctx.textAlign = 'left';
}

// Main entry: draw one frame for the current game state.
export function renderFrame(ctx, w, h, game, time) {
  const cam = {
    x: game.plane.x, y: game.plane.alt + 5, z: game.plane.z,
    heading: game.plane.heading, pitch: game.plane.pitch * 0.7,
  };
  skyGradient(ctx, w, h, cam.pitch);
  drawSunAndClouds(ctx, w, h, cam, time);
  drawRidge(ctx, w, h, cam);
  drawTerrain(ctx, w, h, cam);
  drawCity(ctx, w, h, cam);
  drawRunway(ctx, w, h, cam);
  if (game.mode === 'play' || game.mode === 'paused' || game.mode === 'over') {
    drawRings(ctx, w, h, cam, game.rings, game.nextRing);
  }
  if (game.mode !== 'title') drawPlane(ctx, w, h, game.plane, time);
  if (game.mode === 'play' || game.mode === 'paused') {
    drawCockpit(ctx, w, h, game.plane, game.mission, time);
    drawHud(ctx, w, h, game);
  }
  if (game.mode === 'title') drawTitle(ctx, w, h, game, time);
  if (game.mode === 'paused') drawPause(ctx, w, h);
  if (game.mode === 'over') drawEnd(ctx, w, h, game);
}

export { MISSIONS };
