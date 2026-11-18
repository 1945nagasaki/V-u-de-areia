import { FOOD_STATES, FOOD_TEXT } from '../config/foods.js';

/**
 * Bloco da dica de comida (mochila, chão e fogueira): selo do estado, Fome
 * restaurada em destaque, como assar e o tempo exato na fogueira.
 * Vazio para itens que não são da coleta/caça.
 *
 * @example
 *   el.innerHTML = foodCardHTML(ITEMS.carne_javali_crua);
 *   // "Carne Crua · Restaura: +18 de Fome · Como assar: … · Tempo para assar na fogueira: 15 segundos"
 * @param {{ forage?: import('../config/foods.js').FOOD_ITEMS[string] }} def item de ITEMS
 */
export function foodCardHTML(def) {
  const f = def?.forage;
  if (!f) return '';
  const raw = !!f.roastsTo;
  const st = f.state;
  return `<div class="food-card ${st}">
    <span class="fc-badge">${FOOD_STATES[st]}</span>
    <div class="fc-hunger">${FOOD_TEXT.restores(f.hunger)}</div>
    <p class="fc-how">${raw ? FOOD_TEXT.howToRoast : FOOD_TEXT.roasted}</p>
    <div class="fc-time">${FOOD_TEXT.cookTime(f.cookTime)}</div>
  </div>`;
}

/** Linha curta para o aviso de interação no chão: "+18 Fome · assa 15 s na fogueira". */
export function foodShortLine(def) {
  const f = def?.forage;
  if (!f) return '';
  return `+${f.hunger} Fome · ${f.roastsTo ? `assa ${f.cookTime} s na fogueira` : 'assado'}`;
}
