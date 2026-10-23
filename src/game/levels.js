// Règles des niveaux (sans 3D, sans navigateur) : objectif, progression, course libre.
// Séparées du rendu pour être vérifiées par `npm test` (voir tests/levels.mjs).
import { LEVELS } from '../config.js';

export const LEVEL_COUNT = LEVELS.length;

// Index valable : -3 -> 0, 99 -> dernier niveau. (Un index de sauvegarde peut valoir LEVEL_COUNT
// quand tous les niveaux sont terminés : c'est « course libre », pas un niveau.)
export function levelIndex(i) {
  const n = Math.trunc(i);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(LEVEL_COUNT - 1, n));
}

// Le niveau à jouer (réglages : densité du trafic, vitesse des autres véhicules).
export const levelAt = (i) => LEVELS[levelIndex(i)];

// Tous les niveaux sont terminés : plus rien à débloquer, on passe en course libre.
export const allDone = (savedLevel) => savedLevel >= LEVEL_COUNT;

// L'objectif du niveau est-il atteint ? (boarded = passagers montés depuis le départ)
export const goalReached = (i, boarded) => boarded >= levelAt(i).goal;

// Index de sauvegarde après avoir réussi le niveau i : on ne recule jamais
// (rejouer un vieux niveau ne fait pas perdre la progression) et on ne dépasse pas la fin.
export function afterWin(savedLevel, i) {
  const saved = Math.max(0, Math.trunc(savedLevel) || 0);
  return Math.min(LEVEL_COUNT, Math.max(saved, levelIndex(i) + 1));
}

// Course libre : commune selon la distance parcourue (m). Le trafic s'épaissit au fil des mètres.
export function communeForDistance(dist) {
  let idx = 0;
  for (let i = 0; i < LEVEL_COUNT; i++) if (dist >= LEVELS[i].from) idx = i;
  return idx;
}

// ---------- Encaissement (utilisé par game.js) ----------
// Ces deux fonctions modifient la sauvegarde (src/save.js) et renvoient de quoi remplir
// l'écran de fin. Elles sont ici pour être testées sans navigateur ni 3D.

// Niveau réussi : argent de la course + prime, kilomètres cumulés, record, niveau suivant débloqué.
export function bankLevelWin(data, i, { earned = 0, distance = 0 } = {}) {
  const level = levelAt(i);
  const wasDone = allDone(data.level);
  data.money += Math.floor(earned) + level.reward;
  data.totalKm += distance / 1000;
  const record = distance > data.bestDistance;
  data.bestDistance = Math.max(data.bestDistance, distance);
  data.level = afterWin(data.level, i);
  return {
    level,
    bonus: level.reward,
    record,
    allDone: allDone(data.level),
    nextName: allDone(data.level) ? null : levelAt(data.level).name,
    freeRunUnlocked: allDone(data.level) && !wasDone,
  };
}

// Course ratée (dégâts à 100 %) ou terminée à la main : pas de prime, rien n'est débloqué.
export function bankRunLoss(data, { earned = 0, distance = 0 } = {}) {
  data.money += Math.floor(earned);
  data.totalKm += distance / 1000;
  const record = distance > data.bestDistance;
  data.bestDistance = Math.max(data.bestDistance, distance);
  return { record };
}
