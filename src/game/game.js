import * as THREE from 'three';
import {
  ROAD, LEVELS, SKINS, UPGRADES, DISTRICTS,
  CHECKPOINT_FIRST, CHECKPOINT_EVERY, FARE_PER_M_PER_PASSENGER, clamp,
} from '../config.js';
import { World } from './world.js';
import { Gbaka, Smoke } from './gbaka.js';
import { Traffic } from './traffic.js';
import { People } from './people.js';
import { carHitsPlayer } from './rules.js';
import { levelAt, levelIndex, allDone, goalReached, communeForDistance, bankLevelWin, bankRunLoss } from './levels.js';
import { sectorOfLevel, quartierAt, stopLabel } from './sectors.js';
import { FpsMeter } from '../perf.js';

const _v = new THREE.Vector3();

// Lumière de chaque commune : soleil plus blanc et plus franc au Plateau, plus chaud et plus
// bas à Yopougon et Adjamé, lumière verte sous les arbres de Cocody.
const LIGHTING = {
  yopougon: { sun: 0.9, sunColor: 0xfff0cc, hemi: 1.3, sky: 0xffffff, ground: 0xc08a55, angle: 0 },
  adjame: { sun: 0.95, sunColor: 0xffe9c0, hemi: 1.22, sky: 0xfff4e0, ground: 0xa8794f, angle: 1 },
  plateau: { sun: 1.05, sunColor: 0xfff8e8, hemi: 1.12, sky: 0xdcefff, ground: 0x9b9b92, angle: 2 },
  treichville: { sun: 0.88, sunColor: 0xffeccc, hemi: 1.2, sky: 0xe6eef0, ground: 0x9d8a6a, angle: 3 },
  cocody: { sun: 1.0, sunColor: 0xfff6d8, hemi: 1.32, sky: 0xe8fff2, ground: 0x8f9c6a, angle: 4 },
};

export const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];

export function playerStats(save) {
  const u = save.data.upgrades;
  const v = (k) => UPGRADES[k].base + UPGRADES[k].step * u[k];
  return { maxSpeed: v('speed'), accel: v('accel'), brake: v('brake'), capacity: v('capacity') };
}

