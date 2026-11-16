import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GEAR_CATALOG, PACK_ITEMS, TIERS, TIER_IDS, MELEE, ARROWS, BOW, FIREARMS, AMMO, CONSUMABLES, RELICS, COFFEE, STACK, BACKPACK,
  SHOP_ARSENAL, SHOP_PROVISIONS, ECONOMY, EXTRACTION, CRAFTABLE_IDS,
} from '../../../src/config/gear.js';
import { EquipmentStore, MeleeSwing, Firearm, BowDraw, hitDamage } from '../../../src/systems/gear/Equipment.js';
import { Consumption, SurvivalNeeds } from '../../../src/systems/gear/Consumption.js';
import { slotsUsed, hasRoom, ShopStock, buy, Extraction } from '../../../src/systems/gear/Trade.js';
import { snapshot, sanitize } from '../../../src/systems/gear/GearSave.js';
import { ITEM_CATALOG } from '../../../src/config/items.js';
import { ALL_RECIPES } from '../../../src/systems/crafting/RecipeRegistry.js';
import { STATUS_EFFECTS } from '../../../src/config/gameplay.js';
import { PlayerState } from '../../../src/systems/PlayerState.js';
import { RESOURCES } from '../../../src/config/resources.js';
import { SKINNING } from '../../../src/config/hunting.js';

/** Mochila de teste: contagens por id. */
function bag(items = {}) {
  const m = new Map(Object.entries(items));
  return { m, count: (id) => m.get(id) ?? 0, take: (id, n) => { const c = (m.get(id) ?? 0) - n; assert.ok(c >= 0, 'tirou mais do que havia'); if (c) m.set(id, c); else m.delete(id); } };
}
function needs({ hunger = 50, stamina = 50 } = {}) {
  return {
    hunger, stamina,
    get hungerFull() { return this.hunger >= 100; },
    get staminaFull() { return this.stamina >= 100; },
    addHunger(n) { this.hunger = Math.min(100, this.hunger + n); },
    addStamina(n) { this.stamina = Math.min(100, this.stamina + n); },
  };
}

// ---------------------------------------------------------------- catálogo

test('pacote_34ItensOriginais_todosCadastrados', () => {
  assert.equal(Object.keys(PACK_ITEMS).length, 34);
  for (const [base, ids] of Object.entries(PACK_ITEMS)) for (const id of ids) assert.ok(GEAR_CATALOG[id], `${base}: ${id} sem cadastro`);
  // variantes de material identificadas à parte: 4 itens × 3 níveis + 3 flechas
  for (const base of ['adaga', 'espada', 'machado', 'picareta', 'flecha']) assert.equal(PACK_ITEMS[base].length, 3, base);
});

test('catalogo_camposCentralizados_presentesEmTodoItem', () => {
  const fields = ['id', 'name', 'description', 'category', 'materialTier', 'icon', 'image', 'model', 'damage', 'durabilityMax',
    'hungerRestore', 'staminaRestore', 'useDuration', 'stackLimit', 'acquisition', 'craftable', 'effects'];
  for (const [id, d] of Object.entries(GEAR_CATALOG)) {
    for (const f of fields) assert.ok(f in d, `${id}: falta ${f}`);
    assert.match(id, /^[a-z0-9_]+$/, `${id}: id com espaço/acento`);
    assert.equal(ITEM_CATALOG[id]?.gear, true, `${id} não entrou no catálogo do jogo`);
    assert.equal(d.craftable, CRAFTABLE_IDS.includes(id), `${id}: craftable`);
  }
});

test('receitas_soArcoFlechaDePedraEFlechaDeMadeiraSaoFabricaveis', () => {
  const made = new Set(ALL_RECIPES.flatMap((r) => Object.keys(r.out)));
  const used = new Set(ALL_RECIPES.flatMap((r) => [...Object.keys(r.in), ...r.tools]));
  assert.deepEqual(CRAFTABLE_IDS, ['arco', 'flecha', 'flecha_madeira']);
  for (const id of CRAFTABLE_IDS) assert.ok(made.has(id), `${id} deveria ter receita`);
  assert.deepEqual(ALL_RECIPES.filter((r) => r.out.flecha).map((r) => r.out.flecha), [3], 'a receita rende 3 flechas de pedra');
  for (const [id, d] of Object.entries(GEAR_CATALOG)) {
    if (CRAFTABLE_IDS.includes(id)) continue;
    if (d.equipment || d.kind === 'ammo' || d.kind === 'relic' || id === 'drogas') assert.ok(!made.has(id), `${id} tem receita`);
    if (d.kind === 'relic' || d.equipment) assert.ok(!used.has(id), `${id} é ingrediente`);
  }
});

