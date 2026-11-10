// Balance check: how often does a human-ish bot win, by how it uses the views?
//
//   npm run balance
//
// The bot kites and shoots. It aims with jitter, re-picks its target only a few
// times a second, and in 3D sees only its view cone and turns at stick speed.
// It never uses cover, the timer or the super, so its win rate is a floor for a
// player who does. What matters is the ORDER of the three rows: switching views
// should beat staying in either one, or there is no reason to switch.

import { fighting } from '../src/game/stage_fighting.js';
import { createGame, startGame, step, drainEvents, colliders, lineOfSight } from '../src/game/logic.js';
import { ENEMIES, ROUNDS } from '../src/game/config.js';
const DT = 1 / 60, TURN = 2.8, FOV = (95 * Math.PI) / 180;
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// A human-ish player. policy(state) picks the view each frame.
//  - aims with jitter, and re-picks a target only every 0.35s
//  - in 3D sees only what is inside the view cone and can only turn so fast
function play(seed, policy) {
  const rng = seeded(seed * 7919);
  const s = createGame(fighting, seeded(seed)); startGame(s);
  let yaw = Math.PI / 2, think = 0, target = null, jitter = 0, t = 0, mode = '2d';
  for (; t < 400 && s.phase !== 'won' && s.phase !== 'ko'; t += DT) {
    const p = s.player; mode = policy(s, mode);
    const rects = colliders(s);
    const seen = s.enemies.filter((e) => {
      if (mode === '2d') return true;
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      const off = Math.abs(wrap(Math.atan2(e.x - p.x, -(e.z - p.z)) - yaw));
      return d < 1.6 || (off < FOV / 2 && lineOfSight(p.x, p.z, e.x, e.z, rects));
    });
    think -= DT;
    if (think <= 0 || !s.enemies.includes(target)) {
      think = 0.35; jitter = (rng() - 0.5) * 0.42; // about +-12 degrees
      target = seen.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0] ?? null;
    }
    let fx = -p.x * 0.02, fz = -p.z * 0.02;
    for (const e of seen) { const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < 6) { fx += (p.x - e.x) / (d * d); fz += (p.z - e.z) / (d * d); } }
    let want = target ? Math.atan2(target.x - p.x, -(target.z - p.z)) + jitter : yaw + 1;
    if (mode === '3d') { const diff = wrap(want - yaw); yaw += Math.max(-TURN * DT, Math.min(TURN * DT, diff)); } else yaw = want;
    step(s, { moveX: fx * 10, moveZ: fz * 10, aimX: Math.sin(yaw), aimZ: -Math.cos(yaw), firing: Boolean(target), mode }, DT);
    drainEvents(s);
  }
  return { phase: s.phase, round: s.round + 1, t };
}
const policies = {
  'always 2D': () => '2d',
  'always 3D': () => '3d',
  // 3D to burn down a lone target, 2D whenever a crowd is close.
  'switches': (s) => (s.enemies.filter((e) => Math.hypot(e.x - s.player.x, e.z - s.player.z) < 5).length >= 2 ? '2d' : '3d'),
};
console.log(`60 games per policy.  grunt ${JSON.stringify(ENEMIES.grunt)}\nshooter ${JSON.stringify(ENEMIES.shooter)}\nrounds ${JSON.stringify(ROUNDS)}\n`);
for (const [label, policy] of Object.entries(policies)) {
  const runs = Array.from({ length: 60 }, (_, i) => play(i + 1, policy));
  const wins = runs.filter((r) => r.phase === 'won').length;
  const reach = [2, 3].map((n) => runs.filter((r) => r.round >= n).length);
  const avgT = runs.filter((r) => r.phase === 'won').reduce((a, r) => a + r.t, 0) / Math.max(1, wins);
  console.log(`  ${label.padEnd(10)} wins ${String(wins).padStart(2)}/60   reached round 2/3: ${reach.join('/')}   avg win ${avgT.toFixed(0)}s`);
}
