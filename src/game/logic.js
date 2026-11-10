// The whole game as plain data and one step function. Nothing here knows about
// three.js, the DOM or touch, so the rules can be run and tested headlessly;
// the view only reads this state and plays back `events`.

import { ARENA, PLAYER, MODES, ENEMIES, HPBAR, TIMER, SUPER, ROUND, ROUNDS } from './config.js';

const HALF_W = ARENA.w / 2;
const HALF_D = ARENA.d / 2;
const CELL = 1;
const COLS = ARENA.w / CELL;
const ROWS = ARENA.d / CELL;
const UNREACHED = 32767;
const FIELD_REFRESH = 0.2;
const BULLET_STEP = 0.25;

export function createGame(stage, rng = Math.random) {
  const state = {
    stage,
    rng,
    phase: 'title', // title -> intro -> fight -> (intro ...) -> won | ko
    phaseTime: 0,
    round: 0,
    roundsWon: 0,
    toSpawn: [],
    spawnCooldown: 0,
    spawnIndex: 0,
    player: {
      x: stage.playerStart.x, z: stage.playerStart.z,
      hp: PLAYER.hp, aimX: 1, aimZ: 0, fireCooldown: 0,
    },
    enemies: [],
    bullets: [],
    hpBars: stage.hpBars.map((def) => ({ ...def, hp: HPBAR.hp })),
    timer: { left: TIMER.seconds },
    super: 0,
    beam: null,
    field: { dist: new Int16Array(COLS * ROWS).fill(UNREACHED), age: Infinity },
    events: [],
    kills: 0,
    nextId: 1,
  };
  return state;
}

export function startGame(state) {
  state.roundsWon = 0;
  state.kills = 0;
  state.super = 0;
  state.player.hp = PLAYER.hp;
  state.player.x = state.stage.playerStart.x;
  state.player.z = state.stage.playerStart.z;
  startRound(state, 0);
}

function startRound(state, index) {
  state.round = index;
  state.phase = 'intro';
  state.phaseTime = ROUND.introSeconds;
  state.enemies.length = 0;
  state.bullets.length = 0;
  state.beam = null;
  state.timer.left = TIMER.seconds;
  // Bars refill every round, the way they do in a fighting game.
  for (const bar of state.hpBars) bar.hp = HPBAR.hp;

  const plan = ROUNDS[index];
  const queue = [];
  for (const type of Object.keys(plan)) {
    for (let i = 0; i < plan[type]; i++) queue.push(type);
  }
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(state.rng() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  state.toSpawn = queue;
  state.spawnCooldown = 0;
  state.events.push({ type: 'roundStart', round: index });
}

/** Hand over what happened since the last call, for effects and banners. */
export function drainEvents(state) {
  return state.events.splice(0);
}

// ---- geometry ---------------------------------------------------------------

/** The part of an HP bar that is still standing: its length is its health. */
export function barRect(bar) {
  const dir = Math.sign(bar.tip - bar.anchor);
  const end = bar.anchor + dir * Math.abs(bar.tip - bar.anchor) * Math.max(0, bar.hp) / HPBAR.hp;
  return {
    x0: Math.min(bar.anchor, end), x1: Math.max(bar.anchor, end),
    z0: bar.z - bar.d / 2, z1: bar.z + bar.d / 2,
  };
}

function boxRect(s) {
  return { x0: s.x - s.w / 2, x1: s.x + s.w / 2, z0: s.z - s.d / 2, z1: s.z + s.d / 2 };
}

/**
 * Everything that stops a body. `low` ones stop a walk but not a bullet;
 * `bar` points back at the HP bar a rect belongs to, so a hit can drain it.
 */
export function colliders(state) {
  const { stage } = state;
  const out = [];
  for (const p of stage.portraits) out.push(boxRect(p));
  out.push(boxRect(stage.timer));
  for (const l of stage.letters) out.push(boxRect(l));
  for (const bar of state.hpBars) {
    if (bar.hp > 0) out.push({ ...barRect(bar), bar });
  }
  for (const g of stage.gauges) {
    out.push({ x0: g.x0, x1: g.x1, z0: g.z - g.d / 2, z1: g.z + g.d / 2, low: true });
  }
  return out;
}

function pointInRect(x, z, r, pad = 0) {
  return x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
}

/** Move a circle, then push it back out of anything it ended up inside. */
function moveCircle(body, radius, dx, dz, rects) {
  body.x += dx;
  body.z += dz;
  for (let pass = 0; pass < 2; pass++) {
    for (const r of rects) {
      const nx = Math.max(r.x0, Math.min(body.x, r.x1));
      const nz = Math.max(r.z0, Math.min(body.z, r.z1));
      let ox = body.x - nx;
      let oz = body.z - nz;
      const d2 = ox * ox + oz * oz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        body.x = nx + (ox / d) * radius;
        body.z = nz + (oz / d) * radius;
      } else {
        // Centre is inside the rect: leave by the nearest face.
        const left = body.x - r.x0, right = r.x1 - body.x;
        const top = body.z - r.z0, bottom = r.z1 - body.z;
        const m = Math.min(left, right, top, bottom);
        if (m === left) body.x = r.x0 - radius;
        else if (m === right) body.x = r.x1 + radius;
        else if (m === top) body.z = r.z0 - radius;
        else body.z = r.z1 + radius;
      }
    }
  }
  body.x = Math.max(-HALF_W + radius, Math.min(HALF_W - radius, body.x));
  body.z = Math.max(-HALF_D + radius, Math.min(HALF_D - radius, body.z));
}

