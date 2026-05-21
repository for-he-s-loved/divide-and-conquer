// WebRTC voice chat between the two peers using PeerJS's call API.
// Mic is opt-in (click the button) and protocol-coordinated so the call only
// initiates once BOTH sides have their streams ready.

const Voice = {
  localStream: null,
  remoteAudio: null,
  call: null,
  myReady: false,
  partnerReady: false,
  muted: false,
  audioCtx: null,
  _lastSentSpeaking: false,
  _lastSpeakChange: 0,

  async enable() {
    if (this.localStream) return true;
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
    } catch (e) {
      App.chatSystem('🎤 Microphone access denied or unavailable.');
      return false;
    }
    this.myReady = true;
    this.muted = false;
    this.localStream.getAudioTracks().forEach(t => t.enabled = true);
    App.updateMicButton();
    Net.send({ type: 'voice-ready' });
    this._tryConnect();
    this._monitorLocal();
    App.chatSystem('🎤 Voice chat enabled.');
    return true;
  },

  onPartnerReady() {
    this.partnerReady = true;
    App.chatSystem('🎤 Partner enabled voice.');
    this._tryConnect();
  },

  hostListenForCalls() {
    if (!Net.peer || this._listening) return;
    this._listening = true;
    Net.peer.on('call', (call) => {
      if (!this.localStream) {
        this._pendingCall = call;
        return;
      }
      call.answer(this.localStream);
      this._handleCall(call);
    });
  },

  _tryConnect() {
    if (!this.myReady || !this.partnerReady || this.call) return;

    if (Net.isHost) {
      if (this._pendingCall) {
        this._pendingCall.answer(this.localStream);
        this._handleCall(this._pendingCall);
        this._pendingCall = null;
      }
      // otherwise wait for incoming call
    } else {
      const hostId = Net._prefix + Net.roomCode;
      const call = Net.peer.call(hostId, this.localStream);
      this._handleCall(call);
    }
  },

  _handleCall(call) {
    this.call = call;
    call.on('stream', (remote) => this._playRemote(remote));
    call.on('close', () => {
      this.call = null;
      this.partnerReady = false;
    });
    call.on('error', () => {});
  },

  _playRemote(stream) {
    if (!this.remoteAudio) {
      this.remoteAudio = document.createElement('audio');
      this.remoteAudio.autoplay = true;
      this.remoteAudio.playsInline = true;
      this.remoteAudio.style.display = 'none';
      document.body.appendChild(this.remoteAudio);
    }
    this.remoteAudio.srcObject = stream;
    this.remoteAudio.play().catch(() => {});
    this._monitorRemote(stream);
  },

  _monitorLocal() {
    if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    const source = this.audioCtx.createMediaStreamSource(this.localStream);
    const analyser = this.audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(buf);
      let sum = 0;
      for (let v of buf) sum += v;
      const avg = sum / buf.length;
      const speaking = !this.muted && avg > 14;
      const now = performance.now();
      if (speaking !== this._lastSentSpeaking && now - this._lastSpeakChange > 180) {
        this._lastSentSpeaking = speaking;
        this._lastSpeakChange = now;
        Net.send({ type: 'speaking', on: speaking });
        if (window.Game) Game.setSpeaking(Net.playerId, speaking);
      }
      requestAnimationFrame(tick);
    };
    tick();
  },

  _monitorRemote(stream) {
    if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = this.audioCtx.createMediaStreamSource(stream);
    const analyser = this.audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    let lastState = false;
    const tick = () => {
      analyser.getByteFrequencyData(buf);
      let sum = 0;
      for (let v of buf) sum += v;
      const avg = sum / buf.length;
      const speaking = avg > 14;
      if (speaking !== lastState) {
        lastState = speaking;
        const partnerId = Net.playerId === 1 ? 2 : 1;
        if (window.Game) Game.setSpeaking(partnerId, speaking);
      }
      requestAnimationFrame(tick);
    };
    tick();
  },

  toggleMute() {
    if (!this.localStream) return this.enable();
    this.muted = !this.muted;
    this.localStream.getAudioTracks().forEach(t => t.enabled = !this.muted);
    App.updateMicButton();
  },
};
