import { DISTRICTS } from '../config.js';

// Choix des ambiances de rue, tronçon par tronçon (48 m chacun).
// Règles simples et lisibles :
//   - la ville domine et sépare toujours deux ambiances spéciales ;
//   - un marché ou un quartier dure 2 tronçons, un pont 3 (la lagune se traverse) ;
//   - aucun tronçon spécial n'en suit un autre.
// Les poids de DISTRICTS doivent faire 1 : le pont occupe la fin du tirage.
// Générateur pur (aucune dépendance 3D) : testé dans tests/simulate.mjs.

export const DISTRICT_IDS = ['ville', 'marche', 'quartier', 'pont'];

export function* districtPlan(rand = Math.random) {
  let last = 'ville';
  let queue = [];
  for (;;) {
    let d;
    if (queue.length) {
      d = queue.shift();
    } else if (last !== 'ville') {
      d = 'ville'; // on respire une rue « normale » après un quartier spécial
    } else {
      const r = rand();
      const a = DISTRICTS.villeRun;
      const b = a + DISTRICTS.marche;
      const c = b + DISTRICTS.quartier;
      if (r < a) d = 'ville';
      else if (r < b) { d = 'marche'; queue = repeat('marche', DISTRICTS.specialLength); }
      else if (r < c) { d = 'quartier'; queue = repeat('quartier', DISTRICTS.specialLength); }
      else { d = 'pont'; queue = repeat('pont', DISTRICTS.bridgeLength); }
    }
    last = d;
    yield d;
  }
}

// Les tronçons restants d'une ambiance (le premier est déjà tiré).
function repeat(id, n) {
  return new Array(Math.max(0, n - 1)).fill(id);
}
