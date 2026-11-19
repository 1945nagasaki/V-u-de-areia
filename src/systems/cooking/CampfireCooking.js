import { COOKING } from '../../config/hunting.js';
import { ITEMS } from '../PlayerState.js';
import { FireCooker } from './FireCooker.js';

/**
 * Cozinha nas fogueiras: TODA comida só assa numa fogueira acesa (as das vilas
 * e as que o jogador acende). Cada fogueira guarda sua fila (FireCooker), que
 * continua assando com o jogador longe. O painel (CampfireUI) só pede ações.
 *
 * @example
 *   game.cooking = new CampfireCooking(game);
 *   game.cooking.open(fire);           // E perto do fogo
 *   game.cooking.put('carne_javali_crua');
 *   game.cooking.update(dt);           // no loop: assa e toca o chiado
 */
export class CampfireCooking {
  /**
   * @param {object} game Game (state, ui, fireLights, camera, time)
   * @param {{ ui?: { open(fire): void, close(): void, isOpen: boolean, refresh(): void }, sounds?: import('../../audio/FoodSounds.js').FoodSounds }} deps
   */
  constructor(game, { ui = null, sounds = null } = {}) {
    this.game = game;
    this.ui = ui;
    this.sounds = sounds;
    /** @type {Set<object>} fogueiras com algo no fogo ou pronto */
    this.active = new Set();
    this.fire = null; // fogueira do painel aberto
  }

  /** Fila da fogueira (criada na primeira vez). */
  cookerOf(fire) {
    if (!fire.cooker) fire.cooker = new FireCooker({ recipes: COOKING.recipes, times: COOKING.times, slots: COOKING.slots, defaultTime: COOKING.defaultTime });
    return fire.cooker;
  }

  /** Abre o painel "Fogueira — Assar Alimentos" para esta fogueira. */
  open(fire) {
    this.fire = fire;
    this.cookerOf(fire);
    this.ui?.open(fire);
  }

  close() {
    this.fire = null;
    this.ui?.close();
  }

  get isOpen() {
    return !!this.ui?.isOpen;
  }

  /** Itens da mochila que assam aqui: [{ id, n }]. */
  cookables() {
    const out = [];
    for (const [id, n] of this.game.state.inventory) if (n > 0 && COOKING.recipes[id] && COOKING.recipes[id] !== id) out.push({ id, n });
    return out;
  }

  /** Tira 1 da mochila e põe no fogo. */
  put(id) {
    const c = this.fire && this.cookerOf(this.fire);
    if (!c) return false;
    if (c.queue.length >= c.slots) { this.game.ui.toast('A fogueira está cheia: espere algo ficar pronto.'); return false; }
    if (!c.canCook(id) || !this.game.state.removeItem(id)) return false;
    c.put(id);
    this.active.add(this.fire);
    this.ui?.refresh();
    return true;
  }

  /** Tira da fila e devolve o cru para a mochila. */
  remove(index) {
    const c = this.fire?.cooker;
    const raw = c?.remove(index);
    if (raw) { this.returning = true; this.game.state.addItem(raw); this.returning = false; } // devolução: não é coleta
    this.ui?.refresh();
  }

  /** Recolhe tudo que ficou pronto nesta fogueira. */
  take() {
    const c = this.fire?.cooker;
    if (!c) return;
    const out = c.take();
    const parts = [];
    for (const [id, n] of Object.entries(out)) { this.game.state.addItem(id, n); parts.push(`${ITEMS[id]?.name ?? id}${n > 1 ? ` ×${n}` : ''}`); }
    if (parts.length) this.game.ui.toast(`Na mochila: ${parts.join(', ')}.`);
    this.ui?.refresh();
  }

  /** Cinza (curativos): uma vez a cada COOKING.ashCooldown s por fogueira. */
  takeAsh() {
    const fire = this.fire, g = this.game;
    if (!fire || g.time - (fire.ashAt ?? -Infinity) < COOKING.ashCooldown) return false;
    fire.ashAt = g.time;
    g.state.addItem('cinza');
    g.ui.toast('Cinza de Fogueira na mochila.');
    this.ui?.refresh();
    return true;
  }

  /** Assa em todas as fogueiras ativas e ajusta o chiado da mais perto. */
  update(dt) {
    const g = this.game;
    let loud = 0, pan = 0;
    const cam = g.camera?.position;
    for (const fire of this.active) {
      const c = fire.cooker;
      const done = dt > 0 ? c.update(dt) : [];
      if (done.length && fire === this.fire) g.ui.toast(`${done.map((id) => ITEMS[id]?.name ?? id).join(', ')}: pronto na fogueira.`);
      if (!c.busy && !Object.keys(c.output).length) { this.active.delete(fire); continue; }
      if (c.busy && cam && g.areaId === 'overworld') {
        const dx = fire.x - cam.x, dz = fire.z - cam.z, d = Math.hypot(dx, dz);
        const lv = Math.max(0, 1 - d / COOKING.sizzleRange);
        if (lv > loud) {
          loud = lv;
          // pan: lado da fogueira em relação à direção da câmera
          const yaw = g.cameraRig?.yaw ?? 0, rx = Math.cos(yaw), rz = -Math.sin(yaw);
          pan = d > 0.01 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)) : 0;
        }
      }
    }
    this.sounds?.setSizzle(g.pauseMenu?.open ? 0 : loud, pan);
    if (this.isOpen) {
      // Fechou sozinho se o jogador se afastou da fogueira.
      const p = g.player.position;
      if (this.fire && Math.hypot(this.fire.x - p.x, this.fire.z - p.z) > COOKING.radius + 1.5) this.close();
      else this.ui.tick?.();
    }
  }
}
