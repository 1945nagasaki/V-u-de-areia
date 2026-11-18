import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORAGE } from '../../../src/config/forage.js';
import { FRUITS } from '../../../src/config/foods.js';
import { BIOMES } from '../../../src/config/biomes.js';
import {
  generateCell, fruitsByBiome, selectActive, nearestReady, harvestNode,
  tickRegrowth, tickGrowIn, cellsInRadius, easeOutBack,
} from '../../../src/systems/forage/fruitSpawn.js';

const CS = FORAGE.cellSize;
const BIOME_IDS = new Set(BIOMES.map((b) => b.id));

/** Matriz de instância (colunas) só com translação e escala uniforme. */
const mat = (x, y, z, s = 1) => [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, x, y, z, 1];

/** Hospedeiro sintético no centro da célula (0,0), com folga para não colidir. */
const host = (type, i, height = 5) => {
  const x = 4 + (i % 8) * 7, z = 4 + Math.floor(i / 8) * 7;
  return { type, x, y: 1, z, height, e: mat(x, 1, z) };
};

/** Mundo sintético: um bioma só, altura fixa. */
const world = (biome, h) => ({ biomeAt: () => biome, heightAt: () => h });

/** Muitos hospedeiros de cada tipo de cfg.hosts. */
const allHosts = () => Object.keys(FORAGE.hosts).flatMap((t, k) => Array.from({ length: 8 }, (_, i) => host(t, k * 8 + i)));

test('colocação é determinística (mesma célula → mesmos nós)', () => {
  const args = { cx: 3, cz: -2, cfg: FORAGE, hosts: allHosts(), ...world('tropical', 2), waterLevel: 0 };
  const a = generateCell(args), b = generateCell(args);
  assert.deepEqual(a, b);
  assert.ok(a.nodes.length > 0);
  const c = generateCell({ ...args, cx: 4 });
  assert.notDeepEqual(a.nodes.map((n) => [n.x, n.z]), c.nodes.map((n) => [n.x, n.z]));
});

test('as regras só usam biomas, hospedeiros e frutas que existem', () => {
  for (const r of FORAGE.rules) {
    assert.ok(FRUITS[r.fruit], `fruta ${r.fruit}`);
    assert.ok(FORAGE.regrow[r.fruit], `rebrota de ${r.fruit}`);
    assert.ok(FORAGE.models[r.fruit], `modelo de ${r.fruit}`);
    for (const b of r.biomes) assert.ok(BIOME_IDS.has(b), `bioma ${b}`);
    if (r.host) {
      const hosts = Array.isArray(r.host) ? r.host : [r.host];
      for (const h of hosts) assert.ok(FORAGE.hosts[h], `hospedeiro ${h}`);
      // algum bioma da regra planta mesmo esse hospedeiro
      const ok = r.biomes.some((b) => BIOMES.find((x) => x.id === b).vegetation.some((v) => hosts.includes(v.type)));
      assert.ok(ok, `${r.fruit}: nenhum bioma de ${r.biomes} tem ${hosts}`);
    }
  }
});

test('mapa bioma → frutas segue o desenho', () => {
  const m = fruitsByBiome(FORAGE);
  const has = (b, f) => assert.ok(m[b]?.has(f), `${f} em ${b}`);
  has('tropical', 'coco_fruto'); has('tropical', 'banana_selvagem'); has('tropical', 'manga');
  has('equatorial', 'banana_selvagem'); has('equatorial', 'manga');
  has('deserto', 'tamara'); has('deserto', 'figo_india'); has('deserto', 'coco_fruto');
  has('kalahari', 'figo_india'); has('kalahari', 'tamara');
  has('savana', 'marula'); has('savana', 'frutas_vermelhas');
  has('taiga', 'frutas_vermelhas');
  assert.ok(!m.taiga.has('banana_selvagem'));
  assert.ok(!m.savana.has('manga'));
});

test('toda fruta de FRUITS nasce em algum lugar, nos 3 tipos de nó no conjunto', () => {
  const seen = new Set(), kinds = new Set();
  for (const b of BIOMES) {
    for (const h of [1.5, 4, 20]) {
      for (let cx = 0; cx < 6; cx++) {
        const { nodes } = generateCell({ cx, cz: 0, cfg: FORAGE, hosts: allHosts(), ...world(b.id, h), waterLevel: 0 });
        for (const n of nodes) { seen.add(n.fruit); kinds.add(n.kind); }
      }
    }
  }
  for (const id of Object.keys(FRUITS)) assert.ok(seen.has(id), `${id} nunca nasce`);
  assert.deepEqual([...kinds].sort(), ['bush', 'ground', 'tree']);
});

