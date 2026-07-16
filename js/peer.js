// WebSocket message relay client. Replaces PeerJS/WebRTC.
// Both clients connect to the same server URL; the server forwards messages
// between them by room code. Works on any network with outbound HTTPS — no
// NAT traversal, no ICE, no TURN required.

const Net = {
  // ▼ Set this to your deployed relay URL (Render, Fly, etc.) ▼
  RELAY_URL: 'wss://dac-peerserver.onrender.com',

  ws: null,
  isHost: false,
  playerId: 0,
  roomCode: null,
  onOpen: null,
  onPeer: null,
  onConnect: null,
  onDisconnect: null,

  // Legacy stubs — classroom.js still talks to the PeerJS broker for the
  // teacher↔students connection, and voice.js opens WebRTC calls on top of it.
  // We keep these so those features don't crash when peer.js no longer creates
  // a Peer instance for the pair-game connection (which is now WebSocket).
  peer: null,
  _prefix: 'dac-',
  _peerOpts() {
    return {
      debug: 1,
      host: '0.peerjs.com', port: 443, path: '/', secure: true,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
    };
  },
  _hostReady: null,
  _hostError: null,
  _joinReady: null,
  _joinError: null,
  _connectTimer: null,

  // Reconnect / message-queue state. Previously a dropped socket silently
  // discarded every message (finish, ready-next, plate…) with no reconnect,
  // which deadlocked the round-advance handshake.
  _outbox: [],
  _reconnectTimer: null,
  _reconnectAttempts: 0,
  // When the relay restarts (e.g. a redeploy) it loses all rooms. On
  // 'no-room' during a mid-game reconnect the host re-creates the room under
  // the same code and the joiner keeps retrying 'join' until it exists again.
  _recoverMode: null, // null | 'rehost' | 'rejoin-as-join'

  _log(msg) {
    console.log('[Net]', msg);
    try { if (typeof App !== 'undefined' && App.netDiag) App.netDiag(msg); } catch (e) {}
  },

  randomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no easily-confused chars
    let c = '';
    for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
    return c;
  },

  _connect() {
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return this.ws;
    this._log(`Connecting to relay: ${this.RELAY_URL}`);
    const ws = new WebSocket(this.RELAY_URL);
    this.ws = ws;

    ws.addEventListener('message', (ev) => this._onMessage(ev));
    ws.addEventListener('error', (e) => {
      this._log(`Relay socket error (the server may be sleeping; Render free dynos take ~30s to wake)`);
    });
    ws.addEventListener('close', (e) => {
      this._log(`Relay socket closed (code=${e.code})`);
      this.ws = null;
      if (this._connectTimer) { clearTimeout(this._connectTimer); this._connectTimer = null; }
      if (this.onDisconnect) this.onDisconnect();
      // Mid-game drop → try to get back into the same room.
      if (this.roomCode && this.playerId) this._scheduleReconnect();
    });
    return ws;
  },

  _scheduleReconnect() {
    if (this._reconnectTimer || !this.roomCode || !this.playerId) return;
    if (this._reconnectAttempts >= 30) {
      this._log('Gave up reconnecting after 30 attempts.');
      try { if (typeof App !== 'undefined' && App.chatSystem) App.chatSystem('⚠ Lost the relay connection and could not recover. Both players should refresh and start a new room.'); } catch (_) {}
      return;
    }
    const delay = Math.min(8000, 500 * Math.pow(2, this._reconnectAttempts));
    this._reconnectAttempts++;
    this._log(`Reconnecting in ${(delay / 1000).toFixed(1)}s… (attempt ${this._reconnectAttempts}/30)`);
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._rejoin();
    }, delay);
  },

  _rejoin() {
    const code = this.roomCode;
    if (!code) return;
    const ws = this._connect();
    const go = () => {
      if (this._recoverMode === 'rehost') this._send({ type: 'host', code });
      else if (this._recoverMode === 'rejoin-as-join') this._send({ type: 'join', code });
      else this._send({ type: 'rejoin', code, role: this.isHost ? 'host' : 'joiner' });
    };
    if (ws.readyState === 1) go();
    else ws.addEventListener('open', go, { once: true });
  },

  _flushOutbox() {
    if (!this.ws || this.ws.readyState !== 1) return;
    const q = this._outbox.splice(0);
    for (const m of q) this._send({ type: 'data', payload: m });
    if (q.length) this._log(`Flushed ${q.length} queued message(s).`);
  },

  _setConnPill(connected) {
    try {
      const conn = document.getElementById('conn-status');
      if (conn) {
        conn.textContent = connected ? '● Connected' : '○ Disconnected';
        conn.className = 'hud-pill ' + (connected ? 'connected' : 'disconnected');
      }
    } catch (_) {}
  },

  _send(obj) {
    if (!this.ws || this.ws.readyState !== 1) return;
    this.ws.send(JSON.stringify(obj));
  },

  _onMessage(ev) {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (_) { return; }

    if (msg.type === 'hosted') {
      const midGameRehost = !this._hostReady && this.playerId;
      this._log(midGameRehost
        ? `Room ${msg.code} re-created after relay restart. Waiting for partner to rejoin…`
        : `Hosted room ${msg.code}. Waiting for partner…`);
      this.roomCode = msg.code;
      this._reconnectAttempts = 0;
      this._recoverMode = null;
      if (midGameRehost) {
        try { if (typeof App !== 'undefined' && App.chatSystem) App.chatSystem('🔌 Relay came back — waiting for partner to reconnect…'); } catch (_) {}
      }
      if (this._hostReady) { this._hostReady(msg.code); this._hostReady = null; }
      this._hostError = null; // don't let a stale callback swallow future errors
    } else if (msg.type === 'joined') {
      const midGameRejoin = !this._joinReady && this.playerId;
      this._log(`Joined room ${msg.code}. Connected ✓`);
      this.roomCode = msg.code;
      this._reconnectAttempts = 0;
      this._recoverMode = null;
      if (this._connectTimer) { clearTimeout(this._connectTimer); this._connectTimer = null; }
      if (this._joinReady) { this._joinReady(); this._joinReady = null; }
      this._joinError = null; // don't let a stale callback swallow future errors
      if (midGameRejoin) {
        this._flushOutbox();
        this._setConnPill(true);
        try { if (typeof App !== 'undefined' && App.chatSystem) App.chatSystem('🔌 Reconnected to the relay.'); } catch (_) {}
      } else if (this.onConnect) {
        this.onConnect();
      }
    } else if (msg.type === 'partner-joined') {
      this._log(`Partner connected ✓`);
      this._flushOutbox();
      if (this.onConnect) this.onConnect();
    } else if (msg.type === 'rejoined') {
      this._log(`Rejoined room ${msg.code} ✓${msg.partner ? '' : ' (partner not back yet)'}`);
      this._reconnectAttempts = 0;
      this._recoverMode = null;
      if (msg.partner !== false) this._flushOutbox();
      this._setConnPill(true);
      try {
        if (typeof App !== 'undefined' && App.chatSystem) App.chatSystem('🔌 Reconnected to the relay.');
      } catch (_) {}
    } else if (msg.type === 'partner-rejoined') {
      this._log('Partner reconnected ✓');
      this._flushOutbox();
      try {
        if (typeof App !== 'undefined' && App.chatSystem) App.chatSystem('🔌 Partner reconnected.');
      } catch (_) {}
    } else if (msg.type === 'partner-left') {
      this._log(`Partner disconnected`);
      if (this.onDisconnect) this.onDisconnect();
    } else if (msg.type === 'data') {
      if (this.onPeer) this.onPeer(msg.payload);
    } else if (msg.type === 'error') {
      this._log(`Relay error: ${msg.reason}`);
      if (msg.reason === 'no-room' && !this._joinError && this.playerId) {
        // Mid-game reconnect found the room gone — the relay restarted and
        // lost it. Host re-creates the room under the same code; joiner
        // retries 'join' until the host has done so.
        this._recoverMode = this.isHost ? 'rehost' : 'rejoin-as-join';
        this._log(this.isHost
          ? 'Room lost (relay restarted) — re-creating it under the same code…'
          : 'Room lost (relay restarted) — waiting for host to re-create it…');
        this._scheduleReconnect();
        return;
      }
      if ((msg.reason === 'code-taken' || msg.reason === 'room-full') && !this._hostError && !this._joinError && this.playerId) {
        // Mid-game recovery race (partner's stale socket still holds the
        // slot, or another pair took the code) — retry shortly.
        this._scheduleReconnect();
        return;
      }
      if (msg.reason === 'code-taken' && this._hostError) {
        // Caller will retry with a new code
        this._hostError({ type: 'code-taken' });
        this._hostError = null;
      } else if (msg.reason === 'no-room' && this._joinError) {
        this._joinError(`No pair with code "${this.roomCode}". Double-check the code, and make sure the host is still on the waiting screen.`);
        this._joinError = null;
      } else if (msg.reason === 'room-full' && this._joinError) {
        this._joinError(`Room "${this.roomCode}" is already full.`);
        this._joinError = null;
      } else if (this._joinError) {
        this._joinError(msg.reason);
        this._joinError = null;
      } else if (this._hostError) {
        this._hostError(msg.reason);
        this._hostError = null;
      }
    }
  },

  host(onReady, onError) {
    this.isHost = true;
    this.playerId = 1;
    this._tryHost(onReady, onError, 0);
  },

  _tryHost(onReady, onError, attempts) {
    if (attempts > 5) { onError('Could not get a free room code. Try again.'); return; }
    const code = this.randomCode();
    const startHost = () => {
      this._hostReady = (c) => onReady(c);
      this._hostError = (err) => {
        if (err && err.type === 'code-taken') { this._tryHost(onReady, onError, attempts + 1); }
        else onError(typeof err === 'string' ? err : 'Host failed');
      };
      this._log(`Hosting room ${code}…`);
      this._send({ type: 'host', code });
    };
    const ws = this._connect();
    if (ws.readyState === 1) startHost();
    else ws.addEventListener('open', startHost, { once: true });
  },

  join(code, onReady, onError) {
    this.isHost = false;
    this.playerId = 2;
    this.roomCode = code;
    const startJoin = () => {
      this._joinReady = () => onReady();
      this._joinError = (err) => onError(err);
      this._log(`Joining room ${code}…`);
      this._send({ type: 'join', code });
      this._connectTimer = setTimeout(() => {
        if (this._joinReady) {
          this._joinError && this._joinError(`Connection to "${code}" timed out. The relay may be waking up (Render free tier sleeps after 15min). Try again in 30 seconds.`);
          this._joinReady = null;
          this._joinError = null;
        }
      }, 30000);
    };
    const ws = this._connect();
    if (ws.readyState === 1) startJoin();
    else ws.addEventListener('open', startJoin, { once: true });
  },

  send(msg) {
    if (this.ws && this.ws.readyState === 1) {
      this._send({ type: 'data', payload: msg });
    } else if (this.roomCode && this.playerId) {
      // Socket is down mid-game: queue instead of silently dropping, and
      // kick off a reconnect. Skip high-frequency position updates.
      if (msg && msg.type !== 'pos' && this._outbox.length < 200) this._outbox.push(msg);
      this._scheduleReconnect();
    }
  },

  // Legacy compat — game.js checks Net.conn.open in places
  get conn() {
    return this.ws ? { open: this.ws.readyState === 1, send: (m) => this.send(m) } : null;
  },
};
