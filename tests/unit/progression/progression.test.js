import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Progression, xpSourceForSpecies } from '../../../src/systems/Progression.js';
import { PROGRESSION } from '../../../src/config/survival.js';

test('XP: fontes animal/criatura/missão e nível', () => {
  const p = new Progression();
  assert.equal(p.addXp('animal'), PROGRESSION.rewards.animal);
  p.addXp('creature');
  p.addXp('mission');
  assert.equal(p.totalXp, 155);
  assert.equal(p.level, 2);
  assert.equal(xpSourceForSpecies({ damage: 18 }), 'creature');
  assert.equal(xpSourceForSpecies({}), 'animal');
});

test('árvore de skills: custo por tier, gasto e bônus aplicados', () => {
  const p = new Progression();
  assert.equal(p.upgrade('forca'), false);
  p.addXp(200);
  assert.equal(p.cost('forca'), 50);
  assert.equal(p.upgrade('forca'), true);
  assert.equal(p.cost('forca'), 75);
  assert.equal(p.upgrade('energia'), true);
  assert.equal(p.xp, 100);
  const s = p.stats({ maxHealth: 100, maxStamina: 100 });
  assert.equal(s.meleeMultiplier, 1.25);
  assert.equal(s.maxStamina, 115);
  assert.ok(Math.abs(s.speedMultiplier - 1.05) < 1e-9);
  assert.equal(s.maxHealth, 100);
  p.addXp(10000);
  for (let i = 0; i < 9; i++) p.upgrade('vida');
  assert.equal(p.tiers.vida, PROGRESSION.maxTier);
  assert.equal(p.cost('vida'), Infinity);
});

test('progressão: salva e carrega', () => {
  const p = new Progression();
  p.addXp(120); p.upgrade('vida');
  const q = new Progression();
  q.load(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(q.toJSON(), p.toJSON());
});
