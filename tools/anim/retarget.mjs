// Gera clipes de animação para as espécies do jogo a partir de animações
// reais (Sketchfab), adaptadas ao esqueleto que o AutoRig monta em cada
// modelo. O modelo, a malha e a textura do jogo não mudam: só os ossos ar_*
// recebem movimento.
//
// Uso: node tools/anim/retarget.mjs <pasta-das-fontes> [espécie ...]
// Saída: public/assets/animations/animals/<espécie>.json (+ catálogo)
import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';
import { loadGlbNode } from './nodeGltf.mjs';
import { alignmentBasis, pointAlong, swing, localsFromWorld } from './retargetCore.mjs';
import { SOURCES, JOBS } from './sources.mjs';
import { ANIMAL_MODELS } from '../../src/config/animalModels.js';
import { normalize } from '../../src/render/AnimalModels.js';
import { autoRig } from '../../src/render/AutoRig.js';

const FPS = 30;
const SRC_DIR = process.argv[2];
const only = new Set(process.argv.slice(3));
const OUT = 'public/assets/animations/animals';
fs.mkdirSync(OUT, { recursive: true });

const clean = (n) => n.replace(/(_end)?(_\d+)+$/, '').replace(/_\d+$/, '');
const V = () => new THREE.Vector3();

// ------------------------------------------------------------ fonte
const srcCache = new Map();
async function loadSource(key) {
  if (srcCache.has(key)) return srcCache.get(key);
  const s = SOURCES[key];
  const gltf = await loadGlbNode(path.join(SRC_DIR, s.dir, 'model.glb'));
  const meta = JSON.parse(fs.readFileSync(path.join(SRC_DIR, s.dir, 'source.json'), 'utf8'));
  const bones = [];
  gltf.scene.traverse((o) => { if (o.isBone) bones.push(o); });
  // nome sem o sufixo do exportador (último _N) ou sem todos os sufixos numéricos
  const find = (re) => bones.find((b) => re.test(b.name.replace(/_\d+$/, '')) || re.test(clean(b.name))) ?? null;
  const chain = (list) => list.map(find).filter(Boolean);
  const m = s.map;
  const legs = {};
  for (const [k, list] of Object.entries(m.legs)) legs[k] = chain(list);
  const out = { gltf, meta, spine: chain(m.spine), neck: chain(m.neck), head: chain(m.head), tail: chain(m.tail), legs };
  const missing = [];
  if (out.spine.length < 2) missing.push('spine');
  if (out.head.length < 2) missing.push('head');
  for (const [k, c] of Object.entries(legs)) if (c.length < 3) missing.push(`leg ${k}`);
  if (missing.length) throw new Error(`${key}: ossos não achados: ${missing.join(', ')}`);
  srcCache.set(key, out);
  return out;
}

/** Posições (alinhadas ao espaço do jogo) de todos os pontos usados, no estado atual da cena. */
function sampleSource(src, M) {
  src.gltf.scene.updateMatrixWorld(true);
  const p = (b) => b.getWorldPosition(V()).applyMatrix4(M);
  const legs = {};
  for (const [k, c] of Object.entries(src.legs)) legs[k] = c.map(p);
  return { spine: src.spine.map(p), neck: src.neck.map(p), head: src.head.map(p), tail: src.tail.map(p), legs };
}

function findClip(clips, name) {
  return clips.find((c) => c.name === name)
    ?? clips.find((c) => new RegExp(`(^|\\|)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\||:|$)`).test(c.name)) ?? null;
}

