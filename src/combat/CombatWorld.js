import { inCone, capsuleHitsCylinder, segmentHitsCylinder } from './Hitbox.js';

/**
 * Mundo de combate: entidades (`CombatEntity`), alvos passivos (NPCs, animais,
 * boneco — qualquer coisa com posição e `onHit`), projéteis e a resolução dos
 * acertos (dano, empurrão, hitstop). Sem cena: os efeitos visuais escutam os
 * eventos (`on('hit', fn)` …) do lado da renderização.
 *
 * Alvo = { x, y, z, radius, height, team, alive, ...}. Entidades viram alvo
 * lendo a própria posição; alvos passivos vêm de `passiveTargets()` a cada quadro.
 *
 * Eventos:
 *   'skill' (entity, skill, phase)      — mudou de fase (STARTUP/ACTIVE/RECOVERY)
 *   'hit' (attacker, target, info)      — acerto confirmado (info: { x,y,z, dirX, dirZ, damage, heavy, skill })
 *   'dodge' (entity) · 'death' (entity)
 *   'projectile' (p, 'spawn'|'hit'|'end')
 *
 * @example
 *   const world = new CombatWorld({ feel: MELEE.feel });
 *   world.add(player); world.add(enemy);
 *   world.passiveTargets = () => npcsPerto;          // opcional
 *   world.blocked = (ax,ay,az,bx,by,bz) => -1;       // opcional: parede entre dois pontos (0..1 ou -1)
 *   world.on('hit', (a, t, info) => fx.flash(t));
 *   world.update(dt);
 */
export class CombatWorld {
  constructor({ feel }) {
    this.feel = feel;
    this.time = 0;
    /** @type {import('./CombatEntity.js').CombatEntity[]} */
    this.entities = [];
    /** @returns {Array<object>} alvos passivos perto (o controlador do jogo preenche). */
    this.passiveTargets = () => EMPTY;
    /** Parede entre dois pontos? fração 0..1 do primeiro bloqueio, ou -1. */
    this.blocked = null;
    this.projectiles = [];
    this._pool = [];
    this.listeners = new Map();
    this._info = { x: 0, y: 0, z: 0, dirX: 0, dirZ: 1, damage: 0, heavy: false, skill: '', knockback: 0 };
    this._hit = { damage: 0, dirX: 0, dirZ: 0, knockback: 0, heavy: false, attacker: null, skill: '' };
  }

  add(e) { this.entities.push(e); return e; }
  remove(e) { const i = this.entities.indexOf(e); if (i >= 0) this.entities.splice(i, 1); }

  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  emit(type, a, b, c) {
    const l = this.listeners.get(type);
    if (l) for (const fn of l) fn(a, b, c);
  }

  /**
   * Quem pode acertar quem: times diferentes; o neutro (NPC, bicho, boneco)
   * só apanha do jogador — a IA não bate em morador.
   */
  canHit(att, tgt) {
    if (tgt === att || !tgt.alive || tgt.team === att.team) return false;
    return tgt.team !== 'neutral' || att.team === 'player';
  }

  /** Visita os alvos possíveis de `att` (entidades + passivos) com a forma de cilindro preenchida. */
  forTargets(att, fn) {
    for (const e of this.entities) {
      if (!this.canHit(att, e)) continue;
      const c = this._cyl ??= { x: 0, y: 0, z: 0, radius: 0, height: 0 };
      c.x = e.pos.x; c.y = e.pos.y; c.z = e.pos.z; c.radius = e.radius; c.height = e.height;
      if (fn(e, c) === false) return;
    }
    for (const p of this.passiveTargets()) {
      if (!this.canHit(att, p)) continue;
      if (fn(p, p) === false) return;
    }
  }

  /**
   * Hitbox de golpe (cone/360°) neste quadro. Cada alvo uma vez por execução (`hits`).
   * @param {object} att atacante
   * @param {{ range: number, angle: number, height?: number[] }} shape
   * @param {import('./Hitbox.js').HitOnce} hits
   * @param {{ damage: number, knockback: number, heavy?: boolean, skill?: string, radial?: boolean }} spec
   */
  meleeSweep(att, shape, hits, spec) {
    this.lastShape = shape; // para o desenho de debug
    this.forTargets(att, (t, c) => {
      if (hits.has(t) || !inCone(att.pos, att.facing, c, shape)) return;
      if (this.blocked && this.blocked(att.pos.x, att.pos.y + 1.2, att.pos.z, c.x, c.y + c.height * 0.6, c.z) >= 0) return; // parede no meio
      hits.claim(t);
      this.resolve(att, t, c, spec, c.x - att.pos.x, c.z - att.pos.z);
    });
  }

