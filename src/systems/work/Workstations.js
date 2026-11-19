import { STATION_RULES } from '../../config/workplaces.js';

/**
 * Estações de trabalho (regra pura, sem Three.js).
 *
 * Uma estação é um lugar FÍSICO onde um morador pode trabalhar: tem prédio,
 * posição, altura do piso, para onde olhar, gesto, ferramenta e lotação.
 * Regra fundamental do jogo: ninguém trabalha sem uma estação válida,
 * alcançável e livre — `validate` diz por quê quando não pode.
 *
 * @example
 * const reg = new WorkstationRegistry();
 * reg.add({ id: 'forge_01:anvil', profession: 'ferreiro', buildingId: 'forge_01', kind: 'anvil',
 *   x: 10, y: 4.2, z: 15, yaw: Math.PI, gesture: 'hammer', tool: 'hammer', capacity: 1 });
 * const st = reg.find({ buildingId: 'forge_01', kind: 'anvil', agentId: 'ana' });
 * reg.validate(st, { agentId: 'ana', profession: 'ferreiro', pos: { x: 10.1, z: 15 }, floorAt: () => 4.2 }); // { ok: true }
 * reg.claim(st, 'ana');
 */
export class WorkstationRegistry {
  constructor(rules = STATION_RULES) {
    this.rules = rules;
    /** @type {Map<string, object>} */
    this.stations = new Map();
    this.byBuilding = new Map();
  }

  /**
   * Registra uma estação.
   * @param {{ id: string, profession: string|null, buildingId: string, kind: string, role?: 'worker'|'visitor',
   *   x: number, y: number, z: number, yaw: number, gesture: string, tool?: string|null, carry?: string|null,
   *   fx?: string|null, sit?: boolean, capacity?: number, plot?: number }} s
   */
  add(s) {
    if (this.stations.has(s.id)) throw new Error(`Estação duplicada: ${s.id}`);
    const st = { role: 'worker', tool: null, carry: null, fx: null, sit: false, capacity: 1, ...s, occupants: [], blockedUntil: 0, lastFail: null };
    this.stations.set(st.id, st);
    if (!this.byBuilding.has(st.buildingId)) this.byBuilding.set(st.buildingId, []);
    this.byBuilding.get(st.buildingId).push(st);
    return st;
  }

  /** Tira todas as estações de um prédio (prédio removido). */
  removeBuilding(buildingId) {
    for (const st of this.byBuilding.get(buildingId) ?? []) this.stations.delete(st.id);
    this.byBuilding.delete(buildingId);
  }

  get(id) {
    return this.stations.get(id) ?? null;
  }

  of(buildingId) {
    return this.byBuilding.get(buildingId) ?? [];
  }

  isFree(st, agentId = null) {
    return st.occupants.length < st.capacity || st.occupants.includes(agentId);
  }

  /**
   * Estação livre de um tipo num prédio (prefere a que o próprio agente já
   * ocupa; depois a menos cheia). `now` pula as que falharam há pouco.
   * @returns {object|null}
   */
  find({ buildingId, kind, role = 'worker', agentId = null, now = 0, except = null }) {
    let best = null;
    for (const st of this.of(buildingId)) {
      if (st.kind !== kind || st.role !== role || st === except) continue;
      if (st.occupants.includes(agentId)) return st;
      if (!this.isFree(st) || st.blockedUntil > now) continue;
      if (!best || st.occupants.length < best.occupants.length) best = st;
    }
    return best;
  }

  /**
   * Pode trabalhar aqui AGORA? Confere tudo o que impede o "trabalho no ar".
   * @param {object|null} st
   * @param {{ agentId: string, profession?: string|null, pos: { x: number, z: number, y?: number },
   *   floorAt?: (x: number, z: number) => number, isClear?: (x: number, z: number) => boolean }} ctx
   * @returns {{ ok: boolean, reason?: 'no-station'|'wrong-profession'|'occupied'|'too-far'|'no-floor'|'blocked' }}
   */
  validate(st, { agentId, profession = null, pos, floorAt = null, isClear = null }) {
    if (!st || !this.stations.has(st.id)) return { ok: false, reason: 'no-station' };
    if (st.role === 'worker' && st.profession && profession !== st.profession) return { ok: false, reason: 'wrong-profession' };
    if (!this.isFree(st, agentId)) return { ok: false, reason: 'occupied' };
    if (Math.hypot(pos.x - st.x, pos.z - st.z) > this.rules.arriveRadius) return { ok: false, reason: 'too-far' };
    if (floorAt) {
      const y = floorAt(st.x, st.z);
      if (!Number.isFinite(y) || Math.abs(y - st.y) > this.rules.floorTolerance) return { ok: false, reason: 'no-floor' };
    }
    if (isClear && !isClear(st.x, st.z)) return { ok: false, reason: 'blocked' };
    return { ok: true };
  }

  /** Ocupa a estação (respeita a lotação). @returns {boolean} */
  claim(st, agentId) {
    if (st.occupants.includes(agentId)) return true;
    if (st.occupants.length >= st.capacity) return false;
    st.occupants.push(agentId);
    return true;
  }

  release(st, agentId) {
    const i = st.occupants.indexOf(agentId);
    if (i >= 0) st.occupants.splice(i, 1);
  }

  /** Solta tudo o que o agente ocupa (fim do turno, fuga, morte). */
  releaseAll(agentId) {
    for (const st of this.stations.values()) this.release(st, agentId);
  }

  /** Marca a estação como problemática por um tempo (inalcançável, bloqueada). */
  fail(st, reason, now) {
    st.lastFail = reason;
    st.blockedUntil = now + this.rules.retrySeconds;
  }
}

/**
 * Distribui os empregos de uma vila (regra pura, determinística): cada prédio
 * abre `workers` vagas da sua profissão; os adultos que não são guardas as
 * preenchem. Quem sobra fica sem ofício (`profession = null`) e NÃO trabalha —
 * passa o dia pela vila. Guardas, crianças e idosos não mudam.
 *
 * @param {object[]} people saída de generatePopulation (alterada no lugar)
 * @param {{ id: string, profession: string, workers: number }[]} buildings
 * @param {() => number} rng
 * @returns {Map<string, { building: object, index: number }>} id da pessoa → emprego
 */
export function assignJobs(people, buildings, rng) {
  const jobs = new Map();
  const adults = people.filter((p) => p.age === 'adult' && p.profession !== 'guarda');
  for (let i = adults.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [adults[i], adults[j]] = [adults[j], adults[i]]; }
  // Uma vaga por prédio de cada vez: toda oficina ganha alguém antes de alguma lotar.
  const open = buildings.map((b) => ({ b, n: 0 })).filter((o) => o.b.workers > 0);
  let k = 0;
  for (let round = 0; k < adults.length && open.some((o) => o.n < o.b.workers); round++) {
    for (const o of open) {
      if (k >= adults.length) break;
      if (o.n >= o.b.workers) continue;
      const p = adults[k++];
      p.profession = o.b.profession;
      jobs.set(p.id, { building: o.b, index: o.n++ });
    }
  }
  for (; k < adults.length; k++) adults[k].profession = null;
  return jobs;
}
