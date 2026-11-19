import { COOKING } from '../../config/hunting.js';

/**
 * Registro central de receitas (estilo JEI). Toda receita do jogo mora aqui,
 * num formato só:
 *
 *   {
 *     id: 'lanca_pedra',                       // estável: a caderneta guarda este id
 *     output: { item: 'lanca_pedra', amount: 1 },
 *     station: 'HANDS',                        // chave de STATIONS
 *     craftTime: 3,                            // segundos (0 = na hora)
 *     ingredients: [{ item: 'graveto_longo', amount: 1 }, …], // gastos
 *     tools: ['faca_osso'],                    // precisam estar na mesa, não são gastos
 *     category: 'WEAPONS',                     // chave de CATEGORIES
 *     hint: 'Aponte a vara com uma pedra.',    // opcional
 *   }
 *
 * Duas receitas com o mesmo `output.item` são **alternativas** (o visualizador
 * mostra setas < >). Para adicionar uma receita, basta uma entrada nova em
 * `recipesDB`; os testes conferem que itens, estações e categorias existem.
 *
 * @example
 * import { ALL_RECIPES, recipesAt } from './RecipeRegistry.js';
 * recipesAt('HANDS');     // as da mesa da mochila (crafting livre)
 * ALL_RECIPES[0].in;      // { pedra: 2 } — forma curta usada por Crafting/RecipeIndex
 */

/**
 * Estações de fabricação. `built: false` = ainda não existe no mundo (fica
 * pronta para receitas futuras; nenhuma receita atual a usa).
 */
export const STATIONS = {
  HANDS: { name: 'Mãos Livres', icon: 'hand', where: 'Mesa de crafting da mochila (I ou Tab)', built: true },
  CAMPFIRE: { name: 'Fogueira / Panela', icon: 'flame', where: 'Qualquer fogueira acesa (E perto do fogo)', built: true },
  CRAFTING_TABLE: { name: 'Mesa de Trabalho', icon: 'wrench', where: 'Ainda não existe no mundo', built: false },
  STONE_FORGE: { name: 'Forja de Pedra', icon: 'flame', where: 'Ainda não existe no mundo', built: false },
  LEATHER_BENCH: { name: 'Bancada de Couro', icon: 'hide', where: 'Ainda não existe no mundo', built: false },
};

export const CATEGORIES = {
  WEAPONS: 'Armas',
  TOOLS: 'Ferramentas',
  MEDICINE: 'Medicina',
  MATERIALS: 'Materiais',
  FOOD: 'Comida e água',
};

const ing = (item, amount = 1) => ({ item, amount });

