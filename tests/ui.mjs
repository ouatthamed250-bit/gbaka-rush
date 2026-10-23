// Test de l'interface, sans navigateur : vérifie que chaque écran et chaque identifiant
// utilisé par src/ui.js existe bien dans index.html. Une faute de frappe casserait un bouton
// en silence (écran vide, bouton mort) ; ce test le voit tout de suite.
// Lancement : npm test
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ui = fs.readFileSync(path.join(root, 'src/ui.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// Tous les id="..." du HTML.
const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
// Tous les $('...') de ui.js.
const used = [...new Set([...ui.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]))];
// La liste SCREENS de ui.js -> les sections #screen-... attendues.
const screenList = ui.match(/const SCREENS = \[([^\]]+)\]/);
assert.ok(screenList, 'liste SCREENS introuvable dans ui.js');
const screens = [...screenList[1].matchAll(/'([^']+)'/g)].map((m) => `screen-${m[1]}`);

const missing = [...used, ...screens].filter((id) => !htmlIds.has(id));
assert.deepEqual(missing, [], `identifiants absents d'index.html : ${missing.join(', ')}`);

// Chaque écran doit avoir un bouton de sortie : menu, pause, fin de course, niveau réussi.
for (const id of ['over-retry', 'over-menu', 'pause-resume', 'pause-end', 'level-next', 'level-menu']) {
  assert.ok(htmlIds.has(id), `bouton manquant : ${id}`);
}

// Le HUD doit afficher l'objectif du niveau (passagers) et les compteurs de la course.
for (const id of ['hud-goal', 'hud-goal-pill', 'hud-pax', 'hud-money', 'hud-damage']) {
  assert.ok(htmlIds.has(id), `élément de HUD manquant : ${id}`);
}

console.log(`OK  interface : ${screens.length} écrans et ${used.length} identifiants branchés sur index.html.`);
