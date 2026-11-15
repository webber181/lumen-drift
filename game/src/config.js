// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.

export const W = 1280;
export const H = 720;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const DEFAULT_SEED = 7;

export const PALETTE = {
  void: '#05061a',
  indigo: '#0b0d33',
  deep: '#14104a',
  cyan: '#3df2ff',
  ice: '#bff9ff',
  magenta: '#ff3ea5',
  orange: '#ff8a3d',
  violet: '#a66bff',
  amber: '#ffc23d',
  gold: '#ffe08a',
  white: '#f2f8ff',
  red: '#ff4d6d',
  text: '#dff3ff',
  dim: '#7f8fc4',
};

export const FONT_UI = "'Segoe UI', 'SF Pro Display', 'Helvetica Neue', Inter, Roboto, 'Trebuchet MS', system-ui, sans-serif";
export const FONT_NUM = "'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', 'Liberation Mono', monospace";

export const PLAYER = {
  radius: 12,
  accel: 2700,
  maxSpeed: 360,
  drag: 5.2,
  hull: 3,
  invulnerable: 1.7,
  margin: 24,
};

export const WEAPON = {
  autoCooldown: 0.2,
  rapidCooldown: 0.105,
  speed: 800,
  life: 0.95,
  radius: 4,
  damage: 1,
};

export const COMBO = {
  window: 4.0,
  perTier: 4,
  maxMultiplier: 9,
  coreScore: 25,
  shieldPerCore: 9,
};

export const CORE = {
  life: 10,
  magnetRadius: 150,
  collectRadius: 24,
  blink: 2.2,
};

/** Wave pacing: how long each phase lasts and how a wave is paid out. */
export const WAVE = {
  introSeconds: 1.9,
  eliteIntroSeconds: 2.8,
  clearSeconds: 2.6,
  bonusPerWave: 300,
  /** An elite wave holds this share of a normal wave's drones, plus the elite itself. */
  eliteEscortShare: 0.6,
};

/** Where and how often drones arrive. */
export const SPAWN = {
  edgeMargin: 40,
  minDistance: 320,
  eliteMinDistance: 380,
  eliteDelay: 2,
  jitter: [0.7, 1.3],
  retries: 5,
};

/** Click-drag steering: no pull inside the dead zone, full pull at `fullPull` pixels. */
export const DRAG_STEER = { deadZone: 34, fullPull: 170 };

/** Hostile shots fired by squares (from `fromWave`) and elites. */
export const HOSTILE_SHOT = {
  square: { speed: 190, radius: 5, fromWave: 6, firstDelay: [2.5, 4.5], baseInterval: 4.6, perWave: 0.12, minInterval: 2.2 },
  elite: { radius: 6, spread: 0.27 },
};

export const SLOWMO = { scale: 0.32, nearMiss: 0.55, hit: 0.22, cooldown: 5 };

/** Per-kind enemy stats. `speed` is pixels per second before the wave's speed multiplier. */
export const ENEMY = {
  triangle: { sides: 3, radius: 14, hp: 1, speed: 150, turn: 2.6, score: 100, cores: 1, color: 'magenta' },
  square: { sides: 4, radius: 21, hp: 3, speed: 78, turn: 0.9, score: 220, cores: 2, color: 'orange' },
  pentagon: { sides: 5, radius: 18, hp: 2, speed: 118, turn: 3.2, score: 160, cores: 1, color: 'violet' },
};

export const ELITE = {
  radius: 46,
  speed: 52,
  turn: 0.8,
  score: 2000,
  cores: 12,
  fireInterval: 2.7,
  bulletSpeed: 210,
  variants: [
    { sides: 6, color: 'magenta', name: 'WARDEN' },
    { sides: 8, color: 'orange', name: 'BASTION' },
    { sides: 10, color: 'violet', name: 'LEVIATHAN' },
  ],
};

/** Elite hit points: tougher every elite wave (wave 5: 80, wave 10: 110). */
export function eliteHealth(wave) {
  return 50 + wave * 6;
}

/** Share of a wave's drones that are squares (from wave 2) and pentagons (from wave 3). */
export function squareShare(wave) {
  return wave >= 2 ? Math.min(0.38, 0.1 + 0.035 * wave) : 0;
}

export function pentagonShare(wave) {
  return wave >= 3 ? Math.min(0.38, 0.08 + 0.045 * (wave - 2)) : 0;
}

/** Points for clearing a wave. */
export function waveBonus(wave) {
  return WAVE.bonusPerWave * wave;
}

export function isEliteWave(wave) {
  return wave > 0 && wave % 5 === 0;
}

/** Enemy speed multiplier for a wave: faster every wave, capped so late waves stay fair. */
export function speedMultiplier(wave) {
  return 1 + Math.min(1.1, 0.06 * (wave - 1));
}

/** How many enemies a wave holds. */
export function waveCount(wave) {
  return Math.min(46, 6 + Math.floor(wave * 2.1));
}

/** Seconds between spawns in a wave. */
export function spawnInterval(wave) {
  return Math.max(0.22, 1.05 - 0.05 * wave);
}

/** The most enemies alive at once. */
export function activeCap(wave) {
  return Math.min(28, 8 + Math.floor(wave * 1.3));
}

/** The weapon grows with the waves: single, twin, then triple fan. */
export function weaponLevel(wave) {
  return 1 + (wave >= 3 ? 1 : 0) + (wave >= 7 ? 1 : 0);
}

export function comboMultiplier(combo) {
  return Math.min(COMBO.maxMultiplier, 1 + Math.floor(combo / COMBO.perTier));
}
