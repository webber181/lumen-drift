// Shared drawing helpers: colour strings, capped glow sprites, polygon paths and text.
import { FONT_UI } from './config.js';

const rgbCache = new Map();
const sprites = new Map();

export function rgb(hex) {
  const key = hex && hex[0] === '#' ? hex : '#3df2ff';
  let c = rgbCache.get(key);
  if (!c) {
    const n = Number.parseInt(key.slice(1), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(key, c);
  }
  return c;
}

export function rgba(hex, alpha) {
  const c = rgb(hex);
  const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

export function mix(a, b, t) {
  const x = rgb(a), y = rgb(b);
  const h = (i) => Math.round(x[i] + (y[i] - x[i]) * t).toString(16).padStart(2, '0');
  return `#${h(0)}${h(1)}${h(2)}`;
}

export function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function glowSprite(hex) {
  const key = hex && hex[0] === '#' ? hex : '#3df2ff';
  let s = sprites.get(key);
  if (!s) {
    if (sprites.size >= 48) sprites.delete(sprites.keys().next().value);
    s = makeCanvas(96, 96);
    const g = s.getContext('2d');
    if (g) {
      const grad = g.createRadialGradient(48, 48, 0, 48, 48, 48);
      grad.addColorStop(0, rgba(key, 1));
      grad.addColorStop(0.22, rgba(key, 0.6));
      grad.addColorStop(0.55, rgba(key, 0.16));
      grad.addColorStop(1, rgba(key, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, 96, 96);
    }
    sprites.set(key, s);
  }
  return s;
}

export function drawGlow(ctx, hex, x, y, radius, alpha = 1) {
  if (!hex || alpha <= 0.002 || radius <= 0.5) return;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * (alpha > 1 ? 1 : alpha);
  ctx.drawImage(glowSprite(hex), x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = prev;
}

export function polyPath(ctx, x, y, r, sides, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = rot + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function starPath(ctx, x, y, outer, inner, points, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const a = rot + (i / (points * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? outer : inner;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export function text(ctx, str, x, y, opts = {}) {
  const { size = 16, weight = 600, color = '#dff3ff', align = 'left', baseline = 'alphabetic', spacing = 0, font = FONT_UI, glow = null, blur = 12, alpha = 1 } = opts;
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  ctx.globalAlpha *= alpha;
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = blur; }
  ctx.fillStyle = color;
  const dx = align === 'center' ? spacing / 2 : align === 'right' ? spacing : 0;
  ctx.fillText(str, x + dx, y);
  ctx.restore();
}

export function measure(ctx, str, size, weight = 600, spacing = 0, font = FONT_UI) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

export function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function formatScore(n) {
  return Math.round(n).toLocaleString('en-US');
}
