# Tests

Run from the repo root (needs Node 18+, and `npm install ws` once for the handshake test):

- `node tests/validate_levels.js .` — checks every level for structural problems:
  map row widths, plates/gates pairing, walls covering spawns/pads/finish, and
  BFS solvability (can both players actually open every gate and reach the finish).

- `node tests/test_handshake.js .` — end-to-end round-advance test. Boots the
  relay (../dac-peerserver/server.js, set PORT=9100) plus two headless game
  clients, then verifies: a normal advance, recovery after a dropped socket
  (queue + rejoin), and recovery after a lost ready-next message (resend loop).
  Start the relay first: `PORT=9100 node ../dac-peerserver/server.js`