/** Can a bullet travel straight from a to b? */
export function lineOfSight(ax, az, bx, bz, rects) {
  const dx = bx - ax, dz = bz - az;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.3));
  for (let i = 1; i < steps; i++) {
    const x = ax + (dx * i) / steps, z = az + (dz * i) / steps;
    for (const r of rects) {
      if (!r.low && pointInRect(x, z, r)) return false;
    }
  }
  return true;
}

// ---- pathing ----------------------------------------------------------------

const cellOf = (x, z) => ({
  cx: Math.max(0, Math.min(COLS - 1, Math.floor((x + HALF_W) / CELL))),
  cz: Math.max(0, Math.min(ROWS - 1, Math.floor((z + HALF_D) / CELL))),
});
const cellCentre = (cx, cz) => ({ x: -HALF_W + (cx + 0.5) * CELL, z: -HALF_D + (cz + 0.5) * CELL });

/**
 * Walking distance from every cell to the player, by flood fill. Cover moves
 * and shrinks, so this is rebuilt a few times a second rather than baked.
 */
function rebuildField(state, rects) {
  const { dist } = state.field;
  const blocked = new Uint8Array(COLS * ROWS);
  for (let cz = 0; cz < ROWS; cz++) {
    for (let cx = 0; cx < COLS; cx++) {
      const c = cellCentre(cx, cz);
      for (const r of rects) {
        if (pointInRect(c.x, c.z, r, 0.4)) { blocked[cz * COLS + cx] = 1; break; }
      }
    }
  }
  dist.fill(UNREACHED);
  const start = cellOf(state.player.x, state.player.z);
  const queue = [start.cz * COLS + start.cx];
  dist[queue[0]] = 0;
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const cx = i % COLS, cz = (i - cx) / COLS;
    for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + ox, nz = cz + oz;
      if (nx < 0 || nz < 0 || nx >= COLS || nz >= ROWS) continue;
      const n = nz * COLS + nx;
      if (blocked[n] || dist[n] !== UNREACHED) continue;
      dist[n] = dist[i] + 1;
      queue.push(n);
    }
  }
  state.field.age = 0;
}

/** Unit direction an enemy should walk to get closer to the player. */
function fieldDirection(state, body) {
  const { dist } = state.field;
  const here = cellOf(body.x, body.z);
  let best = dist[here.cz * COLS + here.cx];
  let target = null;
  for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = here.cx + ox, nz = here.cz + oz;
    if (nx < 0 || nz < 0 || nx >= COLS || nz >= ROWS) continue;
    const d = dist[nz * COLS + nx];
    if (d < best) { best = d; target = cellCentre(nx, nz); }
  }
  // Already in the player's cell, or walled in: just head straight for them.
  if (!target || best === 0) target = state.player;
  const dx = target.x - body.x, dz = target.z - body.z;
  const len = Math.hypot(dx, dz) || 1;
  return { x: dx / len, z: dz / len };
}

// ---- step -------------------------------------------------------------------

/**
 * Advance the game by dt seconds.
 * input: { moveX, moveZ, aimX, aimZ, firing, mode } -- move and aim are in
 * world space; turning a joystick or a first-person yaw into them is the
 * caller's job.
 */
