import { GEAR_CATALOG, STACK, BACKPACK, ECONOMY, EXTRACTION, stockFor } from '../../config/gear.js';

/**
 * Mochila, compras e extração do pacote de itens (regras puras).
 *
 * @example
 * slotsUsed(new Map([['pao', 21]]), 2);        // 2 pilhas de pão + 2 equipamentos = 4
 * const shop = new ShopStock();
 * buy({ id: 'pistola', ... });                  // valida saldo, estoque e espaço ANTES de cobrar
 */

/** Limite por espaço de um item (itens antigos do jogo usam `STACK.legacy`). */
export function stackLimit(id, catalog = GEAR_CATALOG) {
  return catalog[id]?.stackLimit ?? STACK.legacy;
}

/** Espaços que `count` unidades de `id` ocupam. */
export function slotsFor(id, count, catalog = GEAR_CATALOG) {
  return count > 0 ? Math.ceil(count / stackLimit(id, catalog)) : 0;
}

/**
 * Espaços ocupados na mochila.
 * @param {Map<string, number>} inventory pilhas (PlayerState.inventory)
 * @param {number} equipmentCount equipamentos guardados na mochila (fora da hotbar)
 */
export function slotsUsed(inventory, equipmentCount = 0, catalog = GEAR_CATALOG) {
  let n = equipmentCount;
  for (const [id, c] of inventory) n += slotsFor(id, c, catalog);
  return n;
}

/**
 * Cabem mais `amount` unidades de `id`?
 * @returns {boolean}
 */
export function hasRoom(id, amount, inventory, equipmentCount = 0, { catalog = GEAR_CATALOG, capacity = BACKPACK.slots } = {}) {
  const used = slotsUsed(inventory, equipmentCount, catalog);
  if (catalog[id]?.equipment) return used + amount <= capacity;
  const have = inventory.get(id) ?? 0;
  return used - slotsFor(id, have, catalog) + slotsFor(id, have + amount, catalog) <= capacity;
}

/**
 * Estoque das lojas por vendedor, com reposição a cada `restockHours` horas de jogo.
 *
 * @example
 * const s = new ShopStock();
 * s.left('renascimento:ferreiro', section, 'pistola', hours);  // 1
 * s.take('renascimento:ferreiro', 'pistola');
 */
export class ShopStock {
  constructor(cfg = ECONOMY) {
    this.cfg = cfg;
    /** vendedor → { at: hora da última reposição, sold: { id: n } } */
    this.vendors = new Map();
  }

  vendor(key, hours) {
    let v = this.vendors.get(key);
    if (!v || hours - v.at >= this.cfg.restockHours) {
      v = { at: hours, sold: {} };
      this.vendors.set(key, v);
    }
    return v;
  }

  /** Unidades (ou pacotes) ainda à venda. */
  left(key, section, id, hours) {
    return Math.max(0, stockFor(section, id) - (this.vendor(key, hours).sold[id] ?? 0));
  }

  take(key, id, hours) {
    const v = this.vendor(key, hours);
    v.sold[id] = (v.sold[id] ?? 0) + 1;
  }

  serialize() {
    return [...this.vendors].map(([key, v]) => ({ key, at: v.at, sold: { ...v.sold } }));
  }

  load(list) {
    this.vendors.clear();
    for (const v of list ?? []) {
      if (typeof v?.key !== 'string' || !Number.isFinite(v.at)) continue;
      const sold = {};
      for (const [id, n] of Object.entries(v.sold ?? {})) if (GEAR_CATALOG[id] && n > 0) sold[id] = Math.floor(n);
      this.vendors.set(v.key, { at: v.at, sold });
    }
  }
}

/**
 * Quanto uma compra entrega: equipamento = 1 instância; munição = pacote;
 * o resto = 1 unidade.
 */
export function purchaseAmount(def) {
  return def.pack ?? 1;
}

/**
 * Uma compra. Valida TUDO antes de cobrar (saldo, estoque, espaço); só então
 * cobra, baixa o estoque e entrega — tudo na mesma chamada (clicar rápido não
 * duplica nem cobra sem entregar).
 *
 * @param {{ id: string, coins: number, left: number, room: boolean }} q consulta já resolvida
 * @returns {{ ok: boolean, reason?: 'unknown'|'not-for-sale'|'coins'|'stock'|'space', price?: number, amount?: number }}
 */
