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

const LEVELS = [
  {
    name: 'Round 1 · Warmup Plains',
    tile: 40,
    theme: {
      floor: 0x1f3a2c, floorAlt: 0x254432, grid: 0x2d5a40,
      wallTop: 0x4a7c5d, wallSide: 0x2d4a36, wallEdge: 0x6aaa80,
      bg: '#0a1410',
      ambient: 'leaves', ambientColor: 0x7ee9c1,
      accent: 0x7ee9c1,
    },
    // 50 cols × 16 rows × 40px = 2000 × 640
    map: [
      '##################################################',
      '#                                                #',
      '#  1                                          2  #',
      '#                                                #',
      '#                                                #',
      '#       a                                b       #',
      '#                                                #',
      '###################### ###########################',
      '#                                                #',
      '#                                                #',
      '#       c                                d       #',
      '#                                                #',
      '#                                                #',
      '############ #####################################',
      '#                                              F #',
      '##################################################',
    ],
    plates: {
      a: {x: 8, y: 5, who: 'p1', gate: 1},
      b: {x: 41, y: 5, who: 'p2', gate: 1},
      c: {x: 8, y: 10, who: 'p1', gate: 2},
      d: {x: 41, y: 10, who: 'p2', gate: 2},
    },
    gates: [{ id: 1, door: {x: 22, y: 7} }, { id: 2, door: {x: 12, y: 13} }],
    spawns: { 1: {x: 3, y: 2}, 2: {x: 46, y: 2} },
    finish: {x: 47, y: 14},
    guards: [],
    questionRange: { min: 3, max: 6 },
    timed: false,
  },
  {
    name: 'Round 2 · Shadow Library · Boss',
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
    questionRange: { min: 5, max: 9 },
    timed: false,
    boss: {
      name: 'THE LIBRARIAN',
      subtitle: 'The forbidden tome awakens…',
      arenaYMin: 8,
      spawn: { x: 30, y: 13 },        // tile coords (center of arena)
      hp: 8,
      attackInterval: 4800,
      telegraphMs: 1150,
      damageMs: 600,
      damageRadius: 75,
      playerHp: 4,
      padCooldownMs: 1600,
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
    name: 'Round 3 · Crimson Vault',
    tile: 32,
    theme: {
      floor: 0x2a1010, floorAlt: 0x3a1818, grid: 0x553030,
      wallTop: 0x8b3a3a, wallSide: 0x401818, wallEdge: 0xf87171,
      bg: '#160808',
      ambient: 'embers', ambientColor: 0xf97316,
      accent: 0xf87171,
    },
    // 72 cols × 20 rows × 32px = 2304 × 640
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
    finish: {x: 69, y: 18},
    guards: [
      { y: 7, minX: 4, maxX: 68, period: 6500 },
      { y: 12, minX: 4, maxX: 68, period: 5500 },
    ],
    questionRange: { min: 7, max: 12 },
    timed: true,
    timedMs: 6500,
    key: {
      spawn: {x: 3, y: 3},
      handoff: {x: 35, y: 9},
      lock: {x: 69, y: 18},
    },
  },
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
  playerHp: { 1: 4, 2: 4 },
  _playerHpRegenAt: 0,
  _bossIntroStarted: false,

  start() {
    this.currentLevelIdx = 0;
    this.level = LEVELS[0];

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
    this.currentLevelIdx = idx;
    this.level = LEVELS[idx];
    this.resetState();
    this.phaserGame.scene.scenes[0].scene.restart();
  },

  resetState() {
    this.walls = [];
    this.gateState = {};
    this.plates = {};
    this.guards = [];
    this.activePlate = null;
    this.pendingQuestion = null;
    this.finishedMe = false;
    this.finishedThem = false;
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
    this.playerHp = { 1: 4, 2: 4 };
    this._playerHpRegenAt = 0;
    this._bossIntroStarted = false;
    this._bossQSeed = null;
    this._finishLockedNote = 0;
    this.bossIntroLockUntil = 0;
    this.bossStunUntil = 0;
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
    this.drawKeySystem(scene);
    this.setupBoss(scene);

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

    const container = scene.add.container(bx, by);
    container.setDepth(14);
    container.setScale(0); // start hidden — intro tweens up

    // Aura
    const aura = scene.add.circle(0, 0, 60, 0xa78bfa, 0.18);
    const aura2 = scene.add.circle(0, 0, 44, 0xc4b5fd, 0.25);
    // Body — a floating tome with a single glowing eye
    const bodyShadow = scene.add.ellipse(0, 38, 80, 14, 0x000000, 0.5);
    const book = scene.add.graphics();
    book.fillStyle(0x2d1f44, 1);
    book.fillRoundedRect(-32, -28, 64, 56, 6);
    book.lineStyle(3, 0xa78bfa, 0.9);
    book.strokeRoundedRect(-32, -28, 64, 56, 6);
    book.fillStyle(0x1a1430, 1);
    book.fillRect(-4, -28, 8, 56);
    book.lineStyle(1.5, 0x5b3d7d, 0.8);
    book.strokeRect(-4, -28, 8, 56);
    // Decorative runes
    book.lineStyle(2, 0xc4b5fd, 0.6);
    book.beginPath();
    book.moveTo(-22, -14); book.lineTo(-12, -14);
    book.moveTo(-22, 14);  book.lineTo(-12, 14);
    book.moveTo(12, -14);  book.lineTo(22, -14);
    book.moveTo(12, 14);   book.lineTo(22, 14);
    book.strokePath();
    // Single eye in center
    const eyeWhite = scene.add.circle(0, 0, 9, 0xfef3c7, 1);
    const eyeIris = scene.add.circle(0, 0, 6, 0xef4444, 1);
    const eyePupil = scene.add.circle(0, 0, 3, 0x000000, 1);
    const eyeGlow = scene.add.circle(0, 0, 14, 0xef4444, 0.4);

    container.add([aura, aura2, bodyShadow, book, eyeGlow, eyeWhite, eyeIris, eyePupil]);

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

    // Lock both players
    this.bossIntroLockUntil = (startedAt || performance.now()) + 3600;
    this.me.body.body.setVelocity(0, 0);

    // Camera dramatics — stop follow, pan to boss, slight zoom
    scene.cameras.main.stopFollow();
    scene.cameras.main.pan(b.worldX, b.worldY - 20, 800, 'Sine.easeInOut');
    scene.cameras.main.zoomTo(1.25, 800, 'Sine.easeInOut');

    // Dim overlay (screen-anchored)
    const dim = scene.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 0).setOrigin(0, 0);
    dim.setScrollFactor(0);
    dim.setDepth(70);
    if (this.minimap) this.minimap.ignore(dim);
    scene.tweens.add({ targets: dim, alpha: 0.55, duration: 600 });

    // Letterbox bars
    const barH = 60;
    const barTop = scene.add.rectangle(0, -barH, VIEW_W, barH, 0x000000, 0.95).setOrigin(0, 0);
    const barBot = scene.add.rectangle(0, VIEW_H, VIEW_W, barH, 0x000000, 0.95).setOrigin(0, 0);
    barTop.setScrollFactor(0); barBot.setScrollFactor(0);
    barTop.setDepth(82); barBot.setDepth(82);
    if (this.minimap) this.minimap.ignore([barTop, barBot]);
    scene.tweens.add({ targets: barTop, y: 0, duration: 500, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: barBot, y: VIEW_H - barH, duration: 500, ease: 'Cubic.easeOut' });

    // Boss rises from floor (scale tween + slight overshoot)
    scene.tweens.add({
      targets: b.container, scale: { from: 0, to: 1.08 },
      duration: 700, delay: 400, ease: 'Back.easeOut',
      onComplete: () => scene.tweens.add({ targets: b.container, scale: 1, duration: 250, ease: 'Sine.easeInOut' }),
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

    scene.tweens.add({ targets: name, alpha: 1, scale: 1, duration: 500, delay: 900, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: subtitle, alpha: 1, duration: 400, delay: 1300 });

    // Music + roar
    this.bossStinger();

    // "FIGHT!" flash + camera shake
    scene.time.delayedCall(2400, () => {
      const fight = scene.add.text(VIEW_W / 2, VIEW_H / 2, 'FIGHT!', {
        fontFamily: 'Space Grotesk, sans-serif',
        fontSize: '110px', fontStyle: 'bold',
        color: '#fbbf24', stroke: '#1a0a0a', strokeThickness: 10,
      }).setOrigin(0.5);
      fight.setScrollFactor(0); fight.setDepth(95);
      fight.setScale(0.3); fight.setAlpha(0);
      if (this.minimap) this.minimap.ignore(fight);
      scene.tweens.add({ targets: fight, scale: 1.15, alpha: 1, duration: 280, ease: 'Back.easeOut' });
      scene.tweens.add({ targets: fight, alpha: 0, scale: 1.4, duration: 500, delay: 600, onComplete: () => fight.destroy() });
      scene.cameras.main.shake(380, 0.014);
      scene.cameras.main.flash(220, 251, 191, 36, false);
      this.bossRoar();
    });

    // Release: tween out everything, resume follow, start fight
    scene.time.delayedCall(3400, () => {
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
    if (!this.boss) return;
    const mine = this.playerHp[Net.playerId] || 0;
    const max = this.level.boss.playerHp;
    let s = '';
    for (let i = 0; i < max; i++) s += i < mine ? '❤ ' : '🖤 ';
    this.boss.hearts.setText(s.trim());
  },

  updateBossHpBar() {
    if (!this.boss) return;
    const ratio = Math.max(0, this.boss.hp / this.level.boss.hp);
    const targetW = Math.max(0, (this.boss.hpBarW - 4) * ratio);
    this.scene.tweens.add({ targets: this.boss.hpFill, width: targetW, duration: 280, ease: 'Cubic.easeOut' });
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
    this.playerHp[Net.playerId] = Math.max(0, this.playerHp[Net.playerId] - 1);
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
      App.chatSystem(`💢 Hit! ${this.playerHp[Net.playerId]} lives left.`);
    }
  },

  onPlayerDown(pid) {
    if (pid === Net.playerId) {
      App.chatSystem('💀 You went down. Hope your partner can carry…');
      this.bossStunUntil = performance.now() + 10_000_000; // locked until wipe or revive
      // Visually dim the player
      if (this.me && this.me.visual) this.me.visual.setAlpha(0.4);
    } else {
      App.chatSystem('💀 Partner went down!');
      if (this.other && this.other.visual) this.other.visual.setAlpha(0.4);
    }
    // Wipe check — only host triggers
    if (Net.isHost && this.playerHp[1] === 0 && this.playerHp[2] === 0 && this.bossPhase === 'fight') {
      this.triggerWipe();
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
    this.playerHp = { 1: cfg.playerHp, 2: cfg.playerHp };
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
    this.playerHp = { 1: this.level.boss.playerHp, 2: this.level.boss.playerHp };
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
        App.chatSystem('🌟 Finish portal opened. Both players walk through to win!');
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
      Net.send({ type: 'pos', x: this.me.body.x, y: this.me.body.y, vx, vy });
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
    if (Questions.check(q, raw)) {
      feedback.textContent = '✓ Hit!';
      feedback.className = 'correct';
      if (q._boss) {
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
      Net.send({ type: 'finish' });
      App.chatSystem(`🏁 Player ${Net.playerId} reached the finish.`);
      SFX.finish();
      this.burst(this.me.body.x, this.me.body.y, PALETTE.finish, 24);
      this.checkRoundComplete();
    }
  },

  checkRoundComplete() {
    if (!(this.finishedMe && this.finishedThem)) return;
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
    Net.send({ type: 'ready-next' });
    App.updateContinueButton();
    this.tryAdvance();
  },

  tryAdvance() {
    if (this.readyToContinue && this.partnerReadyToContinue) {
      App.hideRoundComplete();
      this.loadLevel(this.currentLevelIdx + 1);
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
      this.finishedThem = true;
      App.chatSystem(`🏁 Partner reached the finish.`);
      this.checkRoundComplete();
    } else if (msg.type === 'voice-ready') {
      Voice.onPartnerReady();
    } else if (msg.type === 'speaking') {
      const partnerId = Net.playerId === 1 ? 2 : 1;
      this.setSpeaking(partnerId, msg.on);
    } else if (msg.type === 'ready-next') {
      this.partnerReadyToContinue = true;
      App.updateContinueButton();
      this.tryAdvance();
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
    }
  },
};
