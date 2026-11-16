// Full-screen states: staged title showcase, neon pause card, and staged game-over reveal.
import { ELITE, ENEMY, FONT_NUM, FONT_UI, H, PALETTE, PICKUP, W } from './config.js';
import { clamp01, drawGlow, formatScore, measure, rgba, roundRect, text } from './gfx.js';
import { drawBullets, drawCores, drawEnemy, drawPickups, drawPlayer } from './actors.js';
import { panel } from './hud.js';

const TAU = Math.PI * 2;
const easeOut = (x) => 1 - (1 - x) ** 3;
const fillOverscan = (ctx) => ctx.fillRect(-400, -250, W + 800, H + 500);

function drawPill(ctx, py, pw, c0, c1, glow, pulse, label, size, spacing, textAlpha = 1) {
  const px = (W - pw) / 2;
  roundRect(ctx, px, py, pw, 50, 25);
  const pg = ctx.createLinearGradient(px, 0, px + pw, 0);
  pg.addColorStop(0, rgba(c0, 0.28 * pulse + 0.1));
  pg.addColorStop(1, rgba(c1, 0.28 * pulse + 0.1));
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.strokeStyle = rgba(PALETTE.ice, 0.55 + 0.4 * pulse);
  ctx.lineWidth = 1.8;
  ctx.stroke();
  text(ctx, label, W / 2, py + 32, { size, weight: 800, color: '#ffffff', spacing, align: 'center', glow, blur: 14, alpha: textAlpha });
}

// ---- title ---------------------------------------------------------------------------------

function fake(kind, x, y, phase, extra = {}) {
  const def = ENEMY[kind];
  return {
    kind, x, y, sides: def ? def.sides : 6, radius: def ? def.radius : ELITE.radius,
    color: def ? PALETTE[def.color] : PALETTE.magenta, phase, rot: 0,
    hp: def ? def.hp : 40, maxHp: def ? def.hp : 40, flash: 0, name: kind,
    aimCharge: 0, aimAngle: 0, bossCharge: 0, attackMode: 'fan', ...extra,
  };
}

const [W_ELITE, B_ELITE] = ELITE.variants;
const TITLE_ENEMIES = [
  fake('elite', 142, 370, 2.3, { sides: B_ELITE.sides, color: PALETTE[B_ELITE.color], name: B_ELITE.name, hp: 50, maxHp: 50, bossCharge: 0.35, attackMode: 'spiral' }),
  fake('splitter', 298, 314, 0.4),
  fake('shardling', 362, 294, 1.3),
  fake('shardling', 350, 344, 2.8),
  fake('orbiter', 316, 418, 1.9),
  fake('square', 228, 438, 0.8),
  fake('triangle', 440, 334, 0.3),
  fake('pentagon', 418, 436, 3.8),
  fake('elite', 1132, 366, 0.6, { sides: W_ELITE.sides, color: PALETTE[W_ELITE.color], name: W_ELITE.name, hp: 40, maxHp: 60, bossCharge: 0.45, attackMode: 'nova' }),
  fake('sniper', 974, 308, 1.7),
  fake('orbiter', 924, 422, 4.1),
  fake('splitter', 836, 308, 2.4),
  fake('triangle', 810, 436, 3.2),
  fake('square', 1026, 438, 2.6),
];

const TITLE_CORES = [
  [558, 396, 0.3], [722, 394, 1.7], [596, 452, 2.9], [682, 332, 4.2],
  [472, 386, 5.5], [802, 376, 0.9], [542, 334, 3.6], [880, 396, 2.2],
];

const TITLE_PICKUPS = [
  ['spread', 520, 368, 0.4], ['shield', 760, 368, 2.1], ['hull', 524, 440, 3.7],
].map(([kind, x, y, phase], i) => ({
  id: i + 1, kind, x, y, vx: 0, vy: 0, age: 0, life: PICKUP.life, radius: PICKUP.radius, phase,
}));

const SPREAD_OFFSETS = [-0.24, -0.12, 0, 0.12, 0.24];

