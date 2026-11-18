import { MISSION_TEXT, MISSION_FX, fillText } from '../config/missions.js';

const el = (tag, cls, parent, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * Rastreador da missão ativa (canto superior direito, abaixo do minimapa) e o
 * banner "MISSÃO CONCLUÍDA". Só exibe: quem muda as missões é o MissionManager.
 *
 * @example
 *   const t = new QuestTracker(game.ui.root);
 *   t.render(manager.list());
 *   t.showComplete(missao);
 */
export class QuestTracker {
  /** @param {HTMLElement} root raiz da UI (`game.ui.root`) */
  constructor(root) {
    // Dentro da coluna do minimapa: fica logo abaixo dele e do relógio, sem calcular alturas.
    const column = root.querySelector('.minimap') ?? root;
    this.box = el('div', 'quest-tracker hidden', column);
    this.box.setAttribute('role', 'status');
    this.box.setAttribute('aria-live', 'polite');
    this.banner = el('div', 'quest-banner hidden', root);
    this.banner.setAttribute('role', 'alert');
    this._hideAt = 0;
    this._timer = null;
  }

  /** Mostra a primeira missão ativa (ou esconde se não há nenhuma). */
  render(missions) {
    const m = missions?.[0];
    if (!m) { this.box.classList.add('hidden'); this.box.innerHTML = ''; return; }
    const objective = fillText(m.objectiveText ?? m.description, { n: m.targetCount });
    this.box.innerHTML = `
      <div class="qt-head">${esc(fillText(MISSION_TEXT.trackerHeader, { difficulty: m.difficultyLabel }))}</div>
      <div class="qt-title">${esc(m.title)}</div>
      <div class="qt-obj">${esc(objective)}: <b class="qt-count">[${m.currentCount}/${m.targetCount}]</b></div>
      <div class="qt-reward">${esc(fillText(MISSION_TEXT.reward, { xp: m.xpReward, gold: m.goldReward }))}</div>`;
    this.box.classList.remove('hidden');
  }

  /** Banner escuro de conclusão; some sozinho depois de `MISSION_FX.bannerSeconds`. */
  showComplete(m) {
    this.banner.textContent = fillText(MISSION_TEXT.banner, { title: m.title, xp: m.xpReward, gold: m.goldReward });
    this.banner.classList.remove('hidden');
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.banner.classList.add('hidden'), MISSION_FX.bannerSeconds * 1000);
  }

  hideBanner() {
    clearTimeout(this._timer);
    this.banner.classList.add('hidden');
  }
}
