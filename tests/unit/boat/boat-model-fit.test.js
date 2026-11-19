import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { fitBoatModel } from '../../../src/render/boat/BoatModel.js';
import { BOAT } from '../../../src/config/boat.js';

/** "Barco" de teste: caixa comprida em X (como vários GLB), fora do centro e em outra escala. */
const rawBoat = () => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(600, 150, 180));
  m.position.set(40, 90, -25);
  const root = new THREE.Group();
  root.add(m);
  return root;
};

test('fitBoatModel_scalesToLength_alignsLengthToZ_andCentersOnTheBoat', () => {
  const { holder, size } = fitBoatModel(rawBoat(), { length: 9.6, draft: 0.12 });
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  assert.ok(Math.abs(size.z - 9.6) < 1e-6, `comprimento ${size.z}`);
  assert.ok(Math.abs(size.x - 9.6 * (180 / 600)) < 1e-6, 'a boca acompanha a mesma escala (sem deformar)');
  assert.ok(Math.abs(box.min.z + 4.8) < 1e-6 && Math.abs(box.max.z - 4.8) < 1e-6, 'comprimento ao longo de Z, centrado');
  assert.ok(Math.abs(box.min.x + box.max.x) < 1e-6, 'centrado na largura');
});

test('fitBoatModel_putsDraftBelowWaterline_andAppliesOffset', () => {
  const { holder } = fitBoatModel(rawBoat(), { length: 8, draft: 0.3, offsetZ: -1.1 });
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  assert.ok(Math.abs(box.min.y + 0.3) < 1e-6, `fundo do casco em y=${box.min.y}`);
  assert.ok(Math.abs((box.min.z + box.max.z) / 2 + 1.1) < 1e-6, 'deslocado 1,1 m para trás');
});

test('fitBoatModel_flip_reversesBowAndStern', () => {
  const mark = (flip) => {
    const root = rawBoat();
    const bow = new THREE.Object3D(); bow.position.set(340, 90, -25); root.add(bow); // ponta +X do casco
    const { holder } = fitBoatModel(root, { length: 8, draft: 0, flip });
    holder.updateMatrixWorld(true);
    return bow.getWorldPosition(new THREE.Vector3()).z;
  };
  assert.ok(Math.abs(mark(false) + mark(true)) < 1e-6 && Math.abs(mark(false)) > 3.9, 'a mesma ponta troca de extremidade');
});

test('boatConfig_modelHelmIsInsideTheHull_andAsset_isDeclared', () => {
  const m = BOAT.model;
  assert.match(m.url, /\.glb$/);
  assert.ok(Math.abs(m.helm[0]) < BOAT.waterlineBeam / 2 && Math.abs(m.helm[2]) < BOAT.waterlineLength / 2, 'piloto dentro do casco da física');
  assert.ok(m.draft > 0 && m.draft < BOAT.freeboard);
});
