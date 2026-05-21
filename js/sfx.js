// Web Audio sound effects. No assets — all synthesized.

const SFX = {
  ctx: null,

  _ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return false; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  },

  _tone(freq, duration, type = 'sine', vol = 0.08, startOffset = 0) {
    if (!this._ensure()) return;
    const now = this.ctx.currentTime + startOffset;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  },

  click() { this._tone(600, 0.06, 'square', 0.04); },
  type()  { this._tone(900, 0.03, 'square', 0.025); },

  correct() {
    this._tone(523, 0.12, 'sine', 0.08, 0);
    this._tone(659, 0.12, 'sine', 0.08, 0.08);
    this._tone(784, 0.22, 'sine', 0.09, 0.16);
  },

  wrong() {
    this._tone(220, 0.18, 'sawtooth', 0.06, 0);
    this._tone(160, 0.22, 'sawtooth', 0.06, 0.06);
  },

  plateOn() {
    this._tone(440, 0.08, 'triangle', 0.06, 0);
    this._tone(660, 0.12, 'triangle', 0.06, 0.05);
  },

  gateOpen() {
    this._tone(120, 0.5, 'sawtooth', 0.05, 0);
    this._tone(180, 0.4, 'square', 0.04, 0.1);
    this._tone(300, 0.3, 'sine', 0.07, 0.25);
    this._tone(450, 0.25, 'sine', 0.06, 0.35);
  },

  finish() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => this._tone(n, 0.18, 'sine', 0.09, i * 0.12));
  },

  win() {
    const seq = [523, 659, 784, 1047, 784, 1047, 1318];
    seq.forEach((n, i) => this._tone(n, 0.2, 'sine', 0.1, i * 0.14));
    seq.forEach((n, i) => this._tone(n / 2, 0.2, 'triangle', 0.05, i * 0.14));
  },
};
