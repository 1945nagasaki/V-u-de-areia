import { NavGrid } from './NavGrid.js';
import { WorkstationRegistry, assignJobs } from './Workstations.js';
import { VillageEconomy, FarmPlots, WorkRoutine } from './Production.js';
import { NAV, STATION_RULES, MARKET_LINK, ROUTE_BUDGET_MS } from '../../config/workplaces.js';
import { WORLD } from '../../config/worldConfig.js';
import { setPlotStage } from '../../villages/Workplaces.js';

/**
 * Trabalho da vila no mundo de verdade: junta os prédios construídos
 * (`village.workplaces`), as estações, os empregos, o estoque, as plantações
 * e a grade de navegação. Vive dentro do `NPCManager` (`manager.work`).
 *
 * Tudo que olha o cenário passa por aqui, com a MESMA regra de colisão que
 * segura o jogador e os moradores (faixa de altura incluída: telhado e verga
 * não bloqueiam quem anda embaixo):
 *  - `isClearAt` — o ponto de interação não está dentro de um objeto;
 *  - `walkable` — célula de navegação: seca, sem parede, sem encosta;
 *  - `route` — A* na grade da vila (com orçamento de tempo por quadro).
 *
 * @example
 * const work = new VillageWork(game);
 * const vw = work.setupVillage(vs, people, rng);   // antes de criar os agentes
 * work.route(vs, from, to);                         // [{x,z}…] | null (sem caminho) | undefined (tente no próximo quadro)
 */
export class VillageWork {
  constructor(game) {
    this.game = game;
    this.registry = new WorkstationRegistry();
    this.budgetUntil = 0;
    /** estatística (depuração / verificação) */
    this.stats = { routes: 0, failedRoutes: 0, deferred: 0, maxRouteMs: 0, navCells: 0, navMs: 0 };
  }

  /** Chão (o mesmo que segura os pés dos moradores). */
  floorAt = (x, z, y = Infinity) => this.game.groundHeight(x, z, y === Infinity ? this.game.terrain.heightAt(x, z) + 0.3 : y);

  /**
   * Ponto livre de colisores na altura do corpo (como o CollisionWorld.resolve).
   * @param {number} r folga (m)
   */
  isClearAt(x, z, r = STATION_RULES.clearRadius, feet = this.game.terrain.heightAt(x, z)) {
    for (const c of this.game.collisions.query(x, z)) {
      if (c.enabled === false) continue;
      if (c.y0 !== undefined && (feet + NAV.headHeight < c.y0 || feet > c.y1 - 0.25)) continue;
      if (c.type === 'circle') { if (Math.hypot(x - c.x, z - c.z) < c.r + r) return false; continue; }
      const dx = x - c.x, dz = z - c.z, lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
      if (Math.abs(lx) < c.hw + r && Math.abs(lz) < c.hd + r) return false;
    }
    return true;
  }

  /** Célula andável: terra seca (ou ponte/piso), sem parede, sem encosta acima do limite. */
  walkable(x, z) {
    const T = this.game.terrain, h = T.heightAt(x, z);
    const surf = this.game.surfaces?.heightAt(x, z, h + 3) ?? -Infinity;
    const feet = Math.max(h, surf);
    if (feet < WORLD.waterLevel - 0.25) return false;
    if (surf <= h + 0.05) { // só relevo: encosta
      const e = NAV.cell * 0.5;
      const s = Math.max(Math.abs(T.heightAt(x + e, z) - T.heightAt(x - e, z)), Math.abs(T.heightAt(x, z + e) - T.heightAt(x, z - e))) / (2 * e);
      if (s > NAV.slopeMax) return false;
    }
    return this.isClearAt(x, z, NAV.agentRadius, feet);
  }

  /**
   * Prepara a vila: estações no registro, empregos para os moradores, estoque,
   * plantações e a grade de navegação.
   * @returns {object} `vs.work`
   */
  setupVillage(vs, people, rng) {
    const v = vs.village, wps = v.workplaces ?? [];
    const vw = { buildings: wps, economy: new VillageEconomy(), farms: new Map(), jobs: new Map(), nav: null, visitable: [], abstractHours: 0 };
    for (const wp of wps) {
      wp.stations = wp.stations.filter((s) => this.settleStation(s, wp));
      for (const s of wp.stations) this.registry.add(s);
      if (wp.plots.length) vw.farms.set(wp.id, new FarmPlots(wp.plots.map((p) => ({ crop: p.crop }))));
      if (wp.stations.some((s) => s.role === 'visitor')) vw.visitable.push({ id: wp.id, type: wp.type });
    }
    // as leiras mostram o estágio do começo
    for (const wp of wps) for (const p of wp.plots) setPlotStage(p, vw.farms.get(wp.id).plots[p.id].stage);
    vw.jobs = assignJobs(people, wps, rng);
    if (wps.length || true) {
      const t0 = performance.now(), half = v.radius + NAV.margin;
      vw.nav = NavGrid.build({ cx: v.x, cz: v.z, half, cell: NAV.cell, isBlocked: (x, z) => !this.walkable(x, z) });
      this.stats.navMs += performance.now() - t0;
      this.stats.navCells += vw.nav.cols * vw.nav.rows;
    }
    vs.work = vw;
    return vw;
  }

