import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GEAR_CATALOG, TIER_IDS } from '../../../src/config/gear.js';
import { GEAR_ICONS } from '../../../src/config/gearIcons.js';
import { GearModels, MODEL_BUILDERS } from '../../../src/render/gear/GearModels.js';
import { HeldItem } from '../../../src/render/gear/HeldItem.js';
import { gripOf, POSES, GRIPS } from '../../../src/config/gearGrips.js';
import { Humanoid } from '../../../src/entities/Humanoid.js';
import { ICON_KEYS } from '../../../src/ui/Icons.js';
import { gearStats } from '../../../src/ui/gear/ItemIcon.js';

const size = (o) => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());

test('modelos_todoItemTemModeloProprio_comTamanhoDeMao', () => {
  const models = new GearModels(), builders = MODEL_BUILDERS();
  for (const [id, d] of Object.entries(GEAR_CATALOG)) {
    assert.ok(builders.includes(d.model.builder), `${id}: sem construtor "${d.model.builder}"`);
    const s = size(models.create(id)), max = Math.max(s.x, s.y, s.z);
    assert.ok(max > 0.02 && max < 1.4, `${id}: tamanho ${max.toFixed(2)} m fora do razoável`);
  }
});

test('modelos_pedraTemGeometriaPropria_naoSoOutraCor', () => {
  const models = new GearModels();
  const tris = (id) => { let n = 0; models.prototype(id).traverse((o) => { if (o.isMesh) n += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; }); return n; };
  for (const base of ['adaga', 'espada', 'machado', 'picareta']) {
    assert.notEqual(tris(`${base}_pedra`), tris(`${base}_metal`), `${base}: pedra e metal com a mesma malha`);
    assert.equal(tris(`${base}_ouro`), tris(`${base}_metal`), `${base}: ouro e metal compartilham a forma`);
    const mats = (id) => { const s = new Set(); models.prototype(id).traverse((o) => { if (o.isMesh) s.add(o.material); }); return s; };
    const [pedra, ouro, metal] = TIER_IDS.map((t) => mats(`${base}_${t}`));
    assert.ok([...pedra].some((m) => m.flatShading), `${base}_pedra sem faces lascadas`);
    assert.ok([...ouro].some((m) => m.metalness > 0.8) && [...metal].some((m) => m.metalness > 0.8));
    assert.ok(![...ouro].some((m) => metal.has(m) && m.metalness > 0.8), `${base}: ouro usando o material do aço`);
  }
});

test('modelos_clonesCompartilhamGeometria_semRecarregar', () => {
  const models = new GearModels(), a = models.create('rifle'), b = models.create('rifle');
  const geos = (o) => { const out = []; o.traverse((x) => { if (x.isMesh) out.push(x.geometry); }); return out; };
  assert.notEqual(a, b);
  assert.deepEqual(geos(a), geos(b), 'equipar de novo não cria geometria');
  assert.equal(models.protos.size, 1);
  // peças móveis existem em cada cópia
  for (const m of [a, b]) { assert.ok(m.userData.parts.magazine?.isObject3D); assert.ok(m.userData.parts.slide?.isObject3D); }
  assert.notEqual(a.userData.parts.magazine, b.userData.parts.magazine);
  const bow1 = models.create('arco'), bow2 = models.create('arco');
  assert.notEqual(bow1.userData.parts.string.geometry, bow2.userData.parts.string.geometry, 'cada arco puxa a sua corda');
});

test('icones_todoItemTemIconeDeLinhaEColorido', () => {
  for (const [id, d] of Object.entries(GEAR_CATALOG)) {
    assert.ok(ICON_KEYS.includes(d.icon), `${id}: ícone de linha "${d.icon}" não existe`);
    assert.ok(GEAR_ICONS.has(id), `${id}: sem PNG colorido`);
    assert.equal(d.image, `assets/icons/items/${id}.png`);
  }
});

test('empunhadura_todoItemTemPoseEPontoConfiguraveis', () => {
  for (const [id, d] of Object.entries(GEAR_CATALOG)) {
    const g = gripOf(d);
    assert.ok(POSES[g.pose], `${id}: pose "${g.pose}"`);
    assert.equal(g.pos.length, 3); assert.equal(g.rot.length, 3); assert.ok(g.scale > 0);
    assert.equal(g.fp.pos.length, 3); assert.equal(g.fp.rot.length, 3);
  }
  assert.equal(gripOf(GEAR_CATALOG.adaga_metal).pose, 'one');
  assert.equal(gripOf(GEAR_CATALOG.machado_pedra).pose, 'two');
  assert.equal(gripOf(GEAR_CATALOG.pistola).pose, 'pistol');
  assert.equal(gripOf(GEAR_CATALOG.rifle).pose, 'rifle');
  assert.equal(gripOf(GEAR_CATALOG.arco).hand, 'S', 'o arco fica na mão de apoio; a dominante puxa a corda');
  assert.ok(GRIPS.default);
});

