import * as THREE from 'three';
import { GBAKA, VEHICLE } from '../config.js';
import { inspectModel } from './model-contract.js';

// Chargement du vrai gbaka : `public/models/gbaka.glb` (voir docs/ASSETS.md).
// Le module GLTFLoader (≈40 ko) n'est téléchargé que si le fichier existe vraiment :
// tant qu'il n'y a pas de modèle, le jeu garde le gbaka en boîtes, sans erreur visible.

// Le jeu éclaire avec une lumière d'ambiance + un soleil, sans environnement réfléchissant :
// un matériau « standard » (métal) sortirait tout noir. On le convertit en Lambert (mat),
// ce qui est aussi beaucoup moins cher pour un téléphone d'entrée de gamme.
function toLambert(m) {
  if (!m) return m;
  if (!m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial) return m.clone();
  return new THREE.MeshLambertMaterial({
    name: m.name,
    color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
    map: m.map || null,
    transparent: !!m.transparent,
    opacity: m.opacity ?? 1,
    alphaTest: m.alphaTest || 0,
    side: m.side,
    vertexColors: !!m.vertexColors,
    flatShading: GBAKA.flatShading,
  });
}

// Prépare le modèle pour le jeu : taille en mètres, avant vers -Z, origine au centre et au sol,
// matériaux adaptés. Le modèle est enveloppé dans un groupe qui devient le « gabarit » ;
// chaque gbaka en jeu en est une copie (les formes sont partagées, rien n'est rechargé).
export function prepareGbaka(scene) {
  const wrap = new THREE.Group();
  wrap.name = 'gbaka_model';
  wrap.add(scene);
  const materials = [];

  // 1. Taille. Un export en centimètres ou en pouces est corrigé tout seul ;
  //    un fichier entre 4 et 10 m est considéré correct et n'est pas touché.
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const length = Math.max(size.x, size.z);
  if (length > 0.01 && (length < 4 || length > 10)) {
    const k = VEHICLE.length / length;
    scene.scale.multiplyScalar(k);
    scene.updateMatrixWorld(true);
    console.info(`[gbaka] fichier de ${length.toFixed(2)} m : mise à l'échelle ×${k.toFixed(3)}`);
  }
  if (GBAKA.scale !== 1) {
    scene.scale.multiplyScalar(GBAKA.scale);
    scene.updateMatrixWorld(true);
  }

  // 2. Orientation : dans le jeu l'avant est vers -Z (GBAKA.yaw corrige un export inversé).
  if (GBAKA.yaw) {
    scene.rotation.y = GBAKA.yaw;
    scene.updateMatrixWorld(true);
  }

  // 3. Origine : centre du gbaka au milieu, bas du gbaka au sol (y = 0).
  const b2 = new THREE.Box3().setFromObject(scene);
  const c = b2.getCenter(new THREE.Vector3());
  scene.position.set(scene.position.x - c.x, scene.position.y - b2.min.y, scene.position.z - c.z);
  scene.updateMatrixWorld(true);

  // 4. Repères utiles, exprimés dans le repère du gbaka (enveloppe à l'origine) :
  //    taille de la caisse pour les peintures, sortie d'échappement, position de la porte.
  wrap.updateMatrixWorld(true);
  const parts = inspectModel(scene);
  const bb = new THREE.Box3().setFromObject(parts.body || scene);
  const decalBox = {
    min: { x: bb.min.x, y: bb.min.y, z: bb.min.z },
    max: { x: bb.max.x, y: bb.max.y, z: bb.max.z },
  };
  const at = (o) => (o ? new THREE.Vector3().setFromMatrixPosition(o.matrixWorld) : null);
  const exhaust = at(parts.exhaust);
  const door = at(parts.door);

  // 5. Matériaux : une seule copie par matériau d'origine, et on garde la liste pour plus tard.
  const cache = new Map();
  const convert = (m) => {
    if (!m) return m;
    if (!cache.has(m)) {
      const out = toLambert(m);
      cache.set(m, out);
      materials.push(out);
    }
    return cache.get(m);
  };
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = false;
    o.receiveShadow = false;
    const list = Array.isArray(o.material) ? o.material.map(convert) : convert(o.material);
    o.material = list;
  });

  return { object: wrap, materials, decalBox, exhaust, door };
}

// Charge le fichier. Lève une erreur (attrapée par gbaka.js) si le fichier est absent,
// illisible ou s'il n'y a pas d'objet « body » : le jeu reste alors sur le modèle en boîtes.
export async function loadGbakaModel() {
  const url = GBAKA.model;
  // HEAD : on ne télécharge rien si le fichier n'existe pas encore (le cas aujourd'hui).
  const head = await fetch(url, { method: 'HEAD' });
  if (!head.ok) throw new Error(`fichier absent (${head.status})`);

  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const gltf = await new Promise((resolve, reject) => {
    new GLTFLoader().load(url, resolve, undefined, () => reject(new Error('fichier illisible')));
  });

  const parts = inspectModel(gltf.scene);
  if (!parts.usable) throw new Error('objet « body » introuvable');
  if (parts.missing.length) {
    console.warn('[gbaka] objets à ajouter dans gbaka.glb :', parts.missing.join(', '));
  }
  return prepareGbaka(gltf.scene);
}
