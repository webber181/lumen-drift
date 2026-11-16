// Painting the world: ship, drones, shots, star cores, pickups and particles.
// Vector shapes plus cached glow sprites; shadowBlur is reserved for ship and elite.
import { CORE, PALETTE, PICKUP } from './config.js';
import { clamp01, drawGlow, polyPath, rgba, starPath, text } from './gfx.js';

const TAU = Math.PI * 2;
const L = 'lighter', S = 'source-over';
const SIDES = [-1, 1], SPREAD_ANGLES = [-0.46, 0, 0.46];
const SHARD_PTS = [1.48, 0, -0.92, -0.82, -0.36, 0, -0.92, 0.82];
const SNIPER_PTS = [1.55, 0, 0, -0.54, -0.42, -0.96, -1.05, -0.34, -0.62, 0, -1.05, 0.34, -0.42, 0.96, 0, 0.54];

function ring(c, x, y, r, style, lw) {
  c.strokeStyle = style; c.lineWidth = lw;
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
}

function seg(c, x1, y1, x2, y2, style, lw) {
  if (style) c.strokeStyle = style;
  if (lw) c.lineWidth = lw;
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
}

function strokePoly(c, x, y, r, sides, rot, style, lw) {
  polyPath(c, x, y, r, sides, rot);
  c.strokeStyle = style; c.lineWidth = lw; c.stroke();
}

function ptsPath(c, pts, r) {
  c.beginPath(); c.moveTo(pts[0] * r, pts[1] * r);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i] * r, pts[i + 1] * r);
  c.closePath();
}

export function drawPlayer(c, p, t, opts = {}) {
  const inv = opts.invulnerable ?? p.invulnerable ?? 0;
  const thrust = opts.thrust ?? p.thrust ?? 0;
  const spread = Boolean(opts.spreadActive);
  const bank = Math.max(-1, Math.min(1, p.bank || 0));
  const flare = p.flare || 0;
  const muzzle = clamp01(Math.max(p.muzzle || 0, flare * 0.65));
  const kick = clamp01(p.recoil || 0) * 3.8;

  if (inv > 0 && Math.floor(t * 16) % 2 === 0) c.globalAlpha = 0.28;

  c.save(); c.globalCompositeOperation = L;
  drawGlow(c, PALETTE.cyan, p.x, p.y, 52 + flare * 8, 0.42 + flare * 0.15);
  if (spread) drawGlow(c, PALETTE.amber, p.x, p.y, 40, 0.22 + 0.08 * Math.sin(t * 9));
  c.restore();

  c.save();
  c.translate(p.x - Math.cos(p.angle) * kick, p.y - Math.sin(p.angle) * kick);
  c.rotate(p.angle);
  c.scale(1.3, 1.3 * (1 - Math.abs(bank) * 0.14));

  const flame = 7 + thrust * 15 + Math.sin(t * 60) * 1.5;
  for (let i = 0; i < 2; i += 1) {
    const s = SIDES[i];
    c.globalCompositeOperation = L;
    const g = c.createLinearGradient(-8, 0, -8 - flame, 0);
    g.addColorStop(0, rgba(PALETTE.ice, 0.95));
    g.addColorStop(0.35, rgba(spread ? PALETTE.amber : PALETTE.cyan, 0.72));
    g.addColorStop(1, rgba(PALETTE.violet, 0));
    c.fillStyle = g; c.beginPath();
    c.moveTo(-7, s * 6.5 - 3); c.lineTo(-8 - flame, s * 6.5); c.lineTo(-7, s * 6.5 + 3);
    c.closePath(); c.fill();
    if (spread) {
      const py = s * 11.4;
      drawGlow(c, PALETTE.amber, 8, py, 8, 0.65);
      c.globalCompositeOperation = S;
      c.fillStyle = '#241c44'; c.strokeStyle = PALETTE.amber; c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(9, py - s * 1.4); c.lineTo(-5, py - s * 2.2);
      c.lineTo(-6, py + s * 1.6); c.lineTo(8, py + s * 1.2);
      c.closePath(); c.fill(); c.stroke();
    }
  }
  c.globalCompositeOperation = S;

  c.shadowColor = spread ? PALETTE.amber : PALETTE.cyan; c.shadowBlur = 14;
  const hull = c.createLinearGradient(-12, 0, 20, 0);
  hull.addColorStop(0, '#0b2c63');
  hull.addColorStop(0.55, spread ? '#209cd4' : '#1d8bc4');
  hull.addColorStop(1, '#9ff6ff');
  c.fillStyle = hull; c.strokeStyle = PALETTE.ice; c.lineWidth = 1.8; c.lineJoin = 'round';
  const topY = -12.5 * (1 - bank * 0.14), botY = 12.5 * (1 + bank * 0.14);
  c.beginPath();
  c.moveTo(20, 0); c.lineTo(-11 - bank * 1.8, topY);
  c.lineTo(-5, 0); c.lineTo(-11 + bank * 1.8, botY);
  c.closePath(); c.fill(); c.stroke();
  c.shadowBlur = 0;

  seg(c, 15, 0, -3, 0, rgba(PALETTE.white, 0.58), 1);
  c.strokeStyle = rgba(spread ? PALETTE.amber : PALETTE.magenta, 0.92); c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(-6, topY * 0.76); c.lineTo(-10 - bank * 1.2, topY * 0.9);
  c.moveTo(-6, botY * 0.76); c.lineTo(-10 + bank * 1.2, botY * 0.9);
  c.stroke();

  c.globalCompositeOperation = L;
  drawGlow(c, PALETTE.white, 4, 0, 7, 0.9);

  if (muzzle > 0.04) {
    const len = 8 + muzzle * 14;
    drawGlow(c, spread ? PALETTE.amber : PALETTE.cyan, 20, 0, 11 + muzzle * 7, muzzle * 0.85);
    c.lineCap = 'round'; c.strokeStyle = rgba('#ffffff', muzzle * 0.92); c.lineWidth = 2.2 * muzzle + 0.6;
    c.beginPath();
    c.moveTo(19, 0); c.lineTo(19 + len, 0);
    c.moveTo(20, -4 * muzzle); c.lineTo(20, 4 * muzzle);
    if (spread || muzzle > 0.35) {
      for (let i = 0; i < 2; i += 1) {
        const s = SIDES[i];
        c.moveTo(10, s * 9.5); c.lineTo(10 + len * 0.62, s * (9.5 + len * 0.14));
      }
    }
    c.stroke();
  }
  c.restore();

  if (opts.shieldReady) drawShield(c, p, t);
  if ((p.shieldFlash || 0) > 0.02) {
    const sf = clamp01(p.shieldFlash);
    c.save(); c.globalCompositeOperation = L;
    ring(c, p.x, p.y, 34 + (1 - sf) * 28, rgba(PALETTE.ice, sf * 0.8), 2.5 * sf);
    c.restore();
  }
  c.globalAlpha = 1;
}