function drawTitleScene(ctx, t) {
  const teal = PALETTE.teal || '#2cf5c8';
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, PALETTE.violet, W / 2, 396, 360, 0.28);
  drawGlow(ctx, PALETTE.cyan, W / 2, 396, 175, 0.24);
  drawGlow(ctx, teal, W / 2, 396, 110, 0.14);
  ctx.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.translate(W / 2, 398);
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

  for (const [x, y, ph] of TITLE_CORES) {
    drawCores(ctx, [{ x: x + Math.sin(t * 1.3 + ph) * 5, y: y + Math.cos(t * 1.1 + ph) * 5, age: 0, phase: ph, spin: 1.4 }], t);
  }
  drawPickups(ctx, TITLE_PICKUPS.map((pk) => ({ ...pk, y: pk.y + Math.sin(t * 1.8 + pk.phase) * 4 })), t);

  const px = W / 2;
  const py = 396 + Math.sin(t * 1.6) * 4;
  const bank = Math.sin(t * 1.1) * 0.65;
  const angle = -Math.PI / 2 + bank * 0.16;
  const ship = {
    x: px, y: py, angle, aimX: px + Math.cos(angle) * 260, aimY: py + Math.sin(angle) * 260,
    invulnerable: 0, flare: 0.6 + 0.4 * Math.sin(t * 9), thrust: 1, bank, recoil: 0.25, muzzle: 0.6 + 0.4 * Math.sin(t * 12),
  };

  const shots = [];
  for (let w = 0; w < 2; w += 1) {
    const dist = 42 + ((w * 64 + t * 320) % 128);
    SPREAD_OFFSETS.forEach((off, idx) => {
      const a = angle + off;
      shots.push({
        x: px + Math.cos(a) * dist, y: py + Math.sin(a) * dist,
        vx: Math.cos(a) * 800, vy: Math.sin(a) * 800, powered: true, color: idx % 2 ? teal : PALETTE.amber,
      });
    });
  }
  drawBullets(ctx, shots);

  for (const e of TITLE_ENEMIES) {
    const live = { ...e, x: e.x + Math.sin(t * 0.9 + e.phase) * 6, y: e.y + Math.cos(t * 0.7 + e.phase * 1.3) * 5 };
    if (e.kind === 'triangle' || e.kind === 'shardling') live.rot = Math.atan2(py - live.y, px - live.x);
    else if (e.kind === 'sniper') {
      live.aimAngle = Math.atan2(py - live.y, px - live.x);
      live.rot = live.aimAngle;
      live.aimCharge = 0.52 + 0.28 * Math.sin(t * 2.1);
    } else if (e.kind === 'elite') live.rot = t * 0.4 + e.phase;
    else live.rot = t * (e.kind === 'orbiter' ? 1.8 : e.kind === 'pentagon' ? 1.5 : 0.65) * (e.phase > 3 ? -1 : 1) + e.phase;
    drawEnemy(ctx, live, t);
  }
  drawPlayer(ctx, ship, t, { shieldReady: true, invulnerable: 0, spreadActive: true });
}

function drawKey(ctx, label, x, y, size = 25) {
  roundRect(ctx, x, y, size, size, 6);
  const g = ctx.createLinearGradient(0, y, 0, y + size);
  g.addColorStop(0, 'rgba(70,90,170,0.55)');
  g.addColorStop(1, 'rgba(20,26,80,0.8)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = rgba(PALETTE.cyan, 0.8);
  ctx.lineWidth = 1.3;
  ctx.stroke();
  text(ctx, label, x + size / 2, y + size / 2 + 5, { size: 12.5, weight: 800, color: PALETTE.white, align: 'center' });
}

function drawCard(ctx, x, y, w, h, accent, heading, draw) {
  panel(ctx, x, y, w, h, accent, 0.68);
  text(ctx, heading, x + 20, y + 27, { size: 11.5, weight: 800, color: accent, spacing: 3.5 });
  draw(x + 20, y);
}

function drawTitleText(ctx, t) {
  const str = 'LUMEN DRIFT';
  const size = 104;
  const baseline = 182;
  const teal = PALETTE.teal || '#2cf5c8';
  ctx.save();
  ctx.font = `800 ${size}px ${FONT_UI}`;
  ctx.textAlign = 'center';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '20px';
  const cx = W / 2 + 10;
  const drift = Math.sin(t * 1.8) * 1.2;

  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgba(PALETTE.magenta, 0.62);
  ctx.fillText(str, cx + 6 + drift, baseline + 2.5);
  ctx.fillStyle = rgba(teal, 0.32);
  ctx.fillText(str, cx - 2, baseline + 2);
  ctx.fillStyle = rgba(PALETTE.cyan, 0.62);
  ctx.fillText(str, cx - 6 - drift, baseline - 2.5);
  ctx.globalCompositeOperation = 'source-over';

  ctx.shadowColor = PALETTE.cyan;
  ctx.shadowBlur = 46;
  ctx.fillStyle = rgba(PALETTE.cyan, 0.52);
  ctx.fillText(str, cx, baseline);
  ctx.shadowColor = PALETTE.magenta;
  ctx.shadowBlur = 78;
  ctx.fillText(str, cx, baseline);
  ctx.shadowBlur = 0;

  const g = ctx.createLinearGradient(0, baseline - size * 0.78, 0, baseline + 8);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.42, '#e2fcff');
  g.addColorStop(0.54, '#79eeff');
  g.addColorStop(1, '#4aa8ff');
  ctx.fillStyle = g;
  ctx.fillText(str, cx, baseline);
  ctx.restore();

  const fy = baseline - size * 0.32;
  const wob = 0.8 + 0.2 * Math.sin(t * 2.2);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const lg = ctx.createLinearGradient(W / 2 - 560, 0, W / 2 + 560, 0);
  lg.addColorStop(0, rgba(PALETTE.cyan, 0));
  lg.addColorStop(0.5, rgba('#ffffff', 0.78 * wob));
  lg.addColorStop(1, rgba(PALETTE.magenta, 0));
  ctx.fillStyle = lg;
  ctx.fillRect(W / 2 - 560, fy - 1, 1120, 2);
  drawGlow(ctx, PALETTE.white, W / 2 + Math.sin(t * 0.85) * 320, fy, 72, 0.28 * wob);
  ctx.restore();
}

