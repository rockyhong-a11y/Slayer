import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fighting } from '../src/game/stage_fighting.js';
import { MODES, PLAYER, ENEMIES, HPBAR, TIMER, SUPER, ROUNDS } from '../src/game/config.js';
import { createGame, startGame, step, barRect, drainEvents } from '../src/game/logic.js';

const DT = 1 / 60;
const IDLE = { moveX: 0, moveZ: 0, aimX: 0, aimZ: 0, firing: false, mode: '2d' };

function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fight with nothing in it. One spawn is held back so the round stays open. */
function emptyFight() {
  const s = createGame(fighting, seeded());
  startGame(s);
  s.phase = 'fight';
  s.toSpawn = ['grunt'];
  s.spawnCooldown = 1e9;
  s.timer.left = 1e9;
  return s;
}

function addEnemy(s, type, x, z) {
  const e = { id: s.nextId++, type, x, z, hp: ENEMIES[type].hp, cooldown: 1e9, faceX: 0, faceZ: 1 };
  s.enemies.push(e);
  return e;
}

function run(s, seconds, input = IDLE) {
  for (let t = 0; t < seconds; t += DT) step(s, input, DT);
}

const enemyBullet = (x, z, dx, dz) => ({ from: 'enemy', x, z, dx, dz, speed: 8, damage: 8, left: 40 });

test('an HP bar is cover whose length is its health, and only enemy fire drains it', () => {
  const s = emptyFight();
  const bar = s.hpBars.find((b) => b.id === 'hpP1');
  const full = barRect(bar);
  assert.ok(Math.abs(full.x1 - bar.tip) < 1e-9, 'a full bar reaches its tip');

  s.bullets.push(enemyBullet(-7, -4, 0, -1));
  run(s, 1);
  assert.equal(bar.hp, HPBAR.hp - HPBAR.damagePerEnemyBullet);
  const worn = barRect(bar);
  assert.ok(worn.x1 < full.x1, 'drains from the tip');
  assert.equal(worn.x0, full.x0, 'stays anchored at the portrait');

  s.player.x = -7; s.player.z = -4;
  run(s, 1, { ...IDLE, aimZ: -1, firing: true });
  assert.equal(bar.hp, HPBAR.hp - HPBAR.damagePerEnemyBullet, 'your own shots do not wear it down');
});

test('standing behind a bar stops bullets until the bar is gone', () => {
  const s = emptyFight();
  s.player.x = -7; s.player.z = -8.5;
  s.bullets.push(enemyBullet(-7, -3, 0, -1));
  run(s, 1.5);
  assert.equal(s.player.hp, PLAYER.hp);

  s.hpBars.find((b) => b.id === 'hpP1').hp = 0;
  s.bullets.push(enemyBullet(-7, -3, 0, -1));
  run(s, 1.5);
  assert.equal(s.player.hp, PLAYER.hp - 8);
});

test('TIME UP kills what stands near the timer and spares what does not', () => {
  const s = emptyFight();
  const near = addEnemy(s, 'shooter', 2, -3);
  const far = addEnemy(s, 'shooter', 12, 6);
  s.timer.left = DT / 2;
  step(s, IDLE, DT);
  assert.ok(!s.enemies.includes(near));
  assert.ok(s.enemies.includes(far));
  assert.equal(s.player.hp, PLAYER.hp, 'the player was out of range');
  assert.ok(Math.abs(s.timer.left - TIMER.seconds) < 1e-9, 'and the clock restarts');

  s.player.x = 0; s.player.z = -3;
  s.timer.left = DT / 2;
  step(s, IDLE, DT);
  assert.equal(s.player.hp, PLAYER.hp - TIMER.playerDamage, 'it does not care whose side you are on');
});

