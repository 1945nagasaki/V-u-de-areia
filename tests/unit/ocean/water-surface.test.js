import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WaterSurface } from '../../../src/world/WaterSurface.js';

/** Consulta falsa da GPU: altura = 0,3·sin(x) (só depois de `delay` quadros do pedido). */
function fakeQuery(delay = 0) {
  let n = 1;
  const pts = new Map();
  return {
    valid: true, rates: new Float32Array(64), resultTime: 0,
    alloc: () => n++,
    set(slot, x, z) { pts.set(slot, { x, z }); this.rates[slot] = 0.5; },
    height(slot) { const p = pts.get(slot); return 0.3 * Math.sin(p.x); },
  };
}
const make = (o = {}) => new WaterSurface({ query: fakeQuery(), ocean: { time: 0 }, level: 0, terrainAt: (x) => -2 + x * 0.1, slots: 4, ...o });

test('getDepthAt_isLevelMinusTerrain_negativeOnLand', () => {
  const s = make();
  assert.equal(s.getDepthAt(0, 0), 2);
  assert.ok(s.getDepthAt(30, 0) < 0, 'terra');
});

test('getHeightAt_returnsStillLevelUntilGpuAnswers_thenRealWave', () => {
  const s = make();
  s.tick();
  assert.equal(s.getHeightAt(1.5, 0), 0, 'quadro do pedido: água parada');
  for (let i = 0; i < 3; i++) { s.tick(); s.getHeightAt(1.5, 0); }
  assert.ok(Math.abs(s.getHeightAt(1.5, 0) - 0.3 * Math.sin(1.5)) < 1e-9, 'depois: a onda');
});

test('getHeightAt_withoutOcean_isStillWater', () => {
  const s = new WaterSurface({ level: 0.2, terrainAt: () => -1 });
  assert.equal(s.getHeightAt(5, 5), 0.2);
  assert.deepEqual({ ...s.getNormalAt(5, 5) }, { x: -0, y: 1, z: -0 });
  assert.equal(s.getVelocityAt(5, 5).y, 0);
});

test('pool_reusesLeastRecentlyUsedSlot_andNeverAllocatesMore', () => {
  const s = make({ slots: 2 });
  const slots = new Set();
  for (let f = 0; f < 10; f++) { s.tick(); s.getHeightAt(f * 5, 0); }
  for (const p of s.pool) slots.add(p.slot);
  assert.equal(slots.size, 2, 'sempre os mesmos 2 slots da GPU');
});

test('getNormalAt_tiltsAgainstTheSlope', () => {
  const s = make({ slots: 12, spacing: 0.5 });
  for (let i = 0; i < 5; i++) { s.tick(); s.getNormalAt(0, 0); }
  const n = s.getNormalAt(0, 0); // dh/dx = 0,3·cos(0) > 0 → normal inclina para −x
  assert.ok(n.x < -0.1 && n.y > 0.9 && Math.abs(Math.hypot(n.x, n.y, n.z) - 1) < 1e-9);
});
