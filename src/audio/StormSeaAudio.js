/**
 * Áudio do naufrágio, sintetizado com Web Audio (o jogo não tem arquivos de som):
 *  - chuva (chiado agudo constante),
 *  - mar revolto (ronco grave + ondas quebrando a cada poucos segundos),
 *  - respiração ofegante (inspira/expira; mais rápida e pesada com a exaustão),
 *  - braçadas (respingos no ritmo do nado; mais fortes no sprint).
 * Tudo passa por um passa-baixa comum: debaixo d'água, o mundo fica abafado.
 *
 * O contexto precisa nascer de um gesto do jogador (o clique em "Novo Jogo").
 *
 * @example
 *   const sea = new StormSeaAudio(PROLOGUE.audio);
 *   sea.start();                       // dentro do clique
 *   sea.update(dt, { paused, underwater, exhaustion, moving, sprint, headAbove });
 *   sea.stop();
 */
export class StormSeaAudio {
  constructor(cfg) {
    this.cfg = cfg;
    this.ctx = null;
    this.on = false;
    this.nextCrash = 0;
    this.nextBreath = 0;
    this.nextStroke = 0;
    this.breathIn = true;
  }

  /** Cria o contexto e as camadas contínuas. Chamar dentro de um gesto (clique/tecla). */
  start() {
    const AC = typeof window !== 'undefined' ? (window.AudioContext ?? window.webkitAudioContext) : null;
    if (!AC) return;
    if (!this.ctx) {
      const ctx = this.ctx = new AC();
      this.white = this.noise(2, 'white');
      this.brown = this.noise(4, 'brown');
      this.out = ctx.createBiquadFilter();
      this.out.type = 'lowpass';
      this.out.frequency.value = 20000;
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      this.out.connect(this.master).connect(ctx.destination);
      // Chuva: ruído branco em banda alta.
      this.rain = this.loop(this.white, 'bandpass', 4200, 0.6, this.cfg.rain);
      // Mar: ruído marrom grave (o "corpo" das ondas).
      this.sea = this.loop(this.brown, 'lowpass', 520, 0.7, this.cfg.waves * 0.55);
    }
    this.ctx.resume?.();
    this.master.gain.setTargetAtTime(this.cfg.master, this.ctx.currentTime, 0.6);
    this.on = true;
  }

  /** Para tudo (fade curto). */
  stop() {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    this.on = false;
  }

  /** Buffer de ruído (branco ou marrom). */
  noise(seconds, kind) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }

  /** Camada contínua: ruído em laço → filtro → ganho → saída. */
  loop(buffer, type, freq, q, vol) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.out);
    src.start();
    return { src, f, g };
  }

  /** Um evento curto de ruído com envelope (onda quebrando, respiração, respingo). */
  burst(buffer, type, freq, q, peak, attack, hold, release, pan = 0, rate = 1) {
    const ctx = this.ctx, t0 = ctx.currentTime + 0.01;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
    g.gain.setValueAtTime(Math.max(0.0002, peak), t0 + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
    let node = src.connect(f).connect(g);
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(this.out);
    src.start(t0, Math.random() * Math.max(0, buffer.duration - (attack + hold + release) * rate - 0.05));
    src.stop(t0 + attack + hold + release + 0.05);
  }

  /**
   * Um quadro.
   * @param {number} dt
   * @param {{ paused?: boolean, underwater?: boolean, exhaustion?: number, moving?: boolean, sprint?: boolean, headAbove?: boolean, drowning?: boolean }} s
   */
  update(dt, s) {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx, C = this.cfg;
    // Esc: o áudio para junto com o jogo.
    if (s.paused) { if (ctx.state === 'running') ctx.suspend(); return; }
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    this.out.frequency.setTargetAtTime(s.underwater ? C.underwaterCutoff : 20000, now, 0.12);
    this.rain.g.gain.setTargetAtTime(C.rain * (s.underwater ? 0.25 : 1), now, 0.3);
    // Ondas quebrando: a cada 3–8 s, de um lado ou de outro.
    if (now >= this.nextCrash) {
      const pan = Math.random() * 1.6 - 0.8;
      this.burst(this.brown, 'lowpass', 900 + Math.random() * 500, 0.5, C.waves * (0.7 + Math.random() * 0.5), 0.35, 0.4, 2.2, pan, 1.4);
      this.burst(this.white, 'bandpass', 1500, 0.7, C.waves * 0.18, 0.2, 0.3, 1.6, pan); // espuma
      this.nextCrash = now + 3 + Math.random() * 5;
    }
    // Respiração: só com a cabeça fora d'água; mais rápida/alta com a exaustão (e no sprint).
    const e = Math.min(1, Math.max(0, s.exhaustion ?? 0));
    if (s.headAbove && !s.drowning && now >= this.nextBreath) {
      const period = (3.4 - 1.8 * e) * (s.sprint ? 0.75 : 1);
      const vol = C.breath * (0.45 + 0.75 * e) * (s.sprint ? 1.2 : 1);
      if (this.breathIn) this.burst(this.white, 'bandpass', 1300 + 500 * e, 1.2, vol * 0.8, 0.12, period * 0.18, 0.25);
      else this.burst(this.white, 'bandpass', 700 + 300 * e, 0.9, vol, 0.05, period * 0.12, 0.45 + 0.3 * e);
      this.nextBreath = now + period * (this.breathIn ? 0.42 : 0.58);
      this.breathIn = !this.breathIn;
    }
    // Braçadas: respingos no ritmo do nado.
    if (s.moving && !s.drowning && now >= this.nextStroke) {
      const side = this.strokeSide = -(this.strokeSide ?? 1);
      this.burst(this.white, 'highpass', 1800, 0.6, C.stroke * (s.sprint ? 1.4 : 1), 0.02, 0.06, 0.3, side * 0.35);
      this.nextStroke = now + (s.sprint ? 0.42 : 0.65);
    }
  }
}
