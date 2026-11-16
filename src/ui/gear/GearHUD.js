import { icon } from '../Icons.js';

const el = (tag, cls, parent, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
};

/**
 * HUD do item equipado (HTML sobre o canvas, acima da hotbar): munição
 * carregador/reserva, barra da recarga, durabilidade atual/máxima com aviso
 * abaixo de 20%, progresso de ação (comer, beber, preparar o arco, extrair) e
 * o efeito do café com contagem regressiva.
 *
 * Só exibe: recebe um retrato pronto do `GearController` a cada quadro e mexe
 * no DOM apenas quando algo mudou.
 *
 * @example
 * const hud = new GearHUD(ui.root);
 * hud.update({ ammo: { mag: 12, reserve: 32, name: 'Munição de Pistola' }, reload: 0.4,
 *   durability: { cur: 80, max: 600, low: true, broken: false }, action: null, effects: [{ icon: 'cup', name: 'Café', seconds: 7.3 }] });
 */
export class GearHUD {
  /** @param {HTMLElement} root */
  constructor(root) {
    this.root = el('div', 'gear-hud', root);
    this.effects = el('div', 'gear-effects', this.root);
    this.action = el('div', 'gear-action hidden', this.root, '<span></span><div class="gear-bar"><i></i></div>');
    this.ammo = el('div', 'gear-ammo hidden', this.root);
    this.dur = el('div', 'gear-dur hidden', this.root, '<span></span><div class="gear-bar"><i></i></div>');
    this._k = {};
  }

  /** Atualiza um bloco só se a chave (número) ou o rótulo mudou — sem montar texto a cada quadro. */
  changed(name, key, label = '') {
    const k = this._k[name];
    if (k && k.key === key && k.label === label) return false;
    if (k) { k.key = key; k.label = label; } else this._k[name] = { key, label };
    return true;
  }

  /**
   * @param {{ ammo: null | { mag: number, reserve: number, name: string, cap?: number },
   *   reload: number | null,
   *   durability: null | { cur: number, max: number, low: boolean, broken: boolean },
   *   action: null | { label: string, progress: number },
   *   effects: { icon: string, name: string, seconds: number }[] }} s
   */
  update({ ammo, reload, durability, action, effects }) {
    const rl = reload === null ? -1 : Math.round(reload * 50);
    if (this.changed('ammo', ammo ? ammo.mag * 1000003 + ammo.reserve * 101 + rl : -9, ammo ? ammo.hint ?? ammo.name : '')) {
      this.ammo.classList.toggle('hidden', !ammo);
      if (ammo) {
        this.ammo.classList.toggle('empty', ammo.mag === 0 && reload === null);
        this.ammo.innerHTML = `${icon(ammo.icon ?? 'bullet')}<b>${ammo.mag}</b><em>/ ${ammo.reserve}</em><small>${reload !== null ? `recarregando… ${Math.round(reload * 100)}%` : ammo.hint ?? ammo.name}</small>`
          + (reload !== null ? `<div class="gear-bar reload"><i style="width:${(reload * 100).toFixed(0)}%"></i></div>` : '');
      }
    }
    if (this.changed('dur', durability ? durability.cur * 10007 + durability.max : -9)) {
      this.dur.classList.toggle('hidden', !durability);
      if (durability) {
        this.dur.classList.toggle('low', durability.low);
        this.dur.classList.toggle('broken', durability.broken);
        this.dur.firstChild.innerHTML = durability.broken ? `${icon('warn')} Quebrado — inutilizável`
          : `${durability.low ? `${icon('warn')} ` : ''}Durabilidade ${durability.cur}/${durability.max}`;
        this.dur.querySelector('i').style.width = `${(100 * durability.cur / durability.max).toFixed(1)}%`;
      }
    }
    if (this.changed('action', action ? Math.round(action.progress * 100) : -9, action ? action.label : '')) {
      this.action.classList.toggle('hidden', !action);
      if (action) {
        this.action.firstChild.textContent = action.label;
        this.action.querySelector('i').style.width = `${(action.progress * 100).toFixed(0)}%`;
      }
    }
    if (this.changed('fx', effects.length ? Math.round(effects[0].seconds * 10) : -9)) {
      this.effects.innerHTML = effects.map((e) => `<div class="gear-effect" title="${e.name}">${icon(e.icon)}<b>${e.seconds.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s</b></div>`).join('');
    }
  }
}
