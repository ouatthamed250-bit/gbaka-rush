import * as THREE from 'three';
import { ROAD, TRAFFIC, lerp } from '../config.js';
import { Builder, VC_MAT } from './mesh-utils.js';
import { carCanSpawn } from './rules.js';

const LANES = [-ROAD.laneWidth, 0, ROAD.laneWidth];
const DARK = 0x1c1f24;
const GLASS = 0x56677a;
const SHADOW = 0x2a2a2d;
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function wheels(B, w, l, r = 0.36) {
  for (const sx of [-1, 1]) for (const z of [-l * 0.32, l * 0.32]) B.cyl(r, r, 0.28, DARK, sx * (w / 2 - 0.06), r, z, 10, 0, 0, Math.PI / 2);
}
function shadow(B, w, l) {
  B.box(w + 0.5, 0.01, l + 0.7, SHADOW, 0, 0.014, 0);
}
function sedan(color, sign, roof) {
  const B = new Builder();
  shadow(B, 1.8, 4.2);
  B.box(1.8, 0.7, 4.2, color, 0, 0.65, 0);
  B.box(1.55, 0.55, 2.2, GLASS, 0, 1.25, 0.2);
  B.box(1.5, 0.08, 2.0, roof || color, 0, 1.56, 0.2);
  B.box(1.84, 0.18, 0.3, DARK, 0, 0.42, -2.1);
  B.box(1.84, 0.18, 0.3, DARK, 0, 0.42, 2.1);
  for (const s of [-1, 1]) {
    B.box(0.3, 0.14, 0.04, 0xfff3c4, s * 0.6, 0.8, -2.12);
    B.box(0.3, 0.14, 0.04, 0xd32f2f, s * 0.6, 0.8, 2.12);
    B.box(0.1, 0.18, 0.2, DARK, s * 0.98, 1.1, -0.7); // rétroviseurs
  }
  if (sign) B.box(0.5, 0.18, 0.3, 0xffd140, 0, 1.7, 0.2);
  wheels(B, 1.8, 4.2);
  return { geo: B.build(), w: 1.8, l: 4.2 };
}

