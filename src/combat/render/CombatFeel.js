import * as THREE from 'three';
import { STATE } from '../CombatStates.js';
import { makeWeapon } from './TribeGear.js';

const S = STATE;

/**
 * Lado VISUAL do combate (o núcleo em src/combat não conhece a cena):
 *  - arma na mão (facão) e o brilho de aviso no STARTUP da IA;
 *  - rastro do corte (fita que segue a ponta da lâmina no ACTIVE);
 *  - flash emissivo no alvo atingido, tremor de câmera;
 *  - efeitos das skills: rastro da investida, anel do giratório, onda (meia-lua);
 *  - DEBUG_HITBOX: cone/anel/cápsula/esfera em wireframe só enquanto a hitbox existe.
 *
 * @example
 *   const feel = new CombatFeel({ scene, world, cfg: MELEE, shake: (m) => cameraRig.shake(m) });
 *   feel.track(entity, humanoid, { telegraph: true });   // inimigo
 *   // no loop, depois das animações:
 *   feel.update(dt);
 */
export class CombatFeel {
  constructor({ scene, world, cfg, shake }) {
    this.scene = scene;
    this.world = world;
    this.cfg = cfg;
    this.shake = shake;
    this.debug = cfg.DEBUG_HITBOX;
    this.group = new THREE.Group();
    this.group.name = 'combate-fx';
    scene.add(this.group);
    /** @type {Map<object, object>} entidade → visual */
    this.tracked = new Map();
    this.flashes = []; // { mats, t }
    this.ownMats = new WeakMap(); // Object3D → materiais próprios (clonados uma vez)
    this.effects = []; // efeitos com tempo de vida
    this.projMeshes = new Map();
    this.debugMeshes = new Map();
    this._v = new THREE.Vector3(); this._v2 = new THREE.Vector3();

    world.on('hit', (a, t, info) => this.onHit(a, t, info));
    world.on('skill', (e, s, phase) => this.onSkill(e, s, phase));
    world.on('projectile', (p, evt) => this.onProjectile(p, evt));
  }

  // ------------------------------------------------------------ arma e entidades
  /**
   * Acompanha uma entidade com corpo Humanoid: põe a arma na mão direita e
   * prepara o rastro.
   * @param {{ telegraph?: boolean, weapon?: 'machete'|'spear'|'club'|'bronze'|'bone' }} o telegraph: brilho de aviso no STARTUP (IA)
   */
  track(entity, humanoid, { telegraph = false, weapon = 'machete' } = {}) {
    const blade = makeWeapon(weapon);
    humanoid.hands[0].add(blade.root);
    this.ensureOwnMaterials(humanoid.root);
    const trail = new SlashTrail(this.cfg.vfx.slash);
    this.group.add(trail.mesh);
    const warn = telegraph ? makeWarning(this.cfg.ai.telegraph.color) : null;
    if (warn) this.group.add(warn);
    const v = { entity, humanoid, blade, trail, warn, telegraph, shown: true };
    this.tracked.set(entity, v);
    return v;
  }

  untrack(entity) {
    const v = this.tracked.get(entity);
    if (!v) return;
    v.blade.root.removeFromParent();
    v.trail.mesh.removeFromParent();
    v.warn?.removeFromParent();
    this.tracked.delete(entity);
  }

  /** Mostra/esconde a arma (o jogador guarda o facão fora de combate). */
  setArmed(entity, armed) {
    const v = this.tracked.get(entity);
    if (v) v.blade.root.visible = armed;
  }

  /** Clona os materiais do objeto uma vez (o cache de materiais é compartilhado: o flash não pode vazar para outros bonecos). */
  ensureOwnMaterials(root) {
    if (this.ownMats.has(root)) return this.ownMats.get(root);
    const mats = [];
    const seen = new Map();
    root.traverse((o) => {
      if (!o.isMesh || !o.material || o.userData.noFlash) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      const own = list.map((m) => {
        if (!('emissive' in m)) return m;
        if (!seen.has(m)) { const c = m.clone(); c.userData.baseEmissive = c.emissive.clone(); c.userData.baseIntensity = c.emissiveIntensity ?? 1; seen.set(m, c); mats.push(c); }
        return seen.get(m);
      });
      o.material = Array.isArray(o.material) ? own : own[0];
    });
    this.ownMats.set(root, mats);
    return mats;
  }

