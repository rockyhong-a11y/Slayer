// Fixed moments for visual QA, opened with ?qa=<name>. Each one arranges the
// state by hand and freezes the simulation, so two screenshots of the same
// scene can be compared and a change in the picture is a change in the code.

import { startGame } from './game/logic.js';
import { ENEMIES } from './game/config.js';

function enemy(state, type, x, z, faceX, faceZ) {
  state.enemies.push({
    id: state.nextId++, type, x, z, hp: ENEMIES[type].hp, cooldown: 1, faceX, faceZ,
  });
}

/** Mid-fight: worn cover, a nearly spent timer, a full super, bullets in the air. */
function brawl(state) {
  startGame(state);
  state.events.length = 0;
  state.phase = 'fight';
  state.toSpawn = ['grunt', 'grunt', 'shooter'];
  state.roundsWon = 1;
  state.round = 1;
  state.player.hp = 64;
  state.hpBars[0].hp = 55;
  state.timer.left = 3.4;
  state.super = 1;
  enemy(state, 'grunt', -3.6, 3.6, -1, 0);
  enemy(state, 'grunt', -1.4, 5.2, -1, 0);
  enemy(state, 'shooter', 1.6, 3.9, -1, 0);
  enemy(state, 'grunt', 3.0, -3.2, -1, 0.3);
  enemy(state, 'shooter', 7.5, -2.0, -1, 0);
  state.bullets.push(
    { from: 'player', x: -6.4, z: 3.6, dx: 1, dz: 0, speed: 24, damage: 10, left: 9 },
    { from: 'player', x: -5.0, z: 3.6, dx: 1, dz: 0, speed: 24, damage: 10, left: 9 },
    { from: 'enemy', x: -1.2, z: 3.8, dx: -1, dz: 0, speed: 8, damage: 8, left: 40 },
  );
  state.player.x = -8.2; state.player.z = 3.6;
  state.player.aimX = 1; state.player.aimZ = 0;
}

/** A live, empty arena: the controls with nothing trying to kill you. */
function sandbox(state) {
  startGame(state);
  state.events.length = 0;
  state.phase = 'fight';
  state.toSpawn = ['grunt'];
  state.spawnCooldown = Infinity; // one spawn held back keeps the round open
  state.timer.left = Infinity;
}

/** Returns true when the simulation should stay frozen. */
export function qaScene(name, state, { setMode, hud }) {
  if (name === 'title') return true;
  if (name === 'sandbox') {
    sandbox(state);
    hud.showGame();
    return false;
  }
  brawl(state);
  hud.showGame();
  if (name === '3d') setMode('3d');
  if (name === 'ko') hud.showEnd('K.O.', 'ROUND 2  /  9 DOWN', 'red');
  if (name === 'won') hud.showEnd('YOU WIN', '32 DOWN');
  return true;
}
