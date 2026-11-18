import { SURVIVAL } from '../config/survival.js';

/**
 * Estamina e Fome (regras puras, testáveis).
 * - Correr gasta estamina; zerou → não corre até recuperar `staminaMinToSprint`.
 * - A fome cai com o tempo (mais rápido correndo). Em 0, `update` devolve o
 *   dano de inanição a aplicar na vida.
 *
 * @example
 *   const s = new Survival();
 *   const { starve } = s.update(dt, { sprinting });
 *   if (starve) state.damage(starve);
 */
export class Survival {
  constructor(cfg = SURVIVAL) {
    this.cfg = cfg;
    this.maxStamina = cfg.baseStamina;
    this.stamina = this.maxStamina;
    this.hunger = cfg.maxHunger;
    this.exhausted = false;
    this._rest = 0;
  }

  /** O jogador pode correr agora? */
  get canSprint() {
    return !this.exhausted && this.stamina > 0;
  }

  /**
   * @param {number} dt
   * @param {{ sprinting?: boolean, active?: boolean }} st `active` = false pausa a fome (prólogo, menus)
   * @returns {{ starve: number }} dano de fome a aplicar neste quadro
   */
  update(dt, { sprinting = false, active = true } = {}) {
    const c = this.cfg;
    if (sprinting) {
      this.stamina = Math.max(0, this.stamina - c.staminaSprintDrain * dt);
      this._rest = 0;
      if (this.stamina === 0) this.exhausted = true;
    } else {
      this._rest += dt;
      if (this._rest >= c.staminaRegenDelay) this.stamina = Math.min(this.maxStamina, this.stamina + c.staminaRegen * dt);
      if (this.exhausted && this.stamina >= c.staminaMinToSprint) this.exhausted = false;
    }
    if (!active) return { starve: 0 };
    const drain = c.hungerDrain * (sprinting ? c.hungerSprintMultiplier : 1) * dt;
    const before = this.hunger;
    this.hunger = Math.max(0, this.hunger - drain);
    // Só começa a doer quando a fome já estava zerada.
    const starve = before === 0 ? c.starveDamagePerSecond * dt : 0;
    return { starve };
  }

  /** Come algo: devolve quanto a fome subiu. */
  eat(amount) {
    const before = this.hunger;
    this.hunger = Math.min(this.cfg.maxHunger, this.hunger + amount);
    return this.hunger - before;
  }

  setMaxStamina(max) {
    const ratio = this.stamina / this.maxStamina;
    this.maxStamina = max;
    this.stamina = Math.min(max, Math.max(this.stamina, ratio * max));
  }

  toJSON() {
    return { stamina: this.stamina, hunger: this.hunger };
  }

  load(d) {
    if (!d) return;
    this.stamina = Math.min(this.maxStamina, d.stamina ?? this.stamina);
    this.hunger = Math.min(this.cfg.maxHunger, d.hunger ?? this.hunger);
  }
}