function drawShield(c, p, t) {
  c.save(); c.translate(p.x, p.y); c.globalCompositeOperation = L;
  const pulse = 0.75 + 0.25 * Math.sin(t * 5);
  drawGlow(c, PALETTE.cyan, 0, 0, 52, 0.22 * pulse);
  c.globalCompositeOperation = S;
  c.setLineDash([9, 6]); c.lineDashOffset = -t * 30;
  strokePoly(c, 0, 0, 33, 6, t * 0.8, rgba(PALETTE.cyan, 0.65 * pulse + 0.2), 2);
  c.setLineDash([]);
  ring(c, 0, 0, 38, rgba(PALETTE.ice, 0.28), 1);
  c.restore();
}

export function drawReticle(c, p, t) {
  const { aimX: x, aimY: y } = p;
  c.save(); c.setLineDash([3, 9]);
  seg(c, p.x + Math.cos(p.angle) * 24, p.y + Math.sin(p.angle) * 24, x, y, rgba(PALETTE.cyan, 0.1), 1);
  c.setLineDash([]); c.translate(x, y); c.rotate(t * 0.8);
  ring(c, 0, 0, 9, rgba(PALETTE.cyan, 0.8), 1.6);
  c.beginPath();
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * TAU;
    c.moveTo(Math.cos(a) * 12, Math.sin(a) * 12); c.lineTo(Math.cos(a) * 18, Math.sin(a) * 18);
  }
  c.stroke(); c.restore();
}

function pentagram(c, r, points) {
  c.beginPath();
  for (let i = 0; i < points; i += 1) {
    const a = ((i * 2) / points) * TAU, x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.closePath();
}

function bodyPath(c, kind, r, sides) {
  if (kind === 'shardling') return ptsPath(c, SHARD_PTS, r);
  if (kind === 'sniper') return ptsPath(c, SNIPER_PTS, r);
  if (kind === 'orbiter') {
    c.beginPath();
    for (let i = 0; i < 16; i += 1) {
      const tip = i % 2 === 0, a = (i / 16) * TAU + (tip ? 0.14 : 0), rad = tip ? r * 1.08 : r * 0.72;
      if (i === 0) c.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); else c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    return c.closePath();
  }
  if (kind === 'splitter') {
    c.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * TAU, rad = r * (i === 0 || i === 3 ? 0.82 : 1.05);
      if (i === 0) c.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); else c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    return c.closePath();
  }
  polyPath(c, 0, 0, r, sides, 0);
}

