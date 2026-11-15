// Painting the things in the world: the ship, the drones, shots, star cores and particles.
// Everything is vector shapes plus cached glow sprites; shadowBlur is used only on the ship
// and the elite so a screen full of enemies stays fast.
import { PALETTE } from './config.js';
import { clamp01, drawGlow, polyPath, rgba, starPath, text } from './gfx.js';

const TAU = Math.PI * 2;
/** The ship is drawn a little larger than its hit circle so it reads clearly. */
const SHIP_SCALE = 1.3;

export function drawPlayer(ctx, p, t, opts = {}) {
  const { invulnerable = p.invulnerable, shieldReady = false, thrust = p.thrust } = opts;
  if (invulnerable > 0 && Math.floor(t * 16) % 2 === 0) {
    // Blink while invulnerable: draw a faint ghost instead of the ship.
    ctx.globalAlpha = 0.28;
  }
  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, PALETTE.cyan, 0, 0, 52 + (p.flare || 0) * 8, 0.42 + (p.flare || 0) * 0.15);
  ctx.restore();

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.scale(SHIP_SCALE, SHIP_SCALE);

  // Engine flame.
  const flame = 7 + thrust * 15 + Math.sin(t * 60) * 1.5;
  ctx.globalCompositeOperation = 'lighter';
  for (const side of [-1, 1]) {
    const g = ctx.createLinearGradient(-8, 0, -8 - flame, 0);
    g.addColorStop(0, rgba(PALETTE.ice, 0.95));
    g.addColorStop(0.35, rgba(PALETTE.cyan, 0.7));
    g.addColorStop(1, rgba(PALETTE.violet, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-7, side * 6.5 - 3);
    ctx.lineTo(-8 - flame, side * 6.5);
    ctx.lineTo(-7, side * 6.5 + 3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  // Hull.
  ctx.shadowColor = PALETTE.cyan;
  ctx.shadowBlur = 14;
  const hull = ctx.createLinearGradient(-12, 0, 20, 0);
  hull.addColorStop(0, '#0b2c63');
  hull.addColorStop(0.55, '#1d8bc4');
  hull.addColorStop(1, '#9ff6ff');
  ctx.fillStyle = hull;
  ctx.strokeStyle = PALETTE.ice;
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-11, -12.5);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-11, 12.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Details: spine, wing accents, cockpit.
  ctx.strokeStyle = rgba(PALETTE.white, 0.55);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(-3, 0);
  ctx.stroke();
  ctx.strokeStyle = rgba(PALETTE.magenta, 0.9);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-6, -9.5);
  ctx.lineTo(-10, -11.2);
  ctx.moveTo(-6, 9.5);
  ctx.lineTo(-10, 11.2);
  ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, PALETTE.white, 4, 0, 7, 0.9);
  ctx.restore();

  if (shieldReady) drawShield(ctx, p, t);
  ctx.globalAlpha = 1;
}

function drawShield(ctx, p, t) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.globalCompositeOperation = 'lighter';
  const pulse = 0.75 + 0.25 * Math.sin(t * 5);
  drawGlow(ctx, PALETTE.cyan, 0, 0, 52, 0.22 * pulse);
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = rgba(PALETTE.cyan, 0.65 * pulse + 0.2);
  ctx.lineWidth = 2;
  ctx.setLineDash([9, 6]);
  ctx.lineDashOffset = -t * 30;
  polyPath(ctx, 0, 0, 33, 6, t * 0.8);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = rgba(PALETTE.ice, 0.28);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 38, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

