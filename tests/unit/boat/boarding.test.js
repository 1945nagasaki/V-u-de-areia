import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findLanding, hopPath } from '../../../src/systems/boat/Boarding.js';
import { BOAT } from '../../../src/config/boat.js';

const CFG = BOAT.boarding;
// Margem: água para x < 10, terra plana a 0,5 m para x ≥ 10.
const shore = { groundAt: (x) => (x < 10 ? -2 : 0.5), isWater: (x) => x < 10, blocked: () => false, deckY: 0.3 };

test('findLanding_picksNearestDryGround_withinRange', () => {
  const s = findLanding({ x: 7, z: 0 }, 0, shore, CFG);
  assert.ok(s && !s.water, 'achou terra');
  assert.ok(s.x >= 10 && s.x - 7 <= CFG.maxRadius + 1e-9, `x=${s.x.toFixed(2)}`);
  assert.equal(s.y, 0.5);
});

test('findLanding_farFromShore_dropsIntoWaterBesideTheBoat', () => {
  const s = findLanding({ x: -20, z: 0 }, 0, { ...shore, waterExit: { x: -18, z: 0 } }, CFG);
  assert.deepEqual(s, { x: -18, z: 0, y: null, water: true });
});

test('findLanding_rejectsBlockedSpots_cliffsAndSteepSlopes', () => {
  // A terra mais perto está ocupada por uma parede: escolhe outro ponto livre, nunca dentro do colisor.
  const wall = (x, z) => x >= 10 && x < 12 && Math.abs(z) < 3;
  const s = findLanding({ x: 7, z: 0 }, 0, { ...shore, blocked: wall }, CFG);
  assert.ok(s && !wall(s.x, s.z));
  // Barranco 3 m acima do assoalho: não sobe; sem saída para a água, fica no barco.
  assert.equal(findLanding({ x: 7, z: 0 }, 0, { ...shore, groundAt: (x) => (x < 10 ? -2 : 3.5) }, CFG), null);
  // Encosta muito íngreme: também não.
  assert.equal(findLanding({ x: 7, z: 0 }, 0, { ...shore, groundAt: (x) => (x < 10 ? -2 : (x - 10) * 2) }, CFG), null);
  // Saída para a água ocupada (casco de outro barco, pilar): não sai.
  assert.equal(findLanding({ x: -20, z: 0 }, 0, { ...shore, blocked: () => true, waterExit: { x: -18, z: 0 } }, CFG), null);
});

test('hopPath_startsAndEndsOnTarget_andArcsInTheMiddle', () => {
  const a = { x: 0, y: 0, z: 0 }, b = { x: 4, y: 1, z: 2 }, o = {};
  assert.deepEqual(hopPath(a, b, 0, 0.5, o), { x: 0, y: 0, z: 0 });
  const end = hopPath(a, b, 1, 0.5, {});
  assert.ok(Math.abs(end.x - 4) < 1e-12 && Math.abs(end.y - 1) < 1e-12 && Math.abs(end.z - 2) < 1e-12);
  assert.ok(Math.abs(hopPath(a, b, 0.5, 0.5, {}).y - (0.5 + 0.5)) < 1e-12, 'no meio: altura média + o arco');
});