const MARKINGS = {
  triangle(c, e, r) { polyPath(c, -r * 0.1, 0, r * 0.5, 3, 0); c.stroke(); },
  square(c, e, r) {
    c.save(); c.rotate(-(e.rot || 0) * 2.4); strokePoly(c, 0, 0, r * 0.62, 4, Math.PI / 4, c.strokeStyle, c.lineWidth); c.restore();
    c.strokeStyle = rgba(e.color || PALETTE.orange, 0.7); c.beginPath();
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * TAU;
      c.moveTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62);
      c.lineTo(Math.cos(a + Math.PI / 4) * r, Math.sin(a + Math.PI / 4) * r);
    }
    c.stroke();
  },
  pentagon(c, e, r) { pentagram(c, r * 0.72, 5); c.stroke(); },
  splitter(c, e, r, t) {
    c.strokeStyle = rgba('#ffffff', 0.65 * (0.65 + 0.35 * Math.sin(t * 7 + (e.phase || 0)))); c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(-r * 0.76, -r * 0.08); c.lineTo(-r * 0.15, r * 0.12); c.lineTo(r * 0.16, -r * 0.1); c.lineTo(r * 0.76, r * 0.06);
    c.moveTo(-r * 0.15, r * 0.12); c.lineTo(-r * 0.42, r * 0.74);
    c.moveTo(r * 0.16, -r * 0.1); c.lineTo(r * 0.4, -r * 0.74);
    c.stroke();
    strokePoly(c, 0, 0, r * 0.42, 6, Math.PI / 6, rgba(e.color || PALETTE.teal || '#2cf5c8', 0.8), 1.1);
  },
  shardling(c, e, r) { seg(c, -r * 0.25, 0, r * 1.15, 0); },
  orbiter(c, e, r) {
    ring(c, 0, 0, r * 0.44, c.strokeStyle, c.lineWidth);
    c.beginPath();
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * TAU;
      c.moveTo(Math.cos(a) * r * 0.44, Math.sin(a) * r * 0.44);
      c.lineTo(Math.cos(a + 0.35) * r * 0.88, Math.sin(a + 0.35) * r * 0.88);
    }
    c.stroke();
  },
  sniper(c, e, r) {
    c.beginPath();
    c.moveTo(-r * 0.72, -r * 0.22); c.lineTo(r * 1.08, -r * 0.08);
    c.moveTo(-r * 0.72, r * 0.22); c.lineTo(r * 1.08, r * 0.08);
    c.stroke();
    ring(c, -r * 0.06, 0, r * 0.24, c.strokeStyle, c.lineWidth);
  },
  elite(c, e, r, t) {
    const sides = e.sides || 6, rot = e.rot || 0;
    polyPath(c, 0, 0, r * 0.72, sides, Math.PI / sides); c.stroke();
    if (sides >= 10) pentagram(c, r * 0.56, 5);
    else if (sides === 8) polyPath(c, 0, 0, r * 0.42, 4, rot + t * 0.8);
    else polyPath(c, 0, 0, r * 0.38, 3, -rot * 2);
    c.stroke();
    c.save(); c.rotate(-rot * 3 + t); c.setLineDash([10, 8]);
    ring(c, 0, 0, r * 0.5, rgba(PALETTE.white, 0.45), 1.2);
    c.restore(); c.setLineDash([]);
    c.beginPath();
    for (let i = 0; i < sides; i += 1) {
      const a = (i / sides) * TAU;
      c.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7); c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.stroke();
  },
};

