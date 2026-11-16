import * as THREE from 'three';

/**
 * Efeitos dos ofícios, baratos e com objetos reutilizados (nada é criado
 * durante o jogo):
 *  - fumaça das chaminés (ferraria, padaria, olaria, taverna) das vilas ativas;
 *  - faíscas na bigorna, lascas na rocha/tora, serragem, vapor da têmpera —
 *    disparados no INSTANTE em que o gesto bate no objeto (ritmo do gesto).
 *
 * @example
 * const fx = new WorkFx(scene);
 * fx.setSmoke(chimneys);           // [{x,y,z}] das vilas ativas
 * fx.beat(agent, station);         // a cada quadro em que ele trabalha na estação
 * fx.update(dt);
 */
const KINDS = {
  sparks: { color: 0xffb040, n: 6, speed: 2.4, up: 1.6, life: 0.35, size: 0.035, gravity: -6, emissive: true },
  chips: { color: 0x8a8580, n: 5, speed: 1.6, up: 1.8, life: 0.55, size: 0.05, gravity: -9 },
  dust: { color: 0xd8c08a, n: 4, speed: 0.5, up: 0.6, life: 0.8, size: 0.04, gravity: -1 },
  steam: { color: 0xe8eef2, n: 4, speed: 0.3, up: 1.4, life: 1.0, size: 0.12, gravity: 0.6, grow: 2.5, alpha: 0.5 },
};
/** Ritmo (rad/s) do gesto: o efeito sai quando o seno cruza zero descendo (o golpe). */
const BEAT = { hammer: 4, chop: 2.6, mine: 2.8, saw: 5.2, dip: 1.4 };

export class WorkFx {
  constructor(scene, { pool = 90, puffs = 48 } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'work-fx';
    this.group.userData.noCollide = true;
    scene.add(this.group);
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.mats = {};
    for (const [k, c] of Object.entries(KINDS)) {
      this.mats[k] = c.emissive ? new THREE.MeshBasicMaterial({ color: c.color, toneMapped: false })
        : new THREE.MeshStandardMaterial({ color: c.color, roughness: 1, transparent: !!c.alpha, opacity: c.alpha ?? 1, depthWrite: !c.alpha });
    }
    this.parts = [];
    for (let i = 0; i < pool; i++) {
      const m = new THREE.Mesh(geo, this.mats.chips);
      m.visible = false;
      m.userData = { vx: 0, vy: 0, vz: 0, life: 0, max: 1, kind: null };
      this.group.add(m);
      this.parts.push(m);
    }
    this.next = 0;
    // fumaça: esferas cinzentas que sobem, crescem e somem (pool fixo)
    this.smokeMat = new THREE.MeshStandardMaterial({ color: 0x8a8682, roughness: 1, transparent: true, opacity: 0.35, depthWrite: false });
    const sg = new THREE.SphereGeometry(1, 7, 5);
    this.puffs = [];
    for (let i = 0; i < puffs; i++) {
      const m = new THREE.Mesh(sg, this.smokeMat.clone());
      m.visible = false;
      m.userData = { t: Math.random(), src: null };
      this.group.add(m);
      this.puffs.push(m);
    }
    this.chimneys = [];
    this._phase = new WeakMap();
  }

  /** Chaminés que soltam fumaça agora (só as das vilas perto do jogador). */
  setSmoke(list) {
    this.chimneys = list;
    this.puffs.forEach((p, i) => {
      p.userData.src = list.length ? list[i % list.length] : null;
      p.userData.t = (i / this.puffs.length) * 1.0 + Math.random() * 0.1;
      p.visible = !!p.userData.src;
    });
  }

  /** Chamado a cada quadro em que `agent` trabalha em `station`: emite no golpe. */
  beat(agent, station) {
    const f = BEAT[station.gesture] ?? 3;
    const s = Math.sin(agent.t * f), prev = this._phase.get(agent) ?? s;
    this._phase.set(agent, s);
    if (!(prev > 0 && s <= 0)) return;
    const t = station.target, y = (agent.pos.y ?? station.y) + (station.kind === 'rock' ? 0.7 : station.kind === 'block' ? 0.7 : 0.95);
    this.emit(station.fx, t.x + (agent.pos.x - t.x) * 0.25, y, t.z + (agent.pos.z - t.z) * 0.25);
  }

  emit(kind, x, y, z) {
    const c = KINDS[kind];
    if (!c) return;
    for (let i = 0; i < c.n; i++) {
      const m = this.parts[this.next];
      this.next = (this.next + 1) % this.parts.length;
      const a = Math.random() * Math.PI * 2, sp = c.speed * (0.4 + Math.random() * 0.6);
      m.material = this.mats[kind];
      m.position.set(x, y, z);
      m.scale.setScalar(c.size);
      Object.assign(m.userData, { vx: Math.cos(a) * sp, vy: c.up * (0.5 + Math.random() * 0.5), vz: Math.sin(a) * sp, life: c.life, max: c.life, kind });
      m.visible = true;
    }
  }

  update(dt) {
    for (const m of this.parts) {
      const u = m.userData;
      if (!m.visible) continue;
      u.life -= dt;
      if (u.life <= 0) { m.visible = false; continue; }
      const c = KINDS[u.kind];
      u.vy += c.gravity * dt;
      m.position.x += u.vx * dt; m.position.y += u.vy * dt; m.position.z += u.vz * dt;
      if (c.grow) m.scale.setScalar(c.size * (1 + (1 - u.life / u.max) * c.grow));
    }
    for (const p of this.puffs) {
      const u = p.userData;
      if (!u.src) continue;
      u.t = (u.t + dt * 0.22) % 1;
      const k = u.t;
      p.position.set(u.src.x + Math.sin(k * 5 + u.src.x) * 0.3 + k * 0.8, u.src.y + k * 4.2, u.src.z + Math.cos(k * 4) * 0.25);
      p.scale.setScalar(0.25 + k * 0.9);
      p.material.opacity = 0.38 * Math.sin(Math.PI * Math.min(1, k * 1.2));
    }
  }
}
