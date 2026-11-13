import { SAVE } from '../../config/gear.js';

/**
 * Save do inventário e dos equipamentos (regra pura; quem lê/grava no
 * `localStorage` é o `GearController`).
 *
 * Guarda: moedas, mochila, hotbar, equipamentos (durabilidade e carregador),
 * efeitos temporários com a duração RESTANTE (café) e o estoque das lojas.
 * Carregar SUBSTITUI o estado (carregar duas vezes não duplica nada), e cada
 * equipamento só pode estar em um lugar (mochila OU um slot da hotbar).
 *
 * @example
 * const data = snapshot({ coins: 80, inventory: new Map([['pao', 3]]), hotbar: [null], selected: 0,
 *   equipment: store.serialize(), effects: [{ id: 'cafe', remaining: 4.2 }], shops: [], arrow: null });
 * const clean = sanitize(JSON.parse(JSON.stringify(data)), { isItem: (id) => !!ITEMS[id], isEffect, slots: 8 });
 */

/** Monta o objeto que vai para o disco. */
export function snapshot({ coins, inventory, hotbar, selected, equipment, effects, shops, arrow }) {
  return {
    v: SAVE.version,
    coins,
    inventory: [...inventory],
    hotbar: hotbar.map((s) => (s ? { ...s } : null)),
    selected,
    equipment,
    effects: effects.map((e) => ({ id: e.id, remaining: e.remaining })),
    shops,
    arrow: arrow ?? null,
  };
}

/**
 * Valida um save lido do disco. Devolve `null` se não der para usar (versão
 * diferente, formato quebrado); senão um objeto limpo: ids desconhecidos fora,
 * contagens inteiras positivas, um equipamento em no máximo um slot.
 *
 * @param {any} data
 * @param {{ isItem: (id: string) => boolean, isEffect: (id: string) => boolean, slots: number, isEquipment?: (id: string) => boolean }} rules
 */
export function sanitize(data, { isItem, isEffect, slots, isEquipment = () => false }) {
  if (!data || typeof data !== 'object' || data.v !== SAVE.version) return null;
  const inventory = new Map();
  for (const pair of Array.isArray(data.inventory) ? data.inventory : []) {
    const [id, n] = Array.isArray(pair) ? pair : [];
    const c = Math.floor(Number(n));
    // equipamentos nunca são pilha: só existem como instância
    if (typeof id === 'string' && isItem(id) && !isEquipment(id) && c > 0) inventory.set(id, (inventory.get(id) ?? 0) + c);
  }
  const uids = new Set((data.equipment?.list ?? []).map((i) => i?.uid).filter((u) => typeof u === 'string'));
  const used = new Set();
  const hotbar = [];
  for (let i = 0; i < slots; i++) {
    const s = Array.isArray(data.hotbar) ? data.hotbar[i] : null;
    let ok = !!s && typeof s === 'object' && typeof s.id === 'string';
    if (ok && s.uid !== undefined) {
      ok = uids.has(s.uid) && !used.has(s.uid); // instância existe e ainda não está em outro slot
      if (ok) used.add(s.uid);
    } else if (ok && isEquipment(s.id)) ok = false; // equipamento sem instância não existe
    else if (ok && s.ref) ok = (inventory.get(s.id) ?? 0) > 0; // atalho de pilha: precisa haver item
    hotbar.push(ok ? { ...s } : null);
  }
  const effects = [];
  for (const e of Array.isArray(data.effects) ? data.effects : []) {
    if (typeof e?.id === 'string' && isEffect(e.id) && Number.isFinite(e.remaining) && e.remaining > 0) effects.push({ id: e.id, remaining: e.remaining });
  }
  const sel = Math.floor(Number(data.selected));
  return {
    coins: Math.max(0, Math.floor(Number(data.coins)) || 0),
    inventory,
    hotbar,
    selected: sel >= 0 && sel < slots ? sel : 0,
    equipment: data.equipment ?? { list: [] },
    effects,
    shops: Array.isArray(data.shops) ? data.shops : [],
    arrow: typeof data.arrow === 'string' ? data.arrow : null,
  };
}
