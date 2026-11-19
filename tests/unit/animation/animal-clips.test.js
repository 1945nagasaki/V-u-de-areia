import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { AnimalAnimationManager } from '../../../src/entities/anim/AnimalAnimationManager.js';
import { SPECIES } from '../../../src/config/fauna.js';

/** Modelo mínimo com um osso e clipes que giram esse osso. */
function modelWith(keys) {
  const object = new THREE.Group();
  const bone = new THREE.Bone();
  bone.name = 'ar_leg0';
  object.add(bone);
  const clips = keys.map((k) => new THREE.AnimationClip(k, 1, [
    new THREE.QuaternionKeyframeTrack('ar_leg0.quaternion', [0, 1], [...new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.8).toArray(), ...new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.8).toArray()]),
  ]));
  return { object, bone, clips, names: Object.fromEntries(keys.map((k) => [k, k])) };
}

const make = (model, spec = SPECIES.rinoceronte) => new AnimalAnimationManager({ spec, speciesId: 'rinoceronte', pose: new THREE.Group(), rig: null, model, dims: { L: 4, H: 2, legTop: 1, torsoH: 0.8 }, rng: () => 0.5 });
const run = (anim, secs, ctx, dt = 1 / 60) => { for (let t = 0; t < secs; t += dt) anim.update(dt, ctx); };

test('clipes_semIdle_parado_voltaParaPoseDeRepouso', () => {
  // Arrange: espécie só com andar (ex.: rinoceronte retargetado só tem walk/run)
  const m = modelWith(['walk', 'run']);
  const anim = make(m);
  run(anim, 1, { speed: 1.5, state: 'wander' });
  assert.ok(m.bone.quaternion.angleTo(new THREE.Quaternion()) > 0.5, 'andando, o osso gira');
  // Act: para
  run(anim, 2, { speed: 0, state: 'idle' });
  // Assert: sem clipe de idle, volta ao repouso em vez de congelar no passo
  assert.ok(m.bone.quaternion.angleTo(new THREE.Quaternion()) < 0.05, `ângulo parado ${m.bone.quaternion.angleTo(new THREE.Quaternion()).toFixed(3)}`);
});

test('bibliotecaRetargetada_jacare_clipesValidosEMexemOsOssos', () => {
  // Arrange: arquivo real gerado por tools/anim/retarget.mjs
  const lib = JSON.parse(fs.readFileSync(new URL('../../../public/assets/animations/animals/jacare.json', import.meta.url)));
  const clips = lib.clips.map((c) => THREE.AnimationClip.parse(c));
  // Assert: chaves esperadas, durações > 0, sem NaN, quatérnios unitários
  for (const k of ['idle', 'walk', 'run', 'attack']) assert.ok(clips.find((c) => c.name === lib.names[k]), `falta ${k}`);
  for (const c of clips) {
    assert.ok(c.duration > 0, c.name);
    for (const t of c.tracks) {
      assert.ok(t.values.every(Number.isFinite), `${c.name}/${t.name} com NaN`);
      if (t.name.endsWith('.quaternion')) for (let i = 0; i < t.values.length; i += 4) {
        const n = Math.hypot(t.values[i], t.values[i + 1], t.values[i + 2], t.values[i + 3]);
        assert.ok(Math.abs(n - 1) < 1e-3, `${c.name}/${t.name} quatérnio não unitário (${n})`);
      }
    }
  }
  // Andar: algum osso de perna varia ao longo do clipe
  const walk = clips.find((c) => c.name === lib.names.walk);
  const leg = walk.tracks.find((t) => /ar_leg\d\.quaternion/.test(t.name));
  const q0 = new THREE.Quaternion().fromArray(leg.values, 0);
  let maxA = 0;
  for (let i = 4; i < leg.values.length; i += 4) maxA = Math.max(maxA, q0.angleTo(new THREE.Quaternion().fromArray(leg.values, i)));
  assert.ok(maxA > 0.1, `perna quase parada no andar (${maxA.toFixed(3)} rad)`);
});
