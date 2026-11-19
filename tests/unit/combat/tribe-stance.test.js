import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TribeStance } from '../../../src/combat/TribeStance.js';
import { TRIBE_BEHAVIOR } from '../../../src/config/tribeBehavior.js';
import { CombatEntity } from '../../../src/combat/CombatEntity.js';
import { CombatWorld } from '../../../src/combat/CombatWorld.js';
import { createSkills } from '../../../src/combat/Skill.js';
import { EnemyAI } from '../../../src/combat/EnemyAI.js';
import { MELEE } from '../../../src/config/meleeCombat.js';

const T = TRIBE_BEHAVIOR.tribes;
const V = { x: 0, z: 0, radius: 100 };
const at = (d) => ({ x: d, z: 0 });
const stance = (id) => new TribeStance(id, T[id], V);

test('cadaTribo_temARegraDoCanone', () => {
  assert.equal(T.coroaAlta.rule, 'onSight');
  assert.equal(T.maoCerrada.rule, 'onSight');
  assert.equal(T.brasaViva.rule, 'territorial');
  assert.equal(T.pousoLento.rule, 'territorial');
  assert.equal(T.veuCarmesim.rule, 'provoked');
  assert.equal(T.mesaFarta.rule, 'provoked');
  assert.equal(T.espelhoTurvo.rule, 'ambush');
});

test('forcaRelativa_coroaAltaMaisForte_brasaVivaSegunda', () => {
  const power = (t) => t.health * t.damage;
  const ranked = Object.entries(T).sort((a, b) => power(b[1]) - power(a[1])).map(([k]) => k);
  assert.deepEqual(ranked.slice(0, 2), ['coroaAlta', 'brasaViva']);
});

test('onSight_semprePodeAtacar_alertaAoEntrarNaCidade', () => {
  const s = stance('coroaAlta');
  s.update(0, at(300));
  assert.ok(s.hostile(0), 'ataca quem vir');
  assert.equal(s.alert(0), false, 'fora da cidade: só quem vê');
  assert.equal(s.update(1, at(50)), 'spotted');
  assert.ok(s.alert(1), 'dentro: o bando inteiro vem');
});

test('territorial_avisaNaMargem_atacaDentro_perseguePorUmTempoDepoisDeSair', () => {
  const s = stance('brasaViva');
  assert.equal(s.update(0, at(300)), null);
  assert.equal(s.hostile(0), false, 'em paz do lado de fora');
  assert.equal(s.update(1, at(100 + 10)), 'warn', 'margem: avisa uma vez');
  assert.equal(s.update(2, at(100 + 9)), null);
  assert.equal(s.hostile(2), false, 'aviso não é ataque');
  assert.equal(s.update(3, at(80)), 'spotted');
  assert.ok(s.hostile(3));
  s.update(4, at(140)); // saiu correndo
  assert.ok(s.hostile(4), 'ainda persegue');
  assert.equal(s.update(4 + T.brasaViva.grudge + 1, at(300)), 'calm');
});

test('pousoLento_cacaAteOFim_rixaLonga', () => {
  assert.ok(T.pousoLento.grudge > T.brasaViva.grudge * 3);
});

test('provocado_emPazAteAlguemDaTriboApanhar', () => {
  const s = stance('mesaFarta');
  s.update(0, at(20));
  assert.equal(s.hostile(0), false, 'dentro da vila e em paz (são amigáveis)');
  s.provoke(5);
  assert.equal(s.update(5, at(20)), 'spotted');
  assert.ok(s.hostile(10) && s.alert(10));
  assert.equal(s.update(5 + T.mesaFarta.grudge + 1, at(20)), 'calm', 'a rixa passa');
});

test('emboscada_soDepoisDeRevelar_eVoltaAEsconder', () => {
  const s = stance('espelhoTurvo');
  s.update(0, at(20));
  assert.equal(s.hostile(0), false, 'escondidos: ninguém ataca');
  s.reveal(1);
  assert.equal(s.update(1, at(20)), 'spotted');
  assert.ok(s.hostile(2));
  s.update(1 + T.espelhoTurvo.grudge + 1, at(300));
  assert.equal(s.revealed, false, 'voltam a se esconder');
});

