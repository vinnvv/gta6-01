// Synthesized sound: every effect and the music loop are built with WebAudio,
// so the game ships no audio files and loads nothing from the network.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = null;
    this.engineNodes = null;
    this.sirenNodes = null;
    this.step = 0;
  }

  // Must be called from a user gesture at least once.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.startMusic();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  // Short blip for UI actions.
  blip(freq = 660, dur = 0.07, type = 'square', vol = 0.12) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur);
  }

  // Noise burst: gunshots, impacts, explosions.
  noise(dur = 0.15, vol = 0.3, lowpass = 1200) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(t);
  }

  gunshot() { this.noise(0.14, 0.35, 900); this.blip(90, 0.12, 'sine', 0.25); }
  punch() { this.noise(0.08, 0.2, 500); }
  pickup() { this.blip(880, 0.08); this.blip(1320, 0.1); }
  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.16, 'triangle', 0.2), i * 110);
    });
  }
  busted() { [330, 262, 196].forEach((f, i) => setTimeout(() => this.blip(f, 0.25, 'sawtooth', 0.15), i * 180)); }

  // Continuous engine hum; call every frame with speed 0..1.
  engine(speed, on) {
    if (!this.ctx) return;
    if (!on) {
      if (this.engineNodes) {
        this.engineNodes.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        this.engineNodes = null;
      }
      return;
    }
    if (!this.engineNodes) {
      const o1 = this.ctx.createOscillator(); o1.type = 'sawtooth';
      const o2 = this.ctx.createOscillator(); o2.type = 'square';
      const g = this.ctx.createGain(); g.gain.value = 0;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
      o1.start(); o2.start();
      this.engineNodes = { o1, o2, gain: g };
    }
    const n = this.engineNodes;
    const freq = 55 + speed * 140;
    n.o1.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
    n.o2.frequency.setTargetAtTime(freq * 0.5, this.ctx.currentTime, 0.05);
    n.gain.gain.setTargetAtTime(0.05 + speed * 0.06, this.ctx.currentTime, 0.1);
  }

  // Two-tone police siren while any police unit is close.
  siren(on) {
    if (!this.ctx) return;
    if (!on) {
      if (this.sirenNodes) {
        this.sirenNodes.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
        this.sirenNodes = null;
      }
      return;
    }
    if (!this.sirenNodes) {
      const o = this.ctx.createOscillator(); o.type = 'sine';
      const g = this.ctx.createGain(); g.gain.value = 0.04;
      o.connect(g); g.connect(this.master);
      o.start();
      this.sirenNodes = { o, gain: g, t: 0 };
    }
    const n = this.sirenNodes;
    n.t += 1 / 60;
    n.o.frequency.value = (Math.floor(n.t * 1.4) % 2 === 0) ? 720 : 540;
  }

  // A lazy bassline plus hats, scheduled a bar at a time.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bassNotes = [55, 55, 65.4, 49, 55, 55, 73.4, 82.4];
    const bar = 1.9;
    const playBar = () => {
      if (this.muted) return;
      const t0 = this.ctx.currentTime + 0.05;
      const note = bassNotes[this.step % bassNotes.length];
      this.step++;
      const o = this.ctx.createOscillator(); o.type = 'triangle';
      o.frequency.value = note;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + bar * 0.9);
      o.connect(g); g.connect(this.master);
      o.start(t0); o.stop(t0 + bar);
      for (let h = 0; h < 4; h++) {
        const ht = t0 + (h + 0.5) * (bar / 4);
        const len = Math.floor(this.ctx.sampleRate * 0.03);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.4;
        const src = this.ctx.createBufferSource(); src.buffer = buf;
        const hg = this.ctx.createGain(); hg.gain.value = 0.05;
        src.connect(hg); hg.connect(this.master);
        src.start(ht);
      }
    };
    playBar();
    this.musicTimer = setInterval(playBar, bar * 1000);
  }
}
