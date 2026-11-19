import { ITEMS } from '../../systems/PlayerState.js';
import { STATIONS, ALL_RECIPES } from '../../systems/crafting/RecipeRegistry.js';
import { icon } from '../Icons.js';
import { itemIcon } from '../gear/ItemIcon.js';
import { KIND_LABEL } from './ItemTooltip.js';

const SOURCE_ICON = { coleta: 'leaf', caça: 'knife', fogueira: 'flame', loja: 'coin', kit: 'backpack', água: 'wave' };
/** Escala da barra de tempo: a receita mais demorada enche a barra. */
const MAX_TIME = Math.max(1, ...ALL_RECIPES.map((r) => r.craftTime));
const secs = (t) => `${t.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s`;

/**
 * Janela de receita (R / clique) e de usos (U / botão direito), estilo JEI.
 *
 * - **Receita**: uma receita por página; setas < > (ou ←/→) alternam entre
 *   receitas alternativas do mesmo item.
 * - **Usos**: todas as receitas que pedem o item (ingrediente ou ferramenta).
 *
 * Cada receita mostra estação, ingredientes com tem/precisa, resultado,
 * tempo e o botão [+] que preenche a mesa da mochila (pedido ao hub via
 * `onAutoFill`; a janela não mexe no estado). Slots são navegáveis: clique =
 * receita do slot, botão direito = usos; ← volta.
 *
 * @example
 * const v = new RecipeViewer(game, hubEl, { index, tooltip, onAutoFill: (r) => bp.fillTable(r) });
 * v.show('osso', 'uses');
 */
