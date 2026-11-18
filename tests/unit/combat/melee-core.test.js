import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CombatFSM, STATE } from '../../../src/combat/CombatStates.js';
import { inCone, segmentHitsCylinder, HitOnce } from '../../../src/combat/Hitbox.js';
import { CombatEntity } from '../../../src/combat/CombatEntity.js';
import { CombatWorld } from '../../../src/combat/CombatWorld.js';
import { createSkills } from '../../../src/combat/Skill.js';
import { EnemyAI } from '../../../src/combat/EnemyAI.js';
import { MELEE } from '../../../src/config/meleeCombat.js';

const S = STATE;
const DT = 1 / 120;

/** Corpo falso: posição/frente por referência, move sem colisão. */
function body(x = 0, z = 0, fx = 0, fz = 1) {
  const b = {
    pos: { x, y: 0, z }, facing: { x: fx, z: fz },
    move(dx, dz) { b.pos.x += dx; b.pos.z += dz; },
    face(x2, z2) { const l = Math.hypot(x2, z2) || 1; b.facing.x = x2 / l; b.facing.z = z2 / l; },
  };
  return b;
}
function fighter(team, x = 0, z = 0, fx = 0, fz = 1, health = 100) {
  const e = new CombatEntity({ name: team, team, body: body(x, z, fx, fz), health, dodge: MELEE.player.dodge, hitstun: 0.3 });
  createSkills(MELEE.skills).forEach((s) => e.addSkill(s));
  return e;
}
function setup(...ents) {
  const w = new CombatWorld({ feel: MELEE.feel });
  ents.forEach((e) => w.add(e));
  return w;
}
const run = (w, secs) => { for (let t = 0; t < secs; t += DT) w.update(DT); };
const until = (w, pred, max = 3) => { for (let t = 0; t < max && !pred(); t += DT) w.update(DT); };

// ------------------------------------------------------------ FSM
test('fsm_atordoado_naoAtacaNemEsquiva', () => {
  const f = new CombatFSM();
  f.enter(S.STUNNED);
  assert.equal(f.canEnter(S.STARTUP), false);
  assert.equal(f.canEnter(S.DODGE), false);
});

test('fsm_duasSkillsAoMesmoTempo_recusada', () => {
  const p = fighter('player');
  const w = setup(p);
  assert.ok(p.useSkill('whirlwind', w));
  assert.equal(p.useSkill('dash', w), false, 'segunda skill no STARTUP');
  until(w, () => p.state === S.ACTIVE);
  assert.equal(p.useSkill('shockwave', w), false, 'segunda skill no ACTIVE');
});

test('esquiva_soCancelaNoRecovery_naoNoStartupNemNoActive', () => {
  const p = fighter('player');
  const w = setup(p);
  p.useSkill('whirlwind', w);
  assert.equal(p.dodge(1, 0, w), false, 'STARTUP');
  until(w, () => p.state === S.ACTIVE);
  assert.equal(p.dodge(1, 0, w), false, 'ACTIVE');
  until(w, () => p.state === S.RECOVERY);
  assert.ok(p.dodge(1, 0, w), 'RECOVERY cancela com esquiva');
  assert.equal(p.skill, null);
  run(w, 0.4);
  assert.ok(p.pos.x > 2.5, `esquivou ${p.pos.x.toFixed(2)} m`);
});

test('esquiva_invulneravelNaJanela_depoisNao', () => {
  const p = fighter('player');
  const w = setup(p);
  const hit = { damage: 10, dirX: 0, dirZ: 1, knockback: 0, heavy: false };
  p.dodge(0, -1, w);
  assert.equal(p.takeHit(hit, w), false, 'dentro dos i-frames');
  assert.equal(p.health, 100);
  run(w, MELEE.player.dodge.iframes + 0.05);
  assert.ok(p.takeHit(hit, w), 'depois da janela');
  assert.equal(p.health, 90);
});

