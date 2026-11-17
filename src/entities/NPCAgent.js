import * as THREE from 'three';
import { Humanoid } from './Humanoid.js';
import { activityAt, energyStep, tirednessOf } from '../systems/npc/Routine.js';
import { PROFESSIONS, POPULATION, ENERGY, WEATHER_REACT } from '../config/npcLife.js';

import { LAW } from '../config/law.js';
import { SLOPE } from '../config/physics.js';
import { surfaceNormal, isUnwalkable, SlideState, steerAroundSlope } from '../systems/physics/SlopePhysics.js';
import { workGoal, arriveAtWork, isWorking, tickWork, leaveWork, workUnreachable, workNoPath, heldItem, leisureGoal, arriveAtVisit, aiStateOf } from '../systems/work/AgentWork.js';

const _steer = { x: 0, z: 0, blocked: false };

const _e = new THREE.Euler();
const HITBOX_MAT = new THREE.MeshBasicMaterial({ visible: false });
const HITBOX_GEO = new THREE.BoxGeometry(1, 1, 1);
const ARRIVE = 0.45;

/**
 * Morador com vida própria: segue a rotina de 24 h (casa → trabalho →
 * almoço → trabalho → lazer → casa/sono), cansa ao longo do dia, reage ao
 * clima e tem um boneco 3D só quando está perto do jogador (LOD de IA).
 *
 * Estados de chegada: IDLE (em pé), WORKING (gesto da profissão), SITTING,
 * SLEEPING (deitado dentro de casa), SHELTER (abrigado do temporal).
 * Durante o caminho: WALK.
 *
 * Trabalho: quem tem emprego (`job`, um prédio da vila) vai de estação em
 * estação seguindo o ciclo da profissão; o gesto de trabalho só toca depois
 * de CHEGAR e OCUPAR uma estação válida (systems/work/AgentWork.js). Quem não
 * tem prédio para trabalhar não finge: passa o turno pela vila.
 * `aiState` resume tudo: SLEEPING · WAKING_UP · GOING_TO_WORK · WORKING ·
 * TAKING_BREAK · EATING · SOCIALIZING · GOING_HOME · IDLE.
 *
 * @example
 * const a = new NPCAgent(person, { look, home, workplace, manager });
 * a.update(dt, { hour, hoursPassed, env, detailed: true }); // detailed = tem boneco
 */
export class NPCAgent {
  constructor(person, { look, home, workplace, lunchSpot, leisure, patrol = null, village, manager, rng }) {
    this.person = person;
    this.id = person.id;
    this.name = person.fullName;
    this.look = look;
    this.home = home; // { id, door:{x,z}, inside:{x,z}, floorY, yaw }
    this.workplace = workplace; // { x, z, yaw, gesture }
    this.lunchSpot = lunchSpot;
    this.leisure = leisure; // [{x,z}] — sorteia um por dia
    this.patrol = patrol; // [{x,z}] loop (guardas)
    this.patrolIndex = 0;
    this.village = village;
    this.manager = manager;
    this.rng = rng;
    this.jitter = (rng() * 2 - 1) * 0.35;
    this.prof = PROFESSIONS[person.profession] ?? null;
    this.pos = { x: home.inside.x, y: 0, z: home.inside.z };
    this.yaw = home.yaw ?? 0;
    this.activity = null;
    this.state = 'SLEEPING';
    this.route = [];
    this.goal = null; // { x, z, state, yaw, gesture }
    this.energy = 1;
    this.speed = 0;
    this.model = null;
    this.rendered = false;
    this.t = rng() * 100; // relógio do gesto
    this.sweatIn = 5 + rng() * 6;
    this.wipeT = 0;
    this.stuck = 0;
    this.lastProgress = 0;
    this.sheltering = false;
    this._leisurePick = Math.floor(rng() * 1000);
    /**
     * Reação que interrompe a rotina por alguns segundos:
     * { kind: 'FLEE'|'FACE'|'CHAT'|'RUN_TO' (corre até x,z — testemunha), until: s, x, z (de quem foge / para quem olha), gesture }
     */
    this.reaction = null;
    this.reactCooldown = 0;
    this.chatCooldown = rng() * 10;
    /** Vida: 'ALIVE' | 'KNOCKED_OUT' (deitado, levanta sozinho) | 'DEAD' (corpo fica no chão). */
    this.life = 'ALIVE';
    this.koUntil = 0;
    /** Limite de inclinação: normal sob os pés e escorregão (SLIDING). */
    this.normal = { x: 0, y: 1, z: 0 };
    this.slide = new SlideState();
    this.sliding = false;
    /** Emprego: ciclo de tarefas num prédio da vila (WorkRoutine) — null = sem ofício. */
    this.job = null;
    this.workBuilding = null;
    /** Por que não está trabalhando agora ('occupied', 'unreachable', 'no-floor'…) — depuração. */
    this.workFail = null;
    /** Lugar de visita ocupado (banco da capela, mesa da taverna…). */
    this.visiting = null;
    /** Prédios visitáveis da vila ({ id, type }) — preenchido pelo NPCManager. */
    this.villageWork = null;
    this.toolMesh = null;
    this._toolId = null;
    /** Desvio pessoal nos pontos de encontro (ninguém fica empilhado no mesmo lugar). */
    this._off = { x: (rng() - 0.5) * 7, z: (rng() - 0.5) * 7 };
  }

