import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MissionManager, isFoodItem } from '../../../src/systems/missions/MissionManager.js';
import { MissionDirector } from '../../../src/systems/missions/MissionDirector.js';
import { MISSIONS, MISSION_SAVE_KEY } from '../../../src/config/missions.js';

const COLLECT = 'collect_food';
const TARGET = MISSIONS.buscar_comida.targetCount;

test('start cria a missão com todos os campos e currentCount 0', () => {
  const m = new MissionManager();
  const q = m.start('buscar_comida');
  for (const k of ['id', 'title', 'description', 'difficulty', 'objectiveType', 'targetCount', 'currentCount', 'xpReward', 'goldReward']) assert.ok(k in q, k);
  assert.equal(q.currentCount, 0);
  assert.equal(q.difficultyLabel, 'Fácil');
  assert.equal(m.start('buscar_comida'), null, 'não começa duas vezes');
  assert.equal(m.start('nao_existe'), null);
});

test('progress conta só o tipo certo e conclui ao chegar no alvo (sem passar dele)', () => {
  const m = new MissionManager();
  const events = [];
  m.onChange((e) => events.push(e.type));
  m.start('buscar_comida');
  assert.deepEqual(m.progress('outro_tipo', 3), []);
  m.progress(COLLECT, 1);
  assert.equal(m.list()[0].currentCount, 1);
  const done = m.progress(COLLECT, 10);
  assert.equal(done.length, 1);
  assert.equal(done[0].currentCount, TARGET);
  assert.equal(done[0].completed, true);
  assert.ok(m.isCompleted('buscar_comida'));
  assert.equal(m.list().length, 0);
  assert.equal(events.filter((t) => t === 'complete').length, 1);
  assert.deepEqual(m.progress(COLLECT, 1), [], 'depois de concluída não conta mais');
  assert.equal(m.start('buscar_comida'), null, 'concluída não recomeça');
});

test('progress ignora n inválido; complete de missão inativa devolve null', () => {
  const m = new MissionManager();
  m.start('buscar_comida');
  m.progress(COLLECT, 0); m.progress(COLLECT, -2); m.progress(COLLECT, NaN);
  assert.equal(m.list()[0].currentCount, 0);
  assert.equal(m.complete('nao_ativa'), null);
});

test('toJSON/load guarda ativas e concluídas; dados ruins são saneados', () => {
  const a = new MissionManager();
  a.start('buscar_comida');
  a.progress(COLLECT, 3);
  const b = new MissionManager();
  b.load(JSON.parse(JSON.stringify(a.toJSON())));
  assert.equal(b.list()[0].currentCount, 3);
  b.progress(COLLECT, 2);
  assert.deepEqual(b.toJSON(), { active: [], completed: ['buscar_comida'] });
  const c = new MissionManager();
  c.load({ active: [{ id: 'buscar_comida', currentCount: 99 }, { id: 'xyz', currentCount: 1 }, null], completed: ['xyz'] });
  assert.equal(c.list().length, 1);
  assert.equal(c.list()[0].currentCount, TARGET - 1);
  assert.equal(c.isCompleted('xyz'), false);
  c.reset();
  assert.deepEqual(c.toJSON(), { active: [], completed: [] });
});

test('isFoodItem: food:true ou kind food; remédios e materiais não contam', () => {
  assert.equal(isFoodItem({ kind: 'food' }), true);
  assert.equal(isFoodItem({ kind: 'material', food: true }), true);
  assert.equal(isFoodItem({ kind: 'medicine', food: true }), false);
  assert.equal(isFoodItem({ kind: 'material' }), false);
  assert.equal(isFoodItem(undefined), false);
});

// ---- MissionDirector com jogo falso (sem DOM, sem Web Audio) ----
function fakeGame() {
  const listeners = new Map();
  const state = {
    coins: 10,
    on(ev, fn) { (listeners.get(ev) ?? listeners.set(ev, []).get(ev)).push(fn); },
    emit(ev, d) { for (const fn of listeners.get(ev) ?? []) fn(d); },
    addItem(id, n = 1) { this.emit('item-added', { id, n }); },
  };
  const calls = { xp: [], progressSave: 0, sound: 0, banner: [], renders: [] };
  const game = {
    state,
    progress: { progression: { addXp: (n) => calls.xp.push(n) }, save: () => calls.progressSave++ },
    ui: { toast() {} },
  };
  const storage = new Map();
  const deps = {
    items: {
      fruta: { kind: 'food', food: true, forage: { roastsTo: 'fruta_assada' } },
      carne: { food: true, kind: 'food', forage: { roastsTo: 'carne_assada' } },
      assado: { food: true, kind: 'food', forage: { roastedFrom: 'carne' } }, // sai da fogueira: não é coleta
      pedra: { kind: 'material' }, cha: { kind: 'medicine', food: true },
    },
    storage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) },
    tracker: { render: (l) => calls.renders.push(l.map((m) => m.currentCount)), showComplete: (m) => calls.banner.push(m.id), hideBanner() {} },
    sounds: { complete: () => calls.sound++ },
  };
  return { game, calls, storage, deps };
}

