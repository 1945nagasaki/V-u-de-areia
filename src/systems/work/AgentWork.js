import { LEISURE_VISITS, STATION_RULES } from '../../config/workplaces.js';

/**
 * Trabalho e visitas de um morador (cola entre `NPCAgent` e as regras puras
 * de `Workstations` / `Production`). Aqui mora a garantia de que NINGUÉM
 * trabalha no ar:
 *
 *  1. o destino do turno é sempre o ponto de interação de uma estação real
 *     (`workGoal`), ou um ponto de espera na frente do prédio;
 *  2. ao chegar, a estação é validada (existe, é da profissão, está livre, o
 *     morador está em cima dela, há chão, não está dentro de um objeto) e só
 *     então ocupada (`arriveAtWork`);
 *  3. o gesto de trabalho só toca enquanto a estação está ocupada
 *     (`isWorking`); qualquer falha vira espera em pé, com o motivo guardado
 *     em `agent.workFail` (modo de depuração).
 *
 * @example
 * const goal = workGoal(agent);            // dentro de NPCAgent.desired()
 * arriveAtWork(agent);                     // dentro de NPCAgent.arrive()
 * tickWork(agent, dt);                     // a cada atualização
 */

/** Relógio comum (s) — prazos de espera das estações valem para todos os moradores. */
const now = (agent) => agent.manager.clockSeconds ?? agent.t;

/** Destino do turno de trabalho: a estação do passo atual, ou esperar na frente do prédio. */
export function workGoal(agent) {
  const job = agent.job, t = job.target(now(agent));
  if (t.station) {
    const s = t.station;
    return { key: `WORK:${s.id}:${job.index}`, x: s.x, z: s.z, state: 'WORKING', yaw: s.yaw, gesture: s.gesture, station: s, noTeleport: true };
  }
  agent.workFail = t.wait;
  const w = agent.workBuilding.wait, b = agent.workBuilding;
  return { key: `WAIT:${b.id}`, x: w.x, z: w.z, state: 'IDLE', yaw: Math.atan2(b.x - w.x, b.z - w.z), gesture: null, wait: t.wait, noTeleport: true };
}

/** Contexto de validação da estação a partir do mundo real (chão e colisores). */
function stationCtx(agent) {
  const m = agent.manager;
  return { pos: agent.pos, floorAt: m.floorAt ?? null, isClear: m.stationClear ?? null };
}

/**
 * Chegou ao destino de trabalho: valida e ocupa a estação.
 * @returns {boolean} true = pode trabalhar (estado WORKING); false = fica em pé esperando
 */
export function arriveAtWork(agent) {
  const st = agent.goal.station;
  const r = agent.job.begin(st, stationCtx(agent), now(agent));
  if (!r.ok) {
    agent.workFail = r.reason;
    agent.state = 'IDLE';
    return false;
  }
  agent.workFail = null;
  agent.pos.x = st.x; agent.pos.z = st.z; // em cima do ponto de interação, virado para o objeto
  agent.yaw = st.yaw;
  agent.state = 'WORKING';
  return true;
}

/** Está de fato trabalhando numa estação ocupada por ele? (só assim o gesto toca) */
export function isWorking(agent) {
  return agent.state === 'WORKING' && !!agent.job?.station && agent.job.station === agent.goal?.station;
}

/**
 * Avança o passo de trabalho. Ao terminar: produção/plantação e próxima estação.
 * @returns {object|null} resultado do passo (produced, farm, starved…)
 */
export function tickWork(agent, dt) {
  if (!isWorking(agent)) return null;
  const r = agent.job.tick(dt);
  if (!r) return null;
  agent.lastWork = r;
  agent.manager.onWorkStep?.(agent, r);
  return r;
}

/** Larga tudo (fim do turno, susto, nocaute, morte): solta estação e lugar de visita. */
export function leaveWork(agent) {
  agent.job?.leave();
  if (agent.visiting) { agent.manager.registry?.release(agent.visiting, agent.id); agent.visiting = null; }
}