test('armasEReliquias_semDropNemSpawnNatural', () => {
  const natural = new Set([...Object.values(RESOURCES.types).flatMap((t) => [t.item, t.also]), ...Object.values(SKINNING.loot).flatMap((l) => Object.keys(l))]);
  for (const [id, d] of Object.entries(GEAR_CATALOG)) if (d.equipment || d.kind === 'ammo' || d.kind === 'relic') assert.ok(!natural.has(id), `${id} nasce no mundo`);
});

test('reliquias_soCadastro_semVendaSemPoder', () => {
  const sold = new Set([...SHOP_ARSENAL, ...SHOP_PROVISIONS].flatMap((s) => s.ids));
  assert.equal(Object.keys(RELICS).length, 7);
  for (const id of Object.keys(RELICS)) {
    const d = GEAR_CATALOG[id];
    assert.equal(d.damage, 0); assert.equal(d.durabilityMax, null); assert.deepEqual(d.effects, []);
    assert.equal(d.unique, true); assert.equal(d.acquisition, 'exploration');
    assert.equal(d.biomeId, null); assert.equal(d.originCultureId, null); // associação ainda não definida
    assert.ok(!d.price && !sold.has(id), `${id} à venda`);
    assert.ok(!d.equipment && !d.consumable);
  }
});

test('lojas_armasSoNoFerreiro_tudoComPreco', () => {
  const arsenal = SHOP_ARSENAL.flatMap((s) => s.ids), prov = SHOP_PROVISIONS.flatMap((s) => s.ids);
  for (const [id, d] of Object.entries(GEAR_CATALOG)) {
    if (d.equipment || d.kind === 'ammo') { assert.ok(arsenal.includes(id), `${id} fora do ferreiro`); assert.ok(!prov.includes(id)); }
  }
  for (const id of [...arsenal, ...prov]) assert.ok(GEAR_CATALOG[id].price > 0, `${id} sem preço`);
  assert.equal(ECONOMY.balancePending, true);
});

test('drogas_cadastradaSemUso', () => {
  const d = GEAR_CATALOG.drogas;
  assert.equal(d.name, 'Drogas');
  assert.equal(d.description, 'Cápsulas de efeito ainda não definido.');
  assert.equal(d.damage, 0); assert.equal(d.consumable, false); assert.equal(d.stackLimit, 20);
  const c = new Consumption({ stock: bag({ drogas: 3 }), needs: needs() });
  assert.deepEqual(c.start('drogas'), { ok: false, reason: 'disabled' });
});

// ---------------------------------------------------------------- dano e durabilidade

test('niveis_pedraMenorQueOuroMenorQueMetal_dentroDosTetos', () => {
  const table = { adaga: [[6, 12, 18], [60, 180, 420]], espada: [[10, 20, 30], [80, 240, 560]], machado: [[8, 16, 24], [70, 210, 490]], picareta: [[4, 8, 12], [90, 270, 630]] };
  for (const [base, [dmg, dur]] of Object.entries(table)) {
    TIER_IDS.forEach((tier, i) => {
      const d = GEAR_CATALOG[`${base}_${tier}`];
      assert.equal(d.damage, dmg[i], `${base} ${tier} dano`);
      assert.equal(d.durabilityMax, dur[i], `${base} ${tier} durabilidade`);
      assert.ok(hitDamage(d) <= TIERS[tier].damageCap);
      if (i) assert.ok(d.damage > GEAR_CATALOG[`${base}_${TIER_IDS[i - 1]}`].damage && d.durabilityMax > GEAR_CATALOG[`${base}_${TIER_IDS[i - 1]}`].durabilityMax);
    });
  }
  assert.deepEqual([MELEE.adaga.interval, MELEE.espada.interval, MELEE.machado.interval, MELEE.picareta.interval], [0.45, 0.9, 1.0, 1.1]);
  assert.deepEqual(ARROWS.ids.map((id) => GEAR_CATALOG[id].damage), [8, 16, 24]);
  assert.deepEqual([TIERS.pedra.damageCap, TIERS.ouro.damageCap, TIERS.metal.damageCap], [10, 20, 30]);
  for (const d of Object.values(GEAR_CATALOG)) assert.ok(d.damage <= 30, `${d.id} passa do teto`);
});

