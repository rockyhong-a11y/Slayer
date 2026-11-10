// Touch smoke test: play the real build the way a phone would.
//
//   npm run build && npm run smoke
//
// Screenshots of frozen scenes cannot show that the controls work. This starts
// a game with a tap, then drives both thumbsticks with real multi-touch events,
// switches view and back, and checks the game state responded each time.
//
// The controls are exercised in ?qa=sandbox, an arena with no enemies: a test
// of the thumbsticks must not pass or fail on how a fight happened to go.

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');

const PORT = 4174;
const BASE = `http://127.0.0.1:${PORT}/`;
const W = 844, H = 390;

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('preview server did not start');
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
const problems = [];
try {
  await waitForServer();
  mkdirSync('qa_shots', { recursive: true });
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const context = await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
  const cdp = await context.newCDPSession(page);

  // Every touch currently on the glass, so two thumbs can be down at once.
  const down = new Map();
  const touch = (type) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: [...down].map(([id, p]) => ({ id, x: p.x, y: p.y })),
  });
  async function press(id, x, y) { down.set(id, { x, y }); await touch('touchStart'); }
  async function drag(id, x, y) { down.set(id, { x, y }); await touch('touchMove'); }
  // CDP cannot lift one finger of several: leaving a point out of a move does
  // not release it. So thumbs come up together, with an empty touchEnd.
  async function liftAll() { down.clear(); await touch('touchEnd'); }

  const game = () => page.evaluate(() => {
    const { state, mode } = window.__slayer;
    return {
      mode, phase: state.phase, hp: state.player.hp, x: state.player.x, z: state.player.z,
      aimX: state.player.aimX, aimZ: state.player.aimZ,
      bullets: state.bullets.filter((b) => b.from === 'player').length,
    };
  });

  await page.goto(BASE);
  await page.waitForFunction(() => window.__slayer, null, { timeout: 30000 });
  check('opens on the title screen', (await game()).phase === 'title');

  await page.touchscreen.tap(W / 2, H / 2);
  await page.waitForFunction(() => window.__slayer.state.phase === 'fight', null, { timeout: 10000 });
  check('a tap starts the game and the round reaches FIGHT', true);

  await page.goto(`${BASE}?qa=sandbox`);
  await page.waitForFunction(() => window.__slayer?.state.phase === 'fight', null, { timeout: 30000 });

  // Left thumb: move right and down.
  const before = await game();
  await press(1, 150, 250);
  await drag(1, 200, 290);
  await page.waitForTimeout(900);
  const moved = await game();
  check('left thumb moves the player', moved.x > before.x + 1 && moved.z > before.z + 1,
    `dx ${(moved.x - before.x).toFixed(1)}, dz ${(moved.z - before.z).toFixed(1)}`);

  // Right thumb, while the left is still down: aim up and fire.
  await press(2, 650, 250);
  await drag(2, 650, 200);
  // Wait for a bullet rather than sampling at a fixed moment: a shot lives a
  // third of a second, so a single late look can land between two of them.
  const shot = await page.waitForFunction(
    () => window.__slayer.state.bullets.some((b) => b.from === 'player'), null, { timeout: 5000 },
  ).then(() => true, () => false);
  const firing = await game();
  check('right thumb aims and fires while moving', shot && firing.aimZ < -0.9,
    `aim z ${firing.aimZ.toFixed(2)}`);
  await liftAll();

  // Switch to first person with the on-screen button.
  await page.touchscreen.tap(W - 40, 30);
  await page.waitForTimeout(750);
  const fp = await game();
  check('the view button switches to 3D', fp.mode === '3d');
  check('the switch keeps the heading', fp.aimZ < -0.9, `aim z ${fp.aimZ.toFixed(2)}`);
  await page.screenshot({ path: 'qa_shots/live-3d.png' });

  // In first person the right thumb turns.
  // A short hold: held too long the view would come all the way round, and
  // "is it facing east" would stop meaning "did it turn right".
  await press(3, 650, 250);
  await drag(3, 706, 250);
  await page.waitForTimeout(200);
  await liftAll();
  const turned = await game();
  check('right thumb turns the view right in 3D', turned.aimX > 0.2,
    `aim x ${turned.aimX.toFixed(2)}, phase ${turned.phase}, hp ${turned.hp}`);

  // Left thumb forward now means "the way I am facing", not "north". Stand in
  // open ground first: wherever the earlier checks left the player, a wall in
  // the way would stop the walk and say nothing about the stick.
  await page.evaluate(() => Object.assign(window.__slayer.state.player, { x: -13, z: 3.4 }));
  turned.x = -13; turned.z = 3.4;
  await press(4, 150, 250);
  await drag(4, 150, 194);
  await page.waitForTimeout(600);
  const walked = await game();
  await liftAll();
  const ahead = (walked.x - turned.x) * turned.aimX + (walked.z - turned.z) * turned.aimZ;
  check('left thumb forward walks where the view faces', ahead > 1, `${ahead.toFixed(1)} units ahead`);

  await page.touchscreen.tap(W - 90, 30);
  await page.waitForTimeout(700);
  check('and the button switches back to 2D', (await game()).mode === '2d');
  await page.screenshot({ path: 'qa_shots/live-2d.png' });

  // The way it is really pressed: one thumb still holding the move stick, the
  // other reaching for the button. Browsers send no click for that second finger.
  await press(5, 150, 250);
  await drag(5, 200, 250);
  await press(6, W - 40, 30);
  await page.waitForTimeout(300);
  const midMove = await game();
  await liftAll();
  check('the view button works while a thumb is on the move stick', midMove.mode === '3d');

  await browser.close();
} finally {
  server.kill();
}

check('no page errors', problems.length === 0, problems.join(' | '));
const failed = checks.filter((c) => !c.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed ? 1 : 0);
