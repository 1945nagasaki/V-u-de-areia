import { NAV } from '../../config/workplaces.js';

/**
 * Grade de navegação de uma vila com A* (regra pura, sem Three.js).
 *
 * A grade é montada UMA vez a partir do mundo já pronto (`isBlocked` olha os
 * colisores reais: paredes, móveis, cercas, árvores, água, encosta) — então
 * portas e vãos ficam abertos exatamente onde estão no cenário. As rotas são
 * pedidas só quando o morador muda de destino (nunca por quadro), e saem
 * alisadas (sem zigue-zague de grade).
 *
 * @example
 * const nav = NavGrid.build({ cx: 0, cz: 0, half: 60, isBlocked: (x, z) => collisions.overlaps(x, z, 0.3) });
 * const route = nav.path({ x: -20, z: 3 }, { x: 14, z: -8 });   // [{x, z}, …] ou null
 * nav.refresh(x0, z0, x1, z1, isBlocked);                        // prédio novo/removido nessa área
 */
export class NavGrid {
  constructor({ minX, minZ, cols, rows, cell }) {
    this.minX = minX; this.minZ = minZ; this.cols = cols; this.rows = rows; this.cell = cell;
    const n = cols * rows;
    this.blocked = new Uint8Array(n);
    this.g = new Float32Array(n);
    this.from = new Int32Array(n);
    this.mark = new Uint32Array(n); // geração em que o nó foi tocado
    this.closed = new Uint32Array(n);
    this.gen = 0;
    this.heap = [];
    this.lastExpanded = 0;
  }

  /**
   * @param {{ cx: number, cz: number, half: number, cell?: number, isBlocked: (x: number, z: number) => boolean }} o
   */
  static build({ cx, cz, half, cell = NAV.cell, isBlocked }) {
    const n = Math.ceil((half * 2) / cell);
    const grid = new NavGrid({ minX: cx - half, minZ: cz - half, cols: n, rows: n, cell });
    grid.refresh(cx - half, cz - half, cx + half, cz + half, isBlocked);
    return grid;
  }

  /** Reavalia as células de um retângulo (construção adicionada ou removida). */
  refresh(x0, z0, x1, z1, isBlocked) {
    const i0 = Math.max(0, Math.floor((x0 - this.minX) / this.cell)), i1 = Math.min(this.cols - 1, Math.floor((x1 - this.minX) / this.cell));
    const j0 = Math.max(0, Math.floor((z0 - this.minZ) / this.cell)), j1 = Math.min(this.rows - 1, Math.floor((z1 - this.minZ) / this.cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.blocked[j * this.cols + i] = isBlocked(this.cx(i), this.cz(j)) ? 1 : 0;
  }

  cx(i) { return this.minX + (i + 0.5) * this.cell; }
  cz(j) { return this.minZ + (j + 0.5) * this.cell; }

  inside(i, j) {
    return i >= 0 && j >= 0 && i < this.cols && j < this.rows;
  }

  free(i, j) {
    return this.inside(i, j) && !this.blocked[j * this.cols + i];
  }

  /** Índice da célula livre mais perto de (x, z) (espiral até `maxCells`), ou −1. */
  nearestFree(x, z, maxCells = 6) {
    const ci = Math.floor((x - this.minX) / this.cell), cj = Math.floor((z - this.minZ) / this.cell);
    if (this.free(ci, cj)) return cj * this.cols + ci;
    let best = -1, bd = Infinity;
    for (let r = 1; r <= maxCells && best < 0; r++) {
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r || !this.free(ci + di, cj + dj)) continue;
        const d = (this.cx(ci + di) - x) ** 2 + (this.cz(cj + dj) - z) ** 2;
        if (d < bd) { bd = d; best = (cj + dj) * this.cols + ci + di; }
      }
    }
    return best;
  }

  /** Há linha reta livre entre dois pontos? (amostra a cada meia célula) */
  lineClear(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / (this.cell * 0.5)));
    for (let k = 0; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n;
      if (!this.free(Math.floor((x - this.minX) / this.cell), Math.floor((z - this.minZ) / this.cell))) return false;
    }
    return true;
  }

  /**
   * Rota de `a` até `b`. O último ponto é o próprio `b` (a estação pode estar
   * colada num móvel: chega-se até a célula livre vizinha e dá-se o passo final).
   * @returns {{ x: number, z: number }[] | null} null = sem caminho
   */
  path(a, b, { maxExpand = NAV.maxExpand } = {}) {
    const s = this.nearestFree(a.x, a.z), t = this.nearestFree(b.x, b.z);
    if (s < 0 || t < 0) return null;
    if (s === t) return [{ x: b.x, z: b.z }];
    const { cols, g, from, mark, closed, heap, blocked } = this;
    const gen = ++this.gen, ti = t % cols, tj = (t / cols) | 0;
    const h = (n) => { const dx = Math.abs((n % cols) - ti), dz = Math.abs(((n / cols) | 0) - tj); return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz); };
    heap.length = 0;
    g[s] = 0; from[s] = -1; mark[s] = gen;
    push(heap, s, h(s));
    let expanded = 0, found = false;
    while (heap.length) {
      const cur = pop(heap);
      if (closed[cur] === gen) continue;
      closed[cur] = gen;
      if (cur === t) { found = true; break; }
      if (++expanded > maxExpand) break;
      const ci = cur % cols, cj = (cur / cols) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= cols || nj >= this.rows) continue;
        const n = nj * cols + ni;
        if (blocked[n] || closed[n] === gen) continue;
        if (di && dj && (blocked[cj * cols + ni] || blocked[nj * cols + ci])) continue; // não corta quina
        const cost = g[cur] + (di && dj ? 1.4142 : 1);
        if (mark[n] !== gen || cost < g[n]) { g[n] = cost; from[n] = cur; mark[n] = gen; push(heap, n, cost + h(n)); }
      }
    }
    this.lastExpanded = expanded;
    if (!found) return null;
    const cells = [];
    for (let n = t; n !== -1; n = from[n]) cells.push(n);
    cells.reverse();
    // alisa: pula os pontos intermediários enquanto houver linha reta livre
    const pts = cells.map((n) => ({ x: this.cx(n % cols), z: this.cz((n / cols) | 0) }));
    const out = [];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !this.lineClear(pts[i].x, pts[i].z, pts[j].x, pts[j].z)) j--;
      out.push(pts[j]);
      i = j;
    }
    const last = out[out.length - 1];
    if (!last || Math.hypot(last.x - b.x, last.z - b.z) > 0.05) out.push({ x: b.x, z: b.z });
    return out;
  }
}

// ---- fila de prioridade (heap binário de pares [nó, f] achatados)
function push(heap, node, f) {
  let i = heap.length;
  heap.push(node, f);
  while (i > 0) {
    const p = (((i >> 1) - 1) >> 1) << 1;
    if (heap[p + 1] <= f) break;
    heap[i] = heap[p]; heap[i + 1] = heap[p + 1];
    i = p;
  }
  heap[i] = node; heap[i + 1] = f;
}

function pop(heap) {
  const top = heap[0], f = heap.pop(), node = heap.pop(), n = heap.length;
  if (n) {
    let i = 0;
    for (;;) {
      let c = i * 2 + 2;
      if (c >= n) break;
      if (c + 2 < n && heap[c + 3] < heap[c + 1]) c += 2;
      if (heap[c + 1] >= f) break;
      heap[i] = heap[c]; heap[i + 1] = heap[c + 1];
      i = c;
    }
    heap[i] = node; heap[i + 1] = f;
  }
  return top;
}
