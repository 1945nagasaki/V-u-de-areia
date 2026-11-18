import { PROGRESSION } from '../config/progression.js';

/**
 * XP e Árvore de Skills (regra pura, testável).
 *
 * - `xp` é o XP disponível para gastar; `totalXp` só cresce e define o Nível.
 * - Três ramos (vida, energia, forca), cada um com tiers 0..maxTier.
 * - `stats()` devolve os bônus atuais para o jogo aplicar na hora.
 *
 * @example
 *   const p = new Progression();
 *   p.addXp('creature');          // +40 (derrotar criatura)
 *   p.upgrade('forca');           // true se tinha XP
 *   p.stats().meleeMultiplier;    // 1.25
 */
export class Progression {
  constructor(cfg = PROGRESSION) {
    this.cfg = cfg;
    this.xp = 0;
    this.totalXp = 0;
    this.tiers = Object.fromEntries(Object.keys(cfg.skills).map((k) => [k, 0]));
    this.listeners = [];
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  emit(evt) {
    for (const fn of this.listeners) fn(evt);
  }

  /**
   * Ganha XP por uma fonte de `cfg.rewards` ('animal' | 'creature' | 'mission' | 'tutorial') ou um número.
   * @returns {number} XP ganho
   */
  addXp(source, amount) {
    const n = amount ?? (typeof source === 'number' ? source : this.cfg.rewards[source]);
    if (!Number.isFinite(n) || n <= 0) return 0;
    const before = this.level;
    this.xp += n;
    this.totalXp += n;
    this.emit({ type: 'xp', amount: n, source, levelUp: this.level > before });
    return n;
  }

  /** Nível a partir do XP total (1, 2, 3…). */
  get level() {
    let lvl = 1, need = this.cfg.levelBase, left = this.totalXp;
    while (left >= need) {
      left -= need;
      lvl++;
      need = this.cfg.levelBase + (lvl - 1) * this.cfg.levelStep;
    }
    return lvl;
  }

  /** Progresso dentro do nível atual: { into, need }. */
  get levelProgress() {
    let lvl = 1, need = this.cfg.levelBase, left = this.totalXp;
    while (left >= need) {
      left -= need;
      lvl++;
      need = this.cfg.levelBase + (lvl - 1) * this.cfg.levelStep;
    }
    return { into: left, need };
  }

  /** Custo do próximo tier do ramo (Infinity se já está no máximo). */
  cost(skill) {
    const t = this.tiers[skill];
    if (t === undefined) throw new Error(`Skill desconhecida: ${skill}`);
    if (t >= this.cfg.maxTier) return Infinity;
    return this.cfg.costBase + t * this.cfg.costStep;
  }

  canUpgrade(skill) {
    return this.xp >= this.cost(skill);
  }

  /** Gasta XP e sobe um tier. @returns {boolean} */
  upgrade(skill) {
    if (!this.canUpgrade(skill)) return false;
    this.xp -= this.cost(skill);
    this.tiers[skill]++;
    this.emit({ type: 'upgrade', skill, tier: this.tiers[skill] });
    return true;
  }

  /** Bônus atuais. */
  stats(base = { maxHealth: 100, maxStamina: 100 }) {
    const s = this.cfg.skills;
    return {
      maxHealth: base.maxHealth + this.tiers.vida * s.vida.perTier.maxHealth,
      maxStamina: base.maxStamina + this.tiers.energia * s.energia.perTier.maxStamina,
      speedMultiplier: 1 + this.tiers.energia * s.energia.perTier.speed,
      meleeMultiplier: 1 + this.tiers.forca * s.forca.perTier.melee,
    };
  }

  toJSON() {
    return { xp: this.xp, totalXp: this.totalXp, tiers: { ...this.tiers } };
  }

  load(d) {
    if (!d) return;
    this.xp = d.xp ?? 0;
    this.totalXp = d.totalXp ?? this.xp;
    for (const k of Object.keys(this.tiers)) this.tiers[k] = Math.min(this.cfg.maxTier, d.tiers?.[k] ?? 0);
    this.emit({ type: 'load' });
  }
}

/** Fonte de XP de um animal abatido: predador (ataca) = criatura hostil. */
export function xpSourceForSpecies(spec) {
  return spec?.damage || spec?.predator || spec?.hostile ? 'creature' : 'animal';
}
