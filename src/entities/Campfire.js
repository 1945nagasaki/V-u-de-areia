import * as THREE from 'three';
import { CAMPFIRE } from '../config/survival.js';

/**
 * Fogueira posicionável: pedras em anel + lenha. Acesa (`light()`), emite
 * luz quente que tremula (PointLight), chamas (sprites aditivos) e fumaça.
 */
export class Campfire {
  constructor({ x, y, z, cfg = CAMPFIRE }) {
    this.cfg = cfg;
    this.lit = false;
    this.root = new THREE.Group();
    this.root.position.set(x, y, z);
    const stone = new THREE.MeshStandardMaterial({ color: 0x7d746a, roughness: 0.95 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + (i % 3) * 0.03), stone);
      s.position.set(Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55);
      s.castShadow = true;
      this.root.add(s);
    }
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 1 });
    for (let i = 0; i < 4; i++) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.8, 6), wood);
      l.rotation.z = Math.PI / 2 - 0.45;
      l.rotation.y = (i / 4) * Math.PI * 2;
      l.position.y = 0.2;
      this.root.add(l);
    }

    this.light = new THREE.PointLight(0xff8a3a, 0, cfg.lightDistance, 1.6);
    this.light.position.y = 0.7;
    this.root.add(this.light);

    const tex = glowTexture();
    this.flames = [];
    for (let i = 0; i < 14; i++) {
      const m = new THREE.SpriteMaterial({ map: tex, color: 0xffa040, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
      const sp = new THREE.Sprite(m);
      sp.userData = { t: Math.random(), speed: 1.2 + Math.random() * 0.8, ox: (Math.random() - 0.5) * 0.35, oz: (Math.random() - 0.5) * 0.35 };
      this.root.add(sp);
      this.flames.push(sp);
    }
    this.smoke = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.SpriteMaterial({ map: tex, color: 0x4a4744, depthWrite: false, transparent: true, opacity: 0 });
      const sp = new THREE.Sprite(m);
      sp.userData = { t: i / 10 };
      this.root.add(sp);
      this.smoke.push(sp);
    }
    this._t = 0;
  }

  get position() {
    return this.root.position;
  }

  /** Acende a fogueira. */
  ignite() {
    this.lit = true;
  }

  update(dt) {
    if (!this.lit) return;
    this._t += dt;
    const f = 0.8 + 0.2 * Math.sin(this._t * 17) * Math.sin(this._t * 7.3) + 0.08 * Math.random();
    this.light.intensity = this.cfg.lightIntensity * f;
    for (const sp of this.flames) {
      const u = sp.userData;
      u.t += dt * u.speed;
      if (u.t > 1) u.t -= 1;
      const s = (1 - u.t) * 0.7 + 0.1;
      sp.scale.set(s, s * 1.4, s);
      sp.position.set(u.ox * (1 - u.t), 0.25 + u.t * 1.1, u.oz * (1 - u.t));
      sp.material.opacity = Math.sin(u.t * Math.PI) * 0.9;
      sp.material.color.setHSL(0.05 + 0.06 * (1 - u.t), 1, 0.55);
    }
    for (const sp of this.smoke) {
      const u = sp.userData;
      u.t += dt * 0.18;
      if (u.t > 1) u.t -= 1;
      const s = 0.3 + u.t * 1.6;
      sp.scale.set(s, s, s);
      sp.position.set(Math.sin(u.t * 5 + this._t * 0.3) * 0.4 * u.t, 1.4 + u.t * 5, u.t * 0.6);
      sp.material.opacity = Math.sin(u.t * Math.PI) * 0.16;
    }
  }
}

let _glow = null;
function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}

/**
 * Recurso coletável no chão (galho, pedra, ervas, tâmaras, carne).
 * Malha simples por tipo; some ao ser coletado.
 */
export function makePickupMesh(id) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 });
  if (id === 'madeira') {
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 5), mat(0x8a6a48));
      m.rotation.z = Math.PI / 2; m.rotation.y = i * 0.7; m.position.y = 0.05 + i * 0.05;
      g.add(m);
    }
  } else if (id === 'pedra') {
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18 - i * 0.05), mat(0x9a9088));
      m.position.set(i * 0.25, 0.1, 0);
      g.add(m);
    }
  } else if (id === 'ervas') {
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.4, 4), mat(0x6f8a3a));
      m.position.set(Math.cos(i) * 0.12, 0.2, Math.sin(i) * 0.12);
      g.add(m);
    }
  } else if (id === 'tamara') {
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), mat(0x7a3a18));
      m.position.set(Math.cos(i * 1.3) * 0.1, 0.06, Math.sin(i * 1.3) * 0.1);
      g.add(m);
    }
  } else {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.22), mat(0xa03a30));
    m.position.y = 0.06;
    g.add(m);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
