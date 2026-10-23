import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/800.css';
import './styles.css';
import { Save } from './save.js';
import { Sound } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Game } from './game/game.js';

const save = new Save();
const sound = new Sound();
sound.setEnabled(save.data.sound);
const ui = new UI(save);
ui.renderMenu();
ui.show('menu');

try {
  const canvas = document.getElementById('game');
  const input = new Input(canvas);
  const game = new Game(canvas, save, sound, input, ui);

  ui.on('play', () => {
    sound.unlock();
    game.startRun();
  });
  ui.on('garage', () => game.openGarage());
  ui.on('menu', () => game.toMenu());
  ui.on('pause', () => game.pause());
  ui.on('resume', () => game.resume());
  ui.on('end', () => game.gameOver());
  ui.on('skin', (id) => game.setSkin(id));
  ui.on('sound', (v) => sound.setEnabled(v));
  ui.on('quality', () => game.setQuality());
  ui.on('reset', () => game.setSkin(save.data.skin));

  // Met le jeu en pause quand l'onglet est caché (appel, changement d'appli)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.pause();
  });
} catch (err) {
  console.error(err);
  document.getElementById('fatal').classList.remove('hidden');
}
