// The backdrop: a cached nebula painting (deep indigo gradient, layered magenta/violet/cyan
// clouds, dust, a ringed planet) plus three parallax star layers computed from time and the
// camera each frame, so the picture is a pure function of (seed, time, camera). The painting
// is larger than the playfield so a window that is not 16:9 still shows space, not bars.
import { H, PALETTE, W } from './config.js';
import { createRandom, pick, range } from './random.js';
import { drawGlow, makeCanvas, rgba } from './gfx.js';

const PAD_X = 320;
const PAD_Y = 180;
const BW = W + PAD_X * 2;
const BH = H + PAD_Y * 2;

const STAR_COLORS = ['#ffffff', '#d8ecff', '#bff9ff', '#ffd9f2', '#ffe9b0'];

const LAYERS = [
  { count: 110, depth: 0.12, speed: 5, size: [0.6, 1.1], alpha: [0.25, 0.6], glow: false },
  { count: 60, depth: 0.32, speed: 14, size: [0.9, 1.6], alpha: [0.4, 0.8], glow: false },
  { count: 26, depth: 0.7, speed: 34, size: [1.4, 2.4], alpha: [0.6, 1], glow: true },
];

function paintNebula(rng) {
  const canvas = makeCanvas(BW, BH);
  const g = canvas.getContext('2d');

  const sky = g.createLinearGradient(0, 0, 0, BH);
  sky.addColorStop(0, '#04051a');
  sky.addColorStop(0.45, '#0a0b30');
  sky.addColorStop(0.8, '#140c3d');
  sky.addColorStop(1, '#1a0b3f');
  g.fillStyle = sky;
  g.fillRect(0, 0, BW, BH);

  g.globalCompositeOperation = 'lighter';
  const cloudColors = [PALETTE.magenta, PALETTE.violet, PALETTE.cyan, '#3b46ff', PALETTE.violet];
  for (let i = 0; i < 6; i += 1) {
    const cx = range(rng, 0.05, 0.95) * BW;
    const cy = range(rng, 0.08, 0.92) * BH;
    const color = cloudColors[i % cloudColors.length];
    const radius = range(rng, 380, 700);
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, rgba(color, 0.2));
    grad.addColorStop(0.5, rgba(color, 0.07));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    // Puffs around the centre give the cloud texture.
    for (let j = 0; j < 14; j += 1) {
      const a = rng() * Math.PI * 2;
      const d = rng() * radius * 0.65;
      const px = cx + Math.cos(a) * d;
      const py = cy + Math.sin(a) * d * 0.7;
      const pr = range(rng, 50, 180);
      const pg = g.createRadialGradient(px, py, 0, px, py, pr);
      pg.addColorStop(0, rgba(pick(rng, cloudColors), range(rng, 0.04, 0.1)));
      pg.addColorStop(1, rgba(color, 0));
      g.fillStyle = pg;
      g.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    }
  }

  // A faint band of galactic dust across the sky.
  g.save();
  g.translate(BW * 0.5, BH * 0.5);
  g.rotate(-0.32);
  const band = g.createLinearGradient(0, -170, 0, 170);
  band.addColorStop(0, 'rgba(120,140,255,0)');
  band.addColorStop(0.5, 'rgba(150,160,255,0.075)');
  band.addColorStop(1, 'rgba(120,140,255,0)');
  g.fillStyle = band;
  g.fillRect(-BW, -170, BW * 2, 340);
  g.restore();

  // Dust specks.
  for (let i = 0; i < 520; i += 1) {
    g.fillStyle = rgba(pick(rng, STAR_COLORS), range(rng, 0.03, 0.18));
    g.fillRect(rng() * BW, rng() * BH, range(rng, 0.6, 1.8), range(rng, 0.6, 1.8));
  }

  g.globalCompositeOperation = 'source-over';
  paintPlanet(g, PAD_X + 1130, PAD_Y + 640, 150);
  paintMoon(g, PAD_X + 150, PAD_Y + 560, 30);
  return canvas;
}

