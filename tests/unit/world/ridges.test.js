import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRidge, ridgeLift } from '../../../src/world/Ridges.js';

// Escarpa ao norte (arco de −π a 0 passa pelo norte, −π/2).
const ridge = () => makeRidge({ x: 0, z: 0, r: 200, width: 50, height: 45, from: -Math.PI, to: 0 });

test('dentro do anel (a cidade) o terreno não muda', () => {
  assert.equal(ridgeLift(ridge(), 0, -150), 0);
  assert.equal(ridgeLift(ridge(), 0, 0), 0);
});

test('no topo da escarpa, ao norte, sobe a altura inteira', () => {
  assert.equal(ridgeLift(ridge(), 0, -(200 + 8 + 10)), 45);
});

test('a face interna é íngreme: sobe 45 m em ~8 m', () => {
  const R = ridge();
  const rise = ridgeLift(R, 0, -208) - ridgeLift(R, 0, -200);
  assert.ok(rise > 40, `subiu ${rise}`);
});

test('fora do arco (ao sul) não há escarpa', () => {
  assert.equal(ridgeLift(ridge(), 0, 218), 0);
});

test('longe, além da encosta externa, volta a zero', () => {
  assert.equal(ridgeLift(ridge(), 0, -(200 + 8 + 51)), 0);
});
