import { Humanoid } from '../entities/Humanoid.js';
import { CombatEntity } from './CombatEntity.js';
import { createSkills } from './Skill.js';
import { EnemyAI } from './EnemyAI.js';
import { HumanoidCombatAnimator } from './anim/HumanoidCombatAnimator.js';
import { MOVE_SUBSTEP } from '../config/physics.js';

/**
 * Inimigo de treino: boneco humano com facão, MESMAS classes do jogador
 * (CombatEntity + Skill) comandadas pela EnemyAI.
 *
 * @example
 *   const d = new Duelist({ cfg: MELEE, x, z, groundAt, collisions, random });
 *   scene.add(d.model.root); world.add(d.entity); feel.track(d.entity, d.model, { telegraph: true });
 *   // por quadro: d.update(dt, world, playerEntity)
 */
export class Duelist {
  /**
   * @param {object} [o.profile] sobrepõe MELEE.duelist (nome, time, aparência, vida…) — guerreiros das tribos
   * @param {object} [o.ai] sobrepõe MELEE.ai (raio de visão, coleira)
   * @param {object} [o.aiHooks] { hostile, alert, patrol } para a EnemyAI (postura da tribo)
   */
  constructor({ cfg, x, z, groundAt, collisions, random = Math.random, profile = null, ai = null, aiHooks = {} }) {
    const D = profile ? { ...cfg.duelist, ...profile } : cfg.duelist;
    this.profile = D;
    this.cfg = cfg;
    this.groundAt = groundAt;
    this.collisions = collisions;
    this.home = { x, z };
    this.model = new Humanoid({ height: D.height, build: D.build ?? 1, ...D.look, rng: random });
    this.model.root.name = 'duelista';
    this.root = this.model.root;
    this.root.position.set(x, groundAt(x, z), z);
    const facing = { x: 0, z: 1 };
    const pos = this.root.position;
    const body = {
      pos, facing,
      move: (dx, dz) => {
        collisions.move(pos, dx, dz, D.radius, MOVE_SUBSTEP);
        pos.y = groundAt(pos.x, pos.z, pos.y + 0.6);
      },
      face: (fx, fz) => {
        const l = Math.hypot(fx, fz);
        if (l < 1e-6) return;
        facing.x = fx / l; facing.z = fz / l;
        this.root.rotation.y = Math.atan2(facing.x, facing.z);
      },
    };
    this.entity = new CombatEntity({
      name: D.name, team: D.team, body, health: D.health, radius: D.radius, height: D.height,
      hitstun: D.hitstun, knockbackDamp: cfg.feel.knockbackDamp, heavyHitstun: cfg.feel.heavyHitstun, turnRate: D.turnRate,
    });
    for (const s of createSkills(cfg.skills, D.skillScale)) this.entity.addSkill(s);
    this.entity.skills.get('combo').cooldown = D.comboCooldown;
    this.ai = new EnemyAI(this.entity, ai ? { ...cfg.ai, ...ai } : cfg.ai, { home: this.home, random, walk: D.walkSpeed, run: D.runSpeed, ...aiHooks });
    this.animator = new HumanoidCombatAnimator(this.model);
    this.deadFor = 0;
    this._ground = (gx, gz) => groundAt(gx, gz, pos.y + 0.3);
  }

  get alive() { return this.entity.alive; }

  /**
   * Um quadro: IA decide → anda (se o estado deixar) → animação base → pose de combate.
   * @param {import('./CombatEntity.js').CombatEntity} target
   */
  update(dt, world, target) {
    const e = this.entity;
    if (!e.alive) {
      this.deadFor += dt;
      if (this.deadFor >= this.profile.respawn) this.respawn();
      else { this.model.update(dt, 0, {}); this.animator.apply(e, dt); }
      return;
    }
    const it = this.ai.update(dt, world, target);
    let speed = 0;
    if (e.canMove && it.speed > 0) {
      const x0 = e.pos.x, z0 = e.pos.z;
      e.body.move(it.mx * it.speed * dt, it.mz * it.speed * dt);
      speed = Math.hypot(e.pos.x - x0, e.pos.z - z0) / Math.max(dt, 1e-6);
    }
    e.setMoving(speed > 0.2);
    // Fora do golpe: vira suave para onde a IA quer olhar.
    if (e.canMove) {
      const cur = Math.atan2(e.facing.x, e.facing.z), want = Math.atan2(it.faceX, it.faceZ);
      const d = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
      const a = cur + d * Math.min(1, dt * 8);
      e.body.face(Math.sin(a), Math.cos(a));
    }
    // Hitstop: a animação base também congela.
    this.model.update(e.hitstop > 0 ? 0 : dt, speed, { ground: this._ground });
    this.animator.apply(e, dt, { armed: true });
  }

  respawn() {
    const { x, z } = this.home;
    this.root.position.set(x, this.groundAt(x, z), z);
    this.model.body.rotation.set(0, 0, 0);
    this.deadFor = 0;
    this.entity.revive();
  }
}