/** Rota até a estação falhou: recalcula algumas vezes e depois desiste por ora (sem teletransporte). */
export function workUnreachable(agent, station) {
  agent.workFail = 'unreachable';
  return agent.job.unreachable(station, now(agent));
}

/** Sem rota nenhuma (A* não achou caminho): marca a estação e espera. */
export function workNoPath(agent, station) {
  agent.workFail = 'unreachable';
  agent.job.replans = STATION_RULES.maxReplans - 1;
  agent.job.unreachable(station, now(agent));
}

/**
 * Ferramenta ou carga que deve estar na mão agora (null = mãos vazias).
 * Trabalhando: a ferramenta da estação. Andando até uma estação de carga: a carga.
 */
export function heldItem(agent) {
  const st = agent.goal?.station;
  if (!st) return null;
  if (isWorking(agent)) return st.tool ?? st.carry ?? null;
  if (agent.state === 'WALK' && st.carry && agent.job?.index > 0) return st.carry;
  return null;
}

/**
 * Visita do tempo livre (17–20 h): taverna, capela, mercado ou padaria, se a
 * vila tiver e houver lugar. Sorteada uma vez por dia por morador.
 * @returns {object|null} destino, ou null (vai para a praça como antes)
 */
export function leisureGoal(agent) {
  const m = agent.manager, day = Math.floor(m.day);
  if (!agent._visit || agent._visit.day !== day) {
    agent._visit = { day, type: null };
    const types = agent.villageWork?.visitable ?? [];
    let r = agent.rng();
    for (const t of types) { const p = LEISURE_VISITS[t.type] ?? 0; if (r < p) { agent._visit.type = t; break; } r -= p; }
  }
  const b = agent._visit.type;
  if (!b || agent._visit.failed) return null;
  let st = agent.visiting;
  if (!st) {
    for (const s of m.registry.of(b.id)) if (s.role === 'visitor' && m.registry.isFree(s, agent.id) && (!st || s.occupants.length < st.occupants.length)) st = s;
  }
  if (!st) return null;
  return { key: `VISIT:${st.id}`, x: st.x, z: st.z, state: st.sit ? 'SITTING' : 'IDLE', yaw: st.yaw, gesture: st.gesture, visit: st, seat: st.sit, noTeleport: true };
}

/** Chegou ao lugar de visita: ocupa (respeita a lotação); cheio → volta para a praça. */
export function arriveAtVisit(agent) {
  const st = agent.goal.visit, reg = agent.manager.registry;
  if (Math.hypot(agent.pos.x - st.x, agent.pos.z - st.z) > STATION_RULES.arriveRadius || !reg.claim(st, agent.id)) {
    agent._visit.failed = true;
    agent.state = 'IDLE';
    return false;
  }
  agent.visiting = st;
  agent.pos.x = st.x; agent.pos.z = st.z;
  agent.yaw = st.yaw;
  agent.manager.onVisit?.(agent, st);
  return true;
}

/**
 * Estado de IA legível (rotina + trabalho), para a depuração e os testes:
 * SLEEPING · WAKING_UP · GOING_TO_WORK · WORKING · TAKING_BREAK · EATING ·
 * SOCIALIZING · GOING_HOME · IDLE
 */
export function aiStateOf(agent) {
  const key = agent.goal?.key ?? '', walking = agent.state === 'WALK';
  if (agent.state === 'SLEEPING') return 'SLEEPING';
  if (agent.state === 'SHELTER') return 'IDLE';
  if (key === 'WAKE') return 'WAKING_UP';
  if (key.startsWith('WORK:')) return isWorking(agent) ? 'WORKING' : walking ? 'GOING_TO_WORK' : 'IDLE';
  if (key === 'PATROL' || key === 'POST') return 'WORKING';
  if (key.startsWith('WAIT:')) return walking ? 'GOING_TO_WORK' : 'TAKING_BREAK';
  if (key === 'LUNCH') return walking ? 'TAKING_BREAK' : 'EATING';
  if (key.startsWith('VISIT:') || key.startsWith('LEISURE') || key === 'PLAY' || key === 'REST' || key === 'FREE') return 'SOCIALIZING';
  if (key === 'HOME') return 'GOING_HOME';
  return 'IDLE';
}
