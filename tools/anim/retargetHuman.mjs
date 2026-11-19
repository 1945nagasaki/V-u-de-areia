// Gera clipes para o Humanoid do jogo (boneco de peças com juntas) a partir de
// animações humanas reais (Sketchfab, CC BY). O boneco não muda: só as juntas
// recebem rotações.
//
// Uso: node tools/anim/retargetHuman.mjs <pasta-das-fontes> [categoria|chave ...]
// Saída: public/assets/animations/humans/<categoria>.json + catalog.json
//
// Método (por quadro, num espaço da fonte já alinhado ao do jogo: Y para cima,
// frente +Z):
//   - quadril e cabeça: rotação do osso da fonte relativa à pose de referência
//     (quadro 0 de um idle, "em pé, braços caídos" = repouso do Humanoid);
//   - tronco: base formada por (bacia → pescoço) e (ombro → ombro);
//   - braço, antebraço, coxa e canela: DIREÇÃO do segmento (ombro→cotovelo,
//     cotovelo→punho, quadril→joelho, joelho→tornozelo), no referencial da
//     junta-mãe — independe da pose de repouso e das proporções da fonte;
//   - mão e pé: rotação relativa ao antebraço/canela da fonte;
//   - corpo: sobe-e-desce da bacia na escala do boneco (e um pouco de lado).
import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';
import { loadGlbNode } from './nodeGltf.mjs';
import { swing } from './retargetCore.mjs';
import { HUMAN_SOURCES, HUMAN_JOBS } from './humanSources.mjs';
import { HUMAN_JOINTS } from '../../src/entities/anim/HumanClips.js';

const SRC_DIR = process.argv[2];
const only = new Set(process.argv.slice(3));
const OUT = 'public/assets/animations/humans';
fs.mkdirSync(OUT, { recursive: true });

// Humanoid (src/entities/Humanoid.js, BODY): altura do quadril no corpo de 1,80 m.
const TARGET_HIP = 0.93;
const SEAM = 0.2; // s — emenda dos laços
const MAX_SHIFT = 0.45; // deslocamento lateral/frontal máximo do corpo (m): clipes "no lugar"

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DOWN = V(0, -1, 0);
const stripSuffix = (n) => n.replace(/_\d+$/, '');

// ------------------------------------------------------------ fonte
const cache = new Map();
async function loadSource(key) {
  if (cache.has(key)) return cache.get(key);
  const s = HUMAN_SOURCES[key];
  const gltf = await loadGlbNode(path.join(SRC_DIR, s.dir, 'model.glb'));
  const meta = JSON.parse(fs.readFileSync(path.join(SRC_DIR, s.dir, 'source.json'), 'utf8'));
  const bones = [];
  gltf.scene.traverse((o) => { if (o.isBone) bones.push(o); });
  const find = (re) => {
    const b = bones.find((o) => re.test(stripSuffix(o.name))) ?? bones.find((o) => re.test(o.name));
    if (!b) throw new Error(`${key}: osso não achado ${re}`);
    return b;
  };
  const m = s.map;
  const B = {
    pelvis: find(m.pelvis), neck: find(m.neck), head: find(m.head),
    arm: { L: m.arm.L.map(find), R: m.arm.R.map(find) },
    leg: { L: m.leg.L.map(find), R: m.leg.R.map(find) },
  };
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const out = { key, gltf, meta, B, mixer, clips: gltf.animations };
  out.refFrame = captureRef(out, s.ref);
  cache.set(key, out);
  return out;
}

function findClip(clips, name) {
  return clips.find((c) => c.name === name) ?? clips.find((c) => c.name.replace(/^.*\|/, '') === name) ?? null;
}

/** Posições e rotações de mundo dos ossos usados, no tempo t do clipe. */
function snapshot(src, clip, t) {
  src.mixer.stopAllAction();
  const a = src.mixer.clipAction(clip);
  // Sem repetir: em t = duração o LoopRepeat do three voltaria ao quadro 0 (último quadro "pulava" para o início).
  a.setLoop(THREE.LoopOnce, 1);
  a.clampWhenFinished = true;
  a.reset().play();
  src.mixer.setTime(t);
  src.gltf.scene.updateMatrixWorld(true);
  const P = (b) => b.getWorldPosition(V());
  const Q = (b) => b.getWorldQuaternion(new THREE.Quaternion());
  const { B } = src;
  const side = (arr) => arr.map((b) => ({ p: P(b), q: Q(b) }));
  return {
    pelvis: { p: P(B.pelvis), q: Q(B.pelvis) }, neck: { p: P(B.neck) }, head: { q: Q(B.head) },
    arm: { L: side(B.arm.L), R: side(B.arm.R) }, leg: { L: side(B.leg.L), R: side(B.leg.R) },
  };
}

