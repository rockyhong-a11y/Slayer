// Draws the game state. Reads it, never changes it: everything that happens
// is decided in game/logic.js and arrives here as state plus events.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ARENA, HPBAR, TIMER, SUPER } from '../game/config.js';
import { barRect } from '../game/logic.js';
import { canvasTexture, drawLabel } from './art.js';

const MODELS = ['fighter', 'grunt', 'shooter', 'portrait_frame', 'timer_housing', 'pad'];
const BULLET_HEIGHT = 0.9;
const GOLD = new THREE.Color(0xffd23f);
const RED = new THREE.Color(0xff3b4e);

/** A box that stands on the ground instead of straddling it. */
function block(w, h, d, material) {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(0, h / 2, 0);
  return new THREE.Mesh(geo, material);
}

function flat(w, d, material, y) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

export async function createWorld(stage, art, camera) {
  const loader = new GLTFLoader();
  const models = Object.fromEntries(await Promise.all(
    MODELS.map(async (name) => [name, (await loader.loadAsync(`models/${name}.glb`)).scene]),
  ));

  const scene = new THREE.Scene();
  scene.background = art.backdrop;
  scene.fog = new THREE.Fog(0x1a1038, 200, 400);
  scene.add(camera); // so the first-person weapon, a child of the camera, is drawn
  scene.add(new THREE.HemisphereLight(0xffffff, 0x30345c, 1.7));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(-6, 14, 8);
  scene.add(sun);

  // ---- the stage -------------------------------------------------------------

  scene.add(flat(ARENA.w, ARENA.d, new THREE.MeshStandardMaterial({ map: art.floor, roughness: 0.9 }), 0));

  // The screen's bezel.
  const bezel = new THREE.MeshStandardMaterial({ color: 0x2a2f5a, roughness: 0.7 });
  for (const [w, d, x, z] of [
    [ARENA.w + 1, 0.5, 0, -ARENA.d / 2 - 0.25], [ARENA.w + 1, 0.5, 0, ARENA.d / 2 + 0.25],
    [0.5, ARENA.d, -ARENA.w / 2 - 0.25, 0], [0.5, ARENA.d, ARENA.w / 2 + 0.25, 0],
  ]) {
    const wall = block(w, 1.4, d, bezel);
    wall.position.set(x, 0, z);
    scene.add(wall);
  }

  for (const p of stage.portraits) {
    const frame = models.portrait_frame.clone();
    frame.scale.set(p.w, p.h, p.d);
    frame.position.set(p.x, 0, p.z);
    scene.add(frame);
    const face = new THREE.MeshBasicMaterial({ map: p.id.endsWith('P1') ? art.portraitP1 : art.portraitP2 });
    const top = flat(p.w * 0.84, p.d * 0.84, face, p.h * 0.965);
    top.position.x = p.x; top.position.z = p.z;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(p.w * 0.84, p.h * 0.84), face);
    front.position.set(p.x, p.h * 0.5, p.z + p.d * 0.476);
    scene.add(top, front);
  }

  const bars = stage.hpBars.map((def) => {
    const length = Math.abs(def.tip - def.anchor);
    const tray = block(length + 0.2, 0.1, def.d + 0.3, new THREE.MeshStandardMaterial({ color: 0x0b0d1a }));
    tray.position.set((def.anchor + def.tip) / 2, 0, def.z);
    const material = new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0.25, roughness: 0.4 });
    const fill = block(1, def.h, def.d, material);
    fill.position.z = def.z;
    scene.add(tray, fill);
    return { id: def.id, fill, material };
  });

  // Timer: one canvas of digits shared by every face.
  const t = stage.timer;
  const housing = models.timer_housing.clone();
  housing.scale.set(t.w, t.h, t.d);
  housing.position.set(t.x, 0, t.z);
  scene.add(housing);
  const digitCanvas = document.createElement('canvas');
  digitCanvas.width = 256; digitCanvas.height = 160;
  const digitTex = canvasTexture(digitCanvas);
  const digitMat = new THREE.MeshBasicMaterial({ map: digitTex });
  const digitTop = flat(t.w * 0.74, t.d * 0.7, digitMat, t.h + 0.02);
  digitTop.position.x = t.x; digitTop.position.z = t.z;
  scene.add(digitTop);
  for (const [dx, dz, turn, width] of [
    [0, 1, 0, t.w], [0, -1, Math.PI, t.w], [1, 0, Math.PI / 2, t.d], [-1, 0, -Math.PI / 2, t.d],
  ]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.8, t.h * 0.6), digitMat);
    face.position.set(t.x + dx * t.w * 0.486, t.h * 0.5, t.z + dz * t.d * 0.486);
    face.rotation.y = turn;
    scene.add(face);
  }
  let shownDigits = null;
  function drawDigits(seconds) {
    if (seconds === shownDigits) return;
    shownDigits = seconds;
    const ctx = digitCanvas.getContext('2d');
    ctx.fillStyle = '#0b0d1a';
    ctx.fillRect(0, 0, 256, 160);
    ctx.fillStyle = seconds <= 5 ? '#ff3b4e' : '#ffd23f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic 800 132px system-ui, sans-serif';
    ctx.fillText(String(seconds).padStart(2, '0'), 128, 88);
    digitTex.needsUpdate = true;
  }

  // Blast radius, on the floor: a ring always, a filling disc as time runs out.
  const ringMat = new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.3, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(TIMER.radius - 0.14, TIMER.radius, 64), ringMat);
  const dangerMat = new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0, depthWrite: false });
  const danger = new THREE.Mesh(new THREE.CircleGeometry(TIMER.radius, 64), dangerMat);
  for (const mesh of [ring, danger]) {
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(t.x, mesh === ring ? 0.04 : 0.03, t.z);
    scene.add(mesh);
  }

  const letterSide = new THREE.MeshStandardMaterial({ color: 0x2b3170, roughness: 0.6 });
  for (const l of stage.letters) {
    const label = new THREE.MeshStandardMaterial({
      map: canvasTexture(drawLabel(l.ch, { w: 196, h: 256 })), roughness: 0.6,
    });
    // Box faces: +x -x +y -y +z -z. The letter goes on top and on both long sides.
    const mesh = block(l.w, l.h, l.d, [letterSide, letterSide, label, letterSide, label, label]);
    mesh.position.set(l.x, 0, l.z);
    scene.add(mesh);
  }

  const gauges = stage.gauges.map((g, i) => {
    const length = g.x1 - g.x0;
    const base = block(length, g.h, g.d, new THREE.MeshStandardMaterial({ color: 0x18204a, roughness: 0.5 }));
    base.position.set((g.x0 + g.x1) / 2, 0, g.z);
    const material = new THREE.MeshStandardMaterial({ color: 0x3fd0ff, emissive: 0x3fd0ff, emissiveIntensity: 0.6 });
    const fill = block(1, g.h + 0.08, g.d * 0.6, material);
    fill.position.z = g.z;
    scene.add(base, fill);
    // Each gauge fills away from its own corner, toward the middle.
    return { fill, material, from: i === 0 ? g.x0 : g.x1, dir: i === 0 ? 1 : -1, length };
  });

  const padGlow = new THREE.MeshBasicMaterial({ color: 0x3fd0ff, transparent: true, opacity: 0.15, depthWrite: false });
  for (const p of stage.pads) {
    const pad = models.pad.clone();
    pad.scale.set(p.r, 1, p.r);
    pad.position.set(p.x, 0, p.z);
    const glow = new THREE.Mesh(new THREE.RingGeometry(p.r * 0.95, p.r * 1.3, 40), padGlow);
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(p.x, 0.05, p.z);
    scene.add(pad, glow);
  }

  const lampOff = new THREE.MeshStandardMaterial({ color: 0x23284d });
  const lampOn = new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 1.2 });
  const lamps = stage.roundLamps.map((l) => {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 24), lampOff);
    lamp.position.set(l.x, 0.04, l.z);
    scene.add(lamp);
    return lamp;
  });

  const beamMat = new THREE.MeshBasicMaterial({ color: 0x9be8ff, transparent: true, opacity: 0, depthWrite: false });
  const beam = block(ARENA.w, 1.7, stage.lane.halfWidth * 2, beamMat);
  beam.position.z = stage.lane.z;
  beam.visible = false;
  scene.add(beam);

  // ---- things that move --------------------------------------------------------

  const shadowGeo = new THREE.CircleGeometry(0.5, 20);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
  function character(name) {
    const group = new THREE.Group();
    group.add(models[name].clone());
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    group.add(shadow);
    scene.add(group);
    return group;
  }

  const player = character('fighter');
  const enemies = new Map(); // id -> { group, flash }

  const bulletGeo = new THREE.SphereGeometry(0.14, 10, 8);
  const bulletMats = {
    player: new THREE.MeshBasicMaterial({ color: 0xfff1a8 }),
    enemy: new THREE.MeshBasicMaterial({ color: 0xff4fd8 }),
  };
  const bullets = [];

  // First-person weapon: a glove and a barrel, riding the camera.
  const weapon = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.4), new THREE.MeshStandardMaterial({ color: 0x4a5296 }));
  const glove = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), new THREE.MeshStandardMaterial({ color: 0xeb2a35, roughness: 0.4 }));
  glove.position.set(0, -0.05, 0.16);
  weapon.add(barrel, glove);
  weapon.position.set(0.2, -0.17, -0.6);
  camera.add(weapon);
  let kick = 0;

  // Short-lived effects: each is a mesh plus a function of its age (0..1).
  const effects = [];
  function effect(mesh, seconds, animate) {
    scene.add(mesh);
    effects.push({ mesh, seconds, age: 0, animate });
  }
  function puff(x, z, color, size) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), mat);
    mesh.position.set(x, BULLET_HEIGHT, z);
    effect(mesh, 0.25, (k) => { mesh.scale.setScalar(0.4 + k * size); mat.opacity = 1 - k; });
  }

  let clock = 0;

  return {
    scene,

    onEvent(ev) {
      if (ev.type === 'kill') puff(ev.x, ev.z, ev.enemy === 'grunt' ? 0xff6a5c : 0x7dffb0, 4);
      else if (ev.type === 'barHit') puff(ev.x, ev.z, 0xffd23f, 1.6);
      else if (ev.type === 'wallHit') puff(ev.x, ev.z, 0xffffff, 1);
      else if (ev.type === 'enemyHit') { const e = enemies.get(ev.id); if (e) e.flash = 1; }
      else if (ev.type === 'shot') kick = 1;
      else if (ev.type === 'timeUp') {
        const mat = new THREE.MeshBasicMaterial({ color: RED, transparent: true, side: THREE.DoubleSide, depthWrite: false });
        const wave = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 64), mat);
        wave.rotation.x = -Math.PI / 2;
        wave.position.set(t.x, 0.5, t.z);
        effect(wave, 0.45, (k) => { wave.scale.setScalar(Math.max(0.01, k * TIMER.radius)); mat.opacity = 1 - k * k; });
      }
    },

    /** blend: 0 in the top view, 1 in first person. */
    sync(state, dt, blend) {
      clock += dt;
      const firstPerson = blend > 0.6;

      const p = state.player;
      player.position.set(p.x, 0, p.z);
      player.rotation.y = Math.atan2(p.aimX, p.aimZ);
      player.visible = !firstPerson;

      weapon.visible = firstPerson;
      kick = Math.max(0, kick - dt * 9);
      weapon.position.z = -0.6 + kick * 0.09;

      // Close fog is what makes first person feel like a corridor shooter; the
      // top view sits far above the floor and must stay clear.
      scene.fog.near = THREE.MathUtils.lerp(200, 8, blend);
      scene.fog.far = THREE.MathUtils.lerp(400, 55, blend);

      const alive = new Set();
      for (const e of state.enemies) {
        alive.add(e.id);
        let view = enemies.get(e.id);
        if (!view) {
          view = { group: character(e.type), flash: 0 };
          enemies.set(e.id, view);
        }
        view.flash = Math.max(0, view.flash - dt * 8);
        view.group.position.set(e.x, Math.abs(Math.sin(clock * 9 + e.id)) * 0.06, e.z);
        view.group.rotation.y = Math.atan2(e.faceX, e.faceZ);
        view.group.scale.setScalar(1 + view.flash * 0.25);
      }
      for (const [id, view] of enemies) {
        if (alive.has(id)) continue;
        scene.remove(view.group);
        enemies.delete(id);
      }

      while (bullets.length < state.bullets.length) {
        const mesh = new THREE.Mesh(bulletGeo, bulletMats.player);
        scene.add(mesh);
        bullets.push(mesh);
      }
      bullets.forEach((mesh, i) => {
        const b = state.bullets[i];
        mesh.visible = Boolean(b);
        if (!b) return;
        mesh.material = bulletMats[b.from];
        mesh.scale.setScalar(b.from === 'enemy' ? 1.5 : firstPerson ? 0.45 : 1);
        mesh.position.set(b.x, BULLET_HEIGHT, b.z);
        // Seen from behind the muzzle, your own fresh shots would fill the screen.
        if (firstPerson && b.from === 'player' && Math.hypot(b.x - p.x, b.z - p.z) < 1.6) mesh.visible = false;
      });

      state.hpBars.forEach((bar, i) => {
        const rect = barRect(bar);
        const view = bars[i];
        view.fill.visible = bar.hp > 0;
        view.fill.scale.x = Math.max(0.001, rect.x1 - rect.x0);
        view.fill.position.x = (rect.x0 + rect.x1) / 2;
        view.material.color.lerpColors(RED, GOLD, bar.hp / HPBAR.hp);
        view.material.emissive.copy(view.material.color);
      });

      const seconds = Math.ceil(Math.max(0, state.timer.left));
      drawDigits(seconds);
      const urgent = state.phase === 'fight' && state.timer.left <= 5;
      const pulse = 0.5 + 0.5 * Math.sin(clock * 14);
      ringMat.opacity = urgent ? 0.45 + 0.5 * pulse : 0.3;
      dangerMat.opacity = urgent ? 0.1 + 0.16 * pulse : 0;

      const full = state.super >= 1;
      for (const g of gauges) {
        const len = Math.max(0.001, g.length * state.super);
        g.fill.visible = state.super > 0;
        g.fill.scale.x = len;
        g.fill.position.x = g.from + (g.dir * len) / 2;
        g.material.emissiveIntensity = full ? 1.2 + pulse : 0.6;
      }
      padGlow.opacity = full ? 0.5 + 0.5 * pulse : 0.15;

      lamps.forEach((lamp, i) => { lamp.material = i < state.roundsWon ? lampOn : lampOff; });

      beam.visible = Boolean(state.beam);
      if (state.beam) beamMat.opacity = 0.85 * (state.beam.left / SUPER.beamSeconds);

      for (let i = effects.length - 1; i >= 0; i--) {
        const fx = effects[i];
        fx.age += dt;
        const k = Math.min(1, fx.age / fx.seconds);
        fx.animate(k);
        if (k >= 1) {
          scene.remove(fx.mesh);
          fx.mesh.geometry.dispose();
          fx.mesh.material.dispose();
          effects.splice(i, 1);
        }
      }
    },
  };
}
