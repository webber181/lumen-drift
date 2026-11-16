// Deterministic screenshot scenes for ?shot=start|play|end.
import { PALETTE, PICKUP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function place(world, kind, x, y, opts = {}) {
  const e = world.stage.spawnEnemy(kind, x, y);
  const p = world.state.player;
  if (kind === 'triangle' || kind === 'shardling') e.rot = Math.atan2(p.y - y, p.x - x) + (opts.turn ?? 0);
  else if (kind === 'sniper' && opts.aimAngle !== undefined) e.rot = opts.aimAngle;
  else e.rot = opts.rot ?? 0.4;
  if (opts.hpFraction) e.hp = Math.max(1, Math.round(e.maxHp * opts.hpFraction));
  if (opts.flash) e.flash = opts.flash;
  if (opts.aimCharge !== undefined) e.aimCharge = opts.aimCharge;
  if (opts.aimAngle !== undefined) e.aimAngle = opts.aimAngle;
  if (opts.bossCharge !== undefined) e.bossCharge = opts.bossCharge;
  if (opts.attackMode) e.attackMode = opts.attackMode;
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
  const teal = PALETTE.teal || '#2cf5c8';

  world.stage.prepareWave(5);
  s.events.length = 0;
  s.phase = 'spawn';
  if (s.eliteWarning) s.eliteWarning.active = false;
  s.banner.t = s.banner.dur;
  s.queue.length = 2;
  s.waveTotal = 16;
  s.waveKilled = 9;
  s.score = 32450;
  s.scoreShown = s.score;
  s.lastScore = s.score;
  s.hull = 2;
  s.shield = 100;
  s.shieldReady = true;
  s.combo = 14;
  s.comboTimer = 3.1;
  s.maxCombo = 14;
  s.kills = 48;
  s.cores = 43;
  s.pickupsCollected = 3;
  s.spreadTimer = 6.4;
  s.maxSpreadTimer = PICKUP.spreadSeconds;

  const p = s.player;
  p.x = 446;
  p.y = 448;
  p.aimX = 875;
  p.aimY = 252;
  p.angle = Math.atan2(p.aimY - p.y, p.aimX - p.x);
  p.thrust = 0.88;
  p.vx = 155;
  p.vy = -85;
  p.flare = 0.85;
  p.bank = 0.48;
  p.recoil = 0.34;
  p.muzzle = 0.72;

  place(world, 'elite', 924, 268, { rot: 0.55, hpFraction: 0.68, bossCharge: 0.52, attackMode: 'nova' });
  place(world, 'splitter', 688, 492, { rot: 0.4, hpFraction: 0.67 });
  place(world, 'shardling', 748, 442, { turn: -0.1 });
  place(world, 'shardling', 770, 526, { turn: 0.15 });
  place(world, 'orbiter', 344, 296, { rot: 0.9 });
  const sniperAngle = Math.atan2(p.y - 492, p.x - 1094);
  place(world, 'sniper', 1094, 492, { aimCharge: 0.72, aimAngle: sniperAngle });
  place(world, 'triangle', 624, 340, { turn: 0.08 });
  place(world, 'triangle', 228, 548, { turn: -0.15 });
  place(world, 'square', 570, 224, { rot: 0.85, flash: 0.06 });

  s.particles.length = 0;

  world.stage.spawnPickup('spread', 526, 488);
  world.stage.spawnPickup('shield', 296, 476);

  const fan = [-0.24, -0.12, 0, 0.12, 0.24];
  for (let w = 0; w < 3; w += 1) {
    const dist = 52 + w * 76;
    fan.forEach((off, idx) => {
      const a = p.angle + off;
      s.bullets.push({
        x: p.x + Math.cos(a) * dist, y: p.y + Math.sin(a) * dist,
        vx: Math.cos(a) * 800, vy: Math.sin(a) * 800, life: 0.7, radius: 4, damage: 1,
        powered: true, color: idx % 2 ? teal : PALETTE.amber,
      });
    });
  }

  s.enemyBullets.push(
    { x: 786, y: 312, vx: -180, vy: 82, life: 4, radius: 6, color: PALETTE.magenta, nearState: 0, fast: false },
    { x: 818, y: 356, vx: -165, vy: 112, life: 4, radius: 6, color: PALETTE.magenta, nearState: 0, fast: false },
    { x: 868, y: 472, vx: -460, vy: -22, life: 2, radius: 4, color: PALETTE.red, nearState: 0, fast: true },
  );

  scatterCores(world, [
    [414, 386, 1], [592, 524, 2], [588, 396, 3.2], [356, 398, 0.6], [642, 434, 4.1],
    [488, 316, 2.5], [712, 392, 1.4], [274, 368, 4.8], [806, 344, 0.4],
  ]);

  fx.explosion(s, rng, 728, 312, teal, 22);
  if (fx.shockwave) fx.shockwave(s, 728, 312, teal, 96, 0.7);
  fx.update(s, 0.18);
  fx.explosion(s, rng, 396, 610, PALETTE.orange, 19);
  fx.update(s, 0.08);
  fx.impact(s, rng, 676, 340, PALETTE.magenta);
  fx.impact(s, rng, 872, 286, PALETTE.magenta);
  fx.popup(s, '+520', 732, 282, PALETTE.white, 16);
  fx.popup(s, 'OVERDRIVE!', p.x - 6, p.y - 74, PALETTE.amber, 19);
  fx.popup(s, '+440', 400, 580, PALETTE.white, 16);
  for (let i = 1; i <= 7; i += 1) {
    const back = p.angle + Math.PI;
    fx.glow(s, p.x + Math.cos(back) * (12 + i * 7), p.y + Math.sin(back) * (12 + i * 7), i % 2 ? PALETTE.cyan : PALETTE.violet, 13 - i, 0.3, 0.4, -0.4);
  }
  return { screen: SCREEN_PLAY, time: 3.3, best: 54800, overTime: 0, muted: false };
}

function stageEnd(world) {
  world.reset();
  const s = world.state;
  const fx = world.fx;
  const rng = world.stage.rng();
  world.stage.prepareWave(8);
  s.events.length = 0;
  s.banner.t = s.banner.dur;
  s.phase = 'spawn';
  if (s.eliteWarning) s.eliteWarning.active = false;
  s.queue.length = 0;
  s.alive = false;
  s.hull = 0;
  s.score = 64850;
  s.scoreShown = s.score;
  s.lastScore = s.score;
  s.kills = 118;
  s.cores = 104;
  s.pickupsCollected = 7;
  s.maxCombo = 27;
  s.newBest = true;
  s.player.x = 216;
  s.player.y = 434;

  place(world, 'splitter', 132, 290, { rot: 0.4 });
  place(world, 'shardling', 248, 224, { turn: 0.2 });
  place(world, 'orbiter', 1092, 298, { rot: 1.1 });
  place(world, 'sniper', 1142, 492, { aimCharge: 0.55, aimAngle: Math.atan2(434 - 492, 216 - 1142) });
  place(world, 'elite', 1116, 178, { rot: 0.6, hpFraction: 0.42, attackMode: 'spiral' });
  place(world, 'square', 132, 578, { rot: 0.6 });
  place(world, 'pentagon', 1024, 608, { rot: 0.3 });
  place(world, 'triangle', 158, 168, { turn: -0.1 });
  place(world, 'triangle', 1060, 626, { turn: 0.4 });

  s.particles.length = 0;
  scatterCores(world, [[292, 496, 1], [156, 356, 2], [250, 568, 3], [140, 470, 0.4], [1034, 412, 2]]);

  fx.explosion(s, rng, 216, 434, PALETTE.cyan, 44);
  if (fx.shockwave) fx.shockwave(s, 216, 434, PALETTE.cyan, 280, 1.0);
  fx.ring(s, 216, 434, PALETTE.magenta, 230, 1.1);
  fx.update(s, 0.22);
  fx.explosion(s, rng, 240, 408, PALETTE.amber, 24);
  fx.update(s, 0.08);
  return { screen: SCREEN_OVER, time: 4.2, best: 64850, overTime: 2.5, muted: false };
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