function drawSniperSight(c, e, r, t) {
  const charge = clamp01(e.aimCharge || 0), ang = e.aimAngle ?? e.rot ?? 0;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const sx = e.x + ca * r * 1.25, sy = e.y + sa * r * 1.25, ex = e.x + ca * 1450, ey = e.y + sa * 1450;
  const flk = 0.82 + 0.18 * Math.sin(t * 28);
  c.save(); c.globalCompositeOperation = L;
  seg(c, sx, sy, ex, ey, rgba(PALETTE.red, (0.09 + charge * 0.26) * flk), 1.6 + (1 - charge) * 14);
  if (charge <= 0.75) c.setLineDash([12, 8]);
  seg(c, sx, sy, ex, ey, rgba(PALETTE.red, (0.35 + charge * 0.65) * flk), 0.8 + charge * 1.6);
  c.setLineDash([]);
  if (charge > 0.62) seg(c, sx, sy, ex, ey, rgba('#ffffff', ((charge - 0.62) / 0.38) * 0.9), 1);
  drawGlow(c, PALETTE.red, sx, sy, 10 + charge * 12, 0.4 + charge * 0.55);
  c.restore();
}

export function drawEnemy(c, e, t) {
  const elite = e.kind === 'elite', color = e.color || PALETTE.magenta, sides = e.sides || 3;
  const radius = e.radius || 14, rot = e.rot || 0, hpRatio = e.maxHp > 0 ? e.hp / e.maxHp : 1;
  const flash = (e.flash || 0) > 0, born = e.age === undefined ? 1 : clamp01(e.age / 0.5);
  const r = radius * (born < 1 ? 1 - (1 - born) ** 3 * 0.9 : 1);

  if (e.kind === 'sniper' && (e.aimCharge || 0) > 0) drawSniperSight(c, e, r, t);

  c.globalCompositeOperation = L;
  drawGlow(c, color, e.x, e.y, r * 2.8, (elite ? 0.55 : 0.42) * (flash ? 1.5 : 1) * (0.4 + 0.6 * born));
  c.globalCompositeOperation = S;

  c.save(); c.translate(e.x, e.y); c.rotate(rot); c.lineJoin = 'round';
  if (elite) { c.shadowColor = color; c.shadowBlur = 18; }
  bodyPath(c, e.kind, r, sides);
  const body = c.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
  body.addColorStop(0, rgba(color, flash ? 0.95 : 0.1 + 0.25 * hpRatio));
  body.addColorStop(1, rgba(color, flash ? 0.95 : 0.36));
  c.fillStyle = flash ? '#ffffff' : body; c.fill();
  c.strokeStyle = flash ? '#ffffff' : color; c.lineWidth = elite ? 3.4 : 2.3; c.stroke();
  c.shadowBlur = 0;

  c.strokeStyle = rgba(PALETTE.white, flash ? 0.9 : 0.52); c.lineWidth = 1.2;
  (MARKINGS[e.kind] ?? MARKINGS.elite)(c, e, r, t);
  c.restore();

  c.globalCompositeOperation = L;
  drawGlow(c, flash ? '#ffffff' : PALETTE.white, e.x, e.y, r * (elite ? 0.7 : 0.55), 0.6 + 0.25 * Math.sin(t * 6 + (e.phase || 0)));
  c.globalCompositeOperation = S;

  if (elite) drawEliteExtras(c, e, t, hpRatio, color, radius, sides);
}

function drawEliteExtras(c, e, t, hpRatio, color, radius, sides) {
  const charge = clamp01(e.bossCharge || 0);
  if (charge > 0) {
    const m = e.attackMode;
    const cCol = m === 'lunge' ? PALETTE.red : m === 'nova' ? PALETTE.amber : m === 'spiral' ? PALETTE.cyan : color;
    c.save(); c.globalCompositeOperation = L;
    drawGlow(c, cCol, e.x, e.y, radius * (1.8 + charge * 0.9), charge * 0.55);
    ring(c, e.x, e.y, radius + 12 + (1 - charge) * 38, rgba(cCol, 0.35 + charge * 0.6), 1.6 + charge * 2.6);
    c.setLineDash([12, 10]); c.strokeStyle = rgba('#ffffff', charge * 0.75); c.lineWidth = 1.4;
    c.beginPath(); c.arc(e.x, e.y, radius + 18, t * 4, t * 4 + TAU); c.stroke();
    c.setLineDash([]); c.restore();
  }
  const sats = sides >= 10 ? 4 : 3;
  for (let i = 0; i < sats; i += 1) {
    const a = t * 1.6 + (i / sats) * TAU;
    c.save();
    c.translate(e.x + Math.cos(a) * (radius + 16), e.y + Math.sin(a) * (radius + 16));
    c.rotate(a * 2);
    polyPath(c, 0, 0, 5, 4, 0);
    c.fillStyle = rgba(color, 0.9); c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = 1; c.stroke();
    c.restore();
  }
  const w = 84, x = e.x - 42, y = e.y - radius - 32;
  c.fillStyle = 'rgba(5,6,26,0.7)'; c.fillRect(x - 2, y - 2, w + 4, 9);
  c.fillStyle = rgba(PALETTE.white, 0.15); c.fillRect(x, y, w, 5);
  c.fillStyle = color; c.fillRect(x, y, w * clamp01(hpRatio), 5);
  c.strokeStyle = rgba(color, 0.8); c.lineWidth = 1; c.strokeRect(x - 2.5, y - 2.5, w + 5, 10);
}

