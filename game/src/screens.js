// Full-screen states painted over the world: the title screen (a staged hero scene with the
// game's name, instructions and a Start prompt), the pause card and the game over card.
import { FONT_NUM, FONT_UI, H, PALETTE, W } from './config.js';
import { clamp01, drawGlow, formatScore, measure, rgba, roundRect, text } from './gfx.js';
import { drawBullets, drawCores, drawEnemy, drawPlayer } from './actors.js';
import { panel } from './hud.js';

const TAU = Math.PI * 2;

// ---- title ---------------------------------------------------------------------------------

function fake(kind, x, y, sides, radius, color, phase, extra = {}) {
  return { kind, x, y, sides, radius, color, phase, rot: 0, hp: 1, maxHp: 1, flash: 0, name: kind, ...extra };
}

const TITLE_ENEMIES = [
  fake('triangle', 430, 318, 3, 14, PALETTE.magenta, 0.2),
  fake('triangle', 372, 436, 3, 14, PALETTE.magenta, 1.4),
  fake('triangle', 520, 462, 3, 14, PALETTE.magenta, 2.1),
  fake('triangle', 800, 300, 3, 14, PALETTE.magenta, 3.3),
  fake('triangle', 745, 452, 3, 14, PALETTE.magenta, 4.1),
  fake('square', 262, 372, 4, 21, PALETTE.orange, 0.7),
  fake('square', 880, 452, 4, 21, PALETTE.orange, 2.7),
  fake('pentagon', 944, 350, 5, 18, PALETTE.violet, 1.1),
  fake('pentagon', 330, 308, 5, 18, PALETTE.violet, 3.9),
  fake('pentagon', 612, 296, 5, 18, PALETTE.violet, 5.0),
  fake('elite', 1118, 372, 8, 46, PALETTE.magenta, 0.5, { name: 'WARDEN', hp: 38, maxHp: 60 }),
  fake('elite', 160, 408, 6, 36, PALETTE.orange, 2.5, { name: 'BASTION', hp: 50, maxHp: 50 }),
];

const TITLE_CORES = [
  [560, 410, 0.3], [722, 398, 1.7], [606, 462, 2.9], [676, 340, 4.2], [470, 392, 5.5], [812, 380, 0.9], [545, 346, 3.6], [905, 405, 2.2],
];

function drawTitleScene(ctx, t) {
  // Soft stage light behind the hero.
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, PALETTE.violet, W / 2, 400, 360, 0.3);
  drawGlow(ctx, PALETTE.cyan, W / 2, 400, 170, 0.22);
  ctx.globalCompositeOperation = 'source-over';

  // Concentric orbit rings.
  ctx.save();
  ctx.translate(W / 2, 404);
  ctx.scale(1, 0.34);
  for (let i = 0; i < 3; i += 1) {
    ctx.strokeStyle = rgba(i === 1 ? PALETTE.magenta : PALETTE.cyan, 0.2 - i * 0.04);
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 12]);
    ctx.lineDashOffset = -t * (14 + i * 6) * (i % 2 ? -1 : 1);
    ctx.beginPath();
    ctx.arc(0, 0, 190 + i * 150, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
  ctx.setLineDash([]);

  TITLE_CORES.forEach(([x, y, ph]) => drawCores(ctx, [{ x: x + Math.sin(t * 1.3 + ph) * 6, y: y + Math.cos(t * 1.1 + ph) * 6, age: 0, phase: ph, spin: 1.4 }], t));

  const px = W / 2;
  const py = 408;
  const ship = { x: px, y: py + Math.sin(t * 1.6) * 5, angle: -Math.PI / 2, aimX: px, aimY: 100, invulnerable: 0, flare: 0.5 + 0.5 * Math.sin(t * 8), thrust: 1 };
  const shots = [];
  for (let i = 0; i < 4; i += 1) {
    const y = ship.y - 40 - ((i * 30 + t * 340) % 120);
    shots.push({ x: px - 8, y, vx: 0, vy: -800 }, { x: px + 8, y, vx: 0, vy: -800 });
  }
  drawBullets(ctx, shots);

  for (const e of TITLE_ENEMIES) {
    const bobX = Math.sin(t * 0.9 + e.phase) * 9;
    const bobY = Math.cos(t * 0.7 + e.phase * 1.3) * 8;
    const live = { ...e, x: e.x + bobX, y: e.y + bobY };
    if (e.kind === 'triangle') live.rot = Math.atan2(py - live.y, px - live.x);
    else live.rot = t * (e.kind === 'pentagon' ? 1.6 : 0.6) * (e.phase > 3 ? -1 : 1) + e.phase;
    if (e.kind === 'elite') live.rot = t * 0.4 + e.phase;
    drawEnemy(ctx, live, t);
  }
  drawPlayer(ctx, ship, t, { shieldReady: true, invulnerable: 0 });
}

