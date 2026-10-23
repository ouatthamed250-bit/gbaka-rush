import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Outil pour construire un objet 3D à partir de formes simples (boîtes, cylindres...) puis les FUSIONNER en un seul objet.
// Une seule fusion = un seul appel de dessin = beaucoup plus fluide sur téléphone.
// Chaque forme garde sa couleur (couleurs de sommets).

export const VC_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color();

export class Builder {
  constructor() {
    this.parts = [];
  }

  add(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s);
    geo.applyMatrix4(_m);
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3);
    _c.set(color);
    for (let i = 0; i < n; i++) {
      col[i * 3] = _c.r;
      col[i * 3 + 1] = _c.g;
      col[i * 3 + 2] = _c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.parts.push(geo);
    return this;
  }

  box(w, h, d, color, x, y, z, rx, ry, rz) {
    return this.add(new THREE.BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz);
  }
  cyl(rTop, rBot, h, color, x, y, z, seg = 8, rx, ry, rz) {
    return this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg), color, x, y, z, rx, ry, rz);
  }
  cone(r, h, color, x, y, z, seg = 8, rx, ry, rz) {
    return this.add(new THREE.ConeGeometry(r, h, seg), color, x, y, z, rx, ry, rz);
  }
  sphere(r, color, x, y, z, ws = 8, hs = 6) {
    return this.add(new THREE.SphereGeometry(r, ws, hs), color, x, y, z);
  }

  // Immeuble : boîte dont la texture de fenêtres se répète (une fenêtre tous les `cell` mètres).
  facade(w, h, d, color, x, y, z, cell = 3.2) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const scale = (from, su, sv) => {
      for (let i = from; i < from + 4; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    };
    scale(0, d / cell, h / cell); // +x
    scale(4, d / cell, h / cell); // -x
    for (let i = 8; i < 16; i++) uv.setXY(i, 0.03, 0.03); // toit et dessous : mur uni
    scale(16, w / cell, h / cell); // +z
    scale(20, w / cell, h / cell); // -z
    return this.add(g, color, x, y, z);
  }

  // Fusion en un seul objet. Renvoie null si rien n'a été ajouté : le monde s'en sert pour
  // masquer un maillage inutile (un pont n'a pas de façades, par exemple).
  build() {
    if (!this.parts.length) return null;
    const g = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts = [];
    return g;
  }
}

// Assombrit/éclaircit une couleur (0xRRGGBB) d'un facteur.
export function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return c.getHex();
}

// Petit générateur aléatoire reproductible (pour que chaque variante de rue soit toujours la même).
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
