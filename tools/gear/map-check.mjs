/**
 * Verificação do mapa grande (tecla M) no jogo de verdade: abre o mapa,
 * confere que a foto do mundo 3D foi tirada e que o jogo segue desenhando
 * normalmente depois; guarda prints em production/qa/evidence/mapa/.
 *
 * Uso (com `npx vite --port 5199` rodando):
 *   node tools/gear/map-check.mjs http://127.0.0.1:5199
 */
import { openBrowser } from './browser.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:5199';
const out = 'production/qa/evidence/mapa';
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'OK  ' : 'FALHOU'} ${name}${detail ? ` — ${detail}` : ''}`); };

const b = await openBrowser({ width: 1280, height: 720 });
const js = (code) => b.evaluate(`(() => { ${code} })()`);
try {
  await b.goto(`${base}/?novo`);
  await b.waitFor('window.game?.ready', 240000, 1000);
  await b.sleep(2000);
  await b.screenshot(`${out}/antes-de-abrir-o-mapa.jpg`);
  const before = await js('return { fog: !!game.scene.fog, water: game.water.mesh.visible, sun: game.environment.sun.visible }');
  await js('game.ui.toggleWorldMap(true);');
  await b.sleep(800);
  await b.screenshot(`${out}/mapa-grande-versao-minimapa.jpg`, { quality: 90 });
  const info = await js(`
    const wm = game.worldMapRenderer, d = wm.pixels, n = d.length / 4;
    let land = 0, sea = 0; const seen = new Set();
    for (let i = 0; i < n; i += 37) {
      const r = d[i * 4], g = d[i * 4 + 1], bl = d[i * 4 + 2];
      if (bl > r + 25 && bl > g) sea++; else land++;
      seen.add((r >> 4) << 8 | (g >> 4) << 4 | (bl >> 4));
    }
    const t0 = performance.now(); wm.capture(); const ms = performance.now() - t0;
    return { ready: wm.ready, land, sea, colors: seen.size, ms: Math.round(ms), rig: wm.rig.visible,
      fog: !!game.scene.fog, water: game.water.mesh.visible, sun: game.environment.sun.visible };
  `);
  check('foto do mundo tirada ao abrir o mapa', info.ready);
  check('a foto tem terra e mar (não é uma cor só)', info.land > 500 && info.sea > 500 && info.colors > 40, `terra ${info.land}, mar ${info.sea}, ${info.colors} tons`);
  check('estado da cena devolvido (neblina, água, sol, mar do mapa escondido)', info.fog === before.fog && info.water === before.water && info.sun === before.sun && !info.rig, JSON.stringify(info));
  check('tirar a foto é rápido', info.ms < 400, `${info.ms} ms`);
  // viajar clicando no mapa continua batendo com o lugar
  const travel = await js(`
    const c = game.ui.worldCanvas, r = c.getBoundingClientRect(), v = Object.values(game.villages).find((x) => x.config.id === 'bussola') ?? Object.values(game.villages)[1];
    const u = v.x / 4096 + 0.5, w = v.z / 2304 + 0.5;
    c.dispatchEvent(new MouseEvent('click', { clientX: r.left + u * r.width, clientY: r.top + w * r.height, bubbles: true }));
    const p = game.player.position;
    return { d: Math.hypot(p.x - v.x, p.z - v.z), name: v.config.name };
  `);
  check('clicar numa vila no mapa leva até ela', travel.d < 12, `${travel.name}: a ${travel.d.toFixed(1)} m`);
  await b.sleep(2500);
  await b.screenshot(`${out}/depois-de-viajar-pelo-mapa.jpg`);
  await js('game.ui.toggleWorldMap(true);');
  await b.sleep(800);
  await b.screenshot(`${out}/mapa-grande-jogador-em-outra-vila.jpg`, { quality: 90 });
  await js('game.ui.toggleWorldMap(false);');
  const errors = b.logs.filter((l) => /^\[(error|exception)/.test(l));
  check('console do jogo sem erros', errors.length === 0, errors.slice(0, 4).join(' || '));
} catch (err) {
  check('roteiro chegou ao fim', false, `${err.message}\n${b.logs.slice(-10).join('\n')}`);
} finally {
  await b.close();
}
process.exit(failed ? 1 : 0);
