import { test } from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld, initPhysics, fixedSteps } from '../../../src/physics/PhysicsWorld.js';
import { CollisionWorld } from '../../../src/world/CollisionWorld.js';
import { PHYSICS, PROP_TYPES } from '../../../src/config/physics.js';

await initPhysics();

const CRATE_HALF = PROP_TYPES.crate.shape.half[1];
const run = (pw, pos, secs, dt = 1 / 60) => { for (let t = 0; t < secs - 1e-9; t += dt) pw.update(dt, pos); };
const ORIGIN = { x: 0, y: 0, z: 0 };

// ---------------------------------------------------------------- escala real

test('world_gravityIsRealEarthGravity_andStepIsOneSixtieth', () => {
  const pw = new PhysicsWorld({ groundAt: () => 0, collisions: new CollisionWorld() });
  assert.deepEqual({ ...pw.world.gravity }, { x: 0, y: -9.81, z: 0 });
  assert.ok(Math.abs(pw.world.timestep - 1 / 60) < 1e-9);
  assert.equal(PHYSICS.maxFrame, 0.25);
});

test('freeFall_oneSecond_dropsAboutHalfGTSquared', () => {
  const pw = new PhysicsWorld({ groundAt: () => 0, collisions: new CollisionWorld() });
  const p = pw.addProp('crate', { x: 2, z: 0 });
  pw.placeProp(p, { x: 2, y: 30, z: 0 });
  run(pw, ORIGIN, 1);
  const fell = 30 - p.pos.y, ideal = 0.5 * 9.81; // 4,905 m (a resistência do ar tira alguns cm)
  assert.ok(fell > ideal * 0.93 && fell < ideal * 1.03, `caiu ${fell.toFixed(3)} m em 1 s`);
});

// ---------------------------------------------------------------- passo fixo

test('fixedSteps_decouplesFromFrameRate_andCapsLongFrames', () => {
  const cfg = { step: 1 / 60, maxFrame: 0.25 };
  assert.equal(fixedSteps(0, 1 / 60, cfg).steps, 1);
  assert.equal(fixedSteps(0, 1 / 30, cfg).steps, 2);
  const slow = fixedSteps(0, 1 / 144, cfg); // monitor de 144 Hz: acumula até dar um passo
  assert.equal(slow.steps, 0);
  assert.ok(Math.abs(slow.acc - 1 / 144) < 1e-12);
  assert.equal(fixedSteps(0, 5, cfg).steps, 15, 'aba 5 s sem foco: só 0,25 s simulados');
  let acc = 0, total = 0;
  for (let i = 0; i < 144; i++) { const r = fixedSteps(acc, 1 / 144, cfg); acc = r.acc; total += r.steps; }
  assert.ok(total === 59 || total === 60, `1 s a 144 FPS = ${total} passos`);
});

test('simulation_sameResult_at30_60_and144Fps', () => {
  const fall = (fps) => {
    const pw = new PhysicsWorld({ groundAt: () => 0, collisions: new CollisionWorld() });
    const p = pw.addProp('crate', { x: 2, z: 0 });
    pw.placeProp(p, { x: 2, y: 20, z: 0 });
    let steps = 0;
    while (steps < 60) steps += pw.update(1 / fps, ORIGIN);
    return p.pos.y;
  };
  const a = fall(60), b = fall(30), c = fall(144);
  assert.ok(Math.abs(a - b) < 1e-6 && Math.abs(a - c) < 1e-6, `60: ${a}, 30: ${b}, 144: ${c}`);
});

// ---------------------------------------------------------------- colisões sólidas

test('heightfield_matchesTerrain_onBothAxes', () => {
  for (const [name, ground] of [['rampa em X', (x) => 0.2 * x], ['rampa em Z', (_x, z) => 0.2 * z]]) {
    const pw = new PhysicsWorld({ groundAt: ground, collisions: new CollisionWorld() });
    pw.update(1 / 60, ORIGIN);
    for (const [x, z] of [[10.3, -6.4], [-14.7, 8.2], [3.1, 17.6]]) { // fora dos vértices da malha (raio exatamente num vértice não acerta)
      const hit = pw.world.castRay(new RAPIER.Ray({ x, y: 50, z }, { x: 0, y: -1, z: 0 }), 100, true);
      assert.ok(hit, `${name}: raio acertou o chão em (${x}, ${z})`);
      const y = 50 - (hit.timeOfImpact ?? hit.toi);
      assert.ok(Math.abs(y - ground(x, z)) < 0.02, `${name} em (${x}, ${z}): chão físico ${y.toFixed(3)}, terreno ${ground(x, z).toFixed(3)}`);
    }
  }
});

test('ccd_fastObject_doesNotTunnelThroughThinWall', () => {
  const cw = new CollisionWorld();
  cw.addBox(6, 0, 0.05, 4, 0, 'wall'); // parede de 10 cm em x = 6
  const pw = new PhysicsWorld({ groundAt: () => 0, collisions: cw });
  const p = pw.addProp('crate', { x: 1, z: 0 });
  run(pw, ORIGIN, 0.1);
  // 240 m/s = 4 m por passo, contra uma parede de 10 cm. (Nesta escala os contatos preditivos do Rapier
  // já seguram o caixote mesmo sem CCD; o teste garante o comportamento, e o teste de `isCcdEnabled` garante a opção.)
  pw.placeProp(p, { x: 1, y: 1.5, z: 0 }, { x: 240, y: 0, z: 0 });
  run(pw, ORIGIN, 1.5);
  assert.ok(p.pos.x < 6, `parou em x=${p.pos.x.toFixed(2)} (parede em 6)`);
});

test('bodies_playerIsKinematicCapsuleWithCcd_propsHaveDampingAndCcd', () => {
  const pw = new PhysicsWorld({ groundAt: () => 0, collisions: new CollisionWorld() });
  const p = pw.addProp('barrel', { x: 2, z: 0 });
  pw.update(1 / 60, ORIGIN);
  assert.ok(pw.player.isKinematic() && pw.player.isCcdEnabled());
  assert.ok(p.body.isDynamic() && p.body.isCcdEnabled());
  assert.ok(Math.abs(p.body.linearDamping() - PHYSICS.dynamic.linearDamping) < 1e-6);
  assert.ok(Math.abs(p.body.angularDamping() - PHYSICS.dynamic.angularDamping) < 1e-6);
  assert.ok(Math.abs(p.body.mass() - PROP_TYPES.barrel.mass) < 1e-3, `massa ${p.body.mass()}`);
  assert.ok([...pw.statics.values()].every((b) => b.isFixed()));
});

test('prop_leavingAndReenteringRadius_keepsPoseAndGetsNewBody', () => {
  const pw = new PhysicsWorld({ groundAt: () => 0, collisions: new CollisionWorld() });
  const p = pw.addProp('crate', { x: 3, z: 0 });
  pw.update(1 / 60, ORIGIN);
  pw.punch({ x: 1.6, y: 0.6, z: 0 }, { x: 1, y: 0, z: 0 });
  run(pw, ORIGIN, 3);
  const at = { ...p.pos };
  assert.ok(at.x > 3.5, 'o soco moveu o caixote');
  pw.update(1 / 60, { x: 5000, y: 0, z: 0 });
  assert.ok(!p.active && p.body === null);
  pw.update(1 / 60, ORIGIN);
  assert.ok(p.active && p.body);
  run(pw, ORIGIN, 1);
  assert.ok(Math.hypot(p.pos.x - at.x, p.pos.z - at.z) < 0.02 && Math.abs(p.pos.y - CRATE_HALF) < 0.08, 'continua onde parou, no chão');
});
