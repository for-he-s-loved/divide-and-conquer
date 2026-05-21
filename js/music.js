// Web Audio chiptune background music. 3 tracks, one per round.
// Built from arpeggiated melodies + a bassline, scheduled in lookahead loops.

const Music = {
  ctx: null,
  master: null,
  enabled: false,
  muted: false,
  currentTrack: null,
  _timer: null,
  _nextNoteTime: 0,
  _step: 0,
  _trackIdx: 0,

  // Tracks: { tempo (bpm of 16ths), melody: [midi|null], bass: [midi|null], pattern length = 16 }
  tracks: [
    // Round 1 — mellow chiptune, A minor
    {
      tempo: 360, // 16th-notes per minute
      melody: [69, null, 72, null, 76, null, 72, 74, 76, null, 72, null, 69, null, 67, null],
      bass:   [45, null, null, null, 52, null, null, null, 48, null, null, null, 50, null, null, null],
      melodyType: 'triangle',
      bassType: 'square',
    },
    // Round 2 — tense, D minor descending
    {
      tempo: 420,
      melody: [74, 77, 81, 77, 74, 77, 81, 84, 82, 79, 77, 74, 77, 74, 72, 70],
      bass:   [38, null, 38, null, 41, null, 41, null, 43, null, 43, null, 36, null, 36, null],
      melodyType: 'square',
      bassType: 'sawtooth',
    },
    // Round 3 — fast, urgent, E minor
    {
      tempo: 520,
      melody: [76, 79, 83, 79, 76, 79, 83, 86, 88, 86, 83, 79, 76, 79, 76, 74],
      bass:   [40, 40, 47, 47, 43, 43, 38, 38, 40, 40, 47, 47, 45, 45, 43, 43],
      melodyType: 'square',
      bassType: 'sawtooth',
    },
  ],

  _ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.12;
        this.master.connect(this.ctx.destination);
      } catch (e) { return false; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  },

  enable() {
    if (!this._ensure()) return;
    this.enabled = true;
    this.muted = false;
    this.master.gain.setTargetAtTime(0.12, this.ctx.currentTime, 0.05);
    if (this.currentTrack === null) this.playTrack(this._trackIdx);
  },

  toggleMute() {
    if (!this.ctx) { this.enable(); return; }
    this.muted = !this.muted;
    const target = this.muted ? 0.0001 : 0.12;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  },

  playTrack(idx) {
    if (!this._ensure()) return;
    this._trackIdx = idx;
    this.currentTrack = this.tracks[idx % this.tracks.length];
    this._step = 0;
    this._nextNoteTime = this.ctx.currentTime + 0.06;
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => this._scheduler(), 30);
  },

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this.currentTrack = null;
  },

  _scheduler() {
    if (!this.currentTrack) return;
    const t = this.currentTrack;
    const stepDur = 60 / t.tempo;
    const lookahead = this.ctx.currentTime + 0.15;
    while (this._nextNoteTime < lookahead) {
      const i = this._step % t.melody.length;
      const mel = t.melody[i];
      const bas = t.bass[i];
      if (mel != null) this._note(this._midiToHz(mel), this._nextNoteTime, stepDur * 0.9, t.melodyType, 0.18);
      if (bas != null) this._note(this._midiToHz(bas), this._nextNoteTime, stepDur * 1.8, t.bassType, 0.22);
      this._step++;
      this._nextNoteTime += stepDur;
    }
  },

  _note(freq, when, duration, type, vol) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(vol, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain).connect(this.master);
    osc.start(when);
    osc.stop(when + duration + 0.05);
  },

  _midiToHz(m) { return 440 * Math.pow(2, (m - 69) / 12); },

  // Stinger when a key is picked up
  keyJingle() {
    if (!this._ensure()) return;
    const notes = [880, 1175, 1568];
    notes.forEach((n, i) => {
      const t = this.ctx.currentTime + i * 0.08;
      this._note(n, t, 0.18, 'triangle', 0.25);
    });
  },
};