// ------------------------------------------------------------ alvo (modelo do jogo)
async function loadTarget(species) {
  const cfg = ANIMAL_MODELS[species];
  const file = path.join('public', cfg.glb.replace(/^.*?assets\//, 'assets/'));
  const gltf = await loadGlbNode(file);
  const holder = normalize(gltf.scene, cfg);
  const rigged = autoRig(holder, cfg.rig);
  if (!rigged) throw new Error(`AutoRig falhou em ${species}`);
  const obj = rigged.object;
  obj.updateMatrixWorld(true);
  const bones = [];
  obj.traverse((o) => { if (o.isBone) bones.push(o); });
  const byName = new Map(bones.map((b) => [b.name, b]));
  const pos = (n) => byName.get(n).getWorldPosition(V());
  return { cfg, rig: rigged.rig, bones, byName, pos, order: bones.map((b) => ({ name: b.name, parent: b.parent?.isBone ? b.parent.name : null })) };
}

/** Segmentos do alvo: osso → [ponto inicial, ponto final] em repouso, e de onde vem a direção na fonte. */
function targetSegments(T) {
  const r = T.rig, segs = [];
  const spinePts = [...r.spine.map(T.pos), T.pos(r.neck ?? r.head)];
  const lens = [0];
  for (let i = 1; i < spinePts.length; i++) lens.push(lens[i - 1] + spinePts[i].distanceTo(spinePts[i - 1]));
  r.spine.forEach((n, i) => segs.push({ bone: n, rest: spinePts[i + 1].clone().sub(spinePts[i]), src: { chain: 'spine', f0: lens[i] / lens.at(-1), f1: lens[i + 1] / lens.at(-1) } }));
  if (r.neck) segs.push({ bone: r.neck, rest: T.pos(r.head).sub(T.pos(r.neck)), src: { chain: 'neck', f0: 0, f1: 1 } });
  if (r.head) segs.push({ bone: r.head, rest: new THREE.Vector3(0, 0, 1), src: { chain: 'head', f0: 0, f1: 1 } });
  const tailPts = r.tail.map(T.pos);
  if (tailPts.length) {
    const last = tailPts.at(-1), prev = tailPts.length > 1 ? tailPts.at(-2) : T.pos(r.spine[0]);
    tailPts.push(last.clone().add(last.clone().sub(prev)));
    r.tail.forEach((n, i) => segs.push({ bone: n, rest: tailPts[i + 1].clone().sub(tailPts[i]), src: { chain: 'tail', f0: i / r.tail.length, f1: (i + 1) / r.tail.length } }));
  }
  for (const l of r.legs) {
    const key = (l.front ? 'F' : 'B') + (l.side > 0 ? 'L' : 'R');
    segs.push({ bone: l.upper, rest: T.pos(l.lower).sub(T.pos(l.upper)), src: { leg: key, a: 0, b: 1 } });
    segs.push({ bone: l.lower, rest: new THREE.Vector3(0, -1, 0), src: { leg: key, a: 1, b: 2 } });
  }
  return segs;
}

function sourceDir(S, seg, pairSide) {
  const s = seg.src;
  if (s.chain) {
    const pts = S[s.chain];
    if (!pts || pts.length < 2) return null;
    return pointAlong(pts, s.f1).sub(pointAlong(pts, s.f0));
  }
  const pts = S.legs[pairSide[s.leg] ?? s.leg];
  return pts[s.b].clone().sub(pts[s.a]);
}

// ------------------------------------------------------------ retarget de um clipe
async function retargetClip(T, segs, srcKey, clipName, key) {
  const src = await loadSource(srcKey);
  const clip = findClip(src.gltf.animations, clipName);
  if (!clip) throw new Error(`${srcKey}: clipe "${clipName}" não existe (${src.gltf.animations.map((c) => c.name).join(', ')})`);
  const mixer = new THREE.AnimationMixer(src.gltf.scene);
  // Repouso = pose de ligação (antes de tocar qualquer clipe).
  src.gltf.scene.traverse((o) => { if (o.isBone && o.userData.rest) { o.position.copy(o.userData.rest.p); o.quaternion.copy(o.userData.rest.q); o.scale.copy(o.userData.rest.s); } });
  src.gltf.scene.traverse((o) => { if (o.isBone && !o.userData.rest) o.userData.rest = { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }; });
  const ident = new THREE.Matrix4();
  const R0 = sampleSource(src, ident);
  const feet = Object.values(R0.legs).reduce((acc, c) => acc.add(c[2]), V()).multiplyScalar(1 / 4);
  const M = alignmentBasis(R0.spine[0], R0.head[0], feet);
  // Referência = postura natural de pé (quadro 0 do clipe `ref`), não a pose de ligação do arquivo:
  // assim a postura de repouso do NOSSO modelo corresponde à postura de repouso do animal de origem.
  const refClip = findClip(src.gltf.animations, SOURCES[srcKey].ref ?? clipName) ?? clip;
  const refAction = mixer.clipAction(refClip);
  refAction.play();
  mixer.setTime(0);
  const rest = sampleSource(src, M);
  refAction.stop();
  // Lado: pata do mesmo nome pode estar espelhada no arquivo; confere pela posição.
  const pairSide = {};
  for (const fb of ['F', 'B']) {
    const xL = rest.legs[`${fb}L`][0].x, xR = rest.legs[`${fb}R`][0].x;
    pairSide[`${fb}L`] = xL >= xR ? `${fb}L` : `${fb}R`;
    pairSide[`${fb}R`] = xL >= xR ? `${fb}R` : `${fb}L`;
  }
  const restFeet = Object.values(rest.legs).reduce((acc, c) => acc.add(c[2]), V()).multiplyScalar(1 / 4);
  const srcHip = rest.spine[0].y - restFeet.y;
  const tgtHip = T.pos(T.rig.spine[0]).y;
  const restDirs = segs.map((s) => sourceDir(rest, s, pairSide));

  const action = mixer.clipAction(clip);
  action.play();
  const frames = Math.max(2, Math.round(clip.duration * FPS) + 1);
  const times = [];
  const qv = new Map(segs.map((s) => [s.bone, []]));
  for (const b of T.order) if (!qv.has(b.name)) qv.set(b.name, []);
  const rootY = [];
  const rootRest = T.byName.get(T.rig.root).position.clone();
  for (let f = 0; f < frames; f++) {
    const t = Math.min(clip.duration, f / FPS);
    times.push(t);
    mixer.setTime(t);
    const P = sampleSource(src, M);
    const world = new Map();
    segs.forEach((s, i) => {
      const d = sourceDir(P, s, pairSide);
      if (!d || !restDirs[i]) return;
      if (s.src.chain === 'tail') dampPitch(d, restDirs[i], TAIL_PITCH);
      // swing da fonte (repouso → agora) aplicado à direção de repouso do alvo
      const q = swing(restDirs[i], d);
      const want = s.rest.clone().normalize().applyQuaternion(q);
      world.set(s.bone, swing(s.rest, want));
    });
    const local = localsFromWorld(T.order, world);
    for (const b of T.order) qv.get(b.name).push(...local.get(b.name).toArray());
    // Sobe e desce do corpo (pelve), na escala do alvo; sem deslocar para frente/lados.
    const pf = Object.values(P.legs).reduce((acc, c) => acc.add(c[2]), V()).multiplyScalar(1 / 4);
    // limitado: o corpo não afunda no chão nem salta mais que ~35% da altura do quadril
    const dy = Math.max(-0.25 * tgtHip, Math.min(0.35 * tgtHip, ((P.spine[0].y - restFeet.y) - srcHip) * (tgtHip / Math.max(1e-6, srcHip))));
    void pf;
    rootY.push(rootRest.x, rootRest.y + dy, rootRest.z);
  }
  mixer.stopAllAction();
  const tracks = [];
  for (const [name, vals] of qv) tracks.push(new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, vals));
  tracks.push(new THREE.VectorKeyframeTrack(`${T.rig.root}.position`, times, rootY));
  return { clip: new THREE.AnimationClip(key, clip.duration, tracks), source: src.meta, sourceClip: clip.name, frames };
}

/**
 * Cauda: mantém a ondulação lateral da fonte mas amortece o sobe-e-desce
 * (proporções diferentes de quadril/cauda fazem a ponta varar o chão) e não
 * deixa descer abaixo da elevação de repouso.
 */
const TAIL_PITCH = 0.3;
function dampPitch(d, rest, k) {
  const elev = (v) => Math.asin(Math.max(-1, Math.min(1, v.y / v.length())));
  const e0 = elev(rest), e = elev(d);
  const target = Math.max(e0, e0 + k * (e - e0));
  const h = Math.hypot(d.x, d.z) || 1e-9;
  d.set((d.x / h) * Math.cos(target), Math.sin(target), (d.z / h) * Math.cos(target));
}

// ------------------------------------------------------------ principal
const catalog = [];
for (const [species, clips] of Object.entries(JOBS)) {
  if (only.size && !only.has(species)) continue;
  const T = await loadTarget(species);
  const segs = targetSegments(T);
  const out = { species, fps: FPS, clips: [], names: {} };
  for (const [key, [srcKey, clipName, loop]] of Object.entries(clips)) {
    try {
      const r = await retargetClip(T, segs, srcKey, clipName, key);
      out.clips.push(THREE.AnimationClip.toJSON(r.clip));
      out.names[key] = key;
      catalog.push({ name: `${species}.${key}`, category: 'animals', species, key, loop, duration: +r.clip.duration.toFixed(3), fps: FPS, frames: r.frames, rig: 'autorig-quadruped',
        source: { file: r.source.name, clip: r.sourceClip, author: r.source.author, license: r.source.license, url: r.source.url }, validation: 'gerado' });
      console.log(`${species}.${key} ← ${srcKey}/${r.sourceClip} (${r.clip.duration.toFixed(2)} s)`);
    } catch (e) {
      console.log(`${species}.${key} FALHOU: ${e.message}`, process.env.DEBUG ? e.stack : "");
    }
  }
  // 4 casas decimais: imperceptível na pose e reduz o arquivo pela metade
  fs.writeFileSync(path.join(OUT, `${species}.json`), JSON.stringify(out, (k, v) => (typeof v === "number" ? Math.round(v * 1e4) / 1e4 : v)));
}
const catFile = path.join(OUT, 'catalog.json');
const prev = fs.existsSync(catFile) ? JSON.parse(fs.readFileSync(catFile, 'utf8')) : [];
const merged = [...prev.filter((c) => !catalog.some((n) => n.name === c.name)), ...catalog];
fs.writeFileSync(catFile, JSON.stringify(merged, null, 1));
