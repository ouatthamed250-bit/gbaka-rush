// Test des niveaux, sans navigateur : objectifs, progression, course libre, durée.
// Lancement : npm test
//
// Vérifie que chaque niveau a un objectif atteignable, que la progression ne recule jamais,
// que le dernier niveau débloque la course libre et qu'une course normale suffit à remplir
// chaque objectif (nombre d'arrêts et distance raisonnables).
import assert from 'node:assert/strict';
import { LEVELS, CHECKPOINT_FIRST, CHECKPOINT_EVERY } from '../src/config.js';
import {
  LEVEL_COUNT, levelIndex, levelAt, allDone, goalReached, afterWin, communeForDistance,
  bankLevelWin, bankRunLoss,
} from '../src/game/levels.js';

// ---------- 1. Réglages des niveaux ----------
function testSettings() {
  assert.ok(LEVEL_COUNT >= 3, `il faut au moins 3 niveaux (${LEVEL_COUNT})`);
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const l = LEVELS[i];
    assert.equal(typeof l.name, 'string', `niveau ${i} : nom manquant`);
    assert.ok(l.name.length > 0, `niveau ${i} : nom vide`);
    assert.ok(Number.isInteger(l.goal) && l.goal > 0, `${l.name} : objectif invalide`);
    assert.ok(l.reward > 0, `${l.name} : prime invalide`);
    assert.ok(l.density > 0 && l.density <= 1, `${l.name} : densité invalide`);
    assert.equal(l.carSpeed.length, 2, `${l.name} : carSpeed doit avoir 2 valeurs`);
    assert.ok(l.carSpeed[0] > 0 && l.carSpeed[0] < l.carSpeed[1], `${l.name} : vitesses invalides`);
    if (i === 0) {
      assert.equal(l.from, 0, 'le premier niveau commence au départ');
      continue;
    }
    // La progression doit se sentir : plus de passagers, plus de prime, plus de trafic, plus loin.
    assert.ok(l.goal > LEVELS[i - 1].goal, `${l.name} : objectif trop facile`);
    assert.ok(l.reward > LEVELS[i - 1].reward, `${l.name} : prime trop faible`);
    assert.ok(l.density >= LEVELS[i - 1].density, `${l.name} : trafic trop léger`);
    assert.ok(l.from > LEVELS[i - 1].from, `${l.name} : distance de course libre mal ordonnée`);
  }
  console.log(
    `OK  réglages : ${LEVEL_COUNT} niveaux, objectifs ${LEVELS.map((l) => l.goal).join(' / ')} passagers.`,
  );
}

// ---------- 2. Objectif ----------
function testGoal() {
  assert.equal(goalReached(0, 0), false, 'départ à zéro');
  assert.equal(goalReached(0, LEVELS[0].goal - 1), false, 'un passager de moins = objectif non atteint');
  assert.equal(goalReached(0, LEVELS[0].goal), true, 'objectif atteint pile');
  assert.equal(goalReached(0, LEVELS[0].goal + 5), true, 'objectif dépassé');
  console.log(`OK  objectif : ${LEVELS[0].goal} passagers pour réussir ${LEVELS[0].name}.`);
}

// ---------- 3. Progression sauvegardée ----------
function testProgression() {
  let saved = 0;
  for (let i = 0; i < LEVEL_COUNT; i++) {
    assert.equal(saved, i, `avant le niveau ${i + 1}, la sauvegarde doit valoir ${i}`);
    assert.equal(allDone(saved), false, `niveau ${i + 1} : la partie ne doit pas être finie`);
    saved = afterWin(saved, i);
  }
  assert.equal(saved, LEVEL_COUNT, 'après le dernier niveau, la sauvegarde vaut LEVEL_COUNT');
  assert.ok(allDone(saved), 'tous les niveaux terminés = course libre');

  // Rejouer un ancien niveau ne fait jamais reculer la progression.
  assert.equal(afterWin(3, 0), 3, 'rejouer le niveau 1 ne rebloque pas les suivants');
  assert.equal(afterWin(LEVEL_COUNT, 0), LEVEL_COUNT, 'la course libre reste débloquée');
  // ... et on ne dépasse jamais la fin de la liste.
  assert.equal(afterWin(0, 99), LEVEL_COUNT);
  assert.equal(afterWin(-5, 0), 1);
  console.log('OK  progression : niveau suivant débloqué à chaque réussite, jamais de recul.');
}

// ---------- 4. Index et course libre ----------
function testIndex() {
  assert.equal(levelIndex(-3), 0);
  assert.equal(levelIndex(0), 0);
  assert.equal(levelIndex(LEVEL_COUNT - 1), LEVEL_COUNT - 1);
  assert.equal(levelIndex(LEVEL_COUNT), LEVEL_COUNT - 1);
  assert.equal(levelIndex(99), LEVEL_COUNT - 1);
  assert.equal(levelIndex(NaN), 0);
  assert.equal(levelAt(99).name, LEVELS[LEVEL_COUNT - 1].name);

  assert.equal(communeForDistance(0), 0);
  assert.equal(communeForDistance(-50), 0);
  for (let i = 1; i < LEVEL_COUNT; i++) {
    assert.equal(communeForDistance(LEVELS[i].from - 1), i - 1, `${LEVELS[i].name} : arrivée trop tôt`);
    assert.equal(communeForDistance(LEVELS[i].from), i, `${LEVELS[i].name} : jamais atteinte`);
  }
  assert.equal(communeForDistance(1e9), LEVEL_COUNT - 1);
  console.log('OK  course libre : le trafic s’épaissit à chaque palier de distance.');
}

