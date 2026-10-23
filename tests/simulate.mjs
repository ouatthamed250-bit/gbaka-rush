// Test automatique (Node, sans navigateur) : collisions et règle « une voie libre toujours ».
// Lancement : npm test
//
// Le script simule le trafic pendant 5 minutes minimum (18 000 images par minute à 60 i/s),
// vérifie qu'aucune voiture ne se traverse et qu'à chaque apparition il reste au moins une
// voie libre dans une fenêtre de 30 m (TRAFFIC.clearWindow).
import assert from 'node:assert/strict';
import { Traffic } from '../src/game/traffic.js';
import { boxesOverlap, carHitsPlayer, occupiedLanes, laneOf, carCanSpawn } from '../src/game/rules.js';
import { inspectModel, decalLayout } from '../src/game/model-contract.js';
import { districtPlan, DISTRICT_IDS } from '../src/game/districts.js';
import { LEVELS, TRAFFIC, ROAD, DECAL, DISTRICTS } from '../src/config.js';

const DT = 1 / 60;

// Hasard reproductible : un échec est toujours rejouable à l'identique.
let seed = 123456789;
Math.random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const car = (x, z, w = 1.8, l = 4.2) => ({ x, z, w, l, active: true });

// Existe-t-il, entre fromZ et toZ, une fenêtre de ± windowM où les 3 voies sont occupées ?
function hasWall(cars, fromZ, toZ, windowM) {
  for (let z = fromZ; z <= toZ; z += 5) {
    if (occupiedLanes(cars, z, windowM).size >= 3) return true;
  }
  return false;
}

// ---------- 1. Collisions ----------
function testCollisions() {
  // gbaka : 2,1 m de large, 6,2 m de long.
  assert.equal(carHitsPlayer(0, 0, car(0, 0)), true, 'même voie, même endroit');
  assert.equal(carHitsPlayer(0, 0, car(ROAD.laneWidth, 0)), false, 'voiture sur la voie voisine');
  assert.equal(carHitsPlayer(0, 0, car(0, 20)), false, 'voiture loin devant');
  assert.equal(carHitsPlayer(0, 0, car(0, 4.6)), true, 'choc par l’arrière');
  assert.equal(carHitsPlayer(0, 0, car(0, 5.2)), false, 'fin de la tolérance (pas de choc injuste)');
  assert.equal(carHitsPlayer(ROAD.laneWidth, 0, car(0, 0)), false, 'gbaka sur la voie voisine');
  assert.equal(carHitsPlayer(0, 0, car(0, 0, 0.8, 2.0)), true, 'moto dans la même voie');

  // Fonction de base : deux boîtes de 2 x 6 m.
  assert.equal(boxesOverlap(0, 0, 2, 6, 0, 5.9, 2, 6), true);
  assert.equal(boxesOverlap(0, 0, 2, 6, 0, 6.1, 2, 6), false);
  assert.equal(boxesOverlap(0, 0, 2, 6, 2.1, 0, 2, 6), false);
  assert.equal(boxesOverlap(0, 0, 2, 6, 1.9, 0, 2, 6), true);

  console.log('OK  collisions : même voie = choc, voie voisine = pas de choc.');
}

// ---------- 1 bis. Règle d'apparition ----------
function testSpawnRule() {
  const x = (lane) => lane * ROAD.laneWidth; // -3,6 / 0 / +3,6
  const at = (lane, z) => car(x(lane), z);

  // Deux voies occupées au même endroit : la troisième est interdite.
  const two = [at(-1, -100), at(0, -125)];
  assert.equal(carCanSpawn(two, x(1), -100), false, 'ne pas boucher la 3e voie');
  assert.equal(carCanSpawn(two, x(0), -100), true, 'ajouter une voiture dans une voie déjà occupée reste permis');

  // Hors de la fenêtre de 30 m : autorisé.
  assert.equal(carCanSpawn(two, x(1), -100 - TRAFFIC.clearWindow - 1), true, 'hors de la fenêtre');

  // Même voie : il faut au moins TRAFFIC.minGap entre deux véhicules.
  const one = [at(0, -100)];
  assert.equal(carCanSpawn(one, x(0), -100 + TRAFFIC.minGap - 1), false, 'trop collé dans la même voie');
  assert.equal(carCanSpawn(one, x(0), -100 + TRAFFIC.minGap + 1), true, 'espace suffisant dans la même voie');

  // Zone déjà saturée (3 voies dans la fenêtre) : refus même dans une voie occupée.
  const full = [at(-1, -100), at(0, -100), at(1, -125)];
  assert.equal(carCanSpawn(full, x(1), -100), false, 'zone déjà à 3 voies');

  console.log('OK  apparition : jamais 3 voies bouchées, jamais deux véhicules collés.');
}

