import * as THREE from 'three';
import { MELEE } from '../config/meleeCombat.js';
import { MOVE_SUBSTEP } from '../config/physics.js';
import { CombatWorld } from '../combat/CombatWorld.js';
import { CombatEntity } from '../combat/CombatEntity.js';
import { createSkills } from '../combat/Skill.js';
import { STATE } from '../combat/CombatStates.js';
import { Duelist } from '../combat/Duelist.js';
import { HumanoidCombatAnimator } from '../combat/anim/HumanoidCombatAnimator.js';
import { CombatFeel } from '../combat/render/CombatFeel.js';
import { TribeController } from './TribeController.js';

/**
 * Liga o combate corpo a corpo (src/combat) ao jogo:
 *  - o jogador vira uma CombatEntity (posição/frente do Player, vida do PlayerState);
 *  - teclas → skills (só com "Mãos Livres");
 *  - alvos passivos = tudo que já apanhava do soco (NPCs, boneco, animais, caçadores):
 *    lidos do registro do `Combat` antigo, sem mexer nessas classes;
 *  - paredes (CollisionWorld) param projétil e golpe atrás de parede;
 *  - arena de treino com Duelistas (IA) perto de Renascimento.
 *
 * Ordem no quadro (Game.update):
 *   handleInput(input)  → antes do player.update (aciona skills, trava o movimento)
 *   player.update(...)   → anda + animação base
 *   update(dt)           → combate (fases, hitboxes, projéteis), IA, poses de golpe, efeitos
 *
 * @example
 *   this.melee = new MeleeController(this);
 *   // loop:
 *   this.melee.handleInput(input, { busy });
 *   this.player.update(dt, input, this.cameraRig);
 *   this.melee.update(dt);
 */
export class MeleeController {
  /** @param {import('../core/Game.js').Game} game */
  constructor(game) {
    this.game = game;
    this.cfg = MELEE;
    this.world = new CombatWorld({ feel: MELEE.feel });
    this.world.blocked = (ax, ay, az, bx, by, bz) => this.blocked(ax, az, bx, bz);
    this._passive = [];
    this._adapters = new Map();
    this._dir = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._wp = new THREE.Vector3();
    this.world.passiveTargets = () => this._passive;
    this.duelists = [];

    // ---- jogador
    const P = MELEE.player, player = game.player;
    const body = {
      pos: player.position,
      facing: player.facing,
      move: (dx, dz) => { if (!player.flying && !player.climbing) game.collisions.move(player.position, dx, dz, P.radius, MOVE_SUBSTEP); },
      face: (x, z) => { this._dir.set(x, 0, z); if (this._dir.lengthSq() > 1e-8) player.faceDirection(this._dir); },
    };
    this.player = new CombatEntity({
      name: 'Você', team: P.team, body, health: game.state.maxHealth, radius: P.radius, height: P.height,
      hitstun: P.hitstun, dodge: P.dodge, knockbackDamp: MELEE.feel.knockbackDamp, heavyHitstun: MELEE.feel.heavyHitstun, turnRate: P.turnRate,
      hooks: {
        // A vida é a do PlayerState: o dano passa pelo caminho normal (morte, mensagens, ferimentos).
        damage: (amount, hit) => { game.damagePlayer(amount, hit.attacker?.name ?? 'golpe'); return game.dead ? 0 : game.state.health; },
      },
    });
    for (const s of createSkills(MELEE.skills)) this.player.addSkill(s);
    // O clique de combo também empurra objetos soltos (caixas, potes) como o soco antigo.
    this.player.skills.get('combo').onExecute = () => {
      const g = this.game;
      if (g.areaId === 'overworld') g.physics?.punch(g.player.punchOrigin(), g.player.facing);
      if (g.cameraRig.isFirstPerson) g.fpArm.punch(0.3);
    };
    this.world.add(this.player);
    this.playerAnim = new HumanoidCombatAnimator(player.model);

    // ---- efeitos
    this.feel = new CombatFeel({ scene: game.scene, world: this.world, cfg: MELEE, shake: (m) => game.cameraRig.shake(m, MELEE.feel.shake.decay) });
    this.feel.track(this.player, player.model);
    this.feel.setArmed(this.player, false);

    this.world.on('hit', (a, t, info) => {
      if (a === this.player) game.ui.showHit(`${info.skill === 'combo' ? 'Golpe' : this.player.skills.get(info.skill)?.name ?? 'Golpe'}: ${t.name ?? 'alvo'}${t.maxHealth ? ` · ${Math.max(0, Math.round(t.health))}/${t.maxHealth}` : ''}`, true);
    });
    this.world.on('death', (e) => { if (e.team === 'enemy') game.ui.toast(`${e.name} caiu. Volta em ${MELEE.duelist.respawn} s.`); });
    this.setupArena();
    // Bandos das sete capitais: cada tribo com sua regra para forasteiros (config/tribeBehavior.js).
    this.tribes = new TribeController(this);
  }

