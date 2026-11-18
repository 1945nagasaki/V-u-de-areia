import { PROLOGUE } from '../config/survival.js';

/**
 * Regras puras do prólogo no mar e da chegada à Costa do Deserto.
 *
 * Fases: 'ocean' (nado na tempestade, cronômetro de 10 min) → 'shore' (pisou
 * na areia: tempestade se dissipa) → 'clear' (céu limpo, tutorial rodando).
 */
export class Landfall {
  constructor(cfg = PROLOGUE) {
    this.cfg = cfg;
    this.phase = 'ocean';
    this.timeLeft = cfg.drownSeconds;
    this.clearT = 0; // 0..1 da transição tempestade → céu limpo
  }

  /** 1 = tempestade cheia, 0 = céu limpo. */
  get storm() {
    return this.phase === 'ocean' ? 1 : 1 - this.clearT;
  }

  /**
   * @param {number} dt
   * @param {{ onLand: boolean }} st jogador pisando em terra (não nadando)
   * @returns {'landed'|'drowned'|'cleared'|null} evento deste quadro
   */
  update(dt, { onLand }) {
    if (this.phase === 'ocean') {
      if (onLand) {
        this.phase = 'shore';
        return 'landed';
      }
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      if (this.timeLeft === 0) {
        this.timeLeft = this.cfg.drownSeconds; // recomeça após renascer no mar
        return 'drowned';
      }
      return null;
    }
    if (this.phase === 'shore') {
      this.clearT = Math.min(1, this.clearT + dt / this.cfg.clearSeconds);
      if (this.clearT === 1) {
        this.phase = 'clear';
        return 'cleared';
      }
    }
    return null;
  }

  /** Pula direto ao fim (checkpoint carregado depois da chegada). */
  skip() {
    this.phase = 'clear';
    this.clearT = 1;
  }
}

/**
 * Pode sair do OCEANO para a terra neste ponto? Só na Costa do Deserto.
 * Fora da faixa oceânica (lago, rios) sempre pode.
 * @param {{ edgeDistance: number, desertWeight: number }} p
 */
export function canMakeLandfall({ edgeDistance, desertWeight }, cfg = PROLOGUE) {
  if (edgeDistance > cfg.oceanBand) return true;
  return desertWeight >= cfg.desertThreshold;
}

/**
 * Formata segundos em "MM:SS".
 */
export function formatClock(s) {
  const t = Math.max(0, Math.ceil(s));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/**
 * Acha a linha da praia na costa leste em `z`: anda do mar (x máximo) para
 * dentro até o chão passar de `minHeight`.
 * @param {(x:number,z:number)=>number} heightAt
 */
export function findShoreX(heightAt, z, { fromX, toX, step = 2, minHeight = 0.4 }) {
  for (let x = fromX; x > toX; x -= step) if (heightAt(x, z) >= minHeight) return x;
  return toX;
}