export class RecipeViewer {
  constructor(game, parent, { index, tooltip, onAutoFill }) {
    this.game = game;
    this.index = index;
    this.onAutoFill = onAutoFill;
    this.id = null;
    this.mode = 'recipe';
    this.page = 0;
    this.history = [];
    this.root = document.createElement('div');
    this.root.className = 'jei-modal';
    this.root.hidden = true;
    this.root.innerHTML = '<div class="jei-window" role="dialog" aria-modal="true"></div>';
    parent.appendChild(this.root);
    this.win = this.root.firstElementChild;
    tooltip.attach(this.win);
    this.tooltip = tooltip;

    this.win.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.fill) this.autoFill(b.dataset.fill);
      else if (b.dataset.mode) this.show(this.id, b.dataset.mode, { push: false });
      else if (b.dataset.step) this.step(+b.dataset.step);
      else if (b.classList.contains('jei-back')) this.back();
      else if (b.classList.contains('jei-close')) this.close();
      else if (b.dataset.id) this.show(b.dataset.id, 'recipe');
    });
    this.win.addEventListener('contextmenu', (e) => {
      const s = e.target.closest('[data-id]');
      if (!s) return;
      e.preventDefault();
      this.show(s.dataset.id, 'uses');
    });
    this.root.addEventListener('click', (e) => { if (e.target === this.root) this.close(); });
    window.addEventListener('keydown', (e) => {
      if (!this.open) return;
      if (e.code === 'ArrowLeft') this.step(-1);
      else if (e.code === 'ArrowRight') this.step(1);
      else if (e.code === 'Backspace' && !e.target.closest?.('input')) this.back();
    });
  }

  get open() {
    return !this.root.hidden;
  }

  /**
   * Abre a janela num item.
   * @param {string} id
   * @param {'recipe'|'uses'} mode
   */
  show(id, mode = 'recipe', { push = true } = {}) {
    if (!ITEMS[id]) return;
    if (push && this.open && this.id && (this.id !== id || this.mode !== mode)) this.history.push([this.id, this.mode]);
    if (this.history.length > 30) this.history.shift();
    if (!this.open) this.history = [];
    this.id = id;
    this.mode = mode;
    this.page = 0;
    this.root.hidden = false;
    this.tooltip.hide();
    this.render();
  }

  close() {
    this.root.hidden = true;
    this.tooltip.hide();
  }

  back() {
    const prev = this.history.pop();
    if (prev) this.show(prev[0], prev[1], { push: false });
  }

  /** Página anterior/seguinte (receitas alternativas). */
  step(d) {
    const n = this.index.recipesFor(this.id).length;
    if (this.mode !== 'recipe' || n < 2) return;
    this.page = (this.page + d + n) % n;
    this.render();
  }

  autoFill(recipeId) {
    const r = this.index.recipes.find((x) => x.id === recipeId);
    if (r && this.onAutoFill(r)) this.close();
  }

  /** Re-desenha se estiver aberta (o inventário mudou). */
  refresh() {
    if (this.open) this.render();
  }

  slot(id, need, { tool = false, out = false } = {}) {
    const d = ITEMS[id], have = this.game.state.inventory.get(id) ?? 0, ok = out || have >= need;
    const q = out ? `×${need}` : `${have}/${need}`;
    return `<button class="jei-slot${ok ? ' ok' : ' lack'}${tool ? ' tool' : ''}${out ? ' out' : ''}" data-id="${id}"
      aria-label="${d.name}: ${out ? `produz ${need}` : `tem ${have} de ${need}`}${tool ? ', ferramenta' : ''}">
      <span class="ic">${itemIcon(d)}</span><span class="nm">${d.name}</span>
      <span class="q">${ok || out ? '' : `${icon('alert')} `}${q}${tool ? ` · ${icon('wrench')} não gasta` : ''}</span></button>`;
  }

  card(r) {
    const inv = this.game.state.inventory, ix = this.index;
    const miss = ix.missing(r, inv), can = !Object.keys(miss).length;
    const st = STATIONS[r.station];
    const ins = [...r.ingredients.map((x) => this.slot(x.item, x.amount)), ...r.tools.map((t) => this.slot(t, 1, { tool: true }))];
    const pct = r.craftTime ? Math.max(6, (r.craftTime / MAX_TIME) * 100) : 0;
    let fill;
    if (r.station !== 'HANDS') fill = `<button class="jei-fill" disabled title="Feita em: ${st.name}">${icon(st.icon)} ${st.name}</button>`;
    else if (!can) fill = `<button class="jei-fill" disabled title="Faltam itens">[+] Faltam itens</button>`;
    else fill = `<button class="jei-fill" data-fill="${r.id}" title="Põe os itens na mesa de crafting">[+] Preencher mesa</button>`;
    const missing = Object.entries(miss).map(([id, n]) => `${n}× ${ITEMS[id].name}`).join(', ');
    return `<div class="jei-recipe${can ? ' can' : ''}">
      <div class="jei-station">${icon(st.icon)} <b>${st.name}</b><small>${st.where}</small></div>
      <div class="jei-row">
        <div class="jei-inputs">${ins.join('')}</div>
        <span class="jei-arrow">${icon('next')}</span>
        ${this.slot(r.output.item, r.output.amount, { out: true })}
      </div>
      <div class="jei-time"><span>Tempo</span><div class="jei-bar" role="img" aria-label="${r.craftTime ? secs(r.craftTime) : 'na hora'}"><i style="width:${pct}%"></i></div><b>${r.craftTime ? secs(r.craftTime) : 'na hora'}</b></div>
      <div class="jei-rfoot"><span>${can ? `${icon('check')} Você tem tudo.` : `Falta: ${missing}`}${r.hint ? ` · ${r.hint}` : ''}</span>${fill}</div>
    </div>`;
  }

  render() {
    const id = this.id, d = ITEMS[id], ix = this.index;
    const make = ix.recipesFor(id), uses = ix.usesOf(id), have = this.game.state.inventory.get(id) ?? 0;
    const fx = ix.effectsOf(id), src = ix.sourcesOf(id);
    let body;
    if (this.mode === 'recipe') {
      if (make.length) {
        const pager = make.length > 1
          ? `<div class="jei-pager"><button data-step="-1" aria-label="Receita anterior">&lt;</button><span>Receita ${this.page + 1} de ${make.length}</span><button data-step="1" aria-label="Próxima receita">&gt;</button></div>`
          : '';
        body = pager + this.card(make[this.page]);
      } else body = '<p class="jei-none">Este item não se fabrica. Veja abaixo onde conseguir.</p>';
    } else {
      body = uses.length
        ? `<p class="jei-sub">Usado em ${uses.length} receita${uses.length > 1 ? 's' : ''}:</p>${uses.map((r) => this.card(r)).join('')}`
        : '<p class="jei-none">Não é ingrediente nem ferramenta de nenhuma receita.</p>';
    }
    const sources = src.length
      ? `<div class="jei-sources"><b>Onde conseguir</b><ul>${src.map((s) => `<li>${icon(SOURCE_ICON[s.kind] ?? 'dot')} <em>${s.kind}</em> ${s.text}</li>`).join('')}</ul></div>`
      : '';
    this.win.innerHTML = `
      <div class="jei-wtop">
        <button class="jei-back" ${this.history.length ? '' : 'disabled'} aria-label="Voltar">←</button>
        <span class="jei-big">${itemIcon(d)}</span>
        <div class="jei-title"><b>${d.name}</b><small>${KIND_LABEL[d.kind] ?? ''} · você tem ${have}${ix.tagsOf(id).length ? ` · ${ix.tagsOf(id).slice(0, 5).map((t) => `#${t}`).join(' ')}` : ''}</small></div>
        <button class="jei-close" aria-label="Fechar">✕</button>
      </div>
      ${d.description ? `<p class="jei-desc">${d.description}</p>` : ''}
      ${fx.length ? `<ul class="jei-fx">${fx.map((t) => `<li>${t}</li>`).join('')}</ul>` : ''}
      <div class="jei-modes">
        <button data-mode="recipe" class="${this.mode === 'recipe' ? 'on' : ''}"><kbd>R</kbd> Receita <em>${make.length}</em></button>
        <button data-mode="uses" class="${this.mode === 'uses' ? 'on' : ''}"><kbd>U</kbd> Usos <em>${uses.length}</em></button>
      </div>
      <div class="jei-body">${body}${this.mode === 'recipe' || !uses.length ? sources : ''}</div>`;
  }
}
