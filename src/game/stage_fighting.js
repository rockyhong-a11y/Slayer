// The fighting-game HUD, laid flat as an arena. x runs left to right and z runs
// top to bottom, exactly as the HUD reads on a screen: portraits and HP bars
// along the top, the round timer between them, super gauges along the bottom.

const LETTERS = 'FIGHT'.split('').map((ch, i) => ({
  id: `letter${ch}`, ch, x: (i - 2) * 3, z: 0.8, w: 1.7, d: 2.2, h: 1.5,
}));

export const fighting = {
  id: 'fighting',
  playerStart: { x: -11, z: -2.5 },
  // Challengers walk in from the P2 side.
  spawns: [{ x: 13.6, z: -3.6 }, { x: 14.6, z: 2.5 }],

  portraits: [
    { id: 'portraitP1', x: -14, z: -6.5, w: 2.8, d: 2.8, h: 2.6 },
    { id: 'portraitP2', x: 14, z: -6.5, w: 2.8, d: 2.8, h: 2.6 },
  ],

  // Anchored at the portrait and draining from the tip, so losing a bar opens
  // the middle of the arena first -- right next to the timer.
  hpBars: [
    { id: 'hpP1', anchor: -12.4, tip: -3.4, z: -6.5, d: 1.0, h: 1.7 },
    { id: 'hpP2', anchor: 12.4, tip: 3.4, z: -6.5, d: 1.0, h: 1.7 },
  ],

  timer: { id: 'timer', x: 0, z: -6.6, w: 3.0, d: 2.2, h: 2.4 },

  letters: LETTERS,

  // Low enough to shoot over, solid enough to stop a walk.
  gauges: [
    { id: 'superP1', x0: -13.2, x1: -5.2, z: 9.0, d: 0.9, h: 0.6 },
    { id: 'superP2', x0: 5.2, x1: 13.2, z: 9.0, d: 0.9, h: 0.6 },
  ],

  // The strip the super beam sweeps, and the pads at each end that fire it.
  lane: { z: 5.8, halfWidth: 1.3 },
  pads: [
    { id: 'padP1', x: -14.4, z: 5.8, r: 1.0, dir: 1 },
    { id: 'padP2', x: 14.4, z: 5.8, r: 1.0, dir: -1 },
  ],

  // Flat lamps under the HP bars that light as rounds are won.
  roundLamps: [{ x: -5.6, z: -5.0 }, { x: -4.6, z: -5.0 }, { x: -3.6, z: -5.0 }],
};
