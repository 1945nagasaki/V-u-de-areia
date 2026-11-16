import { DISEASES, BITE_INFECTION_CHANCE } from '../config/afflictions.js';

/**
 * Doenças zoonóticas raras (regra pura). Cada ataque bem-sucedido de um
 * animal vetor tem BITE_INFECTION_CHANCE (2%) de contágio. A doença evolui
 * por estágios (incubação → leve → avançada) e NÃO passa sozinha: só o
 * remédio certo (`cure`) ou a morte.
 *
 * O aleatório é injetável (`rng`, padrão Math.random): `rng() < 0.02`.
 *
 * Eventos (`on`): 'contracted' { id, def, source }, 'stage' { id, def, stage },
 * 'cured' { id, def }, 'spasm' { id } (hidrofobia), 'infect-bite' { id } (tétano).
 *
 * @example
 * const dm = new DiseaseManager({ rng: Math.random });
 * dm.onAnimalBite('lobo');               // 2%: raiva
 * const fx = dm.update(dt, { swimming }); // debuffs do quadro
 * fx.speed; fx.sprintBlocked; fx.invertControls; fx.hpPerSecond;
 * dm.cure('soro_antirrabico');           // remédio → doenças que ele cura
 */
export class DiseaseManager {
  /**
   * @param {{ rng?: () => number, diseases?: typeof DISEASES, chance?: number }} [o]
   */
  constructor({ rng = Math.random, diseases = DISEASES, chance = BITE_INFECTION_CHANCE } = {}) {
    this.rng = rng;
    this.defs = diseases;
    this.chance = chance;
    /** id → { id, age, stage, source, confusedLeft, nextConfusion, spasmIn, bitten } */
    this.active = new Map();
    this.listeners = new Map();
    this.effects = DiseaseManager.neutral();
  }

