// Phaser 3 maze game — 3 rounds, fog of war, patrolling guard, timed
// math questions in round 3, voice speaking indicators, dramatic feedback.

const PALETTE = {
  floor: 0x1a2030, floorAlt: 0x1f2638, grid: 0x2a3349,
  wallTop: 0x3b4868, wallSide: 0x232b42, wallEdge: 0x4a5a82,
  finish: 0x7ee9c1, finishGlow: 0x34d399,
  p1: 0xf87171, p2: 0x60a5fa, p1Dark: 0xb91c1c, p2Dark: 0x1d4ed8,
  skin: 0xfcd9b6, hair1: 0x3d2817, hair2: 0x6b3410, pants: 0x1f2937,
  gate: 0xfbbf24, gateStripe: 0x1a0f00,
  guard: 0x4c1d95, guardEye: 0xef4444,
};

const VISION_RADIUS = 170;
const VIEW_W = 1280;
const VIEW_H = 640;

// Enemy archetypes. Host runs the AI; clients render.
// ai: 'patrol' bounces between waypoints; 'chase' homes on nearest player;
// 'shooter' stands still and fires every fireMs; 'minBoss' is the revive boss.
// damage values are in QUARTER HEARTS (4 quarters per heart).
const ENEMY_TYPES = {
  shade:   { hp: 1, speed: 60,  damage: 1, contactRadius: 14, ai: 'patrol', color: 0x7c3aed, eye: 0xef4444, size: 14 },
  brute:   { hp: 3, speed: 30,  damage: 2, contactRadius: 18, ai: 'patrol', color: 0xdc2626, eye: 0xfde047, size: 22 },
  stalker: { hp: 2, speed: 95,  damage: 1, contactRadius: 14, ai: 'chase',  color: 0x166534, eye: 0xfacc15, size: 14 },
  hexer:   { hp: 2, speed: 0,   damage: 1, contactRadius: 0,  ai: 'shooter',color: 0x6d28d9, eye: 0xfb7185, size: 16, fireMs: 2400, projSpeed: 160, range: 320 },
  wraith:  { hp: 2, speed: 110, damage: 1, contactRadius: 12, ai: 'chase',  color: 0x0e7490, eye: 0x67e8f9, size: 13 },
  reviveBoss: { hp: 1, speed: 0, damage: 4, contactRadius: 0, ai: 'minBoss',color: 0x7c2d12, eye: 0xfacc15, size: 32 },
};

const LEVELS = [
  {
    name: 'Round 1 · Greenwood · Bramble Warden',
    tile: 40,
    theme: {
      floor: 0x1f3a2c, floorAlt: 0x254432, grid: 0x2d5a40,
      wallTop: 0x4a7c5d, wallSide: 0x2d4a36, wallEdge: 0x6aaa80,
      bg: '#0a1410',
      ambient: 'leaves', ambientColor: 0x7ee9c1,
      accent: 0x7ee9c1,
    },
    // 50 cols × 21 rows × 40px = 2000 × 840
    // 4 zones (rows 1-4, 6-9, 11-14, 16-19), each 4 rows × 48 cols = 192 cells.
    map: [
      '##################################################',
      '#                                                #',
      '#  1                                          2  #',
      '#                                                #',
      '#       a                                b       #',
      '###################### ###########################',
      '#                                                #',
      '#                                                #',
      '#       c                                d       #',
      '#                                                #',
      '############################# ####################',
      '#                                                #',
      '#                                                #',
      '#       e                                f       #',
      '#                                                #',
      '############ #####################################',
      '#                                                #',
      '#                                                #',
      '#                                              F #',
      '#                                                #',
      '##################################################',
    ],
    plates: {
      a: {x: 8,  y: 4,  who: 'p1', gate: 1},
      b: {x: 41, y: 4,  who: 'p2', gate: 1},
      c: {x: 8,  y: 8,  who: 'p1', gate: 2},
      d: {x: 41, y: 8,  who: 'p2', gate: 2},
      e: {x: 8,  y: 13, who: 'p1', gate: 3},
      f: {x: 41, y: 13, who: 'p2', gate: 3},
    },
    gates: [
      { id: 1, door: {x: 22, y: 5} },
      { id: 2, door: {x: 29, y: 10} },
      { id: 3, door: {x: 12, y: 15} },
    ],
    spawns: { 1: {x: 3, y: 2}, 2: {x: 46, y: 2} },
    finish: {x: 47, y: 18},
    guards: [],
    enemies: [
      // Zone 1 (rows 1-4) — 4 shades + 1 brute, kept off the corner spawns.
      { type: 'shade', x: 12, y: 2, minX: 10, maxX: 16, noExpand: true },
      { type: 'shade', x: 20, y: 3, minX: 16, maxX: 24, noExpand: true },
      { type: 'shade', x: 30, y: 3, minX: 26, maxX: 33, noExpand: true },
      { type: 'shade', x: 38, y: 2, minX: 34, maxX: 40, noExpand: true },
      { type: 'brute', x: 25, y: 4, minX: 18, maxX: 32, noExpand: true },
      // Zone 2 (rows 6-9)
      { type: 'shade', x: 10, y: 7, minX: 6,  maxX: 15, noExpand: true },
      { type: 'shade', x: 20, y: 6, minX: 17, maxX: 24, noExpand: true },
      { type: 'shade', x: 30, y: 6, minX: 26, maxX: 33, noExpand: true },
      { type: 'shade', x: 40, y: 7, minX: 35, maxX: 43, noExpand: true },
      { type: 'brute', x: 25, y: 9, minX: 18, maxX: 32, noExpand: true },
      // Zone 3 (rows 11-14)
      { type: 'shade', x: 10, y: 11, minX: 6,  maxX: 15, noExpand: true },
      { type: 'shade', x: 20, y: 12, minX: 17, maxX: 24, noExpand: true },
      { type: 'shade', x: 30, y: 12, minX: 26, maxX: 33, noExpand: true },
      { type: 'shade', x: 40, y: 11, minX: 35, maxX: 43, noExpand: true },
      { type: 'brute', x: 25, y: 14, minX: 18, maxX: 32, noExpand: true },
      // Zone 4 (rows 16-19) — edges so boss pads stay clear.
      { type: 'shade', x: 6,  y: 17, minX: 4,  maxX: 12, noExpand: true },
      { type: 'shade', x: 12, y: 19, minX: 8,  maxX: 18, noExpand: true },
      { type: 'shade', x: 36, y: 19, minX: 30, maxX: 42, noExpand: true },
      { type: 'shade', x: 42, y: 17, minX: 38, maxX: 45, noExpand: true },
      { type: 'brute', x: 40, y: 18, minX: 34, maxX: 45, noExpand: true },
    ],
    reviveZone: { x: 25, y: 17 },
    overworldHp: 3,
    difficultyBadge: 'Easy',
    questionRange: { min: 3, max: 6 },
    timed: false,
    boss: {
      name: 'THE BRAMBLE WARDEN',
      subtitle: 'Vines stir in the underbrush…',
      visual: 'warden',
      arenaYMin: 16,
      spawn: { x: 24, y: 18 },
      hp: 5,
      attackInterval: 5500,
      telegraphMs: 1500,
      damageMs: 600,
      damageRadius: 68,
      playerHp: 5,
      padCooldownMs: 1200,
      colors: { aura: 0x7ee9c1, aura2: 0xbef264, eye: 0xfacc15, accent: 0x86efac },
      pads: {
        n: { x: 24, y: 16 },
        e: { x: 32, y: 18 },
        s: { x: 24, y: 19 },
        w: { x: 16, y: 18 },
      },
    },
  },
  {
    name: 'Round 2 · Shadow Library · The Librarian',
    tile: 36,
    theme: {
      floor: 0x1a1a2e, floorAlt: 0x252040, grid: 0x3b2858,
      wallTop: 0x5b3d7d, wallSide: 0x2d1f44, wallEdge: 0xa78bfa,
      bg: '#0a0816',
      ambient: 'dust', ambientColor: 0xa78bfa,
      accent: 0xa78bfa,
    },
    // 60 cols × 18 rows × 36px = 2160 × 648
    map: [
      '############################################################',
      '#                                                          #',
      '#  1                                                    2  #',
      '#                                                          #',
      '#                                                          #',
      '#       a                                          b       #',
      '#                                                          #',
      '############################ ###############################',
      '#                                                          #',
      '#                                                          #',
      '#  p                                                    q  #',
      '#                                                          #',
      '#                                                          #',
      '#                                                          #',
      '#                                                          #',
      '#                                                          #',
      '#                            F                             #',
      '############################################################',
    ],
    plates: {
      a: {x: 8, y: 5, who: 'p1', gate: 1},
      b: {x: 51, y: 5, who: 'p2', gate: 1},
    },
    gates: [{ id: 1, door: {x: 28, y: 7} }],
    spawns: { 1: {x: 3, y: 2}, 2: {x: 56, y: 2} },
    finish: {x: 29, y: 16},
    guards: [],
    enemies: [
      { type: 'shade',   x: 14, y: 11, minX: 8,  maxX: 20 },
      { type: 'shade',   x: 46, y: 11, minX: 40, maxX: 52 },
      { type: 'stalker', x: 30, y: 12 },
      { type: 'hexer',   x: 30, y: 4 },
    ],
    reviveZone: { x: 30, y: 9 },
    overworldHp: 3,
    difficultyBadge: 'Normal',
    questionRange: { min: 5, max: 9 },
    timed: false,
    boss: {
      name: 'THE LIBRARIAN',
      subtitle: 'The forbidden tome awakens…',
      visual: 'librarian',
      arenaYMin: 8,
      spawn: { x: 30, y: 13 },        // tile coords (center of arena)
      hp: 8,
      attackInterval: 4800,
      telegraphMs: 1150,
      damageMs: 600,
      damageRadius: 75,
      playerHp: 4,
      padCooldownMs: 1600,
      colors: { aura: 0xa78bfa, aura2: 0xc4b5fd, eye: 0xef4444, accent: 0xc4b5fd },
      // 4 pads in a ring around the boss — anyone can use any pad.
      pads: {
        n: { x: 30, y: 10 },
        e: { x: 36, y: 13 },
        s: { x: 30, y: 15 },
        w: { x: 24, y: 13 },
      },
    },
  },
  {
    name: 'Round 3 · Crimson Vault · The Lich',
    tile: 32,
    theme: {
      floor: 0x2a1010, floorAlt: 0x3a1818, grid: 0x553030,
      wallTop: 0x8b3a3a, wallSide: 0x401818, wallEdge: 0xf87171,
      bg: '#160808',
      ambient: 'embers', ambientColor: 0xf97316,
      accent: 0xf87171,
    },
    // 72 cols × 27 rows × 32px = 2304 × 864
    map: [
      '########################################################################',
      '#                                                                      #',
      '#  1                                                                2  #',
      '#                                                                      #',
      '#       a                                                      b       #',
      '#                                                                      #',
      '################################ #######################################',
      '#                                                                      #',
      '#                                                                      #',
      '#       c                                                      d       #',
      '#                                                                      #',
      '################## #####################################################',
      '#                                                                      #',
      '#                                                                      #',
      '#       e                                                      f       #',
      '#                                                                      #',
      '################################################## #####################',
      '#                                                                      #',
      '#                                                                      #',
      '#############################          #################################',
      '#                                                                      #',
      '#                                                                      #',
      '#                                                                      #',
      '#                                                                      #',
      '#                                                                      #',
      '#                                                                    F #',
      '########################################################################',
    ],
    plates: {
      a: {x: 8, y: 4, who: 'p1', gate: 1},
      b: {x: 63, y: 4, who: 'p2', gate: 1},
      c: {x: 8, y: 9, who: 'p1', gate: 2},
      d: {x: 63, y: 9, who: 'p2', gate: 2},
      e: {x: 8, y: 14, who: 'p1', gate: 3},
      f: {x: 63, y: 14, who: 'p2', gate: 3},
    },
    gates: [
      { id: 1, door: {x: 32, y: 6} },
      { id: 2, door: {x: 18, y: 11} },
      { id: 3, door: {x: 50, y: 16} },
    ],
    spawns: { 1: {x: 3, y: 2}, 2: {x: 68, y: 2} },
    finish: {x: 69, y: 25},
    guards: [
      { y: 7, minX: 4, maxX: 68, period: 6500 },
      { y: 12, minX: 4, maxX: 68, period: 5500 },
    ],
    enemies: [
      { type: 'stalker', x: 20, y: 13 },
      { type: 'stalker', x: 50, y: 13 },
      { type: 'brute',   x: 36, y: 18, minX: 28, maxX: 44 },
      { type: 'hexer',   x: 6,  y: 22 },
      { type: 'hexer',   x: 65, y: 22 },
    ],
    reviveZone: { x: 36, y: 14 },
    overworldHp: 3,
    difficultyBadge: 'Hard',
    questionRange: { min: 7, max: 12 },
    timed: true,
    timedMs: 6500,
    key: {
      spawn: {x: 3, y: 3},
      handoff: {x: 35, y: 9},
      lock: {x: 69, y: 25},
    },
    boss: {
      name: 'THE CRIMSON LICH',
      subtitle: 'You should not have come this far…',
      visual: 'lich',
      arenaYMin: 20,
      spawn: { x: 36, y: 22 },
      hp: 12,
      attackInterval: 3500,
      telegraphMs: 800,
      damageMs: 700,
      damageRadius: 82,
      playerHp: 3,
      padCooldownMs: 2000,
      colors: { aura: 0xef4444, aura2: 0xf97316, eye: 0xfde047, accent: 0xfca5a5 },
      pads: {
        n: { x: 36, y: 20 },
        e: { x: 42, y: 22 },
        s: { x: 36, y: 24 },
        w: { x: 30, y: 22 },
      },
    },
  },
  {
    name: 'Round 4 · Frozen Spire · The Cryomancer',
    tile: 36,
    theme: {
      floor: 0x0f2540, floorAlt: 0x16345a, grid: 0x1e4475,
      wallTop: 0x4a83c4, wallSide: 0x1a3358, wallEdge: 0x93c5fd,
      bg: '#060b1a',
      ambient: 'dust', ambientColor: 0x93c5fd,
      accent: 0x93c5fd,
    },
    // 60 cols × 21 rows × 36px
    map: [
      '############################################################',
      '#                                                          #',
      '#  1                                                    2  #',
      '#                                                          #',
      '#       a                                          b       #',
      '#                                                          #',
      '############# ##############################################',
      '#                                                          #',
      '#                                                          #',
      '#       c                                          d       #',
      '#                                                          #',
      '##################### ######################################',
      '#                                                          #',
      '#                                                          #',
      '#       e                                          f       #',
      '#                                                          #',
      '############################ ###############################',
      '#                                                          #',
      '#                                                          #',
      '#                            F                             #',
      '############################################################',
    ],
    plates: {
      a: {x: 8, y: 4, who: 'p1', gate: 1},
      b: {x: 51, y: 4, who: 'p2', gate: 1},
      c: {x: 8, y: 9, who: 'p1', gate: 2},
      d: {x: 51, y: 9, who: 'p2', gate: 2},
      e: {x: 8, y: 14, who: 'p1', gate: 3},
      f: {x: 51, y: 14, who: 'p2', gate: 3},
    },
    gates: [
      { id: 1, door: {x: 13, y: 6} },
      { id: 2, door: {x: 21, y: 11} },
      { id: 3, door: {x: 28, y: 16} },
    ],
    spawns: { 1: {x: 3, y: 2}, 2: {x: 56, y: 2} },
    finish: {x: 29, y: 19},
    guards: [],
    enemies: [
      { type: 'wraith',  x: 20, y: 13 },
      { type: 'wraith',  x: 40, y: 13 },
      { type: 'stalker', x: 30, y: 17 },
      { type: 'brute',   x: 30, y: 8, minX: 22, maxX: 38 },
      { type: 'hexer',   x: 6,  y: 17 },
      { type: 'hexer',   x: 53, y: 17 },
    ],
    reviveZone: { x: 30, y: 13 },
    overworldHp: 3,
    difficultyBadge: 'Brutal',
    questionRange: { min: 8, max: 14 },
    timed: false,
    boss: {
      name: 'THE CRYOMANCER',
      subtitle: 'Ice crystallizes around you…',
      visual: 'librarian',
      arenaYMin: 17,
      spawn: { x: 30, y: 18 },
      hp: 14,
      attackInterval: 3200,
      telegraphMs: 750,
      damageMs: 700,
      damageRadius: 86,
      playerHp: 3,
      padCooldownMs: 2000,
      colors: { aura: 0x60a5fa, aura2: 0xbfdbfe, eye: 0xfde047, accent: 0xc4d9ff },
      pads: {
        n: { x: 30, y: 17 },
        e: { x: 36, y: 18 },
        s: { x: 30, y: 19 },
        w: { x: 24, y: 18 },
      },
    },
  },
  {
    name: 'Round 5 · Void Citadel · The Devourer',
    tile: 30,
    theme: {
      floor: 0x140020, floorAlt: 0x1e0030, grid: 0x3a0a4f,
      wallTop: 0x6b21a8, wallSide: 0x2e0a3a, wallEdge: 0xe879f9,
      bg: '#08000f',
      ambient: 'embers', ambientColor: 0xe879f9,
      accent: 0xe879f9,
    },
    // 76 cols × 28 rows × 30px
    map: [
      '############################################################################',
      '#                                                                          #',
      '#  1                                                                    2  #',
      '#                                                                          #',
      '#       a                                                          b       #',
      '#                                                                          #',
      '################################## #########################################',
      '#                                                                          #',
      '#                                                                          #',
      '#       c                                                          d       #',
      '#                                                                          #',
      '############ ###############################################################',
      '#                                                                          #',
      '#                                                                          #',
      '#       e                                                          f       #',
      '#                                                                          #',
      '################################################### ########################',
      '#                                                                          #',
      '#                                                                          #',
      '#       g                                                          h       #',
      '#                                                                          #',
      '############################# ##############################################',
      '#                                                                          #',
      '#                                                                          #',
      '#                                                                          #',
      '#                                                                          #',
      '#                              F                                           #',
      '############################################################################',
    ],
    plates: {
      a: {x: 8, y: 4, who: 'p1', gate: 1},
      b: {x: 67, y: 4, who: 'p2', gate: 1},
      c: {x: 8, y: 9, who: 'p1', gate: 2},
      d: {x: 67, y: 9, who: 'p2', gate: 2},
      e: {x: 8, y: 14, who: 'p1', gate: 3},
      f: {x: 67, y: 14, who: 'p2', gate: 3},
      g: {x: 8, y: 19, who: 'p1', gate: 4},
      h: {x: 67, y: 19, who: 'p2', gate: 4},
    },
    gates: [
      { id: 1, door: {x: 34, y: 6} },
      { id: 2, door: {x: 12, y: 11} },
      { id: 3, door: {x: 51, y: 16} },
      { id: 4, door: {x: 29, y: 21} },
    ],
    spawns: { 1: {x: 3, y: 2}, 2: {x: 72, y: 2} },
    finish: {x: 31, y: 26},
    guards: [],
    enemies: [
      { type: 'wraith',  x: 20, y: 13 },
      { type: 'wraith',  x: 56, y: 13 },
      { type: 'stalker', x: 28, y: 18 },
      { type: 'stalker', x: 50, y: 18 },
      { type: 'brute',   x: 38, y: 8,  minX: 28, maxX: 48 },
      { type: 'brute',   x: 38, y: 23, minX: 28, maxX: 48 },
      { type: 'hexer',   x: 5,  y: 23 },
      { type: 'hexer',   x: 70, y: 23 },
      { type: 'hexer',   x: 38, y: 17 },
    ],
    reviveZone: { x: 38, y: 13 },
    overworldHp: 4,
    difficultyBadge: 'Nightmare',
    questionRange: { min: 10, max: 18 },
    timed: true,
    timedMs: 5500,
    boss: {
      name: 'THE VOID DEVOURER',
      subtitle: 'It hungers for your light…',
      visual: 'lich',
      arenaYMin: 22,
      spawn: { x: 38, y: 24 },
      hp: 18,
      attackInterval: 2700,
      telegraphMs: 650,
      damageMs: 700,
      damageRadius: 90,
      playerHp: 3,
      padCooldownMs: 2200,
      colors: { aura: 0xe879f9, aura2: 0xf0abfc, eye: 0xfde047, accent: 0xfbcfe8 },
      pads: {
        n: { x: 38, y: 22 },
        e: { x: 44, y: 24 },
        s: { x: 38, y: 26 },
        w: { x: 32, y: 24 },
      },
    },
  },
  (() => {
    // Round 6 · Stormforge · The Magmaheart — built with helpers to guarantee row widths.
    const W = 68;
    const wall = '#'.repeat(W);
    const empty = '#' + ' '.repeat(W - 2) + '#';
    const gateRow = (door) => '#'.repeat(door) + ' ' + '#'.repeat(W - door - 1);
    const plateRow = (a, ac, b, bc) => {
      const s = ' '.repeat(W).split('');
      s[0] = '#'; s[W - 1] = '#'; s[ac] = a; s[bc] = b;
      return s.join('');
    };
    const spawnRow = () => {
      const s = ' '.repeat(W).split('');
      s[0] = '#'; s[W - 1] = '#'; s[3] = '1'; s[64] = '2';
      return s.join('');
    };
    const finishRow = () => {
      const s = ' '.repeat(W).split('');
      s[0] = '#'; s[W - 1] = '#'; s[33] = 'F';
      return s.join('');
    };
    return {
      name: 'Round 6 · Stormforge · The Magmaheart',
      tile: 30,
      theme: {
        floor: 0x2a1208, floorAlt: 0x3a1a10, grid: 0x66331a,
        wallTop: 0xa3431a, wallSide: 0x401a08, wallEdge: 0xfb923c,
        bg: '#1a0a04',
        ambient: 'embers', ambientColor: 0xfb923c,
        accent: 0xfb923c,
      },
      map: [
        wall,
        empty,
        spawnRow(),
        empty,
        empty,
        plateRow('a', 8, 'b', 59),
        empty,
        gateRow(34),
        empty,
        plateRow('c', 8, 'd', 59),
        empty,
        gateRow(14),
        empty,
        plateRow('e', 8, 'f', 59),
        empty,
        gateRow(50),
        empty,
        plateRow('g', 8, 'h', 59),
        empty,
        gateRow(26),
        empty,
        finishRow(),
        empty,
        wall,
      ],
      plates: {
        a: { x: 8, y: 5, who: 'p1', gate: 1 },
        b: { x: 59, y: 5, who: 'p2', gate: 1 },
        c: { x: 8, y: 9, who: 'p1', gate: 2 },
        d: { x: 59, y: 9, who: 'p2', gate: 2 },
        e: { x: 8, y: 13, who: 'p1', gate: 3 },
        f: { x: 59, y: 13, who: 'p2', gate: 3 },
        g: { x: 8, y: 17, who: 'p1', gate: 4 },
        h: { x: 59, y: 17, who: 'p2', gate: 4 },
      },
      gates: [
        { id: 1, door: { x: 34, y: 7 } },
        { id: 2, door: { x: 14, y: 11 } },
        { id: 3, door: { x: 50, y: 15 } },
        { id: 4, door: { x: 26, y: 19 } },
      ],
      spawns: { 1: { x: 3, y: 2 }, 2: { x: 64, y: 2 } },
      finish: { x: 33, y: 21 },
      guards: [],
      enemies: [
        { type: 'brute',   x: 22, y: 6,  minX: 16, maxX: 32 },
        { type: 'brute',   x: 46, y: 6,  minX: 38, maxX: 54 },
        { type: 'stalker', x: 34, y: 10 },
        { type: 'hexer',   x: 4,  y: 12 },
        { type: 'hexer',   x: 63, y: 12 },
        { type: 'wraith',  x: 22, y: 14 },
        { type: 'wraith',  x: 46, y: 14 },
        { type: 'stalker', x: 34, y: 18 },
        { type: 'brute',   x: 34, y: 20, minX: 20, maxX: 48 },
      ],
      reviveZone: { x: 33, y: 12 },
      overworldHp: 4,
      difficultyBadge: 'Insane',
      questionRange: { min: 9, max: 15 },
      timed: true,
      timedMs: 6000,
      boss: {
        name: 'THE MAGMAHEART',
        subtitle: 'The forge bellows with rage…',
        visual: 'lich',
        arenaYMin: 21,
        spawn: { x: 33, y: 21 },
        hp: 16,
        attackInterval: 2900,
        telegraphMs: 700,
        damageMs: 700,
        damageRadius: 92,
        playerHp: 3,
        padCooldownMs: 2100,
        colors: { aura: 0xfb923c, aura2: 0xfde047, eye: 0xfee2b1, accent: 0xff7a3a },
        pads: {
          n: { x: 33, y: 20 },
          e: { x: 38, y: 21 },
          s: { x: 33, y: 22 },
          w: { x: 28, y: 21 },
        },
      },
    };
  })(),
  (() => {
    // Round 7 · Celestial Apex · The Architect — 5 gates, all enemy types.
    const W = 80;
    const wall = '#'.repeat(W);
    const empty = '#' + ' '.repeat(W - 2) + '#';
    const gateRow = (door) => '#'.repeat(door) + ' ' + '#'.repeat(W - door - 1);
    const cell = (positions) => {
      const s = ' '.repeat(W).split('');
      s[0] = '#'; s[W - 1] = '#';
      for (const [c, ch] of positions) s[c] = ch;
      return s.join('');
    };
    return {
      name: 'Round 7 · Celestial Apex · The Architect',
      tile: 28,
      theme: {
        floor: 0x0a1428, floorAlt: 0x10204a, grid: 0x274780,
        wallTop: 0x5b6dca, wallSide: 0x1a2a52, wallEdge: 0xfde68a,
        bg: '#040814',
        ambient: 'dust', ambientColor: 0xfde68a,
        accent: 0xfde68a,
      },
      map: [
        wall,
        empty,
        cell([[3, '1'], [76, '2']]),
        empty,
        cell([[8, 'a'], [71, 'b']]),
        empty,
        gateRow(40),
        empty,
        cell([[8, 'c'], [71, 'd']]),
        empty,
        gateRow(16),
        empty,
        cell([[8, 'e'], [71, 'f']]),
        empty,
        gateRow(60),
        empty,
        cell([[8, 'g'], [71, 'h']]),
        empty,
        gateRow(30),
        empty,
        cell([[8, 'i'], [71, 'j']]),
        empty,
        gateRow(50),
        empty,
        empty,
        cell([[39, 'F']]),
        empty,
        wall,
      ],
      plates: {
        a: { x: 8,  y: 4,  who: 'p1', gate: 1 },
        b: { x: 71, y: 4,  who: 'p2', gate: 1 },
        c: { x: 8,  y: 8,  who: 'p1', gate: 2 },
        d: { x: 71, y: 8,  who: 'p2', gate: 2 },
        e: { x: 8,  y: 12, who: 'p1', gate: 3 },
        f: { x: 71, y: 12, who: 'p2', gate: 3 },
        g: { x: 8,  y: 16, who: 'p1', gate: 4 },
        h: { x: 71, y: 16, who: 'p2', gate: 4 },
        i: { x: 8,  y: 20, who: 'p1', gate: 5 },
        j: { x: 71, y: 20, who: 'p2', gate: 5 },
      },
      gates: [
        { id: 1, door: { x: 40, y: 6 } },
        { id: 2, door: { x: 16, y: 10 } },
        { id: 3, door: { x: 60, y: 14 } },
        { id: 4, door: { x: 30, y: 18 } },
        { id: 5, door: { x: 50, y: 22 } },
      ],
      spawns: { 1: { x: 3, y: 2 }, 2: { x: 76, y: 2 } },
      finish: { x: 39, y: 25 },
      guards: [
        { y: 7,  minX: 4, maxX: 76, period: 5200 },
        { y: 15, minX: 4, maxX: 76, period: 4800 },
      ],
      enemies: [
        { type: 'brute',   x: 25, y: 5,  minX: 18, maxX: 36 },
        { type: 'brute',   x: 54, y: 5,  minX: 46, maxX: 62 },
        { type: 'wraith',  x: 30, y: 9 },
        { type: 'wraith',  x: 50, y: 9 },
        { type: 'stalker', x: 20, y: 13 },
        { type: 'stalker', x: 60, y: 13 },
        { type: 'hexer',   x: 5,  y: 13 },
        { type: 'hexer',   x: 74, y: 13 },
        { type: 'brute',   x: 40, y: 17, minX: 28, maxX: 52 },
        { type: 'wraith',  x: 25, y: 21 },
        { type: 'wraith',  x: 54, y: 21 },
        { type: 'hexer',   x: 39, y: 24 },
      ],
      reviveZone: { x: 39, y: 12 },
      overworldHp: 4,
      difficultyBadge: 'Hellish',
      questionRange: { min: 11, max: 20 },
      timed: true,
      timedMs: 5000,
      boss: {
        name: 'THE ARCHITECT',
        subtitle: 'Reality itself bends to its will…',
        visual: 'librarian',
        arenaYMin: 23,
        spawn: { x: 39, y: 25 },
        hp: 22,
        attackInterval: 2400,
        telegraphMs: 600,
        damageMs: 700,
        damageRadius: 96,
        playerHp: 3,
        padCooldownMs: 2400,
        colors: { aura: 0xfde68a, aura2: 0xfef3c7, eye: 0xfb7185, accent: 0xfff1c1 },
        pads: {
          n: { x: 39, y: 24 },
          e: { x: 44, y: 25 },
          s: { x: 39, y: 26 },
          w: { x: 34, y: 25 },
        },
      },
    };
  })(),
];

