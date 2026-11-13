import { GOODS, START_STOCK, FARMING, CYCLES, ABSTRACT } from '../../config/workplaces.js';

/**
 * Estoque e produção de uma vila (regra pura).
 *
 * Os ofícios produzem de verdade: o passo final de cada ciclo de trabalho
 * consome os materiais e entrega o produto — e só entrega se houver material.
 * Vila longe do jogador produz por simulação abstrata (`abstract`), sem
 * animação.
 *
 * @example
 * const eco = new VillageEconomy();
 * eco.finish({ consume: { farinha: 1 }, produce: { pao: 2 } });   // { produced: { pao: 2 } }
 * eco.count('pao');                                                 // 6 (4 do começo + 2)
 */
export class VillageEconomy {
  constructor({ start = START_STOCK, goods = GOODS } = {}) {
    this.goods = goods;
    this.stock = new Map(Object.entries(start));
    /** total produzido por recurso (estatística/depuração) */
    this.produced = {};
    /** unidades postas à venda pelos mercadores: recurso → n (o jogo repõe as lojas com isto) */
    this.forSale = {};
  }

  count(id) {
    return this.stock.get(id) ?? 0;
  }

  has(need) {
    for (const [id, n] of Object.entries(need ?? {})) if (this.count(id) < n) return false;
    return true;
  }

  /** Soma ao depósito, respeitando o teto de cada recurso. @returns {Record<string, number>} o que coube */
  add(goods) {
    const got = {};
    for (const [id, n] of Object.entries(goods ?? {})) {
      const cap = this.goods[id]?.cap ?? 99, cur = this.count(id), put = Math.max(0, Math.min(n, cap - cur));
      if (put > 0) { this.stock.set(id, cur + put); got[id] = put; this.produced[id] = (this.produced[id] ?? 0) + put; }
    }
    return got;
  }

  /** Tira do depósito (tudo ou nada). @returns {boolean} */
  take(goods) {
    if (!this.has(goods)) return false;
    for (const [id, n] of Object.entries(goods ?? {})) this.stock.set(id, this.count(id) - n);
    return true;
  }

  /**
   * Fim de um passo do ciclo: consome e produz. Sem material → não produz.
   * @param {{ consume?: object, produce?: object }} step
   * @returns {{ produced: Record<string, number> } | { starved: string[] } | null}
   */
  finish(step) {
    if (!step.produce && !step.consume) return null;
    if (step.consume && !this.take(step.consume)) return { starved: Object.keys(step.consume).filter((id) => this.count(id) < step.consume[id]) };
    return { produced: this.add(step.produce) };
  }

  /**
   * Mercador: põe à venda uma unidade de cada produto que a vila tem (o jogo
   * usa `forSale` para repor as lojas).
   * @param {string[]} ids recursos que viram mercadoria
   */
  distribute(ids) {
    const moved = {};
    for (const id of ids) if (this.count(id) > 0) { this.stock.set(id, this.count(id) - 1); this.forSale[id] = (this.forSale[id] ?? 0) + 1; moved[id] = 1; }
    return moved;
  }

  /**
   * Produção abstrata (vila longe): cada trabalhador faz `cyclesPerHour` ciclos
   * por hora de jogo, limitado pelos materiais.
   * @param {number} hours horas de jogo passadas
   * @param {Record<string, number>} workers profissão → quantos em serviço
   */
  abstract(hours, workers, cfg = ABSTRACT) {
    for (const [prof, n] of Object.entries(workers)) {
      const cycle = CYCLES[prof];
      if (!cycle || n <= 0) continue;
      this._frac ??= {};
      this._frac[prof] = (this._frac[prof] ?? 0) + hours * cfg.cyclesPerHour * n;
      let times = Math.floor(this._frac[prof]);
      this._frac[prof] -= times;
      for (; times > 0; times--) {
        for (const step of cycle) {
          if (step.farm || step.farmStore) continue; // a lavoura abstrata rende abaixo
          this.finish(step);
        }
        if (prof === 'agricultor') this.add(times % 2 ? FARMING.harvest.wheat : FARMING.harvest.veg);
      }
    }
  }

