import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tutorial, TUTORIAL_STEPS } from '../../../src/systems/Tutorial.js';

test('tutorial: 9 passos na ordem pedida, avançando por ação', () => {
  assert.deepEqual(TUTORIAL_STEPS.map((s) => s.event), ['walk', 'sprint', 'zoom', 'punch', 'inventory', 'craft', 'food', 'campfire', 'skill']);
  const t = new Tutorial();
  const events = [];
  t.onChange((e) => events.push(e.type));
  t.start();
  assert.equal(t.notify('zoom'), false, 'evento fora de ordem é ignorado');
  t.notify('walk', 5);
  assert.equal(t.step.id, 'mover');
  t.notify('walk', 5);
  assert.equal(t.step.id, 'correr');
  for (const s of TUTORIAL_STEPS.slice(1)) t.notify(s.event, s.need);
  assert.equal(t.done, true);
  assert.equal(events.at(-1), 'done');
});
