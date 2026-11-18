/**
 * Lógica PURA da coleta de frutas (sem THREE, sem DOM): colocação determinística
 * dos nós por célula, seleção dos nós ativos perto do jogador e rebrota.
 * Quem desenha e interage é FruitNodes.js; aqui tudo é testável em Node.
 *
 * Um nó é um objeto simples:
 * { id, fruit, kind: 'tree'|'bush'|'ground', x, y, z, groundY, yaw, tilt, scale,
 *   regrow, ready: boolean, timer: number (s até voltar), grow: 0..1 }
 */

/** Gerador pseudoaleatório determinístico (mesma semente = mesma sequência). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semente inteira estável de uma célula (cx, cz) da grade. */
export function cellSeed(seed, cx, cz) {
  let h = Math.imul(cx | 0, 374761393) + Math.imul(cz | 0, 668265263) + Math.imul(seed | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Chave texto da célula. */
export const cellKey = (cx, cz) => `${cx},${cz}`;

/** Célula da grade que contém (x, z). */
export function cellOf(x, z, cellSize) {
  return { cx: Math.floor(x / cellSize), cz: Math.floor(z / cellSize) };
}

const asList = (v) => (Array.isArray(v) ? v : [v]);
const range = (rnd, [a, b]) => a + (b - a) * rnd();
const intRange = (rnd, [a, b]) => a + Math.floor(rnd() * (b - a + 1));

/**
 * Bioma → frutas que podem nascer nele (pelas regras do config).
 * @param {object} cfg FORAGE
 * @returns {Record<string, Set<string>>}
 */
export function fruitsByBiome(cfg) {
  const out = {};
  for (const r of cfg.rules) for (const b of r.biomes) (out[b] ??= new Set()).add(r.fruit);
  return out;
}

/** A regra vale para este bioma/altura? (`h` = altura acima da água). */
function fits(rule, biome, h) {
  if (!rule.biomes.includes(biome)) return false;
  if (rule.minH !== undefined && h < rule.minH) return false;
  if (rule.maxH !== undefined && h > rule.maxH) return false;
  return true;
}

/** Aplica a matriz 4x4 (colunas, como THREE.Matrix4.elements) ao ponto local. */
function applyMatrix(e, lx, ly, lz) {
  return {
    x: e[0] * lx + e[4] * ly + e[8] * lz + e[12],
    y: e[1] * lx + e[5] * ly + e[9] * lz + e[13],
    z: e[2] * lx + e[6] * ly + e[10] * lz + e[14],
  };
}

/**
 * Gera (de forma determinística) os nós de frutas de uma célula.
 *
 * @param {object} p
 * @param {number} p.cx célula x
 * @param {number} p.cz célula z
 * @param {object} p.cfg FORAGE
 * @param {{ type: string, x: number, y: number, z: number, height: number, e: ArrayLike<number> }[]} p.hosts
 *   árvores/arbustos reais da célula: `e` = matriz da instância (16 números),
 *   `height` = altura do modelo no espaço local
 * @param {(x: number, z: number) => string} p.biomeAt id do bioma dominante
 * @param {(x: number, z: number) => number} p.heightAt altura do terreno
 * @param {number} [p.waterLevel=0] nível do mar
 * @returns {{ nodes: object[], procHosts: { x: number, y: number, z: number, s: number, yaw: number }[] }}
 */
export function generateCell({ cx, cz, cfg, hosts, biomeAt, heightAt, waterLevel = 0 }) {
  const rnd = mulberry32(cellSeed(cfg.seed, cx, cz));
  const nodes = [];
  const procHosts = [];
  const key = cellKey(cx, cz);
  const add = (fruit, kind, x, y, z) => {
    const range0 = cfg.regrow[fruit];
    const tilt = kind === 'ground' ? rnd() * cfg.groundTilt : 0;
    nodes.push({
      id: `${key}#${nodes.length}`, fruit, kind, x, y, z,
      groundY: heightAt(x, z),
      yaw: rnd() * Math.PI * 2, tilt,
      scale: cfg.kindScale[kind] * (1 + (rnd() * 2 - 1) * cfg.scaleJitter),
      regrow: range(rnd, range0),
      ready: true, timer: 0, grow: 1,
    });
  };
  const addGround = (fruit, x, z) => add(fruit, 'ground', x, heightAt(x, z) - cfg.groundSink, z);

  const hostRules = cfg.rules.filter((r) => r.host);
  for (const host of hosts) {
    const biome = biomeAt(host.x, host.z);
    const h = heightAt(host.x, host.z) - waterLevel;
    for (const rule of hostRules) {
      if (!asList(rule.host).includes(host.type) || !fits(rule, biome, h)) continue;
      if (rnd() > rule.chance) break; // o hospedeiro foi sorteado para esta regra e ficou sem fruta
      const hc = cfg.hosts[host.type];
      const n = intRange(rnd, rule.count);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, r = range(rnd, hc.spread);
        if (rule.kind === 'tree') {
          const ly = host.height * range(rnd, hc.hang);
          const p = applyMatrix(host.e, hc.offset[0] + Math.cos(a) * r, ly, hc.offset[1] + Math.sin(a) * r);
          add(rule.fruit, 'tree', p.x, p.y, p.z);
        } else {
          const p = applyMatrix(host.e, Math.cos(a) * r, 0, Math.sin(a) * r);
          const sy = Math.hypot(host.e[4], host.e[5], host.e[6]); // escala vertical da instância
          const top = host.height * hc.top * sy;
          const y = host.y + Math.min(cfg.bushY[1], Math.max(cfg.bushY[0], top));
          add(rule.fruit, 'bush', p.x, y, p.z);
        }
      }
      if (rule.fallen && rnd() <= rule.fallen.chance) {
        const m = intRange(rnd, rule.fallen.count);
        for (let i = 0; i < m; i++) {
          const a = rnd() * Math.PI * 2, r = range(rnd, rule.fallen.ring);
          addGround(rule.fruit, host.x + Math.cos(a) * r, host.z + Math.sin(a) * r);
        }
      }
      break;
    }
  }

  const x0 = cx * cfg.cellSize, z0 = cz * cfg.cellSize;
  for (const rule of cfg.rules) {
    if (!rule.scatter) continue;
    for (let t = 0; t < rule.scatter.attempts; t++) {
      const x = x0 + rnd() * cfg.cellSize, z = z0 + rnd() * cfg.cellSize;
      const roll = rnd();
      if (roll > rule.scatter.chance) continue;
      const h = heightAt(x, z) - waterLevel;
      if (!fits(rule, biomeAt(x, z), h)) continue;
      const n = intRange(rnd, rule.count);
      if (rule.procHost === 'bush') {
        const pb = cfg.procBush;
        const s = range(rnd, pb.scale);
        const y = heightAt(x, z);
        procHosts.push({ x, y, z, s, yaw: rnd() * Math.PI * 2 });
        const top = Math.min(cfg.bushY[1], Math.max(cfg.bushY[0], pb.height * s));
        for (let i = 0; i < n; i++) {
          const a = rnd() * Math.PI * 2, r = rnd() * rule.cluster;
          add(rule.fruit, 'bush', x + Math.cos(a) * r, y + top, z + Math.sin(a) * r);
        }
      } else {
        for (let i = 0; i < n; i++) {
          const a = rnd() * Math.PI * 2, r = rnd() * rule.cluster;
          addGround(rule.fruit, x + Math.cos(a) * r, z + Math.sin(a) * r);
        }
      }
    }
  }
  return { nodes, procHosts };
}

/**
 * Células cujo quadrado toca o círculo (x, z, raio).
 * @returns {{ cx: number, cz: number }[]}
 */
export function cellsInRadius(x, z, radius, cellSize) {
  const out = [];
  const a = cellOf(x - radius, z - radius, cellSize), b = cellOf(x + radius, z + radius, cellSize);
  for (let cz = a.cz; cz <= b.cz; cz++) {
    for (let cx = a.cx; cx <= b.cx; cx++) {
      const nx = Math.max(cx * cellSize, Math.min(x, (cx + 1) * cellSize));
      const nz = Math.max(cz * cellSize, Math.min(z, (cz + 1) * cellSize));
      if (Math.hypot(nx - x, nz - z) <= radius) out.push({ cx, cz });
    }
  }
  return out;
}

/**
 * Os nós mais próximos de (x, z) dentro do raio, no máximo `cap`
 * (ordem: do mais perto ao mais longe; empate decidido pelo id → estável).
 * @param {Iterable<object>} nodes
 */
export function selectActive(nodes, x, z, radius, cap) {
  const list = [];
  for (const n of nodes) {
    const d = Math.hypot(n.x - x, n.z - z);
    if (d <= radius) list.push({ n, d });
  }
  list.sort((a, b) => a.d - b.d || (a.n.id < b.n.id ? -1 : a.n.id > b.n.id ? 1 : 0));
  return list.slice(0, Math.max(0, cap)).map((e) => e.n);
}

/**
 * O nó PRONTO mais perto de (x, z) dentro do raio (no plano), ou null.
 * @param {Iterable<object>} nodes
 */
export function nearestReady(nodes, x, z, radius) {
  let best = null, bd = radius;
  for (const n of nodes) {
    if (!n.ready) continue;
    const d = Math.hypot(n.x - x, n.z - z);
    if (d <= bd) { bd = d; best = n; }
  }
  return best;
}

/**
 * Colhe o nó: some e começa a contar a rebrota (`node.regrow` segundos).
 * @returns {boolean} false se o nó não estava pronto
 */
export function harvestNode(node) {
  if (!node.ready) return false;
  node.ready = false;
  node.timer = node.regrow;
  node.grow = 0;
  return true;
}

/**
 * Avança a rebrota com o dt do jogo (jogo pausado = dt 0 = nada cresce).
 * Os nós que terminaram saem de `regrowing` e voltam prontos (grow 0 → a
 * fruta "incha" em `growIn` segundos via tickGrowIn).
 * @param {Set<object>} regrowing nós colhidos
 * @param {number} dt segundos
 * @returns {object[]} nós que ficaram prontos agora
 */
export function tickRegrowth(regrowing, dt) {
  const done = [];
  for (const n of regrowing) {
    n.timer -= dt;
    if (n.timer <= 0) {
      n.timer = 0;
      n.ready = true;
      n.grow = 0;
      done.push(n);
    }
  }
  for (const n of done) regrowing.delete(n);
  return done;
}

/**
 * Faz as frutas que acabaram de voltar crescerem até o tamanho cheio.
 * @param {Set<object>} growing nós prontos com grow < 1
 * @param {number} dt segundos
 * @param {number} growIn segundos para ir de 0 a 1
 */
export function tickGrowIn(growing, dt, growIn) {
  for (const n of growing) {
    n.grow = growIn > 0 ? Math.min(1, n.grow + dt / growIn) : 1;
    if (n.grow >= 1) growing.delete(n);
  }
}

/** Curva da escala ao reaparecer (sai rápido, assenta suave). */
export const easeOutBack = (t) => {
  const c = 1.4, u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};