export function step(state, input, dt) {
  if (state.phase !== 'intro' && state.phase !== 'fight') return;

  const rects = colliders(state);
  const { player } = state;

  // -- player
  const moveLen = Math.hypot(input.moveX, input.moveZ);
  if (moveLen > 0.01) {
    const scale = (PLAYER.speed * dt) / Math.max(1, moveLen);
    moveCircle(player, PLAYER.radius, input.moveX * scale, input.moveZ * scale, rects);
  }
  const aimLen = Math.hypot(input.aimX, input.aimZ);
  if (aimLen > 0.01) {
    player.aimX = input.aimX / aimLen;
    player.aimZ = input.aimZ / aimLen;
  }

  if (state.phase === 'intro') {
    state.phaseTime -= dt;
    if (state.phaseTime <= 0) {
      state.phase = 'fight';
      state.events.push({ type: 'fight' });
    }
    return;
  }

  player.fireCooldown -= dt;
  if (input.firing && player.fireCooldown <= 0) {
    const mode = MODES[input.mode] ?? MODES['2d'];
    player.fireCooldown = PLAYER.fireInterval;
    state.bullets.push({
      from: 'player',
      x: player.x + player.aimX * 0.6, z: player.z + player.aimZ * 0.6,
      dx: player.aimX, dz: player.aimZ,
      speed: PLAYER.bulletSpeed, damage: mode.damage, left: mode.range,
    });
    state.events.push({ type: 'shot' });
  }

  // -- spawning
  state.spawnCooldown -= dt;
  if (state.toSpawn.length && state.spawnCooldown <= 0) {
    const type = state.toSpawn.pop();
    const at = state.stage.spawns[state.spawnIndex++ % state.stage.spawns.length];
    state.enemies.push({
      id: state.nextId++, type, x: at.x, z: at.z,
      hp: ENEMIES[type].hp, cooldown: ENEMIES[type].fireInterval ?? 0, faceX: -1, faceZ: 0,
    });
    state.spawnCooldown = ROUND.spawnInterval;
  }

  // -- enemies
  state.field.age += dt;
  if (state.field.age >= FIELD_REFRESH) rebuildField(state, rects);

  for (const e of state.enemies) {
    const spec = ENEMIES[e.type];
    const toX = player.x - e.x, toZ = player.z - e.z;
    const gap = Math.hypot(toX, toZ) || 1;
    e.cooldown -= dt;

    let advancing = true;
    if (e.type === 'shooter' && gap <= spec.keepDistance
      && lineOfSight(e.x, e.z, player.x, player.z, rects)) {
      advancing = false;
      e.faceX = toX / gap; e.faceZ = toZ / gap;
      if (e.cooldown <= 0) {
        e.cooldown = spec.fireInterval;
        state.bullets.push({
          from: 'enemy',
          x: e.x + e.faceX * 0.6, z: e.z + e.faceZ * 0.6,
          dx: e.faceX, dz: e.faceZ,
          speed: spec.bulletSpeed, damage: spec.bulletDamage, left: 40,
        });
        state.events.push({ type: 'enemyShot', id: e.id });
      }
    }
    if (advancing) {
      const dir = fieldDirection(state, e);
      e.faceX = dir.x; e.faceZ = dir.z;
      moveCircle(e, spec.radius, dir.x * spec.speed * dt, dir.z * spec.speed * dt, rects);
    }
    // Bodies do not overlap. An enemy stops at arm's length instead of walking
    // into the player -- which in first person means into the camera.
    const reach = spec.radius + PLAYER.radius;
    const sx = e.x - player.x, sz = e.z - player.z;
    const sep = Math.hypot(sx, sz);
    if (sep < reach && sep > 1e-6) {
      e.x = player.x + (sx / sep) * reach;
      e.z = player.z + (sz / sep) * reach;
    }
    if (e.type === 'grunt' && gap <= spec.radius + PLAYER.radius + 0.15 && e.cooldown <= 0) {
      e.cooldown = spec.touchInterval;
      hurtPlayer(state, spec.touchDamage);
    }
  }

  // Keep the crowd from stacking into one body.
  for (let i = 0; i < state.enemies.length; i++) {
    for (let j = i + 1; j < state.enemies.length; j++) {
      const a = state.enemies[i], b = state.enemies[j];
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      const min = ENEMIES[a.type].radius + ENEMIES[b.type].radius;
      if (d >= min || d < 1e-6) continue;
      const push = (min - d) / 2;
      a.x -= (dx / d) * push; a.z -= (dz / d) * push;
      b.x += (dx / d) * push; b.z += (dz / d) * push;
    }
  }

  // -- bullets
  for (const b of state.bullets) {
    let travel = b.speed * dt;
    while (travel > 0 && !b.dead) {
      const s = Math.min(BULLET_STEP, travel);
      travel -= s;
      b.x += b.dx * s; b.z += b.dz * s;
      b.left -= s;
      if (b.left <= 0 || Math.abs(b.x) > HALF_W || Math.abs(b.z) > HALF_D) { b.dead = true; break; }

      const wall = rects.find((r) => !r.low && pointInRect(b.x, b.z, r));
      if (wall) {
        b.dead = true;
        // Only enemy fire wears cover down; your own shots just stop.
        if (wall.bar && b.from === 'enemy') {
          wall.bar.hp = Math.max(0, wall.bar.hp - HPBAR.damagePerEnemyBullet);
          state.events.push({ type: 'barHit', id: wall.bar.id, x: b.x, z: b.z });
        } else {
          state.events.push({ type: 'wallHit', x: b.x, z: b.z });
        }
        break;
      }

      if (b.from === 'player') {
        const hit = state.enemies.find(
          (e) => e.hp > 0 && Math.hypot(e.x - b.x, e.z - b.z) <= ENEMIES[e.type].radius,
        );
        if (hit) {
          b.dead = true;
          hit.hp -= b.damage;
          state.events.push({ type: 'enemyHit', id: hit.id, x: b.x, z: b.z });
        }
      } else if (Math.hypot(player.x - b.x, player.z - b.z) <= PLAYER.radius) {
        b.dead = true;
        hurtPlayer(state, b.damage);
      }
    }
  }
  state.bullets = state.bullets.filter((b) => !b.dead);

  // -- the timer bomb
  state.timer.left -= dt;
  if (state.timer.left <= 0) {
    const t = state.stage.timer;
    for (const e of state.enemies) {
      if (Math.hypot(e.x - t.x, e.z - t.z) <= TIMER.radius) e.hp = 0;
    }
    if (Math.hypot(player.x - t.x, player.z - t.z) <= TIMER.radius) {
      hurtPlayer(state, TIMER.playerDamage);
    }
    state.timer.left = TIMER.seconds;
    state.events.push({ type: 'timeUp' });
  }

  // -- the super lane
  if (state.beam) {
    state.beam.left -= dt;
    if (state.beam.left <= 0) state.beam = null;
  }
  if (state.super >= 1 && !state.beam) {
    const pad = state.stage.pads.find(
      (p) => Math.hypot(player.x - p.x, player.z - p.z) <= p.r + PLAYER.radius,
    );
    if (pad) {
      const { lane } = state.stage;
      for (const e of state.enemies) {
        if (Math.abs(e.z - lane.z) <= lane.halfWidth + ENEMIES[e.type].radius) e.hp = 0;
      }
      state.super = 0;
      state.beam = { dir: pad.dir, left: SUPER.beamSeconds };
      state.events.push({ type: 'super', dir: pad.dir });
    }
  }

  // -- deaths
  for (const e of state.enemies) {
    if (e.hp > 0) continue;
    state.kills++;
    // A kill from the beam still charges the next one, just like any other.
    state.super = Math.min(1, state.super + SUPER.perKill);
    state.events.push({ type: 'kill', id: e.id, x: e.x, z: e.z, enemy: e.type });
  }
  state.enemies = state.enemies.filter((e) => e.hp > 0);

  // -- round flow
  if (player.hp <= 0) {
    state.phase = 'ko';
    state.events.push({ type: 'ko' });
    return;
  }
  if (!state.toSpawn.length && !state.enemies.length) {
    state.roundsWon++;
    state.events.push({ type: 'roundWon', round: state.round });
    if (state.round + 1 >= ROUNDS.length) {
      state.phase = 'won';
      state.events.push({ type: 'won' });
    } else {
      player.hp = Math.min(PLAYER.hp, player.hp + ROUND.healOnWin);
      startRound(state, state.round + 1);
    }
  }
}

function hurtPlayer(state, amount) {
  state.player.hp = Math.max(0, state.player.hp - amount);
  state.events.push({ type: 'playerHurt', amount });
}