// ---------- 1 ter. Contrat du modèle 3D (public/models/gbaka.glb) ----------
function testModelContract() {
  const node = (name, children = []) => ({ name, children });

  // Arbre factice : les noms doivent être reconnus quelle que soit la casse,
  // et malgré le suffixe « .001 » que Blender ajoute aux doublons.
  const root = node('Scene', [
    node('body', [node('chassis')]),
    node('Wheel_FL'),
    node('wheel_fr.001'),
    node('Wheel RL'),
    node('wheel_RR'),
    node('door_side', [node('handle')]),
    node('exhaust'),
    node('skin_rear'),
    node('skin_side_L'),
    node('skin_side_R'),
  ]);
  const parts = inspectModel(root);
  assert.equal(parts.usable, true, 'body présent : modèle utilisable');
  assert.equal(parts.wheelCount, 4, 'les 4 roues sont trouvées');
  assert.deepEqual(parts.missing, [], 'aucun objet manquant');
  assert.equal(parts.door.name, 'door_side');
  assert.equal(parts.skinSideRight.name, 'skin_side_R');
  assert.equal(parts.body, root.children[0]);

  // Modèle incomplet : on sait exactement quoi demander au graphiste.
  const empty = inspectModel(node('Scene', [node('body')]));
  assert.equal(empty.usable, true, 'un modèle sans roues reste jouable');
  assert.equal(empty.wheelCount, 0);
  assert.deepEqual(empty.missing, ['wheel_FL', 'wheel_FR', 'wheel_RL', 'wheel_RR', 'door_side', 'exhaust']);
  const noBody = inspectModel(node('Scene', [node('wheel_FL')]));
  assert.equal(noBody.usable, false, 'sans body, on reste sur le gbaka en boîtes');
  assert.ok(noBody.missing.includes('body'));

  // Placement des peintures : arrière au fond (+Z), côtés sur les flancs (±X), sans déborder.
  const box = { min: { x: -1.05, y: 0, z: -3.1 }, max: { x: 1.05, y: 2.8, z: 3.1 } };
  const rear = decalLayout(box, 'rear', DECAL.rear);
  assert.ok(rear.pos[2] > box.max.z, 'le panneau arrière est posé derrière la caisse');
  assert.equal(rear.rotY, 0);
  assert.ok(rear.size[0] < 2.1 && rear.size[1] < 2.8, 'le panneau arrière tient sur la caisse');
  const right = decalLayout(box, 'sideRight', DECAL.side);
  const left = decalLayout(box, 'sideLeft', DECAL.side);
  assert.ok(right.pos[0] > box.max.x && left.pos[0] < box.min.x, 'les panneaux latéraux sont à l’extérieur');
  assert.equal(right.rotY, Math.PI / 2);
  assert.equal(left.rotY, -Math.PI / 2);
  assert.ok(right.size[0] < 6.2 && right.size[1] < 2.8, 'le panneau latéral tient sur la caisse');

  console.log('OK  modèle 3D : noms reconnus, objets manquants listés, peintures bien placées.');
}

