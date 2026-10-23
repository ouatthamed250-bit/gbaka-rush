// Règles pures du jeu (sans 3D, sans navigateur) : collisions et placement du trafic.
// Elles sont séparées du rendu pour pouvoir être vérifiées par `npm test` (voir tests/simulate.mjs).
import { ROAD, VEHICLE, TRAFFIC, COLLISION } from '../config.js';

// Numéro de voie à partir de la position x : -1 = gauche, 0 = milieu, +1 = droite.
// (Ne jamais utiliser l'indice du tableau LANES ici : c'est 0/1/2, pas -1/0/+1.)
export const laneOf = (x) => Math.round(x / ROAD.laneWidth);

// Deux boîtes (largeur w, longueur l) se touchent-elles ?
// marginX / marginZ : tolérance en mètres (on pardonne un peu au joueur).
export function boxesOverlap(ax, az, aw, al, bx, bz, bw, bl, marginX = 0, marginZ = 0) {
  return (
    Math.abs(ax - bx) < (aw + bw) / 2 - marginX &&
    Math.abs(az - bz) < (al + bl) / 2 - marginZ
  );
}

// Le gbaka du joueur touche-t-il cette voiture ?
// (mêmes calculs que l'ancien code, maintenant testables)
export function carHitsPlayer(px, pz, car) {
  return boxesOverlap(
    px, pz, VEHICLE.width, VEHICLE.length,
    car.x, car.z, car.w, car.l,
    COLLISION.graceX, COLLISION.graceZ,
  );
}

// Voies occupées par au moins une voiture active dans une fenêtre autour de z.
// Sert à la règle de sécurité : il doit toujours rester une voie libre.
export function occupiedLanes(cars, z, windowM = TRAFFIC.clearWindow) {
  const lanes = new Set();
  for (const c of cars) {
    if (!c.active) continue;
    if (Math.abs(c.z - z) <= windowM) lanes.add(laneOf(c.x));
  }
  return lanes;
}

// Peut-on poser un véhicule à cette position (x, z) ?
// - jamais collé à un véhicule de la même voie ;
// - on ne remplit jamais les 3 voies en même temps (une voie reste libre).
// On reçoit x (et non un indice) pour que le numéro de voie soit toujours calculé
// de la même façon que dans occupiedLanes() : c'est ce qui garantit la cohérence.
export function carCanSpawn(cars, x, z) {
  const laneIdx = laneOf(x);
  for (const c of cars) {
    if (!c.active) continue;
    if (laneOf(c.x) === laneIdx && Math.abs(c.z - z) < TRAFFIC.minGap) return false;
  }
  const lanes = occupiedLanes(cars, z);
  // Jamais 3 voies bouchées : on refuse aussi une zone déjà saturée (les voitures roulent,
  // une zone peut se retrouver à 3 voies occupées entre deux apparitions).
  if (lanes.size >= 3) return false;
  if (lanes.size >= 2 && !lanes.has(laneIdx)) return false;
  return true;
}
