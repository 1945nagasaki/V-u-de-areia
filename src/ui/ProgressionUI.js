import { PROGRESSION } from '../config/progression.js';

const el = (tag, cls, parent, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
};

/**
 * Interface da progressão: selo de Nível/XP (canto), painel do tutorial (direita)
 * e Árvore de Skills (K). Só mostra; os pedidos (evoluir) vão para o
 * ProgressionDirector, que muda o estado.
 */
export class ProgressionUI {
  /**
   * @param {import('../systems/ProgressionDirector.js').ProgressionDirector} director
   * @param {HTMLElement} root
   */
  constructor(director, root) {
    this.d = director;
    this.root = el('div', 'sv', root);
    this.badge = el('div', 'sv-level', this.root, '<span>Nível <b class="lv">1</b></span><div class="sv-meter"><i class="xp"></i></div><em class="xpv"></em><kbd>K</kbd>');
    this.tut = el('div', 'sv-tut hidden', this.root, '<div class="t-head"><span class="t-num"></span><span class="t-title"></span></div><p class="t-text"></p><div class="t-prog"><i></i></div>');
    this.skills = el('div', 'sv-modal hidden', this.root);
    this.skills.addEventListener('click', (e) => {
      if (e.target === this.skills) { director.toggleSkills(false); return; }
      const t = e.target.closest('[data-skill]');
      if (t) director.upgradeSkill(t.dataset.skill);
    });
  }

  get skillsOpen() {
    return !this.skills.classList.contains('hidden');
  }

  /** Selo do canto: nível, barra até o próximo e XP para gastar. */
  refresh() {
    const p = this.d.progression, lp = p.levelProgress;
    this.badge.querySelector('.lv').textContent = p.level;
    this.badge.querySelector('.xp').style.width = `${Math.min(1, lp.into / lp.need) * 100}%`;
    this.badge.querySelector('.xpv').textContent = `${p.xp} XP`;
    this.badge.classList.toggle('can', Object.keys(p.tiers).some((k) => p.canUpgrade(k)));
    if (this.skillsOpen) this.renderSkills();
  }

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
    this.tut.classList.remove('hidden');
    this.tut.querySelector('.t-num').textContent = '✓';
    this.tut.querySelector('.t-title').textContent = 'Tutorial concluído';
    this.tut.querySelector('.t-text').innerHTML = 'Você sabe sobreviver. O Véu de Areia espera.';
    this.tut.querySelector('.t-prog i').style.width = '100%';
    this.tut.classList.add('done');
    clearTimeout(this._doneT);
    this._doneT = setTimeout(() => this.tut.classList.add('hidden'), 6000);
  }

  hideTutorial() {
    this.tut.classList.add('hidden');
  }

  toggleSkills(force) {
    const open = force ?? !this.skillsOpen;
    this.skills.classList.toggle('hidden', !open);
    if (open) this.renderSkills();
    return open;
  }

  renderSkills() {
    const p = this.d.progression, st = this.d.stats();
    const effect = {
      vida: `Vida Máxima <b>${st.maxHealth}</b>`,
      energia: `Fôlego <b>+${st.staminaBonus}</b> · Velocidade <b>${Math.round(st.speedMultiplier * 100)}%</b>`,
      forca: `Dano Corpo a Corpo <b>${Math.round(st.meleeMultiplier * 100)}%</b>`,
    };
    const branches = Object.entries(PROGRESSION.skills).map(([id, s]) => {
      const tier = p.tiers[id], cost = p.cost(id), max = cost === Infinity;
      const pips = Array.from({ length: PROGRESSION.maxTier }, (_, i) => `<i class="${i < tier ? 'on' : ''}"></i>`).join('');
      return `<div class="branch b-${id}">
        <div class="b-name">${s.nome}</div><div class="b-desc">${s.desc}</div>
        <div class="tiers">${pips}</div>
        <div class="b-eff">${effect[id]}</div>
        <button class="sv-act" data-skill="${id}" ${max || !p.canUpgrade(id) ? 'disabled' : ''}>${max ? 'Máximo' : `Evoluir · ${cost} XP`}</button>
      </div>`;
    }).join('');
    this.skills.innerHTML = `
      <div class="sv-card">
        <div class="sv-title">Árvore de Skills <small>K ou Esc fecha</small></div>
        <div class="xp-pool">XP disponível <b>${p.xp}</b> · Nível ${p.level}</div>
        <div class="branches">${branches}</div>
        <p class="dim">Ganhe XP abatendo animais, derrotando guerreiros e completando missões.</p>
      </div>`;
  }
}
