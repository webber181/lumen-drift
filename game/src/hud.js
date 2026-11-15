// The heads-up display: score and best, combo with its timer, wave progress, hull pips,
// shield meter, the elite's health bar, the wave banner and a quiet controls hint.
import { COMBO, FONT_NUM, H, PALETTE, PLAYER, W, comboMultiplier, isEliteWave } from './config.js';
import { clamp01, formatScore, measure, rgba, roundRect, text } from './gfx.js';

export function panel(ctx, x, y, w, h, accent = PALETTE.cyan, fillAlpha = 0.7) {
  roundRect(ctx, x, y, w, h, 10);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, `rgba(22,26,78,${fillAlpha})`);
  g.addColorStop(1, `rgba(6,8,34,${fillAlpha})`);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = rgba(accent, 0.38);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Bright corner ticks.
  ctx.strokeStyle = rgba(accent, 0.95);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 1, y + 16);
  ctx.lineTo(x + 1, y + 7);
  ctx.quadraticCurveTo(x + 1, y + 1, x + 7, y + 1);
  ctx.lineTo(x + 18, y + 1);
  ctx.moveTo(x + w - 1, y + h - 16);
  ctx.lineTo(x + w - 1, y + h - 7);
  ctx.quadraticCurveTo(x + w - 1, y + h - 1, x + w - 7, y + h - 1);
  ctx.lineTo(x + w - 18, y + h - 1);
  ctx.stroke();
}

function label(ctx, str, x, y, align = 'left', color = PALETTE.dim) {
  text(ctx, str, x, y, { size: 11, weight: 700, color, spacing: 3, align });
}

function bar(ctx, x, y, w, h, fill, colorA, colorB, bg = 'rgba(160,180,255,0.14)') {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  const fw = w * clamp01(fill);
  if (fw <= 0) return;
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, colorA);
  g.addColorStop(1, colorB);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, fw, h);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x, y, fw, Math.max(1, h * 0.3));
}

function shipIcon(ctx, x, y, size, filled, color) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 0.82, y + size * 0.85);
  ctx.lineTo(x, y + size * 0.42);
  ctx.lineTo(x - size * 0.82, y + size * 0.85);
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
  } else {
    ctx.fillStyle = 'rgba(160,180,255,0.07)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,180,255,0.35)';
    ctx.lineWidth = 1.4;
  }
  ctx.stroke();
}

const MARGIN = 24;
/** The shield meter has this many cells; each one is 1/CELLS of a full charge. */
const SHIELD_CELLS = 10;
const CELL_BG = 'rgba(160,180,255,0.14)';

function drawScorePanel(ctx, state, view) {
  panel(ctx, MARGIN, 18, 272, 92, PALETTE.cyan);
  label(ctx, 'SCORE', 44, 42);
  label(ctx, `BEST ${formatScore(Math.max(view.best, state.score))}`, 276, 42, 'right', PALETTE.amber);
  // The number counts up toward the real score and swells a little whenever it grows.
  const pop = 1 + 0.1 * state.scorePulse;
  ctx.save();
  ctx.translate(44, 92);
  ctx.scale(pop, pop);
  text(ctx, formatScore(state.scoreShown), 0, 0, {
    size: 40, weight: 800, color: state.scorePulse > 0.3 ? PALETTE.ice : PALETTE.white, font: FONT_NUM, glow: PALETTE.cyan, blur: 14 + 10 * state.scorePulse,
  });
  ctx.restore();
}

function drawComboPanel(ctx, state) {
  const mult = comboMultiplier(state.combo);
  const live = state.combo > 0;
  const idle = PALETTE.dim;
  panel(ctx, MARGIN, 120, 272, 70, live ? PALETTE.amber : idle, 0.62);
  label(ctx, 'COMBO', 44, 144);
  text(ctx, `x${mult}`, 44, 180, { size: 36, weight: 800, color: live ? PALETTE.amber : idle, font: FONT_NUM, glow: live ? PALETTE.amber : null, blur: 16 });
  text(ctx, live ? `${state.combo} CHAIN` : 'GRAB CORES', 276, 144, { size: 12, weight: 700, color: live ? PALETTE.gold : idle, spacing: 2, align: 'right' });
  const toNext = COMBO.perTier - (state.combo % COMBO.perTier);
  const hint = mult >= COMBO.maxMultiplier ? 'MAX MULTIPLIER' : `+${toNext} FOR x${mult + 1}`;
  text(ctx, hint, 276, 164, { size: 11, weight: 600, color: idle, spacing: 1.5, align: 'right' });
  bar(ctx, 108, 178, 168, 5, live ? state.comboTimer / COMBO.window : 0, PALETTE.amber, PALETTE.magenta);
}

function drawWavePanel(ctx, state, elite) {
  const cx = W / 2;
  const accent = elite ? PALETTE.magenta : PALETTE.cyan;
  panel(ctx, cx - 120, 18, 240, 70, accent);
  label(ctx, 'WAVE', cx, 40, 'center');
  text(ctx, String(state.wave).padStart(2, '0'), cx, 72, { size: 32, weight: 800, color: PALETTE.white, font: FONT_NUM, align: 'center', glow: accent, blur: 14 });
  bar(ctx, cx - 100, 78, 200, 4, state.waveKilled / Math.max(1, state.waveTotal), PALETTE.cyan, PALETTE.magenta);
  if (isEliteWave(state.wave)) text(ctx, 'ELITE', cx + 100, 40, { size: 11, weight: 800, color: PALETTE.magenta, spacing: 3, align: 'right', glow: PALETTE.magenta, blur: 8 });
  const left = Math.max(0, state.waveTotal - state.waveKilled);
  text(ctx, `${left} LEFT`, cx - 100, 40, { size: 10, weight: 700, color: PALETTE.dim, spacing: 2 });
}

