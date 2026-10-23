// Test du décor, sans navigateur : on simule un canvas minimal (les textures ne sont pas
// dessinées), on construit le monde puis on traverse CHAQUE commune d'Abidjan.
// Vérifie : un décor par secteur (palette, variantes, chaussée), les ambiances autorisées par
// la commune (pas de pont à Yopougon, un pont à Treichville), l'eau uniquement sur le pont,
// les longueurs d'ambiance, le recyclage des tronçons et le poids d'un tronçon.
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
const { ROAD, SECTORS, DISTRICTS } = await import('../src/config.js');
const { DISTRICT_IDS } = await import('../src/game/districts.js');
const { mixTotal } = await import('../src/game/sectors.js');

const L = ROAD.chunkLength;
const world = new World({ add() {} });
const chunks = world.chunks;

const tris = (geo) => (geo ? (geo.index ? geo.index.count : geo.attributes.position.count) / 3 : 0);
const weight = (kind) =>
  Math.round(world.variants[kind].reduce((a, v) => a + tris(v.facades) + tris(v.props), 0) / world.variants[kind].length);

function testConstruction() {
  assert.equal(chunks.length, ROAD.chunks, 'nombre de tronçons');
  assert.equal(world.sectorId, SECTORS[0].id, 'le monde démarre dans le premier secteur');

  for (const sector of SECTORS) {
    world.setSector(sector);
    assert.equal(world.sectorId, sector.id, `secteur non appliqué : ${sector.name}`);
    assert.equal(world.ground.material.color.getHex(), world.style.ground, `${sector.name} : sol de la commune`);
    assert.equal(Math.round(mixTotal(sector) * 1e9) / 1e9, 1, `${sector.name} : les ambiances doivent faire 1`);

    for (const kind of Object.keys(world.variants)) {
      assert.ok(world.variants[kind].length >= 1, `${sector.name} : aucune variante ${kind}`);
    }

    // Dans ce secteur, seules les ambiances de son mélange apparaissent.
    world.reset();
    for (let i = 0; i < 60; i++) world.update(-i * 12);
    const seen = new Set(chunks.map((g) => g.userData.district));
    for (const d of seen) {
      assert.ok(DISTRICT_IDS.includes(d), `${sector.name} : ambiance inconnue ${d}`);
      assert.ok((sector.mix[d] ?? 0) > 0, `${sector.name} : ambiance interdite ${d}`);
    }

    for (const g of chunks) {
      const d = g.userData.district;
      const bridge = d === 'pont';
      assert.equal(g.userData.water.visible, bridge, `${sector.name} : eau seulement sur le pont (${d})`);
      assert.equal(g.userData.facades.visible, !bridge, `${sector.name} : façades hors du pont (${d})`);
      assert.ok(g.userData.props.geometry.attributes.position, `${sector.name} : accessoires manquants (${d})`);
      assert.ok(g.userData.road.material, `${sector.name} : chaussée manquante (${d})`);
      if (bridge) assert.equal(g.userData.road.material, world.roadMats.bridge, 'chaussée de pont');
    }

    for (const kind of Object.keys(world.variants)) {
      const n = weight(kind);
      assert.ok(n < 12000, `${sector.name} : tronçon trop lourd (${kind} : ${n} triangles)`);
    }
  }

  // L'eau couvre bien toute la largeur visible (le sol ne doit pas apparaître sur le pont).
  assert.ok(world.waterGeo.parameters.width >= 300, 'nappe d’eau assez large');

  console.log(
    `OK  décor : ${SECTORS.length} communes, ${chunks.length} tronçons construits, ` +
      `${Object.values(world.variants).flat().length} variantes pour ${world.sector.name}, ` +
      `triangles par tronçon : ${Object.keys(world.variants).map((k) => `${k} ${weight(k)}`).join(', ')}.`,
  );
}

