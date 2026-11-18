import { HitOnce } from './Hitbox.js';
import { STATE } from './CombatStates.js';

/**
 * Habilidade reutilizável por jogador e IA. A entidade (`CombatEntity`) roda as
 * fases; a skill diz quanto dura cada uma e o que acontece nelas.
 *
 * Campos: cooldown, startupTime, activeTime, recoveryTime, range, damage,
 * knockback, animationName, onExecute (chamado ao ENTRAR no ACTIVE, uma vez
 * por execução — bom lugar para som/efeito extra).
 *
 * Ganchos (sobrescritos pelas subclasses):
 *   begin(e, world)       — começa uma execução (zera o "já acertou")
 *   onActiveStart(e, w)   — entrou no ACTIVE
 *   onActive(e, w, dt)    — cada quadro do ACTIVE (a hitbox só existe aqui)
 *   chain(e, w)           — no RECOVERY: emenda o próximo golpe? (combo)
 *   end(e, w)             — acabou (ou foi interrompida)
 *
 * @example
 *   const s = new MeleeSkill('golpe', { cooldown: 1, startup: 0.1, active: 0.1, recovery: 0.2, range: 2, angle: 90, damage: 10 });
 *   entity.addSkill(s);
 *   entity.useSkill('golpe', world); // true se pôde começar
 */
export class Skill {
  /**
   * @param {string} id
   * @param {object} cfg item de MELEE.skills
   * @param {{ startup?: number, damage?: number, cooldown?: number }} [scale] multiplicadores (ex.: IA mais lenta)
   */
  constructor(id, cfg, scale = {}) {
    this.id = id;
    this.name = cfg.name ?? id;
    this.cfg = cfg;
    this.scale = { startup: scale.startup ?? 1, damage: scale.damage ?? 1, cooldown: scale.cooldown ?? 1 };
    this.cooldown = (cfg.cooldown ?? 0) * this.scale.cooldown;
    this.startupTime = (cfg.startup ?? 0.1) * this.scale.startup;
    this.activeTime = cfg.active ?? 0.1;
    this.recoveryTime = cfg.recovery ?? 0.2;
    this.range = cfg.range ?? 2;
    this.damage = (cfg.damage ?? 0) * this.scale.damage;
    this.knockback = cfg.knockback ?? 0;
    this.animationName = cfg.animation ?? id;
    /** @type {((entity: object, world: object) => void) | null} */
    this.onExecute = null;
    this.readyAt = 0;
    this.hits = new HitOnce();
  }

  /** Multiplicador de dano (ex.: Força da Árvore de Skills). Vale a partir do próximo uso. */
  setDamageScale(m) {
    this.scale.damage = m;
    this.damage = (this.cfg.damage ?? 0) * m;
  }

  /** Pronta no instante `now` (relógio do CombatWorld)? */
  ready(now) { return now >= this.readyAt; }
  /** s até ficar pronta. */
  remaining(now) { return Math.max(0, this.readyAt - now); }
  /** Fração 0..1 da recarga que falta (para a HUD). */
  cooldownFraction(now) { return this.cooldown > 0 ? this.remaining(now) / this.cooldown : 0; }

  /** Tempos da execução atual (o combo muda a cada golpe). */
  timings() { return { startup: this.startupTime, active: this.activeTime, recovery: this.recoveryTime }; }
  /** Animação da execução atual. */
  animation() { return this.animationName; }
  /** Golpe pesado (mais tremor/hitstop)? */
  heavy() { return !!this.cfg.heavy; }

  begin(e, world) {
    this.hits.reset();
    this.readyAt = world.time + this.cooldown;
  }
  onActiveStart(e, world) { this.onExecute?.(e, world); }
  onActive(e, world, dt) {}
  chain(e, world) { return false; }
  end(e, world) {}
}

/** Golpe em cone (ou 360°) na frente do atacante, ativo todo o ACTIVE, um acerto por alvo. */
export class MeleeSkill extends Skill {
  constructor(id, cfg, scale) {
    super(id, cfg, scale);
    this.shape = { range: this.range, angle: cfg.angle ?? 90, height: cfg.height ?? [0.1, 2] };
  }

  onActive(e, world) {
    world.meleeSweep(e, this.shape, this.hits, this.hitSpec(e));
  }

  /** Dados do acerto (o mesmo objeto, reaproveitado). */
  hitSpec(e) {
    const s = this._spec ??= { damage: 0, knockback: 0, heavy: false, skill: this.id, radial: false };
    s.damage = this.damage; s.knockback = this.knockback; s.heavy = this.heavy(); s.radial = this.shape.angle >= 360;
    return s;
  }
}

