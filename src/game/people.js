import * as THREE from 'three';

// Passants sur les trottoirs : marchent, certains restent debout et font signe au gbaka (bras levé).
// Tout est dessiné avec des "instances" (7 appels de dessin pour tout le monde), donc très léger.

const TORSO = [0xe53935, 0x1e88e5, 0xfdd835, 0x43a047, 0xff7a00, 0x8e24aa, 0xf4e9d7, 0xd81b60, 0x00acc1];
const SKIN = [0x3b2416, 0x4a2e1c, 0x5a3a25, 0x6b4630, 0x2d1a10];
const PANTS = [0x1f2a44, 0x2b2b2b, 0x4a3b2a, 0x6b6b6b];

const _parent = new THREE.Matrix4();
const _local = new THREE.Matrix4();
const _out = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _yaw = new THREE.Vector3(0, 1, 0);

export class People {
  constructor(scene, count = 28) {
    this.count = count;
    const mk = (geo, n) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      scene.add(m);
      return m;
    };
    this.torso = mk(new THREE.BoxGeometry(0.42, 0.62, 0.26), count);
    this.head = mk(new THREE.SphereGeometry(0.15, 8, 6), count);
    this.legs = mk(new THREE.BoxGeometry(0.15, 0.55, 0.15), count * 2);
    this.arms = mk(new THREE.BoxGeometry(0.11, 0.55, 0.11), count * 2);
    this.meshes = [this.torso, this.head, this.legs, this.arms];

    const c = new THREE.Color();
    this.people = [];
    for (let i = 0; i < count; i++) {
      const torso = TORSO[i % TORSO.length];
      const skin = SKIN[Math.floor(Math.random() * SKIN.length)];
      const pants = PANTS[Math.floor(Math.random() * PANTS.length)];
      this.torso.setColorAt(i, c.set(torso));
      this.head.setColorAt(i, c.set(skin));
      this.legs.setColorAt(i * 2, c.set(pants));
      this.legs.setColorAt(i * 2 + 1, c.set(pants));
      this.arms.setColorAt(i * 2, c.set(skin));
      this.arms.setColorAt(i * 2 + 1, c.set(skin));
      this.people.push({ x: 0, z: -9999, dir: 1, speed: 1, phase: Math.random() * 6, waving: false, scale: 1 });
    }
  }

  setVisible(v) {
    for (const m of this.meshes) m.visible = v;
  }

  _spawn(p, playerZ, far) {
    const side = Math.random() < 0.5 ? -1 : 1;
    p.x = side * (7.35 + Math.random() * 0.45); // trottoir, côté route
    p.z = playerZ - (far ? 30 + Math.random() * 190 : 60 + Math.random() * 160);
    p.dir = Math.random() < 0.5 ? -1 : 1;
    p.waving = Math.random() < 0.18;
    p.speed = p.waving ? 0 : 0.8 + Math.random() * 0.7;
    p.scale = 0.92 + Math.random() * 0.18;
    p.side = side;
  }

  reset(playerZ) {
    for (const p of this.people) this._spawn(p, playerZ, true);
  }

  _part(mesh, idx, tx, ty, tz, rx, rz, offY) {
    // local = T(tx,ty,tz) * Rx(rx) * Rz(rz) * T(0,offY,0), puis parent * local
    _e.set(rx, 0, rz);
    _q.setFromEuler(_e);
    _local.compose(_v.set(tx, ty, tz), _q, _s.set(1, 1, 1));
    _out.multiplyMatrices(_parent, _local);
    if (offY) {
      _local.makeTranslation(0, offY, 0);
      _out.multiply(_local);
    }
    mesh.setMatrixAt(idx, _out);
  }

  update(dt, playerZ, t) {
    for (let i = 0; i < this.count; i++) {
      const p = this.people[i];
      if (p.z > playerZ + 25 || p.z < playerZ - 240) this._spawn(p, playerZ, false);
      p.z += p.dir * p.speed * dt;
      p.phase += dt * p.speed * 5.5;

      // Les personnes qui font signe se tournent vers la route
      const yaw = p.waving ? (p.side > 0 ? -Math.PI / 2 : Math.PI / 2) : p.dir > 0 ? Math.PI : 0;
      _q.setFromAxisAngle(_yaw, yaw);
      _parent.compose(_v.set(p.x, 0.18, p.z), _q, _s.set(p.scale, p.scale, p.scale));

      const swing = p.waving ? 0 : Math.sin(p.phase) * 0.65;
      this._part(this.torso, i, 0, 0.91, 0, 0, 0, 0);
      this._part(this.head, i, 0, 1.38, 0, 0, 0, 0);
      this._part(this.legs, i * 2, -0.1, 0.6, 0, swing, 0, -0.275);
      this._part(this.legs, i * 2 + 1, 0.1, 0.6, 0, -swing, 0, -0.275);
      // bras : balancement en marchant, ou bras droit levé et agité pour appeler un gbaka
      this._part(this.arms, i * 2, -0.27, 1.17, 0, -swing, 0, -0.25);
      if (p.waving) this._part(this.arms, i * 2 + 1, 0.27, 1.17, 0, 0, 2.5 + Math.sin(t * 8 + i) * 0.35, -0.25);
      else this._part(this.arms, i * 2 + 1, 0.27, 1.17, 0, swing, 0, -0.25);
    }
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }
}
