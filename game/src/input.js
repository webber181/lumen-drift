// Keyboard and pointer input. Held state (movement, aim, fire) is read each step through
// read(); one-shot presses (confirm, pause, restart, mute, auto-fire toggle, click) are queued
// as bits and handed over by takeActions().
import { H, W } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;
export const ACTION_AUTO = 16;
export const ACTION_CLICK = 32;

const BLOCKED = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function createInput(canvas, toField, onGesture) {
  const keys = new Set();
  let actions = 0;
  let mouseDown = false;
  let aimX = W / 2;
  let aimY = 0;

  function onKeyDown(event) {
    onGesture();
    if (BLOCKED.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyR') actions |= ACTION_RESTART;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    else if (event.code === 'KeyF') actions |= ACTION_AUTO;
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function aimFrom(event) {
    const p = toField(event.clientX, event.clientY);
    aimX = Math.max(0, Math.min(W, p.x));
    aimY = Math.max(0, Math.min(H, p.y));
  }

  function onPointerDown(event) {
    onGesture();
    if (event.button !== 0) return;
    aimFrom(event);
    mouseDown = true;
    actions |= ACTION_CLICK;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Capture can fail for synthetic pointers; dragging still works while inside the window.
    }
  }

  function onPointerMove(event) {
    aimFrom(event);
  }

  function onPointerUp() {
    mouseDown = false;
  }

  function releaseAll() {
    keys.clear();
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', releaseAll);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  const down = (...codes) => codes.some((c) => keys.has(c));

  return {
    /** The held state the world reads every step. */
    read() {
      const moveX = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0);
      const moveY = (down('KeyS', 'ArrowDown') ? 1 : 0) - (down('KeyW', 'ArrowUp') ? 1 : 0);
      return { moveX, moveY, aimX, aimY, fire: mouseDown || keys.has('Space'), dragging: mouseDown };
    },
    takeActions() {
      const a = actions;
      actions = 0;
      return a;
    },
    releaseAll,
  };
}
