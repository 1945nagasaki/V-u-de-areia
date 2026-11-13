import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILDINGS, CYCLES, GOODS, PLACEMENT, STATION_RULES, FARMING } from '../../../src/config/workplaces.js';
import { PROFESSIONS, ROUTINE } from '../../../src/config/npcLife.js';
import { WorkstationRegistry, assignJobs } from '../../../src/systems/work/Workstations.js';
import { VillageEconomy, FarmPlots, WorkRoutine } from '../../../src/systems/work/Production.js';
import { NavGrid } from '../../../src/systems/work/NavGrid.js';
import { activityAt } from '../../../src/systems/npc/Routine.js';
import { mulberry32 } from '../../../src/world/Noise.js';

/** Prédio de teste: registra as estações de um tipo de prédio em (0, 0), sem rotação. */
function register(reg, type, id = `${type}_01`) {
  const spec = BUILDINGS[type];
  spec.stations.forEach((s, i) => reg.add({
    id: `${id}:${s.kind}:${i}`, profession: spec.profession, buildingId: id, kind: s.kind, role: s.role ?? 'worker',
    x: s.at[0], y: 0, z: s.at[1], yaw: 0, gesture: s.gesture, tool: s.tool ?? null, carry: s.carry ?? null, capacity: s.capacity ?? 1, plot: s.plot,
  }));
  return id;
}
const at = (st) => ({ pos: { x: st.x, z: st.z }, floorAt: () => st.y, isClear: () => true });

// ---------------------------------------------------------------- configuração

test('predios_todaProfissaoTemEstacoesParaOCicloInteiro', () => {
  for (const [type, b] of Object.entries(BUILDINGS)) {
    assert.ok(PROFESSIONS[b.profession], `${type}: profissão ${b.profession} sem cadastro`);
    assert.ok(PLACEMENT.order.includes(type), `${type} fora da ordem de construção`);
    assert.ok(PLACEMENT.rings[b.place], `${type}: regra de posição ${b.place}`);
    const kinds = new Set(b.stations.filter((s) => (s.role ?? 'worker') === 'worker').map((s) => s.kind));
    for (const step of CYCLES[b.profession] ?? []) assert.ok(kinds.has(step.station), `${type}: o ciclo pede a estação "${step.station}" que o prédio não tem`);
    if (b.workers > 0) assert.ok(CYCLES[b.profession]?.length, `${type}: profissão sem ciclo de tarefas`);
    for (const s of b.stations) {
      assert.ok(Math.abs(s.at[0]) <= b.w / 2 + 2 && Math.abs(s.at[1]) <= b.d / 2 + 2, `${type}/${s.kind}: estação fora do prédio`);
      assert.ok(Math.hypot(s.face[0] - s.at[0], s.face[1] - s.at[1]) > 0.3, `${type}/${s.kind}: sem objeto para olhar`);
      assert.ok(s.gesture, `${type}/${s.kind}: sem gesto`);
    }
  }
});

test('ciclos_recursosExistem_eAsCadeiasFecham', () => {
  const produced = new Set(['trigo', 'vegetais']); // vêm da colheita (FARMING.harvest)
  for (const c of Object.values(CYCLES)) for (const s of c) for (const id of Object.keys(s.produce ?? {})) produced.add(id);
  for (const [prof, c] of Object.entries(CYCLES)) {
    for (const s of c) {
      for (const id of [...Object.keys(s.produce ?? {}), ...Object.keys(s.consume ?? {}), ...Object.keys(s.needs ?? {})]) assert.ok(GOODS[id], `${prof}: recurso ${id} sem cadastro`);
      for (const id of Object.keys(s.consume ?? {})) assert.ok(produced.has(id), `${prof} consome ${id}, que ninguém produz`);
      assert.ok(s.seconds > 0);
    }
  }
  for (const y of Object.values(FARMING.harvest)) for (const id of Object.keys(y)) assert.ok(GOODS[id]);
});