  serialize() {
    return { stock: [...this.stock], forSale: { ...this.forSale } };
  }

  load(data) {
    if (!data) return;
    this.stock = new Map((data.stock ?? []).filter(([id, n]) => typeof id === 'string' && n >= 0));
    this.forSale = { ...(data.forSale ?? {}) };
  }
}

/**
 * Leiras de uma fazenda com crescimento em estágios (regra pura).
 * 0 terra arada → 1 semeado → 2 broto → 3 crescendo → 4 maduro → colheita → 0.
 * Trabalhar na leira adianta; do estágio 1 em diante ela também cresce sozinha
 * com o tempo de jogo.
 *
 * @example
 * const plots = new FarmPlots([{ crop: 'wheat' }, { crop: 'veg' }]);
 * plots.work(0);            // { action: 'till' } … até { action: 'harvest', yield: { trigo: 4 } }
 * plots.grow(3);            // 3 h de jogo
 */
export class FarmPlots {
  constructor(plots, cfg = FARMING) {
    this.cfg = cfg;
    this.plots = plots.map((p, i) => ({ id: i, crop: p.crop, stage: (i * 2) % 5, work: 0, grown: 0 }));
  }

  /** Nome do que o agricultor faz na leira neste estágio. */
  actionFor(stage) {
    return ['plant', 'water', 'tend', 'tend', 'harvest'][stage];
  }

  /**
   * Um passo de trabalho numa leira.
   * @returns {{ action: string, stage: number, yield?: Record<string, number> }}
   */
  work(id) {
    const p = this.plots[id], action = this.actionFor(p.stage);
    if (p.stage === 4) { // colhe: a leira volta a terra arada
      p.stage = 0; p.work = 0; p.grown = 0;
      return { action, stage: 0, yield: { ...this.cfg.harvest[p.crop] } };
    }
    p.work += 1;
    if (p.work >= this.cfg.workPerStage) { p.work = 0; p.stage += 1; }
    return { action, stage: p.stage };
  }

  /** Crescimento com o tempo (só depois de semeado). */
  grow(hours) {
    const perStage = this.cfg.growHours / 3;
    for (const p of this.plots) {
      if (p.stage < 1 || p.stage >= 4) continue;
      p.grown += hours;
      while (p.grown >= perStage && p.stage < 4) { p.grown -= perStage; p.stage += 1; p.work = 0; }
    }
  }

  /** Leira que mais precisa de trabalho (madura primeiro). */
  neediest() {
    let best = this.plots[0];
    for (const p of this.plots) if (p.stage === 4 && best.stage !== 4) best = p;
    return best;
  }
}

/**
 * Ciclo de trabalho de UM morador (regra pura): em que passo está, qual
 * estação quer, quanto falta, e o que acontece ao terminar. Não anda nem
 * anima — o `NPCAgent` pergunta `target()` e avisa `begin`/`tick`.
 *
 * @example
 * const job = new WorkRoutine({ agentId: 'ana', profession: 'padeiro', buildingId: 'bakery_01', registry, economy });
 * const t = job.target(now);                 // { station, step } ou { wait: 'occupied' }
 * job.begin(t.station, ctx);                 // { ok: true } → ocupa a estação
 * job.tick(dt);                              // null … { done: true, produced: { pao: 2 } }
 */
export class WorkRoutine {
  constructor({ agentId, profession, buildingId, registry, economy, farm = null, offset = 0, cycle = CYCLES[profession] }) {
    this.agentId = agentId;
    this.profession = profession;
    this.buildingId = buildingId;
    this.registry = registry;
    this.economy = economy;
    this.farm = farm;
    this.cycle = cycle ?? [];
    this.index = this.cycle.length ? offset % this.cycle.length : 0;
    this.station = null; // estação ocupada agora
    this.left = 0;
    this.waitUntil = 0;
    this.waitReason = null;
    this.replans = 0;
    this.starved = null; // materiais em falta (depuração)
    this.carrying = null; // colheita na mão até o celeiro
    this.done = 0; // ciclos completos
  }

