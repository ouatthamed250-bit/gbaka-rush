import * as THREE from 'three';
import { clamp, GBAKA, DECAL } from '../config.js';
import { Builder, VC_MAT, shade } from './mesh-utils.js';
import { Apprenti } from './apprenti.js';
import { decalLayout, inspectModel } from './model-contract.js';
import { loadGbakaModel } from './gbaka-model.js';

// Le gbaka : vrai modèle 3D s'il existe (public/models/gbaka.glb), sinon modèle en boîtes.
// Les deux chemins utilisent les mêmes roues, la même peinture et le même apprenti,
// pour que la peinture et l'animation marchent même sans le fichier 3D.

const DARK = 0x22262e;
const GLASS = 0x4b5a6b;

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 4, 32, 32, 30);
  g.addColorStop(0, 'rgba(0,0,0,0.6)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Gbaka {
  constructor(scene, loader) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.loader = loader;
    this.inner = null;
    this.wheels = [];
    this.wheelRadius = GBAKA.wheelRadius;
    this.apprenti = null;
    this.exhaust = new THREE.Vector3(0.65, 0.45, 3.2);
    this.skin = null;
    this.wheelGeo = null;
    this.model = null; // gabarit du vrai modèle 3D, null tant qu'il n'est pas chargé
    this.info = null; // repères du vrai modèle (taille de caisse, porte, échappement)
    this.parts = null; // objets trouvés dans le modèle courant (body, door, roues...)
    this.decalBox = null; // taille de la caisse, pour placer les peintures
    this.ownsGeometry = false; // vrai si les formes de `inner` appartiennent au gbaka en boîtes
    this._ownedMats = []; // matériaux créés pour ce gbaka (à libérer au changement de peinture)
    this._textures = new Map(); // images de peinture déjà chargées
    this._pendingTex = new Map(); // images en cours de chargement
    this._buildId = 0; // pour ignorer une image qui arrive après un changement de peinture

    // Ombre au sol (reste à plat quand le gbaka penche)
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 7.8).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }),
    );
    shadow.position.y = 0.03;
    this.group.add(shadow);

    // Le vrai modèle arrive en arrière-plan : le gbaka en boîtes sert de repli immédiat.
    loadGbakaModel()
      .then((prepared) => {
        this.model = prepared.object;
        this.info = prepared;
        this._rebuild(); // on réapplique la peinture en cours sur le vrai modèle
        console.info('[gbaka] modèle 3D chargé');
      })
      .catch((err) => {
        console.info(`[gbaka] modèle 3D non chargé (${err.message}) : gbaka en boîtes`);
      });
  }

  setSkin(skin) {
    this.skin = skin;
    this._rebuild();
  }

  // Reconstruit le gbaka (vrai modèle ou boîtes) et réapplique la peinture.
  _rebuild() {
    if (!this.skin) return;
    this._clear();
    const inner = new THREE.Group();
    this.inner = inner;
    this.group.add(inner);
    if (this.model) this._buildFromModel(inner);
    else this._buildBoxes(inner);
    this._applySkin();
    this._attachApprenti(inner);
  }

  // Libère tout ce que le gbaka possède, sauf les formes du gabarit 3D (partagées).
  _clear() {
    this._buildId++;
    if (this.apprenti) {
      this.apprenti.dispose();
      this.apprenti = null;
    }
    if (this.inner) {
      this.group.remove(this.inner);
      if (this.ownsGeometry) {
        this.inner.traverse((o) => {
          if (o.isMesh && o.geometry) o.geometry.dispose();
        });
      }
    }
    if (this.wheelGeo) {
      this.wheelGeo.dispose();
      this.wheelGeo = null;
    }
    for (const m of this._ownedMats) m.dispose();
    this._ownedMats = [];
    this.wheels = [];
    this.parts = null;
    this.inner = null;
  }

  // ---------- Modèle en boîtes (repli tant que le fichier 3D n'est pas là) ----------
  _buildBoxes(inner) {
    const skin = this.skin;
    this.ownsGeometry = true;
    this.wheelRadius = GBAKA.wheelRadius;
    this.exhaust.set(0.65, 0.45, 3.2);
    // Boîte de référence du modèle en boîtes : sert à placer les peintures.
    this.decalBox = { min: { x: -1.02, y: 0, z: -3.1 }, max: { x: 1.02, y: 2.78, z: 3.1 } };
    const body = new THREE.Color(skin.body).getHex();

    const B = new Builder();
    // Caisse (avant = -z, arrière = +z)
    B.box(2.0, 1.0, 6.2, body, 0, 0.95, 0);
    B.box(2.02, 0.14, 6.0, shade(body, 0.72), 0, 1.0, 0); // bande de caisse
    B.box(2.0, 1.2, 4.7, body, 0, 2.05, 0.75); // toit haut
    B.box(2.04, 0.08, 4.74, shade(body, 1.15), 0, 2.69, 0.75);
    B.box(0.5, 0.12, 0.5, DARK, 0, 2.78, 1.6); // trappe de toit
    B.box(1.96, 0.42, 1.5, body, 0, 1.6, -2.3, -0.2, 0, 0); // capot incliné
    B.box(1.8, 0.85, 0.08, GLASS, 0, 2.0, -1.62, 0.35, 0, 0); // pare-brise
    B.box(1.8, 0.1, 0.12, DARK, 0, 2.6, -1.5);
    for (const s of [-1, 1]) {
      B.box(0.05, 0.55, 3.1, GLASS, s * 1.02, 2.2, 1.1); // vitres passagers
      B.box(0.05, 0.55, 1.1, GLASS, s * 1.02, 2.05, -1.0); // vitre cabine
      B.box(0.3, 0.05, 0.05, DARK, s * 1.12, 1.95, -1.75); // bras du rétroviseur
      B.box(0.1, 0.32, 0.2, DARK, s * 1.3, 1.95, -1.75); // rétroviseur
      B.box(0.14, 0.14, 1.2, DARK, s * 1.02, 0.95, -2.05); // passage de roue avant
      B.box(0.14, 0.14, 1.2, DARK, s * 1.02, 0.95, 2.0); // passage de roue arrière
      B.box(0.3, 0.22, 0.05, 0xfff3c4, s * 0.7, 1.1, -3.12); // phares
      B.box(0.2, 0.45, 0.05, 0xd32f2f, s * 0.9, 1.25, 3.12); // feux arrière
    }
    B.box(0.5, 0.08, 0.35, DARK, 1.1, 0.52, -0.2); // marchepied côté porte
    B.box(2.1, 0.3, 0.3, DARK, 0, 0.5, 3.15); // pare-chocs arrière
    B.box(2.1, 0.3, 0.3, DARK, 0, 0.5, -3.15);
    B.box(0.1, 0.8, 0.1, DARK, -0.75, 0.95, -3.3); // pare-buffle
    B.box(0.1, 0.8, 0.1, DARK, 0.75, 0.95, -3.3);
    B.box(1.6, 0.1, 0.1, DARK, 0, 1.35, -3.3);
    B.box(0.55, 0.14, 0.03, 0xf2f2f2, 0.5, 0.78, 3.31); // plaque arrière
    // Échelle arrière
    B.box(0.06, 1.9, 0.06, DARK, -0.78, 1.95, 3.2);
    B.box(0.06, 1.9, 0.06, DARK, -0.42, 1.95, 3.2);
    for (let i = 0; i < 6; i++) B.box(0.4, 0.05, 0.05, DARK, -0.6, 1.15 + i * 0.32, 3.2);
    inner.add(new THREE.Mesh(B.build(), VC_MAT));

    // Roues (une seule forme partagée : pneu + moyeu)
    const W = new Builder();
    W.cyl(0.42, 0.42, 0.3, DARK, 0, 0, 0, 14, 0, 0, Math.PI / 2);
    W.cyl(0.2, 0.2, 0.32, 0x9aa0a6, 0, 0, 0, 10, 0, 0, Math.PI / 2);
    this.wheelGeo = W.build();
    for (const sx of [-1, 1]) {
      for (const z of [-2.05, 2.0]) {
        const w = new THREE.Mesh(this.wheelGeo, VC_MAT);
        w.position.set(sx * 1.0, 0.42, z);
        inner.add(w);
        this.wheels.push(w);
      }
    }
  }

  // ---------- Vrai modèle 3D (public/models/gbaka.glb) ----------
  _buildFromModel(inner) {
    this.ownsGeometry = false; // les formes appartiennent au gabarit : on n'y touche pas
    const inst = this.model.clone(true);
    inner.add(inst);

    const parts = inspectModel(inst);
    this.parts = parts;

    // Roues : on mesure le rayon pour que la rotation colle à la taille réelle du fichier.
    this.wheels = [];
    this.wheelRadius = GBAKA.wheelRadius;
    const box = new THREE.Box3();
    for (const w of parts.wheels) {
      if (!w) continue;
      box.setFromObject(w);
      const r = box.getSize(new THREE.Vector3()).y / 2;
      if (r > 0.05) this.wheelRadius = r;
      this.wheels.push(w);
    }

    // Peintures et échappement : repères calculés une fois au chargement du fichier
    // (ils ne dépendent donc pas de la position ou de la rotation du gbaka dans le garage).
    this.decalBox = this.info.decalBox;
    this.exhaust.set(0.65, 0.45, 3.2);
    if (this.info.exhaust) this.exhaust.copy(this.info.exhaust);
  }

  // ---------- Peintures (arrière et côtés) ----------
  _applySkin() {
    const skin = this.skin;
    if (!skin || !this.inner) return;
    const id = this._buildId;

    // Couleur de la caisse : seulement sur les matériaux sans image (une peinture peinte
    // dans le fichier 3D est laissée telle quelle).
    if (this.parts?.body) this._tintBody(this.parts.body, skin.body);

    // Arrière : panneau fourni par le fichier 3D, sinon panneau posé automatiquement.
    if (this.parts?.skinRear) this._paintPart(this.parts.skinRear, skin.rear, id);
    else if (skin.rear) this._addPanel('rear', skin.rear, id);

    // Côtés : deux panneaux fournis par le fichier 3D, sinon deux panneaux automatiques.
    const right = this.parts?.skinSideRight;
    const left = this.parts?.skinSideLeft;
    if (right || left) {
      if (right) this._paintPart(right, skin.side, id);
      if (left) this._paintPart(left, skin.side, id);
    } else if (skin.side) {
      this._addPanel('sideRight', skin.side, id);
      this._addPanel('sideLeft', skin.side, id);
    }
  }

  // Applique la couleur de la peinture aux matériaux de la caisse.
  _tintBody(body, hex) {
    const color = new THREE.Color(hex);
    body.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const one = (m) => {
        if (!m || m.map) return m; // matériau déjà peint : on n'y touche pas
        const c = m.clone();
        c.color.copy(color);
        this._ownedMats.push(c);
        return c;
      };
      o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
    });
  }

  // Remplace la peinture de tous les objets d'un panneau fourni par le fichier 3D.
  _paintPart(part, url, id) {
    if (!url) return; // pas d'image : on garde le matériau d'origine du fichier
    this._texture(url, (tex) => {
      if (id !== this._buildId || !this.inner) return; // la peinture a changé entre-temps
      part.traverse((o) => {
        if (!o.isMesh) return;
        const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true });
        this._ownedMats.push(mat);
        o.material = mat;
      });
    });
  }

  // Pose un panneau de peinture sur la caisse (arrière ou côté), à la taille du gbaka.
  _addPanel(kind, url, id) {
    if (!url || !this.decalBox) return;
    const layout = decalLayout(this.decalBox, kind, kind === 'rear' ? DECAL.rear : DECAL.side);
    this._texture(url, (tex) => {
      if (id !== this._buildId || !this.inner) return;
      const mat = new THREE.MeshLambertMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(layout.size[0], layout.size[1]), mat);
      mesh.position.fromArray(layout.pos);
      mesh.rotation.y = layout.rotY;
      this.inner.add(mesh);
      this._ownedMats.push(mat);
    });
  }

  // Charge une image une seule fois, même si deux panneaux l'utilisent.
  _texture(url, onReady) {
    const ready = this._textures.get(url);
    if (ready) {
      onReady(ready);
      return;
    }
    const waiting = this._pendingTex.get(url);
    if (waiting) {
      waiting.push(onReady);
      return;
    }
    const list = [onReady];
    this._pendingTex.set(url, list);
    this.loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        this._textures.set(url, tex);
        this._pendingTex.delete(url);
        for (const fn of list) fn(tex);
      },
      undefined,
      () => {
        // Image absente : on ne pose rien, le jeu reste jouable.
        this._pendingTex.delete(url);
      },
    );
  }

  // L'apprenti sort par la porte côté passager (+X). S'il y a un nœud « door_side »,
  // il est accroché dessus : le jour où la porte coulisse, l'apprenti suivra.
  _attachApprenti(inner) {
    let parent = inner;
    let baseX = 0.62;
    let baseZ = -0.25;
    const door = this.info?.door;
    if (door) {
      // Pivot à la hauteur du sol : la porte ne décale que l'axe X/Z, pas la taille de l'apprenti.
      parent = new THREE.Group();
      parent.position.set(door.x, 0, door.z);
      inner.add(parent);
      baseX -= door.x;
      baseZ -= door.z;
    }
    this.apprenti = new Apprenti(parent, baseX, baseZ);
  }

  // speed en m/s, steerVel en m/s (vitesse latérale)
  update(dt, t, speed, steerVel, throttle, braking, full) {
    for (const w of this.wheels) w.rotation.x -= (speed / (this.wheelRadius || GBAKA.wheelRadius)) * dt;
    // Roulis dans les virages, tangage à l'accélération / freinage, petites secousses de la route
    const roll = clamp(-steerVel * 0.012, -0.08, 0.08);
    const pitch = throttle ? 0.015 : braking ? -0.035 : 0;
    const bump = Math.sin(t * 17 + speed) * 0.012 * Math.min(1, speed / 10);
    this.inner.rotation.z += (roll - this.inner.rotation.z) * Math.min(1, dt * 6);
    this.inner.rotation.x += (pitch - this.inner.rotation.x) * Math.min(1, dt * 5);
    this.inner.position.y = bump;
    this.apprenti.update(dt, t, full);
  }

  exhaustWorld() {
    this.inner.updateWorldMatrix(true, false);
    return this.inner.localToWorld(this.exhaust.clone());
  }
}