test('ferramentas_eficienciaSoNaExtracao_armasSemBonus', () => {
  for (const base of ['machado', 'picareta']) assert.deepEqual(TIER_IDS.map((t) => GEAR_CATALOG[`${base}_${t}`].gatherEfficiency), [1, 1.5, 2]);
  assert.equal(GEAR_CATALOG.machado_metal.gather, 'wood'); assert.equal(GEAR_CATALOG.picareta_metal.gather, 'stone');
  for (const id of ['adaga_metal', 'espada_metal', 'arco', 'pistola', 'rifle']) assert.equal(GEAR_CATALOG[id].gather ?? null, null);
  // eficiência não mexe no dano
  assert.equal(hitDamage(GEAR_CATALOG.machado_metal), 24);
});

test('extracao_eficienciaMultiplicaProgresso', () => {
  const ex = new Extraction(), tree = {};
  const hits = (eff) => { let n = 0, r; do { r = ex.hit(tree, 'wood', eff, 0); n++; } while (!r.done); return [n, r.yield]; };
  assert.deepEqual(hits(1), [4, EXTRACTION.wood.yield]);
  assert.equal(hits(1.5)[0], 3);
  assert.equal(hits(2)[0], 2);
  assert.equal(ex.kindOfTag('trunk'), 'wood'); assert.equal(ex.kindOfTag('boulder'), 'stone'); assert.equal(ex.kindOfTag('hut'), null);
});

test('durabilidade_gastaPorUso_quebraEmZero_avisaAbaixoDe20', () => {
  const store = new EquipmentStore(), a = store.create('adaga_pedra');
  assert.equal(a.durability, 60);
  for (let i = 0; i < 48; i++) store.wear(a);
  assert.equal(a.durability, 12); assert.equal(store.isLow(a), false); // 20% exato ainda não avisa
  store.wear(a);
  assert.equal(store.isLow(a), true);
  for (let i = 0; i < 10; i++) store.wear(a);
  assert.deepEqual(store.wear(a), { broke: true });
  assert.equal(a.durability, 0); assert.ok(store.isBroken(a));
  assert.deepEqual(store.wear(a), { broke: false }); assert.equal(a.durability, 0);
});

test('golpe_respeitaIntervalo_impactoUmaVezPorGolpe', () => {
  const s = new MeleeSwing();
  assert.ok(s.start(10, 'espada'));
  assert.equal(s.start(10.5, 'espada'), false, 'antes de 0,90 s não ataca de novo');
  let impacts = 0;
  for (let t = 10; t < 10.9; t += 1 / 60) if (s.update(t)) impacts++;
  assert.equal(impacts, 1);
  assert.ok(s.start(10.9, 'espada'));
  s.cancel();
  assert.equal(s.update(12), false, 'golpe cancelado não acerta');
});

// ---------------------------------------------------------------- armas de fogo

test('armasDeFogo_valoresDaTabela', () => {
  const p = GEAR_CATALOG.pistola, r = GEAR_CATALOG.rifle;
  assert.deepEqual([p.damage, p.magazine, p.reloadSeconds, p.attackInterval, p.durabilityMax], [22, 16, 1.8, 0.3, 600]);
  assert.deepEqual([r.damage, r.magazine, r.reloadSeconds, r.attackInterval, r.durabilityMax], [30, 20, 2.6, 0.5, 900]);
  assert.equal(AMMO.municao_pistola.pack, 16); assert.equal(AMMO.municao_rifle.pack, 20);
  assert.notEqual(FIREARMS.pistola.ammo, FIREARMS.rifle.ammo);
  assert.equal(GEAR_CATALOG.municao_pistola.damage, 0, 'munição não soma dano');
});

