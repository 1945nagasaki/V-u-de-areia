import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { Humanoid, setHumanClipLibrary } from '../../../src/entities/Humanoid.js';
import { HumanClipLibrary, HUMAN_JOINTS, HumanPose, samplePose } from '../../../src/entities/anim/HumanClips.js';
import { HUMAN_ANIMATION } from '../../../src/config/humanAnimation.js';

const DIR = new URL('../../../public/assets/animations/humans/', import.meta.url);
const readLib = (cat) => JSON.parse(fs.readFileSync(new URL(`${cat}.json`, DIR)));
/** Biblioteca real, lida do disco (sem rede). */
async function realLibrary(cats = ['locomotion', 'social', 'professions', 'transitions']) {
  const lib = new HumanClipLibrary('', (u) => Promise.resolve(readLib(u.replace('.json', ''))));
  await Promise.all(cats.map((c) => lib.load(c)));
  return lib;
}
const run = (h, secs, speed, o = {}, dt = 1 / 60) => { for (let t = 0; t < secs; t += dt) h.update(dt, speed, o); };

afterEach(() => setHumanClipLibrary(null)); // a biblioteca é global: cada teste devolve o estado

test('biblioteca_humana_todosOsClipesValidos', () => {
  // Arrange / Act
  let n = 0;
  for (const cat of ['locomotion', 'social', 'professions', 'transitions']) {
    for (const c of readLib(cat).clips) {
      const clip = THREE.AnimationClip.parse(c);
      n++;
      // Assert: todas as juntas presentes, sem NaN, quatérnios unitários
      for (const j of HUMAN_JOINTS) assert.ok(clip.tracks.find((t) => t.name === `${j}.quaternion`), `${clip.name} sem ${j}`);
      for (const t of clip.tracks) {
        assert.ok(t.values.every(Number.isFinite), `${clip.name}/${t.name} com NaN`);
        if (t.name.endsWith('.quaternion')) for (let i = 0; i < t.values.length; i += 4) {
          assert.ok(Math.abs(Math.hypot(t.values[i], t.values[i + 1], t.values[i + 2], t.values[i + 3]) - 1) < 2e-3, `${clip.name}/${t.name}`);
        }
      }
    }
  }
  assert.ok(n >= 80, `só ${n} clipes`);
});

test('biblioteca_humana_lacosSemEmenda', () => {
  // Regressão: o martelo do ferreiro saltava 0,9 rad ao recomeçar o ciclo.
  for (const cat of ['locomotion', 'social', 'professions', 'transitions']) {
    const lib = readLib(cat);
    for (const c of lib.clips) {
      if (lib.loop[c.name] === false) continue;
      const clip = THREE.AnimationClip.parse(c);
      for (const t of clip.tracks.filter((tr) => tr.name.endsWith('.quaternion'))) {
        const v = t.values, k = v.length - 4;
        const a = new THREE.Quaternion(v[0], v[1], v[2], v[3]), b = new THREE.Quaternion(v[k], v[k + 1], v[k + 2], v[k + 3]);
        assert.ok(a.angleTo(b) < 0.05, `${clip.name}/${t.name}: emenda de ${a.angleTo(b).toFixed(3)} rad`);
      }
    }
  }
});

test('config_gestosEIdles_apontamParaClipesQueExistem', async () => {
  const lib = await realLibrary();
  const L = HUMAN_ANIMATION.locomotion;
  for (const k of [...L.idle, L.walk, L.run]) assert.ok(lib.get(k), `locomoção: falta ${k}`);
  for (const [g, m] of Object.entries(HUMAN_ANIMATION.gestures)) for (const k of m.clips) assert.ok(lib.get(k), `gesto ${g}: falta ${k}`);
});

test('andar_comClipes_cadenciaSegueVelocidadeReal', async () => {
  // Arrange
  setHumanClipLibrary(await realLibrary(['locomotion']));
  const h = new Humanoid({ rng: () => 0.5 });
  const walk = (await realLibrary(['locomotion'])).get(HUMAN_ANIMATION.locomotion.walk);
  const nat = walk.userData.gait.speed;
  // Act: 2 s andando exatamente na velocidade natural do clipe
  run(h, 0.5, nat);
  const p0 = h.locoPhase;
  run(h, 2, nat);
  // Assert: avançou 2 s ÷ duração do ciclo (mód. 1) — pé de apoio sem escorregar
  const expected = (p0 + 2 / walk.duration) % 1;
  const d = Math.abs(h.locoPhase - expected);
  assert.ok(Math.min(d, 1 - d) < 0.03, `fase ${h.locoPhase.toFixed(3)} esperada ${expected.toFixed(3)}`);
});

