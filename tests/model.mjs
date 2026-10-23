// Test du vrai chemin de chargement du gbaka 3D, sans navigateur :
// on fabrique un petit fichier .glb en mémoire, on le donne à GLTFLoader,
// puis on vérifie que le jeu retrouve les objets, recentre le modèle et
// convertit les matériaux. Lancement : npm test
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { inspectModel } from '../src/game/model-contract.js';
import { prepareGbaka } from '../src/game/gbaka-model.js';

// ---------- Fabrication d'un GLB minimal ----------
// Caisse : un triangle qui occupe toute la boîte du gbaka (x ±1, y 0..2,5, z ±3).
// Roues : un petit triangle de 0,8 m de côté, placé par la translation du nœud.
function boxGlb() {
  const body = new Float32Array([-1, 0, -3, 1, 0, -3, 1, 2.5, 3]);
  const wheel = new Float32Array([-0.4, -0.4, -0.4, 0.4, -0.4, -0.4, 0.4, 0.4, 0.4]);
  const bin = Buffer.concat([Buffer.from(body.buffer), Buffer.from(wheel.buffer)]);

  const json = {
    asset: { version: '2.0', generator: 'gbaka-rush test' },
    scene: 0,
    scenes: [{ nodes: [0, 1, 2, 3, 4, 5, 6] }],
    nodes: [
      { name: 'body', mesh: 0 },
      { name: 'wheel_FL', mesh: 1, translation: [-1, 0.4, -2] },
      { name: 'wheel_FR', mesh: 1, translation: [1, 0.4, -2] },
      { name: 'wheel_RL', mesh: 1, translation: [-1, 0.4, 2] },
      { name: 'wheel_RR', mesh: 1, translation: [1, 0.4, 2] },
      { name: 'door_side', translation: [1, 1.2, -0.3] },
      { name: 'exhaust', translation: [0.7, 0.4, 3.1] },
    ],
    meshes: [
      { primitives: [{ attributes: { POSITION: 0 }, mode: 4 }] },
      { primitives: [{ attributes: { POSITION: 1 }, mode: 4 }] },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-1, 0, -3], max: [1, 2.5, 3] },
      { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3', min: [-0.4, -0.4, -0.4], max: [0.4, 0.4, 0.4] },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 36, target: 34962 },
    ],
    buffers: [{ byteLength: 72 }],
  };

  const pad4 = (n) => (n + 3) & ~3;
  const jsonRaw = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonChunk = Buffer.concat([jsonRaw, Buffer.alloc(pad4(jsonRaw.length) - jsonRaw.length, 0x20)]);
  const binChunk = Buffer.concat([bin, Buffer.alloc(pad4(bin.length) - bin.length, 0)]);
  const total = 12 + 8 + jsonChunk.length + 8 + binChunk.length;

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // « glTF »
  header.writeUInt32LE(2, 4); // version 2
  header.writeUInt32LE(total, 8);

  const jsonHead = Buffer.alloc(8);
  jsonHead.writeUInt32LE(jsonChunk.length, 0);
  jsonHead.writeUInt32LE(0x4e4f534a, 4); // « JSON »

  const binHead = Buffer.alloc(8);
  binHead.writeUInt32LE(binChunk.length, 0);
  binHead.writeUInt32LE(0x004e4942, 4); // « BIN »

  const glb = Buffer.concat([header, jsonHead, jsonChunk, binHead, binChunk]);
  return glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength);
}

// ---------- Test ----------
try {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const gltf = await new Promise((resolve, reject) => {
    new GLTFLoader().parse(boxGlb(), '', resolve, reject);
  });

  const parts = inspectModel(gltf.scene);
  assert.equal(parts.usable, true, 'le fichier est utilisable');
  assert.equal(parts.wheelCount, 4, 'les 4 roues sont retrouvées');
  assert.deepEqual(parts.missing, [], 'aucun objet manquant');

  // Préparation : le jeu doit retrouver la taille, les repères et des matériaux mats.
  const prepared = prepareGbaka(gltf.scene);
  const b = prepared.decalBox;
  assert.ok(Math.abs(b.min.x + 1) < 0.01 && Math.abs(b.max.x - 1) < 0.01, 'largeur de caisse = 2 m');
  assert.ok(Math.abs(b.min.y) < 0.01 && Math.abs(b.max.y - 2.5) < 0.01, 'caisse posée au sol');
  assert.ok(Math.abs(b.min.z + 3) < 0.01 && Math.abs(b.max.z - 3) < 0.01, 'longueur de caisse = 6 m');
  assert.ok(prepared.door && Math.abs(prepared.door.x - 1) < 0.01, 'porte trouvée côté +X');
  assert.ok(prepared.exhaust && prepared.exhaust.z > 3, 'échappement trouvé à l’arrière');

  let meshes = 0;
  prepared.object.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    assert.equal(o.material.isMeshLambertMaterial, true, 'matériau converti en mat (Lambert)');
  });
  assert.ok(meshes >= 2, 'les maillages sont bien là');

  // Une copie du gabarit doit garder les mêmes repères (utilisé à chaque changement de peinture).
  const copy = prepared.object.clone(true);
  assert.equal(inspectModel(copy).wheelCount, 4, 'la copie garde les noms des roues');
  assert.equal(copy.children.length, 1, 'une seule enveloppe');

  // Un modèle trop petit (export en centimètres) est remis à l'échelle du jeu.
  const small = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 620));
  const fixed = prepareGbaka(small);
  const size = new THREE.Box3().setFromObject(fixed.object).getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.z - 6.2) < 0.05, `mise à l'échelle automatique (${size.z.toFixed(2)} m)`);

  console.log('OK  gbaka.glb : fichier lu, objets retrouvés, modèle recentré, matériaux mats.');
} catch (err) {
  console.error(`\nECHEC : ${err.message}`);
  process.exit(1);
}
