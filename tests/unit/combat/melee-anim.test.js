import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MixerCombatAnimator } from '../../../src/combat/anim/MixerCombatAnimator.js';
import { HumanoidCombatAnimator } from '../../../src/combat/anim/HumanoidCombatAnimator.js';
import { CombatEntity } from '../../../src/combat/CombatEntity.js';
import { CombatWorld } from '../../../src/combat/CombatWorld.js';
import { createSkills } from '../../../src/combat/Skill.js';
import { STATE } from '../../../src/combat/CombatStates.js';
import { Humanoid } from '../../../src/entities/Humanoid.js';
import { MELEE } from '../../../src/config/meleeCombat.js';
import { MELEE_POSES } from '../../../src/config/meleePoses.js';

const S = STATE;
const DT = 1 / 120;

function bodyFor(obj) {
  const facing = { x: 0, z: 1 };
  return { pos: obj.position, facing, move(dx, dz) { obj.position.x += dx; obj.position.z += dz; }, face(x, z) { const l = Math.hypot(x, z) || 1; facing.x = x / l; facing.z = z / l; obj.rotation.y = Math.atan2(facing.x, facing.z); } };
}
function entityOn(obj) {
  const e = new CombatEntity({ name: 'p', team: 'player', body: bodyFor(obj), dodge: MELEE.player.dodge });
  createSkills(MELEE.skills).forEach((s) => e.addSkill(s));
  return e;
}

// ------------------------------------------------------------ mixer
function rig() {
  const root = new THREE.Object3D(), bone = new THREE.Object3D();
  bone.name = 'arm';
  root.add(bone);
  // posição x = tempo do clipe (0 → 1 em 1 s): lê o ponto exato do clipe
  const lin = (name) => new THREE.AnimationClip(name, 1, [new THREE.NumberKeyframeTrack('arm.position[x]', [0, 1], [0, 1])]);
  return { root, bone, clips: [lin('Atk'), lin('Idle')] };
}

test('mixer_faseDoClipeAcompanhaFaseDaSkill_eHitstopCongela', () => {
  const { root, bone, clips } = rig();
  const mixer = new THREE.AnimationMixer(root);
  const anim = new MixerCombatAnimator(mixer, clips, { map: { slashRight: 'Atk', idle: 'Idle' }, marks: { Atk: [0.35, 0.55] } });
  const e = entityOn(root), w = new CombatWorld({ feel: MELEE.feel });
  w.add(e);
  anim.update(e, 0);
  e.useSkill('combo', w);
  // Até o fim do STARTUP: o clipe tem que chegar na marca 0,35, qualquer que seja o tempo da fase.
  while (e.state === S.STARTUP) { w.update(DT); anim.update(e, DT); }
  // Ao trocar de fase o clipe é posto na marca e já anda 1 quadro na velocidade da fase nova.
  const one = (st) => anim.phaseScale(e, anim.current.getClip()) * DT;
  assert.ok(Math.abs(anim.current.time - (0.35 + one())) < 1e-4, `início do ACTIVE em ${anim.current.time.toFixed(4)}`);
  while (e.state === S.ACTIVE) { w.update(DT); anim.update(e, DT); }
  assert.ok(Math.abs(anim.current.time - (0.55 + one())) < 1e-4, `início do RECOVERY em ${anim.current.time.toFixed(4)}`);
  // Hitstop: o clipe para
  e.hitstop = 0.05;
  const t0 = anim.current.time;
  anim.update(e, 0.03);
  assert.equal(anim.current.time, t0);
  void bone;
});

test('mixer_entraComCrossfade', () => {
  const { root, clips } = rig();
  const mixer = new THREE.AnimationMixer(root);
  const anim = new MixerCombatAnimator(mixer, clips, { map: { slashRight: 'Atk', idle: 'Idle' }, fade: 0.12 });
  const e = entityOn(root), w = new CombatWorld({ feel: MELEE.feel });
  anim.update(e, 0);
  anim.update(e, 0.2);
  const idle = anim.current;
  e.useSkill('combo', w);
  anim.update(e, 0.06);
  assert.ok(idle.getEffectiveWeight() > 0.05 && idle.getEffectiveWeight() < 0.95, `meio do crossfade: ${idle.getEffectiveWeight().toFixed(2)}`);
});

// ------------------------------------------------------------ procedural (Humanoid)
const armDirInTorso = (h, i) => {
  const d = new THREE.Vector3(0, -1, 0).applyQuaternion(h.arms[i].quaternion);
  return d;
};
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]).normalize();

test('procedural_fimDoStartup_armaNaAntecipacao_fimDoActive_noCorte', () => {
  const h = new Humanoid({ rng: () => 0.5 });
  const anim = new HumanoidCombatAnimator(h);
  const e = entityOn(h.root), w = new CombatWorld({ feel: MELEE.feel });
  w.add(e);
  e.useSkill('combo', w);
  const step = () => { w.update(DT); h.update(DT, 0, {}); anim.apply(e, DT); };
  while (e.state === S.STARTUP) step();
  // 1º quadro do ACTIVE ≈ antecipação
  assert.ok(armDirInTorso(h, 0).angleTo(v3(MELEE_POSES.slashRight.windup.upR)) < 0.2, 'braço puxado para trás');
  while (e.state === S.ACTIVE) step();
  assert.ok(armDirInTorso(h, 0).angleTo(v3(MELEE_POSES.slashRight.strike.upR)) < 0.2, 'braço no fim do corte');
});

test('procedural_comboEmendado_semSaltoNaTroca', () => {
  const h = new Humanoid({ rng: () => 0.5 });
  const anim = new HumanoidCombatAnimator(h);
  const e = entityOn(h.root), w = new CombatWorld({ feel: MELEE.feel });
  w.add(e);
  e.useSkill('combo', w);
  let prev = null, worstAtSwitch = 0, last = e.state;
  for (let f = 0; f < 240; f++) {
    if (e.state === S.ACTIVE) e.useSkill('combo', w);
    w.update(DT); h.update(DT, 0, {}); anim.apply(e, DT);
    const q = h.arms[0].quaternion.clone();
    if (prev && last === S.RECOVERY && e.state === S.STARTUP) worstAtSwitch = Math.max(worstAtSwitch, q.angleTo(prev));
    prev = q; last = e.state;
  }
  assert.ok(worstAtSwitch < 0.2, `salto na emenda: ${worstAtSwitch.toFixed(3)} rad`);
});

test('procedural_hitstop_congelaAPose', () => {
  const h = new Humanoid({ rng: () => 0.5 });
  const anim = new HumanoidCombatAnimator(h);
  const e = entityOn(h.root), w = new CombatWorld({ feel: MELEE.feel });
  w.add(e);
  e.useSkill('whirlwind', w);
  while (e.state !== S.ACTIVE) { w.update(DT); h.update(DT, 0, {}); anim.apply(e, DT); }
  w.update(DT); h.update(DT, 0, {}); anim.apply(e, DT);
  const q = h.arms[0].quaternion.clone();
  e.hitstop = 0.045;
  w.update(DT); h.update(DT, 0, {}); anim.apply(e, DT);
  assert.ok(h.arms[0].quaternion.angleTo(q) < 1e-6);
});