test('andar_comClipes_pernasSeguemOClipe', async () => {
  // Arrange: mesmo boneco com e sem biblioteca
  const proc = new Humanoid({ rng: () => 0.5 });
  run(proc, 1, 1.25);
  setHumanClipLibrary(await realLibrary(['locomotion']));
  const h = new Humanoid({ rng: () => 0.5 });
  // Act
  run(h, 1, 1.25);
  // Assert: a pose do quadril/joelho veio do clipe (difere do procedural) e as pernas se mexem
  const a = h.legs[0].quaternion.clone();
  run(h, 0.3, 1.25);
  assert.ok(a.angleTo(h.legs[0].quaternion) > 0.05, 'a perna mexeu');
  assert.ok(h.knees[0].quaternion.angleTo(proc.knees[0].quaternion) > 1e-3, 'joelho igual ao procedural');
});

test('semBiblioteca_bonecoContinuaProcedural', () => {
  // Arrange / Act
  const h = new Humanoid({ rng: () => 0.5 });
  run(h, 1, 1.25);
  // Assert: clipGesture recusa e nada quebra
  assert.equal(h.clipGesture('hammer', 1 / 60), false);
});

test('gesto_sentado_soMexeTroncoEBracos', async () => {
  setHumanClipLibrary(await realLibrary(['social']));
  const h = new Humanoid({ rng: () => 0.5 });
  run(h, 0.5, 0);
  const legs = h.legs.map((l) => l.quaternion.clone()), body = h.body.position.clone();
  // Act: gesto de comer, sentado
  let used = false;
  for (let i = 0; i < 30; i++) used = h.clipGesture('eat', 1 / 60, { upperOnly: true }) || used;
  // Assert
  assert.ok(used, 'gesto com clipe');
  h.legs.forEach((l, i) => assert.ok(l.quaternion.angleTo(legs[i]) < 1e-6, 'perna mexida'));
  assert.ok(h.body.position.distanceTo(body) < 1e-6, 'corpo deslocado');
});

test('gesto_entraESaiSuave_semSalto', async () => {
  setHumanClipLibrary(await realLibrary(['professions']));
  const dt = 1 / 60;
  const stepMax = (h, frames, gestureAt) => {
    let prev = null, worst = 0;
    for (let f = 0; f < frames; f++) {
      h.update(dt, 0, {});
      h.clipGesture(gestureAt(f), dt);
      const q = h.arms[0].quaternion.clone();
      if (prev) worst = Math.max(worst, q.angleTo(prev));
      prev = q;
    }
    return worst;
  };
  // Arrange: velocidade própria do clipe (o golpe do martelo é rápido de verdade), já em peso 1
  const solo = new Humanoid({ rng: () => 0.5 });
  stepMax(solo, 30, () => 'hammer');
  const intrinsic = stepMax(solo, 240, () => 'hammer');
  // Act: 1 s parado, 2 s martelando, 1 s parado — entrada, emendas do laço e saída
  const worst = stepMax(new Humanoid({ rng: () => 0.5 }), 240, (f) => (f >= 60 && f < 180 ? 'hammer' : null));
  // Assert: nada salta mais do que o próprio movimento do clipe
  assert.ok(worst <= intrinsic * 1.05 + 0.02, `maior salto ${worst.toFixed(3)} rad (clipe: ${intrinsic.toFixed(3)})`);
});

test('pose_amostrada_semLaco_paraNoUltimoQuadro', async () => {
  const lib = await realLibrary(['transitions']);
  const c = lib.get('sitDown'), pose = new HumanPose(), end = new HumanPose();
  samplePose(c, c.duration, end);
  samplePose(c, c.duration + 5, pose);
  for (const k of HUMAN_JOINTS) assert.ok(pose.q[k].angleTo(end.q[k]) < 1e-6, k);
});