  /** Estado de IA legível (rotina + trabalho). */
  get aiState() {
    return aiStateOf(this);
  }

  /** Fora de ação (desacordado ou morto): não anda, não conversa, não reage. */
  get down() {
    return this.life !== 'ALIVE';
  }

  /**
   * Nocaute: deita no chão e levanta depois de `seconds`.
   * @example agent.knockOut(LAW.knockoutSeconds);
   */
  knockOut(seconds) {
    if (this.life === 'DEAD') return;
    this.life = 'KNOCKED_OUT';
    leaveWork(this);
    this.koUntil = this.t + seconds;
    this.reaction = null;
    this.route = [];
    this.speed = 0;
    this.state = 'DOWN';
  }

  /** Morte: o corpo fica onde caiu. */
  kill() {
    this.life = 'DEAD';
    leaveWork(this);
    this.reaction = null;
    this.route = [];
    this.speed = 0;
    this.state = 'DOWN';
  }

  /** Interrompe a rotina: foge, encara, conversa ou corre até um ponto por `seconds` (`speed` opcional em m/s). */
  react(kind, seconds, at, gesture = null, speed = null) {
    leaveWork(this); // larga a estação: ao voltar, chega e ocupa de novo
    this.reaction = { kind, until: this.t + seconds, x: at.x, z: at.z, gesture, speed };
  }

  get walkSpeed() {
    const base = this.person.age === 'child' ? 1.15 : this.person.age === 'elder' ? 0.75 : POPULATION.walkSpeed;
    return base * (this.energy < ENERGY.tired ? 0.8 : 1);
  }

  get tiredness() {
    return tirednessOf(this.energy);
  }

  /** Dentro de casa (dormindo ou abrigado) — sem boneco do lado de fora. */
  get indoors() {
    return this.state === 'SLEEPING' || this.state === 'SHELTER';
  }

  // ------------------------------------------------------------ decisão

  /**
   * Onde ele deveria estar agora e em que estado ao chegar.
   * @param {number} hour
   * @param {{ shelter: boolean }} env clima no lugar (temporal = procurar abrigo)
   */
  desired(hour, env) {
    const p = this.person;
    const act = activityAt(hour, { jitter: this.jitter, profession: p.profession, shift: p.shift ?? 'day', age: p.age });
    const h = this.home;
    // Comandante da Guarda: sempre no posto da praça (NPC fixo).
    if (this.commander) return { key: 'POST', x: this.workplace.x, z: this.workplace.z, state: 'WORKING', yaw: this.workplace.yaw, gesture: 'guard' };
    // Temporal: todos buscam abrigo em casa, menos o guarda em serviço.
    if (env.shelter && !(p.profession === 'guarda' && act === 'WORK')) {
      return { key: 'SHELTER', x: h.inside.x, z: h.inside.z, state: 'SHELTER', yaw: h.yaw, viaDoor: true, run: true };
    }
    switch (act) {
      case 'WAKE': return { key: 'WAKE', x: h.yard.x, z: h.yard.z, state: 'IDLE', yaw: h.yaw, gesture: this.t % 20 < 8 ? 'eat' : 'talk' };
      case 'WORK':
      case 'WORK_PM':
        if (this.patrol) return { key: 'PATROL', patrol: true, state: 'WALK' };
        if (this.job) return workGoal(this); // estação do passo atual, ou esperar na frente do prédio
        { // sem ofício (a vila não tem prédio para ele): não finge trabalhar — passa o turno pela vila
          const s = this.leisure[this._leisurePick % this.leisure.length];
          return { key: 'FREE', x: s.x + this._off.x, z: s.z + this._off.z, state: 'IDLE', yaw: null, gesture: 'talk' };
        }
      case 'LUNCH': return { key: 'LUNCH', x: this.lunchSpot.x, z: this.lunchSpot.z, state: 'SITTING', yaw: this.lunchSpot.yaw, gesture: 'eat' };
      case 'LEISURE': {
        const visit = this.villageWork ? leisureGoal(this) : null; // taverna, capela, mercado, padaria
        if (visit) return visit;
        const s = this.leisure[(this._leisurePick + Math.floor(this.manager.day)) % this.leisure.length];
        return { key: `LEISURE${s.id}`, x: s.x + this._off.x * 0.6, z: s.z + this._off.z * 0.6, state: 'IDLE', yaw: null, gesture: 'talk' };
      }
      case 'PLAY': {
        const s = this.leisure[0];
        return { key: 'PLAY', x: s.x + Math.sin(this.t * 0.07) * 5, z: s.z + Math.cos(this.t * 0.05) * 5, state: 'IDLE', gesture: 'play' };
      }
      case 'REST': return { key: 'REST', x: this.leisure[0].x, z: this.leisure[0].z, state: 'SITTING', gesture: 'talk' };
      default: return { key: 'HOME', x: h.inside.x, z: h.inside.z, state: 'SLEEPING', yaw: h.yaw, viaDoor: true };
    }
  }

