// Particle pool (MAX_PARTICLES = 900 reusable objects) and emitters for sparks, glows,
// rings, shockwaves, shards, polygon debris, embers, and popups.
import { range } from './random.js';

export const MAX_PARTICLES = 900;
const pools = new WeakMap();
const { cos, exp, min, PI, round, sin } = Math;
const TAU = PI * 2;

function getPool(state) {
  let pool = pools.get(state);
  if (!pool) {
    const all = new Array(MAX_PARTICLES);
    const free = new Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      all[i] = free[i] = {
        kind: '', x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 0,
        color: '#ffffff', drag: 0, rot: 0, vr: 0, alpha: 1, grow: 0, sides: 3, text: '', weight: 700,
      };
    }
    pool = { all, free };
    pools.set(state, pool);
  }
  return pool;
}

function add(state, kind, x, y, color, life, size) {
  const list = state.particles;
  if (list.length >= MAX_PARTICLES) return null;
  const pool = getPool(state);
  if (pool.free.length === 0) {
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      if (list.length === 0 || !list.includes(pool.all[i])) pool.free.push(pool.all[i]);
    }
    if (pool.free.length === 0) return null;
  }
  const p = pool.free.pop();
  p.kind = kind; p.x = x; p.y = y; p.vx = 0; p.vy = 0; p.life = life; p.max = life > 0 ? life : 0.001;
  p.size = size; p.color = color; p.drag = 0; p.rot = 0; p.vr = 0; p.alpha = 1; p.grow = 0; p.sides = 3; p.text = ''; p.weight = 700;
  list.push(p);
  return p;
}

function radial(state, rng, kind, x, y, color, speed, minF, life, size, drag) {
  const p = add(state, kind, x, y, color, life, size);
  if (!p) return null;
  const a = rng() * TAU; const v = speed * range(rng, minF, 1);
  p.vx = cos(a) * v; p.vy = sin(a) * v; p.drag = drag;
  return p;
}

export function spark(state, rng, x, y, color, speed, life, size = 2) {
  radial(state, rng, 'spark', x, y, color, speed, 0.35, life * range(rng, 0.6, 1), size, 2.6);
}

export function sparkDir(state, rng, x, y, angle, spread, color, speed, life, size = 2) {
  const p = add(state, 'spark', x, y, color, life * range(rng, 0.6, 1), size);
  if (!p) return;
  const a = angle + (rng() - 0.5) * spread; const v = speed * range(rng, 0.5, 1);
  p.vx = cos(a) * v; p.vy = sin(a) * v; p.drag = 3.2;
}

export function glow(state, x, y, color, radius, life, alpha = 1, grow = 0, vx = 0, vy = 0) {
  const p = add(state, 'glow', x, y, color, life, radius);
  if (p) { p.alpha = alpha; p.grow = grow; p.vx = vx; p.vy = vy; p.drag = 2; }
}

export function ring(state, x, y, color, radius, life) {
  add(state, 'ring', x, y, color, life, radius);
}

export function shockwave(state, x, y, color, radius, life) {
  add(state, 'shockwave', x, y, color, life, radius);
}

export function shard(state, rng, x, y, color, speed, size) {
  const p = radial(state, rng, 'shard', x, y, color, speed, 0.3, range(rng, 0.5, 1.1), size, 1.8);
  if (p) { p.rot = rng() * PI; p.vr = range(rng, -9, 9); }
}

export function debris(state, rng, x, y, color, speed, size, sides = 3) {
  const p = radial(state, rng, 'debris', x, y, color, speed, 0.28, range(rng, 0.55, 1.15), size, 1.6);
  if (p) { p.rot = rng() * TAU; p.vr = range(rng, -8, 8); p.sides = sides; }
}

export function ember(state, rng, x, y, color, speed, life = 0.7, size = 2.4) {
  const p = radial(state, rng, 'ember', x, y, color, speed * 0.9, 0.22, life * range(rng, 0.65, 1.2), size, 1.2);
  if (p) p.alpha = 0.95;
}

export function popup(state, text, x, y, color, size = 18, life = 0.95) {
  const p = add(state, 'text', x, y, color, life, size);
  if (p) { p.text = text; p.vy = -46; p.drag = 1.4; p.weight = 800; }
}

export function explosion(state, rng, x, y, color, size) {
  glow(state, x, y, '#ffffff', size * 3.0, 0.18, 0.9, 0.5);
  glow(state, x, y, color, size * 5.6, 0.52, 0.78, 0.9);
  shockwave(state, x, y, color, size * 4.4, 0.52);
  if (size > 28) shockwave(state, x, y, '#ffffff', size * 2.8, 0.36);
  for (let i = 0, n = min(28, round(9 + size * 0.55)); i < n; i += 1) spark(state, rng, x, y, i % 3 === 0 ? '#ffffff' : color, 155 + size * 6.8, 0.7, 1.5 + rng() * 1.5);
  for (let i = 0, n = min(10, round(3 + size / 8)); i < n; i += 1) debris(state, rng, x, y, color, 115 + size * 4.8, 3.6 + size * 0.24, 3 + (i % 3));
  for (let i = 0, n = min(12, round(3 + size / 7)); i < n; i += 1) ember(state, rng, x, y, i % 2 === 0 ? color : '#ffffff', 95 + size * 3.5, 0.75, 2 + rng() * 1.6);
  for (let i = 0; i < 3; i += 1) {
    glow(state, x + range(rng, -size, size) * 0.45, y + range(rng, -size, size) * 0.45, color,
      size * range(rng, 1.4, 2.2), range(rng, 0.42, 0.75), 0.32, 0.55, range(rng, -28, 28), range(rng, -28, 28));
  }
}

export function impact(state, rng, x, y, color) {
  glow(state, x, y, '#ffffff', 11, 0.1, 0.9, 0.4);
  for (let i = 0; i < 4; i += 1) spark(state, rng, x, y, color, 210, 0.3, 1.5);
}

export function pickupBurst(state, rng, x, y, color) {
  ring(state, x, y, color, 30, 0.35);
  glow(state, x, y, color, 34, 0.25, 0.9, 0.6);
  for (let i = 0; i < 6; i += 1) spark(state, rng, x, y, i % 2 ? '#ffffff' : color, 150, 0.4, 1.6);
}

export function shieldBurst(state, rng, x, y, color) {
  shockwave(state, x, y, color, 96, 0.55);
  ring(state, x, y, '#ffffff', 60, 0.35);
  glow(state, x, y, color, 80, 0.4, 0.8, 0.6);
  for (let i = 0; i < 18; i += 1) spark(state, rng, x, y, color, 360, 0.5, 2);
}

export function update(state, dt) {
  const list = state.particles;
  const pool = getPool(state);
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const p = list[i];
    if ((p.life -= dt) <= 0) {
      const last = list.pop();
      if (i < list.length) list[i] = last;
      pool.free.push(p);
      continue;
    }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.drag) { const f = exp(-p.drag * dt); p.vx *= f; p.vy *= f; }
    p.rot += p.vr * dt;
  }
}
