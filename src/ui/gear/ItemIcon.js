import { icon } from '../Icons.js';
import { GEAR_ICONS } from '../../config/gearIcons.js';
import { GEAR_CATALOG, TIERS, DURABILITY } from '../../config/gear.js';

const BASE = import.meta.env?.BASE_URL ?? './';

/**
 * Ícone de um item: o PNG colorido (`public/assets/icons/items/<id>.png`)
 * quando ele existe em `GEAR_ICONS`, senão o ícone de linha do jogo.
 *
 * @example
 * el.innerHTML = itemIcon(ITEMS.espada_metal);   // <img class="item-img" …> ou <svg class="i" …>
 */
export function itemIcon(def, cls = '') {
  if (def?.id && GEAR_ICONS.has(def.id)) return `<img class="item-img ${cls}" src="${BASE}assets/icons/items/${def.id}.png" alt="" draggable="false">`;
  return icon(def?.icon ?? 'dot', cls);
}

/** Ícone a partir do que a hotbar guarda (`{ id, icone }`). */
export function slotIcon(item) {
  const def = GEAR_CATALOG[item.id];
  return def ? itemIcon(def) : icon(item.icone ?? 'dot');
}

const num = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/**
 * Linhas de atributos de um item do pacote para a mochila/dica: material,
 * dano (só quando existe), durabilidade, recuperação e efeitos. Não mostra
 * "dano 0" em comida, recursos ou relíquias.
 *
 * @param {object} def definição do catálogo
 * @param {{ durability: number, mag?: number } | null} [inst] estado do equipamento
 * @returns {string[]} linhas HTML
 */
export function gearStats(def, inst = null) {
  const out = [];
  if (def.materialTier) out.push(`Material: <b>${TIERS[def.materialTier].name}</b>`);
  if (def.equipment === 'bow') out.push('Dano: <b>o da flecha</b> (o arco não soma dano)');
  else if (def.damage > 0) out.push(`Dano: <b>${def.damage}</b> por ${def.equipment === 'firearm' ? 'tiro' : 'acerto'}`);
  if (def.attackInterval) out.push(`Intervalo: <b>${num(def.attackInterval)} s</b>`);
  if (def.equipment === 'bow') out.push(`Preparo: <b>${num(def.useDuration)} s</b>`);
  if (def.gather) out.push(`Extração de ${def.gather === 'wood' ? 'madeira' : 'pedra e minério'}: <b>${num(def.gatherEfficiency)}×</b>`);
  if (def.magazine) out.push(`Carregador: <b>${inst ? `${inst.mag}/` : ''}${def.magazine}</b> · recarga ${num(def.reloadSeconds)} s`);
  if (def.durabilityMax) {
    const cur = inst ? inst.durability : def.durabilityMax, broken = inst && cur <= 0, low = inst && !broken && cur / def.durabilityMax < DURABILITY.warnBelow;
    out.push(`Durabilidade: <b class="${broken ? 'gear-broken' : low ? 'gear-low' : ''}">${cur}/${def.durabilityMax}</b>${broken ? ' — <b class="gear-broken">quebrado</b>' : low ? ' — <b class="gear-low">quase quebrando</b>' : ''}`);
  }
  if (def.hungerRestore > 0) out.push(`Fome: <b>+${def.hungerRestore}</b>`);
  if (def.staminaRestore > 0) out.push(`Estamina: <b>+${def.staminaRestore}</b>`);
  if (def.effects?.includes('cafe')) out.push('Efeito: <b>+25% de velocidade</b> por 10 s (não acumula)');
  if (def.consumable) out.push(`Consumo: <b>${num(def.useDuration)} s</b>${def.portion ? ` · ${def.portion}` : ''}`);
  if (def.useDisabled) out.push('Uso <b>desabilitado</b> nesta etapa');
  if (def.kind === 'relic') out.push('Relíquia única · sem uso nesta etapa');
  if (def.pack) out.push(`Vendida em pacote de <b>${def.pack}</b>`);
  if (def.stackLimit > 1) out.push(`Até <b>${def.stackLimit}</b> por espaço`);
  return out;
}
