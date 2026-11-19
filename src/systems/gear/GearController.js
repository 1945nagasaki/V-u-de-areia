import * as THREE from 'three';
import {
  GEAR_CATALOG, MELEE, BOW, FIREARMS, EXTRACTION, SHOP_ARSENAL, SHOP_PROVISIONS, BACKPACK, SAVE, COFFEE,
} from '../../config/gear.js';
import { STATUS_EFFECTS } from '../../config/gameplay.js';
import { SHOP_SMITH, SHOP_MATERIALS } from '../../config/items.js';
import { SHOP_FOOD } from '../../config/survival.js';
import { BLEED } from '../../config/hunting.js';
import { ITEMS } from '../PlayerState.js';
import { EquipmentStore, MeleeSwing, Firearm, BowDraw, hitDamage } from './Equipment.js';
import { Consumption, SurvivalNeeds } from './Consumption.js';
import { ShopStock, Extraction, buy, quote, hasRoom, slotsUsed, purchaseAmount } from './Trade.js';
import { snapshot, sanitize } from './GearSave.js';
import { GearModels } from '../../render/gear/GearModels.js';
import { HeldItem } from '../../render/gear/HeldItem.js';
import { GearHUD } from '../../ui/gear/GearHUD.js';
import { Mechanics } from '../Mechanics.js';

const REASONS = {
  coins: 'sem moedas', stock: 'esgotado', space: 'mochila cheia', 'not-for-sale': 'não está à venda',
};

/**
 * Liga o pacote de itens (config/gear.js) ao jogo: clique com o item
 * equipado, recarga (R), tipo de flecha (X), consumo com tempo, extração com
 * machado/picareta, compras, item na mão, HUD e save.
 *
 * As regras ficam nas classes puras (`Equipment`, `Consumption`, `Trade`,
 * `GearSave`); aqui só mora a cola com `Game`.
 *
 * Console (depuração): `game.gear.give('pistola')`, `game.gear.give('pao', 5)`,
 * `game.gear.save()`, `game.gear.resetSave()`.
 *
 * @example
 * game.gear = new GearController(game);
 * game.gear.handles(item) && game.gear.use(item);   // clique com item do pacote
 * game.gear.update(dt, busy);                        // a cada quadro, depois do jogador
 */
export class GearController {
  constructor(game, { storage = globalThis.localStorage ?? null } = {}) {
    this.game = game;
    this.storage = storage;
    const state = game.state;
    /** A mochila como reserva de munição/comida. */
    this.reserve = { count: (id) => state.inventory.get(id) ?? 0, take: (id, n) => state.removeItem(id, n) };
    this.store = new EquipmentStore();
    this.firearm = new Firearm(this.store, this.reserve);
    this.bow = new BowDraw(this.store, this.reserve);
    this.swing = new MeleeSwing();
    this.needs = new SurvivalNeeds(game.survival);
    this.consumption = new Consumption({ stock: this.reserve, needs: this.needs, applyEffect: (id) => state.addEffect(id) });
    this.extraction = new Extraction();
    this.shops = new ShopStock();
    this.models = new GearModels();
    this.held = new HeldItem({ models: this.models, humanoid: game.player.model, camera: game.camera });
    this.hud = new GearHUD(game.ui.root);
    this.consumeFromHand = false;
    this.swingItem = null; // { uid, def } do golpe em andamento
    this.extractMsg = null; // { label, progress, until }
    this._lastKey = null;
    this._saveIn = SAVE.autosaveSeconds;
    this._dir = new THREE.Vector3();
    this._origin = new THREE.Vector3();
    this._hud = { ammo: null, reload: null, durability: null, action: null, effects: [] };
    this._ammo = { mag: 0, reserve: 0, name: '', icon: 'bullet', hint: null };
    this._dur = { cur: 0, max: 1, low: false, broken: false };
    this._act = { label: '', progress: 0 };
    this._fx = [{ icon: 'cup', name: STATUS_EFFECTS[COFFEE.id].name, seconds: 0 }];
    this._none = [];
    this._anim = { swing: null, reload: null, draw: null, consume: null, pitch: 0, firstPerson: false, visible: true };

    // Pilha na hotbar que acabou: o atalho sai sozinho.
    state.on('change', () => { this.pruneHotbar(); if (game.inventory.slots.some((s) => s?.ref)) game.ui.refreshHotbar(game.inventory); });
    // Equipamento que entra como "pilha" (arco fabricado na mesa, por exemplo) vira instância
    // com durabilidade própria: equipamento nunca fica como contagem na mochila.
    state.on('item-added', ({ id, n }) => {
      if (!this.store.isEquipment(id)) return;
      state.inventory.delete(id);
      for (let i = 0; i < n; i++) this.store.create(id);
    });
    if (new URLSearchParams(globalThis.location?.search ?? '').has('novo')) this.resetSave();
    else this.load();
    globalThis.addEventListener?.('beforeunload', () => this.save());
  }

