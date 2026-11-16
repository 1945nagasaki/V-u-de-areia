import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { stridePlan, flightWindow, jumpEnvelope, legCycle, fract } from '../../../src/entities/anim/AnimMath.js';
import { AnimalAnimationManager } from '../../../src/entities/anim/AnimalAnimationManager.js';
import { SPECIES } from '../../../src/config/fauna.js';
import { ANIMATION } from '../../../src/config/animation.js';

const G = ANIMATION.gait;
const LEGS = ['LH', 'LF', 'RH', 'RF']; // ordem do vetor de fases: [traseira E, dianteira E, traseira D, dianteira D]
/** Instante (em ciclos) em que cada pata pousa, em ordem. */
const footfalls = (phases) => phases.map((o, i) => [fract(1 - o), LEGS[i]]).sort((a, b) => a[0] - b[0]).map(([, n]) => n);
/** Gira a lista para começar em `first`. */
const from = (list, first) => { const i = list.indexOf(first); return [...list.slice(i), ...list.slice(0, i)]; };

function rigOf() {
  const g = () => new THREE.Group();
  const r = { spine: [g(), g()], neck: g(), head: g(), jaw: g(), ribs: g(), tail: [g(), g()], legs: [], extra: [], chains: [] };
  for (const [front, side] of [[false, -1], [true, -1], [false, 1], [true, 1]]) r.legs.push({ upper: g(), lower: g(), front, side, len: 0.8, knee: 0.4 });
  return r;
}
const make = () => {
  const pose = new THREE.Group(), rig = rigOf();
  const anim = new AnimalAnimationManager({ spec: SPECIES.leao, speciesId: 'leao', pose, rig, dims: { L: 2.3, H: 1.2, legTop: 0.8, torsoH: 0.4 }, rng: () => 0.5 });
  return { anim, rig, pose };
};
const run = (anim, secs, ctx, dt = 1 / 60, each = null) => {
  for (let t = 0; t < secs; t += dt) { anim.update(dt, typeof ctx === 'function' ? ctx(t) : ctx); each?.(t); }
};

// ---------------------------------------------------------------- passo

test('walk_footfallOrder_isLateralSequence_RF_LH_LF_RH', () => {
  assert.deepEqual(from(footfalls(G.phases.walk), 'RF'), ['RF', 'LH', 'LF', 'RH']);
});

test('walk_alwaysHasAtLeastTwoFeetOnGround', () => {
  for (let ph = 0; ph < 1; ph += 0.005) {
    const down = G.phases.walk.filter((o) => fract(ph + o) < G.duty.walk).length;
    assert.ok(down >= 2, `fase ${ph.toFixed(3)}: ${down} patas`);
  }
});

test('walk_bodyShiftsWeightSideToSide_oncePerCycle', () => {
  const { anim, pose } = make();
  run(anim, 2, { speed: 1.3, state: 'wander' });
  let min = Infinity, max = -Infinity;
  run(anim, 3, { speed: 1.3, state: 'wander' }, 1 / 60, () => { min = Math.min(min, pose.position.x); max = Math.max(max, pose.position.x); });
  assert.ok(max > 0.004 && min < -0.004, `desloca para os dois lados (${min.toFixed(4)} .. ${max.toFixed(4)})`);
  assert.ok(Math.abs(max + min) < 0.004, 'simétrico');
});

// ---------------------------------------------------------------- sem deslize

test('stridePlan_stanceFootSpeedEqualsBodySpeed_acrossGaitsAndSpeeds', () => {
  const legLen = 0.8;
  for (const [gait, v] of [['walk', 0.8], ['walk', 1.3], ['trot', 3.5], ['gallop', 7], ['gallop', 9.5], ['gallop', 11]]) {
    const hz = Math.min(G.maxHz, Math.max(G.minHz, G.cadenceK * Math.sqrt(v / legLen)));
    const { duty, amp } = stridePlan(v, legLen, hz, G.duty[gait], G.maxSwing, G.minDuty);
    // No apoio o quadril varre 2·amp rad em duty/hz s → velocidade da pata no chão.
    const footSpeed = (2 * amp * legLen * hz) / duty;
    assert.ok(Math.abs(footSpeed - v) < 1e-6 * Math.max(1, v), `${gait} a ${v} m/s: pata a ${footSpeed.toFixed(3)} m/s`);
    assert.ok(amp <= G.maxSwing + 1e-12 && duty <= G.duty[gait] && duty >= G.minDuty);
  }
});

test('stridePlan_slowSpeeds_keepNominalDuty_fastSpeedsShortenStance', () => {
  assert.equal(stridePlan(1, 0.8, 1, 0.64, 0.62).duty, 0.64);
  const fast = stridePlan(9.5, 0.8, 2.6, 0.38, 0.62);
  assert.ok(fast.duty < 0.38 && fast.amp === 0.62, `apoio ${fast.duty.toFixed(3)}`);
});

