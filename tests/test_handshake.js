// End-to-end test: real game.js + real peer.js (in vm sandboxes) talking
// through the real relay server.js. Verifies:
//  1. normal round-advance handshake
//  2. self-healing after an abrupt socket drop mid-handshake (queue+rejoin)
const vm = require('vm');
const fs = require('fs');
const WS = require('ws');

const GAME_DIR = process.argv[2] || '/tmp/dac';
const RELAY_URL = 'ws://127.0.0.1:9100';
const gameSrc = fs.readFileSync(GAME_DIR + '/js/game.js', 'utf8');
const peerSrc = fs.readFileSync(GAME_DIR + '/js/peer.js', 'utf8')
  .replace("RELAY_URL: 'wss://dac-peerserver.onrender.com'", `RELAY_URL: '${RELAY_URL}'`);

function makeClient(name) {
  const el = () => ({ classList: { add() {}, remove() {} }, textContent: '', className: '', disabled: false });
  const ctx = {
    console: { log: (...a) => console.log(`  [${name}]`, ...a) },
    setTimeout, setInterval, clearTimeout, clearInterval,
    performance: { now: () => Date.now() },
    Date, Math, JSON,
    WebSocket: WS,
    document: { getElementById: el, activeElement: null },
    localStorage: { getItem: () => null, setItem: () => {} },
    Phaser: { AUTO: 0, Scale: { FIT: 0, CENTER_BOTH: 0 } },
    App: {
      events: [],
      chatSystem(t) { ctx.App.events.push(t); },
      showRoundComplete(n) { ctx.App.events.push(`SHOW_ROUND_COMPLETE:${n}`); },
      hideRoundComplete() {},
      updateContinueButton() {},
      updateRoundIndicator() {},
      updateKeyIndicator() {},
      stopTimer: () => '0:00',
      launchConfetti() {},
      netDiag() {},
      chatReceive() {},
      partnerName: '',
      timerStart: Date.now(), timerStopped: null,
    },
    SFX: new Proxy({}, { get: () => () => {} }),
    Music: new Proxy({}, { get: () => () => {} }),
    Voice: { onPartnerReady() {}, localStream: null },
    Packs: { setSessionPack() {}, getActive: () => ({ name: 'x', questions: [] }) },
    Classroom: { connected: () => false, sendFinish() {}, studentHandlers: {} },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(peerSrc, ctx);
  vm.runInContext(gameSrc, ctx);
  vm.runInContext(`
    Game.level = LEVELS[0];
    Game.currentLevelIdx = 0;
    Game.resetState();
    Game.phaserGame = { scene: { scenes: [{ scene: { restart() { App.events.push('RESTART:' + Game.currentLevelIdx); } } }] } };
    Net.onPeer = Game.handlePeerMessage.bind(Game);
    Net.onConnect = () => {};
    Net.onDisconnect = () => {};
    globalThis.Net = Net; globalThis.Game = Game; globalThis.LEVELS = LEVELS;
  `, ctx);
  return ctx;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  let failures = 0;
  const assert = (cond, msg) => {
    console.log(`  ${cond ? '✓' : '✗ FAIL:'} ${msg}`);
    if (!cond) failures++;
  };

  const host = makeClient('host');
  const join = makeClient('join');

  const code = await new Promise((res, rej) => host.Net.host(res, rej));
  await new Promise((res, rej) => join.Net.join(code, res, rej));
  await sleep(300);
  console.log(`\nRoom ${code} up. TEST 1: normal advance`);

  // Host reaches the finish (what checkFinish does)
  vm.runInContext(`
    Game.finishedMe = true;
    Net.send({ type: 'finish', levelIdx: Game.currentLevelIdx });
    Game.checkRoundComplete();
  `, host);
  await sleep(1200); // overlay setTimeout is 700ms
  assert(join.Game.roundOver === true, 'joiner sees round over after host finish');
  assert(join.App.events.some(e => String(e).startsWith('SHOW_ROUND_COMPLETE')), 'joiner shows round-complete overlay');

  vm.runInContext('Game.continueToNextRound()', host);
  await sleep(200);
  vm.runInContext('Game.continueToNextRound()', join);
  await sleep(600);
  assert(host.Game.currentLevelIdx === 1, `host advanced to level 2 (idx=${host.Game.currentLevelIdx})`);
  assert(join.Game.currentLevelIdx === 1, `joiner advanced to level 2 (idx=${join.Game.currentLevelIdx})`);
  assert(host.Game.roundOver === false && join.Game.roundOver === false, 'round state reset on both');

  console.log('\nTEST 2: joiner socket dies mid-handshake — must self-heal');
  vm.runInContext(`
    Game.finishedMe = true;
    Net.send({ type: 'finish', levelIdx: Game.currentLevelIdx });
    Game.checkRoundComplete();
  `, host);
  await sleep(1000);
  assert(join.Game.roundOver === true, 'joiner sees round 2 over');

  // Abruptly kill joiner's socket, then have joiner click Continue while dead.
  join.Net.ws.terminate();
  await sleep(100);
  vm.runInContext('Game.continueToNextRound()', join); // goes to outbox
  await sleep(200);
  vm.runInContext('Game.continueToNextRound()', host); // host waits
  await sleep(300);
  assert(host.Game.currentLevelIdx === 1, 'host still waiting (message queued on dead socket)');

  // Wait for joiner's auto-reconnect + rejoin + outbox flush + advance
  await sleep(6000);
  assert(join.Net.ws && join.Net.ws.readyState === 1, 'joiner reconnected to relay');
  assert(host.Game.currentLevelIdx === 2, `host advanced to level 3 after heal (idx=${host.Game.currentLevelIdx})`);
  assert(join.Game.currentLevelIdx === 2, `joiner advanced to level 3 after heal (idx=${join.Game.currentLevelIdx})`);

  console.log('\nTEST 3: lost ready-next — resend loop heals it');
  vm.runInContext(`
    Game.finishedMe = true;
    Net.send({ type: 'finish', levelIdx: Game.currentLevelIdx });
    Game.checkRoundComplete();
  `, join);
  await sleep(1000);
  // Simulate a one-off message drop: host clicks continue but we eat the send once.
  const realSend = host.Net._send.bind(host.Net);
  let ate = false;
  host.Net._send = (obj) => {
    if (!ate && obj.type === 'data' && obj.payload && obj.payload.type === 'ready-next') {
      ate = true; console.log('  [test] ate one ready-next from host');
      return;
    }
    realSend(obj);
  };
  vm.runInContext('Game.continueToNextRound()', host);
  await sleep(300);
  vm.runInContext('Game.continueToNextRound()', join);
  await sleep(400);
  // Without the resend loop this would now deadlock (joiner never saw host's ready-next).
  await sleep(4000);
  assert(host.Game.currentLevelIdx === 3, `host advanced to level 4 (idx=${host.Game.currentLevelIdx})`);
  assert(join.Game.currentLevelIdx === 3, `joiner advanced to level 4 (idx=${join.Game.currentLevelIdx})`);

  console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('test crashed:', e); process.exit(1); });
