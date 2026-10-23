// Commande à UN SEUL DOIGT :
//  - doigt posé = accélère
//  - doigt glissé à gauche/droite = dévie
//  - doigt levé = freine (après un petit délai de grâce)
// Clavier (pour tester sur ordinateur) : Espace/Flèche haut = accélérer, Flèches gauche/droite = dévier.
//
// Solidité : le relâchement est écouté sur window (doigt qui sort du canvas, perte de capture),
// et tout est remis à zéro si l'onglet perd le focus, passe en arrière-plan ou si l'écran tourne.

export const BRAKE_GRACE = 0.2; // secondes avant que le relâchement déclenche le freinage
const MAX_DX = 400; // pixels : limite un glissement aberrant (changement d'écran, bug de focus)

export class Input {
  constructor(el) {
    this.el = el;
    this.pointerDown = false;
    this.pointerId = null;
    this.lastX = 0;
    this.dxPx = 0;
    this.upAt = 0;
    this.keyUp = false;
    this.keyDir = 0;
    this.keys = new Set(); // touches gauche/droite actuellement enfoncées
    this.skipMove = false; // après une rotation / un redimensionnement, on ignore le 1er mouvement
    this.onFirstPress = null;

    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => this._down(e));
    el.addEventListener('lostpointercapture', (e) => this._up(e));
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mouvement et relâchement sur window : si le doigt quitte le canvas, on reçoit quand même
    // l'événement et le gbaka ne reste pas bloqué en accélération.
    window.addEventListener('pointermove', (e) => this._move(e), { passive: true });
    window.addEventListener('pointerup', (e) => this._up(e));
    window.addEventListener('pointercancel', (e) => this._up(e));

    // Perte de focus, changement d'onglet, rotation de l'écran.
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.reset();
    });
    window.addEventListener('orientationchange', () => this._afterResize());
    window.addEventListener('resize', () => this._afterResize());

    window.addEventListener('keydown', (e) => this._key(e, true));
    window.addEventListener('keyup', (e) => this._key(e, false));
  }

  _afterResize() {
    // La position du doigt change de repère : on ne compte pas le premier mouvement.
    this.skipMove = true;
    this.dxPx = 0;
  }

  _down(e) {
    if (!e.isPrimary) return; // un deuxième doigt est ignoré
    if (e.pointerType === 'mouse' && e.button !== 0) return; // clic droit / molette
    if (this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.pointerDown = true;
    this.lastX = e.clientX;
    this.skipMove = false;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* capture indisponible : les écouteurs sur window prennent le relais */
    }
    if (this.onFirstPress) {
      const fn = this.onFirstPress;
      this.onFirstPress = null;
      fn();
    }
  }

  _move(e) {
    if (e.pointerId !== this.pointerId) return;
    if (this.skipMove) {
      this.skipMove = false;
      this.lastX = e.clientX;
      return;
    }
    this.dxPx += e.clientX - this.lastX;
    this.lastX = e.clientX;
    this.dxPx = Math.max(-MAX_DX, Math.min(MAX_DX, this.dxPx));
  }

  _up(e) {
    if (e.pointerId !== this.pointerId) return;
    try {
      this.el.releasePointerCapture(e.pointerId);
    } catch {
      /* la capture est peut-être déjà perdue */
    }
    this.pointerId = null;
    this.pointerDown = false;
    this.upAt = performance.now() / 1000;
  }

  _key(e, isDown) {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      if (this.keyUp && !isDown) this.upAt = performance.now() / 1000;
      this.keyUp = isDown;
      e.preventDefault();
      return;
    }
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      if (isDown) this.keys.add(e.code);
      else this.keys.delete(e.code);
      // Les deux flèches peuvent être enfoncées en même temps : on regarde l'ensemble.
      this.keyDir = (this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('ArrowLeft') ? 1 : 0);
      e.preventDefault();
    }
  }

  reset() {
    this.pointerDown = false;
    this.pointerId = null;
    this.dxPx = 0;
    this.keyUp = false;
    this.keyDir = 0;
    this.keys.clear();
    this.skipMove = true;
    this.upAt = performance.now() / 1000;
  }
  isDown() {
    return this.pointerDown || this.keyUp;
  }
  // Vrai quand le joueur a levé le doigt depuis plus de BRAKE_GRACE secondes.
  brakeActive() {
    return !this.isDown() && performance.now() / 1000 - this.upAt > BRAKE_GRACE;
  }
  // Déplacement horizontal (en pixels) accumulé depuis le dernier appel.
  consumeDx(dt) {
    const v = this.dxPx + this.keyDir * dt * 420;
    this.dxPx = 0;
    return Math.max(-MAX_DX, Math.min(MAX_DX, v));
  }
}
