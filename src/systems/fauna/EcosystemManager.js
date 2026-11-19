import { ECOSYSTEM, PACKS } from '../../config/ecosystem.js';
import { PackController } from './PackController.js';
import { buildDiet, SpatialGrid, needsStep, wantsToHunt, scorePrey, statKillChance } from './Ecology.js';
import { FOOD_WEB } from '../../config/foodWeb.js';
import { ForageField } from './Foraging.js';

/**
 * Ecossistema vivo da fauna (Etapa F1). Não move nem anima ninguém: decide,
 * a cada `tick`, para cada animal:
 *  - **predador** (níveis 1–2) com fome > 60% e energia → `eco.target` = a melhor
 *    presa por perto (animal da dieta ou o jogador); alimentado → `eco.calm`
 *    (não ataca o jogador nem as presas, só se for provocado);
 *  - **presa** → `eco.threat` = predador que está caçando por perto (alerta) ou
 *    qualquer um colado nela (pânico). Predador alimentado e presa convivem.
 * Fome e energia andam a cada quadro. Caçadas em que predador **e** presa estão
 * além de `detailRadius` do jogador são resolvidas por estatística (sem
 * perseguição nem combate físico) e viram eventos `kill`.
 *
 * **Pasto e água** (config/foodWeb.js): herbívoros têm fome que só cai quando
 * chegam a um pedaço com capim/folhagem e comem de fato (`ForageField`: a
 * vegetação acaba e rebrota); todos os terrestres têm sede e vão beber na
 * margem. O alvo fica em `eco.forage` = { x, z, cx, cz, kind } e só existe sem
 * ameaça, sem caçada e sem carcaça à mesa. Precisa de `setEnvironment`.
 *
 * Os animais precisam de: speciesId, spec{sense,run,walk,health}, position{x,z},
 * health, alive, speed, limpT, group, young?.
 *
 * @example
 *   const eco = new EcosystemManager(ECOSYSTEM, { rng: Math.random });
 *   eco.register(animal);                                   // ao nascer
 *   const ev = eco.update(dt, animais, { position, alive, health01 });
 *   for (const e of ev) if (e.type === 'kill') fauna.applyKill(e.predator, e.prey);
 */
export class EcosystemManager {
  constructor(cfg = ECOSYSTEM, { rng = Math.random, packs = PACKS, food = FOOD_WEB } = {}) {
    this.cfg = cfg;
    this.food = food;
    /** Vegetação consumível e bebedouros: ligados por `setEnvironment` (sem isso, ninguém pasta nem bebe). */
    this.field = null;
    this.findWater = null;
    this.clock = 0;
    /** Matilhas e manadas (F3). */
    this.packs = new PackController(packs);
    this.sentinelScale = packs.herd.sentinelScale;
    this.rng = rng;
    this.diet = buildDiet(cfg);
    /** Espécies que algum predador come (para saber quem vigia). */
    this.preySpecies = new Set();
    for (const s of this.diet.values()) for (const p of s) this.preySpecies.add(p);
    this.grid = new SpatialGrid(cfg.gridCell);
    this._t = 0;
    this._near = [];
    this._alive = [];
    /** Últimos números (HUD de depuração / testes). */
    this.stats = { hunting: 0, alarmed: 0, statKills: 0 };
  }

  /**
   * Liga o ecossistema ao mundo.
   * @param {{ capacityAt: (x: number, z: number) => { grass: number, browse: number },
   *   findWater?: (x: number, z: number, radius: number) => { x: number, z: number, wx: number, wz: number } | null }} env
   * @example eco.setEnvironment({ capacityAt: (x, z) => biomeCapacity(biomeAt(x, z)), findWater });
   */
  setEnvironment({ capacityAt, findWater = null }) {
    this.field = new ForageField(this.food.field, { capacityAt });
    this.findWater = findWater;
  }

  /** Cria `animal.eco` (nível, fome, sede, energia, alvo, ameaça, pasto). */
  register(a) {
    const lvl = this.cfg.levels[a.speciesId] ?? 4;
    const [h0, h1] = this.cfg.hunger.initial;
    a.eco = {
      level: lvl,
      predator: (this.diet.get(a.speciesId)?.size ?? 0) > 0,
      prey: this.preySpecies.has(a.speciesId),
      needs: { hunger: h0 + (h1 - h0) * this.rng(), energy: 1, thirst: 0.2 + 0.5 * this.rng() },
      /** Recursos vegetais que come ('grass', 'browse'); vazio = não pasta. */
      forages: this.food.species[a.speciesId]?.forage ?? [],
      /** 'daily' | 'rare' | 'aquatic' | undefined (não simula sede). */
      water: this.food.species[a.speciesId]?.water,
      /** Onde vai comer/beber agora: { x, z, cx, cz, kind: 'grass'|'browse'|'water' } | null. */
      forage: null,
      /** Come folhas no alto (girafa): a animação ergue a cabeça. */
      browseHigh: !!this.food.species[a.speciesId]?.browseHigh,
      /** O que está de fato consumindo neste quadro ('grass'|'browse'|'water'|null). */
      consuming: null,
      seed: this.rng(),
      hunting: false,
      calm: true,
      target: null, // animal | 'player' | null
      threat: null, // animal | null
    };
    return a.eco;
  }

