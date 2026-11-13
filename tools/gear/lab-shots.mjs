/**
 * Prints do laboratório de itens (tools/item-lab.html) para conferência visual.
 * Uso: node tools/gear/lab-shots.mjs [url-base] [pasta-de-saída] [filtro]
 *   node tools/gear/lab-shots.mjs http://127.0.0.1:5199 production/qa/evidence/itens
 */
import { openBrowser } from './browser.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:5199';
const out = process.argv[3] ?? 'production/qa/evidence/itens';
const only = process.argv[4] ?? '';

/** [nome, item, ação, progresso, 1ª pessoa, câmera [x, y, z, alvoX, alvoY, alvoZ]] */
const SHOTS = [
  ['mao-espada-metal', 'espada_metal', 'idle', 0, false],
  ['mao-espada-pedra-golpe', 'espada_pedra', 'swing', 0.3, false],
  ['mao-espada-ouro-impacto', 'espada_ouro', 'swing', 0.55, false],
  ['mao-adaga-ouro', 'adaga_ouro', 'idle', 0, false],
  ['mao-machado-metal', 'machado_metal', 'idle', 0, false],
  ['mao-machado-pedra-preparo', 'machado_pedra', 'swing', 0.34, false],
  ['mao-picareta-ouro-impacto', 'picareta_ouro', 'swing', 0.6, false],
  ['mao-pistola', 'pistola', 'idle', 0, false],
  ['mao-pistola-lado', 'pistola', 'idle', 0, false, [2.6, 1.4, 0.4]],
  ['mao-pistola-recarga-sem-carregador', 'pistola', 'reload', 0.42, false],
  ['mao-pistola-recarga-encaixe', 'pistola', 'reload', 0.7, false],
  ['mao-rifle', 'rifle', 'idle', 0, false],
  ['mao-rifle-lado', 'rifle', 'idle', 0, false, [2.6, 1.4, 0.4]],
  ['mao-rifle-recarga', 'rifle', 'reload', 0.45, false],
  ['mao-arco-repouso', 'arco', 'idle', 0, false],
  ['mao-arco-puxado', 'arco', 'draw', 1, false, [2.6, 1.5, 0.6]],
  ['mao-pao-comendo', 'pao', 'consume', 0.5, false],
  ['mao-cafe-bebendo', 'cafe', 'consume', 0.5, false],
  ['mao-agua', 'agua', 'idle', 0, false],
  ['mao-reliquia-coroa', 'reliquia_coroa', 'idle', 0, false],
  ['mao-reliquia-escudo', 'reliquia_escudo', 'idle', 0, false],
  ['mao-reliquia-capa', 'reliquia_capa', 'idle', 0, false],
  ['fp-espada-metal', 'espada_metal', 'idle', 0, true],
  ['fp-machado-golpe', 'machado_metal', 'swing', 0.5, true],
  ['fp-pistola', 'pistola', 'idle', 0, true],
  ['fp-pistola-recarga', 'pistola', 'reload', 0.42, true],
  ['fp-rifle', 'rifle', 'idle', 0, true],
  ['fp-arco-puxado', 'arco', 'draw', 0.9, true],
  ['fp-hamburguer-comendo', 'hamburguer', 'consume', 0.5, true],
  ['fp-picareta-pedra', 'picareta_pedra', 'idle', 0, true],
];

const b = await openBrowser({ width: 960, height: 720 });
try {
  await b.goto(`${base}/tools/item-lab.html?hud=0`);
  await b.waitFor('window.lab?.ready', 60000);
  for (const [name, item, action, t, fp, view] of SHOTS) {
    if (only && !name.includes(only)) continue;
    const v = view ?? [1.7, 1.45, 2.3];
    await b.evaluate(`lab.setGrid(false); lab.setAction('idle', 0, ${fp}); lab.setItem('${item}'); lab.setView(${v.join(',')})`);
    await b.sleep(700); // termina a animação de equipar
    await b.evaluate(`lab.setAction('${action}', ${t}, ${fp})`);
    await b.sleep(350);
    console.log(await b.screenshot(`${out}/${name}.jpg`));
  }
  if (!only || 'grade'.includes(only)) {
    await b.evaluate('lab.setAction("idle", 0, false); lab.setGrid(true)');
    await b.sleep(500);
    console.log(await b.screenshot(`${out}/todos-os-itens.jpg`, { quality: 88 }));
  }
  const errors = b.logs.filter((l) => /^\[(error|exception)/.test(l));
  console.log(errors.length ? `ERROS NO CONSOLE:\n${errors.join('\n')}` : 'console sem erros');
} finally {
  await b.close();
}