// ------------------------------------------------------------ IA com a postura
function body(x, z) {
  const b = { pos: { x, y: 0, z }, facing: { x: 0, z: 1 }, move(dx, dz) { b.pos.x += dx; b.pos.z += dz; }, face(fx, fz) { const l = Math.hypot(fx, fz) || 1; b.facing.x = fx / l; b.facing.z = fz / l; } };
  return b;
}
function warrior(stanceObj) {
  const e = new CombatEntity({ name: 'g', team: 'enemy', body: body(0, 0) });
  createSkills(MELEE.skills).forEach((s) => e.addSkill(s));
  const ai = new EnemyAI(e, { ...MELEE.ai, aggroRadius: 40, leashRadius: 200 }, {
    home: { x: 0, z: 0 }, random: () => 0.3,
    hostile: () => stanceObj.hostile(0), alert: () => stanceObj.alert(0),
    patrol: TRIBE_BEHAVIOR.patrol,
  });
  ai.thinkT = 0;
  return { e, ai };
}

test('ia_tribalEmPaz_naoAtacaJogadorColado_eFazRonda', () => {
  const s = stance('veuCarmesim');
  const { e, ai } = warrior(s);
  const p = new CombatEntity({ name: 'p', team: 'player', body: body(0, 1.5) });
  const w = new CombatWorld({ feel: MELEE.feel }); w.add(e); w.add(p);
  const it = ai.update(1 / 60, w, p);
  assert.equal(e.skill, null, 'não atacou');
  assert.equal(ai.mode, 'patrol');
  assert.ok(it.speed > 0, 'anda na ronda');
});

test('ia_tribalProvocada_ataca', () => {
  const s = stance('veuCarmesim');
  s.provoke(-1);
  const { e, ai } = warrior(s);
  const p = new CombatEntity({ name: 'p', team: 'player', body: body(0, 1.5) });
  const w = new CombatWorld({ feel: MELEE.feel }); w.add(e); w.add(p);
  ai.update(1 / 60, w, p);
  assert.ok(e.skill, 'atacou');
});

test('ia_alerta_convergeDeLonge', () => {
  const s = stance('coroaAlta');
  s.update(0, at(10)); // jogador dentro da cidade: alerta
  const { e, ai } = warrior(s);
  const p = new CombatEntity({ name: 'p', team: 'player', body: body(0, 90) }); // 90 m, fora do raio de visão (40)
  const w = new CombatWorld({ feel: MELEE.feel }); w.add(e); w.add(p);
  const it = ai.update(1 / 60, w, p);
  assert.equal(ai.mode, 'approach');
  assert.ok(it.mz > 0.9 && it.speed > 2, 'corre até o jogador');
});

test('emboscada_cadaGuerreiroDeTocaiaPertoDeUmLaco', async () => {
  // Regressão (visto no jogo): o laço disparava a emboscada, mas todos os guerreiros estavam a mais de 35 m.
  const { TribeController } = await import('../../../src/systems/TribeController.js');
  const fake = { game: { villages: { espelhoTurvo: { x: 0, z: 0, radius: 150, npcSpots: [] } } }, world: { on() {}, time: 0 }, player: {} };
  const tc = new TribeController(fake);
  const t = tc.byId.get('espelhoTurvo');
  const traps = tc.trapSpots(t), posts = tc.posts(t), R = T.espelhoTurvo.revealRadius;
  assert.equal(posts.length, TRIBE_BEHAVIOR.warriors);
  for (const p of posts) {
    const d = Math.min(...traps.map((tr) => Math.hypot(p.x - tr.x, p.z - tr.z)));
    assert.ok(d < R * 0.6, `guerreiro a ${d.toFixed(1)} m do laço mais perto`);
  }
});