  // ------------------------------------------------------------ consultas

  /** O item é do pacote (tem regra aqui)? */
  handles(item) {
    return !!GEAR_CATALOG[item?.id];
  }

  /** Arma do pacote na mão (para os moradores perceberem o jogador armado). */
  isWeapon(id) {
    const d = GEAR_CATALOG[id];
    return !!d?.equipment && d.kind === 'weapon';
  }

  /** Equipamento (instância) do slot ativo, ou null. */
  equippedInstance() {
    const s = this.game.inventory.equipado;
    return s?.uid ? this.store.get(s.uid) : null;
  }

  /** Equipamentos guardados na mochila (fora da hotbar). */
  bagEquipment() {
    const inHotbar = new Set(this.game.inventory.slots.map((s) => s?.uid).filter(Boolean));
    return this.store.list().filter((i) => !inHotbar.has(i.uid));
  }

  /** Espaços da mochila: { used, total }. */
  capacity() {
    return { used: slotsUsed(this.game.state.inventory, this.bagEquipment().length, ITEMS), total: BACKPACK.slots };
  }

  // ------------------------------------------------------------ entrada de itens

  /**
   * Entrega um item do pacote (depuração e testes). Equipamento vira instância
   * nova na mochila; o resto soma à pilha.
   * @returns {object|number} a instância criada, ou a nova contagem
   */
  give(id, n = 1) {
    const d = GEAR_CATALOG[id];
    if (!d) throw new Error(`gear.give: item desconhecido "${id}"`);
    if (d.equipment) { const inst = this.store.create(id); this.game.state.emit('change'); return inst; }
    this.game.state.addItem(id, n);
    return this.reserve.count(id);
  }

  /**
   * Põe na hotbar: um equipamento da mochila (`uid`) ou o atalho de uma pilha
   * (`id` — a pilha continua na mochila; o slot some quando ela acaba).
   * @returns {boolean}
   */
  equip(idOrUid) {
    const g = this.game, inv = g.inventory;
    const inst = this.store.get(idOrUid) ?? this.bagEquipment().find((i) => i.id === idOrUid) ?? null;
    const id = inst?.id ?? idOrUid, d = GEAR_CATALOG[id];
    if (!d?.hotbar) return false;
    if (!inst && d.equipment) return false; // equipamento só existe como instância
    if (inst ? inv.slots.some((s) => s?.uid === inst.uid) : inv.slots.some((s) => s?.ref && s.id === id)) {
      inv.selecionar(inv.slots.findIndex((s) => (inst ? s?.uid === inst.uid : s?.ref && s.id === id)));
      return true;
    }
    if (!inst && this.reserve.count(id) <= 0) return false;
    const slot = inv.adicionarItem(inst ? { id, nome: d.name, icone: d.icon, tipo: d.kind, uid: inst.uid } : { id, nome: d.name, icone: d.icon, tipo: d.kind, ref: true });
    if (slot < 0) { g.ui.toast('Hotbar cheia: o item fica na mochila.'); return false; }
    g.ui.toast(`${d.name} na hotbar (slot ${slot + 1}).`);
    g.state.emit('change');
    return true;
  }

