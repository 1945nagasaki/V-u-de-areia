import { ITEM_CATALOG, SHOP_MATERIALS, STARTER_KIT } from '../config/items.js';
import { BIOMES } from '../config/biomes.js';
import { RESOURCES } from '../config/resources.js';
import { SKINNING, COOKING } from '../config/hunting.js';
import { PROP_TYPES } from '../config/physics.js';
import { SHOP_FOOD, WOUNDS, FOODS, CONDITIONS } from '../config/survival.js';
import { Crafting } from './Crafting.js';
import { ALL_RECIPES, STATIONS } from './crafting/RecipeRegistry.js';

/**
 * Índice de receitas no estilo "JEI" (regra pura): para cada item, como
 * fazer (receitas que o produzem), onde é usado (receitas que o pedem, como
 * ingrediente ou ferramenta), onde conseguir (coleta por bioma, esfolar,
 * fogueira, lojas, kit inicial, rio) e para que serve (ferimentos que trata,
 * macros que enche, doenças que cura).
 *
 * @example
 * const idx = new RecipeIndex({ biomeName: (id) => 'Savana' });
 * idx.recipesFor('lanca_pedra');  // [{ id: 'lanca_pedra', in, out, tools }]
 * idx.usesOf('corda');            // receitas que pedem corda
 * idx.sourcesOf('mel');           // [{ kind: 'coleta', text: 'Tirar mel da colmeia — Savana, …' }]
 * idx.search('curativo');         // ids cujo nome contém o texto
 * idx.search('#arma lança');      // tag + texto
 * idx.tagsOf('noz');              // ['comida', …, 'taiga', 'preta', 'coleta']
 * idx.missing(recipe, inventory); // { cipo: 1 } → falta 1 cipó
 */
export class RecipeIndex {
  /**
   * @param {{ recipes?: object[], items?: Record<string, object>, biomeName?: (id: string) => string }} [o]
   */
  constructor({ recipes = ALL_RECIPES, items = ITEM_CATALOG, biomeName = (id) => id } = {}) {
    this.recipes = recipes;
    this.items = items;
    this.biomeName = biomeName;
    this.byOutput = new Map();
    this.byInput = new Map();
    for (const r of recipes) {
      for (const id of Object.keys(r.out)) push(this.byOutput, id, r);
      for (const id of new Set([...Object.keys(r.in), ...(r.tools ?? [])])) push(this.byInput, id, r);
    }
    this.sources = this.buildSources();
    this.tags = new Map(Object.keys(items).map((id) => [id, this.buildTags(id)]));
  }

  /** Todos os ids do catálogo, ordenados por categoria e nome. */
  allItems() {
    const order = { medicine: 0, weapon: 1, tool: 2, material: 3, food: 4, key: 5 };
    return Object.keys(this.items).sort((a, b) => (order[this.items[a].kind] ?? 9) - (order[this.items[b].kind] ?? 9)
      || this.items[a].name.localeCompare(this.items[b].name, 'pt'));
  }