function drawEliteBar(ctx, elite) {
  const w = 420;
  const x = (W - w) / 2;
  panel(ctx, x, 98, w, 34, PALETTE.magenta, 0.62);
  text(ctx, elite.name, x + 16, 120, { size: 11, weight: 800, color: PALETTE.magenta, spacing: 3 });
  bar(ctx, x + 120, 109, w - 138, 12, elite.hp / elite.maxHp, PALETTE.magenta, PALETTE.orange);
}

function drawHullRow(ctx, state, x, t) {
  const danger = state.hull === 1;
  const color = danger ? PALETTE.red : PALETTE.cyan;
  label(ctx, 'HULL', x + 20, 48);
  for (let i = 0; i < PLAYER.hull; i += 1) {
    const filled = i < state.hull;
    ctx.globalAlpha = danger && filled ? 0.7 + 0.3 * Math.sin(t * 8) : 1;
    shipIcon(ctx, x + 148 + i * 52, 45, 12, filled, color);
  }
  ctx.globalAlpha = 1;
}

function drawShieldRow(ctx, state, x, t) {
  label(ctx, 'SHIELD', x + 20, 90);
  const charge = (state.shield / 100) * SHIELD_CELLS;
  for (let i = 0; i < SHIELD_CELLS; i += 1) {
    const cellX = x + 96 + i * 18.4;
    const filled = clamp01(charge - i);
    ctx.fillStyle = CELL_BG;
    ctx.fillRect(cellX, 80, 15, 12);
    if (filled <= 0) continue;
    ctx.fillStyle = state.shieldReady ? PALETTE.ice : PALETTE.cyan;
    // A ready shield shimmers across the cells; a charging one fades each cell in.
    ctx.globalAlpha = state.shieldReady ? 0.8 + 0.2 * Math.sin(t * 6 + i * 0.5) : 0.35 + 0.65 * filled;
    ctx.fillRect(cellX, 80, 15, 12);
    ctx.globalAlpha = 1;
  }
  if (state.shieldReady) text(ctx, 'READY', x + 270, 71, { size: 10, weight: 800, color: PALETTE.ice, spacing: 2, align: 'right', glow: PALETTE.cyan, blur: 8 });
}

function drawHullPanel(ctx, state, t) {
  const x = W - MARGIN - 290;
  panel(ctx, x, 18, 290, 92, state.hull === 1 ? PALETTE.red : PALETTE.cyan);
  drawHullRow(ctx, state, x, t);
  drawShieldRow(ctx, state, x, t);
}

function drawFooter(ctx, view) {
  const hint = 'WASD / ARROWS MOVE   \u00b7   MOUSE AIM   \u00b7   HOLD CLICK / SPACE RAPID FIRE   \u00b7   P PAUSE   \u00b7   M MUTE';
  text(ctx, hint, W / 2, H - 14, { size: 10.5, weight: 600, color: PALETTE.dim, spacing: 1.6, align: 'center', alpha: 0.55 });
  if (view.muted) text(ctx, 'SOUND OFF', W - 28, H - 14, { size: 10.5, weight: 700, color: PALETTE.red, spacing: 2, align: 'right' });
}

/** Everything the player watches while flying: score, combo, wave, elite health, hull, shield. */
export function drawHud(ctx, state, view) {
  const elite = state.enemies.find((e) => e.kind === 'elite');
  drawScorePanel(ctx, state, view);
  drawComboPanel(ctx, state);
  drawWavePanel(ctx, state, elite);
  if (elite) drawEliteBar(ctx, elite);
  drawHullPanel(ctx, state, view.time);
  drawFooter(ctx, view);
}

/** A thin rule that fades out away from the banner text: dir = -1 for the left, 1 for the right. */
function bannerRule(ctx, color, x, y, dir) {
  const near = x + dir * 20;
  const far = x + dir * 260;
  const g = ctx.createLinearGradient(near, 0, far, 0);
  g.addColorStop(0, rgba(color, 0.9));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(Math.min(near, far), y, 240, 2);
}

export function drawBanner(ctx, banner) {
  const { t, dur } = banner;
  if (!banner.text || t >= dur) return;
  const a = clamp01(t / 0.25) * clamp01((dur - t) / 0.45);
  const slide = (1 - clamp01(t / 0.3)) * 26;
  const y = H * 0.36;
  const w = measure(ctx, banner.text, 68, 800, 14);
  ctx.save();
  ctx.globalAlpha = a;
  bannerRule(ctx, banner.color, W / 2 - w / 2, y - 24, -1);
  bannerRule(ctx, banner.color, W / 2 + w / 2, y - 24, 1);
  ctx.restore();
  text(ctx, banner.text, W / 2 + slide, y, { size: 68, weight: 800, color: PALETTE.white, spacing: 14, align: 'center', glow: banner.color, blur: 26, alpha: a });
  text(ctx, banner.sub, W / 2 - slide, y + 38, { size: 17, weight: 700, color: banner.color, spacing: 7, align: 'center', alpha: a });
}
