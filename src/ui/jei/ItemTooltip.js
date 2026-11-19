import { ITEMS } from '../../systems/PlayerState.js';
import { icon } from '../Icons.js';
import { itemIcon } from '../gear/ItemIcon.js';
import { foodCardHTML } from '../FoodCard.js';
import { weaponCardHTML } from '../WeaponCard.js';

export const KIND_LABEL = { medicine: 'Remédio', weapon: 'Arma', tool: 'Ferramenta', material: 'Material', food: 'Comida', key: 'Missão' };

/**
 * Card flutuante do JEI: nome, categoria, descrição curta, tags e os atalhos
 * [R] Ver receita / [U] Ver usos. Guarda o item sob o mouse (`current`), que
 * é o alvo das teclas R e U.
 *
 * Qualquer elemento com `data-id="<item>"` dentro de um container ligado com
 * `attach()` mostra o card ao passar o mouse ou receber foco do teclado.
 *
 * @example
 * const tip = new ItemTooltip(document.body, { index, inventory: () => state.inventory });
 * tip.attach(gridEl);
 * tip.current; // 'osso' enquanto o mouse está sobre o osso
 */
export class ItemTooltip {
  /**
   * @param {HTMLElement} parent onde o card é criado
   * @param {{ index: import('../../systems/RecipeIndex.js').RecipeIndex, inventory: () => Map<string, number> }} deps
   */
  constructor(parent, { index, inventory }) {
    this.index = index;
    this.inventory = inventory;
    this.current = null;
    this.el = document.createElement('div');
    this.el.className = 'jei-tip';
    this.el.hidden = true;
    this.el.setAttribute('role', 'tooltip');
    parent.appendChild(this.el);
  }

  /** Liga o card a um container (delegação: vale para filhos criados depois). */
  attach(container) {
    container.addEventListener('mouseover', (e) => {
      const t = e.target.closest('[data-id]');
      if (t && container.contains(t)) this.show(t.dataset.id, e.clientX, e.clientY);
    });
    container.addEventListener('mousemove', (e) => { if (!this.el.hidden) this.place(e.clientX, e.clientY); });
    container.addEventListener('mouseout', (e) => {
      const from = e.target.closest('[data-id]');
      if (from && !from.contains(e.relatedTarget)) this.hide();
    });
    container.addEventListener('focusin', (e) => {
      const t = e.target.closest('[data-id]');
      if (!t) return;
      const r = t.getBoundingClientRect();
      this.show(t.dataset.id, r.right, r.bottom);
    });
    container.addEventListener('focusout', () => this.hide());
  }

  show(id, x, y) {
    const d = ITEMS[id];
    if (!d) return;
    this.current = id;
    const ix = this.index, make = ix.recipesFor(id).length, uses = ix.usesOf(id).length;
    const have = this.inventory().get(id) ?? 0;
    const tags = ix.tagsOf(id).slice(0, 6).map((t) => `<span>#${t}</span>`).join('');
    this.el.innerHTML = `
      <div class="jei-tip-head"><span class="ic">${itemIcon(d)}</span><div><b>${d.name}</b><small>${KIND_LABEL[d.kind] ?? ''}${have ? ` · você tem ${have}` : ''}</small></div></div>
      ${d.forage ? foodCardHTML(d) : d.description ? `<p>${d.description}</p>` : ''}${weaponCardHTML(d)}
      ${tags ? `<div class="jei-tip-tags">${tags}</div>` : ''}
      <div class="jei-tip-keys"><span><kbd>R</kbd> Ver receita${make ? ` (${make})` : ''}</span><span><kbd>U</kbd> Ver usos${uses ? ` (${uses})` : ''}</span></div>`;
    this.el.hidden = false;
    this.place(x, y);
  }

  /** Posiciona perto do cursor sem sair da tela. */
  place(x, y) {
    const w = this.el.offsetWidth, h = this.el.offsetHeight, pad = 14;
    const left = x + pad + w > innerWidth ? x - pad - w : x + pad;
    const top = y + pad + h > innerHeight ? Math.max(4, innerHeight - h - 4) : y + pad;
    this.el.style.left = `${Math.max(4, left)}px`;
    this.el.style.top = `${top}px`;
  }

  hide() {
    this.current = null;
    this.el.hidden = true;
  }
}
