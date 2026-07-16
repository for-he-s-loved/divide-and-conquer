// Level-data validator for Divide & Conquer.
// Loads js/game.js top-level (LEVELS) with stubs, then checks structural
// integrity + solvability (BFS reachability with progressive gate opening).

const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(process.argv[2] || '/tmp/dac', 'js/game.js'), 'utf8');

// Stubs so top-level eval works
global.Phaser = { AUTO: 0, Scale: { FIT: 0, CENTER_BOTH: 0 } };
global.document = { getElementById: () => null };
global.performance = { now: () => 0 };
global.App = {}; global.Net = {}; global.SFX = {}; global.Music = {};
global.Voice = {}; global.Packs = {}; global.Classroom = {};

eval(src + '\n; global.__LEVELS = LEVELS; global.__Game = Game;');
const LEVELS = global.__LEVELS;

let problems = 0;
const bad = (lvl, msg) => { problems++; console.log(`  ✗ [${lvl}] ${msg}`); };
const info = (lvl, msg) => console.log(`  · [${lvl}] ${msg}`);

LEVELS.forEach((L, idx) => {
  const name = `R${idx + 1} ${L.name || ''}`;
  console.log(`\n=== Level ${idx + 1}: ${L.name}`);
  const rows = L.map.length, cols = L.map[0].length;

  // 1. rectangular map
  L.map.forEach((r, y) => {
    if (r.length !== cols) bad(name, `map row ${y} width ${r.length} != ${cols}`);
  });

  const inB = (p) => p && p.x >= 0 && p.y >= 0 && p.x < cols && p.y < rows;
  const at = (p) => (inB(p) ? L.map[p.y][p.x] : '#');
  const open = (p) => inB(p) && at(p) !== '#';

  const checkPt = (label, p, mustBeOpen = true) => {
    if (!p) return bad(name, `${label} missing`);
    if (!inB(p)) return bad(name, `${label} (${p.x},${p.y}) out of bounds`);
    if (mustBeOpen && at(p) === '#') bad(name, `${label} (${p.x},${p.y}) is inside a wall`);
  };

  checkPt('spawn P1', L.spawns && L.spawns[1]);
  checkPt('spawn P2', L.spawns && L.spawns[2]);
  checkPt('finish', L.finish);

  // 2. plates/gates pairing
  const gateIds = new Set((L.gates || []).map(g => g.id));
  const platesByGate = {};
  for (const [k, p] of Object.entries(L.plates || {})) {
    checkPt(`plate ${k}`, p);
    if (!gateIds.has(p.gate)) bad(name, `plate ${k} references gate ${p.gate} which doesn't exist`);
    (platesByGate[p.gate] = platesByGate[p.gate] || []).push({ k, ...p });
  }
  for (const g of L.gates || []) {
    checkPt(`gate ${g.id} door`, g.door, false);
    const ps = platesByGate[g.id] || [];
    const who = ps.map(p => p.who).sort().join(',');
    if (who !== 'p1,p2') bad(name, `gate ${g.id} has plates [${who}] — needs exactly p1+p2 (else it can NEVER open)`);
    if (at(g.door) === '#') info(name, `gate ${g.id} door on wall tile (ok if intended as blocker)`);
  }

  if (L.key) {
    checkPt('key spawn', L.key.spawn);
    checkPt('key handoff', L.key.handoff);
    checkPt('key lock', L.key.lock);
    if (L.key.lock && L.finish && (L.key.lock.x !== L.finish.x || L.key.lock.y !== L.finish.y))
      info(name, `key lock (${L.key.lock.x},${L.key.lock.y}) != finish (${L.finish.x},${L.finish.y})`);
  }
  if (L.boss) {
    checkPt('boss spawn', L.boss.spawn, false);
    for (const [pk, pp] of Object.entries(L.boss.pads || {})) checkPt(`boss pad ${pk}`, pp);
    if (L.boss.arena) {
      const a = L.boss.arena;
      if (!inB({ x: a.x1, y: a.y1 }) || !inB({ x: a.x2, y: a.y2 })) bad(name, 'boss arena out of bounds');
    }
  }
  if (L.reviveZone) checkPt('reviveZone', L.reviveZone);

  // 3. Solvability sim: BFS with progressive gate opening + key logic
  const doorAt = {};
  for (const g of L.gates || []) doorAt[`${g.door.x},${g.door.y}`] = g.id;

  const reach = (from, openGates) => {
    const seen = new Set();
    const q = [from];
    seen.add(`${from.x},${from.y}`);
    while (q.length) {
      const c = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = { x: c.x + dx, y: c.y + dy };
        const key = `${n.x},${n.y}`;
        if (seen.has(key) || !inB(n)) continue;
        const gid = doorAt[key];
        if (gid !== undefined && !openGates.has(gid)) continue; // closed door blocks
        if (at(n) === '#' && gid === undefined) continue;       // wall (doors may sit on '#')
        seen.add(key);
        q.push(n);
      }
    }
    return seen;
  };

  const openGates = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    const r1 = reach(L.spawns[1], openGates);
    const r2 = reach(L.spawns[2], openGates);
    for (const g of L.gates || []) {
      if (openGates.has(g.id)) continue;
      const ps = platesByGate[g.id] || [];
      const p1p = ps.find(p => p.who === 'p1');
      const p2p = ps.find(p => p.who === 'p2');
      if (p1p && p2p && r1.has(`${p1p.x},${p1p.y}`) && r2.has(`${p2p.x},${p2p.y}`)) {
        openGates.add(g.id);
        changed = true;
      }
    }
  }
  const r1 = reach(L.spawns[1], openGates);
  const r2 = reach(L.spawns[2], openGates);

  for (const g of L.gates || []) {
    if (!openGates.has(g.id)) {
      const ps = platesByGate[g.id] || [];
      const p1p = ps.find(p => p.who === 'p1');
      const p2p = ps.find(p => p.who === 'p2');
      bad(name, `gate ${g.id} can never open: p1 plate reachable=${p1p ? r1.has(`${p1p.x},${p1p.y}`) : 'n/a'}, p2 plate reachable=${p2p ? r2.has(`${p2p.x},${p2p.y}`) : 'n/a'} → LEVEL UNWINNABLE`);
    }
  }

  const fKey = `${L.finish.x},${L.finish.y}`;
  const f1 = r1.has(fKey), f2 = r2.has(fKey);
  if (!f1 && !f2) bad(name, `finish unreachable by BOTH players even with all openable gates → LEVEL UNWINNABLE`);
  else info(name, `finish reachable: P1=${f1} P2=${f2}`);

  if (L.key) {
    const ks = `${L.key.spawn.x},${L.key.spawn.y}`, kh = `${L.key.handoff.x},${L.key.handoff.y}`, kl = `${L.key.lock.x},${L.key.lock.y}`;
    if (!r1.has(ks)) bad(name, `P1 cannot reach key spawn → key flow stuck`);
    if (!r1.has(kh)) bad(name, `P1 cannot reach handoff → key flow stuck`);
    if (!r2.has(kh)) bad(name, `P2 cannot reach handoff → key flow stuck`);
    if (!r2.has(kl)) bad(name, `P2 cannot reach lock → key flow stuck (finish stays LOCKED)`);
  }
  if (L.boss) {
    for (const [pk, pp] of Object.entries(L.boss.pads || {})) {
      const k = `${pp.x},${pp.y}`;
      if (!r1.has(k) && !r2.has(k)) bad(name, `boss pad ${pk} unreachable by both players → boss unkillable → STUCK`);
    }
    if (L.boss.arena) {
      // both players must be able to enter arena to trigger intro
      let inArena1 = false, inArena2 = false;
      for (let y = L.boss.arena.y1; y <= L.boss.arena.y2; y++)
        for (let x = L.boss.arena.x1; x <= L.boss.arena.x2; x++) {
          if (r1.has(`${x},${y}`)) inArena1 = true;
          if (r2.has(`${x},${y}`)) inArena2 = true;
        }
      if (!inArena1 || !inArena2) bad(name, `boss arena enterable: P1=${inArena1} P2=${inArena2} — intro requires BOTH → STUCK`);
    }
  }
  if (L.reviveZone && !r1.has(`${L.reviveZone.x},${L.reviveZone.y}`) && !r2.has(`${L.reviveZone.x},${L.reviveZone.y}`))
    bad(name, 'reviveZone unreachable by both players');

  if (L.enemies) {
    const defs = (typeof global.__Game.expandEnemyDefs === 'function')
      ? (() => { try { return global.__Game.expandEnemyDefs.call({ level: L }, L.enemies); } catch (e) { return L.enemies; } })()
      : L.enemies;
    defs.forEach((e, i) => {
      if (e.x !== undefined && at({ x: e.x, y: e.y }) === '#') info(name, `enemy ${i} (${e.type}) spawns in wall at (${e.x},${e.y})`);
    });
  }
});

console.log(`\n${problems === 0 ? '✓ all levels pass' : problems + ' problem(s) found'}`);
