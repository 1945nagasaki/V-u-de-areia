import { FOOD_WEB } from '../../config/foodWeb.js';

/**
 * Vegetação como recurso (regra pura, sem Three.js): o mundo dividido em
 * células; cada célula tem capim (`grass`) e folhagem (`browse`) de 0 até a
 * capacidade do lugar, perde o que os animais comem e rebrota com o tempo.
 *
 * Preguiçoso: a célula só existe depois de consultada e a rebrota é calculada
 * na hora da consulta (pelo tempo passado) — custo zero por quadro, não
 * importa o tamanho do mapa.
 *
 * @example
 *   const field = new ForageField(FOOD_WEB.field, { capacityAt: (x, z) => ({ grass: 0.9, browse: 0.3 }) });
 *   const spot = field.findBest(x, z, ['grass'], 90, now);   // { x, z, kind, amount } | null
 *   const eaten = field.consume(spot.x, spot.z, 'grass', 0.02 * dt, now); // o que saiu de fato
 */
export class ForageField {
  /**
   * @param {typeof FOOD_WEB.field} cfg
   * @param {{ capacityAt: (x: number, z: number) => { grass: number, browse: number } }} env
   */
  constructor(cfg = FOOD_WEB.field, { capacityAt }) {
    this.cfg = cfg;
    this.capacityAt = capacityAt;
    /** @type {Map<number, { grass: number, browse: number, capGrass: number, capBrowse: number, t: number }>} */
    this.cells = new Map();
  }

  key(i, j) {
    return (i + 32768) * 65536 + (j + 32768);
  }

  /** Célula (i, j) já com a rebrota aplicada até `now`. */
  cell(i, j, now) {
    const k = this.key(i, j);
    let c = this.cells.get(k);
    if (!c) {
      const s = this.cfg.cell, cap = this.capacityAt((i + 0.5) * s, (j + 0.5) * s);
      const g = Math.min(this.cfg.maxCapacity, Math.max(0, cap.grass)), b = Math.min(this.cfg.maxCapacity, Math.max(0, cap.browse));
      c = { grass: g, browse: b, capGrass: g, capBrowse: b, t: now };
      this.cells.set(k, c);
      return c;
    }
    const dt = now - c.t;
    if (dt > 0) {
      const r = this.cfg.regrowPerSecond * dt;
      c.grass = Math.min(c.capGrass, c.grass + c.capGrass * r);
      c.browse = Math.min(c.capBrowse, c.browse + c.capBrowse * r);
      c.t = now;
    }
    return c;
  }

  /** Quanto há de `kind` em (x, z). */
  amount(x, z, kind, now) {
    const s = this.cfg.cell;
    return this.cell(Math.floor(x / s), Math.floor(z / s), now)[kind];
  }

  /**
   * Come até `want` de `kind` em (x, z).
   * @returns {number} o que saiu de fato (0 = rapado)
   */
  consume(x, z, kind, want, now) {
    const s = this.cfg.cell, c = this.cell(Math.floor(x / s), Math.floor(z / s), now);
    const taken = Math.min(c[kind], Math.max(0, want));
    c[kind] -= taken;
    return taken;
  }

  /**
   * Melhor pedaço num raio: muito alimento e perto (quantidade ÷ distância em células).
   * @param {string[]} kinds recursos aceitos ('grass', 'browse')
   * @param {number} [min] quantidade mínima para valer a viagem
   * @returns {{ x: number, z: number, kind: string, amount: number } | null} centro da célula
   */
  findBest(x, z, kinds, radius, now, min = 0.05) {
    const s = this.cfg.cell, n = Math.ceil(radius / s);
    const i0 = Math.floor(x / s), j0 = Math.floor(z / s);
    let best = null, bs = 0;
    for (let di = -n; di <= n; di++) {
      for (let dj = -n; dj <= n; dj++) {
        const cx = (i0 + di + 0.5) * s, cz = (j0 + dj + 0.5) * s;
        const d = Math.hypot(cx - x, cz - z);
        if (d > radius) continue;
        const c = this.cell(i0 + di, j0 + dj, now);
        for (const kind of kinds) {
          const a = c[kind];
          if (a < min) continue;
          const score = a / (1 + d / s);
          if (score > bs) { bs = score; best = { x: cx, z: cz, kind, amount: a }; }
        }
      }
    }
    return best;
  }
}

/**
 * Capacidade de pasto/folhagem de um bioma, a partir da mesma configuração
 * que planta a vegetação (config/biomes.js).
 * @param {{ grass?: { density: number }, vegetation?: { type: string, density: number }[] }} biome
 * @returns {{ grass: number, browse: number }} 0..1
 * @example biomeCapacity(BIOMES[0]); // savana: { grass: 0.95, browse: ≈0.8 }
 */
export function biomeCapacity(biome, cfg = FOOD_WEB.field) {
  let browse = 0;
  for (const v of biome?.vegetation ?? []) if (cfg.browseTypes.includes(v.type)) browse += v.density;
  return { grass: Math.min(1, biome?.grass?.density ?? 0), browse: Math.min(1, browse * cfg.browsePerDensity) };
}

/**
 * Ponto de beber mais próximo: procura água em anéis e devolve o último ponto
 * de TERRA antes dela (o animal bebe da margem, olhando para a água).
 * @param {(x: number, z: number) => boolean} isWater
 * @returns {{ x: number, z: number, wx: number, wz: number } | null}
 * @example findShore((x, z) => heightAt(x, z) < 0, 10, 10, 200);
 */
export function findShore(isWater, x, z, radius, step = 8, dirs = 16) {
  if (isWater(x, z)) return null; // já está dentro d'água
  for (let r = step; r <= radius; r += step) {
    for (let k = 0; k < dirs; k++) {
      const a = (k / dirs) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
      if (!isWater(x + cx * r, z + cz * r)) continue;
      // Volta para a margem em passos curtos até pisar em terra.
      let rr = r;
      while (rr > 0 && isWater(x + cx * rr, z + cz * rr)) rr -= 1;
      return { x: x + cx * rr, z: z + cz * rr, wx: x + cx * r, wz: z + cz * r };
    }
  }
  return null;
}
