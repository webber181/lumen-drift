// Backdrop: cached nebula, planet, moon, seamless drifting wisps, orbital station,
// 4 parallax star layers and dust streaks. Zero per-frame string/heap allocations in draw().
import { H, PALETTE, W } from './config.js';
import { createRandom, pick, range } from './random.js';
import { drawGlow, makeCanvas, rgba } from './gfx.js';

const TAU = Math.PI * 2;
const PAD_X = 320, PAD_Y = 180;
const BW = W + PAD_X * 2, BH = H + PAD_Y * 2;
const WISP_W = 960, WISP_H = 540, ST_SZ = 260;

const STARS = ['#ffffff', '#d8ecff', '#bff9ff', '#ffd9f2', '#ffe9b0'];
const DUST = ['#bff9ff', '#a66bff', '#dff3ff'];
const LAYERS = [
  { count: 115, depth: 0.08, speed: 3.5, size: [0.6, 1.0], alpha: [0.22, 0.52], glow: false },
  { count: 70, depth: 0.2, speed: 8.5, size: [0.85, 1.35], alpha: [0.35, 0.72], glow: false },
  { count: 40, depth: 0.44, speed: 18, size: [1.1, 1.75], alpha: [0.5, 0.86], glow: false },
  { count: 20, depth: 0.72, speed: 34, size: [1.4, 2.3], alpha: [0.65, 1.0], glow: true },
];

function fillRad(g, x, y, r, c0, m, cm) {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, c0);
  if (m > 0) grad.addColorStop(m, cm);
  grad.addColorStop(1, 'rgba(5,6,26,0)');
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

function strokeArc(g, x, y, r, a0, a1, col, lw) {
  g.strokeStyle = col; g.lineWidth = lw;
  g.beginPath(); g.arc(x, y, r, a0, a1); g.stroke();
}

function paintNebula(rng) {
  const c = makeCanvas(BW, BH), g = c.getContext('2d');
  const teal = PALETTE.teal || '#2cf5c8';
  const sky = g.createLinearGradient(0, 0, 0, BH);
  sky.addColorStop(0, '#030416'); sky.addColorStop(0.45, '#090a2b');
  sky.addColorStop(0.8, '#130b3b'); sky.addColorStop(1, '#190a3c');
  g.fillStyle = sky; g.fillRect(0, 0, BW, BH);

  g.globalCompositeOperation = 'lighter';
  const clouds = [PALETTE.magenta, PALETTE.violet, PALETTE.cyan, '#3b46ff', teal, PALETTE.violet];
  for (let i = 0; i < 7; i += 1) {
    const cx = range(rng, 0.05, 0.95) * BW, cy = range(rng, 0.08, 0.92) * BH;
    const col = clouds[i % clouds.length], rad = range(rng, 360, 680);
    fillRad(g, cx, cy, rad, rgba(col, 0.19), 0.45, rgba(col, 0.075));
    for (let j = 0; j < 14; j += 1) {
      const a = rng() * TAU, d = rng() * rad * 0.65;
      fillRad(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, range(rng, 50, 175), rgba(pick(rng, clouds), range(rng, 0.04, 0.1)), 0, '');
    }
  }

  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 6; i += 1) {
    fillRad(g, range(rng, 0.1, 0.9) * BW, range(rng, 0.1, 0.9) * BH, range(rng, 140, 290), 'rgba(3,4,20,0.45)', 0, '');
  }

  g.save(); g.translate(BW * 0.5, BH * 0.5); g.rotate(-0.32);
  const band = g.createLinearGradient(0, -180, 0, 180);
  band.addColorStop(0, 'rgba(120,140,255,0)'); band.addColorStop(0.5, 'rgba(150,165,255,0.08)'); band.addColorStop(1, 'rgba(120,140,255,0)');
  g.fillStyle = band; g.fillRect(-BW, -180, BW * 2, 360); g.restore();
  for (let i = 0; i < 560; i += 1) {
    g.fillStyle = rgba(pick(rng, STARS), range(rng, 0.03, 0.18));
    const sz = range(rng, 0.6, 1.8); g.fillRect(rng() * BW, rng() * BH, sz, sz);
  }
  paintPlanet(g, PAD_X + 1130, PAD_Y + 640, 150);
  paintMoon(g, PAD_X + 150, PAD_Y + 560, 30);
  return c;
}

function paintWisps(rng) {
  const c = makeCanvas(WISP_W, WISP_H), g = c.getContext('2d');
  const cols = [PALETTE.cyan, PALETTE.magenta, PALETTE.violet, PALETTE.teal || '#2cf5c8'];
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i += 1) {
    const cx = rng() * WISP_W, cy = rng() * WISP_H, rad = range(rng, 110, 220);
    const col = cols[i % cols.length], alpha = range(rng, 0.035, 0.075);
    for (let ox = -1; ox <= 1; ox += 1) {
      const px = cx + ox * WISP_W;
      if (px + rad < 0 || px - rad > WISP_W) continue;
      for (let oy = -1; oy <= 1; oy += 1) {
        const py = cy + oy * WISP_H;
        if (py + rad < 0 || py - rad > WISP_H) continue;
        fillRad(g, px, py, rad, rgba(col, alpha), 0.55, rgba(col, alpha * 0.35));
      }
    }
  }
  return c;
}