  /**
   * Busca (sem acento, sem caixa). Palavras com "#" (ou "@") são tags e todas
   * precisam bater (por prefixo: #rem acha #remedio); o resto é texto livre,
   * procurado no nome e na descrição. Ex.: "#arma", "#taiga", "#medicina mel".
   */
  search(text = '') {
    const words = norm(text).split(/\s+/).filter(Boolean);
    const tags = words.filter((w) => /^[#@]./.test(w)).map((w) => w.slice(1));
    const t = words.filter((w) => !/^[#@]/.test(w)).join(' ');
    return this.allItems().filter((id) => {
      const mine = this.tagsOf(id);
      if (!tags.every((q) => mine.some((tag) => tag.startsWith(q)))) return false;
      const d = this.items[id];
      return !t || norm(d.name).includes(t) || norm(d.description ?? '').includes(t);
    });
  }

  /** Tags do item (sem "#"): tipo, planta, biomas onde se coleta, estação e origem. */
  tagsOf(id) {
    return this.tags.get(id) ?? [];
  }

  buildTags(id) {
    const d = this.items[id], tags = new Set(KIND_TAGS[d.kind] ?? []);
    if (d.plant) tags.add('planta');
    if (d.hotbar) tags.add('equipavel');
    for (const t of Object.values(RESOURCES.types)) {
      if (t.item !== id && t.also !== id) continue;
      for (const b of t.biomes === 'all' ? BIOMES.map((x) => x.id) : t.biomes) tags.add(norm(b));
    }
    for (const r of this.recipesFor(id)) {
      tags.add('fabricavel');
      if (STATIONS[r.station]) tags.add(norm(STATIONS[r.station].name.split(/[ /]/)[0]));
    }
    for (const s of this.sourcesOf(id)) tags.add(norm(s.kind));
    return [...tags];
  }

  /** Receitas que produzem o item. */
  recipesFor(id) {
    return this.byOutput.get(id) ?? [];
  }

  /** Receitas que pedem o item (ingrediente ou ferramenta). */
  usesOf(id) {
    return this.byInput.get(id) ?? [];
  }

  /** Onde conseguir o item (fora da mesa de crafting). */
  sourcesOf(id) {
    return this.sources.get(id) ?? [];
  }

  /**
   * Para que serve (tratamentos e comida).
   * @returns {string[]}
   */
  effectsOf(id) {
    const out = [];
    for (const [wid, w] of Object.entries(WOUNDS)) {
      const act = w.treat?.[id];
      if (act) out.push(`Trata ${w.name.toLowerCase()} (${{ bandage: 'cobre', suture: 'costura', clean: 'limpa o pus', antivenom: 'neutraliza o veneno', extract: 'extrai', pull: 'arranca' }[act] ?? act})`);
      void wid;
    }
    const f = FOODS[id];
    if (f) {
      const m = [['proteins', 'proteínas'], ['carbs', 'carboidratos'], ['fats', 'gorduras'], ['water', 'água']].filter(([k]) => f[k]).map(([k, n]) => `${f[k] > 0 ? '+' : ''}${f[k]} ${n}`);
      if (m.length) out.push(`Comer: ${m.join(', ')}`);
      for (const c of f.cures ?? []) out.push(`Cura ${c === 'veneno' ? 'veneno' : CONDITIONS[c]?.name.toLowerCase() ?? c}`);
      if (f.contamination) out.push('Pode dar parasitas (ferva/asse antes)');
      if (f.sweet) out.push('Doce: acalma a mente');
    }
    if (this.items[id]?.comfort) out.push('Atividade de conforto: recupera sanidade');
    return out;
  }

  /**
   * O que falta no inventário para a receita (ingredientes e ferramentas).
   * @param {object} recipe
   * @param {Map<string, number>} inventory
   * @returns {Record<string, number>} id → quantidade que falta (vazio = dá para fazer)
   */
  missing(recipe, inventory) {
    const need = {};
    for (const [id, n] of Object.entries(recipe.in)) { const have = inventory.get(id) ?? 0; if (have < n) need[id] = n - have; }
    for (const t of recipe.tools ?? []) if (!(inventory.get(t) > 0)) need[t] = 1;
    return need;
  }

  /** Lista da mesa (ids com repetição) para a receita. */
  static tableFor(recipe) {
    return Crafting.expand(recipe);
  }

  buildSources() {
    const src = new Map();
    const add = (id, kind, text) => push(src, id, { kind, text });
    for (const t of Object.values(RESOURCES.types)) {
      const where = t.biomes === 'all' ? 'todos os biomas' : t.biomes.map(this.biomeName).join(', ');
      add(t.item, 'coleta', `${t.label} — ${where}${t.water ? ' (na margem da água)' : ''}`);
      if (t.also) add(t.also, 'coleta', `${t.label} (vem junto) — ${where}`);
    }
    const loot = new Map();
    for (const [size, table] of Object.entries(SKINNING.loot)) for (const type of Object.keys(table)) {
      const item = PROP_TYPES[type]?.item;
      if (item) { if (!loot.has(item)) loot.set(item, []); loot.get(item).push({ small: 'animais pequenos', medium: 'animais médios', large: 'animais grandes', bird: 'aves' }[size]); }
    }
    for (const [item, sizes] of loot) add(item, 'caça', `Esfolar ${sizes.join(', ')} (faca equipada, segure E)`);
    for (const [raw, cooked] of Object.entries(COOKING.recipes)) if (raw !== cooked) add(cooked, 'fogueira', `${raw.startsWith('agua') ? 'Ferver' : 'Assar'} ${this.items[raw]?.name ?? raw} na fogueira`);
    add('cinza', 'fogueira', 'Recolher da fogueira (a cada 90 s)');
    add('agua_rio', 'água', 'Encher o cantil no rio ou lago (E na margem)');
    for (const { id, price } of [...SHOP_FOOD, ...SHOP_MATERIALS]) add(id, 'loja', `Lojas das vilas — ${price} moedas`);
    for (const [id, n] of Object.entries(STARTER_KIT)) add(id, 'kit', `Kit inicial (${n})`);
    return src;
  }
}

/** Tags por tipo de item (singular e plural, para "#armas" também achar). */
const KIND_TAGS = {
  medicine: ['medicina', 'remedio', 'remedios'], weapon: ['arma', 'armas'], tool: ['ferramenta', 'ferramentas'],
  material: ['material', 'materiais'], food: ['comida'], key: ['missao'],
};

function push(map, k, v) {
  if (!map.has(k)) map.set(k, []);
  map.get(k).push(v);
}

function norm(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
