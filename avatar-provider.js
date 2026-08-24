(() => {
  const configKey = 'expression-trainer.avatar-provider.v1';
  const defaults = { provider: 'mock', serverUrl: 'http://127.0.0.1:8010', avatarId: '' };

  function loadConfig() {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(configKey)) }; } catch (_) { return { ...defaults }; }
  }
  function saveConfig(config) { localStorage.setItem(configKey, JSON.stringify({ ...defaults, ...config })); }

  class BrowserDemoProvider {
    constructor(config = {}) { this.config = config; this.tiles = []; this.voices = []; }
    async connect(tiles) {
      this.tiles = tiles;
      this.voices = window.speechSynthesis?.getVoices?.().filter(voice => voice.lang.startsWith('zh')) || [];
      tiles.forEach(tile => { tile.dataset.avatarState = 'demo'; setState(tile, '浏览器演示'); });
      return { connected: tiles.length, fallback: 0 };
    }
    async speak(index, text) {
      const tile = this.tiles[index % this.tiles.length];
      if (!tile) return;
      animate(tile, text.length);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN'; utterance.rate = 1.08;
        if (this.voices.length) utterance.voice = this.voices[index % this.voices.length];
        window.speechSynthesis.speak(utterance);
      }
    }
    async interrupt() { window.speechSynthesis?.cancel?.(); }
    async disconnect() { await this.interrupt(); this.tiles = []; }
  }

  class LiveTalkingProvider {
    constructor(config = {}) {
      this.config = { ...defaults, ...config };
      this.connections = [];
      this.pending = [];
      this.fallback = new BrowserDemoProvider(config);
      this.tiles = [];
    }
    async connect(tiles) {
      this.tiles = tiles;
      await this.fallback.connect(tiles);
      const results = await Promise.allSettled(tiles.map((tile, index) => this.connectOne(tile, index)));
      results.forEach((item, index) => { if (item.status === 'rejected') this.pending[index]?.close(); });
      this.pending = [];
      const connected = results.filter(item => item.status === 'fulfilled').length;
      return { connected, fallback: tiles.length - connected };
    }
    async connectOne(tile, index) {
      const pc = new RTCPeerConnection({ sdpSemantics: 'unified-plan' });
      this.pending[index] = pc;
      const streamVideo = ensureMedia(tile, 'video');
      const streamAudio = ensureMedia(tile, 'audio');
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });
      pc.addEventListener('track', event => {
        if (event.track.kind === 'video') streamVideo.srcObject = event.streams[0];
        if (event.track.kind === 'audio') streamAudio.srcObject = event.streams[0];
      });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIce(pc);
      const avatarIds = String(this.config.avatarId || '').split(',').map(value => value.trim()).filter(Boolean);
      const selectedAvatar = avatarIds[index] || avatarIds[0];
      const response = await fetch(`${cleanUrl(this.config.serverUrl)}/offer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sdp: pc.localDescription.sdp, type: pc.localDescription.type, avatar: selectedAvatar || undefined })
      });
      if (!response.ok) throw new Error(`LiveTalking /offer ${response.status}`);
      const answer = await response.json();
      if (!answer.sdp || !answer.sessionid) throw new Error(answer.msg || 'LiveTalking 未返回会话');
      await pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp });
      this.connections[index] = { pc, sessionid: String(answer.sessionid), tile };
      tile.dataset.avatarState = 'live';
      setState(tile, 'LiveTalking 已连接');
      return answer.sessionid;
    }
    async speak(index, text) {
      const connection = this.connections[index % Math.max(this.tiles.length, 1)];
      if (!connection) return this.fallback.speak(index, text);
      animate(connection.tile, text.length);
      try {
        const response = await fetch(`${cleanUrl(this.config.serverUrl)}/human`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionid: connection.sessionid, text, type: 'echo', interrupt: true })
        });
        if (!response.ok) throw new Error(`LiveTalking /human ${response.status}`);
      } catch (_) { return this.fallback.speak(index, text); }
    }
    async interrupt() {
      await Promise.allSettled(this.connections.filter(Boolean).map(connection => fetch(`${cleanUrl(this.config.serverUrl)}/interrupt_talk`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionid: connection.sessionid })
      })));
      await this.fallback.interrupt();
    }
    async disconnect() {
      await this.interrupt();
      this.connections.filter(Boolean).forEach(connection => connection.pc.close());
      this.pending.filter(Boolean).forEach(pc => pc.close());
      this.connections = [];
      this.pending = [];
      await this.fallback.disconnect();
    }
  }

  function cleanUrl(value) { return String(value || defaults.serverUrl).replace(/\/$/, ''); }
  function waitForIce(pc) {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise(resolve => {
      const check = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', check); resolve(); } };
      pc.addEventListener('icegatheringstatechange', check);
      setTimeout(() => { pc.removeEventListener('icegatheringstatechange', check); resolve(); }, 5000);
    });
  }
  function ensureMedia(tile, type) {
    let node = tile.querySelector(`.avatar-${type}`);
    if (!node) {
      node = document.createElement(type); node.className = `avatar-${type}`; node.autoplay = true; node.playsInline = true;
      if (type === 'audio') node.hidden = true;
      tile.prepend(node);
    }
    return node;
  }
  function setState(tile, text) {
    const node = tile.querySelector('.avatar-provider-state'); if (node) node.textContent = text;
  }
  function animate(tile, length) {
    tile.classList.add('speaking');
    setTimeout(() => tile.classList.remove('speaking'), Math.min(6500, Math.max(1800, length * 95)));
  }
  function create(config = loadConfig()) { return config.provider === 'live' ? new LiveTalkingProvider(config) : new BrowserDemoProvider(config); }

  window.CreatorAvatarProvider = { defaults, loadConfig, saveConfig, create };
  if (typeof window.dispatchEvent === 'function') window.dispatchEvent(new CustomEvent('creator:avatar-provider-ready'));
})();
