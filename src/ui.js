import { SKINS, UPGRADES, upgradeCost } from './config.js';
import { LEVEL_COUNT, allDone, levelAt } from './game/levels.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.floor(n).toLocaleString('fr-FR');
const SCREENS = ['menu', 'hud', 'pause', 'over', 'level', 'garage', 'settings'];

// Gère les écrans HTML (menu, HUD, pause, fin de partie, garage, paramètres).
// La logique du jeu est dans game/game.js ; ici on ne fait qu'afficher et relayer les boutons.
export class UI {
  constructor(save) {
    this.save = save;
    this.handlers = {};
    this.selectedStat = 'speed';
    this.cache = {};
    this.toastTimer = null;
    this._bind();
  }

  on(name, fn) {
    this.handlers[name] = fn;
  }
  emit(name, ...args) {
    this.handlers[name]?.(...args);
  }

  show(name) {
    for (const s of SCREENS) $(`screen-${s}`).classList.toggle('hidden', s !== name);
    $('toast').classList.remove('show');
    if (name !== 'hud') this.showHint(false);
    if (name === 'hud') this.cache = {}; // nouveau départ : on réaffiche tout le HUD
    document.body.dataset.screen = name;
  }

  _bind() {
    const click = (id, fn) => $(id).addEventListener('click', fn);
    click('btn-play', () => this.emit('play'));
    click('btn-garage', () => this.emit('garage'));
    click('btn-settings', () => {
      this.renderSettings();
      this.show('settings');
    });
    click('btn-pause', () => this.emit('pause'));
    click('pause-resume', () => this.emit('resume'));
    click('pause-end', () => this.emit('end'));
    click('over-retry', () => this.emit('play'));
    click('over-menu', () => this.emit('menu'));
    click('level-next', () => this.emit('play'));
    click('level-menu', () => this.emit('menu'));
    click('garage-back', () => this.emit('menu'));
    click('garage-prev', () => this.cycleSkin(-1));
    click('garage-next', () => this.cycleSkin(1));
    click('garage-upgrade', () => this.buyUpgrade());
    for (const id of ['nav-map', 'nav-shop', 'nav-profile']) click(id, () => this.toast('Bientôt disponible'));
    click('set-sound', () => {
      this.save.data.sound = !this.save.data.sound;
      this.save.write();
      this.emit('sound', this.save.data.sound);
      this.renderSettings();
    });
    click('set-quality', () => {
      this.save.data.quality = this.save.data.quality === 'eco' ? 'normal' : 'eco';
      this.save.write();
      this.emit('quality');
      this.renderSettings();
    });
    click('set-reset', () => {
      if (window.confirm('Effacer toute ta progression (argent, améliorations, peintures) ?')) {
        this.save.reset();
        this.emit('reset');
        this.renderSettings();
        this.toast('Progression effacée');
      }
    });
    click('set-back', () => this.emit('menu'));
  }

  // ----- Menu -----
  renderMenu() {
    const d = this.save.data;
    $('menu-best').textContent =
      d.bestDistance > 0 ? `Record : ${(d.bestDistance / 1000).toFixed(2).replace('.', ',')} km` : 'Prêt pour ta première course ?';
    const lv = Math.min(d.level, LEVEL_COUNT);
    $('menu-level').textContent = allDone(lv)
      ? `Tous les niveaux terminés · course libre`
      : `Niveau ${lv + 1} / ${LEVEL_COUNT} · ${levelAt(lv).name} — ${levelAt(lv).goal} passagers`;
  }

