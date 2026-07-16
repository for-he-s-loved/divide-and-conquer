// Lobby UI, view switching, chat, mic button, timer, confetti.

const App = {
  timerStart: 0,
  timerInterval: null,
  timerStopped: null,
  roster: {},          // teacher-side: connId -> info (mirrors Classroom.studentConns)
  leaderboard: [],     // teacher-side: persisted in localStorage
  LB_KEY: 'dac_leaderboard_v1',
  NAME_KEY: 'dac_player_name',
  playerName: '',      // local player's chosen name
  partnerName: '',     // remote partner's name

  init() {
    document.getElementById('host-btn').onclick = () => { SFX.click(); this.startHost(); };
    document.getElementById('join-btn').onclick = () => { SFX.click(); this.startJoin(); };
    const codeInput = document.getElementById('code-input');
    if (codeInput) {
      codeInput.addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase(); });
      codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.startJoin(); });
    }
    const studentClassInputUpper = document.getElementById('student-class-code');
    if (studentClassInputUpper) studentClassInputUpper.addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase(); });
    document.getElementById('copy-code').onclick = () => this.copyCode();

    document.getElementById('answer-submit').onclick = () => Game.submitAnswer();
    document.getElementById('answer-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') Game.submitAnswer();
    });

    const manageBtn = document.getElementById('manage-content-btn');
    if (manageBtn) manageBtn.onclick = () => { SFX.click(); Teacher.open(); };
    const contentClose = document.getElementById('content-close');
    if (contentClose) contentClose.onclick = () => { SFX.click(); Teacher.close(); };
    const newPackBtn = document.getElementById('new-pack-btn');
    if (newPackBtn) newPackBtn.onclick = () => { SFX.click(); Teacher.newPack(); };
    const importBtn = document.getElementById('import-pack-btn');
    if (importBtn) importBtn.onclick = () => { SFX.click(); document.getElementById('import-file').click(); };
    const importFile = document.getElementById('import-file');
    if (importFile) importFile.addEventListener('change', (e) => Teacher.handleImport(e));

    this.refreshActivePackBar();

    document.getElementById('chat-send').onclick = () => this.chatSend();
    document.getElementById('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.chatSend();
    });

    document.getElementById('mic-btn').onclick = () => {
      SFX.click();
      if (!Voice.localStream) Voice.enable();
      else Voice.toggleMute();
    };

    document.getElementById('continue-btn').onclick = () => {
      SFX.click();
      Game.continueToNextRound();
    };

    document.getElementById('music-btn').onclick = () => {
      SFX.click();
      if (!Music.enabled) {
        Music.enable();
        if (Game.currentLevelIdx != null) Music.playTrack(Game.currentLevelIdx);
      } else {
        Music.toggleMute();
      }
      this.updateMusicButton();
    };

    Net.onConnect = () => this.onPeerConnect();
    Net.onDisconnect = () => this.onPeerDisconnect();

    // Load saved name
    try { this.playerName = localStorage.getItem(this.NAME_KEY) || ''; } catch (e) {}

    // ── Role / class / pair screen flow ────────────────
    const studentBtn = document.getElementById('role-student-btn');
    if (studentBtn) studentBtn.onclick = () => { SFX.click(); this.autoStartMusic(); this.showClassScreen(); };
    const nameInput = document.getElementById('student-name');
    if (nameInput) {
      nameInput.value = this.playerName || '';
      nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.submitClassCode(); });
    }

    const classBack = document.getElementById('class-back-btn');
    if (classBack) classBack.onclick = () => { SFX.click(); this.showRoleScreen(); };
    const classSkip = document.getElementById('class-skip-btn');
    if (classSkip) classSkip.onclick = () => {
      SFX.click();
      const nameInp = document.getElementById('student-name');
      const name = (nameInp ? nameInp.value : '').trim();
      if (!name) { this.setClassStatus('Type your name first.', true); nameInp && nameInp.focus(); return; }
      this.savePlayerName(name);
      this.showPairScreen(null);
    };
    const classContinue = document.getElementById('class-continue-btn');
    if (classContinue) classContinue.onclick = () => { SFX.click(); this.submitClassCode(); };
    const studentClassInput = document.getElementById('student-class-code');
    if (studentClassInput) {
      studentClassInput.addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase(); });
      studentClassInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.submitClassCode(); });
    }
    const pairBack = document.getElementById('pair-back-btn');
    if (pairBack) pairBack.onclick = () => { SFX.click(); this.showClassScreen(); };

    // ── Teacher Hub wiring ────────────────────────────
    const openTeacherBtn = document.getElementById('open-teacher-btn');
    if (openTeacherBtn) openTeacherBtn.onclick = () => { SFX.click(); this.autoStartMusic(); this.openTeacherConsole(); };

    const teacherExit = document.getElementById('teacher-exit');
    if (teacherExit) teacherExit.onclick = () => { SFX.click(); this.closeTeacherConsole(); };

    const teacherCopy = document.getElementById('teacher-copy-code');
    if (teacherCopy) teacherCopy.onclick = () => this.copyTeacherCode();

    const teacherManage = document.getElementById('teacher-manage-content');
    if (teacherManage) teacherManage.onclick = () => { SFX.click(); Teacher.open(); };

    const teacherPush = document.getElementById('teacher-push-pack');
    if (teacherPush) teacherPush.onclick = () => { SFX.click(); this.pushPackToClass(); };

    const teacherBroadcast = document.getElementById('teacher-broadcast-send');
    if (teacherBroadcast) teacherBroadcast.onclick = () => this.sendBroadcast();
    const broadcastInput = document.getElementById('teacher-broadcast-input');
    if (broadcastInput) broadcastInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.sendBroadcast(); });

    const lbClear = document.getElementById('leaderboard-clear');
    if (lbClear) lbClear.onclick = () => { SFX.click(); this.clearLeaderboard(); };

    // Student-side handlers: adopt pack pushed from teacher, surface broadcasts in chat
    Classroom.studentHandlers.onPackReceived = (pack) => {
      if (!pack) return;
      Packs.setSessionPack(pack);
      this.refreshActivePackBar();
      this.chatSystem(`📦 Teacher pushed new pack: ${pack.name} (${pack.questions.length} questions).`);
    };
    Classroom.studentHandlers.onTeacherBroadcast = (text) => {
      this.chatSystem(`📣 Teacher: ${text}`);
    };
  },

  updateRoundIndicator(current, total, name) {
    const el = document.getElementById('round-indicator');
    if (el) el.textContent = `${current}/${total} · ${name}`;
  },

  showRoundComplete(roundNumber) {
    const overlay = document.getElementById('round-complete');
    document.getElementById('round-complete-num').textContent = roundNumber;
    const titles = ['Nice work!', 'Great teamwork!', 'On a roll!', 'Unstoppable!', 'Legendary!'];
    document.getElementById('round-complete-title').textContent =
      titles[Math.min(roundNumber - 1, titles.length - 1)];
    const nextLevel = LEVELS && LEVELS[roundNumber];
    const next = nextLevel ? nextLevel.name : 'the next round';
    document.getElementById('round-complete-sub').textContent = `Next up: ${next}`;
    const diffEl = document.getElementById('round-complete-difficulty');
    if (diffEl) {
      const badge = nextLevel && nextLevel.difficultyBadge;
      if (badge) {
        diffEl.textContent = 'Difficulty: ' + badge;
        diffEl.classList.remove('hidden');
      } else {
        diffEl.classList.add('hidden');
      }
    }
    overlay.classList.remove('hidden');
    this.updateContinueButton();
    SFX.finish();
  },

  hideRoundComplete() {
    document.getElementById('round-complete').classList.add('hidden');
  },

  updateContinueButton() {
    const me = document.getElementById('ready-me');
    const them = document.getElementById('ready-them');
    const btn = document.getElementById('continue-btn');
    const hint = document.getElementById('continue-hint');
    const mineReady = Game.readyToContinue;
    const theirsReady = Game.partnerReadyToContinue;
    me.textContent = mineReady ? '●' : '○';
    me.className = 'ready-dot' + (mineReady ? ' ready' : '');
    them.textContent = theirsReady ? '●' : '○';
    them.className = 'ready-dot' + (theirsReady ? ' ready' : '');
    if (mineReady && theirsReady) {
      btn.disabled = true;
      btn.textContent = 'Loading next round…';
      hint.textContent = '';
    } else if (mineReady) {
      btn.disabled = true;
      btn.textContent = 'Waiting for partner…';
      hint.textContent = 'They need to click Continue too.';
    } else if (theirsReady) {
      btn.disabled = false;
      btn.textContent = 'Continue → (partner ready)';
      hint.textContent = 'Your partner is waiting on you.';
    } else {
      btn.disabled = false;
      btn.textContent = 'Continue →';
      hint.textContent = 'Both players must click to advance';
    }
  },

  setStatus(msg, isError) {
    const el = document.getElementById('lobby-status');
    el.textContent = msg;
    el.className = 'status' + (isError ? ' error' : '');
  },

  startHost() {
    this.setStatus('Creating pair code…');
    Net.host(
      (code) => {
        this.showWaiting(code);
        Voice.hostListenForCalls();
      },
      (err) => this.setStatus('Error: ' + err, true)
    );
  },

  startJoin() {
    const code = document.getElementById('code-input').value.trim().toUpperCase();
    if (code.length !== 4) {
      this.setStatus('Enter a 4-character pair code.', true);
      return;
    }
    this.setStatus('Joining ' + code + '…');
    Net.join(code, () => {}, (err) => this.setStatus('Error: ' + err, true));
  },

  // ── Screen navigation ──────────────────────
  hideAllScreens() {
    ['role-screen', 'class-screen', 'pair-screen', 'waiting', 'game-screen', 'teacher-screen', 'win-screen']
      .forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });
  },

  showRoleScreen() {
    this.hideAllScreens();
    document.getElementById('role-screen').classList.remove('hidden');
  },

  showClassScreen() {
    this.hideAllScreens();
    document.getElementById('class-screen').classList.remove('hidden');
    const inp = document.getElementById('student-class-code');
    if (inp) { inp.value = ''; setTimeout(() => inp.focus(), 50); }
    this.setClassStatus('');
  },

  setClassStatus(msg, isError) {
    const el = document.getElementById('class-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'status' + (isError ? ' error' : '');
  },

  submitClassCode() {
    const nameInp = document.getElementById('student-name');
    const name = (nameInp ? nameInp.value : '').trim();
    if (!name) { this.setClassStatus('Type your name first.', true); nameInp && nameInp.focus(); return; }
    this.savePlayerName(name);

    const inp = document.getElementById('student-class-code');
    const code = (inp.value || '').trim().toUpperCase();
    if (code.length !== 4) {
      this.setClassStatus('Enter the 4-letter code your teacher gave you.', true);
      return;
    }
    this.setClassStatus('Joining class ' + code + '…');
    Classroom.joinClass(
      code,
      () => { this.showPairScreen(code); },
      (err) => { this.setClassStatus(err, true); }
    );
  },

  netDiag(msg) {
    const el = document.getElementById('net-diag');
    if (!el) return;
    const t = new Date().toLocaleTimeString();
    el.textContent += `[${t}] ${msg}\n`;
    el.scrollTop = el.scrollHeight;
  },

  savePlayerName(name) {
    this.playerName = name.slice(0, 20);
    try { localStorage.setItem(this.NAME_KEY, this.playerName); } catch (e) {}
  },

  autoStartMusic() {
    if (typeof Music === 'undefined') return;
    if (Music.enabled) return;
    try { Music.enable(); Music.playTrack(0); } catch (e) {}
    this.updateMusicButton();
  },

  showPairScreen(classCode) {
    this.hideAllScreens();
    document.getElementById('pair-screen').classList.remove('hidden');
    const label = document.getElementById('pair-class-label');
    const codeEl = document.getElementById('pair-class-code');
    if (classCode) {
      label.classList.remove('hidden');
      codeEl.textContent = classCode;
    } else {
      label.classList.add('hidden');
    }
  },

  showWaiting(code) {
    this.hideAllScreens();
    document.getElementById('waiting').classList.remove('hidden');
    document.getElementById('room-code').textContent = code;
    document.getElementById('hud-room-code').textContent = code;
    this.setStatus('');
  },

  copyCode() {
    const code = document.getElementById('room-code').textContent;
    navigator.clipboard.writeText(code).then(() => {
      const btn = document.getElementById('copy-code');
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = orig, 1200);
    });
  },

  onPeerConnect() {
    if (Net.roomCode) document.getElementById('hud-room-code').textContent = Net.roomCode;
    this.hideAllScreens();
    document.getElementById('game-screen').classList.remove('hidden');
    const conn = document.getElementById('conn-status');
    conn.textContent = '● Connected';
    conn.className = 'hud-pill connected';

    if (Net.isHost) {
      const localPack = Packs.getActive();
      Packs.setSessionPack(localPack);
      Net.send({ type: 'pack', pack: localPack });
    }

    // Exchange names
    Net.send({ type: 'name', name: this.playerName || ('P' + Net.playerId) });
    this.updateYouLabel();

    if (!Game.phaserGame) Game.start();
    const packName = Packs.getSessionPack().name;
    const youAre = this.playerName || ('P' + Net.playerId);
    this.chatSystem(`Connected as ${youAre}. P1 = red, P2 = blue. Pack: ${packName}. Click 🎤 for voice.`);
  },

  updateYouLabel() {
    const el = document.getElementById('you-label');
    if (!el) return;
    const display = this.playerName || ('P' + Net.playerId);
    el.textContent = `You: ${display}`;
  },

  onPeerDisconnect() {
    const conn = document.getElementById('conn-status');
    conn.textContent = '○ Disconnected';
    conn.className = 'hud-pill disconnected';
    this.chatSystem('Partner disconnected.');
  },

  updateMusicButton() {
    const btn = document.getElementById('music-btn');
    const icon = document.getElementById('music-icon');
    const label = document.getElementById('music-label');
    if (!Music.enabled) {
      btn.className = 'hud-pill music-btn';
      icon.textContent = '🎵';
      label.textContent = 'Music';
    } else if (Music.muted) {
      btn.className = 'hud-pill music-btn muted';
      icon.textContent = '🔈';
      label.textContent = 'Muted';
    } else {
      btn.className = 'hud-pill music-btn active';
      icon.textContent = '🎶';
      label.textContent = 'Playing';
    }
  },

  updateKeyIndicator(state, myPlayerId, hasKey) {
    const el = document.getElementById('key-indicator');
    const txt = document.getElementById('key-status');
    if (!hasKey || state === 'used') {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    el.className = 'hud-pill key-indicator';
    const meIsP1 = myPlayerId === 1;
    if (state === 'idle') {
      txt.textContent = meIsP1 ? 'Go grab it!' : 'P1 is fetching…';
      if (meIsP1) el.classList.add('mine');
    } else if (state === 'p1') {
      txt.textContent = meIsP1 ? 'Carrying — to handoff' : 'P1 has the key';
      if (meIsP1) el.classList.add('mine');
    } else if (state === 'at_handoff') {
      txt.textContent = meIsP1 ? 'Dropped — partner grab it' : 'At handoff — grab it!';
      if (!meIsP1) el.classList.add('mine');
    } else if (state === 'p2') {
      txt.textContent = meIsP1 ? 'P2 has the key' : 'Carrying — to lock 🔒';
      if (!meIsP1) el.classList.add('mine');
    }
  },

  updateMicButton() {
    const btn = document.getElementById('mic-btn');
    const icon = document.getElementById('mic-icon');
    const label = document.getElementById('mic-label');
    if (!Voice.localStream) {
      btn.className = 'hud-pill mic-btn';
      icon.textContent = '🎤';
      label.textContent = 'Enable voice';
    } else if (Voice.muted) {
      btn.className = 'hud-pill mic-btn muted';
      icon.textContent = '🔇';
      label.textContent = 'Muted';
    } else {
      btn.className = 'hud-pill mic-btn active';
      icon.textContent = '🎤';
      label.textContent = 'Mic on';
    }
  },

  // ── Timer ────────────────────────────
  startTimer() {
    this.timerStart = Date.now();
    this.timerStopped = null;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => this._updateTimer(), 250);
    this._updateTimer();
  },

  stopTimer() {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
    this.timerStopped = Date.now();
    return this._formatElapsed();
  },

  _updateTimer() {
    const el = document.getElementById('timer');
    if (el) el.textContent = this._formatElapsed();
  },

  _formatElapsed() {
    const end = this.timerStopped || Date.now();
    const sec = Math.floor((end - this.timerStart) / 1000);
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  },

  // ── Chat ─────────────────────────────
  chatSend() {
    const inp = document.getElementById('chat-input');
    const text = inp.value.trim();
    if (!text) return;
    Net.send({ type: 'chat', text, from: Net.playerId });
    this.chatAppend(text, Net.playerId);
    inp.value = '';
    SFX.click();
  },

  chatReceive(text, from) { this.chatAppend(text, from); },

  chatAppend(text, from) {
    const log = document.getElementById('chat-log');
    const div = document.createElement('div');
    div.className = 'chat-msg p' + from;
    const isMe = from === Net.playerId;
    const who = isMe ? (this.playerName || ('P' + from)) : (this.partnerName || ('P' + from));
    div.innerHTML = `<span class="who">${this.escape(who)}</span>${this.escape(text)}`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  },

  chatSystem(text) {
    const log = document.getElementById('chat-log');
    const div = document.createElement('div');
    div.className = 'chat-msg sys';
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  },

  escape(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  },

  // ── Teacher Hub ─────────────────────────
  openTeacherConsole() {
    if (typeof Classroom === 'undefined') {
      alert('Classroom module not loaded. Hard-refresh the page (Ctrl+Shift+R).');
      return;
    }
    if (typeof Peer === 'undefined') {
      alert('PeerJS library not loaded. Check your internet connection and refresh.');
      return;
    }
    if (Classroom.role === 'teacher' && Classroom.classCode) {
      this.showTeacherScreen();
      return;
    }
    this.setStatus('Opening teacher console…');
    this.wireTeacherHandlers();
    this.showTeacherScreen();
    document.getElementById('teacher-class-code').textContent = '…';
    this.loadLeaderboard();
    this.renderLeaderboard();
    this.refreshTeacherPackInfo();
    this.renderRoster();
    try {
      Classroom.openTeacher(
        (code) => {
          this.setStatus('');
          document.getElementById('teacher-class-code').textContent = code;
        },
        (err) => {
          document.getElementById('teacher-class-code').textContent = 'ERR';
          alert('Teacher console error: ' + err);
        }
      );
    } catch (e) {
      document.getElementById('teacher-class-code').textContent = 'ERR';
      alert('Failed to open teacher console: ' + e.message);
    }
  },

  showTeacherScreen() {
    this.hideAllScreens();
    document.getElementById('teacher-screen').classList.remove('hidden');
  },

  closeTeacherConsole() {
    document.getElementById('teacher-screen').classList.add('hidden');
    document.getElementById('role-screen').classList.remove('hidden');
  },

  copyTeacherCode() {
    const code = document.getElementById('teacher-class-code').textContent;
    if (!code || code === '----') return;
    navigator.clipboard.writeText(code).then(() => {
      const btn = document.getElementById('teacher-copy-code');
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = orig, 1200);
    });
  },

  refreshTeacherPackInfo() {
    const active = Packs.getActive();
    const nameEl = document.getElementById('teacher-active-pack');
    const metaEl = document.getElementById('teacher-active-pack-meta');
    if (nameEl) nameEl.textContent = active.name;
    if (metaEl) metaEl.textContent = `${active.questions.length} questions · ${active.subject || 'General'}`;
  },

  pushPackToClass() {
    const pack = Packs.getActive();
    Classroom.broadcastPack(pack);
    this.refreshTeacherPackInfo();
    this.flashTeacherStatus(`Pushed "${pack.name}" to ${Object.keys(this.roster).length} student(s).`);
  },

  sendBroadcast() {
    const inp = document.getElementById('teacher-broadcast-input');
    const text = inp.value.trim();
    if (!text) return;
    Classroom.broadcastMessage(text);
    inp.value = '';
    this.flashTeacherStatus(`Broadcast sent.`);
  },

  flashTeacherStatus(msg) {
    const meta = document.getElementById('teacher-active-pack-meta');
    if (!meta) return;
    const orig = meta.textContent;
    meta.textContent = msg;
    setTimeout(() => this.refreshTeacherPackInfo(), 1800);
  },

  wireTeacherHandlers() {
    Classroom.teacherHandlers.onStudentJoin = (connId, info) => {
      this.roster[connId] = info;
      this.renderRoster();
    };
    Classroom.teacherHandlers.onStudentUpdate = (connId, info) => {
      this.roster[connId] = info;
      this.renderRoster();
    };
    Classroom.teacherHandlers.onStudentLeave = (connId) => {
      delete this.roster[connId];
      this.renderRoster();
    };
    Classroom.teacherHandlers.onLeaderboardEntry = (entry) => {
      this.addLeaderboardEntry(entry);
    };
    Classroom.teacherHandlers.onStudentChat = (connId, text) => {
      // Future: surface in a teacher chat panel. For now ignore.
    };
  },

  renderRoster() {
    const list = document.getElementById('roster-list');
    const countEl = document.getElementById('roster-count');
    if (!list) return;
    const ids = Object.keys(this.roster);
    if (countEl) countEl.textContent = ids.length;
    if (ids.length === 0) {
      list.innerHTML = '<div class="roster-empty">Waiting for students to join the class…</div>';
      return;
    }
    list.innerHTML = ids.map((id) => {
      const r = this.roster[id] || {};
      const pair = r.pairCode || '----';
      const round = r.round != null ? `R${r.round}` : '—';
      const partner = r.partnerConnected ? 'paired' : 'solo';
      const dot = r.partnerConnected ? 'on' : 'off';
      const name = r.name ? this.escape(r.name) : `<em>unnamed</em>`;
      return `<div class="roster-row">
        <span class="roster-dot ${dot}">●</span>
        <span class="roster-name">${name}</span>
        <span class="roster-meta">Pair ${this.escape(pair)} · ${round} · ${partner}</span>
      </div>`;
    }).join('');
  },

  addLeaderboardEntry(entry) {
    if (!entry || !entry.time) return;
    this.leaderboard.push(entry);
    this.leaderboard.sort((a, b) => (a.timeMs || Infinity) - (b.timeMs || Infinity));
    this.leaderboard = this.leaderboard.slice(0, 20);
    this.saveLeaderboard();
    this.renderLeaderboard();
  },

  renderLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    if (this.leaderboard.length === 0) {
      list.innerHTML = '<div class="roster-empty">No completions yet.</div>';
      return;
    }
    list.innerHTML = this.leaderboard.map((e, i) => `
      <div class="leaderboard-row">
        <span class="lb-rank">#${i + 1}</span>
        <span class="lb-pair">Pair ${this.escape(e.pairCode || '----')}</span>
        <span class="lb-time">${this.escape(e.time || '--:--')}</span>
      </div>`).join('');
  },

  loadLeaderboard() {
    try {
      const raw = localStorage.getItem(this.LB_KEY);
      this.leaderboard = raw ? JSON.parse(raw) : [];
    } catch (e) { this.leaderboard = []; }
  },

  saveLeaderboard() {
    try { localStorage.setItem(this.LB_KEY, JSON.stringify(this.leaderboard)); } catch (e) {}
  },

  clearLeaderboard() {
    if (!confirm('Clear the leaderboard?')) return;
    this.leaderboard = [];
    this.saveLeaderboard();
    this.renderLeaderboard();
  },

  refreshActivePackBar() {
    const active = Packs.getActive();
    const nameEl = document.getElementById('active-pack-name');
    const metaEl = document.getElementById('active-pack-meta');
    if (nameEl) nameEl.textContent = active.name;
    if (metaEl) metaEl.textContent = `${active.questions.length} item${active.questions.length === 1 ? '' : 's'} · ${active.subject || 'General'}`;
  },

  // ── Confetti ─────────────────────────
  launchConfetti() {
    const canvas = document.getElementById('confetti');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ['#7ee9c1', '#5ad1ff', '#fbbf24', '#f87171', '#60a5fa', '#a78bfa'];
    const parts = [];
    for (let i = 0; i < 160; i++) {
      parts.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 4,
        size: 6 + Math.random() * 6,
        color: colors[i % colors.length],
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.2,
      });
    }
    let frames = 0;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size * 0.6);
        ctx.restore();
      }
      frames++;
      if (frames < 480) requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    tick();
  },
};

window.addEventListener('DOMContentLoaded', () => App.init());