  /** Tira da hotbar de volta para a mochila (o item não some). */
  unequip(slot = this.game.inventory.selected) {
    const s = this.game.inventory.slots[slot];
    if (!s || !this.handles(s)) return false;
    this.game.inventory.removerItem(slot);
    this.game.state.emit('change');
    return true;
  }

  /**
   * Selo do slot da hotbar: barrinha de durabilidade (e balas no carregador)
   * do equipamento, ou a quantidade da pilha.
   * @returns {string} HTML ('' para itens que não são do pacote)
   */
  slotBadge(item) {
    if (item.uid) {
      const inst = this.store.get(item.uid);
      if (!inst) return '';
      const cls = this.store.isBroken(inst) ? ' broken' : this.store.isLow(inst) ? ' low' : '';
      const mag = inst.mag !== undefined ? `<span class="slot-count">${inst.mag}</span>` : '';
      return `${mag}<span class="slot-dur${cls}"><i style="width:${(this.store.fraction(inst) * 100).toFixed(0)}%"></i></span>`;
    }
    return item.ref ? `<span class="slot-count">${this.reserve.count(item.id)}</span>` : '';
  }

  pruneHotbar() {
    const inv = this.game.inventory;
    for (let i = 0; i < inv.slots.length; i++) {
      const s = inv.slots[i];
      if (s?.ref && this.reserve.count(s.id) <= 0) inv.removerItem(i);
    }
  }

  // ------------------------------------------------------------ clique com o item equipado

  /** Clique esquerdo com um item do pacote no slot ativo. */
  use(item) {
    const g = this.game, d = GEAR_CATALOG[item.id];
    if (g.player.flying || g.player.swimming) return;
    if (this.consumption.active) { // clicar de novo cancela (nada é gasto)
      const id = this.consumption.cancel();
      g.ui.showHit(`${GEAR_CATALOG[id].name}: consumo cancelado`, false);
      return;
    }
    const inst = item.uid ? this.store.get(item.uid) : null;
    if (d.equipment && !inst) return;
    if (inst && this.store.isBroken(inst)) { g.ui.showHit(`${d.name} quebrou: inutilizável`, false); return; }
    if (d.equipment === 'melee') this.startSwing(inst, d);
    else if (d.equipment === 'firearm') this.shoot(inst, d);
    else if (d.equipment === 'bow') this.startDraw(inst);
    else if (d.consumable) this.consume(item.id, true);
    else if (d.useDisabled) g.ui.showHit(`${d.name}: efeito ainda não definido (uso desabilitado)`, false);
    else g.ui.showHit(`${d.name}: sem ação — só inspeção`, false);
  }

  startSwing(inst, d) {
    const g = this.game;
    if (!this.swing.start(g.time, d.base)) return; // ainda no intervalo mínimo
    this.swingItem = { uid: inst.uid, def: d };
    g.player.faceDirection(g.cameraRig.forward(this._dir));
  }

  /** Janela de impacto do golpe: UM teste de acerto por golpe. */
  resolveImpact() {
    const g = this.game, it = this.swingItem;
    const inst = it && this.store.get(it.uid);
    if (!inst || this.store.isBroken(inst) || g.inventory.equipado.uid !== it.uid) return;
    const d = it.def, m = MELEE[d.base];
    const dir = g.cameraRig.forward(this._dir), origin = g.player.punchOrigin(this._origin);
    const p = g.player.position;
    g.combat.obstacles = g.areaId === 'overworld'
      ? Object.values(g.villages).filter((v) => Math.hypot(p.x - v.x, p.z - v.z) < v.radius + 30).map((v) => v.group)
      : [];
    const hit = g.combat.strike(origin, dir, { range: m.range, damage: hitDamage(d), rayHeights: g.combat.config.punch.rayHeights });
    if (hit?.target) {
      // alvo registrado (animal, morador, boneco): impacto válido
      this.wear(inst, d);
      g.cameraRig.kick(g.combat.config.punch.cameraKick);
      const dummy = g.dummies.find((x) => x.hitbox === hit.target.object);
      const animal = g.fauna?.animals.find((a) => a.root === hit.target.object);
      const extra = dummy ? ` · ${dummy.health}/${dummy.maxHealth}` : animal ? (animal.alive ? ` · ${Math.max(0, Math.round(animal.health))}/${animal.spec.health}` : ' · abatido') : '';
      g.ui.showHit(`${d.name}: ${hit.name} −${hit.damage}${extra}`, true);
      return;
    }
    if (d.gather && !hit && g.areaId === 'overworld' && this.extract(inst, d, m, dir)) return;
    g.ui.showHit(hit ? `${d.name}: bateu em ${hit.name}` : `${d.name}: golpe no ar`, false);
  }

