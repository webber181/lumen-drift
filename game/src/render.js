// Composes a frame: backdrop, world (with screen shake), screen-wide effects, then the HUD or
// the full-screen state on top. Everything is drawn in 1280x720 field coordinates; the canvas
// is scaled to fit the window (letterboxed, but the backdrop paints past the field edges).
import { H, PALETTE, W } from './config.js';
import { createBackground } from './background.js';
import { drawBullets, drawCores, drawEnemy, drawEnemyBullets, drawParticles, drawPlayer, drawReticle } from './actors.js';
import { drawBanner, drawHud } from './hud.js';
import { drawGameOver, drawPause, drawTitle } from './screens.js';
import { makeCanvas, rgba } from './gfx.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

export function createRenderer(canvas, seed) {
  const ctx = canvas.getContext('2d');
  const background = createBackground(seed);
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  const bloomCanvas = makeCanvas(320, 180);
  const bloomCtx = bloomCanvas.getContext('2d');

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

  /** Window coordinates to field coordinates. */
  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return { x: (clientX - rect.left - offsetX) / scale, y: (clientY - rect.top - offsetY) / scale };
  }

  function drawWorld(state, t) {
    drawCores(ctx, state.coreList, t);
    drawEnemyBullets(ctx, state.enemyBullets, t);
    for (const e of state.enemies) drawEnemy(ctx, e, t);
    drawBullets(ctx, state.bullets);
    if (state.alive) drawPlayer(ctx, state.player, t, { shieldReady: state.shieldReady });
    drawParticles(ctx, state.particles);
  }

  function vignette(state, view) {
    const v = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 780);
    v.addColorStop(0, 'rgba(3,4,20,0)');
    v.addColorStop(1, 'rgba(3,4,20,0.5)');
    ctx.fillStyle = v;
    ctx.fillRect(-400, -250, W + 800, H + 500);
    if (state.hitFlash > 0) {
      const r = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 760);
      r.addColorStop(0, rgba(PALETTE.red, 0));
      r.addColorStop(1, rgba(PALETTE.red, 0.55 * state.hitFlash));
      ctx.fillStyle = r;
      ctx.fillRect(-400, -250, W + 800, H + 500);
    }
    if (state.alive && state.hull === 1 && view.screen === SCREEN_PLAY) {
      const pulse = 0.5 + 0.5 * Math.sin(view.time * 5);
      const d = ctx.createRadialGradient(W / 2, H / 2, 330, W / 2, H / 2, 780);
      d.addColorStop(0, rgba(PALETTE.red, 0));
      d.addColorStop(1, rgba(PALETTE.red, 0.1 + 0.14 * pulse));
      ctx.fillStyle = d;
      ctx.fillRect(-400, -250, W + 800, H + 500);
    }
    if (state.tierFlash > 0) {
      const f = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 780);
      f.addColorStop(0, rgba(PALETTE.amber, 0));
      f.addColorStop(1, rgba(PALETTE.amber, 0.2 * state.tierFlash));
      ctx.fillStyle = f;
      ctx.fillRect(-400, -250, W + 800, H + 500);
    }
    if (state.timeScale < 0.8) {
      const k = (1 - state.timeScale) * 0.5;
      const c = ctx.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 760);
      c.addColorStop(0, rgba(PALETTE.cyan, 0));
      c.addColorStop(1, rgba(PALETTE.cyan, 0.4 * k));
      ctx.fillStyle = c;
      ctx.fillRect(-400, -250, W + 800, H + 500);
    }
  }

  /**
   * Cheap bloom: shrink the frame so far, blur it while stretching it back and add it on top,
   * so every bright neon edge picks up a soft halo.
   */
  function bloom(strength) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    bloomCtx.globalCompositeOperation = 'copy';
    bloomCtx.drawImage(canvas, 0, 0, bloomCanvas.width, bloomCanvas.height);
    if ('filter' in ctx) ctx.filter = `blur(${Math.max(2, canvas.width / 220)}px)`;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = strength;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bloomCanvas, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function frame() {
    ctx.strokeStyle = rgba(PALETTE.cyan, 0.14);
    ctx.lineWidth = 1.5;
    const m = 8;
    const l = 26;
    ctx.beginPath();
    for (const [x, y, dx, dy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
      ctx.moveTo(x + dx * l, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dy * l);
    }
    ctx.stroke();
  }

  /**
   * Paint one frame. view = { screen, time, best, overTime, muted }; the title, pause and over
   * screens draw over the world, whose state is whatever the world holds.
   */
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
      bloom(0.2);
    } else {
      ctx.save();
      ctx.translate(state.shakeX, state.shakeY);
      drawWorld(state, view.time);
      ctx.restore();
      vignette(state, view);
      bloom(0.22);
      if (state.alive && view.screen !== SCREEN_OVER) drawReticle(ctx, state.player, view.time);
      if (view.screen === SCREEN_OVER) {
        drawGameOver(ctx, state, view);
      } else {
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