test('a full super gauge fires down the lane from a pad, and only then', () => {
  const s = emptyFight();
  const pad = fighting.pads[0];
  const inLane = addEnemy(s, 'shooter', 0, fighting.lane.z);
  const outside = addEnemy(s, 'shooter', 4.5, -2);
  s.player.x = pad.x; s.player.z = pad.z;

  s.super = 0.8;
  step(s, IDLE, DT);
  assert.ok(s.enemies.includes(inLane), 'not full: nothing happens');
  assert.equal(s.beam, null);

  s.super = 1;
  step(s, IDLE, DT);
  assert.ok(!s.enemies.includes(inLane));
  assert.ok(s.enemies.includes(outside));
  assert.equal(s.beam.dir, pad.dir);
  assert.ok(Math.abs(s.super - SUPER.perKill) < 1e-9, 'spent, then recharged by its own kill');
});

test('3D hits twice as hard and reaches where 2D cannot', () => {
  for (const [mode, expectHp] of [['2d', ENEMIES.shooter.hp], ['3d', ENEMIES.shooter.hp - MODES['3d'].damage]]) {
    const s = emptyFight();
    s.player.x = -11; s.player.z = 4;
    const target = addEnemy(s, 'shooter', 3, 4); // 14 away: past 2D range
    s.timer.left = 1e9;
    step(s, { ...IDLE, aimX: 1, firing: true, mode }, DT);
    target.x = 3; target.z = 4;
    for (let t = 0; t < 1; t += DT) {
      step(s, IDLE, DT);
      target.x = 3; target.z = 4; // hold it still: this test is about the bullet
    }
    assert.equal(target.hp, expectHp, mode);
  }
  assert.equal(MODES['3d'].damage, MODES['2d'].damage * 2);
});

test('a grunt walks around cover to reach the player', () => {
  const s = emptyFight();
  s.player.x = -7; s.player.z = -4;        // south of the P1 bar
  const grunt = addEnemy(s, 'grunt', -7, -8.5); // in the trench behind it
  grunt.cooldown = 0;
  run(s, 12);
  assert.ok(s.player.hp < PLAYER.hp, 'it found the gap and landed a hit');
});

test('an enemy stops at arm\'s length instead of standing inside the player', () => {
  const s = emptyFight();
  const grunt = addEnemy(s, 'grunt', s.player.x + 3, s.player.z);
  const reach = ENEMIES.grunt.radius + PLAYER.radius;
  for (let t = 0; t < 4; t += DT) {
    step(s, IDLE, DT);
    const gap = Math.hypot(grunt.x - s.player.x, grunt.z - s.player.z);
    assert.ok(gap >= reach - 1e-6, `gap ${gap}`);
  }
  assert.ok(Math.hypot(grunt.x - s.player.x, grunt.z - s.player.z) < reach + 0.2, 'but it does close in');
});

test('three rounds won is a win; no health is a K.O.', () => {
  const s = createGame(fighting, seeded());
  startGame(s);
  for (let t = 0; t < 120 && s.phase !== 'won'; t += DT) {
    step(s, IDLE, DT);
    for (const e of s.enemies) e.hp = 0;
  }
  assert.equal(s.phase, 'won');
  assert.equal(s.roundsWon, ROUNDS.length);

  const k = emptyFight();
  k.player.hp = 1;
  const grunt = addEnemy(k, 'grunt', k.player.x + 0.9, k.player.z);
  grunt.cooldown = 0;
  run(k, 1);
  assert.equal(k.phase, 'ko');
});

test('a whole game played by a simple bot ends, with every number still finite', () => {
  const s = createGame(fighting, seeded(7));
  startGame(s);
  const seen = new Set();
  for (let t = 0; t < 600 && s.phase !== 'won' && s.phase !== 'ko'; t += DT) {
    const target = s.enemies[0];
    const input = target
      ? { moveX: -(target.x - s.player.x), moveZ: -(target.z - s.player.z),
          aimX: target.x - s.player.x, aimZ: target.z - s.player.z, firing: true, mode: '3d' }
      : IDLE;
    step(s, input, DT);
    for (const ev of drainEvents(s)) seen.add(ev.type);
  }
  assert.ok(s.phase === 'won' || s.phase === 'ko', `ended in ${s.phase}`);
  for (const v of [s.player.x, s.player.z, s.player.hp, s.super, s.timer.left]) {
    assert.ok(Number.isFinite(v));
  }
  assert.ok(seen.has('kill') && seen.has('shot'));
});
