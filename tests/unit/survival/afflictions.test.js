import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DiseaseManager } from '../../../src/systems/DiseaseManager.js';
import { PhobiaManager } from '../../../src/systems/PhobiaManager.js';
import { SanityManager } from '../../../src/systems/SanityManager.js';
import { Survival } from '../../../src/systems/Survival.js';
import { PlayerState } from '../../../src/systems/PlayerState.js';
import { DISEASES, PHOBIAS, TRAUMA, BITE_INFECTION_CHANCE } from '../../../src/config/afflictions.js';
import { SANITY_TRIGGERS } from '../../../src/config/character.js';
import { ITEMS } from '../../../src/systems/PlayerState.js';
import { ALL_RECIPES } from '../../../src/systems/crafting/RecipeRegistry.js';

const fixed = (v) => () => v;
/** Avança `secs` em passos de `step` s, devolvendo os efeitos de cada quadro. */
function run(dm, secs, env = {}, step = 0.5) {
  const out = [];
  for (let t = 0; t < secs; t += step) out.push(dm.update(step, env));
  return out;
}

// ---------------------------------------------------------------- doenças

test('biteInfection_chanceIsExactlyTwoPercent', () => {
  assert.equal(BITE_INFECTION_CHANCE, 0.02);
  assert.equal(new DiseaseManager({ rng: fixed(0.0199) }).onAnimalBite('lobo'), 'raiva', 'abaixo de 0,02: contágio');
  assert.equal(new DiseaseManager({ rng: fixed(0.02) }).onAnimalBite('lobo'), null, '0,02 já não contagia (rng() < 0,02)');
  assert.equal(new DiseaseManager({ rng: fixed(0) }).onAnimalBite('zebra'), null, 'espécie que não é vetor nunca contagia');
});

test('biteInfection_vectorsMapToTheirDisease', () => {
  const pick = (sp) => new DiseaseManager({ rng: fixed(0) }).onAnimalBite(sp);
  assert.equal(pick('hiena'), 'raiva');
  assert.equal(pick('javali'), 'maculosa');
  assert.equal(pick('alce'), 'maculosa');
  assert.equal(pick('capivara'), 'leptospirose');
  for (const sp of ['leao', 'onca', 'leopardo', 'urso']) assert.equal(pick(sp), 'tetano', sp);
});

test('biteInfection_overManyAttacks_rateIsAboutTwoPercent', () => {
  let seed = 12345;
  const lcg = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  let hits = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) if (new DiseaseManager({ rng: lcg }).onAnimalBite('lobo')) hits++;
  assert.ok(Math.abs(hits / N - 0.02) < 0.004, `taxa ${hits / N}`);
});

test('disease_progressesThroughStages_andNeverHealsAlone', () => {
  const dm = new DiseaseManager({ rng: fixed(0.5) });
  dm.contract('maculosa');
  assert.equal(dm.update(1).speed, 1, 'incubação: sem sintomas');
  run(dm, DISEASES.maculosa.stages[2]);
  const fx = dm.update(0.1);
  assert.equal(dm.list()[0].stage, 2);
  assert.ok(Math.abs(fx.speed - 0.65) < 1e-9, 'dores articulares: −35%');
  assert.equal(fx.carryLimit, DISEASES.maculosa.debuffs[2].carryLimit);
  run(dm, 3600, {}, 5);
  assert.ok(dm.has('maculosa'), 'uma hora depois continua doente');
});

test('disease_curedOnlyByItsRemedy', () => {
  const dm = new DiseaseManager();
  dm.contract('maculosa');
  dm.contract('leptospirose');
  dm.contract('raiva');
  assert.deepEqual(dm.cure('cataplasma_antibiotico'), [], 'remédio errado não cura');
  assert.deepEqual(dm.cure('cha_ervas').sort(), ['leptospirose', 'maculosa']);
  assert.deepEqual(dm.cure('soro_antirrabico'), ['raiva']);
  assert.equal(dm.list().length, 0);
});