// ---------- 2. Simulation ----------
function run({ label, minutes, speed, forcedLevel = -1 }) {
  const traffic = new Traffic({ add() {} });
  const steps = Math.round((minutes * 60) / DT);
  let playerZ = 0;
  let t = 0;
  let spawns = 0;
  let badSpawns = 0;
  let badGaps = 0;
  let overlaps = 0;
  let maxActive = 0;
  let sumActive = 0;
  let blockedCorridorFrames = 0;
  let wallFrames = 0;
  const badDetails = [];

  // On contrôle la règle au moment exact de l'apparition. Un espion est nécessaire :
  // une voiture peut disparaître puis réapparaître dans la même image (elle était active
  // au début de l'image), et un simple diff d'état raterait cette apparition.
  const realSpawn = traffic._spawn.bind(traffic);
  traffic._spawn = (c, pz, level) => {
    if (!realSpawn(c, pz, level)) return false;
    spawns++;
    const lanes = occupiedLanes(traffic.cars, c.z);
    if (lanes.size > 2) {
      badSpawns++;
      if (badDetails.length < 3) {
        const near = traffic.cars
          .filter((o) => o.active && Math.abs(o.z - c.z) <= TRAFFIC.clearWindow)
          .map((o) => `${o.type} voie ${laneOf(o.x)} z ${o.z.toFixed(1)}`);
        badDetails.push(`nouvelle ${c.type} voie ${laneOf(c.x)} z ${c.z.toFixed(1)} | ${near.join(' ; ')}`);
      }
    }
    for (const o of traffic.cars) {
      if (o === c || !o.active) continue;
      if (laneOf(o.x) === laneOf(c.x) && Math.abs(o.z - c.z) < TRAFFIC.minGap) {
        badGaps++;
        break;
      }
    }
    return true;
  };

  for (let step = 0; step < steps; step++) {
    playerZ -= speed * DT;
    const dist = -playerZ;
    let levelIdx = 0;
    for (let i = 0; i < LEVELS.length; i++) if (dist >= LEVELS[i].from) levelIdx = i;
    const level = LEVELS[forcedLevel >= 0 ? forcedLevel : levelIdx];

    traffic.update(DT, playerZ, level, t);
    t += DT;

    // Aucune voiture ne doit en traverser une autre.
    for (let i = 0; i < traffic.cars.length; i++) {
      const a = traffic.cars[i];
      if (!a.active) continue;
      for (let j = i + 1; j < traffic.cars.length; j++) {
        const b = traffic.cars[j];
        if (!b.active) continue;
        if (Math.abs(a.x - b.x) < 1.5 && Math.abs(a.z - b.z) < (a.l + b.l) / 2 - 0.2) overlaps++;
      }
    }

    // Statistique : les 3 voies sont-elles bouchées juste devant le joueur ?
    // (corridor de 50 m : de playerZ - 55 à playerZ - 5)
    if (occupiedLanes(traffic.cars, playerZ - 30, 25).size >= 3) blockedCorridorFrames++;

    // Statistique de jouabilité : un vrai « mur » (les 3 voies occupées à moins de 10 m
    // les unes des autres) existe-t-il dans les 90 m devant le joueur ?
    if (hasWall(traffic.cars, playerZ - 90, playerZ - 10, 5)) wallFrames++;

    const active = traffic.activeCount();
    maxActive = Math.max(maxActive, active);
    sumActive += active;
  }

  assert.equal(badSpawns, 0, `${label} : ${badSpawns} apparition(s) avec les 3 voies occupées\n${badDetails.join('\n')}`);
  assert.equal(badGaps, 0, `${label} : ${badGaps} apparition(s) trop proche(s) d'un véhicule de la même voie`);
  assert.equal(overlaps, 0, `${label} : ${overlaps} chevauchement(s) de véhicules`);
  assert.ok(spawns > 0, `${label} : aucune voiture n'est apparue`);
  assert.ok(maxActive >= 3, `${label} : trafic trop faible (${maxActive} véhicules au maximum)`);

  const avg = (sumActive / steps).toFixed(1);
  const blockedPct = ((blockedCorridorFrames / steps) * 100).toFixed(1);
  const wallPct = ((wallFrames / steps) * 100).toFixed(1);
  console.log(
    `OK  ${label} : ${spawns} apparitions, ${avg} véhicules en moyenne (max ${maxActive}), ` +
    `0 chevauchement, 0 règle cassée. Couloir devant à 3 voies : ${blockedPct} %, ` +
    `mur serré (10 m) dans les 90 m devant : ${wallPct} %.`,
  );
  return { spawns, badSpawns, overlaps };
}

