import { MISSIONS, MISSION_DIFFICULTY } from '../../config/missions.js';

/**
 * Item conta como comida para as missões? `food: true` ou `kind: 'food'`
 * (remédios marcados `food: true`, como o chá de ervas, não contam).
 * @param {{food?: boolean, kind?: string}|undefined} def entrada de ITEMS
 */
/**
 * Comida "coletada" para a missão: fruta fresca colhida ou carne crua pega do
 * chão (itens da coleta/caça de config/foods.js que ainda assam). Assados que
 * saem da fogueira, compras e devoluções não contam.
 * @param {{ forage?: { roastsTo?: string } }} def item de ITEMS
 */
export function isForagedFood(def) {
  return !!def?.forage?.roastsTo;
}

export function isFoodItem(def) {
  if (!def || def.kind === 'medicine') return false;
  return def.food === true || def.kind === 'food';
}

/**
 * Missões: lógica pura (sem DOM, sem THREE, sem armazenamento).
 * Guarda as missões ativas e concluídas, conta o progresso por tipo de objetivo
 * e avisa os ouvintes. Quem dá a recompensa é quem ouve o evento 'complete'.
 *
 * Eventos (`onChange`): {type:'start'|'progress'|'complete'|'load'|'reset', mission?}
 *
 * @example
 *   const m = new MissionManager();
 *   m.onChange((e) => { if (e.type === 'complete') darRecompensa(e.mission); });
 *   m.start('buscar_comida');
 *   m.progress('collect_food', 1); // [1/5]
 */
export class MissionManager {
  /** @param {Record<string, object>} catalog definições (config/missions.js) */
  constructor(catalog = MISSIONS) {
    this.catalog = catalog;
    /** @type {Map<string, object>} missões ativas (id → missão) */
    this.active = new Map();
    /** @type {Set<string>} ids concluídos */
    this.completed = new Set();
    this.listeners = [];
  }

  /** @param {(e: {type: string, mission?: object}) => void} fn */
  onChange(fn) {
    this.listeners.push(fn);
  }

  emit(e) {
    for (const fn of this.listeners) fn(e);
  }

  /** Cria a missão (cópia da definição) com `currentCount` = 0. */
  create(id) {
    const def = this.catalog[id];
    if (!def) return null;
    return {
      id: def.id ?? id,
      title: def.title,
      description: def.description,
      difficulty: def.difficulty,
      difficultyLabel: MISSION_DIFFICULTY[def.difficulty]?.label ?? def.difficulty,
      objectiveType: def.objectiveType,
      objectiveItem: def.objectiveItem ?? null, // ex.: 'adaga_pedra' (craft_item)
      objectiveText: def.objectiveText,
      targetCount: def.targetCount,
      currentCount: 0,
      xpReward: def.xpReward,
      goldReward: def.goldReward,
      completed: false,
    };
  }

  /**
   * Começa uma missão. Não faz nada se ela já está ativa, já foi concluída ou não existe.
   * @returns {object|null} a missão iniciada
   */
  start(id) {
    if (this.active.has(id) || this.completed.has(id)) return null;
    const m = this.create(id);
    if (!m) return null;
    this.active.set(id, m);
    this.emit({ type: 'start', mission: m });
    return m;
  }

  /**
   * Soma `n` às missões ativas com esse tipo de objetivo; conclui as que chegam ao alvo.
   * @returns {object[]} missões concluídas nesta chamada
   */
  progress(type, n = 1, item = null) {
    if (!Number.isFinite(n) || n <= 0) return [];
    const done = [];
    for (const m of [...this.active.values()]) {
      if (m.objectiveType !== type) continue;
      if (m.objectiveItem && m.objectiveItem !== item) continue; // missão de um item específico
      m.currentCount = Math.min(m.targetCount, m.currentCount + n);
      this.emit({ type: 'progress', mission: m });
      if (m.currentCount >= m.targetCount && this.complete(m.id)) done.push(m);
    }
    return done;
  }

  /**
   * Conclui a missão ativa (chamado sozinho por `progress` ao chegar no alvo).
   * @returns {object|null} a missão concluída
   */
  complete(id) {
    const m = this.active.get(id);
    if (!m) return null;
    m.currentCount = m.targetCount;
    m.completed = true;
    this.active.delete(id);
    this.completed.add(id);
    this.emit({ type: 'complete', mission: m });
    return m;
  }

  isActive(id) {
    return this.active.has(id);
  }

  isCompleted(id) {
    return this.completed.has(id);
  }

  /** Lista das missões ativas, na ordem em que começaram. */
  list() {
    return [...this.active.values()];
  }

  /** Estado salvável: ativas (id + contagem) e concluídas (ids). */
  toJSON() {
    return {
      active: this.list().map((m) => ({ id: m.id, currentCount: m.currentCount })),
      completed: [...this.completed],
    };
  }

  /** Repõe o estado salvo. Ids desconhecidos são ignorados; contagens ficam em [0, alvo). */
  load(data) {
    this.active.clear();
    this.completed.clear();
    for (const id of data?.completed ?? []) if (this.catalog[id]) this.completed.add(id);
    for (const s of data?.active ?? []) {
      if (!s || this.completed.has(s.id)) continue;
      const m = this.create(s.id);
      if (!m) continue;
      const c = Number(s.currentCount);
      m.currentCount = Number.isFinite(c) ? Math.max(0, Math.min(m.targetCount - 1, Math.floor(c))) : 0;
      this.active.set(m.id, m);
    }
    this.emit({ type: 'load' });
  }

  /** Novo Jogo: nenhuma missão ativa ou concluída. */
  reset() {
    this.active.clear();
    this.completed.clear();
    this.emit({ type: 'reset' });
  }
}
