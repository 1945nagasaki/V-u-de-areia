import { ITEMS } from '../systems/PlayerState.js';
import { RecipeIndex } from '../systems/RecipeIndex.js';
import { Input } from '../core/Input.js';
import { icon } from './Icons.js';
import { ItemTooltip } from './jei/ItemTooltip.js';
import { CatalogPanel } from './jei/CatalogPanel.js';
import { RecipeViewer } from './jei/RecipeViewer.js';
import { CharacterSheet } from './CharacterSheet.js';
import { itemIcon, gearStats } from './gear/ItemIcon.js';

const el = (tag, cls, parent, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
};

const KINDS = [['medicine', 'Remédios'], ['food', 'Comida e água'], ['material', 'Materiais'], ['tool', 'Ferramentas'], ['weapon', 'Armas'], ['ammo', 'Munições'], ['relic', 'Relíquias'], ['key', 'Missão']];

/**
 * Hub de crafting (teclas I ou Tab; J abre já na busca): mochila + mesa de
 * crafting à esquerda e o catálogo JEI à direita, com a janela de receita/usos.
 *
 * Modo "dock" (durante a inspeção corporal): só a mochila, num painel lateral
 * de onde se ARRASTA um remédio para cima da ferida no corpo 3D.
 *
 * Só exibe; quem muda o estado é o jogo (state/crafting/survival). Clique =
 * selecionar; arrasto leva o item para a mesa ou para a ferida. Fabricar leva
 * o `craftTime` da receita (barra de progresso); fechar o hub interrompe.
 *
 * @example
 * const bp = new BackpackUI(game);
 * bp.toggle();                       // I / Tab
 * bp.openSearch();                   // J
 * bp.viewer.show('osso', 'uses');    // U sobre o osso
 * bp.open('dock'); bp.onDrop = (itemId, x, y) => inspection.applyAt(itemId, x, y);
 */
export class BackpackUI {
  constructor(game) {
    this.game = game;
    this.index = new RecipeIndex({ biomeName: (id) => game.biomeName?.(id) ?? id });
    this.root = el('div', 'backpack hidden', game.ui.root);
    const hub = el('div', 'bp-hub', this.root);
    const card = el('div', 'bp-card', hub);
    card.innerHTML = `
        <div class="bp-head"><div class="bp-tabs" role="tablist"><button data-tab="bag" class="on" role="tab">${icon('backpack')} Mochila</button><button data-tab="sheet" role="tab">${icon('mind')} Ficha <em class="bp-sheet-n"></em></button></div><span class="bp-cap" title="Espaços ocupados da mochila"></span><span class="bp-hint">clique num item · arraste para a mesa · <kbd>I</kbd>/<kbd>Tab</kbd>/<kbd>Esc</kbd> fecha</span></div>
        <div class="bp-body">
          <div class="bp-items"></div>
          <div class="bp-side">
            <div class="bp-detail"><i>Selecione um item.</i></div>
            <div class="bp-craft">
              <div class="bp-craft-title">Mesa de crafting <small>Mãos Livres · até 4 itens, sem ordem</small></div>
              <div class="bp-table"></div>
              <div class="bp-progress" hidden><div class="bp-bar"><i></i></div><span></span></div>
              <div class="bp-craft-actions"><button class="bp-craft-btn">Craft</button><button class="bp-clear-btn">Limpar</button></div>
              <div class="bp-craft-msg"></div>
            </div>
          </div>
        </div>`;
    this.tooltip = new ItemTooltip(this.root, { index: this.index, inventory: () => game.state.inventory });
    this.catalog = new CatalogPanel(game, hub, {
      index: this.index,
      tooltip: this.tooltip,
      onRecipe: (id) => this.viewer.show(id, 'recipe'),
      onUses: (id) => this.viewer.show(id, 'uses'),
    });
    this.viewer = new RecipeViewer(game, this.root, { index: this.index, tooltip: this.tooltip, onAutoFill: (r) => this.fillTable(r) });
    // Ficha do personagem (fobias e doenças): aba ao lado da mochila.
    this.sheet = new CharacterSheet(game, card, { onRecipe: (id) => this.viewer.show(id, 'recipe') });
    this.tab = 'bag';
    this.sheetCount = card.querySelector('.bp-sheet-n');
    card.querySelector('.bp-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (b) this.setTab(b.dataset.tab);
    });