export function drawTitle(ctx, state, view) {
  const t = view.time;
  const v = ctx.createRadialGradient(W / 2, H / 2, 210, W / 2, H / 2, 760);
  v.addColorStop(0, 'rgba(3,4,20,0)');
  v.addColorStop(1, 'rgba(3,4,20,0.58)');
  ctx.fillStyle = v;
  fillOverscan(ctx);

  drawTitleScene(ctx, t);
  drawTitleText(ctx, t);

  const sub = 'NEON DEEP-SPACE SURVIVAL';
  const sw = measure(ctx, sub, 17, 700, 11);
  text(ctx, sub, W / 2, 230, { size: 17, weight: 700, color: PALETTE.ice, spacing: 11, align: 'center', glow: PALETTE.cyan, blur: 10 });
  for (const dir of [-1, 1]) {
    const x0 = W / 2 + dir * (sw / 2 + 24);
    const g = ctx.createLinearGradient(x0, 0, x0 + dir * 170, 0);
    g.addColorStop(0, rgba(PALETTE.magenta, 0.9));
    g.addColorStop(1, rgba(PALETTE.magenta, 0));
    ctx.fillStyle = g;
    ctx.fillRect(dir > 0 ? x0 : x0 - 170, 224, 170, 2);
  }

  const cw = 316;
  const gap = 28;
  const x0 = (W - (cw * 3 + gap * 2)) / 2;
  drawCard(ctx, x0, 492, cw, 104, PALETTE.cyan, 'PILOT & SHIELD', (x, y) => {
    ['W', 'A', 'S', 'D'].forEach((k, i) => drawKey(ctx, k, x + i * 31, y + 40, 25));
    text(ctx, 'or ARROWS', x + 132, y + 58, { size: 12.5, weight: 700, color: PALETTE.text, spacing: 1 });
    text(ctx, 'Click-drag steers  \u00b7  Shield blocks 1 hit', x, y + 89, { size: 12.5, weight: 500, color: PALETTE.dim });
  });
  drawCard(ctx, x0 + cw + gap, 492, cw, 104, PALETTE.magenta, 'ARSENAL & DROPS', (x, y) => {
    text(ctx, 'Mouse aims. Click / SPACE rapid fire.', x, y + 57, { size: 13.5, color: PALETTE.text });
    text(ctx, 'Grab SPREAD, HULL & SHIELD drops.', x, y + 87, { size: 12.5, color: PALETTE.teal || PALETTE.ice });
  });
  drawCard(ctx, x0 + (cw + gap) * 2, 492, cw, 104, PALETTE.amber, 'THREATS & CORES', (x, y) => {
    text(ctx, 'Splitters, Orbiters, Snipers & Elites.', x, y + 57, { size: 13.5, color: PALETTE.text });
    text(ctx, 'Chain star cores: x9 combo + shield.', x, y + 87, { size: 12.5, weight: 500, color: PALETTE.dim });
  });

  const pulse = 0.72 + 0.28 * Math.sin(t * 3.2);
  const startLabel = 'PRESS ENTER  /  CLICK TO START';
  const pw = Math.max(470, measure(ctx, startLabel, 18, 800, 4) + 80);
  drawPill(ctx, 632, pw, PALETTE.cyan, PALETTE.magenta, PALETTE.cyan, pulse, startLabel, 18, 4, 0.7 + 0.3 * pulse);
  text(ctx, 'P / ESC PAUSE   \u00b7   M SOUND   \u00b7   F AUTO-FIRE   \u00b7   ELITE BOSS EVERY 5 WAVES', W / 2, 705, {
    size: 10.5, color: PALETTE.dim, spacing: 2, align: 'center', alpha: 0.72,
  });
  if (view.best > 0) text(ctx, `BEST  ${formatScore(view.best)}`, W - 28, 36, { size: 13, weight: 800, color: PALETTE.amber, spacing: 3, align: 'right' });
}