/** Pose de referência + alinhamento (fonte → jogo) + escala e pareamento de lados. */
function captureRef(src, refName) {
  const clip = findClip(src.clips, refName);
  if (!clip) throw new Error(`${src.key}: clipe de referência "${refName}" não existe`);
  const r = snapshot(src, clip, 0);
  const feet = V().add(r.leg.L[2].p).add(r.leg.R[2].p).multiplyScalar(0.5);
  const up = V().subVectors(r.neck.p, feet).normalize();
  const across = V().subVectors(r.leg.L[0].p, r.leg.R[0].p);
  across.addScaledVector(up, -across.dot(up)).normalize();
  let fwd = V().crossVectors(across, up).normalize();
  const toes = V().subVectors(r.leg.L[3].p, r.leg.L[2].p).add(V().subVectors(r.leg.R[3].p, r.leg.R[2].p));
  if (fwd.dot(toes) < 0) fwd.negate();
  const right = V().crossVectors(up, fwd).normalize(); // +X do jogo
  const M = new THREE.Matrix4().set(right.x, right.y, right.z, 0, up.x, up.y, up.z, 0, fwd.x, fwd.y, fwd.z, 0, 0, 0, 0, 1);
  const qM = new THREE.Quaternion().setFromRotationMatrix(M);
  const al = (p) => p.clone().applyMatrix4(M);
  // Lado: índice 1 do Humanoid fica em x > 0.
  const legIdx = al(r.leg.L[0].p).x > al(r.leg.R[0].p).x ? { L: 1, R: 0 } : { L: 0, R: 1 };
  const armIdx = al(r.arm.L[0].p).x > al(r.arm.R[0].p).x ? { L: 1, R: 0 } : { L: 0, R: 1 };
  const ground = Math.min(...['L', 'R'].flatMap((s) => [al(r.leg[s][2].p).y, al(r.leg[s][3].p).y]));
  const hipH = al(r.pelvis.p).y - ground;
  return { snap: r, M, qM, legIdx, armIdx, k: TARGET_HIP / hipH, pelvis0: al(r.pelvis.p) };
}

// ------------------------------------------------------------ um quadro
const align = (ref, p) => p.clone().applyMatrix4(ref.M);
/** Rotação de mundo da fonte, relativa à referência, já no espaço do jogo. */
const deltaQ = (ref, qNow, qRef) => {
  const d = qNow.clone().multiply(qRef.clone().invert());
  return ref.qM.clone().multiply(d).multiply(ref.qM.clone().invert());
};
/** Base ortonormal (como quatérnio) a partir de "para cima" e "através". */
function basisQ(up, across) {
  const u = up.clone().normalize();
  const x = across.clone().addScaledVector(u, -across.dot(u)).normalize();
  const z = V().crossVectors(x, u).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, u, z));
}
const inv = (q) => q.clone().invert();
const HAND_DAMP = 0.5, HAND_MAX = 0.8, FOOT_MAX = 1.0; // rad
/** Limita o ângulo de um quatérnio (mesmo eixo, no máximo `max` rad). */
function limit(q, max) {
  if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
  const ang = 2 * Math.acos(Math.min(1, q.w));
  return ang <= max ? q : new THREE.Quaternion().slerp(q, max / ang);
}
const toLocal = (parentW, v) => v.clone().applyQuaternion(inv(parentW));

