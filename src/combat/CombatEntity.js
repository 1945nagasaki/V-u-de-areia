import { CombatFSM, STATE } from './CombatStates.js';

const S = STATE;
const easeOut = (t) => 1 - (1 - t) * (1 - t);

/**
 * Entidade de combate (jogador e inimigos usam a MESMA classe). Só lógica:
 * nada de cena. O corpo concreto entra por um adaptador:
 *
 *   body = {
 *     pos,                 // {x,y,z} (pode ser o Vector3 do personagem — é lido e escrito por referência)
 *     facing,              // {x,z} normalizado (idem)
 *     move(dx, dz),        // desloca com colisão
 *     face(x, z),          // vira o modelo para (x,z)
 *   }
 *
 * Vida: interna (`health`) ou por adaptador `hooks.damage(amount, hit) → vida restante`
 * (o jogador usa a vida do PlayerState).
 *
 * @example
 *   const e = new CombatEntity({ name: 'Duelista', team: 'enemy', body, health: 90 });
 *   createSkills(MELEE.skills).forEach((s) => e.addSkill(s));
 *   world.add(e);
 *   e.useSkill('combo', world);     // golpe 1
 *   e.useSkill('combo', world);     // dentro da janela: emenda o golpe 2
 *   e.dodge(-1, 0, world);          // só em IDLE/MOVING/RECOVERY
 */
export class CombatEntity {
  /**
   * @param {{ name: string, team: string, body: object, health?: number, radius?: number, height?: number,
   *   hitstun?: number, dodge?: { distance: number, duration: number, iframes: number, cooldown: number },
   *   hooks?: { damage?: (amount: number, hit: object) => number, onDeath?: () => void } }} o
   */
  constructor({ name, team, body, health = 100, radius = 0.4, height = 1.8, hitstun = 0.3, dodge = null, hooks = {}, knockbackDamp = 9 }) {
    this.name = name;
    this.team = team;
    this.body = body;
    this.pos = body.pos;
    this.facing = body.facing;
    this.radius = radius;
    this.height = height;
    this.maxHealth = health;
    this.health = health;
    this.hitstunTime = hitstun;
    this.dodgeCfg = dodge;
    this.hooks = hooks;
    this.knockbackDamp = knockbackDamp;
    this.fsm = new CombatFSM();
    /** @type {Map<string, import('./Skill.js').Skill>} */
    this.skills = new Map();
    /** Skill em execução (STARTUP/ACTIVE/RECOVERY). */
    this.skill = null;
    /** Tempos da execução atual. */
    this.phase = { startup: 0, active: 0, recovery: 0 };
    this.hitstop = 0;
    this.iframes = 0;
    this.stunFor = 0;
    this.kvx = 0; this.kvz = 0; // empurrão (m/s), amortecido
    this.ivx = 0; this.ivz = 0; this.iLeft = 0; // avanço do próprio golpe
    this.aim = { x: body.facing.x, z: body.facing.z };
    this.turnRate = 10; // rad/s no STARTUP (mira acompanha o alvo até o golpe sair)
    this.dodgeDir = { x: 0, z: 0 };
    this.dodgeReadyAt = 0;
    this.lastCombatAt = -Infinity;
    /** Estado do corpo para animação/IA: o último acerto recebido. */
    this.lastHit = null;
  }

  addSkill(s) { this.skills.set(s.id, s); return s; }

  get alive() { return !this.fsm.dead; }
  get state() { return this.fsm.state; }
  /** Na janela de invulnerabilidade da esquiva. */
  get invulnerable() { return this.iframes > 0; }
  /** Fração 0..1 do estado atual (para animação). */
  get phaseT() {
    const st = this.fsm.state, t = this.fsm.time, p = this.phase;
    const d = st === S.STARTUP ? p.startup : st === S.ACTIVE ? p.active : st === S.RECOVERY ? p.recovery
      : st === S.DODGE ? this.dodgeCfg?.duration ?? 0.3 : st === S.STUNNED ? this.stunFor : 1;
    return d > 0 ? Math.min(1, t / d) : 1;
  }

  /** Para onde o golpe deve sair (o STARTUP gira até aqui). */
  aimAt(x, z) {
    const l = Math.hypot(x, z);
    if (l > 1e-6) { this.aim.x = x / l; this.aim.z = z / l; }
  }

  /** Pedido de movimento do controle/IA (só muda IDLE ⇄ MOVING; atacando, nada). */
  setMoving(moving) {
    if (this.fsm.free && this.fsm.is(S.MOVING) !== moving) this.fsm.enter(moving ? S.MOVING : S.IDLE);
  }

  /** Pode andar com o controle normal agora? */
  get canMove() { return this.fsm.free && this.hitstop <= 0; }

  /**
   * Tenta usar uma skill. Regras:
   * - parado/andando: começa se estiver pronta;
   * - no meio de um combo: o mesmo id enfileira o próximo golpe (se estiver na janela);
   * - qualquer outro caso (atordoado, outra skill rodando, recarga): recusa.
   * @returns {boolean}
   */
  useSkill(id, world) {
    const s = this.skills.get(id);
    if (!s || !this.alive) return false;
    if (this.skill) return this.skill === s && typeof s.queue === 'function' ? s.queue(this) : false;
    if (!this.fsm.free || this.hitstop > 0 || !s.ready(world.time)) return false;
    if (!this.fsm.enter(S.STARTUP)) return false;
    this.skill = s;
    s.begin(this, world);
    Object.assign(this.phase, s.timings());
    this.lastCombatAt = world.time;
    world.emit('skill', this, s, S.STARTUP);
    return true;
  }