  /** Machado na madeira, picareta na pedra: progresso × eficiência (não mexe no dano). */
  extract(inst, d, m, dir) {
    const g = this.game, p = g.player.position, cfg = EXTRACTION[d.gather];
    let best = null, bd = Infinity;
    for (const reach of [0.5, 1]) {
      for (const c of g.collisions.query(p.x + dir.x * m.range * reach, p.z + dir.z * m.range * reach)) {
        if (c.type !== 'circle' || c.enabled === false || !cfg.tags.includes(c.tag)) continue;
        const dx = c.x - p.x, dz = c.z - p.z, dist = Math.hypot(dx, dz);
        const edge = dist - c.r;
        if (edge > m.range + EXTRACTION.reachPad || (dx * dir.x + dz * dir.z) / (dist || 1) < 0.35) continue;
        if (edge < bd) { bd = edge; best = c; }
      }
    }
    if (!best) return false;
    this.wear(inst, d);
    const r = this.extraction.hit(best, d.gather, d.gatherEfficiency, g.time);
    g.cameraRig.kick(g.combat.config.punch.cameraKick * 0.8);
    this.extractMsg = { label: `${cfg.verb} ${cfg.label}`, progress: r.progress / r.work, until: g.time + 1.6 };
    if (r.done) {
      const parts = [];
      for (const [id, n] of Object.entries(r.yield)) { g.state.addItem(id, n); parts.push(`${ITEMS[id].name} ×${n}`); }
      g.ui.toast(`${parts.join(', ')} na mochila.`);
    }
    g.ui.showHit(`${d.name}: ${cfg.label} ${Math.min(r.work, r.progress).toLocaleString('pt-BR')}/${r.work}`, true);
    return true;
  }

  /** Gasta 1 de durabilidade e avisa quando quebra. */
  wear(inst, d) {
    const { broke } = this.store.wear(inst);
    if (broke) this.onBroke(d);
    this.game.inventory.emit(); // a hotbar mostra a barrinha
  }

  onBroke(d) {
    this.game.ui.toast(`${d.name} quebrou. Não dá mais para usar.`);
    this.game.inventory.emit();
  }

  shoot(inst, d) {
    const g = this.game;
    if (g.areaId !== 'overworld') { g.ui.showHit('Aqui embaixo o tiro ricocheteia: melhor não', false); return; }
    const r = this.firearm.fire(inst, g.time);
    if (!r.ok) {
      if (r.reason === 'empty') g.ui.showHit('Carregador vazio — R recarrega', false);
      else if (r.reason === 'reloading') g.ui.showHit('Recarregando…', false);
      return;
    }
    const f = FIREARMS[inst.id];
    this.launch(inst.id, inst.id, r.damage, f.speed, 'bullet');
    this.held.kick(1);
    g.cameraRig.kick(f.kick);
    if (r.broke) this.onBroke(d);
    g.inventory.emit();
  }

  startDraw(inst) {
    const g = this.game;
    if (g.areaId !== 'overworld') return;
    const r = this.bow.start(inst);
    if (!r.ok && r.reason === 'no-arrow') g.ui.showHit('Sem flechas na mochila', false);
  }

