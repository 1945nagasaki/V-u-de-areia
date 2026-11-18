import * as THREE from 'three';
import { WORLD } from '../config/worldConfig.js';
import { GAMEPLAY } from '../config/gameplay.js';
import { PROLOGUE, RESOURCES, STARTER, PROGRESSION } from '../config/survival.js';
import { Survival } from './Survival.js';
import { Bag } from './Bag.js';
import { Progression, xpSourceForSpecies } from './Progression.js';
import { Tutorial } from './Tutorial.js';
import { Landfall, canMakeLandfall, findShoreX } from './Landfall.js';
import { SaveGame } from './SaveGame.js';
import { AudioScape } from './AudioScape.js';
import { Weather } from '../world/Weather.js';
import { Campfire, makePickupMesh } from '../entities/Campfire.js';
import { SurvivalUI } from '../ui/SurvivalUI.js';

const DESERT = 2; // índice do bioma 'deserto' em BIOMES

/**
 * Missão: Véu de Areia — orquestra o prólogo no mar (tempestade + cronômetro
 * de 10 min), a chegada exclusiva pela Costa do Deserto, o fim da tempestade,
 * o checkpoint, o tutorial de 9 passos, e os sistemas de sobrevivência
 * (Fome, Estamina, Mochila/Craft, Fogueira) e de progressão (XP + Skills).
 *
 * Integração em Game: `new SurvivalDirector(game)` depois do mundo pronto;
 * `director.update(dt)` no loop; `director.busy` entra no "busy" do jogo.
 */
export class SurvivalDirector {
  constructor(game) {
    this.game = game;
    this.state = game.state;
    this.survival = new Survival();
    this.bag = new Bag();
    this.progression = new Progression();
    this.tutorial = new Tutorial();
    this.landfall = new Landfall();
    this.save = new SaveGame(safeStorage());
    this.audio = new AudioScape();
    this.weather = new Weather(game.scene);
    this.ui = new SurvivalUI(this, game.ui.root);
    this.baseStats = { maxHealth: GAMEPLAY.player.maxHealth, maxStamina: this.survival.cfg.baseStamina };
    this.campfires = [];
    this.pickups = [];
    this.zoom = { held: false, latched: false, downAt: 0 };
    this._barrierToast = 0;
    this._prev = new THREE.Vector3();
    this._w = new Float32Array(16);
    this.weaponMultiplier = 1;

    // Áudio só depois de um gesto do jogador.
    const unlock = () => this.audio.unlock();
    window.addEventListener('keydown', unlock);
    window.addEventListener('mousedown', unlock);

    this.progression.onChange((e) => {
      this.applyStats();
      if (e.type === 'xp') {
        game.ui.toast(`+${e.amount} XP${e.levelUp ? ` · Nível ${this.progression.level}!` : ''}`);
      }
      if (e.type === 'upgrade') {
        game.ui.toast(`${PROGRESSION.skills[e.skill].nome} evoluiu para o tier ${e.tier}`);
        this.tutorial.notify('skill');
      }
    });
    this.bag.onChange(() => { if (!this.ui.inv.classList.contains('hidden')) this.ui.renderInventory(); });
    this.tutorial.onChange((e) => this.onTutorial(e));
    this.state.on('change', () => this.ui.refreshHud());

    this.findLanding();
    this.spawnPickups();
  }

  get busy() {
    return this.ui.modalOpen;
  }

  // ---------- prólogo e chegada ----------
  /** Acha a praia de chegada na costa leste (deserto) e o ponto no mar. */
  findLanding() {
    const t = this.game.terrain;
    const z = PROLOGUE.landingZ;
    const W2 = WORLD.width / 2;
    const shoreX = findShoreX((x, zz) => t.heightAt(x, zz), z, { fromX: W2 - 6, toX: W2 - 900 });
    this.landing = { x: shoreX - 6, z }; // ponto na areia seca
    this.seaSpawn = { x: Math.min(W2 - 20, shoreX + PROLOGUE.spawnOffshore), z };
  }

