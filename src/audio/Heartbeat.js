/**
 * Batimento cardíaco (WebAudio, sem arquivos): "tum-tum" grave cuja
 * frequência sobe com a intensidade (0..1). Usado pela Zoofobia.
 *
 * @example
 *   const hb = new Heartbeat({ volume: 0.35 });
 *   hb.update(dt, 0.8); // a cada quadro; 0 = silêncio
 */
export class Heartbeat {
  constructor({ volume = 0.35, minBpm = 80, maxBpm = 150 } = {}) {
    this.volume = volume;
    this.minBpm = minBpm;
    this.maxBpm = maxBpm;
    this.ctx = null;
    this._next = 0;
    if (typeof window === 'undefined') return;
    const unlock = () => {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (AC && !this.ctx) this.ctx = new AC();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  /**
   * @param {number} dt s
   * @param {number} intensity 0..1 (0 = parado)
   */
  update(dt, intensity) {
    if (intensity <= 0) { this._next = 0; return; }
    this._next -= dt;
    if (this._next > 0) return;
    this._next = 60 / (this.minBpm + (this.maxBpm - this.minBpm) * Math.min(1, intensity));
    this.beat(intensity);
  }

  /** Um "tum-tum". */
  beat(intensity = 1) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime, v = this.volume * (0.5 + 0.5 * Math.min(1, intensity));
    for (const [start, f, k] of [[0, 62, 1], [0.16, 52, 0.7]]) {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t0 + start);
      osc.frequency.exponentialRampToValueAtTime(f * 0.6, t0 + start + 0.12);
      g.gain.setValueAtTime(0, t0 + start);
      g.gain.linearRampToValueAtTime(v * k, t0 + start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + 0.16);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + 0.18);
    }
  }
}