  /** O predador comeu a presa: fome cai pelo tamanho dela. */
  feed(pred, prey) {
    const e = pred.eco;
    if (!e) return;
    e.needs.hunger = Math.max(0, e.needs.hunger - (prey.spec?.health ?? 60) * this.cfg.hunger.mealPerHealth);
    e.target = null;
    e.hunting = false;
  }

  /**
   * @param {number} dt
   * @param {object[]} animals
   * @param {{ position: {x:number,z:number}, alive: boolean, health01?: number }} player
   * @returns {{ type: string, predator?: object, prey?: object }[]} `kill` (caçada estatística) e os de bando (`howl`, `alarm`…)
   */
  update(dt, animals, player) {
    const cfg = this.cfg, ev = [];
    this.clock += dt;
    for (const a of animals) {
      if (!a.eco || !a.alive) continue;
      needsStep(a.eco.needs, dt, { running: a.speed > a.spec.walk * 1.5, level: a.eco.level }, cfg);
      this.stepForage(a, dt);
    }
    this._t -= dt;
    if (this._t > 0) return ev;
    const step = Math.max(dt, cfg.tick - this._t);
    this._t = cfg.tick;
    const alive = this._alive;
    alive.length = 0;
    for (const a of animals) if (a.eco && a.alive) alive.push(a);
    this.grid.rebuild(alive);
    let hunting = 0, alarmed = 0;
    const p = player.position;
    // 1) Predadores: caçar ou conviver.
    for (const a of alive) {
      const e = a.eco;
      if (!e.predator) continue;
      // À mesa de uma carcaça (F4): come em vez de caçar, e não é ameaça para os vizinhos.
      e.hunting = wantsToHunt(e.needs, cfg) && !(e.feedAt && !e.feedAt.wait);
      e.calm = !e.hunting;
      if (!e.hunting) { e.target = null; continue; }
      hunting++;
      e.target = this.pickTarget(a, player);
    }
    // 2) Presas: vigiar e alarmar.
    for (const a of alive) {
      const e = a.eco;
      if (!e.prey) continue;
      e.threat = this.findThreat(a);
      if (e.threat) alarmed++;
    }
    // 2a) Pasto e água: quem tem fome/sede e está em paz escolhe (e mantém) um lugar.
    let foraging = 0, drinking = 0;
    if (this.field) {
      for (const a of alive) {
        this.decideForage(a);
        const k = a.eco.forage?.kind;
        if (k === 'water') drinking++; else if (k) foraging++;
      }
    }
    this.stats.foraging = foraging;
    this.stats.drinking = drinking;
    // 2b) Bandos: alvo comum, papéis, vigia, alarme (F3). Eventos: howl/alarm/circle/stampede.
    for (const e of this.packs.update(alive)) ev.push(e);
    // 3) LOD: caçadas longe do jogador → estatística.
    const R = cfg.detailRadius;
    for (const a of alive) {
      const t = a.eco.target;
      if (!t || t === 'player' || !t.alive) continue;
      const far = (o) => Math.hypot(o.position.x - p.x, o.position.z - p.z) > R;
      if (!far(a) || !far(t)) continue;
      const pack = alive.filter((o) => o.group === a.group && o.eco.target === t).length;
      if (this.rng() < statKillChance({ run: a.spec.run, pack }, { run: t.spec.run }, step, cfg)) {
        ev.push({ type: 'kill', predator: a, prey: t });
        this.stats.statKills++;
      }
    }
    this.stats.hunting = hunting;
    this.stats.alarmed = alarmed;
    return ev;
  }

