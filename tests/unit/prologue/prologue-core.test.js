import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DrowningTimer } from '../../../src/systems/prologue/DrowningTimer.js';
import { Checkpoint } from '../../../src/systems/prologue/Checkpoint.js';
import { PROLOGUE } from '../../../src/config/prologue.js';

const T = PROLOGUE.timer;
const run = (t, secs, dt = 0.5) => { const out = []; for (let s = 0; s < secs - 1e-9; s += dt) out.push(...t.tick(dt)); return out; };

test('cronometro_sao600Segundos_eExpiraNoFim', () => {
  const t = new DrowningTimer(T);
  assert.equal(T.seconds, 600);
  assert.equal(t.label, '10:00');
  run(t, 599);
  assert.equal(t.expired, false);
  assert.equal(t.label, '00:01');
  run(t, 1);
  assert.ok(t.expired);
  assert.equal(t.remaining, 0);
});

test('cronometro_pausado_dtZero_naoAnda', () => {
  const t = new DrowningTimer(T);
  run(t, 100);
  for (let i = 0; i < 1000; i++) t.tick(0); // Esc: o jogo passa dt = 0
  assert.equal(t.elapsed, 100);
});

test('exaustao_zeroAte7Min_sobeEm7_8_9_eChegaAoMaximo', () => {
  const t = new DrowningTimer(T);
  run(t, 419);
  assert.equal(t.exhaustion, 0, 'antes dos 7 min');
  run(t, 51); // 470 s
  const e7 = t.exhaustion;
  run(t, 60); // 530 s
  const e8 = t.exhaustion;
  run(t, 70); // 600 s
  const e9 = t.exhaustion;
  assert.ok(e7 > 0.25 && e7 < 0.4, `7 min: ${e7}`);
  assert.ok(e8 > e7 && e8 < 0.7, `8 min: ${e8}`);
  assert.ok(e9 > 0.95, `9 min+: ${e9}`);
});

test('exaustao_sobeSemSaltos', () => {
  const t = new DrowningTimer(T);
  let prev = 0, worst = 0;
  for (let s = 0; s < 600; s += 0.1) { t.tick(0.1); worst = Math.max(worst, Math.abs(t.exhaustion - prev)); prev = t.exhaustion; }
  assert.ok(worst < 0.02, `maior salto por 0,1 s: ${worst}`);
});

test('avisos_7_8_9min_umaVezCada', () => {
  const t = new DrowningTimer(T);
  assert.deepEqual(run(t, 600, 0.25), [420, 480, 540]);
});

test('chegouAIlha_paraOCronometro_semExpirar_semExaustao', () => {
  const t = new DrowningTimer(T);
  run(t, 590);
  t.stop();
  run(t, 60);
  assert.equal(t.expired, false);
  assert.equal(t.exhaustion, 0);
  assert.equal(t.elapsed, 590);
});

test('checkpoint_salvaECarrega_eRecusaLixo', () => {
  const mem = new Map();
  const store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  const cp = new Checkpoint('k', store);
  assert.equal(cp.load(), null);
  cp.save({ x: 1, y: 2, z: 3, yaw: 0.5, phase: 'ilha' });
  const d = cp.load();
  assert.equal(d.x, 1); assert.equal(d.phase, 'ilha'); assert.ok(d.savedAt > 0);
  mem.set('k', '{quebrado');
  assert.equal(cp.load(), null);
  mem.set('k', JSON.stringify({ v: 1, x: 'a', y: 0, z: 0 }));
  assert.equal(cp.load(), null);
  cp.clear();
  assert.equal(cp.exists, false);
});

test('checkpoint_semArmazenamento_naoQuebra', () => {
  const cp = new Checkpoint('k', null);
  assert.equal(cp.save({ x: 0, y: 0, z: 0 }), false);
  assert.equal(cp.load(), null);
});