export function quote({ id, coins, left, room }, catalog = GEAR_CATALOG) {
  const def = catalog[id];
  if (!def) return { ok: false, reason: 'unknown' };
  if (def.acquisition !== 'shop' || !(def.price > 0)) return { ok: false, reason: 'not-for-sale' };
  const price = def.price, amount = purchaseAmount(def);
  if (left <= 0) return { ok: false, reason: 'stock', price, amount };
  if (coins < price) return { ok: false, reason: 'coins', price, amount };
  if (!room) return { ok: false, reason: 'space', price, amount };
  return { ok: true, price, amount };
}

/**
 * Executa a compra.
 * @param {object} o
 * @param {string} o.id
 * @param {string} o.vendor chave do vendedor
 * @param {object} o.section seção da vitrine (estoque)
 * @param {number} o.hours hora total do jogo (reposição)
 * @param {{ coins: number, spend(n: number): boolean, inventory: Map<string, number>, addItem(id: string, n: number): void }} o.wallet PlayerState
 * @param {import('./Equipment.js').EquipmentStore} o.store
 * @param {ShopStock} o.stock
 * @param {number} o.equipmentInBag equipamentos guardados na mochila
 * @returns {{ ok: boolean, reason?: string, price?: number, amount?: number, instance?: object }}
 */
export function buy({ id, vendor, section, hours, wallet, store, stock, equipmentInBag }) {
  const def = store.catalog[id];
  const amount = def ? purchaseAmount(def) : 0;
  const q = quote({
    id, coins: wallet.coins, left: def ? stock.left(vendor, section, id, hours) : 0,
    room: !!def && hasRoom(id, amount, wallet.inventory, equipmentInBag, { catalog: store.catalog }),
  }, store.catalog);
  if (!q.ok) return q;
  if (!wallet.spend(q.price)) return { ...q, ok: false, reason: 'coins' };
  stock.take(vendor, id, hours);
  if (def.equipment) return { ...q, instance: store.create(id) }; // descarregada, durabilidade cheia
  wallet.addItem(id, q.amount);
  return q;
}

/**
 * Progresso de extração por alvo (árvore, rocha). Cada impacto válido soma a
 * eficiência da ferramenta; ao completar `work`, o alvo entrega o recurso.
 * A eficiência mexe só no PROGRESSO, nunca no dano de combate.
 *
 * @example
 * const ex = new Extraction();
 * ex.hit(tree, 'wood', 2, time);   // machado de metal: { progress: 2, work: 4, done: false }
 * ex.hit(tree, 'wood', 2, time);   // { done: true, yield: { graveto: 2 } }
 */
export class Extraction {
  constructor(cfg = EXTRACTION) {
    this.cfg = cfg;
    /** alvo → { progress, at } */
    this.targets = new Map();
  }

  /** A ferramenta serve para este tipo de alvo (etiqueta do colisor)? */
  kindOfTag(tag) {
    for (const kind of ['wood', 'stone']) if (this.cfg[kind].tags.includes(tag)) return kind;
    return null;
  }

  /**
   * @param {object} target identidade do alvo (o colisor da árvore/rocha)
   * @param {'wood'|'stone'} kind
   * @param {number} efficiency 1 | 1,5 | 2
   * @param {number} time s de jogo
   */
  hit(target, kind, efficiency, time) {
    const c = this.cfg[kind];
    let t = this.targets.get(target);
    if (!t || time - t.at > this.cfg.forgetSeconds) { t = { progress: 0, at: time }; this.targets.set(target, t); }
    t.at = time;
    t.progress += efficiency;
    if (t.progress < c.work) return { done: false, progress: t.progress, work: c.work };
    this.targets.delete(target);
    return { done: true, progress: c.work, work: c.work, yield: { ...c.yield } };
  }

  /** Limpa alvos abandonados (chamar de vez em quando). */
  prune(time) {
    for (const [k, t] of this.targets) if (time - t.at > this.cfg.forgetSeconds) this.targets.delete(k);
  }
}
