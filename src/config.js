// Tous les réglages du jeu sont ici. Pour équilibrer le jeu, modifie ce fichier en premier.

export const PALETTE = {
  lagune: '#00A8E8',
  laterite: '#FF7A00',
  taxi: '#FFD140',
  ocean: '#0D2B6B',
  nature: '#16A34A',
  route: '#2D2D2D',
};

// 1 unité 3D = 1 mètre.
export const ROAD = {
  laneWidth: 3.6, // 3 voies : x = -3.6, 0, 3.6
  asphaltWidth: 14,
  playerLimit: 6.0, // le gbaka peut rouler sur l'accotement
  chunkLength: 48,
  chunks: 6,
};

export const VEHICLE = { length: 6.2, width: 2.1 };

// Vrai modèle 3D du gbaka (voir docs/ASSETS.md pour les noms d'objets exigés).
// Dépose simplement le fichier : s'il est absent, le jeu utilise le gbaka en boîtes.
export const GBAKA = {
  model: '/models/gbaka.glb',
  yaw: 0, // correction en radians si l'avant du fichier n'est pas vers -Z
  scale: 1, // correction fine de la taille (1 = taille du fichier)
  flatShading: true, // facettes visibles = style low-poly
  wheelRadius: 0.42, // m, utilisé si la taille des roues du fichier n'est pas mesurable
};

// Placement des peintures quand le fichier 3D ne fournit pas de panneau dédié.
// Fractions de la taille du gbaka (0 = bas / avant, 1 = haut / arrière).
export const DECAL = {
  rear: { w: 0.83, h: 0.7, y: 0.64, gap: 0.005 },
  side: { l: 0.36, h: 0.22, y: 0.3, z: 0.04, gap: 0.02 },
};


// Fluidité : compteur d'images (?debug dans l'adresse) et passage automatique en qualité « éco ».
export const PERF = {
  lowFps: 30, // en dessous de ce nombre d'images par seconde...
  lowForSec: 3, // ...pendant ce temps (secondes), on passe tout seul en qualité éco
  warmupSec: 2, // on ignore le début de la course (chargement, premiers modèles)
  sampleSec: 0.5, // le compteur se met à jour à cette fréquence
};

// Trafic : nombre de véhicules créés, et combien restent actifs en qualité éco.
export const TRAFFIC = {
  count: 14, // véhicules disponibles dans la réserve
  ecoCount: 8, // plafond en qualité éco (téléphone lent)
  minGap: 24, // m : jamais deux véhicules plus proches que ça dans la même voie
  clearWindow: 30, // m : fenêtre utilisée pour garder toujours une voie libre
};

// ---------- Quartiers (étape C) ----------
// Chaque tronçon de rue (48 m) reçoit une ambiance : ville, marché, quartier d'habitation,
// ou pont au-dessus de la lagune. Le tirage vit dans src/game/districts.js et se teste
// sans navigateur (npm test).
export const DISTRICTS = {
  // Tirage quand on est déjà en ville : les quatre poids doivent faire exactement 1
  // (vérifié par npm test). Parts obtenues sur la route : ~57 % de ville, ~17 % de marché,
  // ~17 % de quartier et ~9 % de pont.
  villeRun: 0.65,
  marche: 0.15,
  quartier: 0.15,
  pont: 0.05,
  // Longueur des ambiances, en tronçons de 48 m.
  specialLength: 2, // marché / quartier : 2 tronçons = 96 m
  bridgeLength: 3, // pont : 3 tronçons = 144 m au-dessus de l'eau
  // Message affiché à l'écran en entrant dans un quartier (pas de message pour la ville).
  labels: {
    marche: 'Marché de rue',
    quartier: 'Quartier',
    pont: 'Pont sur la lagune',
  },
};

// Tolérance des collisions (m) : on pardonne un peu pour éviter les chocs « injustes ».
export const COLLISION = { graceX: 0.1, graceZ: 0.4 };

