/**
 * Assar na fogueira (regra pura, testável): cada fogueira tem uma fila de
 * alimentos crus, assa UM por vez pelo tempo exato da receita e junta os
 * prontos na saída. O relógio é o dt do jogo (pausado = não assa).
 *
 * @example
 *   const c = new FireCooker({ recipes: { carne_javali_crua: 'carne_javali_assada' }, times: { carne_javali_crua: 15 } });
 *   c.put('carne_javali_crua');   // true (entra na fila)
 *   c.update(15);                 // ['carne_javali_assada'] — ficou pronto
 *   c.take();                     // { carne_javali_assada: 1 } — vai para a mochila
 */
export class FireCooker {
  /**
   * @param {{ recipes: Record<string,string>, times: Record<string,number>, slots?: number, defaultTime?: number }} cfg
   */
  constructor({ recipes, times, slots = 4, defaultTime = 6 }) {
    this.recipes = recipes;
    this.times = times;
    this.slots = slots;
    this.defaultTime = defaultTime;
    /** @type {{ raw: string, cooked: string, total: number, left: number }[]} fila (o primeiro está no fogo) */
    this.queue = [];
    /** @type {Record<string, number>} prontos esperando ser recolhidos */
    this.output = {};
  }

  /** O item assa nesta fogueira? */
  canCook(id) {
    return !!this.recipes[id] && this.recipes[id] !== id;
  }

  /** Segundos para assar o item. */
  timeFor(id) {
    return this.times[id] ?? this.defaultTime;
  }

  /** Põe um alimento cru na fila. @returns {boolean} false se não assa ou a fila está cheia */
  put(id) {
    if (!this.canCook(id) || this.queue.length >= this.slots) return false;
    const t = this.timeFor(id);
    this.queue.push({ raw: id, cooked: this.recipes[id], total: t, left: t });
    return true;
  }

  /** Tira da fila (devolve o cru) um item que ainda não começou, ou o que está no fogo. */
  remove(index) {
    const [e] = this.queue.splice(index, 1);
    return e?.raw ?? null;
  }

  /** O que está no fogo agora (ou null). */
  get current() {
    return this.queue[0] ?? null;
  }

  get busy() {
    return this.queue.length > 0;
  }

  /**
   * Avança o fogo. O tempo que sobra de um item passa para o próximo.
   * @returns {string[]} itens que ficaram prontos neste passo
   */
  update(dt) {
    const done = [];
    let t = dt;
    while (t > 0 && this.queue.length) {
      const c = this.queue[0];
      const step = Math.min(t, c.left);
      c.left -= step;
      t -= step;
      if (c.left <= 1e-9) {
        this.queue.shift();
        this.output[c.cooked] = (this.output[c.cooked] ?? 0) + 1;
        done.push(c.cooked);
      }
    }
    return done;
  }

  /** Recolhe tudo que está pronto. @returns {Record<string, number>} */
  take() {
    const out = this.output;
    this.output = {};
    return out;
  }
}