  /** Muda de objetivo: monta a rota (porta → ruas → destino). */
  setGoal(goal) {
    if (!goal.station) this.job?.leave(); // saiu do trabalho: solta a estação
    if (this.visiting && goal.visit !== this.visiting) { this.manager.registry?.release(this.visiting, this.id); this.visiting = null; }
    this.goal = goal;
    const k = goal.key;
    this.activity = k.startsWith('WORK:') || k.startsWith('WAIT:') ? 'WORK' : k.startsWith('VISIT:') ? 'LEISURE' : k === 'FREE' ? 'LEISURE' : k;
    if (goal.patrol) { this.route = []; this.state = 'WALK'; return; }
    this.stuck = 0;
    const route = this.manager.route(this, this.pos, goal);
    if (route === undefined) { this.route = []; this.state = 'IDLE'; this._pendingRoute = true; return; } // calcula no próximo quadro
    if (route === null) { // sem caminho: não teletransporta nem trabalha de longe — espera e tenta de novo
      if (goal.station) workNoPath(this, goal.station);
      else if (goal.visit && this._visit) this._visit.failed = true;
      this.route = [];
      this.state = 'IDLE';
      this.goal = { key: 'NOPATH', state: 'IDLE', gesture: null, x: this.pos.x, z: this.pos.z, target: k };
      return;
    }
    this.route = route;
    if (route.length) this.state = 'WALK';
    else this.arrive(); // já estava no lugar: mesma validação de quem chega andando
  }

  /** Teletransporta direto para onde a rotina manda (vila acabou de ativar: posição "matemática"). */
  snap(hour, env) {
    if (this.life === 'DEAD') return;
    if (this.life === 'KNOCKED_OUT') this.life = 'ALIVE'; // salto de relógio: já acordou
    leaveWork(this);
    const g = this.desired(hour, env);
    this.goal = g;
    this.activity = g.key.startsWith('WORK:') || g.key.startsWith('WAIT:') ? 'WORK' : g.key.startsWith('VISIT:') || g.key === 'FREE' ? 'LEISURE' : g.key;
    this.route = [];
    if (g.station || g.visit) {
      // posição "matemática" também passa pela validação: estação ocupada → fica na frente do prédio
      const st = g.station ?? g.visit;
      this.pos.x = st.x; this.pos.z = st.z;
      this.state = g.state;
      const ok = g.station ? arriveAtWork(this) : arriveAtVisit(this);
      if (!ok) {
        const w = this.workBuilding?.wait ?? this.leisure[0];
        this.pos.x = w.x + this._off.x * 0.3; this.pos.z = w.z + this._off.z * 0.3;
        this.state = 'IDLE';
      }
    } else if (g.patrol) {
      const p = this.patrol[Math.floor(this.rng() * this.patrol.length)];
      this.pos.x = p.x; this.pos.z = p.z; this.state = 'WALK';
    } else {
      this.pos.x = g.x; this.pos.z = g.z; this.state = g.state;
      if (g.yaw !== null && g.yaw !== undefined) this.yaw = g.yaw;
    }
    // Energia "matemática" pela hora: horas trabalhadas desde as 7h30 (almoço não conta).
    const worked = Math.max(0, Math.min(4.5, hour - 7.5)) + Math.max(0, Math.min(4.5, hour - 13));
    this.energy = hour < 6 || hour >= 21.5 ? 1 : energyStep(1, 'WORK', worked);
  }

  // ------------------------------------------------------------ simulação

