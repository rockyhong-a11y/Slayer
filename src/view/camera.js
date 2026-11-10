// One camera, two poses. The world is always 3D; "2D" is the same world seen
// from high above through a narrow lens, and switching views is a dive between
// the two poses rather than a cut -- so the player never loses their bearings.

import * as THREE from 'three';
import { ARENA } from '../game/config.js';

// Top view: how many world units fit down the screen, and the least that must
// fit across it (which takes over on a tall, narrow screen).
const TOP = { fov: 30, depth: 14, minWidth: 14, tilt: 0.21 };
// First person: eye height, and a horizontal field of view held steady across
// screen shapes so a wide phone does not turn into a fisheye.
const EYE = { height: 1.15, horizontalFov: 95, maxVerticalFov: 75 };
const SWITCH_SECONDS = 0.45;

const rad = THREE.MathUtils.degToRad;
const deg = THREE.MathUtils.radToDeg;

/** Follow the player, but stop at the arena's edge instead of showing void. */
function follow(value, view, arena) {
  const slack = (arena - view) / 2 + 1;
  return slack <= 0 ? 0 : Math.max(-slack, Math.min(slack, value));
}

export function createRig(camera) {
  let blend = 0;
  let target = 0;
  const topPos = new THREE.Vector3();
  const eyePos = new THREE.Vector3();
  const topQuat = new THREE.Quaternion();
  const eyeQuat = new THREE.Quaternion();
  const look = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const m = new THREE.Matrix4();

  return {
    /** 0 in the top view, 1 in first person, in between while switching. */
    get blend() { return blend; },
    setMode(mode) { target = mode === '3d' ? 1 : 0; },
    snap() { blend = target; },

    /** yaw: 0 faces north (-z), growing clockwise as seen from above. */
    update(dt, player, yaw, aspect) {
      const move = dt / SWITCH_SECONDS;
      blend = target > blend ? Math.min(target, blend + move) : Math.max(target, blend - move);
      const k = blend * blend * (3 - 2 * blend);

      const depth = Math.max(TOP.depth, TOP.minWidth / aspect);
      const cx = follow(player.x, depth * aspect, ARENA.w);
      const cz = follow(player.z, depth, ARENA.d);
      const height = depth / 2 / Math.tan(rad(TOP.fov / 2));
      topPos.set(cx, height, cz + height * Math.tan(TOP.tilt));
      m.lookAt(topPos, look.set(cx, 0, cz), up);
      topQuat.setFromRotationMatrix(m);

      eyePos.set(player.x, EYE.height, player.z);
      look.set(player.x + Math.sin(yaw), EYE.height, player.z - Math.cos(yaw));
      m.lookAt(eyePos, look, up);
      eyeQuat.setFromRotationMatrix(m);
      const eyeFov = Math.min(
        EYE.maxVerticalFov,
        deg(2 * Math.atan(Math.tan(rad(EYE.horizontalFov / 2)) / aspect)),
      );

      camera.position.lerpVectors(topPos, eyePos, k);
      camera.quaternion.slerpQuaternions(topQuat, eyeQuat, k);
      camera.fov = THREE.MathUtils.lerp(TOP.fov, eyeFov, k);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },
  };
}
