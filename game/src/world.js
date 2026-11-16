// Fixed-step game simulation: ship physics, waves, enemies, pickups, combat, and FX.
import {
  COMBO, CORE, DRAG_STEER, ELITE, ENEMY, H, HOSTILE_SHOT, PALETTE, PICKUP, PLAYER, SLOWMO, SPAWN, W, WAVE, WEAPON,
  activeCap, comboMultiplier, eliteHealth, isEliteWave, pentagonShare, spawnInterval, speedMultiplier, squareShare,
  waveBonus, waveCount, weaponLevel,
} from './config.js';
import { createRandom, range, sign } from './random.js';
import * as fx from './particles.js';

const { abs, atan2, cos, exp, floor, hypot, max, min, round, sin, sqrt } = Math;
const TAU = Math.PI * 2;
const C = PALETTE;
const PL = PLAYER;
const WP = WEAPON;
const EL = ELITE;
const PK = PICKUP;
const SQ_GUN = HOSTILE_SHOT.square;
const SN_GUN = HOSTILE_SHOT.sniper;
const WEAPON_DIRS = [[[0, 0]], [[-7, 0], [7, 0]], [[0, 0], [-9, -0.13], [9, 0.13]]];
const SPREAD_DIRS = [[0, 0], [-7, -0.14], [7, 0.14], [-13, -0.29], [13, 0.29]];
const CONFETTI = [C.amber, C.cyan, C.magenta, C.teal, '#ffffff'];
const PICKUP_COL = { hull: C.emerald, shield: C.cyan, spread: C.amber };
const DOCTRINES = ['CROSSFIRE GRID', 'PRISM FRACTURE', 'ORBITAL FLANK', 'APEX ASSAULT'];
const DOCTRINE_MIX = {
  'CROSSFIRE GRID': [['sniper', 0.22], ['square', 0.47], ['pentagon', 0.65], ['splitter', 0.77]],
  'PRISM FRACTURE': [['splitter', 0.30], ['orbiter', 0.48], ['sniper', 0.60], ['pentagon', 0.75]],
  'ORBITAL FLANK': [['orbiter', 0.34], ['pentagon', 0.58], ['sniper', 0.72], ['square', 0.84]],
  'ELITE SIEGE': [['orbiter', 0.20], ['splitter', 0.38], ['sniper', 0.54], ['square', 0.72], ['pentagon', 0.86]],
  'APEX ASSAULT': [['splitter', 0.20], ['sniper', 0.40], ['orbiter', 0.62], ['square', 0.80], ['pentagon', 0.92]],
};

function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function swapPop(list, i) {
  const last = list.pop();
  if (i < list.length) list[i] = last;
}

function waveDoctrine(wave) {
  if (isEliteWave(wave)) return 'ELITE SIEGE';
  if (wave <= 4) return ['RECON SWARM', 'INTERCEPTORS', 'PRISM FRACTURE', 'ORBITAL FLANK'][wave - 1];
  return DOCTRINES[(wave - 6 - floor((wave - 6) / 5)) % DOCTRINES.length];
}

function rollWaveEnemy(rng, wave, tag) {
  const r = rng();
  if (wave <= 5) {
    if (wave === 1) return 'triangle';
    if (wave === 2) return r < squareShare(wave) ? 'square' : 'triangle';
    let acc = wave >= 4 ? 0.18 : 0;
    if (r < acc) return 'orbiter';
    acc += wave >= 3 ? 0.16 : 0;
    if (r < acc) return 'splitter';
    acc += pentagonShare(wave);
    if (r < acc) return 'pentagon';
    return r < acc + squareShare(wave) ? 'square' : 'triangle';
  }
  const mix = DOCTRINE_MIX[tag] || DOCTRINE_MIX['APEX ASSAULT'];
  for (let i = 0; i < mix.length; i += 1) if (r < mix[i][1]) return mix[i][0];
  return 'triangle';
}

function buildQueue(rng, wave, tag) {
  const q = []; const count = waveCount(wave);
  for (let i = 0; i < count; i += 1) q.push(rollWaveEnemy(rng, wave, tag));
  if (isEliteWave(wave)) { q.length = floor(count * WAVE.eliteEscortShare); q.unshift('elite'); }
  return q;
}

function stepBullets(list, dt) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const b = list[i]; b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.life <= 0 || b.x < -60 || b.x > W + 60 || b.y < -60 || b.y > H + 60) swapPop(list, i);
  }
}

function fireHostile(s, e, angle, speed, radius, fast = false) {
  s.enemyBullets.push({
    x: e.x + cos(angle) * e.radius, y: e.y + sin(angle) * e.radius,
    vx: cos(angle) * speed, vy: sin(angle) * speed, life: 6, radius, color: e.color, nearState: 0, fast,
  });
}

