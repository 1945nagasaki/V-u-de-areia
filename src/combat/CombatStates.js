/**
 * Estados de combate e as ÚNICAS transições permitidas.
 *
 *   IDLE ⇄ MOVING
 *   IDLE/MOVING → STARTUP → ACTIVE → RECOVERY → IDLE      (um golpe/skill)
 *   RECOVERY → STARTUP                                     (próximo golpe do combo, só se a skill deixar)
 *   IDLE/MOVING/RECOVERY → DODGE → IDLE                    (esquiva: o único cancelamento intencional)
 *   qualquer vivo → STUNNED → IDLE                         (levou golpe; interrompe o ataque)
 *   qualquer → DEAD                                        (fim)
 *
 * Sem STARTUP → STARTUP (duas skills ao mesmo tempo), sem atacar atordoado,
 * sem esquivar no meio do golpe (STARTUP/ACTIVE).
 *
 * @example
 *   const fsm = new CombatFSM();
 *   fsm.canEnter(STATE.STARTUP); // true (está em IDLE)
 *   fsm.enter(STATE.STARTUP);
 *   fsm.canEnter(STATE.STARTUP); // false: já está atacando
 */
export const STATE = Object.freeze({
  IDLE: 'IDLE',
  MOVING: 'MOVING',
  STARTUP: 'STARTUP',
  ACTIVE: 'ACTIVE',
  RECOVERY: 'RECOVERY',
  DODGE: 'DODGE',
  STUNNED: 'STUNNED',
  DEAD: 'DEAD',
});

const S = STATE;
/** De → para. */
export const TRANSITIONS = Object.freeze({
  [S.IDLE]: [S.MOVING, S.STARTUP, S.DODGE, S.STUNNED, S.DEAD],
  [S.MOVING]: [S.IDLE, S.STARTUP, S.DODGE, S.STUNNED, S.DEAD],
  [S.STARTUP]: [S.ACTIVE, S.STUNNED, S.DEAD],
  [S.ACTIVE]: [S.RECOVERY, S.STUNNED, S.DEAD],
  [S.RECOVERY]: [S.IDLE, S.MOVING, S.STARTUP, S.DODGE, S.STUNNED, S.DEAD],
  [S.DODGE]: [S.IDLE, S.MOVING, S.STUNNED, S.DEAD],
  [S.STUNNED]: [S.IDLE, S.STUNNED, S.DEAD],
  [S.DEAD]: [S.IDLE], // só pelo respawn (revive)
});

/** Estados em que a entidade está ocupada com um golpe. */
export const ATTACKING = new Set([S.STARTUP, S.ACTIVE, S.RECOVERY]);
/** Estados em que pode andar livremente. */
export const FREE = new Set([S.IDLE, S.MOVING]);

export class CombatFSM {
  constructor() {
    this.state = S.IDLE;
    /** s no estado atual. */
    this.time = 0;
    this.prev = null;
    /** @type {((from: string, to: string) => void) | null} */
    this.onChange = null;
  }

  /** A transição é permitida a partir do estado atual? */
  canEnter(to) {
    return TRANSITIONS[this.state].includes(to);
  }

  /**
   * Muda de estado se for permitido.
   * @returns {boolean} false = recusado (o estado não muda)
   */
  enter(to) {
    if (!this.canEnter(to)) return false;
    this.prev = this.state;
    this.state = to;
    this.time = 0;
    this.onChange?.(this.prev, to);
    return true;
  }

  /** Avança o relógio do estado. */
  tick(dt) {
    this.time += dt;
  }

  is(s) { return this.state === s; }
  get attacking() { return ATTACKING.has(this.state); }
  get free() { return FREE.has(this.state); }
  get dead() { return this.state === S.DEAD; }
}
