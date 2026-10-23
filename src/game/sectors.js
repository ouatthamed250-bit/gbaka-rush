import { SECTORS, LEVELS, APPRENTI_CRIS, APPRENTI_CRIS_ARRET } from '../config.js';

// Règles des secteurs d'Abidjan, sans 3D ni navigateur (testées dans tests/sectors.mjs).
// Un secteur = une commune = un niveau. L'apprenti n'appelle que les quartiers du secteur
// joué : c'est ce qui évite le mélange « Yopougon / Adjamé » dans une même course.

export const SECTOR_COUNT = SECTORS.length;

// Secteur par index, tolérant aux valeurs hors limites (une sauvegarde peut valoir 99).
export function sectorAt(i) {
  const n = Math.trunc(i);
  if (!Number.isFinite(n)) return SECTORS[0];
  return SECTORS[Math.max(0, Math.min(SECTOR_COUNT - 1, n))];
}

// Secteur du niveau i (c'est LEVELS[i].sector qui fait foi).
export function sectorOfLevel(i) {
  const n = Math.trunc(i);
  const idx = Number.isFinite(n) ? Math.max(0, Math.min(LEVELS.length - 1, n)) : 0;
  return sectorAt(LEVELS[idx].sector ?? idx);
}

// Quartier de l'arrêt n° `stopIndex` : on fait le tour des quartiers du secteur, dans l'ordre.
export function quartierAt(sector, stopIndex) {
  const list = sector?.quartiers ?? [];
  if (!list.length) return '';
  const n = Math.trunc(stopIndex) || 0;
  return list[((n % list.length) + list.length) % list.length];
}

// Cris disponibles : ceux du secteur, plus l'appel du quartier d'arrivée.
// Aucun nom d'un autre secteur ne peut donc sortir de la bouche de l'apprenti.
export function criesFor(sector, quartier = '') {
  const base = sector?.cries?.length ? [...sector.cries] : [...APPRENTI_CRIS];
  if (quartier) base.push(APPRENTI_CRIS_ARRET(quartier));
  return base;
}

// Tirage d'un cri, sans répéter le précédent (les listes courtes tournent donc toutes).
export function pickCry(list, lastIndex = -1, rand = Math.random) {
  if (!list?.length) return { text: '', index: -1 };
  let i = Math.floor(rand() * list.length);
  if (list.length > 1 && i === lastIndex) i = (i + 1) % list.length;
  return { text: list[i], index: i };
}

// Libellé d'un arrêt (« Arrêt Niangon »), vide si le secteur n'a pas de quartier.
export const stopLabel = (quartier) => (quartier ? `Arrêt ${quartier}` : 'Arrêt');

// Libellé du lieu affiché dans le HUD : « Yopougon · Niangon ».
export const placeLabel = (sector, quartier) =>
  quartier ? `${sector?.name ?? ''} · ${quartier}` : (sector?.name ?? '');

// Somme des ambiances d'un secteur : doit valoir 1 (vérifié par les tests).
export function mixTotal(sector) {
  const m = sector?.mix ?? {};
  return (m.ville ?? 0) + (m.marche ?? 0) + (m.quartier ?? 0) + (m.pont ?? 0);
}

// Conversion vers la forme attendue par districtPlan (src/game/districts.js), qui garde
// les noms de DISTRICTS (villeRun, marche...) et les longueurs d'ambiance globales.
export function districtMix(sector, districts) {
  const m = sector?.mix ?? {};
  return {
    villeRun: m.ville ?? 1,
    marche: m.marche ?? 0,
    quartier: m.quartier ?? 0,
    pont: m.pont ?? 0,
    specialLength: districts.specialLength,
    bridgeLength: districts.bridgeLength,
  };
}