export class Game {
  constructor(canvas, save, sound, input, ui) {
    this.canvas = canvas;
    this.save = save;
    this.sound = sound;
    this.input = input;
    this.ui = ui;
    // Compteur d'images (seulement avec ?debug dans l'adresse) + qualité éco automatique.
    this.autoEco = false;
    const debug = new URLSearchParams(window.location.search).has('debug');
    this.perf = new FpsMeter({ debug, onLow: () => this._autoEco() });

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 230);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xc08a55, 1.25);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d0, 0.85);
    this.sun.position.set(-20, 40, 30);
    this.scene.add(this.sun);

    this.loader = new THREE.TextureLoader();
    this.world = new World(this.scene);
    this.traffic = new Traffic(this.scene);
    this.people = new People(this.scene);
    this.people.setVisible(false);
    this.gbaka = new Gbaka(this.scene, this.loader);
    this.gbaka.setSkin(skinById(save.data.skin));
    this.smoke = new Smoke(this.scene);

    this.mode = 'menu'; // menu | garage | playing | paused | over
    this.t = 0;
    this.stats = playerStats(save);
    this.x = 0; this.z = 0; this.speed = 0; this.camX = 0;
    this.damage = 0; this.passengers = 0; this.boarded = 0; this.runMoney = 0;
    this.nextCheckpoint = CHECKPOINT_FIRST; this.levelIndex = 0;
    this.endless = false; // course libre (après le dernier niveau)
    this.invuln = 0; this.shake = 0; this.honkCd = 0;
    this.district = 'ville';
    this.sector = null; // commune jouée (SECTORS) : décor, foule, cris de l'apprenti
    this.quartier = ''; // quartier du prochain arrêt
    this.stopIndex = 0;
    this._apprenti = null; // apprenti déjà mis au courant de la commune (voir _syncApprenti)

    this.applyQuality();
    window.addEventListener('resize', () => this.resize());
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  isEco() {
    return this.autoEco || this.save.data.quality === 'eco';
  }
  applyQuality() {
    const eco = this.isEco();
    this.renderer.setPixelRatio(eco ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
    this.traffic.setEco(eco, this.z);
    this.resize();
  }
  // Changement manuel dans les paramètres : il annule la qualité éco automatique.
  setQuality() {
    this.autoEco = false;
    this.applyQuality();
  }
  // Appelé par le compteur si la fluidité reste sous 30 i/s pendant 3 s.
  _autoEco() {
    if (this.mode !== 'playing' || this.isEco()) return;
    this.autoEco = true;
    this.applyQuality();
    this.ui.toast('Qualité éco : jeu plus fluide');
  }
  _perfExtra() {
    return `${this.isEco() ? 'éco' : 'normale'} · trafic ${this.traffic.activeCount()} · ${this.world.district}`;
  }
  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------- Modes visuels ----------
  _playVisuals() {
    this.world.applyEnvironment(this.scene);
    this.world.group.visible = true;
    this.people.setVisible(true);
  }
  _garageVisuals() {
    this.scene.background = null;
    this.scene.fog = null;
    this.world.group.visible = false;
    this.people.setVisible(false);
    this.traffic.reset();
    this.smoke.clear();
    this.gbaka.group.position.set(0, 0, 0);
    this.gbaka.group.rotation.set(0, 0.7, 0);
    this.camera.fov = 60;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 3.4, 15);
    this.camera.lookAt(0, -0.6, 0);
  }

  // ---------- Commune (secteur) ----------
  // Applique la commune du niveau : décor (world), foule (people), trafic (motos), cris de
  // l'apprenti, lumière et HUD. Le premier arrêt du niveau est dans son premier quartier.
  _useSector(index) {
    const sector = sectorOfLevel(index);
    this.world.setSector(sector);
    this.world.applyEnvironment(this.scene);
    this.people.setSector(sector, this.z);
    this.traffic.setSector(sector);
    this.sector = sector;
    this.stopIndex = 0;
    this.quartier = quartierAt(sector, 0);
    this._apprenti = null; // le gbaka a pu reconstruire son apprenti : on le remet au courant
    this._syncApprenti();
    this.ui.setPlace(sector.name, this.quartier);
    this._applySectorLight(sector);
    return sector;
  }

  // Le gbaka reconstruit son apprenti à chaque changement de peinture (et quand le vrai modèle
  // 3D finit de charger) : cet apprenti neuf doit récupérer la commune et le quartier en cours,
  // sinon il se remettrait à crier des destinations génériques.
  _syncApprenti() {
    const a = this.gbaka?.apprenti;
    if (!a || a === this._apprenti) return;
    this._apprenti = a;
    a.setSector(this.sector);
    a.setQuartier(this.quartier);
  }

  _applySectorLight(sector) {
    const l = LIGHTING[sector?.look] || LIGHTING.yopougon;
    this.sun.intensity = l.sun;
    this.sun.color.set(l.sunColor);
    this.sun.position.set(-24 + l.angle * 7, 40 + l.angle * 2, 30 - l.angle * 4);
    this.hemi.intensity = l.hemi;
    this.hemi.color.set(l.sky);
    this.hemi.groundColor.set(l.ground);
  }

  // ---------- Garage ----------
  openGarage() {
    this.mode = 'garage';
    this.sound.silence();
    this.gbaka.setSkin(skinById(this.save.data.skin));
    this._garageVisuals();
    this.ui.renderGarage();
    this.ui.show('garage');
  }
  setSkin(id) {
    this.save.data.skin = id;
    this.save.write();
    this.gbaka.setSkin(skinById(id));
  }
  toMenu() {
    this.mode = 'menu';
    this.sound.silence();
    this.ui.renderMenu();
    this.ui.show('menu');
  }

  // ---------- Course ----------
  // Démarre le niveau en cours (`save.data.level`). Si tous les niveaux sont terminés,
  // « Jouer » lance la course libre : plus d'objectif, le trafic s'épaissit avec la distance.
  startRun(opts = {}) {
    const d = this.save.data;
    this.endless = opts.endless ?? allDone(d.level);
    this.levelIndex = this.endless ? 0 : levelIndex(d.level);
    const level = levelAt(this.levelIndex);
    this.stats = playerStats(this.save);
    this._playVisuals();
    // Commune du niveau : décor, foule, taxis-motos, lumière et cris de l'apprenti changent ici.
    this._useSector(this.levelIndex);
    this.world.reset();
    this.traffic.reset();
    this.people.reset(0);
    this.smoke.clear();
    this.gbaka.setSkin(skinById(d.skin));
    // La peinture reconstruit le gbaka (et son apprenti) : on lui redonne la commune du niveau.
    this._syncApprenti();
    this.gbaka.group.rotation.set(0, 0, 0);
    this.x = 0; this.z = 0; this.speed = 0; this.camX = 0;
    this.damage = 0; this.runMoney = 0;
    // Le gbaka démarre avec un passager déjà à bord, mais l'objectif ne compte que les montées.
    this.passengers = Math.min(1, this.stats.capacity);
    this.boarded = 0;
    this.nextCheckpoint = CHECKPOINT_FIRST;
    this.invuln = 0; this.shake = 0; this.honkCd = 0;
    this.district = 'ville';
    this.input.reset();
    this.mode = 'playing';
    this.perf.reset();
    this.ui.setPlace(level.name, this.quartier);
    this.ui.setPauseGoal(this._goalText());
    this.ui.show('hud');
    this.ui.toast(
      this.endless
        ? 'Course libre ! Roule le plus loin possible'
        : `Niveau ${this.levelIndex + 1} · ${level.name} — ${level.goal} passagers à transporter`,
    );
    if (!this.save.data.tutorialDone) {
      this.ui.showHint(true);
      this.input.onFirstPress = () => {
        this.ui.showHint(false);
        this.save.data.tutorialDone = true;
        this.save.write();
      };
    }
    this.camera.fov = 58;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 4.4, 9.6);
    this.camera.lookAt(0, 1.6, -16);
  }
  // Texte d'objectif (pause) : « Objectif : 6 / 10 passagers ».
  _goalText() {
    if (this.endless) return 'Course libre : roule le plus loin possible.';
    const level = levelAt(this.levelIndex);
    return `Objectif : ${this.boarded} / ${level.goal} passagers`;
  }

  pause() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.sound.silence();
    this.ui.setPauseGoal(this._goalText());
    this.ui.show('pause');
  }
  resume() {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    this.input.reset();
    this.ui.show('hud');
  }
  // Fin de course (dégâts à 100 % ou bouton « Terminer la course ») : le niveau reste à refaire.
  gameOver() {
    if (this.mode !== 'playing' && this.mode !== 'paused') return;
    this.mode = 'over';
    this.sound.silence();
    this.ui.hideBubble();
    const d = this.save.data;
    const dist = -this.z;
    const earned = Math.floor(this.runMoney);
    const before = d.totalKm;
    const { record } = bankRunLoss(d, { earned, distance: dist });
    this.save.write();
    const newly = SKINS.filter((s) => s.unlockKm > before && s.unlockKm <= d.totalKm).map((s) => s.name);
    this.ui.showOver({
      distanceKm: dist / 1000,
      boarded: this.boarded,
      earned,
      damage: Math.round(this.damage),
      newly,
      record,
      goal: this.endless ? 0 : levelAt(this.levelIndex).goal,
    });
  }

  // Objectif atteint : prime + argent de la course, niveau suivant débloqué, écran de bilan.
  levelComplete() {
    if (this.mode !== 'playing') return;
    this.mode = 'level';
    this.sound.silence();
    this.ui.hideBubble();
    const d = this.save.data;
    const dist = -this.z;
    const earned = Math.floor(this.runMoney);
    const before = d.totalKm;
    const win = bankLevelWin(d, this.levelIndex, { earned, distance: dist });
    this.save.write();
    const newly = SKINS.filter((s) => s.unlockKm > before && s.unlockKm <= d.totalKm).map((s) => s.name);
    this.ui.showLevel({
      levelNumber: this.levelIndex + 1,
      name: win.level.name,
      goal: win.level.goal,
      boarded: this.boarded,
      distanceKm: dist / 1000,
      earned,
      bonus: win.bonus,
      damage: Math.round(this.damage),
      newly,
      record: win.record,
      allDone: win.allDone,
      nextName: win.nextName,
      freeRunUnlocked: win.freeRunUnlocked,
    });
  }

  _hit(c) {
    if (this.invuln > 0) return;
    const rel = Math.max(0, this.speed - c.speed);
    this.damage = Math.min(100, this.damage + 6 + rel * 1.6);
    this.speed = Math.min(this.speed, c.speed * 0.6);
    this.x = clamp(this.x + (this.x >= c.x ? 0.8 : -0.8), -ROAD.playerLimit, ROAD.playerLimit);
    c.z -= 2.5;
    this.invuln = 0.9;
    this.shake = 0.5;
    this.sound.crash();
    navigator.vibrate?.(70);
    if (this.passengers > 0 && Math.random() < 0.5) {
      this.passengers--;
      this.ui.toast('Un passager est descendu !');
    }
    if (this.damage >= 100) this.gameOver();
  }

  _updatePlay(dt) {
    const st = this.stats;
    const throttle = this.input.isDown();
    const braking = this.input.brakeActive();

    if (throttle) this.speed = Math.min(st.maxSpeed, this.speed + st.accel * dt * (1 - 0.5 * (this.speed / st.maxSpeed)));
    else if (braking) this.speed = Math.max(0, this.speed - st.brake * dt);
    else this.speed = Math.max(0, this.speed - 2.2 * dt);

    const authority = 0.25 + 0.75 * Math.min(1, this.speed / 5);
    const dx = this.input.consumeDx(dt) * (ROAD.asphaltWidth / Math.max(320, window.innerWidth)) * 1.1 * authority;
    const prevX = this.x;
    this.x = clamp(this.x + dx, -ROAD.playerLimit, ROAD.playerLimit);
    const steerVel = (this.x - prevX) / Math.max(dt, 0.001);

    this.z -= this.speed * dt;
    const dist = -this.z;

    // Commune : en course libre, le trafic s'épaissit avec la distance ; sinon c'est le niveau joué.
    // En course libre, on change aussi de décor (et de quartiers) en entrant dans la commune.
    if (this.endless) {
      const li = communeForDistance(dist);
      if (li !== this.levelIndex) {
        this.levelIndex = li;
        this._useSector(li);
        this.ui.toast(`Bienvenue à ${this.sector.name}`);
      }
    }
    const level = levelAt(this.levelIndex);

    this.world.update(this.z);
    // Quartier traversé : on l'annonce une seule fois, à l'entrée (pas de message pour la ville).
    if (this.world.district !== this.district) {
      this.district = this.world.district;
      const label = DISTRICTS.labels[this.district];
      if (label) this.ui.toast(label);
    }
    this.people.update(dt, this.z, this.t);
    this.traffic.update(dt, this.z, level, this.t);

    // Collisions
    if (this.invuln > 0) this.invuln -= dt;
    for (const c of this.traffic.cars) {
      if (!c.active) continue;
      if (carHitsPlayer(this.x, this.z, c)) {
        this._hit(c);
        break;
      }
    }
    if (this.mode !== 'playing') return;

    // Klaxon automatique quand on arrive vite sur une voiture
    this.honkCd -= dt;
    if (this.honkCd <= 0 && this.speed > 6) {
      for (const c of this.traffic.cars) {
        const ahead = this.z - c.z;
        if (c.active && ahead > 3 && ahead < 12 && Math.abs(c.x - this.x) < 2.2 && this.speed > c.speed + 3) {
          this.sound.honk();
          this.honkCd = 2.5;
          break;
        }
      }
    }

    // Arrêts de gbaka : des passagers descendent et montent. À chaque arrêt, on change de
    // quartier du secteur : l'apprenti appelle celui où le gbaka va s'arrêter maintenant.
    if (dist >= this.nextCheckpoint) {
      this.nextCheckpoint += CHECKPOINT_EVERY;
      const arrived = this.quartier;
      const leave = Math.min(this.passengers, Math.floor(Math.random() * 3));
      const board = 1 + Math.floor(Math.random() * 3);
      const after = Math.min(st.capacity, this.passengers - leave + board);
      const gained = Math.max(0, after - (this.passengers - leave));
      this.passengers = after;
      this.boarded += gained;
      this.stopIndex += 1;
      this.quartier = quartierAt(this.sector, this.stopIndex);
      this.gbaka.apprenti?.setQuartier(this.quartier);
      this.ui.setPlace(this.sector.name, this.quartier);
      this.ui.toast(
        gained > 0
          ? `${stopLabel(arrived)} : +${gained} passager${gained > 1 ? 's' : ''}`
          : `${stopLabel(arrived)} : gbaka plein`,
      );
    }

    // Objectif du niveau atteint : on termine ici (bilan, prime, niveau suivant).
    if (!this.endless && goalReached(this.levelIndex, this.boarded)) {
      this.levelComplete();
      return;
    }

    // Argent : les passagers paient au fil des mètres
    this.runMoney += this.passengers * this.speed * dt * FARE_PER_M_PER_PASSENGER;

    // Gbaka, fumée, caméra
    this.gbaka.group.position.set(this.x, 0, this.z);
    this.gbaka.update(dt, this.t, this.speed, steerVel, throttle, braking, this.passengers >= st.capacity);
    this.smoke.update(dt, throttle ? 12 + this.speed * 0.9 : 4, this.gbaka.exhaustWorld());

    this.camX += (this.x * 0.7 - this.camX) * (1 - Math.exp(-6 * dt));
    let sx = 0;
    let sy = 0;
    if (this.shake > 0) {
      this.shake -= dt;
      sx = (Math.random() - 0.5) * 0.5 * this.shake;
      sy = (Math.random() - 0.5) * 0.4 * this.shake;
    }
    this.camera.position.set(this.camX + sx, 4.4 + sy, this.z + 9.6 + this.speed * 0.04);
    this.camera.lookAt(this.x * 0.5, 1.6, this.z - 16);
    const fov = 58 + (this.speed / st.maxSpeed) * 8;
    if (Math.abs(fov - this.camera.fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    this._syncApprenti();
    this._updateBubble();
    this.sound.update(this.speed / st.maxSpeed, throttle ? 1 : 0, true);
    this.ui.updateHud({
      speed: Math.round(this.speed * 3.6),
      money: Math.floor(this.runMoney),
      pax: this.passengers,
      cap: st.capacity,
      damage: Math.round(this.damage),
      boarded: this.boarded,
      goal: this.endless ? 0 : level.goal,
    });
  }

  // Bulle de texte au-dessus de l'apprenti quand il crie une destination
  _updateBubble() {
    const a = this.gbaka.apprenti;
    if (!a || !a.showing || a.out < 0.5) {
      this.ui.hideBubble();
      return;
    }
    this.camera.updateMatrixWorld();
    this.gbaka.group.updateMatrixWorld(true);
    _v.set(0.5, 2.7, 0);
    a.group.localToWorld(_v);
    _v.project(this.camera);
    this.ui.showBubble(a.text, (_v.x * 0.5 + 0.5) * window.innerWidth, (-_v.y * 0.5 + 0.5) * window.innerHeight);
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    this.t += dt;
    if (this.mode === 'menu') return; // rien à dessiner derrière le menu
    if (this.mode === 'playing') this._updatePlay(dt);
    else if (this.mode === 'garage') this.gbaka.group.rotation.y += dt * 0.7;
    this.renderer.render(this.scene, this.camera);
    if (this.mode === 'playing') this.perf.frame(dt, this._perfExtra());
  }
}
