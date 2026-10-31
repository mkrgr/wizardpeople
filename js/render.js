'use strict';
// ───────────────────────── Canvas ─────────────────────────
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;
const lightCv = document.createElement('canvas');
const lctx = lightCv.getContext('2d');
const cam = { x: 0, y: 0 };
let stars = [];
const raySprites = {};

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  lightCv.width = Math.ceil(W / 2); lightCv.height = Math.ceil(H / 2);
  stars = [];
  for (let i = 0; i < 220; i++) stars.push({ x: Math.random(), y: Math.random() * 0.7, r: Math.random() < 0.12 ? 2 : 1, sp: rand(0.5, 2), ph: rand(0, 6), b: rand(0.3, 1) });
}

const sx = (x, y) => (x - y) * 32 - cam.x + W / 2;
const sy = (x, y) => (x + y) * 16 - cam.y + H / 2;
const leftPt = (x, y, u, v) => ({ x: x - 32 + 32 * u, y: y + 16 + 16 * u - v });
const rightPt = (x, y, u, v) => ({ x: x + 32 * u, y: y + 32 - 16 * u - v });

function diamondPath(c, x, y) {
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + 32, y + 16); c.lineTo(x, y + 32); c.lineTo(x - 32, y + 16); c.closePath();
}
function poly(pts) {
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath(); ctx.fill();
}
// Quader: (cx,cy) = Mittelpunkt der Grundfläche auf dem Bildschirm
function box(cx, cy, z0, h, hw, hh, top, left, right) {
  const b = z0, t = z0 + h;
  ctx.fillStyle = left; poly([cx - hw, cy - b, cx, cy + hh - b, cx, cy + hh - t, cx - hw, cy - t]);
  ctx.fillStyle = right; poly([cx, cy + hh - b, cx + hw, cy - b, cx + hw, cy - t, cx, cy + hh - t]);
  ctx.fillStyle = top; poly([cx, cy - hh - t, cx + hw, cy - t, cx, cy + hh - t, cx - hw, cy - t]);
}
function quadPath(P, x, y, u0, u1, v0, v1) {
  const a = P(x, y, u0, v0), b = P(x, y, u1, v0), c = P(x, y, u1, v1), d = P(x, y, u0, v1);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
}
function ellipse(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
function glow(c, x, y, r, color, a = 1) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
}

