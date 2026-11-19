import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTerraceZone, terraceHeight, terraceLevelAt, stairProfile } from '../../../src/world/Terraces.js';

const LEVELS = [
  { r: 130, shift: 0, y: 0 },
  { r: 100, shift: 22, y: 9 },
  { r: 74, shift: 42, y: 18 },
];
const zone = () => makeTerraceZone({ x: 0, z: 0, base: 50, levels: LEVELS, stair: { width: 12, run: 18 } });

test('cada nível é plano na altura dele, longe das bordas e da escada', () => {
  const z = zone();
  assert.equal(terraceHeight(z, 60, 110, 999), 50); // Pé (1º nível), ao sul-leste
  assert.equal(terraceLevelAt(z, 60, 110), 0);
  assert.equal(terraceHeight(z, 40, 40, 999), 59); // 2º nível
  assert.equal(terraceLevelAt(z, 40, 40), 1);
  assert.equal(terraceHeight(z, 20, -40, 999), 68); // 3º nível
});

test('fora da cidade (além do blend) vale o relevo natural', () => {
  const z = zone();
  assert.equal(terraceHeight(z, 0, 130 + 46, 123), 123);
  assert.equal(terraceLevelAt(z, 0, 200), -1);
});

test('a escada sobe sem degrau maior que a rampa (≤ 30°)', () => {
  const z = zone();
  let prev = terraceHeight(z, 0, 130, 50);
  for (let zz = 129; zz > -100; zz -= 1) {
    const h = terraceHeight(z, 0, zz, 50);
    assert.ok(h - prev <= Math.tan(Math.PI / 6) + 1e-6, `subida brusca em z=${zz}: ${h - prev}`);
    prev = h;
  }
  assert.equal(stairProfile(z, -100), 18);
});

test('fora da escada há um degrau íngreme entre os níveis', () => {
  const z = zone();
  // borda oeste do 2º nível: centro (0, -22), raio 100 → x = -100
  const below = terraceHeight(z, -103, -22, 50);
  const above = terraceHeight(z, -94, -22, 50);
  assert.ok(above - below > 8, `degrau de ${above - below} m`);
});