test('rabies_advanced_invertsControlsBriefly_andHydrophobiaSpasmsInWater', () => {
  const dm = new DiseaseManager({ rng: fixed(0) });
  let spasms = 0;
  dm.on('spasm', () => spasms++);
  dm.contract('raiva');
  run(dm, DISEASES.raiva.stages[2]);
  const frames = run(dm, 60, { swimming: true }, 0.25);
  const inverted = frames.filter((f) => f.invertControls).length * 0.25;
  assert.ok(inverted > 0 && inverted < 60 * 0.2, `confusão ocasional (${inverted} s de 60)`);
  assert.ok(spasms >= 10, 'espasmos de pânico na água');
  assert.ok(frames.every((f) => f.hpPerSecond > 0 && f.sanityPerSecond > 0), 'perde vida e sanidade (hidrofobia)');
});

test('leptospirosis_feverPeak_drainsTwoPercentOfMaxHealthPerSecond', () => {
  const dm = new DiseaseManager();
  dm.contract('leptospirose');
  run(dm, DISEASES.leptospirose.stages[2]);
  const frames = run(dm, DISEASES.leptospirose.debuffs[2].feverPeak.every, { maxHealth: 100 }, 0.5);
  const peak = frames.filter((f) => f.feverPeak);
  assert.ok(peak.length > 0 && peak.length < frames.length, 'picos, não febre contínua');
  assert.ok(peak.every((f) => Math.abs(f.hpPerSecond - 2) < 1e-9), '2% de 100 = 2 PV/s');
});

test('tetanus_blocksSprintInIntervals_andInfectsTheBite', () => {
  const dm = new DiseaseManager();
  let infected = 0;
  dm.on('infect-bite', () => infected++);
  dm.contract('tetano');
  run(dm, DISEASES.tetano.stages[2]);
  const frames = run(dm, 32, {}, 0.5);
  assert.ok(frames.some((f) => f.sprintBlocked) && frames.some((f) => !f.sprintBlocked), 'rigidez intermitente');
  assert.equal(infected, 1, 'a mordida infecciona uma vez');
});

test('remediesExist_inCatalogAndRecipes', () => {
  for (const d of Object.values(DISEASES)) {
    assert.ok(ITEMS[d.cure], `${d.cure} no catálogo`);
    assert.ok(ALL_RECIPES.some((r) => r.output.item === d.cure), `${d.cure} tem receita (JEI)`);
  }
});

// ---------------------------------------------------------------- fobias

const newPhobias = (rng = fixed(0)) => {
  const sanity = new SanityManager({ start: 100, profile: { dislikes: [], comfortActivities: [] } });
  return { sanity, pm: new PhobiaManager({ sanity, rng }) };
};

test('trauma_belowThreshold_noPhobia', () => {
  const { sanity, pm } = newPhobias();
  sanity.drainSanity(TRAUMA.threshold * 100 - 1, 'Susto', { tags: ['ANIMAL'] });
  assert.equal(pm.list().length, 0);
});

test('trauma_singleEventAtThreshold_acquiresPhobiaFromContext', () => {
  const { sanity, pm } = newPhobias();
  sanity.drainSanity(TRAUMA.threshold * 100, 'Ataque de leão', { tags: ['ANIMAL'] });
  assert.deepEqual(pm.list().map((p) => p.id), ['zoofobia']);
  assert.match(pm.list()[0].cause, /leão/);
});

test('trauma_drainsWithinWindowSum_outsideWindowDoNot', () => {
  const { sanity, pm } = newPhobias();
  sanity.drainSanity(SANITY_TRIGGERS.npcDeath, 'Morte vista', { tags: ['MORTE'] });
  pm.update(TRAUMA.windowSeconds + 1);
  sanity.drainSanity(SANITY_TRIGGERS.npcDeath, 'Morte vista', { tags: ['MORTE'] });
  assert.equal(pm.list().length, 0, 'janela expirou');
  sanity.drainSanity(SANITY_TRIGGERS.corpseFound, 'Ossada', { tags: ['MORTE'] });
  sanity.drainSanity(SANITY_TRIGGERS.npcDeath, 'Morte vista', { tags: ['MORTE'] });
  assert.deepEqual(pm.list().map((p) => p.id), ['necrofobia']);
});