// ------------------------------------------------------------ hitbox
test('cone_frenteAcerta_costasNao_bordaDoCorpoConta', () => {
  const o = { x: 0, y: 0, z: 0 }, f = { x: 0, z: 1 };
  const shape = { range: 2, angle: 90, height: [0.1, 2] };
  const t = (x, z) => ({ x, y: 0, z, radius: 0.4, height: 1.8 });
  assert.ok(inCone(o, f, t(0, 1.5), shape), 'frente');
  assert.equal(inCone(o, f, t(0, -1.5), shape), false, 'costas');
  assert.equal(inCone(o, f, t(0, 2.6), shape), false, 'longe');
  assert.ok(inCone(o, f, t(0, 2.35), shape), 'borda do corpo no alcance');
  // 50° fora do eixo: fora do cone de 90° pelo centro, dentro pela borda do corpo (raio 0,4 a 1 m)
  const a = (50 * Math.PI) / 180;
  assert.ok(inCone(o, f, t(Math.sin(a), Math.cos(a)), shape), 'borda do corpo alarga o cone');
  assert.equal(inCone(o, f, { ...t(0, 1), y: 3 }, shape), false, 'alto demais');
});

test('hitbox_soExisteNoActive_eAcertaUmaVezPorExecucao', () => {
  const p = fighter('player'), e = fighter('enemy', 0, 1.5, 0, -1);
  const w = setup(p, e);
  p.useSkill('combo', w);
  // STARTUP inteiro: nada
  while (p.state === S.STARTUP) { w.update(DT); if (p.state === S.STARTUP) assert.equal(e.health, 100, 'dano no STARTUP'); }
  assert.equal(p.state, S.ACTIVE);
  const dmg = 100 - e.health;
  assert.equal(dmg, MELEE.skills.combo.steps[0].damage, 'acertou no 1º quadro do ACTIVE');
  // Resto do golpe: o alvo continua no cone, mas não leva de novo
  until(w, () => p.state === S.IDLE);
  assert.equal(100 - e.health, dmg, 'uma vez só');
});

test('hitOnce_claimDevolveTrueSoNaPrimeira', () => {
  const h = new HitOnce(), a = {};
  assert.ok(h.claim(a));
  assert.equal(h.claim(a), false);
  h.reset();
  assert.ok(h.claim(a));
});

// ------------------------------------------------------------ combo
test('combo_inputNaJanela_emendaTresGolpes_terceiroMaisForte', () => {
  const p = fighter('player'), e = fighter('enemy', 0, 1.6, 0, -1, 1000);
  e.knockbackDamp = 1e9; // alvo parado (sem empurrão) para medir só o dano
  const w = setup(p, e);
  const dmg = [];
  w.on('hit', (a, t, info) => dmg.push([info.damage, info.knockback]));
  p.useSkill('combo', w);
  for (let k = 0; k < 2; k++) {
    until(w, () => p.state === S.ACTIVE);
    assert.ok(p.useSkill('combo', w), 'clique na janela aceito');
    until(w, () => p.state === S.STARTUP);
    e.pos.x = 0; e.pos.z = 1.6; e.kvx = e.kvz = 0;
  }
  until(w, () => p.state === S.IDLE);
  assert.equal(dmg.length, 3, `golpes: ${JSON.stringify(dmg)}`);
  assert.ok(dmg[2][0] > dmg[0][0] && dmg[2][1] > dmg[0][1], '3º golpe com mais dano e empurrão');
});

test('combo_inputForaDaJanela_naoEmenda', () => {
  const p = fighter('player');
  const w = setup(p);
  p.useSkill('combo', w);
  until(w, () => p.state === S.RECOVERY);
  run(w, MELEE.skills.combo.inputWindow + 0.02);
  if (p.state === S.RECOVERY) assert.equal(p.useSkill('combo', w), false, 'clique tarde demais');
  until(w, () => p.state === S.IDLE);
  assert.equal(p.skill, null);
});

test('combo_cliqueNoStartup_naoEnfileira', () => {
  const p = fighter('player');
  const w = setup(p);
  p.useSkill('combo', w);
  assert.equal(p.useSkill('combo', w), false);
});