function steerEnemy(s, e, dt, dx, dy, dist, speedMul) {
  let heading = atan2(e.vy, e.vx); let speed = hypot(e.vx, e.vy);
  if (s.alive) {
    let want = atan2(dy, dx); let target = e.speed * speedMul;
    if (e.kind === 'pentagon') want += e.orbit * clamp((dist - 90) / 420, 0, 1) * 1.2;
    else if (e.kind === 'triangle') {
      want += sin(e.age * 3 + e.phase) * 0.24 * (dist > 220 ? 1 : 0);
      const l = max(0, sin(e.age * 2.1 + e.phase)); target *= 1 + 0.55 * l * l;
    } else if (e.kind === 'shardling') want += sin(e.age * 5 + e.phase) * 0.34 * (dist > 140 ? 1 : 0);
    else if (e.kind === 'splitter') want += sin(e.age * 1.8 + e.phase) * 0.2;
    else if (e.kind === 'orbiter') want += e.orbit * clamp(1.38 - (dist - max(52, 270 - e.age * 26)) * 0.004, 0.72, 1.68);
    else if (e.kind === 'sniper') {
      if (e.aimCharge > 0) { want += e.orbit * 1.5; target *= 0.25; }
      else if (dist < SN_GUN.minRange) want = (e.x < 64 || e.x > W - 64 || e.y < 64 || e.y > H - 64) ? atan2(H * 0.5 - e.y, W * 0.5 - e.x) : want + Math.PI + e.orbit * 0.55;
      else if (dist <= SN_GUN.maxRange) { want += e.orbit * 1.52; target *= 0.62; }
      else want += e.orbit * 0.2;
    } else if (e.kind === 'elite' && e.bossCharge > 0) target *= 0.25;
    heading += clamp(angleDiff(want, heading), -e.turn * dt, e.turn * dt);
    speed += (target - speed) * min(1, dt * 2.4);
  } else speed *= exp(-0.6 * dt);
  e.vx = cos(heading) * speed; e.vy = sin(heading) * speed;
  if (e.kind === 'triangle' || e.kind === 'shardling') e.rot = heading;
  else if (e.kind !== 'sniper') e.rot += e.spin * dt;
}

function separateEnemies(list, i, e, dt) {
  for (let j = 0; j < list.length; j += 1) {
    if (j === i || list[j].dead) continue;
    const o = list[j]; const ox = e.x - o.x; const oy = e.y - o.y; const mn = e.radius + o.radius; const d2 = ox * ox + oy * oy;
    if (d2 > 0.01 && d2 < mn * mn) {
      const d = sqrt(d2); const shift = (mn - d) * (o.kind === 'elite' ? 1 : e.kind === 'elite' ? 0 : 0.5) * min(1, dt * 6);
      e.x += (ox / d) * shift; e.y += (oy / d) * shift;
    }
  }
}

function nearMissCheck(s, entity, gap) {
  if (entity.nearState === 0 && gap < 22) entity.nearState = 1;
  else if (entity.nearState === 1 && gap > 34) {
    entity.nearState = 2;
    if (s.slowCooldown <= 0 && s.player.invulnerable <= 0 && s.alive) {
      s.slow = max(s.slow, SLOWMO.nearMiss); s.slowCooldown = SLOWMO.cooldown;
      s.score += 50 * comboMultiplier(s.combo);
      fx.popup(s, 'CLOSE CALL', s.player.x, s.player.y + 56, C.cyan, 16, 1.1); s.events.push({ type: 'nearMiss', value: 0 });
    }
  }
}

function updateTelemetry(s, rng, dtReal) {
  if (s.score > s.lastScore) s.scorePulse = 1;
  s.lastScore = s.score; s.scoreShown += (s.score - s.scoreShown) * min(1, dtReal * 9);
  if (abs(s.score - s.scoreShown) < 1) s.scoreShown = s.score;
  s.scorePulse = max(0, s.scorePulse - dtReal * 4); s.tierFlash = max(0, s.tierFlash - dtReal * 3);
  s.hitFlash = max(0, s.hitFlash - dtReal * 2.4); s.shake *= exp(-7 * dtReal);
  if (s.shake < 0.01) s.shake = 0;
  const amp = s.shake * 11; s.shakeX = (rng() - 0.5) * 2 * amp; s.shakeY = (rng() - 0.5) * 2 * amp;
}

function freshState() {
  return {
    time: 0, tick: 0, alive: true, score: 0, wave: 1, hull: PL.hull,
    shield: 0, shieldReady: false, combo: 0, comboTimer: 0, maxCombo: 0, kills: 0, cores: 0,
    player: {
      x: W / 2, y: H * 0.72, vx: 0, vy: 0, angle: -Math.PI / 2, aimX: W / 2, aimY: 0,
      fireCooldown: 0, invulnerable: 0, flare: 0, shieldFlash: 0, thrust: 0, bank: 0, recoil: 0, muzzle: 0,
    },
    bullets: [], enemyBullets: [], enemies: [], coreList: [], pickups: [], particles: [],
    spreadTimer: 0, maxSpreadTimer: PK.spreadSeconds, pickupsCollected: 0,
    hitStop: 0, hitStopFlash: 0, deathTimer: 0, waveTag: 'RECON SWARM',
    eliteWarning: { active: false, x: 0, y: 0, t: 0, dur: WAVE.eliteIntroSeconds, name: '', color: C.magenta },
    shake: 0, shakeX: 0, shakeY: 0, hitFlash: 0, timeScale: 1, slow: 0, slowCooldown: 0,
    phase: 'intro', phaseTimer: 1.8, queue: [], spawnTimer: 0, waveTotal: 0, waveKilled: 0,
    banner: { text: '', sub: '', t: 0, dur: 2, color: C.cyan },
    events: [], autoFire: true, nextId: 1, newBest: false,
    scoreShown: 0, scorePulse: 0, lastScore: 0, tierFlash: 0,
  };
}