test('rotina_horariosPedidos', () => {
  assert.deepEqual(ROUTINE.blocks.map((b) => [b.from, b.activity]), [[6, 'WAKE'], [7, 'WORK'], [12, 'LUNCH'], [13, 'WORK_PM'], [17, 'LEISURE'], [20, 'HOME']]);
  assert.equal(activityAt(6.5), 'WAKE'); assert.equal(activityAt(7.2), 'WORK'); assert.equal(activityAt(12.5), 'LUNCH');
  assert.equal(activityAt(16.9), 'WORK_PM'); assert.equal(activityAt(17.1), 'LEISURE'); assert.equal(activityAt(20.5), 'HOME'); assert.equal(activityAt(3), 'HOME');
});

// ---------------------------------------------------------------- estações

test('estacao_validaProfissaoDistanciaPisoEObstaculo', () => {
  const reg = new WorkstationRegistry(), id = register(reg, 'forge');
  const anvil = reg.find({ buildingId: id, kind: 'anvil', agentId: 'a' });
  assert.equal(anvil.tool, 'hammer');
  const ok = { agentId: 'a', profession: 'ferreiro', ...at(anvil) };
  assert.deepEqual(reg.validate(anvil, ok), { ok: true });
  assert.equal(reg.validate(null, ok).reason, 'no-station');
  assert.equal(reg.validate(anvil, { ...ok, profession: 'padeiro' }).reason, 'wrong-profession');
  assert.equal(reg.validate(anvil, { ...ok, pos: { x: anvil.x + 2, z: anvil.z } }).reason, 'too-far', 'longe da estação não trabalha');
  assert.equal(reg.validate(anvil, { ...ok, floorAt: () => anvil.y - 3 }).reason, 'no-floor', 'sem chão embaixo não trabalha');
  assert.equal(reg.validate(anvil, { ...ok, floorAt: () => NaN }).reason, 'no-floor');
  assert.equal(reg.validate(anvil, { ...ok, isClear: () => false }).reason, 'blocked', 'dentro de um objeto não trabalha');
});

test('estacao_respeitaLotacao_eSoltaAoSair', () => {
  const reg = new WorkstationRegistry(), id = register(reg, 'forge');
  const anvil = reg.find({ buildingId: id, kind: 'anvil', agentId: 'a' });
  assert.equal(reg.claim(anvil, 'a'), true);
  assert.equal(reg.claim(anvil, 'a'), true, 'ocupar de novo não duplica');
  assert.equal(anvil.occupants.length, 1);
  assert.equal(reg.claim(anvil, 'b'), false);
  assert.equal(reg.validate(anvil, { agentId: 'b', profession: 'ferreiro', ...at(anvil) }).reason, 'occupied');
  assert.equal(reg.find({ buildingId: id, kind: 'anvil', agentId: 'b' }), null, 'bigorna única ocupada');
  reg.releaseAll('a');
  assert.equal(reg.find({ buildingId: id, kind: 'anvil', agentId: 'b' }), anvil);
  // lotação 2 (depósito da mina)
  const mine = register(reg, 'mine'), depot = reg.find({ buildingId: mine, kind: 'depot', agentId: 'x' });
  assert.ok(reg.claim(depot, 'x') && reg.claim(depot, 'y'));
  assert.equal(reg.claim(depot, 'z'), false);
});

