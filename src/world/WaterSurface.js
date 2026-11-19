/**
 * Interface única da superfície da água para quem flutua ou nada (animais, objetos, scripts):
 *
 *   surface.getHeightAt(x, z)     altura da água (m) — ondas da FFT incluídas
 *   surface.getNormalAt(x, z, out) normal da superfície (diferenças centrais, ±`spacing` m)
 *   surface.getVelocityAt(x, z, out) velocidade da superfície: só a VERTICAL (dh/dt) é conhecida
 *   surface.getDepthAt(x, z)      profundidade até o fundo (m; ≤ 0 = terra)
 *
 * De onde vêm os números: a altura das ondas é a MESMA que a água desenhada, calculada na GPU
 * (`WaterQuery`) e lida de volta 1–3 quadros depois. Aqui há um conjunto de `slots` pontos de
 * consulta reaproveitados: o pedido de (x, z) ocupa o slot mais antigo e, a partir do quadro em
 * que a resposta chega, devolve a altura real. Até lá (ou sem oceano FFT, ou fora dos slots)
 * devolve o nível da água parada — por isso quem precisa de MUITOS pontos rápidos, como o casco
 * do barco, continua com slots próprios.
 *
 * Velocidade horizontal das partículas da onda não é calculada (a FFT só dá altura aqui):
 * `getVelocityAt` devolve x = z = 0.
 *
 * @example
 *   const s = new WaterSurface({ query: water.query, ocean: water.ocean, level: 0, terrainAt: (x, z) => terrain.heightAt(x, z) });
 *   // a cada quadro, para cada coisa boiando:
 *   y = s.getHeightAt(x, z) - calado;
 *   if (s.getDepthAt(x, z) > 0.6) nadando = true;
 */
export class WaterSurface {
  /**
   * @param {{ query?: object|null, ocean?: { time: number }|null, level: number,
   *   terrainAt: (x: number, z: number) => number, slots?: number, cell?: number, spacing?: number }} o
   *   `cell`: pontos a menos de `cell` m reaproveitam a mesma consulta.
   */
  constructor({ query = null, ocean = null, level = 0, terrainAt, slots = 12, cell = 1, spacing = 1.2 }) {
    this.query = query;
    this.ocean = ocean;
    this.level = level;
    this.terrainAt = terrainAt;
    this.cell = cell;
    this.spacing = spacing;
    /** Slots da GPU deste conjunto: { slot, key, used, since } */
    this.pool = [];
    if (query) {
      for (let i = 0; i < slots; i++) {
        try { this.pool.push({ slot: query.alloc(), key: null, used: -1, since: Infinity }); } catch { break; }
      }
    }
    this.frame = 0;
    this._v = { x: 0, y: 0, z: 0 };
  }

  /** Avança o relógio do conjunto (chamar uma vez por quadro, antes de consultar). */
  tick() {
    this.frame++;
  }

  /** Slot da GPU para (x, z), ou null se ainda não há resposta para esse ponto. */
  slotFor(x, z) {
    if (!this.pool.length || !this.query?.valid) return null;
    const c = this.cell, key = `${Math.round(x / c)},${Math.round(z / c)}`;
    let p = this.pool.find((s) => s.key === key);
    if (!p) {
      // o menos usado recentemente
      p = this.pool[0];
      for (const s of this.pool) if (s.used < p.used) p = s;
      p.key = key;
      p.since = this.frame;
      this.query.set(p.slot, x, z);
    }
    p.used = this.frame;
    // A resposta da GPU para um ponto novo leva até 3 quadros.
    return this.frame - p.since >= 3 ? p.slot : null;
  }

  /** Altura da água (m) em (x, z). */
  getHeightAt(x, z) {
    const s = this.slotFor(x, z);
    if (s === null) return this.level;
    return this.query.height(s, this.ocean?.time);
  }

  /** Profundidade da água até o fundo (m) em (x, z); ≤ 0 em terra. Usa a água parada (sem onda). */
  getDepthAt(x, z) {
    return this.level - this.terrainAt(x, z);
  }

  /**
   * Normal da superfície (unitária) em (x, z), por diferenças centrais.
   * @param {{x: number, y: number, z: number}} [out]
   */
  getNormalAt(x, z, out = { x: 0, y: 1, z: 0 }) {
    const e = this.spacing;
    const dx = (this.getHeightAt(x + e, z) - this.getHeightAt(x - e, z)) / (2 * e);
    const dz = (this.getHeightAt(x, z + e) - this.getHeightAt(x, z - e)) / (2 * e);
    const l = Math.hypot(dx, 1, dz);
    out.x = -dx / l; out.y = 1 / l; out.z = -dz / l;
    return out;
  }

  /**
   * Velocidade da superfície em (x, z): só a vertical (dh/dt, m/s) — ver nota no topo.
   * @param {{x: number, y: number, z: number}} [out]
   */
  getVelocityAt(x, z, out = this._v) {
    const s = this.slotFor(x, z);
    out.x = 0; out.z = 0;
    out.y = s === null ? 0 : Math.max(-4, Math.min(4, this.query.rates[s]));
    return out;
  }
}