test('armaComprada_chegaDescarregadaEComDurabilidadeCheia', () => {
  const store = new EquipmentStore(), g = store.create('rifle');
  assert.equal(g.mag, 0); assert.equal(g.durability, 900);
});

test('recarga_transfereMinimo_conservaTotal_nuncaPassaDaCapacidade', () => {
  for (const [id, cap] of [['pistola', 16], ['rifle', 20]]) {
    const store = new EquipmentStore(), g = store.create(id), ammo = FIREARMS[id].ammo;
    const r = bag({ [ammo]: 50 }), fa = new Firearm(store, r);
    const total = () => g.mag + r.count(ammo);
    assert.deepEqual(fa.startReload(g), { ok: true });
    assert.equal(fa.update(FIREARMS[id].reload - 0.01, g), null); assert.equal(g.mag, 0, 'nada antes de concluir');
    assert.deepEqual(fa.update(0.02, g), { reloaded: cap });
    assert.equal(g.mag, cap); assert.equal(total(), 50);
    assert.deepEqual(fa.startReload(g), { ok: false, reason: 'full' });
    // gasta 5, recarrega: transfere exatamente 5
    let t = 0;
    for (let i = 0; i < 5; i++) { assert.ok(fa.fire(g, t).ok); t += 1; }
    assert.equal(total(), 45);
    fa.startReload(g); assert.deepEqual(fa.update(10, g), { reloaded: 5 });
    assert.equal(g.mag, cap); assert.equal(total(), 45);
  }
});

test('recarga_reservaMenorQueOEspaco_transfereSoOQueHa', () => {
  const store = new EquipmentStore(), g = store.create('pistola'), r = bag({ municao_pistola: 3 }), fa = new Firearm(store, r);
  fa.startReload(g);
  assert.deepEqual(fa.update(2, g), { reloaded: 3 });
  assert.equal(g.mag, 3); assert.equal(r.count('municao_pistola'), 0);
  assert.deepEqual(fa.startReload(g), { ok: false, reason: 'no-reserve' });
});

test('recarga_cancelada_naoTransfereNemPerde', () => {
  const store = new EquipmentStore(), g = store.create('pistola'), r = bag({ municao_pistola: 16 }), fa = new Firearm(store, r);
  fa.startReload(g); fa.update(1.0, g);
  assert.equal(fa.cancelReload(), true);
  assert.equal(fa.update(5, g), null);
  assert.equal(g.mag, 0); assert.equal(r.count('municao_pistola'), 16);
  // trocar de arma no meio também cancela
  fa.startReload(g);
  assert.equal(fa.update(5, store.create('rifle')), null);
  assert.equal(g.mag, 0); assert.equal(r.count('municao_pistola'), 16);
});

test('tiro_bloqueadoNaRecarga_semBalaNaoAtira_umPorIntervalo_municaoErradaNaoServe', () => {
  const store = new EquipmentStore(), g = store.create('pistola'), r = bag({ municao_pistola: 20, municao_rifle: 40 }), fa = new Firearm(store, r);
  assert.deepEqual(fa.fire(g, 0), { ok: false, reason: 'empty' });
  fa.startReload(g);
  assert.deepEqual(fa.fire(g, 0), { ok: false, reason: 'reloading' });
  fa.update(2, g);
  assert.equal(r.count('municao_rifle'), 40, 'munição de rifle intocada');
  const shot = fa.fire(g, 10);
  assert.equal(shot.ok, true); assert.equal(shot.damage, 22);
  assert.deepEqual(fa.fire(g, 10.2), { ok: false, reason: 'cooldown' });
  assert.ok(fa.fire(g, 10.3).ok);
  assert.equal(g.mag, 14); assert.equal(g.durability, 598, '1 de durabilidade por disparo');
  // pistola só com munição de rifle na mochila: não recarrega
  const g2 = store.create('pistola'), fa2 = new Firearm(store, bag({ municao_rifle: 40 }));
  assert.deepEqual(fa2.startReload(g2), { ok: false, reason: 'no-reserve' });
});