function paintPlanet(g, cx, cy, r) {
  // Atmosphere halo.
  g.globalCompositeOperation = 'lighter';
  const halo = g.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.5);
  halo.addColorStop(0, rgba(PALETTE.magenta, 0.22));
  halo.addColorStop(0.4, rgba(PALETTE.violet, 0.08));
  halo.addColorStop(1, rgba(PALETTE.violet, 0));
  g.fillStyle = halo;
  g.fillRect(cx - r * 1.6, cy - r * 1.6, r * 3.2, r * 3.2);
  g.globalCompositeOperation = 'source-over';

  // Back half of the ring.
  const ringTilt = -0.28;
  const ring = (front) => {
    g.save();
    g.translate(cx, cy);
    g.rotate(ringTilt);
    for (let k = 0; k < 4; k += 1) {
      const rx = r * (1.45 + k * 0.1);
      const ry = r * (0.34 + k * 0.025);
      g.beginPath();
      g.ellipse(0, 0, rx, ry, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
      g.strokeStyle = rgba(k % 2 ? PALETTE.cyan : PALETTE.violet, 0.16 - k * 0.025);
      g.lineWidth = 7 - k;
      g.stroke();
    }
    g.restore();
  };
  ring(false);

  const body = g.createRadialGradient(cx - r * 0.4, cy - r * 0.45, r * 0.08, cx, cy, r);
  body.addColorStop(0, '#4a4fb0');
  body.addColorStop(0.35, '#232a78');
  body.addColorStop(0.75, '#0e1040');
  body.addColorStop(1, '#05061a');
  g.fillStyle = body;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();

  // Banding and a terminator shadow.
  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.clip();
  for (let b = 0; b < 7; b += 1) {
    g.fillStyle = rgba(b % 2 ? PALETTE.magenta : PALETTE.cyan, 0.045);
    g.fillRect(cx - r, cy - r * 0.8 + b * r * 0.26, r * 2, r * 0.12);
  }
  const shade = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  shade.addColorStop(0, 'rgba(5,6,26,0)');
  shade.addColorStop(0.55, 'rgba(5,6,26,0.25)');
  shade.addColorStop(1, 'rgba(5,6,26,0.85)');
  g.fillStyle = shade;
  g.fillRect(cx - r, cy - r, r * 2, r * 2);
  g.restore();

  // Rim light.
  g.beginPath();
  g.arc(cx, cy, r - 1, Math.PI * 1.02, Math.PI * 1.55);
  g.strokeStyle = rgba(PALETTE.cyan, 0.4);
  g.lineWidth = 2.5;
  g.stroke();
  ring(true);
}

function paintMoon(g, cx, cy, r) {
  const body = g.createRadialGradient(cx - r * 0.4, cy - r * 0.4, r * 0.1, cx, cy, r);
  body.addColorStop(0, '#8a79d8');
  body.addColorStop(0.5, '#3a2f86');
  body.addColorStop(1, '#0b0a30');
  g.fillStyle = body;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(cx, cy, r - 1, Math.PI * 1.05, Math.PI * 1.6);
  g.strokeStyle = rgba(PALETTE.magenta, 0.45);
  g.lineWidth = 2;
  g.stroke();
}

function makeStars(rng, layer) {
  const stars = [];
  for (let i = 0; i < layer.count; i += 1) {
    stars.push({
      x: rng() * BW,
      y: rng() * BH,
      size: range(rng, layer.size[0], layer.size[1]),
      alpha: range(rng, layer.alpha[0], layer.alpha[1]),
      phase: rng() * Math.PI * 2,
      freq: range(rng, 0.6, 2.4),
      color: pick(rng, STAR_COLORS),
    });
  }
  return stars;
}

function wrap(v, size) {
  return ((v % size) + size) % size;
}

export function createBackground(seed) {
  const rng = createRandom((seed * 31 + 7) | 0);
  const nebula = paintNebula(rng);
  const layers = LAYERS.map((layer) => ({ ...layer, stars: makeStars(rng, layer) }));

  /** Paint the backdrop for time t (seconds) and camera offset (cx, cy) in field pixels. */
  function draw(ctx, t, cx, cy) {
    ctx.drawImage(nebula, -PAD_X - cx * 0.03, -PAD_Y - cy * 0.03);
    for (const layer of layers) {
      for (const s of layer.stars) {
        const x = wrap(s.x - cx * layer.depth * 0.2 - t * layer.speed, BW) - PAD_X;
        const y = wrap(s.y - cy * layer.depth * 0.2 + t * layer.speed * 0.35, BH) - PAD_Y;
        const tw = 0.7 + 0.3 * Math.sin(t * s.freq + s.phase);
        const a = s.alpha * tw;
        if (layer.glow) {
          ctx.globalCompositeOperation = 'lighter';
          drawGlow(ctx, s.color, x, y, s.size * 6, a * 0.55);
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = rgba('#ffffff', a);
          ctx.fillRect(x - s.size * 0.5, y - s.size * 0.5, s.size, s.size);
          ctx.fillStyle = rgba(s.color, a * 0.5);
          ctx.fillRect(x - s.size * 3.2, y - 0.4, s.size * 6.4, 0.8);
          ctx.fillRect(x - 0.4, y - s.size * 3.2, 0.8, s.size * 6.4);
        } else {
          ctx.fillStyle = rgba(s.color, a);
          ctx.fillRect(x, y, s.size, s.size);
        }
      }
    }
  }

  return { draw };
}
