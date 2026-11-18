import { RESOURCES, RECIPES, PROGRESSION } from '../config/survival.js';
import { formatClock } from '../systems/Landfall.js';

const el = (tag, cls, parent, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
};

/**
 * Interface de sobrevivência (Missão: Véu de Areia):
 *  - HUD de barras (Vida, Energia/Estamina, Fome, Nível/XP) no canto;
 *  - cronômetro de afogamento do prólogo e aviso "Progresso Salvo";
 *  - overlay do tutorial (passo, texto, progresso);
 *  - Inventário em grade + Craft (I / TAB);
 *  - Árvore de Skills (K ou botão do HUD).
 *
 * Depende de `game`: state, survival, bag, progression, tutorial, e das
 * ações game.eat(id), game.craft(id), game.placeCampfire(), game.upgradeSkill(id).
 */
export class SurvivalUI {
  constructor(game, root) {
    this.game = game;
    this.root = el('div', 'sv', root);

    this.hud = el('div', 'sv-hud', this.root, `
      <div class="sv-bar"><span>Vida</span><div class="sv-meter"><i class="hp"></i></div><b class="v-hp"></b></div>
      <div class="sv-bar"><span>Energia</span><div class="sv-meter"><i class="st"></i></div><b class="v-st"></b></div>
      <div class="sv-bar"><span>Fome</span><div class="sv-meter"><i class="hu"></i></div><b class="v-hu"></b></div>
      <div class="sv-bar"><span>Nível <em class="v-lvl"></em></span><div class="sv-meter"><i class="xp"></i></div><b class="v-xp"></b></div>
      <div class="sv-btns"><button class="sv-btn b-inv"><kbd>I</kbd>Inventário</button><button class="sv-btn b-sk"><kbd>K</kbd>Skills</button></div>`);
    this.hud.querySelector('.b-inv').addEventListener('click', () => game.toggleInventory());
    this.hud.querySelector('.b-sk').addEventListener('click', () => game.toggleSkills());

    this.clock = el('div', 'sv-clock hidden', this.root, '<small>TEMPO ATÉ AFOGAR</small><span></span><em>Nade para a costa do deserto · a correnteza ajuda</em>');
    this.saved = el('div', 'sv-saved', this.root, '<span class="spin"></span>Progresso Salvo');

    this.tut = el('div', 'sv-tut hidden', this.root, '<div class="t-head"><span class="t-num"></span><span class="t-title"></span></div><p class="t-text"></p><div class="t-prog"><i></i></div>');

    this.inv = el('div', 'sv-modal hidden', this.root);
    this.skills = el('div', 'sv-modal hidden', this.root);
    this.inv.addEventListener('click', (e) => this.onInvClick(e));
    this.skills.addEventListener('click', (e) => this.onSkillClick(e));
    this._info = null;
  }

  get modalOpen() {
    return !this.inv.classList.contains('hidden') || !this.skills.classList.contains('hidden');
  }

