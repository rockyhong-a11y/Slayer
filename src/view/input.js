// Touch first: the left half of the screen is a move stick, the right half an
// aim stick, each appearing wherever the thumb lands. Keyboard and mouse feed
// the same two sticks so a desktop can play (and tests can drive) the same game.

const STICK_RADIUS = 56;

export function createInput(surface) {
  const sticks = {
    move: { el: document.getElementById('stickMove'), id: null, ox: 0, oy: 0, x: 0, y: 0 },
    look: { el: document.getElementById('stickLook'), id: null, ox: 0, oy: 0, x: 0, y: 0 },
  };
  const keys = new Set();
  const mouse = { down: false, ndc: null, turn: 0 };
  let toggle = false;

  function place(stick) {
    stick.el.hidden = stick.id === null;
    stick.el.style.left = `${stick.ox}px`;
    stick.el.style.top = `${stick.oy}px`;
    stick.el.firstElementChild.style.transform =
      `translate(${stick.x * STICK_RADIUS}px, ${stick.y * STICK_RADIUS}px)`;
  }

  function trackMouse(e) {
    mouse.ndc = { x: (e.clientX / innerWidth) * 2 - 1, y: -(e.clientY / innerHeight) * 2 + 1 };
    if (document.pointerLockElement === surface) mouse.turn += e.movementX;
  }

  surface.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') { mouse.down = true; trackMouse(e); return; }
    const stick = e.clientX < innerWidth / 2 ? sticks.move : sticks.look;
    if (stick.id !== null) return;
    stick.id = e.pointerId;
    stick.ox = e.clientX; stick.oy = e.clientY;
    stick.x = 0; stick.y = 0;
    surface.setPointerCapture(e.pointerId);
    place(stick);
  });

  surface.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') { trackMouse(e); return; }
    const stick = Object.values(sticks).find((s) => s.id === e.pointerId);
    if (!stick) return;
    let dx = (e.clientX - stick.ox) / STICK_RADIUS;
    let dy = (e.clientY - stick.oy) / STICK_RADIUS;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    stick.x = dx; stick.y = dy;
    place(stick);
  });

  function release(e) {
    if (e.pointerType === 'mouse') { mouse.down = false; return; }
    const stick = Object.values(sticks).find((s) => s.id === e.pointerId);
    if (!stick) return;
    stick.id = null; stick.x = 0; stick.y = 0;
    place(stick);
  }
  surface.addEventListener('pointerup', release);
  surface.addEventListener('pointercancel', release);
  surface.addEventListener('contextmenu', (e) => e.preventDefault());

  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'KeyF' || e.code === 'Tab') { toggle = true; e.preventDefault(); }
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  const axis = (neg, pos) => (keys.has(pos) ? 1 : 0) - (keys.has(neg) ? 1 : 0);

  return {
    requestToggle() { toggle = true; },

    /**
     * One frame of intent, in screen terms: x is right, y is DOWN the screen,
     * exactly as a thumb moves. Turning that into world space depends on the
     * view, so it is left to the caller.
     */
    read() {
      const touchMove = sticks.move.id !== null;
      const touchLook = sticks.look.id !== null;
      const arrows = { x: axis('ArrowLeft', 'ArrowRight'), y: axis('ArrowUp', 'ArrowDown') };
      const out = {
        moveX: touchMove ? sticks.move.x : axis('KeyA', 'KeyD'),
        moveY: touchMove ? sticks.move.y : axis('KeyW', 'KeyS'),
        lookX: touchLook ? sticks.look.x : arrows.x,
        lookY: touchLook ? sticks.look.y : arrows.y,
        lookHeld: touchLook || arrows.x !== 0 || arrows.y !== 0,
        fireKey: keys.has('Space') || mouse.down,
        mouseNdc: mouse.ndc,
        mouseTurn: mouse.turn,
        toggle,
      };
      mouse.turn = 0;
      toggle = false;
      return out;
    },
  };
}
