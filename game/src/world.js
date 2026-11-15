// The rules: one world object holds the whole game state and advances it in fixed steps.
// step(dt, input) moves the ship, fires, spawns waves, steers the drones, resolves hits, drops
// and collects cores, and builds combo and shield. Things that should make a sound are pushed
// onto state.events for main.js to hand to the audio; nothing here touches the screen.
import {
  COMBO, CORE, DRAG_STEER, ELITE, ENEMY, H, HOSTILE_SHOT, PALETTE, PLAYER, SLOWMO, SPAWN, W, WAVE, WEAPON,
  activeCap, comboMultiplier, eliteHealth, isEliteWave, pentagonShare, spawnInterval, speedMultiplier, squareShare,
  waveBonus, waveCount, weaponLevel,
} from './config.js';
import { createRandom, range, sign } from './random.js';
import * as fx from './particles.js';

const TAU = Math.PI * 2;

function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function freshState() {
  return {
    time: 0,
    tick: 0,
    alive: true,
    score: 0,
    wave: 1,
    hull: PLAYER.hull,
    shield: 0,
    shieldReady: false,
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    kills: 0,
    cores: 0,
    player: {
      x: W / 2, y: H * 0.72, vx: 0, vy: 0, angle: -Math.PI / 2, aimX: W / 2, aimY: 0,
      fireCooldown: 0, invulnerable: 0, flare: 0, shieldFlash: 0, thrust: 0,
    },
    bullets: [],
    enemyBullets: [],
    enemies: [],
    coreList: [],
    particles: [],
    shake: 0,
    shakeX: 0,
    shakeY: 0,
    hitFlash: 0,
    timeScale: 1,
    slow: 0,
    slowCooldown: 0,
    phase: 'intro',
    phaseTimer: 1.8,
    queue: [],
    spawnTimer: 0,
    waveTotal: 0,
    waveKilled: 0,
    banner: { text: '', sub: '', t: 0, dur: 2, color: PALETTE.cyan },
    events: [],
    autoFire: true,
    nextId: 1,
    newBest: false,
    scoreShown: 0,
    scorePulse: 0,
    lastScore: 0,
    tierFlash: 0,
  };
}