export function drawReticle(ctx, p, t) {
  const x = p.aimX;
  const y = p.aimY;
  // Faint aim line from the nose.
  ctx.save();
  ctx.strokeStyle = rgba(PALETTE.cyan, 0.1);
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 9]);
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(p.angle) * 24, p.y + Math.sin(p.angle) * 24);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.translate(x, y);
  ctx.rotate(t * 0.8);
  ctx.strokeStyle = rgba(PALETTE.cyan, 0.8);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * TAU;
    ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
    ctx.lineTo(Math.cos(a) * 18, Math.sin(a) * 18);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawEnemy(ctx, e, t) {
  const hpRatio = e.maxHp > 0 ? e.hp / e.maxHp : 1;
  const flash = e.flash > 0;
  const born = e.age === undefined ? 1 : clamp01(e.age / 0.5);
  const grow = born < 1 ? 1 - Math.pow(1 - born, 3) * 0.9 : 1;
  const r = e.radius * grow;

  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, e.color, e.x, e.y, r * 2.8, (e.kind === 'elite' ? 0.55 : 0.42) * (flash ? 1.5 : 1) * (0.4 + 0.6 * born));
  ctx.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.rot);
  ctx.lineJoin = 'round';
  if (e.kind === 'elite') {
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 18;
  }

  // Body: dark translucent fill with a bright rim.
  polyPath(ctx, 0, 0, r, e.sides, 0);
  const body = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
  body.addColorStop(0, rgba(e.color, flash ? 0.95 : 0.1 + 0.25 * hpRatio));
  body.addColorStop(1, rgba(e.color, flash ? 0.95 : 0.34));
  ctx.fillStyle = flash ? '#ffffff' : body;
  ctx.fill();
  ctx.strokeStyle = flash ? '#ffffff' : e.color;
  ctx.lineWidth = e.kind === 'elite' ? 3.4 : 2.4;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Inner shapes, distinct per kind.
  ctx.strokeStyle = rgba(PALETTE.white, flash ? 0.9 : 0.5);
  ctx.lineWidth = 1.2;
  if (e.kind === 'triangle') {
    polyPath(ctx, -r * 0.1, 0, r * 0.5, 3, 0);
    ctx.stroke();
  } else if (e.kind === 'square') {
    ctx.save();
    ctx.rotate(-e.rot * 2.4);
    polyPath(ctx, 0, 0, r * 0.62, 4, Math.PI / 4);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = rgba(e.color, 0.7);
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62);
      ctx.lineTo(Math.cos(a + Math.PI / 4) * r, Math.sin(a + Math.PI / 4) * r);
      ctx.stroke();
    }
  } else if (e.kind === 'pentagon') {
    ctx.beginPath();
    for (let i = 0; i < 5; i += 1) {
      const a = ((i * 2) / 5) * TAU;
      const px = Math.cos(a) * r * 0.72;
      const py = Math.sin(a) * r * 0.72;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  } else {
    // Elite: nested polygon, counter-rotating ring, health-coloured core.
    polyPath(ctx, 0, 0, r * 0.7, e.sides, Math.PI / e.sides);
    ctx.stroke();
    ctx.save();
    ctx.rotate(-e.rot * 3 + t);
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = rgba(PALETTE.white, 0.45);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.5, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    for (let i = 0; i < e.sides; i += 1) {
      const a = (i / e.sides) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Bright core.
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, flash ? '#ffffff' : PALETTE.white, e.x, e.y, r * (e.kind === 'elite' ? 0.7 : 0.55), 0.6 + 0.25 * Math.sin(t * 6 + (e.phase || 0)));
  ctx.globalCompositeOperation = 'source-over';

  if (e.kind === 'elite') drawEliteExtras(ctx, e, t, hpRatio);
}

function drawEliteExtras(ctx, e, t, hpRatio) {
  // Orbiting satellites.
  for (let i = 0; i < 3; i += 1) {
    const a = t * 1.6 + (i / 3) * TAU;
    const sx = e.x + Math.cos(a) * (e.radius + 16);
    const sy = e.y + Math.sin(a) * (e.radius + 16);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(a * 2);
    polyPath(ctx, 0, 0, 5, 4, 0);
    ctx.fillStyle = rgba(e.color, 0.9);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
  // Health bar.
  const w = 84;
  const x = e.x - w / 2;
  const y = e.y - e.radius - 32;
  ctx.fillStyle = 'rgba(5,6,26,0.7)';
  ctx.fillRect(x - 2, y - 2, w + 4, 9);
  ctx.fillStyle = rgba(PALETTE.white, 0.15);
  ctx.fillRect(x, y, w, 5);
  ctx.fillStyle = e.color;
  ctx.fillRect(x, y, w * clamp01(hpRatio), 5);
  ctx.strokeStyle = rgba(e.color, 0.8);
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 2.5, y - 2.5, w + 5, 10);
}

export function drawBullets(ctx, list) {
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const b of list) {
    const tx = b.x - b.vx * 0.032;
    const ty = b.y - b.vy * 0.032;
    ctx.strokeStyle = rgba(PALETTE.cyan, 0.75);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    drawGlow(ctx, PALETTE.cyan, b.x, b.y, 13, 0.7);
  }
  ctx.lineCap = 'butt';
  ctx.globalCompositeOperation = 'source-over';
}

export function drawEnemyBullets(ctx, list, t) {
  for (const b of list) {
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, b.color, b.x, b.y, 20, 0.75);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 0.55, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius + Math.sin(t * 14) * 0.8, 0, TAU);
    ctx.stroke();
  }
}

export function drawCores(ctx, list, t) {
  for (const c of list) {
    const remaining = 10 - c.age;
    if (remaining < 2.2 && Math.floor(t * 10) % 2 === 0) continue;
    const pulse = 0.8 + 0.2 * Math.sin(t * 6 + c.phase);
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, PALETTE.amber, c.x, c.y, 24 * pulse, 0.85);
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.translate(c.x, c.y);
    starPath(ctx, 0, 0, 9.5, 3.4, 4, t * c.spin);
    ctx.fillStyle = PALETTE.gold;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, '#ffffff', c.x, c.y, 6, 0.9);
    ctx.globalCompositeOperation = 'source-over';
  }
}

export function drawParticles(ctx, list) {
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const p of list) {
    const a = p.life / p.max;
    if (p.kind === 'spark') {
      ctx.strokeStyle = rgba(p.color, Math.min(1, a * 1.4));
      ctx.lineWidth = p.size * (0.4 + a * 0.6);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
      ctx.stroke();
    } else if (p.kind === 'glow') {
      const radius = p.size * (1 + (1 - a) * p.grow);
      drawGlow(ctx, p.color, p.x, p.y, radius, a * p.alpha);
    } else if (p.kind === 'ring') {
      const k = 1 - a;
      const radius = p.size * (0.12 + 0.88 * (1 - (1 - k) * (1 - k)));
      ctx.strokeStyle = rgba(p.color, a * 0.85);
      ctx.lineWidth = 1 + 3.5 * a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, TAU);
      ctx.stroke();
    } else if (p.kind === 'shard') {
      const dx = Math.cos(p.rot) * p.size * 0.5;
      const dy = Math.sin(p.rot) * p.size * 0.5;
      ctx.strokeStyle = rgba(p.color, a);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - dx, p.y - dy);
      ctx.lineTo(p.x + dx, p.y + dy);
      ctx.stroke();
    }
  }
  ctx.lineCap = 'butt';
  ctx.globalCompositeOperation = 'source-over';
  for (const p of list) {
    if (p.kind !== 'text') continue;
    const a = p.life / p.max;
    const pop = a > 0.85 ? 1 + (a - 0.85) * 3 : 1;
    text(ctx, p.text, p.x, p.y, {
      size: p.size * pop, weight: 800, color: p.color, align: 'center', spacing: 1, glow: p.color, blur: 8, alpha: Math.min(1, a * 2.2),
    });
  }
}