// ---- pause ---------------------------------------------------------------------------------

export function drawPause(ctx, state, view) {
  ctx.fillStyle = 'rgba(3,4,22,0.68)';
  fillOverscan(ctx);
  const w = 540;
  const h = 272;
  const x = (W - w) / 2;
  const y = (H - h) / 2;
  panel(ctx, x, y, w, h, PALETTE.cyan, 0.9);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  text(ctx, 'PAUSED', W / 2 + 3, y + 82, { size: 56, weight: 800, color: rgba(PALETTE.magenta, 0.45), spacing: 16, align: 'center' });
  text(ctx, 'PAUSED', W / 2 - 3, y + 82, { size: 56, weight: 800, color: rgba(PALETTE.cyan, 0.45), spacing: 16, align: 'center' });
  ctx.restore();
  text(ctx, 'PAUSED', W / 2, y + 82, { size: 56, weight: 800, color: '#ffffff', spacing: 16, align: 'center', glow: PALETTE.cyan, blur: 26 });

  ctx.fillStyle = rgba(PALETTE.cyan, 0.24);
  ctx.fillRect(x + 48, y + 102, w - 96, 1);

  const lines = [
    ['P / ESC / CLICK', 'RESUME'],
    ['R', 'RESTART RUN'],
    ['M', `SOUND  (${view.muted ? 'OFF' : 'ON'})`],
    ['F', `AUTO-FIRE  (${state.autoFire ? 'ON' : 'OFF'})`],
  ];
  lines.forEach(([k, v], i) => {
    const ly = y + 136 + i * 26;
    text(ctx, k, W / 2 - 14, ly, { size: 13, weight: 800, color: PALETTE.amber, spacing: 2, align: 'right' });
    text(ctx, v, W / 2 + 14, ly, { size: 13, color: PALETTE.text, spacing: 2 });
  });
  text(ctx, `SCORE ${formatScore(state.score)}   \u00b7   WAVE ${state.wave}   \u00b7   MAX x${state.maxCombo}`, W / 2, y + h - 16, {
    size: 11, weight: 700, color: PALETTE.dim, spacing: 2.5, align: 'center', alpha: 0.7 + 0.3 * Math.sin(view.time * 3),
  });
}

// ---- game over -----------------------------------------------------------------------------

function stat(ctx, labelText, value, x, y, color, alpha = 1) {
  text(ctx, labelText, x, y, { size: 10.5, weight: 700, color: PALETTE.dim, spacing: 2.4, align: 'center', alpha });
  text(ctx, value, x, y + 29, { size: 23, weight: 800, color, font: FONT_NUM, align: 'center', alpha });
}