    this.items = this.root.querySelector('.bp-items');
    this.detail = this.root.querySelector('.bp-detail');
    this.tableEl = this.root.querySelector('.bp-table');
    this.msg = this.root.querySelector('.bp-craft-msg');
    this.progress = this.root.querySelector('.bp-progress');
    this.craftBtn = this.root.querySelector('.bp-craft-btn');
    this.clearBtn = this.root.querySelector('.bp-clear-btn');
    this.table = []; // ids na mesa
    this.job = null; // fabricação em andamento
    this.selected = null;
    this.mode = 'full';
    /** Durante a inspeção: callback do arrasto solto fora do painel. */
    this.onDrop = null;
    this.onDragMove = null;
    this.craftBtn.addEventListener('click', () => this.craft());
    this.clearBtn.addEventListener('click', () => { if (!this.job) { this.table = []; this.refresh(); } });
    this.tableEl.addEventListener('click', (e) => {
      const i = e.target.closest('[data-slot]')?.dataset.slot;
      if (i !== undefined && this.table[i] && !this.job) { this.table.splice(+i, 1); this.refresh(); }
    });
    this.items.addEventListener('mousedown', (e) => {
      const chip = e.target.closest('[data-id]');
      if (!chip || e.button !== 0) return;
      e.preventDefault();
      if (chip.dataset.uid) { this.selected = chip.dataset.id; this.selectedUid = chip.dataset.uid; this.refresh(); return; }
      this.selectedUid = null;
      this.beginDrag(chip.dataset.id, e);
    });
    this.items.addEventListener('contextmenu', (e) => {
      const chip = e.target.closest('[data-id]');
      if (!chip || this.mode !== 'full') return;
      e.preventDefault();
      this.viewer.show(chip.dataset.id, 'uses');
    });
    this.tooltip.attach(this.items);
    this.items.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (act) { this.action(act.dataset.act, act.dataset.id); return; }
    });
    this.detail.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (act) this.action(act.dataset.act, act.dataset.id, act.dataset.uid);
    });
    // R / U sobre um item (catálogo, mochila ou slots da janela) — padrão JEI.
    window.addEventListener('keydown', (e) => {
      if (!this.open || this.mode !== 'full' || e.repeat || Input.isTyping(e.target)) return;
      const id = this.tooltip.current ?? document.activeElement?.closest?.('[data-id]')?.dataset.id;
      if (!id || !ITEMS[id]) return;
      if (e.code === 'KeyR') this.viewer.show(id, 'recipe');
      else if (e.code === 'KeyU') this.viewer.show(id, 'uses');
    });
    game.inventory.onChange(() => { if (this.open) this.refresh(); });
    game.state.on('change', () => {
      if (!this.open) return;
      this.refresh();
      if (this.mode === 'full') { this.catalog.render(); this.viewer.refresh(); }
    });
  }

  get open() {
    return !this.root.classList.contains('hidden');
  }

  /** @param {'full'|'dock'} [mode] */
  show(mode = 'full') {
    this.mode = mode;
    this.root.classList.remove('hidden');
    this.root.classList.toggle('dock', mode === 'dock');
    this.game.input.unlock();
    this.refresh();
    if (mode === 'full') this.catalog.render();
    else this.setTab('bag'); // inspeção: só a mochila
  }

  /**
   * Troca a aba do card: 'bag' (mochila + mesa) ou 'sheet' (ficha do personagem).
   * @param {'bag'|'sheet'} tab
   */
  setTab(tab) {
    this.tab = tab;
    for (const b of this.root.querySelectorAll('.bp-tabs [data-tab]')) b.classList.toggle('on', b.dataset.tab === tab);
    this.root.querySelector('.bp-body').hidden = tab !== 'bag';
    this.sheet.root.hidden = tab !== 'sheet';
    if (tab === 'sheet') this.sheet.render();
  }

  /** A cada quadro (Game): mantém a ficha e o contador da aba em dia (estágios mudam sem evento). */
  tick() {
    if (!this.open) return;
    const s = this.game.survival, n = s.phobias.active.size + s.diseases.active.size;
    const txt = n ? String(n) : '';
    if (this.sheetCount.textContent !== txt) this.sheetCount.textContent = txt;
    if (this.tab === 'sheet') this.sheet.render();
  }

  hide() {
    this.cancelCraft();
    this.viewer.close();
    this.tooltip.hide();
    this.catalog.search.blur();
    this.root.classList.add('hidden');
  }

  toggle() {
    if (this.open) this.hide(); else this.show('full');
  }

  /** Abre o hub com o cursor na busca do catálogo (tecla J). */
  openSearch() {
    if (!this.open || this.mode !== 'full') this.show('full');
    setTimeout(() => this.catalog.focusSearch(), 0);
  }

  /** Itens da mochila agrupados por tipo (os da mesa aparecem descontados). */
  refresh() {
    const s = this.game.state;
    const onTable = {};
    for (const id of this.table) onTable[id] = (onTable[id] ?? 0) + 1;
    const groups = KINDS.map(([kind, label]) => {
      const list = [...s.inventory].filter(([id]) => (ITEMS[id]?.kind ?? 'key') === kind).filter(([id, n]) => n - (onTable[id] ?? 0) > 0);
      if (!list.length) return '';
      return `<div class="bp-group"><div class="bp-group-title">${label}</div><div class="bp-grid">${list.map(([id, n]) => {
        const d = ITEMS[id];
        return `<div class="bp-chip${this.selected === id && !this.selectedUid ? ' sel' : ''}" data-id="${id}" tabindex="0"><span class="ic">${itemIcon(d)}</span><span class="nm">${d?.name ?? id}</span><span class="ct">×${n - (onTable[id] ?? 0)}</span></div>`;
      }).join('')}</div></div>`;
    }).join('');
    // Equipamentos do pacote: um por espaço, cada um com a sua durabilidade (e carregador).
    const gear = this.game.gear, held = new Set(this.game.inventory.slots.map((x) => x?.uid).filter(Boolean));
    const equips = gear ? gear.store.list() : [];
    const equipHtml = equips.length ? `<div class="bp-group"><div class="bp-group-title">Equipamentos</div><div class="bp-grid">${equips.map((it) => {
      const d = ITEMS[it.id], f = Math.max(0, it.durability) / d.durabilityMax;
      return `<div class="bp-chip bp-equip${this.selectedUid === it.uid ? ' sel' : ''}${it.durability <= 0 ? ' broken' : f < 0.2 ? ' low' : ''}" data-id="${it.id}" data-uid="${it.uid}" tabindex="0"><span class="ic">${itemIcon(d)}</span><span class="nm">${d.name}</span><span class="ct">${held.has(it.uid) ? 'na hotbar' : `${it.durability}/${d.durabilityMax}`}</span><span class="bp-dur"><i style="width:${(f * 100).toFixed(0)}%"></i></span></div>`;
    }).join('')}</div></div>` : '';
    this.items.innerHTML = (equipHtml + groups) || '<i class="bp-empty">Mochila vazia.</i>';
    if (gear) { const c = gear.capacity(); this.root.querySelector('.bp-cap').textContent = `${c.used}/${c.total} espaços`; }
    this.renderDetail();
    this.tableEl.innerHTML = [0, 1, 2, 3].map((i) => {
      const id = this.table[i], d = id && ITEMS[id];
      return `<div class="bp-slot${id ? ' filled' : ''}" data-slot="${i}" title="${id ? 'clique para tirar' : ''}">${d ? `<span class="ic">${icon(d.icon)}</span><span class="nm">${d.name}</span>` : '<span class="plus">+</span>'}</div>`;
    }).join('');
  }

  renderDetail() {
    const inst = this.selectedUid ? this.game.gear?.store.get(this.selectedUid) : null;
    if (this.selectedUid && !inst) this.selectedUid = null;
    if (inst) { this.renderEquipDetail(inst); return; }
    const id = this.selected, d = id && ITEMS[id], n = id ? this.game.state.inventory.get(id) ?? 0 : 0;
    if (!d || !n) { this.detail.innerHTML = '<i>Selecione um item.</i>'; return; }
    const acts = [];
    if (d.food) acts.push(`<button data-act="eat" data-id="${id}">Comer / beber</button>`);
    if (d.consumable) acts.push(`<button data-act="consume" data-id="${id}">${d.drink ? 'Beber' : 'Comer'}</button>`);
    if (d.comfort) acts.push(`<button data-act="use" data-id="${id}">Usar</button>`);
    if (this.mode === 'full') acts.push(`<button data-act="book" data-id="${id}">${icon('book')} Usos <kbd>U</kbd></button>`);
    if (d.placeable) acts.push(`<button data-act="place" data-id="${id}">Posicionar</button>`);
    if (d.hotbar) acts.push(`<button data-act="equip" data-id="${id}">Pôr na hotbar</button>`);
    if (this.mode === 'full' && this.table.length < 4) acts.push(`<button data-act="table" data-id="${id}">Pôr na mesa</button>`);
    const stats = d.gear ? `<ul class="bp-stats">${gearStats(d).map((s) => `<li>${s}</li>`).join('')}</ul>` : '';
    this.detail.innerHTML = `<div class="bp-detail-head"><span class="ic">${itemIcon(d)}</span><b>${d.name}</b> <span class="ct">×${n}</span></div><p>${d.description ?? ''}</p>${stats}<div class="bp-actions">${acts.join('')}</div>`;
  }

  /** Detalhe de um equipamento (instância): material, dano, durabilidade, carregador. */
  renderEquipDetail(inst) {
    const d = ITEMS[inst.id], slot = this.game.inventory.slots.findIndex((s) => s?.uid === inst.uid);
    const act = slot >= 0
      ? `<button data-act="unequip" data-uid="${inst.uid}" data-id="${inst.id}">Guardar na mochila</button>`
      : `<button data-act="equipUid" data-uid="${inst.uid}" data-id="${inst.id}">Pôr na hotbar</button>`;
    this.detail.innerHTML = `<div class="bp-detail-head"><span class="ic">${itemIcon(d)}</span><b>${d.name}</b>${slot >= 0 ? ` <span class="ct">slot ${slot + 1}</span>` : ''}</div><p>${d.description}</p><ul class="bp-stats">${gearStats(d, inst).map((s) => `<li>${s}</li>`).join('')}</ul><div class="bp-actions">${act}</div>`;
  }

  /** Ações dos botões (pedidos ao jogo; a UI não muda estado sozinha). */
  action(act, id, uid) {
    const g = this.game;
    if (act === 'consume') g.gear.consume(id); // efeito e gasto só quando a barra do HUD termina
    else if (act === 'equipUid') g.gear.equip(uid);
    else if (act === 'unequip') g.gear.unequip(g.inventory.slots.findIndex((s) => s?.uid === uid));
    if (act === 'book') {
      this.viewer.show(id, 'uses');
      return;
    } else if (act === 'use') {
      g.useComfortItem(id);
    } else if (act === 'eat') {
      if (g.state.removeItem(id)) g.ui.toast(`Você consumiu: ${g.survival.consume(id)}`);
    } else if (act === 'place') {
      g.progress?.placeCampfire(id);
    } else if (act === 'equip') {
      g.equipFromBackpack(id);
    } else if (act === 'table') {
      this.addToTable(id);
    }
    this.refresh();
  }

  addToTable(id) {
    const have = this.game.state.inventory.get(id) ?? 0, used = this.table.filter((x) => x === id).length;
    if (this.job || this.table.length >= 4 || used >= have) return false;
    this.table.push(id);
    this.msg.textContent = '';
    this.refresh();
    return true;
  }

  /**
   * [+] do JEI: põe na mesa os itens da receita (só a mesa da mochila, e só
   * se o jogador tiver tudo).
   * @returns {boolean} true se a mesa foi preenchida
   */
  fillTable(recipe) {
    if (this.job || recipe.station !== 'HANDS' || Object.keys(this.index.missing(recipe, this.game.state.inventory)).length) return false;
    this.table = RecipeIndex.tableFor(recipe);
    this.msg.innerHTML = `Mesa pronta: <b>${ITEMS[recipe.output.item].name}</b>. Clique em Craft.`;
    this.msg.classList.remove('ok');
    this.refresh();
    return true;
  }

  /** Tenta a combinação da mesa; receita válida leva o craftTime dela. */
  craft() {
    if (this.job) return;
    const recipe = this.game.crafting.match(this.table);
    const ready = recipe && !Object.keys(this.index.missing(recipe, this.game.state.inventory)).length;
    if (!ready || !(recipe.craftTime > 0)) { this.finishCraft(); return; }
    const dur = recipe.craftTime * 1000, t0 = performance.now();
    const bar = this.progress.querySelector('i'), label = this.progress.querySelector('span');
    const name = ITEMS[recipe.output.item].name;
    this.job = { raf: 0 };
    this.setBusy(true);
    const tick = (now) => {
      if (!this.job) return;
      const k = Math.min(1, (now - t0) / dur);
      bar.style.width = `${k * 100}%`;
      label.textContent = `${name}: ${((dur - (now - t0)) / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;
      if (k < 1) { this.job.raf = requestAnimationFrame(tick); return; }
      this.job = null;
      this.setBusy(false);
      this.finishCraft();
    };
    bar.style.width = '0%';
    this.job.raf = requestAnimationFrame(tick);
  }

  finishCraft() {
    const r = this.game.craftFromTable(this.table);
    this.msg.innerHTML = r.message;
    this.msg.classList.toggle('ok', r.ok);
    if (r.ok) this.table = [];
    this.refresh();
  }

  /** Interrompe a fabricação em andamento (nada é gasto). */
  cancelCraft() {
    if (!this.job) return;
    cancelAnimationFrame(this.job.raf);
    this.job = null;
    this.setBusy(false);
    this.msg.textContent = 'Fabricação interrompida.';
    this.msg.classList.remove('ok');
  }

  setBusy(busy) {
    this.progress.hidden = !busy;
    this.craftBtn.disabled = busy;
    this.clearBtn.disabled = busy;
    this.root.querySelector('.bp-craft').classList.toggle('busy', busy);
  }

  // ------------------------------------------------------------ arrasto

  beginDrag(id, e) {
    this.selected = id;
    this.refresh();
    const start = { x: e.clientX, y: e.clientY };
    let ghost = null;
    const move = (ev) => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6) return;
        ghost = el('div', 'bp-ghost', document.body, `${icon(ITEMS[id]?.icon)} ${ITEMS[id]?.name ?? id}`);
        this.tooltip.hide();
      }
      ghost.style.left = `${ev.clientX + 12}px`;
      ghost.style.top = `${ev.clientY + 12}px`;
      this.onDragMove?.(id, ev.clientX, ev.clientY);
    };
    const up = (ev) => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      if (!ghost) return; // clique simples: só seleciona
      ghost.remove();
      const over = document.elementFromPoint(ev.clientX, ev.clientY);
      if (this.mode === 'full' && over?.closest('.bp-craft')) this.addToTable(id);
      else if (!over?.closest('.bp-card')) this.onDrop?.(id, ev.clientX, ev.clientY);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }
}
