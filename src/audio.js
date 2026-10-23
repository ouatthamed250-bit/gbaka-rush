// Sons générés par le navigateur (aucun fichier). À remplacer plus tard par de vrais sons enregistrés
// (moteur, klaxon, voix de l'apprenti) dans public/audio/.

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }
  unlock() {
    if (this.ctx) {
      this.ctx.resume?.();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0;
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 400;
    this.osc = this.ctx.createOscillator();
    this.osc.type = 'sawtooth';
    this.osc.frequency.value = 50;
    this.osc.connect(this.filter);
    this.filter.connect(this.gain);
    this.gain.connect(this.ctx.destination);
    this.osc.start();
  }
  setEnabled(v) {
    this.enabled = v;
    if (!v && this.gain) this.gain.gain.value = 0;
  }
  // speedRatio : 0..1, throttle : 0 ou 1
  update(speedRatio, throttle, playing) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const vol = this.enabled && playing ? 0.035 + 0.05 * throttle : 0;
    this.gain.gain.setTargetAtTime(vol, t, 0.06);
    this.osc.frequency.setTargetAtTime(42 + speedRatio * 95, t, 0.08);
    this.filter.frequency.setTargetAtTime(320 + speedRatio * 650, t, 0.1);
  }
  silence() {
    if (this.ctx) this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  }
  crash() {
    if (!this.ctx || !this.enabled) return;
    const len = Math.floor(this.ctx.sampleRate * 0.28);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.35;
    src.connect(g);
    g.connect(this.ctx.destination);
    src.start();
  }
  honk() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    for (const f of [392, 494]) {
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start(t);
      o.stop(t + 0.3);
    }
  }
}