  // ----- HUD -----
  setCommune(name) {
    $('hud-commune').textContent = name;
  }
  updateHud(v) {
    const c = this.cache;
    if (c.speed !== v.speed) $('hud-speed').textContent = c.speed = v.speed;
    if (c.money !== v.money) $('hud-money').textContent = fmt((c.money = v.money));
    if (c.pax !== v.pax || c.cap !== v.cap) {
      $('hud-pax').textContent = `${(c.pax = v.pax)}/${(c.cap = v.cap)}`;
    }
    // Objectif du niveau (masqué en course libre : goal = 0).
    if (c.boarded !== v.boarded || c.goal !== v.goal) {
      $('hud-goal').textContent = `${(c.boarded = v.boarded)}/${(c.goal = v.goal)}`;
      $('hud-goal-pill').classList.toggle('hidden', v.goal <= 0);
    }
    if (c.damage !== v.damage) {
      c.damage = v.damage;
      $('hud-damage').style.width = `${v.damage}%`;
      $('hud-damage-txt').textContent = `${v.damage}%`;
      $('hud-damage').dataset.level = v.damage > 66 ? 'high' : v.damage > 33 ? 'mid' : 'low';
    }
  }
  showBubble(text, x, y) {
    const el = $('bubble');
    if (this.bubbleText !== text) {
      el.textContent = text;
      this.bubbleText = text;
    }
    const cx = Math.min(window.innerWidth - 90, Math.max(90, x));
    el.style.transform = `translate(${cx}px, ${y}px) translate(-50%, -115%)`;
    el.classList.remove('hidden');
  }
  hideBubble() {
    this.bubbleText = null;
    $('bubble').classList.add('hidden');
  }
  showHint(visible) {
    $('hint').classList.toggle('hidden', !visible);
  }
  toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('show'), 1900);
  }

  // ----- Fin de partie -----
  showOver(r) {
    $('over-distance').textContent = `${r.distanceKm.toFixed(2).replace('.', ',')} km`;
    $('over-pax').textContent = r.boarded;
    $('over-money').textContent = `${fmt(r.earned)} FCFA`;
    $('over-damage').textContent = `${r.damage}%`;
    const note = $('over-note');
    // On rappelle l'objectif du niveau pour que le joueur sache ce qui lui manquait.
    const lines = r.goal > 0 ? [`Objectif manqué : ${r.boarded} / ${r.goal} passagers`] : [];
    if (r.record) lines.push('Nouveau record !');
    for (const n of r.newly) lines.push(`Nouvelle peinture débloquée : ${n}`);
    note.textContent = lines.join(' · ');
    note.classList.toggle('hidden', lines.length === 0);
    this.cache = {};
    this.show('over');
  }

  // Objectif affiché dans la pause (et dans l'écran de fin si besoin).
  setPauseGoal(text) {
    const el = $('pause-goal');
    el.textContent = text || '';
    el.classList.toggle('hidden', !text);
  }

  // ----- Niveau réussi -----
  showLevel(r) {
    const done = r.allDone;
    $('level-title').textContent = done ? 'Tous les niveaux terminés !' : 'Niveau réussi !';
    $('level-banner').className = `banner ${done ? 'final' : 'win'}`;
    $('level-name').textContent = `Niveau ${r.levelNumber} · ${r.name}`;
    $('level-pax').textContent = `${r.boarded} / ${r.goal}`;
    $('level-distance').textContent = `${r.distanceKm.toFixed(2).replace('.', ',')} km`;
    $('level-money').textContent = `${fmt(r.earned)} FCFA`;
    $('level-bonus').textContent = `+ ${fmt(r.bonus)} FCFA`;
    $('level-damage').textContent = `${r.damage}%`;
    $('level-next').textContent = done ? 'Course libre' : 'Niveau suivant';

    const lines = [];
    if (r.record) lines.push('Nouveau record !');
    if (r.nextName) lines.push(`Prochain niveau : ${r.nextName}`);
    if (r.freeRunUnlocked) lines.push('Course libre débloquée : roule aussi loin que possible !');
    for (const n of r.newly) lines.push(`Nouvelle peinture débloquée : ${n}`);
    const note = $('level-note');
    note.textContent = lines.join(' · ');
    note.classList.toggle('hidden', lines.length === 0);
    this.cache = {};
    this.show('level');
  }

  // ----- Garage -----
  unlocked(skin) {
    return this.save.data.totalKm >= skin.unlockKm;
  }
  cycleSkin(dir) {
    const list = SKINS.filter((s) => this.unlocked(s));
    const i = Math.max(0, list.findIndex((s) => s.id === this.save.data.skin));
    const next = list[(i + dir + list.length) % list.length];
    this.emit('skin', next.id);
    this.renderGarage();
  }
  buyUpgrade() {
    const d = this.save.data;
    const key = this.selectedStat;
    const lvl = d.upgrades[key];
    if (lvl >= UPGRADES[key].max) return;
    const cost = upgradeCost(lvl);
    if (d.money < cost) {
      this.toast('Pas assez de FCFA');
      return;
    }
    d.money -= cost;
    d.upgrades[key] = lvl + 1;
    this.save.write();
    this.renderGarage();
    this.toast(`${UPGRADES[key].label} améliorée`);
  }
  renderGarage() {
    const d = this.save.data;
    $('garage-money').textContent = fmt(d.money);
    const cur = SKINS.find((s) => s.id === d.skin) || SKINS[0];
    $('garage-skin').textContent = cur.name;

    const stats = $('garage-stats');
    stats.innerHTML = '';
    for (const key of Object.keys(UPGRADES)) {
      const u = UPGRADES[key];
      const lvl = d.upgrades[key];
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'stat-row' + (key === this.selectedStat ? ' selected' : '');
      let segs = '';
      for (let i = 0; i < u.max; i++) segs += `<i class="${i < lvl ? 'on' : ''}"></i>`;
      row.innerHTML = `<span class="stat-label">${u.label}</span><span class="stat-bar">${segs}</span><span class="stat-lvl">${lvl}/${u.max}</span>`;
      row.addEventListener('click', () => {
        this.selectedStat = key;
        this.renderGarage();
      });
      stats.appendChild(row);
    }

    const key = this.selectedStat;
    const lvl = d.upgrades[key];
    const btn = $('garage-upgrade');
    if (lvl >= UPGRADES[key].max) {
      btn.textContent = 'Niveau maximum';
      btn.disabled = true;
    } else {
      const cost = upgradeCost(lvl);
      btn.textContent = `Améliorer : ${fmt(cost)} FCFA`;
      btn.disabled = d.money < cost;
    }

    const slots = $('garage-skins');
    slots.innerHTML = '';
    for (const s of SKINS) {
      const open = this.unlocked(s);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'skin-slot' + (s.id === d.skin ? ' selected' : '') + (open ? '' : ' locked');
      b.style.setProperty('--skin', s.body);
      b.setAttribute('aria-label', open ? s.name : `${s.name}, verrouillée`);
      b.innerHTML = open
        ? '<span class="dot"></span>'
        : `<span class="lock"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-7-2a2 2 0 0 1 4 0v2h-4Z"/></svg><small>${s.unlockKm} km</small></span>`;
      b.addEventListener('click', () => {
        if (!open) {
          this.toast(`Débloquée à ${s.unlockKm} km au total`);
          return;
        }
        this.emit('skin', s.id);
        this.renderGarage();
      });
      slots.appendChild(b);
    }
  }

  // ----- Paramètres -----
  renderSettings() {
    const d = this.save.data;
    $('set-sound').textContent = `Son : ${d.sound ? 'oui' : 'non'}`;
    $('set-quality').textContent = `Qualité : ${d.quality === 'eco' ? 'économique' : 'normale'}`;
  }
}