// ------------------------------------------------------------ skills
test('investida_avancaEacertaQuemEstaNoTrajeto', () => {
  const p = fighter('player'), e = fighter('enemy', 0.3, 4, 0, -1);
  const w = setup(p, e);
  p.useSkill('dash', w);
  until(w, () => p.state === S.IDLE);
  assert.ok(p.pos.z > 5, `andou ${p.pos.z.toFixed(2)}`);
  assert.equal(e.health, 100 - MELEE.skills.dash.damage, 'uma vez, no trajeto');
});

test('giratorio_acertaEmVolta_eEmpurraParaFora', () => {
  const p = fighter('player');
  const behind = fighter('enemy', 0, -1.8), side = fighter('enemy', 1.8, 0);
  const w = setup(p, behind, side);
  p.useSkill('whirlwind', w);
  until(w, () => p.state === S.IDLE);
  assert.ok(behind.health < 100 && side.health < 100);
  assert.ok(behind.pos.z < -2.5 && side.pos.x > 2.5, 'empurrados para fora');
});

test('projetil_rapidoComQuadroLongo_naoAtravessa_eParaNoPrimeiro', () => {
  const p = fighter('player'), first = fighter('enemy', 0, 6), second = fighter('enemy', 0, 9);
  const w = setup(p, first, second);
  p.useSkill('shockwave', w);
  until(w, () => w.projectiles.length > 0);
  w.update(0.6); // um quadro enorme: 10,8 m de uma vez
  w.update(0.6);
  assert.ok(first.health < 100, 'acertou o primeiro');
  assert.equal(second.health, 100, 'parou no primeiro');
  assert.equal(w.projectiles.length, 0);
});

test('projetil_segmentoTangente_acertaPelaBorda', () => {
  const t = { x: 0.9, y: 0, z: 5, radius: 0.4, height: 1.8 };
  assert.ok(segmentHitsCylinder(0, 1, 0, 0, 1, 10, 0.55, t) >= 0);
  assert.equal(segmentHitsCylinder(0, 1, 0, 0, 1, 10, 0.4, t), -1);
});

test('hitstop_congelaOAtacanteEOAlvo', () => {
  const p = fighter('player'), e = fighter('enemy', 0, 1.5, 0, -1);
  const w = setup(p, e);
  p.useSkill('combo', w);
  until(w, () => e.health < 100);
  assert.ok(p.hitstop > 0 && e.hitstop > 0);
  const t = p.fsm.time;
  w.update(0.02);
  assert.equal(p.fsm.time, t, 'relógio do golpe parado no hitstop');
});

test('acerto_interrompeOGolpeDoAlvo_eAtordoa', () => {
  const p = fighter('player'), e = fighter('enemy', 0, 1.5, 0, -1);
  const w = setup(p, e);
  e.useSkill('shockwave', w); // STARTUP longo
  p.useSkill('combo', w);
  until(w, () => e.health < 100);
  assert.equal(e.state, S.STUNNED);
  assert.equal(e.skill, null);
  assert.equal(w.projectiles.length, 0, 'onda interrompida não saiu');
});

test('times_inimigoNaoBateEmNeutro_jogadorBate', () => {
  const w = setup();
  const npc = { x: 0, y: 0, z: 1.5, radius: 0.4, height: 1.8, team: 'neutral', alive: true, hits: 0, takeHit() { this.hits++; return true; } };
  w.passiveTargets = () => [npc];
  const e = fighter('enemy'), p = fighter('player');
  w.add(e); w.add(p); p.pos.x = 5;
  e.useSkill('whirlwind', w);
  until(w, () => e.state === S.IDLE);
  assert.equal(npc.hits, 0);
  p.pos.x = 0; p.pos.z = 0; p.facing.x = 0; p.facing.z = 1;
  p.useSkill('combo', w);
  until(w, () => p.state === S.IDLE);
  assert.equal(npc.hits, 1);
});

