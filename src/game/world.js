import * as THREE from 'three';
import { ROAD, DISTRICTS, SECTORS } from '../config.js';
import { Builder, rng, shade } from './mesh-utils.js';
import { districtPlan } from './districts.js';
import { districtMix } from './sectors.js';

// Le décor est fabriqué en variantes fusionnées (voir mesh-utils.js) : chaque tronçon de 48 m
// ne coûte que quelques appels de dessin. Quatre ambiances se succèdent dans UN secteur
// (choix : districts.js) : la rue commerçante, le marché, les rues d'habitation et le pont.
//
// Chaque niveau est une commune d'Abidjan (SECTORS dans config.js) et chaque commune a son
// propre STYLE de décor : couleurs des murs et des trottoirs, étage maximum, texture de
// façade (ciment, tôle, verre, villa), silhouettes, foule et taxis-motos. World.setSector()
// change tout d'un coup au début du niveau : on ne mélange jamais deux communes.

const L = ROAD.chunkLength;

// ---------- Styles de décor (un par commune) ----------
// seed : décale le tirage des bâtiments pour que deux communes n'aient jamais les mêmes rues.
const STYLES = {
  yopougon: {
    seed: 11,
    facade: 'ciment',
    walls: [0xf0d8b0, 0xe8c48c, 0xd9a066, 0xf3e9d2, 0xcbb894, 0xd98b6a],
    shops: [0x2f6b3b, 0x1d5fa8, 0xc0392b, 0xe0a800, 0x6d3b8e],
    awnings: [0xffd140, 0xff7a00, 0x16a34a, 0xe53935, 0xf4f4f4],
    towers: [0xb8c7d9],
    roofs: [0xb04a2a, 0x8a5a3a, 0x9a4a3a, 0x7f6a55],
    goods: [0xe91e63, 0x1e88e5, 0xfdd835, 0x43a047, 0xff7a00],
    greens: [0x2e8b3d, 0x3fa34d, 0x2a7a35],
    sidewalk: '#cba97c',
    sidewalkLine: '#b9976b',
    curb: '#ded7c6',
    asphalt: '#3b3b3f',
    lanePaint: '#f3f1e8',
    wear: 0.05,
    potholes: 5,
    ground: 0xbf8a52,
    sky: ['#2f9fe0', '#9edcf5', '#d9ecec', '#ffe3b0'],
    fog: 0xdff0ea,
    skyline: { color: '#93a9b8', minH: 26, maxH: 60, towers: 0, cranes: 0, hills: 0 },
    city: { lowChance: 0.8, hMin: 4.2, hMax: 8.5, towerChance: 0.2, towerH: [12, 20], awning: 0.75, balcony: 0.25 },
    quartier: { kind: 'courtyards', wallH: 2.0, houseH: [2.8, 4.0], zinc: 0.55, villa: 0.15, laundry: 0.5, maquis: 0.8, tank: 0.35 },
    market: { stalls: 4, hangar: 1, banner: 0.8, kiosk: 0, containers: 0 },
    props: { trees: 2, palms: 0.3, lamps: 1, waterTowers: 0.5, carts: 0.8, parkedMotos: 1.0, billboards: 0.5, stallsCity: 1 },
  },
  adjame: {
    seed: 23,
    facade: 'zinc',
    walls: [0xd9a066, 0xc98a55, 0xb9b0a0, 0xe8c26b, 0xa9c4d6, 0xd98b6a, 0xbfd3c1],
    shops: [0xc0392b, 0x1d5fa8, 0xe0a800, 0x2f6b3b, 0x6d3b8e, 0xff7a00],
    awnings: [0xffd140, 0xff7a00, 0x16a34a, 0x00a8e8, 0xe53935, 0xf4f4f4],
    towers: [0xb8c7d9, 0xc9d3dc],
    roofs: [0x8a5a3a, 0x7f6a55, 0x9a4a3a],
    goods: [0xe91e63, 0x1e88e5, 0xfdd835, 0x43a047, 0xff7a00, 0x8e24aa],
    greens: [0x2e8b3d, 0x3fa34d],
    sidewalk: '#b9a389',
    sidewalkLine: '#a08c74',
    curb: '#cfc8bb',
    asphalt: '#37373c',
    lanePaint: '#e9e6d8',
    wear: 0.1,
    potholes: 16,
    ground: 0xa8794f,
    sky: ['#2b93d4', '#9dcfe4', '#cfd9d6', '#f3d7a6'],
    fog: 0xd6e2e0,
    skyline: { color: '#8c9aa6', minH: 34, maxH: 84, towers: 1, cranes: 0, hills: 0 },
    city: { lowChance: 0.35, hMin: 6.5, hMax: 15, towerChance: 0.35, towerH: [16, 24], awning: 0.95, balcony: 0.4 },
    quartier: { kind: 'courtyards', wallH: 1.9, houseH: [2.6, 3.6], zinc: 0.9, villa: 0.05, laundry: 0.7, maquis: 0.9, tank: 0.25 },
    market: { stalls: 7, hangar: 1, banner: 1, kiosk: 0, containers: 0 },
    props: { trees: 1, palms: 0.15, lamps: 1, waterTowers: 0.3, carts: 1.2, parkedMotos: 1.4, billboards: 0.6, stallsCity: 2.2 },
  },
  plateau: {
    seed: 37,
    facade: 'glass',
    walls: [0xd9dde3, 0xc9d3dc, 0xe6e9ee, 0xb8c7d9, 0xf0eee8],
    shops: [0x2b2b2b, 0x1d5fa8, 0x2f6b3b, 0x8a8a8a],
    awnings: [0xf4f4f4, 0xf4f4f4, 0x1d5fa8, 0xe0a800],
    towers: [0xb8c7d9, 0xd9dde3, 0x9fb3c8, 0xc9d3dc, 0x8fa6bd],
    roofs: [0x7d8a98, 0x8f959b],
    goods: [0x1e88e5, 0xfdd835, 0xf4f4f4],
    greens: [0x2e8b3d, 0x3fa34d],
    sidewalk: '#d8d5cc',
    sidewalkLine: '#c2bfb4',
    curb: '#efece4',
    asphalt: '#33343a',
    lanePaint: '#ffffff',
    wear: 0.025,
    potholes: 0,
    ground: 0x9b9b92,
    sky: ['#1f8fe0', '#8fd0f5', '#d7eefc', '#f4e6c8'],
    fog: 0xdcefff,
    skyline: { color: '#7fa6cc', minH: 60, maxH: 140, towers: 3, cranes: 0, hills: 0 },
    city: { lowChance: 0.1, hMin: 10, hMax: 26, towerChance: 0.9, towerH: [28, 58], awning: 0.3, balcony: 0.55 },
    quartier: { kind: 'residences', wallH: 1.6, houseH: [7, 12], zinc: 0, villa: 0, laundry: 0, maquis: 0.1, tank: 0.6 },
    market: { stalls: 1, hangar: 0, banner: 0, kiosk: 1, containers: 0 },
    props: { trees: 2, palms: 1.4, lamps: 2, waterTowers: 0, carts: 0, parkedMotos: 0, billboards: 1.2, stallsCity: 0.3 },
  },
  treichville: {
    seed: 53,
    facade: 'zinc',
    walls: [0xb9b0a0, 0xa9a396, 0xc9bda6, 0x9fb3c8, 0xd9a066, 0xbfd3c1],
    shops: [0x1d5fa8, 0xc0392b, 0x2f6b3b, 0x8a8a8a, 0xe0a800],
    awnings: [0xf4f4f4, 0x1d5fa8, 0xe53935, 0xffd140],
    towers: [0x9fb3c8, 0xb8c7d9],
    roofs: [0x7f6a55, 0x8a5a3a, 0x767c82],
    goods: [0xe91e63, 0xfdd835, 0x1e88e5, 0x43a047],
    greens: [0x2e8b3d, 0x2a7a35],
    sidewalk: '#b3ada0',
    sidewalkLine: '#9c968a',
    curb: '#c9c3b6',
    asphalt: '#3a3a3d',
    lanePaint: '#e6e3d6',
    wear: 0.11,
    potholes: 12,
    ground: 0x9d8a6a,
    sky: ['#2a86c4', '#93c3d9', '#c6d2cf', '#efd6a8'],
    fog: 0xd3dedd,
    skyline: { color: '#7f8f9c', minH: 30, maxH: 70, towers: 1, cranes: 2, hills: 0 },
    city: { lowChance: 0.4, hMin: 5.5, hMax: 13, towerChance: 0.25, towerH: [14, 22], awning: 0.6, balcony: 0.2 },
    quartier: { kind: 'warehouses', wallH: 2.2, houseH: [4, 7], zinc: 1, villa: 0, laundry: 0.2, maquis: 0.4, tank: 0.5 },
    market: { stalls: 3, hangar: 1, banner: 0.4, kiosk: 0, containers: 1 },
    props: { trees: 1, palms: 0.2, lamps: 1.4, waterTowers: 0.4, carts: 0.4, parkedMotos: 0.6, billboards: 0.5, stallsCity: 0.6 },
  },
  cocody: {
    seed: 71,
    facade: 'villa',
    walls: [0xf3e9d2, 0xebd9b8, 0xe7b7a0, 0xf6f1e6, 0xd9c9a8, 0xbfd3c1],
    shops: [0x2f6b3b, 0x1d5fa8, 0x8a8a8a, 0xe0a800],
    awnings: [0xf4f4f4, 0x16a34a, 0xffd140],
    towers: [0xd9dde3, 0xc9d3dc, 0xb8c7d9],
    roofs: [0xb04a2a, 0x9a4a3a, 0x7d8a98],
    goods: [0xe91e63, 0xfdd835, 0x43a047],
    greens: [0x2e8b3d, 0x3fa34d, 0x2a7a35, 0x4caf50],
    sidewalk: '#d3cfc2',
    sidewalkLine: '#bcb8ab',
    curb: '#e8e4d8',
    asphalt: '#35363b',
    lanePaint: '#f7f7f2',
    wear: 0.03,
    potholes: 2,
    ground: 0x8f9c6a,
    sky: ['#2892dd', '#9ad8f0', '#dcf0ec', '#f7e6bd'],
    fog: 0xe2f2ee,
    skyline: { color: '#7fa07f', minH: 30, maxH: 70, towers: 1, cranes: 0, hills: 1 },
    city: { lowChance: 0.35, hMin: 7, hMax: 17, towerChance: 0.55, towerH: [18, 34], awning: 0.35, balcony: 0.5 },
    quartier: { kind: 'villas', wallH: 2.4, houseH: [3.6, 5.2], zinc: 0.1, villa: 0.8, laundry: 0.15, maquis: 0.3, tank: 0.5 },
    market: { stalls: 1, hangar: 0, banner: 0.2, kiosk: 1, containers: 0 },
    props: { trees: 2, palms: 1.5, lamps: 1.2, waterTowers: 0.15, carts: 0.1, parkedMotos: 0.15, billboards: 0.7, stallsCity: 0.25 },
  },
};