export function createWorld(seed) {
  let rng = createRandom(seed);
  let state = freshState();
  const emit = (type, value = 0) => state.events.push({ type, value });

  function spawnPoint(minDist) {
    const p = state.player; const m = SPAWN.edgeMargin;
    const edgePt = (e) => {
      const a = range(rng, m, (e % 2 === 0 ? W : H) - m);
      return [{ x: a, y: -m }, { x: W + m, y: a }, { x: a, y: H + m }, { x: -m, y: a }][e];
    };
    let pt = edgePt(floor(rng() * 4));
    for (let t = 1; t < SPAWN.retries && hypot(pt.x - p.x, pt.y - p.y) < minDist; t += 1) pt = edgePt(floor(rng() * 4));
    return pt;
  }

  function prepareWave(wave) {
    const s = state; const tag = waveDoctrine(wave);
    s.wave = wave; s.waveTag = tag; s.queue = buildQueue(rng, wave, tag);
    s.waveTotal = s.queue.length; s.waveKilled = 0; s.phase = 'intro'; s.spawnTimer = 0;
    if (isEliteWave(wave)) {
      const v = EL.variants[max(0, floor(wave / 5) - 1) % EL.variants.length];
      const pt = spawnPoint(SPAWN.eliteMinDistance); const color = C[v.color];
      s.phaseTimer = WAVE.eliteIntroSeconds;
      s.eliteWarning = { active: true, x: pt.x, y: pt.y, t: 0, dur: WAVE.eliteIntroSeconds, name: v.name, color };
      s.banner = { text: `WAVE ${wave}`, sub: `${v.name} INBOUND  -  ${tag}`, t: 0, dur: 2.6, color };
      emit('elite', wave); emit('eliteWarn', wave);
    } else {
      s.phaseTimer = WAVE.introSeconds;
      s.eliteWarning = { active: false, x: 0, y: 0, t: 0, dur: WAVE.eliteIntroSeconds, name: '', color: C.magenta };
      s.banner = { text: `WAVE ${wave}`, sub: wave === 1 ? 'DESTROY THE DRONES  -  COLLECT THE CORES' : tag, t: 0, dur: 1.9, color: C.cyan };
      emit('waveStart', wave);
    }
  }

  function spawnEnemy(kind, x, y) {
    const s = state; const wave = s.wave; const elite = kind === 'elite';
    const v = elite ? EL.variants[max(0, floor(wave / 5) - 1) % EL.variants.length] : null;
    const def = elite ? null : ENEMY[kind];
    const hp = elite ? eliteHealth(wave) : def.hp;
    const h = atan2(s.player.y - y, s.player.x - x);
    const baseSpeed = elite ? EL.speed : def.speed; const sp = baseSpeed * speedMultiplier(wave);
    const spin = elite ? 0.5 : kind === 'square' ? range(rng, 0.5, 1.2) * sign(rng)
      : kind === 'pentagon' ? range(rng, 1.4, 2.2) * sign(rng)
      : kind === 'splitter' ? range(rng, 0.7, 1.3) * sign(rng) : kind === 'orbiter' ? 3.8 * sign(rng) : 0;
    const fireTimer = elite ? 1.6 : kind === 'square' ? range(rng, ...SQ_GUN.firstDelay) : kind === 'sniper' ? range(rng, 1.1, 1.9) : 0;
    const e = {
      id: s.nextId++, kind, x, y, vx: cos(h) * sp * 0.6, vy: sin(h) * sp * 0.6,
      rot: h, spin, hp, maxHp: hp, radius: elite ? EL.radius : def.radius,
      sides: elite ? v.sides : def.sides, color: C[elite ? v.color : def.color],
      name: elite ? v.name : kind, speed: baseSpeed, turn: elite ? EL.turn : def.turn,
      score: elite ? EL.score + wave * 100 : def.score, dropCores: elite ? EL.cores : def.cores,
      flash: 0, age: 0, phase: rng() * TAU, orbit: sign(rng), fireTimer, summons: 0, nearState: 0, dead: false,
      aimCharge: 0, aimAngle: 0, bossCharge: 0, attackMode: 'fan', attackCount: 0, lungeTime: 0,
    };
    s.enemies.push(e);
    if (elite) s.eliteWarning.active = false;
    const rx = clamp(x, 14, W - 14); const ry = clamp(y, 14, H - 14);
    fx.ring(s, rx, ry, e.color, e.radius * 1.8, 0.4); fx.glow(s, rx, ry, e.color, e.radius * 1.4, 0.3, 0.4, 0.4);
    return e;
  }

  function spawnPickup(kind, x, y) {
    const a = rng() * TAU;
    const pk = {
      id: state.nextId++, kind, x: clamp(x, 28, W - 28), y: clamp(y, 28, H - 28),
      vx: cos(a) * 18, vy: sin(a) * 18, age: 0, life: PK.life, radius: PK.radius, phase: rng() * TAU,
    };
    state.pickups.push(pk);
    return pk;
  }

  function clearWave() {
    const s = state; const bonus = waveBonus(s.wave);
    s.score += bonus; s.phase = 'clear'; s.phaseTimer = WAVE.clearSeconds;
    s.banner = { text: `WAVE ${s.wave} CLEAR`, sub: `BONUS +${bonus.toLocaleString('en-US')}`, t: 0, dur: 2.4, color: C.amber };
    emit('waveClear', s.wave);
    const { x, y } = s.player;
    fx.shockwave(s, x, y, C.amber, 420, 1.0); fx.ring(s, x, y, C.cyan, 300, 0.8); fx.glow(s, x, y, C.amber, 160, 0.5, 0.6, 1.2);
    for (let i = 0; i < 46; i += 1) fx.spark(s, rng, x, y, CONFETTI[i % CONFETTI.length], 520, 1.1, 2.2);
  }

  function updateWave(dt) {
    const s = state; s.banner.t += dt;
    if (s.phase === 'intro') {
      if (s.eliteWarning.active) s.eliteWarning.t += dt;
      if ((s.phaseTimer -= dt) <= 0) {
        s.phase = 'spawn';
        if (s.eliteWarning.active) {
          const { x, y } = s.eliteWarning; s.eliteWarning.active = false;
          if (s.queue[0] === 'elite') {
            s.queue.shift(); spawnEnemy('elite', x, y);
            s.spawnTimer = spawnInterval(s.wave) * range(rng, ...SPAWN.jitter) + SPAWN.eliteDelay;
          }
        }
      }
    } else if (s.phase === 'spawn') {
      if ((s.spawnTimer -= dt) <= 0 && s.queue.length > 0 && s.enemies.length < activeCap(s.wave)) {
        const kind = s.queue.shift(); const pt = spawnPoint(kind === 'elite' ? SPAWN.eliteMinDistance : SPAWN.minDistance);
        spawnEnemy(kind, pt.x, pt.y);
        s.spawnTimer = spawnInterval(s.wave) * range(rng, ...SPAWN.jitter) + (kind === 'elite' ? SPAWN.eliteDelay : 0);
      }
      if (s.queue.length === 0 && s.enemies.length === 0 && s.alive) clearWave();
    } else if (s.phase === 'clear' && (s.phaseTimer -= dt) <= 0) prepareWave(s.wave + 1);
  }

  function fireWeapon(rapid) {
    const s = state; const p = s.player; const spread = s.spreadTimer > 0;
    const dirs = spread ? SPREAD_DIRS : WEAPON_DIRS[weaponLevel(s.wave) - 1];
    const c = cos(p.angle); const sn = sin(p.angle);
    for (let i = 0; i < dirs.length; i += 1) {
      const a = p.angle + dirs[i][1] + (rng() - 0.5) * 0.02; const lat = dirs[i][0];
      s.bullets.push({
        x: p.x + c * 18 - sn * lat, y: p.y + sn * 18 + c * lat,
        vx: cos(a) * WP.speed + p.vx * 0.25, vy: sin(a) * WP.speed + p.vy * 0.25,
        life: WP.life, radius: spread ? WP.radius + 1 : WP.radius, damage: WP.damage,
        color: spread ? (i % 2 === 0 ? C.amber : C.teal) : C.cyan, powered: spread,
      });
    }
    p.flare = 1; p.muzzle = 1; p.recoil = 1;
    fx.glow(s, p.x + c * 20, p.y + sn * 20, spread ? C.amber : C.cyan, spread ? 22 : 16, 0.08, 0.9);
    fx.sparkDir(s, rng, p.x + c * 20, p.y + sn * 20, p.angle, spread ? 1 : 0.7, spread ? C.amber : C.ice, 220, 0.18, 1.3);
    emit(rapid ? 'laserRapid' : 'laser');
  }

  function updatePlayer(dt, input) {
    const p = state.player; let mx = input.moveX; let my = input.moveY;
    if (mx === 0 && my === 0 && input.dragging) {
      const dx = input.aimX - p.x; const dy = input.aimY - p.y; const d = hypot(dx, dy);
      if (d > DRAG_STEER.deadZone) { const k = min(1, (d - DRAG_STEER.deadZone) / DRAG_STEER.fullPull); mx = (dx / d) * k; my = (dy / d) * k; }
    }
    const len = hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    const curSp = hypot(p.vx, p.vy); let accel = PL.accel;
    if (curSp > 20 && (mx !== 0 || my !== 0)) {
      const dot = (mx * p.vx + my * p.vy) / curSp;
      if (dot < 0) accel *= 1 + (PL.counterThrust - 1) * (-dot);
    }
    p.vx += mx * accel * dt; p.vy += my * accel * dt;
    const f = exp(-PL.drag * dt); p.vx *= f; p.vy *= f;
    const sp = hypot(p.vx, p.vy);
    if (sp > PL.maxSpeed) { p.vx *= PL.maxSpeed / sp; p.vy *= PL.maxSpeed / sp; }
    p.x = clamp(p.x + p.vx * dt, PL.margin, W - PL.margin); if (p.x === PL.margin) p.vx = max(0, p.vx); if (p.x === W - PL.margin) p.vx = min(0, p.vx);
    p.y = clamp(p.y + p.vy * dt, PL.margin, H - PL.margin); if (p.y === PL.margin) p.vy = max(0, p.vy); if (p.y === H - PL.margin) p.vy = min(0, p.vy);
    p.thrust = clamp(hypot(mx, my) + sp / PL.maxSpeed * 0.4, 0, 1);

    p.aimX = input.aimX; p.aimY = input.aimY; const prev = p.angle;
    if (hypot(p.aimX - p.x, p.aimY - p.y) > 4) p.angle = atan2(p.aimY - p.y, p.aimX - p.x);
    const turnRate = angleDiff(p.angle, prev) / max(dt, 0.001);
    p.bank += (clamp((-sin(p.angle) * mx + cos(p.angle) * my) * 0.75 + clamp(turnRate / 8, -0.6, 0.6), -1, 1) - p.bank) * min(1, dt * 12);

    p.invulnerable = max(0, p.invulnerable - dt); p.flare = max(0, p.flare - dt * 12);
    p.muzzle = max(0, p.muzzle - dt * 16); p.recoil = max(0, p.recoil - dt * 10); p.shieldFlash = max(0, p.shieldFlash - dt * 2);
    if ((p.fireCooldown -= dt) <= 0 && (input.fire || state.autoFire)) {
      fireWeapon(input.fire); p.fireCooldown = input.fire ? WP.rapidCooldown : WP.autoCooldown;
    }
    if (p.thrust > 0.25 && rng() < 0.55 + p.thrust * 0.4) {
      const back = p.angle + Math.PI;
      fx.glow(state, p.x + cos(back) * 11, p.y + sin(back) * 11, rng() < 0.5 ? C.cyan : C.violet, 8 + p.thrust * 5, 0.3, 0.55, -0.5, cos(back) * 40 - p.vx * 0.1, sin(back) * 40 - p.vy * 0.1);
    }
  }

  function damagePlayer(fromX, fromY) {
    const s = state; const p = s.player; const away = atan2(p.y - fromY, p.x - fromX);
    if (s.shieldReady) {
      s.shieldReady = false; s.shield = 0; p.invulnerable = 1.1; p.shieldFlash = 1;
      s.hitStop = max(s.hitStop, 0.04); s.hitStopFlash = max(s.hitStopFlash, 0.6); s.shake = max(s.shake, 0.6);
      fx.shieldBurst(s, rng, p.x, p.y, C.cyan); p.vx += cos(away) * 260; p.vy += sin(away) * 260; emit('shieldBreak'); return;
    }
    s.hull -= 1; p.invulnerable = PL.invulnerable; p.vx += cos(away) * 300; p.vy += sin(away) * 300;
    if (s.combo > 0) fx.popup(s, 'COMBO LOST', p.x, p.y - 62, C.red, 14, 1.1);
    s.combo = 0; s.comboTimer = 0; s.shake = max(s.shake, 1); s.hitFlash = 1; s.slow = max(s.slow, SLOWMO.hit);
    fx.explosion(s, rng, p.x, p.y, C.red, 16); emit('hit');
    if (s.hull <= 0) {
      s.hull = 0; s.alive = false; s.deathTimer = 0; s.bullets.length = 0; s.enemyBullets.length = 0; s.shake = 2;
      fx.explosion(s, rng, p.x, p.y, C.cyan, 44); fx.shockwave(s, p.x, p.y, C.magenta, 220, 1.1); emit('gameOver');
    }
  }

  function killEnemy(e, rammed) {
    const s = state;
    if (e.dead) return;
    e.dead = true; s.kills += 1; s.waveKilled += 1;
    const gained = round((rammed ? e.score * 0.5 : e.score) * comboMultiplier(s.combo)); s.score += gained;
    fx.explosion(s, rng, e.x, e.y, e.color, e.radius);
    fx.popup(s, `+${gained.toLocaleString('en-US')}`, e.x, e.y - e.radius - 6, e.kind === 'elite' ? C.amber : C.white, e.kind === 'elite' ? 26 : 16);
    for (let i = 0; i < e.dropCores; i += 1) {
      const a = rng() * TAU; const v = range(rng, 50, e.kind === 'elite' ? 300 : 150);
      s.coreList.push({ x: e.x + cos(a) * 4, y: e.y + sin(a) * 4, vx: cos(a) * v, vy: sin(a) * v, age: 0, phase: rng() * TAU, spin: range(rng, 1, 2.4) * sign(rng) });
    }
    s.shake = max(s.shake, e.kind === 'elite' ? 1.8 : 0.12 + e.radius / 120); emit('explosion', e.radius);

    if (e.kind === 'splitter' && !rammed) {
      const perp = atan2(s.player.y - e.y, s.player.x - e.x) + Math.PI / 2;
      for (const side of [-1, 1]) {
        const d = spawnEnemy('shardling', e.x + cos(perp) * side * 14, e.y + sin(perp) * side * 14);
        d.vx = cos(perp) * side * 195 + e.vx * 0.3; d.vy = sin(perp) * side * 195 + e.vy * 0.3;
      }
      s.waveTotal += 2; fx.shockwave(s, e.x, e.y, C.teal, 56, 0.36); emit('split');
    }
    if (e.kind === 'elite') {
      if (s.hull < PL.hull && s.alive) { s.hull += 1; fx.popup(s, 'HULL +1', s.player.x, s.player.y - 62, C.cyan, 18, 1.4); emit('repair'); }
      s.hitStop = max(s.hitStop, 0.11); s.hitStopFlash = 1; s.slow = max(s.slow, 0.5);
      for (let i = 0; i < 3; i += 1) fx.shockwave(s, e.x, e.y, i === 0 ? '#ffffff' : e.color, 150 + i * 65, 0.65 + i * 0.18);
      for (let i = 0; i < 12; i += 1) fx.debris(s, rng, e.x, e.y, e.color, 260, 6 + rng() * 5, 3 + (i % 3));
      for (let i = 0; i < 16; i += 1) fx.ember(s, rng, e.x, e.y, i % 2 === 0 ? C.amber : e.color, 220, 0.95, 2.8);
      emit('eliteDown');
    }
    const ok = e.kind === 'elite' || ((e.kind === 'splitter' || e.kind === 'sniper' || (e.kind === 'square' && s.wave >= 4)) && s.pickups.length < 2);
    if (ok && rng() < (e.kind === 'elite' ? PK.eliteDropChance : PK.droneDropChance)) {
      const nh = s.hull < PL.hull; const ns = !s.shieldReady; const r = rng();
      const kind = nh && ns ? (r < 0.45 ? 'hull' : r < 0.75 ? 'shield' : 'spread')
        : nh ? (r < 0.55 ? 'hull' : r < 0.85 ? 'spread' : 'shield')
        : ns ? (r < 0.5 ? 'shield' : r < 0.9 ? 'spread' : 'hull') : (r < 0.72 ? 'spread' : r < 0.88 ? 'shield' : 'hull');
      spawnPickup(kind, e.x, e.y); fx.ring(s, e.x, e.y, PICKUP_COL[kind], 32, 0.45);
    }
  }

  function summonEscorts(e, count, kind) {
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * TAU + e.age;
      const d = spawnEnemy(kind, e.x + cos(a) * (e.radius + 14), e.y + sin(a) * (e.radius + 14));
      d.vx = cos(a) * 220; d.vy = sin(a) * 220; state.waveTotal += 1;
    }
    fx.shockwave(state, e.x, e.y, e.color, e.radius * 2.5, 0.5);
  }

  function fireEliteFan(e, bolts, spread, speedScale = 1) {
    const s = state; const base = atan2(s.player.y - e.y, s.player.x - e.x);
    for (let i = 0; i < bolts; i += 1) fireHostile(s, e, base + (i - (bolts - 1) / 2) * spread, EL.bulletSpeed * speedScale, HOSTILE_SHOT.elite.radius);
    fx.glow(s, e.x, e.y, e.color, e.radius * 1.6, 0.25, 0.8, 0.5); emit('enemyShot');
  }

  function fireEliteRing(e, count, offset, speedScale, nova) {
    const s = state;
    for (let i = 0; i < count; i += 1) fireHostile(s, e, offset + (i / count) * TAU, EL.bulletSpeed * speedScale, HOSTILE_SHOT.elite.radius);
    fx.glow(s, e.x, e.y, nova ? '#ffffff' : e.color, e.radius * (nova ? 2 : 1.6), 0.25, nova ? 0.9 : 0.8, 0.5);
    if (nova) fx.shockwave(s, e.x, e.y, e.color, e.radius * 2.8, 0.48);
    emit(nova ? 'bossNova' : 'enemyShot');
  }

  function updateElite(e, dt, dx, dy, speedMul) {
    const ratio = e.hp / e.maxHp; const escort = e.name === 'LEVIATHAN' ? 'orbiter' : 'triangle';
    if (e.summons === 0 && ratio < 0.66) { e.summons = 1; summonEscorts(e, 3, escort); emit('elite'); }
    if (e.summons === 1 && ratio < 0.33) { e.summons = 2; summonEscorts(e, 4, escort); emit('elite'); }
    if (e.name === 'BASTION' && e.lungeTime > 0) {
      e.lungeTime -= dt; if (rng() < 0.7) fx.glow(state, e.x, e.y, e.color, e.radius * 1.1, 0.22, 0.6, -0.3);
      if (e.lungeTime <= 0) { e.attackMode = 'spiral'; e.fireTimer = ratio < 0.5 ? 1.4 : 1.85; }
      return;
    }
    if (e.bossCharge > 0) {
      e.bossCharge += dt / (e.attackMode === 'lunge' ? 0.8 : e.name === 'LEVIATHAN' ? 0.85 : 0.95);
      if (e.bossCharge >= 1) {
        e.bossCharge = 0;
        if (e.attackMode === 'lunge') {
          const a = atan2(dy, dx) + e.orbit * 0.28; const sp = e.speed * speedMul * 2.9;
          e.vx = cos(a) * sp; e.vy = sin(a) * sp; e.lungeTime = 0.68;
          fx.shockwave(state, e.x, e.y, e.color, e.radius * 2.2, 0.42); emit('bossNova');
        } else { fireEliteRing(e, 12, e.rot, 1.04, true); e.attackMode = 'fan'; e.fireTimer = EL.fireInterval * (ratio < 0.5 ? 0.72 : 1); }
      }
      return;
    }
    if ((e.fireTimer -= dt) > 0) return;
    e.attackCount += 1;
    if (e.name === 'BASTION') {
      if (e.attackCount % 2 === 0) { e.attackMode = 'lunge'; e.bossCharge = 0.01; }
      else { e.attackMode = 'spiral'; fireEliteRing(e, ratio < 0.5 ? 8 : 6, e.rot + e.age * 1.2, 0.95, false); e.fireTimer = EL.fireInterval * (ratio < 0.5 ? 0.72 : 0.92); }
    } else if (e.name === 'LEVIATHAN') {
      const m = e.attackCount % 3;
      if (m === 0) { e.attackMode = 'nova'; e.bossCharge = 0.01; }
      else if (m === 1) { e.attackMode = 'fan'; fireEliteFan(e, 3, 0.11, 1.24); fireEliteFan(e, 2, 0.84, 0.96); e.fireTimer = ratio < 0.5 ? 1.5 : 1.95; }
      else { e.attackMode = 'spiral'; fireEliteRing(e, ratio < 0.5 ? 10 : 8, e.rot + e.age * 1.2, 0.95, false); e.fireTimer = ratio < 0.5 ? 1.5 : 1.95; }
    } else if (e.attackCount % 2 === 0) { e.attackMode = 'nova'; e.bossCharge = 0.01; }
    else { e.attackMode = 'fan'; fireEliteFan(e, ratio < 0.5 ? 5 : 3, HOSTILE_SHOT.elite.spread); e.fireTimer = EL.fireInterval * (ratio < 0.5 ? 0.72 : 1); }
  }

  function updateEnemies(dt) {
    const s = state; const p = s.player; const speedMul = speedMultiplier(s.wave); const list = s.enemies;
    for (let i = 0; i < list.length; i += 1) {
      const e = list[i]; e.age += dt; e.flash = max(0, e.flash - dt);
      const dx = p.x - e.x; const dy = p.y - e.y; const dist = hypot(dx, dy) || 1;
      const lunging = e.kind === 'elite' && e.lungeTime > 0;
      if (lunging) e.rot += e.spin * dt * 2.2; else steerEnemy(s, e, dt, dx, dy, dist, speedMul);
      separateEnemies(list, i, e, dt);
      e.x += e.vx * dt; e.y += e.vy * dt;
      if (lunging) { e.x = clamp(e.x, 30, W - 30); e.y = clamp(e.y, 30, H - 30); }
      if (e.kind === 'elite' && s.alive) updateElite(e, dt, dx, dy, speedMul);
      else if (e.kind === 'sniper') {
        if (s.alive && e.age > 0.75) {
          if (e.aimCharge > 0) {
            e.aimCharge += dt / SN_GUN.chargeTime;
            if (e.aimCharge < SN_GUN.lockPoint) e.aimAngle += clamp(angleDiff(atan2(dy, dx), e.aimAngle), -2.2 * dt, 2.2 * dt);
            e.rot = e.aimAngle;
            if (e.aimCharge >= 1) {
              fireHostile(s, e, e.aimAngle, SN_GUN.speed, SN_GUN.radius, true);
              fx.glow(s, e.x + cos(e.aimAngle) * e.radius, e.y + sin(e.aimAngle) * e.radius, e.color, 24, 0.22, 0.9, 0.5);
              emit('sniperShot'); e.aimCharge = 0;
              e.fireTimer = max(SN_GUN.minInterval, SN_GUN.baseInterval - s.wave * SN_GUN.perWave) * range(rng, 0.85, 1.15);
            }
          } else {
            e.rot = atan2(dy, dx);
            if (e.x > 24 && e.x < W - 24 && e.y > 24 && e.y < H - 24 && (e.fireTimer -= dt) <= 0) { e.aimCharge = 0.01; e.aimAngle = atan2(dy, dx); }
          }
        } else e.aimCharge = 0;
      } else if (e.kind === 'square' && s.alive && s.wave >= SQ_GUN.fromWave && e.age > 1 && (e.fireTimer -= dt) <= 0) {
        e.fireTimer = max(SQ_GUN.minInterval, SQ_GUN.baseInterval - s.wave * SQ_GUN.perWave) * range(rng, 0.8, 1.2);
        fireHostile(s, e, atan2(dy, dx), SQ_GUN.speed, SQ_GUN.radius);
        fx.glow(s, e.x, e.y, e.color, e.radius * 1.5, 0.2, 0.7, 0.4); emit('enemyShot');
      }
      if ((e.kind === 'triangle' || e.kind === 'shardling') && rng() < 0.35) {
        fx.glow(s, e.x - cos(e.rot) * e.radius * 0.8, e.y - sin(e.rot) * e.radius * 0.8, e.color, e.kind === 'shardling' ? 5 : 7, 0.22, 0.5, -0.4);
      }
    }
  }

  function updateCores(dt, magnetAll) {
    const s = state; const p = s.player; const f = exp(-2.8 * dt);
    for (let i = s.coreList.length - 1; i >= 0; i -= 1) {
      const c = s.coreList[i]; c.age += dt; c.vx *= f; c.vy *= f;
      const dx = p.x - c.x; const dy = p.y - c.y; const d = hypot(dx, dy) || 1;
      if (s.alive && (d < CORE.magnetRadius || magnetAll)) {
        const pull = magnetAll ? 900 : 620 * (1 - d / CORE.magnetRadius) + 160;
        c.vx += (dx / d) * pull * dt * 2.2; c.vy += (dy / d) * pull * dt * 2.2;
        if (rng() < 0.4) fx.glow(s, c.x, c.y, C.amber, 7, 0.25, 0.6, -0.5);
      }
      c.x = clamp(c.x + c.vx * dt, 10, W - 10); c.y = clamp(c.y + c.vy * dt, 10, H - 10);
      if (s.alive && d < CORE.collectRadius + PL.radius * 0.5) {
        s.combo += 1; s.maxCombo = max(s.maxCombo, s.combo); s.comboTimer = COMBO.window; s.cores += 1;
        const mult = comboMultiplier(s.combo); s.score += COMBO.coreScore * mult;
        if (!s.shieldReady && (s.shield = min(100, s.shield + COMBO.shieldPerCore)) >= 100) {
          s.shieldReady = true; fx.popup(s, 'SHIELD READY', p.x, p.y - 62, C.cyan, 16, 1.2); emit('shieldReady');
        }
        fx.pickupBurst(s, rng, c.x, c.y, C.amber);
        if (s.combo > 0 && s.combo % COMBO.perTier === 0) {
          fx.popup(s, `COMBO x${mult}`, p.x, p.y - 62, C.amber, 20, 1.1); fx.ring(s, p.x, p.y, C.amber, 110, 0.5); s.tierFlash = 1;
        }
        emit('pickup', s.combo); swapPop(s.coreList, i);
      } else if (c.age > CORE.life && !magnetAll) swapPop(s.coreList, i);
    }
  }

  function collectPickup(pk) {
    const s = state; const p = s.player; const mult = comboMultiplier(s.combo); const col = PICKUP_COL[pk.kind];
    s.pickupsCollected += 1;
    if (pk.kind === 'spread') { s.spreadTimer = PK.spreadSeconds; fx.popup(s, 'SPREAD OVERDRIVE', p.x, p.y - 64, col, 17, 1.3); }
    else if (pk.kind === 'hull') {
      if (s.hull < PL.hull) { s.hull += 1; fx.popup(s, 'HULL +1', p.x, p.y - 64, col, 18, 1.3); }
      else { const pts = 750 * mult; s.score += pts; fx.popup(s, `OVERCHARGE +${pts}`, p.x, p.y - 64, col, 17, 1.3); }
    } else if (pk.kind === 'shield') {
      if (!s.shieldReady) {
        s.shield = 100; s.shieldReady = true; p.invulnerable = max(p.invulnerable, 0.9); p.shieldFlash = 1;
        fx.popup(s, 'SHIELD CHARGED', p.x, p.y - 64, col, 17, 1.3);
      } else {
        const pts = 600 * mult; s.score += pts; p.invulnerable = max(p.invulnerable, 0.6);
        for (let i = s.enemyBullets.length - 1; i >= 0; i -= 1) {
          const eb = s.enemyBullets[i];
          if (hypot(eb.x - p.x, eb.y - p.y) < 170) { fx.impact(s, rng, eb.x, eb.y, col); swapPop(s.enemyBullets, i); }
        }
        fx.shieldBurst(s, rng, p.x, p.y, col); fx.shockwave(s, p.x, p.y, col, 175, 0.5);
        fx.popup(s, `AEGIS SURGE +${pts}`, p.x, p.y - 64, C.ice, 17, 1.3);
      }
    }
    fx.pickupBurst(s, rng, pk.x, pk.y, col);
    if (pk.kind !== 'shield') fx.shockwave(s, pk.x, pk.y, col, 74, 0.38);
    emit('powerup', pk.kind);
  }

  function updatePickups(dt) {
    const s = state; const p = s.player; const list = s.pickups; const drag = exp(-2.5 * dt);
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const pk = list[i]; pk.age += dt; pk.vx *= drag; pk.vy *= drag;
      const dx = p.x - pk.x; const dy = p.y - pk.y; const d = hypot(dx, dy) || 1;
      if (s.alive && d < PK.magnetRadius) {
        const pull = 280 * (1 - d / PK.magnetRadius) + 80;
        pk.vx += (dx / d) * pull * dt * 2.4; pk.vy += (dy / d) * pull * dt * 2.4;
      }
      pk.x = clamp(pk.x + pk.vx * dt, 18, W - 18); pk.y = clamp(pk.y + pk.vy * dt, 18, H - 18);
      if (s.alive && d < PK.collectRadius + PL.radius) { collectPickup(pk); swapPop(list, i); }
      else if (pk.age >= pk.life) swapPop(list, i);
    }
  }

  function collisions() {
    const s = state; const p = s.player; const n = s.enemies.length;
    for (let bi = s.bullets.length - 1; bi >= 0; bi -= 1) {
      const b = s.bullets[bi];
      for (let ei = 0; ei < n; ei += 1) {
        const e = s.enemies[ei]; if (e.dead) continue;
        const r = e.radius + b.radius; const dx = e.x - b.x; const dy = e.y - b.y;
        if (dx * dx + dy * dy < r * r) {
          e.hp -= b.damage; e.flash = 0.09;
          if (e.kind !== 'elite') { e.vx += b.vx * 0.012; e.vy += b.vy * 0.012; }
          fx.impact(s, rng, b.x, b.y, e.color); emit('hitEnemy'); swapPop(s.bullets, bi);
          if (e.hp <= 0) killEnemy(e, false);
          break;
        }
      }
    }
    if (!s.alive) return;
    for (let ei = 0; ei < n; ei += 1) {
      const e = s.enemies[ei]; if (e.dead) continue;
      const gap = hypot(e.x - p.x, e.y - p.y) - e.radius - PL.radius;
      if (gap < -2 && p.invulnerable <= 0) {
        damagePlayer(e.x, e.y);
        if (e.kind === 'elite') { e.vx *= 0.4; e.vy *= 0.4; } else killEnemy(e, true);
        if (!s.alive) return;
      } else if (gap > -2) nearMissCheck(s, e, gap);
    }
    for (let i = s.enemyBullets.length - 1; i >= 0; i -= 1) {
      const b = s.enemyBullets[i]; const gap = hypot(b.x - p.x, b.y - p.y) - b.radius - PL.radius;
      if (gap < -1 && p.invulnerable <= 0) {
        swapPop(s.enemyBullets, i); fx.explosion(s, rng, b.x, b.y, b.color, 8); damagePlayer(b.x - b.vx, b.y - b.vy);
        if (!s.alive) return;
      } else if (gap > -1) nearMissCheck(s, b, gap);
    }
  }

  function updateDeathWreck(dtReal, dt) {
    const s = state; const p = s.player; const prev = s.deathTimer; s.deathTimer += dtReal;
    const f = exp(-2.2 * dt); p.vx *= f; p.vy *= f;
    p.x = clamp(p.x + p.vx * dt, PL.margin, W - PL.margin); p.y = clamp(p.y + p.vy * dt, PL.margin, H - PL.margin);
    const burst = (col, rad, swCol, swRad, shk) => {
      const ox = p.x + range(rng, -17, 17); const oy = p.y + range(rng, -17, 17);
      fx.explosion(s, rng, ox, oy, col, rad); fx.shockwave(s, ox, oy, swCol, swRad, 0.5);
      s.shake = max(s.shake, shk); emit('explosion', rad);
    };
    if (prev < 0.22 && s.deathTimer >= 0.22) burst(C.orange, 26, C.cyan, 115, 1.15);
    if (prev < 0.5 && s.deathTimer >= 0.5) burst(C.magenta, 34, '#ffffff', 155, 1.45);
  }

  function step(dtReal, input) {
    const s = state; s.hitStopFlash = max(0, s.hitStopFlash - dtReal * 5);
    if (s.hitStop > 0) { s.hitStop = max(0, s.hitStop - dtReal); s.tick += 1; updateTelemetry(s, rng, dtReal); return; }
    s.slow = max(0, s.slow - dtReal); s.slowCooldown = max(0, s.slowCooldown - dtReal);
    s.timeScale += ((s.slow > 0 ? SLOWMO.scale : 1) - s.timeScale) * min(1, dtReal * 12);
    const dt = dtReal * s.timeScale; s.time += dt; s.tick += 1;

    if (s.spreadTimer > 0) s.spreadTimer = max(0, s.spreadTimer - dt);
    if (s.alive) updatePlayer(dt, input); else updateDeathWreck(dtReal, dt);

    updateWave(dt); updateEnemies(dt); stepBullets(s.bullets, dt); stepBullets(s.enemyBullets, dt);
    collisions(); updateCores(dt, s.phase === 'clear'); updatePickups(dt);
    for (let i = s.enemies.length - 1; i >= 0; i -= 1) if (s.enemies[i].dead) swapPop(s.enemies, i);

    if (s.comboTimer > 0 && (s.comboTimer -= dt) <= 0) {
      s.comboTimer = 0; if (s.combo >= 4) fx.popup(s, 'CHAIN ENDED', s.player.x, s.player.y - 62, C.dim, 13, 0.9); s.combo = 0;
    }
    if (s.alive && s.hull === 1 && rng() < 0.3) {
      fx.spark(s, rng, s.player.x, s.player.y, rng() < 0.5 ? C.orange : '#ffffff', 90, 0.5, 1.5);
      if (rng() < 0.3) fx.glow(s, s.player.x, s.player.y, C.orange, 10, 0.4, 0.4, 0.8, s.player.vx * 0.2, s.player.vy * 0.2 - 20);
    }
    fx.update(s, dt); updateTelemetry(s, rng, dtReal);
  }

  function reset(nextSeed) {
    if (nextSeed !== undefined) rng = createRandom(nextSeed);
    state = freshState(); world.state = state; prepareWave(1); state.events.length = 0;
  }

  const world = { state, step, reset, stage: { spawnEnemy, spawnPickup, prepareWave, rng: () => rng, emit }, fx };
  prepareWave(1); state.events.length = 0;
  return world;
}