  /**
   * Esquiva (dash curto com invulnerabilidade). O ÚNICO cancelamento: vale em
   * IDLE, MOVING e RECOVERY (cancela o fim do golpe). No STARTUP/ACTIVE, atordoado ou morto: não.
   */
  dodge(dx, dz, world) {
    const c = this.dodgeCfg;
    if (!c || world.time < this.dodgeReadyAt || this.hitstop > 0) return false;
    const l = Math.hypot(dx, dz);
    if (l < 1e-6) { dx = -this.facing.x; dz = -this.facing.z; } else { dx /= l; dz /= l; }
    const fromSkill = this.skill;
    if (!this.fsm.enter(S.DODGE)) return false;
    if (fromSkill) { fromSkill.end(this, world); this.skill = null; }
    this.dodgeDir.x = dx; this.dodgeDir.z = dz;
    this.iframes = c.iframes;
    this.dodgeReadyAt = world.time + c.cooldown;
    this._dodged = 0;
    world.emit('dodge', this);
    return true;
  }

  /** Avanço curto do próprio golpe (lunge), em `time` s. */
  impulse(dx, dz, time) {
    this.ivx = dx / time; this.ivz = dz / time; this.iLeft = time;
  }

  /**
   * Leva um golpe. Ignora se estiver invulnerável (esquiva) ou morto.
   * @param {{ damage: number, dirX: number, dirZ: number, knockback: number, heavy?: boolean, attacker?: CombatEntity }} hit
   * @returns {boolean} se o golpe valeu
   */
  takeHit(hit, world) {
    if (!this.alive || this.iframes > 0) return false;
    this.lastHit = hit;
    this.health = this.hooks.damage ? this.hooks.damage(hit.damage, hit) : Math.max(0, this.health - hit.damage);
    // Empurrão suave: velocidade inicial que, amortecida, percorre `knockback` metros.
    this.kvx = hit.dirX * hit.knockback * this.knockbackDamp;
    this.kvz = hit.dirZ * hit.knockback * this.knockbackDamp;
    if (this.skill) { this.skill.end(this, world); this.skill = null; } // golpe interrompido
    if (this.health <= 0) {
      this.fsm.enter(S.DEAD);
      this.hooks.onDeath?.();
      world?.emit('death', this);
      return true;
    }
    this.stunFor = this.hitstunTime * (hit.heavy ? 1.5 : 1);
    this.fsm.enter(S.STUNNED);
    return true;
  }

  /** Volta à vida (respawn). */
  revive() {
    this.health = this.maxHealth;
    this.kvx = this.kvz = 0;
    this.skill = null;
    this.fsm.enter(S.IDLE);
  }

  /**
   * Um quadro. Hitstop congela o golpe, o empurrão e o relógio do estado (a
   * animação, que lê esse relógio, congela junto).
   */
  update(dt, world) {
    if (this.fsm.dead) { this.slide(dt); return; }
    if (this.hitstop > 0) { this.hitstop = Math.max(0, this.hitstop - dt); return; }
    this.iframes = Math.max(0, this.iframes - dt);
    this.slide(dt);
    this.fsm.tick(dt);
    const st = this.fsm.state, t = this.fsm.time, s = this.skill, p = this.phase;
    if (st === S.STARTUP) {
      this.turnToAim(dt);
      if (t >= p.startup) {
        this.fsm.enter(S.ACTIVE);
        s.onActiveStart(this, world);
        world.emit('skill', this, s, S.ACTIVE);
        s.onActive(this, world, 0); // a hitbox já vale no 1º quadro do ACTIVE
      }
    } else if (st === S.ACTIVE) {
      s.onActive(this, world, dt);
      if (t >= p.active) {
        this.fsm.enter(S.RECOVERY);
        world.emit('skill', this, s, S.RECOVERY);
      }
    } else if (st === S.RECOVERY) {
      if (s.chain(this, world)) {
        this.fsm.enter(S.STARTUP);
        Object.assign(this.phase, s.timings());
        this.lastCombatAt = world.time;
        world.emit('skill', this, s, S.STARTUP);
      } else if (t >= p.recovery) {
        s.end(this, world);
        this.skill = null;
        this.fsm.enter(S.IDLE);
      }
    } else if (st === S.DODGE) {
      const c = this.dodgeCfg, u = Math.min(1, t / c.duration);
      const want = easeOut(u) * c.distance;
      const step = want - this._dodged;
      if (step > 0) this.body.move(this.dodgeDir.x * step, this.dodgeDir.z * step);
      this._dodged = want;
      if (u >= 1) this.fsm.enter(S.IDLE);
    } else if (st === S.STUNNED) {
      if (t >= this.stunFor) this.fsm.enter(S.IDLE);
    }
  }

  /** Empurrão recebido + avanço do próprio golpe. */
  slide(dt) {
    let dx = 0, dz = 0;
    if (this.kvx || this.kvz) {
      dx += this.kvx * dt; dz += this.kvz * dt;
      const k = Math.exp(-this.knockbackDamp * dt);
      this.kvx *= k; this.kvz *= k;
      if (Math.abs(this.kvx) + Math.abs(this.kvz) < 0.02) this.kvx = this.kvz = 0;
    }
    if (this.iLeft > 0) {
      const h = Math.min(dt, this.iLeft);
      dx += this.ivx * h; dz += this.ivz * h;
      this.iLeft -= h;
    }
    if (dx || dz) this.body.move(dx, dz);
  }

  /** No STARTUP a frente gira até a mira (taxa limitada); no ACTIVE fica travada. */
  turnToAim(dt) {
    const f = this.facing, a = this.aim;
    const cur = Math.atan2(f.x, f.z), want = Math.atan2(a.x, a.z);
    let d = want - cur;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const step = Math.max(-this.turnRate * dt, Math.min(this.turnRate * dt, d));
    const ang = cur + step;
    this.body.face(Math.sin(ang), Math.cos(ang));
  }
}
