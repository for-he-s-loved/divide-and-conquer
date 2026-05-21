// PeerJS wrapper. Handles room creation/joining and message passing.
// Both clients run symmetric logic; player 1 (host) just picks the room code.

const Net = {
  peer: null,
  conn: null,
  isHost: false,
  playerId: 0,        // 1 or 2
  roomCode: null,
  onOpen: null,
  onPeer: null,       // (msg) => void
  onConnect: null,
  onDisconnect: null,

  _prefix: 'dac-',    // namespace so codes don't collide with random PeerJS IDs

  randomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no easily-confused chars
    let c = '';
    for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
    return c;
  },

  host(onReady, onError) {
    this.isHost = true;
    this.playerId = 1;
    this._tryHost(onReady, onError, 0);
  },

  _tryHost(onReady, onError, attempts) {
    if (attempts > 5) { onError('Could not get a free room code. Try again.'); return; }
    const code = this.randomCode();
    const peer = new Peer(this._prefix + code, { debug: 1 });
    peer.on('open', () => {
      this.peer = peer;
      this.roomCode = code;
      onReady(code);

      peer.on('connection', (conn) => {
        this.conn = conn;
        conn.on('open', () => {
          if (this.onConnect) this.onConnect();
        });
        conn.on('data', (msg) => { if (this.onPeer) this.onPeer(msg); });
        conn.on('close', () => { if (this.onDisconnect) this.onDisconnect(); });
      });
    });
    peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        peer.destroy();
        this._tryHost(onReady, onError, attempts + 1);
      } else {
        onError(err.message || String(err));
      }
    });
  },

  join(code, onReady, onError) {
    this.isHost = false;
    this.playerId = 2;
    this.roomCode = code;
    const peer = new Peer(undefined, { debug: 1 });
    peer.on('open', () => {
      this.peer = peer;
      const conn = peer.connect(this._prefix + code, { reliable: true });
      this.conn = conn;
      conn.on('open', () => {
        onReady();
        if (this.onConnect) this.onConnect();
      });
      conn.on('data', (msg) => { if (this.onPeer) this.onPeer(msg); });
      conn.on('close', () => { if (this.onDisconnect) this.onDisconnect(); });
    });
    peer.on('error', (err) => {
      if (err.type === 'peer-unavailable') onError(`No room with code "${code}".`);
      else onError(err.message || String(err));
    });
  },

  send(msg) {
    if (this.conn && this.conn.open) {
      this.conn.send(msg);
    }
  },
};
