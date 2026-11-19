/**
 * Cronômetro de exaustão/afogamento do prólogo (puro: só números).
 *
 * - Conta só com `tick(dt)` — o jogo passa dt = 0 quando está pausado (Esc), então
 *   a pausa congela o tempo sem lógica extra.
 * - `exhaustion` (0..1) sobe em degraus suaves (7, 8 e 9 minutos por padrão).
 * - `expired` quando o tempo acaba; `stop()` (chegou à ilha) congela e zera o perigo.
 *
 * @example
 *   const t = new DrowningTimer(PROLOGUE.timer);
 *   t.tick(dt);           // a cada quadro, enquanto está na água
 *   t.remaining;          // s que faltam
 *   t.exhaustion;         // 0..1 (respiração, vinheta, sprint mais lento)
 *   t.expired;            // true → sequência de afogamento
 */
export class DrowningTimer {
  /** @param {{ seconds: number, exhaustionSteps: {at:number, level:number}[], exhaustionRamp: number, warnAt?: number[] }} cfg */
  constructor(cfg) {
    this.cfg = cfg;
    this.reset();
  }

  reset() {
    this.elapsed = 0;
    this.running = true;
    this.stopped = false;
    this._warned = new Set();
  }

  /** @returns {number[]} avisos (em s) que acabaram de ser cruzados neste passo */
  tick(dt) {
    if (!this.running || dt <= 0) return [];
    const before = this.elapsed;
    this.elapsed = Math.min(this.cfg.seconds, this.elapsed + dt);
    const crossed = [];
    for (const w of this.cfg.warnAt ?? []) if (before < w && this.elapsed >= w && !this._warned.has(w)) { this._warned.add(w); crossed.push(w); }
    return crossed;
  }

  /** Chegou à ilha: o cronômetro para e não conta mais. */
  stop() {
    this.running = false;
    this.stopped = true;
  }

  get remaining() { return Math.max(0, this.cfg.seconds - this.elapsed); }
  get expired() { return !this.stopped && this.elapsed >= this.cfg.seconds; }

  /** 0..1: soma suave dos degraus já alcançados. */
  get exhaustion() {
    if (this.stopped) return 0;
    // Cada degrau sobe do nível anterior até o seu, em `exhaustionRamp` s (suave).
    let level = 0, prev = 0;
    for (const s of this.cfg.exhaustionSteps) {
      if (this.elapsed < s.at) break; // degraus em ordem: os seguintes ainda não começaram
      const u = Math.min(1, (this.elapsed - s.at) / this.cfg.exhaustionRamp);
      const k = u * u * (3 - 2 * u);
      level = Math.max(level, prev + (s.level - prev) * k);
      prev = s.level;
    }
    return Math.min(1, level);
  }

  /** "09:59" */
  get label() {
    const r = Math.ceil(this.remaining);
    return `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
  }
}
