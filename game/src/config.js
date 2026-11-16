// Tuning constants and palette for the fixed 1280x720 playfield.
export const W = 1280;
export const H = 720;
export const STEP = 1 / 60;
export const DEFAULT_SEED = 7;

export const PALETTE = {
  void: '#05061a', indigo: '#0b0d33', deep: '#14104a', cyan: '#3df2ff', ice: '#bff9ff',
  magenta: '#ff3ea5', orange: '#ff8a3d', violet: '#a66bff', amber: '#ffc23d', gold: '#ffe08a',
  white: '#f2f8ff', red: '#ff4d6d', teal: '#2cf5c8', emerald: '#4dff9a', text: '#dff3ff', dim: '#7f8fc4',
};

export const FONT_UI = "'Segoe UI', 'SF Pro Display', 'Helvetica Neue', Inter, Roboto, 'Trebuchet MS', system-ui, sans-serif";
export const FONT_NUM = "'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', 'Liberation Mono', monospace";

export const PLAYER = {
  radius: 12, accel: 2700, counterThrust: 1.35, maxSpeed: 360, drag: 5.2, hull: 3, invulnerable: 1.7, margin: 24,
};

export const WEAPON = { autoCooldown: 0.2, rapidCooldown: 0.105, speed: 800, life: 0.95, radius: 4, damage: 1 };
export const COMBO = { window: 4.0, perTier: 4, maxMultiplier: 9, coreScore: 25, shieldPerCore: 9 };
export const CORE = { life: 10, magnetRadius: 150, collectRadius: 24, blink: 2.2 };

export const WAVE = {
  introSeconds: 1.9, eliteIntroSeconds: 2.8, clearSeconds: 2.6, bonusPerWave: 300, eliteEscortShare: 0.6,
};

export const SPAWN = { edgeMargin: 40, minDistance: 320, eliteMinDistance: 380, eliteDelay: 2, jitter: [0.7, 1.3], retries: 5 };
export const DRAG_STEER = { deadZone: 34, fullPull: 170 };

export const HOSTILE_SHOT = {
  square: { speed: 190, radius: 5, fromWave: 6, firstDelay: [2.5, 4.5], baseInterval: 4.6, perWave: 0.12, minInterval: 2.2 },
  sniper: { speed: 470, radius: 5, chargeTime: 0.85, lockPoint: 0.72, minRange: 280, maxRange: 390, baseInterval: 2.8, perWave: 0.05, minInterval: 1.75 },
  elite: { radius: 6, spread: 0.27 },
};

export const SLOWMO = { scale: 0.32, nearMiss: 0.55, hit: 0.22, cooldown: 5 };

export const PICKUP = {
  life: 14, blink: 3.0, radius: 15, collectRadius: 28, magnetRadius: 115,
  spreadSeconds: 9.0, eliteDropChance: 0.85, droneDropChance: 0.07,
};

export const ENEMY = {
  triangle: { sides: 3, radius: 14, hp: 1, speed: 150, turn: 2.6, score: 100, cores: 1, color: 'magenta' },
  square: { sides: 4, radius: 21, hp: 3, speed: 78, turn: 0.9, score: 220, cores: 2, color: 'orange' },
  pentagon: { sides: 5, radius: 18, hp: 2, speed: 118, turn: 3.2, score: 160, cores: 1, color: 'violet' },
  splitter: { sides: 6, radius: 22, hp: 3, speed: 92, turn: 1.8, score: 260, cores: 2, color: 'teal' },
  shardling: { sides: 3, radius: 9, hp: 1, speed: 210, turn: 4.2, score: 65, cores: 1, color: 'teal' },
  orbiter: { sides: 8, radius: 15, hp: 2, speed: 168, turn: 4.5, score: 190, cores: 2, color: 'ice' },
  sniper: { sides: 4, radius: 17, hp: 2, speed: 124, turn: 3.4, score: 280, cores: 2, color: 'red' },
};

export const ELITE = {
  radius: 46, speed: 52, turn: 0.8, score: 2000, cores: 12, fireInterval: 2.7, bulletSpeed: 210,
  variants: [
    { sides: 6, color: 'magenta', name: 'WARDEN' },
    { sides: 8, color: 'orange', name: 'BASTION' },
    { sides: 10, color: 'violet', name: 'LEVIATHAN' },
  ],
};

export function eliteHealth(wave) { return 50 + wave * 6; }
export function squareShare(wave) { return wave >= 2 ? Math.min(0.38, 0.1 + 0.035 * wave) : 0; }
export function pentagonShare(wave) { return wave >= 3 ? Math.min(0.38, 0.08 + 0.045 * (wave - 2)) : 0; }
export function waveBonus(wave) { return WAVE.bonusPerWave * wave; }
export function isEliteWave(wave) { return wave > 0 && wave % 5 === 0; }
export function speedMultiplier(wave) { return 1 + Math.min(1.1, 0.06 * (wave - 1)); }
export function waveCount(wave) { return Math.min(46, 6 + Math.floor(wave * 2.1)); }
export function spawnInterval(wave) { return Math.max(0.22, 1.05 - 0.05 * wave); }
export function activeCap(wave) { return Math.min(28, 8 + Math.floor(wave * 1.3)); }
export function weaponLevel(wave) { return 1 + (wave >= 3 ? 1 : 0) + (wave >= 7 ? 1 : 0); }
export function comboMultiplier(combo) { return Math.min(COMBO.maxMultiplier, 1 + Math.floor(combo / COMBO.perTier)); }
