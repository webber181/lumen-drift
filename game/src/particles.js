// Particle effects: plain objects in state.particles, advanced by update() and painted by
// actors.js. Kinds: spark (streak), glow (soft flash), ring (shockwave), shard (spinning
// debris line), text (floating popup). All randomness comes from the rng passed in.
import { range } from './random.js';

const MAX_PARTICLES = 1200;

function add(state, p) {
  if (state.particles.length >= MAX_PARTICLES) return null;
  state.particles.push(p);
  return p;
}

function make(kind, x, y, color, life, size) {
  return { kind, x, y, vx: 0, vy: 0, life, max: life, size, color, drag: 0, rot: 0, vr: 0, alpha: 1, grow: 0, text: '', weight: 700 };
}

export function spark(state, rng, x, y, color, speed, life, size = 2) {
  const a = rng() * Math.PI * 2;
  const v = speed * range(rng, 0.35, 1);
  const p = make('spark', x, y, color, life * range(rng, 0.6, 1), size);
  if (!add(state, p)) return;
  p.vx = Math.cos(a) * v;
  p.vy = Math.sin(a) * v;
  p.drag = 2.6;
}

export function sparkDir(state, rng, x, y, angle, spread, color, speed, life, size = 2) {
  const a = angle + (rng() - 0.5) * spread;
  const v = speed * range(rng, 0.5, 1);
  const p = make('spark', x, y, color, life * range(rng, 0.6, 1), size);
  if (!add(state, p)) return;
  p.vx = Math.cos(a) * v;
  p.vy = Math.sin(a) * v;
  p.drag = 3.2;
}

export function glow(state, x, y, color, radius, life, alpha = 1, grow = 0, vx = 0, vy = 0) {
  const p = add(state, make('glow', x, y, color, life, radius));
  if (!p) return;
  p.alpha = alpha;
  p.grow = grow;
  p.vx = vx;
  p.vy = vy;
  p.drag = 2;
}

export function ring(state, x, y, color, radius, life) {
  add(state, make('ring', x, y, color, life, radius));
}

export function shard(state, rng, x, y, color, speed, size) {
  const a = rng() * Math.PI * 2;
  const v = speed * range(rng, 0.3, 1);
  const p = add(state, make('shard', x, y, color, range(rng, 0.5, 1.1), size));
  if (!p) return;
  p.vx = Math.cos(a) * v;
  p.vy = Math.sin(a) * v;
  p.rot = rng() * Math.PI;
  p.vr = range(rng, -9, 9);
  p.drag = 1.8;
}

export function popup(state, text, x, y, color, size = 18, life = 0.95) {
  const p = add(state, make('text', x, y, color, life, size));
  if (!p) return;
  p.text = text;
  p.vy = -46;
  p.drag = 1.4;
}

/** A full destroyed-enemy burst, scaled by `size` (about the enemy's radius). */
export function explosion(state, rng, x, y, color, size) {
  glow(state, x, y, '#ffffff', size * 3.2, 0.2, 0.9, 0.5);
  glow(state, x, y, color, size * 6, 0.55, 0.8, 0.9);
  ring(state, x, y, color, size * 4.2, 0.5);
  if (size > 30) ring(state, x, y, '#ffffff', size * 2.6, 0.35);
  const sparks = Math.round(12 + size * 0.9);
  for (let i = 0; i < sparks; i += 1) spark(state, rng, x, y, i % 3 === 0 ? '#ffffff' : color, 160 + size * 7, 0.75, 1.6 + rng() * 1.6);
  const shards = Math.round(4 + size / 6);
  for (let i = 0; i < shards; i += 1) shard(state, rng, x, y, color, 120 + size * 5, 4 + size * 0.3);
  for (let i = 0; i < 4; i += 1) {
    glow(state, x + range(rng, -size, size) * 0.5, y + range(rng, -size, size) * 0.5, color, size * range(rng, 1.4, 2.4), range(rng, 0.45, 0.8), 0.35, 0.6, range(rng, -30, 30), range(rng, -30, 30));
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
  ring(state, x, y, color, 90, 0.55);
  ring(state, x, y, '#ffffff', 60, 0.35);
  glow(state, x, y, color, 80, 0.4, 0.8, 0.6);
  for (let i = 0; i < 18; i += 1) spark(state, rng, x, y, color, 360, 0.5, 2);
}

/** Advance every particle by dt seconds and drop the dead ones. */
export function update(state, dt) {
  const list = state.particles;
  const drag = (k) => Math.exp(-k * dt);
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) {
      list[i] = list[list.length - 1];
      list.pop();
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.drag) {
      const f = drag(p.drag);
      p.vx *= f;
      p.vy *= f;
    }
    p.rot += p.vr * dt;
  }
}