  /** Nenhum debuff. */
  static neutral() {
    return {
      speed: 1, staminaRegenMult: 1, staminaDrainPerSecond: 0, hpPerSecond: 0, sanityPerSecond: 0,
      fever: 0, chills: 0, sprintBlocked: false, invertControls: false, carryLimit: Infinity, feverPeak: false,
    };
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

  /** Doenças cujo vetor é esta espécie. */
  diseasesOf(speciesId) {
    return Object.keys(this.defs).filter((id) => this.defs[id].vectors.includes(speciesId));
  }

  /**
   * Ataque bem-sucedido de um animal: sorteio de contágio, exatamente
   * `rng() < 0.02`. Um sorteio por ataque (espécie com mais de uma doença
   * escolhe qual pelo mesmo sorteio).
   * @param {string} speciesId chave de SPECIES (config/fauna.js)
   * @returns {string|null} doença contraída
   */
  onAnimalBite(speciesId) {
    const list = this.diseasesOf(speciesId).filter((id) => !this.active.has(id));
    if (!list.length) return null;
    const roll = this.rng();
    if (!(roll < this.chance)) return null;
    const id = list[Math.min(list.length - 1, Math.floor((roll / this.chance) * list.length))];
    return this.contract(id, speciesId);
  }

  /**
   * Contágio por outra via (água sem ferver, carrapato do capim).
   * @returns {string|null}
   */
  roll(id, chance, source) {
    if (this.active.has(id) || !(this.rng() < chance)) return null;
    return this.contract(id, source);
  }

  /** Contrai a doença (sem sorteio). */
  contract(id, source = null) {
    const def = this.defs[id];
    if (!def || this.active.has(id)) return null;
    this.active.set(id, { id, age: 0, stage: 0, source, confusedLeft: 0, nextConfusion: 0, spasmIn: 0, bitten: false });
    this.emit('contracted', { id, def, source });
    return id;
  }

  /**
   * Usa um remédio: cura as doenças que têm `cure === itemId`.
   * @returns {string[]} doenças curadas
   */
  cure(itemId) {
    const cured = [...this.active.keys()].filter((id) => this.defs[id].cure === itemId);
    for (const id of cured) {
      this.active.delete(id);
      this.emit('cured', { id, def: this.defs[id] });
    }
    return cured;
  }

  /** Lista para a ficha: estágio atual e sintomas. */
  list() {
    return [...this.active.values()].map((d) => {
      const def = this.defs[d.id];
      return { id: d.id, def, stage: d.stage, age: d.age, source: d.source, symptoms: def.debuffs[d.stage].symptoms ?? [] };
    });
  }

  /**
   * Um quadro: avança os estágios e soma os debuffs de todas as doenças.
   * @param {number} dt s de jogo
   * @param {{ swimming?: boolean, maxHealth?: number }} [env]
   * @returns {ReturnType<typeof DiseaseManager.neutral>}
   */
  update(dt, { swimming = false, maxHealth = 100 } = {}) {
    const fx = DiseaseManager.neutral();
    for (const d of this.active.values()) {
      const def = this.defs[d.id];
      d.age += dt;
      let stage = 0;
      def.stages.forEach((at, i) => { if (d.age >= at) stage = i; });
      if (stage !== d.stage) {
        d.stage = stage;
        this.emit('stage', { id: d.id, def, stage });
      }
      const b = def.debuffs[stage];
      if (b.speed) fx.speed *= b.speed;
      if (b.staminaRegenMult) fx.staminaRegenMult *= b.staminaRegenMult;
      if (b.staminaDrainPerSecond) fx.staminaDrainPerSecond += b.staminaDrainPerSecond;
      if (b.hpPerSecond) fx.hpPerSecond += b.hpPerSecond;
      if (b.fever) fx.fever = Math.max(fx.fever, b.fever);
      if (b.chills) fx.chills = Math.max(fx.chills, b.chills);
      if (b.carryLimit) fx.carryLimit = Math.min(fx.carryLimit, b.carryLimit);
      // Raiva: hidrofobia (água = pânico) e confusão (comandos trocados por 1 s).
      if (b.hydrophobia && swimming) {
        fx.sanityPerSecond += b.hydrophobia.sanityPerSecond;
        d.spasmIn -= dt;
        if (d.spasmIn <= 0) { d.spasmIn = b.hydrophobia.spasmEvery; this.emit('spasm', { id: d.id }); }
      }
      if (b.confusion) {
        if (d.confusedLeft > 0) d.confusedLeft -= dt;
        d.nextConfusion -= dt;
        if (d.nextConfusion <= 0) {
          const [lo, hi] = b.confusion.every;
          d.nextConfusion = lo + this.rng() * (hi - lo);
          d.confusedLeft = b.confusion.seconds;
        }
        if (d.confusedLeft > 0) fx.invertControls = true;
      }
      // Leptospirose: picos de febre periódicos que tiram 2% da vida/s.
      if (b.feverPeak && d.age % b.feverPeak.every >= b.feverPeak.every - b.feverPeak.seconds) {
        fx.feverPeak = true;
        fx.fever = 1;
        fx.hpPerSecond += b.feverPeak.hpFractionPerSecond * maxHealth;
      }
      // Tétano: rigidez em intervalos (sem correr) e a mordida infecciona.
      if (b.rigidity && d.age % b.rigidity.every < b.rigidity.seconds) fx.sprintBlocked = true;
      if (b.infectBite && !d.bitten) { d.bitten = true; this.emit('infect-bite', { id: d.id }); }
    }
    this.effects = fx;
    return fx;
  }

  /** Frase de morte se uma doença pesou (a mais avançada). */
  deathCause() {
    const worst = [...this.active.values()].sort((a, b) => b.stage - a.stage)[0];
    return worst ? `${this.defs[worst.id].name} venceu seu corpo` : null;
  }

  /** Morte e respawn: renasce curado. */
  clearOnDeath() {
    this.active.clear();
    this.effects = DiseaseManager.neutral();
  }
}
