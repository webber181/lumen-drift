// A small seeded random number generator (mulberry32): the same seed gives the same game,
// which is what makes the screenshot scenes repeatable. Every random choice in the game,
// gameplay, particles, background and audio noise alike, comes from one of these.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max). */
export function range(rng, min, max) {
  return min + (max - min) * rng();
}

/** -1 or 1. */
export function sign(rng) {
  return rng() < 0.5 ? -1 : 1;
}

/** One element of a non-empty array. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}
