import { PROGRESSION, TUTORIAL_KIT, ZOOM, CAMPFIRE } from '../config/progression.js';
import { ITEMS } from './PlayerState.js';
import { Progression, xpSourceForSpecies } from './Progression.js';
import { Tutorial } from './Tutorial.js';
import { Campfire } from '../entities/Campfire.js';
import { ProgressionUI } from '../ui/ProgressionUI.js';

/**
 * Liga XP + Árvore de Skills, o tutorial de 9 passos, o zoom (Z) e a fogueira
 * posicionável ao jogo. Os sistemas puros (Progression, Tutorial) não conhecem o
 * Game; aqui ficam os ganchos:
 *  - XP: animal abatido (Fauna → `game.onAnimalKilled`), guerreiro derrotado
 *    (combate corpo a corpo), chegada à ilha, missões (`completeMission`);
 *  - bônus das skills: vida máxima (PlayerState), fôlego (Survival.staminaBonus),
 *    velocidade (PlayerState.setSkillModifiers) e dano (soco e golpes do combate);
 *  - tutorial: começa ao chegar à ilha no prólogo; os passos ouvem andar, correr,
 *    zoom, golpe, mochila, craft, comer, fogueira e skills.
 * O progresso (XP, tiers, passo do tutorial, fogueiras) fica salvo em localStorage.
 *
 * @example
 *   game.progress = new ProgressionDirector(game);
 *   game.progress.update(dt, input, busy); // no loop
 */
export class ProgressionDirector {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game = game;
    this.progression = new Progression();
    this.tutorial = new Tutorial();
    this.ui = new ProgressionUI(this, game.ui.root);
    this.baseMaxHealth = game.state.maxHealth;
    this.campfires = [];
    this.zoom = { held: false, latched: false, cancel: false, downAt: 0 };
    this._prev = { x: game.player.position.x, z: game.player.position.z };
    this._backpackWasOpen = false;
    this.storage = safeStorage();

