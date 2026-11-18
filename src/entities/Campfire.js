import * as THREE from 'three';
import { CAMPFIRE } from '../config/progression.js';

/**
 * Fogueira posicionável: pedras em anel + lenha. Acesa (`ignite()`), mostra
 * chamas (sprites aditivos) e fumaça. A LUZ não mora aqui: quem acende registra
 * uma fonte em FireLights (o pool de luzes do jogo), que também aquece e permite
 * cozinhar — criar um PointLight novo recompilaria os shaders da cena.
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
