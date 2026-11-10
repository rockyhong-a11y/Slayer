import * as THREE from 'three';
import { fighting } from './game/stage_fighting.js';
import { createGame, startGame, step, drainEvents } from './game/logic.js';
import { loadArt } from './view/art.js';
import { createWorld } from './view/world.js';
import { createRig } from './view/camera.js';
import { createInput } from './view/input.js';
import { createHud } from './view/hud.js';
import { qaScene } from './qa.js';

const TURN_RATE = 2.8;       // first-person turn, rad/s at full stick
const MOUSE_TURN = 0.0028;   // rad per pixel of locked-mouse travel
const AIM_DEADZONE = 0.3;    // how far the aim stick must move before it fires
const STEP = 1 / 60;         // the rules always advance in steps of this size
const MAX_CATCH_UP = 0.25;   // a stalled tab resumes, it does not fast-forward

const canvas = document.getElementById('game');
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);
const stage = fighting;
const state = createGame(stage);
const hud = createHud();

// The two steps that depend on the device and the host: getting a WebGL
// context, and fetching models and art. Either can fail, and must say so.
let renderer, world;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  world = await createWorld(stage, await loadArt(stage), camera);
} catch (err) {
  hud.failed(err);
  throw err;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const rig = createRig(camera);
const input = createInput(canvas);

let mode = '2d';
let yaw = 0;      // first-person heading: 0 faces north, growing clockwise
let frozen = false;

function setMode(next) {
  if (next === mode) return;
  // Carry the heading across, so the switch never spins the player around.
  if (next === '3d') yaw = Math.atan2(state.player.aimX, -state.player.aimZ);
  else if (document.pointerLockElement) document.exitPointerLock();
  mode = next;
  rig.setMode(mode);
  hud.setMode(mode);
}

hud.onModeButton(() => setMode(mode === '2d' ? '3d' : '2d'));
hud.onStart(() => { startGame(state); hud.showGame(); });

canvas.addEventListener('mousedown', () => {
  if (mode !== '3d' || document.pointerLockElement) return;
  // Optional nicety; a browser that refuses the lock still turns with the arrow keys.
  try { Promise.resolve(canvas.requestPointerLock?.()).catch(() => {}); } catch { /* unsupported */ }
});

const ray = new THREE.Raycaster();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const point = new THREE.Vector3();

/** Turn this frame's sticks into the world-space intent the rules understand. */
function intent(pad, dt) {
  if (mode === '3d') {
    yaw += pad.lookX * TURN_RATE * dt + pad.mouseTurn * MOUSE_TURN;
    const fx = Math.sin(yaw), fz = -Math.cos(yaw);
    const forward = -pad.moveY, strafe = pad.moveX;
    return {
      moveX: fx * forward - fz * strafe, moveZ: fz * forward + fx * strafe,
      aimX: fx, aimZ: fz, firing: pad.lookHeld || pad.fireKey, mode,
    };
  }
  let aimX = 0, aimZ = 0, firing = pad.fireKey;
  if (pad.lookHeld) {
    if (Math.hypot(pad.lookX, pad.lookY) > AIM_DEADZONE) { aimX = pad.lookX; aimZ = pad.lookY; firing = true; }
  } else if (pad.mouseNdc) {
    ray.setFromCamera(pad.mouseNdc, camera);
    if (ray.ray.intersectPlane(ground, point)) {
      aimX = point.x - state.player.x; aimZ = point.z - state.player.z;
    }
  }
  return { moveX: pad.moveX, moveZ: pad.moveY, aimX, aimZ, firing, mode };
}

function announce(ev) {
  if (ev.type === 'roundStart') hud.banner(`ROUND ${ev.round + 1}`, 1.0);
  else if (ev.type === 'fight') hud.banner('FIGHT!', 0.7);
  else if (ev.type === 'timeUp') hud.banner('TIME UP!', 0.8, 'red');
  else if (ev.type === 'super') hud.banner('SUPER!', 0.8, 'cyan');
  else if (ev.type === 'ko') hud.showEnd('K.O.', `ROUND ${state.round + 1}  /  ${state.kills} DOWN`, 'red');
  else if (ev.type === 'won') hud.showEnd('YOU WIN', `${state.kills} DOWN`);
}

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
}
addEventListener('resize', resize);
resize();

let last = performance.now();
let backlog = 0;
function frame(now) {
  const dt = Math.min(MAX_CATCH_UP, (now - last) / 1000);
  last = now;

  const pad = input.read();
  if (pad.toggle) setMode(mode === '2d' ? '3d' : '2d');
  // Game time follows the clock, not the frame rate: a phone drawing 20 frames
  // a second plays the same game as one drawing 60, just less smoothly.
  if (!frozen) {
    const want = intent(pad, dt);
    backlog += dt;
    while (backlog >= STEP) {
      step(state, want, STEP);
      backlog -= STEP;
    }
  }
  for (const ev of drainEvents(state)) {
    world.onEvent(ev);
    announce(ev);
  }

  rig.update(dt, state.player, yaw, innerWidth / innerHeight);
  world.sync(state, frozen ? 0 : dt, rig.blend);
  hud.update(state, dt);
  renderer.render(world.scene, camera);
  requestAnimationFrame(frame);
}

// ?qa=<scene> poses a fixed, frozen moment so a screenshot shows the same
// thing every time. See src/qa.js.
const scene = new URLSearchParams(location.search).get('qa');
if (scene) {
  frozen = qaScene(scene, state, { setMode, hud });
  rig.snap();
}

// A handle for tools/ scripts; the game itself never reads it.
window.__slayer = { state, setMode, get mode() { return mode; } };

hud.ready();
requestAnimationFrame(frame);