test('empregos_umaVagaPorPredioPrimeiro_semTrabalhoSemPredio', () => {
  const people = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, age: i < 9 ? 'adult' : i === 9 ? 'child' : 'elder', profession: i === 0 ? 'guarda' : 'agricultor' }));
  const buildings = [{ id: 'forge_01', profession: 'ferreiro', workers: 2 }, { id: 'bakery_01', profession: 'padeiro', workers: 2 }, { id: 'farm_01', profession: 'agricultor', workers: 2 }];
  const jobs = assignJobs(people, buildings, mulberry32(7));
  assert.equal(jobs.size, 6, 'só há 6 vagas');
  assert.equal(people[0].profession, 'guarda', 'guarda não muda');
  const adults = people.filter((p) => p.age === 'adult' && p.profession !== 'guarda');
  assert.equal(adults.filter((p) => p.profession === null).length, 2, 'quem sobra fica sem ofício (não trabalha no ar)');
  for (const b of buildings) assert.equal(adults.filter((p) => p.profession === b.profession).length, 2);
  for (const p of adults) assert.equal(!!p.profession, jobs.has(p.id));
  assert.equal(people[9].profession, 'agricultor', 'criança não entra na distribuição (a rotina já a manda brincar)');
  // poucas pessoas: cada oficina ganha uma antes de alguma lotar
  const few = Array.from({ length: 3 }, (_, i) => ({ id: `q${i}`, age: 'adult', profession: 'agricultor' }));
  assignJobs(few, buildings, mulberry32(3));
  assert.deepEqual(few.map((p) => p.profession).sort(), ['agricultor', 'ferreiro', 'padeiro']);
});

// ---------------------------------------------------------------- produção

test('producao_soComMaterial_eComTeto', () => {
  const eco = new VillageEconomy({ start: { farinha: 1 } });
  const bake = CYCLES.padeiro.find((s) => s.produce);
  assert.deepEqual(eco.finish(bake), { produced: { pao: 2 } });
  assert.deepEqual(eco.finish(bake), { starved: ['farinha'] }, 'sem farinha não sai pão');
  assert.equal(eco.count('pao'), 2); assert.equal(eco.count('farinha'), 0);
  eco.add({ pao: 500 });
  assert.equal(eco.count('pao'), GOODS.pao.cap);
});

test('cicloDeTrabalho_passoAPasso_produzNoFim', () => {
  const reg = new WorkstationRegistry(), id = register(reg, 'bakery'), eco = new VillageEconomy({ start: { farinha: 2 } });
  const job = new WorkRoutine({ agentId: 'ana', profession: 'padeiro', buildingId: id, registry: reg, economy: eco });
  const seen = [];
  let produced = null;
  for (let guard = 0; guard < 20 && job.done === 0; guard++) {
    const t = job.target(0);
    assert.ok(t.station, `passo ${job.index}: ${t.wait}`);
    seen.push(t.station.kind);
    assert.equal(job.tick(1), null, 'sem chegar na estação não há trabalho');
    assert.deepEqual(job.begin(t.station, at(t.station)), { ok: true });
    assert.equal(t.station.occupants[0], 'ana');
    assert.equal(job.tick(t.step.seconds - 0.1), null);
    const r = job.tick(0.2);
    assert.equal(r.done, true);
    assert.equal(t.station.occupants.length, 0, 'solta a estação ao terminar');
    if (r.produced) produced = r.produced;
  }
  assert.deepEqual(seen, CYCLES.padeiro.map((s) => s.station));
  assert.deepEqual(produced, { pao: 2 });
  assert.equal(eco.count('farinha'), 1);
});

test('doisTrabalhadores_mesmaOficina_naoDividemAMesmaEstacao', () => {
  const reg = new WorkstationRegistry(), id = register(reg, 'forge'), eco = new VillageEconomy();
  const a = new WorkRoutine({ agentId: 'a', profession: 'ferreiro', buildingId: id, registry: reg, economy: eco });
  const b = new WorkRoutine({ agentId: 'b', profession: 'ferreiro', buildingId: id, registry: reg, economy: eco });
  const ta = a.target(0);
  a.begin(ta.station, at(ta.station));
  const tb = b.target(0);
  assert.equal(tb.wait, 'occupied', 'o segundo espera, não trabalha no ar');
  assert.equal(b.station, null);
  assert.equal(b.tick(100), null);
  assert.equal(b.target(1).wait, 'occupied', 'continua esperando até o prazo');
  a.tick(100); // termina e solta
  const again = b.target(STATION_RULES.retrySeconds + 0.1);
  assert.equal(again.station, ta.station);
  assert.ok(b.begin(again.station, at(again.station)).ok);
  // defasados no ciclo, trabalham ao mesmo tempo em estações diferentes
  const c = new WorkRoutine({ agentId: 'c', profession: 'ferreiro', buildingId: id, registry: reg, economy: eco, offset: 2 });
  const tc = c.target(0);
  assert.notEqual(tc.station, again.station);
  assert.ok(c.begin(tc.station, at(tc.station)).ok);
});

