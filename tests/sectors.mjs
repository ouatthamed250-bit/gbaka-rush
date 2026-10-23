// Test des secteurs d'Abidjan, sans navigateur : ordre du tour, quartiers (jamais partagés),
// cris de l'apprenti, rotation des arrêts et mélange d'ambiances de chaque commune.
// Lancement : npm test
import assert from 'node:assert/strict';
import { SECTORS, LEVELS, DISTRICTS } from '../src/config.js';
import {
  SECTOR_COUNT, sectorAt, sectorOfLevel, quartierAt, criesFor, pickCry,
  stopLabel, placeLabel, mixTotal, districtMix,
} from '../src/game/sectors.js';

const lower = (s) => s.toLowerCase();

// Vrai si le texte cite le mot comme mot entier (« Plateau » ne doit pas matcher « Deux-Plateaux »).
const isLetter = (c) => !!c && c.toLowerCase() !== c.toUpperCase();
const mentions = (text, word) => {
  const t = lower(text);
  const w = lower(word);
  for (let i = t.indexOf(w); i >= 0; i = t.indexOf(w, i + 1)) {
    if (!isLetter(t[i - 1]) && !isLetter(t[i + w.length])) return true;
  }
  return false;
};

// ---------- 1. Le tour d'Abidjan ----------
function testOrder() {
  assert.ok(SECTOR_COUNT >= 3, `il faut au moins 3 secteurs (${SECTOR_COUNT})`);
  assert.equal(SECTORS[0].name, 'Yopougon', 'le jeu commence à Yopougon');
  assert.equal(SECTORS[1].name, 'Adjamé', 'puis Adjamé');
  assert.equal(LEVELS.length, SECTORS.length, 'un niveau par secteur');

  LEVELS.forEach((l, i) => {
    assert.equal(l.sector, i, `${l.name} : mauvais secteur`);
    assert.equal(l.name, SECTORS[i].name, `${l.name} : le niveau et le secteur doivent avoir le même nom`);
    assert.equal(sectorOfLevel(i).id, SECTORS[i].id, `${l.name} : secteurOfLevel`);
  });
  // Un nom de commune n'apparaît qu'une fois : rien ne se mélange.
  const names = SECTORS.map((s) => lower(s.name));
  assert.equal(new Set(names).size, names.length, 'commune en double');
  console.log(`OK  secteurs : ${SECTORS.map((s) => s.name).join(' → ')}.`);
}

// ---------- 2. Quartiers ----------
function testQuartiers() {
  const owner = new Map();
  for (const s of SECTORS) {
    assert.ok(s.quartiers.length >= 4, `${s.name} : il faut au moins 4 quartiers`);
    assert.equal(new Set(s.quartiers).size, s.quartiers.length, `${s.name} : quartier en double`);
    for (const q of s.quartiers) {
      assert.ok(q.trim().length > 0, `${s.name} : quartier vide`);
      assert.ok(!owner.has(q), `quartier partagé entre ${owner.get(q)} et ${s.name} : ${q}`);
      owner.set(q, s.name);
    }
  }
  console.log(`OK  quartiers : ${owner.size} quartiers, aucun partagé entre deux communes.`);
}

// ---------- 3. Cris de l'apprenti ----------
function testCries() {
  for (const s of SECTORS) {
    assert.ok(s.cries.length >= 3, `${s.name} : pas assez de cris`);
    const own = [s.name, ...s.quartiers];
    for (const cry of s.cries) {
      // Il ne cite QUE sa commune et ses quartiers.
      for (const other of SECTORS) {
        if (other.id === s.id) continue;
        assert.ok(!mentions(cry, other.name), `${s.name} : le cri « ${cry} » mélange ${other.name}`);
      }
      assert.ok(own.some((w) => lower(cry).includes(lower(w))), `${s.name} : le cri « ${cry} » ne parle pas du quartier`);
    }

    // L'appel d'arrêt est toujours le quartier, doublé.
    const q = quartierAt(s, 0);
    const cries = criesFor(s, q);
    assert.ok(cries.includes(`${q} ! ${q} !`), `${s.name} : l'appel du quartier manque`);
    assert.ok(cries.length > s.cries.length, `${s.name} : l'appel d'arrêt n'est pas ajouté`);
    // Secours : un secteur sans cri garde des cris génériques (jamais une autre commune).
    for (const cry of criesFor({ name: s.name, quartiers: [], cries: [] }, '')) {
      for (const other of SECTORS) assert.ok(!mentions(cry, other.name), 'cri générique mélangé');
    }
  }
  console.log('OK  cris : chaque secteur n’appelle que ses propres quartiers.');
}