test('fim do tutorial começa Buscar Comida; 5 comidas dão +50 XP, +35 moedas, som, banner e save', () => {
  const { game, calls, storage, deps } = fakeGame();
  const d = new MissionDirector(game, deps);
  game.state.addItem('fruta', 2); // antes da missão: não conta
  d.onTutorialDone();
  assert.ok(d.manager.isActive('buscar_comida'));
  game.state.addItem('pedra', 3);
  game.state.addItem('cha', 1);
  game.state.addItem('assado', 2);
  game.cooking = { returning: true };
  game.state.addItem('carne', 1); // cru devolvido pela fila da fogueira: não conta
  game.cooking = null;
  game.state.addItem('fruta', 2);
  game.state.addItem('carne', 1);
  assert.equal(d.manager.list()[0].currentCount, 3);
  assert.equal(game.state.coins, 10);
  game.state.addItem('fruta', 2);
  assert.ok(d.manager.isCompleted('buscar_comida'));
  assert.deepEqual(calls.xp, [50]);
  assert.equal(game.state.coins, 45);
  assert.equal(calls.sound, 1);
  assert.deepEqual(calls.banner, ['buscar_comida']);
  assert.ok(calls.progressSave >= 1);
  assert.deepEqual(JSON.parse(storage.get(MISSION_SAVE_KEY)).completed, ['buscar_comida']);
  d.onTutorialDone();
  assert.equal(d.manager.isActive('buscar_comida'), false, 'não repete depois de concluída');
});

test('save é retomado ao recriar; reset (Novo Jogo) apaga a chave', () => {
  const { game, storage, deps } = fakeGame();
  const d = new MissionDirector(game, deps);
  d.onTutorialDone();
  game.state.addItem('fruta', 2);
  const again = new MissionDirector(fakeGame().game, deps);
  assert.equal(again.manager.list()[0].currentCount, 2);
  again.reset();
  assert.equal(storage.has(MISSION_SAVE_KEY), false);
  assert.equal(again.manager.list().length, 0);
});

test('isForagedFood: só fruta fresca e carne crua da coleta/caça contam para "Buscar Comida"', async () => {
  const { isForagedFood } = await import('../../../src/systems/missions/MissionManager.js');
  const { ITEMS } = await import('../../../src/systems/PlayerState.js');
  assert.equal(isForagedFood(ITEMS.banana_selvagem), true);
  assert.equal(isForagedFood(ITEMS.carne_javali_crua), true);
  assert.equal(isForagedFood(ITEMS.carne_javali_assada), false, 'assado da fogueira não é coleta');
  assert.equal(isForagedFood(ITEMS.banana), false, 'banana de loja/kit não conta');
  assert.equal(isForagedFood(ITEMS.pedra), false);
});

test('corrente: Buscar Comida concluída começa "Craftar uma Adaga de Pedra"; só a adaga feita na mesa conta (+60 XP, +40 ouro)', async () => {
  const { game, calls, deps } = fakeGame();
  deps.items.adaga_pedra = { kind: 'weapon' };
  let crafted = null;
  game.craftFromTable = (ids) => { crafted = ids; game.state.addItem('adaga_pedra', 1); return { ok: true }; };
  const d = new MissionDirector(game, deps);
  d.onTutorialDone();
  game.state.addItem('fruta', 5);
  await Promise.resolve(); // a próxima missão entra num microtask, depois das recompensas
  const m = d.manager.list()[0];
  assert.equal(m?.id, 'craftar_adaga');
  assert.equal(m.difficulty, 'facil');
  game.state.addItem('adaga_pedra', 1); // comprada/achada: não é craft
  assert.equal(d.manager.list()[0].currentCount, 0);
  const r = game.craftFromTable(['pedra', 'pedra', 'graveto']);
  assert.ok(r.ok);
  assert.deepEqual(crafted, ['pedra', 'pedra', 'graveto']);
  assert.ok(d.manager.isCompleted('craftar_adaga'));
  assert.deepEqual(calls.xp, [50, 60]);
  assert.equal(game.state.coins, 10 + 35 + 40);
  assert.deepEqual(calls.banner, ['buscar_comida', 'craftar_adaga']);
});

test('receita: Adaga de Pedra = 2 Pedras + 1 Graveto na mesa da mochila', async () => {
  const { Crafting } = await import('../../../src/systems/Crafting.js');
  const r = new Crafting().match(['pedra', 'graveto', 'pedra']);
  assert.equal(Object.keys(r.out)[0], 'adaga_pedra');
});