// ───────────────────────── Himmel & Nordlicht ─────────────────────────
function raySprite(color) {
  if (raySprites[color]) return raySprites[color];
  const c = document.createElement('canvas'); c.width = 4; c.height = 128;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, rgba(color, 0)); g.addColorStop(0.18, rgba(color, 0.9));
  g.addColorStop(0.45, rgba(color, 0.45)); g.addColorStop(1, rgba(color, 0));
  x.fillStyle = g; x.fillRect(0, 0, 4, 128);
  raySprites[color] = c;
  return c;
}
function drawSky(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#02040e'); g.addColorStop(0.45, '#061327'); g.addColorStop(1, '#0b1f35');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (const s of stars) {
    const a = (0.35 + 0.65 * Math.abs(Math.sin(t * s.sp + s.ph))) * s.b;
    ctx.fillStyle = `rgba(225,238,255,${a})`;
    ctx.fillRect(s.x * W, s.y * H, s.r, s.r);
  }
  drawAurora(t);
  drawMountains();
}
function drawAurora(t) {
  const boost = G.auroraBoost;
  const hc = G.profile ? HOUSES[G.profile.house || 'nebelsee'].color : null;
  const bands = [
    { c: '#38ffb0', y: 0.15, a: 0.34, sp: 0.22, ph: 0 },
    { c: '#36d6ff', y: 0.24, a: 0.2, sp: 0.16, ph: 2.1 },
    { c: '#a46bff', y: 0.08, a: 0.16, sp: 0.3, ph: 4.2 },
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const step = 5;
  for (const b of bands) {
    let col = b.c;
    if (boost > 0.02 && hc) col = mixHex(b.c, hc, Math.round(Math.min(1, boost) * 10) / 12);
    const spr = raySprite(col);
    const amp = 1 + boost * 0.9;
    for (let x = -10; x < W + 10; x += step) {
      const wx = x + cam.x * 0.08;
      const yb = H * b.y + Math.sin(wx * 0.0032 + t * b.sp + b.ph) * H * 0.05 + Math.sin(wx * 0.011 - t * b.sp * 1.7) * 14;
      const len = (90 + 60 * Math.sin(wx * 0.019 + t * 0.9 + b.ph) + 45 * Math.sin(wx * 0.005 - t * 0.4)) * amp;
      const al = b.a * (0.3 + 0.7 * Math.pow(Math.sin(wx * 0.012 + t * 0.6 + b.ph), 2)) * (0.75 + 0.25 * amp);
      if (al <= 0.01 || len <= 0) continue;
      ctx.globalAlpha = Math.min(1, al);
      ctx.drawImage(spr, x, yb - len * 0.2, step + 1, len);
    }
  }
  ctx.restore();
}
function drawMountains() {
  for (let l = 0; l < 2; l++) {
    const par = 0.04 + l * 0.05;
    const base = H * (0.46 + l * 0.07) - cam.y * 0.015;
    ctx.fillStyle = l ? '#081323' : '#0f2038';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 8; x += 8) {
      const wx = x + cam.x * par + l * 700;
      const y = base - (Math.abs(Math.sin(wx * 0.0042)) * 95 + Math.abs(Math.sin(wx * 0.0113 + 1.3)) * 45 + Math.sin(wx * 0.031) * 6) * (1 + l * 0.25);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
}

// ───────────────────────── Böden ─────────────────────────
function drawFloor(t, tx, ty, x, y, time) {
  const h = hash(tx, ty);
  let f;
  switch (t) {
    case '.': f = `hsl(218,13%,${26 + h * 7}%)`; break;
    case 'k': f = `hsl(190,12%,${15 + h * 5}%)`; break;
    case 'c': f = `hsl(228,46%,${21 + h * 3}%)`; break;
    case 'b': f = `hsl(214,55%,${28 + h * 3}%)`; break;
    case 'g': f = `hsl(135,38%,${25 + h * 3}%)`; break;
    case 'a': f = `hsl(210,8%,${37 + h * 3}%)`; break;
    case 'r': f = `hsl(4,52%,${28 + h * 3}%)`; break;
    case 's': f = `hsl(207,38%,${80 + h * 8}%)`; break;
    case 'p': f = `hsl(28,36%,${27 + h * 6}%)`; break;
    case 'S': f = '#14171e'; break;
    case 'i': f = `hsl(195,70%,${79 + h * 7}%)`; break;
    case 'w': { const s = Math.sin(time * 1.2 + tx * 0.9 + ty * 0.55) * 0.5 + 0.5; f = `hsl(${197 + s * 6},58%,${12 + s * 5}%)`; break; }
    default: f = '#333';
  }
  diamondPath(ctx, x, y); ctx.fillStyle = f; ctx.fill();
  ctx.lineWidth = 1;
  switch (t) {
    case '.': case 'k':
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.stroke();
      if (h > 0.85) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ellipse(ctx, x + (h - 0.9) * 200, y + 16, 7, 3); }
      break;
    case 'c':
      ctx.strokeStyle = '#d8b65a'; ctx.lineWidth = 1.5; ctx.beginPath();
      if (tx === 20) { ctx.moveTo(x - 27, y + 13.5); ctx.lineTo(x - 5, y + 2.5); }
      if (tx === 23) { ctx.moveTo(x + 5, y + 29.5); ctx.lineTo(x + 27, y + 18.5); }
      ctx.stroke();
      break;
    case 'b': case 'g': case 'a': case 'r':
      ctx.strokeStyle = 'rgba(255,230,160,0.22)'; ctx.beginPath();
      ctx.moveTo(x, y + 7); ctx.lineTo(x + 18, y + 16); ctx.lineTo(x, y + 25); ctx.lineTo(x - 18, y + 16); ctx.closePath(); ctx.stroke();
      break;
    case 's':
      if (hash(tx, ty, 1) > 0.6) {
        const a = 0.5 + 0.5 * Math.sin(time * 3 + h * 20);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(x - 12 + h * 24, y + 10 + hash(tx, ty, 2) * 12, 1.5, 1.5);
      }
      break;
    case 'w': {
      const r = Math.sin(time * 0.4 + tx * 0.25 - ty * 0.15);
      if (r > 0.3) { ctx.fillStyle = `rgba(80,255,180,${(r - 0.3) * 0.11})`; ctx.fill(); }
      const p = (time * 0.45 + h) % 1;
      ctx.strokeStyle = `rgba(180,230,255,${0.28 * (1 - Math.abs(p - 0.5) * 2)})`;
      ctx.beginPath(); ctx.moveTo(x - 12 + h * 10, y + 10 + p * 10); ctx.lineTo(x + 4 + h * 10, y + 10 + p * 10); ctx.stroke();
      break;
    }
    case 'i': {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath();
      const a = h * 6.28;
      ctx.moveTo(x, y + 16); ctx.lineTo(x + Math.cos(a) * 14, y + 16 + Math.sin(a) * 6);
      ctx.moveTo(x, y + 16); ctx.lineTo(x + Math.cos(a + 2.4) * 12, y + 16 + Math.sin(a + 2.4) * 5);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(120,200,230,0.5)'; diamondPath(ctx, x, y); ctx.stroke();
      break;
    }
    case 'p':
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath();
      for (let k = 1; k < 4; k++) { const u = k / 4; ctx.moveTo(x - 32 * u, y + 16 * u); ctx.lineTo(x + 32 - 32 * u, y + 16 + 16 * u); }
      ctx.stroke();
      break;
    case 'S':
      for (let k = 0; k < 4; k++) {
        const u = k / 4, u2 = (k + 1) / 4;
        ctx.fillStyle = `hsl(215,10%,${34 - k * 7}%)`;
        poly([x - 32 * u, y + 16 * u, x + 32 - 32 * u, y + 16 + 16 * u, x + 32 - 32 * u2, y + 16 + 16 * u2, x - 32 * u2, y + 16 * u2]);
      }
      break;
  }
}

// ───────────────────────── Blöcke ─────────────────────────
function cutHeight(tx, ty, h) {
  const f = G.focus;
  const diff = tx + ty + 1 - (f.x + f.y);
  const k = clamp((diff - 0.4) / 1.4, 0, 1);
  return h + (12 - h) * k;
}
function snowNear(tx, ty) {
  return T(tx + 1, ty) === 's' || T(tx - 1, ty) === 's' || T(tx, ty + 1) === 's' || T(tx, ty - 1) === 's';
}
function visibleFace(tx, ty) {
  if (isFloor(tx, ty + 1)) return 'L';
  if (isFloor(tx + 1, ty)) return 'R';
  return null;
}
const BOOK_COLORS = ['#7a2b2b', '#2b4a7a', '#2f6b3e', '#7a6a2b', '#5a2b6b', '#8a5a2b', '#2b6b6b', '#a33c3c', '#c9b27a'];

function drawBlock(t, tx, ty, time, lights) {
  const x = sx(tx, ty), y = sy(tx, ty);
  const d = TILES[t];
  let h = d.cut ? cutHeight(tx, ty, d.h) : d.h;
  const v = hash(tx, ty) * 5;
  switch (t) {
    case 'R': drawCliff(tx, ty, x, y, time); return;
    case 't': drawTable(tx, ty, x, y); return;
    case 'P': {
      const stone = ['#9aa5b5', '#77818f', '#5c6571'];
      const hh = h;
      box(x, y + 16, 0, 7, 22, 11, ...stone);
      if (hh > 16) box(x, y + 16, 7, hh - 14, 13, 6.5, '#a8b2c0', '#838d9b', '#656e7a');
      box(x, y + 16, Math.max(7, hh - 7), 7, 20, 10, ...stone);
      return;
    }
    case 'B': {
      box(x, y + 16, 0, h, 32, 16, '#5a3a22', '#47301c', '#36230f');
      if (h > 30) {
        for (const face of ['L', 'R']) {
          const P = face === 'L' ? leftPt : rightPt;
          for (let r = 0; r < 3; r++) {
            const v0 = 5 + r * 13, v1 = v0 + 10;
            let u = 0.07, k = 0;
            while (u < 0.92) {
              const w = 0.07 + hash(tx * 7 + k, ty * 3 + r, face === 'L' ? 1 : 2) * 0.06;
              const col = BOOK_COLORS[Math.floor(hash(tx + k * 13, ty + r * 5, face === 'L' ? 3 : 4) * BOOK_COLORS.length)];
              quadPath(P, x, y, u, Math.min(0.93, u + w), v0, v1 - hash(k, r, tx) * 3);
              ctx.fillStyle = face === 'L' ? col : shade(col, -0.3); ctx.fill();
              u += w + 0.012; k++;
            }
            quadPath(P, x, y, 0.04, 0.96, v0 - 2, v0); ctx.fillStyle = '#2b1a0c'; ctx.fill();
          }
        }
      }
      return;
    }
  }
  // Mauerartige Blöcke
  const snowy = snowNear(tx, ty);
  box(x, y + 16, 0, h, 32, 16, snowy ? '#dfe9f2' : `hsl(216,13%,${45 + v}%)`, `hsl(216,15%,${31 + v}%)`, `hsl(216,17%,${23 + v}%)`);
  if (h > 30) {
    ctx.strokeStyle = 'rgba(0,0,0,0.17)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let r = 1; r * 13 < h - 2; r++) {
      const vv = r * 13;
      ctx.moveTo(x - 32, y + 16 - vv); ctx.lineTo(x, y + 32 - vv); ctx.lineTo(x + 32, y + 16 - vv);
      const off = r % 2 ? 0.25 : 0;
      for (let u = 0.25 + off; u < 1; u += 0.5) {
        let a = leftPt(x, y, u, vv), b = leftPt(x, y, u, vv - 13); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        a = rightPt(x, y, u, vv); b = rightPt(x, y, u, vv - 13); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      }
    }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = 1;
  diamondPath(ctx, x, y - h); ctx.stroke();
  if (h < 40) return;
  const face = visibleFace(tx, ty);
  if (!face) return;
  const P = face === 'L' ? leftPt : rightPt;
  if (t === '#' && World.windows.has(tx + ',' + ty)) drawWindow(P, x, y, h, time, tx);
  else if (t === 'F') {
    quadPath(P, x, y, 0.2, 0.8, 0, 26); ctx.fillStyle = '#140b06'; ctx.fill();
    const c = P(x, y, 0.5, 3);
    drawFlame(c.x, c.y, 0.75, time, tx * 3 + ty);
    quadPath(P, x, y, 0.12, 0.88, 26, 31); ctx.fillStyle = '#626d7e'; ctx.fill();
    const lp = P(x, y, 0.5, 14);
    lights.push({ x: lp.x, y: lp.y, r: 190, i: 0.95, c: 'rgba(255,140,60,0.16)', flick: tx + ty });
  } else if (t === 'D') {
    quadPath(P, x, y, 0.25, 0.75, 0, 40); ctx.fillStyle = '#5c3a1e'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath();
    for (const u of [0.375, 0.5, 0.625]) { const a = P(x, y, u, 0), b = P(x, y, u, 40); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    ctx.stroke();
    for (const vv of [10, 30]) { quadPath(P, x, y, 0.25, 0.75, vv, vv + 3); ctx.fillStyle = '#2a2a30'; ctx.fill(); }
    const l = P(x, y, 0.64, 20);
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    glow(ctx, l.x, l.y, 12, '#ffd86b', 0.25 + 0.3 * pulse);
    ctx.fillStyle = '#e0b84a'; ellipse(ctx, l.x, l.y, 3.2, 3.6);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(l.x - 0.7, l.y - 1, 1.4, 3);
  } else if (t === 'h') {
    const house = HOUSES[World.houseDoors[tx + ',' + ty]];
    quadPath(P, x, y, 0.25, 0.75, 0, 40); ctx.fillStyle = house.dark; ctx.fill();
    ctx.strokeStyle = house.light; ctx.lineWidth = 1.5; ctx.stroke();
    const c = P(x, y, 0.5, 26);
    ctx.fillStyle = house.color; ellipse(ctx, c.x, c.y, 5, 5);
    ctx.fillStyle = house.light; ellipse(ctx, c.x, c.y, 2, 2);
  }
}
function drawWindow(P, x, y, h, time, seed) {
  const u0 = 0.27, u1 = 0.73, v0 = 14, v1 = h - 9;
  ctx.save();
  quadPath(P, x, y, u0, u1, v0, v1);
  ctx.fillStyle = '#0a1a2d'; ctx.fill(); ctx.clip();
  ctx.fillStyle = 'rgba(90,165,215,0.35)'; ctx.fillRect(x - 40, y - h - 20, 80, h + 70);
  ctx.lineWidth = 1.6; ctx.setLineDash([6, 9]);
  for (let i = 0; i < 6; i++) {
    const u = u0 + ((u1 - u0) * (i + 0.5)) / 6;
    ctx.strokeStyle = `rgba(225,246,255,${0.45 + 0.25 * Math.sin(i * 1.7 + seed)})`;
    ctx.lineDashOffset = -(time * (120 + i * 23) + i * 7 + seed * 5);
    const a = P(x, y, u, v1 + 4), b = P(x, y, u, v0 - 4);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.restore();
  ctx.setLineDash([]);
  quadPath(P, x, y, u0, u1, v0, v1); ctx.strokeStyle = '#a3b1c2'; ctx.lineWidth = 2; ctx.stroke();
  const m0 = P(x, y, 0.5, v0), m1 = P(x, y, 0.5, v1);
  ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(m0.x, m0.y); ctx.lineTo(m1.x, m1.y); ctx.stroke();
}
function drawCliff(tx, ty, x, y, time) {
  const h = 150 + hash(tx, ty, 9) * 70 + (tx === 0 || ty === 0 ? 30 : 0);
  const v = hash(tx, ty) * 5;
  box(x, y + 16, 0, h, 32, 16, '#e3edf5', `hsl(214,14%,${19 + v}%)`, `hsl(216,16%,${13 + v}%)`);
  // Gesteinsschichten
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let k = 1; k < 7; k++) {
    const vv = h * (k / 7) + (hash(tx, ty, k) - 0.5) * 10;
    ctx.moveTo(x - 32, y + 16 - vv); ctx.lineTo(x, y + 32 - vv + (hash(tx, k, ty) - 0.5) * 8); ctx.lineTo(x + 32, y + 16 - vv);
  }
  ctx.stroke();
  // Schneekante
  ctx.fillStyle = 'rgba(230,240,250,0.85)';
  poly([x - 32, y + 16 - h, x, y + 32 - h, x + 32, y + 16 - h, x + 32, y + 22 - h, x + 12, y + 30 - h, x, y + 40 - h, x - 14, y + 30 - h, x - 32, y + 24 - h]);
  if (World.falls.has(tx + ',' + ty)) {
    const P = ty === 1 ? leftPt : rightPt;
    ctx.save();
    quadPath(P, x, y, 0.15, 0.85, -2, h); ctx.clip();
    const g = ctx.createLinearGradient(0, y - h, 0, y + 32);
    g.addColorStop(0, 'rgba(170,220,250,0.55)'); g.addColorStop(1, 'rgba(220,245,255,0.8)');
    ctx.fillStyle = g; ctx.fillRect(x - 40, y - h - 20, 80, h + 60);
    ctx.lineWidth = 2.2; ctx.setLineDash([12, 16]);
    for (let i = 0; i < 8; i++) {
      const u = 0.17 + i * 0.095;
      ctx.strokeStyle = `rgba(255,255,255,${0.55 + 0.3 * Math.sin(i * 2.1 + tx)})`;
      ctx.lineDashOffset = -(time * (170 + i * 19) + i * 11 + tx * 7);
      const a = P(x, y, u, h + 4), b = P(x, y, u, -4);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.restore(); ctx.setLineDash([]);
    const f = P(x, y, 0.5, 2);
    ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.2 * Math.sin(time * 6 + tx)})`;
    ellipse(ctx, f.x, f.y, 20, 6);
  }
}
const HALL_TABLES = { 17: 'gipfelsturm', 19: 'wiesengrund', 24: 'nebelsee', 26: 'duenenglut' };
function drawTable(tx, ty, x, y) {
  box(x, y + 16, 0, 14, 30, 15, '#7b5434', '#5b3c22', '#452c17');
  const house = ty >= 19 && ty <= 25 && HALL_TABLES[tx] ? HOUSES[HALL_TABLES[tx]] : null;
  if (house) {
    const p = (u, w) => [sx(tx + u, ty + w), sy(tx + u, ty + w) - 14];
    const a = p(0.36, 0), b = p(0.64, 0), c = p(0.64, 1), d = p(0.36, 1);
    ctx.fillStyle = house.color; poly([...a, ...b, ...c, ...d]);
    // Kerzen & Teller
    if ((ty + tx) % 2 === 0) {
      const [cx, cy] = p(0.5, 0.5);
      ctx.fillStyle = '#f2ead6'; ctx.fillRect(cx - 1.5, cy - 9, 3, 9);
      drawFlame(cx, cy - 9, 0.22, G.time, tx * 7 + ty);
    } else {
      const [cx, cy] = p(0.5, 0.5);
      ctx.fillStyle = '#d9dee6'; ellipse(ctx, cx, cy, 6, 3);
    }
  }
}

// ───────────────────────── Feuer ─────────────────────────
function drawFlame(x, y, s, time, seed) {
  const f = Math.sin(time * 12 + seed) * 0.15 + Math.sin(time * 19 + seed * 2) * 0.1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const layers = [['rgba(255,80,20,0.85)', 1], ['rgba(255,165,40,0.9)', 0.68], ['rgba(255,240,190,0.95)', 0.38]];
  for (const [c, k] of layers) {
    const w = 9 * s * k, hg = (27 + f * 10) * s * k;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w * 0.9, y - hg * 0.55, x + f * 6 * s, y - hg);
    ctx.quadraticCurveTo(x + w * 0.9, y - hg * 0.55, x + w, y);
    ctx.quadraticCurveTo(x, y + w * 0.45, x - w, y);
    ctx.fill();
  }
  ctx.restore();
}

// ───────────────────────── Objekte ─────────────────────────
function drawObject(o, X, Y, time, lights) {
  switch (o.type) {
    case 'brazier': {
      box(X, Y, 0, 12, 10, 5, '#5d6675', '#3d4450', '#2c323b');
      ctx.fillStyle = '#1d2128'; ellipse(ctx, X, Y - 15, 15, 7);
      ctx.strokeStyle = '#6b7484'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(X, Y - 17, 15, 6.5, 0, 0, Math.PI * 2); ctx.stroke();
      if (o.lit) {
        drawFlame(X, Y - 17, 1.25, time, o.seed);
        lights.push({ x: X, y: Y - 30, r: 210, i: 1, c: 'rgba(255,140,60,0.18)', flick: o.seed });
      } else {
        ctx.fillStyle = '#3a3330'; ellipse(ctx, X, Y - 17, 10, 4);
      }
      break;
    }
    case 'torch': {
      ctx.strokeStyle = '#3b2a1c'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(X, Y - 2); ctx.lineTo(X, Y - 38); ctx.stroke();
      ctx.fillStyle = '#4a4f58'; ctx.fillRect(X - 4.5, Y - 42, 9, 5);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(ctx, X, Y, 6, 3);
      if (o.lit) {
        drawFlame(X, Y - 41, 0.6, time, o.seed);
        lights.push({ x: X, y: Y - 44, r: 170, i: 0.95, c: 'rgba(255,140,60,0.15)', flick: o.seed });
      }
      break;
    }
    case 'crate': {
      const cx = X, cy = Y;
      box(cx, cy, 0, 27, 25, 12.5, '#b0824c', '#80582f', '#5f3f20');
      ctx.strokeStyle = 'rgba(40,20,5,0.55)'; ctx.lineWidth = 1.3; ctx.beginPath();
      ctx.moveTo(cx - 25, cy); ctx.lineTo(cx, cy + 12.5 - 27); ctx.moveTo(cx - 25, cy - 27); ctx.lineTo(cx, cy + 12.5);
      ctx.moveTo(cx + 25, cy); ctx.lineTo(cx, cy + 12.5 - 27); ctx.moveTo(cx + 25, cy - 27); ctx.lineTo(cx, cy + 12.5);
      ctx.stroke();
      if (o.key) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; poly([cx, cy - 12.5 - 27, cx + 25, cy - 27, cx, cy + 12.5 - 27, cx - 25, cy - 27]); }
      break;
    }
    case 'tree': {
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(ctx, X, Y, 18, 8);
      ctx.fillStyle = '#3b2a1f'; ctx.fillRect(X - 3, Y - 14, 6, 14);
      const tiers = [[22, 14, 26], [17, 32, 24], [11, 50, 22]];
      for (const [w, base, hg] of tiers) {
        ctx.fillStyle = '#1b3a2c'; poly([X - w, Y - base, X + w, Y - base, X, Y - base - hg]);
        ctx.fillStyle = '#e6f0f7'; poly([X - w * 0.45, Y - base - hg * 0.55, X + w * 0.45, Y - base - hg * 0.55, X, Y - base - hg]);
        ctx.fillStyle = 'rgba(230,240,247,0.8)'; poly([X - w, Y - base, X - w * 0.3, Y - base - 3, X + w * 0.2, Y - base, X + w, Y - base - 2, X + w, Y - base]);
      }
      break;
    }
    case 'banner': {
      const hs = HOUSES[o.house];
      ctx.strokeStyle = '#8b7a55'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X, Y - 74); ctx.stroke();
      ctx.fillStyle = '#d8b65a'; ellipse(ctx, X, Y - 76, 3, 3);
      const wv = Math.sin(time * 2 + o.seed) * 2;
      ctx.fillStyle = hs.color;
      poly([X + 1, Y - 70, X + 22, Y - 66 + wv * 0.3, X + 22 + wv, Y - 30, X + 11.5, Y - 36, X + 1 + wv * 0.3, Y - 32]);
      ctx.fillStyle = hs.light; ellipse(ctx, X + 11.5 + wv * 0.5, Y - 52, 4, 4);
      break;
    }
    case 'fountain': {
      box(X, Y, 0, 10, 28, 14, '#8d98a8', '#6a7483', '#525b68');
      ctx.fillStyle = '#bfe9f7'; ellipse(ctx, X, Y - 10, 22, 10);
      ctx.fillStyle = 'rgba(200,245,255,0.9)';
      poly([X - 7, Y - 12, X, Y - 54, X + 7, Y - 12]);
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; poly([X - 2, Y - 14, X, Y - 54, X + 2, Y - 14]);
      ctx.fillStyle = 'rgba(200,245,255,0.8)'; poly([X - 15, Y - 12, X - 9, Y - 34, X - 4, Y - 12]); poly([X + 4, Y - 12, X + 10, Y - 30, X + 15, Y - 12]);
      const s = 0.5 + 0.5 * Math.sin(time * 2.5);
      glow(ctx, X, Y - 54, 10, '#ffffff', 0.4 * s);
      break;
    }
    case 'cauldron': {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ellipse(ctx, X, Y, 17, 7);
      ctx.fillStyle = '#1b1d22'; ellipse(ctx, X, Y - 12, 15, 12);
      ctx.fillStyle = '#2a2d34'; ellipse(ctx, X, Y - 20, 15, 5.5);
      ctx.fillStyle = '#5dff9a'; ellipse(ctx, X, Y - 20, 12, 4);
      lights.push({ x: X, y: Y - 22, r: 90, i: 0.6, c: 'rgba(90,255,150,0.12)' });
      if (Math.random() < 0.08) spawn({ x: o.x + 0.5 + rand(-0.1, 0.1), y: o.y + 0.5 + rand(-0.1, 0.1), z: 22, vz: 22, life: 0.9, size: 3, color: '#8dffb8' });
      break;
    }
    case 'item': {
      const bob = Math.sin(time * 2 + o.seed) * 4;
      const yy = Y - 26 + bob;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(ctx, X, Y, 9, 4);
      if (o.item === 'perle') {
        glow(ctx, X, yy, 26, '#ffe6f2', 0.5);
        const g = ctx.createRadialGradient(X - 3, yy - 3, 1, X, yy, 8);
        g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e9c8dc');
        ctx.fillStyle = g; ellipse(ctx, X, yy, 8, 8);
      } else if (o.item === 'buch') {
        glow(ctx, X, yy, 26, '#ffd86b', 0.4);
        ctx.fillStyle = '#1e2a5c'; poly([X - 12, yy - 4, X + 2, yy - 10, X + 12, yy - 2, X - 2, yy + 5]);
        ctx.fillStyle = '#f0e6c8'; poly([X - 12, yy - 1, X - 2, yy + 8, X - 2, yy + 5, X - 12, yy - 4]);
        ctx.fillStyle = '#ffd86b'; ellipse(ctx, X, yy - 2.5, 2, 1.2); ellipse(ctx, X + 5, yy - 4, 1.2, 0.8);
      } else {
        glow(ctx, X, yy, 34, '#7dffc4', 0.55);
        ctx.fillStyle = '#7dffd0'; poly([X, yy - 15, X + 7, yy, X, yy + 11, X - 7, yy]);
        ctx.fillStyle = '#d9fff0'; poly([X, yy - 15, X + 2, yy, X, yy + 11, X - 3, yy]);
      }
      lights.push({ x: X, y: yy, r: 90, i: 0.7 });
      if (Math.random() < 0.1) spawn({ x: o.x + 0.5 + rand(-0.3, 0.3), y: o.y + 0.5 + rand(-0.3, 0.3), z: 20, vz: 20, life: 1, size: 2, color: '#ffffff' });
      break;
    }
    case 'rune': {
      const p = 0.5 + 0.5 * Math.sin(time * 2.5 + o.seed);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(ctx, X, Y + 1, 9, 4);
      ctx.fillStyle = '#6c7582'; poly([X - 8, Y, X - 6, Y - 16, X + 1, Y - 20, X + 7, Y - 14, X + 8, Y]);
      ctx.fillStyle = '#545c68'; poly([X + 1, Y - 20, X + 7, Y - 14, X + 8, Y, X + 2, Y + 1]);
      ctx.strokeStyle = `rgba(120,240,255,${0.5 + 0.5 * p})`; ctx.lineWidth = 1.6; ctx.beginPath();
      ctx.moveTo(X - 3, Y - 4); ctx.lineTo(X - 3, Y - 15); ctx.lineTo(X + 1, Y - 10); ctx.moveTo(X - 3, Y - 11); ctx.lineTo(X + 1, Y - 6);
      ctx.stroke();
      glow(ctx, X, Y - 10, 16, '#78f0ff', 0.2 + 0.25 * p);
      lights.push({ x: X, y: Y - 10, r: 55, i: 0.5 });
      break;
    }
  }
}

// ───────────────────────── Figuren ─────────────────────────
function drawWizard(c, x, y, o) {
  const { robe, trim, hat, skin, hair } = o;
  const fx = o.fx ?? 0.7, fy = o.fy ?? 0.7;
  c.save();
  c.globalAlpha = o.alpha ?? 1;
  c.fillStyle = 'rgba(0,0,0,0.32)'; ellipse(c, x, y, 13, 6);
  const t = o.time ?? 0;
  const bob = o.moving ? Math.abs(Math.sin(o.phase || 0)) * 2.5 : Math.sin(t * 2 + (o.seed || 0)) * 0.6;
  const yy = y - bob - (o.float || 0);
  let dx = fx - fy, dy = (fx + fy) * 0.5;
  const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
  const back = dy < -0.15;
  const side = dx >= 0 ? 1 : -1;
  const drawWand = () => {
    if (o.staff) {
      const hx = x + side * 11, hy = yy - 18;
      c.strokeStyle = '#8b6b44'; c.lineWidth = 2.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(hx, yy + 2); c.lineTo(hx, yy - 50); c.stroke();
      glow(c, hx, yy - 53, 14, '#bfe9ff', 0.6 + 0.3 * Math.sin(t * 3));
      c.fillStyle = '#e6f8ff'; c.beginPath(); c.moveTo(hx, yy - 61); c.lineTo(hx + 4, yy - 53); c.lineTo(hx, yy - 47); c.lineTo(hx - 4, yy - 53); c.closePath(); c.fill();
      return hy;
    }
    if (!o.wand) return;
    const hx = x + side * 9, hy = yy - 19;
    const ex = hx + dx * 15, ey = hy + dy * 9 - 5;
    c.strokeStyle = o.wand; c.lineWidth = 2.6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(hx, hy); c.lineTo(ex, ey); c.stroke();
    c.fillStyle = skin; ellipse(c, hx, hy, 2.8, 2.8);
    const fl = o.flash || 0;
    glow(c, ex, ey, 8 + fl * 26, o.tip || '#ffffff', 0.7 + fl * 0.3);
    c.fillStyle = '#fff'; ellipse(c, ex, ey, 1.6, 1.6);
  };
  if (back) drawWand();
  // Robe
  const g = c.createLinearGradient(x - 12, 0, x + 12, 0);
  g.addColorStop(0, shade(robe, -0.2)); g.addColorStop(0.5, robe); g.addColorStop(1, shade(robe, -0.42));
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(x - 12, yy - 1); c.quadraticCurveTo(x, yy + 3, x + 12, yy - 1);
  c.lineTo(x + 7, yy - 30); c.quadraticCurveTo(x, yy - 34, x - 7, yy - 30); c.closePath(); c.fill();
  c.strokeStyle = trim; c.lineWidth = 2;
  c.beginPath(); c.moveTo(x - 11.5, yy - 2); c.quadraticCurveTo(x, yy + 2, x + 11.5, yy - 2); c.stroke();
  if (!back) {
    c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + dx * 2, yy - 30); c.lineTo(x + dx * 4, yy - 1); c.stroke();
  }
  // Kopf
  c.fillStyle = hair; ellipse(c, x, yy - 37, 7.6, 7.8);
  if (!back) {
    c.fillStyle = skin; ellipse(c, x + dx * 1.6, yy - 35.5, 6.2, 6.4);
    c.fillStyle = '#1b1b24';
    c.fillRect(x + dx * 3.5 - 2.8, yy - 37, 1.6, 1.8); c.fillRect(x + dx * 3.5 + 1.4, yy - 37, 1.6, 1.8);
    if (o.beard) { c.fillStyle = o.beard; c.beginPath(); c.moveTo(x - 5 + dx * 2, yy - 33); c.lineTo(x + 5 + dx * 2, yy - 33); c.lineTo(x + dx * 3, yy - 22); c.closePath(); c.fill(); }
  }
  // Hut
  if (!o.noHat) {
    c.fillStyle = hat; ellipse(c, x, yy - 41.5, 12.5, 4.2);
    c.beginPath(); c.moveTo(x - 8, yy - 42); c.lineTo(x + 8, yy - 42); c.lineTo(x + 5 - dx * 3, yy - 65); c.closePath(); c.fill();
    c.strokeStyle = trim; c.lineWidth = 2.2; c.beginPath(); c.moveTo(x - 7.5, yy - 44.5); c.lineTo(x + 7.5, yy - 44.5); c.stroke();
    if (o.hatStar) { c.fillStyle = o.hatStar; ellipse(c, x + 1, yy - 52, 1.8, 1.8); }
  }
  if (!back) drawWand();
  c.restore();
}

// ───────────────────────── Szene ─────────────────────────
function floorUnder(tx, ty) {
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    const t = T(tx + dx, ty + dy);
    if (t === '.' || t === 'k' || t === 'c' || t === 's') return t;
  }
  return '.';
}
function npcLook(n) {
  return { robe: n.robe, trim: n.trim, hat: n.hat, skin: n.skin, hair: n.hair, beard: n.beard, noHat: n.noHat, staff: n.staff,
    fx: n.fx, fy: n.fy, moving: n.moving, phase: n.phase, time: G.time, seed: n.homeX, alpha: n.ghost ? 0.5 : 1,
    float: n.ghost ? 8 + Math.sin(G.time * 1.5) * 4 : 0, wand: n.student || n.prefect ? '#8b6b44' : null, tip: '#ffffff' };
}
function playerLook() {
  const p = G.player, pr = G.profile, hs = HOUSES[pr.house];
  return { robe: '#1d2433', trim: hs.color, hat: hs.dark, skin: pr.skin, hair: pr.hair, hatStar: hs.light,
    fx: p.fx, fy: p.fy, moving: p.moving, phase: p.phase, time: G.time, wand: woodOf(pr.wand).color, tip: coreOf(pr.wand).color, flash: G.castFlash };
}

function renderWorld(time) {
  const lights = [];
  const draw = [];
  const myHouse = G.profile && G.profile.house;
  for (let ty = -2; ty < MH + 18; ty++) {
    for (let tx = -2; tx < MW + 18; tx++) {
      const x = (tx - ty) * 32 - cam.x + W / 2;
      if (x < -70 || x > W + 70) continue;
      const y = (tx + ty) * 16 - cam.y + H / 2;
      if (y < -40 || y > H + 230) continue;
      let t;
      if (inb(tx, ty)) t = World.grid[ty][tx];
      else if (tx >= MW || ty >= MH) t = 'w';
      else continue;
      const d = TILES[t];
      if (t === 'h' && World.houseDoors[tx + ',' + ty] === myHouse) {
        if (y > H + 10) continue;
        drawFloor('.', tx, ty, x, y, time);
        const hs = HOUSES[myHouse];
        ctx.strokeStyle = hs.light; ctx.lineWidth = 2; diamondPath(ctx, x, y + 3); ctx.stroke();
        ctx.fillStyle = rgba(hs.color, 0.35); ctx.fill();
        continue;
      }
      if (d.block) {
        if (t === 't' || t === 'P') { if (y <= H + 10) drawFloor(floorUnder(tx, ty), tx, ty, x, y, time); }
        draw.push({ d: tx + ty + 1, k: 0, tx, ty, t });
      } else if (y <= H + 10) drawFloor(t, tx, ty, x, y, time);
    }
  }
  for (const o of World.objects) {
    const X = sx(o.rx + 0.5, o.ry + 0.5), Y = sy(o.rx + 0.5, o.ry + 0.5);
    if (X < -90 || X > W + 90 || Y < -30 || Y > H + 120) continue;
    draw.push({ d: o.rx + o.ry + 1, k: 1, o, X, Y });
  }
  for (const n of World.npcs) {
    const X = sx(n.x, n.y), Y = sy(n.x, n.y);
    if (X < -60 || X > W + 60 || Y < -20 || Y > H + 90) continue;
    draw.push({ d: n.x + n.y, k: 2, n, X, Y });
  }
  if (G.player && G.state !== 'menu') {
    const p = G.player;
    draw.push({ d: p.x + p.y, k: 3, p, X: sx(p.x, p.y), Y: sy(p.x, p.y) });
  }
  draw.sort((a, b) => a.d - b.d || a.k - b.k);
  for (const e of draw) {
    const n0 = lights.length;
    if (e.k === 0) drawBlock(e.t, e.tx, e.ty, time, lights);
    else if (e.k === 1) drawObject(e.o, e.X, e.Y, time, lights);
    else if (e.k === 2) drawWizard(ctx, e.X, e.Y, npcLook(e.n));
    else drawWizard(ctx, e.X, e.Y, playerLook());
    for (let i = n0; i < lights.length; i++) {
      lights[i].tx = e.k === 0 ? e.tx : e.o.x; lights[i].ty = e.k === 0 ? e.ty : e.o.y;
    }
  }
  const r = G.state !== 'menu' && G.room;
  if (r && r.dark) return lights.filter((L) => L.tx === undefined || (L.tx >= r.x1 - 1 && L.tx <= r.x2 + 1 && L.ty >= r.y1 - 1 && L.ty <= r.y2 + 1));
  return lights;
}

function drawLighting(lights, time) {
  const w = lightCv.width, h = lightCv.height;
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, w, h);
  lctx.fillStyle = `rgba(3,6,18,${G.amb})`;
  lctx.fillRect(0, 0, w, h);
  lctx.globalCompositeOperation = 'destination-out';
  for (const L of lights) {
    const fl = L.flick !== undefined ? 1 + Math.sin(time * 11 + L.flick) * 0.04 + Math.sin(time * 23 + L.flick * 2) * 0.03 : 1;
    const x = L.x / 2, y = L.y / 2, r = (L.r * fl) / 2;
    if (x < -r || x > w + r || y < -r || y > h + r) continue;
    const g = lctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${L.i})`);
    g.addColorStop(0.45, `rgba(0,0,0,${L.i * 0.65})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g;
    lctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.drawImage(lightCv, 0, 0, W, H);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const L of lights) {
    if (!L.c) continue;
    const r = L.r * 0.65;
    if (L.x < -r || L.x > W + r || L.y < -r || L.y > H + r) continue;
    const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, r);
    g.addColorStop(0, L.c); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(L.x - r, L.y - r, r * 2, r * 2);
  }
  ctx.restore();
}

function drawParticles() {
  ctx.save();
  for (const q of G.particles) {
    if (q.add) continue;
    const X = sx(q.x, q.y), Y = sy(q.x, q.y) - q.z;
    const a = clamp(q.life / q.max, 0, 1);
    ctx.globalAlpha = a * 0.5; ctx.fillStyle = q.color;
    ellipse(ctx, X, Y, q.size * (1.6 - a * 0.6), q.size * (1.6 - a * 0.6));
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const q of G.particles) {
    if (!q.add) continue;
    const X = sx(q.x, q.y), Y = sy(q.x, q.y) - q.z;
    const a = clamp(q.life / q.max, 0, 1);
    const s = q.size * (0.4 + 0.6 * a);
    ctx.globalAlpha = a; ctx.fillStyle = q.color;
    ctx.fillRect(X - s / 2, Y - s / 2, s, s);
  }
  ctx.restore();
}
function drawProjectiles() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of G.projectiles) {
    const X = sx(p.x, p.y), Y = sy(p.x, p.y) - 22;
    glow(ctx, X, Y, 30, p.color, 0.55);
    glow(ctx, X, Y, 10, '#ffffff', 0.9);
  }
  ctx.restore();
}
function drawLumenOrb(time) {
  const p = G.player;
  if (!p || !p.lumen) return;
  const X = sx(p.orb.x, p.orb.y), Y = sy(p.orb.x, p.orb.y) - 54 - Math.sin(time * 2.2) * 5;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  glow(ctx, X, Y, 46, '#cfe8ff', 0.45);
  glow(ctx, X, Y, 14, '#ffffff', 1);
  ctx.restore();
}
function drawSnow(dt) {
  const a = G.outdoor;
  if (a < 0.02) return;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  for (const f of G.snow) {
    f.y += f.v * dt; f.x += Math.sin(G.time * f.w + f.ph) * 12 * dt - 6 * dt;
    if (f.y > H + 5) { f.y = -5; f.x = Math.random() * W; }
    if (f.x < -5) f.x = W + 5;
    ctx.globalAlpha = a * f.a;
    ctx.fillRect(f.x, f.y, f.s, f.s);
  }
  ctx.restore();
}
function drawLabels(time) {
  if (!G.player || G.state === 'menu') return;
  const p = G.player;
  ctx.save();
  ctx.textAlign = 'center';
  for (const n of World.npcs) {
    const d = Math.hypot(n.x - p.x, n.y - p.y);
    if (d > 6.5) continue;
    if (G.room && G.room.dark && !p.lumen && d > 2.5) continue;
    const X = sx(n.x, n.y), Y = sy(n.x, n.y) - 74 - (n.ghost ? 10 : 0);
    const a = clamp((6.5 - d) / 2, 0, 1);
    ctx.globalAlpha = a;
    ctx.font = '600 12px "Alegreya Sans", sans-serif';
    const label = n.name;
    const w = ctx.measureText(label).width + 12;
    ctx.fillStyle = 'rgba(6,12,24,0.7)'; ctx.fillRect(X - w / 2, Y - 13, w, 17);
    ctx.fillStyle = '#e8f0fa'; ctx.fillText(label, X, Y);
    const m = npcMarker(n);
    if (m) {
      const by = Y - 22 + Math.sin(time * 4) * 3;
      ctx.font = '700 22px Cinzel, serif';
      ctx.fillStyle = m === '?' ? '#7dffc4' : '#ffd86b';
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12;
      ctx.fillText(m, X, by);
      ctx.shadowBlur = 0;
    }
  }
  ctx.restore();
}

// ───────────────────────── Minikarte ─────────────────────────
const MINI_COL = { '.': '#7f8899', k: '#3c4a50', c: '#3f4f8a', b: '#3b6cb5', g: '#3d8a50', a: '#8a939c', r: '#9c3b35', s: '#c5d6e4', p: '#7a5a3a',
  S: '#e0b84a', i: '#d2f1fb', w: '#14405a', '#': '#4a5568', F: '#c0703a', D: '#b08040', h: '#6a7488', B: '#5a3a22', t: '#6b4a2e', P: '#8a94a3', R: '#232a36' };
const miniCv = document.createElement('canvas');
miniCv.width = 220; miniCv.height = 112;
function buildMinimap() {
  const c = miniCv.getContext('2d');
  c.clearRect(0, 0, 220, 112);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    let t = World.grid[y][x];
    c.fillStyle = t === 'h' ? HOUSES[World.houseDoors[x + ',' + y]].color : MINI_COL[t] || '#000';
    c.fillRect((x - y) * 2 + 108, (x + y) + 4, 4, 2);
  }
  World.dirty = false;
}
function drawMinimap(el, time) {
  if (World.dirty) buildMinimap();
  const c = el.getContext('2d');
  c.clearRect(0, 0, el.width, el.height);
  c.drawImage(miniCv, 0, 0);
  for (const n of World.npcs) {
    const m = npcMarker(n);
    if (!m) continue;
    c.fillStyle = m === '?' ? '#7dffc4' : '#ffd86b';
    c.fillRect((n.x - n.y) * 2 + 108, n.x + n.y + 2, 4, 4);
  }
  const p = G.player;
  const X = (p.x - p.y) * 2 + 110, Y = p.x + p.y + 5;
  c.fillStyle = Math.sin(time * 6) > 0 ? '#ffffff' : HOUSES[G.profile.house].color;
  c.beginPath(); c.arc(X, Y, 3.2, 0, Math.PI * 2); c.fill();
}

// ───────────────────────── Zauberstab-Vorschau ─────────────────────────
function drawWandPreview(cv, wand, time) {
  const c = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  c.clearRect(0, 0, w, h);
  const bg = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
  bg.addColorStop(0, 'rgba(60,90,140,0.35)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  const wood = woodOf(wand), core = coreOf(wand);
  const L = 150 + ((wand.length - 22) / 12) * 250;
  const bend = [7, 5, 3.5, 1.2, 0.3][FLEX.indexOf(wand.flex)] || 3;
  c.save();
  c.translate(w / 2, h / 2 + 6);
  c.rotate(-0.1 + Math.sin(time * 0.8) * 0.025);
  const g = c.createLinearGradient(-L / 2, 0, L / 2, 0);
  g.addColorStop(0, wood.dark); g.addColorStop(0.3, wood.dark); g.addColorStop(0.32, wood.color);
  g.addColorStop(1, shade(wood.color, 0.25));
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(-L / 2, -5.5);
  c.quadraticCurveTo(0, -5 - bend, L / 2, -1.6);
  c.lineTo(L / 2, 1.6);
  c.quadraticCurveTo(0, 5 - bend, -L / 2, 5.5);
  c.closePath(); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.8;
  for (let k = -1; k <= 1; k += 2) { c.beginPath(); c.moveTo(-L * 0.18, k * 1.6); c.quadraticCurveTo(L * 0.15, k * 1.4 - bend, L * 0.48, k * 0.6 - bend * 0.15); c.stroke(); }
  c.strokeStyle = shade(wood.dark, -0.3); c.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) { const xx = -L / 2 + 10 + i * (L * 0.28 - 14) / 3; c.beginPath(); c.moveTo(xx, -5.5); c.lineTo(xx, 5.5); c.stroke(); }
  c.fillStyle = shade(wood.dark, -0.2); ellipse(c, -L / 2, 0, 5, 7);
  const tipX = L / 2, tipY = 0;
  c.globalCompositeOperation = 'lighter';
  glow(c, tipX, tipY, 30 + Math.sin(time * 3) * 4, core.color, 0.75);
  glow(c, tipX, tipY, 8, '#ffffff', 1);
  for (let i = 0; i < 7; i++) {
    const a = time * (1 + i * 0.13) + i * 0.9;
    const r = 16 + Math.sin(time * 2 + i) * 6;
    c.fillStyle = rgba(core.color, 0.8);
    c.fillRect(tipX + Math.cos(a) * r, tipY + Math.sin(a) * r * 0.6, 2, 2);
  }
  c.restore();
}