/**
 * Combo de N golpes. O próximo golpe só sai se o input chegar na janela
 * [início do ACTIVE, início do RECOVERY + inputWindow]; aí ele emenda direto
 * do RECOVERY para o STARTUP do golpe seguinte. Fora da janela, o combo acaba
 * e o próximo clique recomeça do 1º.
 */
export class ComboSkill extends MeleeSkill {
  constructor(id, cfg, scale) {
    super(id, { ...cfg, ...cfg.steps[0] }, scale);
    this.steps = cfg.steps;
    this.inputWindow = cfg.inputWindow ?? 0.3;
    this.index = 0;
    this.queued = false;
  }

  step() { return this.steps[this.index]; }
  timings() {
    const s = this.step();
    return { startup: s.startup * this.scale.startup, active: s.active, recovery: s.recovery };
  }
  animation() { return this.step().animation; }
  heavy() { return !!this.step().heavy; }

  begin(e, world) {
    super.begin(e, world);
    this.index = 0;
    this.queued = false;
    this.applyStep();
  }

  /** Multiplicador de dano (ex.: Força da Árvore de Skills). Vale a partir do próximo golpe. */
  setDamageScale(m) {
    this.scale.damage = m;
    this.applyStep();
  }

  applyStep() {
    const s = this.step();
    this.shape.range = s.range; this.shape.angle = s.angle;
    this.damage = s.damage * this.scale.damage; this.knockback = s.knockback;
  }

  /**
   * Clique de combo durante um golpe deste combo: guarda se estiver na janela.
   * @returns {boolean} aceito
   */
  queue(e) {
    const st = e.fsm.state, t = e.fsm.time;
    const open = st === STATE.ACTIVE || (st === STATE.RECOVERY && t <= this.inputWindow);
    if (open && this.index < this.steps.length - 1) this.queued = true;
    return open;
  }

  onActiveStart(e, world) {
    super.onActiveStart(e, world);
    // Pequeno avanço no golpe (dá peso; o 3º avança mais).
    e.impulse(e.facing.x * (this.step().lunge ?? 0), e.facing.z * (this.step().lunge ?? 0), 0.12);
  }

  chain(e, world) {
    if (!this.queued || this.index >= this.steps.length - 1) return false;
    this.queued = false;
    this.index++;
    this.hits.reset(); // novo golpe: pode acertar o mesmo alvo de novo
    this.applyStep();
    return true;
  }

  end() { this.queued = false; }
}

/** Investida: avança `distance` durante o ACTIVE e acerta quem estiver no trajeto (cápsula varrida). */
export class DashSkill extends Skill {
  constructor(id, cfg, scale) {
    super(id, cfg, scale);
    this.distance = cfg.distance ?? 6;
    this.width = cfg.width ?? 1;
    this.height = cfg.height ?? [0.1, 2];
    this.travelled = 0;
  }

  begin(e, world) {
    super.begin(e, world);
    this.travelled = 0;
  }

  onActive(e, world, dt) {
    const speed = this.distance / this.activeTime;
    const want = Math.min(speed * dt, this.distance - this.travelled);
    if (want <= 0) return;
    const ax = e.pos.x, az = e.pos.z;
    e.body.move(e.facing.x * want, e.facing.z * want);
    this.travelled += want;
    world.capsuleSweep(e, ax, az, e.pos.x, e.pos.z, this.width, this.height, this.hits, this.hitSpec());
  }

  hitSpec() {
    const s = this._spec ??= { damage: 0, knockback: 0, heavy: true, skill: this.id, radial: false };
    s.damage = this.damage; s.knockback = this.knockback;
    return s;
  }
}

/** Onda de choque: dispara um projétil no início do ACTIVE (a varredura fica com o CombatWorld). */
export class ProjectileSkill extends Skill {
  constructor(id, cfg, scale) {
    super(id, cfg, scale);
    this.projectile = cfg.projectile;
  }

  onActiveStart(e, world) {
    super.onActiveStart(e, world);
    const p = this.projectile;
    world.spawnProjectile(e, {
      x: e.pos.x + e.facing.x * (e.radius + 0.3), y: e.pos.y + p.height, z: e.pos.z + e.facing.z * (e.radius + 0.3),
      dx: e.facing.x, dz: e.facing.z, speed: p.speed, range: p.range, radius: p.radius,
      damage: this.damage, knockback: this.knockback, skill: this.id,
    });
  }
}

/**
 * Monta as 4 skills a partir da config.
 * @param {object} skills MELEE.skills
 * @param {object} [scale]
 */
export function createSkills(skills, scale) {
  return [
    new ComboSkill('combo', skills.combo, scale),
    new DashSkill('dash', skills.dash, scale),
    new MeleeSkill('whirlwind', skills.whirlwind, scale),
    new ProjectileSkill('shockwave', skills.shockwave, scale),
  ];
}