export function drawGameOver(ctx, state, view) {
  if (view.overTime <= 0) return;
  const t = view.time;
  const ot = view.overTime;

  const bgT = clamp01(ot / 0.45);
  ctx.fillStyle = `rgba(3,4,22,${0.66 * bgT})`;
  fillOverscan(ctx);
  const v = ctx.createRadialGradient(W / 2, H / 2, 160, W / 2, H / 2, 720);
  v.addColorStop(0, 'rgba(255,62,165,0)');
  v.addColorStop(1, `rgba(120,10,70,${0.38 * bgT})`);
  ctx.fillStyle = v;
  fillOverscan(ctx);

  if (ot < 0.7) {
    const sw = W * easeOut(clamp01(ot / 0.38));
    ctx.fillStyle = rgba(PALETTE.magenta, (1 - clamp01((ot - 0.25) / 0.45)) * 0.45);
    ctx.fillRect((W - sw) / 2, 198, sw, 2);
  }

  const titleT = easeOut(clamp01((ot - 0.1) / 0.46));
  if (titleT > 0.01) {
    const split = 4 + (1 - titleT) * 14;
    const ty = 154 + (1 - titleT) * -20;
    ctx.save();
    ctx.globalAlpha = titleT;
    ctx.font = `800 94px ${FONT_UI}`;
    ctx.textAlign = 'center';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '16px';
    const cx = W / 2 + 8;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(PALETTE.cyan, 0.55);
    ctx.fillText('GAME OVER', cx - split, ty);
    ctx.fillStyle = rgba(PALETTE.magenta, 0.45);
    ctx.fillText('GAME OVER', cx + split * 0.7, ty + 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowColor = PALETTE.magenta;
    ctx.shadowBlur = 50;
    ctx.fillStyle = rgba(PALETTE.magenta, 0.7);
    ctx.fillText('GAME OVER', cx, ty + 2);
    ctx.shadowBlur = 0;
    const g = ctx.createLinearGradient(0, ty - 78, 0, ty + 10);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#ffc2e4');
    g.addColorStop(1, '#ff4d9a');
    ctx.fillStyle = g;
    ctx.fillText('GAME OVER', cx, ty + 2);
    ctx.restore();
    text(ctx, 'HULL BREACH  \u00b7  SIGNAL LOST', W / 2, 196, {
      size: 16, weight: 700, color: PALETTE.ice, spacing: 8, align: 'center', alpha: 0.85 * clamp01((ot - 0.24) / 0.34),
    });
  }

  const cardT = easeOut(clamp01((ot - 0.26) / 0.5));
  if (cardT > 0.01) {
    const w = 680;
    const x = (W - w) / 2;
    const y = 230 + (1 - cardT) * 26;
    ctx.save();
    ctx.globalAlpha = cardT;
    panel(ctx, x, y, w, 256, PALETTE.magenta, 0.86);
    text(ctx, 'FINAL SCORE', W / 2, y + 38, { size: 13, weight: 800, color: PALETTE.dim, spacing: 7, align: 'center' });
    const count = easeOut(clamp01((ot - 0.4) / 0.95));
    text(ctx, formatScore(state.score * count), W / 2, y + 110, {
      size: 76, weight: 800, color: '#ffffff', font: FONT_NUM, align: 'center', glow: PALETTE.cyan, blur: 24,
    });
    const badgeT = clamp01((ot - 0.85) / 0.3);
    if (state.newBest && badgeT > 0) {
      ctx.save();
      ctx.globalAlpha *= badgeT;
      roundRect(ctx, W / 2 - 98, y + 126, 196, 28, 14);
      ctx.fillStyle = rgba(PALETTE.amber, 0.2 + 0.08 * Math.sin(t * 5));
      ctx.fill();
      ctx.strokeStyle = PALETTE.amber;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      text(ctx, 'NEW BEST SCORE', W / 2, y + 145, { size: 12, weight: 800, color: PALETTE.gold, spacing: 4, align: 'center' });
      ctx.restore();
    } else if (!state.newBest) {
      text(ctx, `BEST  ${formatScore(view.best)}`, W / 2, y + 146, {
        size: 15, weight: 800, color: PALETTE.amber, spacing: 5, align: 'center', alpha: badgeT,
      });
    }
    ctx.fillStyle = rgba(PALETTE.cyan, 0.25);
    ctx.fillRect(x + 34, y + 172, w - 68, 1);

    const cols = [
      ['WAVE', String(state.wave), PALETTE.cyan],
      ['BEST', formatScore(view.best), PALETTE.amber],
      ['DRONES', String(state.kills), PALETTE.magenta],
      ['PICKUPS', String(state.pickupsCollected ?? 0), PALETTE.teal || PALETTE.ice],
      ['MAX COMBO', `x${state.maxCombo}`, PALETTE.gold],
    ];
    cols.forEach(([l, val, c], i) => {
      const colA = clamp01((ot - (0.64 + i * 0.08)) / 0.24);
      if (colA > 0) stat(ctx, l, val, x + (w / 5) * (i + 0.5), y + 196, c, colA);
    });
    ctx.restore();
  }

  const ctaT = easeOut(clamp01((ot - 1.05) / 0.55));
  if (ctaT > 0.01) {
    const py = 516 + (1 - ctaT) * 12;
    ctx.save();
    ctx.globalAlpha = ctaT;
    drawPill(ctx, py, 460, PALETTE.magenta, PALETTE.cyan, PALETTE.magenta, 0.72 + 0.28 * Math.sin(t * 3.2), 'PRESS R  /  CLICK TO RESTART', 19, 5);
    text(ctx, 'ENTER ALSO WORKS', W / 2, py + 78, { size: 10.5, color: PALETTE.dim, spacing: 3, align: 'center' });
    ctx.restore();
  }
}