function paintPlanet(g, cx, cy, r) {
  g.globalCompositeOperation = 'lighter';
  const halo = g.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.55);
  halo.addColorStop(0, rgba(PALETTE.magenta, 0.24)); halo.addColorStop(0.4, rgba(PALETTE.violet, 0.09)); halo.addColorStop(1, rgba(PALETTE.violet, 0));
  g.fillStyle = halo; g.fillRect(cx - r * 1.6, cy - r * 1.6, r * 3.2, r * 3.2);
  g.globalCompositeOperation = 'source-over';

  const ring = (front) => {
    g.save(); g.translate(cx, cy); g.rotate(-0.28);
    for (let k = 0; k < 4; k += 1) {
      g.beginPath();
      g.ellipse(0, 0, r * (1.45 + k * 0.1), r * (0.34 + k * 0.025), 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
      g.strokeStyle = rgba(k % 2 ? PALETTE.cyan : PALETTE.violet, 0.16 - k * 0.025);
      g.lineWidth = 7 - k; g.stroke();
    }
    g.restore();
  };
  ring(false);

  const body = g.createRadialGradient(cx - r * 0.4, cy - r * 0.45, r * 0.08, cx, cy, r);
  body.addColorStop(0, '#4a4fb0'); body.addColorStop(0.35, '#232a78');
  body.addColorStop(0.75, '#0e1040'); body.addColorStop(1, '#05061a');
  g.fillStyle = body; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();

  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.clip();
  for (let b = 0; b < 7; b += 1) {
    g.fillStyle = rgba(b % 2 ? PALETTE.magenta : PALETTE.cyan, 0.045);
    g.fillRect(cx - r, cy - r * 0.8 + b * r * 0.26, r * 2, r * 0.12);
  }
  const shade = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  shade.addColorStop(0, 'rgba(5,6,26,0)'); shade.addColorStop(0.55, 'rgba(5,6,26,0.25)'); shade.addColorStop(1, 'rgba(5,6,26,0.85)');
  g.fillStyle = shade; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  g.restore();
  strokeArc(g, cx, cy, r - 1, Math.PI * 1.02, Math.PI * 1.55, rgba(PALETTE.cyan, 0.4), 2.5);
  ring(true);
}

function paintMoon(g, cx, cy, r) {
  const body = g.createRadialGradient(cx - r * 0.4, cy - r * 0.4, r * 0.1, cx, cy, r);
  body.addColorStop(0, '#8a79d8'); body.addColorStop(0.5, '#3a2f86'); body.addColorStop(1, '#0b0a30');
  g.fillStyle = body; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
  strokeArc(g, cx - r * 0.28, cy - r * 0.18, r * 0.22, 0, TAU, rgba(PALETTE.violet, 0.2), 1);
  strokeArc(g, cx, cy, r - 1, Math.PI * 1.05, Math.PI * 1.6, rgba(PALETTE.magenta, 0.45), 2);
}

function paintStation(tilt) {
  const c = makeCanvas(ST_SZ, ST_SZ), g = c.getContext('2d');
  const teal = PALETTE.teal || '#2cf5c8';
  g.save(); g.translate(ST_SZ / 2, ST_SZ / 2); g.rotate(tilt);
  fillRad(g, 0, 0, 74, rgba(PALETTE.cyan, 0.18), 0.5, rgba(PALETTE.violet, 0.08));
  const ell = (rx, ry, a0, a1, col, lw) => {
    g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, a0, a1); g.stroke();
  };
  ell(56, 22, 0, TAU, '#141944', 9);
  ell(60, 24, Math.PI * 0.95, Math.PI * 1.85, rgba(PALETTE.cyan, 0.24), 1.4);
  ell(34, 13, 0, TAU, rgba(teal, 0.16), 1);
  g.strokeStyle = '#1c2458'; g.lineWidth = 2.4;
  g.beginPath();
  g.moveTo(-66, 0); g.lineTo(66, 0); g.moveTo(-42, -16); g.lineTo(42, 16); g.moveTo(-42, 16); g.lineTo(42, -16);
  g.stroke();
  g.fillStyle = '#0e1338'; g.strokeStyle = rgba(PALETTE.cyan, 0.28); g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(0, -76); g.lineTo(7, -14); g.lineTo(11, 0); g.lineTo(6, 20);
  g.lineTo(0, 62); g.lineTo(-6, 20); g.lineTo(-11, 0); g.lineTo(-7, -14);
  g.closePath(); g.fill(); g.stroke();
  g.fillStyle = rgba(PALETTE.cyan, 0.65); g.fillRect(-1.5, -16, 3, 28);
  g.restore();
  return c;
}

