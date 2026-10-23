// Test de bout en bout, sans navigateur : « objectif atteint » doit vraiment terminer le niveau.
// On fabrique un DOM minimal, on appelle les vraies méthodes de Game (levelComplete, gameOver,
// pause) puis on lit ce que l'interface a écrit. C'est le test qui aurait attrapé le bug
// « 10 passagers mais la course ne s'arrête jamais ».
// Lancement : npm test
import assert from 'node:assert/strict';

// Canvas minimal (le décor crée des textures au chargement du module, sans les dessiner).
const ctx = new Proxy({}, { get: (_t, k) => (k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}) });

// DOM minimal : chaque getElementById renvoie un objet mémorisé, avec ce que l'UI utilise.
const nodes = new Map();
const node = (id) => {
  if (!nodes.has(id)) {
    const el = {
      id,
      textContent: '',
      innerHTML: '',
      className: '',
      style: { setProperty() {} },
      dataset: {},
      classList: {
        _s: new Set(),
        toggle(c, on) {
          if (on ?? !this._s.has(c)) this._s.add(c);
          else this._s.delete(c);
        },
        add(c) { this._s.add(c); },
        remove(c) { this._s.delete(c); },
        contains(c) { return this._s.has(c); },
      },
      addEventListener() {},
      appendChild() {},
      setAttribute() {},
    };
    nodes.set(id, el);
  }
  return nodes.get(id);
};
globalThis.document = {
  body: { dataset: {} },
  createElement: (tag) => (tag === 'canvas' ? { width: 0, height: 0, getContext: () => ctx } : node(`new-${nodes.size}`)),
  getElementById: (id) => node(id),
};
globalThis.window = {
  location: { search: '' },
  innerWidth: 390,
  innerHeight: 844,
  devicePixelRatio: 2,
  addEventListener() {},
};

const { Game } = await import('../src/game/game.js');
const { UI } = await import('../src/ui.js');
const { LEVELS } = await import('../src/config.js');

const save = {
  data: { money: 1000, totalKm: 0, bestDistance: 0, level: 0, skin: 'maestro', sound: true, quality: 'normal' },
  write() {},
};
const ui = new UI(save);

// Un « jeu » réduit à ce dont les écrans de fin ont besoin.
const makeGame = (levelIndex = 0) => {
  const g = Object.create(Game.prototype);
  g.save = save;
  g.sound = { silence() {} };
  g.ui = ui;
  g.mode = 'playing';
  g.endless = false;
  g.levelIndex = levelIndex;
  g.z = -1800; // 1,8 km
  g.runMoney = 1234.4;
  g.boarded = LEVELS[levelIndex].goal;
  g.damage = 12.4;
  return g;
};

function testGoalOnHud() {
  ui.renderMenu();
  assert.equal(
    node('menu-level').textContent,
    `Niveau 1 / ${LEVELS.length} · ${LEVELS[0].name} — ${LEVELS[0].goal} passagers`,
  );

  ui.updateHud({ speed: 40, money: 3500, pax: 4, cap: 8, damage: 12, boarded: 3, goal: LEVELS[0].goal });
  assert.equal(node('hud-goal').textContent, `3/${LEVELS[0].goal}`, 'objectif affiché dans le HUD');
  assert.equal(node('hud-goal-pill').classList.contains('hidden'), false, 'pastille objectif visible');

  // Course libre : plus d'objectif (goal = 0), la pastille disparaît.
  ui.updateHud({ speed: 40, money: 3500, pax: 4, cap: 8, damage: 12, boarded: 30, goal: 0 });
  assert.equal(node('hud-goal-pill').classList.contains('hidden'), true, 'pas d’objectif en course libre');
  console.log('OK  HUD : objectif du niveau affiché (et masqué en course libre).');
}

function testLevelWin() {
  const money = save.data.money;
  const g = makeGame(0);
  g.levelComplete();
  assert.equal(g.mode, 'level', 'objectif atteint = niveau terminé (écran de bilan)');
  assert.equal(node('level-title').textContent, 'Niveau réussi !');
  assert.equal(node('level-name').textContent, `Niveau 1 · ${LEVELS[0].name}`);
  assert.equal(node('level-pax').textContent, `${LEVELS[0].goal} / ${LEVELS[0].goal}`);
  assert.equal(node('level-bonus').textContent, `+ ${LEVELS[0].reward.toLocaleString('fr-FR')} FCFA`);
  assert.equal(node('level-next').textContent, 'Niveau suivant', 'il y a un bouton pour continuer');
  assert.equal(save.data.level, 1, 'niveau suivant débloqué');
  assert.equal(save.data.money, money + 1234 + LEVELS[0].reward, 'argent de la course + prime');
  assert.ok(
    node('level-note').textContent.includes(`Prochain niveau : ${LEVELS[1].name}`),
    'le bilan annonce le niveau suivant',
  );

  ui.renderMenu();
  assert.equal(
    node('menu-level').textContent,
    `Niveau 2 / ${LEVELS.length} · ${LEVELS[1].name} — ${LEVELS[1].goal} passagers`,
    'le menu annonce le niveau suivant',
  );
  console.log('OK  niveau réussi : écran de bilan, prime versée, niveau suivant débloqué.');
}

function testLevelFail() {
  const level = save.data.level;
  const money = save.data.money;
  const g = makeGame(level);
  g.boarded = 3;
  g.gameOver();
  assert.equal(g.mode, 'over');
  assert.ok(
    node('over-note').textContent.includes(`Objectif manqué : 3 / ${LEVELS[level].goal}`),
    'objectif rappelé sur l’écran de fin',
  );
  assert.equal(save.data.level, level, 'un échec ne débloque rien');
  assert.equal(save.data.money, money + 1234, 'pas de prime en cas d’échec');

  // Pause en pleine course : l'objectif est rappelé.
  g.mode = 'playing';
  g.pause();
  assert.equal(g.mode, 'paused');
  assert.equal(node('pause-goal').textContent, `Objectif : 3 / ${LEVELS[level].goal} passagers`);
  console.log('OK  échec : objectif manqué affiché, pause qui rappelle l’objectif, rien n’est débloqué.');
}

function testLastLevel() {
  save.data.level = LEVELS.length - 1;
  const g = makeGame(LEVELS.length - 1);
  g.levelComplete();
  assert.equal(node('level-title').textContent, 'Tous les niveaux terminés !');
  assert.equal(node('level-next').textContent, 'Course libre', 'après le dernier niveau : course libre');
  assert.equal(save.data.level, LEVELS.length);
  assert.ok(node('level-note').textContent.includes('Course libre débloquée'), 'la course libre est annoncée');

  ui.renderMenu();
  assert.equal(node('menu-level').textContent, 'Tous les niveaux terminés · course libre');

  const free = makeGame(0);
  free.endless = true;
  assert.equal(free._goalText(), 'Course libre : roule le plus loin possible.');
  console.log('OK  dernier niveau : course libre débloquée, plus d’objectif.');
}

try {
  console.log('--- Parcours d’un niveau ---');
  testGoalOnHud();
  testLevelWin();
  testLevelFail();
  testLastLevel();
  console.log('\nTous les tests du parcours passent.');
} catch (err) {
  console.error(`\nECHEC : ${err.message}`);
  process.exit(1);
}