  /** Lança um projétil do pacote: dano fixo, sem multiplicador de zona, sem recuperar do chão. */
  launch(weapon, item, damage, speed, kind) {
    const g = this.game, dir = g.cameraRig.forward(this._dir), o = g.player.punchOrigin(this._origin);
    if (g.cameraRig.isFirstPerson) o.copy(g.camera.position);
    g.player.faceDirection(dir);
    const p = g.projectiles.launch({ weapon, item, x: o.x + dir.x * 0.6, y: o.y + (g.cameraRig.isFirstPerson ? -0.05 : 0.2), z: o.z + dir.z * 0.6, dx: dir.x, dy: dir.y, dz: dir.z, speed });
    p.gear = { damage, kind };
    return p;
  }

  /**
   * Um projétil do pacote cravou (acerto ou chão). Chamado por `Game.updateHunting`.
   * Aplica o dano FIXO do item (sem abate por cabeça) e tira o projétil do mundo
   * (flechas disparadas não são recuperadas nesta etapa).
   */
  onProjectileEvent(p, hit) {
    const g = this.game;
    g.projectiles.remove(p);
    if (!hit) return;
    const dmg = p.gear.damage, what = ITEMS[p.item]?.name ?? 'Tiro';
    if (hit.hunter) {
      hit.hunter.hurt(dmg);
      g.ui.showHit(`${what}: ${hit.hunter.name} −${dmg}${hit.hunter.alive ? '' : ' · morto'}`, true);
    } else if (hit.agent) {
      g.onAgentShot(hit, p); // lei do jogo: pernas derrubam, o resto mata (crime)
    } else if (hit.animal) {
      const a = hit.animal, len = Math.hypot(p.vel.x, p.vel.z) || 1;
      a.takeHit({ damage: dmg, direction: { x: p.vel.x / len, z: p.vel.z / len }, zone: null });
      const y = g.groundHeight(hit.point.x, hit.point.z, -Infinity);
      for (let i = 0; i < BLEED.bloodAtHit; i++) g.trails.add('blood', hit.point.x + (g.random() - 0.5) * 0.5, y, hit.point.z + (g.random() - 0.5) * 0.5, g.time);
      g.notebook.record('fauna', a.speciesId);
      g.ui.showHit(`${what}: ${a.spec.nome} −${dmg}${a.alive ? ` · ${Math.max(0, Math.round(a.health))}/${a.spec.health}` : ' · abatido'}`, true);
    }
  }

  /** Tecla R: recarrega a arma de fogo equipada. */
  reload() {
    const g = this.game, inst = this.equippedInstance();
    if (!inst || GEAR_CATALOG[inst.id].equipment !== 'firearm') return false;
    const r = this.firearm.startReload(inst);
    if (r.ok) return true;
    const ammo = ITEMS[FIREARMS[inst.id].ammo].name;
    g.ui.showHit({ full: 'Carregador cheio', 'no-reserve': `Sem ${ammo} na mochila`, broken: 'Arma quebrada', reloading: 'Já recarregando…' }[r.reason], false);
    return false;
  }

  /**
   * Come/bebe um item do pacote (botão da mochila ou clique com ele na mão).
   * O efeito e o gasto só vêm quando a barra termina.
   */
  consume(id, fromHand = false) {
    const g = this.game, d = GEAR_CATALOG[id];
    const r = this.consumption.start(id);
    if (r.ok) { this.consumeFromHand = fromHand; this.firearm.cancelReload(); this.bow.cancel(); return true; }
    const msg = {
      disabled: `${d?.name}: uso desabilitado`, none: `Sem ${d?.name} na mochila`, busy: 'Já está comendo ou bebendo',
      'hunger-full': 'Sem fome: não dá para comer agora', 'stamina-full': 'Estamina cheia: não precisa beber agora',
    }[r.reason];
    g.ui.showHit(msg ?? 'Não dá para consumir isso', false);
    return false;
  }

  // ------------------------------------------------------------ loop

