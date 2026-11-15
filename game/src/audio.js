// All sound is synthesized with WebAudio: no audio files. The context is created on the first
// user gesture (browsers require it), which also starts a quiet background hum. Noise comes
// from the seeded rng so even the audio is reproducible.
import { createRandom } from './random.js';

const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export function createAudio(seed) {
  const rng = createRandom(seed ^ 0x5eed);
  let ctx = null;
  let master = null;
  let humGain = null;
  let noise = null;
  let muted = false;
  let paused = false;
  const last = {};

  function ready() {
    return ctx !== null && ctx.state !== 'closed';
  }

  /** Create or resume the audio context. Call from a user gesture. */
  function unlock() {
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      try {
        ctx = new Ctor();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 6;
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.55;
        master.connect(comp);
        comp.connect(ctx.destination);
        const length = Math.floor(ctx.sampleRate * 1.2);
        noise = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < length; i += 1) data[i] = rng() * 2 - 1;
        startHum();
      } catch {
        ctx = null;
        return;
      }
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function startHum() {
    humGain = ctx.createGain();
    humGain.gain.value = 0.0001;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    filter.connect(humGain);
    humGain.connect(master);
    for (const [type, freq, level] of [['sine', 55, 0.5], ['triangle', 82.6, 0.22], ['sine', 55.7, 0.4], ['sine', 110.3, 0.1]]) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.value = level;
      osc.connect(g);
      g.connect(filter);
      osc.start();
    }
    // A slow swell so the hum breathes.
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.11;
    lfoGain.gain.value = 70;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    humGain.gain.setTargetAtTime(0.085, ctx.currentTime, 1.5);
  }

  function gate(name, minGap) {
    const now = ctx.currentTime;
    if (last[name] !== undefined && now - last[name] < minGap) return false;
    last[name] = now;
    return true;
  }

  function tone({ type = 'sine', from, to = from, dur = 0.2, vol = 0.2, delay = 0, attack = 0.005 }) {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function burst({ dur = 0.4, vol = 0.3, from = 2000, to = 200, type = 'lowpass', q = 1, delay = 0 }) {
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  const sounds = {
    laser(rapid) {
      if (!gate('laser', 0.05)) return;
      tone({ type: 'sawtooth', from: rapid ? 1250 : 1050, to: 260, dur: 0.1, vol: 0.05 });
      tone({ type: 'square', from: 640, to: 180, dur: 0.08, vol: 0.025 });
    },
    hitEnemy() {
      if (!gate('hitEnemy', 0.04)) return;
      burst({ dur: 0.06, vol: 0.06, from: 5000, to: 1800, type: 'bandpass', q: 2 });
    },
    explosion(size) {
      if (!gate('explosion', 0.03)) return;
      const k = Math.min(1.6, 0.6 + size / 40);
      burst({ dur: 0.35 + 0.3 * k, vol: 0.28 * k, from: 2600, to: 90 });
      tone({ type: 'sine', from: 150, to: 38, dur: 0.4 + 0.2 * k, vol: 0.3 * k });
      tone({ type: 'triangle', from: 420, to: 60, dur: 0.22, vol: 0.08 });
    },
    pickup(combo) {
      const step = PENTATONIC[Math.min(PENTATONIC.length - 1, Math.max(0, combo - 1) % PENTATONIC.length)];
      const f = 523.25 * 2 ** (step / 12);
      tone({ type: 'sine', from: f, to: f, dur: 0.14, vol: 0.12 });
      tone({ type: 'triangle', from: f * 1.5, to: f * 1.5, dur: 0.16, vol: 0.07, delay: 0.05 });
    },
    hit() {
      burst({ dur: 0.5, vol: 0.4, from: 1800, to: 70 });
      tone({ type: 'sawtooth', from: 260, to: 40, dur: 0.5, vol: 0.2 });
      tone({ type: 'square', from: 90, to: 35, dur: 0.4, vol: 0.12 });
    },
    shieldBreak() {
      burst({ dur: 0.4, vol: 0.2, from: 800, to: 4000, type: 'bandpass', q: 3 });
      tone({ type: 'sine', from: 300, to: 1500, dur: 0.3, vol: 0.14 });
    },
    shieldReady() {
      tone({ type: 'sine', from: 880, to: 880, dur: 0.18, vol: 0.12 });
      tone({ type: 'sine', from: 1320, to: 1320, dur: 0.3, vol: 0.1, delay: 0.09 });
    },
    waveClear() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        tone({ type: 'triangle', from: f, to: f, dur: 0.32, vol: 0.14, delay: i * 0.11 });
        tone({ type: 'sine', from: f * 2, to: f * 2, dur: 0.25, vol: 0.04, delay: i * 0.11 });
      });
    },
    waveStart() {
      tone({ type: 'sine', from: 220, to: 330, dur: 0.35, vol: 0.1 });
      tone({ type: 'triangle', from: 330, to: 495, dur: 0.35, vol: 0.06, delay: 0.1 });
    },
    elite() {
      for (let i = 0; i < 3; i += 1) tone({ type: 'square', from: 110, to: 98, dur: 0.22, vol: 0.12, delay: i * 0.26 });
      burst({ dur: 0.8, vol: 0.1, from: 200, to: 900, type: 'bandpass', q: 2 });
    },
    eliteDown() {
      [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ type: 'triangle', from: f, to: f, dur: 0.4, vol: 0.12, delay: 0.1 + i * 0.09 }));
    },
    repair() {
      tone({ type: 'sine', from: 600, to: 1200, dur: 0.3, vol: 0.1, delay: 0.3 });
    },
    enemyShot() {
      tone({ type: 'sawtooth', from: 330, to: 110, dur: 0.25, vol: 0.07 });
    },
    nearMiss() {
      burst({ dur: 0.5, vol: 0.18, from: 3500, to: 300, type: 'bandpass', q: 4 });
      tone({ type: 'sine', from: 1200, to: 500, dur: 0.4, vol: 0.06 });
    },
    gameOver() {
      tone({ type: 'sawtooth', from: 440, to: 50, dur: 1.5, vol: 0.18 });
      tone({ type: 'sine', from: 220, to: 30, dur: 1.8, vol: 0.2 });
      burst({ dur: 1.2, vol: 0.3, from: 3000, to: 60 });
      if (humGain) humGain.gain.setTargetAtTime(0.03, ctx.currentTime, 0.3);
    },
    start() {
      tone({ type: 'triangle', from: 330, to: 660, dur: 0.25, vol: 0.14 });
      tone({ type: 'sine', from: 660, to: 990, dur: 0.3, vol: 0.1, delay: 0.1 });
    },
    laserRapid() {
      sounds.laser(true);
    },
  };

  return {
    unlock,
    /** Play the sound for one world event ({ type, value }). */
    play(event) {
      if (!ready() || muted || ctx.state !== 'running') return;
      const fn = sounds[event.type];
      if (fn) fn(event.value);
    },
    cue(name) {
      if (!ready() || muted) return;
      if (sounds[name]) sounds[name]();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.05);
    },
    isMuted: () => muted,
    setPaused(value) {
      paused = value;
      if (humGain) humGain.gain.setTargetAtTime(paused ? 0.03 : 0.085, ctx.currentTime, 0.2);
    },
    resumeHum() {
      if (humGain) humGain.gain.setTargetAtTime(paused ? 0.03 : 0.085, ctx.currentTime, 0.3);
    },
  };
}
