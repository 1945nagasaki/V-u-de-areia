import * as THREE from 'three';
import { STATE } from '../CombatStates.js';

const S = STATE;

/**
 * Animação de combate para modelos com AnimationMixer (GLTF/FBX com clipes).
 *
 * Cada clipe de golpe é dividido por marcas de impacto [início, fim] (fração
 * do clipe): antes = antecipação, entre = corte, depois = volta. Em cada fase
 * a velocidade do clipe é ajustada para o trecho caber EXATAMENTE no tempo da
 * fase da skill — o golpe visual sai junto com a hitbox, mesmo mudando os
 * tempos na config. Entrada com `crossFadeTo` (0,1–0,15 s); hitstop congela
 * (timeScale 0) e volta.
 *
 * @example
 *   const anim = new MixerCombatAnimator(mixer, gltf.animations, {
 *     map: { slashRight: 'Attack1', slashLeft: 'Attack2', overhead: 'Attack3', thrust: 'Stab', spin: 'Spin',
 *            idle: 'Idle', move: 'Run', stunned: 'Hit', dead: 'Death', dodge: 'Roll' },
 *     marks: { Attack1: [0.35, 0.55] },  // opcional; padrão [0.35, 0.55]
 *     fade: 0.12,
 *   });
 *   // no loop: anim.update(entity, dt)  (chama mixer.update)
 */
export class MixerCombatAnimator {
  constructor(mixer, clips, { map, marks = {}, fade = 0.12, defaultMarks = [0.35, 0.55] }) {
    this.mixer = mixer;
    this.map = map;
    this.marks = marks;
    this.fade = fade;
    this.defaultMarks = defaultMarks;
    this.clips = new Map(clips.map((c) => [c.name, c]));
    this.current = null;
    this.key = null;
    this.prevState = null;
  }

  action(name) {
    const clip = this.clips.get(this.map[name]);
    return clip ? this.mixer.clipAction(clip) : null;
  }

  /** Troca para `next` com crossfade (sem cortar seco). */
  play(next, { loop = true, time = 0 } = {}) {
    if (!next || next === this.current) return next;
    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;
    next.time = time;
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.play();
    if (this.current) this.current.crossFadeTo(next, this.fade, false);
    this.current = next;
    return next;
  }

  /**
   * Velocidade para o trecho da fase atual caber no tempo da fase.
   * @returns {number} timeScale
   */
  phaseScale(entity, clip) {
    const [m0, m1] = this.marks[clip.name] ?? this.defaultMarks;
    const D = clip.duration, p = entity.phase;
    const seg = entity.state === S.STARTUP ? m0 * D : entity.state === S.ACTIVE ? (m1 - m0) * D : (1 - m1) * D;
    const dur = entity.state === S.STARTUP ? p.startup : entity.state === S.ACTIVE ? p.active : p.recovery;
    return dur > 1e-6 ? seg / dur : 1;
  }

  update(entity, dt) {
    const st = entity.state;
    if (st !== this.prevState) {
      this.prevState = st;
      if (st === S.STARTUP) {
        const a = this.action(entity.skill?.animation?.());
        this.key = entity.skill?.animation?.();
        this.play(a, { loop: false });
      } else if (st === S.ACTIVE || st === S.RECOVERY) {
        // Garante o ponto exato da marca ao trocar de fase (sem desvio acumulado).
        const a = this.current, clip = a?.getClip();
        if (clip) {
          const [m0, m1] = this.marks[clip.name] ?? this.defaultMarks;
          a.time = (st === S.ACTIVE ? m0 : m1) * clip.duration;
        }
      } else if (st === S.IDLE || st === S.MOVING) this.play(this.action(st === S.MOVING ? 'move' : 'idle'));
      else if (st === S.STUNNED) this.play(this.action('stunned'), { loop: false });
      else if (st === S.DODGE) this.play(this.action('dodge'), { loop: false });
      else if (st === S.DEAD) this.play(this.action('dead'), { loop: false });
    }
    const a = this.current;
    if (a) {
      const attacking = st === S.STARTUP || st === S.ACTIVE || st === S.RECOVERY;
      const ts = entity.hitstop > 0 ? 0 : attacking ? this.phaseScale(entity, a.getClip()) : 1;
      a.setEffectiveTimeScale(ts);
    }
    this.mixer.update(dt);
  }
}