  /**
   * Um quadro (depois do jogador e dos projéteis).
   * @param {number} dt
   * @param {boolean} busy painel/diálogo aberto, morto ou desmaiado
   */
  update(dt, busy) {
    const g = this.game, input = g.input, slot = g.inventory.equipado;
    const def = GEAR_CATALOG[slot.id] ?? null, inst = slot.uid ? this.store.get(slot.uid) : null;
    const key = slot.uid ?? (def ? slot.id : null);
    if (key !== this._lastKey) { // trocou de item: ações em andamento param sem gastar nada
      this._lastKey = key;
      this.swing.cancel(); this.swingItem = null;
      this.bow.cancel();
      this.firearm.cancelReload();
      if (this.consumeFromHand) this.consumption.cancel();
      this.held.set(def ? slot.id : null);
    }
    const firearm = def?.equipment === 'firearm', isBow = def?.equipment === 'bow';
    g.cameraRig.reloadKeyBusy = firearm; // R recarrega (e deixa de girar a câmera) só com arma de fogo na mão
    if (g.dead) { this.bow.cancel(); this.firearm.cancelReload(); this.consumption.cancel(); this.swing.cancel(); }
    if (!busy && dt > 0) {
      if (input.pressed('KeyR') && firearm) this.reload();
      if (input.pressed('KeyX') && isBow) {
        const a = this.bow.cycle();
        g.ui.showHit(a ? `Flecha: ${ITEMS[a].name}` : 'Sem flechas na mochila', !!a);
      }
    } else if (busy) this.bow.cancel(); // painel aberto: solta a corda sem gastar flecha

    // golpe: o dano sai uma vez, na janela de impacto
    if (this.swing.update(g.time)) this.resolveImpact();
    // recarga
    if (firearm) {
      const done = this.firearm.update(dt, inst);
      if (done) { g.ui.showHit(done.reloaded ? `Recarregado: ${inst.mag}/${def.magazine}` : 'Sem munição para recarregar', done.reloaded > 0); g.inventory.emit(); }
    }
    // arco
    if (isBow) {
      const shot = this.bow.update(dt, inst);
      if (shot) {
        this.launch('arco', shot.arrow, shot.damage, BOW.speed, 'arrow');
        this.held.kick(0.6);
        g.cameraRig.kick(0.03);
        if (shot.broke) this.onBroke(def);
        g.inventory.emit();
      }
    }
    // consumo
    const eaten = this.consumption.update(dt);
    if (eaten?.done) {
      const d = GEAR_CATALOG[eaten.id], parts = [];
      if (eaten.hunger > 0.05) parts.push(`fome +${Math.round(eaten.hunger)}`);
      if (eaten.stamina > 0.05) parts.push(`estamina +${Math.round(eaten.stamina)}`);
      if (eaten.effects.includes(COFFEE.id)) parts.push(`+25% de velocidade por ${COFFEE.seconds} s`);
      g.ui.toast(`${d.name}: ${parts.join(' · ') || 'consumido'}.`);
    }

    // ---- item na mão (pose por cima da animação do corpo)
    if (!g.inspection?.active) {
      const swinging = this.swingItem && this.swing.progress(g.time) < 1;
      const a = this._anim; // objeto reutilizado: nada é alocado por quadro
      a.swing = swinging ? this.swing.progress(g.time) : null;
      a.reload = firearm && inst && this.firearm.isReloading(inst) ? this.firearm.reloadProgress(inst) : null;
      a.draw = isBow && this.bow.drawing ? this.bow.progress : null;
      a.consume = this.consumption.active && def && this.consumption.active.id === slot.id ? this.consumption.progress : null;
      a.pitch = g.cameraRig.isFirstPerson ? g.cameraRig.firstPitch : 0;
      a.firstPerson = g.cameraRig.isFirstPerson;
      a.visible = !g.boat?.piloting;
      this.held.update(dt, a);
    }
    this.refreshHud(def, inst, firearm, isBow);

    this._saveIn -= dt;
    if (this._saveIn <= 0) { this._saveIn = SAVE.autosaveSeconds; this.extraction.prune(g.time); this.save(); }
  }

