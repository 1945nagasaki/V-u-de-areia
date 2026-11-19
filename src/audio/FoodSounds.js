/**
 * Sons da comida, sintetizados com Web Audio (o jogo não tem arquivos de som):
 *  - chew(): mastigar (estalos abafados em sequência),
 *  - pickup(pan): coletar do chão (baque curto + roçar),
 *  - setSizzle(level, pan): chiado contínuo da fogueira assando (0 = mudo).
 * `pan` (-1..1) põe o som no lado certo; `level` já vem atenuado pela distância.
 * O contexto nasce no primeiro uso (sempre depois de um gesto do jogador).
 *
 * @example
 *   const fx = new FoodSounds();
 *   fx.chew();
 *   fx.setSizzle(0.6, -0.3); // fogueira à esquerda, perto
 */
export class FoodSounds {
  constructor({ volume = 0.5 } = {}) {
    this.volume = volume;
    this.ctx = null;
    this.sizzle = null;
  }

  /** Cria o contexto (preguiçoso). @returns {AudioContext|null} */
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume?.(); return this.ctx; }
    const AC = typeof window !== 'undefined' ? (window.AudioContext ?? window.webkitAudioContext) : null;
    if (!AC) return null;
    const ctx = this.ctx = new AC();
    const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = b;
    this.out = ctx.createGain();
    this.out.gain.value = this.volume;
    this.out.connect(ctx.destination);
    return ctx;
  }

  /** Um estalo de ruído filtrado com envelope. */
  burst(t0, { freq, q = 1, type = 'bandpass', peak, attack = 0.01, release = 0.12, pan = 0 }) {
    const ctx = this.ctx, src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);
    let node = src.connect(f).connect(g);
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(this.out);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + attack + release + 0.05);
  }

  /** Mastigar: 4 mordidas abafadas. */
  chew() {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime + 0.02;
    for (let i = 0; i < 4; i++) {
      this.burst(t + i * 0.22, { freq: 520 + Math.random() * 260, q: 1.4, peak: 0.5, attack: 0.015, release: 0.12 });
      this.burst(t + i * 0.22 + 0.05, { freq: 1800, q: 2, peak: 0.12, attack: 0.005, release: 0.05 });
    }
  }

  /** Coletar algo do chão. */
  pickup(pan = 0) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime + 0.01;
    this.burst(t, { type: 'lowpass', freq: 380, peak: 0.6, attack: 0.008, release: 0.14, pan });
    this.burst(t + 0.04, { freq: 2400, q: 0.8, peak: 0.15, attack: 0.02, release: 0.18, pan });
  }

  /**
   * Chiado da fogueira assando. Chamar a cada quadro (barato: só ajusta ganhos).
   * @param {number} level 0..1 (0 desliga)
   * @param {number} pan -1..1
   */
  setSizzle(level, pan = 0) {
    if (level <= 0 && !this.sizzle) return;
    if (!this.ensure()) return;
    const ctx = this.ctx;
    if (!this.sizzle) {
      const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2600;
      const g = ctx.createGain(); g.gain.value = 0;
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      let node = src.connect(hp).connect(g);
      if (p) node = node.connect(p);
      node.connect(this.out);
      src.start();
      this.sizzle = { g, p, nextPop: 0 };
    }
    const s = this.sizzle, now = ctx.currentTime;
    s.g.gain.setTargetAtTime(0.16 * level, now, 0.15);
    if (s.p) s.p.pan.setTargetAtTime(pan, now, 0.1);
    // Estalos de gordura pingando no fogo.
    if (level > 0 && now >= s.nextPop) {
      this.burst(now + 0.01, { freq: 3200 + Math.random() * 2000, q: 3, peak: 0.25 * level, attack: 0.003, release: 0.04, pan });
      s.nextPop = now + 0.12 + Math.random() * 0.5;
    }
  }
}
