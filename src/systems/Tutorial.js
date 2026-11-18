/**
 * Tutorial de sobrevivência (máquina de passos pura, testável).
 * Cada passo espera um evento (`notify(evento, valor)`) e avança sozinho
 * quando o acumulado chega em `need`.
 *
 * Eventos: 'walk' (metros), 'sprint' (s), 'zoom', 'punch', 'inventory',
 * 'craft', 'food', 'campfire', 'skill'.
 */
export const TUTORIAL_STEPS = [
  { id: 'mover', titulo: 'Movimentação', texto: 'Use <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> para caminhar pela costa do deserto.', event: 'walk', need: 8 },
  { id: 'correr', titulo: 'Correr', texto: 'Segure <kbd>SHIFT</kbd> para correr (consome Energia/Estamina).', event: 'sprint', need: 1.2 },
  { id: 'zoom', titulo: 'Zoom', texto: 'Segure ou pressione <kbd>C</kbd> para dar Zoom na visão e observar o horizonte.', event: 'zoom', need: 1 },
  { id: 'bater', titulo: 'Bater', texto: 'Pressione o <kbd>Botão Esquerdo do Mouse</kbd> para bater.', event: 'punch', need: 3 },
  { id: 'inventario', titulo: 'Inventário', texto: 'Pressione <kbd>I</kbd> ou <kbd>TAB</kbd> para abrir o Inventário. Recolha galhos e pedras na areia com <kbd>E</kbd>.', event: 'inventory', need: 1 },
  { id: 'craftar', titulo: 'Craftar', texto: 'Abra o menu de Craft e combine materiais coletados para criar uma Fogueira.', event: 'craft', need: 1 },
  { id: 'fome', titulo: 'Fome', texto: 'Acompanhe sua barra de Fome no HUD: ela diminui com o tempo. Consuma alimentos para recuperá-la.', event: 'food', need: 1 },
  { id: 'fogueira', titulo: 'Fogueira', texto: 'Posicione e acenda a Fogueira na areia para iluminar o ambiente e cozinhar.', event: 'campfire', need: 1 },
  { id: 'skills', titulo: 'Árvore de Skills', texto: 'Pressione <kbd>K</kbd> para abrir a Árvore de Skills e evoluir Vida, Energia ou Força.', event: 'skill', need: 1, grantXp: true },
];

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
