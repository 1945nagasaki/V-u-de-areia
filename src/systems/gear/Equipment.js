import { GEAR_CATALOG, DURABILITY, MELEE, BOW, FIREARMS, TIERS } from '../../config/gear.js';

/**
 * Equipamentos com estado próprio (regra pura, sem Three.js).
 *
 * Cada arma/ferramenta comprada vira uma INSTÂNCIA: `{ uid, id, durability, mag }`.
 * Itens empilháveis (comida, munição, recursos) continuam sendo só uma contagem
 * no `PlayerState.inventory`.
 *
 * @example
 * const store = new EquipmentStore();
 * const gun = store.create('pistola');   // durabilidade cheia, carregador vazio
 * store.wear(gun);                        // -1 de durabilidade
 * store.isBroken(gun);                    // false
 */
export class EquipmentStore {
  constructor({ catalog = GEAR_CATALOG } = {}) {
    this.catalog = catalog;
    /** @type {Map<string, { uid: string, id: string, durability: number, mag?: number }>} */
    this.instances = new Map();
    this.nextUid = 1;
  }

  /** É um equipamento com instância (arma branca, ferramenta, arco, arma de fogo)? */
  isEquipment(id) {
    return !!this.catalog[id]?.equipment;
  }

  /**
   * Cria um equipamento novo: durabilidade cheia e, se for arma de fogo, DESCARREGADA.
   * @param {string} id
   */
  create(id) {
    const def = this.catalog[id];
    if (!def?.equipment) throw new Error(`EquipmentStore.create: "${id}" não é um equipamento`);
    const inst = { uid: `e${this.nextUid++}`, id, durability: def.durabilityMax };
    if (def.magazine) inst.mag = 0;
    this.instances.set(inst.uid, inst);
    return inst;
  }

  get(uid) {
    return this.instances.get(uid) ?? null;
  }

  remove(uid) {
    return this.instances.delete(uid);
  }

  list() {
    return [...this.instances.values()];
  }

  def(inst) {
    return this.catalog[inst.id];
  }

  isBroken(inst) {
    return inst.durability <= 0;
  }

  /** 0..1 da durabilidade restante. */
  fraction(inst) {
    return Math.max(0, inst.durability) / this.def(inst).durabilityMax;
  }

  /** Abaixo de 20% (e ainda inteiro): a interface avisa. */
  isLow(inst) {
    return !this.isBroken(inst) && this.fraction(inst) < DURABILITY.warnBelow;
  }

  /**
   * Gasta durabilidade (1 por impacto válido / disparo). Nunca fica negativa.
   * @returns {{ broke: boolean }} `broke` = quebrou AGORA
   */
  wear(inst, n = 1) {
    if (this.isBroken(inst)) return { broke: false };
    inst.durability = Math.max(0, inst.durability - n);
    return { broke: inst.durability === 0 };
  }

  /** Estado para o save. */
  serialize() {
    return { nextUid: this.nextUid, list: this.list().map((i) => ({ ...i })) };
  }

  /**
   * Carrega do save SUBSTITUINDO o que havia (carregar duas vezes não duplica).
   * Entradas inválidas são descartadas; valores são presos aos limites do item.
   */
  load(data) {
    this.instances.clear();
    this.nextUid = 1;
    for (const raw of data?.list ?? []) {
      const def = this.catalog[raw?.id];
      if (!def?.equipment || typeof raw.uid !== 'string' || this.instances.has(raw.uid)) continue;
      const inst = { uid: raw.uid, id: raw.id, durability: clampInt(raw.durability, 0, def.durabilityMax) };
      if (def.magazine) inst.mag = clampInt(raw.mag, 0, def.magazine);
      this.instances.set(inst.uid, inst);
      const n = Number(raw.uid.slice(1));
      if (Number.isFinite(n)) this.nextUid = Math.max(this.nextUid, n + 1);
    }
    this.nextUid = Math.max(this.nextUid, clampInt(data?.nextUid, 1, Number.MAX_SAFE_INTEGER));
  }
}

function clampInt(v, lo, hi) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
}

/**
 * Golpe corpo a corpo: respeita o intervalo mínimo e testa o impacto UMA vez,
 * na janela certa da animação (`impactAt`). Golpear o ar não gasta durabilidade
 * (quem gasta é o jogo, só quando o impacto acerta algo válido).
 *
 * @example
 * const s = new MeleeSwing();
 * s.start(time, 'espada');          // true se podia atacar
 * if (s.update(time)) { ...testa o acerto... }   // true num único quadro
 */
