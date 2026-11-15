// Small drawing helpers shared by every renderer file: colour strings, cached glow sprites
// (a soft radial gradient painted once, then stamped with additive blending, which is much
// cheaper than shadowBlur), polygon paths, rounded rectangles and a text helper.
import { FONT_UI } from './config.js';

const rgbCache = new Map();

export function rgb(hex) {
  let c = rgbCache.get(hex);
  if (!c) {
    const n = Number.parseInt(hex.slice(1), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, c);
  }
  return c;
}

export function rgba(hex, alpha) {
  const c = rgb(hex);
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

/** Linear blend of two #rrggbb colours. */
export function mix(a, b, t) {
  const x = rgb(a);
  const y = rgb(b);
  const h = (i) => Math.round(x[i] + (y[i] - x[i]) * t).toString(16).padStart(2, '0');
  return `#${h(0)}${h(1)}${h(2)}`;
}

export function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

const sprites = new Map();

function glowSprite(hex) {
  let s = sprites.get(hex);
  if (!s) {
    s = makeCanvas(96, 96);
    const g = s.getContext('2d');
    const grad = g.createRadialGradient(48, 48, 0, 48, 48, 48);
    grad.addColorStop(0, rgba(hex, 1));
    grad.addColorStop(0.22, rgba(hex, 0.6));
    grad.addColorStop(0.55, rgba(hex, 0.16));
    grad.addColorStop(1, rgba(hex, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 96, 96);
    sprites.set(hex, s);
  }
  return s;
}

/** Stamp a soft glow of `radius` at x,y. Call with globalCompositeOperation = 'lighter'. */
export function drawGlow(ctx, hex, x, y, radius, alpha = 1) {
  if (alpha <= 0.002 || radius <= 0.5) return;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * (alpha > 1 ? 1 : alpha);
  ctx.drawImage(glowSprite(hex), x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = prev;
}

/** Path of a regular polygon (first vertex pointing along +x). */
export function polyPath(ctx, x, y, r, sides, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = rot + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** Path of a star with `points` tips. */
export function starPath(ctx, x, y, outer, inner, points, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const a = rot + (i / (points * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? outer : inner;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * Draw one line of text. opts: size, weight, color, align, baseline, spacing (letter spacing
 * in px), font (family stack), glow (shadow colour), blur, alpha.
 */
export function text(ctx, str, x, y, opts = {}) {
  const { size = 16, weight = 600, color = '#dff3ff', align = 'left', baseline = 'alphabetic', spacing = 0, font = FONT_UI, glow = null, blur = 12, alpha = 1 } = opts;
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  ctx.globalAlpha *= alpha;
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = blur;
  }
  ctx.fillStyle = color;
  // With letter spacing, centred text is shifted by half the trailing gap; compensate.
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