// ---------- 3. Qualité éco ----------
function testEco() {
  const traffic = new Traffic({ add() {} });
  let playerZ = 0;
  let t = 0;
  traffic.setEco(true, playerZ);
  assert.equal(traffic.maxActive, TRAFFIC.ecoCount, 'plafond éco');

  for (let step = 0; step < 60 / DT; step++) {
    playerZ -= 10 * DT;
    traffic.update(DT, playerZ, LEVELS[3], t);
    t += DT;
    assert.ok(
      traffic.activeCount() <= TRAFFIC.ecoCount,
      `qualité éco : ${traffic.activeCount()} véhicules actifs (plafond ${TRAFFIC.ecoCount})`,
    );
  }
  traffic.setEco(false, playerZ);
  assert.equal(traffic.maxActive, TRAFFIC.count, 'retour à la normale');
  console.log(`OK  qualité éco : jamais plus de ${TRAFFIC.ecoCount} véhicules actifs.`);
}

// ---------- 3. Quartiers de rue ----------
function testDistricts() {
  // Générateur local (on ne touche pas au hasard global : les simulations de trafic
  // gardent ainsi exactement les mêmes tirages qu'avant).
  let s = 987654321;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

  const plan = districtPlan(rand);
  const out = [];
  for (let i = 0; i < 400; i++) out.push(plan.next().value);

  // 1. Uniquement des ambiances connues.
  for (const d of out) assert.ok(DISTRICT_IDS.includes(d), `ambiance inconnue : ${d}`);

  // 2. Jamais deux ambiances spéciales différentes d'affilée : après une ambiance
  //    spéciale, soit elle continue (longueur du pont / du marché), soit c'est la ville.
  for (let i = 1; i < out.length; i++) {
    if (out[i - 1] !== 'ville' && out[i] !== out[i - 1]) {
      assert.equal(out[i], 'ville', `deux quartiers spéciaux différents collés en ${i}`);
    }
  }

  // 3. Longueurs : marché et quartier 2 tronçons, pont 3 (le dernier lot peut être coupé).
  const runs = [];
  for (const d of out) {
    if (runs.length && runs[runs.length - 1].id === d) runs[runs.length - 1].n++;
    else runs.push({ id: d, n: 1 });
  }
  for (const r of runs.slice(0, -1)) {
    if (r.id === 'marche' || r.id === 'quartier') assert.equal(r.n, DISTRICTS.specialLength, `${r.id} : ${r.n} tronçons`);
    if (r.id === 'pont') assert.equal(r.n, DISTRICTS.bridgeLength, `pont : ${r.n} tronçons`);
    assert.ok(r.n >= 1, 'tronçon vide');
  }

  // 4. La ville domine sans écraser le reste : les 4 ambiances sortent.
  const count = (id) => out.filter((d) => d === id).length;
  const ville = count('ville') / out.length;
  assert.ok(ville > 0.25 && ville < 0.75, `part de ville inhabituelle : ${ville.toFixed(2)}`);
  for (const id of ['marche', 'quartier', 'pont']) assert.ok(count(id) > 0, `${id} n'apparaît jamais`);

  // 4 bis. Les poids doivent faire 1 (sinon le pont récupère le reste, en silence).
  const sum = DISTRICTS.villeRun + DISTRICTS.marche + DISTRICTS.quartier + DISTRICTS.pont;
  assert.ok(Math.abs(sum - 1) < 1e-9, `poids des quartiers : ${sum}`);

  // 5. Reproductible : même hasard => même suite.
  const a = districtPlan(() => 0.9);
  const b = districtPlan(() => 0.9);
  for (let i = 0; i < 20; i++) assert.equal(a.next().value, b.next().value);

  console.log(
    `OK  quartiers : ${out.length} tronçons, ${Math.round(ville * 100)} % de ville, ` +
      `${runs.length} ambiances dont ${count('marche')} tronçons de marché, ` +
      `${count('quartier')} de quartier, ${count('pont')} de pont.`,
  );
}

// ---------- Lancement ----------
try {
  console.log('--- Collisions ---');
  testCollisions();
  testSpawnRule();
  console.log('\n--- Modèle 3D ---');
  testModelContract();
  console.log('\n--- Quartiers ---');
  testDistricts();
  console.log('\n--- Trafic : 5 minutes ---');
  run({ label: 'Parcours normal (5 min)', minutes: 5, speed: 20 });
  run({ label: 'Embouteillage (5 min)', minutes: 5, speed: 10, forcedLevel: 3 });
  console.log('\n--- Qualité éco ---');
  testEco();
  console.log('\nTous les tests passent.');
} catch (err) {
  console.error(`\nECHEC : ${err.message}`);
  process.exit(1);
}
