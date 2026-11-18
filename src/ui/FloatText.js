/**
 * Texto que sobe e some no meio da tela (ex.: "+50 Fome" ao comer).
 * @example floatText(game.ui.root, '+50 Fome', 'hunger');
 * @param {HTMLElement} root
 * @param {string} text
 * @param {string} [kind] classe extra (cor)
 */
export function floatText(root, text, kind = '') {
  const e = document.createElement('div');
  e.className = `float-gain ${kind}`;
  e.textContent = text;
  root.appendChild(e);
  setTimeout(() => e.remove(), 1700);
}