test('estacaoInalcancavel_tentaDeNovo_depoisEsperaSemTrabalhar', () => {
  const reg = new WorkstationRegistry(), id = register(reg, 'pottery'), eco = new VillageEconomy();
  const job = new WorkRoutine({ agentId: 'o', profession: 'oleiro', buildingId: id, registry: reg, economy: eco });
  const t = job.target(0);
  assert.equal(job.unreachable(t.station, 0), false, '1ª falha: recalcula a rota');
  assert.equal(job.unreachable(t.station, 0), false);
  assert.equal(job.unreachable(t.station, 0), true, `${STATION_RULES.maxReplans}ª: desiste por ora`);
  assert.equal(job.target(1).wait, 'unreachable');
  assert.equal(t.station.lastFail, 'unreachable');
  // chegou no lugar errado (longe): não começa
  const far = job.begin(t.station, { pos: { x: t.station.x + 5, z: t.station.z }, floorAt: () => 0 }, 100);
  assert.deepEqual(far, { ok: false, reason: 'too-far' });
  assert.equal(job.station, null);
});

test('plantacao_cresceEmEstagios_colheVaiParaOCeleiro', () => {
  const plots = new FarmPlots([{ crop: 'wheat' }]);
  assert.equal(plots.plots[0].stage, 0);
  const actions = [];
  let y = null;
  for (let i = 0; i < 20 && !y; i++) { const r = plots.work(0); actions.push(r.action); y = r.yield ?? null; }
  assert.deepEqual(y, FARMING.harvest.wheat);
  assert.deepEqual([...new Set(actions)], ['plant', 'water', 'tend', 'harvest']);
  assert.equal(plots.plots[0].stage, 0, 'colhida: volta a terra arada');
  plots.grow(10);
  assert.equal(plots.plots[0].stage, 0, 'terra sem semente não cresce sozinha');
  plots.work(0); plots.work(0); // semeado
  plots.grow(FARMING.growHours);
  assert.equal(plots.plots[0].stage, 4, 'semeada, amadurece com o tempo');
  // ciclo do agricultor: colhe na leira e só entra no estoque ao guardar no celeiro
  const reg = new WorkstationRegistry(), id = register(reg, 'farm'), eco = new VillageEconomy({ start: {} });
  const farm = new FarmPlots([{ crop: 'wheat' }, { crop: 'veg' }]);
  farm.plots[0].stage = 4;
  const job = new WorkRoutine({ agentId: 'f', profession: 'agricultor', buildingId: id, registry: reg, economy: eco, farm });
  let stored = null;
  for (let i = 0; i < 12 && !stored; i++) {
    const t = job.target(0);
    job.begin(t.station, at(t.station));
    const r = job.tick(60);
    if (r.farm?.yield) assert.equal(eco.count('trigo'), 0, 'ainda na mão');
    stored = r.produced ?? null;
  }
  assert.deepEqual(stored, { trigo: 4 });
});

test('mercador_poeAVendaOQueAVilaProduziu', () => {
  const eco = new VillageEconomy({ start: { pao: 2 } });
  assert.deepEqual(eco.distribute(['pao', 'peixe']), { pao: 1 });
  assert.equal(eco.count('pao'), 1); assert.equal(eco.forSale.pao, 1);
});

test('vilaDistante_produzPorSimulacaoAbstrata_limitadaPelosMateriais', () => {
  const eco = new VillageEconomy({ start: { trigo: 4 } });
  eco.abstract(10, { moleiro: 1, padeiro: 1, lenhador: 1 });
  assert.ok(eco.count('madeira') >= 20, 'lenhador não precisa de insumo');
  assert.equal(eco.produced.farinha, 4, 'moleiro para quando o trigo acaba');
  assert.ok((eco.produced.pao ?? 0) <= 8);
  const idle = new VillageEconomy({ start: {} });
  idle.abstract(10, {});
  assert.deepEqual(idle.produced, {}, 'sem trabalhadores, nada é produzido');
});