test('gallop_stanceLegSweepsLinearly_noSlideInTheRig', () => {
  // A coxa de uma pata, durante o apoio, gira a velocidade angular constante v/perna (± suavização do osso).
  const { anim, rig } = make();
  const v = 9.5, dt = 1 / 240, leg = rig.legs[0].upper, e = new THREE.Euler();
  run(anim, 2, { speed: v, state: 'chase' }, dt);
  const rates = [];
  let prev = e.setFromQuaternion(leg.quaternion, 'YXZ').x;
  run(anim, 1.5, { speed: v, state: 'chase' }, dt, () => {
    const x = e.setFromQuaternion(leg.quaternion, 'YXZ').x;
    rates.push((x - prev) / dt);
    prev = x;
  });
  // Apoio = a coxa girando para trás (taxa positiva em X): pega o trecho estável (mediana das taxas positivas).
  const stance = rates.filter((r) => r > 0).sort((a, b) => a - b);
  const median = stance[Math.floor(stance.length / 2)];
  const expected = v / 0.8; // rad/s para a pata ficar parada no chão
  assert.ok(Math.abs(median - expected) / expected < 0.12, `coxa a ${median.toFixed(2)} rad/s, esperado ${expected.toFixed(2)}`);
});

// ---------------------------------------------------------------- galope

test('gallop_hasFlightPhase_withAllFeetOffGround', () => {
  const f = flightWindow(G.phases.gallop, G.duty.gallop);
  assert.ok(f.length >= 0.08, `fase aérea de ${(f.length * 100).toFixed(0)}% do ciclo`);
  assert.equal(G.phases.gallop.filter((o) => fract(f.center + o) < G.duty.gallop).length, 0);
  assert.equal(flightWindow(G.phases.walk, G.duty.walk).length, 0, 'no passo nunca voa');
});

test('gallop_bodyIsHighestDuringFlight_notDuringStance', () => {
  const { anim, pose } = make();
  run(anim, 2, { speed: 9.5, state: 'chase' });
  let top = -Infinity, topPhase = 0;
  run(anim, 1.2, { speed: 9.5, state: 'chase' }, 1 / 240, () => { if (pose.position.y > top) { top = pose.position.y; topPhase = anim.phase; } });
  const d = Math.abs(fract(topPhase - anim.flight.center + 0.5) - 0.5);
  assert.ok(d < 0.12, `pico a ${d.toFixed(3)} ciclos do meio da fase aérea`);
});

// ---------------------------------------------------------------- salto

const J = ANIMATION.jump;

test('jumpEnvelope_phasesInOrder_andContinuousAtSeams', () => {
  const at = (t) => jumpEnvelope(t, J);
  assert.equal(at(J.anticipation * 0.5).phase, 'anticipation');
  assert.equal(at(J.anticipation + J.flight * 0.5).phase, 'flight');
  assert.equal(at(J.anticipation + J.flight + J.landing * 0.5).phase, 'landing');
  assert.equal(at(J.anticipation + J.flight + J.landing).phase, 'done');
  const dt = 1 / 240;
  let prev = at(0);
  for (let t = dt; t < prev.total + 0.1; t += dt) {
    const cur = at(t);
    // O agachar muda rápido de propósito em dois pontos: o impulso (estica) e o impacto (afunda).
    for (const k of ['air', 'arc', 'reach']) assert.ok(Math.abs(cur[k] - prev[k]) < 0.08, `${k} pulou em t=${t.toFixed(3)}`);
    assert.ok(Math.abs(cur.crouch - prev.crouch) < 0.2, `crouch pulou em t=${t.toFixed(3)}`);
    prev = cur;
  }
});

test('jumpEnvelope_arcIsZeroOnGround_peaksMidFlight_pitchUpThenDown', () => {
  const at = (t) => jumpEnvelope(t, J);
  assert.equal(at(J.anticipation * 0.9).arc, 0, 'antecipação: no chão');
  assert.equal(at(J.anticipation + J.flight + 0.01).arc, 0, 'aterrissagem: no chão');
  assert.ok(Math.abs(at(J.anticipation + J.flight / 2).arc - 1) < 1e-9, 'ápice no meio do voo');
  assert.ok(at(J.anticipation + J.flight * 0.2).pitch > 0 && at(J.anticipation + J.flight * 0.8).pitch < 0);
});