  refreshHud(def, inst, firearm, isBow) {
    const g = this.game, H = this._hud;
    H.ammo = null; H.reload = null; H.durability = null; H.action = null;
    if (firearm && inst) {
      const a = this._ammo, ammoId = FIREARMS[inst.id].ammo;
      a.mag = inst.mag; a.reserve = this.reserve.count(ammoId); a.name = ITEMS[ammoId].name; a.icon = 'bullet'; a.hint = null;
      H.ammo = a;
      if (this.firearm.isReloading(inst)) H.reload = this.firearm.reloadProgress(inst);
    } else if (isBow && inst) {
      const a = this._ammo, arrow = this.bow.arrow();
      let all = 0;
      for (const id of BOW.ammo) all += this.reserve.count(id);
      a.mag = arrow ? this.reserve.count(arrow) : 0; a.reserve = all;
      a.name = arrow ? ITEMS[arrow].name : 'sem flechas'; a.icon = 'arrow'; a.hint = arrow ? `${ITEMS[arrow].name} · X troca` : 'sem flechas';
      H.ammo = a;
    }
    if (inst) {
      const d = this._dur;
      d.cur = inst.durability; d.max = def.durabilityMax; d.broken = this.store.isBroken(inst); d.low = this.store.isLow(inst);
      H.durability = d;
    }
    const act = this._act;
    if (this.consumption.active) {
      const d = GEAR_CATALOG[this.consumption.active.id];
      act.label = `${d.drink ? 'Bebendo' : 'Comendo'}: ${d.name}`; act.progress = this.consumption.progress; H.action = act;
    } else if (isBow && this.bow.drawing) { act.label = 'Preparando o disparo'; act.progress = this.bow.progress; H.action = act; }
    else if (this.extractMsg && g.time < this.extractMsg.until) { act.label = this.extractMsg.label; act.progress = this.extractMsg.progress; H.action = act; }
    let coffee = null;
    for (const e of g.state.effects) if (e.id === COFFEE.id) coffee = e;
    if (coffee) { this._fx[0].seconds = Math.max(0, coffee.remaining); H.effects = this._fx; } else H.effects = this._none;
    this.hud.update(H);
  }

  // ------------------------------------------------------------ lojas

  /**
   * Abre a loja de um vendedor.
   * @param {{ key: string, name: string, kind: 'ferreiro'|'mercador', title?: string }} v `key` identifica o estoque
   */
  openShop(v) {
    const g = this.game, smith = v.kind === 'ferreiro';
    const sections = smith ? SHOP_ARSENAL : SHOP_PROVISIONS;
    const legacy = smith ? SHOP_SMITH : [...SHOP_FOOD, ...SHOP_MATERIALS].filter((e) => !GEAR_CATALOG[e.id]);
    g.ui.dialogue.open({
      speaker: v.name, title: v.title ?? (smith ? 'Forja' : 'Banca'),
      text: smith
        ? '"Lâmina, ferramenta, arco, arma de fogo: tudo sai daqui. Ninguém mais vende."'
        : '"Comida, água, café e uns recursos. Escolha a prateleira."',
      options: [
        ...sections.map((s) => ({ label: `${s.title}…`, onSelect: () => this.openSection(v, s) })),
        { label: smith ? 'Lanças, facas e lâminas…' : 'Mantimentos e materiais de sobrevivência…', onSelect: () => Mechanics.shopList(g, v.name, smith ? 'Forja' : 'Banca', legacy) },
        { label: 'Sair' },
      ],
    });
  }

  /** Estado de compra de um item numa seção (para o rótulo e para o botão). */
  quoteFor(v, section, id) {
    const g = this.game, d = GEAR_CATALOG[id];
    const left = this.shops.left(v.key, section, id, g.gameClock.totalHours);
    const room = hasRoom(id, purchaseAmount(d), g.state.inventory, this.bagEquipment().length, { catalog: ITEMS });
    return { left, ...quote({ id, coins: g.state.coins, left, room }) };
  }

