import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FireCooker } from '../../../src/systems/cooking/FireCooker.js';
import { COOKING } from '../../../src/config/hunting.js';
import { FRUITS, MEATS, FOOD_ITEMS, SPECIES_LOOT, nutritionFor, FOOD_TEXT } from '../../../src/config/foods.js';
import { TABLE_RECIPES } from '../../../src/systems/crafting/RecipeRegistry.js';
import { ITEMS } from '../../../src/systems/PlayerState.js';
import { FOODS } from '../../../src/config/survival.js';

const cooker = () => new FireCooker({ recipes: COOKING.recipes, times: COOKING.times, slots: COOKING.slots });

test('fogueira: tempos exatos do pedido (frutas e carnes)', () => {
  const want = {
    frutas_vermelhas: 5, tamara: 5, figo_india: 6, marula: 6, banana_selvagem: 7, manga: 7, coco_fruto: 8,
    carne_ave_crua: 8, carne_coelho_crua: 9, carne_reptil_crua: 9, carne_gazela_crua: 12, carne_javali_crua: 15,
  };
  for (const [id, s] of Object.entries(want)) assert.equal(COOKING.times[id], s, id);
});

test('fogueira: Fome fresca/crua → assada como no pedido', () => {
  const want = {
    frutas_vermelhas: [8, 14], tamara: [10, 16], figo_india: [12, 19], marula: [14, 22], banana_selvagem: [16, 25], manga: [18, 28], coco_fruto: [20, 30],
    carne_ave_crua: [10, 28], carne_coelho_crua: [12, 32], carne_reptil_crua: [12, 32], carne_gazela_crua: [15, 42], carne_javali_crua: [18, 50],
  };
  for (const [id, [raw, done]] of Object.entries(want)) {
    assert.equal(FOOD_ITEMS[id].hunger, raw, id);
    assert.equal(FOOD_ITEMS[FOOD_ITEMS[id].roastsTo].hunger, done, `${id} assado`);
  }
});

test('fogueira: assa um por vez, no tempo exato, e o tempo que sobra passa ao próximo', () => {
  const c = cooker();
  assert.ok(c.put('carne_javali_crua'));
  assert.ok(c.put('frutas_vermelhas'));
  assert.deepEqual(c.update(14.9), []);
  assert.deepEqual(c.update(0.1), ['carne_javali_assada']);
  assert.equal(c.current.raw, 'frutas_vermelhas');
  assert.deepEqual(c.update(5), ['frutas_vermelhas_assadas']);
  assert.deepEqual(c.take(), { carne_javali_assada: 1, frutas_vermelhas_assadas: 1 });
  assert.deepEqual(c.take(), {});
});

test('fogueira: fila limitada e só aceita o que assa', () => {
  const c = cooker();
  assert.equal(c.put('pedra'), false);
  assert.equal(c.put('carne_javali_assada'), false, 'assado não volta ao fogo');
  for (let i = 0; i < COOKING.slots; i++) assert.ok(c.put('manga'));
  assert.equal(c.put('manga'), false);
  assert.equal(c.remove(1), 'manga');
});

test('regra: NENHUMA comida sai da mesa da mochila (só a fogueira cozinha)', () => {
  for (const r of TABLE_RECIPES) {
    for (const id of Object.keys(r.out ?? { [r.output.item]: 1 })) {
      assert.ok(!FOOD_ITEMS[id] && !Object.values(COOKING.recipes).includes(id), `${r.id} faz comida na mesa`);
    }
  }
});

test('itens: toda comida da coleta/caça existe, é comida e a nutrição soma a Fome', () => {
  for (const [id, f] of Object.entries(FOOD_ITEMS)) {
    assert.ok(ITEMS[id]?.food, id);
    assert.equal(ITEMS[id].forage.hunger, f.hunger);
    const n = nutritionFor(f);
    const sum = (n.proteins ?? 0) + (n.carbs ?? 0) + (n.fats ?? 0) + (n.water ?? 0);
    assert.ok(Math.abs(sum - f.hunger) < 1e-9, id);
    assert.ok(FOODS[id], `${id} em FOODS`);
  }
  assert.equal(Object.keys(FRUITS).length, 7);
  assert.equal(Object.keys(MEATS).length, 5);
});

test('caça: cada espécie pedida deixa a SUA carne', () => {
  assert.equal(SPECIES_LOOT.javali.meat, 'carne_javali_crua');
  assert.equal(SPECIES_LOOT.gazela.meat, 'carne_gazela_crua');
  assert.equal(SPECIES_LOOT.coelho.meat, 'carne_coelho_crua');
  assert.equal(SPECIES_LOOT.ave.meat, 'carne_ave_crua');
  assert.equal(SPECIES_LOOT.lagarto.meat, 'carne_reptil_crua');
  for (const [sp, l] of Object.entries(SPECIES_LOOT)) assert.ok(MEATS[l.meat], sp);
});

test('dica: textos fixos em português', () => {
  assert.equal(FOOD_TEXT.cookTime(15), 'Tempo para assar na fogueira: 15 segundos');
  assert.equal(FOOD_TEXT.restores(50), 'Restaura: +50 de Fome');
});
