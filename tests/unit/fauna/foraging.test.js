import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ForageField, biomeCapacity, findShore } from '../../../src/systems/fauna/Foraging.js';
import { EcosystemManager } from '../../../src/systems/fauna/EcosystemManager.js';
import { buildDiet } from '../../../src/systems/fauna/Ecology.js';
import { ECOSYSTEM } from '../../../src/config/ecosystem.js';
import { FOOD_WEB, PENDING_SPECIES } from '../../../src/config/foodWeb.js';
import { SPECIES, BIOME_FAUNA } from '../../../src/config/fauna.js';
import { BIOMES } from '../../../src/config/biomes.js';

const FIELD = { ...FOOD_WEB.field, cell: 20, regrowPerSecond: 0.01 };
const flat = (grass, browse) => () => ({ grass, browse });

// ---------------------------------------------------------------- teia alimentar

test('foodWeb_lionHuntsGrazersNotOtherPredators', () => {
  const diet = buildDiet(ECOSYSTEM);
  const lion = diet.get('leao');
  assert.ok(lion.has('zebra') && lion.has('girafa'));
  for (const rival of ['lobo', 'hiena', 'leopardo', 'gorila', 'camelo']) assert.ok(!lion.has(rival), `leão não caça ${rival}`);
});

test('foodWeb_everyListedPreyExists_andNoSpeciesEatsItself', () => {
  for (const [id, s] of Object.entries(FOOD_WEB.species)) {
    assert.ok(SPECIES[id], `${id} existe em SPECIES`);
    for (const p of s.prey ?? []) { assert.ok(SPECIES[p], `${id} → ${p} existe`); assert.notEqual(p, id); }
    for (const f of s.forage ?? []) assert.ok(['grass', 'browse'].includes(f));
  }
});

test('foodWeb_herbivoresAreNotAllGrazers', () => {
  const S = FOOD_WEB.species;
  assert.deepEqual(S.zebra.forage, ['grass'], 'zebra: pastadora');
  assert.deepEqual(S.girafa.forage, ['browse'], 'girafa: só folhas');
  assert.ok(S.girafa.browseHigh);
  assert.equal(buildDiet(ECOSYSTEM).get('zebra').size, 0);
});

test('foodWeb_levelRuleStillAppliesToSpeciesWithoutOwnDiet', () => {
  const diet = buildDiet(ECOSYSTEM);
  assert.ok(!FOOD_WEB.species.javali, 'javali corrompido não tem dieta própria');
  assert.ok(diet.get('javali').has('zebra'), 'continua na regra por nível');
});

test('pendingSpecies_areCataloguedButNeverSpawn', () => {
  const spawned = new Set(Object.values(BIOME_FAUNA).flatMap((b) => Object.keys(b)));
  for (const id of Object.keys(PENDING_SPECIES)) {
    assert.ok(!SPECIES[id], `${id} ainda não é uma espécie do jogo`);
    assert.ok(!spawned.has(id), `${id} não nasce em nenhum bioma`);
  }
});

// ---------------------------------------------------------------- vegetação como recurso

test('forageField_consumeDepletes_andRegrowsOverTime', () => {
  const f = new ForageField(FIELD, { capacityAt: flat(0.8, 0.2) });
  assert.equal(f.amount(5, 5, 'grass', 0), 0.8);
  assert.equal(f.consume(5, 5, 'grass', 0.5, 0), 0.5);
  assert.ok(Math.abs(f.amount(5, 5, 'grass', 0) - 0.3) < 1e-9);
  assert.ok(Math.abs(f.consume(5, 5, 'grass', 1, 0) - 0.3) < 1e-9, 'só sai o que existe');
  assert.equal(f.consume(5, 5, 'grass', 1, 0), 0, 'rapado');
  assert.equal(f.amount(5, 5, 'browse', 0), 0.2, 'a folhagem não foi tocada');
  assert.ok(Math.abs(f.amount(5, 5, 'grass', 50) - 0.4) < 1e-9, 'rebrota 1%/s da capacidade');
  assert.equal(f.amount(5, 5, 'grass', 1000), 0.8, 'nunca passa da capacidade');
});

test('forageField_findBest_prefersRichNearbyPatch_andSkipsEmptyOnes', () => {
  const f = new ForageField(FIELD, { capacityAt: (x) => ({ grass: x > 100 ? 0.9 : 0, browse: 0 }) });
  const best = f.findBest(50, 10, ['grass'], 120, 0);
  assert.ok(best && best.x > 100 && best.kind === 'grass');
  assert.equal(f.findBest(50, 10, ['grass'], 30, 0), null, 'nada ao alcance');
  assert.equal(f.findBest(50, 10, ['browse'], 120, 0), null, 'não há folhagem');
});

test('biomeCapacity_followsBiomeVegetationConfig', () => {
  const by = Object.fromEntries(BIOMES.map((b) => [b.id, biomeCapacity(b)]));
  assert.ok(by.savana.grass > by.deserto.grass * 5, 'savana tem muito mais capim que o deserto');
  assert.ok(by.equatorial.browse > by.deserto.browse, 'floresta tem mais folhagem que o deserto');
  for (const c of Object.values(by)) assert.ok(c.grass >= 0 && c.grass <= 1 && c.browse >= 0 && c.browse <= 1);
});

test('findShore_returnsLandPointFacingWater_orNullWhenTooFar', () => {
  const isWater = (x) => x > 50; // água a leste de x = 50
  const s = findShore(isWater, 10, 0, 100);
  assert.ok(s && !isWater(s.x, s.z) && s.x > 44 && isWater(s.wx, s.wz));
  assert.equal(findShore(isWater, 10, 0, 20), null);
  assert.equal(findShore(isWater, 60, 0, 100), null, 'dentro d\'água não procura margem');
});