  openSection(v, section) {
    const g = this.game;
    const cap = this.capacity();
    g.ui.dialogue.open({
      speaker: v.name, title: section.title,
      text: `Você tem <b>${g.state.coins}</b> moedas · mochila ${cap.used}/${cap.total} espaços.`,
      options: [
        ...section.ids.map((id) => {
          const d = GEAR_CATALOG[id], q = this.quoteFor(v, section, id);
          const pack = d.pack ? ` (pacote de ${d.pack})` : '';
          return {
            label: `${d.name}${pack} — ${d.price} moedas · estoque ${q.left}${q.ok ? '' : ` · ${REASONS[q.reason]}`}`,
            disabled: !q.ok,
            onSelect: () => { this.purchase(v, section, id); this.openSection(v, section); },
          };
        }),
        { label: 'Voltar', onSelect: () => this.openShop(v) },
      ],
    });
  }

  /** Compra (valida saldo, estoque e espaço antes de cobrar). */
  purchase(v, section, id) {
    const g = this.game, d = GEAR_CATALOG[id];
    const r = buy({
      id, vendor: v.key, section, hours: g.gameClock.totalHours, wallet: g.state,
      store: this.store, stock: this.shops, equipmentInBag: this.bagEquipment().length,
    });
    if (!r.ok) { g.ui.toast(`${d.name}: ${REASONS[r.reason] ?? 'não foi possível comprar'}.`); return r; }
    if (r.instance) {
      g.state.emit('change');
      if (g.inventory.slots.includes(null)) this.equip(r.instance.uid);
      else g.ui.toast(`${d.name} na mochila (hotbar cheia).`);
      if (d.equipment === 'firearm') g.ui.toast(`${d.name} vem descarregada: compre ${ITEMS[d.ammo].name} e aperte R.`);
    } else g.ui.toast(`${d.name}${r.amount > 1 ? ` ×${r.amount}` : ''} na mochila.`);
    this.save();
    return r;
  }

  // ------------------------------------------------------------ save

  /** Grava moedas, mochila, hotbar, equipamentos, efeitos temporários e estoques. */
  save() {
    if (!this.storage) return false;
    const g = this.game;
    const data = snapshot({
      coins: g.state.coins, inventory: g.state.inventory, hotbar: g.inventory.slots, selected: g.inventory.selected,
      equipment: this.store.serialize(),
      effects: g.state.effects.filter((e) => e.remaining !== null),
      shops: this.shops.serialize(), arrow: this.bow.choice,
    });
    try { this.storage.setItem(SAVE.key, JSON.stringify(data)); return true; } catch { return false; }
  }

  /** Carrega o save, SUBSTITUINDO mochila, hotbar e equipamentos (não soma ao kit inicial). */
  load() {
    if (!this.storage) return false;
    let raw = null;
    try { raw = JSON.parse(this.storage.getItem(SAVE.key) ?? 'null'); } catch { raw = null; }
    const g = this.game;
    const s = sanitize(raw, {
      isItem: (id) => !!ITEMS[id], isEffect: (id) => !!STATUS_EFFECTS[id] && STATUS_EFFECTS[id].duration !== null,
      isEquipment: (id) => !!GEAR_CATALOG[id]?.equipment, slots: g.inventory.slots.length,
    });
    if (!s) return false;
    this.store.load(s.equipment);
    g.state.coins = s.coins;
    g.state.inventory.clear();
    for (const [id, n] of s.inventory) g.state.inventory.set(id, n);
    for (let i = 0; i < g.inventory.slots.length; i++) {
      const slot = s.hotbar[i];
      g.inventory.slots[i] = slot && (!slot.uid || this.store.get(slot.uid)) ? slot : null;
    }
    g.inventory.selected = s.selected;
    for (const e of s.effects) {
      g.state.addEffect(e.id);
      const live = g.state.effects.find((x) => x.id === e.id);
      if (live) live.remaining = Math.min(e.remaining, STATUS_EFFECTS[e.id].duration); // duração RESTANTE, nunca maior que a original
    }
    this.shops.load(s.shops);
    this.bow.choice = s.arrow;
    g.inventory.emit();
    g.state.emit('change');
    return true;
  }

  /** Apaga o save (o próximo carregamento começa do kit inicial). Também: abrir o jogo com `?novo`. */
  resetSave() {
    try { this.storage?.removeItem(SAVE.key); } catch { /* sem armazenamento */ }
  }
}
