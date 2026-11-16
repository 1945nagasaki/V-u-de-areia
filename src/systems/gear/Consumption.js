import { GEAR_CATALOG, NEEDS } from '../../config/gear.js';

/**
 * Fome e estamina do pacote de itens (0..100), ligadas à sobrevivência do jogo.
 *
 * O jogo não tem uma barra única de fome: tem proteínas, carboidratos e
 * gorduras. Aqui "fome/saciedade" = a MÉDIA dessas três barras, e "recuperar N
 * de fome" = somar N a cada uma (presas em 100), o que sobe a média em até N.
 * A hidratação não entra: a Água do pacote recupera ESTAMINA.
 *
 * @example
 * const needs = new SurvivalNeeds(game.survival);
 * needs.hunger;            // 0..100
 * needs.addHunger(15);     // banana
 */
export class SurvivalNeeds {
  /** @param {{ nutrition: { values: Record<string, number> }, stamina: number, staminaMax: number }} survival */
  constructor(survival, max = NEEDS.max) {
    this.survival = survival;
    this.max = max;
  }

  get hunger() {
    const v = this.survival.nutrition.values;
    return (v.proteins + v.carbs + v.fats) / 3;
  }

  get hungerFull() {
    return this.hunger >= this.max - 1e-6;
  }

  addHunger(n) {
    const v = this.survival.nutrition.values;
    for (const k of ['proteins', 'carbs', 'fats']) v[k] = Math.min(this.max, v[k] + n);
  }

  get stamina() {
    return this.survival.stamina;
  }

  /** Teto de hoje (deficiências e febre encolhem a barra), nunca acima de 100. */
  get staminaCap() {
    return Math.min(this.max, this.survival.staminaMax);
  }

  get staminaFull() {
    return this.stamina >= this.staminaCap - 1e-6;
  }

  addStamina(n) {
    // (a Survival tira o "exausto" sozinha quando a barra passa do limite de recuperação)
    this.survival.stamina = Math.min(this.staminaCap, this.survival.stamina + n);
  }
}

/**
 * Consumo com tempo (regra pura): o efeito e o gasto de UMA unidade só acontecem
 * quando a ação termina. Cancelar antes não gasta nem dá efeito. Uma ação por
 * vez (não há como "comer duas vezes" clicando rápido).
 *
 * Dependências injetadas:
 *  - `stock`: `{ count(id), take(id, n) }` (a mochila)
 *  - `needs`: `{ hunger, hungerFull, addHunger(n), stamina, staminaFull, addStamina(n) }`
 *  - `applyEffect(effectId)`: liga um efeito temporário (ex.: 'cafe')
 *
 * @example
 * const c = new Consumption({ stock, needs, applyEffect });
 * c.start('pao');            // { ok: true }
 * c.update(1.8);             // { done: true, id: 'pao', hunger: 28, stamina: 0, effects: [] }
 */
export class Consumption {
  constructor({ stock, needs, applyEffect = () => {}, catalog = GEAR_CATALOG }) {
    this.stock = stock;
    this.needs = needs;
    this.applyEffect = applyEffect;
    this.catalog = catalog;
    /** ação em andamento: { id, t, total } */
    this.active = null;
  }

  /**
   * Pode consumir agora?
   * @returns {{ ok: boolean, reason?: 'unknown'|'disabled'|'none'|'busy'|'hunger-full'|'stamina-full' }}
   */
  check(id) {
    const d = this.catalog[id];
    if (!d) return { ok: false, reason: 'unknown' };
    if (!d.consumable) return { ok: false, reason: 'disabled' };
    if (this.stock.count(id) <= 0) return { ok: false, reason: 'none' };
    if (this.active) return { ok: false, reason: 'busy' };
    // Só comida/água sem outro efeito são barradas com o atributo cheio (o café sempre pode).
    if (!d.effects.length) {
      const feeds = d.hungerRestore > 0, hydrates = d.staminaRestore > 0;
      const hungerUseful = feeds && !this.needs.hungerFull, staminaUseful = hydrates && !this.needs.staminaFull;
      if (!hungerUseful && !staminaUseful) return { ok: false, reason: feeds ? 'hunger-full' : 'stamina-full' };
    }
    return { ok: true };
  }

  start(id) {
    const r = this.check(id);
    if (!r.ok) return r;
    this.active = { id, t: 0, total: this.catalog[id].useDuration };
    return { ok: true };
  }

  /** 0..1 da ação em andamento. */
  get progress() {
    return this.active ? Math.min(1, this.active.t / this.active.total) : 0;
  }

  /** Cancela: nada é gasto, nenhum efeito é dado. @returns {string|null} id que estava sendo consumido */
  cancel() {
    const id = this.active?.id ?? null;
    this.active = null;
    return id;
  }

  /**
   * Avança a ação. Ao terminar: gasta 1 unidade e aplica os efeitos (uma vez).
   * @returns {{ done: true, id: string, hunger: number, stamina: number, effects: string[] } | { done: false, lost: true, id: string } | null}
   */
  update(dt) {
    const a = this.active;
    if (!a) return null;
    a.t += dt;
    if (a.t < a.total) return null;
    this.active = null;
    // A unidade pode ter saído da mochila no meio da ação: sem item, sem efeito.
    if (this.stock.count(a.id) <= 0) return { done: false, lost: true, id: a.id };
    const d = this.catalog[a.id];
    this.stock.take(a.id, 1);
    const h0 = this.needs.hunger, s0 = this.needs.stamina;
    if (d.hungerRestore > 0) this.needs.addHunger(d.hungerRestore);
    if (d.staminaRestore > 0) this.needs.addStamina(d.staminaRestore);
    for (const e of d.effects) this.applyEffect(e);
    return { done: true, id: a.id, hunger: this.needs.hunger - h0, stamina: this.needs.stamina - s0, effects: [...d.effects] };
  }
}