const BUILDERS = {
  taxi: () => {
    const r = sedan(0xffd140, true);
    return r;
  },
  woro: () => sedan(0x16a34a, false, 0xf4f4f4),
  sedan: () => sedan(pick([0xe9e9e9, 0xb8bcc2, 0xc0392b, 0x1d5fa8, 0x2b2b2b])),
  camion: () => {
    const B = new Builder();
    shadow(B, 2.2, 6);
    B.box(2.0, 1.5, 1.6, 0xf4e9d7, 0, 1.0, -2.1);
    B.box(1.7, 0.5, 0.06, GLASS, 0, 1.45, -2.92);
    B.box(2.2, 2.2, 4.2, pick([0xe9e5dc, 0xd9a066, 0x9fb3c8]), 0, 1.45, 1.0);
    B.box(2.0, 0.2, 0.3, DARK, 0, 0.4, -3.0);
    wheels(B, 2.2, 6, 0.42);
    return { geo: B.build(), w: 2.2, l: 6 };
  },
  minibus: () => {
    const body = pick([0xf2eee6, 0xf2eee6, 0xffffff, 0xe8d9b5]);
    const B = new Builder();
    shadow(B, 2.0, 5.8);
    B.box(2.0, 1.0, 5.8, body, 0, 0.95, 0);
    B.box(2.0, 1.1, 4.4, body, 0, 2.0, 0.7);
    B.box(2.02, 0.16, 5.0, pick([0xff7a00, 0x16a34a, 0x00a8e8]), 0, 1.2, 0.3);
    B.box(1.8, 0.6, 0.06, GLASS, 0, 2.0, -1.5);
    for (const s of [-1, 1]) B.box(0.05, 0.5, 3.0, GLASS, s * 1.02, 2.2, 1.0);
    B.box(2.0, 0.25, 0.3, DARK, 0, 0.5, 2.95);
    B.box(0.5, 0.06, 0.06, DARK, -0.5, 2.7, 2.8);
    wheels(B, 2.0, 5.8, 0.42);
    return { geo: B.build(), w: 2.0, l: 5.8 };
  },
  moto: () => {
    const B = new Builder();
    B.box(1.1, 0.01, 2.6, SHADOW, 0, 0.014, 0);
    B.box(0.36, 0.5, 1.7, DARK, 0, 0.55, 0);
    B.box(0.38, 0.28, 0.6, pick([0xe53935, 0x1e88e5, 0xffd140]), 0, 0.88, -0.35);
    for (const z of [-0.7, 0.7]) B.cyl(0.3, 0.3, 0.12, DARK, 0, 0.3, z, 10, 0, 0, Math.PI / 2);
    B.box(0.44, 0.7, 0.32, pick([0xff7a00, 0x43a047, 0x8e24aa, 0xf4e9d7]), 0, 1.3, 0.15); // pilote
    B.sphere(0.16, pick([0xffd140, 0x1e88e5, 0xe53935]), 0, 1.82, 0.1, 8, 6); // casque
    B.box(0.5, 0.5, 0.28, pick([0xe91e63, 0xfdd835]), 0, 1.3, 0.5); // passager
    return { geo: B.build(), w: 0.8, l: 2.0 };
  },
  // Un autre gbaka de ligne : carrosserie colorée, bandeau de slogan, galerie de toit.
  gbaka: () => {
    const body = pick([0xffd140, 0x00a8e8, 0x16a34a, 0xf2eee6, 0xe53935]);
    const B = new Builder();
    shadow(B, 2.1, 6.0);
    B.box(2.1, 1.05, 6.0, body, 0, 0.95, 0);
    B.box(2.1, 1.15, 4.6, body, 0, 2.05, 0.7);
    B.box(1.9, 0.62, 0.06, GLASS, 0, 2.05, -1.62);
    for (const s of [-1, 1]) {
      B.box(0.05, 0.58, 3.4, GLASS, s * 1.06, 2.25, 0.9);
      B.box(0.06, 0.9, 0.06, DARK, s * 1.06, 0.95, -2.35); // montant de caisse
    }
    B.box(2.14, 0.5, 4.8, pick([0xf4f4f4, 0xff7a00, 0x1d5fa8]), 0, 1.35, 0.4); // bandeau peint
    B.box(2.16, 0.14, 5.4, 0x2b2b2b, 0, 0.5, 0);
    B.box(1.7, 0.08, 0.08, DARK, 0, 2.95, 2.1); // galerie
    for (const s of [-1, 1]) B.box(0.08, 0.3, 0.08, DARK, s * 0.75, 2.8, 2.1);
    B.box(1.5, 0.4, 0.6, pick([0xe91e63, 0x43a047, 0xfdd835]), 0, 3.15, 2.1); // chargement sur le toit
    for (const s of [-1, 1]) B.box(0.3, 0.14, 0.04, 0xfff3c4, s * 0.6, 0.85, -3.06);
    wheels(B, 2.1, 6.0, 0.44);
    return { geo: B.build(), w: 2.1, l: 6.0 };
  },
  // Le gros bus bleu et blanc de la Sotra.
  sotra: () => {
    const B = new Builder();
    shadow(B, 2.45, 9.5);
    B.box(2.45, 2.3, 9.5, 0xf4f6f8, 0, 1.55, 0);
    B.box(2.48, 0.9, 9.3, 0x1d5fa8, 0, 0.95, 0); // bas de caisse bleu
    B.box(2.3, 0.9, 0.06, GLASS, 0, 2.35, -4.72); // pare-brise
    for (const s of [-1, 1]) for (let k = -3; k <= 3; k++) B.box(0.05, 0.8, 1.0, GLASS, s * 1.24, 2.35, k * 1.25);
    B.box(2.48, 0.16, 9.5, 0x1d5fa8, 0, 2.72, 0); // toit
    B.box(1.0, 0.5, 0.1, 0xffd140, 0, 2.05, -4.76); // panneau de ligne
    B.box(0.3, 0.18, 0.04, 0xfff3c4, -0.85, 0.9, -4.76);
    B.box(0.3, 0.18, 0.04, 0xfff3c4, 0.85, 0.9, -4.76);
    wheels(B, 2.45, 9.5, 0.5);
    return { geo: B.build(), w: 2.45, l: 9.5 };
  },
  // Pick-up bâché : plus court, il se faufile et se double facilement.
  pickup: () => {
    const body = pick([0xf2eee6, 0x1d5fa8, 0xc0392b, 0x9fb3c8]);
    const B = new Builder();
    shadow(B, 1.9, 4.8);
    B.box(1.9, 0.62, 4.8, body, 0, 0.62, 0);
    B.box(1.8, 0.75, 1.7, body, 0, 1.3, -1.4); // cabine
    B.box(1.6, 0.5, 0.06, GLASS, 0, 1.35, -2.24);
    for (const s of [-1, 1]) B.box(0.05, 0.45, 1.2, GLASS, s * 0.91, 1.35, -1.4);
    B.box(1.84, 0.06, 2.5, 0x7a5a3a, 0, 0.94, 1.0); // plateau
    B.box(0.08, 0.5, 2.5, DARK, 0, 1.15, 1.0); // ridelles
    for (const s of [-1, 1]) B.box(0.06, 0.5, 2.5, DARK, s * 0.92, 1.15, 1.0);
    B.box(0.06, 0.5, 2.5, DARK, 0, 1.15, 2.25);
    B.box(1.2, 0.75, 1.3, pick([0xe91e63, 0x43a047, 0xfdd835, 0xe0a800]), 0, 1.32, 0.9); // chargement
    B.box(0.3, 0.14, 0.04, 0xfff3c4, -0.6, 0.85, -2.4);
    B.box(0.3, 0.14, 0.04, 0xfff3c4, 0.6, 0.85, -2.4);
    wheels(B, 1.9, 4.8, 0.4);
    return { geo: B.build(), w: 1.9, l: 4.8 };
  },
};
const TYPES = [
  'taxi', 'woro', 'sedan', 'taxi', 'woro', 'camion', 'minibus', 'minibus',
  'moto', 'sedan', 'moto', 'taxi', 'gbaka', 'pickup', 'sotra',
];