// ---------- 4. Rotation des arrêts ----------
function testRotation() {
  for (const s of SECTORS) {
    assert.equal(quartierAt(s, 0), s.quartiers[0], `${s.name} : premier arrêt`);
    assert.equal(quartierAt(s, s.quartiers.length), s.quartiers[0], `${s.name} : la boucle repart au début`);
    assert.equal(quartierAt(s, -1), s.quartiers[s.quartiers.length - 1], `${s.name} : arrêt précédent`);
    const seen = new Set();
    for (let i = 0; i < s.quartiers.length * 2; i++) {
      const q = quartierAt(s, i);
      assert.ok(s.quartiers.includes(q), `${s.name} : ${q} n'est pas un quartier du secteur`);
      seen.add(q);
    }
    assert.equal(seen.size, s.quartiers.length, `${s.name} : tous les quartiers doivent être visités`);
  }
  console.log('OK  arrêts : on fait le tour des quartiers du secteur, jamais ceux d’une autre commune.');
}

// ---------- 5. Mélanges d'ambiances ----------
function testMix() {
  for (const s of SECTORS) {
    assert.ok(Math.abs(mixTotal(s) - 1) < 1e-9, `${s.name} : la somme des ambiances doit faire 1 (${mixTotal(s)})`);
    const mix = districtMix(s, DISTRICTS);
    assert.equal(mix.villeRun, s.mix.ville, `${s.name} : ambiance ville`);
    assert.equal(mix.marche, s.mix.marche, `${s.name} : ambiance marché`);
    assert.equal(mix.quartier, s.mix.quartier, `${s.name} : ambiance quartier`);
    assert.equal(mix.pont, s.mix.pont, `${s.name} : ambiance pont`);
    assert.equal(mix.specialLength, DISTRICTS.specialLength, `${s.name} : longueur de marché`);
    assert.equal(mix.bridgeLength, DISTRICTS.bridgeLength, `${s.name} : longueur de pont`);
    if (s.mix.pont > 0) assert.ok(s.mix.ville >= 0.4, `${s.name} : trop de pont, la ville doit respirer`);
  }
  console.log('OK  ambiances : chaque commune a son mélange (Yopougon sans pont, Treichville avec).');
}

// ---------- 6. Libellés et tirage ----------
function testLabels() {
  assert.equal(stopLabel('Niangon'), 'Arrêt Niangon');
  assert.equal(stopLabel(''), 'Arrêt');
  assert.equal(placeLabel(SECTORS[0], 'Siporex'), `${SECTORS[0].name} · Siporex`);
  assert.equal(placeLabel(SECTORS[0], ''), SECTORS[0].name);

  const r = pickCry(['a', 'b', 'c'], -1, () => 0);
  assert.equal(r.text, 'a');
  assert.equal(pickCry(['a', 'b'], 0, () => 0).text, 'b', 'jamais deux fois le même cri de suite');
  assert.equal(pickCry([], 0, () => 0).text, '', 'liste vide');
  assert.equal(sectorAt(-4).id, SECTORS[0].id);
  assert.equal(sectorAt(99).id, SECTORS[SECTOR_COUNT - 1].id);
  console.log('OK  libellés : « Arrêt Niangon », « Yopougon · Siporex », tirages sans répétition.');
}

try {
  console.log('--- Secteurs d’Abidjan ---');
  testOrder();
  testQuartiers();
  testCries();
  testRotation();
  testMix();
  testLabels();
  console.log('\nTous les tests des secteurs passent.');
} catch (err) {
  console.error(`\nECHEC : ${err.message}`);
  process.exit(1);
}
