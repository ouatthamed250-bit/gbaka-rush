// Test du décor, sans navigateur : on simule un canvas minimal (les textures ne sont pas
// dessinées), on construit le monde puis on fait avancer le joueur sur 6 km.
// Vérifie : les 2 tronçons de départ, les ambiances valides, l'eau uniquement sur le pont,
// les longueurs de pont / marché, et le recyclage des tronçons (positions toujours régulières).
import assert from 'node:assert/strict';

// Hasard reproductible : un échec est toujours rejouable à l'identique.
let seed = 424242;
Math.random = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Canvas minimal : toutes les méthodes de dessin existent et ne font rien.
const ctx = new Proxy(
  {},
  {
    get: (_t, key) => (key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}),
  },
);
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };

const { World } = await import('../src/game/world.js');
const { ROAD } = await import('../src/config.js');
const { DISTRICT_IDS } = await import('../src/game/districts.js');

const L = ROAD.chunkLength;
const world = new World({ add() {} });
const chunks = world.chunks;

function testConstruction() {
  assert.equal(chunks.length, ROAD.chunks, 'nombre de tronçons');
  assert.equal(chunks[0].userData.district, 'ville', 'départ en ville');
  assert.equal(chunks[1].userData.district, 'ville', 'départ en ville');

  for (const g of chunks) {
    const d = g.userData.district;
    assert.ok(DISTRICT_IDS.includes(d), `ambiance inconnue : ${d}`);
    assert.ok(g.userData.props.geometry.attributes.position, `accessoires manquants (${d})`);
    assert.ok(g.userData.road.material, `chaussée manquante (${d})`);

    const bridge = d === 'pont';
    assert.equal(g.userData.water.visible, bridge, `eau seulement sur le pont (${d})`);
    assert.equal(g.userData.facades.visible, !bridge, `façades hors du pont (${d})`);
    if (bridge) assert.equal(g.userData.road.material, world.roadMats.bridge, 'chaussée de pont');
  }
  // L'eau couvre bien toute la largeur visible (le sol de latérite ne doit pas apparaître).
  assert.ok(world.waterGeo.parameters.width >= 300, 'nappe d’eau assez large');

  // Poids du décor : un tronçon doit rester léger (il est dessiné en 2 maillages).
  const tris = (geo) => (geo ? (geo.index ? geo.index.count : geo.attributes.position.count) / 3 : 0);
  const weight = (kind) =>
    Math.round(world.variants[kind].reduce((a, v) => a + tris(v.facades) + tris(v.props), 0) / world.variants[kind].length);
  const weights = Object.fromEntries(Object.keys(world.variants).map((k) => [k, weight(k)]));
  for (const [kind, n] of Object.entries(weights)) assert.ok(n < 12000, `tronçon trop lourd (${kind} : ${n} triangles)`);

  console.log(
    `OK  décor : ${chunks.length} tronçons construits, ${Object.values(world.variants).flat().length} variantes, ` +
      `triangles par tronçon : ville ${weights.ville}, marché ${weights.marche}, ` +
      `quartier ${weights.quartier}, pont ${weights.pont}.`,
  );
}

function testRun() {
  let z = 0;
  // On relève l'ambiance de chaque tronçon traversé. La clé est la position du tronçon :
  // elle change quand le tronçon est recyclé, donc chaque tronçon n'est compté qu'une fois.
  const seen = new Map();
  for (let step = 0; step < 3000; step++) {
    z -= 2; // 2 m par pas => 6 km
    world.update(z);
    // Le tronçon sous le joueur doit toujours être trouvé : jamais de trou dans la route.
    const under = chunks.find((g) => z >= g.position.z - L / 2 && z <= g.position.z + L / 2);
    assert.ok(under, `aucun tronçon sous le joueur à z=${z}`);
    assert.equal(under.userData.district, world.district, 'ambiance annoncée = ambiance sous les roues');
    seen.set(Math.round(under.position.z * 1000), under.userData.district);
  }

  // Les 6 tronçons restent 6 emplacements consécutifs (pas de trou, pas de doublon).
  const zs = chunks.map((g) => g.position.z).sort((a, b) => a - b);
  assert.equal(new Set(zs.map((v) => Math.round(v * 1000))).size, ROAD.chunks, 'tronçons superposés');
  assert.ok(Math.abs(zs[ROAD.chunks - 1] - zs[0] - (ROAD.chunks - 1) * L) < 1e-6, 'espacement des tronçons');
  for (const g of chunks) assert.ok(Number.isFinite(g.position.z), 'position invalide');

  // Suite des tronçons parcourus, du départ (z le plus grand) vers l'avant.
  const path = [...seen.entries()].sort((a, b) => b[0] - a[0]).map((e) => e[1]);
  assert.ok(path.length > 100, `trop peu de tronçons traversés : ${path.length}`);

  const runs = [];
  for (const d of path) {
    if (runs.length && runs[runs.length - 1].id === d) runs[runs.length - 1].n++;
    else runs.push({ id: d, n: 1 });
  }
  for (const r of runs) {
    if (r.id === 'pont') assert.equal(r.n, 3, `pont de ${r.n} tronçons`);
    else if (r.id !== 'ville') assert.equal(r.n, 2, `${r.id} de ${r.n} tronçons`);
  }
  for (let i = 1; i < runs.length; i++) {
    assert.ok(!(runs[i].id !== 'ville' && runs[i - 1].id !== 'ville'), 'deux ambiances spéciales collées');
  }

  const kinds = new Set(path);
  for (const id of DISTRICT_IDS) assert.ok(kinds.has(id), `ambiance jamais traversée : ${id}`);
  const count = (id) => path.filter((d) => d === id).length;
  const ville = count('ville') / path.length;
  assert.ok(ville > 0.25 && ville < 0.75, `part de ville inhabituelle : ${ville.toFixed(2)}`);

  console.log(
    `OK  parcours : 6 km, ${path.length} tronçons, ${Math.round(ville * 100)} % de ville, ` +
      `${count('marche')} de marché, ${count('quartier')} de quartier, ${count('pont')} de pont.`,
  );
}

try {
  testConstruction();
  testRun();
  console.log('Tous les tests du décor passent.');
} catch (err) {
  console.error(`\nECHEC : ${err.message}`);
  process.exit(1);
}
