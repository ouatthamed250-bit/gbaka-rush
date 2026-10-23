// Sauvegarde locale (localStorage). Rien n'est envoyé sur internet.
const KEY = 'gbakaRush.v1';

const DEFAULTS = {
  money: 0,
  bestDistance: 0, // mètres
  totalKm: 0,
  // Niveau à jouer (0 = premier). Quand il vaut le nombre de niveaux, tout est terminé
  // et « Jouer » lance la course libre. Voir src/game/levels.js.
  level: 0,
  skin: 'maestro',
  upgrades: { speed: 0, accel: 0, brake: 0, capacity: 0 },
  sound: true,
  quality: 'normal', // 'eco' | 'normal'
  tutorialDone: false,
};

export class Save {
  constructor() {
    this.data = structuredClone(DEFAULTS);
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = { ...this.data, ...parsed, upgrades: { ...this.data.upgrades, ...(parsed.upgrades || {}) } };
      }
    } catch {
      /* stockage indisponible : on joue sans sauvegarde */
    }
  }
  write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* ignore */
    }
  }
  reset() {
    this.data = structuredClone(DEFAULTS);
    this.write();
  }
}
