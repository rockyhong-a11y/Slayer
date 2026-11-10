// Every tuning number lives here, so balance is read and changed in one place.

export const ARENA = { w: 32, d: 20 };

export const PLAYER = {
  radius: 0.45,
  speed: 5.5,
  hp: 100,
  fireInterval: 0.18,
  bulletSpeed: 24,
};

// The reason to switch views. 2D sees the whole fight but hits softly and only
// at short range; 3D sees just what is in front, but hits twice as hard at any
// distance.
export const MODES = {
  '2d': { damage: 10, range: 9 },
  '3d': { damage: 20, range: 60 },
};

// Tuned with tools/balance.mjs so that running and shooting alone is not
// enough: a player who never switches view loses often, one who does rarely.
export const ENEMIES = {
  // Walks up and punches.
  grunt: { radius: 0.5, speed: 3.4, hp: 40, touchDamage: 10, touchInterval: 0.8 },
  // Stops at a distance and shoots; its bullets are what wear cover down.
  shooter: {
    radius: 0.45, speed: 2.0, hp: 30,
    keepDistance: 7.5, fireInterval: 1.4, bulletSpeed: 10, bulletDamage: 10,
  },
};

// An HP bar is a wall whose length is its remaining health.
export const HPBAR = { hp: 100, damagePerEnemyBullet: 10 };

// The round timer is a bomb: at zero, TIME UP clears everything standing near it.
export const TIMER = { seconds: 20, radius: 5, playerDamage: 40 };

// Kills fill the super gauge; a full gauge fires a beam down the super lane.
export const SUPER = { perKill: 0.2, beamSeconds: 0.5 };

export const ROUND = { introSeconds: 1.6, spawnInterval: 0.9, healOnWin: 30 };

export const ROUNDS = [
  { grunt: 6, shooter: 2 },
  { grunt: 8, shooter: 4 },
  { grunt: 10, shooter: 6 },
];