function rig() {
  const camera = new THREE.PerspectiveCamera();
  const humanoid = new Humanoid({ rng: () => 0.5 });
  return { camera, humanoid, held: new HeldItem({ models: new GearModels(), humanoid, camera }) };
}
const settle = (held, a = {}) => { for (let i = 0; i < 40; i++) held.update(1 / 30, a); };

test('itemNaMao_umPorVez_semDuplicarAoTrocar', () => {
  const { humanoid, held } = rig();
  const inHands = () => humanoid.hands.reduce((n, h) => n + h.children.filter((c) => c.userData.itemId).length, 0);
  held.set('espada_metal'); settle(held);
  assert.equal(inHands(), 1);
  held.set('pistola'); held.set('rifle'); held.set('pao'); // troca rápida
  settle(held);
  assert.equal(inHands(), 1); assert.equal(held.id, 'pao');
  assert.equal(held.fp.children.filter((c) => c.userData.itemId).length, 1);
  held.set(null); settle(held);
  assert.equal(inHands(), 0); assert.equal(held.fp.visible, false);
});

test('itemNaMao_maoCerta_eVisibilidadePorCamera', () => {
  const { humanoid, held } = rig();
  held.set('espada_metal'); settle(held, { firstPerson: false });
  assert.equal(held.tp.parent, humanoid.hands[1], 'espada na mão dominante (a do soco)');
  assert.equal(held.fp.visible, false);
  settle(held, { firstPerson: true });
  assert.equal(held.fp.visible, true);
  held.set('arco'); settle(held);
  assert.equal(held.tp.parent, humanoid.hands[0], 'arco na mão de apoio');
});

test('recarga_carregadorSaiSomeEVolta_ferrolhoMexe', () => {
  const { held } = rig();
  held.set('pistola'); settle(held);
  const mag = held.tp.userData.parts.magazine, slide = held.tp.userData.parts.slide;
  held.update(0, { reload: 0 });
  assert.equal(mag.position.y + 0, 0); assert.equal(mag.visible, true);
  held.update(0, { reload: 0.25 });
  assert.ok(mag.position.y < -0.05 && mag.visible, 'carregador descendo');
  held.update(0, { reload: 0.42 });
  assert.equal(mag.visible, false, 'sem carregador enquanto busca outro');
  held.update(0, { reload: 0.7 });
  assert.ok(mag.visible && mag.position.y < 0, 'carregador novo subindo');
  held.update(0, { reload: 0.84 });
  assert.ok(slide.position.z < -0.01, 'ferrolho puxado');
  held.update(0, { reload: null });
  assert.equal(mag.position.y + 0, 0); assert.equal(slide.position.z + 0, 0);
});

test('arco_cordaEFlechaAcompanhamOPreparo', () => {
  const { held } = rig();
  held.set('arco'); settle(held);
  const { string, arrow } = held.tp.userData.parts;
  const rest = string.geometry.attributes.position.getY(1);
  assert.equal(arrow.visible, false);
  held.update(0, { draw: 1 });
  assert.ok(string.geometry.attributes.position.getY(1) > rest + 0.3, 'corda puxada');
  assert.equal(arrow.visible, true);
  held.update(0, { draw: null });
  assert.equal(string.geometry.attributes.position.getY(1), rest); assert.equal(arrow.visible, false);
});

test('comerEBeber_maoDominanteSobeAteABoca', () => {
  const { humanoid, held } = rig();
  held.set('pao'); settle(held);
  const idle = humanoid.elbows[1].rotation.x;
  humanoid.update(0, 0, {});
  held.update(0, { consume: 0.5 });
  assert.ok(humanoid.elbows[1].rotation.x < idle - 0.8, 'cotovelo dobra para levar à boca');
});

test('descricaoNaMochila_naoDestacaDanoZero', () => {
  for (const [id, d] of Object.entries(GEAR_CATALOG)) {
    const txt = gearStats(d).join(' | ');
    if (d.damage === 0 && d.equipment !== 'bow') assert.ok(!/Dano/.test(txt), `${id} mostra dano 0`);
    if (d.damage > 0) assert.match(txt, new RegExp(`Dano: <b>${d.damage}</b>`), id);
    if (d.kind === 'food' || d.kind === 'material' || d.kind === 'relic') assert.ok(!/Durabilidade/.test(txt), `${id} mostra durabilidade`);
  }
  assert.match(gearStats(GEAR_CATALOG.pistola, { durability: 100, mag: 3 }).join('|'), /gear-low/);
  assert.match(gearStats(GEAR_CATALOG.pistola, { durability: 0, mag: 3 }).join('|'), /quebrado/);
});