export class Traffic {
  constructor(scene, count = TRAFFIC.count) {
    this.cars = [];
    this.maxActive = count; // plafond de véhicules actifs (réduit en qualité éco)
    this.eco = false;
    this.motos = true; // les taxis-motos circulent-elles dans la commune ?
    this.motoShare = 0.3;
    for (let i = 0; i < count; i++) {
      const type = TYPES[i % TYPES.length];
      const b = BUILDERS[type]();
      const mesh = new THREE.Mesh(b.geo, VC_MAT);
      mesh.visible = false;
      scene.add(mesh);
      this.cars.push({ mesh, w: b.w, l: b.l, type, x: 0, z: -9999, speed: 0, baseSpeed: 0, active: false, phase: Math.random() * 6 });
    }
  }

  // Commune jouée : les taxis-motos circulent à Yopougon, Adjamé et Treichville ; au Plateau
  // et à Cocody, elles restent au garage (et les motos déjà en piste sortent de la route).
  setSector(sector) {
    this.motos = sector?.motos !== false;
    this.motoShare = this.motos ? 0.3 : 0;
    if (this.motos) return;
    for (const c of this.cars) {
      if (c.type === 'moto' && c.active) {
        c.active = false;
        c.mesh.visible = false;
      }
    }
  }

  reset() {
    for (const c of this.cars) {
      c.active = false;
      c.mesh.visible = false;
    }
  }

  setVisible(v) {
    for (const c of this.cars) c.mesh.visible = v && c.active;
  }

  // Qualité éco : on réduit le nombre de véhicules actifs.
  setEco(eco, playerZ = 0) {
    this.eco = eco;
    this.maxActive = eco ? Math.min(TRAFFIC.ecoCount, this.cars.length) : this.cars.length;
    if (!eco) return;
    // Les voitures en trop, déjà loin devant (dans la brume), sont retirées.
    let active = this.activeCount();
    while (active > this.maxActive) {
      let victim = null;
      for (const c of this.cars) {
        if (c.active && c.z < playerZ - 100 && (!victim || c.z < victim.z)) victim = c;
      }
      if (!victim) break;
      victim.active = false;
      victim.mesh.visible = false;
      active--;
    }
  }

  activeCount() {
    let n = 0;
    for (const c of this.cars) if (c.active) n++;
    return n;
  }

  update(dt, playerZ, level, t) {
    const target = Math.min(this.maxActive, Math.round(level.density * this.maxActive));
    let active = 0;
    for (const c of this.cars) {
      if (!c.active) continue;
      c.speed = c.baseSpeed;
      active++;
    }
    // Les voitures ne se traversent pas : une voiture rapide derrière une lente ralentit.
    // On traite du plus loin (petit z) au plus proche, pour que chaque voiture compare sa
    // vitesse à celle, déjà corrigée, de la voiture qui la précède réellement.
    const order = this.cars.filter((c) => c.active).sort((a, b) => a.z - b.z);
    for (const c of order) {
      let leader = null;
      for (const o of order) {
        if (o === c || Math.abs(o.x - c.x) > 1.5 || o.z >= c.z) continue;
        if (!leader || o.z > leader.z) leader = o; // la voiture la plus proche devant
      }
      if (!leader) continue;
      const gap = c.z - leader.z;
      if (gap < (c.l + leader.l) / 2 + 4) c.speed = Math.min(c.speed, leader.speed);
    }
    for (const c of this.cars) {
      if (!c.active) continue;
      c.z -= c.speed * dt;
      c.mesh.position.set(c.type === 'moto' ? c.x + Math.sin(t * 2 + c.phase) * 0.45 : c.x, 0, c.z);
      if (c.z > playerZ + 20) {
        c.active = false;
        c.mesh.visible = false;
        active--;
      }
    }
    // Une seule apparition par image : cela évite les paquets de voitures qui surgissent
    // ensemble et garantit qu'après chaque apparition il reste toujours une voie libre.
    if (active < target) {
      // La commune décide de la part de taxis-motos dans le flux.
      const free = this.cars.filter((q) => !q.active && (this.motos || q.type !== 'moto'));
      let c = null;
      if (this.motos && free.length && Math.random() < this.motoShare) c = free.find((q) => q.type === 'moto');
      if (!c) c = free.find((q) => q.type !== 'moto') || free[0];
      if (c && this._spawn(c, playerZ, level)) active++;
    }
  }

  _spawn(c, playerZ, level) {
    const z = playerZ - (110 + Math.random() * 60);
    const idx = Math.floor(Math.random() * LANES.length);
    const x = LANES[idx];
    if (!carCanSpawn(this.cars, x, z)) return false; // jamais 3 voies bouchées, jamais 2 véhicules collés
    c.x = x;
    c.z = z;
    c.baseSpeed = c.speed = lerp(level.carSpeed[0], level.carSpeed[1], Math.random()) * (c.type === 'moto' ? 1.15 : 1);
    c.active = true;
    c.mesh.visible = true;
    c.mesh.position.set(x, 0, z);
    return true;
  }
}
