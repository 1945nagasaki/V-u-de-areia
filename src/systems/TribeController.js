import * as THREE from 'three';
import { TRIBE_BEHAVIOR } from '../config/tribeBehavior.js';
import { MELEE } from '../config/meleeCombat.js';
import { TribeStance } from '../combat/TribeStance.js';
import { Duelist } from '../combat/Duelist.js';
import { makeMask, makeEmblem, makeShield } from '../combat/render/TribeGear.js';

/**
 * Os bandos de guerreiros das sete capitais e o comportamento de cada tribo
 * com o jogador (regras em config/tribeBehavior.js, postura em TribeStance).
 *
 * - Cada bando nasce só quando o jogador chega perto da capital (nada a mais no
 *   carregamento) e só age/aparece perto dela.
 * - Guerreiros = Duelist (CombatEntity + skills + EnemyAI) com a aparência da
 *   tribe (máscara, arma, cores, corpo) e a IA ligada à postura da tribo.
 * - Provocação: qualquer golpe (combo, soco, arma do inventário) num morador da
 *   capital chega por `onAssault`; golpe num guerreiro, pelo evento 'hit'.
 * - Espelho-Turvo: guerreiros escondidos (invisíveis e fora do combate) e laços
 *   no chão; a emboscada revela quem estiver perto.
 * - Começou a luta: moradores perto do jogador fogem.
 *
 * @example
 *   this.tribes = new TribeController(meleeController);
 *   // por quadro (depois do world.update): this.tribes.update(dt)
 */
export class TribeController {
  /** @param {import('./MeleeController.js').MeleeController} melee */
  constructor(melee) {
    this.melee = melee;
    this.game = melee.game;
    this.world = melee.world;
    this.tribes = [];
    for (const [id, cfg] of Object.entries(TRIBE_BEHAVIOR.tribes)) {
      const v = this.game.villages?.[id];
      if (!v) continue;
      this.tribes.push({ id, cfg, village: v, stance: new TribeStance(id, cfg, { x: v.x, z: v.z, radius: v.radius }), warriors: [], traps: [], built: false });
    }
    this.byId = new Map(this.tribes.map((t) => [t.id, t]));
    this.world.on('hit', (a, t) => {
      if (a === melee.player && t.tribe) this.provoke(t.tribe);
    });
  }

  /** A tribe `id` foi provocada (alguém dela apanhou do jogador). */
  provoke(id) {
    const t = this.byId.get(id);
    if (t) t.stance.provoke(this.world.time);
  }

  /** Um morador (NPCAgent) foi agredido por qualquer arma: provoca a tribo da vila dele. */
  onAssault(agent) {
    const id = agent?.village?.config?.id ?? agent?.village?.id;
    if (this.byId.has(id)) this.provoke(id);
  }