// ---------------------------------------------------------------- navegação

/** Mapa de teste: parede em x=0 de z=-20 a z=20 com uma porta em z=5..6. */
const wall = (x, z) => Math.abs(x) < 0.6 && !(z > 5 && z < 6.2) && Math.abs(z) < 20;

test('navegacao_contornaParede_passaPelaPorta', () => {
  const nav = NavGrid.build({ cx: 0, cz: 0, half: 30, cell: 1, isBlocked: wall });
  const route = nav.path({ x: -10, z: -8 }, { x: 10, z: -8 });
  assert.ok(route, 'há caminho pela porta');
  assert.deepEqual(route[route.length - 1], { x: 10, z: -8 });
  let px = -10, pz = -8;
  for (const p of route) {
    assert.ok(nav.lineClear(px, pz, p.x, p.z) || p === route[route.length - 1], 'nenhum trecho atravessa a parede');
    px = p.x; pz = p.z;
  }
  assert.ok(route.some((p) => Math.abs(p.x) < 1.6 && p.z > 4.4 && p.z < 6.8), 'a rota passa pela porta');
  assert.ok(route.length < 12, 'rota alisada (sem zigue-zague de grade)');
});

test('navegacao_semCaminho_devolveNull_eAtualizaQuandoOMundoMuda', () => {
  const closed = (x, z) => Math.abs(x) < 0.6 && Math.abs(z) < 40;
  const nav = NavGrid.build({ cx: 0, cz: 0, half: 30, cell: 1, isBlocked: closed });
  assert.equal(nav.path({ x: -10, z: 0 }, { x: 10, z: 0 }), null, 'parede fechada: sem rota (o morador espera)');
  nav.refresh(-2, 4, 2, 8, wall); // abriram uma porta
  assert.ok(nav.path({ x: -10, z: 0 }, { x: 10, z: 0 }));
  nav.refresh(-2, 4, 2, 8, closed); // construíram em cima
  assert.equal(nav.path({ x: -10, z: 0 }, { x: 10, z: 0 }), null);
});

test('navegacao_destinoColadoEmMovel_chegaNaCelulaLivreVizinha', () => {
  const block = (x, z) => Math.abs(x - 5) < 0.9 && Math.abs(z) < 0.9; // um móvel
  const nav = NavGrid.build({ cx: 0, cz: 0, half: 20, cell: 1, isBlocked: block });
  const route = nav.path({ x: -5, z: 0 }, { x: 4.6, z: 0.2 });
  assert.ok(route);
  assert.deepEqual(route[route.length - 1], { x: 4.6, z: 0.2 }, 'último passo é o ponto de interação exato');
});

test('navegacao_rapidaOBastante_emVilaGrande', () => {
  const rng = mulberry32(5), houses = Array.from({ length: 220 }, () => ({ x: (rng() - 0.5) * 420, z: (rng() - 0.5) * 420, r: 3 + rng() * 3 }));
  const blocked = (x, z) => houses.some((h) => Math.abs(x - h.x) < h.r && Math.abs(z - h.z) < h.r);
  const nav = NavGrid.build({ cx: 0, cz: 0, half: 290, cell: 1, isBlocked: blocked });
  const t0 = performance.now();
  let ok = 0;
  for (let i = 0; i < 20; i++) if (nav.path({ x: (rng() - 0.5) * 380, z: (rng() - 0.5) * 380 }, { x: (rng() - 0.5) * 380, z: (rng() - 0.5) * 380 })) ok++;
  const ms = (performance.now() - t0) / 20;
  assert.ok(ok >= 18, `${ok}/20 rotas`);
  assert.ok(ms < 40, `média de ${ms.toFixed(1)} ms por rota`);
});