// ---------------------------------------------------------------- fome, sede e decisão

const SPEC = { zebra: { sense: 20, run: 11, walk: 1, health: 80 }, girafa: { sense: 20, run: 9, walk: 1, health: 220 }, leao: { sense: 30, run: 12, walk: 1, health: 150 } };
let seq = 0;
const animal = (speciesId, x, z) => ({ id: ++seq, speciesId, spec: SPEC[speciesId], position: { x, y: 0, z }, health: SPEC[speciesId].health, alive: true, speed: 0, limpT: 0, group: seq });
const FAR = { position: { x: 9999, z: 9999 }, alive: true, health01: 1 };
const world = (capacityAt, findWater = null) => {
  const eco = new EcosystemManager(ECOSYSTEM, { rng: () => 0.5 });
  eco.setEnvironment({ capacityAt, findWater });
  return eco;
};
/** Anda o animal até o alvo de pasto (como o Animal faz) e avança o ecossistema. */
function live(eco, list, secs, { walk = true } = {}) {
  for (let t = 0; t < secs; t += 0.25) {
    for (const a of list) {
      const f = a.eco.forage;
      a.speed = 0;
      if (walk && f) { const dx = f.x - a.position.x, dz = f.z - a.position.z, d = Math.hypot(dx, dz); if (d > 0.6) { const s = Math.min(d, 1.15 * 0.25); a.position.x += (dx / d) * s; a.position.z += (dz / d) * s; a.speed = 1.15; } }
    }
    eco.update(0.25, list, FAR);
  }
}

test('hungryGrazer_walksToGrass_andHungerDropsOnlyWhileActuallyEating', () => {
  const eco = world((x) => ({ grass: x > 60 ? 0.9 : 0, browse: 0 }));
  const z = animal('zebra', 0, 0);
  eco.register(z);
  z.eco.needs.hunger = 0.7; z.eco.needs.thirst = 0;
  eco.update(0.3, [z], FAR);
  assert.equal(z.eco.forage?.kind, 'grass', 'escolheu um pedaço de capim');
  const h0 = z.eco.needs.hunger;
  live(eco, [z], 5, { walk: false }); // parada, longe da comida: a "animação" não mata a fome
  assert.ok(z.eco.needs.hunger > h0, 'sem chegar ao capim a fome só sobe');
  assert.equal(z.eco.consuming, null);
  live(eco, [z], 120);
  assert.equal(z.eco.consuming ?? 'grass', 'grass');
  assert.ok(z.eco.needs.hunger < h0 - 0.2, `comeu: fome ${z.eco.needs.hunger.toFixed(2)}`);
  assert.ok(eco.field.amount(z.eco.forage?.cx ?? 70, z.eco.forage?.cz ?? 10, 'grass', eco.clock) < 0.9, 'o capim do pedaço diminuiu');
});

test('browser_ignoresGrass_andStaysHungryWithoutFoliage', () => {
  const eco = world(flat(1, 0));
  const g = animal('girafa', 0, 0);
  eco.register(g);
  g.eco.needs.hunger = 0.9; g.eco.needs.thirst = 0;
  live(eco, [g], 30);
  assert.equal(g.eco.forage, null, 'capim não serve para a girafa');
  assert.ok(g.eco.needs.hunger >= 0.9);
});

test('satedGrazer_doesNotForage_andStopsWhenFull', () => {
  const eco = world(flat(1, 1));
  const z = animal('zebra', 0, 0);
  eco.register(z);
  z.eco.needs.hunger = 0.2; z.eco.needs.thirst = 0;
  eco.update(0.3, [z], FAR);
  assert.equal(z.eco.forage, null, 'abaixo de seekAbove não procura');
  z.eco.needs.hunger = 0.6;
  live(eco, [z], 200);
  assert.ok(z.eco.needs.hunger < FOOD_WEB.forage.seekAbove, 'comeu até saciar');
  assert.equal(z.eco.forage, null, 'saciada, larga o pasto (histerese)');
});

test('thirst_sendsAnimalToShore_andDrinkingQuenchesIt', () => {
  const shore = { x: 30, z: 0, wx: 36, wz: 0 };
  const eco = world(flat(0, 0), () => shore);
  const z = animal('zebra', 0, 0);
  eco.register(z);
  z.eco.needs.hunger = 0; z.eco.needs.thirst = 0.8;
  eco.update(0.3, [z], FAR);
  assert.equal(z.eco.forage?.kind, 'water');
  live(eco, [z], 60);
  assert.ok(z.eco.needs.thirst < 0.2, `bebeu: sede ${z.eco.needs.thirst.toFixed(2)}`);
});

test('threat_cancelsForaging_fearBeforeHunger', () => {
  const eco = world(flat(1, 1));
  const z = animal('zebra', 0, 0), lion = animal('leao', 12, 0);
  eco.register(z); eco.register(lion);
  z.eco.needs.hunger = 0.9; z.eco.needs.thirst = 0;
  lion.eco.needs.hunger = 0.95; lion.eco.needs.thirst = 0;
  eco.update(0.3, [z, lion], FAR);
  assert.ok(z.eco.threat === lion, 'a zebra percebe o leão caçando');
  assert.equal(z.eco.forage, null, 'com medo não pasta');
  assert.equal(lion.eco.forage, null, 'caçando não vai beber nem comer capim');
});

test('withoutEnvironment_nothingForages_backwardCompatible', () => {
  const eco = new EcosystemManager(ECOSYSTEM, { rng: () => 0.5 });
  const z = animal('zebra', 0, 0);
  eco.register(z);
  z.eco.needs.hunger = 0.9;
  eco.update(0.3, [z], FAR);
  assert.equal(z.eco.forage, null);
});
