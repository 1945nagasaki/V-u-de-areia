import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, MISSION_DIFFICULTY, OBJECTIVE_TYPES, POST_TUTORIAL_MISSION, fillText } from '../../../src/config/missions.js';

test('faixas de ouro por dificuldade (Fácil 25–50, Média 80–150, Difícil 220–400, Extrema 500+)', () => {
  assert.deepEqual(MISSION_DIFFICULTY.facil.gold, [25, 50]);
  assert.deepEqual(MISSION_DIFFICULTY.media.gold, [80, 150]);
  assert.deepEqual(MISSION_DIFFICULTY.dificil.gold, [220, 400]);
  assert.equal(MISSION_DIFFICULTY.extrema.gold[0], 500);
  assert.ok(MISSION_DIFFICULTY.extrema.gold[1] >= 1000);
});

test('toda missão respeita a faixa de ouro e XP da sua dificuldade', () => {
  for (const [id, m] of Object.entries(MISSIONS)) {
    const band = MISSION_DIFFICULTY[m.difficulty];
    assert.ok(band, `${id}: dificuldade desconhecida ${m.difficulty}`);
    assert.equal(m.id, id);
    assert.ok(m.goldReward >= band.gold[0] && m.goldReward <= band.gold[1], `${id}: ouro ${m.goldReward} fora de ${band.gold}`);
    assert.ok(m.xpReward >= band.xp[0] && m.xpReward <= band.xp[1], `${id}: XP ${m.xpReward} fora de ${band.xp}`);
    assert.ok(Object.values(OBJECTIVE_TYPES).includes(m.objectiveType), `${id}: objetivo ${m.objectiveType}`);
    assert.ok(Number.isInteger(m.targetCount) && m.targetCount > 0);
    for (const k of ['title', 'description']) assert.equal(typeof m[k], 'string');
  }
});

test('buscar_comida: Fácil, collect_food, 5 itens, +50 XP, 35 ouro; é a missão pós-tutorial', () => {
  const m = MISSIONS.buscar_comida;
  assert.equal(m.difficulty, 'facil');
  assert.equal(m.objectiveType, 'collect_food');
  assert.equal(m.targetCount, 5);
  assert.equal(m.xpReward, 50);
  assert.equal(m.goldReward, 35);
  assert.equal(POST_TUTORIAL_MISSION, 'buscar_comida');
  assert.equal(fillText(m.objectiveText, { n: m.targetCount }), 'Colete 5 comidas (frutas ou carnes)');
});