// ---------- 5. Une course normale suffit ----------
function testPlaythrough() {
  // Même formule que game.js : 0 à 2 descentes, 1 à 3 montées, plafond de capacité.
  // Capacité de départ (8), sans amélioration : c'est le pire cas pour le joueur.
  let seed = 2024;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const capacity = 8;
  const lines = [];
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const goal = LEVELS[i].goal;
    let pax = 1;
    let boarded = 0;
    let stops = 0;
    while (boarded < goal && stops < 40) {
      const leave = Math.min(pax, Math.floor(rand() * 3));
      const board = 1 + Math.floor(rand() * 3);
      const after = Math.min(capacity, pax - leave + board);
      boarded += Math.max(0, after - (pax - leave));
      pax = after;
      stops++;
    }
    assert.ok(boarded >= goal, `${LEVELS[i].name} : objectif impossible (${boarded} / ${goal})`);
    assert.ok(stops <= 20, `${LEVELS[i].name} : ${stops} arrêts, c'est trop long`);
    const km = (CHECKPOINT_FIRST + (stops - 1) * CHECKPOINT_EVERY) / 1000;
    lines.push(`${LEVELS[i].name} ${stops} arrêts (${km.toFixed(1)} km)`);
  }
  console.log(`OK  course normale, capacité ${capacity} : ${lines.join(', ')}.`);
}

// ---------- 6. Encaissement (sauvegarde) ----------
function testBanking() {
  // Niveau réussi : argent de la course + prime, kilomètres, record, niveau suivant.
  const data = { money: 1000, totalKm: 4.5, bestDistance: 2000, level: 0 };
  const win = bankLevelWin(data, 0, { earned: 1234, distance: 1800 });
  assert.equal(data.money, 1000 + 1234 + LEVELS[0].reward, 'argent + prime');
  assert.ok(Math.abs(data.totalKm - 6.3) < 1e-9, `kilomètres cumulés : ${data.totalKm}`);
  assert.equal(data.bestDistance, 2000, 'le record ne baisse pas');
  assert.equal(win.record, false, '1,8 km ne bat pas 2 km');
  assert.equal(win.bonus, LEVELS[0].reward);
  assert.equal(data.level, 1, 'niveau suivant débloqué');
  assert.equal(win.nextName, LEVELS[1].name);
  assert.equal(win.allDone, false);
  assert.equal(win.freeRunUnlocked, false);

  // Course ratée : l'argent de la course est gardé, rien n'est débloqué.
  const money = data.money;
  const loss = bankRunLoss(data, { earned: 500, distance: 5000 });
  assert.equal(data.money, money + 500, 'pas de prime quand on rate');
  assert.equal(data.level, 1, 'une course ratée ne débloque rien');
  assert.equal(loss.record, true, 'le record se met à jour');
  assert.equal(data.bestDistance, 5000);

  // Dernier niveau : la course libre s'annonce une seule fois.
  const last = { money: 0, totalKm: 0, bestDistance: 0, level: LEVEL_COUNT - 1 };
  const first = bankLevelWin(last, LEVEL_COUNT - 1, { earned: 0, distance: 100 });
  assert.equal(last.level, LEVEL_COUNT, 'tous les niveaux terminés');
  assert.equal(first.allDone, true);
  assert.equal(first.nextName, null, 'plus de niveau suivant');
  assert.equal(first.freeRunUnlocked, true);
  const again = bankLevelWin(last, LEVEL_COUNT - 1, { earned: 0, distance: 100 });
  assert.equal(again.freeRunUnlocked, false, 'message de déblocage affiché une seule fois');
  // Rejouer un ancien niveau ne rebloque pas la course libre.
  assert.equal(bankLevelWin(last, 0, { earned: 0, distance: 100 }).allDone, true);
  assert.equal(last.level, LEVEL_COUNT);

  // Toutes les primes sont positives : réussir un niveau ne fait jamais perdre d'argent.
  assert.ok(LEVELS.every((l) => l.reward > 0), 'primes positives');
  console.log('OK  encaissement : prime versée une fois, record conservé, progression bloquée en cas d’échec.');
}

try {
  console.log('--- Niveaux ---');
  testSettings();
  testGoal();
  testProgression();
  testIndex();
  testPlaythrough();
  testBanking();
  console.log('\nTous les tests des niveaux passent.');
} catch (err) {
  console.error(`\nECHEC : ${err.message}`);
  process.exit(1);
}
