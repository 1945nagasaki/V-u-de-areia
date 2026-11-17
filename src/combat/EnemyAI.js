import { STATE } from './CombatStates.js';

/**
 * IA de combate. Usa a MESMA CombatEntity e as MESMAS skills do jogador:
 * a IA só decide (qual skill, para onde andar); quem executa é a entidade.
 *
 * Comportamento:
 *  - sem alvo no raio de aggro (ou longe demais do posto): volta para o posto;
 *  - escolhe a skill pela situação, a cada `think` s:
 *      colado + vida baixa ou cercada → Golpe Giratório
 *      corpo a corpo                   → Combo (continua o combo se o alvo segue perto)
 *      longe (dashRange)               → Investida
 *      bem longe (shockwaveRange)      → Onda de Choque
 *  - tudo em recarga: circula o alvo de lado (strafe) na distância tática,
 *    trocando de lado de tempos em tempos, em vez de ficar parada;
 *  - o STARTUP de toda skill é o aviso (o lado da renderização faz a arma e
 *    o corpo brilharem enquanto `entity.state === STARTUP`).
 *
 * Saída por quadro: `intent` = { mx, mz, speed, faceX, faceZ } (movimento
 * desejado, normalizado, e para onde olhar), aplicado pelo corpo do inimigo.
 *
 * @example
 *   const ai = new EnemyAI(entity, MELEE.ai, { home: { x, z }, random: Math.random, walk: 1.6, run: 3.6 });
 *   const intent = ai.update(dt, world, playerEntity);
 *   body.walk(intent.mx, intent.mz, intent.speed, dt);
 */
export class EnemyAI {
  constructor(entity, cfg, { home, random = Math.random, walk = 1.6, run = 3.6 }) {
    this.e = entity;
    this.cfg = cfg;
    this.home = home;
    this.random = random;
    this.walkSpeed = walk;
    this.runSpeed = run;
    this.thinkT = random() * cfg.think;
    this.strafeSide = random() < 0.5 ? -1 : 1;
    this.strafeT = this.nextStrafe();
    this.mode = 'idle'; // idle | return | approach | strafe | attack
    this.lastChoice = null;
    this.intent = { mx: 0, mz: 0, speed: 0, faceX: entity.facing.x, faceZ: entity.facing.z };
  }

  nextStrafe() {
    const [a, b] = this.cfg.strafeSwitch;
    return a + this.random() * (b - a);
  }

  /** Inimigos (do ponto de vista desta entidade) colados nela. */
  hostilesNear(world, r) {
    let n = 0;
    for (const o of world.entities) {
      if (o.alive && o.team !== this.e.team && (o.pos.x - this.e.pos.x) ** 2 + (o.pos.z - this.e.pos.z) ** 2 < r * r) n++;
    }
    return n;
  }

  /**
   * Decide a skill para a distância/vida/cerco atuais (sem usar: só escolhe).
   * @returns {string|null} id da skill, ou null (nenhuma serve agora)
   */
  choose(world, dist) {
    const c = this.cfg, e = this.e, now = world.time;
    const ready = (id) => e.skills.get(id)?.ready(now);
    const ww = e.skills.get('whirlwind');
    const low = e.health / e.maxHealth <= c.whirlwindHealth;
    const surrounded = this.hostilesNear(world, ww ? ww.range : 2.8) >= c.surroundedCount;
    if (ready('whirlwind') && dist <= (ww?.range ?? 2.8) - 0.3 && (low || surrounded)) return 'whirlwind';
    if (ready('combo') && dist <= c.comboRange) return 'combo';
    if (ready('dash') && dist >= c.dashRange[0] && dist <= c.dashRange[1]) return 'dash';
    if (ready('shockwave') && dist >= c.shockwaveRange[0] && dist <= c.shockwaveRange[1]) return 'shockwave';
    return null;
  }

  /** Algum golpe útil está pronto (se não, strafe)? */
  anyReady(world) {
    for (const s of this.e.skills.values()) if (s.ready(world.time)) return true;
    return false;
  }

  /**
   * Um quadro.
   * @param {object} target entidade alvo (o jogador)
   */
  update(dt, world, target) {
    const e = this.e, c = this.cfg, it = this.intent;
    it.mx = 0; it.mz = 0; it.speed = 0;
    if (!e.alive) { this.mode = 'dead'; return it; }
    const dx = target.pos.x - e.pos.x, dz = target.pos.z - e.pos.z;
    const dist = Math.hypot(dx, dz) || 1e-6;
    const ux = dx / dist, uz = dz / dist;
    const homeD = Math.hypot(e.pos.x - this.home.x, e.pos.z - this.home.z);
    const engaged = target.alive && dist <= c.aggroRadius && homeD <= c.leashRadius;
    it.faceX = e.facing.x; it.faceZ = e.facing.z;

    // Mira acompanha o alvo (o STARTUP gira até ela; ACTIVE trava).
    if (engaged) e.aimAt(ux, uz);

    // No meio do combo: continua se o alvo segue no alcance (input na janela).
    if (e.skill?.id === 'combo' && (e.state === STATE.ACTIVE || e.state === STATE.RECOVERY) && engaged && dist <= c.comboRange + 0.6) {
      if (this.random() < 0.9) e.useSkill('combo', world);
    }
    if (!e.canMove) { this.mode = e.fsm.attacking ? 'attack' : this.mode; return it; }

    if (!engaged) {
      if (homeD > 1.5) {
        this.mode = 'return';
        it.mx = (this.home.x - e.pos.x) / homeD; it.mz = (this.home.z - e.pos.z) / homeD; it.speed = this.walkSpeed;
        it.faceX = it.mx; it.faceZ = it.mz;
      } else this.mode = 'idle';
      return it;
    }

    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = c.think;
      const id = this.choose(world, dist);
      if (id) {
        e.body.face(ux, uz); // começa virada para o alvo
        if (e.useSkill(id, world)) { this.mode = 'attack'; this.lastChoice = id; return it; }
      }
    }

    // Andar: aproxima se o combo está pronto; senão (golpes em recarga) strafe na distância tática.
    if (e.skills.get('combo')?.ready(world.time) && dist > c.comboRange * 0.85) {
      this.mode = 'approach';
      it.mx = ux; it.mz = uz; it.speed = dist > 4 ? this.runSpeed : this.walkSpeed;
    } else {
      this.mode = 'strafe';
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeSide *= -1; this.strafeT = this.nextStrafe(); }
      const [near, far] = c.strafeDistance;
      // Lateral (perpendicular ao alvo) + correção para ficar na faixa de distância.
      const radial = dist < near ? -1 : dist > far ? 1 : 0;
      let mx = -uz * this.strafeSide + ux * radial * 0.8, mz = ux * this.strafeSide + uz * radial * 0.8;
      const l = Math.hypot(mx, mz) || 1;
      it.mx = mx / l; it.mz = mz / l; it.speed = this.walkSpeed;
    }
    // Olha sempre para o alvo durante o combate (anda de lado/de costas se precisar).
    it.faceX = ux; it.faceZ = uz;
    return it;
  }
}
