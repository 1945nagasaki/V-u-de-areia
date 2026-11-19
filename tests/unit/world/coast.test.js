import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorldGenerator } from '../../../src/world/WorldGenerator.js';
import { WORLD } from '../../../src/config/worldConfig.js';
import { VILLAGES } from '../../../src/config/villages.js';

const W2 = WORLD.width / 2, D2 = WORLD.depth / 2;
const uvToWorld = (u, v) => ({ x: (u - 0.5) * WORLD.width, z: (v - 0.5) * WORLD.depth });

/** Gerador com as vilas (como o Game monta), para a altura real do mapa. */
function generator(northCliffs = WORLD.northCliffs) {
  const saved = WORLD.northCliffs;
  WORLD.northCliffs = northCliffs;
  const g = new WorldGenerator(null);
  for (const v of Object.values(VILLAGES)) {
    const c = uvToWorld(v.u, v.v);
    if (v.terraces) g.addTerraceZone({ x: c.x, z: c.z, ...v.terraces }); else g.addFlatZone({ x: c.x, z: c.z, ...v.flatten });
    for (const r of v.ridges ?? []) g.addRidge({ x: c.x, z: c.z, ...r });
    for (const t of v.trenches ?? []) g.addTrench({ ...t, x: c.x + (t.dx ?? 0), z: c.z + (t.dz ?? 0) });
  }
  return { g, restore: () => { WORLD.northCliffs = saved; } };
}

test('ilha_as4BordasTerminamNoMar', () => {
  // Regressão: no centro-norte as montanhas iam até a borda (sem litoral; minimapa preto além dela).
  const { g, restore } = generator();
  try {
    const bad = [];
    for (let i = 0; i <= 400; i++) {
      const t = i / 400;
      for (const [n, x, z] of [['norte', -W2 + t * WORLD.width, -D2 + 1], ['sul', -W2 + t * WORLD.width, D2 - 1], ['oeste', -W2 + 1, -D2 + t * WORLD.depth], ['leste', W2 - 1, -D2 + t * WORLD.depth]]) {
        const h = g.height(x, z);
        if (h > WORLD.waterLevel - 0.5) bad.push(`${n} ${(t * 100).toFixed(0)}%: ${h.toFixed(1)} m`);
      }
    }
    assert.deepEqual(bad.slice(0, 8), [], `borda em terra (${bad.length} pontos)`);
  } finally { restore(); }
});

test('ilha_falesiaNoNorte_naoMexeEmNadaAMaisDe80mDaBorda', () => {
  const now = generator(), old = generator(null);
  try {
    let worst = 0, where = '';
    for (let i = 0; i <= 200; i++) {
      const x = -W2 + (i / 200) * WORLD.width;
      for (let dz = 80; dz <= 600; dz += 20) {
        const z = -D2 + dz, d = Math.abs(now.g.height(x, z) - old.g.height(x, z));
        if (d > worst) { worst = d; where = `x=${x.toFixed(0)} a ${dz} m da borda`; }
      }
    }
    assert.ok(worst < 1e-6, `mudou ${worst.toFixed(3)} m em ${where}`);
  } finally { now.restore(); }
});

test('ilha_vilasDoNorteIntactas', () => {
  const now = generator(), old = generator(null);
  try {
    for (const id of ['presaDeGelo', 'coroaAlta', 'maoCerrada', 'mesaFarta', 'abstracao']) {
      const v = VILLAGES[id], c = uvToWorld(v.u, v.v);
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2, x = c.x + Math.sin(a) * v.radius, z = c.z + Math.cos(a) * v.radius;
        assert.equal(now.g.height(x, z), old.g.height(x, z), `${id} mudou na borda da vila`);
      }
    }
  } finally { now.restore(); }
});

test('ilha_falesiaIngreme_comFaixaDeSeixosNoPe', () => {
  const { g, restore } = generator();
  try {
    // No centro-norte (x = 400: montanha maciça; em x = 0 desce um rio): do mar ao topo em poucas dezenas de metros.
    const x = 400;
    const prof = [];
    for (let d = 0; d <= 120; d += 2) prof.push([d, g.height(x, -D2 + d)]);
    const top = prof.find(([, h]) => h > 30), sea = [...prof].reverse().find(([, h]) => h < 0);
    assert.ok(top && sea && top[0] - sea[0] < 60, `falésia: mar em ${sea?.[0]} m, 30 m de altura em ${top?.[0]} m`);
  } finally { restore(); }
});
