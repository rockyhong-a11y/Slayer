// Art slots. Every piece of 2D art in a stage is a named slot; public/art/
// manifest.json says which file fills it. A slot left null is drawn here in
// code instead, so the game always runs and swapping in generated art
// (Higgsfield or anything else) is a manifest edit, never a code change.

import * as THREE from 'three';
import { ARENA, TIMER } from '../game/config.js';

const HALF_W = ARENA.w / 2;
const HALF_D = ARENA.d / 2;

export async function loadArt(stage) {
  let slots = {};
  try {
    const manifest = await (await fetch('art/manifest.json')).json();
    slots = manifest[stage.id] ?? {};
  } catch {
    // No manifest is the same as an empty one: everything is drawn in code.
  }
  const drawn = {
    floor: () => canvasTexture(drawFloor(stage)),
    backdrop: () => canvasTexture(drawBackdrop()),
    portraitP1: () => canvasTexture(drawPortrait('P1')),
    portraitP2: () => canvasTexture(drawPortrait('CPU')),
  };
  const art = {};
  const loader = new THREE.TextureLoader();
  for (const [slot, draw] of Object.entries(drawn)) {
    if (slots[slot]) {
      art[slot] = await loader.loadAsync(`art/${slots[slot]}`);
      art[slot].colorSpace = THREE.SRGBColorSpace;
    } else {
      art[slot] = draw();
    }
  }
  return art;
}

export function canvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  return [canvas, canvas.getContext('2d')];
}

const FONT = 'italic 800 %px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const font = (px) => FONT.replace('%', px);

/** A label on a block face: one glyph or a short word, centred. */
export function drawLabel(text, { fg = '#ffd23f', bg = '#1b1f3d', w = 256, h = 256, scale = 0.72 } = {}) {
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(h * scale);
  ctx.fillText(text, w / 2, h / 2 + h * 0.04, w * 0.86);
  return canvas;
}

/**
 * The default floor: the fighting HUD printed flat, at 64px per world unit.
 * Structure footprints are outlined so the layout reads as a screen even
 * before the 3D blocks are drawn on top of it.
 */
function drawFloor(stage) {
  const S = 64;
  const [canvas, ctx] = makeCanvas(ARENA.w * S, ARENA.d * S);
  const X = (x) => (x + HALF_W) * S;
  const Z = (z) => (z + HALF_D) * S;

  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, '#1a1f45');
  bg.addColorStop(1, '#10132b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i <= ARENA.w; i++) {
    ctx.fillStyle = i % 4 === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)';
    ctx.fillRect(i * S - 1, 0, 2, canvas.height);
  }
  for (let i = 0; i <= ARENA.d; i++) {
    ctx.fillStyle = i % 4 === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, i * S - 1, canvas.width, 2);
  }

  // Super lane: where the beam will sweep.
  const { lane } = stage;
  ctx.fillStyle = 'rgba(63,208,255,0.10)';
  ctx.fillRect(0, Z(lane.z - lane.halfWidth), canvas.width, lane.halfWidth * 2 * S);
  ctx.fillStyle = 'rgba(63,208,255,0.5)';
  ctx.fillRect(0, Z(lane.z - lane.halfWidth) - 3, canvas.width, 6);
  ctx.fillRect(0, Z(lane.z + lane.halfWidth) - 3, canvas.width, 6);
  ctx.font = font(S * 0.9);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(63,208,255,0.32)';
  for (let x = -10; x <= 10; x += 5) {
    ctx.fillText(x === 0 ? 'SUPER LANE' : x < 0 ? '›››' : '‹‹‹', X(x), Z(lane.z));
  }

  // Timer blast radius.
  ctx.setLineDash([S * 0.5, S * 0.3]);
  ctx.strokeStyle = 'rgba(255,59,78,0.55)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(X(stage.timer.x), Z(stage.timer.z), TIMER.radius * S, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,59,78,0.5)';
  ctx.font = font(S * 0.5);
  ctx.fillText('TIME UP ZONE', X(stage.timer.x), Z(stage.timer.z + TIMER.radius - 0.7));

  // Footprints.
  const outline = (x0, z0, x1, z1, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.strokeRect(X(x0), Z(z0), (x1 - x0) * S, (z1 - z0) * S);
  };
  for (const b of stage.hpBars) {
    outline(Math.min(b.anchor, b.tip), b.z - b.d / 2, Math.max(b.anchor, b.tip), b.z + b.d / 2, 'rgba(255,210,63,0.55)');
  }
  for (const g of stage.gauges) outline(g.x0, g.z - g.d / 2, g.x1, g.z + g.d / 2, 'rgba(63,208,255,0.55)');
  for (const l of stage.letters) {
    outline(l.x - l.w / 2, l.z - l.d / 2, l.x + l.w / 2, l.z + l.d / 2, 'rgba(255,255,255,0.22)');
  }

  // Where challengers walk in.
  ctx.fillStyle = 'rgba(255,59,78,0.6)';
  ctx.font = font(S * 0.42);
  for (const s of stage.spawns) {
    ctx.beginPath();
    ctx.arc(X(s.x), Z(s.z), S * 0.7, 0, Math.PI * 2);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,59,78,0.6)';
    ctx.stroke();
    ctx.fillText('IN', X(s.x), Z(s.z));
  }

  ctx.font = font(S * 0.7);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillText('1P', X(-14), Z(-4.2));
  ctx.fillText('CPU', X(13.6), Z(-1.6));
  ctx.fillText('ROUND', X(-4.6), Z(-4.1));
  return canvas;
}

function drawBackdrop() {
  const [canvas, ctx] = makeCanvas(16, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#05060f');
  g.addColorStop(0.55, '#1a1038');
  g.addColorStop(0.75, '#5b1d4f');
  g.addColorStop(1, '#0b0d1a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 256);
  return canvas;
}

function drawPortrait(tag) {
  const [canvas, ctx] = makeCanvas(256, 256);
  const hero = tag === 'P1';
  const g = ctx.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, hero ? '#2c6bff' : '#8a1630');
  g.addColorStop(1, hero ? '#0f2a80' : '#2a0712');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = hero ? '#ffc79a' : '#c8323f';
  ctx.beginPath();
  ctx.arc(128, 130, 70, 0, Math.PI * 2);
  ctx.fill();
  if (hero) {
    ctx.fillStyle = '#eb2a35';
    ctx.fillRect(52, 88, 152, 22);
  } else {
    ctx.fillStyle = '#240a12';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(128 + side * 34, 74);
      ctx.lineTo(128 + side * 76, 26);
      ctx.lineTo(128 + side * 62, 88);
      ctx.fill();
    }
  }
  ctx.fillStyle = hero ? '#1b1f3d' : '#ffe94d';
  ctx.fillRect(92, 124, 22, 12);
  ctx.fillRect(142, 124, 22, 12);
  ctx.fillStyle = '#1b1f3d';
  ctx.fillRect(104, 162, 48, 8);

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 206, 256, 50);
  ctx.fillStyle = '#ffd23f';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(34);
  ctx.fillText(tag, 128, 233);
  return canvas;
}