// Arrêt de gbaka : des passagers montent / descendent tous les X mètres (valeurs à tester).
export const CHECKPOINT_FIRST = 150;
export const CHECKPOINT_EVERY = 400;
// Gain en FCFA par mètre et par passager (valeur de départ, à équilibrer).
export const FARE_PER_M_PER_PASSENGER = 0.25;

// Améliorations du garage : valeur = base + step * niveau.
export const UPGRADES = {
  speed: { label: 'Vitesse', base: 22, step: 2, max: 5 }, // m/s (22 m/s = 79 km/h)
  accel: { label: 'Accélération', base: 7, step: 1, max: 5 },
  brake: { label: 'Freinage', base: 14, step: 2, max: 5 },
  capacity: { label: 'Capacité', base: 8, step: 2, max: 5 }, // passagers
};
export const upgradeCost = (level) => 2000 * (level + 1);

// Niveaux = communes. Chaque niveau est une course avec un objectif :
// transporter `goal` passagers (comptés à la montée, même s'ils descendent ensuite).
// Objectif atteint => le niveau est réussi : prime `reward`, écran de bilan, niveau suivant.
// 100 % de dégâts => niveau raté, on rejoue le même.
// `from` ne sert qu'à la course libre (après le dernier niveau) : le trafic s'épaissit avec la distance.
// Les objectifs et les primes se règlent ici (voir docs/GAME_DESIGN.md).
export const LEVELS = [
  { name: 'Yopougon', from: 0, goal: 10, reward: 2500, density: 0.35, carSpeed: [9, 14] },
  { name: 'Adjamé', from: 2000, goal: 12, reward: 4000, density: 0.5, carSpeed: [7, 13] },
  { name: 'Plateau', from: 5000, goal: 14, reward: 6000, density: 0.7, carSpeed: [5, 12] },
  { name: 'Embouteillage', from: 9000, goal: 16, reward: 9000, density: 0.95, carSpeed: [2, 9] },
];

// Peintures du gbaka. unlockKm = distance cumulée pour débloquer (à tester).
// rear (arrière) et side (côtés) sont des images de public/skins/ — voir docs/ASSETS.md.
// side: null = image pas encore livrée : le jeu ne pose rien et reste jouable.
// Pour activer un côté dès que l'image existe : side: '/skins/maestro_cote.jpg'.
export const SKINS = [
  { id: 'maestro', name: 'Le Maestro', body: '#FF7A00', rear: '/skins/maestro_arriere.jpg', side: null, unlockKm: 0 },
  { id: 'elephant', name: "L'Éléphant", body: '#FF8A2A', rear: '/skins/elephant_arriere.jpg', side: null, unlockKm: 0 },
  { id: 'reine', name: 'La Reine du Pagne', body: '#8E2DA8', rear: null, side: null, unlockKm: 5 },
  { id: 'comedien', name: 'Le Grand Comédien', body: '#00A8E8', rear: null, side: null, unlockKm: 15 },
  { id: 'supporter', name: 'Supporter du Monde', body: '#16A34A', rear: null, side: null, unlockKm: 30 },
  { id: 'legende', name: 'La Légende Dorée', body: '#FFD140', rear: null, side: null, unlockKm: 60 },
];

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// Cris de l'apprenti (il sort la tête et le bras du gbaka pour appeler les passagers).
export const APPRENTI_CRIS = [
  'Adjamé, Adjamé !',
  'Yopougon Siporex !',
  'Niangon, à gauche, à droite !',
  'Adjamé Liberté, par le pont !',
  'Plateau, Plateau, direct !',
  'Abobo Gare, Abobo Gare !',
  'Yopougon Sicogi, Yopougon Maroc !',
  'Treichville, Marcory, Koumassi !',
  'Cocody Danga, Angré !',
  'Adjamé Williamsville !',
  'Port-Bouët, Aéroport !',
  'Bingerville, Bingerville !',
  'Il y a place, il y a place !',
];
export const APPRENTI_CRIS_PLEIN = ["C'est plein, prochain gbaka !", 'Complet, complet !'];
