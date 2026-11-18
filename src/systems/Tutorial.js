/**
 * Tutorial de sobrevivência (máquina de passos pura, testável).
 * Cada passo espera um evento (`notify(evento, valor)`) e avança sozinho
 * quando o acumulado chega em `need`. Os passos vêm de config/progression.js.
 *
 * Eventos: 'walk' (metros), 'sprint' (s), 'zoom', 'punch', 'inventory',
 * 'craft', 'food', 'campfire', 'skill'.
 */
import { TUTORIAL_STEPS } from '../config/progression.js';

export { TUTORIAL_STEPS };

export class Tutorial {
  constructor(steps = TUTORIAL_STEPS) {
    this.steps = steps;
    this.index = -1; // -1 = não começou
    this.progress = 0;
    this.listeners = [];
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  emit(evt) {
    for (const fn of this.listeners) fn(evt);
  }

  get active() {
    return this.index >= 0 && this.index < this.steps.length;
  }

  get done() {
    return this.index >= this.steps.length;
  }

  get step() {
    return this.active ? this.steps[this.index] : null;
  }

  start(at = 0) {
    this.index = at;
    this.progress = 0;
    if (this.active) this.emit({ type: 'step', step: this.step, index: this.index });
    else this.emit({ type: 'done' });
  }

  /** Informa uma ação do jogador. @returns {boolean} true se o passo avançou */
  notify(event, value = 1) {
    const s = this.step;
    if (!s || s.event !== event) return false;
    this.progress += value;
    this.emit({ type: 'progress', step: s, fraction: Math.min(1, this.progress / s.need) });
    if (this.progress < s.need) return false;
    this.emit({ type: 'complete', step: s, index: this.index });
    this.index++;
    this.progress = 0;
    if (this.active) this.emit({ type: 'step', step: this.step, index: this.index });
    else this.emit({ type: 'done' });
    return true;
  }
}
