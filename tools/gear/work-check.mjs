/**
 * Verificação do trabalho dos moradores NO JOGO DE VERDADE: prédios, estações,
 * empregos, rotinas, navegação, ferramentas na mão, produção e desempenho.
 * Guarda prints em production/qa/evidence/trabalho/.
 *
 * Uso (com `npx vite --port 5199` rodando):
 *   node tools/gear/work-check.mjs http://127.0.0.1:5199 [só-estáticos]
 */
import { openBrowser } from './browser.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:5199';
const quick = process.argv[3] === 'rapido';
const out = 'production/qa/evidence/trabalho';
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'OK  ' : 'FALHOU'} ${name}${detail ? ` — ${detail}` : ''}`); };

const b = await openBrowser({ width: 1280, height: 720 });
const js = (code) => b.evaluate(`(() => { ${code} })()`);
const gameWait = async (s) => { const t0 = await js('return game.time'); await b.waitFor(`game.time >= ${t0 + s}`, 300000, 100); };

try {
  await b.goto(`${base}/?novo`);
  await b.waitFor('window.game?.ready', 300000, 1000);
  await b.sleep(1500);

  // ---------------------------------------------------------------- estrutura (todas as vilas)
  const S = await js(`
    const nm = game.npcManager, work = nm.work, T = game.terrain, out = { villages: [], badStations: [], floating: [], noWork: [], stats: work.stats };
    for (const vs of nm.villages) {
      const bs = vs.work?.buildings ?? [];
      const types = bs.map((b) => b.type);
      const jobs = vs.agents.filter((a) => a.job).length, adults = vs.agents.filter((a) => a.person.age === 'adult' && a.person.profession !== 'guarda').length;
      out.villages.push({ id: vs.village.config.id, n: bs.length, types, jobs, adults, nav: !!vs.work?.nav });
      for (const b of bs) {
        // paredes assentadas: o chão sob os 4 cantos não fica abaixo da base das paredes
        if (b.shell !== 'yard') for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const cs = Math.cos(b.rot), sn = Math.sin(b.rot), lx = a * b.w / 2, lz = c * b.d / 2;
          const x = b.x + lx * cs + lz * sn, z = b.z - lx * sn + lz * cs;
          if (T.heightAt(x, z) < b.base - 0.02) out.floating.push(b.id);
        }
        for (const s of b.stations) {
          const floor = work.floorAt(s.x, s.z), clear = work.isClearAt(s.x, s.z);
          if (Math.abs(floor - s.y) > 0.6 || !clear) out.badStations.push(\`\${s.id} (\${!clear ? 'dentro de objeto' : 'sem chão'})\`);
        }
      }
      for (const a of vs.agents) if (a.person.profession && a.person.profession !== 'guarda' && a.person.age === 'adult' && !a.job) out.noWork.push(a.name);
    }
    out.stations = work.registry.stations.size;
    out.settled = work.stats.settled; out.dropped = work.stats.dropped;
    return out;
  `);
  console.log(S.villages.map((v) => `  ${v.id}: ${v.n} prédios [${v.types.join(', ')}] · ${v.jobs}/${v.adults} adultos empregados`).join('\n'));
  const withBuildings = S.villages.filter((v) => v.n > 0);
  check('vilas habitadas com locais de trabalho', withBuildings.length >= 5, `${withBuildings.length} vilas, ${S.stations} estações (${S.settled} ajustadas ao móvel, ${S.dropped.length} descartadas)`);
  check('profissões obrigatórias aparecem', ['forge', 'mine', 'farm', 'chapel', 'carpentry', 'bakery', 'tavern', 'stable', 'market'].every((t) => S.villages.some((v) => v.types.includes(t))),
    ['forge', 'mine', 'farm', 'chapel', 'carpentry', 'bakery', 'tavern', 'stable', 'market'].filter((t) => !S.villages.some((v) => v.types.includes(t))).join(','));
  check('nenhuma estação dentro de objeto ou sem chão', S.badStations.length === 0, S.badStations.slice(0, 8).join(' | '));
  check('nenhum prédio flutuando', S.floating.length === 0, [...new Set(S.floating)].join(','));
  check('todo morador com ofício tem prédio (ninguém trabalha sem local)', S.noWork.length === 0, S.noWork.slice(0, 5).join(', '));
  check('grade de navegação montada no carregamento', S.villages.every((v) => v.nav), `${S.stats.navCells} células em ${S.stats.navMs.toFixed(0)} ms`);

  // ---------------------------------------------------------------- uma vila ao vivo: Renascimento às 9 h
  const vid = 'renascimento';
  const centre = await js(`const v = game.villages.${vid}; return { x: v.x, z: v.z }`);
  await js(`game.gameClock.totalHours = Math.floor(game.gameClock.totalHours / 24) * 24 + 24 + 6.8; game.weather.scheduler.roll = () => 'limpo';`);
  await gameWait(1);
  const forge = await js(`const b = game.npcManager.villages.find((x) => x.village.config.id === '${vid}').work.buildings.find((b) => b.type === 'forge'); return b ? { x: b.x, z: b.z, ex: b.entrance.x, ez: b.entrance.z, rot: b.rot } : null`);
  if (forge) await js(`game.player.teleport(${forge.ex + Math.sin(forge.rot) * 5}, ${forge.ez + Math.cos(forge.rot) * 5}, ${forge.rot + Math.PI}); game.cameraRig.yaw = ${forge.rot}; game.cameraRig.snap?.();`);
  // posição "matemática" das 9 h (como quando a vila acorda perto do jogador): passa pela mesma validação de estação
  await js(`game.gameClock.totalHours += 2.2;`);
  await gameWait(2);
  const snapped = await js(`
    const vs = game.npcManager.villages.find((x) => x.village.config.id === '${vid}');
    const w = vs.agents.filter((a) => a.state === 'WORKING' && a.goal?.station);
    return { working: w.length, valid: w.filter((a) => a.job?.station === a.goal.station && a.goal.station.occupants.includes(a.id)).length, waiting: vs.agents.filter((a) => a.goal?.key?.startsWith('WAIT:')).length };
  `);
  check('às 9 h os empregados estão nas estações (posição validada)', snapped.working >= 8 && snapped.valid === snapped.working, JSON.stringify(snapped));
  await b.screenshot(`${out}/${vid}-ferraria-9h.jpg`);
  // espera de jogo para os moradores irem a pé até os prédios (1 h de jogo = 50 s)
  const samples = [];
  for (let k = 0; k < (quick ? 4 : 10); k++) {
    await gameWait(6);
    samples.push(await js(`
      const nm = game.npcManager, vs = nm.villages.find((x) => x.village.config.id === '${vid}'), reg = nm.registry, out = { air: [], working: 0, walking: 0, waiting: 0, tools: 0, toolsMissing: [], doubled: [] , teleports: 0, hour: game.gameClock.hour };
      const seen = new Map();
      for (const a of vs.agents) {
        if (a.state === 'WORKING' && a.goal?.station !== undefined) {
          const st = a.goal.station;
          const ok = st && a.job?.station === st && Math.hypot(a.pos.x - st.x, a.pos.z - st.z) <= 0.8 && st.occupants.includes(a.id);
          if (!ok) out.air.push(a.name + ' @' + (st?.id ?? '?'));
          else { out.working++; if (seen.has(st.id)) seen.get(st.id).push(a.name); else seen.set(st.id, [a.name]); }
          if (a.rendered && st?.tool) { if (a.toolMesh?.parent === a.model?.hands[0]) out.tools++; else out.toolsMissing.push(a.name + ':' + st.tool); }
        }
        if (a.gestureNow && a.rendered && a.state !== 'WORKING') {
          const g = a.gestureNow(vs.env ?? {});
          if (['hammer', 'mine', 'saw', 'hoe', 'chop', 'knead', 'stoke', 'write'].includes(g)) out.air.push(a.name + ' gesto ' + g + ' fora de estação');
        }
        if (a.state === 'WALK') out.walking++;
        if (a.goal?.key?.startsWith('WAIT:')) out.waiting++;
      }
      for (const st of reg.stations.values()) if (st.occupants.length > st.capacity) out.doubled.push(st.id);
      return out;
    `));
  }
  const air = samples.flatMap((s) => s.air), worked = Math.max(...samples.map((s) => s.working));
  check('ninguém trabalha no ar (estado WORKING só em estação ocupada, no lugar)', air.length === 0, air.slice(0, 6).join(' | '));
  check('moradores chegam andando e trabalham nas estações', worked >= 5, `até ${worked} trabalhando ao mesmo tempo; ${samples.map((s) => s.walking).join('/')} andando`);
  check('lotação das estações respeitada', samples.every((s) => s.doubled.length === 0), samples.flatMap((s) => s.doubled).join(','));
  const toolsMissing = samples.flatMap((s) => s.toolsMissing);
  check('ferramenta presa na mão de quem trabalha (com boneco)', toolsMissing.length === 0 && samples.some((s) => s.tools > 0), `${Math.max(...samples.map((s) => s.tools))} com ferramenta · faltando: ${toolsMissing.slice(0, 4).join(', ')}`);

  // prints: ferraria, fazenda, mina, capela…
  const shots = await js(`
    const vs = game.npcManager.villages.find((x) => x.village.config.id === '${vid}');
    return vs.work.buildings.map((b) => ({ type: b.type, x: b.x, z: b.z, rot: b.rot, ex: b.entrance.x, ez: b.entrance.z, w: b.w, d: b.d }));
  `);
  for (const s of shots) {
    const dist = Math.max(s.w, s.d) * 0.75 + 6;
    await js(`
      const g = game, x = ${s.x} + Math.sin(${s.rot}) * ${dist}, z = ${s.z} + Math.cos(${s.rot}) * ${dist};
      g.player.teleport(x, z, ${s.rot} + Math.PI); g.cameraRig.yaw = ${s.rot}; g.cameraRig.snap?.();
    `);
    await gameWait(1.2);
    await b.screenshot(`${out}/${vid}-${s.type}.jpg`);
  }

  // ---------------------------------------------------------------- produção e rotina ao longo do dia
  const prod0 = await js(`return { ...game.npcManager.villages.find((x) => x.village.config.id === '${vid}').work.economy.produced }`);
  await gameWait(quick ? 20 : 60);
  const prod1 = await js(`return { ...game.npcManager.villages.find((x) => x.village.config.id === '${vid}').work.economy.produced }`);
  const gained = Object.keys(prod1).filter((k) => (prod1[k] ?? 0) > (prod0[k] ?? 0));
  check('ofícios produzem recursos na vila ativa', gained.length >= 1, gained.map((k) => `${k} +${prod1[k] - (prod0[k] ?? 0)}`).join(' · '));
  const far = await js(`
    const nm = game.npcManager, vs = nm.villages.find((x) => !x.active && x.work?.buildings.length);
    if (!vs) return null;
    const before = Object.values(vs.work.economy.produced).reduce((a, b) => a + b, 0);
    nm.work.abstract(vs, 2, true);
    return { id: vs.village.config.id, gained: Object.values(vs.work.economy.produced).reduce((a, b) => a + b, 0) - before };
  `);
  check('vila longe produz por simulação abstrata', far && far.gained > 0, far ? `${far.id}: +${far.gained}` : 'nenhuma vila inativa');
  // às 18 h: tempo livre (taverna/capela/mercado)
  await js(`game.gameClock.totalHours = Math.floor(game.gameClock.totalHours / 24) * 24 + 17.6;`);
  await gameWait(quick ? 15 : 35);
  const leisure = await js(`
    const vs = game.npcManager.villages.find((x) => x.village.config.id === '${vid}');
    const st = {}; for (const a of vs.agents) st[a.aiState] = (st[a.aiState] ?? 0) + 1;
    return { st, visiting: vs.agents.filter((a) => a.visiting).length, working: vs.agents.filter((a) => a.state === 'WORKING' && a.goal?.station).length };
  `);
  check('fim de tarde: ninguém nas estações de trabalho, moradores em visita/convívio', leisure.working === 0 && (leisure.st.SOCIALIZING ?? 0) > 5, JSON.stringify(leisure));
  const tav = await js(`const b = game.npcManager.villages.find((x) => x.village.config.id === '${vid}').work.buildings.find((b) => b.type === 'tavern'); return b ? { x: b.x, z: b.z, rot: b.rot } : null`);
  if (tav) { await js(`game.player.teleport(${tav.x} + Math.sin(${tav.rot}) * 11, ${tav.z} + Math.cos(${tav.rot}) * 11, ${tav.rot} + Math.PI); game.cameraRig.yaw = ${tav.rot}; game.cameraRig.snap?.();`); await gameWait(1.5); await b.screenshot(`${out}/${vid}-taverna-fim-de-tarde.jpg`); }
  // à noite: em casa
  await js(`game.gameClock.totalHours = Math.floor(game.gameClock.totalHours / 24) * 24 + 23;`);
  await gameWait(2);
  const night = await js(`const vs = game.npcManager.villages.find((x) => x.village.config.id === '${vid}'); return { working: vs.agents.filter((a) => a.job?.station).length, occupied: [...game.npcManager.registry.stations.values()].filter((s) => s.occupants.length).length }`);
  check('à noite ninguém ocupa estação', night.working === 0 && night.occupied === 0, JSON.stringify(night));

  // ---------------------------------------------------------------- depuração e desempenho
  await js(`game.gameClock.totalHours = Math.floor(game.gameClock.totalHours / 24) * 24 + 24 + 9; game.workDebug.toggle(true);`);
  if (forge) await js(`game.player.teleport(${forge.ex + Math.sin(forge.rot) * 6}, ${forge.ez + Math.cos(forge.rot) * 6}, ${forge.rot + Math.PI}); game.cameraRig.yaw = ${forge.rot}; game.cameraRig.snap?.();`);
  await gameWait(4);
  await b.screenshot(`${out}/${vid}-modo-depuracao.jpg`);
  const dbg = await js('return { labels: document.querySelectorAll(".work-debug-labels .wdl").length, markers: game.workDebug.markers.children.length }');
  check('modo de depuração mostra estações e etiquetas', dbg.markers > 5 && dbg.labels > 0, JSON.stringify(dbg));
  await js('game.workDebug.toggle(false)');
  const st = await js('return game.npcManager.work.stats');
  check('rotas rápidas (orçamento por quadro)', st.maxRouteMs < 60, `${st.routes} rotas, pior ${st.maxRouteMs.toFixed(1)} ms, ${st.deferred} adiadas, ${st.failedRoutes} sem caminho`);

  const errors = b.logs.filter((l) => /^\[(error|exception)/.test(l));
  check('console do jogo sem erros', errors.length === 0, errors.slice(0, 4).join(' || '));
} catch (err) {
  check('roteiro chegou ao fim', false, `${err.message}\n${b.logs.slice(-12).join('\n')}`);
} finally {
  await b.close();
}
process.exit(failed ? 1 : 0);
