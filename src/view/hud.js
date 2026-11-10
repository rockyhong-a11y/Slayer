// The DOM overlay: title and end screens, the few readouts that are not part
// of the arena, and the view switch. Kept deliberately thin -- in this game the
// real HUD is the level.

import { PLAYER } from '../game/config.js';

const $ = (id) => document.getElementById(id);

// How long the end screen ignores touches, so a thumb still hammering the fire
// stick when the K.O. lands does not skip straight past it.
const END_GUARD_MS = 600;

export function createHud() {
  const hpFill = $('hp').querySelector('.fill');
  const [roundName, roundLeft] = $('round').children;
  let bannerLeft = 0;
  let endShownAt = 0;

  const overlayOpen = () => !$('title').hidden || !$('end').hidden;

  return {
    // pointerdown, not click. A click is a gesture the browser has to decide
    // happened, and on a touchscreen it never does for a second finger while
    // another is down -- which is exactly when this button gets pressed: one
    // thumb on the move stick, the other reaching for the view switch.
    onModeButton(fn) {
      $('mode').addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); });
    },

    onStart(fn) {
      $('title').addEventListener('pointerdown', fn);
      $('end').addEventListener('pointerdown', () => {
        if (performance.now() - endShownAt >= END_GUARD_MS) fn();
      });
      addEventListener('keydown', (e) => { if (e.code === 'Enter' && overlayOpen()) fn(); });
    },

    /** Everything loaded: the title may now promise that a tap does something. */
    ready() { $('go').textContent = 'TAP TO START'; },

    /**
     * Loading failed. The title screen is plain HTML and looks alive either
     * way, so without this a broken load is a game that silently ignores
     * every touch, on a device whose console nobody can see.
     */
    failed(err) {
      $('go').textContent = 'COULD NOT LOAD';
      $('go').classList.add('red');
      $('bootDetail').textContent = String(err?.message ?? err);
      $('bootDetail').hidden = false;
    },

    showGame() {
      $('title').hidden = true;
      $('end').hidden = true;
      $('hud').hidden = false;
    },

    showEnd(title, sub, tone) {
      $('endTitle').textContent = title;
      $('endTitle').className = tone ?? '';
      $('endSub').textContent = sub;
      $('end').hidden = false;
      endShownAt = performance.now();
    },

    setMode(mode) {
      for (const span of $('mode').children) span.classList.toggle('on', span.dataset.mode === mode);
      $('crosshair').hidden = mode !== '3d';
    },

    banner(text, seconds, tone) {
      $('banner').textContent = text;
      $('banner').className = tone ?? '';
      $('banner').hidden = false;
      bannerLeft = seconds;
    },

    update(state, dt) {
      const hp = state.player.hp / PLAYER.hp;
      hpFill.style.width = `${hp * 100}%`;
      $('hp').classList.toggle('low', hp <= 0.3);
      roundName.textContent = `ROUND ${state.round + 1}`;
      roundLeft.textContent = `${state.enemies.length + state.toSpawn.length} LEFT`;
      $('superHint').hidden = !(state.super >= 1 && state.phase === 'fight');
      if (bannerLeft > 0) {
        bannerLeft -= dt;
        if (bannerLeft <= 0) $('banner').hidden = true;
      }
    },
  };
}