export function drawBullets(c, list) {
  if (!list || !list.length) return;
  c.globalCompositeOperation = L; c.lineCap = 'round';
  for (const b of list) {
    const col = b.color || PALETTE.cyan, pow = Boolean(b.powered), tail = pow ? 0.038 : 0.032;
    seg(c, b.x - b.vx * tail, b.y - b.vy * tail, b.x, b.y, rgba(col, pow ? 0.88 : 0.75), pow ? 6.5 : 5);
    seg(c, b.x - b.vx * 0.017, b.y - b.vy * 0.017, b.x, b.y, '#ffffff', pow ? 2.6 : 2);
    drawGlow(c, col, b.x, b.y, pow ? 17 : 13, pow ? 0.85 : 0.7);
    if (pow) drawGlow(c, PALETTE.cyan, b.x, b.y, 9, 0.5);
  }
  c.lineCap = 'butt'; c.globalCompositeOperation = S;
}

export function drawEnemyBullets(c, list, t) {
  if (!list || !list.length) return;
  for (const b of list) {
    const col = b.color || PALETTE.red, r = b.radius || 5;
    if (b.fast) {
      c.globalCompositeOperation = L; c.lineCap = 'round';
      seg(c, b.x - b.vx * 0.068, b.y - b.vy * 0.068, b.x, b.y, rgba(col, 0.82), 6.5);
      seg(c, b.x - b.vx * 0.045, b.y - b.vy * 0.045, b.x, b.y, '#ffffff', 2.2);
      drawGlow(c, col, b.x, b.y, 22, 0.9);
      c.lineCap = 'butt'; c.globalCompositeOperation = S;
      continue;
    }
    c.globalCompositeOperation = L; drawGlow(c, col, b.x, b.y, 20, 0.75);
    c.globalCompositeOperation = S; c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(b.x, b.y, r * 0.55, 0, TAU); c.fill();
    ring(c, b.x, b.y, r + Math.sin(t * 14) * 0.8, col, 2);
  }
}

export function drawCores(c, list, t) {
  if (!list || !list.length) return;
  for (const co of list) {
    if (CORE.life - (co.age || 0) < CORE.blink && Math.floor(t * 10) % 2 === 0) continue;
    const pulse = 0.8 + 0.2 * Math.sin(t * 6 + (co.phase || 0));
    c.globalCompositeOperation = L; drawGlow(c, PALETTE.amber, co.x, co.y, 24 * pulse, 0.85);
    c.globalCompositeOperation = S; c.save(); c.translate(co.x, co.y);
    starPath(c, 0, 0, 9.5, 3.4, 4, t * (co.spin || 1.4));
    c.fillStyle = PALETTE.gold; c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = 1.2; c.stroke();
    c.restore(); c.globalCompositeOperation = L; drawGlow(c, '#ffffff', co.x, co.y, 6, 0.9);
    c.globalCompositeOperation = S;
  }
}