  /**
   * Confere a estação contra o mundo de verdade (colisores automáticos já
   * existem): se o ponto de interação ficou dentro de um móvel ou parede,
   * recua para longe do objeto (e depois para os lados) até achar chão livre,
   * e recalcula para onde olhar. Sem ponto livre a até 1,4 m, a estação NÃO
   * entra no registro (ninguém vai trabalhar ali).
   * @returns {boolean} true = estação válida
   */
  settleStation(s, wp) {
    this.stats.settled ??= 0; this.stats.dropped ??= [];
    const ok = (x, z) => this.isClearAt(x, z) && this.walkable(x, z);
    if (!ok(s.x, s.z)) {
      const tx = s.target.x, tz = s.target.z;
      let dx = s.x - tx, dz = s.z - tz;
      const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      let found = null;
      for (let k = 1; k <= 10 && !found; k++) {
        const r = k * 0.14;
        for (const side of [0, 1, -1]) { // para trás, depois na diagonal
          const x = s.x + dx * r - dz * side * r * 0.7, z = s.z + dz * r + dx * side * r * 0.7;
          if (ok(x, z)) { found = { x, z }; break; }
        }
      }
      if (!found) { this.stats.dropped.push(s.id); return false; }
      s.x = found.x; s.z = found.z;
      s.yaw = Math.atan2(tx - s.x, tz - s.z);
      this.stats.settled++;
    }
    s.y = this.floorAt(s.x, s.z);
    return true;
  }

  /** Cria a rotina de trabalho de um morador empregado (ou null). */
  jobFor(vs, agent) {
    const job = vs.work?.jobs.get(agent.person.id);
    if (!job) return null;
    const b = job.building;
    agent.workBuilding = b;
    agent.villageWork = vs.work;
    return new WorkRoutine({
      agentId: agent.id, profession: b.profession, buildingId: b.id, registry: this.registry, economy: vs.work.economy,
      farm: vs.work.farms.get(b.id) ?? null, offset: job.index * 2,
    });
  }

  /**
   * Rota pela grade da vila. Orçamento de tempo por quadro: se esgotou, devolve
   * `undefined` e o morador pede de novo no próximo quadro (nada de engasgo
   * quando a vila inteira sai para o trabalho às 7 h).
   * @returns {{x:number, z:number}[] | null | undefined}
   */
  route(vs, from, to) {
    const nav = vs.work?.nav;
    if (!nav) return undefined;
    const now = performance.now();
    if (now > this.budgetUntil + 1000 / 30) this.budgetUntil = now + ROUTE_BUDGET_MS; // novo quadro: orçamento novo
    if (now > this.budgetUntil) { this.stats.deferred++; return undefined; }
    const path = nav.path(from, to);
    const ms = performance.now() - now;
    this.stats.routes++;
    this.stats.maxRouteMs = Math.max(this.stats.maxRouteMs, ms);
    if (!path) this.stats.failedRoutes++;
    return path;
  }

  /** Um passo de trabalho terminou: plantação, celeiro, mercado. */
  onWorkStep(agent, r) {
    const vs = agent.villageState ?? this.game.npcManager?.villages.find((x) => x.village === agent.village);
    const st = agent.job?.station ?? agent.goal?.station;
    if (r.farm && st?.plot !== undefined) {
      const plot = agent.workBuilding.plots[st.plot];
      if (plot) setPlotStage(plot, r.farm.stage);
    }
    if (r.distributed) {
      const shops = this.game.gear?.shops, hours = this.game.gameClock?.totalHours ?? 0;
      for (const id of Object.keys(r.distributed)) {
        const item = MARKET_LINK[id];
        if (!item || !shops) continue;
        const vendor = shops.vendor(`${agent.village.config.id}:mercador`, hours);
        vendor.sold[item] = (vendor.sold[item] ?? 0) - 1; // mais uma unidade na banca do mercador da vila
      }
    }
    if (vs) vs.work.lastStep = { who: agent.name, kind: st?.kind, r };
  }

  /** Crescimento das plantações com o tempo de jogo (todas as vilas). */
  grow(vs, hours) {
    const vw = vs.work;
    if (!vw || !hours) return;
    for (const wp of vw.buildings) {
      const farm = vw.farms.get(wp.id);
      if (!farm) continue;
      farm.grow(hours);
      if (vs.active) for (const p of wp.plots) setPlotStage(p, farm.plots[p.id].stage);
    }
  }

  /** Vila longe: produção abstrata (sem andar nem animar), só no horário de trabalho. */
  abstract(vs, hours, working) {
    const vw = vs.work;
    if (!vw || !working || !hours) return;
    const workers = {};
    for (const a of vs.agents) if (a.job && !a.down) workers[a.workBuilding.profession] = (workers[a.workBuilding.profession] ?? 0) + 1;
    vw.economy.abstract(hours, workers);
  }
}