  /** Começa o jogo: carrega o checkpoint, ou acorda no mar na tempestade. */
  begin() {
    const g = this.game;
    const d = this.save.read();
    if (d?.prologueDone) {
      this.progression.load(d.progression);
      this.applyStats();
      this.survival.load(d.survival);
      this.bag.load(d.bag);
      this.state.health = Math.min(this.state.maxHealth, d.health ?? this.state.maxHealth);
      this.landfall.skip();
      g.player.teleport(d.pos.x, d.pos.z, d.facing ?? 0);
      g.cameraRig.yaw = d.facing ?? 0;
      g.cameraRig.snap();
      for (const c of d.campfires ?? []) this.addCampfire(c.x, c.z, c.lit);
      for (const id of d.collected ?? []) this.pickups.find((p) => p.id === id)?.take(true);
      this.tutorial.start(d.tutorialIndex ?? 0);
      g.ui.toast('Checkpoint carregado. (Ctrl+Shift+N recomeça do mar)');
    } else {
      for (const [id, n] of Object.entries(STARTER.bag)) this.bag.add(id, n);
      this.applyStats();
      this.spawnAtSea();
      g.ui.toast('Você acorda no mar, em plena tempestade. Nade até a costa do deserto antes que as forças acabem.');
    }
    this.ui.refreshHud();
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyN' && e.ctrlKey && e.shiftKey) { e.preventDefault(); this.save.clear(); location.reload(); }
    });
  }

  spawnAtSea() {
    const g = this.game;
    g.player.teleport(this.seaSpawn.x, this.seaSpawn.z, -Math.PI / 2, WORLD.waterLevel - GAMEPLAY.swimming.surfaceDepth);
    g.cameraRig.yaw = -Math.PI / 2; // olhando para oeste (a costa)
    g.cameraRig.snap();
  }

  /** Distância até a borda do mapa (faixa oceânica). */
  edgeDistance(x, z) {
    return Math.min(WORLD.width / 2 - Math.abs(x), WORLD.depth / 2 - Math.abs(z));
  }

  /** Chamado ANTES de player.update: lembra a posição. */
  beforePlayer() {
    this._prev.copy(this.game.player.position);
    this._wasSwimming = this.game.player.swimming;
  }

  /**
   * Depois de player.update: correnteza no prólogo e barreira de penhascos /
   * correntes fortes — do oceano só se pisa em terra na Costa do Deserto.
   */
  afterPlayer(dt) {
    const g = this.game, p = g.player;
    if (g.areaId !== 'overworld' || p.flying) return;
    if (this.landfall.phase === 'ocean' && p.swimming) {
      const dx = this.landing.x - p.position.x, dz = this.landing.z - p.position.z;
      const d = Math.hypot(dx, dz) || 1;
      p.position.x += (dx / d) * PROLOGUE.currentSpeed * dt;
      p.position.z += (dz / d) * PROLOGUE.currentSpeed * dt;
    }
    if (this._wasSwimming && !p.swimming) {
      const w = g.terrain.weightsAt(p.position.x, p.position.z, this._w);
      const ok = canMakeLandfall({ edgeDistance: this.edgeDistance(this._prev.x, this._prev.z), desertWeight: w[DESERT] });
      if (!ok) {
        p.position.copy(this._prev);
        p.swimming = true;
        if (g.time > this._barrierToast) {
          this._barrierToast = g.time + PROLOGUE.barrierToastCooldown;
          g.ui.toast('Penhascos íngremes e correntes fortes: impossível subir aqui. Só a Costa do Deserto é acessível pelo mar.');
        }
      }
    }
  }

  // ---------- loop ----------
  update(dt, input, busy) {
    const g = this.game, p = g.player;
    const ev = this.landfall.update(dt, { onLand: !p.swimming && p.grounded && g.areaId === 'overworld' && !p.flying });
    if (ev === 'landed') this.onLanded();
    if (ev === 'cleared') this.onCleared();
    if (ev === 'drowned') g.killPlayer('A tempestade venceu: você se afogou');

    const storm = this.landfall.storm;
    const bleach = this.landfall.phase === 'ocean' ? 0 : 1;
    const { thunder } = this.weather.update(dt, g.camera, g.areaId === 'overworld' ? storm : 0, bleach, g.random);
    if (thunder) this.audio.thunder();
    this.weather.applyTo(g.environment);
    if (storm > 0) {
      const u = g.water.uniforms;
      u.uSkyTop.value.lerp(this.weather.storm.skyTop, storm);
      u.uSkyHorizon.value.lerp(this.weather.storm.skyHorizon, storm);
      u.uSunColor.value.multiplyScalar(1 - 0.85 * storm);
    }
    this.audio.setStorm(g.areaId === 'overworld' ? storm : 0);
    this.audio.update(g.camera);
    this.ui.setClock(this.landfall.timeLeft, this.landfall.phase === 'ocean' && !g.dead);

    // Zoom (C): segurar = zoom enquanto segura; toque curto = trava/destrava.
    const z = this.zoom;
    if (!busy && input.pressed('KeyC')) {
      z.downAt = g.time;
      z.held = true;
      if (z.latched) { z.latched = false; z.held = false; z.cancel = true; } else z.cancel = false;
      this.tutorial.notify('zoom');
    }
    if (z.held && !input.isDown('KeyC')) {
      z.held = false;
      if (!z.cancel && g.time - z.downAt < 0.25) z.latched = true;
    }

    // Teclas dos menus.
    if (input.pressed('KeyI') || input.pressed('Tab')) this.toggleInventory();
    if (input.pressed('KeyK')) this.toggleSkills();
    if (input.pressed('Escape') && this.busy) { this.ui.toggleInventory(false); this.ui.toggleSkills(false); }

    // Sobrevivência (pausa no prólogo, em menus e morto).
    const active = this.landfall.phase !== 'ocean' && !g.dead && !this.busy && !g.ui.dialogue.isOpen;
    const sprinting = !busy && p.sprinting;
    const { starve } = this.survival.update(dt, { sprinting, active });
    if (starve && !g.dead) {
      this.state.damage(starve);
      if (this.state.health <= 0) g.killPlayer('Você morreu de fome');
    }

    // Tutorial: andar e correr.
    if (!busy && this.tutorial.active && p.grounded) {
      const moved = Math.hypot(p.position.x - this._prev.x, p.position.z - this._prev.z);
      if (moved > 0 && moved < 2) this.tutorial.notify('walk', moved);
      if (p.sprinting) this.tutorial.notify('sprint', dt);
    }

    for (const c of this.campfires) c.update(dt);
    this._hudT = (this._hudT ?? 0) - dt;
    if (this._hudT <= 0) { this._hudT = 0.1; this.ui.refreshHud(); }
  }

  /** O zoom está ativo (segurando ou travado)? */
  get zooming() {
    return this.zoom.held || this.zoom.latched;
  }

  onLanded() {
    const g = this.game;
    g.oxygen.reset();
    g.ui.toast('Terra firme. A Costa do Deserto.');
    this.checkpoint();
  }

  onCleared() {
    this.game.ui.toast('A tempestade passou. O sol castiga a areia.');
    if (!this.tutorial.active && !this.tutorial.done) this.tutorial.start(0);
  }

  onTutorial(e) {
    const total = this.tutorial.steps.length;
    if (e.type === 'step') {
      this.ui.showTutorialStep(e.step, e.index, total);
      if (e.step.grantXp) this.progression.addXp('tutorial');
    } else if (e.type === 'progress') this.ui.setTutorialProgress(e.fraction);
    else if (e.type === 'complete') this.checkpoint(true);
    else if (e.type === 'done') {
      this.ui.tutorialDone();
      this.completeMission('Tutorial de Sobrevivência');
    }
  }

  /** Salva o checkpoint e mostra "Progresso Salvo". */
  checkpoint(silent = false) {
    const g = this.game, p = g.player;
    if (this.landfall.phase === 'ocean') return false;
    const ok = this.save.write({
      prologueDone: true,
      pos: { x: p.position.x, y: p.position.y, z: p.position.z },
      facing: p.root.rotation.y,
      health: this.state.health,
      survival: this.survival.toJSON(),
      bag: this.bag.toJSON(),
      progression: this.progression.toJSON(),
      tutorialIndex: this.tutorial.done ? this.tutorial.steps.length : Math.max(0, this.tutorial.index),
      campfires: this.campfires.map((c) => ({ x: c.position.x, z: c.position.z, lit: c.lit })),
      collected: this.pickups.filter((pk) => pk.taken).map((pk) => pk.id),
    });
    if (ok && !silent) this.ui.showSaved();
    return ok;
  }

  // ---------- XP ----------
  /** Animal abatido: XP (presa ou criatura hostil) e carne crua. */
  onAnimalKilled(animal) {
    const src = xpSourceForSpecies(animal.spec);
    this.progression.addXp(src);
    this.bag.add('carne_crua', 1);
    this.game.ui.toast(`${animal.spec.nome} abatido · +1 Carne Crua`);
  }

  /** Missão completa: XP de missão. Também disponível como `game.completarMissao(nome)`. */
  completeMission(name) {
    this.game.ui.toast(`Missão completa: ${name}`);
    this.progression.addXp('mission');
    this.checkpoint();
  }

  /** Aplica os bônus da Árvore de Skills na hora. */
  applyStats() {
    const s = this.progression.stats(this.baseStats);
    const st = this.state;
    const gain = s.maxHealth - st.maxHealth;
    st.maxHealth = s.maxHealth;
    if (gain > 0) st.health += gain; else st.health = Math.min(st.health, st.maxHealth);
    st.emit('change');
    this.survival.setMaxStamina(s.maxStamina);
    this.speedMultiplier = s.speedMultiplier;
    this.game.combat.damageMultiplier = s.meleeMultiplier * this.weaponMultiplier;
  }

  // ---------- menus ----------
  toggleInventory(force) {
    const open = this.ui.toggleInventory(force);
    if (open) { this.game.input.unlock(); this.tutorial.notify('inventory'); }
  }

  toggleSkills(force) {
    const open = this.ui.toggleSkills(force);
    if (open) this.game.input.unlock();
  }

  upgradeSkill(id) {
    if (!this.progression.upgrade(id)) this.game.ui.toast('XP insuficiente.');
  }

  eat(id) {
    const r = RESOURCES[id];
    if (!r?.food || !this.bag.remove(id)) return;
    this.survival.eat(r.food);
    if (r.heal) this.state.heal(r.heal);
    this.game.ui.toast(`Você comeu ${r.nome}: +${r.food} Fome${r.heal ? ` · +${r.heal} Vida` : ''}`);
    this.tutorial.notify('food');
    this.ui.refreshHud();
  }

  craft(id) {
    if (!this.bag.craft(id)) return;
    this.game.ui.toast(`Criado: ${RESOURCES[this.bag.recipe(id).out].nome}`);
    this.tutorial.notify('craft');
  }

  /** Arma criada vai para a hotbar (clique ataca com bônus de dano). */
  equipWeapon(id) {
    const r = RESOURCES[id];
    if (!r?.weapon || !this.bag.remove(id)) return;
    const slot = this.game.inventory.adicionarItem({ id, nome: r.nome, icone: r.icone, tipo: 'arma', damageMultiplier: r.weapon.damageMultiplier });
    if (slot < 0) { this.bag.add(id); this.game.ui.toast('Hotbar cheia.'); return; }
    this.game.inventory.selecionar(slot);
    this.game.ui.toast(`${r.nome} equipada (slot ${slot + 1}).`);
  }

  /** Multiplicador de dano do item equipado (arma) — chamado ao trocar de slot. */
  setWeapon(item) {
    this.weaponMultiplier = item?.damageMultiplier ?? 1;
    this.applyStats();
  }

  /** Coloca a fogueira da mochila na areia, 2 m à frente. */
  placeCampfire() {
    const g = this.game, p = g.player;
    if (p.swimming || g.areaId !== 'overworld') { g.ui.toast('Precisa de chão firme para a fogueira.'); return; }
    if (!this.bag.remove('fogueira')) return;
    const x = p.position.x + p.facing.x * 2, z = p.position.z + p.facing.z * 2;
    this.addCampfire(x, z, false);
    this.ui.toggleInventory(false);
    g.ui.toast('Fogueira posicionada. Aproxime-se e pressione [E] para acender.');
  }

  addCampfire(x, z, lit) {
    const g = this.game;
    const fire = new Campfire({ x, y: g.groundHeight(x, z), z });
    g.scene.add(fire.root);
    g.collisions.addCircle?.(x, z, 0.5);
    this.campfires.push(fire);
    if (lit) this.lightFire(fire, true);
    g.interactions.register({
      id: `fogueira-${this.campfires.length}`,
      label: 'Acender a Fogueira',
      position: fire.position,
      radius: 2.6,
      onInteract: () => {
        if (!fire.lit) { this.lightFire(fire); entry.label = 'Cozinhar Carne Crua'; return; }
        if (!this.bag.remove('carne_crua')) { g.ui.toast('Sem carne crua para cozinhar. Cace animais para conseguir carne.'); return; }
        this.bag.add('carne_assada');
        g.ui.toast('Carne assada! (+40 Fome ao comer)');
      },
    });
    const entry = g.interactions.items.at(-1); // cópia guardada pelo sistema
    if (lit) entry.label = 'Cozinhar Carne Crua';
    return fire;
  }

  lightFire(fire, silent = false) {
    fire.ignite();
    this.audio.unlock();
    this.audio.addFire(fire.position.x, fire.position.y + 0.5, fire.position.z);
    if (silent) return;
    this.game.ui.toast('A fogueira crepita. Use [E] para cozinhar carne crua.');
    this.tutorial.notify('campfire');
    this.checkpoint();
  }

  // ---------- recursos na praia ----------
  spawnPickups() {
    const g = this.game;
    STARTER.pickups.forEach(([id, n, dx, dz], i) => {
      const x = this.landing.x + dx, z = this.landing.z + dz;
      const mesh = makePickupMesh(id);
      mesh.position.set(x, g.terrain.heightAt(x, z), z);
      mesh.rotation.y = i * 1.7;
      g.scene.add(mesh);
      const pk = {
        id: `praia-${i}`, taken: false,
        take: (silent) => {
          if (pk.taken) return;
          pk.taken = true;
          mesh.visible = false;
          item.enabled = false;
          if (silent) return;
          this.bag.add(id, n);
          g.ui.toast(`+${n} ${RESOURCES[id].nome}`);
        },
      };
      g.interactions.register({
        id: pk.id, label: `Recolher ${RESOURCES[id].nome}`, position: mesh.position, radius: 2.2,
        onInteract: () => pk.take(false),
      });
      const item = g.interactions.items.at(-1);
      this.pickups.push(pk);
    });
  }

  /** Renascer: no mar (prólogo) ou na praia do checkpoint. */
  respawnPoint() {
    if (this.landfall.phase === 'ocean') return { sea: true };
    const d = this.save.read();
    return d?.pos ? { x: d.pos.x, z: d.pos.z } : { x: this.landing.x, z: this.landing.z };
  }
}

function safeStorage() {
  try { return window.localStorage; } catch { return null; }
}
