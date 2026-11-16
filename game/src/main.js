// Fixed-timestep 60 Hz loop between title, play, paused and game over screens.
// ?seed=N fixes RNG; ?shot=start|play|end stages a fixed frame and sets window.__shotReady.
import { DEFAULT_SEED, STEP } from './config.js';
import { createWorld } from './world.js';
import {
  ACTION_AUTO, ACTION_CLICK, ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput,
} from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const OVER_DELAY = 1.05;
const OVER_LOCK = 1.65;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : DEFAULT_SEED;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas, seed);

function runShot(name) {
  const view = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, view);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const audio = createAudio(seed);
  const input = createInput(canvas, renderer.toField, () => audio.unlock());
  const view = { screen: SCREEN_TITLE, time: 0, best: 0, overTime: 0, muted: false };
  let runs = 0;
  let accumulator = 0;
  let last = performance.now();

  const announce = (msg) => { if (status) status.textContent = msg; };

  function setScreen(screen) {
    view.screen = screen;
    canvas.style.cursor = screen === SCREEN_PLAY ? 'none' : 'default';
    audio.setPaused(screen === SCREEN_PAUSED);
  }

  function pauseGame() {
    if (view.screen !== SCREEN_PLAY) return;
    setScreen(SCREEN_PAUSED);
    announce('Paused. Press P or click to resume.');
  }

  function startGame() {
    world.reset(runs === 0 ? seed : seed + runs * 7919);
    runs += 1;
    accumulator = 0;
    view.overTime = 0;
    input.releaseAll();
    input.takeActions();
    setScreen(SCREEN_PLAY);
    audio.cue('start');
    audio.resumeHum();
    announce(`Playing. Wave ${world.state.wave}. ${world.state.hull} hull.`);
  }

  function endGame() {
    const s = world.state;
    s.newBest = s.score > view.best;
    if (s.newBest) view.best = s.score;
    view.overTime = -OVER_DELAY;
    setScreen(SCREEN_OVER);
    announce(`Game over. Score ${s.score}. Best ${view.best}. Press R or click to restart.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (!actions) return;
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      view.muted = audio.isMuted();
      announce(view.muted ? 'Audio muted.' : 'Audio unmuted.');
    }
    if (actions & ACTION_AUTO && view.screen !== SCREEN_TITLE) {
      world.state.autoFire = !world.state.autoFire;
      announce(world.state.autoFire ? 'Auto-fire on.' : 'Auto-fire off.');
    }
    const start = actions & (ACTION_CONFIRM | ACTION_CLICK | ACTION_RESTART);
    if (view.screen === SCREEN_TITLE) {
      if (start) startGame();
    } else if (view.screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) pauseGame();
      else if (actions & ACTION_RESTART) startGame();
    } else if (view.screen === SCREEN_PAUSED) {
      if (actions & ACTION_RESTART) startGame();
      else if (actions & (ACTION_PAUSE | ACTION_CONFIRM | ACTION_CLICK)) {
        setScreen(SCREEN_PLAY);
        input.releaseAll();
        announce(`Playing. Wave ${world.state.wave}.`);
      }
    } else if (view.screen === SCREEN_OVER && start && view.overTime > OVER_LOCK - OVER_DELAY) {
      startGame();
    }
  }

  window.addEventListener('blur', pauseGame);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

  function step() {
    const events = world.state.events;
    world.step(STEP, input.read());
    for (const { type, value } of events) {
      audio.play({ type, value });
      if (type === 'gameOver' && view.screen === SCREEN_PLAY) endGame();
      else if (view.screen === SCREEN_PLAY) {
        const s = world.state;
        if (type === 'waveClear') announce(`Wave ${value || s.wave} cleared. Score ${s.score}.`);
        else if (type === 'waveStart' && value > 1) announce(`Wave ${value}.`);
        else if (type === 'eliteWarn' || (type === 'elite' && value > 0)) announce(`Elite incoming on wave ${value}.`);
        else if (type === 'powerup') announce(`Power-up: ${value}.`);
      }
    }
    events.length = 0;
  }

  function frame(now) {
    const dt = Math.min(MAX_FRAME, Math.max(0, (now - last) / 1000));
    last = now;
    view.time += dt;
    handleActions();
    if (view.screen === SCREEN_PLAY || view.screen === SCREEN_OVER) {
      accumulator += dt;
      while (accumulator >= STEP) {
        step();
        accumulator -= STEP;
      }
    }
    if (view.screen === SCREEN_OVER) view.overTime += dt;
    audio.tick(dt, view.screen === SCREEN_PLAY, world.state.hull === 1 ? 1 : 0);
    renderer.draw(world.state, view);
    requestAnimationFrame(frame);
  }

  setScreen(SCREEN_TITLE);
  announce('Lumen Drift. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
