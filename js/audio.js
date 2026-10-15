// Little synthesized sound effects (WebAudio, no files). Quiet by design: a playground, not an arcade.

export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.birdT = 3;
  }

  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
        const n = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, n, n);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      } catch { this.ctx = null; }
    }
    this.ctx?.resume?.();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  get ok() {
    return this.ctx && this.ctx.state === 'running' && !this.muted;
  }

  tone(f0, dur, { type = 'sine', vol = 0.2, f1 = f0, at = 0, attack = 0.005 } = {}) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, { f0 = 1000, f1 = f0, q = 1, vol = 0.2, at = 0, type = 'bandpass' } = {}) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime + at;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  jump() { this.tone(300, 0.16, { f1: 560, vol: 0.12 }); }
  land() { this.noise(0.12, { f0: 400, f1: 120, vol: 0.18, type: 'lowpass' }); }
  boing() { this.tone(160, 0.45, { type: 'triangle', f1: 620, vol: 0.2 }); this.tone(240, 0.3, { f1: 500, vol: 0.08, at: 0.05 }); }
  whoosh() { this.noise(1.1, { f0: 500, f1: 2600, q: 0.7, vol: 0.16 }); }
  pole() { this.noise(0.8, { f0: 3000, f1: 1500, q: 4, vol: 0.06 }); }
  plop() { for (let i = 0; i < 6; i++) this.tone(500 + Math.random() * 700, 0.05, { type: 'triangle', vol: 0.05, at: Math.random() * 0.15 }); }
  splash() {
    for (let i = 0; i < 22; i++) this.tone(380 + Math.random() * 1100, 0.06, { type: 'triangle', vol: 0.07, at: Math.random() * 0.45 });
    this.noise(0.4, { f0: 900, f1: 300, vol: 0.12, type: 'lowpass' });
  }
  spin() { this.noise(0.5, { f0: 300, f1: 900, q: 2, vol: 0.06 }); }
  sticker() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.14, at: i * 0.09 })); }
  champion() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.4, { type: 'triangle', vol: 0.14, at: i * 0.12 })); }
  bark() {
    this.tone(520, 0.09, { type: 'sawtooth', f1: 300, vol: 0.06 });
    this.noise(0.09, { f0: 900, f1: 500, q: 2, vol: 0.1 });
    this.tone(560, 0.09, { type: 'sawtooth', f1: 320, vol: 0.06, at: 0.16 });
    this.noise(0.09, { f0: 900, f1: 500, q: 2, vol: 0.1, at: 0.16 });
  }
  chime() { [1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.6, { vol: 0.08, at: i * 0.12 })); }
  flap() { for (let i = 0; i < 5; i++) this.noise(0.06, { f0: 1500, q: 1, vol: 0.05, at: i * 0.07 }); }
  creak() { this.tone(900, 0.25, { type: 'sawtooth', f1: 700, vol: 0.015 }); }
  tag() { this.tone(880, 0.12, { type: 'square', vol: 0.05 }); this.tone(660, 0.18, { type: 'square', vol: 0.05, at: 0.12 }); }
  click() { this.tone(1200, 0.04, { vol: 0.06 }); }

  // Babble: one blip per syllable-ish chunk, pitched around the speaker's voice, with a rise on questions.
  voice(text, base = 400, adult = false) {
    if (!this.ok) return;
    const n = Math.min(14, Math.max(2, Math.round(text.replace(/[^a-z]/gi, '').length / 3.2)));
    const q = text.trim().endsWith('?');
    const ex = text.includes('!');
    const step = adult ? 0.105 : 0.085;
    for (let i = 0; i < n; i++) {
      const rise = q && i > n - 3 ? 1.25 : 1;
      const f = base * (0.85 + Math.random() * 0.35) * rise * (ex ? 1.08 : 1);
      this.tone(f, step * 0.9, { type: adult ? 'triangle' : 'square', f1: f * (0.9 + Math.random() * 0.2), vol: adult ? 0.05 : 0.028, at: i * step + Math.random() * 0.02, attack: 0.01 });
    }
  }

  /** Ambient birdsong now and then. */
  update(dt) {
    this.birdT -= dt;
    if (this.birdT > 0) return;
    this.birdT = 4 + Math.random() * 7;
    const base = 2200 + Math.random() * 1600;
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) this.tone(base * (1 + Math.random() * 0.2), 0.09, { f1: base * 1.35, vol: 0.025, at: i * 0.13 });
  }
}