  // ---------- HUD ----------
  refreshHud() {
    const g = this.game, s = g.state, sv = g.survival, p = g.progression;
    const set = (sel, frac) => { this.hud.querySelector(sel).style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`; };
    set('.hp', s.health / s.maxHealth);
    set('.st', sv.stamina / sv.maxStamina);
    set('.hu', sv.hunger / sv.cfg.maxHunger);
    const lp = p.levelProgress;
    set('.xp', lp.into / lp.need);
    this.hud.querySelector('.v-hp').textContent = `${Math.round(s.health)}/${s.maxHealth}`;
    this.hud.querySelector('.v-st').textContent = `${Math.round(sv.stamina)}/${sv.maxStamina}`;
    this.hud.querySelector('.v-hu').textContent = `${Math.round(sv.hunger)}%`;
    this.hud.querySelector('.v-lvl').textContent = p.level;
    this.hud.querySelector('.v-xp').textContent = `${p.xp} XP`;
    this.hud.classList.toggle('starving', sv.hunger <= 0);
    this.hud.classList.toggle('tired', sv.exhausted);
  }

  setClock(seconds, visible) {
    this.clock.classList.toggle('hidden', !visible);
    if (!visible) return;
    this.clock.querySelector('span').textContent = formatClock(seconds);
    this.clock.classList.toggle('low', seconds < 60);
  }

  showSaved() {
    this.saved.classList.remove('show');
    void this.saved.offsetWidth;
    this.saved.classList.add('show');
  }

  // ---------- tutorial ----------
  showTutorialStep(step, index, total) {
    this.tut.classList.remove('hidden', 'done');
    this.tut.querySelector('.t-num').textContent = `${index + 1}/${total}`;
    this.tut.querySelector('.t-title').textContent = step.titulo;
    this.tut.querySelector('.t-text').innerHTML = step.texto;
    this.tut.querySelector('.t-prog i').style.width = '0%';
    this.tut.classList.remove('enter');
    void this.tut.offsetWidth;
    this.tut.classList.add('enter');
  }

  setTutorialProgress(f) {
    this.tut.querySelector('.t-prog i').style.width = `${f * 100}%`;
  }

  tutorialDone() {
    this.tut.querySelector('.t-num').textContent = '✓';
    this.tut.querySelector('.t-title').textContent = 'Tutorial concluído';
    this.tut.querySelector('.t-text').innerHTML = 'Você sabe sobreviver. O Véu de Areia espera.';
    this.tut.classList.add('done');
    setTimeout(() => this.tut.classList.add('hidden'), 5000);
  }

  // ---------- inventário + craft ----------
  toggleInventory(force) {
    const open = force ?? this.inv.classList.contains('hidden');
    this.inv.classList.toggle('hidden', !open);
    if (open) {
      this.skills.classList.add('hidden');
      this.renderInventory();
    }
    return open;
  }

  renderInventory() {
    const bag = this.game.bag;
    const list = bag.list();
    const cells = [];
    for (let i = 0; i < 20; i++) {
      const it = list[i];
      cells.push(it
        ? `<button class="cell${this._info === it.id ? ' sel' : ''}" data-cell="${it.id}" title="${it.def.nome}"><span>${it.def.icone}</span><b>${it.n}</b></button>`
        : '<div class="cell empty"></div>');
    }
    const info = this._info && bag.count(this._info) ? RESOURCES[this._info] : null;
    let actions = '';
    if (info) {
      if (info.food) actions += `<button class="sv-act" data-eat="${this._info}">Comer</button>`;
      if (info.placeable) actions += `<button class="sv-act" data-place="${this._info}">Posicionar na areia</button>`;
      if (info.weapon) actions += `<button class="sv-act" data-equip="${this._info}">Equipar na hotbar</button>`;
    }
    const recipes = RECIPES.map((r) => {
      const ok = bag.canCraft(r.id);
      const needs = Object.entries(r.needs).map(([id, n]) => `<span class="${bag.count(id) >= n ? 'have' : 'miss'}">${RESOURCES[id].icone} ${bag.count(id)}/${n}</span>`).join('');
      return `<div class="recipe${ok ? ' ok' : ''}"><div class="r-out">${RESOURCES[r.out].icone}<b>${RESOURCES[r.out].nome}</b></div><div class="r-needs">${needs}</div><button class="sv-act" data-craft="${r.id}" ${ok ? '' : 'disabled'}>Criar</button></div>`;
    }).join('');
    this.inv.innerHTML = `
      <div class="sv-card wide">
        <div class="sv-title">Inventário <small>I / TAB fecha · clique num item</small></div>
        <div class="inv-cols">
          <div>
            <div class="grid">${cells.join('')}</div>
            <div class="info">${info ? `<b>${info.icone} ${info.nome}</b><p>${info.desc}</p><div class="acts">${actions}</div>` : '<p class="dim">Selecione um item para ver detalhes. Recolha recursos na areia com <kbd>E</kbd>.</p>'}</div>
          </div>
          <div class="craft"><div class="sv-sub">Craftar</div>${recipes}</div>
        </div>
      </div>`;
  }

  onInvClick(e) {
    const t = e.target.closest('[data-cell],[data-eat],[data-place],[data-craft],[data-equip]');
    if (!t) return;
    const g = this.game;
    if (t.dataset.cell) {
      this._info = t.dataset.cell;
      if (RESOURCES[this._info]?.food) g.tutorial.notify('food'); // inspecionar comida conta
    } else if (t.dataset.eat) g.eat(t.dataset.eat);
    else if (t.dataset.place) { g.placeCampfire(); return; }
    else if (t.dataset.craft) g.craft(t.dataset.craft);
    else if (t.dataset.equip) g.equipWeapon(t.dataset.equip);
    if (!this.inv.classList.contains('hidden')) this.renderInventory();
  }

  // ---------- árvore de skills ----------
  toggleSkills(force) {
    const open = force ?? this.skills.classList.contains('hidden');
    this.skills.classList.toggle('hidden', !open);
    if (open) {
      this.inv.classList.add('hidden');
      this.renderSkills();
    }
    return open;
  }

  renderSkills() {
    const p = this.game.progression;
    const st = p.stats(this.game.baseStats);
    const effect = {
      vida: `Vida Máxima <b>${st.maxHealth}</b>`,
      energia: `Estamina Máxima <b>${st.maxStamina}</b> · Velocidade <b>${Math.round(st.speedMultiplier * 100)}%</b>`,
      forca: `Dano Corpo a Corpo <b>${Math.round(st.meleeMultiplier * 100)}%</b>`,
    };
    const branches = Object.entries(PROGRESSION.skills).map(([id, s]) => {
      const tier = p.tiers[id], cost = p.cost(id);
      const pips = Array.from({ length: PROGRESSION.maxTier }, (_, i) => `<i class="${i < tier ? 'on' : ''}"></i>`).join('');
      const max = cost === Infinity;
      return `<div class="branch b-${id}">
        <div class="b-name">${s.nome}</div><div class="b-desc">${s.desc}</div>
        <div class="tiers">${pips}</div>
        <div class="b-eff">${effect[id]}</div>
        <button class="sv-act" data-skill="${id}" ${max || !p.canUpgrade(id) ? 'disabled' : ''}>${max ? 'Máximo' : `Evoluir · ${cost} XP`}</button>
      </div>`;
    }).join('');
    this.skills.innerHTML = `
      <div class="sv-card">
        <div class="sv-title">Árvore de Skills <small>K fecha</small></div>
        <div class="xp-pool">XP disponível <b>${p.xp}</b> · Nível ${p.level}</div>
        <div class="branches">${branches}</div>
        <p class="dim">Ganhe XP matando animais, derrotando criaturas e completando missões.</p>
      </div>`;
  }

  onSkillClick(e) {
    const t = e.target.closest('[data-skill]');
    if (!t) return;
    this.game.upgradeSkill(t.dataset.skill);
    this.renderSkills();
  }
}
