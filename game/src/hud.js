// Heads-up display: score/best, combo meter, wave progress/tag, overdrive spread timer,
// elite health/phase bar, hull pips, shield meter, staged banners and footer.
import { COMBO, FONT_NUM, H, PALETTE, PICKUP, PLAYER, W, comboMultiplier, isEliteWave } from './config.js';
import { clamp01, formatScore, measure, rgba, roundRect, text } from './gfx.js';

const MARGIN = 24;
const RIGHT_X = W - MARGIN - 290;
const SHIELD_CELLS = 10;
const CELL_BG = 'rgba(160,180,255,0.14)';
const MODE_LABEL = { fan: 'SPREAD FAN', nova: 'RADIAL NOVA', spiral: 'SPIRAL VOLLEY', lunge: 'TANGENT LUNGE' };

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

function bar(ctx, x, y, w, h, fill, colorA, colorB, bg = CELL_BG) {
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

function drawScorePanel(ctx, state, view) {
  panel(ctx, MARGIN, 18, 272, 92, PALETTE.cyan);
  label(ctx, 'SCORE', 44, 42);
  label(ctx, `BEST ${formatScore(Math.max(view.best, state.score))}`, 276, 42, 'right', PALETTE.amber);
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
  text(ctx, hint, 276, 164, { size: 11, color: idle, spacing: 1.5, align: 'right' });
  bar(ctx, 108, 178, 168, 5, live ? state.comboTimer / COMBO.window : 0, PALETTE.amber, PALETTE.magenta);
}

function drawWavePanel(ctx, state, elite, t) {
  const cx = W / 2;
  const warn = state.eliteWarning?.active;
  const accent = elite || warn ? (state.eliteWarning?.color || PALETTE.magenta) : PALETTE.cyan;
  panel(ctx, cx - 140, 18, 280, 78, accent);
  label(ctx, 'WAVE', cx, 36, 'center');
  text(ctx, String(state.wave).padStart(2, '0'), cx, 64, {
    size: 29, weight: 800, color: PALETTE.white, font: FONT_NUM, align: 'center', glow: accent, blur: 14,
  });
  bar(ctx, cx - 120, 70, 240, 4, state.waveKilled / Math.max(1, state.waveTotal), PALETTE.cyan, accent);
  if (warn) {
    text(ctx, 'ELITE ALERT', cx + 122, 36, {
      size: 10, weight: 800, color: accent, spacing: 2.2, align: 'right', glow: accent, blur: 10, alpha: 0.55 + 0.45 * Math.sin(t * 11),
    });
  } else if (isEliteWave(state.wave)) {
    text(ctx, 'ELITE', cx + 122, 36, {
      size: 10.5, weight: 800, color: PALETTE.magenta, spacing: 3, align: 'right', glow: PALETTE.magenta, blur: 8,
    });
  }
  const left = Math.max(0, state.waveTotal - state.waveKilled);
  text(ctx, `${left} LEFT`, cx - 122, 36, { size: 10, weight: 700, color: PALETTE.dim, spacing: 2 });
  const tag = warn ? `INBOUND: ${state.eliteWarning.name || 'ELITE'}` : (state.waveTag || (isEliteWave(state.wave) ? 'ELITE SIEGE' : ''));
  if (tag) {
    text(ctx, tag, cx, 89, {
      size: 9.5, weight: 700, color: warn ? PALETTE.gold : (elite ? PALETTE.magenta : PALETTE.ice),
      spacing: 2.6, align: 'center', alpha: warn ? 0.65 + 0.35 * Math.sin(t * 10) : 0.85,
    });
  }
}

function drawEliteBar(ctx, elite, t) {
  const w = 460;
  const x = (W - w) / 2;
  const y = 104;
  const charge = clamp01(elite.bossCharge || 0);
  const hpRatio = clamp01(elite.hp / Math.max(1, elite.maxHp));
  const baseColor = elite.color || PALETTE.magenta;
  const charging = charge > 0.04;
  const pulse = charging ? 0.5 + 0.5 * Math.sin(t * 18) : 0;
  panel(ctx, x, y, w, 42, charging && pulse > 0.55 ? PALETTE.amber : baseColor, 0.72);
  text(ctx, elite.name || 'ELITE', x + 16, y + 18, { size: 11.5, weight: 800, color: baseColor, spacing: 3, glow: baseColor, blur: 10 });
  const mode = MODE_LABEL[elite.attackMode] || 'ASSAULT';
  const status = charging ? `CHARGING ${mode}` : `${hpRatio < 0.5 ? 'PHASE II' : 'PHASE I'} \u00b7 ${mode}`;
  text(ctx, status, x + w - 16, y + 18, {
    size: 10, weight: 800, color: charging ? PALETTE.gold : PALETTE.ice, spacing: 2.2, align: 'right',
    glow: charging ? PALETTE.amber : null, blur: 8, alpha: charging ? 0.7 + 0.3 * pulse : 0.86,
  });
  bar(ctx, x + 16, y + 25, w - 32, 9, hpRatio, baseColor, PALETTE.orange);
  if (charging) {
    ctx.fillStyle = rgba(PALETTE.gold, 0.75 * (0.5 + 0.5 * pulse));
    ctx.fillRect(x + 16, y + 36, (w - 32) * charge, 2);
  }
}

function drawHullPanel(ctx, state, t) {
  const danger = state.hull === 1;
  panel(ctx, RIGHT_X, 18, 290, 92, danger ? PALETTE.red : PALETTE.cyan);
  label(ctx, 'HULL', RIGHT_X + 20, 48);
  for (let i = 0; i < PLAYER.hull; i += 1) {
    const filled = i < state.hull;
    ctx.globalAlpha = danger && filled ? 0.7 + 0.3 * Math.sin(t * 8) : 1;
    shipIcon(ctx, RIGHT_X + 148 + i * 52, 45, 12, filled, danger ? PALETTE.red : PALETTE.cyan);
  }
  ctx.globalAlpha = 1;
  label(ctx, 'SHIELD', RIGHT_X + 20, 90);
  const charge = (state.shield / 100) * SHIELD_CELLS;
  for (let i = 0; i < SHIELD_CELLS; i += 1) {
    const cellX = RIGHT_X + 96 + i * 18.4;
    const filled = clamp01(charge - i);
    ctx.fillStyle = CELL_BG;
    ctx.fillRect(cellX, 80, 15, 12);
    if (filled <= 0) continue;
    ctx.fillStyle = state.shieldReady ? PALETTE.ice : PALETTE.cyan;
    ctx.globalAlpha = state.shieldReady ? 0.8 + 0.2 * Math.sin(t * 6 + i * 0.5) : 0.35 + 0.65 * filled;
    ctx.fillRect(cellX, 80, 15, 12);
    ctx.globalAlpha = 1;
  }
  if (state.shieldReady) text(ctx, 'READY', RIGHT_X + 270, 71, { size: 10, weight: 800, color: PALETTE.ice, spacing: 2, align: 'right', glow: PALETTE.cyan, blur: 8 });
}

function drawSpreadPanel(ctx, state, t) {
  const timer = state.spreadTimer || 0;
  if (timer <= 0) return;
  const maxT = state.maxSpreadTimer || PICKUP?.spreadSeconds || 9;
  const teal = PALETTE.teal || '#2cf5c8';
  const blink = timer < 2.2 && Math.floor(t * 8) % 2 === 0;
  panel(ctx, RIGHT_X, 120, 290, 46, blink ? PALETTE.amber : teal, 0.74);
  text(ctx, 'OVERDRIVE SPREAD', RIGHT_X + 18, 140, { size: 10.5, weight: 800, color: PALETTE.amber, spacing: 2.2, glow: PALETTE.amber, blur: 8 });
  text(ctx, `${timer.toFixed(1)}S`, RIGHT_X + 272, 140, { size: 12.5, weight: 800, color: PALETTE.white, font: FONT_NUM, align: 'right', glow: teal, blur: 6 });
  bar(ctx, RIGHT_X + 18, 148, 254, 6, timer / maxT, teal, PALETTE.amber);
}

/** Everything the player watches while flying: score, combo, wave, elite health, hull, shield, spread. */
export function drawHud(ctx, state, view) {
  const elite = state.enemies.find((e) => e.kind === 'elite');
  drawScorePanel(ctx, state, view);
  drawComboPanel(ctx, state);
  drawWavePanel(ctx, state, elite, view.time);
  if (elite) drawEliteBar(ctx, elite, view.time);
  drawHullPanel(ctx, state, view.time);
  drawSpreadPanel(ctx, state, view.time);
  text(ctx, 'WASD / ARROWS MOVE   \u00b7   MOUSE AIM   \u00b7   HOLD CLICK / SPACE RAPID FIRE   \u00b7   P PAUSE   \u00b7   M MUTE', W / 2, H - 14, {
    size: 10.5, color: PALETTE.dim, spacing: 1.6, align: 'center', alpha: 0.55,
  });
  if (view.muted) text(ctx, 'SOUND OFF', W - 28, H - 14, { size: 10.5, weight: 700, color: PALETTE.red, spacing: 2, align: 'right' });
}

function bannerRule(ctx, color, x, y, dir, reach) {
  const near = x + dir * 18;
  const far = x + dir * (18 + reach);
  const g = ctx.createLinearGradient(near, 0, far, 0);
  g.addColorStop(0, rgba(color, 0.95));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(Math.min(near, far), y, reach, 2);
  ctx.fillStyle = rgba(PALETTE.white, 0.9);
  ctx.fillRect(near - 2, y - 1, 4, 4);
}

export function drawBanner(ctx, banner) {
  if (!banner || !banner.text || banner.dur <= 0 || banner.t >= banner.dur) return;
  const { t, dur, color } = banner;
  const easeIn = 1 - (1 - clamp01(t / 0.28)) ** 3;
  const outT = clamp01((dur - t) / 0.42);
  const a = easeIn * outT;
  if (a <= 0.002) return;
  const slide = (1 - easeIn) * 24;
  const scale = 0.92 + 0.08 * easeIn - 0.04 * (1 - outT);
  const y = H * 0.36;
  const w = measure(ctx, banner.text, 66, 800, 14);
  const reach = 230 * easeIn;

  ctx.save();
  ctx.globalAlpha = a;
  const band = ctx.createLinearGradient(0, y - 62, 0, y + 54);
  band.addColorStop(0, rgba(PALETTE.void, 0));
  band.addColorStop(0.5, rgba(PALETTE.void, 0.56));
  band.addColorStop(1, rgba(PALETTE.void, 0));
  ctx.fillStyle = band;
  ctx.fillRect(0, y - 62, W, 116);

  const sweepP = clamp01(t / Math.min(0.85, dur * 0.55));
  const sweepX = W * (0.18 + 0.64 * sweepP);
  ctx.globalCompositeOperation = 'lighter';
  const sg = ctx.createLinearGradient(sweepX - 240, 0, sweepX + 240, 0);
  sg.addColorStop(0, rgba(color, 0));
  sg.addColorStop(0.5, rgba(color, 0.28 * (1 - sweepP * 0.6)));
  sg.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = sg;
  ctx.fillRect(sweepX - 240, y - 48, 480, 92);
  ctx.globalCompositeOperation = 'source-over';

  ctx.translate(W / 2, y - 8);
  ctx.scale(scale, scale);
  ctx.translate(-W / 2, -(y - 8));

  bannerRule(ctx, color, W / 2 - w / 2, y - 24, -1, reach);
  bannerRule(ctx, color, W / 2 + w / 2, y - 24, 1, reach);
  bannerRule(ctx, PALETTE.white, W / 2 - w * 0.32, y + 48, -1, reach * 0.58);
  bannerRule(ctx, PALETTE.white, W / 2 + w * 0.32, y + 48, 1, reach * 0.58);

  text(ctx, banner.text, W / 2 + slide, y, { size: 66, weight: 800, color: PALETTE.white, spacing: 14, align: 'center', glow: color, blur: 28 });
  if (banner.sub) {
    text(ctx, banner.sub, W / 2 - slide, y + 36, { size: 16, weight: 700, color, spacing: 6.5, align: 'center', glow: color, blur: 10 });
  }
  ctx.restore();
}