function testRun() {
  const lines = [];
  for (const sector of SECTORS) {
    world.setSector(sector);
    world.reset();
    let z = 0;
    // On relève l'ambiance de chaque tronçon traversé. La clé est la position du tronçon :
    // elle change quand le tronçon est recyclé, donc chaque tronçon n'est compté qu'une fois.
    const seen = new Map();
    for (let step = 0; step < 2500; step++) {
      z -= 2; // 2 m par pas => 5 km
      world.update(z);
      // Le tronçon sous le joueur doit toujours être trouvé : jamais de trou dans la route.
      const under = chunks.find((g) => z >= g.position.z - L / 2 && z <= g.position.z + L / 2);
      assert.ok(under, `${sector.name} : aucun tronçon sous le joueur à z=${z}`);
      assert.equal(under.userData.district, world.district, `${sector.name} : ambiance annoncée = sous les roues`);
      seen.set(Math.round(under.position.z * 1000), under.userData.district);
    }

    // Les 6 tronçons restent 6 emplacements consécutifs (pas de trou, pas de doublon).
    const zs = chunks.map((g) => g.position.z).sort((a, b) => a - b);
    assert.equal(new Set(zs.map((v) => Math.round(v * 1000))).size, ROAD.chunks, 'tronçons superposés');
    assert.ok(Math.abs(zs[ROAD.chunks - 1] - zs[0] - (ROAD.chunks - 1) * L) < 1e-6, 'espacement des tronçons');
    for (const g of chunks) assert.ok(Number.isFinite(g.position.z), 'position invalide');

    // Suite des tronçons parcourus, du départ (z le plus grand) vers l'avant.
    const path = [...seen.entries()].sort((a, b) => b[0] - a[0]).map((e) => e[1]);
    assert.ok(path.length > 40, `${sector.name} : trop peu de tronçons traversés (${path.length})`);

    const runs = [];
    for (const d of path) {
      if (runs.length && runs[runs.length - 1].id === d) runs[runs.length - 1].n++;
      else runs.push({ id: d, n: 1 });
    }
    // Le dernier groupe peut être incomplet (on quitte la route au milieu d'un marché) :
    // on ne vérifie que les groupes entiers.
    const complete = runs.slice(0, -1);
    for (const r of complete) {
      if (r.id === 'pont') assert.equal(r.n, DISTRICTS.bridgeLength, `${sector.name} : pont de ${r.n} tronçons`);
      else if (r.id !== 'ville') assert.equal(r.n, DISTRICTS.specialLength, `${sector.name} : ${r.id} de ${r.n} tronçons`);
    }
    for (let i = 1; i < runs.length; i++) {
      assert.ok(!(runs[i].id !== 'ville' && runs[i - 1].id !== 'ville'), `${sector.name} : deux ambiances collées`);
    }

    // Aucune ambiance d'une autre commune ne sort de terre (pas de pont à Yopougon...).
    const kinds = new Set(path);
    for (const d of kinds) {
      assert.ok(DISTRICT_IDS.includes(d), `${sector.name} : ambiance inconnue ${d}`);
      assert.ok((sector.mix[d] ?? 0) > 0, `${sector.name} : ambiance interdite ${d}`);
    }
    if (sector.mix.pont > 0) assert.ok(kinds.has('pont'), `${sector.name} : le pont n'apparaît jamais`);
    else assert.ok(!kinds.has('pont'), `${sector.name} : pont interdit dans ce secteur`);

    const count = (id) => path.filter((d) => d === id).length;
    lines.push(
      `${sector.name} ${path.length} tronçons (${count('ville')} ville, ${count('marche')} marché, ` +
        `${count('quartier')} quartier, ${count('pont')} pont)`,
    );
  }
  console.log(`OK  parcours : ${lines.join(' · ')}.`);
}

try {
  testConstruction();
  testRun();
  console.log('Tous les tests du décor passent.');
} catch (err) {
  console.error(`\nECHEC : ${err.message}`);
  process.exit(1);
}