function makeStars(rng, layer) {
  const stars = [];
  for (let i = 0; i < layer.count; i += 1) {
    const a = range(rng, layer.alpha[0], layer.alpha[1]), col = pick(rng, STARS);
    stars.push({
      x: rng() * BW, y: rng() * BH, size: range(rng, layer.size[0], layer.size[1]),
      alpha: a, phase: rng() * TAU, freq: range(rng, 0.6, 2.4), color: col,
      fill: rgba(col, a), coreFill: layer.glow ? rgba('#ffffff', a) : '', flareFill: layer.glow ? rgba(col, a * 0.45) : '',
    });
  }
  return stars;
}

function makeDust(rng) {
  const dust = [];
  for (let i = 0; i < 34; i += 1) {
    const len = range(rng, 4, 11);
    dust.push({
      x: rng() * BW, y: rng() * BH, dx: len, dy: len * 0.35, width: range(rng, 0.8, 1.3),
      phase: rng() * TAU, freq: range(rng, 0.8, 2), fill: rgba(pick(rng, DUST), range(rng, 0.06, 0.15)),
    });
  }
  return dust;
}

const wrap = (v, size) => ((v % size) + size) % size;

export function createBackground(seed) {
  const rng = createRandom((seed * 31 + 7) | 0);
  const nebula = paintNebula(rng);
  const wisps = paintWisps(rng);
  let wispPat = null;
  const tilt = range(rng, -0.44, -0.22);
  const station = paintStation(tilt);
  const sxBase = 228 + range(rng, -20, 20), syBase = 266 + range(rng, -16, 16);
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const beacons = [
    { ox: st * 74, oy: -ct * 74, col: PALETTE.red, fill: rgba(PALETTE.red, 0.9), f: 3.4, ph: 0.2 },
    { ox: ct * 58, oy: st * 58, col: PALETTE.cyan, fill: rgba(PALETTE.cyan, 0.9), f: 2.3, ph: 1.9 },
    { ox: -st * 60, oy: ct * 60, col: PALETTE.amber, fill: rgba(PALETTE.amber, 0.85), f: 2.8, ph: 4.1 },
  ];
  const layers = LAYERS.map((l) => ({ ...l, stars: makeStars(rng, l) }));
  const dust = makeDust(rng);

  function draw(ctx, t, cx, cy) {
    ctx.drawImage(nebula, -PAD_X - cx * 0.03, -PAD_Y - cy * 0.03);

    const wx0 = -wrap(cx * 0.075 + t * 5.2, WISP_W) - PAD_X;
    const wy0 = -wrap(cy * 0.075 - t * 2.1, WISP_H) - PAD_Y;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.72;
    if (!wispPat && ctx.createPattern) wispPat = ctx.createPattern(wisps, 'repeat');
    if (wispPat) {
      ctx.save(); ctx.translate(wx0, wy0); ctx.fillStyle = wispPat;
      ctx.fillRect(-wx0 - PAD_X, -wy0 - PAD_Y, BW, BH); ctx.restore();
    } else {
      const rx = Math.round(wx0), ry = Math.round(wy0);
      for (let x = rx; x < W + PAD_X; x += WISP_W) {
        for (let y = ry; y < H + PAD_Y; y += WISP_H) ctx.drawImage(wisps, x, y);
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    const sx = sxBase - cx * 0.055, sy = syBase - cy * 0.055;
    ctx.drawImage(station, sx - ST_SZ / 2, sy - ST_SZ / 2);
    for (const b of beacons) {
      const blink = Math.sin(t * b.f + b.ph);
      if (blink <= 0.15) continue;
      const bx = sx + b.ox, by = sy + b.oy;
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, b.col, bx, by, 7, 0.45 * blink);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = b.fill; ctx.fillRect(bx - 1, by - 1, 2, 2);
    }

    for (const layer of layers) {
      const d = layer.depth * 0.2, shX = cx * d + t * layer.speed, shY = cy * d - t * layer.speed * 0.35;
      for (const s of layer.stars) {
        const x = wrap(s.x - shX, BW) - PAD_X, y = wrap(s.y - shY, BH) - PAD_Y;
        const tw = 0.72 + 0.28 * Math.sin(t * s.freq + s.phase);
        if (layer.glow) {
          ctx.globalCompositeOperation = 'lighter';
          drawGlow(ctx, s.color, x, y, s.size * 6, s.alpha * tw * 0.55);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = tw;
          ctx.fillStyle = s.coreFill; ctx.fillRect(x - s.size * 0.5, y - s.size * 0.5, s.size, s.size);
          ctx.fillStyle = s.flareFill;
          ctx.fillRect(x - s.size * 3.2, y - 0.4, s.size * 6.4, 0.8);
          ctx.fillRect(x - 0.4, y - s.size * 3.2, 0.8, s.size * 6.4);
        } else {
          ctx.globalAlpha = tw; ctx.fillStyle = s.fill; ctx.fillRect(x, y, s.size, s.size);
        }
      }
    }

    const dX = cx * 0.18 + t * 54, dY = cy * 0.18 - t * 19;
    for (const d of dust) {
      const x = wrap(d.x - dX, BW) - PAD_X, y = wrap(d.y - dY, BH) - PAD_Y;
      ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * d.freq + d.phase);
      ctx.strokeStyle = d.fill; ctx.lineWidth = d.width;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + d.dx, y - d.dy); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  return { draw };
}