function frame(src, clip, t) {
  const ref = src.refFrame, R = ref.snap;
  const S = snapshot(src, clip, t);
  const out = {};
  // Quadril
  const hipsW = deltaQ(ref, S.pelvis.q, R.pelvis.q);
  out.hips = hipsW;
  // Tronco: orientação ABSOLUTA no espaço alinhado (que já tem a frente dos quadris/pés em +Z):
  // (bacia → pescoço) e (ombro do lado x<0 → ombro do lado x>0). Não usa a referência, porque
  // alguns idles de referência têm os ombros girados em relação aos quadris.
  const shoulder = (idx) => align(ref, S.arm[ref.armIdx.L === idx ? 'L' : 'R'][0].p);
  const torsoW = basisQ(V().subVectors(align(ref, S.neck.p), align(ref, S.pelvis.p)), V().subVectors(shoulder(1), shoulder(0)));
  out.torso = torsoW;
  // Cabeça
  out.head = inv(torsoW).multiply(deltaQ(ref, S.head.q, R.head.q));
  // Braços
  for (const s of ['L', 'R']) {
    const i = ref.armIdx[s];
    const sideV = V(i === 1 ? 1 : -1, 0, 0);
    const [sh, el, wr] = S.arm[s].map((b) => align(ref, b.p));
    const dUp = toLocal(torsoW, V().subVectors(el, sh));
    const armL = swing(sideV, dUp).multiply(swing(DOWN, sideV));
    const armW = torsoW.clone().multiply(armL);
    const elL = swing(DOWN, toLocal(armW, V().subVectors(wr, el)));
    const elW = armW.clone().multiply(elL);
    const dFore = deltaQ(ref, S.arm[s][1].q, R.arm[s][1].q);
    const dHand = deltaQ(ref, S.arm[s][2].q, R.arm[s][2].q);
    out[`arm${i}`] = armL; out[`elbow${i}`] = elL;
    // Mão: rotação relativa ao antebraço da fonte, amortecida e limitada (a torção do
    // punho não se traduz bem entre esqueletos — sem isso a mão "deita" de lado).
    out[`hand${i}`] = limit(new THREE.Quaternion().slerp(inv(dFore).multiply(dHand), HAND_DAMP), HAND_MAX);
    void elW;
  }
  // Pernas
  for (const s of ['L', 'R']) {
    const i = ref.legIdx[s];
    const [hp, kn, an] = S.leg[s].map((b) => align(ref, b.p));
    const legL = swing(DOWN, toLocal(hipsW, V().subVectors(kn, hp)));
    const legW = hipsW.clone().multiply(legL);
    const kneeL = swing(DOWN, toLocal(legW, V().subVectors(an, kn)));
    const kneeW = legW.clone().multiply(kneeL);
    // Pé: direção tornozelo→ponta agora vs. na referência (o pé do boneco nasce na horizontal).
    const toeNow = V().subVectors(align(ref, S.leg[s][3].p), an);
    const toeRef = V().subVectors(align(ref, R.leg[s][3].p), align(ref, R.leg[s][2].p));
    const footW = swing(toeRef, toeNow);
    out[`leg${i}`] = legL; out[`knee${i}`] = kneeL;
    out[`foot${i}`] = limit(inv(kneeW).multiply(footW), FOOT_MAX);
  }
  const pel = align(ref, S.pelvis.p).sub(ref.pelvis0).multiplyScalar(ref.k);
  return { q: out, pos: pel };
}

// ------------------------------------------------------------ contato com o chão
// FK do Humanoid (mesmas medidas de BODY em src/entities/Humanoid.js) para achar o
// ponto mais baixo dos pés em cada quadro.
const FK = { hipY: 0.93, torsoY: 0.95, hipHalf: 0.1, thigh: 0.44, shin: 0.42 };
const SOLE = [V(0, -0.07, -0.08), V(0, -0.07, 0.18), V(0, -0.07, 0.23)];
/** Clipes que saem do chão (corrida com fase de voo, pulos, quedas): só não deixa atravessar o chão. */
const LIFT_ONLY = /^(run|runBack|runStrafe.*|hop|jump.*|land|fall|climb|death.*|lieDead|fallWounded|wakeUp|riseUp)$/;
export function lowestFoot(q, pos) {
  let min = Infinity;
  for (let i = 0; i < 2; i++) {
    const hip = V((i === 1 ? 1 : -1) * FK.hipHalf, 0, 0).applyQuaternion(q.hips).add(V(pos.x, FK.hipY + pos.y, pos.z));
    const legW = q.hips.clone().multiply(q[`leg${i}`]);
    const knee = V(0, -FK.thigh, 0).applyQuaternion(legW).add(hip);
    const kneeW = legW.clone().multiply(q[`knee${i}`]);
    const ankle = V(0, -FK.shin, 0).applyQuaternion(kneeW).add(knee);
    const footW = kneeW.clone().multiply(q[`foot${i}`]);
    for (const p of SOLE) min = Math.min(min, p.clone().applyQuaternion(footW).add(ankle).y);
  }
  return min;
}

