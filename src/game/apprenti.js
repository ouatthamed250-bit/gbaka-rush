import * as THREE from 'three';
import { APPRENTI_CRIS, APPRENTI_CRIS_PLEIN } from '../config.js';

// L'apprenti du gbaka : il sort la tête et le bras par la porte, crie une destination, puis rentre.
// Il est collé à la caisse du gbaka (parent = gbaka.inner), côté droit (porte coulissante).

const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
const ease = (o) => o * o * (3 - 2 * o);

export class Apprenti {
  constructor(parent, baseX = 0.62, baseZ = -0.25) {
    this.group = new THREE.Group();
    parent.add(this.group);
    // Position de repos dans le repère du gbaka (0.62 = à l'intérieur, côté porte).
    // Elle est décalée quand l'apprenti est accroché à une porte placée ailleurs.
    this.baseX = baseX;
    this.baseZ = baseZ;

    const shirt = mat(0xc6d437);
    const skin = mat(0x4a2e1c);
    const cap = mat(0xd32f2f);
    const add = (geo, m, x, y, z, parentObj = this.group) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      parentObj.add(mesh);
      return mesh;
    };
    add(new THREE.BoxGeometry(0.44, 0.62, 0.3), shirt, 0, 1.5, 0);
    this.head = new THREE.Group();
    this.head.position.set(0, 2.0, 0);
    this.group.add(this.head);
    add(new THREE.SphereGeometry(0.18, 10, 8), skin, 0, 0, 0, this.head);
    add(new THREE.BoxGeometry(0.34, 0.08, 0.36), cap, 0, 0.15, 0, this.head); // casquette
    add(new THREE.BoxGeometry(0.3, 0.05, 0.14), cap, 0, 0.12, -0.2, this.head); // visière

    // Bras qui crie (tendu vers l'extérieur) et bras qui s'accroche
    this.arm = new THREE.Group();
    this.arm.position.set(0.28, 1.74, 0);
    this.group.add(this.arm);
    add(new THREE.BoxGeometry(0.12, 0.6, 0.12), shirt, 0, -0.28, 0, this.arm);
    add(new THREE.BoxGeometry(0.14, 0.14, 0.14), skin, 0, -0.64, 0, this.arm);
    const armIn = new THREE.Group();
    armIn.position.set(-0.28, 1.74, 0);
    armIn.rotation.z = -2.9;
    this.group.add(armIn);
    add(new THREE.BoxGeometry(0.12, 0.6, 0.12), shirt, 0, -0.28, 0, armIn);
    add(new THREE.BoxGeometry(0.14, 0.14, 0.14), skin, 0, -0.64, 0, armIn);

    this.out = 0; // 0 = rentré, 1 = sorti
    this.state = 'in';
    this.t = 0.8 + Math.random();
    this.text = '';
    this.showing = false;
    this.sweep = false;
    this.lastIdx = -1;
    this.group.visible = false;
  }

  _pick(full) {
    const list = full ? APPRENTI_CRIS_PLEIN : APPRENTI_CRIS;
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === this.lastIdx) i = (i + 1) % list.length;
    this.lastIdx = i;
    return list[i];
  }

  // full : le gbaka est plein (il crie alors "Complet !")
  update(dt, time, full) {
    this.t -= dt;
    if (this.state === 'in' && this.t <= 0) {
      this.state = 'out';
      this.t = 1.8;
      this.text = this._pick(full);
      this.showing = true;
      this.sweep = /gauche/.test(this.text) || Math.random() < 0.3;
    } else if (this.state === 'out' && this.t <= 0) {
      this.state = 'in';
      this.t = 1.1 + Math.random() * 1.8;
      this.showing = false;
    }
    this.out += ((this.state === 'out' ? 1 : 0) - this.out) * Math.min(1, dt * 9);
    const e = ease(Math.min(1, Math.max(0, this.out)));
    this.group.visible = this.out > 0.03;
    this.group.position.set(this.baseX + 0.72 * e, 0, this.baseZ); // de l'intérieur (caché) vers l'extérieur
    this.group.rotation.z = -0.32 * e; // il se penche dehors
    this.arm.rotation.z = (1.9 + Math.sin(time * 9) * 0.3) * e + 0.1 * (1 - e); // bras tendu et agité
    this.arm.rotation.x = this.sweep ? Math.sin(time * 5) * 0.8 * e : 0; // "à gauche, à droite"
    this.head.rotation.y = Math.sin(time * 6) * 0.25 * e;
  }

  // Libère les formes et les couleurs de l'apprenti (appelé à chaque changement de peinture).
  dispose() {
    this.group.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}