    this.progression.onChange((e) => {
      this.applyStats();
      if (e.type === 'xp') game.ui.toast(`+${e.amount} XP${e.levelUp ? ` · Nível ${this.progression.level}!` : ''}`);
      if (e.type === 'upgrade') {
        game.ui.toast(`${PROGRESSION.skills[e.skill].nome} evoluiu para o tier ${e.tier}`);
        this.tutorial.notify('skill');
      }
      if (e.type !== 'load') this.save();
      this.ui.refresh();
    });
    this.tutorial.onChange((e) => this.onTutorial(e));
    this.hookGame();
    this.load();
    this.ui.refresh();
  }

  // ------------------------------------------------------------ ganchos
  /** Envolve ações do jogo para o tutorial e o XP ouvirem (sem mudar o que elas fazem). */
  hookGame() {
    const g = this.game;
    g.onAnimalKilled = (animal) => this.progression.addXp(xpSourceForSpecies(animal.spec));
    g.melee?.world.on('death', (e) => { if (e.team === 'enemy') this.progression.addXp('creature'); });
    const wrap = (obj, name, after) => {
      const orig = obj?.[name];
      if (typeof orig !== 'function') return;
      obj[name] = (...args) => { const r = orig.apply(obj, args); after(r, ...args); return r; };
    };
    wrap(g, 'tryAttack', () => { if (g.inventory.maosLivres && !g.player.swimming) this.tutorial.notify('punch'); });
    wrap(g, 'craftFromTable', (r) => { if (r?.ok) this.tutorial.notify('craft'); });
    wrap(g.survival, 'consume', () => this.tutorial.notify('food'));
    wrap(g.gear, 'consume', () => this.tutorial.notify('food'));
  }

  // ------------------------------------------------------------ loop
  /** Painel próprio aberto (Árvore de Skills)? Entra no "busy" do jogo. */
  get panelOpen() {
    return this.ui.skillsOpen;
  }

  /** Zoom ativo (segurando Z ou travado). */
  get zooming() {
    return this.zoom.held || this.zoom.latched;
  }

  /**
   * @param {number} dt
   * @param {import('../core/Input.js').Input} input
   * @param {boolean} busy menus/diálogos abertos
   */
  update(dt, input, busy) {
    const g = this.game, p = g.player;
    if (g.backpack.open && this.ui.skillsOpen) this.toggleSkills(false);
    if (g.backpack.open && !this._backpackWasOpen) this.tutorial.notify('inventory');
    this._backpackWasOpen = g.backpack.open;

    // Zoom (Z): segurar = zoom enquanto segura; toque curto trava/destrava.
    const z = this.zoom;
    if (busy || g.dead) { z.held = false; z.latched = false; }
    else {
      if (input.pressed(ZOOM.key)) {
        z.downAt = performance.now() / 1000; z.held = true; // tempo real: o toque não depende do FPS
        if (z.latched) { z.latched = false; z.held = false; z.cancel = true; } else z.cancel = false;
        this.tutorial.notify('zoom');
      }
      if (z.held && !input.isDown(ZOOM.key)) {
        z.held = false;
        if (!z.cancel && performance.now() / 1000 - z.downAt < ZOOM.tapSeconds) z.latched = true;
      }
    }

    // Tutorial: andar e correr (em terra, sem menus).
    const moved = Math.hypot(p.position.x - this._prev.x, p.position.z - this._prev.z);
    if (this.tutorial.active && !busy && dt > 0 && p.grounded && !p.swimming && !p.flying) {
      if (moved > 0 && moved < 2) this.tutorial.notify('walk', moved);
      if (p.sprinting) this.tutorial.notify('sprint', dt);
    }
    this._prev.x = p.position.x; this._prev.z = p.position.z;

    for (const c of this.campfires) c.fire.update(dt);
  }

  // ------------------------------------------------------------ skills
  /** Bônus atuais (vida máxima, fôlego extra, velocidade, dano). */
  stats() {
    const s = this.progression.stats({ maxHealth: this.baseMaxHealth, maxStamina: 0 });
    return { ...s, staminaBonus: s.maxStamina };
  }

  /** Aplica os bônus da Árvore de Skills na hora. */
  applyStats() {
    const g = this.game, st = g.state, s = this.stats();
    const gain = s.maxHealth - st.maxHealth;
    st.maxHealth = s.maxHealth;
    if (gain > 0) st.health += gain; else st.health = Math.min(st.health, st.maxHealth);
    st.emit('change');
    g.survival.staminaBonus = s.staminaBonus;
    st.setSkillModifiers?.({ speed: s.speedMultiplier });
    g.combat.damageMultiplier = s.meleeMultiplier;
    g.melee?.setPlayerDamageScale?.(s.meleeMultiplier);
    if (g.melee?.player) g.melee.player.maxHealth = s.maxHealth;
  }

  toggleSkills(force) {
    const open = this.ui.toggleSkills(force);
    if (open) this.game.input.unlock();
    return open;
  }

  upgradeSkill(id) {
    if (!this.progression.upgrade(id)) this.game.ui.toast('XP insuficiente.');
  }

  /** Missão completa: XP de missão. */
  completeMission(name) {
    this.game.ui.toast(`Missão completa: ${name}`);
    this.progression.addXp('mission');
  }

  // ------------------------------------------------------------ tutorial
  /** Chegada à ilha (prólogo): XP e começo do tutorial, com o kit do náufrago. */
  onLanded() {
    this.progression.addXp('landing');
    if (!this.tutorial.active && !this.tutorial.done) this.startTutorial();
  }

  startTutorial(at = 0) {
    const st = this.game.state;
    if (at === 0) for (const [id, n] of Object.entries(TUTORIAL_KIT)) {
      const have = st.inventory.get(id) ?? 0;
      if (ITEMS[id] && have < n) st.addItem(id, n - have);
    }
    this.tutorial.start(at);
  }

  onTutorial(e) {
    const total = this.tutorial.steps.length;
    if (e.type === 'step') {
      this.ui.showTutorialStep(e.step, e.index, total);
      if (e.step.grantXp) this.progression.addXp('tutorial');
      this.save();
    } else if (e.type === 'progress') this.ui.setTutorialProgress(e.fraction);
    else if (e.type === 'done') {
      this.ui.tutorialDone();
      this.completeMission('Tutorial de Sobrevivência');
      this.game.missions?.onTutorialDone(); // próxima missão: Buscar Comida
      this.save();
    }
  }

  // ------------------------------------------------------------ fogueira
  /** Tira a fogueira da mochila e põe no chão, à frente do jogador. */
  placeCampfire(id = 'fogueira') {
    const g = this.game, p = g.player;
    if (p.swimming || p.flying || g.areaId !== 'overworld') { g.ui.toast('Precisa de chão firme para a fogueira.'); return false; }
    if (!g.state.removeItem(id)) return false;
    const x = p.position.x + p.facing.x * CAMPFIRE.placeDistance, z = p.position.z + p.facing.z * CAMPFIRE.placeDistance;
    this.addCampfire(x, z, false);
    g.backpack.hide?.();
    g.ui.toast('Fogueira posicionada. Chegue perto e aperte E para acender.');
    this.save();
    return true;
  }

  addCampfire(x, z, lit) {
    const g = this.game;
    const fire = new Campfire({ x, y: g.groundHeight(x, z), z });
    g.scene.add(fire.root);
    const col = g.collisions.addCircle?.(x, z, 0.5);
    const c = { fire, x, z, lit: false, light: null, prompt: null, col };
    c.prompt = g.interactions.register({
      id: `fogueira-${this.campfires.length}`,
      label: 'Acender a fogueira',
      position: fire.position,
      radius: CAMPFIRE.interactRadius,
      onInteract: () => this.lightCampfire(c),
    });
    this.campfires.push(c);
    if (lit) this.lightCampfire(c, true);
    return c;
  }

  /** Acende: chamas, luz do pool do jogo e calor (a fogueira passa a cozinhar como as das vilas). */
  lightCampfire(c, silent = false) {
    if (c.lit) return;
    const g = this.game, L = CAMPFIRE.light;
    c.lit = true;
    c.fire.ignite();
    c.light = g.fireLights.add({ x: c.x, y: c.fire.position.y + L.y, z: c.z, color: L.color, intensity: L.intensity, range: L.range, warm: true });
    c.prompt.enabled = false; // daqui em diante o E perto do fogo usa a fogueira (assar, ferver, cinza)
    if (silent) return;
    g.ui.toast('A fogueira crepita. Aperte E perto dela para assar e ferver.');
    this.tutorial.notify('campfire');
    this.save();
  }

  // ------------------------------------------------------------ salvar
  save() {
    if (!this.storage) return false;
    try {
      this.storage.setItem(PROGRESSION.saveKey, JSON.stringify({
        progression: this.progression.toJSON(),
        tutorial: this.tutorial.done ? this.tutorial.steps.length : this.tutorial.index,
        campfires: this.campfires.map((c) => ({ x: c.x, z: c.z, lit: c.lit })),
      }));
      return true;
    } catch { return false; }
  }

  load() {
    let d = null;
    try { d = JSON.parse(this.storage?.getItem(PROGRESSION.saveKey) ?? 'null'); } catch { d = null; }
    this.savedTutorial = d?.tutorial ?? -1;
    this.savedCampfires = d?.campfires ?? [];
    if (d?.progression) this.progression.load(d.progression);
    this.applyStats();
  }

  /** "Continuar": retoma o tutorial de onde parou e repõe as fogueiras. */
  resume() {
    for (const c of this.savedCampfires) this.addCampfire(c.x, c.z, c.lit);
    this.savedCampfires = [];
    if (this.savedTutorial >= 0 && this.savedTutorial < this.tutorial.steps.length) this.tutorial.start(this.savedTutorial);
  }

  /** "Novo Jogo": zera XP, skills, tutorial e fogueiras. */
  reset() {
    try { this.storage?.removeItem(PROGRESSION.saveKey); } catch { /* sem armazenamento */ }
    this.game.missions?.reset(); // missões (save próprio) também do zero
    this.progression.load({ xp: 0, totalXp: 0, tiers: {} });
    this.tutorial.index = -1;
    this.ui.hideTutorial();
    for (const c of this.campfires) {
      this.game.scene.remove(c.fire.root);
      c.prompt.enabled = false;
      if (c.light) this.game.fireLights.remove(c.light);
      if (c.col) this.game.collisions.remove?.(c.col);
    }
    this.campfires = [];
    this.savedTutorial = -1;
    this.savedCampfires = [];
    this.applyStats();
    this.ui.refresh();
  }
}

function safeStorage() {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}