export class MeleeSwing {
  constructor(table = MELEE) {
    this.table = table;
    this.nextAt = -Infinity;
    this.impactTime = null;
    this.endTime = -Infinity;
    this.base = null;
  }

  canStart(time) {
    return time >= this.nextAt;
  }

  /** @param {string} base 'adaga' | 'espada' | 'machado' | 'picareta' */
  start(time, base) {
    const m = this.table[base];
    if (!m || !this.canStart(time)) return false;
    this.base = base;
    this.startTime = time;
    this.nextAt = time + m.interval;
    this.impactTime = time + m.swing * m.impactAt;
    this.endTime = time + m.swing;
    return true;
  }

  /** 0..1 enquanto o golpe está em andamento (para a animação); 1 = terminou. */
  progress(time) {
    if (!this.base || time >= this.endTime) return 1;
    return Math.max(0, (time - this.startTime) / (this.endTime - this.startTime));
  }

  /** true exatamente uma vez por golpe, quando o tempo cruza a janela de impacto. */
  update(time) {
    if (this.impactTime === null || time < this.impactTime) return false;
    this.impactTime = null;
    return true;
  }

  /** Trocou de item no meio do golpe: o impacto pendente não acontece. */
  cancel() {
    this.impactTime = null;
    this.endTime = -Infinity;
  }
}

/** Teto absoluto de dano do nível (pedra 10, ouro 20, metal 30); sem nível = sem teto próprio. */
export function capDamage(damage, tier) {
  const cap = TIERS[tier]?.damageCap ?? TIERS.metal.damageCap;
  return Math.min(damage, cap);
}

/**
 * Dano final de um acerto do pacote: valor fixo do item, limitado pelo teto do
 * nível. Não existe crítico, tiro na cabeça nem outro multiplicador.
 * @param {object} def definição do catálogo (arma branca, flecha ou arma de fogo)
 */
export function hitDamage(def) {
  return capDamage(def.damage, def.materialTier);
}

/**
 * Arma de fogo semiautomática: carregador + reserva separados, recarga com
 * tempo, tiro bloqueado durante a recarga. A reserva é injetada
 * (`{ count(ammoId), take(ammoId, n) }`) — no jogo, a mochila.
 *
 * Invariante: carregador + reserva só diminui 1 por tiro; recarregar conserva o total.
 *
 * @example
 * const fa = new Firearm(store, reserve);
 * fa.startReload(gun);                 // { ok: true }
 * fa.update(1.8, gun);                 // { reloaded: 16 } ao terminar
 * fa.fire(gun, time);                  // { ok: true, damage: 22 }
 */
export class Firearm {
  /**
   * @param {EquipmentStore} store
   * @param {{ count: (id: string) => number, take: (id: string, n: number) => void }} reserve
   */
  constructor(store, reserve, table = FIREARMS) {
    this.store = store;
    this.reserve = reserve;
    this.table = table;
    /** recarga em andamento: { uid, left, total } */
    this.reloading = null;
    this.nextShotAt = -Infinity;
  }

  cfg(inst) {
    return this.table[inst.id];
  }

  isReloading(inst) {
    return this.reloading?.uid === inst.uid;
  }

  /** 0..1 da recarga em andamento (0 se não estiver recarregando). */
  reloadProgress(inst) {
    return this.isReloading(inst) ? 1 - this.reloading.left / this.reloading.total : 0;
  }

  /**
   * Um tiro por acionamento. Gasta 1 bala e 1 de durabilidade, acerte ou não.
   * @returns {{ ok: boolean, reason?: 'broken'|'reloading'|'empty'|'cooldown', damage?: number, broke?: boolean }}
   */
  fire(inst, time) {
    const c = this.cfg(inst);
    if (this.store.isBroken(inst)) return { ok: false, reason: 'broken' };
    if (this.isReloading(inst)) return { ok: false, reason: 'reloading' };
    if (time < this.nextShotAt) return { ok: false, reason: 'cooldown' };
    if (inst.mag <= 0) return { ok: false, reason: 'empty' };
    inst.mag -= 1;
    this.nextShotAt = time + c.interval;
    const { broke } = this.store.wear(inst);
    return { ok: true, damage: hitDamage(this.store.def(inst)), broke };
  }

