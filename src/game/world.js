import * as THREE from 'three';
import { ROAD } from '../config.js';
import { Builder, rng, shade } from './mesh-utils.js';
import { districtPlan } from './districts.js';

// Le décor est fabriqué en variantes fusionnées (voir mesh-utils.js) : chaque tronçon de 48 m
// ne coûte que quelques appels de dessin. Quatre ambiances se succèdent (choix : districts.js) :
// la ville, le marché de rue, le quartier d'habitation et le pont au-dessus de la lagune.

const L = ROAD.chunkLength;
const WALLS = [0xebd9b8, 0xd9a066, 0xf3e9d2, 0xc9bda6, 0xd98b6a, 0xbfd3c1, 0xe8c26b, 0xa9c4d6, 0xe7b7a0];
const SHOPS = [0x2f6b3b, 0x1d5fa8, 0xc0392b, 0x3b2f2a, 0xe0a800, 0x6d3b8e];
const AWNINGS = [0xffd140, 0xff7a00, 0x16a34a, 0x00a8e8, 0xe53935, 0xf4f4f4];
const TOWERS = [0xb8c7d9, 0xd9dde3, 0x9fb3c8, 0xc9d3dc];
const GREENS = [0x2e8b3d, 0x3fa34d, 0x2a7a35];
const GOODS = [0xe91e63, 0x1e88e5, 0xfdd835, 0x43a047, 0xff7a00];
const ROOFS = [0xb04a2a, 0x8a5a3a, 0x9a4a3a, 0x7f6a55];
const STEEL = 0x4a5058;

// Nombre de variantes par ambiance : assez pour ne pas voir la répétition.
const VARIANTS = { ville: 6, marche: 3, quartier: 3, pont: 2 };