// Palette de secours pour un style inconnu (sécurité si un secteur est mal nommé).
const STYLE_FALLBACK = STYLES.yopougon;

// Assez de variantes pour ne pas voir la répétition, assez peu pour rester léger : les
// variantes d'un seul secteur vivent à la fois (elles sont refaites au changement de niveau).
const VARIANTS = { ville: 5, marche: 2, quartier: 2, pont: 1 };

const STEEL = 0x4a5058;

export const styleFor = (sector) => STYLES[sector?.look] || STYLE_FALLBACK;

// ---------- Textures ----------
function facadeTexture(kind) {
  // Une « case » de 3,2 m : mur clair (teinté par la couleur de l'immeuble) + une fenêtre.
  // Le dessin change selon la commune : ciment, tôle, verre ou villa.
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, 128, 128);

  if (kind === 'zinc') {
    // Tôle ondulée : bandes horizontales, petite fenêtre à volets de bois.
    for (let y = 0; y < 128; y += 8) {
      x.fillStyle = y % 16 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)';
      x.fillRect(0, y, 128, 4);
    }
    x.fillStyle = '#7a6248';
    x.fillRect(26, 34, 76, 58); // cadre bois
    x.fillStyle = '#3d4a56';
    x.fillRect(32, 40, 64, 46);
    x.fillStyle = 'rgba(255,255,255,0.22)';
    x.fillRect(32, 40, 26, 46);
    x.fillStyle = 'rgba(0,0,0,0.18)';
    x.fillRect(0, 116, 128, 12);
  } else if (kind === 'glass') {
    // Façade de tour : vitrage bleuté, montants, bandeau de plancher.
    x.fillStyle = '#e9eef3';
    x.fillRect(0, 0, 128, 128);
    for (let gx = 0; gx < 4; gx++) {
      for (let gy = 0; gy < 4; gy++) {
        const g = x.createLinearGradient(gx * 32, gy * 32, gx * 32 + 32, gy * 32 + 32);
        g.addColorStop(0, '#7fa3c4');
        g.addColorStop(0.6, '#3c6488');
        g.addColorStop(1, '#24445f');
        x.fillStyle = g;
        x.fillRect(gx * 32 + 3, gy * 32 + 3, 26, 24);
        x.fillStyle = 'rgba(255,255,255,0.20)';
        x.fillRect(gx * 32 + 3, gy * 32 + 3, 10, 24);
      }
    }
    x.fillStyle = '#d3dae1';
    for (let gx = 0; gx <= 4; gx++) x.fillRect(Math.min(gx * 32, 125), 0, 3, 128);
    x.fillStyle = '#c7ced6';
    for (let gy = 0; gy < 4; gy++) x.fillRect(0, gy * 32 + 27, 128, 5);
  } else if (kind === 'villa') {
    // Villa : mur crème, fenêtre à arc, volets, garde-corps de balcon.
    x.fillStyle = 'rgba(0,0,0,0.05)';
    x.fillRect(0, 112, 128, 16);
    x.fillStyle = '#c8b48e';
    x.fillRect(30, 26, 68, 70);
    x.fillStyle = '#2f4a5c';
    x.beginPath();
    x.moveTo(36, 96);
    x.lineTo(36, 52);
    x.quadraticCurveTo(64, 24, 92, 52);
    x.lineTo(92, 96);
    x.closePath();
    x.fill();
    x.fillStyle = 'rgba(255,255,255,0.25)';
    x.fillRect(40, 54, 18, 40);
    x.fillStyle = '#7a4a2a';
    x.fillRect(26, 26, 6, 72);
    x.fillRect(96, 26, 6, 72);
    x.fillStyle = '#ffffff';
    x.fillRect(0, 104, 128, 5);
    for (let bx = 4; bx < 128; bx += 14) {
      x.fillStyle = '#b0a58e';
      x.fillRect(bx, 108, 3, 12);
    }
  } else {
    // Ciment peint : la fenêtre d'origine (Yopougon, quartiers populaires).
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
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function roadTexture(kind, style) {
  // Texture d'un tronçon : trottoirs, bitume, lignes. 18 m de large x 48 m de long.
  // Couleurs et usure viennent du style de la commune (latérite à Yopougon, dalles claires
  // au Plateau, bitume rapiécé à Adjamé...).
  const S = style || STYLE_FALLBACK;
  const W = 256;
  const H = 512;
  const bridge = kind === 'bridge';
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  const mx = (m) => ((m + 9) / 18) * W;
  x.fillStyle = bridge ? '#b3aca0' : S.sidewalk;
  x.fillRect(0, 0, W, H);

  // Dalles de trottoir (Plateau, Cocody) : joints clairs.
  if (!bridge && S.sidewalkLine) {
    x.strokeStyle = S.sidewalkLine;
    x.lineWidth = 2;
    for (let m = 7.4; m <= 9; m += 0.8) {
      const px = mx(m);
      x.beginPath(); x.moveTo(px, 0); x.lineTo(px, H); x.stroke();
      x.beginPath(); x.moveTo(W - px, 0); x.lineTo(W - px, H); x.stroke();
    }
    for (let y = 0; y < H; y += 34) {
      x.beginPath(); x.moveTo(0, y); x.lineTo(mx(-7), y); x.stroke();
      x.beginPath(); x.moveTo(mx(7), y); x.lineTo(W, y); x.stroke();
    }
  }

  x.fillStyle = bridge ? '#4a4a4e' : S.asphalt;
  x.fillRect(mx(-7), 0, mx(7) - mx(-7), H);

  // Usure, taches d'huile et nids-de-poule : marqués dans les vieilles communes.
  for (let i = 0; i < 160; i++) {
    x.fillStyle = `rgba(${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${0.03 + S.wear * 0.25})`;
    x.fillRect(mx(-7) + Math.random() * (mx(7) - mx(-7)), Math.random() * H, 6 + Math.random() * 18, 3 + Math.random() * 10);
  }
  for (let i = 0; i < S.potholes; i++) {
    x.fillStyle = 'rgba(20,20,22,0.55)';
    x.beginPath();
    x.ellipse(
      mx(-6.5) + Math.random() * (mx(6.5) - mx(-6.5)),
      Math.random() * H,
      7 + Math.random() * 12,
      4 + Math.random() * 7,
      Math.random() * 3, 0, Math.PI * 2,
    );
    x.fill();
  }

  x.fillStyle = S.lanePaint;
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

function skyTexture(style) {
  // Ciel de la commune : bleu franc au Plateau, brume chaude à Yopougon et Adjamé.
  const S = style || STYLE_FALLBACK;
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, S.sky[0]);
  g.addColorStop(0.5, S.sky[1]);
  g.addColorStop(0.62, S.sky[2]);
  g.addColorStop(1, S.sky[3]);
  x.fillStyle = g;
  x.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function skylineTexture(style) {
  // Silhouette lointaine : toits bas à Yopougon, tours au Plateau, grues au port,
  // collines vertes à Cocody. Elle donne tout de suite la commune où l'on roule.
  const S = style || STYLE_FALLBACK;
  const W = 1024;
  const H = 200;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  const r = rng(77 + S.seed);
  x.fillStyle = S.skyline.color;
  let px = 0;
  while (px < W) {
    const w = 28 + r() * 46;
    const h = S.skyline.minH + r() * (S.skyline.maxH - S.skyline.minH);
    x.fillRect(px, H - h, w, h);
    if (r() < 0.3) x.fillRect(px + w / 2 - 1.5, H - h - 22, 3, 22); // antenne
    if (r() < 0.25) x.fillRect(px + 4, H - h + 8, w - 8, 3); // étage
    px += w + r() * 6;
  }

  // Tours vitrées (Plateau, Adjamé, Cocody) : plus larges, avec un toit en escalier.
  for (let i = 0; i < S.skyline.towers; i++) {
    const w = 50 + r() * 60;
    const h = S.skyline.maxH * (0.85 + r() * 0.5);
    const tx = 80 + r() * (W - 200);
    x.fillRect(tx, H - h, w, h);
    x.fillRect(tx + w * 0.2, H - h - 16, w * 0.6, 16);
    x.fillStyle = 'rgba(255,255,255,0.20)';
    for (let wy = H - h + 12; wy < H - 8; wy += 14) x.fillRect(tx + 4, wy, w - 8, 2);
    x.fillStyle = S.skyline.color;
  }

  // Grues portuaires (Treichville) : mâts et flèches au-dessus des entrepôts.
  for (let i = 0; i < S.skyline.cranes; i++) {
    const cx = 180 + i * 320 + r() * 80;
    x.fillRect(cx, 40, 6, H - 40);
    x.fillRect(cx - 60, 44, 130, 6);
    x.fillRect(cx - 46, 50, 4, 46);
    x.fillRect(cx + 30, 50, 4, 46);
  }

  // Collines vertes (Cocody) : grandes courbes derrière les toits.
  if (S.skyline.hills) {
    x.fillStyle = 'rgba(70,110,70,0.55)';
    x.beginPath();
    x.moveTo(0, H);
    for (let hx = 0; hx <= W; hx += 64) x.quadraticCurveTo(hx + 32, H - 90 - r() * 60, hx + 64, H - 30);
    x.lineTo(W, H);
    x.closePath();
    x.fill();
  }

  // Le pont à haubans d'Abidjan, visible de loin.
  x.strokeStyle = S.skyline.color;
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
function sidewalk(P, S, side) {
  // Trottoir surélevé + bordure : donne du relief au bord de la route.
  // La couleur vient de la commune : latérite à Yopougon, dalles claires au Plateau.
  const walk = new THREE.Color(S.sidewalk).getHex();
  const curb = new THREE.Color(S.curb).getHex();
  P.box(2.0, 0.18, L, walk, side * 8.1, 0.09, 0);
  P.box(0.24, 0.22, L, shade(curb, 0.86), side * 7.1, 0.11, 0);
}

function streetLamp(P, side, z) {
  const toRoad = -side;
  const px = side * 7.5;
  P.cyl(0.07, 0.1, 6.5, 0x44484f, px, 0.18 + 3.25, z, 6);
  P.box(1.3, 0.08, 0.08, 0x44484f, px + toRoad * 0.65, 6.6, z);
  P.box(0.5, 0.12, 0.26, 0xfff3c4, px + toRoad * 1.25, 6.52, z);
}

function tree(P, S, pick, side, z, kind = -1) {
  const tx = side * 7.9;
  const palm = kind === 0 || (kind < 0 && pick([0, 1]) === 0);
  if (palm) {
    P.cyl(0.1, 0.17, 5, 0x7a5a3a, tx, 0.18 + 2.5, z, 6);
    for (let i = 0; i < 7; i++) {
      const ry = (i / 7) * Math.PI * 2;
      P.box(2.4, 0.05, 0.32, pick(S.greens), tx + Math.cos(ry) * 1.05, 5.15, z - Math.sin(ry) * 1.05, 0, ry, -0.4);
    }
  } else {
    P.cyl(0.15, 0.22, 3, 0x6f4e2f, tx, 0.18 + 1.5, z, 6);
    P.sphere(1.7, pick(S.greens), tx, 4.2, z, 8, 6);
    P.sphere(1.2, pick(S.greens), tx + 0.6, 5.1, z + 0.3, 8, 6);
  }
}

// ---------- Accessoires de rue (ils changent d'une commune à l'autre) ----------
function waterTower(P, x, z) {
  // Château d'eau de quartier : quatre pieds, cuve ronde, échelle, gyrophare rouge.
  for (const dx of [-0.9, 0.9]) for (const dz of [-0.9, 0.9]) P.cyl(0.08, 0.08, 4.2, 0x8a8a8a, x + dx, 2.1, z + dz, 5);
  P.cyl(1.5, 1.5, 0.25, 0x9aa0a6, x, 4.3, z, 10);
  P.cyl(1.35, 1.35, 2.6, 0xd9d4c8, x, 5.7, z, 10);
  P.cyl(0.42, 0.42, 0.5, 0xd32f2f, x, 7.2, z, 8);
  P.box(0.06, 4.0, 0.06, 0x6b6b6b, x + 1.5, 2.0, z);
}

function parkedMotos(P, style, pick, side, z) {
  // Rangée de taxis-motos garés, avec les conducteurs debout à côté : la signature d'Adjamé
  // et de Yopougon. Trois motos + deux pilotes, pour rester léger.
  const S = style;
  const x = side * 8.5;
  for (let k = 0; k < 3; k++) {
    const mz = z + k * 1.7;
    const body = pick([0xe53935, 0x1e88e5, 0xffd140, 0x43a047, 0xf4f4f4]);
    P.box(0.34, 0.34, 1.5, 0x2b2b2b, x, 0.5, mz);
    P.box(0.38, 0.24, 0.55, body, x, 0.84, mz - 0.3); // réservoir
    P.box(0.2, 0.16, 0.3, 0x1c1f24, x, 0.96, mz + 0.6); // selle
    for (const dz of [-0.55, 0.55]) P.cyl(0.27, 0.27, 0.1, 0x1c1f24, x, 0.3, mz + dz, 8, 0, 0, Math.PI / 2);
    P.box(0.62, 0.05, 0.05, 0x555555, x, 1.0, mz - 0.55); // guidon
    if (k % 2 === 0) {
      const px = x - side * 0.55;
      P.box(0.36, 0.62, 0.24, pick([0xff7a00, 0x43a047, 0xf4e9d7, 0x1e88e5]), px, 1.2, mz + 0.3);
      P.sphere(0.14, pick([0x3b2416, 0x4a2e1c, 0x5a3a25]), px, 1.66, mz + 0.3, 6, 5);
      P.box(0.32, 0.1, 0.32, pick([0xffd140, 0xe53935, 0x1e88e5]), px, 1.8, mz + 0.3); // casque
    }
  }
  if (S.props.parkedMotos > 1 && pick([0, 1]) === 0) P.cone(1.0, 0.4, pick(S.awnings), x, 2.3, z + 2.1, 8); // parasol du point moto
}

function vendorCart(P, style, pick, side, z) {
  // Charrette de vendeuse : planche, fruits empilés, parasol dépareillé.
  const S = style;
  const x = side * 8.6;
  P.box(1.2, 0.12, 2.0, 0x8a6a45, x, 0.78, z);
  for (const dz of [-0.85, 0.85]) P.box(0.95, 0.42, 0.06, 0x7a5a3a, x, 0.96, z + dz);
  for (const dz of [-0.6, 0.6]) P.cyl(0.34, 0.34, 0.08, 0x2b2b2b, x - side * 0.55, 0.44, z + dz, 10, 0, 0, Math.PI / 2);
  for (let k = 0; k < 5; k++) {
    P.box(0.26, 0.2, 0.26, pick(S.goods), x - 0.3 + (k % 2) * 0.6, 0.94, z - 0.7 + Math.floor(k / 2) * 0.7);
  }
  P.cyl(0.03, 0.03, 2.3, 0x555555, x + side * 0.5, 1.15, z + 0.5, 5);
  P.cone(1.15, 0.45, pick(S.awnings), x + side * 0.5, 2.4, z + 0.5, 8);
}

function containerStack(P, style, pick, side, z) {
  // Conteneurs du port (Treichville) : deux piles, couleurs de compagnies maritimes.
  const S = style;
  const x = side * (14 + pick([0, 2]));
  const colors = [0xc0392b, 0x1d5fa8, 0x2f6b3b, 0xe0a800, 0x8a8a8a, 0x6d3b8e];
  for (let k = 0; k < 3; k++) {
    if (k === 2 && pick([0, 1]) === 0) break;
    P.box(2.5, 2.5, 6.2, pick(colors), x, 1.25 + k * 2.45, z + (k % 2) * 0.5);
    P.box(2.54, 0.08, 6.24, shade(pick(colors), 0.7), x, 2.5 + k * 2.45, z + (k % 2) * 0.5); // arête
  }
  for (const dz of [-2.4, 2.4]) P.box(0.08, 0.7, 0.08, 0x555555, x + side * 1.1, 0.5, z + dz);
  if (S.props.containers) P.box(1.6, 1.2, 1.6, 0x9aa0a6, x - side * 2.4, 0.7, z + 1.2); // petite grue mobile
}

function portCrane(P, side, z) {
  // Grue du port : mât jaune, flèche horizontale, câble et conteneur suspendu.
  const x = side * 20;
  const yellow = 0xe0a800;
  for (const dz of [-1.8, 1.8]) P.box(0.45, 14, 0.45, yellow, x, 7, z + dz);
  P.box(0.5, 0.5, 4.2, yellow, x, 14, z);
  P.box(0.4, 0.4, 12, yellow, x, 14.4, z - side * 3.2);
  P.box(0.06, 6.5, 0.06, 0x444444, x, 11, z - side * 8.4);
  P.box(2.4, 2.3, 5.6, 0xc0392b, x, 6.4, z - side * 8.4);
  P.box(2.2, 1.0, 1.4, 0xd9d4c8, x + 0.1, 9.2, z + 1.2); // cabine
}

function billboard(P, pick, side, z) {
  // Panneau publicitaire géant : deux pieds, cadre, affiche vive.
  const x = side * 8.8;
  P.cyl(0.12, 0.12, 6, 0x4a4f57, x, 3.2, z - 1.8, 6);
  P.cyl(0.12, 0.12, 6, 0x4a4f57, x, 3.2, z + 1.8, 6);
  P.box(0.26, 2.6, 5.0, 0x0d2b6b, x, 6.6, z);
  P.box(0.3, 2.2, 4.6, pick([0xffd140, 0x00a8e8, 0xff7a00, 0x16a34a]), x - side * 0.02, 6.6, z);
  P.box(0.34, 0.45, 4.0, 0xf4f4f4, x - side * 0.03, 7.25, z);
}

function stall(P, S, pick, side, z, xoff = 8.5) {
  // Étals de marché avec parasols colorés (marché de rue, boutiques de quartier).
  const x = side * xoff;
  P.box(1.8, 0.75, 1.0, 0x8a6a45, x, 0.18 + 0.375, z);
  for (let g = 0; g < 3; g++) P.box(0.32, 0.26, 0.32, pick(S.goods), x - 0.6 + g * 0.6, 0.18 + 0.88, z);
  P.cyl(0.03, 0.03, 2.3, 0x555555, x + 0.8, 0.18 + 1.15, z + 0.4, 5);
  P.cone(1.3, 0.45, pick(S.awnings), x, 0.18 + 2.45, z, 8);
}

function kiosk(P, S, pick, side, z) {
  // Kiosque à journaux / téléphone (Plateau, Cocody) : petit, coloré, vitré.
  const x = side * 8.8;
  const wall = pick(S.walls);
  P.box(1.6, 2.2, 1.6, wall, x, 0.18 + 1.1, z);
  P.box(1.9, 0.16, 1.9, shade(wall, 0.75), x, 0.18 + 2.28, z);
  P.box(1.2, 0.9, 0.08, 0x2b2b2b, x - side * 0.82, 0.18 + 1.4, z);
  P.box(0.3, 1.4, 1.4, pick([0xe53935, 0x1e88e5, 0xffd140]), x - side * 0.85, 0.18 + 0.72, z);
}

function maquis(P, S, pick, side, z) {
  // Maquis du coin : tables en plastique, chaises, enseigne peinte, casiers de boissons.
  const x = side * 8.35;
  P.box(0.9, 0.08, 0.9, 0xf4f4f4, x, 0.18 + 0.72, z);
  P.cyl(0.05, 0.05, 0.72, 0x8a8a8a, x, 0.18 + 0.36, z, 5);
  for (const dz of [-0.75, 0.75]) P.box(0.45, 0.55, 0.45, pick([0xe53935, 0x1d5fa8, 0x16a34a]), x, 0.18 + 0.28, z + dz);
  P.box(0.1, 1.0, 2.2, pick([0xe0a800, 0x16a34a, 0xc0392b]), side * 9.1, 0.18 + 3.0, z);
  P.cyl(0.06, 0.06, 2.6, 0x6b5642, side * 9.1, 0.18 + 1.3, z - 1.1, 5);
  for (let k = 0; k < 3; k++) P.box(0.34, 0.5, 0.34, pick(S.goods), x + 0.4, 0.18 + 1.14, z - 0.9 + k * 0.9);
}






function hedge(P, S, pick, side, z) {
  // Haie taillée + bougainvillier : les rues résidentielles de Cocody.
  const x = side * 9.6;
  P.box(0.9, 1.5, 3.4, shade(pick(S.greens), 0.85), x, 0.18 + 0.75, z);
  for (let k = 0; k < 3; k++) {
    P.sphere(0.48, pick([0xd81b60, 0xe91e63, 0xf06292]), x - side * 0.25, 0.18 + 1.5, z - 1.2 + k * 1.2, 6, 5);
  }
}

function laundryLine(P, S, pick, side, z) {
  // Linge qui sèche dans la cour : très courant à Yopougon et Adjamé.
  const x = side * 11.5;
  for (const dz of [-2, 2]) P.cyl(0.05, 0.05, 2.2, 0x8a8a8a, x, 0.18 + 1.1, z + dz, 5);
  P.box(0.03, 0.03, 4.2, 0x8a8a8a, x, 0.18 + 2.1, z);
  for (let k = 0; k < 3; k++) P.box(0.04, 0.55, 0.5, pick(S.awnings), x, 0.18 + 1.78, z - 1.2 + k * 1.1);
}

function hangar(P, S, pick, side, z) {
  // Hangar du marché : grand toit de tôle sur poteaux, sacs empilés dessous.
  const x = side * 13.5;
  for (const dz of [-6, 6]) {
    for (const dx of [-2.4, 2.4]) P.cyl(0.12, 0.12, 3.2, 0x9a9a9a, x + dx, 0.18 + 1.6, z + dz, 6);
  }
  P.box(6.2, 0.1, 14.2, 0x767c82, x, 0.18 + 3.18, z);
  P.box(6.0, 0.14, 14.0, 0x9aa0a6, x, 0.18 + 3.3, z, 0, 0, side * 0.05);
  for (let k = 0; k < 6; k++) {
    P.box(0.6, 0.5, 0.5, pick([0xd9c39a, 0xc9b48a, 0xb8a278]), x + pick([-2, -1, 0, 1, 2]), 0.18 + 0.25, z + pick([-5, -3, 0, 3, 5]));
  }
}

function powerPole(P, side, z) {
  // Poteau électrique et ses fils : le long de toutes les rues d'Abidjan.
  const poleX = side * 8.9;
  P.cyl(0.1, 0.15, 9, 0x6b5642, poleX, 0.18 + 4.5, z, 6);
  P.box(2.4, 0.1, 0.1, 0x6b5642, poleX, 8.6, z);
  for (const o of [-0.95, 0, 0.95]) P.box(0.03, 0.03, L, 0x1c1c1c, poleX + o, 8.55, 0);
}

// ---------- Ambiance : la rue commerçante (immeubles, boutiques, panneaux) ----------
function buildCity({ style, R, r, pick, F, P }) {
  const S = style;
  const C = S.city;
  for (const side of [-1, 1]) {
    const toRoad = -side;
    sidewalk(P, S, side);

    // Immeubles proches, de tailles variées, avec boutiques, balcons et auvents.
    let z = -L / 2 + r(0, 2);
    while (z < L / 2 - 7) {
      const d = r(8, 14);
      if (z + d > L / 2) break;
      const w = r(7, 11);
      const low = R() < C.lowChance;
      const h = low ? r(C.hMin, C.hMin + 2.5) : r(C.hMin + 2, C.hMax);
      const wall = pick(S.walls);
      const cx = side * (9.4 + w / 2);
      const cz = z + d / 2;
      const faceX = side * 9.4;
      F.facade(w, h, d, wall, cx, h / 2, cz);
      P.box(w + 0.3, 0.28, d + 0.3, shade(wall, 0.78), cx, h + 0.14, cz); // corniche de toit
      P.box(0.14, 0.6, d * 0.96, shade(wall, 0.6), faceX + toRoad * 0.05, 0.3, cz); // plinthe à l'ombre
      if (R() < 0.35) P.cyl(0.8, 0.8, 1.3, 0x8da2b5, cx, h + 0.9, cz, 10); // citerne sur le toit
      if (R() < 0.3) P.cyl(0.03, 0.03, 3.5, 0x555555, cx, h + 2.0, cz, 4); // antenne
      if (R() < 0.18) P.box(1.6, 1.0, 1.6, shade(wall, 0.9), cx, h + 0.6, cz + r(-1, 1)); // cage d'escalier
      // Balcons + climatiseurs sur les étages (très visibles de la rue).
      for (let fl = 1; fl < Math.floor(h / 3.2); fl++) {
        if (R() < C.balcony) {
          P.box(0.9, 0.12, d * 0.55, 0xe6dcc6, faceX + toRoad * 0.45, fl * 3.2 + 0.9, cz + r(-d * 0.15, d * 0.15));
          P.box(0.1, 0.7, d * 0.55, shade(wall, 0.85), faceX + toRoad * 0.9, fl * 3.2 + 1.3, cz);
        }
        if (R() < 0.25) P.box(0.45, 0.35, 0.6, 0xcfd4d8, faceX + toRoad * 0.15, fl * 3.2 + 2.3, cz + r(-d * 0.3, d * 0.3));
      }
      // Devanture + auvent + rideau de fer.
      P.box(0.18, 3.0, d * 0.92, pick(S.shops), faceX + toRoad * 0.1, 1.5, cz);
      if (R() < C.awning) P.box(1.5, 0.08, d * 0.8, pick(S.awnings), faceX + toRoad * 0.8, 3.05, cz, 0, 0, -0.3 * toRoad);
      if (R() < 0.5) P.box(0.06, 2.0, d * 0.5, 0x7a7f84, faceX + toRoad * 0.22, 1.0, cz); // rideau tiré
      z += d + (R() < 0.25 ? r(3, 6) : r(0.4, 1.2));
    }

    // Grandes tours en arrière-plan (Plateau, Adjamé, Cocody) : la profondeur de la ville.
    if (R() < C.towerChance) {
      const w = r(10, 14);
      const d = r(12, 16);
      const h = r(C.towerH[0], C.towerH[1]);
      const tx = side * r(28, 40);
      const tz = r(-L / 2 + 8, L / 2 - 8);
      F.facade(w, h, d, pick(S.towers), tx, h / 2, tz);
      P.box(w + 0.4, 0.5, d + 0.4, 0x7d8a98, tx, h + 0.25, tz);
    }

    // Lampadaires (le Plateau en a deux fois plus, Yopougon un seul).
    for (let k = 0; k < S.props.lamps; k++) streetLamp(P, side, r(-18, 18));
    powerPole(P, side, r(-18, 18));

    // Arbres : palmiers ou manguiers selon la commune.
    for (let k = 0; k < S.props.trees; k++) tree(P, S, pick, side, r(-20, 20), R() < S.props.palms ? 0 : 1);

    // Étals devant les boutiques (dense à Adjamé, rare au Plateau).
    for (let k = 0; k < Math.floor(r(0, 2) * S.props.stallsCity); k++) stall(P, S, pick, side, r(-20, 20));

    // Rangée de taxis-motos garés (Yopougon et Adjamé surtout).
    if (R() < S.props.parkedMotos) parkedMotos(P, S, pick, side, r(-18, 18));

    // Charrettes de vendeuses.
    if (R() < S.props.carts) vendorCart(P, S, pick, side, r(-20, 20));

    // Château d'eau de quartier.
    if (R() < S.props.waterTowers) waterTower(P, side * 11.5, r(-18, 18));

    // Conteneurs et grue du port (Treichville).
    if (S.props.containers && R() < 0.8) containerStack(P, S, pick, side, r(-16, 16));
    if (S.props.containers && R() < 0.35) portCrane(P, side, r(-14, 14));

    if (R() < 0.5) maquis(P, S, pick, side, r(-18, 18));
  }

  if (R() < S.props.billboards) billboard(P, pick, R() < 0.5 ? -1 : 1, r(-14, 14));

  return { facades: F.build(), props: P.build() };
}

// ---------- Ambiance : le marché de rue (étals, parasols, hangar, banderoles) ----------
function buildMarket({ style, R, r, pick, F, P }) {
  const S = style;
  const M = S.market;
  const SHIRTS = [0xe53935, 0x1e88e5, 0xfdd835, 0x43a047, 0xff7a00, 0x8e24aa, 0xd81b60];
  const SKINS = [0x3b2416, 0x4a2e1c, 0x5a3a25, 0x6b4630];
  for (const side of [-1, 1]) {
    sidewalk(P, S, side);

    // Étals serrés le long du trottoir, avec leurs vendeuses.
    for (let k = 0; k < M.stalls; k++) {
      const sz = r(-L / 2 + 3, L / 2 - 3);
      stall(P, S, pick, side, sz, 8.4 + r(0, 0.6));
      if (k % 2 === 0) {
        const sx = side * 9.5;
        P.box(0.36, 0.52, 0.26, pick(SHIRTS), sx, 0.18 + 0.46, sz + 0.1); // vendeuse assise
        P.sphere(0.14, pick(SKINS), sx, 0.18 + 0.86, sz + 0.1, 6, 5);
        P.box(0.34, 0.1, 0.34, pick(S.awnings), sx, 0.18 + 1.02, sz + 0.1); // foulard
      }
    }

    // Hangar du marché (Adjamé, Yopougon, Treichville).
    if (M.hangar && R() < M.hangar) hangar(P, S, pick, side, r(-14, 14));

    // Immeubles bas derrière le marché (2 à 3 niveaux, tôle et ciment).
    let z = -L / 2 + r(0, 2);
    while (z < L / 2 - 8) {
      const d = r(8, 13);
      const w = r(8, 12);
      const h = r(5, 9.5);
      const wall = pick(S.walls);
      const cx = side * (20 + w / 2);
      F.facade(w, h, d, wall, cx, h / 2, z + d / 2);
      P.box(w + 0.3, 0.3, d + 0.3, shade(wall, 0.75), cx, h + 0.15, z + d / 2);
      if (R() < 0.35) P.cyl(0.8, 0.8, 1.2, 0x8da2b5, cx, h + 0.8, z + d / 2, 10);
      z += d + r(0.5, 2);
    }

    for (const lz of [-14, 14]) streetLamp(P, side, lz);
    for (let k = 0; k < 2; k++) tree(P, S, pick, side, r(-20, 20));
    if (M.kiosk) kiosk(P, S, pick, side, r(-16, 16));
    if (M.containers) {
      containerStack(P, S, pick, side, r(-14, 14));
      portCrane(P, side, r(-10, 10));
    }
    if (R() < 0.5) vendorCart(P, S, pick, side, r(-18, 18));
    if (R() < 0.45) parkedMotos(P, S, pick, side, r(-16, 16));
    if (R() < 0.5) laundryLine(P, S, pick, side, r(-18, 18));
    if (R() < 0.4) maquis(P, S, pick, side, r(-18, 18));
  }

  // Banderole en travers de la rue : la signature des marchés d'Abidjan.
  if (R() < M.banner) {
    const bz = r(-L / 2 + 7, L / 2 - 7);
    P.cyl(0.08, 0.1, 6.2, 0x555555, -8.35, 3.1, bz, 6);
    P.cyl(0.08, 0.1, 6.2, 0x555555, 8.35, 3.1, bz, 6);
    P.box(16.7, 0.95, 0.06, pick([0x16a34a, 0xe53935, 0x1d5fa8, 0xe0a800]), 0, 5.65, bz);
    P.box(15.6, 0.3, 0.08, 0xf4f4f4, 0, 5.65, bz);
  }

  return { facades: F.build(), props: P.build() };
}

// ---------- Ambiance : rues d'habitation (le visage de chaque commune) ----------
// Quatre formes de quartier, choisies par le style : cours et maisons basses (Yopougon,
// Adjamé), villas et haies (Cocody), entrepôts du port (Treichville), résidences (Plateau).
function buildQuartier(ctx) {
  const kind = ctx.style.quartier.kind;
  if (kind === 'villas') return buildVillas(ctx);
  if (kind === 'warehouses') return buildWarehouses(ctx);
  if (kind === 'residences') return buildResidences(ctx);
  return buildCourtyards(ctx);
}

function buildCourtyards({ style, R, r, pick, F, P }) {
  const S = style;
  const Q = S.quartier;
  for (const side of [-1, 1]) {
    sidewalk(P, S, side);

    // Mur de clôture le long de la rue, avec portails, et maisons dans les cours.
    let z = -L / 2 + 1;
    while (z < L / 2 - 6) {
      const d = r(6, 11);
      if (z + d > L / 2) break;
      const wall = pick(S.walls);
      const wx = side * 9.0;
      const cz = z + d / 2;
      P.box(0.35, Q.wallH, d, wall, wx, 0.18 + Q.wallH / 2, cz);
      P.box(0.55, 0.16, d, shade(wall, 0.8), wx, 0.18 + Q.wallH + 0.08, cz); // chaperon
      if (R() < 0.55) {
        P.box(0.16, 1.9, 2.4, pick([0x2f6b3b, 0x1d5fa8, 0x8a8a8a, 0xc0392b]), wx, 0.18 + 0.95, cz);
        for (const dz of [-1.35, 1.35]) P.box(0.42, 2.5, 0.42, shade(wall, 0.9), wx, 0.18 + 1.25, cz + dz);
      }
      if (R() < 0.85) {
        const w = r(6, 9);
        const h = r(Q.houseH[0], Q.houseH[1]);
        const cx = side * (13.5 + w / 2);
        const wall2 = pick(S.walls);
        F.facade(w, h, 8, wall2, cx, 0.18 + h / 2, cz); // murs avec fenêtres
        if (R() < Q.zinc) {
          // toit de tôle ondulée, légèrement en pente
          P.box(w + 0.6, 0.12, 8.6, 0x9aa0a6, cx, 0.18 + h + 0.06, cz, 0, 0, side * 0.04);
          P.box(w + 0.3, 0.1, 8.4, 0x8f959b, cx, 0.18 + h + 0.17, cz);
        } else if (R() < 0.5) {
          P.cone(w * 0.72, 1.5, pick(S.roofs), cx, 0.18 + h + 0.75, cz, 4, 0, Math.PI / 4, 0);
        } else {
          P.box(w + 0.5, 0.14, 8.5, 0x8f959b, cx, 0.18 + h + 0.07, cz);
        }
        // porte et fenêtres côté rue
        P.box(0.07, 1.6, 0.9, 0x5a4632, side * 13.47, 0.18 + 0.8, cz + 2.9);
        if (R() < Q.tank) P.cyl(0.5, 0.5, 1.0, 0x2b2b2b, cx + r(-2.5, 2.5), 0.18 + 0.5, cz + r(-2.5, 2.5), 8);
        if (R() < Q.laundry) laundryLine(P, S, pick, side, cz);
        if (R() < 0.35) {
          // voiture ou taxi garé dans la cour
          const carZ = cz + r(-3, 3);
          P.box(1.7, 0.6, 3.6, pick([0xe9e9e9, 0xffd140, 0x1d5fa8, 0xc0392b]), side * 15, 0.75, carZ);
          P.box(1.5, 0.45, 1.8, 0x56677a, side * 15, 1.25, carZ + 0.2);
          for (const dz of [-1.2, 1.2]) for (const dx of [-0.75, 0.75]) {
            P.cyl(0.3, 0.3, 0.2, 0x1c1f24, side * 15 + dx, 0.45, carZ + dz, 8, 0, 0, Math.PI / 2);
          }
        }
      }
      z += d + r(0.3, 1.4);
    }

    for (let k = 0; k < S.props.trees; k++) tree(P, S, pick, side, r(-20, 20), R() < S.props.palms ? 0 : 1);
    streetLamp(P, side, r(-18, 18));
    powerPole(P, side, r(-18, 18));
    if (R() < Q.maquis) maquis(P, S, pick, side, r(-18, 18));
    if (R() < 0.4) vendorCart(P, S, pick, side, r(-16, 16));
    if (R() < 0.5) stall(P, S, pick, side, r(-18, 18), 8.4);
    if (R() < S.props.parkedMotos * 0.6) parkedMotos(P, S, pick, side, r(-16, 16));
    if (R() < S.props.waterTowers * 0.7) waterTower(P, side * 15, r(-16, 16));
  }
  return { facades: F.build(), props: P.build() };
}

function buildVillas({ style, R, r, pick, F, P }) {
  // Cocody : villas basses, murs blanchis, haies et bougainvilliers, grosses voitures.
  const S = style;
  const Q = S.quartier;
  for (const side of [-1, 1]) {
    sidewalk(P, S, side);
    let z = -L / 2 + 1;
    while (z < L / 2 - 8) {
      const d = r(10, 16);
      if (z + d > L / 2) break;
      const cz = z + d / 2;
      const wall = pick(S.walls);
      const wx = side * 9.0;
      // mur de clôture bas, chaperon clair, portail en fer
      P.box(0.45, Q.wallH, d, wall, wx, 0.18 + Q.wallH / 2, cz);
      P.box(0.62, 0.18, d, shade(wall, 0.82), wx, 0.18 + Q.wallH + 0.09, cz);
      if (R() < 0.6) {
        P.box(0.18, 1.9, 2.8, 0x2f3a45, wx, 0.18 + 0.95, cz);
        for (let k = -2; k <= 2; k++) P.box(0.26, 1.8, 0.08, 0x707a84, wx - side * 0.12, 0.18 + 0.95, cz + k * 0.62);
      }
      if (R() < 0.7) hedge(P, S, pick, side, cz + (R() < 0.5 ? -d * 0.35 : d * 0.35));
      // villa : un corps principal + une aile, toit en tuiles
      const w = r(8, 11);
      const h = r(Q.houseH[0], Q.houseH[1]);
      const cx = side * (14 + w / 2);
      const hue = pick(S.walls);
      F.facade(w, h, 9, hue, cx, 0.18 + h / 2, cz, 3.4);
      P.box(w + 0.7, 0.35, 9.5, shade(hue, 0.82), cx, 0.18 + h + 0.18, cz); // corniche
      P.cone(w * 0.72, 1.9, pick(S.roofs), cx, 0.18 + h + 1.25, cz, 4, 0, Math.PI / 4, 0); // toit 4 pans
      if (R() < 0.6) {
        const gw = r(3.5, 5);
        P.box(gw, 2.6, 6, shade(hue, 0.95), cx + r(-2, 2), 0.18 + 1.3, cz + 7);
        P.box(gw + 0.4, 0.18, 6.4, shade(hue, 0.78), cx, 0.18 + 2.7, cz + 7);
      }
      // balcon, auvent de porte, climatiseurs
      P.box(3.2, 0.14, 1.2, 0xf4f1e8, side * 13.8, 0.18 + h * 0.66, cz - 1.2);
      P.box(0.95, 0.94, 0.04, 0x3c4b5a, side * 13.95, 0.18 + h * 0.4, cz - 1.2); // baie vitrée
      P.box(0.6, 0.5, 0.75, 0xd7dbdd, side * 13.8, 0.18 + h + 0.55, cz + 2.2); // clim
      P.box(1.6, 0.1, 1.1, pick(S.awnings), side * 13.3, 0.18 + 2.5, cz - 3.2, 0, 0, side * 0.2); // auvent
      // allée dallée + voiture
      P.box(3.2, 0.06, 5.2, 0xd8d3c6, side * 11.2, 0.19, cz + 1.4);
      if (R() < 0.4) {
        const carZ = cz + 1.4;
        P.box(1.8, 0.62, 4.0, pick([0xf4f4f4, 0x2b2b2b, 0x9fb3c8, 0xb8bcc2]), side * 11.2, 0.72, carZ);
        P.box(1.6, 0.5, 2.0, 0x3c4b5a, side * 11.2, 1.22, carZ + 0.2);
        for (const dz of [-1.3, 1.3]) for (const dx of [-0.8, 0.8]) {
          P.cyl(0.31, 0.31, 0.2, 0x1c1f24, side * 11.2 + dx, 0.44, carZ + dz, 8, 0, 0, Math.PI / 2);
        }
      }
      z += d + r(1, 3);
    }
    for (let k = 0; k < S.props.trees; k++) tree(P, S, pick, side, r(-20, 20), R() < S.props.palms ? 0 : 1);
    for (let k = 0; k < S.props.lamps; k++) streetLamp(P, side, r(-18, 18));
    if (R() < 0.3) kiosk(P, S, pick, side, r(-16, 16));
    if (R() < 0.35) billboard(P, pick, side, r(-14, 14));
  }
  return { facades: F.build(), props: P.build() };
}

function buildWarehouses({ style, R, r, pick, F, P }) {
  // Treichville : entrepôts, quais de chargement, conteneurs et grues du port.
  const S = style;
  const Q = S.quartier;
  for (const side of [-1, 1]) {
    sidewalk(P, S, side);
    let z = -L / 2 + 2;
    while (z < L / 2 - 10) {
      const d = r(12, 18);
      if (z + d > L / 2) break;
      const cz = z + d / 2;
      const h = r(Q.houseH[0], Q.houseH[1]);
      const wall = pick(S.walls);
      const w = 9;
      const cx = side * (12 + w / 2);
      F.facade(w, h, d, wall, cx, 0.18 + h / 2, cz, 3.8);
      // toit métallique à deux pans
      P.box(w + 0.8, 0.16, d + 0.8, 0x8f959b, cx, 0.18 + h + 0.08, cz);
      P.box(w * 0.5, 0.14, d + 0.8, 0x767c82, cx + side * 1.4, 0.18 + h + 0.35, cz, 0, 0, side * 0.18);
      // rideau de fer + quai de chargement + palettes
      P.box(0.12, h * 0.62, d * 0.42, 0x6d7378, side * 12.06, 0.18 + h * 0.31, cz);
      P.box(0.1, h * 0.42, d * 0.4, 0x9aa0a6, side * 12.07, 0.18 + h * 0.31, cz);
      P.box(2.2, 0.5, d * 0.5, 0xb3ada0, side * 10.8, 0.43, cz + d * 0.15);
      for (let k = 0; k < 2; k++) P.box(1.0, 0.16, 1.0, 0x8a6a45, side * 10.9, 0.66 + k * 0.18, cz + r(-2, 2));
      P.cyl(0.9, 0.9, 2.2, 0x9fb3c8, cx + r(-2, 2), 0.18 + 1.1, cz + r(-d * 0.3, d * 0.3), 10);
      z += d + r(1, 4);
    }
    containerStack(P, S, pick, side, r(-18, 18));
    containerStack(P, S, pick, side, r(-18, 18));
    if (R() < 0.7) portCrane(P, side, r(-14, 14));
    for (let k = 0; k < S.props.trees; k++) tree(P, S, pick, side, r(-20, 20), 1);
    streetLamp(P, side, r(-18, 18));
    if (R() < 0.6) vendorCart(P, S, pick, side, r(-18, 18));
    if (R() < 0.5) maquis(P, S, pick, side, r(-18, 18));
    if (R() < 0.4) parkedMotos(P, S, pick, side, r(-16, 16));
  }
  return { facades: F.build(), props: P.build() };
}

function buildResidences({ style, R, r, pick, F, P }) {
  // Plateau : résidences et sièges d'entreprises, balcons filants, hall vitré, palmiers.
  const S = style;
  const Q = S.quartier;
  for (const side of [-1, 1]) {
    sidewalk(P, S, side);
    let z = -L / 2 + 1;
    while (z < L / 2 - 9) {
      const d = r(11, 17);
      if (z + d > L / 2) break;
      const cz = z + d / 2;
      const h = r(Q.houseH[0], Q.houseH[1]);
      const w = r(9, 12);
      const cx = side * (11 + w / 2);
      const wall = pick(S.towers);
      F.facade(w, h, d, wall, cx, 0.18 + h / 2, cz, 3.2);
      P.box(w + 0.6, 0.45, d + 0.6, 0x7d8a98, cx, 0.18 + h + 0.22, cz);
      for (let fl = 1; fl < Math.floor(h / 3.2); fl++) {
        P.box(0.8, 0.12, d * 0.9, 0xe6e9ee, side * 10.6, 0.18 + fl * 3.2, cz);
        P.box(0.08, 0.6, d * 0.9, 0xc7ced6, side * 10.95, 0.18 + fl * 3.2 + 0.3, cz);
        if (R() < 0.4) P.box(0.5, 0.4, 0.6, 0xcfd4d8, side * 10.5, 0.18 + fl * 3.2 + 1.1, cz + r(-d * 0.3, d * 0.3));
      }
      // rez-de-chaussée : hall vitré et auvent d'entrée
      P.box(0.2, 2.6, d * 0.7, 0x2f4a5c, side * 10.9, 0.18 + 1.3, cz);
      P.box(0.8, 0.12, 3.2, 0x1d5fa8, side * 10.2, 0.18 + 2.9, cz);
      z += d + r(1.5, 3.5);
    }
    for (let k = 0; k < S.props.trees; k++) tree(P, S, pick, side, r(-20, 20), R() < S.props.palms ? 0 : 1);
    for (let k = 0; k < S.props.lamps; k++) streetLamp(P, side, r(-18, 18));
    if (R() < 0.4) kiosk(P, S, pick, side, r(-16, 16));
    if (R() < 0.6) billboard(P, pick, side, r(-14, 14));
    if (R() < 0.4) hedge(P, S, pick, side, r(-18, 18));
    if (R() < 0.3) waterTower(P, side * 14, r(-16, 16));
  }
  return { facades: F.build(), props: P.build() };
}

// ---------- Ambiance : le pont au-dessus de la lagune ----------
// La lagune elle-même est ajoutée par le monde (une nappe d'eau par tronçon), pour pouvoir
// l'allumer seulement sur les tronçons de pont.
function buildBridge({ style, R, r, pick, P }) {
  const S = style;
  for (const side of [-1, 1]) {
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
    // filets et casiers sur le tablier, côté rambarde
    if (R() < 0.6) {
      const fz = r(-L / 2 + 4, L / 2 - 4);
      for (let k = 0; k < 3; k++) P.box(0.7, 0.35, 0.7, pick(S.awnings), side * 8.2, 0.37, fz + k * 0.9);
    }
  }
  // Un pont n'a pas de façades : la ligne d'horizon du jeu suffit au fond.
  return { facades: null, props: P.build() };
}

// ---------- Fabrique des variantes ----------
function buildVariant(seed, kind, style) {
  const R = rng(seed);
  const ctx = {
    style: style || STYLE_FALLBACK,
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
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.sector = SECTORS[0];
    this.sectorId = this.sector.id;
    this.style = styleFor(this.sector);

    this.sky = skyTexture(this.style);
    this.facadeMat = new THREE.MeshLambertMaterial({ map: facadeTexture(this.style.facade), vertexColors: true });
    this.propMat = new THREE.MeshLambertMaterial({ vertexColors: true });

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
      g.userData.road = new THREE.Mesh(this.roadGeo, this.propMat);
      g.userData.facades = new THREE.Mesh(this.dummyGeo, this.facadeMat);
      g.userData.props = new THREE.Mesh(this.dummyGeo, this.propMat);
      g.userData.water = new THREE.Mesh(this.waterGeo, this.waterMat);
      // L'eau affleure sous la chaussée (assez loin du sol pour éviter le scintillement).
      g.userData.water.position.y = -0.01;
      g.userData.water.visible = false;
      g.add(g.userData.road, g.userData.facades, g.userData.props, g.userData.water);
      this.group.add(g);
      this.chunks.push(g);
    }

    // Sol de la commune sous la ville (suit le joueur)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: this.style.ground }),
    );
    ground.position.y = -0.08;
    this.ground = ground;
    this.group.add(ground);

    // Silhouette lointaine de la commune
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(460, 75),
      new THREE.MeshBasicMaterial({ map: skylineTexture(this.style), transparent: true, fog: false, depthWrite: false }),
    );
    sky.position.y = 30;
    this.skyline = sky;
    this.group.add(sky);

    this.variants = {};
    this._buildVariants();
    this._buildRoadMats();
    this.reset();
  }

  // Toutes les variantes sont fabriquées une seule fois par secteur, puis réutilisées.
  _buildVariants() {
    this._disposeVariants();
    const S = this.style;
    let seed = 1000 + S.seed * 131;
    this.variants = {};
    for (const [kind, n] of Object.entries(VARIANTS)) {
      this.variants[kind] = Array.from({ length: n }, () => {
        seed += 97;
        return buildVariant(seed, kind, S);
      });
    }
  }

  // Libère les anciennes variantes (changement de commune) sans jamais libérer une géométrie
  // encore dessinée : on détache d'abord les tronçons.
  _disposeVariants() {
    if (this.chunks) {
      for (const g of this.chunks) {
        g.userData.facades.geometry = this.dummyGeo;
        g.userData.props.geometry = this.dummyGeo;
      }
    }
    for (const list of Object.values(this.variants || {})) {
      for (const v of list) {
        v.facades?.dispose();
        v.props?.dispose();
      }
    }
    this.variants = {};
  }

  _buildRoadMats() {
    if (this.roadMats) {
      for (const m of Object.values(this.roadMats)) {
        m.map?.dispose();
        m.dispose();
      }
    }
    const S = this.style;
    this.roadMats = {
      plain: new THREE.MeshLambertMaterial({ map: roadTexture('plain', S) }),
      zebra: new THREE.MeshLambertMaterial({ map: roadTexture('zebra', S) }),
      bump: new THREE.MeshLambertMaterial({ map: roadTexture('bump', S) }),
      bridge: new THREE.MeshLambertMaterial({ map: roadTexture('bridge', S) }),
    };
    if (this.chunks) {
      for (const g of this.chunks) g.userData.road.material = this._roadFor(g.userData.district || 'ville');
    }
  }

  // Changement de commune : bâtiments, chaussée, trottoirs, ciel, sol et horizon changent
  // d'un coup. Appelé au début de chaque niveau et quand la course libre change de secteur.
  setSector(sector) {
    if (!sector || sector.id === this.sectorId) return false;
    this.sector = sector;
    this.sectorId = sector.id;
    this.style = styleFor(sector);

    this._buildVariants();
    this._buildRoadMats();

    this.facadeMat.map?.dispose();
    this.facadeMat.map = facadeTexture(this.style.facade);
    this.facadeMat.needsUpdate = true;

    this.ground.material.color.set(this.style.ground);
    this.skyline.material.map?.dispose();
    this.skyline.material.map = skylineTexture(this.style);
    this.skyline.material.needsUpdate = true;

    this.sky?.dispose();
    this.sky = skyTexture(this.style);

    this.reset();
    return true;
  }

  // Ciel dégradé et brume (couleur de l'horizon de la commune)
  applyEnvironment(scene) {
    scene.background = this.sky;
    scene.fog = new THREE.Fog(this.style.fog, 80, 215);
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
    // Le mélange d'ambiances est celui de la commune : Yopougon n'a pas de pont, Treichville
    // en a un, etc. Aucune ambiance d'une autre commune ne peut donc apparaître.
    this.plan = districtPlan(Math.random, districtMix(this.sector, DISTRICTS));
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

