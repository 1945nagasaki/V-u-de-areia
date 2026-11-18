import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MeleeController } from '../../../src/systems/MeleeController.js';

// Colisor redondo de 0,4 m no centro do alvo (como o boneco de treino) e, opcionalmente, uma parede.
const ctx = (wallX = null) => ({
  game: { collisions: { overlaps: (x, z) => Math.hypot(x - 2, z) < 0.4 || (wallX !== null && Math.abs(x - wallX) < 0.1) } },
});
const blocked = (c, stop) => MeleeController.prototype.blocked.call(c, 0, 0, 2, 0, stop);

test('golpe: o colisor do próprio alvo (boneco) não conta como parede', () => {
  assert.equal(blocked(ctx(), 0.45), -1);
});

test('golpe: parede de verdade entre atacante e alvo ainda bloqueia', () => {
  assert.ok(blocked(ctx(1.0), 0.45) >= 0);
});