/** Tornozelos (posição) e altura da sola de cada pé — para medir a cadência. */
function feetFK(q, pos) {
  return [0, 1].map((i) => {
    const hip = V((i === 1 ? 1 : -1) * FK.hipHalf, 0, 0).applyQuaternion(q.hips).add(V(pos.x, FK.hipY + pos.y, pos.z));
    const legW = q.hips.clone().multiply(q[`leg${i}`]);
    const knee = V(0, -FK.thigh, 0).applyQuaternion(legW).add(hip);
    const kneeW = legW.clone().multiply(q[`knee${i}`]);
    return { knee, ankle: V(0, -FK.shin, 0).applyQuaternion(kneeW).add(knee) };
  });
}

/**
 * Laços de locomoção: velocidade natural (m/s, boneco de 1,80 m) = quanto o pé
 * de apoio (o mais baixo) desliza para trás por segundo — tocar o clipe nessa
 * velocidade de deslocamento não deixa o pé escorregar. phase0 = fração do
 * ciclo em que o joelho da perna 0 está mais à frente (alinha andar ↔ correr).
 */
function gaitOf(frames, pos, fps) {
  const F = frames.map((fr, f) => feetFK(fr.q, V(pos[f * 3], pos[f * 3 + 1], pos[f * 3 + 2])));
  let dist = 0, time = 0, best = -Infinity, phase0 = 0;
  for (let f = 0; f < F.length; f++) {
    if (F[f][0].knee.z > best) { best = F[f][0].knee.z; phase0 = f / (F.length - 1); }
    if (f === 0) continue;
    const low = (g) => (g[0].ankle.y <= g[1].ankle.y ? 0 : 1);
    const a = low(F[f - 1]), b = low(F[f]);
    if (a !== b) continue;
    const d = V().subVectors(F[f][a].ankle, F[f - 1][a].ankle);
    dist += Math.hypot(d.x, d.z); time += 1 / fps;
  }
  return { speed: time > 0 ? +(dist / time).toFixed(3) : 0, phase0: +phase0.toFixed(3) };
}

/** Ponto mais baixo de bacia, peito e cabeça (deitado/caindo, o chão é o tronco, não os pés). */
export function lowestTrunk(q, pos) {
  const base = V(pos.x, FK.torsoY + pos.y, pos.z);
  const pelvis = base.y - 0.11;
  const chest = V(0, 0.37, 0).applyQuaternion(q.torso).add(base).y - 0.1;
  const headC = V(0, 0.14, 0).applyQuaternion(q.torso.clone().multiply(q.head)).add(V(0, 0.66, 0).applyQuaternion(q.torso)).add(base).y - 0.11;
  return Math.min(pelvis, chest, headC);
}

