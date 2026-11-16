import { ITEMS } from '../systems/PlayerState.js';
import { DISEASE_STAGES } from '../config/afflictions.js';
import { SPECIES } from '../config/fauna.js';
import { icon } from './Icons.js';

/**
 * Ficha do personagem (aba do hub, tecla Tab): fobias ativas e doenças
 * contraídas, com estágio, sintomas atuais e o remédio que cura.
 *
 * Só exibe. "Ver receita" chama `onRecipe(itemId)` (a janela JEI).
 *
 * @example
 * const sheet = new CharacterSheet(game, parentEl, { onRecipe: (id) => viewer.show(id, 'recipe') });
 * sheet.render();
 */
export class CharacterSheet {
  constructor(game, parent, { onRecipe }) {
    this.game = game;
    this.root = document.createElement('div');
    this.root.className = 'cs-sheet';
    this.root.hidden = true;
    parent.appendChild(this.root);
    this.root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-recipe]');
      if (b) onRecipe(b.dataset.recipe);
    });
    this._key = '';
  }

  render() {
    const s = this.game.survival, inv = this.game.state.inventory;
    const phobias = s.phobias.list(), diseases = s.diseases.list(), active = s.phobias.effects.triggered;
    const key = JSON.stringify([phobias.map((p) => p.id), active, diseases.map((d) => [d.id, d.stage]), diseases.map((d) => inv.get(d.def.cure) ?? 0)]);
    if (key === this._key) return;
    this._key = key;
    const ph = phobias.length
      ? phobias.map((p) => `<li class="cs-card phobia${active.includes(p.id) ? ' on' : ''}">
          <span class="cs-ic">${icon(p.def.icon)}</span>
          <div><b>${p.def.name}</b>${active.includes(p.id) ? '<em class="cs-live">ativa agora</em>' : ''}
            <p>${p.def.description}</p><small>Trauma: ${p.cause}</small></div></li>`).join('')
      : '<li class="cs-none">Nenhuma. Traumas fortes (perder 30% da sanidade de uma vez) deixam fobias.</li>';
    const dz = diseases.length
      ? diseases.map((d) => {
        const cure = ITEMS[d.def.cure], have = inv.get(d.def.cure) ?? 0;
        const symptoms = d.stage ? d.symptoms.map((t) => `<li>${t}</li>`).join('') : '<li>Ainda sem sintomas… mas algo não vai bem.</li>';
        return `<li class="cs-card disease stage-${d.stage}">
          <span class="cs-ic">${icon(d.def.icon)}</span>
          <div><b>${d.def.name}</b> <span class="cs-stage">${DISEASE_STAGES[d.stage]}</span>
            <div class="cs-steps" aria-label="Estágio ${d.stage + 1} de ${DISEASE_STAGES.length}">${DISEASE_STAGES.map((_, i) => `<i class="${i <= d.stage ? 'on' : ''}"></i>`).join('')}</div>
            <p>${d.def.description}${d.source ? ` Origem: ${SPECIES[d.source]?.nome ?? ITEMS[d.source]?.name ?? d.source}.` : ''}</p>
            <ul class="cs-sym">${symptoms}</ul>
            <div class="cs-cure">${icon(cure.icon)} Cura: <b>${cure.name}</b> ${have ? `<span class="ok">(você tem ${have} — use na mochila)</span>` : ''}
              <button data-recipe="${d.def.cure}">${icon('book')} Ver receita</button></div>
          </div></li>`;
      }).join('')
      : '<li class="cs-none">Nenhuma. Mordidas de lobo, hiena, javali, alce, capivara e felinos/urso têm 2% de chance de transmitir doenças.</li>';
    this.root.innerHTML = `
      <section><h3>${icon('mind')} Fobias ativas <small>permanentes até a morte</small></h3><ul>${ph}</ul></section>
      <section><h3>${icon('germ')} Doenças contraídas <small>não passam sozinhas</small></h3><ul>${dz}</ul></section>`;
  }
}