test('armaQuebrada_naoAtiraNemRecarrega', () => {
  const store = new EquipmentStore(), g = store.create('pistola'), fa = new Firearm(store, bag({ municao_pistola: 16 }));
  g.durability = 0; g.mag = 5;
  assert.deepEqual(fa.fire(g, 0), { ok: false, reason: 'broken' });
  assert.deepEqual(fa.startReload(g), { ok: false, reason: 'broken' });
});

// ---------------------------------------------------------------- arco

test('arco_1sDePreparo_danoSoDaFlecha_gastaUmaPorDisparo', () => {
  assert.equal(BOW.draw, 1); assert.equal(BOW.durability, 240); assert.equal(GEAR_CATALOG.arco.damage, 0); assert.equal(BOW.recoverArrows, false);
  const store = new EquipmentStore(), bow = store.create('arco');
  for (const [arrow, dmg] of [['flecha', 8], ['flecha_ouro', 16], ['flecha_metal', 24]]) {
    const r = bag({ [arrow]: 2 }), b = new BowDraw(store, r);
    assert.equal(b.start(bow).ok, true);
    assert.equal(b.update(0.99, bow), null); assert.equal(r.count(arrow), 2, 'flecha só sai no disparo');
    const shot = b.update(0.02, bow);
    assert.equal(shot.damage, dmg, 'sem somar dano do arco'); assert.equal(r.count(arrow), 1);
  }
  assert.equal(bow.durability, 237);
});

test('arco_cancelarOuSemFlecha_naoGastaNada', () => {
  const store = new EquipmentStore(), bow = store.create('arco');
  const empty = new BowDraw(store, bag());
  assert.deepEqual(empty.start(bow), { ok: false, reason: 'no-arrow' });
  const r = bag({ flecha: 1, flecha_metal: 1 }), b = new BowDraw(store, r);
  b.start(bow); b.update(0.5, bow);
  assert.equal(b.cancel(), true);
  assert.equal(b.update(5, bow), null);
  assert.equal(r.count('flecha'), 1); assert.equal(bow.durability, 240);
  assert.equal(b.arrow(), 'flecha'); assert.equal(b.cycle(), 'flecha_metal'); assert.equal(b.arrow(), 'flecha_metal');
});

// ---------------------------------------------------------------- comida, água, café

test('alimentos_valoresDaTabela_maiorPorcaoRecuperaMais', () => {
  const expected = { biscoito: [5, 1], tomate: [7, 1], cenoura: [8, 1], uva: [10, 1.2], maca: [12, 1.2], banana: [15, 1.2], milho: [20, 1.5], queijo: [22, 1.5], pao: [28, 1.8], hamburguer: [45, 2.5] };
  for (const [id, [hunger, time]] of Object.entries(expected)) {
    const d = GEAR_CATALOG[id];
    assert.deepEqual([d.hungerRestore, d.staminaRestore, d.useDuration, d.damage, d.durabilityMax, d.stackLimit], [hunger, 0, time, 0, null, 20], id);
  }
  const order = Object.keys(expected).map((id) => GEAR_CATALOG[id].hungerRestore);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.deepEqual([GEAR_CATALOG.agua.hungerRestore, GEAR_CATALOG.agua.staminaRestore, GEAR_CATALOG.agua.useDuration, GEAR_CATALOG.agua.stackLimit], [0, 40, 1.5, 10]);
  assert.deepEqual([GEAR_CATALOG.cafe.hungerRestore, GEAR_CATALOG.cafe.staminaRestore, GEAR_CATALOG.cafe.useDuration, GEAR_CATALOG.cafe.stackLimit], [0, 0, 1.5, 10]);
  assert.equal(Object.keys(CONSUMABLES).length, 12);
});

test('consumo_efeitoEGastoSoAoTerminar_semDuplicar', () => {
  const stock = bag({ pao: 2 }), n = needs({ hunger: 40 }), c = new Consumption({ stock, needs: n });
  assert.deepEqual(c.start('pao'), { ok: true });
  assert.deepEqual(c.start('pao'), { ok: false, reason: 'busy' }, 'clicar de novo não empilha');
  assert.equal(c.update(1.79), null);
  assert.equal(stock.count('pao'), 2); assert.equal(n.hunger, 40);
  const r = c.update(0.02);
  assert.equal(r.done, true); assert.equal(r.hunger, 28);
  assert.equal(stock.count('pao'), 1); assert.equal(n.hunger, 68);
  assert.equal(c.update(5), null, 'não aplica de novo');
  assert.equal(n.hunger, 68);
});