  /**
   * @param {number} dt s reais
   * @param {{ hour: number, hoursPassed: number, env: object, detailed: boolean, move: Function }} ctx
   *   move(pos, dx, dz) = deslocamento com colisão (só com boneco)
   */
  update(dt, { hour, hoursPassed, env, detailed, move }) {
    this.t += dt;
    if (this.life === 'DEAD') { this.speed = 0; return; }
    // Física de encosta (só com boneco, fora de casa, pisando no relevo): > 45° = escorrega.
    if (detailed && move && !this.indoors && this.slideStep(dt, move)) return;
    if (this.life === 'KNOCKED_OUT') {
      this.speed = 0;
      if (this.t < this.koUntil) return;
      // Acorda: volta para a rotina (refaz a rota a partir de onde caiu).
      this.life = 'ALIVE';
      this.goal = null;
      this.state = 'IDLE';
      this.reactCooldown = 3;
    }
    this.reactCooldown = Math.max(0, this.reactCooldown - dt);
    this.chatCooldown = Math.max(0, this.chatCooldown - dt);
    if (this.reaction) {
      const r = this.reaction;
      if (this.t >= r.until) { this.reaction = null; if (this.goal && !this.goal.patrol) this.setGoal(this.goal); }
      else {
        this.speed = 0;
        const dx = this.pos.x - r.x, dz = this.pos.z - r.z, d = Math.hypot(dx, dz) || 1;
        if (r.kind === 'FLEE') this.step(dx / d, dz / d, POPULATION.runSpeed * dt, detailed, move);
        else if (r.kind === 'RUN_TO') { if (d > 0.3) this.step(-dx / d, -dz / d, Math.min(d, (r.speed ?? POPULATION.runSpeed) * dt), detailed, move); }
        else this.yaw = turn(this.yaw, Math.atan2(-dx, -dz), 0.2);
        return;
      }
    }
    const g = this.desired(hour, env);
    if (!this.goal || g.key !== this.goal.key) { this._pendingRoute = false; this.setGoal(g); }
    else if (this._pendingRoute) { this._pendingRoute = false; this.setGoal(this.goal); } // rota que ficou para este quadro
    const sleeping = this.state === 'SLEEPING';
    this.energy = energyStep(this.energy, isWorking(this) || this.goal.key === 'PATROL' ? 'WORK' : this.goal.key, hoursPassed, sleeping);
    tickWork(this, dt); // passo de trabalho na estação ocupada (produção ao terminar)
    if (this.goal.key === 'LUNCH' && this.state === 'SITTING') this.energy = Math.min(1, this.energy + ENERGY.lunchBoost * hoursPassed);

    this.speed = 0;
    if (this.goal.patrol) this.walkPatrol(dt, detailed, move);
    else if (this.state === 'WALK') this.walkRoute(dt, detailed, move, g.run);
    else if (this.goal.key === 'PLAY') { // criança: corre em volta do ponto de brincadeira
      const dx = g.x - this.pos.x, dz = g.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.5) this.step(dx / d, dz / d, Math.min(d, 1.6 * dt), detailed, move);
    }
    // Calor: limpa o suor de tempos em tempos.
    if (env.heat) {
      this.sweatIn -= dt;
      if (this.sweatIn <= 0) { this.wipeT = 1.4; this.sweatIn = WEATHER_REACT.sweatEvery[0] + this.rng() * (WEATHER_REACT.sweatEvery[1] - WEATHER_REACT.sweatEvery[0]); }
    }
    this.wipeT = Math.max(0, this.wipeT - dt);
  }

  /**
   * Escorregão: pisou (ou foi empurrado) numa encosta > 45°. Enquanto desliza, a
   * rotina para e ele faz o gesto de desequilíbrio, até tocar chão firme.
   * @returns {boolean} true = escorregando neste passo (a rotina não roda)
   */
  slideStep(dt, move) {
    const T = this.manager.terrainAt;
    if (!T || this.life !== 'ALIVE') { this.sliding = false; return false; }
    const onTerrain = Math.abs(this.pos.y - T(this.pos.x, this.pos.z)) < SLOPE.onTerrainEps;
    if (onTerrain) surfaceNormal(T, this.pos.x, this.pos.z, SLOPE.normalSample, this.normal);
    else { this.normal.x = 0; this.normal.y = 1; this.normal.z = 0; }
    const d = this.slide.update(dt, this.normal, onTerrain && isUnwalkable(this.normal));
    this.sliding = this.slide.sliding;
    if (!this.sliding) return false;
    move(this.pos, d.dx, d.dz);
    this.speed = 0;
    return true;
  }

  step(dx, dz, dist, detailed, move) {
    // Encosta íngreme à frente: contorna (descarta o passo que escalaria a montanha).
    const T = this.manager.terrainAt;
    if (T && dist > 0 && !this.indoors) {
      steerAroundSlope(T, this.pos.x, this.pos.z, dx, dz, SLOPE, _steer);
      if (_steer.blocked) { this.speed = 0; return; }
      dx = _steer.x; dz = _steer.z;
    }
    if (detailed && move) move(this.pos, dx * dist, dz * dist);
    else { this.pos.x += dx * dist; this.pos.z += dz * dist; }
    this.yaw = turn(this.yaw, Math.atan2(dx, dz), 0.25);
    this.speed = dist / Math.max(1e-4, this.manager.dt);
  }

  walkRoute(dt, detailed, move, run) {
    const target = this.route[0];
    if (!target) { this.arrive(); return; }
    const dx = target.x - this.pos.x, dz = target.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d < ARRIVE) { this.route.shift(); this.stuck = 0; if (!this.route.length) this.arrive(); return; }
    const v = (run ? POPULATION.runSpeed : this.walkSpeed);
    const before = d;
    this.step(dx / d, dz / d, Math.min(d, v * dt), detailed, move);
    // Preso numa quina (colisão): pula para o próximo ponto depois de 2 s.
    const after = Math.hypot(target.x - this.pos.x, target.z - this.pos.z);
    this.stuck = before - after < v * dt * 0.2 ? this.stuck + dt : 0;
    if (this.stuck > 2) {
      this.stuck = 0;
      if (!this.goal.noTeleport) { this.pos.x = target.x; this.pos.z = target.z; return; } // (casa: porta trancada etc.)
      // Trabalho/visita: nada de teletransporte — recalcula a rota; depois de algumas tentativas, desiste por ora.
      const st = this.goal.station;
      const giveUp = st ? workUnreachable(this, st) : (this._replans = (this._replans ?? 0) + 1) >= 3;
      const route = giveUp ? null : this.manager.route(this, this.pos, this.goal);
      if (route === undefined) { this.route = []; this.state = 'IDLE'; this._pendingRoute = true; return; }
      if (!route) {
        if (this.goal.visit && this._visit) this._visit.failed = true;
        this._replans = 0;
        this.route = [];
        this.state = 'IDLE';
        this.goal = { key: 'NOPATH', state: 'IDLE', gesture: null, x: this.pos.x, z: this.pos.z, target: this.goal.key };
        return;
      }
      this.route = route;
    }
  }

  walkPatrol(dt, detailed, move) {
    const p = this.patrol[this.patrolIndex];
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 1) { this.patrolIndex = (this.patrolIndex + 1) % this.patrol.length; return; }
    this.step(dx / d, dz / d, Math.min(d, this.walkSpeed * 0.9 * dt), detailed, move);
    this.state = 'WALK';
  }

  arrive() {
    if (this.goal.station) { arriveAtWork(this); return; } // só vira WORKING se a estação for válida e livre
    if (this.goal.visit && !arriveAtVisit(this)) return;
    this.state = this.goal.state;
    if (this.goal.yaw !== null && this.goal.yaw !== undefined) this.yaw = this.goal.yaw;
  }

  // ------------------------------------------------------------ boneco

  /** Monta o boneco 3D (LOD: só quando perto). */
  ensureModel(scene) {
    if (this.model) return this.model;
    this.model = new Humanoid(this.look);
    this.model.root.name = `npc-${this.id}`;
    this.model.root.userData.agent = this;
    this._toolId = null;
    this.toolMesh = null;
    // Hitbox invisível (soco e projéteis): o Raycaster não olha `visible`.
    const hb = new THREE.Mesh(HITBOX_GEO, HITBOX_MAT);
    hb.scale.set(LAW.hitbox.w, LAW.hitbox.h, LAW.hitbox.d);
    hb.position.y = LAW.hitbox.h / 2;
    hb.name = 'hitbox';
    hb.userData.agent = this;
    this.model.root.add(hb);
    this.hitbox = hb;
    scene.add(this.model.root);
    return this.model;
  }

  /**
   * Copia a simulação para o boneco: posição, giro, animação base do
   * Humanoid e, por cima, o gesto (trabalho, clima, cansaço).
   * @param {{ env: object, groundAt: Function, dt: number }} o
   */
  syncModel({ env, groundAt, dt }) {
    const m = this.model;
    m.root.visible = true;
    const working = isWorking(this);
    const chair = (working && this.goal.station.sit) || (this.state === 'SITTING' && !!this.goal.seat); // banco/cadeira
    const sleeping = this.state === 'SLEEPING', sitting = this.state === 'SITTING' || chair;
    const feet = this.home.floorY !== undefined && this.indoors ? this.home.floorY + 0.3 : this.pos.y + 0.3;
    this.pos.y = groundAt(this.pos.x, this.pos.z, feet);
    m.root.position.set(this.pos.x, this.pos.y, this.pos.z);
    m.root.rotation.y = this.yaw;
    m.update(dt, this.down ? 0 : this.speed, {});
    if (this.down) { // caído de costas (morto: meio de lado)
      m.body.rotation.x = -Math.PI / 2;
      m.body.rotation.z = this.life === 'DEAD' ? 0.35 : 0;
      m.body.position.y = 0.16;
      return;
    }
    m.body.rotation.z = 0;
    // Poses de corpo inteiro.
    m.body.rotation.x = sleeping ? -Math.PI / 2 : 0;
    m.body.position.y = sleeping ? 0.16 : chair ? -0.3 : sitting ? -0.42 : 0;
    this.syncTool(m);
    if (sleeping) return;
    if (sitting) for (let i = 0; i < 2; i++) { m.legs[i].quaternion.setFromEuler(_e.set(-1.45, 0, 0)); m.knees[i].quaternion.setFromEuler(_e.set(1.5, 0, 0)); }
    // Gesto: clipe real quando existe (sentado/andando só o tronco e os braços); senão o procedural.
    const gesture = this.gestureNow(env);
    if (!m.clipGesture(gesture, dt, { upperOnly: sitting || this.state === 'WALK' || this.speed > 0.2, variant: (this._variant ??= [...String(this.id)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) })) applyGesture(m, gesture, this.t);
    if (working && this.goal.station.fx) this.manager.fx?.beat(this, this.goal.station);
  }

  /** Ferramenta/carga na mão direita do boneco: troca só quando muda (some ao terminar o passo). */
  syncTool(m) {
    const id = this.down || this.state === 'SLEEPING' ? null : heldItem(this);
    if (id === this._toolId) return;
    this.toolMesh?.removeFromParent();
    this.toolMesh = id ? this.manager.toolFor?.(id) ?? null : null;
    if (this.toolMesh) m.hands[0].add(this.toolMesh);
    this._toolId = id;
  }

  /** Gesto do momento (prioridade: clima > trabalho/descanso > cansaço). */
  gestureNow(env) {
    if (this.sliding) return 'balance';
    if (this.reaction) return this.reaction.gesture ?? (this.reaction.kind === 'FLEE' || this.reaction.kind === 'RUN_TO' ? 'panic' : this.reaction.kind === 'CHAT' ? 'talk' : null);
    if (env.shelter && !this.indoors) return 'coverHead';
    if (this.wipeT > 0) return 'wipe';
    // Trabalho: o gesto só existe com a estação ocupada (nunca no ar). O comandante no posto não usa estação.
    if (this.state === 'WORKING') return this.goal.station ? (isWorking(this) ? this.goal.gesture : null) : this.goal.gesture;
    if (this._toolId && this.state === 'WALK') return 'carry';
    if (this.state === 'SITTING' || (this.state === 'IDLE' && this.goal.gesture)) {
      if (this.goal.gesture === 'eat' || this.goal.gesture === 'talk' || this.goal.gesture === 'play') return env.cold ? 'crossArms' : this.goal.gesture;
    }
    if (env.cold) return 'crossArms';
    if (this.person.profession === 'guarda') return 'guard';
    if (this.energy < ENERGY.tired) return 'slump';
    return null;
  }

  /** Esconde o boneco (longe ou dentro de casa sem ninguém olhando). */
  hideModel() {
    if (this.model) this.model.root.visible = false;
    this.rendered = false;
  }
}

