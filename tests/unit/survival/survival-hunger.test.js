import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Survival } from '../../../src/systems/Survival.js';
import { Bag } from '../../../src/systems/Bag.js';
import { Landfall, canMakeLandfall, formatClock, findShoreX } from '../../../src/systems/Landfall.js';
import { SaveGame } from '../../../src/systems/SaveGame.js';

const CFG = { baseStamina: 100, staminaSprintDrain: 20, staminaRegen: 10, staminaRegenDelay: 1, staminaMinToSprint: 10,
  maxHunger: 100, hungerDrain: 1, hungerSprintMultiplier: 2, starveDamagePerSecond: 2 };
const run = (s, secs, st) => { let dmg = 0; for (let t = 0; t < secs - 1e-9; t += 0.5) dmg += s.update(0.5, st).starve; return dmg; };

test('estamina: correr esgota, exaustão bloqueia até recuperar o mínimo', () => {
  const s = new Survival(CFG);
  run(s, 5, { sprinting: true });
  assert.equal(s.stamina, 0);
  assert.equal(s.canSprint, false);
  run(s, 1, { sprinting: false }); // regen começa após 1 s: 5
  assert.equal(s.stamina, 5);
  assert.equal(s.canSprint, false);
  run(s, 1, {});
  assert.equal(s.stamina, 15);
  assert.equal(s.canSprint, true);
});

test('fome: cai com o tempo, mais rápido correndo; em 0 drena vida; comer recupera', () => {
  const s = new Survival(CFG);
  run(s, 10, {});
  assert.equal(s.hunger, 90);
  run(s, 10, { sprinting: true });
  assert.equal(s.hunger, 70);
  run(s, 10, { active: false });
  assert.equal(s.hunger, 70, 'pausada no prólogo/menus');
  run(s, 70, {});
  assert.equal(s.hunger, 0);
  assert.equal(run(s, 2, {}), 4);
  assert.equal(s.eat(40), 40);
  assert.equal(s.eat(100), 60, 'não passa do máximo');
});

test('mochila: craft consome materiais e produz fogueira', () => {
  const bag = new Bag();
  assert.equal(bag.craft('fogueira'), false);
  bag.add('madeira', 3); bag.add('pedra', 2);
  assert.equal(bag.canCraft('fogueira'), true);
  assert.equal(bag.craft('fogueira'), true);
  assert.equal(bag.count('fogueira'), 1);
  assert.equal(bag.count('madeira'), 0);
  assert.equal(bag.remove('pedra'), false);
  assert.throws(() => bag.add('xyz'));
});

test('chegada: cronômetro de 10 min, para ao pisar em terra e a tempestade some', () => {
  const lf = new Landfall({ drownSeconds: 600, clearSeconds: 4 });
  assert.equal(lf.update(100, { onLand: false }), null);
  assert.equal(lf.timeLeft, 500);
  assert.equal(lf.update(1, { onLand: true }), 'landed');
  assert.equal(lf.timeLeft, 500, 'cronômetro parado');
  assert.equal(lf.storm, 1);
  lf.update(2, { onLand: true });
  assert.equal(lf.storm, 0.5);
  assert.equal(lf.update(2, { onLand: true }), 'cleared');
  assert.equal(lf.storm, 0);
  const lf2 = new Landfall({ drownSeconds: 10, clearSeconds: 1 });
  assert.equal(lf2.update(10, { onLand: false }), 'drowned');
});

test('chegada: do oceano só se pisa em terra no deserto', () => {
  const cfg = { oceanBand: 500, desertThreshold: 0.6 };
  assert.equal(canMakeLandfall({ edgeDistance: 100, desertWeight: 0.9 }, cfg), true);
  assert.equal(canMakeLandfall({ edgeDistance: 100, desertWeight: 0.2 }, cfg), false);
  assert.equal(canMakeLandfall({ edgeDistance: 900, desertWeight: 0 }, cfg), true, 'lago/rios no interior');
  assert.equal(formatClock(600), '10:00');
  assert.equal(formatClock(59.2), '01:00');
  assert.equal(findShoreX((x) => (x < 50 ? 1 : -5), 0, { fromX: 100, toX: 0, step: 1 }), 49);
});

test('checkpoint: grava/lê e tolera armazenamento quebrado', () => {
  const mem = new Map();
  const store = { setItem: (k, v) => mem.set(k, v), getItem: (k) => mem.get(k) ?? null, removeItem: (k) => mem.delete(k) };
  const s = new SaveGame(store, 'k');
  assert.equal(s.read(), null);
  assert.equal(s.write({ prologueDone: true }), true);
  assert.equal(s.read().prologueDone, true);
  const broken = new SaveGame({ setItem() { throw new Error('cheio'); }, getItem() { return '{'; } });
  assert.equal(broken.write({}), false);
  assert.equal(broken.read(), null);
});
