import { RESOURCES, RECIPES } from '../config/survival.js';

/**
 * Mochila de sobrevivência (inventário em grade) + criação (regra pura).
 * Guarda contagens por id de recurso (`RESOURCES`).
 *
 * @example
 *   const bag = new Bag();
 *   bag.add('madeira', 3); bag.add('pedra', 2);
 *   bag.craft('fogueira'); // true → bag.count('fogueira') === 1
 */
export class Bag {
  constructor({ resources = RESOURCES, recipes = RECIPES } = {}) {
    this.resources = resources;
    this.recipes = recipes;
    this.items = new Map();
    this.listeners = [];
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  emit(evt) {
    for (const fn of this.listeners) fn(evt);
  }

  count(id) {
    return this.items.get(id) ?? 0;
  }

  add(id, n = 1) {
    if (!this.resources[id]) throw new Error(`Recurso desconhecido: ${id}`);
    this.items.set(id, this.count(id) + n);
    this.emit({ type: 'add', id, n });
  }

  remove(id, n = 1) {
    const c = this.count(id);
    if (c < n) return false;
    if (c === n) this.items.delete(id);
    else this.items.set(id, c - n);
    this.emit({ type: 'remove', id, n });
    return true;
  }

  /** Lista para a grade: [{ id, n, def }]. */
  list() {
    return [...this.items].map(([id, n]) => ({ id, n, def: this.resources[id] }));
  }

  recipe(id) {
    return this.recipes.find((r) => r.id === id);
  }

  canCraft(id) {
    const r = this.recipe(id);
    return !!r && Object.entries(r.needs).every(([res, n]) => this.count(res) >= n);
  }

  /** Consome os materiais e adiciona o produto. @returns {boolean} */
  craft(id) {
    if (!this.canCraft(id)) return false;
    const r = this.recipe(id);
    for (const [res, n] of Object.entries(r.needs)) this.remove(res, n);
    this.items.set(r.out, this.count(r.out) + r.qty);
    this.emit({ type: 'craft', id: r.out });
    return true;
  }

  toJSON() {
    return Object.fromEntries(this.items);
  }

  load(d) {
    this.items = new Map(Object.entries(d ?? {}).filter(([id, n]) => this.resources[id] && n > 0));
    this.emit({ type: 'load' });
  }
}
