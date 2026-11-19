import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Cutscene } from '../../../src/ui/PrologueScreens.js';

// sources() só lê os campos de URL: dá para testar sem DOM.
const cfg = { url: '/a.mp4', urlWebm: '/a.webm', hostedUrl: '/_blob/m', hostedUrlWebm: '/_blob/w' };
const sources = (c, mp4) => Cutscene.prototype.sources.call(c, () => (mp4 ? 'probably' : ''));

test('cutscene: com H.264, MP4 local, WebM local, depois as cópias hospedadas', () => {
  assert.deepEqual(sources(cfg, true), ['/a.mp4', '/a.webm', '/_blob/m', '/_blob/w']);
});
test('cutscene: sem H.264, WebM primeiro em cada grupo', () => {
  assert.deepEqual(sources(cfg, false), ['/a.webm', '/a.mp4', '/_blob/w', '/_blob/m']);
});
test('cutscene: ignora fontes ausentes', () => {
  assert.deepEqual(sources({ url: '/a.mp4' }, false), ['/a.mp4']);
});
