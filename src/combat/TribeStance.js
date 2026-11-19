/**
 * Postura de uma tribo diante do jogador (pura: só números e regras; a cena
 * e os guerreiros ficam no TribeController).
 *
 * - `hostile`: o bando pode atacar agora?
 * - `alert`:   o bando inteiro converge para o jogador, esteja onde estiver
 *              dentro da coleira (sem esperar vê-lo de perto).
 * - `update` devolve eventos de uma vez só: 'warn' (chegou à margem),
 *   'spotted' (a luta começou), 'calm' (a tribo voltou à paz).
 *
 * @example
 *   const s = new TribeStance('brasaViva', TRIBE_BEHAVIOR.tribes.brasaViva, { x, z, radius });
 *   const evt = s.update(now, player.position); // 'warn' | 'spotted' | 'calm' | null
 *   ai.hostile = () => s.hostile(now);
 */
export class TribeStance {
  /**
   * @param {string} id
   * @param {object} cfg item de TRIBE_BEHAVIOR.tribes
   * @param {{ x: number, z: number, radius: number }} village
   */
  constructor(id, cfg, village) {
    this.id = id;
    this.cfg = cfg;
    this.rule = cfg.rule;
    this.village = village;
    this.grudgeUntil = -Infinity;
    this.revealed = false; // emboscada já saiu
    this.inside = false;
    this.warned = false;
    this.wasHostile = false;
    this.seen = false; // algum guerreiro viu o jogador (onSight)
  }

  /** Distância do jogador ao centro da vila. */
  dist(p) { return Math.hypot(p.x - this.village.x, p.z - this.village.z); }

  /** Alguém feriu um membro da tribo: o bando caça o jogador por `grudge` s. */
  provoke(now) {
    this.grudgeUntil = Math.max(this.grudgeUntil, now + (this.cfg.grudge ?? 120));
    if (this.rule === 'ambush') this.revealed = true;
  }

  /** Emboscada disparada (chegou perto de um escondido ou pisou num laço). */
  reveal(now) {
    if (this.rule !== 'ambush') return;
    this.revealed = true;
    this.provoke(now);
  }

  hostile(now) {
    const grudge = now < this.grudgeUntil;
    switch (this.rule) {
      case 'onSight': return true;
      case 'territorial': return this.inside || grudge;
      case 'provoked': return grudge;
      case 'ambush': return this.revealed && grudge;
      default: return false;
    }
  }

  /** Bando inteiro converge (não só quem estiver no raio de visão). */
  alert(now) {
    switch (this.rule) {
      case 'onSight': return this.inside || this.seen;
      case 'territorial':
      case 'provoked':
      case 'ambush': return this.hostile(now);
      default: return false;
    }
  }

  /**
   * Um passo da postura.
   * @param {number} now relógio do combate (s)
   * @param {{x:number,z:number}} p posição do jogador
   * @returns {'warn'|'spotted'|'calm'|null}
   */
  update(now, p) {
    const d = this.dist(p), R = this.village.radius;
    const wasInside = this.inside;
    this.inside = d <= R;
    // Territorial: entrar começa a rixa (ao sair, ainda perseguem por `grudge` s).
    if (this.rule === 'territorial' && this.inside && !wasInside) this.provoke(now);
    if (this.rule === 'ambush' && this.revealed && now >= this.grudgeUntil) this.revealed = false; // volta a se esconder
    let evt = null;
    if (this.cfg.warnMargin && !this.inside && d <= R + this.cfg.warnMargin) {
      if (!this.warned) { this.warned = true; evt = 'warn'; }
    } else if (d > R + (this.cfg.warnMargin ?? 0) + 30) this.warned = false;
    const h = this.hostile(now) && (this.rule !== 'onSight' || this.inside || this.seen);
    if (h && !this.wasHostile) evt = 'spotted';
    else if (!h && this.wasHostile) evt = 'calm';
    this.wasHostile = h;
    if (!this.inside && d > R + 60) this.seen = false;
    return evt;
  }
}
