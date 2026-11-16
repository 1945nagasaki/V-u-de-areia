import { PHOBIAS, TRAUMA } from '../config/afflictions.js';

/**
 * Fobias permanentes por trauma (regra pura).
 *
 * Escuta os drenos do SanityManager. Um "evento de trauma" é um dreno
 * marcado `severe`, ou drenos pontuais que somam ≥ TRAUMA.threshold da barra
 * dentro de TRAUMA.windowSeconds. Aí `triggerTraumaCheck()` sorteia uma fobia
 * nova, puxada pelas tags do trauma (ESCURIDAO, ANIMAL, MORTE, SANGUE).
 *
 * Fobias não passam: só `clearOnDeath()` (morte e respawn) limpa a ficha.
 *
 * Eventos (`on`): 'acquired' { id, def, cause }.
 *
 * @example
 * const pm = new PhobiaManager({ sanity, rng: Math.random });
 * pm.update(dt, { dark: true, nearAnimal: 0.6, nearCorpse: 0, openWound: false });
 * pm.effects; // { darkDrainMult, staminaRegenMult, shake, heartbeat, nausea, wobble, healRate }
 * pm.clearOnDeath();
 */
export class PhobiaManager {
  /**
   * @param {{ sanity: import('./SanityManager.js').SanityManager, rng?: () => number, phobias?: typeof PHOBIAS, trauma?: typeof TRAUMA }} o
   */
  constructor({ sanity, rng = Math.random, phobias = PHOBIAS, trauma = TRAUMA }) {
    this.sanity = sanity;
    this.rng = rng;
    this.defs = phobias;
    this.trauma = trauma;
    /** id → { id, cause, at } (ordem de aquisição). */
    this.active = new Map();
    this.clock = 0;
    /** Drenos pontuais recentes: { t, amount, tags, reason }. */
    this.recent = [];
    this.listeners = new Map();
    this.effects = PhobiaManager.neutral();
    sanity.on('drain', (d) => this.onDrain(d));
  }

  /** Efeitos sem nenhuma fobia ativa. */
  static neutral() {
    return { darkDrainMult: 1, staminaRegenMult: 1, shake: 0, heartbeat: false, nausea: 0, wobble: 0, healRate: 1, triggered: [] };
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(fn);
  }

  emit(event, data) {
    for (const fn of this.listeners.get(event) ?? []) fn(data);
  }

  has(id) {
    return this.active.has(id);
  }

  /** Lista para a ficha: [{ id, def, cause }]. */
  list() {
    return [...this.active.values()].map((p) => ({ ...p, def: this.defs[p.id] }));
  }

  /** Dreno do SanityManager: soma na janela; severo ou acima do limiar → checagem. */
  onDrain({ amount, reason, quiet, tags = [], severe = false }) {
    if (quiet && !severe) return; // drenos contínuos (escuridão, febre) não são "um evento"
    this.recent.push({ t: this.clock, amount, tags, reason });
    this.prune();
    const sum = this.recent.reduce((s, d) => s + d.amount, 0);
    if (severe || sum >= this.trauma.threshold * this.sanity.max) this.triggerTraumaCheck();
  }

  prune() {
    const from = this.clock - this.trauma.windowSeconds;
    while (this.recent.length && this.recent[0].t < from) this.recent.shift();
  }

  /**
   * Sorteia uma fobia nova a partir do contexto do trauma (as tags dos
   * drenos na janela pesam pela quantidade drenada). Fobia já existente
   * não repete; com todas, nada acontece. Consome a janela.
   * @returns {string|null} id da fobia adquirida
   */
  triggerTraumaCheck() {
    const episode = this.recent;
    this.recent = [];
    const free = Object.keys(this.defs).filter((id) => !this.active.has(id));
    if (!free.length) return null;
    const weight = new Map(free.map((id) => [id, 0]));
    for (const d of episode) {
      for (const id of free) if (this.defs[id].tags.some((t) => d.tags.includes(t))) weight.set(id, weight.get(id) + d.amount);
    }
    let total = [...weight.values()].reduce((a, b) => a + b, 0);
    if (total <= 0) { for (const id of free) weight.set(id, 1); total = free.length; } // trauma sem contexto: qualquer uma
    let roll = this.rng() * total, pick = free[free.length - 1];
    for (const [id, w] of weight) {
      if (w <= 0) continue;
      if (roll < w) { pick = id; break; }
      roll -= w;
    }
    const cause = episode.map((d) => d.reason).filter(Boolean).slice(-3).join(' · ') || 'Trauma';
    this.active.set(pick, { id: pick, cause, at: this.clock });
    this.emit('acquired', { id: pick, def: this.defs[pick], cause });
    return pick;
  }

  /**
   * Um quadro: aplica os drenos das fobias e recalcula `effects`.
   * @param {number} dt
   * @param {{ dark?: boolean, nearAnimal?: number, nearCorpse?: number, openWound?: boolean }} env
   *   nearAnimal / nearCorpse: 0 (longe) .. 1 (colado), já normalizados pelo raio da fobia
   * @returns {typeof this.effects}
   */
  update(dt, { dark = false, nearAnimal = 0, nearCorpse = 0, openWound = false } = {}) {
    this.clock += dt;
    this.prune();
    const fx = PhobiaManager.neutral();
    if (this.active.has('nictofobia') && dark) {
      const e = this.defs.nictofobia.effects;
      fx.darkDrainMult = e.darkDrainMult;
      fx.staminaRegenMult = e.staminaRegenMult;
      fx.triggered.push('nictofobia');
    }
    if (this.active.has('zoofobia') && nearAnimal > 0) {
      const e = this.defs.zoofobia.effects;
      fx.shake = e.shake * nearAnimal;
      fx.heartbeat = e.heartbeat;
      this.sanity.drainSanity(e.sanityPerSecond * nearAnimal * dt, 'Zoofobia', { quiet: true });
      fx.triggered.push('zoofobia');
    }
    if (this.active.has('necrofobia') && nearCorpse > 0) {
      const e = this.defs.necrofobia.effects;
      fx.nausea = nearCorpse;
      this.sanity.drainSanity(e.sanityPerSecond * nearCorpse * dt, 'Necrofobia', { quiet: true });
      fx.triggered.push('necrofobia');
    }
    if (this.active.has('traumatofobia') && openWound) {
      const e = this.defs.traumatofobia.effects;
      fx.healRate = e.healRate;
      fx.wobble = e.wobble;
      this.sanity.drainSanity(e.sanityPerSecond * dt, 'Traumatofobia', { quiet: true });
      fx.triggered.push('traumatofobia');
    }
    this.effects = fx;
    return fx;
  }

  /** PlayerDeathEvent: a ÚNICA forma de limpar as fobias. */
  clearOnDeath() {
    this.active.clear();
    this.recent = [];
    this.effects = PhobiaManager.neutral();
  }
}