  get step() {
    return this.cycle[this.index] ?? null;
  }

  /**
   * O que fazer agora.
   * @returns {{ station: object, step: object } | { wait: string }}
   */
  target(now) {
    const step = this.step;
    if (!step) return { wait: 'no-station' };
    if (this.station) return { station: this.station, step };
    if (now < this.waitUntil) return { wait: this.waitReason ?? 'occupied' };
    if (step.needs && !this.economy.has(step.needs)) this.starved = Object.keys(step.needs).filter((id) => this.economy.count(id) < step.needs[id]);
    else if (step.needs) this.starved = null;
    let st = null;
    if (step.farm && this.farm) {
      // leira que mais precisa; se as estações dela estão ocupadas, qualquer leira livre
      const want = this.farm.neediest().id;
      for (const s of this.registry.of(this.buildingId)) {
        if (s.kind !== 'plot' || !this.registry.isFree(s, this.agentId) || s.blockedUntil > now) continue;
        if (!st || (s.plot === want && st.plot !== want)) st = s;
      }
    } else st = this.registry.find({ buildingId: this.buildingId, kind: step.station, agentId: this.agentId, now });
    if (!st) { this.hold(now, this.registry.of(this.buildingId).some((s) => s.kind === step.station) ? 'occupied' : 'no-station'); return { wait: this.waitReason }; }
    return { station: st, step };
  }

  /** Espera um pouco antes de tentar de novo (sem trabalhar no ar). */
  hold(now, reason) {
    this.waitUntil = now + this.registry.rules.retrySeconds;
    this.waitReason = reason;
  }

  /**
   * Chegou: valida e ocupa a estação. Só depois disto o gesto de trabalho pode tocar.
   * @returns {{ ok: boolean, reason?: string }}
   */
  begin(station, ctx, now = 0) {
    const r = this.registry.validate(station, { agentId: this.agentId, profession: this.profession, ...ctx });
    if (r.ok && !this.registry.claim(station, this.agentId)) r.ok = false, r.reason = 'occupied';
    if (!r.ok) {
      if (r.reason !== 'occupied') this.registry.fail(station, r.reason, now);
      this.hold(now, r.reason);
      return r;
    }
    this.station = station;
    this.left = this.step.seconds;
    this.waitReason = null;
    this.replans = 0;
    return r;
  }

  /** Não conseguiu chegar: conta a tentativa; depois de `maxReplans`, marca a estação e espera. */
  unreachable(station, now) {
    this.replans += 1;
    if (this.replans < this.registry.rules.maxReplans) return false;
    this.replans = 0;
    this.registry.fail(station, 'unreachable', now);
    this.hold(now, 'unreachable');
    return true;
  }

  /**
   * Avança o passo em andamento.
   * @returns {null | { done: true, produced?: object, starved?: string[], farm?: object }}
   */
  tick(dt) {
    if (!this.station) return null;
    this.left -= dt;
    if (this.left > 0) return null;
    const step = this.step, st = this.station, out = { done: true };
    if (step.farm && this.farm && st.plot !== undefined) {
      out.farm = this.farm.work(st.plot);
      if (out.farm.yield) this.carrying = { ...(this.carrying ?? {}), ...out.farm.yield };
    } else if (step.farmStore) {
      if (this.carrying) { out.produced = this.economy.add(this.carrying); this.carrying = null; }
    } else if (step.distribute) {
      out.distributed = this.economy.distribute(Object.keys(this.economy.goods));
    } else {
      const r = this.economy.finish(step);
      if (r?.produced) out.produced = r.produced;
      if (r?.starved) { out.starved = r.starved; this.starved = r.starved; }
    }
    this.leave();
    this.index = (this.index + 1) % this.cycle.length;
    if (this.index === 0) this.done += 1;
    return out;
  }

  /** Solta a estação (fim do passo, fim do turno, interrupção). */
  leave() {
    if (this.station) this.registry.release(this.station, this.agentId);
    this.station = null;
    this.left = 0;
  }
}
