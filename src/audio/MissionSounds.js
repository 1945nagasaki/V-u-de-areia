import { MISSION_FX } from '../config/missions.js';

/**
 * Som de missão concluída (Web Audio, sem arquivos): arpejo curto e brilhante.
 * O AudioContext nasce no primeiro clique/tecla (regra de autoplay dos navegadores).
 *
 * @example
 *   const s = new MissionSounds();
 *   s.complete();
 */
export class MissionSounds {
  constructor(cfg = MISSION_FX.sound) {
    this.cfg = cfg;
    this.ctx = null;
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.context();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  /** AudioContext (cria se o navegador tiver). */
  context() {
    if (this.ctx || typeof window === 'undefined') return this.ctx;
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (AC) this.ctx = new AC();
    return this.ctx;
  }

  /** Toca o arpejo de "missão concluída". */
  complete() {
    const ctx = this.context();
    if (!ctx) return false;
    if (ctx.state === 'suspended') ctx.resume?.();
    const { volume, notes, noteGap, noteLength } = this.cfg;
    const t0 = ctx.currentTime + 0.02;
    notes.forEach((f, i) => {
      const t = t0 + i * noteGap;
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = i === notes.length - 1 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(volume, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0008, t + noteLength * (i === notes.length - 1 ? 2 : 1));
      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + noteLength * 2 + 0.05);
    });
    return true;
  }
}