test('coco só na palmeira do litoral; acima disso, tâmara no deserto', () => {
  const hosts = Array.from({ length: 40 }, (_, i) => host('palm', i, 10));
  const low = generateCell({ cx: 0, cz: 0, cfg: FORAGE, hosts, ...world('tropical', 2) });
  const high = generateCell({ cx: 0, cz: 0, cfg: FORAGE, hosts, ...world('tropical', 40) });
  const desertHigh = generateCell({ cx: 0, cz: 0, cfg: FORAGE, hosts, ...world('deserto', 40) });
  assert.ok(low.nodes.some((n) => n.fruit === 'coco_fruto' && n.kind === 'tree'));
  assert.ok(!high.nodes.some((n) => n.kind === 'tree'));
  assert.ok(desertHigh.nodes.some((n) => n.fruit === 'tamara' && n.kind === 'tree'));
  assert.ok(!desertHigh.nodes.some((n) => n.fruit === 'coco_fruto'));
});

test('alturas: copa acima do tronco, arbusto entre bushY, chão no terreno', () => {
  const { nodes } = generateCell({ cx: 0, cz: 0, cfg: FORAGE, hosts: allHosts(), ...world('tropical', 1), waterLevel: 0 });
  const [lo, hi] = FORAGE.bushY;
  for (const n of nodes) {
    if (n.kind === 'tree') assert.ok(n.y > 1 + 1, `fruta da copa baixa demais: ${n.y}`);
    if (n.kind === 'bush') assert.ok(n.y - 1 >= lo - 1e-9 && n.y - 1 <= hi + 1e-9, `arbusto: ${n.y}`);
    if (n.kind === 'ground') assert.equal(n.y, 1 - FORAGE.groundSink);
    assert.ok(n.regrow >= FORAGE.regrow[n.fruit][0] && n.regrow <= FORAGE.regrow[n.fruit][1]);
  }
});

test('teto de nós ativos: os mais próximos dentro do raio', () => {
  const nodes = Array.from({ length: 50 }, (_, i) => ({ id: `n${i}`, x: i * 3, z: 0, ready: true }));
  const act = selectActive(nodes, 0, 0, 100, 10);
  assert.equal(act.length, 10);
  assert.deepEqual(act.map((n) => n.id), Array.from({ length: 10 }, (_, i) => `n${i}`));
  assert.equal(selectActive(nodes, 0, 0, 30, 1000).length, 11); // 0..30 m
  assert.equal(selectActive(nodes, 0, 0, 100, 0).length, 0);
});

test('células no raio cobrem o círculo', () => {
  const cells = cellsInRadius(10, 10, FORAGE.activeRadius, CS);
  const keys = new Set(cells.map((c) => `${c.cx},${c.cz}`));
  assert.ok(keys.has('0,0'));
  assert.ok(!keys.has(`${Math.ceil(400 / CS)},0`));
});

test('rebrota: some ao colher, volta após `regrow` s de jogo, incha até 1', () => {
  const n = { id: 'a', x: 0, z: 0, ready: true, timer: 0, grow: 1, regrow: 200 };
  const regrowing = new Set(), growing = new Set();
  assert.equal(harvestNode(n), true);
  assert.equal(harvestNode(n), false); // já colhido
  regrowing.add(n);
  assert.equal(nearestReady([n], 0, 0, 5), null);
  // pausado: dt 0 não avança
  tickRegrowth(regrowing, 0);
  assert.equal(n.timer, 200);
  for (let t = 0; t < 199; t++) assert.deepEqual(tickRegrowth(regrowing, 1), []);
  assert.equal(n.ready, false);
  assert.deepEqual(tickRegrowth(regrowing, 1), [n]);
  assert.equal(n.ready, true);
  assert.equal(regrowing.size, 0);
  assert.equal(nearestReady([n], 0, 0, 5), n);
  growing.add(n);
  tickGrowIn(growing, 1, 2);
  assert.equal(n.grow, 0.5);
  tickGrowIn(growing, 5, 2);
  assert.equal(n.grow, 1);
  assert.equal(growing.size, 0);
  assert.equal(easeOutBack(0), 0);
  assert.ok(Math.abs(easeOutBack(1) - 1) < 1e-9);
});

test('nearestReady respeita o raio e ignora colhidos', () => {
  const a = { id: 'a', x: 1, z: 0, ready: false };
  const b = { id: 'b', x: 2, z: 0, ready: true };
  const c = { id: 'c', x: 9, z: 0, ready: true };
  assert.equal(nearestReady([a, b, c], 0, 0, FORAGE.interactRadius), b);
  assert.equal(nearestReady([a, c], 0, 0, FORAGE.interactRadius), null);
});
