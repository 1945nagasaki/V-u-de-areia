import * as THREE from 'three';
import { STATE } from '../CombatStates.js';
import { MELEE_POSES } from '../../config/meleePoses.js';

const S = STATE;
const easeOut = (t) => 1 - (1 - t) ** 2;
const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a, b, t) => a + (b - a) * t;

// Temporários (sem alocar por quadro).
const DOWN = new THREE.Vector3(0, -1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _side = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qArm = new THREE.Quaternion(), _qInv = new THREE.Quaternion();
const _e = new THREE.Euler();
const _yAxis = new THREE.Vector3(0, 1, 0);

/** Pose interpolada (reaproveitada). */
function makePose() {
  return { upR: [0, -1, 0], foreR: [0, -1, 0], upL: [0, -1, 0], foreL: [0, -1, 0], torso: [0, 0, 0], head: [0, 0, 0], stance: 0, spin: 0 };
}
const DIRS = ['upR', 'foreR', 'upL', 'foreL'];
function mix(out, a, b, t) {
  for (const k of DIRS) for (let i = 0; i < 3; i++) out[k][i] = lerp(a[k][i], b[k][i], t);
  for (const k of ['torso', 'head']) for (let i = 0; i < 3; i++) out[k][i] = lerp(a[k]?.[i] ?? 0, b[k]?.[i] ?? 0, t);
  out.stance = lerp(a.stance ?? 0, b.stance ?? 0, t);
  out.spin = lerp(a.spin ?? 0, b.spin ?? 0, t);
  return out;
}
function copyPose(out, a) { return mix(out, a, a, 0); }

/**
 * Animação PROCEDURAL de combate para o `Humanoid` (boneco de juntas, sem
 * AnimationMixer). Roda DEPOIS de `humanoid.update()` e mistura, por cima da
 * pose base (andar/parado), a pose do golpe:
 *
 *   STARTUP  guarda → antecipação (puxa a arma para trás), ease-out
 *   ACTIVE   antecipação → fim do corte (arco rápido), ease-out cúbico
 *   RECOVERY fim do corte → guarda, ease-in-out
 *   DODGE / STUNNED: poses próprias; DEAD: tomba
 *
 * O tempo de cada fase vem da skill (STARTUP/ACTIVE/RECOVERY), então a animação
 * fica sempre sincronizada com a hitbox. Hitstop congela o relógio do estado,
 * e com ele a pose. Entrada e saída do golpe: crossfade de `fadeIn`/`fadeOut` s.
 * No combo, o golpe seguinte parte do fim do anterior (sem voltar à guarda).
 *
 * @example
 *   const anim = new HumanoidCombatAnimator(humanoid);
 *   // no loop, depois de humanoid.update(dt, ...):
 *   anim.apply(entity, dt, { armed: true });
 */
export class HumanoidCombatAnimator {
  constructor(humanoid, poses = MELEE_POSES) {
    this.h = humanoid;
    this.poses = poses;
    this.pose = makePose();
    this.from = makePose();
    this.chainFrom = null; // pose de onde o próximo STARTUP parte (fim do golpe anterior)
    this._last = makePose();
    this.w = 0; // peso do golpe sobre a base
    this.guardW = 0; // peso da guarda (arma em punho, fora do golpe)
    this.execT = 0;
    this.prevState = S.IDLE;
    this.deadT = 0;
  }

  /** Animação atual da skill (cai para 'slashRight' se não existir pose). */
  anim(entity) {
    const n = entity.skill?.animation?.();
    return this.poses[n]?.windup ? this.poses[n] : this.poses.slashRight;
  }

  /**
   * @param {import('../CombatEntity.js').CombatEntity} entity
   * @param {number} dt
   * @param {{ armed?: boolean, legs?: boolean }} [o] armed: segura a arma em guarda fora do golpe; legs: base de luta nas pernas
   */
  apply(entity, dt, { armed = true } = {}) {
    const P = this.poses, st = entity.state, u = entity.phaseT, out = this.pose;
    const h = this.h;
    // Troca de estado: no combo (RECOVERY → STARTUP) o golpe novo parte do fim do anterior.
    if (st !== this.prevState) {
      if (st === S.STARTUP) { this.chainFrom = this.prevState === S.RECOVERY ? copyPose(this.from, this._last) : null; if (!this.chainFrom) this.execT = 0; }
      if (st === S.DEAD) this.deadT = 0;
      this.prevState = st;
    }
    if (entity.hitstop <= 0) this.execT += dt;

    let target = 0, legs = false;
    if (st === S.STARTUP || st === S.ACTIVE || st === S.RECOVERY) {
      const A = this.anim(entity);
      if (st === S.STARTUP) mix(out, this.chainFrom ?? P.guard, A.windup, easeOut(u));
      else if (st === S.ACTIVE) mix(out, A.windup, A.strike, easeOutCubic(u));
      else mix(out, A.strike, P.guard, easeInOut(u));
      if (st === S.ACTIVE) out.spin = (A.strike.spin ?? 0) * easeOutCubic(u);
      else if (st === S.RECOVERY) out.spin = 0;
      // Crossfade: entra em fadeIn s; sai nos últimos fadeOut s do RECOVERY.
      target = Math.min(1, this.chainFrom ? 1 : this.execT / P.fadeIn);
      if (st === S.RECOVERY) {
        const left = (1 - u) * entity.phase.recovery;
        target = Math.min(target, armed ? 1 : left / P.fadeOut);
      }
      legs = true;
      copyPose(this._last, out);
      this.w = target;
    } else if (st === S.DODGE) {
      copyPose(out, P.dodge);
      this.w = Math.sin(Math.PI * Math.min(1, u)); legs = true;
    } else if (st === S.STUNNED) {
      copyPose(out, P.stunned);
      this.w = u < 0.25 ? easeOut(u / 0.25) : 1 - easeInOut((u - 0.25) / 0.75); legs = false;
    } else if (st === S.DEAD) {
      this.deadT += dt;
      const k = easeOut(Math.min(1, this.deadT / 0.55));
      h.body.rotation.x = -Math.PI / 2 * k;
      h.body.position.y = lerp(h.body.position.y, 0.16, k);
      return;
    } else {
      this.w = 0;
    }
    // Guarda com a arma em punho (andando/parado): só o tronco e os braços.
    this.guardW += ((armed ? 1 : 0) - this.guardW) * Math.min(1, dt * 8);
    if (this.w <= 0.001) {
      if (this.guardW > 0.01) { copyPose(out, P.guard); this.applyPose(out, this.guardW, false); }
      return;
    }
    // Do golpe para a guarda: o resto do peso é a guarda (arma em punho) e não a base de andar.
    if (this.guardW > 0.01 && this.w < 1) {
      mix(out, P.guard, out, this.w); // pose = guarda→golpe pelo peso
      this.applyPose(out, Math.max(this.w, this.guardW), legs);
    } else this.applyPose(out, this.w, legs);
  }

  /** Converte a pose (direções e ângulos) em quatérnios e mistura nas juntas com peso w. */
  applyPose(p, w, legs) {
    const h = this.h;
    // Tronco e cabeça.
    _q.setFromEuler(_e.set(p.torso[0], p.torso[1], p.torso[2]));
    h.torso.quaternion.slerp(_q, w);
    _q.setFromEuler(_e.set(p.head[0], p.head[1], p.head[2]));
    h.head.quaternion.slerp(_q, w);
    // Braços: índice 0 = direito (x < 0), 1 = esquerdo. Direções no referencial do tronco.
    for (let i = 0; i < 2; i++) {
      const up = i === 0 ? p.upR : p.upL, fore = i === 0 ? p.foreR : p.foreL;
      _side.set(i === 1 ? 1 : -1, 0, 0);
      _a.set(up[0], up[1], up[2]).normalize();
      // Braço: baixo → lado (fixo) → direção (giro mínimo); polo só no braço cruzando o peito na horizontal.
      _qArm.setFromUnitVectors(_side, _a).multiply(_q2.setFromUnitVectors(DOWN, _side));
      h.arms[i].quaternion.slerp(_qArm, w);
      // Antebraço: direção no referencial do braço.
      _b.set(fore[0], fore[1], fore[2]).normalize().applyQuaternion(_qInv.copy(_qArm).invert());
      _q.setFromUnitVectors(DOWN, _b);
      h.elbows[i].quaternion.slerp(_q, w);
      // Punho: lâmina levemente à frente do antebraço.
      _q.setFromEuler(_e.set(-0.35, 0, 0));
      h.hands[i].quaternion.slerp(_q, w);
    }
    // Base de luta (perna esquerda à frente) e giro do corpo inteiro.
    if (legs && p.stance > 0) {
      const s = p.stance * w;
      _q.setFromEuler(_e.set(0.32 * s, 0, 0)); h.legs[0].quaternion.multiply(_q); // direita atrás
      _q.setFromEuler(_e.set(0.42 * s, 0, 0)); h.knees[0].quaternion.multiply(_q);
      _q.setFromEuler(_e.set(-0.5 * s, 0, 0)); h.legs[1].quaternion.multiply(_q); // esquerda à frente
      _q.setFromEuler(_e.set(0.55 * s, 0, 0)); h.knees[1].quaternion.multiply(_q);
      h.body.position.y -= 0.075 * s;
    }
    if (p.spin) h.body.quaternion.multiply(_q.setFromAxisAngle(_yAxis, p.spin * Math.PI * 2 * w));
  }
}