  /**
   * Começa a recarga (tecla R). Nada é transferido até terminar.
   * @returns {{ ok: boolean, reason?: 'broken'|'reloading'|'full'|'no-reserve' }}
   */
  startReload(inst) {
    const c = this.cfg(inst);
    if (this.store.isBroken(inst)) return { ok: false, reason: 'broken' };
    if (this.reloading) return { ok: false, reason: 'reloading' };
    if (inst.mag >= c.magazine) return { ok: false, reason: 'full' };
    if (this.reserve.count(c.ammo) <= 0) return { ok: false, reason: 'no-reserve' };
    this.reloading = { uid: inst.uid, left: c.reload, total: c.reload };
    return { ok: true };
  }

  /** Cancela a recarga antes do fim: nada é transferido nem perdido. */
  cancelReload() {
    const was = !!this.reloading;
    this.reloading = null;
    return was;
  }

  /**
   * Avança a recarga. Ao concluir: transferir = min(capacidade − carregador, reserva).
   * @returns {{ reloaded: number } | null} balas transferidas no quadro em que terminou
   */
  update(dt, inst) {
    const r = this.reloading;
    if (!r) return null;
    if (!inst || r.uid !== inst.uid) { this.reloading = null; return null; } // trocou de arma: cancela
    r.left -= dt;
    if (r.left > 0) return null;
    this.reloading = null;
    const c = this.cfg(inst);
    const n = Math.max(0, Math.min(c.magazine - inst.mag, this.reserve.count(c.ammo)));
    if (n > 0) { this.reserve.take(c.ammo, n); inst.mag += n; }
    return { reloaded: n };
  }
}

/**
 * Arco: clique começa a preparação (1 s); ao completar, dispara. O arco não tem
 * dano próprio: vale só o da flecha. Uma flecha por disparo, gasta no DISPARO
 * (cancelar a preparação não gasta nada).
 *
 * @example
 * const bow = new BowDraw(store, reserve);
 * bow.start(inst);                 // { ok: true, arrow: 'flecha' }
 * bow.update(1.0, inst);           // { fired: true, arrow: 'flecha', damage: 8 }
 */
export class BowDraw {
  constructor(store, reserve, cfg = BOW) {
    this.store = store;
    this.reserve = reserve;
    this.cfg = cfg;
    /** preparação em andamento: { uid, t } */
    this.drawing = null;
    /** tipo de flecha escolhido (X troca); null = o primeiro que houver na ordem de `cfg.ammo` */
    this.choice = null;
  }

  /** Flecha que o próximo disparo vai usar, ou null se não há nenhuma. */
  arrow() {
    if (this.choice && this.reserve.count(this.choice) > 0) return this.choice;
    return this.cfg.ammo.find((id) => this.reserve.count(id) > 0) ?? null;
  }

  /** Passa para o próximo tipo de flecha disponível na mochila. */
  cycle() {
    const have = this.cfg.ammo.filter((id) => this.reserve.count(id) > 0);
    if (!have.length) return null;
    this.choice = have[(have.indexOf(this.arrow()) + 1) % have.length];
    return this.choice;
  }

  get progress() {
    return this.drawing ? Math.min(1, this.drawing.t / this.cfg.draw) : 0;
  }

  /** @returns {{ ok: boolean, reason?: 'broken'|'drawing'|'no-arrow', arrow?: string }} */
  start(inst) {
    if (this.store.isBroken(inst)) return { ok: false, reason: 'broken' };
    if (this.drawing) return { ok: false, reason: 'drawing' };
    const arrow = this.arrow();
    if (!arrow) return { ok: false, reason: 'no-arrow' };
    this.drawing = { uid: inst.uid, t: 0, arrow };
    return { ok: true, arrow };
  }

  cancel() {
    const was = !!this.drawing;
    this.drawing = null;
    return was;
  }

  /** @returns {{ fired: true, arrow: string, damage: number, broke: boolean } | null} */
  update(dt, inst) {
    const d = this.drawing;
    if (!d) return null;
    if (!inst || d.uid !== inst.uid) { this.drawing = null; return null; }
    d.t += dt;
    if (d.t < this.cfg.draw) return null;
    this.drawing = null;
    // A flecha separada pode ter sumido da mochila no meio da preparação: usa a que houver.
    const arrow = this.reserve.count(d.arrow) > 0 ? d.arrow : this.arrow();
    if (!arrow) return null;
    this.reserve.take(arrow, 1);
    const { broke } = this.store.wear(inst);
    // dano do arco (0) NÃO soma: só a ponta da flecha conta
    return { fired: true, arrow, damage: hitDamage(this.store.catalog[arrow]), broke };
  }
}