test('consumo_cancelado_naoGastaNemDaEfeito', () => {
  const stock = bag({ hamburguer: 1 }), n = needs({ hunger: 10 }), c = new Consumption({ stock, needs: n });
  c.start('hamburguer'); c.update(2.4);
  assert.equal(c.cancel(), 'hamburguer');
  assert.equal(c.update(5), null);
  assert.equal(stock.count('hamburguer'), 1); assert.equal(n.hunger, 10);
});

test('consumo_nuncaPassaDe100_eBloqueiaComAtributoCheio', () => {
  const stock = bag({ hamburguer: 2, agua: 2 }), n = needs({ hunger: 80, stamina: 90 }), c = new Consumption({ stock, needs: n });
  c.start('hamburguer'); c.update(3);
  assert.equal(n.hunger, 100);
  assert.deepEqual(c.start('hamburguer'), { ok: false, reason: 'hunger-full' });
  assert.equal(stock.count('hamburguer'), 1);
  c.start('agua'); c.update(2);
  assert.equal(n.stamina, 100);
  assert.deepEqual(c.start('agua'), { ok: false, reason: 'stamina-full' });
  assert.equal(stock.count('agua'), 1);
});

test('consumo_itemSumiuNoMeio_semEfeito', () => {
  const stock = bag({ maca: 1 }), n = needs({ hunger: 10 }), c = new Consumption({ stock, needs: n });
  c.start('maca'); stock.take('maca', 1);
  assert.deepEqual(c.update(2), { done: false, lost: true, id: 'maca' });
  assert.equal(n.hunger, 10);
});

test('fomeDoJogo_mediaDasTresBarras_presaEm100', () => {
  const survival = { nutrition: { values: { proteins: 40, carbs: 95, fats: 60, water: 20 } }, stamina: 30, staminaMax: 82, exhausted: false };
  const n = new SurvivalNeeds(survival);
  assert.equal(n.hunger, 65);
  n.addHunger(15);
  assert.deepEqual(survival.nutrition.values, { proteins: 55, carbs: 100, fats: 75, water: 20 });
  n.addStamina(80);
  assert.equal(survival.stamina, 82, 'respeita o teto de hoje'); assert.ok(n.staminaFull);
});

test('cafe_25PorCento_10s_naoAcumula_reiniciaDuracao', () => {
  assert.equal(COFFEE.speedMultiplier, 1.25); assert.equal(COFFEE.seconds, 10);
  assert.equal(STATUS_EFFECTS.cafe.duration, 10);
  assert.deepEqual(STATUS_EFFECTS.cafe.modifiers, { speed: 1.25 }, 'só velocidade de movimento');
  const state = new PlayerState();
  const stock = bag({ cafe: 3 }), c = new Consumption({ stock, needs: needs({ hunger: 100, stamina: 100 }), applyEffect: (id) => state.addEffect(id) });
  assert.equal(c.start('cafe').ok, true, 'café pode com barras cheias');
  c.update(1.5);
  assert.equal(state.modifier('speed'), 1.25); assert.equal(state.modifier('jump'), 1);
  state.update(6);
  c.start('cafe'); c.update(1.5);
  assert.equal(state.effects.filter((e) => e.id === 'cafe').length, 1);
  assert.equal(state.modifier('speed'), 1.25, 'não empilha multiplicador');
  assert.equal(state.effects[0].remaining, 10, 'outra caneca reinicia para 10 s');
  state.update(9.99); assert.equal(state.modifier('speed'), 1.25);
  state.update(0.02); assert.equal(state.modifier('speed'), 1);
  assert.equal(stock.count('cafe'), 1);
});