// ------------------------------------------------------------ um clipe
function retargetClip(src, clipName, key, loop) {
  const clip = findClip(src.clips, clipName);
  if (!clip) throw new Error(`${src.key}: clipe "${clipName}" não existe`);
  const dur = Math.max(clip.duration, 1 / 30);
  const fps = dur > 6 ? 15 : 30;
  const n = Math.max(2, Math.round(dur * fps) + 1);
  const times = [], frames = [];
  for (let f = 0; f < n; f++) {
    const t = Math.min(dur, f / fps);
    times.push(t);
    frames.push(frame(src, clip, Math.min(t, clip.duration)));
  }
  // Corpo: sem avanço (o jogo move o boneco); laços sem tendência linear.
  const p0 = frames[0].pos.clone(), pN = frames.at(-1).pos.clone();
  const pos = [];
  frames.forEach((fr, f) => {
    const u = f / (n - 1);
    const p = fr.pos.clone();
    if (loop) p.sub(V().lerpVectors(p0, pN, u)).add(V(0, p0.y + (pN.y - p0.y) * u, 0));
    p.x = THREE.MathUtils.clamp(p.x, -MAX_SHIFT, MAX_SHIFT);
    p.z = THREE.MathUtils.clamp(p.z, -MAX_SHIFT, MAX_SHIFT);
    // Pé mais baixo no chão: exato nos clipes de pé; nos que saem do chão, só não atravessa.
    const low = LIFT_ONLY.test(key) ? Math.min(lowestFoot(fr.q, p), lowestTrunk(fr.q, p)) : lowestFoot(fr.q, p);
    if (!LIFT_ONLY.test(key) || low < 0) p.y -= low;
    pos.push(p.x, p.y, p.z);
  });
  // Laço sem emenda: muitas fontes não fecham o ciclo (último quadro ≠ primeiro).
  // Os últimos SEAM s misturam-se progressivamente até o quadro 0.
  if (loop) {
    const m = Math.min(n - 2, Math.max(1, Math.round(SEAM * fps)));
    for (let f = n - m; f < n; f++) {
      const u = (f - (n - m - 1)) / m; // → 1 no último quadro
      const e = u * u * (3 - 2 * u);
      for (const j of HUMAN_JOINTS) frames[f].q[j] = frames[f].q[j].clone().slerp(frames[0].q[j], e);
      for (let c = 0; c < 3; c++) pos[f * 3 + c] += (pos[c] - pos[f * 3 + c]) * e;
    }
  }
  const tracks = [new THREE.VectorKeyframeTrack('body.position', times, pos)];
  for (const j of HUMAN_JOINTS) {
    const vals = [];
    let prev = null;
    for (const fr of frames) {
      const q = fr.q[j].clone().normalize();
      if (prev && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w); // sinal contínuo (sem voltas no slerp)
      vals.push(q.x, q.y, q.z, q.w);
      prev = q;
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${j}.quaternion`, times, vals));
  }
  const gait = loop && /^(walk|run|sneak)/.test(key) ? gaitOf(frames, pos, fps) : null;
  return { clip: new THREE.AnimationClip(key, dur, tracks), fps, frames: n, sourceClip: clip.name, sourceDuration: clip.duration, gait };
}

// ------------------------------------------------------------ principal
const catFile = path.join(OUT, 'catalog.json');
const catalog = fs.existsSync(catFile) ? JSON.parse(fs.readFileSync(catFile, 'utf8')) : [];
const round = (k, v) => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v);
for (const [category, jobs] of Object.entries(HUMAN_JOBS)) {
  const keys = Object.keys(jobs).filter((k) => !only.size || only.has(category) || only.has(k));
  if (!keys.length) continue;
  const file = path.join(OUT, `${category}.json`);
  const lib = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { category, clips: [], loop: {} };
  for (const key of keys) {
    const [srcKey, clipName, loop] = jobs[key];
    try {
      const src = await loadSource(srcKey);
      const r = retargetClip(src, clipName, key, loop);
      lib.clips = lib.clips.filter((c) => c.name !== key);
      lib.clips.push(THREE.AnimationClip.toJSON(r.clip));
      lib.loop[key] = loop;
      lib.gait ??= {};
      if (r.gait) lib.gait[key] = r.gait; else delete lib.gait[key];
      const entry = {
        name: `human.${key}`, category, species: 'humano', key, loop, duration: +r.clip.duration.toFixed(3), fps: r.fps, frames: r.frames,
        rig: 'humanoid-juntas', source: { file: src.meta.name, clip: r.sourceClip, author: src.meta.authorName ?? src.meta.author, license: src.meta.license, url: src.meta.url },
        ...(r.gait ? { naturalSpeed: r.gait.speed } : {}),
        validation: 'gerado',
      };
      const i = catalog.findIndex((e) => e.name === entry.name);
      if (i >= 0) catalog[i] = entry; else catalog.push(entry);
      console.log(`${category}.${key} ← ${srcKey}/${r.sourceClip} (${r.clip.duration.toFixed(2)} s, ${r.fps} FPS)`);
    } catch (e) {
      console.log(`${category}.${key} FALHOU: ${e.message}`);
      if (process.env.DEBUG) console.log(e.stack);
    }
  }
  fs.writeFileSync(file, JSON.stringify(lib, round));
}
fs.writeFileSync(catFile, JSON.stringify(catalog, null, 1));
