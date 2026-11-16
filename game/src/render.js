// Frame composer: backdrop, world (with shake), dual-pass bloom, warnings, mood & HUD.
import { H, PALETTE, W } from './config.js';
import { createBackground } from './background.js';
import {
  drawBullets, drawCores, drawEnemy, drawEnemyBullets, drawParticles, drawPickups, drawPlayer, drawReticle,
} from './actors.js';
import { drawBanner, drawHud } from './hud.js';
import { drawGameOver, drawPause, drawTitle } from './screens.js';
import { clamp01, drawGlow, makeCanvas, rgba, text } from './gfx.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const OVERSCAN_X = 400;
const OVERSCAN_Y = 250;
const WASH_OUTER = 780;
const BRACKET_CORNERS = [
  [8, 8, 1, 1], [W - 8, 8, -1, 1], [8, H - 8, 1, -1], [W - 8, H - 8, -1, -1],
];

export function createRenderer(canvas, seed) {
  const ctx = canvas.getContext('2d');
  const background = createBackground(seed);
  let scale = 1, offsetX = 0, offsetY = 0;
  const bloomCanvas = makeCanvas(320, 180);
  const bloomCtx = bloomCanvas.getContext('2d');
  const wideCanvas = makeCanvas(160, 90);
  const wideCtx = wideCanvas.getContext('2d');

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = canvas.clientWidth || window.innerWidth || W;
    const cssH = canvas.clientHeight || window.innerHeight || H;
    const pw = Math.max(1, Math.round(cssW * dpr));
    const ph = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    scale = Math.min(cssW / W, cssH / H);
    offsetX = (cssW - W * scale) / 2;
    offsetY = (cssH - H * scale) / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { cssW, cssH };
  }

  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return { x: (clientX - rect.left - offsetX) / scale, y: (clientY - rect.top - offsetY) / scale };
  }

  function drawWorld(state, t) {
    drawCores(ctx, state.coreList, t);
    if (state.pickups) drawPickups(ctx, state.pickups, t);
    drawEnemyBullets(ctx, state.enemyBullets, t);
    for (const e of state.enemies) drawEnemy(ctx, e, t);
    drawBullets(ctx, state.bullets);
    if (state.alive) {
      drawPlayer(ctx, state.player, t, {
        invulnerable: state.player.invulnerable,
        shieldReady: state.shieldReady,
        thrust: state.player.thrust,
        spreadActive: (state.spreadTimer || 0) > 0,
      });
    }
    drawParticles(ctx, state.particles);
  }

  function edgeWash(color, alpha, inner = 300) {
    if (alpha <= 0.002) return;
    const g = ctx.createRadialGradient(W / 2, H / 2, inner, W / 2, H / 2, WASH_OUTER);
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(1, rgba(color, alpha));
    ctx.fillStyle = g;
    ctx.fillRect(-OVERSCAN_X, -OVERSCAN_Y, W + OVERSCAN_X * 2, H + OVERSCAN_Y * 2);
  }

  function vignette(state, view) {
    edgeWash(PALETTE.void, 0.5);
    edgeWash(PALETTE.red, 0.55 * (state.hitFlash || 0), 200);
    if (state.alive && state.hull === 1 && view.screen === SCREEN_PLAY) {
      edgeWash(PALETTE.red, 0.1 + 0.14 * (0.5 + 0.5 * Math.sin(view.time * 5)), 330);
    }
    edgeWash(PALETTE.amber, 0.2 * (state.tierFlash || 0));
    if (state.timeScale < 0.8) edgeWash(PALETTE.cyan, 0.22 * (1 - state.timeScale), 260);
    if ((state.shake || 0) > 0.25) edgeWash(PALETTE.magenta, Math.min(0.22, state.shake * 0.085), 340);
    const hsf = clamp01(state.hitStopFlash || 0);
    if (hsf > 0.005) {
      edgeWash(PALETTE.ice, 0.22 * hsf, 380);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(PALETTE.ice, 0.52 * hsf);
      ctx.lineWidth = 4 * hsf + 1;
      ctx.strokeRect(2, 2, W - 4, H - 4);
      ctx.restore();
    }
  }

  function drawEliteWarning(ew, t) {
    if (!ew || !ew.active) return;
    const bx = Math.max(38, Math.min(W - 38, ew.x));
    const by = Math.max(38, Math.min(H - 38, ew.y));
    const ang = ew.x === W / 2 && ew.y === H / 2 ? 0 : Math.atan2(ew.y - H / 2, ew.x - W / 2);
    const col = ew.color || PALETTE.magenta;
    const pulse = 0.55 + 0.45 * Math.sin(t * 16);
    const wave = (t * 2.2) % 1;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, col, bx, by, 44 + pulse * 14, 0.45 * pulse);
    ctx.strokeStyle = rgba(col, (1 - wave) * 0.8);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(bx, by, 14 + wave * 24, 0, Math.PI * 2); ctx.stroke();

    ctx.translate(bx, by);
    ctx.rotate(ang);
    ctx.strokeStyle = rgba(col, 0.55 + 0.45 * pulse);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(11, -10); ctx.lineTo(22, 0); ctx.lineTo(11, 10);
    ctx.moveTo(4, -7); ctx.lineTo(13, 0); ctx.lineTo(4, 7);
    ctx.stroke();

    ctx.fillStyle = 'rgba(5,6,26,0.85)';
    ctx.beginPath();
    ctx.moveTo(10, 0); ctx.lineTo(0, -10); ctx.lineTo(-10, 0); ctx.lineTo(0, 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.restore();

    text(ctx, '!', bx, by + 0.5, { size: 13, weight: 800, color: '#ffffff', align: 'center', baseline: 'middle', glow: col, blur: 6 });
    if (ew.name) {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      text(ctx, ew.name, bx - ca * 26, by - sa * 30, {
        size: 10, weight: 800, color: col, spacing: 2,
        align: ca > 0.4 ? 'right' : ca < -0.4 ? 'left' : 'center', baseline: 'middle', alpha: 0.75 + 0.25 * pulse,
      });
    }
  }

  function bloom(strength) {
    if (!bloomCtx || !wideCtx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    bloomCtx.globalCompositeOperation = 'copy';
    bloomCtx.drawImage(canvas, 0, 0, bloomCanvas.width, bloomCanvas.height);
    wideCtx.globalCompositeOperation = 'copy';
    wideCtx.drawImage(bloomCanvas, 0, 0, wideCanvas.width, wideCanvas.height);
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    const hasFilter = 'filter' in ctx;
    if (hasFilter) ctx.filter = `blur(${Math.max(2, canvas.width / 260)}px)`;
    ctx.globalAlpha = strength * 0.72;
    ctx.drawImage(bloomCanvas, 0, 0, canvas.width, canvas.height);
    if (hasFilter) ctx.filter = `blur(${Math.max(4, canvas.width / 110)}px)`;
    ctx.globalAlpha = strength * 0.48;
    ctx.drawImage(wideCanvas, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function frame() {
    ctx.strokeStyle = rgba(PALETTE.cyan, 0.14);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < BRACKET_CORNERS.length; i += 1) {
      const c = BRACKET_CORNERS[i];
      ctx.moveTo(c[0] + c[2] * 26, c[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(c[0], c[1] + c[3] * 26);
    }
    ctx.stroke();
  }

  function draw(state, view) {
    const { cssW, cssH } = resize();
    ctx.fillStyle = PALETTE.void;
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    const title = view.screen === SCREEN_TITLE;
    const camX = title ? Math.sin(view.time * 0.25) * 140 : state.player.x - W / 2;
    const camY = title ? Math.cos(view.time * 0.2) * 60 : state.player.y - H / 2;
    background.draw(ctx, view.time, camX, camY);

    if (title) {
      drawTitle(ctx, state, view);
      bloom(0.24);
    } else {
      ctx.save();
      ctx.translate(state.shakeX || 0, state.shakeY || 0);
      drawWorld(state, view.time);
      ctx.restore();
      vignette(state, view);
      bloom(0.26 + 0.1 * clamp01(state.hitStopFlash || 0));
      if (view.screen === SCREEN_PLAY) drawEliteWarning(state.eliteWarning, view.time);
      if (state.alive && view.screen !== SCREEN_OVER) drawReticle(ctx, state.player, view.time);
      if (view.screen === SCREEN_OVER) drawGameOver(ctx, state, view);
      else {
        drawHud(ctx, state, view);
        drawBanner(ctx, state.banner);
        if (view.screen === SCREEN_PAUSED) drawPause(ctx, state, view);
      }
    }
    frame();
    ctx.restore();
  }

  return { draw, toField, resize };
}
