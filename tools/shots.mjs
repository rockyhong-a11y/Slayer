// Visual QA: build output -> real browser -> screenshots of fixed scenes.
//
//   npm run build && npm run shots          -> qa_shots/*.png
//
// Opens each ?qa= scene (src/qa.js) at a phone-landscape viewport with touch,
// plus one desktop and one portrait shot, and fails if the page logs an error.
// A PNG existing proves nothing: open the files and look at them.

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');

const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}/`;
const OUT = 'qa_shots';

const PHONE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const DESKTOP = { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 };
const PORTRAIT = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };

const SHOTS = [
  ['title', PHONE], ['2d', PHONE], ['3d', PHONE], ['ko', PHONE], ['won', PHONE],
  ['2d', DESKTOP, 'desktop-2d'], ['3d', DESKTOP, 'desktop-3d'], ['2d', PORTRAIT, 'portrait'],
];

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
  mkdirSync(OUT, { recursive: true });
  // Headless Chromium has no GPU; SwiftShader gives it a software WebGL.
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  for (const [scene, device, name = scene] of SHOTS) {
    const context = await browser.newContext(device);
    const page = await context.newPage();
    page.on('pageerror', (e) => problems.push(`${name}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`${name}: ${m.text()}`); });
    page.on('requestfailed', (r) => problems.push(`${name}: failed ${r.url()}`));
    await page.goto(`${BASE}?qa=${scene}`);
    await page.waitForFunction(() => window.__slayer, null, { timeout: 30000 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log(`[shots] ${OUT}/${name}.png`);
    await context.close();
  }
  await browser.close();
} finally {
  server.kill();
}

if (problems.length) {
  console.error(`[shots] ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('[shots] no page errors');