export function drawPickups(c, list, t) {
  if (!list || !list.length) return;
  const emerald = PALETTE.emerald || '#4dff9a', blink = PICKUP ? PICKUP.blink : 3.0;
  for (const p of list) {
    if ((p.life ?? (PICKUP ? PICKUP.life : 14)) - (p.age || 0) < blink && Math.floor(t * 10) % 2 === 0) continue;
    const k = p.kind, col = k === 'hull' ? emerald : k === 'shield' ? PALETTE.cyan : PALETTE.amber;
    const r = p.radius || 15, pulse = 0.88 + 0.12 * Math.sin(t * 5 + (p.phase || 0));

    c.globalCompositeOperation = L; drawGlow(c, col, p.x, p.y, r * 2.5 * pulse, 0.8);
    c.globalCompositeOperation = S; c.save(); c.translate(p.x, p.y);
    polyPath(c, 0, 0, r * 1.12 * pulse, 6, t * 1.2);
    c.fillStyle = 'rgba(5,6,26,0.82)'; c.fill();
    c.strokeStyle = col; c.lineWidth = 2; c.stroke();

    c.setLineDash([5, 4]); ring(c, 0, 0, r * 0.82, rgba('#ffffff', 0.55), 1.1); c.setLineDash([]);
    if (k === 'hull') {
      const a = r * 0.44, th = r * 0.17;
      c.fillStyle = '#ffffff'; c.fillRect(-th, -a, th * 2, a * 2); c.fillRect(-a, -th, a * 2, th * 2);
    } else if (k === 'shield') {
      strokePoly(c, 0, 0, r * 0.52, 6, Math.PI / 6, '#ffffff', 2);
      c.fillStyle = rgba(PALETTE.ice, 0.85); c.beginPath(); c.arc(0, 0, r * 0.18, 0, TAU); c.fill();
    } else {
      c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath();
      for (let i = 0; i < 3; i += 1) {
        const a = -Math.PI / 2 + SPREAD_ANGLES[i], tx = Math.cos(a) * r * 0.52, ty = Math.sin(a) * r * 0.52 + 1.5;
        c.moveTo(tx - Math.cos(a - 0.5) * 4.5, ty - Math.sin(a - 0.5) * 4.5);
        c.lineTo(tx, ty); c.lineTo(tx - Math.cos(a + 0.5) * 4.5, ty - Math.sin(a + 0.5) * 4.5);
      }
      c.stroke();
    }
    c.restore();
  }
}

export function drawParticles(c, list) {
  if (!list || !list.length) return;
  c.globalCompositeOperation = L; c.lineCap = 'round';
  for (const p of list) {
    const a = clamp01(p.life / (p.max || 1)), col = p.color || PALETTE.cyan, k = p.kind;
    if (k === 'spark') {
      seg(c, p.x, p.y, p.x - p.vx * 0.04, p.y - p.vy * 0.04, rgba(col, Math.min(1, a * 1.4)), p.size * (0.4 + a * 0.6));
    } else if (k === 'glow') {
      drawGlow(c, col, p.x, p.y, p.size * (1 + (1 - a) * (p.grow || 0)), a * (p.alpha ?? 1));
    } else if (k === 'ring') {
      const f = 1 - a;
      ring(c, p.x, p.y, p.size * (0.12 + 0.88 * (1 - (1 - f) * (1 - f))), rgba(col, a * 0.85), 1 + 3.5 * a);
    } else if (k === 'shockwave') {
      const f = 1 - a, rad = p.size * (0.14 + 0.86 * (1 - (1 - f) * (1 - f)));
      ring(c, p.x, p.y, rad, rgba(col, a * 0.65), 2 + 6 * a);
      ring(c, p.x, p.y, rad * 0.96, rgba('#ffffff', a * 0.85), 1.2 + 2.2 * a);
      ring(c, p.x, p.y, rad * 0.72, rgba(col, a * 0.42), 1 + 2.2 * a);
    } else if (k === 'shard') {
      const rot = p.rot || 0, dx = Math.cos(rot) * p.size * 0.5, dy = Math.sin(rot) * p.size * 0.5;
      seg(c, p.x - dx, p.y - dy, p.x + dx, p.y + dy, rgba(col, a), 2);
    } else if (k === 'debris') {
      polyPath(c, p.x, p.y, p.size * (0.55 + 0.45 * a), p.sides || 3, p.rot || 0);
      c.fillStyle = rgba(col, a * 0.42); c.fill();
      c.strokeStyle = rgba('#ffffff', a * 0.65); c.lineWidth = 1.2; c.stroke();
    } else if (k === 'ember') {
      const alpha = a * (p.alpha ?? 1), h = p.size * 0.35;
      drawGlow(c, col, p.x, p.y, p.size * (2.6 + a), alpha * 0.75);
      c.fillStyle = rgba('#ffffff', alpha * 0.9); c.fillRect(p.x - h, p.y - h, h * 2, h * 2);
    }
  }
  c.lineCap = 'butt'; c.globalCompositeOperation = S;
  for (const p of list) {
    if (p.kind !== 'text') continue;
    const a = clamp01(p.life / (p.max || 1)), pop = a > 0.85 ? 1 + (a - 0.85) * 3 : 1;
    text(c, p.text, p.x, p.y, {
      size: p.size * pop, weight: p.weight || 800, color: p.color || PALETTE.white, align: 'center', spacing: 1, glow: p.color || PALETTE.cyan, blur: 8, alpha: Math.min(1, a * 2.2),
    });
  }
}