  /**
   * A cada quadro: fome de herbívoro e sede sobem; quem CHEGOU ao lugar
   * (a até `reach` m, parado) come ou bebe — a fome só cai pelo que saiu de
   * fato do pedaço de vegetação.
   */
  stepForage(a, dt) {
    const e = a.eco, n = e.needs, F = this.food.forage, T = this.food.thirst;
    if (e.forages.length) n.hunger = Math.min(1, n.hunger + F.hungerPerSecond * dt);
    const rate = T.perSecond[e.water];
    if (rate) n.thirst = Math.min(1, n.thirst + rate * dt);
    e.consuming = null;
    const f = e.forage;
    if (!f || !this.field) return;
    if (Math.hypot(a.position.x - f.x, a.position.z - f.z) > F.reach || a.speed > 0.2) return; // ainda chegando
    if (f.kind === 'water') {
      n.thirst = Math.max(0, n.thirst - T.drinkPerSecond * dt);
      e.consuming = 'water';
      return;
    }
    const eaten = this.field.consume(f.cx, f.cz, f.kind, F.bitePerSecond * dt, this.clock);
    if (eaten <= 0) { e.forage = null; return; } // rapado: procura outro no próximo tique
    n.hunger = Math.max(0, n.hunger - eaten * F.hungerPerUnit);
    e.consuming = f.kind;
  }

  /**
   * Decisão (a cada tique): mantém o lugar atual enquanto a necessidade durar
   * (histerese `seekAbove` / `stopBelow`, sem troca a cada quadro); ameaça, caçada
   * ou carcaça cancelam. Sede vem antes da fome.
   */
  decideForage(a) {
    const e = a.eco, n = e.needs, F = this.food.forage, T = this.food.thirst;
    if (e.threat || e.hunting || e.feedAt) { e.forage = null; return; }
    const f = e.forage;
    if (f) {
      if (f.kind === 'water') { if (n.thirst > T.stopBelow) return; } else if (n.hunger > F.stopBelow && this.field.amount(f.cx, f.cz, f.kind, this.clock) >= F.minPatch * 0.5) return;
      e.forage = null;
    }
    if (this.findWater && T.perSecond[e.water] && n.thirst > T.seekAbove) {
      const w = this.findWater(a.position.x, a.position.z, T.searchRadius);
      if (w) { e.forage = { x: w.x, z: w.z, cx: w.wx, cz: w.wz, kind: 'water' }; return; }
    }
    if (e.forages.length && n.hunger > F.seekAbove) {
      const best = this.field.findBest(a.position.x, a.position.z, e.forages, F.searchRadius, this.clock, F.minPatch);
      if (!best) return;
      // Cada animal come num ponto próprio do pedaço (não empilham no centro da célula).
      const ang = e.seed * Math.PI * 2, r = this.food.field.cell * 0.32 * (0.3 + 0.7 * ((e.seed * 7.3) % 1));
      e.forage = { x: best.x + Math.cos(ang) * r, z: best.z + Math.sin(ang) * r, cx: best.x, cz: best.z, kind: best.kind };
    }
  }

  /** Melhor presa por perto (mantém a atual se ainda servir). */
  pickTarget(a, player) {
    const cfg = this.cfg, e = a.eco, diet = this.diet.get(a.speciesId);
    const r = a.spec.sense * cfg.huntSenseScale;
    const cur = e.target;
    if (cur && cur !== 'player' && cur.alive && Math.hypot(cur.position.x - a.position.x, cur.position.z - a.position.z) < r * 1.3) return cur;
    let best = null, bs = Infinity;
    const near = this.grid.query(a.position.x, a.position.z, r, (this._near.length = 0, this._near));
    for (const o of near) {
      if (o === a || !diet.has(o.speciesId)) continue;
      const d = Math.hypot(o.position.x - a.position.x, o.position.z - a.position.z);
      const s = scorePrey(d, { health: o.health / o.spec.health, young: !!o.young, limping: o.limpT > 0 });
      if (s < bs) { bs = s; best = o; }
    }
    if (player.alive && cfg.playerPreyOf.includes(e.level)) {
      const d = Math.hypot(player.position.x - a.position.x, player.position.z - a.position.z);
      if (d < r) {
        const s = scorePrey(d, { health: player.health01 ?? 1, young: false, limping: false });
        if (s < bs) { bs = s; best = 'player'; }
      }
    }
    return best;
  }

  /** Predador que ameaça esta presa: caçando por perto (alerta) ou colado (pânico). */
  findThreat(a) {
    const cfg = this.cfg.prey;
    let best = null, bd = Infinity;
    const R = cfg.alarmRadius * (a.eco.sentinel ? this.sentinelScale : 1); // o vigia enxerga mais longe
    const near = this.grid.query(a.position.x, a.position.z, R, (this._near.length = 0, this._near));
    for (const o of near) {
      if (o === a || !o.eco.predator || !this.diet.get(o.speciesId).has(a.speciesId)) continue;
      const d = Math.hypot(o.position.x - a.position.x, o.position.z - a.position.z);
      if (!o.eco.hunting && d > cfg.panicRadius) continue; // alimentado e não colado: convivem
      if (!o.eco.hunting && a.eco.feedAt) continue; // à mesa da carcaça: predador saciado não assusta (F4)
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
}