function turn(cur, target, k) {
  const d = Math.atan2(Math.sin(target - cur), Math.cos(target - cur));
  return cur + d * k;
}

/** Ângulo de um membro (x, y, z) direto no quatérnio da articulação. */
function set(joint, x, y = 0, z = 0) {
  joint.quaternion.setFromEuler(_e.set(x, y, z));
}

/**
 * Gestos por cima da animação base (depois de Humanoid.update).
 * Lados: arms[0]/elbows[0] = braço direito, [1] = esquerdo.
 */
export function applyGesture(m, gesture, t) {
  if (!gesture) return;
  const R = 0, L = 1;
  const s = Math.sin(t * 3.2);
  switch (gesture) {
    case 'hoe': // capinando: os dois braços levantam e descem a enxada
      set(m.torso, 0.3 + 0.12 * s);
      for (const i of [R, L]) { set(m.arms[i], -0.7 - 0.6 * Math.max(0, s), 0, i === R ? 0.15 : -0.15); set(m.elbows[i], -0.5); }
      break;
    case 'hammer':
    case 'chop': { // martelo / machado: braço direito sobe e bate
      const k = Math.max(0, Math.sin(t * (gesture === 'chop' ? 2.6 : 4)));
      set(m.torso, 0.15 + 0.12 * k);
      set(m.arms[R], -2.4 + 1.9 * (1 - k)); set(m.elbows[R], -0.9 * k);
      set(m.arms[L], gesture === 'chop' ? -2.2 + 1.8 * (1 - k) : -0.7); set(m.elbows[L], -0.6);
      break;
    }
    case 'arrange':
    case 'craft': // mãos na bancada, movimentos curtos
      set(m.torso, 0.18);
      set(m.arms[R], -0.95 + 0.15 * s, 0, 0.1); set(m.elbows[R], -0.9 - 0.25 * Math.sin(t * 5));
      set(m.arms[L], -0.9 - 0.1 * s, 0, -0.1); set(m.elbows[L], -0.8);
      break;
    case 'fish': // segurando a vara
      set(m.arms[R], -1.1); set(m.elbows[R], -0.4 + 0.05 * s);
      set(m.arms[L], -0.9); set(m.elbows[L], -0.6);
      break;
    case 'scout': // mão na testa olhando longe
      set(m.arms[R], -2.5, 0, 0.3); set(m.elbows[R], -1.9);
      set(m.head, -0.1, Math.sin(t * 0.6) * 0.6, 0);
      break;
    case 'eat': { // mão à boca de tempos em tempos
      const k = Math.max(0, Math.sin(t * 1.4));
      set(m.arms[R], -0.6 - 0.6 * k, 0, 0.2); set(m.elbows[R], -1.2 - 1.0 * k);
      break;
    }
    case 'talk': // gesticulando
      set(m.arms[R], -0.35 - 0.25 * Math.max(0, Math.sin(t * 2.1)), 0, 0.15); set(m.elbows[R], -0.9 - 0.4 * Math.max(0, Math.sin(t * 2.7)));
      break;
    case 'play':
      set(m.arms[R], -1.2 + Math.sin(t * 6) * 0.8); set(m.arms[L], -1.2 - Math.sin(t * 6) * 0.8);
      break;
    case 'coverHead': // braços sobre a cabeça (chuva/areia)
      set(m.torso, 0.15);
      set(m.arms[R], -2.7, 0, -0.35); set(m.elbows[R], -1.9);
      set(m.arms[L], -2.7, 0, 0.35); set(m.elbows[L], -1.9);
      break;
    case 'crossArms': { // frio: braços cruzados e tremendo
      const shiver = Math.sin(t * 38) * 0.025;
      set(m.torso, 0.06, 0, shiver);
      set(m.arms[R], -0.55, 0, -0.45); set(m.elbows[R], -2.0);
      set(m.arms[L], -0.6, 0, 0.45); set(m.elbows[L], -2.0);
      break;
    }
    case 'wipe': // calor: enxuga o suor da testa
      set(m.arms[R], -2.4 + Math.sin(t * 6) * 0.15, 0, 0.6); set(m.elbows[R], -2.2);
      break;
    case 'slump': // exausto: ombros caídos, cabeça baixa
      set(m.torso, 0.3);
      set(m.head, 0.35);
      set(m.arms[R], 0.1, 0, 0.12); set(m.arms[L], 0.1, 0, -0.12);
      break;
    case 'fists': // provocado: punhos erguidos
      set(m.torso, 0.1);
      set(m.arms[R], -1.3, 0, 0.35); set(m.elbows[R], -2.1);
      set(m.arms[L], -1.2, 0, -0.35); set(m.elbows[L], -2.1);
      break;
    case 'panic': // fugindo: braços se debatendo
      set(m.arms[R], -0.6 + Math.sin(t * 14) * 0.9, 0, 0.3); set(m.arms[L], -0.6 - Math.sin(t * 14) * 0.9, 0, -0.3);
      break;
    case 'point': // guarda apontando / avisando
      set(m.arms[L], -1.5, 0, -0.2); set(m.elbows[L], -0.1);
      break;
    case 'thrust': { // estocada de lança: braço direito recua e avança
      const k = Math.max(0, Math.sin(t * 7));
      set(m.torso, 0.12 + 0.18 * k);
      set(m.arms[R], -1.45 - 0.2 * k, 0, 0.1); set(m.elbows[R], -1.6 + 1.5 * k);
      set(m.arms[L], -1.2, 0, -0.2); set(m.elbows[L], -1.1);
      break;
    }
    case 'balance': { // perdeu a aderência na encosta: braços abertos, tronco para trás, abanando
      const w = Math.sin(t * 9) * 0.35;
      set(m.torso, -0.28, 0, w * 0.4);
      set(m.head, -0.15);
      set(m.arms[R], -0.6 + w, 0, 1.25); set(m.elbows[R], -0.35);
      set(m.arms[L], -0.6 - w, 0, -1.25); set(m.elbows[L], -0.35);
      break;
    }
    case 'guard': // lança em posição de guarda
      set(m.arms[R], -0.35); set(m.elbows[R], -1.0);
      break;
    // ---------------- ofícios (só tocam numa estação ocupada)
    case 'mine': { // picareta: sobe com os dois braços e desce na rocha à frente
      const k = Math.max(0, Math.sin(t * 2.8)), hit = Math.max(0, -Math.sin(t * 2.8));
      set(m.torso, 0.1 + 0.3 * hit - 0.12 * k);
      set(m.arms[R], -1.0 - 1.5 * k + 0.25 * hit, 0, 0.12); set(m.elbows[R], -0.5 - 0.5 * k);
      set(m.arms[L], -1.05 - 1.4 * k + 0.25 * hit, 0, -0.3); set(m.elbows[L], -0.7 - 0.4 * k);
      break;
    }
    case 'saw': case 'scrub': case 'knead': case 'brush': case 'weave': case 'grind': case 'mend': case 'spin': {
      // vai-e-vem das mãos na altura da bancada (ritmo e amplitude por ofício)
      const f = { saw: 5.2, scrub: 4.2, knead: 3.0, brush: 3.6, weave: 2.6, grind: 3.4, mend: 2.2, spin: 2.4 }[gesture];
      const a = { saw: 0.42, scrub: 0.3, knead: 0.22, brush: 0.35, weave: 0.3, grind: 0.16, mend: 0.14, spin: 0.2 }[gesture];
      const w = Math.sin(t * f);
      const low = gesture === 'knead' || gesture === 'scrub' || gesture === 'grind' ? 0.12 : 0;
      set(m.torso, 0.2 + low + 0.05 * w);
      set(m.arms[R], -0.95 + a * w, 0, 0.08); set(m.elbows[R], -0.95 - a * 0.9 * w);
      set(m.arms[L], gesture === 'saw' ? -0.8 : -0.95 - a * w * (gesture === 'knead' ? -1 : 0.6), 0, -0.1); set(m.elbows[L], -0.85);
      break;
    }
    case 'shape': // torno do oleiro: mãos em concha, quase paradas
      set(m.torso, 0.32);
      set(m.arms[R], -0.85 + 0.05 * s, 0, -0.18); set(m.elbows[R], -1.1);
      set(m.arms[L], -0.85 - 0.05 * s, 0, 0.18); set(m.elbows[L], -1.1);
      break;
    case 'reach': case 'arrange': case 'light': case 'tend': case 'trade': case 'serve': {
      // estende o braço até a prateleira / o balcão / o freguês, recolhe e repete
      const k = Math.max(0, Math.sin(t * (gesture === 'trade' ? 1.9 : 1.5)));
      const high = gesture === 'reach' || gesture === 'light' ? 0.5 : 0;
      set(m.torso, 0.08 + 0.1 * k);
      set(m.arms[R], -0.7 - (0.8 + high) * k, 0, 0.1); set(m.elbows[R], -1.1 + 0.9 * k);
      set(m.arms[L], gesture === 'trade' || gesture === 'serve' ? -0.6 - 0.3 * Math.max(0, Math.sin(t * 1.3 + 1)) : -0.25, 0, -0.1); set(m.elbows[L], -0.7);
      break;
    }
    case 'stoke': case 'bake': case 'fork': case 'stir': case 'dip': case 'pour': case 'draw': case 'feed': case 'sweep': {
      // ferramenta longa nas duas mãos: empurra/puxa baixo à frente
      const f = { stoke: 1.8, bake: 1.5, fork: 2.2, stir: 3.2, dip: 1.4, pour: 1.2, draw: 1.6, feed: 1.4, sweep: 2.6 }[gesture];
      const w = Math.sin(t * f), side = gesture === 'sweep' || gesture === 'stir' ? Math.cos(t * f) * 0.25 : 0;
      set(m.torso, 0.24 + 0.08 * w, side * 0.6, 0);
      set(m.arms[R], -0.85 - 0.3 * w, 0, 0.1 + side); set(m.elbows[R], -0.6 + 0.25 * w);
      set(m.arms[L], -0.65 - 0.25 * w, 0, -0.2 + side); set(m.elbows[L], -0.9);
      break;
    }
    case 'lift': case 'load': case 'unload': { // abaixa, pega/põe a carga, levanta
      const k = Math.max(0, Math.sin(t * 1.3));
      set(m.torso, 0.15 + 0.55 * k);
      set(m.arms[R], -0.9 - 0.2 * k, 0, 0.15); set(m.elbows[R], -0.5);
      set(m.arms[L], -0.9 - 0.2 * k, 0, -0.15); set(m.elbows[L], -0.5);
      break;
    }
    case 'carry': // andando com a carga nos dois braços
      set(m.arms[R], -0.75, 0, 0.12); set(m.elbows[R], -1.0);
      set(m.arms[L], -0.75, 0, -0.12); set(m.elbows[L], -1.0);
      break;
    case 'read': // livro aberto na frente do peito
      set(m.head, 0.3 + 0.03 * s);
      set(m.arms[R], -0.75, 0, -0.1); set(m.elbows[R], -1.5);
      set(m.arms[L], -0.75, 0, 0.1); set(m.elbows[L], -1.5);
      break;
    case 'write': { // pena no papel
      const w = Math.sin(t * 7) * 0.06;
      set(m.torso, 0.3); set(m.head, 0.25);
      set(m.arms[R], -0.9 + w, 0, -0.05); set(m.elbows[R], -1.0 - w);
      set(m.arms[L], -0.8, 0, 0.15); set(m.elbows[L], -1.0);
      break;
    }
    case 'pray': // mãos juntas, cabeça baixa
      set(m.head, 0.35); set(m.torso, 0.12);
      set(m.arms[R], -0.9, 0, -0.3); set(m.elbows[R], -1.7);
      set(m.arms[L], -0.9, 0, 0.3); set(m.elbows[L], -1.7);
      break;
    case 'preach': { // braços abertos para os fiéis
      const k = 0.5 + 0.5 * Math.sin(t * 0.9);
      set(m.head, -0.08);
      set(m.arms[R], -1.0 - 0.5 * k, 0, 0.7); set(m.elbows[R], -0.5);
      set(m.arms[L], -1.0 - 0.5 * k, 0, -0.7); set(m.elbows[L], -0.5);
      break;
    }
    default:
      break;
  }
}