  // ------------------------------------------------------------ eventos
  onHit(att, t, info) {
    const F = this.cfg.feel;
    const root = t.object ?? this.tracked.get(t)?.humanoid.root;
    if (root) {
      const mats = this.ensureOwnMaterials(root);
      const color = new THREE.Color(t.team === 'player' ? F.flashColorHurt : F.flashColor);
      this.flashes.push({ mats, t: F.flashTime, total: F.flashTime, color });
    }
    // Faíscas no ponto do impacto.
    this.burst(info.x, info.y, info.z, info.heavy ? this.cfg.vfx.slashHeavy : this.cfg.vfx.slash, info.heavy ? 14 : 8);
    const sh = this.cfg.feel.shake;
    if (t.team === 'player') this.shake(sh.taken);
    else if (att.team === 'player') this.shake(info.heavy ? sh.heavy : sh.hit);
  }

  onSkill(e, skill, phase) {
    const v = this.tracked.get(e);
    if (phase === S.ACTIVE) {
      if (v) v.trail.begin(skill.heavy?.() ? this.cfg.vfx.slashHeavy : skill.id === 'dash' ? this.cfg.vfx.dash : this.cfg.vfx.slash);
      if (skill.id === 'whirlwind') this.ring(e.pos.x, e.pos.y + 0.9, e.pos.z, skill.range, this.cfg.vfx.whirlwind);
      if (skill.id === 'dash') this.dashStreak(e);
    } else if (phase === S.RECOVERY && v) v.trail.end();
  }

  onProjectile(p, evt) {
    if (evt === 'spawn') {
      const m = makeCrescent(this.cfg.vfx.shockwave, p.radius);
      this.group.add(m);
      this.projMeshes.set(p, m);
    } else {
      const m = this.projMeshes.get(p);
      if (m) { m.removeFromParent(); m.geometry.dispose(); m.material.dispose(); this.projMeshes.delete(p); }
      this.burst(p.x, p.y, p.z, this.cfg.vfx.shockwave, evt === 'end' ? 6 : 12);
    }
  }

  // ------------------------------------------------------------ efeitos
  /** Faíscas (pontos que voam e somem). */
  burst(x, y, z, color, n) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      vel[i * 3] = (Math.random() - 0.5) * 6; vel[i * 3 + 1] = Math.random() * 4; vel[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.09, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.frustumCulled = false;
    this.group.add(m);
    this.effects.push({ mesh: m, t: 0.35, total: 0.35, step: (dt) => {
      const a = g.attributes.position;
      for (let i = 0; i < n; i++) { vel[i * 3 + 1] -= 9 * dt; a.array[i * 3] += vel[i * 3] * dt; a.array[i * 3 + 1] += vel[i * 3 + 1] * dt; a.array[i * 3 + 2] += vel[i * 3 + 2] * dt; }
      a.needsUpdate = true;
    } });
  }

  /** Anel que se expande (Golpe Giratório). */
  ring(x, y, z, r, color) {
    const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.85, r, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.set(x, y - 0.6, z);
    this.group.add(m);
    this.effects.push({ mesh: m, t: 0.45, total: 0.45, step: (dt, u) => m.scale.setScalar(0.4 + 0.75 * u) });
  }

  /** Rastro da investida: faixa no chão do ponto de saída até onde a entidade chegar. */
  dashStreak(e) {
    const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: this.cfg.vfx.dash, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    const x0 = e.pos.x, z0 = e.pos.z, y0 = e.pos.y + 0.9;
    m.position.set(x0, y0, z0);
    m.rotation.y = Math.atan2(e.facing.x, e.facing.z);
    this.group.add(m);
    this.effects.push({ mesh: m, t: 0.5, total: 0.5, step: () => {
      const d = Math.hypot(e.pos.x - x0, e.pos.z - z0);
      m.scale.set(0.5, 1, Math.max(0.01, d));
    } });
  }

