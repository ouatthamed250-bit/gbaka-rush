import { PERF } from './config.js';

// Compteur d'images par seconde (visible seulement avec ?debug dans l'adresse)
// et surveillance de la fluidité : si l'on reste sous 30 i/s pendant 3 s,
// on prévient le jeu pour qu'il passe en qualité « éco ».
export class FpsMeter {
  constructor({ debug = false, onLow = null } = {}) {
    this.debug = debug;
    this.onLow = onLow;
    this.el = debug ? document.getElementById('fps') : null;
    if (this.el) this.el.classList.remove('hidden');
    this.reset();
  }

  reset() {
    this.fps = 0;
    this.frames = 0;
    this.window = 0;
    this.elapsed = 0;
    this.lowTime = 0;
    this.done = false;
    this.lastText = '';
  }

  // dt en secondes. extra : texte ajouté au compteur (qualité, nombre de véhicules).
  frame(dt, extra = '') {
    dt = Math.min(0.5, dt);
    this.elapsed += dt;
    this.frames++;
    this.window += dt;

    if (this.window >= PERF.sampleSec) {
      this.fps = Math.round(this.frames / this.window);
      this.frames = 0;
      this.window = 0;
      if (this.el) {
        const txt = `FPS ${this.fps}${extra ? ` · ${extra}` : ''}`;
        if (txt !== this.lastText) {
          this.el.textContent = txt;
          this.lastText = txt;
        }
      }
    }

    // On ignore le tout début (chargement) et on ne déclenche qu'une seule fois.
    if (this.elapsed < PERF.warmupSec || this.done) return;
    if (this.fps > 0 && this.fps < PERF.lowFps) this.lowTime += dt;
    else this.lowTime = 0;

    if (this.lowTime >= PERF.lowForSec) {
      this.done = true;
      this.onLow?.();
    }
  }
}