  // ------------------------------------------------------------ montar o bando
  /** Postos dos guerreiros: espaços abertos da cidade (npcSpots); emboscada: na borda da mata. */
  posts(t) {
    const v = t.village, n = TRIBE_BEHAVIOR.warriors, out = [];
    if (t.cfg.rule === 'ambush') {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.4, r = v.radius * (0.78 + 0.1 * (i % 2));
        out.push({ x: v.x + Math.sin(a) * r, z: v.z + Math.cos(a) * r });
      }
      return out;
    }
    const spots = (v.npcSpots ?? []).filter((s) => Math.hypot(s.x - v.x, s.z - v.z) < v.radius * 0.8);
    for (let i = 0; i < n; i++) {
      if (spots.length) {
        const s = spots[Math.floor((i * spots.length) / n)];
        out.push({ x: s.x + (i % 2 ? 1.5 : -1.5), z: s.z });
      } else {
        const a = (i / n) * Math.PI * 2, r = v.radius * 0.3;
        out.push({ x: v.x + Math.sin(a) * r, z: v.z + Math.cos(a) * r });
      }
    }
    return out;
  }

  build(t) {
    const g = this.game, cfg = t.cfg, D = MELEE.duelist, feel = this.melee.feel;
    t.built = true;
    const world = this.world;
    for (const post of this.posts(t)) {
      const profile = {
        name: cfg.name, team: 'enemy', respawn: TRIBE_BEHAVIOR.respawn,
        health: Math.round(D.health * cfg.health), height: cfg.height, build: cfg.build, look: cfg.look,
        skillScale: { startup: cfg.startup, damage: D.skillScale.damage * cfg.damage, cooldown: D.skillScale.cooldown },
      };
      const w = new Duelist({
        cfg: MELEE, x: post.x, z: post.z, profile,
        groundAt: (x, z, y) => g.groundHeight(x, z, y), collisions: g.collisions, random: Math.random,
        ai: { aggroRadius: cfg.sight ?? 24, leashRadius: t.village.radius + 45 },
        aiHooks: { hostile: () => t.stance.hostile(world.time), alert: () => t.stance.alert(world.time), patrol: TRIBE_BEHAVIOR.patrol },
      });
      if (cfg.mask) w.model.head.add(makeMask(cfg.mask));
      if (cfg.emblem) w.model.torso.add(makeEmblem(cfg.emblem));
      if (cfg.shield) w.model.hands[1].add(makeShield(cfg.shield));
      w.entity.tribe = t.id;
      w.root.name = `guerreiro-${t.id}`;
      g.scene.add(w.root);
      feel.track(w.entity, w.model, { telegraph: true, weapon: cfg.weapon });
      w.hidden = cfg.rule === 'ambush';
      if (!w.hidden) world.add(w.entity);
      t.warriors.push(w);
    }
    if (cfg.traps) this.buildTraps(t);
  }

  /** Laços no chão nas trilhas de chegada (Espelho-Turvo): quase invisíveis até alguém pisar. */
  buildTraps(t) {
    const v = t.village, g = this.game;
    const geo = new THREE.TorusGeometry(0.32, 0.018, 6, 18).rotateX(Math.PI / 2);
    for (let i = 0; i < t.cfg.traps; i++) {
      const a = (i / t.cfg.traps) * Math.PI * 2 + 1.1, r = v.radius * (0.9 + 0.08 * Math.sin(i * 3.1));
      const x = v.x + Math.sin(a) * r, z = v.z + Math.cos(a) * r;
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x4a3a24, roughness: 1, transparent: true, opacity: 0.35 }));
      m.position.set(x, g.groundHeight(x, z) + 0.03, z);
      m.name = 'laco-armadilha';
      g.scene.add(m);
      t.traps.push({ x, z, mesh: m, sprung: false });
    }
  }

  // ------------------------------------------------------------ quadro
  update(dt) {
    const g = this.game, now = this.world.time, p = g.player.position, ui = g.ui;
    const over = g.areaId === 'overworld' && !g.dead;
    for (const t of this.tribes) {
      const v = t.village, d = Math.hypot(p.x - v.x, p.z - v.z);
      const active = over && d < v.radius + TRIBE_BEHAVIOR.activeMargin;
      if (active && !t.built) this.build(t);
      if (!t.built) continue;
      if (active) {
        if (t.cfg.rule === 'onSight' && !t.stance.seen) t.stance.seen = this.anyoneSees(t, p);
        if (t.cfg.rule === 'ambush') this.updateAmbush(t, p, now);
        const evt = t.stance.update(now, p);
        if (evt === 'warn' && t.cfg.warn) ui.toast(t.cfg.warn);
        if (evt === 'spotted') { ui.toast(t.cfg.spotted); this.residentsFlee(t, p); }
      }
      for (const w of t.warriors) {
        const show = active && !w.hidden;
        w.root.visible = show;
        if (show) w.update(dt, this.world, this.melee.player);
        else if (!w.alive && !active) w.respawn(); // longe: o caído volta ao posto
      }
    }
  }

  /** Algum guerreiro vivo vê o jogador (raio de visão e sem parede no meio)? */
  anyoneSees(t, p) {
    for (const w of t.warriors) {
      if (!w.alive || w.hidden) continue;
      const q = w.entity.pos;
      if (Math.hypot(p.x - q.x, p.z - q.z) <= (t.cfg.sight ?? 30) && this.melee.blocked(q.x, q.z, p.x, p.z) < 0) return true;
    }
    return false;
  }

  /** Espelho-Turvo: laços prendem; chegar perto de um escondido (ou cair num laço) revela os próximos. */
  updateAmbush(t, p, now) {
    const c = t.cfg, s = t.stance;
    for (const tr of t.traps) {
      if (tr.sprung || Math.hypot(p.x - tr.x, p.z - tr.z) > 0.7) continue;
      tr.sprung = true;
      tr.mesh.material.opacity = 1;
      tr.mesh.scale.setScalar(0.6);
      this.game.player.status.apply({ pin: c.trapPin });
      this.game.ui.toast(c.trapped);
      s.reveal(now);
    }
    if (!s.revealed) {
      for (const w of t.warriors) if (w.hidden && Math.hypot(p.x - w.entity.pos.x, p.z - w.entity.pos.z) <= c.ambushRadius) { s.reveal(now); break; }
    }
    for (const w of t.warriors) {
      const dist = Math.hypot(p.x - w.entity.pos.x, p.z - w.entity.pos.z);
      if (s.revealed && w.hidden && w.alive && dist <= c.revealRadius) {
        w.hidden = false;
        this.world.add(w.entity);
        this.melee.feel.burst(w.entity.pos.x, w.entity.pos.y + 1, w.entity.pos.z, 0x4a6a2a, 16); // folhas
      } else if (!s.revealed && !w.hidden && w.ai.mode === 'idle') {
        // A emboscada acabou e ele voltou ao posto: some na mata de novo; laços rearmados.
        w.hidden = true;
        this.world.remove(w.entity);
      }
    }
    if (!s.revealed) for (const tr of t.traps) if (tr.sprung) { tr.sprung = false; tr.mesh.material.opacity = 0.35; tr.mesh.scale.setScalar(1); }
  }

  /** Começou a luta: moradores da capital perto do jogador correm para longe. */
  residentsFlee(t, p) {
    const R2 = TRIBE_BEHAVIOR.fleeRadius ** 2;
    for (const a of this.game.npcManager?.agents ?? []) {
      if (a.village !== t.village || a.life === 'DEAD' || a.down) continue;
      if ((a.pos.x - p.x) ** 2 + (a.pos.z - p.z) ** 2 < R2) a.react('FLEE', TRIBE_BEHAVIOR.fleeSeconds, p);
    }
  }
}