function drawKey(ctx, label, x, y, size = 26) {
  roundRect(ctx, x, y, size, size, 6);
  const g = ctx.createLinearGradient(0, y, 0, y + size);
  g.addColorStop(0, 'rgba(70,90,170,0.55)');
  g.addColorStop(1, 'rgba(20,26,80,0.8)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = rgba(PALETTE.cyan, 0.8);
  ctx.lineWidth = 1.3;
  ctx.stroke();
  text(ctx, label, x + size / 2, y + size / 2 + 5, { size: 13, weight: 800, color: PALETTE.white, align: 'center' });
}

function drawCard(ctx, x, y, w, h, accent, heading, draw) {
  panel(ctx, x, y, w, h, accent, 0.66);
  text(ctx, heading, x + 20, y + 28, { size: 12, weight: 800, color: accent, spacing: 4 });
  draw(x + 20, y);
}

function drawTitleText(ctx, t) {
  const str = 'LUMEN DRIFT';
  const size = 104;
  const spacing = 20;
  const baseline = 186;
  ctx.save();
  ctx.font = `800 ${size}px ${FONT_UI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  const cx = W / 2 + spacing / 2;

  // Chromatic echoes.
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgba(PALETTE.magenta, 0.55);
  ctx.fillText(str, cx + 5, baseline + 2);
  ctx.fillStyle = rgba(PALETTE.cyan, 0.55);
  ctx.fillText(str, cx - 5, baseline - 2);
  ctx.globalCompositeOperation = 'source-over';

  // Glow body.
  ctx.shadowColor = PALETTE.cyan;
  ctx.shadowBlur = 42;
  ctx.fillStyle = rgba(PALETTE.cyan, 0.5);
  ctx.fillText(str, cx, baseline);
  ctx.shadowColor = PALETTE.magenta;
  ctx.shadowBlur = 70;
  ctx.fillText(str, cx, baseline);
  ctx.shadowBlur = 0;

  // Metallic gradient face.
  const g = ctx.createLinearGradient(0, baseline - size * 0.75, 0, baseline + 6);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, '#d9fbff');
  g.addColorStop(0.55, '#7ceeff');
  g.addColorStop(1, '#4aa8ff');
  ctx.fillStyle = g;
  ctx.fillText(str, cx, baseline);
  ctx.restore();

  // Lens flare line through the lettering.
  const fy = baseline - size * 0.32;
  const wob = 0.8 + 0.2 * Math.sin(t * 2);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const lg = ctx.createLinearGradient(W / 2 - 560, 0, W / 2 + 560, 0);
  lg.addColorStop(0, rgba(PALETTE.cyan, 0));
  lg.addColorStop(0.5, rgba('#ffffff', 0.75 * wob));
  lg.addColorStop(1, rgba(PALETTE.magenta, 0));
  ctx.fillStyle = lg;
  ctx.fillRect(W / 2 - 560, fy - 1, 1120, 2);
  drawGlow(ctx, PALETTE.white, W / 2, fy, 70, 0.28 * wob);
  ctx.restore();
}

export function drawTitle(ctx, state, view) {
  const t = view.time;
  // Darken the edges so the lettering and cards stay readable.
  const v = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 760);
  v.addColorStop(0, 'rgba(3,4,20,0)');
  v.addColorStop(1, 'rgba(3,4,20,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(-400, -250, W + 800, H + 500);

  drawTitleScene(ctx, t);
  drawTitleText(ctx, t);

  // Subtitle with flanking rules.
  const sub = 'NEON DEEP-SPACE SURVIVAL';
  const sw = measure(ctx, sub, 17, 700, 11);
  text(ctx, sub, W / 2, 236, { size: 17, weight: 700, color: PALETTE.ice, spacing: 11, align: 'center', glow: PALETTE.cyan, blur: 10 });
  for (const dir of [-1, 1]) {
    const x0 = W / 2 + dir * (sw / 2 + 24);
    const g = ctx.createLinearGradient(x0, 0, x0 + dir * 170, 0);
    g.addColorStop(0, rgba(PALETTE.magenta, 0.9));
    g.addColorStop(1, rgba(PALETTE.magenta, 0));
    ctx.fillStyle = g;
    ctx.fillRect(dir > 0 ? x0 : x0 - 170, 230, 170, 2);
  }

  // Instruction cards.
  const cw = 316;
  const gap = 28;
  const x0 = (W - (cw * 3 + gap * 2)) / 2;
  const cy = 492;
  drawCard(ctx, x0, cy, cw, 104, PALETTE.cyan, 'FLY', (x, y) => {
    ['W', 'A', 'S', 'D'].forEach((k, i) => drawKey(ctx, k, x + i * 32, y + 42, 26));
    text(ctx, 'or ARROWS', x + 140, y + 61, { size: 13, weight: 700, color: PALETTE.text, spacing: 1 });
    text(ctx, 'Click-drag also steers the ship', x, y + 90, { size: 13, weight: 500, color: PALETTE.dim });
  });
  drawCard(ctx, x0 + cw + gap, cy, cw, 104, PALETTE.magenta, 'AIM & FIRE', (x, y) => {
    text(ctx, 'Mouse to aim. Auto-fire is on.', x, y + 58, { size: 14, weight: 600, color: PALETTE.text });
    text(ctx, 'Hold click or SPACE for rapid fire', x, y + 86, { size: 13, weight: 500, color: PALETTE.dim });
  });
  drawCard(ctx, x0 + (cw + gap) * 2, cy, cw, 104, PALETTE.amber, 'SURVIVE', (x, y) => {
    text(ctx, 'Shoot drones, grab star cores.', x, y + 58, { size: 14, weight: 600, color: PALETTE.text });
    text(ctx, 'Chain cores: combo + shield. 3 hulls.', x, y + 86, { size: 13, weight: 500, color: PALETTE.dim });
  });

  // Start prompt.
  const pulse = 0.72 + 0.28 * Math.sin(t * 3.2);
  const startLabel = 'PRESS ENTER  /  CLICK TO START';
  const pw = Math.max(470, measure(ctx, startLabel, 18, 800, 4) + 80);
  const px = (W - pw) / 2;
  const py = 634;
  roundRect(ctx, px, py, pw, 50, 25);
  const pg = ctx.createLinearGradient(px, 0, px + pw, 0);
  pg.addColorStop(0, rgba(PALETTE.cyan, 0.28 * pulse + 0.1));
  pg.addColorStop(1, rgba(PALETTE.magenta, 0.28 * pulse + 0.1));
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.strokeStyle = rgba(PALETTE.ice, 0.55 + 0.4 * pulse);
  ctx.lineWidth = 1.8;
  ctx.stroke();
  text(ctx, startLabel, W / 2, py + 32, { size: 18, weight: 800, color: '#ffffff', spacing: 4, align: 'center', glow: PALETTE.cyan, blur: 14, alpha: 0.7 + 0.3 * pulse });
  text(ctx, 'P / ESC PAUSE   \u00b7   M SOUND   \u00b7   ELITE DRONE EVERY 5 WAVES', W / 2, 706, { size: 10.5, weight: 600, color: PALETTE.dim, spacing: 2, align: 'center', alpha: 0.7 });
  if (view.best > 0) text(ctx, `BEST  ${formatScore(view.best)}`, W - 28, 36, { size: 13, weight: 800, color: PALETTE.amber, spacing: 3, align: 'right' });
}

// ---- pause ---------------------------------------------------------------------------------

export function drawPause(ctx, state, view) {
  ctx.fillStyle = 'rgba(3,4,22,0.62)';
  ctx.fillRect(-400, -250, W + 800, H + 500);
  const w = 520;
  const h = 250;
  const x = (W - w) / 2;
  const y = (H - h) / 2;
  panel(ctx, x, y, w, h, PALETTE.cyan, 0.88);
  text(ctx, 'PAUSED', W / 2, y + 86, { size: 58, weight: 800, color: '#ffffff', spacing: 16, align: 'center', glow: PALETTE.cyan, blur: 28 });
  const lines = [
    ['P / ESC / CLICK', 'RESUME'],
    ['R', 'RESTART RUN'],
    ['M', 'SOUND ON / OFF'],
    ['F', 'AUTO-FIRE ON / OFF'],
  ];
  lines.forEach(([k, v], i) => {
    const ly = y + 134 + i * 26;
    text(ctx, k, W / 2 - 14, ly, { size: 13, weight: 800, color: PALETTE.amber, spacing: 2, align: 'right' });
    text(ctx, v, W / 2 + 14, ly, { size: 13, weight: 600, color: PALETTE.text, spacing: 2 });
  });
  const p = 0.7 + 0.3 * Math.sin(view.time * 3);
  text(ctx, `SCORE ${formatScore(state.score)}   \u00b7   WAVE ${state.wave}`, W / 2, y + h - 14, { size: 11, weight: 700, color: PALETTE.dim, spacing: 3, align: 'center', alpha: p });
}

// ---- game over -----------------------------------------------------------------------------

function stat(ctx, labelText, value, x, y, color) {
  text(ctx, labelText, x, y, { size: 10.5, weight: 700, color: PALETTE.dim, spacing: 3, align: 'center' });
  text(ctx, value, x, y + 30, { size: 26, weight: 800, color, font: FONT_NUM, align: 'center' });
}

export function drawGameOver(ctx, state, view) {
  const t = view.time;
  const appear = clamp01(view.overTime / 0.7);
  ctx.fillStyle = `rgba(3,4,22,${0.62 * appear})`;
  ctx.fillRect(-400, -250, W + 800, H + 500);
  const v = ctx.createRadialGradient(W / 2, H / 2, 160, W / 2, H / 2, 700);
  v.addColorStop(0, 'rgba(255,62,165,0)');
  v.addColorStop(1, `rgba(120,10,70,${0.35 * appear})`);
  ctx.fillStyle = v;
  ctx.fillRect(-400, -250, W + 800, H + 500);
  ctx.globalAlpha = appear;

  // Title.
  ctx.save();
  ctx.font = `800 96px ${FONT_UI}`;
  ctx.textAlign = 'center';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '16px';
  const cx = W / 2 + 8;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgba(PALETTE.cyan, 0.5);
  ctx.fillText('GAME OVER', cx - 4, 156);
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowColor = PALETTE.magenta;
  ctx.shadowBlur = 50;
  ctx.fillStyle = rgba(PALETTE.magenta, 0.7);
  ctx.fillText('GAME OVER', cx, 158);
  ctx.shadowBlur = 0;
  const g = ctx.createLinearGradient(0, 80, 0, 168);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, '#ffc2e4');
  g.addColorStop(1, '#ff4d9a');
  ctx.fillStyle = g;
  ctx.fillText('GAME OVER', cx, 158);
  ctx.restore();
  text(ctx, 'HULL BREACH  \u00b7  SIGNAL LOST', W / 2, 198, { size: 16, weight: 700, color: PALETTE.ice, spacing: 8, align: 'center', alpha: 0.85 });

  // Result card.
  const w = 600;
  const h = 250;
  const x = (W - w) / 2;
  const y = 232;
  panel(ctx, x, y, w, h, PALETTE.magenta, 0.84);
  text(ctx, 'FINAL SCORE', W / 2, y + 40, { size: 13, weight: 800, color: PALETTE.dim, spacing: 7, align: 'center' });
  const count = clamp01(view.overTime / 1.3);
  const shown = state.score * (1 - (1 - count) * (1 - count));
  text(ctx, formatScore(shown), W / 2, y + 112, { size: 78, weight: 800, color: '#ffffff', font: FONT_NUM, align: 'center', glow: PALETTE.cyan, blur: 24 });
  if (state.newBest) {
    const bw = 190;
    roundRect(ctx, W / 2 - bw / 2, y + 128, bw, 28, 14);
    ctx.fillStyle = rgba(PALETTE.amber, 0.2 + 0.08 * Math.sin(t * 5));
    ctx.fill();
    ctx.strokeStyle = PALETTE.amber;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    text(ctx, 'NEW BEST SCORE', W / 2, y + 147, { size: 12, weight: 800, color: PALETTE.gold, spacing: 4, align: 'center' });
  } else {
    text(ctx, `BEST  ${formatScore(view.best)}`, W / 2, y + 148, { size: 15, weight: 800, color: PALETTE.amber, spacing: 5, align: 'center' });
  }
  ctx.fillStyle = rgba(PALETTE.cyan, 0.25);
  ctx.fillRect(x + 36, y + 174, w - 72, 1);
  const cols = [
    ['WAVE', String(state.wave), PALETTE.cyan],
    ['BEST', formatScore(view.best), PALETTE.amber],
    ['DRONES', String(state.kills), PALETTE.magenta],
    ['MAX COMBO', `x${state.maxCombo}`, PALETTE.gold],
  ];
  cols.forEach(([l, val, c], i) => stat(ctx, l, val, x + (w / 4) * (i + 0.5), y + 198, c));

  // Restart prompt.
  const pulse = 0.72 + 0.28 * Math.sin(t * 3.2);
  const pw = 460;
  const px = (W - pw) / 2;
  const py = 516;
  roundRect(ctx, px, py, pw, 50, 25);
  const pg = ctx.createLinearGradient(px, 0, px + pw, 0);
  pg.addColorStop(0, rgba(PALETTE.magenta, 0.3 * pulse + 0.1));
  pg.addColorStop(1, rgba(PALETTE.cyan, 0.3 * pulse + 0.1));
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.strokeStyle = rgba(PALETTE.ice, 0.55 + 0.4 * pulse);
  ctx.lineWidth = 1.8;
  ctx.stroke();
  text(ctx, 'PRESS R  /  CLICK TO RESTART', W / 2, py + 32, { size: 19, weight: 800, color: '#ffffff', spacing: 5, align: 'center', glow: PALETTE.magenta, blur: 14 });
  text(ctx, 'ENTER ALSO WORKS', W / 2, 594, { size: 10.5, weight: 600, color: PALETTE.dim, spacing: 3, align: 'center' });
  ctx.globalAlpha = 1;
}
