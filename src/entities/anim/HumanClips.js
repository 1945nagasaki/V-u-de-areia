import * as THREE from 'three';

/**
 * Clipes de corpo inteiro para o `Humanoid` (feito de peças com juntas, sem
 * malha com esqueleto). Os clipes vêm de animações reais retargetadas offline
 * (`tools/anim/retargetHuman.mjs`) e guardam, por quadro, o quatérnio LOCAL de
 * cada junta e o deslocamento do corpo (`body.position`, no espaço do corpo de
 * 1,80 m — o `Humanoid` escala junto).
 *
 * Não usa AnimationMixer: o Humanoid já tem a própria suavização entre poses
 * (slerp por junta) e o seguimento do terreno; aqui só se amostra a pose.
 *
 * Uso:
 *   const lib = await loadHumanClips(url);          // { clips: Map, loop: Map }
 *   const pose = new HumanPose();
 *   samplePose(lib.clips.get('walk'), t, pose);      // t em segundos (dá a volta se laço)
 *   applyPose(humanoid, pose, 1);                    // peso 1 = substitui a pose atual
 */

/** Juntas do Humanoid, na ordem dos arrays dele (índice 0 = lado x < 0). */
export const HUMAN_JOINTS = [
  'hips', 'torso', 'head',
  'leg0', 'leg1', 'knee0', 'knee1', 'foot0', 'foot1',
  'arm0', 'arm1', 'elbow0', 'elbow1', 'hand0', 'hand1',
];

/**
 * Mapa chave → Object3D de um Humanoid.
 * @param {import('../Humanoid.js').Humanoid} h
 */
export function jointsOf(h) {
  return {
    hips: h.hips, torso: h.torso, head: h.head,
    leg0: h.legs[0], leg1: h.legs[1], knee0: h.knees[0], knee1: h.knees[1], foot0: h.feet[0], foot1: h.feet[1],
    arm0: h.arms[0], arm1: h.arms[1], elbow0: h.elbows[0], elbow1: h.elbows[1], hand0: h.hands[0], hand1: h.hands[1],
  };
}

/** Pose amostrada: quatérnio por junta + deslocamento do corpo. */
export class HumanPose {
  constructor() {
    /** @type {Record<string, THREE.Quaternion>} */
    this.q = Object.fromEntries(HUMAN_JOINTS.map((k) => [k, new THREE.Quaternion()]));
    this.pos = new THREE.Vector3();
  }
}

const _buf = new Map();

/**
 * Pose do clipe no tempo `t` (laço: dá a volta; sem laço: para no fim).
 * @param {THREE.AnimationClip & { loop?: boolean }} clip
 * @param {number} t segundos
 * @param {HumanPose} out
 */
export function samplePose(clip, t, out) {
  const d = clip.duration || 1e-6;
  const tt = clip.userData?.loop === false ? Math.min(Math.max(0, t), d) : ((t % d) + d) % d;
  if (!clip._interp) {
    clip._interp = clip.tracks.map((tr) => {
      const [key, prop] = tr.name.split('.');
      return { key, prop, it: tr.createInterpolant() };
    });
  }
  out.pos.set(0, 0, 0);
  for (const { key, prop, it } of clip._interp) {
    const v = it.evaluate(tt);
    if (prop === 'quaternion' && out.q[key]) out.q[key].set(v[0], v[1], v[2], v[3]).normalize();
    else if (prop === 'position' && key === 'body') out.pos.set(v[0], v[1], v[2]);
  }
  return out;
}

/**
 * Mistura `b` em `a` (resultado em `out`) com peso w — slerp por junta.
 * @param {HumanPose} a @param {HumanPose} b @param {number} w @param {HumanPose} out
 */
export function blendPose(a, b, w, out) {
  for (const k of HUMAN_JOINTS) out.q[k].copy(a.q[k]).slerp(b.q[k], w);
  out.pos.lerpVectors(a.pos, b.pos, w);
  return out;
}

/** Só tronco, cabeça e braços (gesto sentado ou andando: as pernas são de outra animação). */
export const UPPER_BODY = ['torso', 'head', 'arm0', 'arm1', 'elbow0', 'elbow1', 'hand0', 'hand1'];

/**
 * Aplica a pose ao boneco com peso w (1 = substitui; <1 = mistura com a pose atual).
 * @param {import('../Humanoid.js').Humanoid} h @param {HumanPose} pose @param {number} [w]
 * @param {string[]} [mask] juntas afetadas (padrão: todas, e o corpo vai para a posição do clipe)
 */
export function applyPose(h, pose, w = 1, mask = HUMAN_JOINTS) {
  const J = h._joints ?? (h._joints = jointsOf(h));
  for (const k of mask) {
    const j = J[k];
    if (w >= 1) j.quaternion.copy(pose.q[k]);
    else j.quaternion.slerp(pose.q[k], w);
  }
  if (mask === HUMAN_JOINTS) h.body.position.lerp(pose.pos, Math.min(1, w));
}

/**
 * Lê uma biblioteca gerada pelo retarget ({ clips: AnimationClip JSON[], loop: {chave: bool} }).
 * @param {object} json
 * @returns {Map<string, THREE.AnimationClip>}
 */
export function parseHumanClips(json) {
  const m = new Map();
  for (const c of json.clips) {
    const clip = THREE.AnimationClip.parse(c);
    // gait: { speed (m/s natural, boneco de 1,80 m), phase0 (fração do ciclo com a perna 0 à frente) }
    clip.userData = { loop: json.loop?.[clip.name] !== false, gait: json.gait?.[clip.name] ?? null };
    m.set(clip.name, clip);
  }
  return m;
}

/**
 * Biblioteca compartilhada por todos os bonecos: categorias baixadas sob
 * demanda (uma vez) e consultadas por chave.
 */
export class HumanClipLibrary {
  /** @param {string} base pasta com `<categoria>.json` */
  constructor(base, fetcher = (u) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} ${u}`))))) {
    this.base = base;
    this.fetcher = fetcher;
    /** @type {Map<string, THREE.AnimationClip>} */
    this.clips = new Map();
    this.loading = new Map();
  }

  /** Baixa uma categoria (idempotente). Falha vira aviso: o jogo segue com o procedural. */
  load(category) {
    if (!this.loading.has(category)) {
      this.loading.set(category, this.fetcher(`${this.base}${category}.json`)
        .then((j) => { for (const [k, c] of parseHumanClips(j)) this.clips.set(k, c); })
        .catch((e) => console.warn(`[animações humanas] ${category} não carregou; usando o procedural.`, e)));
    }
    return this.loading.get(category);
  }

  /** @param {string} key */
  get(key) { return this.clips.get(key) ?? null; }
}
