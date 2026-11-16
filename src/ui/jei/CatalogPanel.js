import { ITEMS } from '../../systems/PlayerState.js';
import { icon } from '../Icons.js';
import { itemIcon } from '../gear/ItemIcon.js';

/** Atalhos de tag na barra do catálogo. */
const QUICK_TAGS = ['#medicina', '#arma', '#ferramenta', '#material', '#comida', '#fogueira', '#planta'];

/**
 * Painel lateral do catálogo (JEI): grade com TODOS os itens do jogo, sempre
 * visíveis (sem "???"), com busca em tempo real por nome ou #tag.
 *
 * Clique esquerdo = receita, clique direito = usos; com o mouse em cima,
 * R e U fazem o mesmo (tratado pelo hub, via `tooltip.current`).
 * Só exibe: as ações vão para `onRecipe` / `onUses`.
 *
 * @example
 * const cat = new CatalogPanel(game, hubEl, { index, tooltip, onRecipe: (id) => viewer.show(id, 'recipe'), onUses: (id) => viewer.show(id, 'uses') });
 * cat.render();
 */
export class CatalogPanel {
  constructor(game, parent, { index, tooltip, onRecipe, onUses }) {
    this.game = game;
    this.index = index;
    this.onRecipe = onRecipe;
    this.onUses = onUses;
    this.query = '';
    this.root = document.createElement('aside');
    this.root.className = 'jei-panel';
    this.root.innerHTML = `
      <div class="jei-head"><b>${icon('book')} Catálogo</b><span class="jei-count"></span></div>
      <input class="jei-search" type="search" placeholder="Buscar nome ou #tag (ex.: #arma, #taiga)" spellcheck="false" autocomplete="off" aria-label="Buscar no catálogo">
      <div class="jei-tags">${QUICK_TAGS.map((t) => `<button data-tag="${t}">${t}</button>`).join('')}</div>
      <div class="jei-grid" role="list"></div>
      <div class="jei-foot">Clique: receita · Botão direito: usos · <kbd>R</kbd>/<kbd>U</kbd> sobre o item</div>`;
    parent.appendChild(this.root);
    this.search = this.root.querySelector('.jei-search');
    this.grid = this.root.querySelector('.jei-grid');
    this.count = this.root.querySelector('.jei-count');
    tooltip.attach(this.grid);

    this.search.addEventListener('input', () => { this.query = this.search.value; this.render(); });
    this.search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const first = this.grid.querySelector('[data-id]'); if (first) this.onRecipe(first.dataset.id); }
    });
    this.root.querySelector('.jei-tags').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tag]');
      if (b) this.toggleTag(b.dataset.tag);
    });
    this.grid.addEventListener('click', (e) => { const c = e.target.closest('[data-id]'); if (c) this.onRecipe(c.dataset.id); });
    this.grid.addEventListener('contextmenu', (e) => {
      const c = e.target.closest('[data-id]');
      if (!c) return;
      e.preventDefault();
      this.onUses(c.dataset.id);
    });
  }

  /** Liga/desliga uma tag na busca (os botões de atalho). */
  toggleTag(tag) {
    const words = this.query.split(/\s+/).filter(Boolean);
    const i = words.indexOf(tag);
    if (i >= 0) words.splice(i, 1); else words.unshift(tag);
    this.query = words.join(' ');
    this.search.value = this.query ? `${this.query} ` : '';
    this.render();
  }

  focusSearch() {
    this.search.focus();
    this.search.select();
  }

  render() {
    const inv = this.game.state.inventory, ix = this.index;
    const ids = ix.search(this.query);
    const words = this.query.split(/\s+/);
    for (const b of this.root.querySelectorAll('[data-tag]')) b.classList.toggle('on', words.includes(b.dataset.tag));
    this.count.textContent = `${ids.length} de ${ix.allItems().length}`;
    this.grid.innerHTML = ids.map((id) => {
      const d = ITEMS[id], n = inv.get(id) ?? 0;
      const can = ix.recipesFor(id).some((r) => r.station === 'HANDS' && !Object.keys(ix.missing(r, inv)).length);
      return `<button class="jei-item${can ? ' can' : ''}" data-id="${id}" role="listitem" aria-label="${d.name}">
        <span class="ic">${itemIcon(d)}</span>${n ? `<span class="n">${n}</span>` : ''}</button>`;
    }).join('') || '<i class="jei-empty">Nada encontrado.</i>';
  }
}