test('cafe_terminar_removeSoOModificadorDoCafe', () => {
  const state = new PlayerState();
  state.addEffect('febre_mendigo'); state.addEffect('cafe');
  assert.equal(state.modifier('speed'), 0.8 * 1.25);
  state.update(10.1);
  assert.equal(state.modifier('speed'), 0.8); assert.ok(state.hasEffect('febre_mendigo'));
});

// ---------------------------------------------------------------- mochila, lojas, save

test('empilhamento_limitesPorCategoria', () => {
  assert.deepEqual(STACK, { equipment: 1, relic: 1, food: 20, drink: 10, resource: 100, ammo: 100, capsule: 20, legacy: 100 });
  for (const id of ['pedra', 'graveto', 'barra_metal', 'barra_ouro', 'flecha', 'flecha_metal', 'municao_pistola', 'municao_rifle']) assert.equal(GEAR_CATALOG[id].stackLimit, 100, id);
  for (const id of ['espada_metal', 'arco', 'rifle', 'reliquia_coroa']) assert.equal(GEAR_CATALOG[id].stackLimit, 1, id);
  assert.equal(slotsUsed(new Map([['pao', 21], ['agua', 10], ['municao_rifle', 101]]), 2), 2 + 1 + 2 + 2);
  const full = new Map([['pao', 20 * BACKPACK.slots]]);
  assert.equal(hasRoom('pao', 1, full), false);
  assert.equal(hasRoom('espada_metal', 1, full), false);
  const almost = new Map([['pao', 20 * (BACKPACK.slots - 1) + 5]]);
  assert.equal(hasRoom('pao', 15, almost), true, 'completa a pilha aberta');
  assert.equal(hasRoom('pao', 16, almost), false);
});

function shopCtx(coins = 1000) {
  const state = new PlayerState(); state.coins = coins;
  return { state, store: new EquipmentStore(), stock: new ShopStock() };
}

test('compra_validaSaldoEstoqueEspaco_antesDeCobrar', () => {
  const sec = SHOP_ARSENAL[3], { state, store, stock } = shopCtx(400);
  const go = (id, extra = {}) => buy({ id, vendor: 'v:ferreiro', section: sec, hours: 0, wallet: state, store, stock, equipmentInBag: store.list().length, ...extra });
  const r = go('pistola');
  assert.equal(r.ok, true); assert.equal(state.coins, 80); assert.equal(r.instance.mag, 0);
  assert.deepEqual([go('pistola').reason, state.coins], ['stock', 80], 'sem estoque não cobra');
  assert.deepEqual([go('rifle').reason, state.coins], ['coins', 80], 'sem saldo não cobra');
  const a = go('municao_pistola');
  assert.equal(a.amount, 16); assert.equal(state.inventory.get('municao_pistola'), 16); assert.equal(state.coins, 32);
  state.coins = 1000;
  assert.deepEqual([go('rifle', { equipmentInBag: BACKPACK.slots }).reason, state.coins], ['space', 1000], 'mochila cheia não cobra');
  assert.equal(store.list().length, 1);
  // reposição depois de 24 h de jogo
  assert.equal(go('pistola', { hours: ECONOMY.restockHours }).ok, true);
});

test('compra_reliquiaECapsulas_naoSaoVendidas', () => {
  const { state, store, stock } = shopCtx();
  for (const id of ['reliquia_espada', 'drogas']) {
    const r = buy({ id, vendor: 'v', section: SHOP_PROVISIONS[0], hours: 0, wallet: state, store, stock, equipmentInBag: 0 });
    assert.equal(r.reason, 'not-for-sale'); assert.equal(state.coins, 1000);
  }
});