test('jump_rig_squatsBeforeTakeoff_stretchesInAir_absorbsLanding_returnsToRest', () => {
  const { anim, rig, pose } = make();
  const idle = { speed: 0, state: 'chase' };
  run(anim, 1, idle);
  const y0 = pose.position.y, hind = rig.legs[0].lower, front = rig.legs[1].upper, e = new THREE.Euler();
  const knee = () => 2 * Math.acos(Math.min(1, Math.abs(hind.quaternion.w))); // ângulo total (Euler dobraria acima de 90°)
  const knee0 = knee();
  let t = 0;
  const step = (secs) => run(anim, secs, () => ({ speed: 0, state: 'chase', jump: jumpEnvelope((t += 1 / 60), J) }));
  step(J.anticipation);
  assert.ok(pose.position.y < y0 - 0.05, `agachou ${(y0 - pose.position.y).toFixed(3)} m`);
  assert.ok(knee() > knee0 + 0.2, 'joelhos de trás dobrados (carregando o impulso)');
  step(J.flight * 0.5);
  assert.ok(pose.position.y > y0 - 0.02, 'no ar o corpo não está agachado');
  assert.ok(e.setFromQuaternion(front.quaternion, 'YXZ').x < -0.5, 'dianteiras esticadas à frente');
  step(J.flight * 0.5 + J.landing * 0.3);
  assert.ok(pose.position.y < y0 - 0.04, `amorteceu ${(y0 - pose.position.y).toFixed(3)} m`);
  step(J.landing * 0.7);
  run(anim, 0.6, idle);
  assert.ok(Math.abs(pose.position.y - y0) < 0.01 && Math.abs(knee() - knee0) < 0.03, 'voltou à postura');
});

test('legCycle_touchdownAndLiftoff_haveNoSwingJump', () => {
  // Emenda apoio → balanço → apoio contínua (a pata não "teleporta").
  for (const duty of [0.64, 0.38, 0.18]) {
    assert.ok(Math.abs(legCycle(duty - 1e-6, duty).swing - legCycle(duty + 1e-6, duty).swing) < 1e-3);
    assert.ok(Math.abs(legCycle(1 - 1e-6, duty).swing - legCycle(0, duty).swing) < 1e-3);
  }
});

// ---------------------------------------------------------------- contato com o chão

test('contactDrop_stanceLegsSetBodyHeight_noFootBelowGround', async () => {
  const { contactDrop, legReach } = await import('../../../src/entities/anim/AnimMath.js');
  const leg = (hip, knee, stance, extra = {}) => ({ l1: 0.4, l2: 0.4, hip, knee, stance, ...extra });
  assert.equal(contactDrop([leg(0, 0, true), leg(0, 0, true)]), 0, 'parado, pernas a prumo: altura cheia');
  // Uma apoiada inclinada 0,5 rad e outra a prumo: vale a que alcança mais longe (a prumo).
  assert.equal(contactDrop([leg(0.5, 0, true), leg(0, 0, true)]), 0);
  // Todas as apoiadas inclinadas: o corpo desce exatamente o que a mais comprida perde.
  const d = contactDrop([leg(0.5, 0, true), leg(-0.3, 0, true)]);
  assert.ok(Math.abs(d - (legReach(0.4, 0.4, -0.3, 0) - 0.8)) < 1e-12 && d < 0);
  // Nenhuma pata no chão (fase aérea): volta à altura de repouso, não agacha no ar.
  assert.equal(contactDrop([leg(0.6, 0.9, false), leg(-0.6, 0.9, false)]), 0);
  // Pata no ar esticada além das apoiadas: o corpo sobe para ela não furar o chão.
  assert.ok(contactDrop([leg(0.6, 0, true), leg(0.1, 0, false)]) > contactDrop([leg(0.6, 0, true)]));
});

test('contactDrop_slantedRestPose_canRaiseBody_upToTheCap', async () => {
  const { contactDrop } = await import('../../../src/entities/anim/AnimMath.js');
  // Perna inclinada 0,5 rad no repouso (modelo esculpido no meio de um passo), 0,8 m de altura de quadril.
  const k = 1 / Math.cos(0.5), slanted = (extra) => ({ l1: 0.4 * k, l2: 0.4 * k, rest: 0.8, knee: 0, stance: true, hip: 0.5 + extra });
  assert.ok(Math.abs(contactDrop([slanted(0)])) < 1e-12, 'na pose de repouso: sem deslocamento');
  assert.ok(contactDrop([slanted(-0.3)]) > 0, 'mais a prumo que o repouso: sobe');
  assert.ok(contactDrop([slanted(-0.5)], 0.05) <= 0.8 * 0.05 + 1e-12, 'limitado ao teto');
});

test('walk_and_run_bodyHeightFollowsLegs_staysWithinLegLength', () => {
  const { anim, pose } = make();
  for (const ctx of [{ speed: 1.3, state: 'wander' }, { speed: 9.5, state: 'chase' }]) {
    run(anim, 2, ctx);
    let min = Infinity, max = -Infinity;
    run(anim, 2, ctx, 1 / 60, () => { min = Math.min(min, pose.position.y); max = Math.max(max, pose.position.y); });
    assert.ok(min > -0.8 * 0.5 && max < 0.25, `altura do corpo entre ${min.toFixed(3)} e ${max.toFixed(3)} m`);
    assert.ok(max - min > 0.002, 'o corpo sobe e desce com a passada');
  }
});
