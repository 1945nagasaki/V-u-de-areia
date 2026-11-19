/**
 * Terreno em terraços (platôs em degrau) para cidades de montanha.
 *
 * Uma zona tem vários níveis circulares encaixados: cada nível é um círculo
 * deslocado para o norte (−z) e mais alto que o anterior. Entre dois níveis
 * fica um degrau íngreme (escondido por muralhas); um corredor reto que sobe
 * do sul para o norte (+z → −z) liga os níveis por rampas (a Escada).
 * Fora do primeiro nível o relevo volta ao natural numa faixa `blend`.
 *
 * Funções puras: não dependem de Three.js nem do gerador (testáveis).
 *
 * @example
 * const zone = makeTerraceZone({ x: 0, z: 0, base: 50, levels: [
 *   { r: 130, shift: 0, y: 0 }, { r: 100, shift: 22, y: 9 } ] });
 * terraceHeight(zone, x, z, natural); // altura final naquele ponto
 */

/** @typedef {{ r: number, shift: number, y: number }} TerraceLevel */

/**
 * @param {{ x: number, z: number, base: number, levels: TerraceLevel[],
 *   blend?: number, edge?: number, stair?: { width: number, run: number } }} o
 */
export function makeTerraceZone(o) {
  const levels = o.levels.map((l) => ({ ...l, cx: o.x, cz: o.z - l.shift }));
  const stair = o.stair ?? { width: 12, run: 18 };
  // Perfil da escada ao longo do eixo (z): pontos [z, y] do sul para o norte.
  const prof = [];
  const outer = levels[0];
  prof.push([outer.cz + outer.r + 1, levels[0].y]);
  for (let i = 1; i < levels.length; i++) {
    const zb = levels[i].cz + levels[i].r; // borda sul do nível i
    prof.push([zb + stair.run / 2, levels[i - 1].y]);
    prof.push([zb - stair.run / 2, levels[i].y]);
  }
  const top = levels[levels.length - 1];
  prof.push([top.cz - top.r, top.y]);
  return { x: o.x, z: o.z, base: o.base, levels, blend: o.blend ?? 45, edge: o.edge ?? 2.5, stair, prof };
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Altura (relativa à base) do perfil da escada no z dado. */
export function stairProfile(zone, z) {
  const p = zone.prof;
  if (z >= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    const [z1, y1] = p[i];
    if (z >= z1) {
      const [z0, y0] = p[i - 1];
      return y0 + ((z0 - z) / (z0 - z1)) * (y1 - y0);
    }
  }
  return p[p.length - 1][1];
}

/**
 * Índice do nível em que o ponto está (−1 = fora da cidade).
 * @returns {number}
 */
export function terraceLevelAt(zone, x, z) {
  for (let i = zone.levels.length - 1; i >= 0; i--) {
    const l = zone.levels[i];
    if (Math.hypot(x - l.cx, z - l.cz) < l.r) return i;
  }
  return -1;
}

/** Altura do chão no nível `i` (absoluta). */
export function levelHeight(zone, i) {
  return zone.base + zone.levels[i].y;
}

/**
 * Altura final do terreno: degraus + escada; fora da cidade, mistura com o
 * relevo natural.
 * @param {number} natural altura sem a zona
 */
export function terraceHeight(zone, x, z, natural) {
  const L = zone.levels;
  const d0 = Math.hypot(x - L[0].cx, z - L[0].cz);
  if (d0 > L[0].r + zone.blend) return natural;
  let h = L[0].y;
  for (let i = 1; i < L.length; i++) {
    const d = Math.hypot(x - L[i].cx, z - L[i].cz);
    h += (L[i].y - L[i - 1].y) * (1 - smoothstep(L[i].r - zone.edge, L[i].r, d));
  }
  // Corredor da Escada (faixa reta no eixo x = centro).
  const dx = Math.abs(x - zone.x);
  const hw = zone.stair.width / 2;
  if (dx < hw + 2 && z < zone.prof[0][0] && z > zone.prof[zone.prof.length - 1][0]) {
    const w = 1 - smoothstep(hw, hw + 2, dx);
    h += (stairProfile(zone, z) - h) * w;
  }
  h += zone.base;
  const t = smoothstep(L[0].r, L[0].r + zone.blend, d0);
  return h + (natural - h) * t;
}
