// Classroom networking layer — separate peer connection from the pair-room peer.
// Teacher hosts a peer with prefix `dac-class-`. Students open a second connection
// to the teacher in addition to their partner connection.

const Classroom = {
  role: null,            // 'teacher' | 'student' | null
  peer: null,            // PeerJS peer object
  classCode: null,

  // Teacher side
  studentConns: {},      // connId -> { conn, info: { pid, pairCode, partnerName, round, hp, ... } }
  teacherHandlers: {
    onStudentJoin: null,         // (connId, info) => void
    onStudentUpdate: null,       // (connId, info) => void
    onStudentLeave: null,        // (connId) => void
    onLeaderboardEntry: null,    // (entry) => void
    onStudentChat: null,         // (connId, text) => void
  },

  // Student side
  teacherConn: null,
  studentHandlers: {
    onPackReceived: null,        // (pack) => void
    onTeacherBroadcast: null,    // (text) => void
    onConnect: null,             // () => void
    onDisconnect: null,          // () => void
  },

  _prefix: 'dac-class-',

  // ── Teacher ─────────────────────────────────────────────────────
  openTeacher(onReady, onError) {
    this.role = 'teacher';
    this._tryHostClass(onReady, onError, 0);
  },

  _tryHostClass(onReady, onError, attempts) {
    if (attempts > 5) { onError && onError('Could not get a free class code. Try again.'); return; }
    const code = Net.randomCode();
    const peer = new Peer(this._prefix + code, Net._peerOpts());
    peer.on('open', () => {
      this.peer = peer;
      this.classCode = code;
      onReady && onReady(code);

      peer.on('connection', (conn) => {
        const connId = conn.peer;
        this.studentConns[connId] = { conn, info: { pid: null, pairCode: null, round: null, status: 'connecting' } };
        conn.on('open', () => {
          // Send current pack on connect
          try {
            const pack = Packs.getActive();
            conn.send({ type: 'class_pack', pack });
          } catch (e) { /* Packs not yet loaded */ }
          if (this.teacherHandlers.onStudentJoin) this.teacherHandlers.onStudentJoin(connId, this.studentConns[connId].info);
        });
        conn.on('data', (msg) => this._teacherHandle(connId, msg));
        conn.on('close', () => {
          delete this.studentConns[connId];
          if (this.teacherHandlers.onStudentLeave) this.teacherHandlers.onStudentLeave(connId);
        });
      });
    });
    peer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        peer.destroy();
        this._tryHostClass(onReady, onError, attempts + 1);
      } else {
        onError && onError(err.message || String(err));
      }
    });
  },

  _teacherHandle(connId, msg) {
    const entry = this.studentConns[connId];
    if (!entry) return;
    if (msg.type === 'class_hello') {
      entry.info = { ...entry.info, ...msg.info, status: 'joined' };
      if (this.teacherHandlers.onStudentJoin) this.teacherHandlers.onStudentJoin(connId, entry.info);
    } else if (msg.type === 'class_status') {
      entry.info = { ...entry.info, ...msg.info };
      if (this.teacherHandlers.onStudentUpdate) this.teacherHandlers.onStudentUpdate(connId, entry.info);
    } else if (msg.type === 'class_finish') {
      if (this.teacherHandlers.onLeaderboardEntry) this.teacherHandlers.onLeaderboardEntry({ ...msg.entry, _at: Date.now() });
    } else if (msg.type === 'class_chat') {
      if (this.teacherHandlers.onStudentChat) this.teacherHandlers.onStudentChat(connId, msg.text);
    }
  },

  // Broadcast helpers (teacher → students)
  broadcastPack(pack) {
    if (this.role !== 'teacher') return;
    this._broadcast({ type: 'class_pack', pack });
  },

  broadcastMessage(text) {
    if (this.role !== 'teacher') return;
    this._broadcast({ type: 'class_broadcast', text });
  },

  _broadcast(msg) {
    for (const id of Object.keys(this.studentConns)) {
      const e = this.studentConns[id];
      if (e.conn && e.conn.open) e.conn.send(msg);
    }
  },

  // ── Student ─────────────────────────────────────────────────────
  joinClass(code, onReady, onError) {
    this.role = 'student';
    this.classCode = code;
    const peer = new Peer(undefined, Net._peerOpts());
    peer.on('open', () => {
      this.peer = peer;
      const conn = peer.connect(this._prefix + code, { reliable: true });
      this.teacherConn = conn;
      conn.on('open', () => {
        onReady && onReady();
        if (this.studentHandlers.onConnect) this.studentHandlers.onConnect();
        this.sendHello();
      });
      conn.on('data', (msg) => this._studentHandle(msg));
      conn.on('close', () => {
        if (this.studentHandlers.onDisconnect) this.studentHandlers.onDisconnect();
      });
    });
    peer.on('error', (err) => {
      if (err.type === 'peer-unavailable') onError && onError(`No class with code "${code}".`);
      else onError && onError(err.message || String(err));
    });
  },

  _studentHandle(msg) {
    if (msg.type === 'class_pack') {
      if (this.studentHandlers.onPackReceived) this.studentHandlers.onPackReceived(msg.pack);
    } else if (msg.type === 'class_broadcast') {
      if (this.studentHandlers.onTeacherBroadcast) this.studentHandlers.onTeacherBroadcast(msg.text);
    }
  },

  sendHello() {
    if (this.role !== 'student' || !this.teacherConn || !this.teacherConn.open) return;
    this.teacherConn.send({
      type: 'class_hello',
      info: {
        pid: Net.playerId,
        pairCode: Net.roomCode,
        partnerConnected: !!(Net.conn && Net.conn.open),
        name: (typeof App !== 'undefined') ? (App.playerName || '') : '',
      },
    });
  },

  sendStatus(info) {
    if (this.role !== 'student' || !this.teacherConn || !this.teacherConn.open) return;
    this.teacherConn.send({ type: 'class_status', info });
  },

  sendFinish(entry) {
    if (this.role !== 'student' || !this.teacherConn || !this.teacherConn.open) return;
    this.teacherConn.send({ type: 'class_finish', entry });
  },

  sendChat(text) {
    if (this.role !== 'student' || !this.teacherConn || !this.teacherConn.open) return;
    this.teacherConn.send({ type: 'class_chat', text });
  },

  connected() {
    return !!(this.teacherConn && this.teacherConn.open);
  },
};