// ---------- Textures ----------
function facadeTexture() {
  // Une "case" de 3,2 m : mur blanc (teinté ensuite par la couleur de l'immeuble) + une fenêtre.
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#d9d9d9';
  x.fillRect(0, 118, 128, 10); // bandeau de plancher
  x.fillStyle = '#9a9a9a';
  x.fillRect(32, 18, 64, 80); // cadre
  const g = x.createLinearGradient(36, 22, 92, 94);
  g.addColorStop(0, '#6f93b5');
  g.addColorStop(1, '#27405c');
  x.fillStyle = g;
  x.fillRect(37, 23, 54, 70); // vitre
  x.fillStyle = 'rgba(255,255,255,0.28)';
  x.beginPath();
  x.moveTo(37, 23); x.lineTo(62, 23); x.lineTo(37, 58);
  x.fill(); // reflet
  x.fillStyle = '#9a9a9a';
  x.fillRect(62, 23, 3, 70); // montant
  x.fillStyle = '#bdbdbd';
  x.fillRect(28, 96, 72, 6); // appui de fenêtre
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function roadTexture(kind) {
  // Texture d'un tronçon : trottoirs, bitume, lignes. 18 m de large x 48 m de long.
  const W = 256;
  const H = 512;
  const bridge = kind === 'bridge';
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  const mx = (m) => ((m + 9) / 18) * W;
  x.fillStyle = bridge ? '#b3aca0' : '#cdb58a';
  x.fillRect(0, 0, W, H);
  x.fillStyle = '#3b3b3f';
  x.fillRect(mx(-7), 0, mx(7) - mx(-7), H);
  // petites taches d'usure
  for (let i = 0; i < 160; i++) {
    x.fillStyle = `rgba(${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},0.035)`;
    x.fillRect(mx(-7) + Math.random() * (mx(7) - mx(-7)), Math.random() * H, 6 + Math.random() * 18, 3 + Math.random() * 10);
  }
  x.fillStyle = '#ffffff';
  x.fillRect(mx(-5.4) - 2, 0, 4, H);
  x.fillRect(mx(5.4) - 2, 0, 4, H);
  const period = H / 8;
  for (let i = 0; i < 8; i++) {
    x.fillRect(mx(-1.8) - 2, i * period + 6, 4, period * 0.4);
    x.fillRect(mx(1.8) - 2, i * period + 6, 4, period * 0.4);
  }
  if (bridge) {
    // joints de chaussée du tablier : bande sombre + fer plat clair
    for (let i = 0; i < 4; i++) {
      const y = 26 + i * (H / 4);
      x.fillStyle = '#6d6a63';
      x.fillRect(mx(-7), y, mx(7) - mx(-7), 5);
      x.fillStyle = '#9a958c';
      x.fillRect(mx(-7), y + 5, mx(7) - mx(-7), 2);
    }
  }
  if (kind === 'zebra') {
    x.fillStyle = '#f2f2f2';
    for (let m = -5.0; m <= 5.0; m += 1.0) x.fillRect(mx(m) - 3, H / 2 - 17, 7, 34);
  }
  if (kind === 'bump') {
    for (let i = 0; i < 6; i++) {
      x.fillStyle = i % 2 ? '#222222' : '#ffd140';
      x.fillRect(mx(-7), H / 2 - 18 + i * 6, mx(7) - mx(-7), 6);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}


function waterTexture() {
  // Lagune Ébrié : eau verte, reflets clairs, petites vagues.
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#2b6f80';
  x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 110; i++) {
    const y = Math.random() * 128;
    const x0 = Math.random() * 128;
    x.strokeStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.13})`;
    x.lineWidth = 1 + Math.random() * 2;
    x.beginPath();
    x.moveTo(x0, y);
    x.bezierCurveTo(x0 + 10, y - 3, x0 + 24, y + 3, x0 + 38, y);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(8, 1.5);
  return t;
}

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#2f9fe0');
  g.addColorStop(0.5, '#9edcf5');
  g.addColorStop(0.62, '#d9f0f7');
  g.addColorStop(1, '#ffe3b0');
  x.fillStyle = g;
  x.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function skylineTexture() {
  // Silhouette lointaine d'Abidjan : tours, antennes et pont.
  const W = 1024;
  const H = 200;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  const r = rng(77);
  x.fillStyle = '#7fa6cc';
  let px = 0;
  while (px < W) {
    const w = 28 + r() * 46;
    const h = 40 + r() * 110;
    x.fillRect(px, H - h, w, h);
    if (r() < 0.3) x.fillRect(px + w / 2 - 1.5, H - h - 22, 3, 22);
    px += w + r() * 6;
  }
  // pont à haubans
  x.strokeStyle = '#6f98c0';
  x.lineWidth = 5;
  x.beginPath();
  x.moveTo(610, H); x.lineTo(650, 20); x.lineTo(690, H);
  x.moveTo(730, H); x.lineTo(770, 20); x.lineTo(810, H);
  x.stroke();
  x.lineWidth = 1.5;
  x.beginPath();
  for (const [tx, ex] of [[650, [540, 570, 600, 700, 720]], [770, [700, 730, 800, 850, 880]]]) {
    for (const e of ex) { x.moveTo(tx, 20); x.lineTo(e, H - 8); }
  }
  x.stroke();
  x.fillRect(520, H - 12, 400, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- Petits morceaux réutilisés par les ambiances ----------
function sidewalk(P, side) {
  // Trottoir surélevé + bordure : donne du relief au bord de la route.
  P.box(2.0, 0.18, L, 0xcdb58a, side * 8.1, 0.09, 0);
  P.box(0.24, 0.22, L, 0xd9d4c8, side * 7.1, 0.11, 0);
}

function streetLamp(P, side, z) {
  const toRoad = -side;
  const px = side * 7.5;
  P.cyl(0.07, 0.1, 6.5, 0x44484f, px, 0.18 + 3.25, z, 6);
  P.box(1.3, 0.08, 0.08, 0x44484f, px + toRoad * 0.65, 6.6, z);
  P.box(0.5, 0.12, 0.26, 0xfff3c4, px + toRoad * 1.25, 6.52, z);
}

function tree(P, pick, side, z) {
  const tx = side * 7.9;
  if (pick([0, 1]) === 0) {
    // palmier
    P.cyl(0.1, 0.17, 5, 0x7a5a3a, tx, 0.18 + 2.5, z, 6);
    for (let i = 0; i < 7; i++) {
      const ry = (i / 7) * Math.PI * 2;
      P.box(2.4, 0.05, 0.32, pick(GREENS), tx + Math.cos(ry) * 1.05, 5.15, z - Math.sin(ry) * 1.05, 0, ry, -0.4);
    }
  } else {
    // manguier
    P.cyl(0.15, 0.22, 3, 0x6f4e2f, tx, 0.18 + 1.5, z, 6);
    P.sphere(1.7, pick(GREENS), tx, 4.2, z, 8, 6);
    P.sphere(1.2, pick(GREENS), tx + 0.6, 5.1, z + 0.3, 8, 6);
  }
}

// ---------- Ambiance : la ville (immeubles, boutiques, panneaux) ----------
function buildCity({ R, r, pick, F, P }) {
  for (const side of [-1, 1]) {
    const toRoad = -side;
    // Trottoir surélevé + bordure : donne du relief au bord de la route
    P.box(2.0, 0.18, L, 0xcdb58a, side * 8.1, 0.09, 0);
    P.box(0.24, 0.22, L, 0xd9d4c8, side * 7.1, 0.11, 0);

    // Immeubles proches, de tailles variées, avec boutiques, auvents et balcons
    let z = -L / 2 + r(0, 2);
    while (z < L / 2 - 7) {
      const d = r(8, 14);
      if (z + d > L / 2) break;
      const w = r(7, 11);
      const low = R() < 0.3;
      const h = low ? r(4.5, 7.5) : r(8, 22);
      const wall = pick(WALLS);
      const cx = side * (9.4 + w / 2);
      const cz = z + d / 2;
      const faceX = side * 9.4;
      F.facade(w, h, d, wall, cx, h / 2, cz);
      P.box(w + 0.3, 0.28, d + 0.3, shade(wall, 0.78), cx, h + 0.14, cz); // corniche de toit
      if (R() < 0.35) P.cyl(0.8, 0.8, 1.3, 0x8da2b5, cx, h + 0.9, cz, 10); // citerne sur le toit
      if (R() < 0.3) P.cyl(0.03, 0.03, 3.5, 0x555555, cx, h + 2.0, cz, 4); // antenne
      for (let fl = 1; fl < Math.floor(h / 3.2); fl++) {
        if (R() < 0.45) P.box(0.9, 0.12, d * 0.55, 0xe6dcc6, faceX + toRoad * 0.45, fl * 3.2 + 0.9, cz + r(-d * 0.15, d * 0.15));
      }
      P.box(0.18, 3.0, d * 0.92, pick(SHOPS), faceX + toRoad * 0.1, 1.5, cz); // devanture
      if (R() < 0.8) P.box(1.5, 0.08, d * 0.8, pick(AWNINGS), faceX + toRoad * 0.8, 3.05, cz, 0, 0, -0.3 * toRoad); // auvent
      z += d + (R() < 0.25 ? r(3, 6) : r(0.4, 1.2));
    }

    // Grandes tours en arrière-plan (profondeur)
    for (let k = 0; k < 2; k++) {
      const w = r(10, 14);
      const d = r(12, 16);
      const h = r(26, 52);
      const tx = side * r(28, 40);
      const tz = r(-L / 2 + 8, L / 2 - 8);
      F.facade(w, h, d, pick(TOWERS), tx, h / 2, tz);
      P.box(w + 0.4, 0.5, d + 0.4, 0x7d8a98, tx, h + 0.25, tz);
    }

    // Lampadaires (2 par côté)
    for (const lz of [-12, 12]) {
      const px = side * 7.5;
      P.cyl(0.07, 0.1, 6.5, 0x44484f, px, 0.18 + 3.25, lz, 6);
      P.box(1.3, 0.08, 0.08, 0x44484f, px + toRoad * 0.65, 6.6, lz);
      P.box(0.5, 0.12, 0.26, 0xfff3c4, px + toRoad * 1.25, 6.52, lz);
    }

    // Poteau électrique et fils (profondeur le long de la rue)
    const pz = r(-18, 18);
    const poleX = side * 8.9;
    P.cyl(0.1, 0.15, 9, 0x6b5642, poleX, 0.18 + 4.5, pz, 6);
    P.box(2.4, 0.1, 0.1, 0x6b5642, poleX, 8.6, pz);
    for (const o of [-0.95, 0, 0.95]) P.box(0.03, 0.03, L, 0x1c1c1c, poleX + o, 8.55, 0);

    // Arbres : palmiers et grands arbres
    for (let k = 0; k < 2; k++) {
      const tz = r(-21, 21);
      const tx = side * 7.9;
      if (R() < 0.6) {
        P.cyl(0.1, 0.17, 5, 0x7a5a3a, tx, 0.18 + 2.5, tz, 6);
        const n = 7;
        for (let i = 0; i < n; i++) {
          const ry = (i / n) * Math.PI * 2 + r(0, 0.4);
          P.box(2.4, 0.05, 0.32, pick(GREENS), tx + Math.cos(ry) * 1.05, 5.15, tz - Math.sin(ry) * 1.05, 0, ry, -0.4);
        }
      } else {
        P.cyl(0.15, 0.22, 3, 0x6f4e2f, tx, 0.18 + 1.5, tz, 6);
        P.sphere(1.7, pick(GREENS), tx, 4.2, tz, 8, 6);
        P.sphere(1.2, pick(GREENS), tx + 0.6, 5.1, tz + 0.3, 8, 6);
      }
    }

    // Étals de marché avec parasols colorés
    for (let k = 0; k < Math.floor(r(0, 3)); k++) {
      const sz = r(-20, 20);
      const sx = side * 8.5;
      P.box(1.8, 0.75, 1.0, 0x8a6a45, sx, 0.18 + 0.375, sz);
      for (let g = 0; g < 3; g++) P.box(0.32, 0.26, 0.32, pick(GOODS), sx - 0.6 + g * 0.6, 0.18 + 0.88, sz);
      P.cyl(0.03, 0.03, 2.3, 0x555555, sx + 0.8, 0.18 + 1.15, sz + 0.4, 5);
      P.cone(1.3, 0.45, pick(AWNINGS), sx, 0.18 + 2.45, sz, 8);
    }
  }

  // Un panneau publicitaire par variante
  const bs = R() < 0.5 ? -1 : 1;
  const bz = r(-14, 14);
  P.cyl(0.12, 0.12, 6, 0x4a4f57, bs * 8.8, 3.2, bz - 1.8, 6);
  P.cyl(0.12, 0.12, 6, 0x4a4f57, bs * 8.8, 3.2, bz + 1.8, 6);
  P.box(0.26, 2.6, 5.0, 0x0d2b6b, bs * 8.8, 6.6, bz);
  P.box(0.3, 2.2, 4.6, pick([0xffd140, 0x00a8e8, 0xff7a00]), bs * 8.8 - bs * 0.02, 6.6, bz);

  return { facades: F.build(), props: P.build() };
}



// ---------- Ambiance : le marché de rue (étals, parasols, hangar, banderoles) ----------
function buildMarket({ R, r, pick, F, P }) {
  for (const side of [-1, 1]) {
    const toRoad = -side;
    sidewalk(P, side);

    // Allée de vendeuses le long du trottoir : tables, marchandises, parasols.
    for (let z = -L / 2 + 3.5; z < L / 2 - 3.5; z += r(3.7, 4.7)) {
      const sx = side * (8.85 + r(0, 0.3));
      P.box(1.7, 0.1, 1.05, 0x9a7444, sx, 1.02, z); // plateau
      for (const dx of [-0.72, 0.72]) {
        for (const dz of [-0.42, 0.42]) P.box(0.08, 0.86, 0.08, 0x7a5a34, sx + dx, 0.61, z + dz);
      }
      for (let g = 0; g < 4; g++) P.box(0.26, 0.2, 0.26, pick(GOODS), sx + r(-0.55, 0.55), 1.17, z + r(-0.32, 0.32));
      const px = sx + toRoad * r(0.1, 0.55);
      P.cyl(0.035, 0.035, 2.4, 0x8b8b8b, px, 1.35, z, 5);
      P.cone(1.45, 0.5, pick(AWNINGS), px, 2.65, z, 7); // parasol
      for (let k = 0; k < 2; k++) P.box(0.5, 0.32, 0.5, pick(GOODS), sx + toRoad * 1.05, 0.34 + k * 0.32, z + r(-0.9, 0.9));
      // la vendeuse, derrière sa table : pagne long, tête, bras tendu vers la rue
      const vx = sx - toRoad * 0.85;
      P.box(0.46, 1.35, 0.34, pick(AWNINGS), vx, 0.18 + 0.675, z);
      P.sphere(0.15, 0x3b2416, vx, 0.18 + 1.5, z, 6, 5);
      P.box(0.11, 0.5, 0.11, 0x3b2416, vx, 0.18 + 1.15, z + 0.2, 0.9, 0, 0);
    }

    // Hangar du marché : grand toit de tôle sur poteaux, sacs empilés dessous.
    const hz = r(-14, 14);
    const hx = side * 13.5;
    for (const dz of [-6, 6]) {
      for (const dx of [-2.4, 2.4]) P.cyl(0.12, 0.12, 3.2, 0x9a9a9a, hx + dx, 0.18 + 1.6, hz + dz, 6);
    }
    P.box(6.2, 0.1, 14.2, 0x767c82, hx, 0.18 + 3.18, hz);
    P.box(6.0, 0.14, 14.0, 0x8f959b, hx, 0.18 + 3.3, hz, 0, 0, side * 0.05);
    for (let k = 0; k < 6; k++) {
      P.box(0.6, 0.5, 0.5, pick([0xd9c39a, 0xc9b48a, 0xb8a278]), hx + r(-2, 2), 0.18 + 0.25, hz + r(-5, 5));
    }

    // Immeubles bas derrière le marché (2 à 3 niveaux)
    let z = -L / 2 + r(0, 2);
    while (z < L / 2 - 8) {
      const d = r(8, 13);
      const w = r(8, 12);
      const h = r(5, 9.5);
      const wall = pick(WALLS);
      const cx = side * (20 + w / 2);
      F.facade(w, h, d, wall, cx, h / 2, z + d / 2);
      P.box(w + 0.3, 0.3, d + 0.3, shade(wall, 0.75), cx, h + 0.15, z + d / 2);
      z += d + r(0.5, 2);
    }

    for (const lz of [-14, 14]) streetLamp(P, side, lz);
    for (let k = 0; k < 2; k++) tree(P, pick, side, r(-20, 20));
  }

  // Banderole en travers de la rue : la signature des marchés d'Abidjan.
  if (R() < 0.6) {
    const bz = r(-L / 2 + 7, L / 2 - 7);
    P.cyl(0.08, 0.1, 6.2, 0x555555, -8.35, 3.1, bz, 6);
    P.cyl(0.08, 0.1, 6.2, 0x555555, 8.35, 3.1, bz, 6);
    P.box(16.7, 0.95, 0.06, pick([0x16a34a, 0xe53935, 0x1d5fa8, 0xe0a800]), 0, 5.65, bz);
    P.box(15.6, 0.3, 0.08, 0xf4f4f4, 0, 5.65, bz);
  }

  return { facades: F.build(), props: P.build() };
}

// ---------- Ambiance : quartier d'habitation (murs, cours, manguiers, maquis) ----------
function buildQuartier({ R, r, pick, F, P }) {
  for (const side of [-1, 1]) {
    sidewalk(P, side);

    // Mur de clôture le long de la rue, avec portails, et maisons dans les cours.
    let z = -L / 2 + 1;
    while (z < L / 2 - 6) {
      const d = r(6, 11);
      if (z + d > L / 2) break;
      const wall = pick(WALLS);
      const wx = side * 9.0;
      const cz = z + d / 2;
      P.box(0.35, 2.1, d, wall, wx, 0.18 + 1.05, cz);
      P.box(0.55, 0.16, d, shade(wall, 0.8), wx, 0.18 + 2.18, cz); // chaperon
      if (R() < 0.55) {
        P.box(0.16, 1.9, 2.4, pick([0x2f6b3b, 0x1d5fa8, 0x8a8a8a, 0xc0392b]), wx, 0.18 + 0.95, cz);
        for (const dz of [-1.35, 1.35]) P.box(0.42, 2.5, 0.42, shade(wall, 0.9), wx, 0.18 + 1.25, cz + dz);
      }
      if (R() < 0.8) {
        const w = r(6, 9);
        const h = r(2.8, 4.2);
        const cx = side * (13.5 + w / 2);
        P.box(w, h, 8, pick(WALLS), cx, 0.18 + h / 2, cz);
        if (R() < 0.5) P.cone(w * 0.72, 1.5, pick(ROOFS), cx, 0.18 + h + 0.75, cz, 4, 0, Math.PI / 4, 0);
        else P.box(w + 0.5, 0.14, 8.5, 0x8f959b, cx, 0.18 + h + 0.07, cz);
        for (let k = -1; k <= 1; k++) P.box(0.07, 0.8, 0.95, 0x3c4b5a, side * 13.47, 0.18 + h * 0.6, cz + k * 2.6);
        P.box(0.07, 1.6, 0.9, 0x5a4632, side * 13.47, 0.18 + 0.8, cz + 2.9); // porte
        if (R() < 0.4) P.cyl(0.5, 0.5, 1.0, 0x2b2b2b, cx + r(-2.5, 2.5), 0.18 + 0.5, cz + r(-2.5, 2.5), 8);
        if (R() < 0.4) {
          // linge qui sèche dans la cour
          const lx = side * 11.5;
          for (const dz of [-2, 2]) P.cyl(0.05, 0.05, 2.2, 0x8a8a8a, lx, 0.18 + 1.1, cz + dz, 5);
          P.box(0.03, 0.03, 4.2, 0x8a8a8a, lx, 0.18 + 2.1, cz);
          for (let k = 0; k < 3; k++) P.box(0.04, 0.55, 0.5, pick(AWNINGS), lx, 0.18 + 1.78, cz - 1.2 + k * 1.1);
        }
      }
      z += d + r(0.3, 1.4);
    }

    for (let k = 0; k < 2; k++) tree(P, pick, side, r(-20, 20));
    streetLamp(P, side, r(-18, 18));

    // Maquis du coin : table en plastique, chaises, enseigne peinte.
    if (R() < 0.6) {
      const mz = r(-18, 18);
      const mx = side * 8.35;
      P.box(0.9, 0.08, 0.9, 0xf4f4f4, mx, 0.18 + 0.72, mz);
      P.cyl(0.05, 0.05, 0.72, 0x8a8a8a, mx, 0.18 + 0.36, mz, 5);
      for (const dz of [-0.75, 0.75]) P.box(0.45, 0.55, 0.45, pick([0xe53935, 0x1d5fa8, 0x16a34a]), mx, 0.18 + 0.28, mz + dz);
      P.box(0.1, 1.0, 2.2, pick([0xe0a800, 0x16a34a, 0xc0392b]), side * 9.1, 0.18 + 3.0, mz);
      P.cyl(0.06, 0.06, 2.6, 0x6b5642, side * 9.1, 0.18 + 1.3, mz - 1.1, 5);
    }
  }
  return { facades: F.build(), props: P.build() };
}

// ---------- Ambiance : le pont au-dessus de la lagune ----------
// La lagune elle-même est ajoutée par le monde (une nappe d'eau par tronçon), pour pouvoir
// l'allumer seulement sur les tronçons de pont.
function buildBridge({ r, pick, P }) {
  for (const side of [-1, 1]) {
    const toRoad = -side;
    // trottoir du pont, en béton, et bordure
    P.box(1.9, 0.2, L, 0xbdb6a8, side * 8.1, 0.1, 0);
    P.box(0.2, 0.24, L, 0xd9d4c8, side * 7.15, 0.12, 0);
    // rambarde : montants tous les 4 m, deux lisses
    for (let z = -L / 2 + 2; z <= L / 2 - 2; z += 4) P.box(0.1, 1.2, 0.1, 0xd0d8dd, side * 8.97, 0.8, z);
    P.box(0.12, 0.09, L, 0xe2e8ec, side * 8.97, 1.42, 0);
    P.box(0.08, 0.06, L, 0xd7dee3, side * 8.97, 0.95, 0);
    // lampadaires du pont
    for (const z of [-16, 8]) {
      P.cyl(0.06, 0.09, 5.4, STEEL, side * 8.6, 2.9, z, 6);
      P.box(1.0, 0.07, 0.07, STEEL, side * 8.1, 5.5, z);
      P.box(0.4, 0.1, 0.22, 0xfff3c4, side * 7.6, 5.42, z);
    }
    // pilotis qui dépassent de l'eau (embarcadères)
    for (let k = 0; k < 3; k++) {
      P.cyl(0.1, 0.13, 1.3, 0x6b5a44, side * r(11, 24), 0.35, r(-L / 2 + 2, L / 2 - 2), 6);
    }
    // pirogues de pêcheurs, le long du pont
    for (let k = 0; k < 2; k++) {
      const bz = r(-L / 2 + 5, L / 2 - 5);
      const bx = side * r(13, 27);
      const rot = r(-0.6, 0.6);
      P.box(0.95, 0.24, 3.8, pick([0x6b4a2a, 0x2f6b3b, 0x1d5fa8, 0xe53935]), bx, 0.1, bz, 0, rot, 0);
      P.box(0.7, 0.14, 2.7, 0x4a3a2a, bx, 0.2, bz, 0, rot, 0);
      P.box(0.4, 0.62, 0.3, pick([0xff7a00, 0x43a047, 0xf4e9d7]), bx, 0.55, bz + 0.7, 0, rot, 0); // pêcheur
      P.sphere(0.14, 0x3b2416, bx, 1.0, bz + 0.7, 6, 5);
      P.box(0.05, 1.6, 0.05, 0x6b5a44, bx + 0.15, 0.9, bz - 1.2, 0, rot, 0.4); // pagaie
    }
  }
  // Un pont n'a pas de façades : la ligne d'horizon du jeu suffit au fond.
  return { facades: null, props: P.build() };
}

// ---------- Fabrique des variantes ----------
function buildVariant(seed, kind = 'ville') {
  const R = rng(seed);
  const ctx = {
    R,
    r: (a, b) => a + R() * (b - a),
    pick: (arr) => arr[Math.floor(R() * arr.length)],
    F: new Builder(),
    P: new Builder(),
  };
  if (kind === 'marche') return buildMarket(ctx);
  if (kind === 'quartier') return buildQuartier(ctx);
  if (kind === 'pont') return buildBridge(ctx);
  return buildCity(ctx);
}

// ---------- Monde ----------
export class World {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.sky = skyTexture();

    const facadeMat = new THREE.MeshLambertMaterial({ map: facadeTexture(), vertexColors: true });
    const propMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.roadMats = {
      plain: new THREE.MeshLambertMaterial({ map: roadTexture('plain') }),
      zebra: new THREE.MeshLambertMaterial({ map: roadTexture('zebra') }),
      bump: new THREE.MeshLambertMaterial({ map: roadTexture('bump') }),
      bridge: new THREE.MeshLambertMaterial({ map: roadTexture('bridge') }),
    };

    // Toutes les variantes sont fabriquées une seule fois au chargement, puis réutilisées.
    this.variants = {};
    let seed = 1000;
    for (const [kind, n] of Object.entries(VARIANTS)) {
      this.variants[kind] = Array.from({ length: n }, () => {
        seed += 97;
        return buildVariant(seed, kind);
      });
    }

    this.roadGeo = new THREE.PlaneGeometry(18, L);
    this.roadGeo.rotateX(-Math.PI / 2);
    this.dummyGeo = new THREE.PlaneGeometry(0.01, 0.01);

    // La lagune : une nappe d'eau par tronçon, allumée seulement sur les tronçons de pont.
    this.waterMat = new THREE.MeshLambertMaterial({ map: waterTexture() });
    this.waterGeo = new THREE.PlaneGeometry(420, L);
    this.waterGeo.rotateX(-Math.PI / 2);

    this.chunks = [];
    for (let i = 0; i < ROAD.chunks; i++) {
      const g = new THREE.Group();
      g.userData.road = new THREE.Mesh(this.roadGeo, this.roadMats.plain);
      g.userData.facades = new THREE.Mesh(this.dummyGeo, facadeMat);
      g.userData.props = new THREE.Mesh(this.dummyGeo, propMat);
      g.userData.water = new THREE.Mesh(this.waterGeo, this.waterMat);
      // L'eau affleure sous la chaussée (assez loin du sol pour éviter le scintillement).
      g.userData.water.position.y = -0.01;
      g.userData.water.visible = false;
      g.add(g.userData.road, g.userData.facades, g.userData.props, g.userData.water);
      this.group.add(g);
      this.chunks.push(g);
    }

    // Sol de latérite sous la ville (suit le joueur)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0xb98550 }),
    );
    ground.position.y = -0.08;
    this.ground = ground;
    this.group.add(ground);

    // Silhouette lointaine de la ville
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(460, 75),
      new THREE.MeshBasicMaterial({ map: skylineTexture(), transparent: true, fog: false, depthWrite: false }),
    );
    sky.position.y = 30;
    this.skyline = sky;
    this.group.add(sky);

    this.reset();
  }

  // Ciel dégradé et brume (couleur de l'horizon)
  applyEnvironment(scene) {
    scene.background = this.sky;
    scene.fog = new THREE.Fog(0xd9f0f7, 80, 205);
  }

  // Route d'un tronçon selon l'ambiance (le pont a ses joints de chaussée).
  _roadFor(district) {
    if (district === 'pont') return this.roadMats.bridge;
    const r = Math.random();
    if (r < 0.12) return this.roadMats.zebra;
    if (r < 0.26) return this.roadMats.bump;
    return this.roadMats.plain;
  }

  _assign(g, district) {
    const d = district || this.plan.next().value;
    const list = this.variants[d];
    const v = list[Math.floor(Math.random() * list.length)];
    g.userData.district = d;
    // Un maillage sans géométrie est masqué (et non dessiné) plutôt que remplacé par un vide.
    g.userData.facades.geometry = v.facades || this.dummyGeo;
    g.userData.facades.visible = !!v.facades;
    g.userData.props.geometry = v.props || this.dummyGeo;
    g.userData.props.visible = !!v.props;
    g.userData.road.material = this._roadFor(d);
    g.userData.water.visible = d === 'pont';
  }

  reset() {
    this.plan = districtPlan();
    this.district = 'ville';
    this.chunks.forEach((g, i) => {
      g.position.z = -i * L + L / 2;
      // Les deux premiers tronçons sont toujours la ville : départ calme et lisible.
      this._assign(g, i < 2 ? 'ville' : null);
    });
  }

  update(playerZ) {
    // On recycle du plus proche du joueur (le plus en arrière) au plus loin : l'ordre des
    // ambiances (pont de 3 tronçons, marché de 2...) reste ainsi correct.
    const behind = this.chunks
      .filter((g) => g.position.z - L / 2 > playerZ + 30)
      .sort((a, b) => b.position.z - a.position.z);
    for (const g of behind) {
      g.position.z -= L * ROAD.chunks;
      this._assign(g);
    }

    // Ambiance du tronçon sous le joueur (le jeu l'annonce à l'écran).
    for (const g of this.chunks) {
      if (playerZ >= g.position.z - L / 2 && playerZ <= g.position.z + L / 2) {
        this.district = g.userData.district;
        break;
      }
    }

    this.ground.position.z = playerZ;
    this.skyline.position.z = playerZ - 198;
    // Léger clapot : la texture de l'eau glisse doucement.
    this.waterMat.map.offset.y = (performance.now() * 0.00002) % 1;
  }
}
