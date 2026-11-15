// The screenshot scenes behind ?shot=start|play|end. Each one builds one fixed, rich scene by
// placing things by hand in the real world state (no loop, no timing), so the same seed always
// paints the same frame. stageShot returns the view the renderer should use.
import { PALETTE } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function place(world, kind, x, y, opts = {}) {
  const e = world.stage.spawnEnemy(kind, x, y);
  const p = world.state.player;
  e.rot = kind === 'triangle' ? Math.atan2(p.y - y, p.x - x) + (opts.turn ?? 0) : opts.rot ?? 0.4;
  if (opts.hpFraction) e.hp = Math.max(1, Math.round(e.maxHp * opts.hpFraction));
  if (opts.flash) e.flash = opts.flash;
  e.vx = 0;
  e.vy = 0;
  e.age = 5;
  return e;
}

function scatterCores(world, list) {
  for (const [x, y, age] of list) {
    world.state.coreList.push({ x, y, vx: 0, vy: 0, age, phase: x * 0.013 + y * 0.007, spin: 1.6 });
  }
}

function stagePlay(world) {
  world.reset();
  const s = world.state;
  const fx = world.fx;
  const rng = world.stage.rng();
  world.stage.prepareWave(4);
  s.events.length = 0;
  s.phase = 'spawn';
  s.banner.t = s.banner.dur;
  s.queue.length = 2;
  s.waveTotal = 12;
  s.waveKilled = 6;
  s.score = 18450;
  s.scoreShown = s.score;
  s.lastScore = s.score;
  s.hull = 2;
  s.shield = 100;
  s.shieldReady = true;
  s.combo = 11;
  s.comboTimer = 2.7;
  s.maxCombo = 11;
  s.kills = 31;
  s.cores = 34;

  const p = s.player;
  p.x = 520;
  p.y = 438;
  p.aimX = 880;
  p.aimY = 236;
  p.angle = Math.atan2(p.aimY - p.y, p.aimX - p.x);
  p.thrust = 0.8;
  p.vx = 120;
  p.vy = -60;
  p.flare = 0.7;

  place(world, 'triangle', 704, 352, { turn: 0.1 });
  place(world, 'triangle', 330, 300, { turn: -0.2 });
  place(world, 'triangle', 420, 584, { turn: 0.15 });
  place(world, 'triangle', 796, 560, { turn: -0.1 });
  place(world, 'triangle', 972, 430, { turn: 0.2 });
  place(world, 'square', 238, 478, { rot: 0.5, hpFraction: 0.67 });
  place(world, 'square', 900, 190, { rot: 1.1, flash: 0.06 });
  place(world, 'pentagon', 624, 190, { rot: 0.2 });
  place(world, 'pentagon', 1040, 318, { rot: 0.9 });
  place(world, 'pentagon', 668, 520, { rot: 1.7, hpFraction: 0.5 });

  s.particles.length = 0; // drop the spawn telegraph rings made by placing drones

  // Twin shots in flight along the aim line.
  const c = Math.cos(p.angle);
  const sn = Math.sin(p.angle);
  for (let i = 0; i < 4; i += 1) {
    for (const lateral of [-7, 7]) {
      const d = 40 + i * 62;
      s.bullets.push({
        x: p.x + c * d - sn * lateral, y: p.y + sn * d + c * lateral,
        vx: c * 800, vy: sn * 800, life: 0.7, radius: 4, damage: 1,
      });
    }
  }

  scatterCores(world, [
    [455, 392, 1], [575, 500, 2], [610, 392, 3.5], [380, 468, 0.5], [660, 440, 4.5],
    [498, 330, 2.5], [742, 436, 1.5], [300, 372, 5], [575, 285, 0.2],
  ]);

  // Two explosions at different ages, plus popups.
  fx.explosion(s, rng, 782, 288, PALETTE.magenta, 14);
  fx.update(s, 0.2);
  fx.explosion(s, rng, 352, 556, PALETTE.orange, 21);
  fx.update(s, 0.08);
  fx.impact(s, rng, 706, 326, PALETTE.magenta);
  fx.impact(s, rng, 903, 214, PALETTE.orange);
  fx.popup(s, '+300', 786, 262, PALETTE.white, 16);
  fx.popup(s, 'COMBO x3', p.x - 8, p.y - 78, PALETTE.amber, 20);
  fx.popup(s, '+660', 354, 528, PALETTE.white, 16);
  for (let i = 1; i <= 7; i += 1) {
    const back = p.angle + Math.PI;
    fx.glow(s, p.x + Math.cos(back) * (12 + i * 7), p.y + Math.sin(back) * (12 + i * 7), i % 2 ? PALETTE.cyan : PALETTE.violet, 13 - i, 0.3, 0.4, -0.4);
  }
  return { screen: SCREEN_PLAY, time: 3.3, best: 41200, overTime: 0, muted: false };
}

function stageEnd(world) {
  world.reset();
  const s = world.state;
  const fx = world.fx;
  const rng = world.stage.rng();
  world.stage.prepareWave(7);
  s.events.length = 0;
  s.banner.t = s.banner.dur;
  s.phase = 'spawn';
  s.queue.length = 0;
  s.alive = false;
  s.hull = 0;
  s.score = 48720;
  s.scoreShown = s.score;
  s.lastScore = s.score;
  s.kills = 96;
  s.cores = 88;
  s.maxCombo = 23;
  s.newBest = true;
  s.player.x = 250;
  s.player.y = 440;

  place(world, 'triangle', 440, 330, { turn: 0.2 });
  place(world, 'triangle', 120, 250, { turn: -0.3 });
  place(world, 'square', 130, 590, { rot: 0.6 });
  place(world, 'pentagon', 520, 560, { rot: 1.4 });
  place(world, 'pentagon', 1060, 290, { rot: 0.3 });
  place(world, 'square', 1100, 540, { rot: 1.0 });
  place(world, 'triangle', 930, 640, { turn: 0.4 });
  place(world, 'triangle', 380, 120, { turn: -0.1 });
  s.particles.length = 0;
  scatterCores(world, [[330, 500, 1], [190, 350, 2], [410, 430, 3], [300, 580, 4], [150, 480, 0.4], [1000, 420, 2]]);

  fx.explosion(s, rng, 250, 440, PALETTE.cyan, 44);
  fx.ring(s, 250, 440, PALETTE.magenta, 220, 1.1);
  fx.update(s, 0.32);
  return { screen: SCREEN_OVER, time: 4.2, best: 48720, overTime: 6, muted: false };
}

function stageStart(world) {
  world.reset();
  return { screen: SCREEN_TITLE, time: 2.35, best: 0, overTime: 0, muted: false };
}

export function stageShot(name, world) {
  if (name === 'play') return stagePlay(world);
  if (name === 'end') return stageEnd(world);
  return stageStart(world);
}