  // ------------------------------------------------------------ por quadro
  update(dt) {
    // Flash: emissivo sobe e cai.
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t -= dt;
      const k = Math.max(0, f.t / f.total);
      for (const m of f.mats) {
        m.emissive.copy(m.userData.baseEmissive).lerp(f.color, k);
        m.emissiveIntensity = m.userData.baseIntensity + 1.6 * k;
      }
      if (f.t <= 0) this.flashes.splice(i, 1);
    }
    // Arma, rastro, aviso.
    for (const v of this.tracked.values()) {
      const e = v.entity;
      v.blade.tip.getWorldPosition(this._v);
      v.blade.mid.getWorldPosition(this._v2);
      v.trail.update(dt, this._v, this._v2, e.hitstop > 0);
      if (v.warn) {
        const on = e.state === S.STARTUP && e.alive;
        const k = on ? Math.min(1, e.phaseT * 1.4) : 0;
        v.blade.mat.emissive.setHex(this.cfg.ai.telegraph.color);
        v.blade.mat.emissiveIntensity = k * this.cfg.ai.telegraph.intensity;
        v.warn.visible = k > 0.01;
        if (v.warn.visible) {
          v.warn.position.set(e.pos.x, e.pos.y + 0.03, e.pos.z);
          v.warn.scale.setScalar(0.6 + 0.9 * k);
          v.warn.material.opacity = 0.25 + 0.5 * k;
        }
      }
    }
    // Projéteis.
    for (const [p, m] of this.projMeshes) {
      m.position.set(p.x, p.y, p.z);
      m.rotation.y = Math.atan2(p.dx, p.dz);
    }
    // Efeitos com tempo de vida.
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.t -= dt;
      const u = 1 - Math.max(0, fx.t / fx.total);
      fx.step?.(dt, u);
      fx.mesh.material.opacity = (fx.mesh.material.userData.o0 ??= fx.mesh.material.opacity) * (1 - u);
      if (fx.t <= 0) { fx.mesh.removeFromParent(); fx.mesh.geometry.dispose(); fx.mesh.material.dispose(); this.effects.splice(i, 1); }
    }
    if (this.debug) this.updateDebug();
    else if (this.debugMeshes.size) { for (const m of this.debugMeshes.values()) m.visible = false; }
  }

  // ------------------------------------------------------------ DEBUG_HITBOX
  /** Liga/desliga o desenho das hitboxes. */
  toggleDebug(on = !this.debug) { this.debug = on; return on; }

  updateDebug() {
    const D = this.cfg.vfx.debug;
    const used = new Set();
    for (const e of this.world.entities) {
      if (e.state !== S.ACTIVE || !e.skill) continue;
      const s = e.skill;
      let key, make;
      if (s.shape) {
        key = `cone:${s.shape.angle}:${s.shape.range}:${s.shape.height?.join(',')}`;
        make = () => coneMesh(s.shape, D.cone, D.opacity);
      } else if (s.id === 'dash') {
        key = `dash:${s.width}`;
        make = () => capsuleMesh(s.width, s.height ?? [0.1, 2], D.cone, D.opacity);
      } else continue;
      const id = `${key}#${this.world.entities.indexOf(e)}`;
      let m = this.debugMeshes.get(id);
      if (!m) { m = make(); this.group.add(m); this.debugMeshes.set(id, m); }
      m.visible = true;
      used.add(id);
      m.position.set(e.pos.x, e.pos.y, e.pos.z);
      m.rotation.y = Math.atan2(e.facing.x, e.facing.z);
      // Investida: a cápsula estica do início do trajeto até aqui.
      if (s.id === 'dash') m.scale.set(1, 1, Math.max(0.05, s.travelled));
    }
    for (const p of this.world.projectiles) {
      const id = `proj#${this.world.projectiles.indexOf(p)}`;
      let m = this.debugMeshes.get(id);
      if (!m) { m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), debugMat(D.projectile, D.opacity)); this.group.add(m); this.debugMeshes.set(id, m); }
      m.visible = true; used.add(id);
      m.position.set(p.x, p.y, p.z); m.scale.setScalar(p.radius);
    }
    for (const [id, m] of this.debugMeshes) if (!used.has(id)) m.visible = false;
  }
}