test('save_idaEVolta_preservaDurabilidadeMunicaoEfeitos', () => {
  const store = new EquipmentStore(), gun = store.create('pistola'), axe = store.create('machado_ouro');
  gun.mag = 7; gun.durability = 411; axe.durability = 3;
  const stock = new ShopStock(); stock.take('v:ferreiro', 'pistola', 5);
  const data = JSON.parse(JSON.stringify(snapshot({
    coins: 77, inventory: new Map([['municao_pistola', 25], ['pao', 4]]),
    hotbar: [{ id: 'pistola', uid: gun.uid }, { id: 'pao', ref: true }, null], selected: 1,
    equipment: store.serialize(), effects: [{ id: 'cafe', remaining: 4.25 }], shops: stock.serialize(), arrow: 'flecha_ouro',
  })));
  const rules = { isItem: (id) => !!ITEM_CATALOG[id], isEffect: (id) => !!STATUS_EFFECTS[id], isEquipment: (id) => !!GEAR_CATALOG[id]?.equipment, slots: 3 };
  const s = sanitize(data, rules);
  const store2 = new EquipmentStore(); store2.load(s.equipment);
  assert.deepEqual(store2.get(gun.uid), { uid: gun.uid, id: 'pistola', durability: 411, mag: 7 });
  assert.equal(store2.get(axe.uid).durability, 3);
  assert.equal(s.coins, 77); assert.equal(s.inventory.get('municao_pistola'), 25); assert.equal(s.selected, 1);
  assert.deepEqual(s.effects, [{ id: 'cafe', remaining: 4.25 }]); assert.equal(s.arrow, 'flecha_ouro');
  // carregar de novo SUBSTITUI: nada duplica
  store2.load(s.equipment);
  assert.equal(store2.list().length, 2);
  assert.notEqual(store2.create('rifle').uid, gun.uid);
});

test('save_adulterado_naoDuplicaNemEstouraLimites', () => {
  const rules = { isItem: (id) => !!ITEM_CATALOG[id], isEffect: (id) => !!STATUS_EFFECTS[id], isEquipment: (id) => !!GEAR_CATALOG[id]?.equipment, slots: 4 };
  const s = sanitize({
    v: 1, coins: -50,
    inventory: [['pao', 2.9], ['item_falso', 9], ['pao', 1], ['pistola', 3], ['agua', -4]],
    hotbar: [{ id: 'pistola', uid: 'e1' }, { id: 'pistola', uid: 'e1' }, { id: 'rifle', uid: 'e99' }, { id: 'rifle' }],
    selected: 12,
    equipment: { list: [{ uid: 'e1', id: 'pistola', durability: 99999, mag: 99 }, { uid: 'e1', id: 'rifle', durability: 5, mag: 5 }, { uid: 'e2', id: 'nada', durability: 1 }] },
    effects: [{ id: 'cafe', remaining: -1 }, { id: 'inventado', remaining: 5 }],
  }, rules);
  assert.equal(s.coins, 0); assert.equal(s.selected, 0);
  assert.deepEqual([...s.inventory], [['pao', 3]], 'equipamento não vira pilha');
  assert.deepEqual(s.hotbar.map((x) => x?.uid ?? null), ['e1', null, null, null], 'a mesma arma não ocupa dois slots');
  assert.deepEqual(s.effects, []);
  const store = new EquipmentStore(); store.load(s.equipment);
  assert.deepEqual(store.list(), [{ uid: 'e1', id: 'pistola', durability: 600, mag: 16 }]);
  assert.equal(sanitize({ v: 999 }, rules), null);
  assert.equal(sanitize(null, rules), null);
});

test('flechaDeMadeira_soGraveto_maisFracaQueAsOutras_eArcoUsaPorUltimo', async () => {
  const { WOOD_ARROW } = await import('../../../src/config/gear.js');
  const { Crafting } = await import('../../../src/systems/Crafting.js');
  const r = ALL_RECIPES.find((x) => x.out.flecha_madeira);
  assert.deepEqual(r.in, { graveto: 1 }, 'só um graveto, nada além de madeira');
  assert.deepEqual(r.tools, []);
  assert.equal(new Crafting().match(['graveto'])?.id, 'flecha_madeira', 'um graveto na mesa vira a flecha de madeira');
  const d = GEAR_CATALOG[WOOD_ARROW.id];
  assert.equal(d.kind, 'ammo');
  for (const id of ARROWS.ids) assert.ok(d.damage < GEAR_CATALOG[id].damage, `mais fraca que ${id}`);
  assert.equal(BOW.ammo.at(-1), WOOD_ARROW.id, 'por padrão o arco gasta as melhores primeiro');
  assert.deepEqual(ARROWS.ids, ['flecha', 'flecha_ouro', 'flecha_metal'], 'os níveis de material não mudaram');
});
