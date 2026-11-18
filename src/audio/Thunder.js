/**
 * Trovão sintetizado com Web Audio (o jogo ainda não tem arquivos de som):
 * ruído marrom filtrado em graves, com estalo inicial e ronco longo.
 * O navegador só libera áudio depois de um clique/tecla, então o contexto
 * nasce no primeiro gesto do jogador; antes disso os trovões são ignorados.
 *
 * @example
 * const thunder = new Thunder({ volume: 0.6 });
 * thunder.thunder(1.2, 0.8); // em 1,2 s, força 0.8
 */
export class Thunder {
  /** @param {{ volume?: number }} [o] */
  constructor({ volume = 0.6 } = {}) {
    this.volume = volume;
    this.ctx = null;
    this.buffer = null;
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.init();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  /** Cria o contexto e um ruído marrom de 4 s (reaproveitado em todo trovão). */
  init() {
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC || this.ctx) return;
    this.ctx = new AC();
    // Saída comum: um passa-baixa que normalmente deixa tudo passar (debaixo d'água, abafa).
    this.out = this.ctx.createBiquadFilter();
    this.out.type = 'lowpass';
    this.out.frequency.value = 20000;
    this.out.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 4;
    this.buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
  }

  /**
   * Abafa os trovões (câmera debaixo d'água).
   * @param {number|null} cutoff Hz do passa-baixa; null = som normal
   */
  setMuffled(cutoff) {
    if (!this.out) return;
    this.out.frequency.setTargetAtTime(cutoff ?? 20000, this.ctx.currentTime, 0.15);
  }

  /**
   * Toca um trovão.
   * @param {number} delay segundos até o som (luz chega antes do som)
   * @param {number} strength 0..1 (longe = fraco)
   * @param {number} [pan] -1 (esquerda) .. 1 (direita): de que lado caiu o raio
   */
  thunder(delay, strength, pan = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.buffer || strength <= 0.02) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = 0.7 + Math.random() * 0.3;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, t0);
    filter.frequency.exponentialRampToValueAtTime(140, t0 + 2.5);
    const gain = ctx.createGain();
    const peak = this.volume * Math.min(1, strength);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.06);
    gain.gain.exponentialRampToValueAtTime(peak * 0.5, t0 + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.8);
    // Espacial: o som vem do lado do raio (o ronco longo se espalha um pouco).
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    let node = src.connect(filter).connect(gain);
    if (panner) {
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t0);
      panner.pan.linearRampToValueAtTime(Math.max(-1, Math.min(1, pan)) * 0.4, t0 + 3);
      node = node.connect(panner);
    }
    node.connect(this.out ?? ctx.destination);
    src.start(t0);
    src.stop(t0 + 4);
  }
}
