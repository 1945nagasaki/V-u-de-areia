import { ITEMS } from '../systems/PlayerState.js';
import { COOKING } from '../config/hunting.js';
import { itemIcon } from './gear/ItemIcon.js';
import { foodCardHTML } from './FoodCard.js';

const el = (tag, cls, parent, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
};

/**
 * Painel "Fogueira — Assar Alimentos": crus da mochila (clique põe no fogo),
 * fila com barra "Assando na fogueira… Xs restantes", saída com os prontos e a
 * dica do alimento (Fome, como assar, tempo). Só mostra; as ações vão para o
 * CampfireCooking.
 *
 * @example
 *   const ui = new CampfireUI(game.ui.root, () => game.cooking);
 *   ui.open(fire); ui.tick(); ui.close();
 */
export class CampfireUI {
  /**
   * @param {HTMLElement} root
   * @param {() => import('../systems/cooking/CampfireCooking.js').CampfireCooking} cooking
   */
  constructor(root, cooking) {
    this.cooking = cooking;
    this.root = el('div', 'cf-modal hidden', root);
    this.card = el('div', 'cf-card', this.root);
    this.root.addEventListener('click', (e) => this.onClick(e));
    this.root.addEventListener('mouseover', (e) => {
      const t = e.target.closest('[data-tip]');
      if (t) this.showTip(t.dataset.tip);
    });
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    this.tipId = null;
    this._t = 0;
  }

  get isOpen() {
    return !this.root.classList.contains('hidden');
  }

  open() {
    this.root.classList.remove('hidden');
    this.tipId = null;
    this.render();
  }

  close() {
    this.root.classList.add('hidden');
  }

  refresh() {
    if (this.isOpen) this.render();
  }

  /** A cada quadro com o painel aberto: só o cronômetro (10×/s). */
  tick() {
    const now = performance.now();
    if (now - this._t < 100) return;
    this._t = now;
    const c = this.cooking().fire?.cooker, cur = c?.current;
    const bar = this.card.querySelector('.cf-cur i'), txt = this.card.querySelector('.cf-cur em');
    if (!cur || !bar) { if (this._hadCur !== !!cur) this.render(); return; }
    bar.style.width = `${((1 - cur.left / cur.total) * 100).toFixed(1)}%`;
    txt.textContent = `Assando na fogueira... ${Math.ceil(cur.left)}s restantes`;
    if (this._outCount !== outCount(c)) this.render();
  }

  render() {
    const ck = this.cooking(), c = ck.fire?.cooker;
    if (!c) return;
    const chip = (id, extra = '', attrs = '') => `<button class="cf-chip" data-tip="${id}" ${attrs}><span class="ic">${itemIcon(ITEMS[id])}</span><span class="nm">${ITEMS[id]?.name ?? id}</span>${extra}</button>`;
    const bag = ck.cookables().map(({ id, n }) => chip(id, `<span class="ct">×${n}</span>`, `data-put="${id}"`)).join('')
      || '<p class="cf-dim">Nada cru na mochila. Cace (carne cai no chão) ou colha frutas.</p>';
    const cur = c.current;
    const fireRow = cur
      ? `<div class="cf-cur" data-tip="${cur.raw}"><div class="cf-cur-h"><span class="ic">${itemIcon(ITEMS[cur.raw])}</span><b>${ITEMS[cur.raw].name}</b> → ${ITEMS[cur.cooked].name}</div>
           <div class="cf-bar"><i style="width:${((1 - cur.left / cur.total) * 100).toFixed(1)}%"></i></div><em>Assando na fogueira... ${Math.ceil(cur.left)}s restantes</em></div>`
      : '<p class="cf-dim">O fogo está livre. Clique num alimento da mochila para pôr no fogo.</p>';
    const queue = c.queue.slice(1).map((q, i) => chip(q.raw, `<span class="ct">${q.total}s</span>`, `data-rm="${i + 1}" title="Tirar do fogo"`)).join('');
    const free = Math.max(0, c.slots - c.queue.length);
    const out = Object.entries(c.output).map(([id, n]) => chip(id, `<span class="ct">×${n}</span>`)).join('');
    const ashCool = ck.game.time - (ck.fire.ashAt ?? -Infinity) < COOKING.ashCooldown;
    const tip = this.tipId ? `<div class="cf-tip-h"><span class="ic">${itemIcon(ITEMS[this.tipId])}</span><b>${ITEMS[this.tipId].name}</b></div>${foodCardHTML(ITEMS[this.tipId]) || `<p>${ITEMS[this.tipId].description ?? ''}</p>`}`
      : '<p class="cf-dim">Passe o mouse sobre um alimento para ver a Fome que ele mata e o tempo no fogo.</p>';
    this.card.innerHTML = `
      <div class="cf-title">Fogueira — Assar Alimentos <small>E ou Esc fecha</small></div>
      <div class="cf-cols">
        <section><h4>Na mochila</h4><div class="cf-list">${bag}</div></section>
        <section><h4>No fogo <small>${c.queue.length}/${c.slots}</small></h4>${fireRow}
          ${queue ? `<div class="cf-queue"><small>Na fila (clique para tirar):</small>${queue}</div>` : ''}
          ${free && cur ? `<p class="cf-dim">${free} lugar(es) livre(s) na fila.</p>` : ''}
          <h4>Pronto</h4><div class="cf-list">${out || '<p class="cf-dim">Nada pronto ainda.</p>'}</div>
          <div class="cf-acts"><button class="cf-btn" data-take ${out ? '' : 'disabled'}>Recolher tudo</button><button class="cf-btn" data-ash ${ashCool ? 'disabled' : ''}>${ashCool ? 'Cinza (ainda quente…)' : 'Recolher cinza'}</button></div>
        </section>
        <section class="cf-tip">${tip}</section>
      </div>`;
    this._hadCur = !!cur;
    this._outCount = outCount(c);
  }

  showTip(id) {
    if (this.tipId === id || !ITEMS[id]) return;
    this.tipId = id;
    const box = this.card.querySelector('.cf-tip');
    if (box) box.innerHTML = `<div class="cf-tip-h"><span class="ic">${itemIcon(ITEMS[id])}</span><b>${ITEMS[id].name}</b></div>${foodCardHTML(ITEMS[id]) || `<p>${ITEMS[id].description ?? ''}</p>`}`;
  }

  onClick(e) {
    const ck = this.cooking();
    if (e.target === this.root) { ck.close(); return; }
    const t = e.target.closest('[data-put],[data-rm],[data-take],[data-ash]');
    if (!t) return;
    if (t.dataset.put) ck.put(t.dataset.put);
    else if (t.dataset.rm) ck.remove(Number(t.dataset.rm));
    else if (t.hasAttribute('data-take')) ck.take();
    else if (t.hasAttribute('data-ash')) ck.takeAsh();
  }
}

function outCount(c) {
  let n = 0;
  for (const v of Object.values(c.output)) n += v;
  return n;
}