  /** Trajeto varrido (investida): cápsula do ponto anterior ao atual. */
  capsuleSweep(att, ax, az, bx, bz, width, height, hits, spec) {
    const y0 = att.pos.y + height[0], y1 = att.pos.y + height[1];
    this.forTargets(att, (t, c) => {
      if (hits.has(t) || !capsuleHitsCylinder(ax, az, bx, bz, width, y0, y1, c)) return;
      hits.claim(t);
      // Empurra para o lado de fora do trajeto + para frente.
      const sx = c.x - bx, sz = c.z - bz, side = sx * -att.facing.z + sz * att.facing.x >= 0 ? 1 : -1;
      this.resolve(att, t, c, spec, att.facing.x + -att.facing.z * side * 0.8, att.facing.z + att.facing.x * side * 0.8);
    });
  }

  /** Aplica um acerto: dano, empurrão, hitstop nos dois, evento para os efeitos. */
  resolve(att, t, c, spec, dx, dz) {
    const l = Math.hypot(dx, dz) || 1;
    const h = this._hit;
    h.damage = spec.damage; h.dirX = dx / l; h.dirZ = dz / l; h.knockback = spec.knockback;
    h.heavy = !!spec.heavy; h.attacker = att; h.skill = spec.skill ?? '';
    const landed = t.takeHit(h, this);
    if (!landed) return false;
    const stop = this.feel.hitstop * (spec.heavy ? this.feel.heavyHitstop ?? 1.6 : 1);
    if (att.hitstop !== undefined && !spec.projectile) att.hitstop = Math.max(att.hitstop, stop);
    if (t.hitstop !== undefined) t.hitstop = Math.max(t.hitstop, stop);
    const i = this._info;
    i.x = c.x; i.y = c.y + c.height * 0.6; i.z = c.z; i.dirX = h.dirX; i.dirZ = h.dirZ;
    i.damage = spec.damage; i.heavy = h.heavy; i.skill = h.skill; i.knockback = spec.knockback;
    this.emit('hit', att, t, i);
    return true;
  }

  /** Dispara um projétil (pool, sem alocar depois do aquecimento). */
  spawnProjectile(owner, o) {
    const p = this._pool.pop() ?? {};
    p.owner = owner; p.x = o.x; p.y = o.y; p.z = o.z; p.px = o.x; p.py = o.y; p.pz = o.z;
    p.dx = o.dx; p.dz = o.dz; p.speed = o.speed; p.left = o.range; p.radius = o.radius;
    p.spec ??= { damage: 0, knockback: 0, heavy: false, skill: '', projectile: true };
    p.spec.damage = o.damage; p.spec.knockback = o.knockback; p.spec.skill = o.skill;
    p.dead = false;
    this.projectiles.push(p);
    this.emit('projectile', p, 'spawn');
    return p;
  }

  /**
   * Projéteis: varredura contínua do ponto anterior ao atual em cada quadro.
   * Para no PRIMEIRO alvo do segmento (o mais perto da posição anterior) e
   * em paredes (`blocked`), então não atravessa nada, a qualquer velocidade.
   */
  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const step = Math.min(p.speed * dt, p.left);
      p.px = p.x; p.py = p.y; p.pz = p.z;
      const bx = p.x + p.dx * step, bz = p.z + p.dz * step;
      let best = 2, bestT = null, bestC = null;
      this.forTargets(p.owner, (t, c) => {
        const u = segmentHitsCylinder(p.x, p.y, p.z, bx, p.y, bz, p.radius, c);
        if (u >= 0 && u < best) {
          best = u; bestT = t;
          bestC = this._bc ??= { x: 0, y: 0, z: 0, radius: 0, height: 0 };
          bestC.x = c.x; bestC.y = c.y; bestC.z = c.z; bestC.radius = c.radius; bestC.height = c.height;
        }
      });
      const wall = this.blocked ? this.blocked(p.x, p.y, p.z, bx, p.y, bz) : -1;
      if (wall >= 0 && wall < best) {
        p.x += (bx - p.x) * wall; p.z += (bz - p.z) * wall;
        this.finish(i, 'end');
        continue;
      }
      if (bestT) {
        p.x += (bx - p.x) * best; p.z += (bz - p.z) * best;
        this.resolve(p.owner, bestT, bestC, p.spec, p.dx, p.dz);
        this.emit('projectile', p, 'hit');
        this.finish(i, null);
        continue;
      }
      p.x = bx; p.z = bz; p.left -= step;
      if (p.left <= 1e-6) this.finish(i, 'end');
    }
  }

  finish(i, evt) {
    const p = this.projectiles[i];
    p.dead = true;
    if (evt) this.emit('projectile', p, evt);
    this.projectiles.splice(i, 1);
    this._pool.push(p);
  }

  /** Um quadro de combate. */
  update(dt) {
    this.time += dt;
    for (const e of this.entities) e.update(dt, this);
    this.updateProjectiles(dt);
  }
}

const EMPTY = [];