const Game = {
  scene: null, phaserGame: null,
  level: null, currentLevelIdx: 0,
  me: null, other: null,
  walls: [], gateState: {}, plates: {}, guards: [],
  activePlate: null, pendingQuestion: null,
  finishedMe: false, finishedThem: false,
  _lastSync: 0, _stepTimer: 0,
  stunned: false, stunUntil: 0,
  fog: null,
  questionTimerStart: 0, questionTimerActive: false,
  readyToContinue: false, partnerReadyToContinue: false,
  keyState: 'idle', // 'idle' | 'p1' | 'at_handoff' | 'p2' | 'used'
  keyVisual: null, handoffVisual: null, lockVisual: null,
  carriedKeyIcon: { p1: null, p2: null },

  // Boss state
  boss: null,                // { hp, alive, phase, sprite, hpBar, attackPads, ... }
  bossPhase: 'idle',         // 'idle' | 'intro' | 'fight' | 'dead'
  bossActivePad: null,
  bossAttacks: [],           // active attacks (one per targeted player)
  bossAttackNextAt: 0,
  playerHp: { 1: 12, 2: 12 }, // quarter-heart units (12 = 3 hearts)
  _playerHpRegenAt: 0,
  _bossIntroStarted: false,

  // Enemy + revive state
  enemies: [],               // [{id, type, container, body, hp, alive, x, y, targetX, targetY, ai, ...}]
  enemyNextSync: 0,
  enemyProjectiles: [],      // [{id, sprite, x, y, vx, vy, dieAt, damage, fromHost}]
  reviveZoneVisual: null,    // { glow, ring, mark, container }
  reviveBoss: null,          // { container, hp, alive, hpBg, hpFill, hpLabel, ... }
  reviveBossPhase: 'idle',   // 'idle' | 'fight' | 'dead'
  reviveActivePad: null,
  reviveAttacks: [],
  reviveAttackNextAt: 0,
  reviveStarted: false,
  reviveInvulnUntil: 0,
  heartsHUD: null,
  _enemyId: 0,
  _projId: 0,

  start() {
    this.currentLevelIdx = 0;
    this.level = LEVELS[0];
    this.resetState();

    const config = {
      type: Phaser.AUTO,
      backgroundColor: '#0b0e16',
      scale: {
        parent: 'game-container',
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: VIEW_W,
        height: VIEW_H,
      },
      scene: { create: this.create.bind(this), update: this.update.bind(this) },
      physics: { default: 'arcade', arcade: { gravity: { y: 0 } } },
      antialias: true,
    };
    this.phaserGame = new Phaser.Game(config);
    Net.onPeer = this.handlePeerMessage.bind(this);
  },

  loadLevel(idx) {
    try {
      if (idx < 0 || idx >= LEVELS.length) {
        console.error('[Game] loadLevel out of bounds:', idx);
        App.chatSystem(`⚠ No round ${idx + 1} exists.`);
        return;
      }
      this.currentLevelIdx = idx;
      this.level = LEVELS[idx];
      this.resetState();
      this.phaserGame.scene.scenes[0].scene.restart();
    } catch (e) {
      console.error('[Game] loadLevel failed:', e);
      App.chatSystem(`⚠ Round ${idx + 1} failed to load: ${e.message}`);
    }
  },

  resetState() {
    this._stopRoundSync && this._stopRoundSync();
    this.walls = [];
    this.gateState = {};
    this.plates = {};
    this.guards = [];
    this.activePlate = null;
    this.pendingQuestion = null;
    this.finishedMe = false;
    this.finishedThem = false;
    this.roundOver = false;
    this.stunned = false;
    this.stunUntil = 0;
    this.readyToContinue = false;
    this.partnerReadyToContinue = false;
    this.questionTimerActive = false;
    this.keyState = 'idle';
    this.keyVisual = null;
    this.handoffVisual = null;
    this.lockVisual = null;
    this.carriedKeyIcon = { p1: null, p2: null };
    this.boss = null;
    this.bossPhase = 'idle';
    this.bossActivePad = null;
    this.bossAttacks = [];
    this.bossAttackNextAt = 0;
    const ohp = (this.level && this.level.overworldHp) || 3;
    this.playerHp = { 1: ohp * 4, 2: ohp * 4 }; // quarter-heart units
    this._playerHpRegenAt = 0;
    this._bossIntroStarted = false;
    this._bossQSeed = null;
    this._finishLockedNote = 0;
    this.bossIntroLockUntil = 0;
    this.bossStunUntil = 0;
    this.enemies = [];
    this.enemyNextSync = 0;
    this.enemyProjectiles = [];
    this.reviveZoneVisual = null;
    this._reviveBanner = null;
    this.reviveBoss = null;
    this.reviveBossPhase = 'idle';
    this.reviveActivePad = null;
    this.reviveAttacks = [];
    this.reviveAttackNextAt = 0;
    this.reviveStarted = false;
    this.reviveInvulnUntil = 0;
    this.dynReviveTile = null;
    this.heartsHUD = null;
    this._enemyId = 0;
    this._projId = 0;
  },

  parseLevel() {
    const L = this.level;
    this.walls = [];
    const rows = L.map.length, cols = L.map[0].length;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (L.map[y][x] === '#') this.walls.push({ x, y });
      }
    }
    for (const g of L.gates) this.gateState[g.id] = { p1Done: false, p2Done: false, open: false };
  },

  create() {
    const scene = this.phaserGame.scene.scenes[0];
    this.scene = scene;
    this.parseLevel();

    const worldW = this.level.map[0].length * this.tile();
    const worldH = this.level.map.length * this.tile();
    this.worldW = worldW;
    this.worldH = worldH;
    scene.physics.world.setBounds(0, 0, worldW, worldH);
    scene.cameras.main.setBounds(0, 0, worldW, worldH);

    if (this.level.theme && this.level.theme.bg) {
      scene.cameras.main.setBackgroundColor(this.level.theme.bg);
    }

    this.makeTextures(scene);
    this.drawFloor(scene);
    this.drawWalls(scene);
    this.makeAmbient(scene);
    this.drawFinish(scene);
    this.drawPlates(scene);
    this.drawGateDoors(scene);
    this.makeGuards(scene);
    this.spawnEnemies(scene);
    this.drawKeySystem(scene);
    this.drawReviveZone(scene);
    this.setupBoss(scene);
    this.setupHeartsHUD(scene);

    this.me = this.makePlayer(scene, Net.playerId, true);
    this.other = this.makePlayer(scene, Net.playerId === 1 ? 2 : 1, false);

    scene.physics.add.collider(this.me.body, this.wallGroup);
    scene.physics.add.collider(this.me.body, Object.values(this.gateDoorBodies));

    this.makeFog(scene);
    this.makeGateOverlay(scene);
    this.makeMinimap(scene, worldW, worldH);

    scene.cameras.main.startFollow(this.me.body, true, 0.12, 0.12);
    scene.cameras.main.setDeadzone(180, 110);

    this.cursors = scene.input.keyboard.createCursorKeys();
    this.wasd = scene.input.keyboard.addKeys('W,A,S,D');

    document.getElementById('you-label').textContent = `You: P${Net.playerId}`;
    App.updateRoundIndicator(this.currentLevelIdx + 1, LEVELS.length, this.level.name);
    App.updateKeyIndicator(this.keyState, Net.playerId, !!this.level.key);

    if (this.currentLevelIdx === 0) App.startTimer();

    if (typeof Music !== 'undefined' && Music.enabled) Music.playTrack(this.currentLevelIdx);

    try {
      if (Classroom && Classroom.connected && Classroom.connected()) {
        Classroom.sendStatus({
          pairCode: Net.roomCode,
          round: this.currentLevelIdx + 1,
          totalRounds: LEVELS.length,
          partnerConnected: !!(Net.conn && Net.conn.open),
        });
      }
    } catch (e) {}
  },

  tile() { return this.level.tile; },

  makeAmbient(scene) {
    const th = this.level.theme;
    if (!th || !th.ambient) return;
    const w = this.level.map[0].length * this.tile();
    const h = this.level.map.length * this.tile();
    const cfg = {
      leaves: { vy: { min: 8, max: 22 }, vx: { min: -10, max: 10 }, count: 28, scale: { start: 0.8, end: 0.2 }, alpha: { start: 0.55, end: 0 } },
      dust:   { vy: { min: -8, max: 8 },  vx: { min: -6, max: 6 },   count: 22, scale: { start: 0.6, end: 0.2 }, alpha: { start: 0.4, end: 0 } },
      embers: { vy: { min: -36, max: -14 }, vx: { min: -8, max: 8 }, count: 30, scale: { start: 1, end: 0.1 },   alpha: { start: 0.7, end: 0 } },
    }[th.ambient];
    if (!cfg) return;
    const startY = th.ambient === 'embers' ? h - 10 : 0;
    const yRange = th.ambient === 'embers' ? { min: h - 40, max: h - 10 } : { min: 0, max: h };
    const ambient = scene.add.particles(0, 0, 'spark', {
      x: { min: 0, max: w },
      y: yRange,
      lifespan: 4500,
      speedX: cfg.vx,
      speedY: cfg.vy,
      scale: cfg.scale,
      alpha: cfg.alpha,
      tint: th.ambientColor,
      quantity: 1,
      frequency: 5000 / cfg.count,
      blendMode: 'ADD',
    });
    ambient.setDepth(40);
  },

  makeTextures(scene) {
    const tex = scene.textures;
    if (tex.exists('spark')) tex.remove('spark');
    if (tex.exists('vision')) tex.remove('vision');

    const g = scene.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('spark', 8, 8);
    g.destroy();

    const vsz = VISION_RADIUS * 2;
    const vg = scene.make.graphics({ add: false });
    const steps = 30;
    for (let i = 0; i < steps; i++) {
      const r = (VISION_RADIUS * (steps - i)) / steps;
      vg.fillStyle(0xffffff, 0.1);
      vg.fillCircle(VISION_RADIUS, VISION_RADIUS, r);
    }
    vg.generateTexture('vision', vsz, vsz);
    vg.destroy();
  },

  drawFloor(scene) {
    const T = this.tile();
    const L = this.level;
    const th = L.theme || PALETTE;
    const bg = scene.add.graphics();
    for (let y = 0; y < L.map.length; y++) {
      for (let x = 0; x < L.map[0].length; x++) {
        if (L.map[y][x] === '#') continue;
        const color = (x + y) % 2 === 0 ? th.floor : th.floorAlt;
        bg.fillStyle(color);
        bg.fillRect(x * T, y * T, T, T);
        bg.lineStyle(1, th.grid, 0.4);
        bg.strokeRect(x * T, y * T, T, T);
      }
    }
  },

  drawWalls(scene) {
    const T = this.tile();
    const th = this.level.theme || PALETTE;
    this.wallGroup = scene.physics.add.staticGroup();
    const g = scene.add.graphics();
    for (const w of this.walls) {
      const x = w.x * T, y = w.y * T;
      g.fillStyle(th.wallSide);
      g.fillRect(x, y + 5, T, T - 5);
      g.fillStyle(th.wallTop);
      g.fillRect(x, y, T, 7);
      g.lineStyle(1, th.wallEdge, 0.8);
      g.strokeRect(x, y, T, 7);
      const r = scene.add.rectangle(x + T/2, y + T/2, T, T);
      r.setVisible(false);
      scene.physics.add.existing(r, true);
      this.wallGroup.add(r);
    }
  },

  drawFinish(scene) {
    const T = this.tile();
    const t = this.level.finish;
    const cx = t.x * T + T/2, cy = t.y * T + T/2;
    const glow = scene.add.circle(cx, cy, T * 0.9, PALETTE.finishGlow, 0.3);
    const ring = scene.add.circle(cx, cy, T/2 - 2, PALETTE.finish, 0);
    ring.setStrokeStyle(3, PALETTE.finish, 1);
    const inner = scene.add.circle(cx, cy, T/2 - 10, PALETTE.finishGlow, 0.6);
    scene.tweens.add({ targets: glow, alpha: 0.55, scale: 1.15, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: ring,  scale: 1.2,  duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: inner, alpha: 0.2,  duration: 800,  yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.finishVisuals = { glow, ring, inner };
  },

  drawPlates(scene) {
    const T = this.tile();
    this.plateGfx = {};
    for (const key of Object.keys(this.level.plates)) {
      const p = this.level.plates[key];
      const cx = p.x * T + T/2, cy = p.y * T + T/2;
      const color = p.who === 'p1' ? PALETTE.p1 : PALETTE.p2;
      const dark  = p.who === 'p1' ? PALETTE.p1Dark : PALETTE.p2Dark;
      const base = scene.add.circle(cx, cy, T/2 - 4, dark, 0.4);
      base.setStrokeStyle(2, color, 0.9);
      const inner = scene.add.circle(cx, cy, T/2 - 12, color, 0.6);
      const mark = scene.add.text(cx, cy, p.who.toUpperCase(), {
        fontFamily: 'Space Grotesk, sans-serif',
        fontSize: '13px', fontStyle: 'bold', color: '#ffffff',
      }).setOrigin(0.5);
      scene.tweens.add({ targets: inner, scale: 1.2, alpha: 0.3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.plateGfx[key] = { base, inner, mark, gateId: p.gate, who: p.who };
    }
  },

  drawGateDoors(scene) {
    const T = this.tile();
    this.gateDoorBodies = {};
    this.gateDoorVisuals = {};
    for (const g of this.level.gates) {
      const x = g.door.x * T, y = g.door.y * T;
      const cx = x + T/2, cy = y + T/2;
      const door = scene.add.graphics();
      door.fillStyle(PALETTE.gate, 1);
      door.fillRect(x, y, T, T);
      door.fillStyle(PALETTE.gateStripe, 1);
      for (let i = -T; i < T * 2; i += 10) {
        door.fillTriangle(x + i, y, x + i + 5, y, x + i - T, y + T);
        door.fillTriangle(x + i + 5, y, x + i + 10, y, x + i + 10 - T, y + T);
      }
      door.lineStyle(2, 0xffffff, 0.4);
      door.strokeRect(x + 1, y + 1, T - 2, T - 2);
      const lock = scene.add.text(cx, cy, '🔒', { fontSize: '18px' }).setOrigin(0.5);
      const body = scene.add.rectangle(cx, cy, T, T);
      body.setVisible(false);
      scene.physics.add.existing(body, true);
      this.gateDoorBodies[g.id] = body;
      this.gateDoorVisuals[g.id] = { door, lock };
    }
  },

  makeGuards(scene) {
    const T = this.tile();
    this.guards = [];
    for (const def of this.level.guards) {
      const c = scene.add.container(def.minX * T, def.y * T + T/2);
      c.setDepth(15);
      c.add(scene.add.ellipse(0, 14, 30, 9, 0x000000, 0.55));
      const aura = scene.add.circle(0, 0, 19, 0x7c3aed, 0.18);
      c.add(aura);
      const body = scene.add.graphics();
      body.fillStyle(PALETTE.guard, 0.92);
      body.fillRoundedRect(-14, -16, 28, 23, { tl: 14, tr: 14, bl: 0, br: 0 });
      body.fillTriangle(-14, 7, -10, 16, -6, 7);
      body.fillTriangle(-6, 7, -2, 16, 2, 7);
      body.fillTriangle(2, 7, 6, 16, 10, 7);
      body.fillTriangle(10, 7, 14, 14, 14, 7);
      c.add(body);
      c.add(scene.add.circle(-5, -6, 3.4, PALETTE.guardEye));
      c.add(scene.add.circle( 5, -6, 3.4, PALETTE.guardEye));
      c.add(scene.add.circle(-5, -6, 1.6, 0xffe4e4, 0.9));
      c.add(scene.add.circle( 5, -6, 1.6, 0xffe4e4, 0.9));
      scene.tweens.add({ targets: aura, scale: 1.25, alpha: 0.32, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.guards.push({
        container: c,
        minX: def.minX * T, maxX: def.maxX * T,
        y: def.y * T + T/2,
        period: def.period,
      });
    }
  },

  makePlayer(scene, id, isMe) {
    const T = this.tile();
    const spawn = this.level.spawns[id];
    const cx = spawn.x * T + T/2, cy = spawn.y * T + T/2;
    const teamColor = id === 1 ? PALETTE.p1 : PALETTE.p2;
    const teamDark = id === 1 ? PALETTE.p1Dark : PALETTE.p2Dark;
    const hairColor = id === 1 ? PALETTE.hair2 : PALETTE.hair1;

    const body = scene.add.rectangle(cx, cy, 20, 20);
    body.setVisible(false);
    scene.physics.add.existing(body);
    body.body.setCollideWorldBounds(true);

    const visual = scene.add.container(cx, cy);
    visual.setDepth(10);

    const speakRing = scene.add.circle(0, 0, 20, 0x7ee9c1, 0);
    speakRing.setStrokeStyle(3, 0x7ee9c1, 0);
    visual.add(speakRing);

    const shadow = scene.add.ellipse(0, 12, 24, 8, 0x000000, 0.35);
    const pants = scene.add.rectangle(0, 9, 16, 7, PALETTE.pants);
    pants.setStrokeStyle(1, 0x0f172a, 0.6);

    const shirt = scene.add.graphics();
    shirt.fillStyle(teamColor);
    shirt.fillRoundedRect(-10, -3, 20, 13, { tl: 5, tr: 5, bl: 2, br: 2 });
    shirt.lineStyle(1, teamDark, 0.8);
    shirt.strokeRoundedRect(-10, -3, 20, 13, { tl: 5, tr: 5, bl: 2, br: 2 });

    const armL = scene.add.circle(-10, 1, 3.3, PALETTE.skin);
    const armR = scene.add.circle( 10, 1, 3.3, PALETTE.skin);

    const head = scene.add.circle(0, -11, 9.5, PALETTE.skin);
    head.setStrokeStyle(1, 0x7b5a3c, 0.4);

    const hair = scene.add.graphics();
    hair.fillStyle(hairColor, 1);
    hair.slice(0, -11, 9.5, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), false);
    hair.fillPath();
    hair.fillCircle(-8, -11, 3);
    hair.fillCircle(8, -11, 3);

    const eyeWhiteL = scene.add.circle(-3, -11, 2.4, 0xffffff);
    const eyeWhiteR = scene.add.circle( 3, -11, 2.4, 0xffffff);
    const eyeL = scene.add.circle(-3, -11, 1.4, 0x111111);
    const eyeR = scene.add.circle( 3, -11, 1.4, 0x111111);
    const cheekL = scene.add.circle(-5, -8, 1.6, 0xffb4b4, 0.5);
    const cheekR = scene.add.circle( 5, -8, 1.6, 0xffb4b4, 0.5);

    const tag = scene.add.text(0, -26, `P${id}`, {
      fontFamily: 'Space Grotesk, sans-serif',
      fontSize: '12px', fontStyle: 'bold',
      color: id === 1 ? '#fca5a5' : '#93c5fd',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    visual.add([shadow, pants, shirt, armL, armR, head, hair, eyeWhiteL, eyeWhiteR, eyeL, eyeR, cheekL, cheekR, tag]);
    if (!isMe) visual.setAlpha(0.94);

    return { body, visual, id, eyeL, eyeR, head, shirt, pants, hair, eyeWhiteL, eyeWhiteR, armL, armR, cheekL, cheekR, shadow, speakRing };
  },

  makeFog(scene) {
    const T = this.tile();
    const w = this.level.map[0].length * T;
    const h = this.level.map.length * T;
    this.fog = scene.add.renderTexture(0, 0, w, h);
    this.fog.setOrigin(0, 0);
    this.fog.setDepth(50);
  },

  makeGateOverlay(scene) {
    this.gateOverlay = scene.add.text(VIEW_W / 2, VIEW_H / 2, '', {
      fontFamily: 'Space Grotesk, sans-serif',
      fontSize: '54px', fontStyle: 'bold',
      color: '#fbbf24', stroke: '#0b0e16', strokeThickness: 6,
      align: 'center',
    });
    this.gateOverlay.setOrigin(0.5);
    this.gateOverlay.setDepth(80);
    this.gateOverlay.setScrollFactor(0);
    this.gateOverlay.setAlpha(0);
  },

  makeMinimap(scene, worldW, worldH) {
    const margin = 12;
    const maxW = 240, maxH = 130;
    const aspect = worldW / worldH;
    let mw = maxW, mh = Math.round(mw / aspect);
    if (mh > maxH) { mh = maxH; mw = Math.round(mh * aspect); }
    const zoom = mw / worldW;
    const x = VIEW_W - mw - margin;
    const y = margin;
    const mini = scene.cameras.add(x, y, mw, mh);
    mini.setZoom(zoom);
    mini.setBounds(0, 0, worldW, worldH);
    mini.setBackgroundColor(0x05070d);
    mini.centerOn(worldW / 2, worldH / 2);
    // Hide fog + screen-anchored overlay from minimap
    if (this.fog) mini.ignore(this.fog);
    if (this.gateOverlay) mini.ignore(this.gateOverlay);
    this.minimap = mini;

    // Frame around the minimap (drawn on main camera only)
    const frame = scene.add.graphics();
    frame.lineStyle(2, 0x7ee9c1, 0.7);
    frame.strokeRect(x - 1, y - 1, mw + 2, mh + 2);
    frame.setScrollFactor(0);
    frame.setDepth(90);
    mini.ignore(frame);
    this.minimapFrame = frame;
  },

  drawKeySystem(scene) {
    if (!this.level.key) return;
    const T = this.tile();
    const K = this.level.key;

    // Handoff pad (always visible while key system in play)
    const hx = K.handoff.x * T + T/2, hy = K.handoff.y * T + T/2;
    const handGlow = scene.add.circle(hx, hy, T * 0.55, 0xfbbf24, 0.18);
    const handRing = scene.add.circle(hx, hy, T/2 - 4, 0xfbbf24, 0);
    handRing.setStrokeStyle(2, 0xfbbf24, 0.7);
    const handMark = scene.add.text(hx, hy, '↔', {
      fontFamily: 'Space Grotesk, sans-serif', fontSize: '20px',
      fontStyle: 'bold', color: '#fbbf24',
    }).setOrigin(0.5);
    scene.tweens.add({ targets: handGlow, alpha: 0.35, scale: 1.15, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.handoffVisual = { glow: handGlow, ring: handRing, mark: handMark };

    // Lock overlays the finish tile (P2 must walk it with the key)
    const lx = K.lock.x * T + T/2, ly = K.lock.y * T + T/2;
    const lockGlow = scene.add.circle(lx, ly, T * 0.85, 0xef4444, 0.28);
    const lockRing = scene.add.circle(lx, ly, T/2 + 2, 0xef4444, 0);
    lockRing.setStrokeStyle(3, 0xef4444, 0.95);
    const lockIcon = scene.add.text(lx, ly, '🔒', { fontSize: '30px' }).setOrigin(0.5);
    lockGlow.setDepth(5);
    lockRing.setDepth(6);
    lockIcon.setDepth(7);
    scene.tweens.add({ targets: lockGlow, alpha: 0.5, scale: 1.25, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: lockIcon, scale: 1.15, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.lockVisual = { glow: lockGlow, ring: lockRing, icon: lockIcon };

    // Key sprite (visible when idle or at_handoff)
    this.keyVisual = this._makeKeySprite(scene, K.spawn.x * T + T/2, K.spawn.y * T + T/2);
  },

  _makeKeySprite(scene, x, y) {
    const c = scene.add.container(x, y);
    c.setDepth(12);
    const glow = scene.add.circle(0, 0, 14, 0xfbbf24, 0.35);
    const bow = scene.add.circle(-6, 0, 5.5, 0xfbbf24);
    bow.setStrokeStyle(1.5, 0x78350f);
    const hole = scene.add.circle(-6, 0, 2, 0x1a0f00);
    const shaft = scene.add.rectangle(2, 0, 12, 3, 0xfbbf24);
    shaft.setStrokeStyle(1, 0x78350f);
    const tooth1 = scene.add.rectangle(6, 3, 3, 4, 0xfbbf24);
    const tooth2 = scene.add.rectangle(8, 3, 2, 3, 0xfbbf24);
    c.add([glow, bow, hole, shaft, tooth1, tooth2]);
    scene.tweens.add({ targets: c, y: y - 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: glow, alpha: 0.6, scale: 1.3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return c;
  },

  setKeyState(newState, fromMe) {
    const T = this.tile();
    const K = this.level.key;
    if (!K) return;
    this.keyState = newState;

    // Update world key sprite
    if (this.keyVisual) {
      if (newState === 'idle') {
        this.keyVisual.setVisible(true);
        this.scene.tweens.killTweensOf(this.keyVisual);
        this.keyVisual.x = K.spawn.x * T + T/2;
        const y = K.spawn.y * T + T/2;
        this.keyVisual.y = y;
        this.scene.tweens.add({ targets: this.keyVisual, y: y - 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      } else if (newState === 'at_handoff') {
        this.keyVisual.setVisible(true);
        this.scene.tweens.killTweensOf(this.keyVisual);
        this.keyVisual.x = K.handoff.x * T + T/2;
        const y = K.handoff.y * T + T/2;
        this.keyVisual.y = y;
        this.scene.tweens.add({ targets: this.keyVisual, y: y - 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      } else {
        this.keyVisual.setVisible(false);
      }
    }

    // Carried-key icons above players
    this._setCarryIcon('p1', newState === 'p1');
    this._setCarryIcon('p2', newState === 'p2');

    if (newState === 'used' && this.lockVisual) {
      const v = this.lockVisual;
      this.scene.tweens.killTweensOf(v.glow);
      this.scene.tweens.add({
        targets: [v.glow, v.ring, v.icon],
        alpha: 0, scale: 0.4, duration: 400, ease: 'Back.easeIn',
        onComplete: () => { v.glow.setVisible(false); v.ring.setVisible(false); v.icon.setVisible(false); }
      });
      this.burst(v.glow.x, v.glow.y, 0xfbbf24, 24);
      this.flashGateOverlay('FINISH UNLOCKED');
      SFX.gateOpen();
    }

    App.updateKeyIndicator(newState, Net.playerId, true);
  },

  _setCarryIcon(who, on) {
    const target = (Net.playerId === 1 && who === 'p1') || (Net.playerId === 2 && who === 'p2')
      ? this.me
      : this.other;
    if (!target) return;
    let icon = this.carriedKeyIcon[who];
    if (on && !icon) {
      icon = this.scene.add.text(0, -36, '🔑', { fontSize: '18px' }).setOrigin(0.5);
      icon.setDepth(11);
      target.visual.add(icon);
      this.carriedKeyIcon[who] = icon;
      this.scene.tweens.add({ targets: icon, y: -40, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else if (!on && icon) {
      this.scene.tweens.killTweensOf(icon);
      icon.destroy();
      this.carriedKeyIcon[who] = null;
    }
  },

  checkKey() {
    if (!this.level.key) return;
    const T = this.tile();
    const K = this.level.key;
    const mx = Math.floor(this.me.body.x / T);
    const my = Math.floor(this.me.body.y / T);
    const onTile = (pt) => pt.x === mx && pt.y === my;
    const meIsP1 = Net.playerId === 1;

    if (this.keyState === 'idle' && meIsP1 && onTile(K.spawn)) {
      this.setKeyState('p1', true);
      Net.send({ type: 'key', state: 'p1' });
      Music.keyJingle();
      App.chatSystem('🔑 You picked up the key. Take it to the handoff pad.');
      this.burst(this.me.body.x, this.me.body.y, 0xfbbf24, 14);
    } else if (this.keyState === 'p1' && meIsP1 && onTile(K.handoff)) {
      this.setKeyState('at_handoff', true);
      Net.send({ type: 'key', state: 'at_handoff' });
      SFX.plateOn();
      App.chatSystem('🔑 Key dropped at the handoff pad. Partner: grab it!');
      this.burst(this.me.body.x, this.me.body.y, 0xfbbf24, 12);
    } else if (this.keyState === 'at_handoff' && !meIsP1 && onTile(K.handoff)) {
      this.setKeyState('p2', true);
      Net.send({ type: 'key', state: 'p2' });
      Music.keyJingle();
      App.chatSystem('🔑 You took the key. Carry it to the 🔒 finish.');
      this.burst(this.me.body.x, this.me.body.y, 0xfbbf24, 14);
    } else if (this.keyState === 'p2' && !meIsP1 && onTile(K.lock)) {
      this.setKeyState('used', true);
      Net.send({ type: 'key', state: 'used' });
      App.chatSystem('🔓 Finish unlocked!');
      this.burst(this.me.body.x, this.me.body.y, 0xfbbf24, 24);
    }
  },

  // ─── Boss ────────────────────────────────────────────────────────
  setupBoss(scene) {
    if (!this.level.boss) { this.boss = null; return; }
    const cfg = this.level.boss;
    const T = this.tile();

    // Hide finish until boss dies
    if (this.finishVisuals) {
      this.finishVisuals.glow.setVisible(false);
      this.finishVisuals.ring.setVisible(false);
      this.finishVisuals.inner.setVisible(false);
    }

    const bx = cfg.spawn.x * T + T/2;
    const by = cfg.spawn.y * T + T/2;

    const C = cfg.colors || { aura: 0xa78bfa, aura2: 0xc4b5fd, eye: 0xef4444, accent: 0xc4b5fd };
    const container = scene.add.container(bx, by);
    container.setDepth(14);
    container.setScale(0); // start hidden — intro tweens up

    // Aura
    const aura = scene.add.circle(0, 0, 60, C.aura, 0.18);
    const aura2 = scene.add.circle(0, 0, 44, C.aura2, 0.25);
    const bodyShadow = scene.add.ellipse(0, 38, 80, 14, 0x000000, 0.5);

    const body = scene.add.graphics();
    const variant = cfg.visual || 'librarian';
    if (variant === 'warden') {
      // Thorny bramble mass — overlapping dark green blobs with spikes
      body.fillStyle(0x14532d, 1);
      body.fillCircle(0, 0, 30);
      body.fillCircle(-18, -8, 16);
      body.fillCircle(18, -6, 17);
      body.fillCircle(-10, 16, 14);
      body.fillCircle(12, 18, 13);
      body.lineStyle(3, C.aura, 0.85);
      body.strokeCircle(0, 0, 30);
      body.fillStyle(0x166534, 1);
      // Thorns (triangles around silhouette)
      const thorns = [[0,-34],[-20,-22],[22,-22],[-32,-4],[32,-4],[-22,22],[22,22],[0,32]];
      for (const [tx, ty] of thorns) {
        const ang = Math.atan2(ty, tx);
        const dx = Math.cos(ang), dy = Math.sin(ang);
        body.fillTriangle(tx, ty, tx - dy * 4, ty + dx * 4, tx + dx * 7, ty + dy * 7);
      }
      body.lineStyle(2, 0x86efac, 0.6);
      body.strokeCircle(-14, -4, 5);
      body.strokeCircle(13, -2, 5);
    } else if (variant === 'lich') {
      // Skull — pale dome with hollow eyes (single big central eye glows)
      body.fillStyle(0xfaf5e6, 1);
      body.fillRoundedRect(-30, -32, 60, 50, 22);
      body.fillRect(-22, 12, 44, 14);
      // Jaw teeth
      body.fillStyle(0xfaf5e6, 1);
      for (let i = -18; i <= 14; i += 8) body.fillRect(i, 22, 5, 8);
      body.lineStyle(3, C.aura, 0.95);
      body.strokeRoundedRect(-30, -32, 60, 50, 22);
      // Cracks
      body.lineStyle(1.5, 0x991b1b, 0.7);
      body.beginPath();
      body.moveTo(-14, -28); body.lineTo(-8, -18); body.lineTo(-16, -10);
      body.moveTo(18, -24); body.lineTo(12, -14);
      body.strokePath();
      // Side eye sockets (hollow black)
      body.fillStyle(0x1a0606, 1);
      body.fillCircle(-14, -8, 6);
      body.fillCircle(14, -8, 6);
      // Crown spikes
      body.fillStyle(C.aura, 1);
      body.fillTriangle(-22, -32, -16, -44, -10, -32);
      body.fillTriangle(-6, -32, 0, -48, 6, -32);
      body.fillTriangle(10, -32, 16, -44, 22, -32);
    } else {
      // Librarian (default) — floating tome with runes
      body.fillStyle(0x2d1f44, 1);
      body.fillRoundedRect(-32, -28, 64, 56, 6);
      body.lineStyle(3, C.aura, 0.9);
      body.strokeRoundedRect(-32, -28, 64, 56, 6);
      body.fillStyle(0x1a1430, 1);
      body.fillRect(-4, -28, 8, 56);
      body.lineStyle(1.5, 0x5b3d7d, 0.8);
      body.strokeRect(-4, -28, 8, 56);
      body.lineStyle(2, C.accent, 0.6);
      body.beginPath();
      body.moveTo(-22, -14); body.lineTo(-12, -14);
      body.moveTo(-22, 14);  body.lineTo(-12, 14);
      body.moveTo(12, -14);  body.lineTo(22, -14);
      body.moveTo(12, 14);   body.lineTo(22, 14);
      body.strokePath();
    }

    // Single central eye — same across variants
    const eyeY = variant === 'lich' ? 0 : 0;
    const eyeWhite = scene.add.circle(0, eyeY, 9, 0xfef3c7, 1);
    const eyeIris = scene.add.circle(0, eyeY, 6, C.eye, 1);
    const eyePupil = scene.add.circle(0, eyeY, 3, 0x000000, 1);
    const eyeGlow = scene.add.circle(0, eyeY, 14, C.eye, 0.4);

    container.add([aura, aura2, bodyShadow, body, eyeGlow, eyeWhite, eyeIris, eyePupil]);

    // Floating bob + aura pulse
    scene.tweens.add({ targets: container, y: by - 8, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: aura, scale: 1.25, alpha: 0.32, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: aura2, scale: 1.18, alpha: 0.45, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: eyeGlow, scale: 1.4, alpha: 0.7, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Attack pads — ring around boss, anyone can use
    const padGfx = {};
    for (const key of Object.keys(cfg.pads)) {
      const p = cfg.pads[key];
      const px = p.x * T + T/2, py = p.y * T + T/2;
      const color = 0xfbbf24, dark = 0x78350f;
      const base = scene.add.circle(px, py, T/2 - 4, dark, 0.5);
      base.setStrokeStyle(2, color, 0.95);
      const inner = scene.add.circle(px, py, T/2 - 12, color, 0.65);
      const mark = scene.add.text(px, py, '⚔', {
        fontFamily: 'Space Grotesk, sans-serif',
        fontSize: '17px', fontStyle: 'bold', color: '#1a0a0a',
      }).setOrigin(0.5);
      const pulseTween = scene.tweens.add({ targets: inner, scale: 1.25, alpha: 0.35, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      padGfx[key] = { base, inner, mark, pulseTween, tile: { x: p.x, y: p.y }, cooldownUntil: 0, color, dark };
    }

    // Boss HP bar (screen-anchored)
    const hpBarW = 420, hpBarH = 18;
    const hpX = VIEW_W / 2 - hpBarW / 2;
    const hpY = 18;
    const hpBg = scene.add.rectangle(hpX, hpY, hpBarW, hpBarH, 0x0b0e16, 0.85).setOrigin(0, 0);
    hpBg.setStrokeStyle(2, 0xef4444, 0.9);
    hpBg.setScrollFactor(0);
    hpBg.setDepth(85);
    const hpFill = scene.add.rectangle(hpX + 2, hpY + 2, hpBarW - 4, hpBarH - 4, 0xef4444, 0.95).setOrigin(0, 0);
    hpFill.setScrollFactor(0);
    hpFill.setDepth(86);
    const hpLabel = scene.add.text(VIEW_W / 2, hpY + hpBarH + 6, cfg.name, {
      fontFamily: 'Space Grotesk, sans-serif',
      fontSize: '14px', fontStyle: 'bold',
      color: '#fca5a5', stroke: '#0b0e16', strokeThickness: 3,
    }).setOrigin(0.5, 0);
    hpLabel.setScrollFactor(0);
    hpLabel.setDepth(86);
    // Hide HP bar until intro completes
    hpBg.setVisible(false); hpFill.setVisible(false); hpLabel.setVisible(false);

    // Player hearts (screen-anchored, bottom-left)
    const hearts = scene.add.text(20, VIEW_H - 32, '', {
      fontFamily: 'Space Grotesk, sans-serif',
      fontSize: '20px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#0b0e16', strokeThickness: 3,
    });
    hearts.setScrollFactor(0);
    hearts.setDepth(86);
    hearts.setVisible(false);

    // Ignore HUD elements from minimap
    if (this.minimap) {
      this.minimap.ignore([hpBg, hpFill, hpLabel, hearts]);
    }

    this.boss = {
      cfg,
      container,
      eyeIris, eyePupil, eyeGlow,
      hpBg, hpFill, hpLabel, hpBarW,
      hearts,
      padGfx,
      hp: cfg.hp,
      alive: true,
      worldX: bx, worldY: by,
    };
    this.bossPhase = 'idle'; // becomes 'intro' when both players enter arena
  },

  checkBossIntroTrigger() {
    if (!this.boss || this.bossPhase !== 'idle') return;
    const cfg = this.level.boss;
    const T = this.tile();
    const myY = this.me.body.y / T;
    const otherY = this.other.body.y / T;
    const bothIn = myY >= cfg.arenaYMin && otherY >= cfg.arenaYMin;
    if (!bothIn) return;

    // Host triggers; clients wait for the broadcast
    if (Net.isHost) {
      const startAt = performance.now();
      this.startBossIntro(startAt);
      Net.send({ type: 'boss_intro_start', at: startAt });
    }
    this._bossIntroStarted = true; // prevent re-trigger from this client
  },

  startBossIntro(startedAt) {
    if (this.bossPhase !== 'idle') return;
    this.bossPhase = 'intro';
    const scene = this.scene;
    const b = this.boss;
    const C = (this.level.boss.colors) || { aura: 0xa78bfa, aura2: 0xc4b5fd, eye: 0xef4444, accent: 0xc4b5fd };

    // Lock both players
    this.bossIntroLockUntil = (startedAt || performance.now()) + 3800;
    this.me.body.body.setVelocity(0, 0);

    // Camera dramatics — stop follow, pan to boss, slight zoom
    scene.cameras.main.stopFollow();
    scene.cameras.main.pan(b.worldX, b.worldY - 20, 800, 'Sine.easeInOut');
    scene.cameras.main.zoomTo(1.3, 800, 'Sine.easeInOut');

    // Gentle tremor before boss rises — builds tension
    scene.cameras.main.shake(700, 0.004);

    // Dim overlay (screen-anchored)
    const dim = scene.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0).setOrigin(0, 0);
    dim.setScrollFactor(0);
    dim.setDepth(70);
    if (this.minimap) this.minimap.ignore(dim);
    scene.tweens.add({ targets: dim, alpha: 0.6, duration: 600 });

    // Vignette tint pulse (boss color washes over screen)
    const tint = scene.add.rectangle(0, 0, VIEW_W, VIEW_H, C.aura, 0).setOrigin(0, 0);
    tint.setScrollFactor(0); tint.setDepth(71); tint.setBlendMode('ADD');
    if (this.minimap) this.minimap.ignore(tint);
    scene.tweens.add({ targets: tint, alpha: 0.18, duration: 500, yoyo: true, repeat: 2,
      onComplete: () => tint.destroy() });

    // Letterbox bars
    const barH = 60;
    const barTop = scene.add.rectangle(0, -barH, VIEW_W, barH, 0x000000, 0.95).setOrigin(0, 0);
    const barBot = scene.add.rectangle(0, VIEW_H, VIEW_W, barH, 0x000000, 0.95).setOrigin(0, 0);
    barTop.setScrollFactor(0); barBot.setScrollFactor(0);
    barTop.setDepth(82); barBot.setDepth(82);
    if (this.minimap) this.minimap.ignore([barTop, barBot]);
    scene.tweens.add({ targets: barTop, y: 0, duration: 500, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: barBot, y: VIEW_H - barH, duration: 500, ease: 'Cubic.easeOut' });

    // Lightning bolts striking from off-screen down to boss (3 staggered)
    for (let i = 0; i < 3; i++) {
      scene.time.delayedCall(420 + i * 180, () => {
        const sx = b.worldX + (Math.random() - 0.5) * 280;
        const sy = b.worldY - 320;
        this._drawLightning(scene, sx, sy, b.worldX, b.worldY - 28, C.aura);
        scene.cameras.main.flash(70, 240, 240, 255, false);
      });
    }

    // Radial shockwave from boss center, expanding fast
    scene.time.delayedCall(700, () => {
      const sw = scene.add.circle(b.worldX, b.worldY, 14, 0xffffff, 0);
      sw.setStrokeStyle(6, C.eye, 0.95);
      sw.setDepth(74);
      scene.tweens.add({
        targets: sw, scale: { from: 0.3, to: 18 }, alpha: { from: 1, to: 0 },
        duration: 1100, ease: 'Cubic.easeOut',
        onComplete: () => sw.destroy(),
      });
      const sw2 = scene.add.circle(b.worldX, b.worldY, 14, 0xffffff, 0);
      sw2.setStrokeStyle(3, C.aura, 0.7);
      sw2.setDepth(73);
      scene.tweens.add({
        targets: sw2, scale: { from: 0.3, to: 26 }, alpha: { from: 0.8, to: 0 },
        duration: 1400, delay: 150, ease: 'Cubic.easeOut',
        onComplete: () => sw2.destroy(),
      });
    });

    // Particle eruption at boss feet
    scene.time.delayedCall(550, () => {
      const eruption = scene.add.particles(b.worldX, b.worldY + 30, 'spark', {
        speed: { min: 90, max: 240 },
        scale: { start: 1.7, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [C.aura, C.eye, C.aura2],
        lifespan: 900,
        quantity: 36,
        blendMode: 'ADD',
        emitting: false,
      });
      eruption.setDepth(75);
      eruption.explode(36);
      scene.time.delayedCall(1100, () => eruption.destroy());
    });

    // Boss rises from floor with overshoot + spin
    scene.tweens.add({
      targets: b.container, scale: { from: 0, to: 1.18 }, angle: { from: -25, to: 0 },
      duration: 850, delay: 500, ease: 'Back.easeOut',
      onComplete: () => scene.tweens.add({ targets: b.container, scale: 1, duration: 280, ease: 'Sine.easeInOut' }),
    });

    // Name banner
    const name = scene.add.text(VIEW_W / 2, VIEW_H / 2 - 24, this.level.boss.name, {
      fontFamily: 'Space Grotesk, sans-serif',
      fontSize: '64px', fontStyle: 'bold',
      color: '#fca5a5', stroke: '#1a0a0a', strokeThickness: 8,
      align: 'center',
    }).setOrigin(0.5);
    name.setScrollFactor(0); name.setDepth(90);
    name.setAlpha(0); name.setScale(0.6);
    if (this.minimap) this.minimap.ignore(name);

    const subtitle = scene.add.text(VIEW_W / 2, VIEW_H / 2 + 38, this.level.boss.subtitle, {
      fontFamily: 'Inter, sans-serif',
      fontSize: '20px',
      color: '#c4b5fd', stroke: '#1a0a0a', strokeThickness: 3,
    }).setOrigin(0.5);
    subtitle.setScrollFactor(0); subtitle.setDepth(90);
    subtitle.setAlpha(0);
    if (this.minimap) this.minimap.ignore(subtitle);

    scene.tweens.add({ targets: name, alpha: 1, scale: 1, duration: 500, delay: 1000, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: subtitle, alpha: 1, duration: 400, delay: 1400 });

    // Sequential color flashes painted in the boss palette
    scene.time.delayedCall(900, () => {
      const rgb = this._hexToRGB(C.aura);
      scene.cameras.main.flash(150, rgb[0], rgb[1], rgb[2], false);
    });
    scene.time.delayedCall(1300, () => {
      const rgb = this._hexToRGB(C.eye);
      scene.cameras.main.flash(120, rgb[0], rgb[1], rgb[2], false);
    });

    // Swap to boss music + dramatic stinger
    this.bossStinger();
    if (typeof Music !== 'undefined' && Music.enabled && !Music.muted) {
      try { Music.playBossTrack(this.currentLevelIdx); } catch (e) {}
    }

    // "FIGHT!" flash + camera shake
    scene.time.delayedCall(2500, () => {
      const fight = scene.add.text(VIEW_W / 2, VIEW_H / 2, 'FIGHT!', {
        fontFamily: 'Space Grotesk, sans-serif',
        fontSize: '130px', fontStyle: 'bold',
        color: '#fbbf24', stroke: '#1a0a0a', strokeThickness: 12,
      }).setOrigin(0.5);
      fight.setScrollFactor(0); fight.setDepth(95);
      fight.setScale(0.3); fight.setAlpha(0);
      if (this.minimap) this.minimap.ignore(fight);
      scene.tweens.add({ targets: fight, scale: 1.2, alpha: 1, duration: 280, ease: 'Back.easeOut' });
      scene.tweens.add({ targets: fight, alpha: 0, scale: 1.55, duration: 500, delay: 700, onComplete: () => fight.destroy() });
      scene.cameras.main.shake(520, 0.02);
      scene.cameras.main.flash(280, 251, 191, 36, false);
      this.bossRoar();
    });

    // Release: tween out everything, resume follow, start fight
    scene.time.delayedCall(3600, () => {
      scene.tweens.add({ targets: [dim, name, subtitle], alpha: 0, duration: 400, onComplete: () => {
        dim.destroy(); name.destroy(); subtitle.destroy();
      }});
      scene.tweens.add({ targets: barTop, y: -barH, duration: 400, ease: 'Cubic.easeIn', onComplete: () => barTop.destroy() });
      scene.tweens.add({ targets: barBot, y: VIEW_H, duration: 400, ease: 'Cubic.easeIn', onComplete: () => barBot.destroy() });
      scene.cameras.main.zoomTo(1, 500, 'Sine.easeInOut');
      scene.cameras.main.startFollow(this.me.body, true, 0.12, 0.12);
      scene.cameras.main.setDeadzone(180, 110);
      b.hpBg.setVisible(true); b.hpFill.setVisible(true); b.hpLabel.setVisible(true);
      b.hearts.setVisible(true);
      this.updatePlayerHearts();
      this.bossPhase = 'fight';
      this.bossAttackNextAt = performance.now() + 2000;
      App.chatSystem('⚔ Stand on your pad and answer questions to damage the boss. Dodge red zones!');
    });
  },

  updatePlayerHearts() {
    const mineQ = this.playerHp[Net.playerId] || 0;
    const inBossFight = this.boss && this.bossPhase === 'fight';
    const max = inBossFight ? this.level.boss.playerHp : (this.level.overworldHp || 3);
    const fullHearts = Math.floor(mineQ / 4);
    const rem = mineQ - fullHearts * 4;
    const fracGlyph = ['', '¼', '½', '¾'][rem] || '';
    let s = '';
    for (let i = 0; i < fullHearts; i++) s += '❤ ';
    if (rem > 0) s += fracGlyph + ' ';
    const usedSlots = fullHearts + (rem > 0 ? 1 : 0);
    for (let i = usedSlots; i < max; i++) s += '🖤 ';
    if (this.boss && this.boss.hearts) this.boss.hearts.setText(s.trim());
    if (this.heartsHUD) {
      this.heartsHUD.setText(s.trim());
      const showHUD = !inBossFight && ((this.level.enemies && this.level.enemies.length > 0) || this.reviveBoss);
      this.heartsHUD.setVisible(showHUD);
    }
  },

  updateBossHpBar() {
    if (!this.boss) return;
    const ratio = Math.max(0, this.boss.hp / this.level.boss.hp);
    const targetW = Math.max(0, (this.boss.hpBarW - 4) * ratio);
    this.scene.tweens.add({ targets: this.boss.hpFill, width: targetW, duration: 280, ease: 'Cubic.easeOut' });
  },

  // ─── Hearts HUD (persistent, used outside boss fights) ──────────
  setupHeartsHUD(scene) {
    const hud = scene.add.text(20, VIEW_H - 32, '', {
      fontFamily: 'Space Grotesk, sans-serif',
      fontSize: '20px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#0b0e16', strokeThickness: 3,
    });
    hud.setScrollFactor(0);
    hud.setDepth(86);
    hud.setVisible(false);
    if (this.minimap) this.minimap.ignore(hud);
    this.heartsHUD = hud;
    this.updatePlayerHearts();
  },

  // ─── Enemies ────────────────────────────────────────────────────
  isTileFree(tx, ty) {
    const m = this.level.map;
    if (!m || ty < 0 || ty >= m.length || tx < 0 || tx >= m[0].length) return false;
    return m[ty][tx] !== '#';
  },

  findOpenTileNear(baseX, baseY) {
    // Spiral search for nearest non-wall tile to (baseX, baseY).
    for (let r = 0; r <= 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const tx = baseX + dx, ty = baseY + dy;
          if (this.isTileFree(tx, ty)) return { x: tx, y: ty };
        }
      }
    }
    return null;
  },

  expandEnemyDefs(defs) {
    // 4x monsters: keep original def, then place 3 clones at nearby open tiles.
    const out = [];
    const used = new Set();
    const key = (x, y) => `${x},${y}`;
    const offsets = [
      [2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, -2], [2, -2], [-2, 2],
      [3, 1], [-3, -1], [1, 3], [-1, -3], [4, 0], [-4, 0], [0, 4], [0, -4],
    ];
    for (const def of defs) {
      const orig = this.findOpenTileNear(def.x, def.y) || { x: def.x, y: def.y };
      if (!used.has(key(orig.x, orig.y))) {
        used.add(key(orig.x, orig.y));
        out.push({ ...def, x: orig.x, y: orig.y });
      }
      if (def.noExpand) continue;
      let added = 0;
      const shuffled = offsets.slice().sort(() => Math.random() - 0.5);
      for (const [dx, dy] of shuffled) {
        if (added >= 3) break;
        const tile = this.findOpenTileNear(def.x + dx, def.y + dy);
        if (!tile) continue;
        const k = key(tile.x, tile.y);
        if (used.has(k)) continue;
        used.add(k);
        const clone = { ...def, x: tile.x, y: tile.y };
        // Re-center patrol range on the new x; preserve span.
        if (def.minX != null && def.maxX != null) {
          const span = (def.maxX - def.minX) / 2;
          clone.minX = Math.max(1, tile.x - span);
          clone.maxX = tile.x + span;
        }
        out.push(clone);
        added++;
      }
    }
    return out;
  },

  spawnEnemies(scene) {
    this.enemies = [];
    const defs = this.expandEnemyDefs(this.level.enemies || []);
    const T = this.tile();
    for (const def of defs) {
      const type = ENEMY_TYPES[def.type];
      if (!type) continue;
      const id = ++this._enemyId;
      const wx = def.x * T + T/2;
      const wy = def.y * T + T/2;
      const c = scene.add.container(wx, wy);
      c.setDepth(13);
      c.add(scene.add.ellipse(0, type.size * 0.85, type.size * 1.6, type.size * 0.5, 0x000000, 0.5));
      const aura = scene.add.circle(0, 0, type.size + 4, type.color, 0.22);
      c.add(aura);
      const body = scene.add.graphics();
      body.fillStyle(type.color, 0.95);
      body.fillRoundedRect(-type.size, -type.size, type.size * 2, type.size * 1.7, { tl: type.size, tr: type.size, bl: 3, br: 3 });
      body.lineStyle(2, 0x000000, 0.5);
      body.strokeRoundedRect(-type.size, -type.size, type.size * 2, type.size * 1.7, { tl: type.size, tr: type.size, bl: 3, br: 3 });
      c.add(body);
      const eyeR = Math.max(2, type.size * 0.28);
      const eyeY = -type.size * 0.4;
      c.add(scene.add.circle(-type.size * 0.4, eyeY, eyeR, type.eye));
      c.add(scene.add.circle( type.size * 0.4, eyeY, eyeR, type.eye));
      scene.tweens.add({ targets: aura, scale: 1.25, alpha: 0.32, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

      // Per-enemy HP bar (compact)
      const hpW = Math.max(24, type.size * 2);
      const hpBg = scene.add.rectangle(0, -type.size - 8, hpW, 4, 0x0b0e16, 0.85).setOrigin(0.5);
      const hpFg = scene.add.rectangle(-hpW/2 + 1, -type.size - 8, hpW - 2, 2, 0xef4444, 0.95).setOrigin(0, 0.5);
      hpBg.setVisible(type.hp > 1);
      hpFg.setVisible(type.hp > 1);
      c.add([hpBg, hpFg]);

      this.enemies.push({
        id, type: def.type, def, typeRef: type,
        container: c, aura, hpBg, hpFg, hpW: hpW - 2,
        x: wx, y: wy, targetX: wx, targetY: wy,
        hp: type.hp, maxHp: type.hp, alive: true,
        dir: 1, fireAt: performance.now() + 1500 + Math.random() * 1500,
        spawnTileX: def.x, spawnTileY: def.y,
        // For patrol AI
        minX: (def.minX != null ? def.minX * T : (def.x - 4) * T),
        maxX: (def.maxX != null ? def.maxX * T : (def.x + 4) * T),
      });
    }
  },

  reviveQuestionActive() {
    // True whenever any question panel is open — freezes ghosts/projectiles/guards.
    return !!this.pendingQuestion;
  },

  enemyTick(time) {
    if (!Net.isHost) return;
    if (this.reviveQuestionActive()) return;
    if (!this.enemies || this.enemies.length === 0) return;
    const T = this.tile();
    const now = performance.now();
    const dt = Math.min(0.05, (this.scene.game.loop.delta || 16) / 1000);
    const meBody = this.me && this.me.body;
    const otherBody = this.other && this.other.body;
    const players = [];
    if (meBody && (this.playerHp[Net.playerId] || 0) > 0) players.push({ pid: Net.playerId, x: meBody.x, y: meBody.y });
    const otherPid = Net.playerId === 1 ? 2 : 1;
    if (otherBody && (this.playerHp[otherPid] || 0) > 0) players.push({ pid: otherPid, x: otherBody.x, y: otherBody.y });

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const t = e.typeRef;
      const prevX = e.x, prevY = e.y;
      if (t.ai === 'patrol') {
        // Short-leash chase: if a player is within ~3 tiles, briefly home in on them.
        let chasing = null, chaseDist = Infinity;
        const aggroRange = T * 3.2;
        for (const p of players) {
          const d = Math.hypot(p.x - e.x, p.y - e.y);
          if (d < aggroRange && d < chaseDist) { chasing = p; chaseDist = d; }
        }
        if (chasing) {
          const ang = Math.atan2(chasing.y - e.y, chasing.x - e.x);
          const sp = t.speed * 1.15;
          e.x += Math.cos(ang) * sp * dt;
          e.y += Math.sin(ang) * sp * dt;
        } else {
          e.x += e.dir * t.speed * dt;
          if (e.x < e.minX) { e.x = e.minX; e.dir = 1; }
          if (e.x > e.maxX) { e.x = e.maxX; e.dir = -1; }
          const homeY = e.spawnTileY * T + T/2;
          if (Math.abs(e.y - homeY) > 2) e.y += Math.sign(homeY - e.y) * t.speed * 0.5 * dt;
        }
      } else if (t.ai === 'chase' && players.length > 0) {
        let best = players[0], bestD = Infinity;
        for (const p of players) {
          const d = Math.hypot(p.x - e.x, p.y - e.y);
          if (d < bestD) { bestD = d; best = p; }
        }
        if (bestD < 400) {
          const ang = Math.atan2(best.y - e.y, best.x - e.x);
          e.x += Math.cos(ang) * t.speed * dt;
          e.y += Math.sin(ang) * t.speed * dt;
        }
      } else if (t.ai === 'shooter' && players.length > 0 && now >= e.fireAt) {
        let best = players[0], bestD = Infinity;
        for (const p of players) {
          const d = Math.hypot(p.x - e.x, p.y - e.y);
          if (d < bestD) { bestD = d; best = p; }
        }
        if (bestD <= (t.range || 320)) {
          const ang = Math.atan2(best.y - e.y, best.x - e.x);
          const speed = t.projSpeed || 160;
          const vx = Math.cos(ang) * speed, vy = Math.sin(ang) * speed;
          const ttl = 1500;
          const pid = ++this._projId;
          this.spawnProjectile({ id: pid, x: e.x, y: e.y, vx, vy, dieAt: now + ttl, color: t.eye });
          Net.send({ type: 'enemy_shot', id: pid, x: e.x, y: e.y, vx, vy, ttl, color: t.eye });
          e.fireAt = now + (t.fireMs || 2400);
        } else {
          e.fireAt = now + 600;
        }
      }

      // Wall + closed-gate collision — axis-separated so they slide along walls.
      if (e.x !== prevX || e.y !== prevY) {
        const xTileNew = Math.floor(e.x / T);
        const yTileNew = Math.floor(e.y / T);
        const xTileOld = Math.floor(prevX / T);
        const yTileOld = Math.floor(prevY / T);
        if (this.isMobBlocked(xTileNew, yTileOld)) e.x = prevX;
        if (this.isMobBlocked(xTileOld, yTileNew)) e.y = prevY;
        // Final guard: never sit on a blocked tile
        if (this.isMobBlocked(Math.floor(e.x / T), Math.floor(e.y / T))) {
          e.x = prevX; e.y = prevY;
        }
      }

      // Contact damage to nearby player
      if (t.contactRadius > 0) {
        for (const p of players) {
          if (Math.hypot(p.x - e.x, p.y - e.y) <= t.contactRadius) {
            this.applyEnemyDamage(p.pid, t.damage, p.x - e.x, p.y - e.y, e.id);
            break;
          }
        }
      }
    }
  },

  isMobBlocked(tx, ty) {
    if (!this.isTileFree(tx, ty)) return true;
    if (this.level && this.level.gates) {
      for (const g of this.level.gates) {
        if (g.door.x === tx && g.door.y === ty) {
          const st = this.gateState[g.id];
          if (st && !st.open) return true;
        }
      }
    }
    return false;
  },

  updateEnemyVisuals() {
    if (!this.enemies) return;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      // Host: snap visual to its authoritative x/y. Client: interp toward target.
      if (Net.isHost) {
        e.container.x = e.x;
        e.container.y = e.y;
      } else {
        const dx = (e.targetX != null ? e.targetX : e.x) - e.container.x;
        const dy = (e.targetY != null ? e.targetY : e.y) - e.container.y;
        e.container.x += dx * 0.3;
        e.container.y += dy * 0.3;
      }
      // HP bar
      if (e.hpFg && e.maxHp > 1) {
        const ratio = Math.max(0, e.hp / e.maxHp);
        e.hpFg.width = Math.max(0, e.hpW * ratio);
      }
    }
  },

  syncEnemyState(time) {
    if (!Net.isHost) return;
    if (!this.enemies || this.enemies.length === 0) return;
    if (time - this.enemyNextSync < 100) return;
    this.enemyNextSync = time;
    const batch = [];
    for (const e of this.enemies) {
      batch.push({ id: e.id, x: Math.round(e.x), y: Math.round(e.y), hp: e.hp, alive: e.alive });
    }
    Net.send({ type: 'enemy_state', enemies: batch });
  },

  applyEnemyState(payload) {
    if (!payload || !payload.enemies) return;
    for (const s of payload.enemies) {
      const e = this.enemies.find(x => x.id === s.id);
      if (!e) continue;
      e.targetX = s.x; e.targetY = s.y;
      e.hp = s.hp;
      if (!s.alive && e.alive) this.killEnemy(e, false);
    }
  },

  applyEnemyDamage(pid, dmg, kx, ky, enemyId) {
    if (this.roundOver) return;
    if (pid === Net.playerId && this.pendingQuestion) return; // immune while answering
    const now = performance.now();
    if (now < this.reviveInvulnUntil) return;
    if (this.bossPhase === 'intro') return; // wait until fight begins
    if (!this._lastHitAt) this._lastHitAt = { 1: 0, 2: 0 };
    if (now - (this._lastHitAt[pid] || 0) < 700) return;
    this._lastHitAt[pid] = now;
    const prev = this.playerHp[pid] || 0;
    if (prev <= 0) return;
    const next = Math.max(0, prev - dmg);
    this.playerHp[pid] = next;
    // Knockback applies locally to "me" only
    if (pid === Net.playerId && this.me && this.me.body) {
      const ang = Math.atan2(ky, kx) || 0;
      this.me.body.x += Math.cos(ang) * 28;
      this.me.body.y += Math.sin(ang) * 28;
      this.me.body.body.reset(this.me.body.x, this.me.body.y);
      this.scene.cameras.main.shake(160, 0.01);
      this.scene.cameras.main.flash(80, 239, 68, 68, false);
      SFX.wrong();
    }
    Net.send({ type: 'enemy_damage', pid, hp: next, kx, ky, enemyId });
    this.updatePlayerHearts();
    if (next === 0) this.onPlayerDown(pid);
    else if (pid === Net.playerId) {
      const h = (next / 4).toFixed(2).replace(/\.?0+$/, '');
      App.chatSystem(`💢 Hit! ${h} ❤ left.`);
    }
  },

  killEnemy(e, fromMe) {
    if (!e.alive) return;
    e.alive = false;
    this.scene.tweens.killTweensOf(e.container);
    this.scene.tweens.add({ targets: e.container, alpha: 0, scale: 0.4, duration: 280, onComplete: () => e.container.setVisible(false) });
    this.burst(e.container.x, e.container.y, e.typeRef.color, 18);
    if (Net.isHost && fromMe) Net.send({ type: 'enemy_dead', id: e.id });
  },

  // ─── Projectiles ────────────────────────────────────────────────
  spawnProjectile({ id, x, y, vx, vy, dieAt, color }) {
    const scene = this.scene;
    const sprite = scene.add.circle(x, y, 5, color || 0xfb7185, 1);
    sprite.setDepth(14);
    sprite.setStrokeStyle(1, 0xffffff, 0.7);
    this.enemyProjectiles.push({ id, sprite, x, y, vx, vy, dieAt });
  },

  updateProjectiles(time) {
    if (this.reviveQuestionActive()) return;
    if (!this.enemyProjectiles || this.enemyProjectiles.length === 0) return;
    const dt = Math.min(0.05, (this.scene.game.loop.delta || 16) / 1000);
    const now = performance.now();
    const meBody = this.me && this.me.body;
    const myPid = Net.playerId;
    const remaining = [];
    for (const p of this.enemyProjectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.sprite.x = p.x; p.sprite.y = p.y;
      let dead = now >= p.dieAt;
      // Host detects hit on local player (self) only; clients each detect themselves
      if (!dead && meBody && (this.playerHp[myPid] || 0) > 0 && performance.now() >= this.reviveInvulnUntil) {
        if (Math.hypot(p.x - meBody.x, p.y - meBody.y) < 16) {
          this.applyEnemyDamage(myPid, 1, meBody.x - p.x, meBody.y - p.y, null);
          dead = true;
        }
      }
      // Out of bounds
      if (!dead && (p.x < 0 || p.y < 0 || p.x > this.worldW || p.y > this.worldH)) dead = true;
      if (dead) {
        this.scene.tweens.add({ targets: p.sprite, alpha: 0, scale: 1.8, duration: 200, onComplete: () => p.sprite.destroy() });
      } else {
        remaining.push(p);
      }
    }
    this.enemyProjectiles = remaining;
  },

  // ─── Revive Zone + Mini-Boss ────────────────────────────────────
  drawReviveZone(scene) {
    const Z = this.level.reviveZone;
    if (!Z) return;
    const T = this.tile();
    const cx = Z.x * T + T/2, cy = Z.y * T + T/2;
    const pillar = scene.add.rectangle(cx, cy - T * 2, T * 0.55, T * 5, 0x7ee9c1, 0);
    const glow = scene.add.circle(cx, cy, T * 1.6, 0x7ee9c1, 0.0);
    const ring = scene.add.circle(cx, cy, T/2 + 6, 0x7ee9c1, 0);
    ring.setStrokeStyle(4, 0x7ee9c1, 0);
    const mark = scene.add.text(cx, cy, '✚', {
      fontFamily: 'Space Grotesk, sans-serif',
      fontSize: `${Math.round(T * 1.4)}px`, fontStyle: 'bold',
      color: '#7ee9c1', stroke: '#0b0e16', strokeThickness: 5,
    }).setOrigin(0.5);
    mark.setAlpha(0);
    pillar.setDepth(4); glow.setDepth(5); ring.setDepth(6); mark.setDepth(7);
    this.reviveZoneVisual = { pillar, glow, ring, mark, cx, cy, active: false };
  },

  moveReviveVisualTo(tx, ty) {
    const v = this.reviveZoneVisual;
    if (!v) return;
    const T = this.tile();
    const cx = tx * T + T/2, cy = ty * T + T/2;
    v.cx = cx; v.cy = cy;
    v.pillar.setPosition(cx, cy - T * 2);
    v.glow.setPosition(cx, cy);
    v.ring.setPosition(cx, cy);
    v.mark.setPosition(cx, cy);
  },

  currentReviveTile() {
    return this.dynReviveTile || this.level.reviveZone;
  },

  setReviveZoneActive(on) {
    const v = this.reviveZoneVisual;
    if (!v || v.active === on) return;
    v.active = on;
    const scene = this.scene;
    scene.tweens.killTweensOf([v.pillar, v.glow, v.ring, v.mark]);
    if (on) {
      v.pillar.setAlpha(0.4);
      v.glow.setAlpha(0.45);
      v.ring.setStrokeStyle(4, 0x7ee9c1, 1);
      v.mark.setAlpha(1);
      scene.tweens.add({ targets: v.pillar, alpha: 0.7, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      scene.tweens.add({ targets: v.glow, alpha: 0.7, scale: 1.35, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      scene.tweens.add({ targets: v.mark, scale: 1.25, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.showReviveBanner(true);
    } else {
      v.pillar.setAlpha(0);
      v.glow.setAlpha(0);
      v.ring.setStrokeStyle(4, 0x7ee9c1, 0);
      v.mark.setAlpha(0);
      this.showReviveBanner(false);
    }
  },

  showReviveBanner(on) {
    const scene = this.scene;
    if (!scene) return;
    if (on) {
      if (this._reviveBanner) return;
      const cam = scene.cameras.main;
      const w = cam.width;
      const bg = scene.add.rectangle(w / 2, 50, Math.min(540, w - 40), 64, 0x1a0c14, 0.92)
        .setScrollFactor(0).setStrokeStyle(3, 0xff5a6b, 1).setDepth(900);
      const txt = scene.add.text(w / 2, 50, '💀 PARTNER DOWN — FOLLOW THE GREEN ARROW TO ✚', {
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '16px',
        color: '#ffd9df',
        stroke: '#000',
        strokeThickness: 3,
        align: 'center',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(901);
      const tween = scene.tweens.add({
        targets: [bg, txt], alpha: { from: 1, to: 0.55 },
        duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      const arrow = scene.add.triangle(w / 2, cam.height / 2, 0, -22, 18, 14, -18, 14, 0x7ee9c1, 1)
        .setStrokeStyle(3, 0x0b3023, 1).setScrollFactor(0).setDepth(902).setVisible(false);
      const arrowGlow = scene.add.circle(w / 2, cam.height / 2, 28, 0x7ee9c1, 0.25)
        .setScrollFactor(0).setDepth(901).setVisible(false);
      const dist = scene.add.text(w / 2, cam.height / 2 + 30, '', {
        fontFamily: 'Inter, Arial, sans-serif', fontSize: '13px', fontStyle: 'bold',
        color: '#d6ffe8', stroke: '#0b3023', strokeThickness: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(902).setVisible(false);
      this._reviveBanner = { bg, txt, tween, arrow, arrowGlow, dist };
    } else {
      if (!this._reviveBanner) return;
      const { bg, txt, tween, arrow, arrowGlow, dist } = this._reviveBanner;
      if (tween) tween.stop();
      bg.destroy(); txt.destroy();
      if (arrow) arrow.destroy();
      if (arrowGlow) arrowGlow.destroy();
      if (dist) dist.destroy();
      this._reviveBanner = null;
    }
  },

  updateReviveArrow() {
    const b = this._reviveBanner;
    const v = this.reviveZoneVisual;
    if (!b || !v || !this.me) return;
    const scene = this.scene;
    const cam = scene.cameras.main;
    const px = this.me.body.x;
    const py = this.me.body.y;
    const dx = v.cx - px;
    const dy = v.cy - py;
    const distWorld = Math.hypot(dx, dy);
    const T = this.tile();
    const distTiles = Math.max(0, Math.round(distWorld / T));
    const angle = Math.atan2(dy, dx);

    const screenX = (v.cx - cam.scrollX) * cam.zoom;
    const screenY = (v.cy - cam.scrollY) * cam.zoom;
    const margin = 60;
    const onScreen = screenX > margin && screenX < cam.width - margin &&
                     screenY > margin && screenY < cam.height - margin;

    if (onScreen || distTiles <= 1) {
      b.arrow.setVisible(false);
      b.arrowGlow.setVisible(false);
      b.dist.setVisible(false);
      return;
    }
    const cx = cam.width / 2, cy = cam.height / 2;
    const radius = Math.min(cam.width, cam.height) / 2 - 80;
    const ax = cx + Math.cos(angle) * radius;
    const ay = cy + Math.sin(angle) * radius;
    b.arrow.setPosition(ax, ay).setRotation(angle + Math.PI / 2).setVisible(true);
    b.arrowGlow.setPosition(ax, ay).setVisible(true);
    b.dist.setPosition(ax, ay + 30).setText(`${distTiles} tiles`).setVisible(true);
  },

  someoneDown() {
    return (this.playerHp[1] || 0) === 0 || (this.playerHp[2] || 0) === 0;
  },

  downedPid() {
    if ((this.playerHp[1] || 0) === 0) return 1;
    if ((this.playerHp[2] || 0) === 0) return 2;
    return null;
  },

  checkReviveZone() {
    if (!this.reviveZoneVisual) return;
    if (this.bossPhase === 'intro') return; // locked during cinematic
    const down = this.someoneDown();
    this.setReviveZoneActive(down && !this.reviveBoss);
    if (!down || this.reviveStarted || this.reviveBoss) return;
    if ((this.playerHp[Net.playerId] || 0) <= 0) return; // I'm dead, can't trigger
    const T = this.tile();
    const myX = Math.floor(this.me.body.x / T);
    const myY = Math.floor(this.me.body.y / T);
    const Z = this.currentReviveTile();
    if (!Z) return;
    if (myX === Z.x && myY === Z.y) {
      this.reviveStarted = true;
      if (Net.isHost) {
        this.startReviveEncounter();
        Net.send({ type: 'revive_start' });
      } else {
        // Ask host to start
        Net.send({ type: 'revive_request' });
      }
    }
  },

  startReviveEncounter() {
    if (this.reviveBoss) return;
    const scene = this.scene;
    const Z = this.currentReviveTile();
    if (!Z) return;
    const T = this.tile();
    const cx = Z.x * T + T/2, cy = Z.y * T + T/2;

    const t = ENEMY_TYPES.reviveBoss;
    const container = scene.add.container(cx, cy - 6);
    container.setDepth(16);
    container.setScale(0);
    const aura = scene.add.circle(0, 0, t.size + 10, t.color, 0.25);
    const body = scene.add.graphics();
    body.fillStyle(t.color, 1);
    body.fillCircle(0, 0, t.size);
    body.lineStyle(3, 0xfbbf24, 0.85);
    body.strokeCircle(0, 0, t.size);
    const eyeGlow = scene.add.circle(0, -2, 10, t.eye, 0.6);
    const eye = scene.add.circle(0, -2, 6, t.eye, 1);
    const pupil = scene.add.circle(0, -2, 3, 0x000000, 1);
    container.add([aura, body, eyeGlow, eye, pupil]);
    scene.tweens.add({ targets: container, scale: 1.1, duration: 600, ease: 'Back.easeOut',
      onComplete: () => scene.tweens.add({ targets: container, scale: 1, duration: 240 }) });
    scene.tweens.add({ targets: aura, scale: 1.3, alpha: 0.45, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // HP bar (smaller than main boss, top-center)
    const hpBarW = 280, hpBarH = 14;
    const hpX = VIEW_W / 2 - hpBarW / 2;
    const hpY = 50;
    const hpBg = scene.add.rectangle(hpX, hpY, hpBarW, hpBarH, 0x0b0e16, 0.85).setOrigin(0, 0);
    hpBg.setStrokeStyle(2, 0x7ee9c1, 0.9);
    hpBg.setScrollFactor(0); hpBg.setDepth(85);
    const hpFill = scene.add.rectangle(hpX + 2, hpY + 2, hpBarW - 4, hpBarH - 4, 0x7ee9c1, 0.95).setOrigin(0, 0);
    hpFill.setScrollFactor(0); hpFill.setDepth(86);
    const hpLabel = scene.add.text(VIEW_W / 2, hpY + hpBarH + 4, 'REVIVE WARDEN — answer the pad to free your teammate', {
      fontFamily: 'Space Grotesk, sans-serif',
      fontSize: '12px', fontStyle: 'bold',
      color: '#7ee9c1', stroke: '#0b0e16', strokeThickness: 3,
    }).setOrigin(0.5, 0);
    hpLabel.setScrollFactor(0); hpLabel.setDepth(86);
    if (this.minimap) this.minimap.ignore([hpBg, hpFill, hpLabel]);

    // Single pad at the revive zone center
    const padBase = scene.add.circle(cx, cy, T/2 - 4, 0x78350f, 0.5);
    padBase.setStrokeStyle(2, 0xfbbf24, 0.95);
    const padInner = scene.add.circle(cx, cy, T/2 - 12, 0xfbbf24, 0.65);
    const padMark = scene.add.text(cx, cy, '✚', {
      fontFamily: 'Space Grotesk, sans-serif',
      fontSize: '17px', fontStyle: 'bold', color: '#1a0a0a',
    }).setOrigin(0.5);
    padBase.setDepth(8); padInner.setDepth(8); padMark.setDepth(9);
    const padPulse = scene.tweens.add({ targets: padInner, scale: 1.25, alpha: 0.4, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.reviveBoss = {
      container, hp: t.hp, maxHp: t.hp, alive: true,
      worldX: cx, worldY: cy - 6, hpBg, hpFill, hpLabel, hpBarW,
      padBase, padInner, padMark, padPulse, padTile: { x: Z.x, y: Z.y }, padCooldownUntil: 0,
    };
    this.reviveBossPhase = 'fight';
    this.reviveAttackNextAt = performance.now() + 3950;
    this.setReviveZoneActive(false);
    if (this.heartsHUD) this.heartsHUD.setVisible(true);
    App.chatSystem('🟢 Revive ward awakened! Stand on its pad and answer to free your teammate.');
  },

  checkRevivePads() {
    if (!this.reviveBoss || this.reviveBossPhase !== 'fight') return;
    if ((this.playerHp[Net.playerId] || 0) <= 0) return;
    const T = this.tile();
    const myX = Math.floor(this.me.body.x / T);
    const myY = Math.floor(this.me.body.y / T);
    const pad = this.reviveBoss;
    const now = performance.now();
    const onPad = pad.padTile.x === myX && pad.padTile.y === myY && now >= pad.padCooldownUntil;
    if (onPad && !this.reviveActivePad) {
      this.reviveActivePad = true;
      this.showReviveQuestion();
    } else if (!onPad && this.reviveActivePad) {
      this.reviveActivePad = false;
      this.hideQuestion();
    }
  },

  showReviveQuestion() {
    if (this._bossQSeed == null) this._bossQSeed = 2000 + Math.floor(Math.random() * 9000);
    this._bossQSeed = (this._bossQSeed + 211) | 0;
    const q = Questions.generate(this._bossQSeed, Net.playerId, this.currentLevelIdx);
    q._revive = true;
    this.pendingQuestion = q;
    const panel = document.getElementById('question-panel');
    panel.classList.remove('hidden');
    document.getElementById('question-text').textContent = q.prompt;
    document.getElementById('answer-feedback').textContent = '';
    const shortRow = document.getElementById('answer-row-short');
    const mcRow = document.getElementById('answer-row-mc');
    const inp = document.getElementById('answer-input');
    if (q.type === 'mc') {
      shortRow.classList.add('hidden');
      mcRow.classList.remove('hidden');
      mcRow.innerHTML = '';
      const letters = ['A', 'B', 'C', 'D'];
      q.options.forEach((opt, i) => {
        const b = document.createElement('button');
        b.className = 'mc-option';
        b.innerHTML = `<span class="mc-letter">${letters[i]}</span><span class="mc-text"></span>`;
        b.querySelector('.mc-text').textContent = opt;
        b.onclick = () => Game.submitAnswer(i);
        mcRow.appendChild(b);
      });
    } else {
      mcRow.classList.add('hidden');
      shortRow.classList.remove('hidden');
      inp.type = q.type === 'number' ? 'number' : 'text';
      inp.inputMode = q.type === 'number' ? 'numeric' : 'text';
      inp.placeholder = q.type === 'number' ? 'Answer' : 'Type answer…';
      inp.value = '';
      setTimeout(() => inp.focus(), 30);
    }
    document.getElementById('timer-bar').classList.add('hidden');
    this.questionTimerActive = false;
    panel.classList.remove('timed');
    SFX.plateOn();
  },

  damageReviveBoss(fromMe) {
    const rb = this.reviveBoss;
    if (!rb || !rb.alive) return;
    rb.hp = Math.max(0, rb.hp - 1);
    const ratio = rb.hp / rb.maxHp;
    this.scene.tweens.add({ targets: rb.hpFill, width: Math.max(0, (rb.hpBarW - 4) * ratio), duration: 250, ease: 'Cubic.easeOut' });
    this.bossHitSound();
    this.scene.cameras.main.shake(110, 0.007);
    this.burst(rb.worldX, rb.worldY, 0xfbbf24, 14);
    // Pad cooldown so spamming doesn't melt the boss
    rb.padCooldownUntil = performance.now() + 1100;
    if (rb.padPulse) rb.padPulse.pause();
    rb.padBase.setFillStyle(0x1f2937, 0.5);
    rb.padInner.setFillStyle(0x4b5563, 0.4);
    rb.padMark.setColor('#6b7280');
    this.scene.time.delayedCall(1100, () => {
      if (!this.reviveBoss) return;
      rb.padBase.setFillStyle(0x78350f, 0.5);
      rb.padInner.setFillStyle(0xfbbf24, 0.65);
      rb.padMark.setColor('#1a0a0a');
      if (rb.padPulse) rb.padPulse.resume();
    });
    if (rb.hp === 0) {
      if (fromMe) Net.send({ type: 'revive_kill' });
      this.completeRevive();
    }
  },

  reviveBossTick() {
    if (!Net.isHost) return;
    if (this.reviveQuestionActive()) return;
    if (!this.reviveBoss || this.reviveBossPhase !== 'fight') return;
    if (this.reviveAttacks.length > 0) return;
    const now = performance.now();
    if (now < this.reviveAttackNextAt) return;
    // Target only the surviving player
    const downed = this.downedPid();
    const aliveId = downed === 1 ? 2 : (downed === 2 ? 1 : Net.playerId);
    const aliveBody = aliveId === Net.playerId ? (this.me && this.me.body) : (this.other && this.other.body);
    if (!aliveBody) return;
    const att = {
      targetPid: aliveId, x: aliveBody.x, y: aliveBody.y,
      startedAt: now, telegraphMs: 1100, damageMs: 500, damageRadius: 60,
      phase: 'tele', revive: true,
    };
    this.startReviveAttack(att);
    Net.send({ type: 'revive_attack', x: att.x, y: att.y, targetPid: aliveId,
      telegraphMs: att.telegraphMs, damageMs: att.damageMs, damageRadius: att.damageRadius });
  },

  startReviveAttack(att) {
    const scene = this.scene;
    const teleRing = scene.add.circle(att.x, att.y, att.damageRadius, 0x7ee9c1, 0);
    teleRing.setStrokeStyle(3, 0x7ee9c1, 0.9);
    teleRing.setDepth(16);
    const teleFill = scene.add.circle(att.x, att.y, att.damageRadius, 0x7ee9c1, 0.12);
    teleFill.setDepth(15);
    scene.tweens.add({ targets: teleFill, alpha: 0.3, duration: att.telegraphMs, ease: 'Sine.easeIn' });
    scene.tweens.add({ targets: teleRing, scale: { from: 0.6, to: 1 }, duration: att.telegraphMs, ease: 'Sine.easeOut' });
    att.teleRing = teleRing; att.teleFill = teleFill;
    this.reviveAttacks.push(att);
  },

  updateReviveAttacks() {
    if (!this.reviveAttacks || this.reviveAttacks.length === 0) return;
    if (this.reviveQuestionActive()) {
      const dt = (this.scene && this.scene.game.loop.delta) || 16;
      for (const att of this.reviveAttacks) att.startedAt += dt;
      return;
    }
    const now = performance.now();
    const remaining = [];
    let anyEnded = false;
    for (const att of this.reviveAttacks) {
      const elapsed = now - att.startedAt;
      if (att.phase === 'tele' && elapsed >= att.telegraphMs) {
        att.phase = 'damage';
        att.teleFill.setFillStyle(0x7ee9c1, 0.55);
        att.teleRing.setStrokeStyle(4, 0xbbf7d0, 1);
        this.scene.cameras.main.shake(120, 0.01);
        this.bossHitSound();
        if (att.targetPid === Net.playerId && (this.playerHp[Net.playerId] || 0) > 0 && performance.now() >= this.reviveInvulnUntil) {
          const dist = Math.hypot(this.me.body.x - att.x, this.me.body.y - att.y);
          if (dist <= att.damageRadius) {
            this.applyEnemyDamage(Net.playerId, 1, this.me.body.x - att.x, this.me.body.y - att.y, null);
          }
        }
        remaining.push(att);
      } else if (att.phase === 'damage' && elapsed >= att.telegraphMs + att.damageMs) {
        this.scene.tweens.add({ targets: [att.teleRing, att.teleFill], alpha: 0, duration: 200,
          onComplete: () => { att.teleRing.destroy(); att.teleFill.destroy(); } });
        anyEnded = true;
      } else {
        remaining.push(att);
      }
    }
    this.reviveAttacks = remaining;
    if (anyEnded && this.reviveAttacks.length === 0 && Net.isHost) {
      this.reviveAttackNextAt = now + 4550;
    }
  },

  completeRevive() {
    const downed = this.downedPid();
    if (!this.reviveBoss) return;
    const rb = this.reviveBoss;
    rb.alive = false;
    this.reviveBossPhase = 'dead';
    // Cancel attacks
    for (const a of this.reviveAttacks) {
      if (a.teleRing) a.teleRing.destroy();
      if (a.teleFill) a.teleFill.destroy();
    }
    this.reviveAttacks = [];
    // Visual cleanup
    const scene = this.scene;
    scene.tweens.killTweensOf(rb.container);
    scene.tweens.add({ targets: rb.container, scale: 1.6, alpha: 0, angle: 270, duration: 500, ease: 'Cubic.easeIn', onComplete: () => rb.container.destroy() });
    scene.tweens.add({ targets: [rb.hpBg, rb.hpFill, rb.hpLabel], alpha: 0, duration: 400, onComplete: () => { rb.hpBg.destroy(); rb.hpFill.destroy(); rb.hpLabel.destroy(); } });
    if (rb.padPulse) rb.padPulse.stop();
    scene.tweens.add({ targets: [rb.padBase, rb.padInner, rb.padMark], alpha: 0, duration: 400, onComplete: () => { rb.padBase.destroy(); rb.padInner.destroy(); rb.padMark.destroy(); } });
    this.burst(rb.worldX, rb.worldY, 0x7ee9c1, 36);
    this.hideQuestion();
    this.reviveActivePad = false;
    this.reviveBoss = null;
    if (downed) {
      if (Net.isHost) Net.send({ type: 'revive_done', pid: downed });
      this.revivePlayer(downed);
    }
  },

  revivePlayer(pid) {
    const T = this.tile();
    const Z = this.currentReviveTile();
    if (!Z) return;
    this.playerHp[pid] = Math.max(1, Math.ceil((this.level.overworldHp || 3) / 2)) * 4;
    this.reviveInvulnUntil = performance.now() + 2500;
    this.reviveStarted = false;
    if (pid === Net.playerId && this.me) {
      this.me.body.x = Z.x * T + T/2;
      this.me.body.y = Z.y * T + T/2;
      this.me.body.body.reset(this.me.body.x, this.me.body.y);
      this.me.visual.setAlpha(1);
      this.bossStunUntil = 0;
    } else if (this.other) {
      this.other.visual.setAlpha(0.94);
      this.other.body.x = Z.x * T + T/2;
      this.other.body.y = Z.y * T + T/2;
    }
    this.updatePlayerHearts();
    App.chatSystem('💚 Teammate revived!');
    this.burst(Z.x * T + T/2, Z.y * T + T/2, 0x7ee9c1, 30);
    this.dynReviveTile = null;
    if (this.level.reviveZone) this.moveReviveVisualTo(this.level.reviveZone.x, this.level.reviveZone.y);
  },

  triggerOverworldWipe() {
    if (Net.isHost) Net.send({ type: 'overworld_wipe' });
    this.runOverworldWipe();
  },

  runOverworldWipe() {
    const scene = this.scene;
    const T = this.tile();
    // Cancel revive boss
    if (this.reviveBoss) {
      const rb = this.reviveBoss;
      for (const a of this.reviveAttacks) {
        if (a.teleRing) a.teleRing.destroy();
        if (a.teleFill) a.teleFill.destroy();
      }
      this.reviveAttacks = [];
      if (rb.container) rb.container.destroy();
      if (rb.hpBg) rb.hpBg.destroy();
      if (rb.hpFill) rb.hpFill.destroy();
      if (rb.hpLabel) rb.hpLabel.destroy();
      if (rb.padBase) rb.padBase.destroy();
      if (rb.padInner) rb.padInner.destroy();
      if (rb.padMark) rb.padMark.destroy();
      this.reviveBoss = null;
      this.reviveBossPhase = 'idle';
      this.reviveActivePad = false;
    }
    this.reviveStarted = false;
    this.dynReviveTile = null;
    if (this.level.reviveZone) this.moveReviveVisualTo(this.level.reviveZone.x, this.level.reviveZone.y);
    // Reset HP
    const ohp = this.level.overworldHp || 3;
    this.playerHp = { 1: ohp * 4, 2: ohp * 4 };
    this.reviveInvulnUntil = performance.now() + 1500;
    this.bossStunUntil = 0;
    // Respawn players
    const mySpawn = this.level.spawns[Net.playerId];
    if (this.me && mySpawn) {
      this.me.body.x = mySpawn.x * T + T/2;
      this.me.body.y = mySpawn.y * T + T/2;
      this.me.body.body.reset(this.me.body.x, this.me.body.y);
      this.me.visual.setAlpha(1);
    }
    const otherId = Net.playerId === 1 ? 2 : 1;
    const otherSpawn = this.level.spawns[otherId];
    if (this.other && otherSpawn) {
      this.other.body.x = otherSpawn.x * T + T/2;
      this.other.body.y = otherSpawn.y * T + T/2;
      this.other.visual.setAlpha(0.94);
    }
    // Respawn enemies
    for (const e of this.enemies) {
      e.alive = true;
      e.hp = e.maxHp;
      e.x = e.targetX = e.spawnTileX * T + T/2;
      e.y = e.targetY = e.spawnTileY * T + T/2;
      if (e.container) {
        e.container.setVisible(true);
        e.container.setAlpha(1);
        e.container.setScale(1);
        e.container.x = e.x; e.container.y = e.y;
        this.scene.tweens.killTweensOf(e.container);
      }
    }
    this.updatePlayerHearts();
    this.setReviveZoneActive(false);
    scene.cameras.main.shake(280, 0.012);
    scene.cameras.main.flash(220, 239, 68, 68, false);
    App.chatSystem('💀 Both fell! Respawning at the start…');
  },

  _drawLightning(scene, x1, y1, x2, y2, glowColor) {
    const segments = 9;
    const g = scene.add.graphics();
    g.setDepth(73);
    // Outer glow stroke
    g.lineStyle(7, glowColor || 0xa78bfa, 0.55);
    g.beginPath();
    g.moveTo(x1, y1);
    const points = [];
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const px = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 36;
      const py = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 14;
      points.push([px, py]);
      g.lineTo(px, py);
    }
    g.strokePath();
    // Inner bright core
    g.lineStyle(2.5, 0xffffff, 1);
    g.beginPath();
    g.moveTo(x1, y1);
    for (const [px, py] of points) g.lineTo(px, py);
    g.strokePath();
    scene.tweens.add({
      targets: g, alpha: 0, duration: 320,
      onComplete: () => g.destroy(),
    });
  },

  _hexToRGB(hex) {
    return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
  },

  bossStinger() {
    if (typeof Music === 'undefined' || !Music._ensure || !Music._ensure()) return;
    const t = Music.ctx.currentTime;
    // Dramatic descending chord
    const notes = [196, 233, 277, 233, 196]; // G3, A#3, C#4 etc
    notes.forEach((n, i) => Music._note(n, t + i * 0.12, 0.3, 'sawtooth', 0.18));
    Music._note(98, t, 1.5, 'sawtooth', 0.22);  // sustained low bass
    Music._note(73, t + 0.4, 1.1, 'sawtooth', 0.15);
  },

  bossRoar() {
    if (typeof Music === 'undefined' || !Music._ensure || !Music._ensure()) return;
    const ctx = Music.ctx;
    const t = ctx.currentTime;
    // Synthesized roar: white-noise-ish via square sweep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.6);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    osc.connect(gain).connect(Music.master || ctx.destination);
    osc.start(t);
    osc.stop(t + 0.8);
  },

  bossHitSound() {
    if (!SFX._ensure || !SFX._ensure()) return;
    SFX._tone(440, 0.1, 'square', 0.1, 0);
    SFX._tone(220, 0.15, 'sawtooth', 0.08, 0.05);
  },

  bossDeathSound() {
    if (!SFX._ensure || !SFX._ensure()) return;
    const seq = [330, 262, 196, 147, 98];
    seq.forEach((n, i) => SFX._tone(n, 0.32, 'sawtooth', 0.12, i * 0.15));
    SFX._tone(660, 0.5, 'sine', 0.1, 0.4);
    SFX._tone(880, 0.5, 'sine', 0.1, 0.55);
  },

  // Stand-on-pad → question → damage boss
  checkBossPads() {
    if (!this.boss || this.bossPhase !== 'fight') return;
    if (this.playerHp[Net.playerId] <= 0) return; // dead — no answering
    const T = this.tile();
    const myTileX = Math.floor(this.me.body.x / T);
    const myTileY = Math.floor(this.me.body.y / T);
    const now = performance.now();

    let onPad = null;
    for (const key of Object.keys(this.boss.padGfx)) {
      const pad = this.boss.padGfx[key];
      if (pad.tile.x === myTileX && pad.tile.y === myTileY) {
        if (now < pad.cooldownUntil) continue; // pad still cooling down
        onPad = { key, pad };
        break;
      }
    }

    if (onPad && (!this.bossActivePad || this.bossActivePad.key !== onPad.key)) {
      this.bossActivePad = onPad;
      this.showBossQuestion();
    } else if (!onPad && this.bossActivePad) {
      this.bossActivePad = null;
      this.hideQuestion();
    }
  },

  showBossQuestion() {
    // Vary the question each time so memorization doesn't trivialize the boss
    if (this._bossQSeed == null) this._bossQSeed = 1000 + Math.floor(Math.random() * 9000);
    this._bossQSeed = (this._bossQSeed + 113) | 0;
    const q = Questions.generate(this._bossQSeed, Net.playerId, this.currentLevelIdx);
    q._boss = true;
    this.pendingQuestion = q;
    const panel = document.getElementById('question-panel');
    panel.classList.remove('hidden');
    document.getElementById('question-text').textContent = q.prompt;
    document.getElementById('answer-feedback').textContent = '';

    const shortRow = document.getElementById('answer-row-short');
    const mcRow = document.getElementById('answer-row-mc');
    const inp = document.getElementById('answer-input');

    if (q.type === 'mc') {
      shortRow.classList.add('hidden');
      mcRow.classList.remove('hidden');
      mcRow.innerHTML = '';
      const letters = ['A', 'B', 'C', 'D'];
      q.options.forEach((opt, i) => {
        const b = document.createElement('button');
        b.className = 'mc-option';
        b.innerHTML = `<span class="mc-letter">${letters[i]}</span><span class="mc-text"></span>`;
        b.querySelector('.mc-text').textContent = opt;
        b.onclick = () => Game.submitAnswer(i);
        mcRow.appendChild(b);
      });
    } else {
      mcRow.classList.add('hidden');
      shortRow.classList.remove('hidden');
      inp.type = q.type === 'number' ? 'number' : 'text';
      inp.inputMode = q.type === 'number' ? 'numeric' : 'text';
      inp.placeholder = q.type === 'number' ? 'Answer' : 'Type answer…';
      inp.value = '';
      setTimeout(() => inp.focus(), 30);
    }

    document.getElementById('timer-bar').classList.add('hidden');
    this.questionTimerActive = false;
    panel.classList.remove('timed');
    SFX.plateOn();
  },

  damageBoss(fromMe, padKey) {
    if (!this.boss || !this.boss.alive) return;
    this.boss.hp = Math.max(0, this.boss.hp - 1);
    this.updateBossHpBar();
    this.bossHitSound();

    const b = this.boss;
    const scene = this.scene;
    scene.cameras.main.shake(120, 0.008);
    scene.tweens.add({ targets: b.container, scale: { from: 1.15, to: 1 }, duration: 200, ease: 'Sine.easeOut' });
    this.burst(b.worldX, b.worldY, 0xfbbf24, 14);
    scene.tweens.add({ targets: [b.eyeIris, b.eyeGlow], alpha: { from: 0.2, to: 1 }, duration: 180 });

    // Bolt from pad → boss
    if (padKey && b.padGfx[padKey]) {
      const pad = b.padGfx[padKey];
      const px = pad.base.x, py = pad.base.y;
      const bolt = scene.add.graphics();
      bolt.setDepth(13);
      bolt.lineStyle(3, 0xfbbf24, 0.95);
      bolt.beginPath();
      bolt.moveTo(px, py);
      bolt.lineTo(b.worldX, b.worldY);
      bolt.strokePath();
      scene.tweens.add({ targets: bolt, alpha: 0, duration: 280, onComplete: () => bolt.destroy() });
      this.padCooldown(padKey);
    }

    if (b.hp === 0) {
      if (fromMe) Net.send({ type: 'boss_dead' });
      this.killBoss();
    }
  },

  padCooldown(padKey) {
    const pad = this.boss && this.boss.padGfx[padKey];
    if (!pad) return;
    pad.cooldownUntil = performance.now() + (this.level.boss.padCooldownMs || 1500);
    if (pad.pulseTween) pad.pulseTween.pause();
    const scene = this.scene;
    pad.base.setFillStyle(0x1f2937, 0.5);
    pad.base.setStrokeStyle(2, 0x4b5563, 0.7);
    pad.inner.setFillStyle(0x4b5563, 0.4);
    pad.mark.setColor('#6b7280');
    scene.time.delayedCall(this.level.boss.padCooldownMs || 1500, () => {
      if (!this.boss) return;
      pad.base.setFillStyle(pad.dark, 0.5);
      pad.base.setStrokeStyle(2, pad.color, 0.95);
      pad.inner.setFillStyle(pad.color, 0.65);
      pad.mark.setColor('#1a0a0a');
      if (pad.pulseTween) pad.pulseTween.resume();
    });
  },

  // Host-only boss AI: schedule attacks; broadcast to client
  bossTick() {
    if (this.bossPhase !== 'fight' || !this.boss || !this.boss.alive) return;
    if (!Net.isHost) return;
    if (this.bossAttacks && this.bossAttacks.length > 0) return;
    const now = performance.now();
    if (now < this.bossAttackNextAt) return;

    // Both players targeted simultaneously — each gets their own red zone.
    // Only target a player who is still alive.
    const targets = [];
    for (const pid of [1, 2]) {
      if ((this.playerHp[pid] || 0) <= 0) continue;
      const body = pid === Net.playerId ? this.me.body : this.other.body;
      targets.push({ pid, x: body.x, y: body.y });
    }

    const telegraphMs = this.level.boss.telegraphMs;
    const damageMs = this.level.boss.damageMs;
    const damageRadius = this.level.boss.damageRadius;

    for (const t of targets) {
      const att = {
        targetPid: t.pid, x: t.x, y: t.y,
        startedAt: now, telegraphMs, damageMs, damageRadius,
        phase: 'tele',
      };
      this.startBossAttack(att);
      Net.send({ type: 'boss_attack', x: t.x, y: t.y, targetPid: t.pid, startedAt: now,
        telegraphMs, damageMs, damageRadius });
    }
  },

  startBossAttack(att) {
    const scene = this.scene;
    const teleRing = scene.add.circle(att.x, att.y, att.damageRadius, 0xef4444, 0);
    teleRing.setStrokeStyle(3, 0xef4444, 0.9);
    teleRing.setDepth(16);
    const teleFill = scene.add.circle(att.x, att.y, att.damageRadius, 0xef4444, 0.12);
    teleFill.setDepth(15);
    scene.tweens.add({ targets: teleFill, alpha: 0.35, duration: att.telegraphMs, ease: 'Sine.easeIn' });
    scene.tweens.add({
      targets: teleRing, scale: { from: 0.6, to: 1 }, duration: att.telegraphMs, ease: 'Sine.easeOut',
    });

    // Project a "beam" from boss to target
    const b = this.boss;
    const beam = scene.add.graphics();
    beam.setDepth(13);
    beam.lineStyle(2, 0xef4444, 0.65);
    beam.beginPath();
    beam.moveTo(b.worldX, b.worldY);
    beam.lineTo(att.x, att.y);
    beam.strokePath();
    scene.tweens.add({ targets: beam, alpha: { from: 0.8, to: 0.2 }, duration: att.telegraphMs, yoyo: true });

    att.teleRing = teleRing;
    att.teleFill = teleFill;
    att.beam = beam;
    this.bossAttacks.push(att);
  },

  updateBossAttacks() {
    if (!this.bossAttacks || this.bossAttacks.length === 0) return;
    const now = performance.now();
    const remaining = [];
    let anyEnded = false;
    for (const att of this.bossAttacks) {
      const elapsed = now - att.startedAt;

      if (att.phase === 'tele' && elapsed >= att.telegraphMs) {
        att.phase = 'damage';
        att.damageStart = now;
        att.teleFill.setFillStyle(0xef4444, 0.55);
        att.teleRing.setStrokeStyle(4, 0xfca5a5, 1);
        this.scene.cameras.main.shake(140, 0.01);
        this.bossHitSound();

        // Only check hit if this attack targets me, and I'm not already dead
        if (att.targetPid === Net.playerId && this.playerHp[Net.playerId] > 0) {
          const mx = this.me.body.x, my = this.me.body.y;
          const dist = Math.hypot(mx - att.x, my - att.y);
          if (dist <= att.damageRadius) this.takeBossDamage(now, att);
        }
        remaining.push(att);
      } else if (att.phase === 'damage' && elapsed >= att.telegraphMs + att.damageMs) {
        this.scene.tweens.add({
          targets: [att.teleRing, att.teleFill, att.beam], alpha: 0, duration: 200,
          onComplete: () => { att.teleRing.destroy(); att.teleFill.destroy(); att.beam.destroy(); },
        });
        anyEnded = true;
      } else {
        remaining.push(att);
      }
    }
    this.bossAttacks = remaining;

    if (anyEnded && this.bossAttacks.length === 0 && Net.isHost) {
      const hpFrac = this.boss.hp / this.level.boss.hp;
      const interval = this.level.boss.attackInterval * (0.55 + 0.45 * hpFrac);
      this.bossAttackNextAt = now + interval;
    }
  },

  takeBossDamage(now, att) {
    if (this.roundOver) return;
    if (this.pendingQuestion) return; // immune while answering
    if (now < this.reviveInvulnUntil) return;
    this.playerHp[Net.playerId] = Math.max(0, this.playerHp[Net.playerId] - 4); // boss attacks deal a full heart
    this.updatePlayerHearts();
    this.scene.cameras.main.shake(220, 0.015);
    this.scene.cameras.main.flash(120, 239, 68, 68, false);
    SFX.wrong();
    const ang = Math.atan2(this.me.body.y - att.y, this.me.body.x - att.x);
    this.me.body.x += Math.cos(ang) * 38;
    this.me.body.y += Math.sin(ang) * 38;
    this.me.body.body.reset(this.me.body.x, this.me.body.y);
    this.bossStunUntil = performance.now() + 600;
    Net.send({ type: 'player_hp', pid: Net.playerId, hp: this.playerHp[Net.playerId] });

    if (this.playerHp[Net.playerId] === 0) {
      this.onPlayerDown(Net.playerId);
    } else {
      const h = (this.playerHp[Net.playerId] / 4).toFixed(2).replace(/\.?0+$/, '');
      App.chatSystem(`💢 Hit! ${h} ❤ left.`);
    }
  },

  onPlayerDown(pid) {
    // Anchor the revive zone to where the player went down (within their current zone).
    if (!this.dynReviveTile) {
      const T = this.tile();
      const body = (pid === Net.playerId) ? (this.me && this.me.body) : (this.other && this.other.body);
      if (body) {
        const rawX = Math.floor(body.x / T);
        const rawY = Math.floor(body.y / T);
        const snapped = this.findOpenTileNear(rawX, rawY) || { x: rawX, y: rawY };
        this.dynReviveTile = { x: snapped.x, y: snapped.y };
        this.moveReviveVisualTo(snapped.x, snapped.y);
      }
    }
    if (pid === Net.playerId) {
      App.chatSystem('💀 You went down. Partner must reach the green ✚ to revive you!');
      this.bossStunUntil = performance.now() + 10_000_000; // locked until wipe or revive
      // Visually dim the player
      if (this.me && this.me.visual) this.me.visual.setAlpha(0.4);
    } else {
      App.chatSystem('💀 Partner went down! Find the green ✚ to revive them.');
      if (this.other && this.other.visual) this.other.visual.setAlpha(0.4);
    }
    // Wipe check — only host triggers
    if (Net.isHost && this.playerHp[1] === 0 && this.playerHp[2] === 0) {
      if (this.bossPhase === 'fight') {
        this.triggerWipe();
      } else {
        this.triggerOverworldWipe();
      }
    }
  },

  triggerWipe() {
    if (this.bossPhase === 'wiping' || this.bossPhase === 'dead') return;
    Net.send({ type: 'boss_wipe' });
    this.runWipe();
  },

  runWipe() {
    if (this.bossPhase === 'wiping' || this.bossPhase === 'dead') return;
    this.bossPhase = 'wiping';
    const scene = this.scene;

    // Cancel attacks
    for (const a of (this.bossAttacks || [])) {
      if (a.teleRing) a.teleRing.destroy();
      if (a.teleFill) a.teleFill.destroy();
      if (a.beam) a.beam.destroy();
    }
    this.bossAttacks = [];
    this.bossActivePad = null;
    this.hideQuestion();

    // Banner + camera FX
    scene.cameras.main.shake(500, 0.018);
    scene.cameras.main.flash(400, 239, 68, 68, false);
    const banner = scene.add.text(VIEW_W / 2, VIEW_H / 2, 'WIPED', {
      fontFamily: 'Space Grotesk, sans-serif',
      fontSize: '110px', fontStyle: 'bold',
      color: '#ef4444', stroke: '#1a0a0a', strokeThickness: 10,
    }).setOrigin(0.5);
    banner.setScrollFactor(0); banner.setDepth(95);
    banner.setScale(0.3); banner.setAlpha(0);
    if (this.minimap) this.minimap.ignore(banner);
    scene.tweens.add({ targets: banner, alpha: 1, scale: 1.1, duration: 300, ease: 'Back.easeOut' });

    const sub = scene.add.text(VIEW_W / 2, VIEW_H / 2 + 70, 'Reset! Solve the gate again.', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '22px',
      color: '#fca5a5', stroke: '#1a0a0a', strokeThickness: 3,
    }).setOrigin(0.5);
    sub.setScrollFactor(0); sub.setDepth(95); sub.setAlpha(0);
    if (this.minimap) this.minimap.ignore(sub);
    scene.tweens.add({ targets: sub, alpha: 1, duration: 300, delay: 400 });

    SFX.wrong();

    scene.time.delayedCall(2000, () => {
      scene.tweens.add({ targets: [banner, sub], alpha: 0, duration: 400, onComplete: () => {
        banner.destroy(); sub.destroy();
      }});
      this.applyArenaReset();
    });
  },

  applyArenaReset() {
    const scene = this.scene;
    const T = this.tile();
    const cfg = this.level.boss;

    // Reset boss HP + visuals
    if (this.boss) {
      this.boss.hp = cfg.hp;
      this.boss.alive = true;
      this.updateBossHpBar();
      this.boss.hpBg.setVisible(false);
      this.boss.hpFill.setVisible(false);
      this.boss.hpLabel.setVisible(false);
      this.boss.hearts.setVisible(false);
      // Reset container without killing its ongoing bob tween — just snap values.
      this.boss.container.setScale(0);
      this.boss.container.setAlpha(1);
      this.boss.container.setAngle(0);
      // Reset pad visuals
      for (const key of Object.keys(this.boss.padGfx)) {
        const pad = this.boss.padGfx[key];
        pad.cooldownUntil = 0;
        pad.base.setFillStyle(pad.dark, 0.5);
        pad.base.setStrokeStyle(2, pad.color, 0.95);
        pad.inner.setFillStyle(pad.color, 0.65);
        pad.mark.setColor('#1a0a0a');
        if (pad.pulseTween && pad.pulseTween.paused) pad.pulseTween.resume();
      }
    }

    // Reset lives
    this.playerHp = { 1: cfg.playerHp * 4, 2: cfg.playerHp * 4 };
    this.bossStunUntil = 0;
    if (this.me && this.me.visual) this.me.visual.setAlpha(1);
    if (this.other && this.other.visual) this.other.visual.setAlpha(0.94);

    // Reset gate 1 (close it again) and plates a/b
    const gateId = 1;
    const gateState = this.gateState[gateId];
    if (gateState) {
      gateState.p1Done = false;
      gateState.p2Done = false;
      gateState.open = false;
    }
    const v = this.gateDoorVisuals && this.gateDoorVisuals[gateId];
    const body = this.gateDoorBodies && this.gateDoorBodies[gateId];
    if (v && body) {
      scene.tweens.killTweensOf([v.door, v.lock]);
      v.door.setAlpha(1); v.lock.setAlpha(1);
      v.door.setScale(1); v.lock.setScale(1);
      v.door.setVisible(true); v.lock.setVisible(true);
      body.body.enable = true;
    }

    // Reset plate visuals + state
    for (const pkey of Object.keys(this.level.plates)) {
      const p = this.level.plates[pkey];
      if (p.gate !== gateId) continue;
      const gfx = this.plateGfx && this.plateGfx[pkey];
      if (!gfx) continue;
      const color = p.who === 'p1' ? PALETTE.p1 : PALETTE.p2;
      const dark  = p.who === 'p1' ? PALETTE.p1Dark : PALETTE.p2Dark;
      gfx.base.setFillStyle(dark, 0.4);
      gfx.base.setStrokeStyle(2, color, 0.9);
      gfx.inner.setFillStyle(color, 0.6);
      gfx.mark.setText(p.who.toUpperCase());
      gfx.mark.setColor('#ffffff');
      scene.tweens.killTweensOf(gfx.inner);
      gfx.inner.setScale(1); gfx.inner.setAlpha(0.9);
      scene.tweens.add({ targets: gfx.inner, scale: 1.2, alpha: 0.3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.activePlate = null;

    // Teleport players to spawn
    const mySpawn = this.level.spawns[Net.playerId];
    this.me.body.x = mySpawn.x * T + T/2;
    this.me.body.y = mySpawn.y * T + T/2;
    this.me.body.body.reset(this.me.body.x, this.me.body.y);
    const otherId = Net.playerId === 1 ? 2 : 1;
    const otherSpawn = this.level.spawns[otherId];
    this.other.body.x = otherSpawn.x * T + T/2;
    this.other.body.y = otherSpawn.y * T + T/2;

    // Phase reset
    this.bossPhase = 'idle';
    this._bossIntroStarted = false;
    this.bossAttackNextAt = 0;
    this.bossActivePad = null;

    // Camera follow back to me
    scene.cameras.main.startFollow(this.me.body, true, 0.12, 0.12);
    scene.cameras.main.setDeadzone(180, 110);
    scene.cameras.main.zoomTo(1, 300, 'Sine.easeInOut');

    App.chatSystem('🔄 Arena reset. Re-solve plates a/b and try the boss again.');
  },

  killBoss() {
    if (!this.boss || !this.boss.alive) return;
    this.boss.alive = false;
    this.bossPhase = 'dead';
    const scene = this.scene;
    const b = this.boss;

    // Revive any downed players so they can walk to the finish
    this.playerHp = { 1: this.level.boss.playerHp * 4, 2: this.level.boss.playerHp * 4 };
    this.bossStunUntil = 0;
    if (this.me && this.me.visual) this.me.visual.setAlpha(1);
    if (this.other && this.other.visual) this.other.visual.setAlpha(0.94);
    this.updatePlayerHearts();

    // Cancel any active attacks
    for (const a of (this.bossAttacks || [])) {
      if (a.teleRing) a.teleRing.destroy();
      if (a.teleFill) a.teleFill.destroy();
      if (a.beam) a.beam.destroy();
    }
    this.bossAttacks = [];

    // Hide pads
    for (const key of Object.keys(b.padGfx)) {
      const pad = b.padGfx[key];
      scene.tweens.killTweensOf(pad.inner);
      scene.tweens.add({ targets: [pad.base, pad.inner, pad.mark], alpha: 0, duration: 400, onComplete: () => {
        pad.base.destroy(); pad.inner.destroy(); pad.mark.destroy();
      }});
    }
    this.bossActivePad = null;
    this.hideQuestion();

    // Boss death animation: spin + scale + flash + explode
    scene.tweens.killTweensOf(b.container);
    scene.tweens.add({ targets: b.container, angle: 540, scale: 1.6, duration: 900, ease: 'Cubic.easeIn' });
    scene.tweens.add({ targets: b.container, alpha: 0, duration: 400, delay: 700, onComplete: () => {
      this.burst(b.worldX, b.worldY, 0xfbbf24, 60);
      this.burst(b.worldX, b.worldY, 0xef4444, 50);
      this.burst(b.worldX, b.worldY, 0xa78bfa, 50);
      b.container.destroy();
    }});

    scene.cameras.main.shake(700, 0.022);
    scene.cameras.main.flash(500, 255, 255, 200, false);
    this.bossDeathSound();

    // Restore regular track for this round after the death sound winds down
    if (typeof Music !== 'undefined' && Music.enabled && !Music.muted) {
      scene.time.delayedCall(1400, () => {
        try { Music.playTrack(this.currentLevelIdx); } catch (e) {}
      });
    }

    // Hide HP bar
    scene.tweens.add({ targets: [b.hpBg, b.hpFill, b.hpLabel], alpha: 0, duration: 600 });

    // Victory banner
    const victory = scene.add.text(VIEW_W / 2, VIEW_H / 2 - 30, 'VICTORY!', {
      fontFamily: 'Space Grotesk, sans-serif',
      fontSize: '92px', fontStyle: 'bold',
      color: '#7ee9c1', stroke: '#0b0e16', strokeThickness: 10,
    }).setOrigin(0.5);
    victory.setScrollFactor(0); victory.setDepth(95);
    victory.setScale(0.3); victory.setAlpha(0);
    if (this.minimap) this.minimap.ignore(victory);
    scene.tweens.add({ targets: victory, alpha: 1, scale: 1.1, duration: 400, delay: 700, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: victory, alpha: 0, duration: 500, delay: 2400, onComplete: () => victory.destroy() });

    // Disperse all remaining mobs — fade + scatter so the survivor can walk to the finish.
    for (const e of this.enemies) {
      if (!e.alive || !e.container) continue;
      e.alive = false;
      const dx = (Math.random() - 0.5) * 220;
      const dy = (Math.random() - 0.5) * 220;
      scene.tweens.add({
        targets: e.container, x: e.container.x + dx, y: e.container.y + dy,
        scale: 0.2, alpha: 0, angle: (Math.random() - 0.5) * 360,
        duration: 700 + Math.random() * 400, ease: 'Cubic.easeOut',
        onComplete: () => { try { e.container.destroy(); } catch (_) {} },
      });
    }
    this.enemyProjectiles.forEach(p => { try { p.sprite.destroy(); } catch (_) {} });
    this.enemyProjectiles = [];

    // Reveal finish portal
    scene.time.delayedCall(1200, () => {
      if (this.finishVisuals) {
        this.finishVisuals.glow.setVisible(true);
        this.finishVisuals.ring.setVisible(true);
        this.finishVisuals.inner.setVisible(true);
        this.finishVisuals.glow.setAlpha(0);
        this.finishVisuals.ring.setAlpha(0);
        this.finishVisuals.inner.setAlpha(0);
        scene.tweens.add({ targets: this.finishVisuals.glow, alpha: 0.55, duration: 600 });
        scene.tweens.add({ targets: this.finishVisuals.ring, alpha: 1, duration: 600 });
        scene.tweens.add({ targets: this.finishVisuals.inner, alpha: 0.6, duration: 600 });
        const f = this.level.finish;
        const T = this.tile();
        this.burst(f.x * T + T/2, f.y * T + T/2, 0x7ee9c1, 30);
        App.chatSystem('🌟 Finish portal opened. One player just needs to reach it!');
      }
    });
  },

  flashGateOverlay(text) {
    this.gateOverlay.setText(text);
    this.gateOverlay.setScale(0.5);
    this.scene.tweens.add({
      targets: this.gateOverlay,
      alpha: 1, scale: 1, duration: 280, ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({ targets: this.gateOverlay, alpha: 0, delay: 800, duration: 500 });
      }
    });
  },

  update(time, delta) {
    if (!this.me) return;

    const speed = 220;
    let vx = 0, vy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -speed;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx = speed;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -speed;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy = speed;

    const active = document.activeElement;
    if (active && ['INPUT', 'TEXTAREA'].includes(active.tagName)) { vx = 0; vy = 0; }
    if (this.stunned && time < this.stunUntil) { vx = 0; vy = 0; }
    else if (this.stunned) { this.stunned = false; }
    if (this.bossPhase === 'intro' && performance.now() < (this.bossIntroLockUntil || 0)) { vx = 0; vy = 0; }
    // Failsafe: if boss is dead or we have HP, never stay locked from a stale down-stun.
    if (this.bossStunUntil && (this.bossPhase === 'dead' || (this.playerHp[Net.playerId] || 0) > 0)) {
      this.bossStunUntil = 0;
      if (this.me && this.me.visual) this.me.visual.setAlpha(1);
    }
    if (this.bossStunUntil && performance.now() < this.bossStunUntil) { vx = 0; vy = 0; }

    if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
    this.me.body.body.setVelocity(vx, vy);

    const moving = Math.abs(vx) > 1 || Math.abs(vy) > 1;
    const bob = moving ? Math.sin(time / 80) * 1.6 : 0;
    this.me.visual.x = this.me.body.x;
    this.me.visual.y = this.me.body.y + bob;
    const lookX = vx === 0 ? 0 : Math.sign(vx) * 1.3;
    const lookY = vy === 0 ? 0 : Math.sign(vy) * 1.0;
    this.me.eyeL.setPosition(-3 + lookX, -11 + lookY);
    this.me.eyeR.setPosition( 3 + lookX, -11 + lookY);
    this.me.eyeWhiteL.setPosition(-3 + lookX * 0.5, -11 + lookY * 0.5);
    this.me.eyeWhiteR.setPosition( 3 + lookX * 0.5, -11 + lookY * 0.5);

    if (moving) {
      this._stepTimer += delta;
      if (this._stepTimer > 260) { SFX.type(); this._stepTimer = 0; }
    } else { this._stepTimer = 200; }

    if (time - this._lastSync > 50) {
      Net.send({ type: 'pos', x: this.me.body.x, y: this.me.body.y, vx, vy, lvl: this.currentLevelIdx });
      this._lastSync = time;
    }

    if (this.other.targetX !== undefined) {
      const dx = this.other.targetX - this.other.body.x;
      const dy = this.other.targetY - this.other.body.y;
      this.other.body.x += dx * 0.3;
      this.other.body.y += dy * 0.3;
      const remoteMoving = (this.other.lastVx || 0) !== 0 || (this.other.lastVy || 0) !== 0;
      const rbob = remoteMoving ? Math.sin(time / 80) * 1.6 : 0;
      this.other.visual.x = this.other.body.x;
      this.other.visual.y = this.other.body.y + rbob;
    }

    this.updateGuards(time);
    this.enemyTick(time);
    this.updateEnemyVisuals();
    this.updateProjectiles(time);
    this.syncEnemyState(time);
    this.checkReviveZone();
    this.updateReviveArrow();
    this.reviveBossTick();
    this.updateReviveAttacks();
    this.checkRevivePads();
    this.updateFog();
    this.checkPlates();
    this.checkKey();
    if (this.boss) {
      this.checkBossIntroTrigger();
      this.bossTick();
      this.updateBossAttacks();
      this.checkBossPads();
    }
    this.checkFinish();
    if (this.questionTimerActive) this.tickQuestionTimer();
  },

  updateGuards(time) {
    if (this.reviveQuestionActive()) return;
    for (const g of this.guards) {
      const t = (time % g.period) / g.period;
      const phase = Math.abs(t - 0.5) * 2;
      const x = g.minX + (g.maxX - g.minX) * phase;
      g.container.x = x;
      g.container.y = g.y + Math.sin(time / 200) * 3;

      if (this.stunned || this.finishedMe) continue;
      const dx = this.me.body.x - x;
      const dy = this.me.body.y - g.container.y;
      if (Math.hypot(dx, dy) < 23) this.stunMe(time, g);
    }
  },

  stunMe(time, g) {
    this.stunned = true;
    this.stunUntil = time + 1300;
    this.me.body.body.setVelocity(0, 0);
    this.scene.cameras.main.shake(180, 0.008);
    SFX.wrong();

    const cx = this.me.body.x, cy = this.me.body.y;
    const flash = this.scene.add.circle(cx, cy, 22, 0xef4444, 0.55);
    flash.setDepth(20);
    this.scene.tweens.add({
      targets: flash, alpha: 0, scale: 1.8, duration: 500,
      onComplete: () => flash.destroy(),
    });

    const ang = Math.atan2(cy - g.container.y, cx - g.container.x);
    this.me.body.x += Math.cos(ang) * 20;
    this.me.body.y += Math.sin(ang) * 20;
    this.me.body.body.reset(this.me.body.x, this.me.body.y);

    App.chatSystem('👻 Stunned by the shadow guard.');
  },

  updateFog() {
    if (!this.fog) return;
    this.fog.clear();
    this.fog.fill(0x000000, 0.6);
    this.fog.erase('vision', this.me.body.x - VISION_RADIUS, this.me.body.y - VISION_RADIUS);
    this.fog.erase('vision', this.other.body.x - VISION_RADIUS, this.other.body.y - VISION_RADIUS);
  },

  checkPlates() {
    const T = this.tile();
    const myTileX = Math.floor(this.me.body.x / T);
    const myTileY = Math.floor(this.me.body.y / T);
    const myWho = Net.playerId === 1 ? 'p1' : 'p2';
    let onPlate = null;
    for (const key of Object.keys(this.level.plates)) {
      const p = this.level.plates[key];
      if (p.who === myWho && p.x === myTileX && p.y === myTileY) {
        onPlate = { key, ...p };
        break;
      }
    }

    if (onPlate && (!this.activePlate || this.activePlate.key !== onPlate.key)) {
      const state = this.gateState[onPlate.gate];
      const myDone = Net.playerId === 1 ? state.p1Done : state.p2Done;
      if (!myDone) {
        this.activePlate = onPlate;
        this.showQuestion(onPlate.gate);
      }
    } else if (!onPlate && this.activePlate) {
      this.activePlate = null;
      this.hideQuestion();
    }
  },

  showQuestion(gateId) {
    const q = Questions.generate(gateId, Net.playerId, this.currentLevelIdx);
    this.pendingQuestion = q;
    const panel = document.getElementById('question-panel');
    panel.classList.remove('hidden');
    document.getElementById('question-text').textContent = q.prompt;
    document.getElementById('answer-feedback').textContent = '';

    const shortRow = document.getElementById('answer-row-short');
    const mcRow = document.getElementById('answer-row-mc');
    const inp = document.getElementById('answer-input');

    if (q.type === 'mc') {
      shortRow.classList.add('hidden');
      mcRow.classList.remove('hidden');
      mcRow.innerHTML = '';
      const letters = ['A', 'B', 'C', 'D'];
      q.options.forEach((opt, i) => {
        const b = document.createElement('button');
        b.className = 'mc-option';
        b.innerHTML = `<span class="mc-letter">${letters[i]}</span><span class="mc-text"></span>`;
        b.querySelector('.mc-text').textContent = opt;
        b.onclick = () => Game.submitAnswer(i);
        mcRow.appendChild(b);
      });
    } else {
      mcRow.classList.add('hidden');
      shortRow.classList.remove('hidden');
      inp.type = q.type === 'number' ? 'number' : 'text';
      inp.inputMode = q.type === 'number' ? 'numeric' : 'text';
      inp.placeholder = q.type === 'number' ? 'Answer' : 'Type answer…';
      inp.value = '';
      setTimeout(() => inp.focus(), 30);
    }

    const bar = document.getElementById('timer-bar');
    if (this.level.timed) {
      bar.classList.remove('hidden');
      document.getElementById('timer-bar-fill').style.transform = 'scaleX(1)';
      this.questionTimerStart = performance.now();
      this.questionTimerActive = true;
      panel.classList.add('timed');
    } else {
      bar.classList.add('hidden');
      this.questionTimerActive = false;
      panel.classList.remove('timed');
    }

    SFX.plateOn();
  },

  hideQuestion() {
    document.getElementById('question-panel').classList.add('hidden');
    document.getElementById('timer-bar').classList.add('hidden');
    this.pendingQuestion = null;
    this.questionTimerActive = false;
  },

  tickQuestionTimer() {
    const elapsed = performance.now() - this.questionTimerStart;
    const frac = Math.max(0, 1 - elapsed / this.level.timedMs);
    document.getElementById('timer-bar-fill').style.transform = `scaleX(${frac})`;
    if (frac <= 0) {
      this.questionTimerActive = false;
      const fb = document.getElementById('answer-feedback');
      fb.textContent = '⏰ Time\'s up! Step off and back on to retry.';
      fb.className = 'wrong';
      SFX.wrong();
      this.scene.cameras.main.shake(120, 0.006);
      this.pendingQuestion = null;
    }
  },

  submitAnswer(mcChoiceIdx) {
    if (!this.pendingQuestion) return;
    const q = this.pendingQuestion;
    const raw = q.type === 'mc' ? mcChoiceIdx : document.getElementById('answer-input').value;
    const feedback = document.getElementById('answer-feedback');
    // 0.5s post-submit immunity (applies on both correct and incorrect answers).
    this.reviveInvulnUntil = Math.max(this.reviveInvulnUntil || 0, performance.now() + 500);
    if (Questions.check(q, raw)) {
      feedback.textContent = '✓ Hit!';
      feedback.className = 'correct';
      if (q._revive) {
        this.damageReviveBoss(true);
        Net.send({ type: 'revive_hit', hp: this.reviveBoss ? this.reviveBoss.hp : 0 });
        this.hideQuestion();
        this.reviveActivePad = false;
        SFX.correct();
      } else if (q._boss) {
        const padKey = this.bossActivePad ? this.bossActivePad.key : null;
        this.damageBoss(true, padKey);
        Net.send({ type: 'boss_hit', hp: this.boss ? this.boss.hp : 0, from: Net.playerId, padKey });
        this.hideQuestion();
        this.bossActivePad = null;
        SFX.correct();
      } else {
        feedback.textContent = '✓ Correct!';
        const gateId = q.gateId;
        this.markPlateDone(gateId, Net.playerId, true);
        Net.send({ type: 'plate', gateId, playerId: Net.playerId });
        this.hideQuestion();
        this.activePlate = null;
      }
    } else {
      feedback.textContent = '✗ Not quite — try again.';
      feedback.className = 'wrong';
      SFX.wrong();
      this.scene.cameras.main.shake(120, 0.005);
    }
  },

  markPlateDone(gateId, playerId, fromMe = false) {
    const state = this.gateState[gateId];
    if (!state) return; // partner may be on a different level
    if (playerId === 1) state.p1Done = true;
    else state.p2Done = true;

    const who = playerId === 1 ? 'p1' : 'p2';
    for (const key of Object.keys(this.level.plates)) {
      const p = this.level.plates[key];
      if (p.gate === gateId && p.who === who) {
        const gfx = this.plateGfx[key];
        if (gfx) {
          this.scene.tweens.killTweensOf(gfx.inner);
          gfx.base.setFillStyle(0x16a34a, 0.7);
          gfx.base.setStrokeStyle(2, PALETTE.finish, 1);
          gfx.inner.setFillStyle(PALETTE.finish, 0.9);
          gfx.inner.setScale(1);
          gfx.inner.setAlpha(0.9);
          gfx.mark.setText('✓');
          gfx.mark.setColor('#0b0e16');
          this.burst(gfx.base.x, gfx.base.y, 0x6ee7b7);
        }
        break;
      }
    }

    if (fromMe) SFX.correct();
    else SFX.plateOn();

    if (state.p1Done && state.p2Done && !state.open) {
      state.open = true;
      this.openGate(gateId);
    }
  },

  openGate(gateId) {
    const v = this.gateDoorVisuals[gateId];
    const body = this.gateDoorBodies[gateId];
    SFX.gateOpen();
    this.scene.cameras.main.shake(220, 0.01);
    this.scene.cameras.main.flash(220, 251, 191, 36, false);

    const cx = body.x, cy = body.y;
    this.burst(cx, cy, PALETTE.gate, 30);

    this.scene.tweens.add({
      targets: [v.door, v.lock],
      alpha: 0, scaleX: 0.3, scaleY: 0.3,
      duration: 450, ease: 'Back.easeIn',
      onComplete: () => {
        v.door.setVisible(false);
        v.lock.setVisible(false);
        body.body.enable = false;
      }
    });

    this.flashGateOverlay(`GATE ${gateId} UNLOCKED`);
    App.chatSystem(`🔓 Gate ${gateId} opened.`);
  },

  burst(x, y, color, count = 16) {
    const p = this.scene.add.particles(x, y, 'spark', {
      speed: { min: 80, max: 200 },
      lifespan: 650,
      scale: { start: 1.3, end: 0 },
      tint: color, quantity: count,
      blendMode: 'ADD',
      angle: { min: 0, max: 360 },
      emitting: false,
    });
    p.explode(count);
    this.scene.time.delayedCall(900, () => p.destroy());
  },

  checkFinish() {
    if (this.finishedMe) return;
    const T = this.tile();
    const tx = Math.floor(this.me.body.x / T);
    const ty = Math.floor(this.me.body.y / T);
    const f = this.level.finish;
    if (tx === f.x && ty === f.y) {
      if (this.level.key && this.keyState !== 'used') {
        if (!this._finishLockedNote || performance.now() - this._finishLockedNote > 3000) {
          App.chatSystem('🔒 Finish is locked — partner needs the key in the lock first.');
          this._finishLockedNote = performance.now();
          SFX.wrong();
        }
        return;
      }
      if (this.boss && this.bossPhase !== 'dead') {
        if (!this._finishLockedNote || performance.now() - this._finishLockedNote > 3000) {
          App.chatSystem('🔒 Defeat the boss first!');
          this._finishLockedNote = performance.now();
          SFX.wrong();
        }
        return;
      }
      this.finishedMe = true;
      Net.send({ type: 'finish', levelIdx: this.currentLevelIdx });
      App.chatSystem(`🏁 Player ${Net.playerId} reached the finish.`);
      SFX.finish();
      this.burst(this.me.body.x, this.me.body.y, PALETTE.finish, 24);
      this.checkRoundComplete();
    }
  },

  checkRoundComplete() {
    if (!(this.finishedMe || this.finishedThem)) return;
    if (this.roundOver) return; // idempotent — duplicate/resent 'finish' messages are no-ops
    // Freeze gameplay on both sides — survivor is safe from enemies/guards.
    this.finishedMe = true;
    this.roundOver = true;
    this._startRoundSync();
    this.enemyProjectiles.forEach(p => { try { p.sprite.destroy(); } catch (_) {} });
    this.enemyProjectiles = [];
    if (this.me && this.me.body && this.me.body.body) this.me.body.body.setVelocity(0, 0);
    const isLast = this.currentLevelIdx >= LEVELS.length - 1;
    if (isLast) {
      const elapsed = App.stopTimer();
      SFX.win();
      const timeMs = (App.timerStopped || Date.now()) - App.timerStart;
      try {
        if (Net.isHost && Classroom && Classroom.connected && Classroom.connected()) {
          Classroom.sendFinish({
            pairCode: Net.roomCode,
            time: elapsed,
            timeMs,
            rounds: LEVELS.length,
            at: Date.now(),
          });
        }
      } catch (e) { /* no class connection */ }
      setTimeout(() => {
        document.getElementById('game-screen').classList.add('hidden');
        document.getElementById('win-screen').classList.remove('hidden');
        document.getElementById('final-time').textContent = elapsed;
        App.launchConfetti();
      }, 600);
    } else {
      setTimeout(() => App.showRoundComplete(this.currentLevelIdx + 1), 700);
    }
  },

  continueToNextRound() {
    this.readyToContinue = true;
    Net.send({ type: 'ready-next', levelIdx: this.currentLevelIdx });
    App.updateContinueButton();
    this.tryAdvance();
  },

  tryAdvance() {
    if (this.readyToContinue && this.partnerReadyToContinue) {
      const next = this.currentLevelIdx + 1;
      // Tell the partner we're advancing — if they missed a 'ready-next',
      // this pulls them forward instead of leaving them stuck waiting.
      Net.send({ type: 'advance', toLevel: next });
      App.hideRoundComplete();
      this.loadLevel(next);
    }
  },

  // While the round-complete overlay is up, periodically re-send our state.
  // The relay drops messages if the socket hiccups; without this, one lost
  // 'finish' or 'ready-next' deadlocks both players on "Waiting for partner…".
  _startRoundSync() {
    if (this._roundSyncTimer) return;
    const lvl = this.currentLevelIdx;
    this._roundSyncTicks = 0;
    this._roundSyncTimer = setInterval(() => {
      if (!this.roundOver || this.currentLevelIdx !== lvl) { this._stopRoundSync(); return; }
      this._roundSyncTicks++;
      if (!this.finishedThem && this._roundSyncTicks <= 15) {
        Net.send({ type: 'finish', levelIdx: lvl });
      }
      if (this.readyToContinue && !this.partnerReadyToContinue) {
        Net.send({ type: 'ready-next', levelIdx: lvl });
      }
    }, 2000);
  },

  _stopRoundSync() {
    if (this._roundSyncTimer) {
      clearInterval(this._roundSyncTimer);
      this._roundSyncTimer = null;
    }
  },

  setSpeaking(playerId, on) {
    const target = (playerId === Net.playerId) ? this.me : this.other;
    if (!target || !target.speakRing) return;
    const ring = target.speakRing;
    this.scene.tweens.killTweensOf(ring);
    if (on) {
      ring.setStrokeStyle(3, 0x7ee9c1, 1);
      this.scene.tweens.add({
        targets: ring,
        radius: { from: 18, to: 24 },
        alpha: { from: 0.9, to: 0.3 },
        duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    } else {
      ring.setStrokeStyle(3, 0x7ee9c1, 0);
      ring.setAlpha(0);
    }
  },

  handlePeerMessage(msg) {
    if (msg.type === 'pos') {
      // Catch-all level sync: enemies and bosses are simulated by the host,
      // so if the pair ever splits across levels (a missed advance message),
      // the game looks frozen — enemies idle, boss never triggers. If the
      // partner is on a later level, the round ended: catch up immediately.
      if (typeof msg.lvl === 'number' && msg.lvl > this.currentLevelIdx && msg.lvl < LEVELS.length) {
        App.hideRoundComplete();
        this.loadLevel(msg.lvl);
        return;
      }
      this.other.targetX = msg.x;
      this.other.targetY = msg.y;
      this.other.lastVx = msg.vx || 0;
      this.other.lastVy = msg.vy || 0;
      const lx = (msg.vx || 0) === 0 ? 0 : Math.sign(msg.vx) * 1.3;
      const ly = (msg.vy || 0) === 0 ? 0 : Math.sign(msg.vy) * 1.0;
      this.other.eyeL.setPosition(-3 + lx, -11 + ly);
      this.other.eyeR.setPosition( 3 + lx, -11 + ly);
      this.other.eyeWhiteL.setPosition(-3 + lx * 0.5, -11 + ly * 0.5);
      this.other.eyeWhiteR.setPosition( 3 + lx * 0.5, -11 + ly * 0.5);
    } else if (msg.type === 'plate') {
      this.markPlateDone(msg.gateId, msg.playerId, false);
    } else if (msg.type === 'chat') {
      App.chatReceive(msg.text, msg.from);
    } else if (msg.type === 'name') {
      App.partnerName = msg.name || '';
      App.chatSystem(`👋 Partner is ${App.partnerName || ('P' + (Net.playerId === 1 ? 2 : 1))}.`);
    } else if (msg.type === 'finish') {
      // Ignore stale re-sends from a round we already left.
      if (typeof msg.levelIdx === 'number' && msg.levelIdx < this.currentLevelIdx) return;
      // Force-sync to partner's level if we lagged behind, so isLast resolves correctly.
      if (typeof msg.levelIdx === 'number' && msg.levelIdx > this.currentLevelIdx) {
        this.currentLevelIdx = msg.levelIdx;
      }
      if (!this.finishedThem) {
        this.finishedThem = true;
        App.chatSystem(`🏁 Partner reached the finish.`);
      }
      this.checkRoundComplete();
    } else if (msg.type === 'voice-ready') {
      Voice.onPartnerReady();
    } else if (msg.type === 'speaking') {
      const partnerId = Net.playerId === 1 ? 2 : 1;
      this.setSpeaking(partnerId, msg.on);
    } else if (msg.type === 'ready-next') {
      if (typeof msg.levelIdx === 'number' && msg.levelIdx < this.currentLevelIdx) {
        // Partner is still on the previous round's overlay (they missed our
        // messages) — pull them forward to where we are.
        Net.send({ type: 'advance', toLevel: this.currentLevelIdx });
      } else {
        this.partnerReadyToContinue = true;
        App.updateContinueButton();
        this.tryAdvance();
      }
    } else if (msg.type === 'advance') {
      if (typeof msg.toLevel === 'number' && msg.toLevel > this.currentLevelIdx && msg.toLevel < LEVELS.length) {
        App.hideRoundComplete();
        this.loadLevel(msg.toLevel);
      }
    } else if (msg.type === 'key') {
      this.setKeyState(msg.state, false);
    } else if (msg.type === 'pack') {
      Packs.setSessionPack(msg.pack);
      App.chatSystem(`📚 Pack loaded: ${msg.pack.name}`);
    } else if (msg.type === 'boss_intro_start') {
      this.startBossIntro(msg.at);
    } else if (msg.type === 'boss_attack') {
      // Mirror host's attack on this client
      this.startBossAttack({
        targetPid: msg.targetPid, x: msg.x, y: msg.y,
        startedAt: performance.now(), // local timeline; close enough
        telegraphMs: msg.telegraphMs, damageMs: msg.damageMs,
        damageRadius: msg.damageRadius, phase: 'tele',
      });
    } else if (msg.type === 'boss_hit') {
      if (this.boss && this.boss.alive) {
        this.boss.hp = msg.hp;
        this.updateBossHpBar();
        this.bossHitSound();
        const b = this.boss;
        this.scene.cameras.main.shake(120, 0.008);
        this.scene.tweens.add({ targets: b.container, scale: { from: 1.15, to: 1 }, duration: 200, ease: 'Sine.easeOut' });
        this.burst(b.worldX, b.worldY, 0xfbbf24, 14);
        if (msg.padKey && b.padGfx[msg.padKey]) {
          const pad = b.padGfx[msg.padKey];
          const bolt = this.scene.add.graphics();
          bolt.setDepth(13);
          bolt.lineStyle(3, 0xfbbf24, 0.95);
          bolt.beginPath();
          bolt.moveTo(pad.base.x, pad.base.y);
          bolt.lineTo(b.worldX, b.worldY);
          bolt.strokePath();
          this.scene.tweens.add({ targets: bolt, alpha: 0, duration: 280, onComplete: () => bolt.destroy() });
          this.padCooldown(msg.padKey);
        }
        if (b.hp === 0) this.killBoss();
      }
    } else if (msg.type === 'boss_dead') {
      this.killBoss();
    } else if (msg.type === 'player_hp') {
      const prev = this.playerHp[msg.pid] || 0;
      this.playerHp[msg.pid] = msg.hp;
      if (msg.hp === 0 && prev > 0) this.onPlayerDown(msg.pid);
    } else if (msg.type === 'boss_wipe') {
      this.runWipe();
    } else if (msg.type === 'enemy_state') {
      this.applyEnemyState(msg);
    } else if (msg.type === 'enemy_damage') {
      // Authoritative HP update from host (or peer) for either player
      const prev = this.playerHp[msg.pid] || 0;
      this.playerHp[msg.pid] = msg.hp;
      this.updatePlayerHearts();
      // If it's about me and I lost HP, apply knockback + feedback locally
      if (msg.pid === Net.playerId && msg.hp < prev && this.me && this.me.body) {
        const ang = Math.atan2(msg.ky || 0, msg.kx || 0);
        this.me.body.x += Math.cos(ang) * 28;
        this.me.body.y += Math.sin(ang) * 28;
        this.me.body.body.reset(this.me.body.x, this.me.body.y);
        this.scene.cameras.main.shake(140, 0.009);
        this.scene.cameras.main.flash(70, 239, 68, 68, false);
        SFX.wrong();
      }
      if (msg.hp === 0 && prev > 0) this.onPlayerDown(msg.pid);
    } else if (msg.type === 'enemy_shot') {
      this.spawnProjectile({ id: msg.id, x: msg.x, y: msg.y, vx: msg.vx, vy: msg.vy, dieAt: performance.now() + (msg.ttl || 1500), color: msg.color });
    } else if (msg.type === 'enemy_dead') {
      const e = this.enemies.find(x => x.id === msg.id);
      if (e) this.killEnemy(e, false);
    } else if (msg.type === 'revive_request') {
      // Client asked host to start; host validates and starts
      if (Net.isHost && !this.reviveBoss && this.someoneDown()) {
        this.startReviveEncounter();
        Net.send({ type: 'revive_start' });
      }
    } else if (msg.type === 'revive_start') {
      this.reviveStarted = true;
      this.startReviveEncounter();
    } else if (msg.type === 'revive_attack') {
      this.startReviveAttack({
        targetPid: msg.targetPid, x: msg.x, y: msg.y,
        startedAt: performance.now(),
        telegraphMs: msg.telegraphMs, damageMs: msg.damageMs,
        damageRadius: msg.damageRadius, phase: 'tele', revive: true,
      });
    } else if (msg.type === 'revive_hit') {
      if (this.reviveBoss && this.reviveBoss.alive) {
        this.reviveBoss.hp = msg.hp;
        const ratio = this.reviveBoss.hp / this.reviveBoss.maxHp;
        this.scene.tweens.add({ targets: this.reviveBoss.hpFill, width: Math.max(0, (this.reviveBoss.hpBarW - 4) * ratio), duration: 250, ease: 'Cubic.easeOut' });
        this.bossHitSound();
        this.burst(this.reviveBoss.worldX, this.reviveBoss.worldY, 0xfbbf24, 14);
        if (this.reviveBoss.hp === 0) this.completeRevive();
      }
    } else if (msg.type === 'revive_kill') {
      // Only relevant if we haven't already killed
      if (this.reviveBoss && this.reviveBoss.alive) {
        this.reviveBoss.hp = 0;
        this.completeRevive();
      }
    } else if (msg.type === 'revive_done') {
      this.revivePlayer(msg.pid);
    } else if (msg.type === 'overworld_wipe') {
      this.runOverworldWipe();
    }
  },
};