// Fumée noire du pot d'échappement : 24 sprites recyclés.
export class Smoke {
  constructor(scene) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(20,20,20,0.95)');
    g.addColorStop(1, 'rgba(20,20,20,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    this.tex = new THREE.CanvasTexture(c);
    this.pool = [];
    for (let i = 0; i < 24; i++) {
      const mat = new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false, opacity: 0 });
      const s = new THREE.Sprite(mat);
      s.visible = false;
      scene.add(s);
      this.pool.push({ s, life: 0, max: 1, vy: 0, vz: 0 });
    }
    this.acc = 0;
  }
  emit(origin) {
    const p = this.pool.find((q) => q.life <= 0);
    if (!p) return;
    p.life = p.max = 0.8 + Math.random() * 0.5;
    p.s.position.set(origin.x + (Math.random() - 0.5) * 0.15, origin.y, origin.z);
    p.s.scale.setScalar(0.5);
    p.vy = 0.8 + Math.random() * 0.8;
    p.vz = 0.4 + Math.random();
    p.s.visible = true;
  }
  update(dt, rate, origin) {
    this.acc += dt * rate;
    while (this.acc >= 1) {
      this.acc -= 1;
      if (origin) this.emit(origin);
    }
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.s.visible = false;
        continue;
      }
      const k = 1 - p.life / p.max;
      p.s.position.y += p.vy * dt;
      p.s.position.z += p.vz * dt;
      p.s.scale.setScalar(0.5 + k * 1.8);
      p.s.material.opacity = (1 - k) * 0.8;
    }
  }
  clear() {
    for (const p of this.pool) {
      p.life = 0;
      p.s.visible = false;
    }
  }
}
