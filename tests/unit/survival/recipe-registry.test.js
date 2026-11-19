import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recipesDB, ALL_RECIPES, TABLE_RECIPES, STATIONS, CATEGORIES, recipesAt } from '../../../src/systems/crafting/RecipeRegistry.js';
import { ITEM_CATALOG } from '../../../src/config/items.js';
import { COOKING } from '../../../src/config/hunting.js';
import { Crafting } from '../../../src/systems/Crafting.js';
import { RecipeIndex } from '../../../src/systems/RecipeIndex.js';

test('registry_everyEntryHasValidItemsStationCategoryAndTime', () => {
  const ids = new Set();
  for (const r of recipesDB) {
    assert.ok(!ids.has(r.id), `id repetido: ${r.id}`);
    ids.add(r.id);
    assert.ok(ITEM_CATALOG[r.output.item], `${r.id}: saída ${r.output.item} não existe`);
    assert.ok(r.output.amount >= 1, `${r.id}: quantidade de saída`);
    for (const x of [...r.ingredients.map((i) => i.item), ...(r.tools ?? [])]) assert.ok(ITEM_CATALOG[x], `${r.id}: ${x} não existe`);
    assert.ok(STATIONS[r.station], `${r.id}: estação ${r.station}`);
    assert.ok(STATIONS[r.station].built, `${r.id}: estação ${r.station} ainda não existe no mundo`);
    assert.ok(CATEGORIES[r.category], `${r.id}: categoria ${r.category}`);
    assert.ok(Number.isFinite(r.craftTime) && r.craftTime >= 0, `${r.id}: craftTime`);
  }
});

test('normalize_addsShortFormMatchingIngredients', () => {
  const lanca = ALL_RECIPES.find((r) => r.id === 'lanca_pedra');
  assert.deepEqual(lanca.in, { graveto_longo: 1, lamina_pedra: 1, corda: 1 });
  assert.deepEqual(lanca.out, { lanca_pedra: 1 });
  assert.deepEqual(lanca.tools, []);
  assert.equal(lanca.station, 'HANDS');
});

test('campfireRecipes_mirrorCookingConfig_andStayOutOfBackpackTable', () => {
  const fire = recipesAt('CAMPFIRE');
  const expected = Object.entries(COOKING.recipes).filter(([a, b]) => a !== b);
  assert.equal(fire.length, expected.length);
  for (const [raw, cooked] of expected) assert.ok(fire.some((r) => r.in[raw] === 1 && r.out[cooked] === 1), `${raw} → ${cooked}`);
  assert.ok(TABLE_RECIPES.every((r) => r.station === 'HANDS'));
  assert.equal(new Crafting().match(['carne_crua']), null, 'não se assa carne na mochila');
});

test('alternativeRecipes_sameOutputDifferentInputs', () => {
  const idx = new RecipeIndex();
  assert.deepEqual(idx.recipesFor('arco').map((r) => r.id), ['arco', 'arco_tripas']);
  assert.equal(new Crafting().match(['tripas', 'graveto_longo']).id, 'arco_tripas');
  assert.ok(idx.recipesFor('agua_fervida').length >= 2);
});

test('tags_includeKindBiomeStationAndSource', () => {
  const idx = new RecipeIndex();
  assert.ok(idx.tagsOf('arco').includes('arma'));
  assert.ok(idx.tagsOf('noz').includes('taiga'), 'coleta na taiga');
  assert.ok(idx.tagsOf('carne_assada').includes('fogueira'));
  assert.ok(idx.tagsOf('curativo_mel').includes('medicina'));
});

test('search_combinesTagsAndText_withPrefixTags', () => {
  const idx = new RecipeIndex();
  const armas = idx.search('#arma');
  assert.ok(armas.length && armas.every((id) => ITEM_CATALOG[id].kind === 'weapon'));
  assert.deepEqual(idx.search('#medicina mel'), ['cataplasma_antibiotico', 'curativo_mel']); // "mel" no nome ou na descrição
  assert.ok(idx.search('#taiga').includes('noz'));
  assert.ok(idx.search('#rem').includes('curativo_folha'), 'prefixo de tag');
  assert.deepEqual(idx.search('#arma #taiga'), [], 'todas as tags precisam bater');
});

test('catalog_showsEveryItem_withNoHiddenEntries', () => {
  const idx = new RecipeIndex();
  assert.equal(idx.search('').length, Object.keys(ITEM_CATALOG).length);
});