test('trauma_quietContinuousDrains_doNotCount_butSevereDoes', () => {
  const { sanity, pm } = newPhobias();
  sanity.drainSanity(50, 'Escuridão', { tags: ['ESCURIDAO'], quiet: true });
  assert.equal(pm.list().length, 0);
  sanity.drainSanity(2, 'Mandíbulas', { tags: ['SANGUE'], severe: true });
  assert.deepEqual(pm.list().map((p) => p.id), ['traumatofobia']);
});

test('phobia_isPermanent_untilDeath', () => {
  const { sanity, pm } = newPhobias();
  sanity.drainSanity(40, 'Noite', { tags: ['ESCURIDAO'] });
  pm.update(100000);
  sanity.restoreSanity(100, 'Descanso');
  assert.ok(pm.has('nictofobia'));
  pm.clearOnDeath();
  assert.equal(pm.list().length, 0);
});

test('phobia_neverRepeats_andAllFourCanBeAcquired', () => {
  const { sanity, pm } = newPhobias(fixed(0.99));
  for (let i = 0; i < 6; i++) sanity.drainSanity(1, 'x', { severe: true });
  assert.deepEqual(pm.list().map((p) => p.id).sort(), Object.keys(PHOBIAS).sort());
});

test('nyctophobia_triplesDarkDrain_andHalvesStaminaRegen', () => {
  const { sanity, pm } = newPhobias();
  pm.active.set('nictofobia', { id: 'nictofobia', cause: 't', at: 0 });
  const fx = pm.update(1, { dark: true });
  assert.equal(fx.staminaRegenMult, 0.5);
  const before = sanity.value;
  sanity.update(10, { dark: true, darkMult: fx.darkDrainMult });
  assert.ok(Math.abs(before - sanity.value - SANITY_TRIGGERS.darkPerSecond * 10 * 3) < 1e-9, '+200%');
  assert.equal(pm.update(1, { dark: false }).staminaRegenMult, 1, 'com luz não pesa');
});

test('zoophobia_nearAnyAnimal_shakesAndDrainsSanity', () => {
  const { sanity, pm } = newPhobias();
  pm.active.set('zoofobia', { id: 'zoofobia', cause: 't', at: 0 });
  const before = sanity.value;
  const fx = pm.update(1, { nearAnimal: 1 });
  assert.ok(fx.shake > 0 && fx.heartbeat);
  assert.ok(sanity.value < before);
  assert.equal(pm.update(1, { nearAnimal: 0 }).shake, 0);
});

// ---------------------------------------------------------------- integração Survival

test('survival_animalHit_rollsDisease_andRespawnClearsEverything', () => {
  const s = new Survival({ state: new PlayerState(), rng: fixed(0.01) });
  s.onAnimalHit('urso');
  assert.ok(s.diseases.has('tetano'));
  s.sanityMgr.drainSanity(1, 'x', { severe: true });
  assert.equal(s.phobias.list().length, 1);
  s.respawn();
  assert.equal(s.diseases.list().length, 0, 'renasce curado');
  assert.equal(s.phobias.list().length, 0, 'a morte limpa as fobias');
});

test('survival_consumeRemedy_curesDisease', () => {
  const s = new Survival({ state: new PlayerState(), rng: fixed(0.99) });
  s.diseases.contract('raiva');
  assert.match(s.consume('soro_antirrabico'), /raiva curada/);
  assert.equal(s.diseases.has('raiva'), false);
});

test('survival_tetanusRigidity_blocksSprint', () => {
  const s = new Survival({ state: new PlayerState(), rng: fixed(0.99) });
  s.diseases.contract('tetano');
  for (let t = 0; t < DISEASES.tetano.stages[1]; t += 1) s.update(1, {});
  assert.equal(s.canSprint(), false, 'início de um intervalo de rigidez');
});

test('survival_diseaseDeath_namesTheDisease', () => {
  const state = new PlayerState();
  const s = new Survival({ state, rng: fixed(0.99) });
  s.diseases.contract('raiva');
  let died = null;
  for (let t = 0; t < 4000 && !died; t += 1) {
    s.nutrition.restoreFloor?.();
    for (const k of Object.keys(s.nutrition.values)) s.nutrition.values[k] = 100;
    s.sanity = 100;
    died = s.update(1, {}).died;
  }
  assert.match(died ?? '', /Raiva/);
});
