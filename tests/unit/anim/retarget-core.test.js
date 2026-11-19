import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { alignmentBasis, pointAlong, swing, localsFromWorld } from '../../../tools/anim/retargetCore.mjs';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('alignmentBasis_zUpModelFacingX_mapsToYUpFacingZ', () => {
  // Modelo de origem em Z para cima, olhando para +X (comum em exportações do 3ds Max).
  const M = alignmentBasis(V(0, 0, 1), V(1, 0, 1), V(0, 0, 0));
  const up = V(0, 0, 1).applyMatrix4(M), fwd = V(1, 0, 0).applyMatrix4(M);
  assert.ok(near(up.y, 1) && near(fwd.z, 1), `up ${up.toArray()} fwd ${fwd.toArray()}`);
});

test('pointAlong_halfOfPolyline_isAtHalfLength', () => {
  const p = pointAlong([V(0, 0, 0), V(1, 0, 0), V(1, 0, 3)], 0.5);
  // comprimento 4 → metade = 2 → 1 m depois do canto
  assert.ok(near(p.x, 1) && near(p.z, 1), p.toArray().join(','));
});

test('swing_rotatesRestDirectionOntoPoseDirection', () => {
  const q = swing(V(0, -1, 0), V(0, -1, 1));
  const r = V(0, -1, 0).applyQuaternion(q);
  assert.ok(r.angleTo(V(0, -1, 1)) < 1e-6);
});

test('localsFromWorld_childOfRotatedParent_getsRelativeRotation', () => {
  const qp = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), 0.5);
  const qc = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), 0.8);
  const loc = localsFromWorld([{ name: 'a', parent: null }, { name: 'b', parent: 'a' }], new Map([['a', qp], ['b', qc]]));
  const back = qp.clone().multiply(loc.get('b'));
  assert.ok(back.angleTo(qc) < 1e-6);
  // Osso sem swing (não mapeado) com pai girado: local desfaz o pai (fica parado no mundo).
  const loc2 = localsFromWorld([{ name: 'a', parent: null }, { name: 'c', parent: 'a' }], new Map([['a', qp]]));
  assert.ok(qp.clone().multiply(loc2.get('c')).angleTo(new THREE.Quaternion()) < 1e-6);
});
