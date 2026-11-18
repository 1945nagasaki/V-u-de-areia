import { MELEE } from '../config/meleeCombat.js';
import { hitDamage } from '../systems/gear/Equipment.js';

/**
 * Linha de arma da dica do item (mochila e catálogo) para lâminas que lutam
 * com o combo: "Arma Corpo a Corpo • Dano Base: +6 | Escala com Força (Árvore de Skills)".
 *
 * @example el.innerHTML += weaponCardHTML(ITEMS.adaga_pedra);
 * @param {{ base?: string, damage?: number, materialTier?: string }} def item de ITEMS
 * @returns {string} HTML (vazio se não for lâmina)
 */
export function weaponCardHTML(def) {
  if (!def || !MELEE.bladeBases.includes(def.base)) return '';
  return `<div class="weapon-card"><b>Arma Corpo a Corpo</b> • Dano Base: <em>+${hitDamage(def)}</em> | Escala com Força (Árvore de Skills)<small>Equipe na hotbar: cada golpe do combo soma o dano da lâmina.</small></div>`;
}