  // ------------------------------------------------------------ arena
  setupArena() {
    const A = MELEE.arena, v = this.game.villages?.[A.village];
    if (!v) return;
    const cx = v.x + A.offset[0], cz = v.z + A.offset[1];
    this.arena = { x: cx, z: cz };
    const g = this.game;
    // Marca no chão: anel de estacas (a arena só aparece como lugar; nada de colisão grande).
    const ring = new THREE.Group();
    ring.name = 'arena-treino';
    const stakeGeo = new THREE.CylinderGeometry(0.06, 0.08, 1.1, 6);
    const stakeMat = new THREE.MeshStandardMaterial({ color: 0x5a3c22, roughness: 0.9 });
    const n = 20;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, x = cx + Math.sin(a) * A.radius, z = cz + Math.cos(a) * A.radius;
      const s = new THREE.Mesh(stakeGeo, stakeMat);
      s.position.set(x, g.groundHeight(x, z) + 0.5, z);
      s.castShadow = true;
      ring.add(s);
    }
    g.scene.add(ring);
    for (let i = 0; i < A.duelists; i++) {
      const a = (i / A.duelists) * Math.PI * 2 + 0.6;
      const d = new Duelist({
        cfg: MELEE, x: cx + Math.sin(a) * A.radius * 0.45, z: cz + Math.cos(a) * A.radius * 0.45,
        groundAt: (x, z, y) => g.groundHeight(x, z, y), collisions: g.collisions, random: g.random?.bind(g) ?? Math.random,
      });
      d.entity.name = `${MELEE.duelist.name} ${i + 1}`;
      g.scene.add(d.root);
      this.world.add(d.entity);
      this.feel.track(d.entity, d.model, { telegraph: true });
      this.duelists.push(d);
    }
  }

  // ------------------------------------------------------------ alvos e paredes
  /** Alvos passivos perto do jogador: o registro do soco antigo, adaptado (cilindro + onHit). */
  refreshPassive() {
    const out = this._passive;
    out.length = 0;
    const p = this.game.player.position;
    for (const t of this.game.combat.targets.values()) {
      if (!t.enabled() || !t.object.visible) continue;
      t.object.getWorldPosition(this._wp);
      if ((this._wp.x - p.x) ** 2 + (this._wp.z - p.z) ** 2 > MELEE.feel.passiveRadius ** 2) continue;
      let a = this._adapters.get(t);
      if (!a) {
        const dir = new THREE.Vector3(), point = new THREE.Vector3();
        a = {
          name: t.name, team: 'neutral', object: t.object, x: 0, y: 0, z: 0,
          radius: t.object.userData.hitRadius ?? 0.45, height: t.object.userData.hitHeight ?? 1.8,
          get alive() { return t.enabled() && t.object.visible; },
          takeHit(hit) {
            dir.set(hit.dirX, 0, hit.dirZ);
            point.set(a.x, a.y + 1.2, a.z);
            t.onHit?.({ name: t.name, distance: 1, point, direction: dir, damage: hit.damage, target: t });
            return true;
          },
        };
        this._adapters.set(t, a);
      }
      // Alvos com caixa de acerto no meio do corpo (boneco): pés = centro − meia altura.
      a.x = this._wp.x; a.z = this._wp.z;
      a.y = t.object.userData.hitCentered ? this._wp.y - a.height / 2 : this._wp.y;
      out.push(a);
    }
  }

  /** Parede entre dois pontos (amostra o CollisionWorld a cada `feel.wallStep` m). @returns fração 0..1 ou -1 */
  blocked(ax, az, bx, bz) {
    const c = this.game.collisions;
    const L = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(L / MELEE.feel.wallStep));
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      if (c.overlaps(ax + (bx - ax) * u, az + (bz - az) * u, 0)) return u;
    }
    return -1;
  }

  // ------------------------------------------------------------ jogador
  /** Pode lutar agora (Mãos Livres, no chão, sem barco/voo/água)? */
  canFight() {
    const g = this.game, pl = g.player;
    return !g.dead && g.inventory.maosLivres && !pl.flying && !pl.swimming && !pl.climbing && !g.boat?.busy;
  }

  /**
   * Teclas e cliques de combate. Chamar ANTES do player.update.
   * O clique esquerdo do combo chega por `combo()` (o Game decide antes se é conversar/usar item).
   */
  handleInput(input, { busy = false } = {}) {
    const g = this.game, e = this.player, K = MELEE.keys;
    if (input.pressed(MELEE.debugKey)) g.ui.toast(`Hitbox de debug: ${this.feel.toggleDebug() ? 'ligada' : 'desligada'}`);
    if (input.pressed(MELEE.slowMoKey)) {
      g.timeScale = (g.timeScale ?? 1) === 1 ? MELEE.slowMo : 1;
      g.ui.toast(g.timeScale === 1 ? 'Velocidade normal' : `Câmera lenta: ${g.timeScale}×`);
    }
    if (!busy && this.canFight()) {
      const fwd = g.cameraRig.forward(this._fwd);
      if (input.secondaryPressed?.()) this.use('shockwave', fwd);
      if (input.pressed(K.dash)) this.use('dash', fwd);
      if (input.pressed(K.whirlwind)) this.use('whirlwind', fwd);
      if (input.pressed(K.dodge)) {
        // Direção da esquiva: WASD relativo à câmera; sem tecla, para trás.
        let x = 0, z = 0;
        if (input.isDown('KeyW')) { x += fwd.x; z += fwd.z; }
        if (input.isDown('KeyS')) { x -= fwd.x; z -= fwd.z; }
        if (input.isDown('KeyD')) { x += -fwd.z; z += fwd.x; }
        if (input.isDown('KeyA')) { x -= -fwd.z; z -= fwd.x; }
        e.dodge(x, z, this.world);
      }
    }
    // Atacando/esquivando/atordoado: o controle não move o corpo.
    g.player.combatLock = e.alive && !e.canMove;
  }

  /** Clique esquerdo com Mãos Livres (fora de conversa): golpe do combo. @returns {boolean} */
  combo() {
    if (!this.canFight()) return false;
    return this.use('combo', this.game.cameraRig.forward(this._fwd));
  }

  /** Usa uma skill na direção da câmera (o corpo vira na hora; o STARTUP ainda ajusta). */
  use(id, dir) {
    const e = this.player;
    const fresh = !e.skill;
    if (fresh && e.canMove) e.body.face(dir.x, dir.z);
    e.aimAt(dir.x, dir.z);
    const ok = e.useSkill(id, this.world);
    if (ok) this.feel.setArmed(e, true);
    else if (fresh && e.skills.get(id) && !e.skills.get(id).ready(this.world.time) && id !== 'combo') {
      this.game.ui.showHit(`${e.skills.get(id).name}: recarga ${e.skills.get(id).remaining(this.world.time).toFixed(1)} s`, false);
    }
    return ok;
  }

  // ------------------------------------------------------------ quadro
  /** Combate + IA + poses + efeitos. Chamar DEPOIS do player.update. */
  update(dt) {
    const g = this.game, e = this.player;
    const here = g.areaId === 'overworld';
    // Vida da entidade espelha a do PlayerState (poção, comida, respawn…).
    e.health = g.state.health; e.maxHealth = g.state.maxHealth;
    if (g.dead && e.alive) e.fsm.enter(STATE.DEAD);
    if (!g.dead && !e.alive) e.revive();
    e.setMoving(g.player.speed > 0.2);
    this.refreshPassive();

    // Duelistas só existem perto da arena.
    const near = here && this.arena && Math.hypot(g.player.position.x - this.arena.x, g.player.position.z - this.arena.z) < MELEE.arena.activeRadius;
    for (const d of this.duelists) {
      d.root.visible = near;
      if (near) d.update(dt, this.world, e);
    }
    // Bandos das capitais (IA e postura de cada tribo) antes das fases dos golpes.
    this.tribes.update(dt);
    // Fases dos golpes, hitboxes e projéteis de todos (entidades longe ficam paradas: sem IA, sem golpe).
    this.world.update(dt);

    // Pose de golpe do jogador por cima da animação base (andar/parado) do Player.update.
    const armed = this.canFight() && this.world.time - e.lastCombatAt < MELEE.player.holsterAfter;
    if (!armed && !e.skill) this.feel.setArmed(e, false);
    if (!g.player.flying && !g.player.swimming) this.playerAnim.apply(e, dt, { armed: armed || !!e.skill });
    this.feel.update(dt);
  }
}