/** Receitas feitas à mão, na mesa da mochila. */
const HAND_RECIPES = [
  // ---- materiais
  { id: 'lamina_pedra', output: { item: 'lamina_pedra', amount: 1 }, station: 'HANDS', craftTime: 1.5, ingredients: [ing('pedra', 2)], category: 'MATERIALS', hint: 'Bata uma pedra na outra.' },
  { id: 'corda', output: { item: 'corda', amount: 1 }, station: 'HANDS', craftTime: 1.5, ingredients: [ing('cipo', 2)], category: 'MATERIALS' },
  { id: 'fragmento_osso', output: { item: 'fragmento_osso', amount: 3 }, station: 'HANDS', craftTime: 2, ingredients: [ing('osso'), ing('pedra')], category: 'MATERIALS', hint: 'Quebre o osso com a pedra.' },
  // ---- armas
  { id: 'adaga_pedra', output: { item: 'adaga_pedra', amount: 1 }, station: 'HANDS', craftTime: 2.5, ingredients: [ing('pedra', 2), ing('graveto')], category: 'WEAPONS', hint: 'Lasque uma pedra na outra e amarre no cabo de graveto.' },
  { id: 'lanca_simples', output: { item: 'lanca_simples', amount: 1 }, station: 'HANDS', craftTime: 2, ingredients: [ing('graveto_longo')], category: 'WEAPONS', hint: 'Aponte a vara com uma pedra.' },
  { id: 'lanca_pedra', output: { item: 'lanca_pedra', amount: 1 }, station: 'HANDS', craftTime: 3, ingredients: [ing('graveto_longo'), ing('lamina_pedra'), ing('corda')], category: 'WEAPONS' },
  { id: 'arco', output: { item: 'arco', amount: 1 }, station: 'HANDS', craftTime: 4, ingredients: [ing('graveto_longo'), ing('corda')], category: 'WEAPONS' },
  { id: 'arco_tripas', output: { item: 'arco', amount: 1 }, station: 'HANDS', craftTime: 4, ingredients: [ing('graveto_longo'), ing('tripas')], category: 'WEAPONS', hint: 'Tripas secas viram a corda do arco.' },
  { id: 'flecha', output: { item: 'flecha', amount: 3 }, station: 'HANDS', craftTime: 2, ingredients: [ing('graveto'), ing('lamina_pedra'), ing('pena')], category: 'WEAPONS', hint: 'Ponta de pedra. As de ouro e metal só com o ferreiro.' },
  { id: 'flecha_madeira', output: { item: 'flecha_madeira', amount: 1 }, station: 'HANDS', craftTime: 1.5, ingredients: [ing('graveto')], category: 'WEAPONS', hint: 'Só madeira: afie a ponta do graveto. Fraca, mas não custa pedra nem pena.' },
  // ---- ferramentas
  { id: 'fogueira', output: { item: 'fogueira', amount: 1 }, station: 'HANDS', craftTime: 2, ingredients: [ing('graveto', 2), ing('pedra', 2)], category: 'TOOLS', hint: 'Posicione no chão pela mochila e acenda com E.' },
  { id: 'faca_osso', output: { item: 'faca_osso', amount: 1 }, station: 'HANDS', craftTime: 2.5, ingredients: [ing('osso'), ing('corda')], category: 'TOOLS' },
  { id: 'faca_pedra', output: { item: 'faca_pedra', amount: 1 }, station: 'HANDS', craftTime: 2.5, ingredients: [ing('lamina_pedra'), ing('graveto'), ing('corda')], category: 'TOOLS' },
  { id: 'agulha_osso', output: { item: 'agulha_osso', amount: 1 }, station: 'HANDS', craftTime: 2, ingredients: [ing('fragmento_osso')], tools: ['faca_osso'], category: 'TOOLS', hint: 'Fragmento fincado na faca.' },
  { id: 'flauta_osso', output: { item: 'flauta_osso', amount: 1 }, station: 'HANDS', craftTime: 3, ingredients: [ing('osso')], tools: ['faca_osso'], category: 'TOOLS', hint: 'Fure o osso oco com a faca.' },
  // ---- medicina
  { id: 'curativo_folha', output: { item: 'curativo_folha', amount: 1 }, station: 'HANDS', craftTime: 1, ingredients: [ing('folha_medicinal')], category: 'MEDICINE' },
  { id: 'curativo_cinza', output: { item: 'curativo_cinza', amount: 1 }, station: 'HANDS', craftTime: 1.5, ingredients: [ing('curativo_folha'), ing('cinza')], category: 'MEDICINE', hint: 'Anti-infeccioso.' },
  { id: 'curativo_tabaco', output: { item: 'curativo_tabaco', amount: 1 }, station: 'HANDS', craftTime: 1.5, ingredients: [ing('curativo_folha'), ing('folha_tabaco')], category: 'MEDICINE', hint: 'Anti-veneno.' },
  { id: 'curativo_lirio', output: { item: 'curativo_lirio', amount: 1 }, station: 'HANDS', craftTime: 1.5, ingredients: [ing('curativo_folha'), ing('lirio')], category: 'MEDICINE', hint: 'Anti-veneno.' },
  { id: 'curativo_mel', output: { item: 'curativo_mel', amount: 1 }, station: 'HANDS', craftTime: 1.5, ingredients: [ing('curativo_folha'), ing('mel')], category: 'MEDICINE' },
  // ---- remédios das doenças zoonóticas (config/afflictions.js)
  { id: 'cha_ervas', output: { item: 'cha_ervas', amount: 1 }, station: 'HANDS', craftTime: 3, ingredients: [ing('agua_fervida'), ing('folha_medicinal', 2)], category: 'MEDICINE', hint: 'Cura Febre Maculosa e Leptospirose.' },
  { id: 'soro_antirrabico', output: { item: 'soro_antirrabico', amount: 1 }, station: 'HANDS', craftTime: 6, ingredients: [ing('agua_fervida'), ing('lirio'), ing('mel')], tools: ['agulha_osso'], category: 'MEDICINE', hint: 'Cura a Raiva. A agulha de osso injeta.' },
  { id: 'cataplasma_antibiotico', output: { item: 'cataplasma_antibiotico', amount: 1 }, station: 'HANDS', craftTime: 3, ingredients: [ing('cinza'), ing('mel'), ing('folha_medicinal')], category: 'MEDICINE', hint: 'Cura o Tétano (trate também a mordida).' },
];

/**
 * Receitas da fogueira, geradas de COOKING.recipes (a fonte de verdade da
 * fogueira). craftTime = segundos no fogo (COOKING.times).
 */
const FIRE_RECIPES = Object.entries(COOKING.recipes)
  .filter(([raw, cooked]) => raw !== cooked)
  .map(([raw, cooked]) => ({
    id: `fogo_${raw}`,
    output: { item: cooked, amount: 1 },
    station: 'CAMPFIRE',
    craftTime: COOKING.times[raw] ?? COOKING.defaultTime,
    ingredients: [ing(raw)],
    category: 'FOOD',
    hint: raw.startsWith('agua') ? 'Ferva na fogueira.' : 'Asse na fogueira.',
  }));

/** Banco global de receitas (formato do registro). */
export const recipesDB = [...HAND_RECIPES, ...FIRE_RECIPES];

/**
 * Acrescenta a forma curta `{ in, out, tools }` usada pelas regras puras
 * (Crafting, RecipeIndex). O objeto continua tendo os campos do registro.
 */
export function normalize(r) {
  return {
    ...r,
    tools: r.tools ?? [],
    in: Object.fromEntries(r.ingredients.map((x) => [x.item, x.amount])),
    out: { [r.output.item]: r.output.amount },
  };
}

/** Todas as receitas, já normalizadas. */
export const ALL_RECIPES = recipesDB.map(normalize);

/** Receitas de uma estação (ex.: 'HANDS' = mesa livre da mochila). */
export function recipesAt(station) {
  return ALL_RECIPES.filter((r) => r.station === station);
}

/** Receitas da mesa livre da mochila (o que o Crafting aceita). */
export const TABLE_RECIPES = recipesAt('HANDS');
