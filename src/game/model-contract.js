// Contrat du fichier 3D `public/models/gbaka.glb` (voir docs/ASSETS.md).
// Ce module ne dépend d'aucune bibliothèque 3D : il est donc testable avec `npm test`,
// et `gbaka.js` l'utilise pour retrouver les objets du modèle chargé.

export const MODEL_NAMES = {
  body: 'body',
  door: 'door_side',
  exhaust: 'exhaust',
  wheels: ['wheel_FL', 'wheel_FR', 'wheel_RL', 'wheel_RR'],
  skinRear: 'skin_rear',
  skinSideLeft: 'skin_side_L',
  skinSideRight: 'skin_side_R',
};

// Nom comparable : minuscules, sans le suffixe « .001 » que Blender ajoute aux doublons,
// et sans séparateurs. Ainsi « Wheel_FL », « wheel FL » et « wheel_FL.001 » se valent.
export function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\.\d+$/, '')
    .replace(/[^a-z0-9]/g, '');
}

// Table nom → rôle, construite une fois.
const ROLES = new Map();
for (const [role, name] of Object.entries({
  body: MODEL_NAMES.body,
  door: MODEL_NAMES.door,
  exhaust: MODEL_NAMES.exhaust,
  skinRear: MODEL_NAMES.skinRear,
  skinSideLeft: MODEL_NAMES.skinSideLeft,
  skinSideRight: MODEL_NAMES.skinSideRight,
})) {
  ROLES.set(normalizeName(name), role);
}
for (const name of MODEL_NAMES.wheels) ROLES.set(normalizeName(name), `wheel:${name}`);

// Parcourt tout l'arbre (objet three ou simple { name, children }) et range le premier
// objet trouvé pour chaque rôle. Un seul parcours, quel que soit le nombre de noms cherchés.
export function indexParts(root) {
  const found = new Map();
  const walk = (o) => {
    if (!o) return;
    const role = ROLES.get(normalizeName(o.name));
    if (role && !found.has(role)) found.set(role, o);
    for (const c of o.children || []) walk(c);
  };
  walk(root);
  return found;
}

// Ce que le jeu a trouvé dans le fichier, et ce qui manque.
// `usable` : le modèle peut remplacer le gbaka en boîtes (il faut au minimum la caisse).
// Un modèle sans roues reste jouable : on le signale dans `missing` mais on l'accepte.
export function inspectModel(root) {
  const parts = indexParts(root);
  const wheels = MODEL_NAMES.wheels.map((n) => parts.get(`wheel:${n}`) || null);
  const missing = [];
  if (!parts.get('body')) missing.push(MODEL_NAMES.body);
  MODEL_NAMES.wheels.forEach((n, i) => {
    if (!wheels[i]) missing.push(n);
  });
  if (!parts.get('door')) missing.push(MODEL_NAMES.door);
  if (!parts.get('exhaust')) missing.push(MODEL_NAMES.exhaust);
  return {
    body: parts.get('body') || null,
    door: parts.get('door') || null,
    exhaust: parts.get('exhaust') || null,
    wheels,
    wheelCount: wheels.filter(Boolean).length,
    skinRear: parts.get('skinRear') || null,
    skinSideLeft: parts.get('skinSideLeft') || null,
    skinSideRight: parts.get('skinSideRight') || null,
    missing,
    usable: !!parts.get('body'),
  };
}

// Placement d'un panneau de peinture quand le fichier 3D n'en fournit pas.
// box : { min: {x,y,z}, max: {x,y,z} } (compatible THREE.Box3), en mètres.
// kind : 'rear' | 'sideRight' | 'sideLeft'. frac : voir DECAL dans src/config.js
// (fractions de la taille du gbaka : 0 = bas / avant, 1 = haut / arrière).
// Renvoie { pos: [x,y,z], size: [largeur, hauteur], rotY }.
export function decalLayout(box, kind, frac) {
  const sx = box.max.x - box.min.x;
  const sy = box.max.y - box.min.y;
  const sz = box.max.z - box.min.z;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const gap = frac.gap ?? 0.02;
  if (kind === 'rear') {
    return {
      pos: [cx, box.min.y + sy * frac.y, box.max.z + gap],
      size: [sx * frac.w, sy * frac.h],
      rotY: 0,
    };
  }
  const side = kind === 'sideLeft' ? -1 : 1;
  return {
    pos: [(side > 0 ? box.max.x : box.min.x) + side * gap, box.min.y + sy * frac.y, cz + sz * frac.z],
    size: [sz * frac.l, sy * frac.h],
    rotY: (side * Math.PI) / 2,
  };
}