export function createWorld(seed) {
  let rng = createRandom(seed);
  let state = freshState();

  function emit(type, value = 0) {
    state.events.push({ type, value });
  }

  // ---- waves -------------------------------------------------------------------------------

  function buildQueue(wave) {
    const queue = [];
    const count = waveCount(wave);
    const pentagons = pentagonShare(wave);
    const squares = pentagons + squareShare(wave);
    for (let i = 0; i < count; i += 1) {
      const roll = rng();
      queue.push(roll < pentagons ? 'pentagon' : roll < squares ? 'square' : 'triangle');
    }
    if (isEliteWave(wave)) {
      // The elite leads a smaller escort.
      queue.length = Math.floor(count * WAVE.eliteEscortShare);
      queue.unshift('elite');
    }
    return queue;
  }

  function prepareWave(wave) {
    state.wave = wave;
    state.queue = buildQueue(wave);
    state.waveTotal = state.queue.length;
    state.waveKilled = 0;
    state.phase = 'intro';
    const elite = isEliteWave(wave);
    state.phaseTimer = elite ? WAVE.eliteIntroSeconds : WAVE.introSeconds;
    state.spawnTimer = 0;
    state.banner = elite
      ? { text: `WAVE ${wave}`, sub: 'ELITE DRONE INCOMING', t: 0, dur: 2.6, color: PALETTE.magenta }
      : { text: `WAVE ${wave}`, sub: wave === 1 ? 'DESTROY THE DRONES  -  COLLECT THE CORES' : 'THEY ARE GETTING FASTER', t: 0, dur: 1.8, color: PALETTE.cyan };
    emit(elite ? 'elite' : 'waveStart', wave);
  }

  function spawnPoint(minDistance) {
    const p = state.player;
    const m = SPAWN.edgeMargin;
    // One point just outside a random edge: top, right, bottom or left.
    const onEdge = (edge) => {
      const along = range(rng, 0, edge % 2 === 0 ? W : H);
      return [
        { x: along, y: -m },
        { x: W + m, y: along },
        { x: along, y: H + m },
        { x: -m, y: along },
      ][edge];
    };
    let point = onEdge(Math.floor(rng() * 4));
    // Retry a few times so a drone never appears right on top of the ship.
    for (let tries = 1; tries < SPAWN.retries && Math.hypot(point.x - p.x, point.y - p.y) < minDistance; tries += 1) {
      point = onEdge(Math.floor(rng() * 4));
    }
    return point;
  }

  function makeEnemy(kind, x, y) {
    const wave = state.wave;
    const elite = kind === 'elite';
    const variant = elite ? ELITE.variants[(Math.floor(wave / 5) - 1) % ELITE.variants.length] : null;
    const def = elite ? null : ENEMY[kind];
    const hp = elite ? eliteHealth(wave) : def.hp;
    const p = state.player;
    const heading = Math.atan2(p.y - y, p.x - x);
    const speed = (elite ? ELITE.speed : def.speed) * speedMultiplier(wave);
    return {
      id: state.nextId++,
      kind,
      x,
      y,
      vx: Math.cos(heading) * speed * 0.6,
      vy: Math.sin(heading) * speed * 0.6,
      rot: heading,
      spin: elite ? 0.5 : kind === 'square' ? range(rng, 0.5, 1.2) * sign(rng) : kind === 'pentagon' ? range(rng, 1.4, 2.2) * sign(rng) : 0,
      hp,
      maxHp: hp,
      radius: elite ? ELITE.radius : def.radius,
      sides: elite ? variant.sides : def.sides,
      color: PALETTE[elite ? variant.color : def.color],
      name: elite ? variant.name : kind,
      speed: elite ? ELITE.speed : def.speed,
      turn: elite ? ELITE.turn : def.turn,
      score: elite ? ELITE.score + wave * 100 : def.score,
      dropCores: elite ? ELITE.cores : def.cores,
      flash: 0,
      age: 0,
      phase: rng() * TAU,
      orbit: sign(rng),
      fireTimer: elite ? 2 : kind === 'square' ? range(rng, ...HOSTILE_SHOT.square.firstDelay) : 0,
      summons: 0,
      nearState: 0,
      dead: false,
    };
  }

  function spawnEnemy(kind, x, y) {
    const e = makeEnemy(kind, x, y);
    state.enemies.push(e);
    // A ring where the drone slides into view, so arrivals are telegraphed.
    const rx = clamp(x, 14, W - 14);
    const ry = clamp(y, 14, H - 14);
    fx.ring(state, rx, ry, e.color, e.radius * 1.8, 0.4);
    fx.glow(state, rx, ry, e.color, e.radius * 1.4, 0.3, 0.4, 0.4);
    return e;
  }

  /** Pay out the wave bonus, announce it and set off the celebration around the ship. */
  function clearWave() {
    const s = state;
    const bonus = waveBonus(s.wave);
    s.score += bonus;
    s.phase = 'clear';
    s.phaseTimer = WAVE.clearSeconds;
    s.banner = { text: `WAVE ${s.wave} CLEAR`, sub: `BONUS +${bonus.toLocaleString('en-US')}`, t: 0, dur: 2.4, color: PALETTE.amber };
    emit('waveClear', s.wave);
    const { x, y } = s.player;
    fx.ring(s, x, y, PALETTE.amber, 420, 1.0);
    fx.ring(s, x, y, PALETTE.cyan, 300, 0.8);
    fx.glow(s, x, y, PALETTE.amber, 160, 0.5, 0.6, 1.2);
    const confetti = [PALETTE.amber, PALETTE.cyan, PALETTE.magenta, '#ffffff'];
    for (let i = 0; i < 46; i += 1) fx.spark(s, rng, x, y, confetti[i % confetti.length], 520, 1.1, 2.2);
  }

  /** Launch one hostile shot from an enemy along `angle`. */
  function fireHostile(e, angle, speed, radius) {
    state.enemyBullets.push({
      x: e.x + Math.cos(angle) * e.radius, y: e.y + Math.sin(angle) * e.radius,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 6, radius, color: e.color, nearState: 0,
    });
  }

  function updateWave(dt) {
    const s = state;
    s.banner.t += dt;
    if (s.phase === 'intro') {
      s.phaseTimer -= dt;
      if (s.phaseTimer <= 0) s.phase = 'spawn';
    } else if (s.phase === 'spawn') {
      s.spawnTimer -= dt;
      if (s.queue.length > 0 && s.spawnTimer <= 0 && s.enemies.length < activeCap(s.wave)) {
        const kind = s.queue.shift();
        const pt = spawnPoint(kind === 'elite' ? SPAWN.eliteMinDistance : SPAWN.minDistance);
        spawnEnemy(kind, pt.x, pt.y);
        s.spawnTimer = spawnInterval(s.wave) * range(rng, SPAWN.jitter[0], SPAWN.jitter[1]);
        if (kind === 'elite') s.spawnTimer += SPAWN.eliteDelay;
      }
      if (s.queue.length === 0 && s.enemies.length === 0 && s.alive) clearWave();
    } else if (s.phase === 'clear') {
      s.phaseTimer -= dt;
      if (s.phaseTimer <= 0) prepareWave(s.wave + 1);
    }
  }

  // ---- player ------------------------------------------------------------------------------

  function fireWeapon(rapid) {
    const p = state.player;
    const level = weaponLevel(state.wave);
    const dirs = [];
    if (level === 1) dirs.push([0, 0]);
    else if (level === 2) dirs.push([-7, 0], [7, 0]);
    else dirs.push([0, 0], [-9, -0.13], [9, 0.13]);
    const c = Math.cos(p.angle);
    const sn = Math.sin(p.angle);
    for (const [lateral, tilt] of dirs) {
      const a = p.angle + tilt + (rng() - 0.5) * 0.02;
      const ox = p.x + c * 18 - sn * lateral;
      const oy = p.y + sn * 18 + c * lateral;
      state.bullets.push({
        x: ox, y: oy, vx: Math.cos(a) * WEAPON.speed + p.vx * 0.25, vy: Math.sin(a) * WEAPON.speed + p.vy * 0.25,
        life: WEAPON.life, radius: WEAPON.radius, damage: WEAPON.damage,
      });
    }
    p.flare = 1;
    fx.glow(state, p.x + c * 20, p.y + sn * 20, PALETTE.cyan, 16, 0.08, 0.9);
    fx.sparkDir(state, rng, p.x + c * 20, p.y + sn * 20, p.angle, 0.7, PALETTE.ice, 220, 0.18, 1.3);
    emit(rapid ? 'laserRapid' : 'laser');
  }

  function updatePlayer(dt, input) {
    const p = state.player;
    let mx = input.moveX;
    let my = input.moveY;
    if (mx === 0 && my === 0 && input.dragging) {
      const dx = input.aimX - p.x;
      const dy = input.aimY - p.y;
      const d = Math.hypot(dx, dy);
      if (d > DRAG_STEER.deadZone) {
        const k = Math.min(1, (d - DRAG_STEER.deadZone) / DRAG_STEER.fullPull);
        mx = (dx / d) * k;
        my = (dy / d) * k;
      }
    }
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    p.vx += mx * PLAYER.accel * dt;
    p.vy += my * PLAYER.accel * dt;
    const f = Math.exp(-PLAYER.drag * dt);
    p.vx *= f;
    p.vy *= f;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > PLAYER.maxSpeed) { p.vx *= PLAYER.maxSpeed / sp; p.vy *= PLAYER.maxSpeed / sp; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const m = PLAYER.margin;
    if (p.x < m) { p.x = m; p.vx = Math.max(0, p.vx); }
    if (p.x > W - m) { p.x = W - m; p.vx = Math.min(0, p.vx); }
    if (p.y < m) { p.y = m; p.vy = Math.max(0, p.vy); }
    if (p.y > H - m) { p.y = H - m; p.vy = Math.min(0, p.vy); }
    p.thrust = clamp(Math.hypot(mx, my) + sp / PLAYER.maxSpeed * 0.4, 0, 1);

    p.aimX = input.aimX;
    p.aimY = input.aimY;
    if (Math.hypot(p.aimX - p.x, p.aimY - p.y) > 4) p.angle = Math.atan2(p.aimY - p.y, p.aimX - p.x);

    p.invulnerable = Math.max(0, p.invulnerable - dt);
    p.flare = Math.max(0, p.flare - dt * 12);
    p.shieldFlash = Math.max(0, p.shieldFlash - dt * 2);
    p.fireCooldown -= dt;
    if ((input.fire || state.autoFire) && p.fireCooldown <= 0) {
      fireWeapon(input.fire);
      p.fireCooldown = input.fire ? WEAPON.rapidCooldown : WEAPON.autoCooldown;
    }

    // Exhaust trail.
    if (p.thrust > 0.25 && rng() < 0.55 + p.thrust * 0.4) {
      const back = p.angle + Math.PI;
      const color = rng() < 0.5 ? PALETTE.cyan : PALETTE.violet;
      // The puff leaves the nozzle and drifts back, carrying a little of the ship's motion.
      fx.glow(
        state, p.x + Math.cos(back) * 11, p.y + Math.sin(back) * 11, color, 8 + p.thrust * 5, 0.3, 0.55, -0.5,
        Math.cos(back) * 40 - p.vx * 0.1, Math.sin(back) * 40 - p.vy * 0.1,
      );
    }
  }

  function damagePlayer(fromX, fromY) {
    const s = state;
    const p = s.player;
    const away = Math.atan2(p.y - fromY, p.x - fromX);
    if (s.shieldReady) {
      s.shieldReady = false;
      s.shield = 0;
      p.invulnerable = 1.1;
      p.shieldFlash = 1;
      s.shake = Math.max(s.shake, 0.55);
      fx.shieldBurst(s, rng, p.x, p.y, PALETTE.cyan);
      p.vx += Math.cos(away) * 260;
      p.vy += Math.sin(away) * 260;
      emit('shieldBreak');
      return;
    }
    s.hull -= 1;
    p.invulnerable = PLAYER.invulnerable;
    p.vx += Math.cos(away) * 300;
    p.vy += Math.sin(away) * 300;
    if (s.combo > 0) fx.popup(s, 'COMBO LOST', p.x, p.y - 62, PALETTE.red, 14, 1.1);
    s.combo = 0;
    s.comboTimer = 0;
    s.shake = Math.max(s.shake, 1);
    s.hitFlash = 1;
    s.slow = Math.max(s.slow, SLOWMO.hit);
    fx.explosion(s, rng, p.x, p.y, PALETTE.red, 16);
    emit('hit');
    if (s.hull <= 0) {
      s.hull = 0;
      s.alive = false;
      s.bullets.length = 0;
      s.enemyBullets.length = 0;
      s.shake = 2;
      fx.explosion(s, rng, p.x, p.y, PALETTE.cyan, 44);
      fx.ring(s, p.x, p.y, PALETTE.magenta, 220, 1.1);
      emit('gameOver');
    }
  }

  // ---- enemies, bullets, cores -------------------------------------------------------------

  function dropCores(e) {
    for (let i = 0; i < e.dropCores; i += 1) {
      const a = rng() * TAU;
      const v = range(rng, 50, e.kind === 'elite' ? 300 : 150);
      state.coreList.push({
        x: e.x + Math.cos(a) * 4, y: e.y + Math.sin(a) * 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        age: 0, phase: rng() * TAU, spin: range(rng, 1, 2.4) * sign(rng),
      });
    }
  }

  function killEnemy(e, rammed) {
    const s = state;
    if (e.dead) return;
    e.dead = true;
    s.kills += 1;
    s.waveKilled += 1;
    const mult = comboMultiplier(s.combo);
    const gained = Math.round((rammed ? e.score * 0.5 : e.score) * mult);
    s.score += gained;
    fx.explosion(s, rng, e.x, e.y, e.color, e.radius);
    fx.popup(s, `+${gained.toLocaleString('en-US')}`, e.x, e.y - e.radius - 6, e.kind === 'elite' ? PALETTE.amber : PALETTE.white, e.kind === 'elite' ? 26 : 16);
    dropCores(e);
    s.shake = Math.max(s.shake, e.kind === 'elite' ? 1.4 : 0.12 + e.radius / 120);
    emit('explosion', e.radius);
    if (e.kind === 'elite') {
      if (s.hull < PLAYER.hull && s.alive) {
        s.hull += 1;
        fx.popup(s, 'HULL +1', s.player.x, s.player.y - 62, PALETTE.cyan, 18, 1.4);
        emit('repair');
      }
      s.slow = Math.max(s.slow, 0.5);
      for (let i = 0; i < 3; i += 1) fx.ring(s, e.x, e.y, i === 0 ? '#ffffff' : e.color, 140 + i * 70, 0.7 + i * 0.2);
      emit('eliteDown');
    }
  }

  function summonDarts(e, count) {
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * TAU + e.age;
      const d = spawnEnemy('triangle', e.x + Math.cos(a) * (e.radius + 14), e.y + Math.sin(a) * (e.radius + 14));
      d.vx = Math.cos(a) * 220;
      d.vy = Math.sin(a) * 220;
      state.waveTotal += 1;
    }
    fx.ring(state, e.x, e.y, e.color, e.radius * 2.4, 0.5);
  }

  function eliteFire(e) {
    const p = state.player;
    const base = Math.atan2(p.y - e.y, p.x - e.x);
    const n = e.hp < e.maxHp * 0.5 ? 5 : 3;
    // A fan of shots centred on the ship; the fan widens when the elite is badly hurt.
    for (let i = 0; i < n; i += 1) {
      const angle = base + (i - (n - 1) / 2) * HOSTILE_SHOT.elite.spread;
      fireHostile(e, angle, ELITE.bulletSpeed, HOSTILE_SHOT.elite.radius);
    }
    fx.glow(state, e.x, e.y, e.color, e.radius * 1.6, 0.25, 0.8, 0.5);
    emit('enemyShot');
  }

  function updateEnemies(dt) {
    const s = state;
    const p = s.player;
    const speedMul = speedMultiplier(s.wave);
    for (const e of s.enemies) {
      e.age += dt;
      e.flash = Math.max(0, e.flash - dt);
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      let heading = Math.atan2(e.vy, e.vx);
      let speed = Math.hypot(e.vx, e.vy);
      if (s.alive) {
        let want = Math.atan2(dy, dx);
        let target = e.speed * speedMul;
        if (e.kind === 'pentagon') {
          want += e.orbit * clamp((dist - 90) / 420, 0, 1) * 1.2;
        } else if (e.kind === 'triangle') {
          want += Math.sin(e.age * 3 + e.phase) * 0.24 * (dist > 220 ? 1 : 0);
          const lunge = Math.sin(e.age * 2.1 + e.phase);
          target *= 1 + 0.55 * Math.max(0, lunge) * Math.max(0, lunge);
        }
        const diff = angleDiff(want, heading);
        const maxTurn = e.turn * dt;
        heading += clamp(diff, -maxTurn, maxTurn);
        speed += (target - speed) * Math.min(1, dt * 2.4);
      } else {
        speed *= Math.exp(-0.6 * dt);
      }
      e.vx = Math.cos(heading) * speed;
      e.vy = Math.sin(heading) * speed;
      e.rot = e.kind === 'triangle' ? heading : e.rot + e.spin * dt;
      // Keep drones from stacking on each other.
      for (const o of s.enemies) {
        if (o === e || o.dead) continue;
        const ox = e.x - o.x;
        const oy = e.y - o.y;
        const min = e.radius + o.radius;
        const d2 = ox * ox + oy * oy;
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const share = o.kind === 'elite' ? 1 : e.kind === 'elite' ? 0 : 0.5;
          const shift = (min - d) * share * Math.min(1, dt * 6);
          e.x += (ox / d) * shift;
          e.y += (oy / d) * shift;
        }
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.kind === 'elite' && s.alive) {
        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          eliteFire(e);
          e.fireTimer = ELITE.fireInterval * (e.hp < e.maxHp * 0.5 ? 0.7 : 1);
        }
        const ratio = e.hp / e.maxHp;
        if (e.summons === 0 && ratio < 0.66) { e.summons = 1; summonDarts(e, 3); emit('elite'); }
        if (e.summons === 1 && ratio < 0.33) { e.summons = 2; summonDarts(e, 4); emit('elite'); }
      }
      const gun = HOSTILE_SHOT.square;
      if (e.kind === 'square' && s.alive && s.wave >= gun.fromWave && e.age > 1) {
        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          e.fireTimer = Math.max(gun.minInterval, gun.baseInterval - s.wave * gun.perWave) * range(rng, 0.8, 1.2);
          fireHostile(e, Math.atan2(dy, dx), gun.speed, gun.radius);
          fx.glow(s, e.x, e.y, e.color, e.radius * 1.5, 0.2, 0.7, 0.4);
          emit('enemyShot');
        }
      }
      // Engine glints behind darts.
      if (e.kind === 'triangle' && rng() < 0.35) {
        fx.glow(s, e.x - Math.cos(e.rot) * e.radius * 0.8, e.y - Math.sin(e.rot) * e.radius * 0.8, e.color, 7, 0.22, 0.5, -0.4);
      }
    }
  }

  function updateBullets(dt) {
    const s = state;
    for (const list of [s.bullets, s.enemyBullets]) {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const b = list[i];
        b.life -= dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.life <= 0 || b.x < -60 || b.x > W + 60 || b.y < -60 || b.y > H + 60) list.splice(i, 1);
      }
    }
  }

  function updateCores(dt, magnetAll) {
    const s = state;
    const p = s.player;
    for (let i = s.coreList.length - 1; i >= 0; i -= 1) {
      const c = s.coreList[i];
      c.age += dt;
      const f = Math.exp(-2.8 * dt);
      c.vx *= f;
      c.vy *= f;
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      const d = Math.hypot(dx, dy) || 1;
      if (s.alive && (d < CORE.magnetRadius || magnetAll)) {
        const pull = magnetAll ? 900 : 620 * (1 - d / CORE.magnetRadius) + 160;
        c.vx += (dx / d) * pull * dt * 2.2;
        c.vy += (dy / d) * pull * dt * 2.2;
        if (rng() < 0.4) fx.glow(s, c.x, c.y, PALETTE.amber, 7, 0.25, 0.6, -0.5);
      }
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.x = clamp(c.x, 10, W - 10);
      c.y = clamp(c.y, 10, H - 10);
      if (s.alive && d < CORE.collectRadius + PLAYER.radius * 0.5) {
        collectCore(c);
        s.coreList.splice(i, 1);
      } else if (c.age > CORE.life && !magnetAll) {
        s.coreList.splice(i, 1);
      }
    }
  }

  function collectCore(c) {
    const s = state;
    s.combo += 1;
    s.maxCombo = Math.max(s.maxCombo, s.combo);
    s.comboTimer = COMBO.window;
    s.cores += 1;
    const mult = comboMultiplier(s.combo);
    s.score += COMBO.coreScore * mult;
    if (!s.shieldReady) {
      s.shield = Math.min(100, s.shield + COMBO.shieldPerCore);
      if (s.shield >= 100) {
        s.shieldReady = true;
        fx.popup(s, 'SHIELD READY', s.player.x, s.player.y - 62, PALETTE.cyan, 16, 1.2);
        emit('shieldReady');
      }
    }
    fx.pickupBurst(s, rng, c.x, c.y, PALETTE.amber);
    if (s.combo > 0 && s.combo % COMBO.perTier === 0) {
      fx.popup(s, `COMBO x${mult}`, s.player.x, s.player.y - 62, PALETTE.amber, 20, 1.1);
      fx.ring(s, s.player.x, s.player.y, PALETTE.amber, 110, 0.5);
      s.tierFlash = 1;
    }
    emit('pickup', s.combo);
  }

  function nearMissCheck(entity, gap) {
    // A threat that came close and slid away without touching earns a slow-motion beat.
    if (entity.nearState === 0 && gap < 22) entity.nearState = 1;
    else if (entity.nearState === 1 && gap > 34) {
      entity.nearState = 2;
      const s = state;
      if (s.slowCooldown <= 0 && s.player.invulnerable <= 0 && s.alive) {
        s.slow = Math.max(s.slow, SLOWMO.nearMiss);
        s.slowCooldown = SLOWMO.cooldown;
        s.score += 50 * comboMultiplier(s.combo);
        fx.popup(s, 'CLOSE CALL', s.player.x, s.player.y + 56, PALETTE.cyan, 16, 1.1);
        emit('nearMiss');
      }
    }
  }

  function collisions() {
    const s = state;
    const p = s.player;
    // Player shots against drones.
    for (let bi = s.bullets.length - 1; bi >= 0; bi -= 1) {
      const b = s.bullets[bi];
      for (const e of s.enemies) {
        if (e.dead) continue;
        const r = e.radius + b.radius;
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        if (dx * dx + dy * dy < r * r) {
          e.hp -= b.damage;
          e.flash = 0.09;
          if (e.kind !== 'elite') { e.vx += b.vx * 0.012; e.vy += b.vy * 0.012; }
          fx.impact(s, rng, b.x, b.y, e.color);
          emit('hitEnemy');
          s.bullets.splice(bi, 1);
          if (e.hp <= 0) killEnemy(e, false);
          break;
        }
      }
    }
    if (!s.alive) return;
    // Drones against the ship.
    for (const e of s.enemies) {
      if (e.dead) continue;
      const gap = Math.hypot(e.x - p.x, e.y - p.y) - e.radius - PLAYER.radius;
      if (gap < -2 && p.invulnerable <= 0) {
        damagePlayer(e.x, e.y);
        if (e.kind === 'elite') {
          e.vx *= 0.4;
          e.vy *= 0.4;
        } else killEnemy(e, true);
        if (!s.alive) return;
      } else if (gap > -2) nearMissCheck(e, gap);
    }
    for (let i = s.enemyBullets.length - 1; i >= 0; i -= 1) {
      const b = s.enemyBullets[i];
      const gap = Math.hypot(b.x - p.x, b.y - p.y) - b.radius - PLAYER.radius;
      if (gap < -1 && p.invulnerable <= 0) {
        s.enemyBullets.splice(i, 1);
        fx.explosion(s, rng, b.x, b.y, b.color, 8);
        damagePlayer(b.x - b.vx, b.y - b.vy);
        if (!s.alive) return;
      } else if (gap > -1) nearMissCheck(b, gap);
    }
  }

  // ---- the step ----------------------------------------------------------------------------

  function step(dtReal, input) {
    const s = state;
    s.slow = Math.max(0, s.slow - dtReal);
    s.slowCooldown = Math.max(0, s.slowCooldown - dtReal);
    const target = s.slow > 0 ? SLOWMO.scale : 1;
    s.timeScale += (target - s.timeScale) * Math.min(1, dtReal * 12);
    const dt = dtReal * s.timeScale;
    s.time += dt;
    s.tick += 1;

    if (s.alive) updatePlayer(dt, input);
    updateWave(dt);
    updateEnemies(dt);
    updateBullets(dt);
    collisions();
    updateCores(dt, s.phase === 'clear');
    s.enemies = s.enemies.filter((e) => !e.dead);

    if (s.comboTimer > 0) {
      s.comboTimer -= dt;
      if (s.comboTimer <= 0) {
        s.comboTimer = 0;
        if (s.combo >= 4) fx.popup(s, 'CHAIN ENDED', s.player.x, s.player.y - 62, PALETTE.dim, 13, 0.9);
        s.combo = 0;
      }
    }
    if (s.alive && s.hull === 1 && rng() < 0.3) {
      fx.spark(s, rng, s.player.x, s.player.y, rng() < 0.5 ? PALETTE.orange : '#ffffff', 90, 0.5, 1.5);
      if (rng() < 0.3) fx.glow(s, s.player.x, s.player.y, PALETTE.orange, 10, 0.4, 0.4, 0.8, s.player.vx * 0.2, s.player.vy * 0.2 - 20);
    }
    fx.update(s, dt);
    if (s.score > s.lastScore) s.scorePulse = 1;
    s.lastScore = s.score;
    s.scoreShown += (s.score - s.scoreShown) * Math.min(1, dtReal * 9);
    if (Math.abs(s.score - s.scoreShown) < 1) s.scoreShown = s.score;
    s.scorePulse = Math.max(0, s.scorePulse - dtReal * 4);
    s.tierFlash = Math.max(0, s.tierFlash - dtReal * 3);

    s.hitFlash = Math.max(0, s.hitFlash - dtReal * 2.4);
    s.shake *= Math.exp(-7 * dtReal);
    if (s.shake < 0.01) s.shake = 0;
    const amp = s.shake * 11;
    s.shakeX = (rng() - 0.5) * 2 * amp;
    s.shakeY = (rng() - 0.5) * 2 * amp;
  }

  function reset(nextSeed) {
    if (nextSeed !== undefined) rng = createRandom(nextSeed);
    state = freshState();
    world.state = state;
    prepareWave(1);
    state.events.length = 0;
  }

  const world = {
    state,
    step,
    reset,
    /** Used by the screenshot scenes to place things by hand. */
    stage: { spawnEnemy, prepareWave, rng: () => rng, emit },
    fx,
  };
  prepareWave(1);
  state.events.length = 0;
  return world;
}
