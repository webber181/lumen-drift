// Synthesized WebAudio engine: no external assets. Context initializes on first user gesture
// with a quiet background hum and a lookahead bass pulse during active play.
import { createRandom } from './random.js';

const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const BASS_SEQ = [55, 55, 55, 65.41, 55, 55, 73.42, 82.41];
const SV = 'setValueAtTime', LR = 'linearRampToValueAtTime', ER = 'exponentialRampToValueAtTime', ST = 'setTargetAtTime';
const SIN = 'sine', TRI = 'triangle', SAW = 'sawtooth', SQR = 'square', BP = 'bandpass';

function ap(p, m, v, t, tc) {
  if (!p) return;
  if (typeof p[m] === 'function') tc === undefined ? p[m](v, t) : p[m](v, t, tc);
  else if (typeof p[SV] === 'function') p[SV](v, t);
  else p.value = v;
}

const wire = (a, b) => a?.connect?.(b);

export function createAudio(seed) {
  const rng = createRandom(seed ^ 0x5eed);
  let ctx = null, master = null, humGain = null, pulseGain = null, bassFilter = null, noise = null;
  let muted = false, paused = false, nextBeatTime = -1, beatStep = 0;
  const last = {};

  const ready = () => ctx !== null && ctx.state !== 'closed';
  const running = () => ready() && (ctx.state === undefined || ctx.state === 'running');
  const nowTime = () => (ctx && Number.isFinite(ctx.currentTime) ? ctx.currentTime : 0);
  const glide = (node, v, tc) => ap(node?.gain, ST, v, nowTime(), tc);

  function mkFilter(type, freq, q = 1) {
    const f = ctx.createBiquadFilter?.();
    if (!f) return null;
    f.type = type;
    if (f.frequency) f.frequency.value = freq;
    if (f.Q) f.Q.value = q;
    return f;
  }

  /** Create or resume the audio context. Call from a user gesture. */
  function unlock() {
    if (!ctx) {
      const host = typeof window !== 'undefined' ? window : globalThis;
      const Ctor = host.AudioContext || host.webkitAudioContext;
      if (!Ctor) return;
      try {
        ctx = new Ctor();
        master = ctx.createGain();
        ap(master.gain, SV, muted ? 0 : 0.55, nowTime());
        const comp = ctx.createDynamicsCompressor?.();
        if (comp) {
          if (comp.threshold) comp.threshold.value = -14;
          if (comp.ratio) comp.ratio.value = 6;
          wire(master, comp);
          wire(comp, ctx.destination);
        } else wire(master, ctx.destination);
        const sr = Number.isFinite(ctx.sampleRate) && ctx.sampleRate > 0 ? ctx.sampleRate : 44100;
        const len = Math.floor(sr * 1.2);
        noise = ctx.createBuffer?.(1, len, sr) || null;
        const data = noise?.getChannelData?.(0);
        if (data) for (let i = 0; i < len; i += 1) data[i] = rng() * 2 - 1;
        startHum();
        ensureBass();
      } catch {
        ctx = master = humGain = pulseGain = bassFilter = null;
        return;
      }
    }
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      try { Promise.resolve(ctx.resume()).catch(() => {}); } catch { /* ignore */ }
    }
  }

  function startHum() {
    if (!ctx?.createGain || !ctx?.createOscillator || !master) return;
    humGain = ctx.createGain();
    ap(humGain.gain, SV, 0.0001, nowTime());
    const filter = mkFilter('lowpass', 260);
    if (filter) wire(filter, humGain);
    wire(humGain, master);
    const dest = filter || humGain;
    for (const [type, freq, level] of [[SIN, 55, 0.5], [TRI, 82.6, 0.22], [SIN, 55.7, 0.4], [SIN, 110.3, 0.1]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      if (o.frequency) o.frequency.value = freq;
      if (g.gain) g.gain.value = level;
      wire(o, g);
      wire(g, dest);
      o.start?.(nowTime());
    }
    if (filter) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      if (lfo.frequency) lfo.frequency.value = 0.11;
      if (lg.gain) lg.gain.value = 70;
      wire(lfo, lg);
      wire(lg, filter.frequency);
      lfo.start?.(nowTime());
    }
    glide(humGain, paused ? 0.03 : 0.085, 1.5);
  }

  function ensureBass() {
    if (pulseGain || !ctx?.createGain || !master) return;
    pulseGain = ctx.createGain();
    ap(pulseGain.gain, SV, 0.0001, nowTime());
    wire(pulseGain, master);
    bassFilter = mkFilter('lowpass', 185, 1.6);
    if (bassFilter) wire(bassFilter, pulseGain);
  }

  function gate(name, minGap) {
    const now = nowTime();
    if (last[name] !== undefined && now - last[name] < minGap) return false;
    last[name] = now;
    return true;
  }

  function tone(type, from, to = 0, dur = 0.2, vol = 0.2, delay = 0, attack = 0.005, startAt, dest) {
    if (!ctx?.createOscillator || !ctx?.createGain) return;
    const t0 = (startAt ?? nowTime()) + delay;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type;
    ap(osc.frequency, SV, from, t0);
    ap(osc.frequency, ER, Math.max(1, to || from), t0 + dur);
    ap(g.gain, SV, 0.0001, t0);
    ap(g.gain, LR, vol, t0 + attack);
    ap(g.gain, ER, 0.0001, t0 + dur);
    wire(osc, g);
    wire(g, dest || master);
    osc.start?.(t0);
    osc.stop?.(t0 + dur + 0.05);
  }

  const tones = (rows) => { for (const r of rows) tone(...r); };

  function burst(dur = 0.4, vol = 0.3, from = 2000, to = 200, type = 'lowpass', q = 1, delay = 0) {
    if (!ctx?.createBufferSource || !ctx?.createGain || !noise) return;
    const t0 = nowTime() + delay;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = noise;
    ap(g.gain, SV, vol, t0);
    ap(g.gain, ER, 0.0001, t0 + dur);
    const filter = mkFilter(type, from, q);
    if (filter) {
      ap(filter.frequency, SV, from, t0);
      ap(filter.frequency, ER, Math.max(20, to), t0 + dur);
      wire(src, filter);
      wire(filter, g);
    } else wire(src, g);
    wire(g, master);
    src.start?.(t0);
    src.stop?.(t0 + dur + 0.05);
  }

  function arp(freqs, dur, vol, step, offset = 0, shimmer = 0) {
    freqs.forEach((f, i) => {
      const d = offset + i * step;
      tone(TRI, f, 0, dur, vol, d);
      if (shimmer > 0) tone(SIN, f * 2, 0, dur * 0.8, shimmer, d);
    });
  }

  function scheduleBassStep(t0, step, danger) {
    ensureBass();
    const dest = bassFilter || pulseGain || master;
    if (!dest) return;
    const freq = BASS_SEQ[step % BASS_SEQ.length];
    const accent = step === 0 ? 1 : step === 4 ? 0.82 : (step & 1) === 0 ? 0.65 : 0.44;
    const dur = step === 0 ? 0.21 : (step & 1) === 0 ? 0.17 : 0.12;
    const vol = (0.04 + 0.028 * accent) * (1 + 0.18 * danger);
    tone(TRI, freq * 1.01, freq, dur, vol, 0, 0.006, t0, dest);
    if (step === 0 || step === 4) tone(SIN, 55, 0, dur + 0.03, vol * 0.65, 0, 0.008, t0, dest);
  }

  const stopPulse = (tc) => { nextBeatTime = -1; glide(pulseGain, 0.0001, tc); };

  const sounds = {
    laser(rapid) {
      if (!gate('laser', 0.05)) return;
      tones([[SAW, rapid ? 1250 : 1050, 260, 0.1, 0.05], [SQR, 640, 180, 0.08, 0.025]]);
    },
    hitEnemy() { if (gate('hitEnemy', 0.04)) burst(0.06, 0.06, 5000, 1800, BP, 2); },
    explosion(size) {
      if (!gate('explosion', 0.03)) return;
      const k = Math.min(1.6, 0.6 + (Number.isFinite(size) ? size : 18) / 40);
      burst(0.35 + 0.3 * k, 0.28 * k, 2600, 90);
      tones([[SIN, 150, 38, 0.4 + 0.2 * k, 0.3 * k], [TRI, 420, 60, 0.22, 0.08]]);
    },
    pickup(combo) {
      const c = Number.isFinite(combo) ? combo : 1;
      const f = 523.25 * 2 ** (PENTATONIC[Math.min(PENTATONIC.length - 1, Math.max(0, c - 1) % PENTATONIC.length)] / 12);
      tones([[SIN, f, 0, 0.14, 0.12], [TRI, f * 1.5, 0, 0.16, 0.07, 0.05]]);
    },
    powerup(kind) {
      if (!gate('powerup', 0.03)) return;
      if (kind === 'hull') {
        tones([[SIN, 440, 0, 0.3, 0.13, 0], [TRI, 554.37, 0, 0.28, 0.065, 0.03], [SIN, 659.25, 0, 0.3, 0.13, 0.1], [TRI, 880, 0, 0.28, 0.065, 0.13]]);
      } else if (kind === 'shield') {
        tones([[SIN, 260, 780, 0.32, 0.13], [TRI, 390, 1170, 0.3, 0.07, 0.03], [SIN, 1046.5, 0, 0.26, 0.09, 0.14]]);
        burst(0.28, 0.1, 600, 2800, BP, 5);
      } else {
        tone(SIN, 261.63, 0, 0.24, 0.1);
        arp([523.25, 659.25, 783.99, 1046.5, 1318.51], 0.19, 0.09, 0.045, 0, 0.03);
      }
    },
    hit() { burst(0.5, 0.4, 1800, 70); tones([[SAW, 260, 40, 0.5, 0.2], [SQR, 90, 35, 0.4, 0.12]]); },
    shieldBreak() { burst(0.4, 0.2, 800, 4000, BP, 3); tone(SIN, 300, 1500, 0.3, 0.14); },
    shieldReady() { tones([[SIN, 880, 0, 0.18, 0.12], [SIN, 1320, 0, 0.3, 0.1, 0.09]]); },
    waveClear() {
      arp([523.25, 659.25, 783.99, 1046.5, 1318.51], 0.34, 0.13, 0.095, 0, 0.04);
      tones([[SIN, 523.25, 0, 0.52, 0.07, 0.4], [SIN, 783.99, 0, 0.52, 0.07, 0.4]]);
    },
    waveStart() { tones([[SIN, 220, 330, 0.35, 0.1], [TRI, 330, 495, 0.35, 0.06, 0.1]]); },
    elite() {
      for (let i = 0; i < 3; i += 1) tone(SQR, 110, 98, 0.22, 0.12, i * 0.26);
      burst(0.8, 0.1, 200, 900, BP, 2);
    },
    eliteWarn() {
      if (!gate('eliteWarn', 0.25)) return;
      for (const d of [0, 0.24]) {
        tones([[SAW, 880, 660, 0.14, 0.09, d], [SIN, 1320, 0, 0.1, 0.08, d]]);
        burst(0.12, 0.09, 2200, 1400, BP, 6, d);
      }
      tones([[TRI, 55, 125, 0.3, 0.15], [SIN, 125, 48, 0.36, 0.15, 0.25]]);
    },
    eliteDown() { arp([392, 523.25, 659.25, 783.99, 1046.5], 0.4, 0.12, 0.09, 0.1); },
    split() {
      if (!gate('split', 0.04)) return;
      burst(0.09, 0.13, 6200, 1200, BP, 3.5);
      tones([[SIN, 2093, 1046.5, 0.11, 0.09], [TRI, 2637, 1396.9, 0.12, 0.06, 0.025]]);
    },
    sniperShot() {
      if (!gate('sniperShot', 0.04)) return;
      tones([[SAW, 2400, 130, 0.13, 0.1, 0, 0.002], [TRI, 280, 75, 0.11, 0.11]]);
      burst(0.09, 0.14, 5200, 750, BP, 2.5);
    },
    bossNova() {
      if (!gate('bossNova', 0.06)) return;
      tones([[SAW, 135, 40, 0.55, 0.12], [SAW, 141, 42, 0.55, 0.11], [SIN, 88, 28, 0.65, 0.22], [TRI, 520, 110, 0.36, 0.1, 0.03]]);
      burst(0.55, 0.24, 3000, 95);
    },
    repair() { tone(SIN, 600, 1200, 0.3, 0.1, 0.3); },
    enemyShot() { tone(SAW, 330, 110, 0.25, 0.07); },
    nearMiss() { burst(0.5, 0.18, 3500, 300, BP, 4); tone(SIN, 1200, 500, 0.4, 0.06); },
    gameOver() {
      tones([[SAW, 440, 50, 1.5, 0.18], [SIN, 220, 30, 1.8, 0.2]]);
      burst(1.2, 0.3, 3000, 60);
      glide(humGain, 0.03, 0.3);
      stopPulse(0.08);
    },
    start() { tones([[TRI, 330, 660, 0.25, 0.14], [SIN, 660, 990, 0.3, 0.1, 0.1]]); },
    laserRapid() { sounds.laser(true); },
  };

  return {
    unlock,
    /** Play the sound for one world event ({ type, value }). */
    play(event) { if (event && running() && !muted) sounds[event.type]?.(event.value); },
    cue(name, value) { if (ready() && !muted) sounds[name]?.(value); },
    setMuted(value) {
      muted = Boolean(value);
      if (muted) stopPulse(0.02);
      glide(master, muted ? 0 : 0.55, 0.02);
    },
    isMuted: () => muted,
    setPaused(value) {
      paused = Boolean(value);
      if (paused) stopPulse(0.06);
      glide(humGain, paused ? 0.03 : 0.085, 0.2);
    },
    resumeHum() { glide(humGain, paused ? 0.03 : 0.085, 0.3); },
    /** Advance lookahead scheduling for the subtle active-play bass pulse. */
    tick(_dt, inPlay, dangerLevel = 0) {
      if (!running() || muted || paused || !inPlay) { stopPulse(0.06); return; }
      const now = nowTime();
      ensureBass();
      glide(pulseGain, 1, 0.04);
      const danger = Math.max(0, Math.min(1, Number(dangerLevel) || 0));
      if (bassFilter) {
        ap(bassFilter.frequency, ST, 185 + danger * 95, now, 0.12);
        ap(bassFilter.Q, ST, 1.6 + danger * 1.4, now, 0.12);
      }
      const stepDur = 30 / (118 + danger * 8);
      if (nextBeatTime < 0 || nextBeatTime < now - 0.15) nextBeatTime = now;
      for (let i = 0; i < 4 && nextBeatTime <= now + 0.12; i += 1) {
        scheduleBassStep(nextBeatTime, beatStep, danger);
        nextBeatTime += stepDur;
        beatStep = (beatStep + 1) & 7;
      }
    },
  };
}