test('morte_paraTudo', () => {
  const p = fighter('player'), e = fighter('enemy', 0, 1.5, 0, -1, 5);
  const w = setup(p, e);
  let died = 0;
  w.on('death', () => died++);
  p.useSkill('combo', w);
  until(w, () => !e.alive);
  assert.equal(died, 1);
  assert.equal(e.useSkill('combo', w), false);
  assert.equal(e.dodge(1, 0, w), false);
});

// ------------------------------------------------------------ IA
function aiPair(dist, enemyHealth = 100) {
  const p = fighter('player', 0, dist, 0, -1);
  const e = fighter('enemy', 0, 0, 0, 1);
  e.health = enemyHealth; // vida atual (máxima continua 100)
  e.skills.get('combo').cooldown = MELEE.duelist.comboCooldown;
  const w = setup(p, e);
  const ai = new EnemyAI(e, MELEE.ai, { home: { x: 0, z: 0 }, random: () => 0.3 });
  ai.thinkT = 0;
  return { p, e, w, ai };
}

test('ia_escolheSkillPelaDistancia', () => {
  assert.equal(aiPair(1.6).ai.choose(aiPair(1.6).w, 1.6), 'combo');
  const far = aiPair(6);
  assert.equal(far.ai.choose(far.w, 6), 'dash');
  const veryFar = aiPair(12);
  assert.equal(veryFar.ai.choose(veryFar.w, 12), 'shockwave');
  const low = aiPair(1.6, 30);
  assert.equal(low.ai.choose(low.w, 1.6), 'whirlwind', 'pouca vida e colada');
});

test('ia_foraDoAggro_naoAtaca', () => {
  const { e, w, ai, p } = aiPair(MELEE.ai.aggroRadius + 3);
  ai.update(DT, w, p);
  assert.equal(e.skill, null);
});

test('ia_avisaNoStartup_antesDoDano', () => {
  const { e, w, ai, p } = aiPair(1.6);
  ai.update(DT, w, p);
  assert.equal(e.state, S.STARTUP, 'começou pelo aviso');
  let warned = 0;
  while (p.health === 100 && warned < 2) { if (e.state === S.STARTUP) warned += DT; w.update(DT); ai.update(DT, w, p); }
  assert.ok(warned >= MELEE.skills.combo.steps[0].startup - 1e-6, `aviso de ${warned.toFixed(3)} s`);
});

test('ia_tudoEmRecarga_circulaDeLado', () => {
  const { e, w, ai, p } = aiPair(3.8);
  for (const s of e.skills.values()) s.readyAt = 100;
  const it = ai.update(DT, w, p);
  assert.equal(ai.mode, 'strafe');
  // Movimento quase perpendicular à linha até o jogador (eixo z).
  assert.ok(Math.abs(it.mz) < 0.3 && Math.abs(it.mx) > 0.9, `intent ${it.mx.toFixed(2)},${it.mz.toFixed(2)}`);
  assert.ok(it.speed > 0);
});

test('combo_contraAlvoQueRecua_osTresGolpesConectam', () => {
  // Regressão (visto no jogo): o empurrão do 1º golpe tirava o alvo do alcance do 2º.
  const p = fighter('player'), e = fighter('enemy', 0, 1.6, 0, -1, 1000);
  const w = setup(p, e);
  let hits = 0;
  w.on('hit', () => hits++);
  p.useSkill('combo', w);
  for (let f = 0; f < 600 && p.skill; f++) {
    if (p.state === S.ACTIVE) p.useSkill('combo', w); // jogador clicando na janela
    w.update(DT);
  }
  assert.equal(hits, 3, `acertos: ${hits}`);
});

test('Skill.setDamageScale: todas as habilidades do jogador aceitam o multiplicador da Força', async () => {
  const { createSkills } = await import('../../../src/combat/Skill.js');
  const { MELEE } = await import('../../../src/config/meleeCombat.js');
  for (const s of createSkills(MELEE.skills)) {
    const base = s.damage;
    s.setDamageScale(1.5);
    assert.ok(Math.abs(s.damage - base * 1.5) < 1e-9, s.id);
  }
});
