import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flipRows } from '../../../src/render/WorldMapRenderer.js';
import { WORLD_MAP, MINIMAP } from '../../../src/config/minimap.js';
import { WORLD } from '../../../src/config/worldConfig.js';

test('flipRows_linhasDoWebGL_viramDeCimaParaBaixo', () => {
  // 2×3 px: cada linha com um valor (linha 0 do WebGL = a de BAIXO)
  const src = new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3]);
  const out = flipRows(src, 2, 3);
  assert.deepEqual([...out], [3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1]);
  assert.equal(src[0], 1, 'não mexe na origem');
});

test('mapaGrande_mesmaProporcaoDoContinente_eMesmaCamadaDoMinimapa', () => {
  assert.equal(WORLD_MAP.width / WORLD_MAP.height, WORLD.width / WORLD.depth, 'clique no mapa = lugar certo no mundo');
  assert.ok(WORLD_MAP.supersample >= 1);
  assert.ok(Number.isInteger(MINIMAP.layer));
});
