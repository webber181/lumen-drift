// Boot and the one loop. Input is read each step, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one) and the renderer paints what is there. The game
// moves between four screens: title, play, paused and game over.
//
// ?seed=N fixes every random choice. ?shot=start|play|end (with &seed=N) stages one fixed scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { DEFAULT_SEED, STEP } from './config.js';
import { createWorld } from './world.js';
import {
  ACTION_AUTO, ACTION_CLICK, ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput,
} from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** Seconds after the ship is lost before the game over card appears, and before it accepts restart. */
const OVER_DELAY = 0.9;
const OVER_LOCK = 1.5;

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

  function announce(message) {
    status.textContent = message;
  }

  function setScreen(screen) {
    view.screen = screen;
    canvas.style.cursor = screen === SCREEN_PLAY ? 'none' : 'default';
    audio.setPaused(screen === SCREEN_PAUSED);
  }

  function startGame() {
    world.reset(runs === 0 ? seed : seed + runs * 7919);
    runs += 1;
    accumulator = 0;
    view.overTime = 0;
    input.releaseAll();
    input.takeActions();
    audio.cue('start');
    audio.resumeHum();
    setScreen(SCREEN_PLAY);
    announce('Playing. Wave 1. 3 hull.');
  }

  function endGame() {
    const state = world.state;
    state.newBest = state.score > view.best;
    if (state.newBest) view.best = state.score;
    view.overTime = -OVER_DELAY;
    setScreen(SCREEN_OVER);
    announce(`Game over. Score ${state.score}. Best ${view.best}. Press R or click to restart.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (!actions) return;
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      view.muted = audio.isMuted();
    }
    if (actions & ACTION_AUTO && view.screen !== SCREEN_TITLE) {
      world.state.autoFire = !world.state.autoFire;
      announce(world.state.autoFire ? 'Auto-fire on.' : 'Auto-fire off.');
    }
    const start = actions & (ACTION_CONFIRM | ACTION_CLICK | ACTION_RESTART);
    if (view.screen === SCREEN_TITLE) {
      if (start) startGame();
    } else if (view.screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        setScreen(SCREEN_PAUSED);
        announce('Paused.');
      } else if (actions & ACTION_RESTART) startGame();
    } else if (view.screen === SCREEN_PAUSED) {
      if (actions & ACTION_RESTART) startGame();
      else if (actions & (ACTION_PAUSE | ACTION_CONFIRM | ACTION_CLICK)) {
        setScreen(SCREEN_PLAY);
        input.releaseAll();
        announce('Playing.');
      }
    } else if (view.screen === SCREEN_OVER) {
      if (start && view.overTime > OVER_LOCK - OVER_DELAY) startGame();
    }
  }

  function pauseIfPlaying() {
    if (view.screen === SCREEN_PLAY) {
      setScreen(SCREEN_PAUSED);
      announce('Paused.');
    }
  }
  window.addEventListener('blur', pauseIfPlaying);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseIfPlaying();
  });

  function step() {
    const events = world.state.events;
    world.step(STEP, input.read());
    for (const event of events) {
      audio.play(event);
      if (event.type === 'gameOver' && view.screen === SCREEN_PLAY) endGame();
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
    renderer.draw(world.state, view);
    requestAnimationFrame(frame);
  }

  setScreen(SCREEN_TITLE);
  announce('Lumen Drift. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