// ------------------------------------------------------------ peças
function debugMat(color, opacity) {
  return new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity, depthWrite: false, depthTest: false });
}

/** Cunha do cone (setor com altura), alinhada a +Z, para o desenho de debug. */
function coneMesh(shape, color, opacity) {
  const ang = Math.min(360, shape.angle) * Math.PI / 180, [h0, h1] = shape.height ?? [0, 2];
  const g = new THREE.CylinderGeometry(shape.range, shape.range, h1 - h0, Math.max(8, Math.round(ang * 8)), 1, false, -ang / 2, ang);
  g.translate(0, (h0 + h1) / 2, 0);
  // CylinderGeometry começa em +Z girando para +X: centraliza o setor na frente (+Z).
  const grp = new THREE.Group();
  const wire = new THREE.Mesh(g, debugMat(color, opacity));
  const fill = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacity * 0.35, depthWrite: false, side: THREE.DoubleSide }));
  grp.add(wire, fill);
  return grp;
}

/** Cápsula da investida (raio = largura), comprimento 1 em +Z (escala = trajeto). */
function capsuleMesh(width, height, color, opacity) {
  const g = new THREE.BoxGeometry(width * 2, height[1] - height[0], 1).translate(0, (height[0] + height[1]) / 2, -0.5);
  return new THREE.Mesh(g, debugMat(color, opacity));
}

/** Anel de aviso no chão (STARTUP da IA). */
function makeWarning(color) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  m.visible = false;
  m.renderOrder = 2;
  return m;
}

/** Meia-lua de energia (Onda de Choque), de pé, virada para +Z. */
function makeCrescent(color, r) {
  const g = new THREE.RingGeometry(r * 1.1, r * 1.9, 24, 1, Math.PI * 0.15, Math.PI * 0.7).rotateX(Math.PI / 2).rotateY(Math.PI);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.rotation.order = 'YXZ';
  return m;
}

/**
 * Rastro do corte: fita entre a ponta e o meio da lâmina, com as últimas N
 * posições; some sozinha depois do golpe. Buffer fixo (sem alocar por quadro).
 */
class SlashTrail {
  constructor(color, n = 18) {
    this.n = n;
    this.count = 0;
    this.on = false;
    this.fade = 0;
    const pos = new Float32Array(n * 2 * 3);
    const alpha = new Float32Array(n * 2);
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
    g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(color) }, opacity: { value: 1 } },
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'uniform vec3 color; uniform float opacity; varying float vA; void main(){ gl_FragColor = vec4(color, vA * opacity); }',
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  begin(color) { this.mat.uniforms.color.value.setHex(color); this.on = true; this.count = 0; this.fade = 1; this.mesh.visible = true; }
  end() { this.on = false; }

  update(dt, tip, mid, frozen) {
    const g = this.mesh.geometry, pos = g.attributes.position.array, al = g.attributes.alpha.array, n = this.n;
    if (this.on && !frozen) {
      // Empurra as amostras e põe a nova na frente.
      pos.copyWithin(6, 0, (n - 1) * 6);
      pos[0] = tip.x; pos[1] = tip.y; pos[2] = tip.z;
      pos[3] = mid.x; pos[4] = mid.y; pos[5] = mid.z;
      this.count = Math.min(n, this.count + 1);
    }
    if (!this.on) this.fade = Math.max(0, this.fade - dt / 0.18);
    for (let i = 0; i < n; i++) {
      const k = i < this.count ? (1 - i / Math.max(1, this.count)) : 0;
      al[i * 2] = k * 0.95; al[i * 2 + 1] = k * 0.15;
    }
    // Amostras ainda não preenchidas repetem a última (fita não estica até a origem).
    for (let i = this.count; i < n; i++) for (let c = 0; c < 6; c++) pos[i * 6 + c] = pos[Math.max(0, this.count - 1) * 6 + c];
    this.mat.uniforms.opacity.value = this.fade;
    g.attributes.position.needsUpdate = true;
    g.attributes.alpha.needsUpdate = true;
    this.mesh.visible = this.fade > 0.01 && this.count > 1;
  }
}
