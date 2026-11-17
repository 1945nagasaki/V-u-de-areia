/**
 * Locais de trabalho das vilas (data-driven): prédios, móveis, estações,
 * ciclos de tarefa de cada profissão, produção e regras de posicionamento.
 *
 * Coordenadas LOCAIS do prédio em metros: +Z = frente (lado da entrada),
 * +X = direita de quem olha de frente. `at` = onde o trabalhador pisa;
 * `face` = para onde ele olha (o objeto em que trabalha).
 *
 * Regra do jogo: ninguém faz gesto de trabalho fora de uma estação válida,
 * alcançável e livre (ver systems/work/Workstations.js).
 *
 * @example
 * import { BUILDINGS, CYCLES } from './workplaces.js';
 * BUILDINGS.forge.stations.find((s) => s.kind === 'anvil').tool;   // 'hammer'
 * CYCLES.ferreiro.map((s) => s.station);                           // ['rack', 'furnace', 'anvil', 'quench', 'store']
 */

const deg = (d) => (d * Math.PI) / 180;

/**
 * Prédios. Campos:
 * - profession / workers: quem trabalha aqui e quantos
 * - w, d: planta (m); shell: 'open' (galpão de frente aberta) | 'closed'
 *   (4 paredes com porta na frente) | 'yard' (área cercada/aberta, sem paredes)
 * - roof: 'thatch' | 'tile' | 'wood' | null; chimney / smoke: chaminé com fumaça
 * - place: regra de posição (ver PLACEMENT); clear: raio livre exigido (m)
 * - props: [tipo, lx, lz, rotGraus?, opções?] — móveis e ferramentas (kit em villages/Workplaces.js)
 * - stations: { kind, at:[lx,lz], face:[lx,lz], gesture, tool?, capacity?, role? }
 *   role 'visitor' = lugar de morador em visita (taverna, igreja, feira)
 */
export const BUILDINGS = {
  forge: {
    name: 'Ferraria', profession: 'ferreiro', workers: 2, w: 7.2, d: 6, shell: 'open', roof: 'tile', chimney: [-2.3, -2.2], smoke: true, place: 'core', clear: 6.5,
    props: [['furnace', -2.3, -2.1], ['anvil', 0.5, -0.4], ['bench', 2.4, -2.2], ['waterBarrel', 2.5, 0.6], ['toolRack', -3.2, 0.5, 90], ['shelf', 3.2, -0.6, -90], ['orePile', -0.6, -2.3], ['coalPile', 0.9, -2.4], ['lantern', 0, -2.75]],
    stations: [
      { kind: 'rack', at: [-2.4, 0.5], face: [-3.2, 0.5], gesture: 'reach' },
      { kind: 'furnace', at: [-2.3, -0.9], face: [-2.3, -2.1], gesture: 'stoke', tool: 'tongs' },
      { kind: 'anvil', at: [0.5, 0.55], face: [0.5, -0.4], gesture: 'hammer', tool: 'hammer', fx: 'sparks' },
      { kind: 'quench', at: [1.7, 0.6], face: [2.5, 0.6], gesture: 'dip', tool: 'tongs', fx: 'steam' },
      { kind: 'store', at: [2.4, -0.6], face: [3.2, -0.6], gesture: 'reach' },
      { kind: 'bench', at: [2.4, -1.3], face: [2.4, -2.2], gesture: 'craft', tool: 'hammer' },
    ],
  },
  mine: {
    name: 'Mina', profession: 'mineiro', workers: 3, w: 11, d: 9, shell: 'yard', roof: null, place: 'rocky', clear: 8.5,
    props: [['mineEntrance', 0, -3.4], ['oreRock', -3.6, -1.2], ['oreRock', 3.5, -1.5, 40], ['oreRock', -2.2, 1.9, 110], ['rails', 0, 0.3], ['mineCart', 0, 1.2], ['crate', 3.6, 2.6], ['crate', 4.3, 2.0, 30], ['torch', -1.7, -2.6], ['torch', 1.7, -2.6], ['oreDepot', 3.4, 3.4]],
    stations: [
      { kind: 'rock', at: [-2.7, -0.6], face: [-3.6, -1.2], gesture: 'mine', tool: 'pickaxe', fx: 'chips' },
      { kind: 'rock', at: [2.6, -0.9], face: [3.5, -1.5], gesture: 'mine', tool: 'pickaxe', fx: 'chips' },
      { kind: 'rock', at: [-1.4, 1.3], face: [-2.2, 1.9], gesture: 'mine', tool: 'pickaxe', fx: 'chips' },
      { kind: 'cart', at: [-0.9, 1.2], face: [0, 1.2], gesture: 'load', carry: 'ore' },
      { kind: 'depot', at: [2.6, 3.0], face: [3.4, 3.4], gesture: 'unload', carry: 'ore', capacity: 2 },
    ],
  },
  farm: {
    name: 'Fazenda', profession: 'agricultor', workers: 4, w: 22, d: 18, shell: 'yard', roof: null, place: 'edge', clear: 13, flat: true,
    props: [['barn', -7.5, -5.5], ['cropPlot', 3.2, -4.6, 0, { w: 9, d: 6, crop: 'wheat', id: 0 }], ['cropPlot', 3.2, 3.6, 0, { w: 9, d: 6, crop: 'veg', id: 1 }], ['farmWell', -7.2, 3.2], ['grainSacks', -5.4, -2.6], ['handCart', -4.2, 5.6, 25], ['toolRack', -9.6, -1.8, 90], ['fencePerimeter', 0, 0, 0, { w: 21, d: 17, gate: 3 }]],
    stations: [
      { kind: 'tools', at: [-8.7, -1.8], face: [-9.6, -1.8], gesture: 'reach' },
      { kind: 'plot', plot: 0, at: [-0.4, -6.4], face: [1.4, -4.9], gesture: 'hoe', tool: 'hoe' },
      { kind: 'plot', plot: 0, at: [-0.4, -2.8], face: [1.4, -4.2], gesture: 'hoe', tool: 'hoe' },
      { kind: 'plot', plot: 1, at: [-0.4, 1.8], face: [1.4, 3.2], gesture: 'hoe', tool: 'hoe' },
      { kind: 'plot', plot: 1, at: [-0.4, 5.4], face: [1.4, 4.0], gesture: 'hoe', tool: 'hoe' },
      { kind: 'well', at: [-6.1, 3.2], face: [-7.2, 3.2], gesture: 'draw', tool: 'bucket' },
      { kind: 'barn', at: [-6.0, -3.3], face: [-7.5, -4.6], gesture: 'unload', carry: 'sack', capacity: 2 },
    ],
  },
  chapel: {
    name: 'Capela', profession: 'sacerdote', workers: 1, w: 6.4, d: 9.5, shell: 'closed', roof: 'tile', bell: true, wall: 'stone', place: 'plaza', clear: 8,
    props: [['altar', 0, -3.6], ['candles', -1.1, -3.6], ['candles', 1.1, -3.6], ['lectern', 1.7, -2.2, -25], ['pew', -1.45, -0.4], ['pew', 1.45, -0.4], ['pew', -1.45, 1.3], ['pew', 1.45, 1.3], ['bookTable', -2.3, -2.5, 90]],
    stations: [
      { kind: 'altar', at: [0, -2.6], face: [0, -3.6], gesture: 'arrange' },
      { kind: 'candles', at: [-1.1, -2.7], face: [-1.1, -3.6], gesture: 'light', tool: 'taper' },
      { kind: 'lectern', at: [1.35, -1.5], face: [1.7, -2.2], gesture: 'read', tool: 'book' },
      { kind: 'aisle', at: [0, -1.3], face: [0, 3], gesture: 'preach' },
      { kind: 'pew', role: 'visitor', at: [-1.85, -0.4], face: [-1.85, -3.6], gesture: 'pray', sit: true },
      { kind: 'pew', role: 'visitor', at: [-1.05, -0.4], face: [-1.05, -3.6], gesture: 'pray', sit: true },
      { kind: 'pew', role: 'visitor', at: [1.05, -0.4], face: [1.05, -3.6], gesture: 'pray', sit: true },
      { kind: 'pew', role: 'visitor', at: [1.85, -0.4], face: [1.85, -3.6], gesture: 'pray', sit: true },
      { kind: 'pew', role: 'visitor', at: [-1.45, 1.3], face: [-1.45, -3.6], gesture: 'pray', sit: true },
      { kind: 'pew', role: 'visitor', at: [1.45, 1.3], face: [1.45, -3.6], gesture: 'pray', sit: true },
    ],
  },
  carpentry: {
    name: 'Carpintaria', profession: 'carpinteiro', workers: 2, w: 7.5, d: 5.6, shell: 'open', roof: 'wood', place: 'core', clear: 6.5,
    props: [['sawhorse', -1.6, 0.2], ['bench', 2.2, -2.0], ['logPile', -3.0, -1.8, 90], ['plankStack', 0.2, -2.2], ['toolRack', 3.3, 0.4, -90], ['trestle', 1.4, 1.0]],
    stations: [
      { kind: 'logs', at: [-2.1, -1.4], face: [-3.0, -1.8], gesture: 'lift', carry: 'log' },
      { kind: 'saw', at: [-1.6, 1.1], face: [-1.6, 0.2], gesture: 'saw', tool: 'saw', fx: 'dust' },
      { kind: 'bench', at: [2.2, -1.1], face: [2.2, -2.0], gesture: 'craft', tool: 'hammer' },
      { kind: 'assemble', at: [1.4, 1.9], face: [1.4, 1.0], gesture: 'hammer', tool: 'hammer' },
      { kind: 'stack', at: [0.2, -1.3], face: [0.2, -2.2], gesture: 'unload', carry: 'plank' },
    ],
  },
  bakery: {
    name: 'Padaria', profession: 'padeiro', workers: 2, w: 6.6, d: 5.6, shell: 'open', roof: 'thatch', chimney: [-2.2, -2.0], smoke: true, place: 'core', clear: 6,
    props: [['oven', -2.2, -1.9], ['kneadTable', 0.6, -1.9], ['flourSacks', 2.6, -2.0], ['breadShelf', 2.9, 0.2, -90], ['counter', 0, 2.3], ['basket', -1.2, 2.3], ['basket', 1.2, 2.3]],
    stations: [
      { kind: 'flour', at: [2.0, -1.2], face: [2.6, -2.0], gesture: 'lift', carry: 'sack' },
      { kind: 'knead', at: [0.6, -0.95], face: [0.6, -1.9], gesture: 'knead' },
      { kind: 'oven', at: [-2.2, -0.7], face: [-2.2, -1.9], gesture: 'bake', tool: 'peel' },
      { kind: 'shelf', at: [2.1, 0.2], face: [2.9, 0.2], gesture: 'arrange' },
      { kind: 'counter', at: [0, 1.5], face: [0, 3.4], gesture: 'serve' },
      { kind: 'customer', role: 'visitor', at: [0, 3.3], face: [0, 2.3], gesture: 'talk', capacity: 2 },
    ],
  },
  tavern: {
    name: 'Taverna', profession: 'taverneiro', workers: 2, w: 9, d: 8, shell: 'closed', roof: 'thatch', chimney: [-3.4, -3.0], smoke: true, place: 'core', clear: 8.5,
    props: [['fireplace', -3.4, -2.9], ['barCounter', 1.6, -2.3], ['kegs', 3.4, -3.2], ['cookPot', -1.6, -3.0], ['table', -2.2, 0.6], ['table', 2.0, 1.3], ['stool', -3.1, 0.6], ['stool', -1.3, 0.6], ['stool', 1.1, 1.3], ['stool', 2.9, 1.3], ['pantry', 3.9, -0.6, -90]],
    stations: [
      { kind: 'pot', at: [-1.6, -2.1], face: [-1.6, -3.0], gesture: 'stir', tool: 'ladle' },
      { kind: 'bar', at: [1.6, -3.1], face: [1.6, -1.2], gesture: 'serve' },
      { kind: 'pantry', at: [3.1, -0.6], face: [3.9, -0.6], gesture: 'reach' },
      { kind: 'tableWork', at: [-2.2, 1.5], face: [-2.2, 0.6], gesture: 'scrub', tool: 'rag' },
      { kind: 'tableWork', at: [2.0, 2.2], face: [2.0, 1.3], gesture: 'scrub', tool: 'rag' },
      { kind: 'seat', role: 'visitor', at: [-3.1, 0.6], face: [-2.2, 0.6], gesture: 'eat', sit: true },
      { kind: 'seat', role: 'visitor', at: [-1.3, 0.6], face: [-2.2, 0.6], gesture: 'eat', sit: true },
      { kind: 'seat', role: 'visitor', at: [1.1, 1.3], face: [2.0, 1.3], gesture: 'eat', sit: true },
      { kind: 'seat', role: 'visitor', at: [2.9, 1.3], face: [2.0, 1.3], gesture: 'eat', sit: true },
      { kind: 'barGuest', role: 'visitor', at: [1.6, -1.2], face: [1.6, -2.3], gesture: 'talk', capacity: 2 },
    ],
  },
  stable: {
    name: 'Estábulo', profession: 'tratador', workers: 2, w: 10, d: 7, shell: 'open', roof: 'thatch', place: 'edge', clear: 8,
    props: [['stall', -3.2, -1.6], ['stall', 0, -1.6], ['stall', 3.2, -1.6], ['horse', -3.2, -1.7], ['horse', 3.2, -1.7, 180], ['hayPile', -4.2, 1.8], ['trough', 0, 0.9], ['waterTrough', 3.6, 1.9, 90], ['pitchforkRack', 4.6, 0.2, -90]],
    stations: [
      { kind: 'hay', at: [-3.3, 1.8], face: [-4.2, 1.8], gesture: 'fork', tool: 'pitchfork' },
      { kind: 'feed', at: [0, 1.8], face: [0, 0.9], gesture: 'feed', carry: 'hay' },
      { kind: 'groom', at: [-3.2, 0.1], face: [-3.2, -1.7], gesture: 'brush', tool: 'brush' },
      { kind: 'groom', at: [3.2, 0.1], face: [3.2, -1.7], gesture: 'brush', tool: 'brush' },
      { kind: 'muck', at: [0, -0.2], face: [0, -1.6], gesture: 'sweep', tool: 'broom' },
      { kind: 'water', at: [2.8, 1.9], face: [3.6, 1.9], gesture: 'pour', tool: 'bucket' },
    ],
  },
  market: {
    name: 'Mercado', profession: 'mercador', workers: 3, w: 12, d: 6, shell: 'yard', roof: null, place: 'plaza', clear: 7.5,
    props: [['stallFood', -4, -0.6], ['stallCloth', 0, -0.6], ['stallTools', 4, -0.6], ['crate', -5.6, -2.0], ['crate', 5.6, -2.0, 20], ['basket', -2.0, -2.1], ['basket', 2.0, -2.1]],
    stations: [
      { kind: 'stall', at: [-4, -1.9], face: [-4, 2], gesture: 'trade' },
      { kind: 'stall', at: [0, -1.9], face: [0, 2], gesture: 'trade' },
      { kind: 'stall', at: [4, -1.9], face: [4, 2], gesture: 'trade' },
      { kind: 'goods', at: [-4.9, -1.5], face: [-5.6, -2.0], gesture: 'arrange', capacity: 1 },
      { kind: 'goods', at: [4.9, -1.5], face: [5.6, -2.0], gesture: 'arrange', capacity: 1 },
      { kind: 'customer', role: 'visitor', at: [-4, 1.0], face: [-4, -0.6], gesture: 'talk', capacity: 2 },
      { kind: 'customer', role: 'visitor', at: [0, 1.0], face: [0, -0.6], gesture: 'talk', capacity: 2 },
      { kind: 'customer', role: 'visitor', at: [4, 1.0], face: [4, -0.6], gesture: 'talk', capacity: 2 },
    ],
  },
  lumberyard: {
    name: 'Serraria do Lenhador', profession: 'lenhador', workers: 2, w: 9, d: 7, shell: 'yard', roof: null, place: 'edge', clear: 7,
    props: [['choppingBlock', -1.6, 0.3], ['choppingBlock', 1.9, 0.6], ['logPile', -3.2, -2.2], ['logPile', 0.4, -2.4], ['firewoodStack', 3.4, -2.0], ['axeStump', 3.6, 2.2], ['woodShed', 0, -2.6]],
    stations: [
      { kind: 'logs', at: [-2.3, -1.5], face: [-3.2, -2.2], gesture: 'lift', carry: 'log' },
      { kind: 'block', at: [-1.6, 1.25], face: [-1.6, 0.3], gesture: 'chop', tool: 'axe', fx: 'chips' },
      { kind: 'block', at: [1.9, 1.55], face: [1.9, 0.6], gesture: 'chop', tool: 'axe', fx: 'chips' },
      { kind: 'stack', at: [2.7, -1.2], face: [3.4, -2.0], gesture: 'unload', carry: 'log', capacity: 2 },
    ],
  },
  fishery: {
    name: 'Cais do Pescador', profession: 'pescador', workers: 2, w: 9, d: 6, shell: 'yard', roof: null, place: 'water', clear: 5.5,
    props: [['netRack', -3.0, -1.4], ['fishRack', 0.2, -1.8], ['fishCrate', 3.0, -1.6], ['boatAshore', 3.4, 1.2, 70], ['jetty', 0, 3.4]],
    stations: [
      { kind: 'shore', at: [-1.6, 2.0], face: [-1.6, 9], gesture: 'fish', tool: 'rod' },
      { kind: 'shore', at: [1.4, 2.0], face: [1.4, 9], gesture: 'fish', tool: 'rod' },
      { kind: 'nets', at: [-3.0, -0.5], face: [-3.0, -1.4], gesture: 'mend' },
      { kind: 'rack', at: [0.2, -0.9], face: [0.2, -1.8], gesture: 'arrange', carry: 'fish' },
      { kind: 'crate', at: [2.3, -1.0], face: [3.0, -1.6], gesture: 'unload', carry: 'fish' },
    ],
  },
  weavery: {
    name: 'Oficina de Tecidos', profession: 'tecelao', workers: 2, w: 6.4, d: 5.2, shell: 'open', roof: 'thatch', place: 'core', clear: 5.5,
    props: [['loom', -1.6, -1.5], ['spinningWheel', 1.7, -1.6], ['clothRolls', 2.7, 0.3, -90], ['woolBasket', -2.6, 0.5], ['dyeVat', 0.2, 1.2]],
    stations: [
      { kind: 'wool', at: [-1.9, 0.9], face: [-2.6, 0.5], gesture: 'lift', carry: 'basket' },
      { kind: 'spin', at: [1.7, -0.7], face: [1.7, -1.6], gesture: 'spin' },
      { kind: 'loom', at: [-1.6, -0.5], face: [-1.6, -1.5], gesture: 'weave' },
      { kind: 'dye', at: [0.2, 2.1], face: [0.2, 1.2], gesture: 'stir', tool: 'ladle' },
      { kind: 'rolls', at: [1.9, 0.3], face: [2.7, 0.3], gesture: 'arrange' },
    ],
  },
  pottery: {
    name: 'Olaria', profession: 'oleiro', workers: 1, w: 6, d: 5.2, shell: 'open', roof: 'thatch', chimney: [-2.0, -1.9], smoke: true, place: 'core', clear: 5.5,
    props: [['kiln', -2.0, -1.8], ['potterWheel', 0.9, -0.9], ['stool', 0.9, 0.0], ['clayPile', 2.4, -1.9], ['potShelf', 2.6, 0.5, -90], ['waterBarrel', -2.4, 1.0]],
    stations: [
      { kind: 'clay', at: [1.8, -1.2], face: [2.4, -1.9], gesture: 'lift', carry: 'clay' },
      { kind: 'wheel', at: [0.9, 0.0], face: [0.9, -0.9], gesture: 'shape', sit: true },
      { kind: 'kiln', at: [-2.0, -0.6], face: [-2.0, -1.8], gesture: 'stoke', tool: 'tongs' },
      { kind: 'shelf', at: [1.8, 0.5], face: [2.6, 0.5], gesture: 'arrange' },
    ],
  },
  mill: {
    name: 'Moinho', profession: 'moleiro', workers: 2, w: 6, d: 6, shell: 'closed', roof: 'wood', sails: true, wall: 'stone', tall: 1.7, place: 'edge', clear: 7.5,
    props: [['millstone', 0, -1.2], ['grainSacks', -1.9, 1.2], ['flourSacks', 1.9, 1.2], ['hopper', 0, -2.3]],
    stations: [
      { kind: 'grain', at: [-1.3, 0.6], face: [-1.9, 1.2], gesture: 'lift', carry: 'sack' },
      { kind: 'stone', at: [0, -0.1], face: [0, -1.2], gesture: 'pour', carry: 'sack' },
      { kind: 'flour', at: [1.3, 0.6], face: [1.9, 1.2], gesture: 'unload', carry: 'sack' },
    ],
  },
  infirmary: {
    name: 'Enfermaria', profession: 'curandeiro', workers: 1, w: 6, d: 5.4, shell: 'closed', roof: 'thatch', place: 'core', clear: 6,
    props: [['bed', -1.8, -1.6], ['bed', 1.8, -1.6], ['herbTable', 0, -2.1], ['herbRack', -2.5, 0.9, 90], ['waterBarrel', 2.4, 1.2]],
    stations: [
      { kind: 'herbs', at: [-1.7, 0.9], face: [-2.5, 0.9], gesture: 'reach' },
      { kind: 'table', at: [0, -1.2], face: [0, -2.1], gesture: 'grind' },
      { kind: 'bed', at: [-1.8, -0.5], face: [-1.8, -1.6], gesture: 'tend' },
      { kind: 'bed', at: [1.8, -0.5], face: [1.8, -1.6], gesture: 'tend' },
    ],
  },
  library: {
    name: 'Casa do Escriba', profession: 'escriba', workers: 1, w: 6, d: 5.4, shell: 'closed', roof: 'tile', place: 'plaza', clear: 6,
    props: [['bookshelf', -2.5, -1.2, 90], ['bookshelf', 2.5, -1.2, -90], ['writingDesk', 0, -1.7], ['stool', 0, -0.95], ['bookTable', 1.5, 1.0], ['candles', -0.7, -1.7]],
    stations: [
      { kind: 'shelf', at: [-1.7, -1.2], face: [-2.5, -1.2], gesture: 'reach', tool: 'book' },
      { kind: 'desk', at: [0, -0.95], face: [0, -1.7], gesture: 'write', tool: 'quill', sit: true },
      { kind: 'shelf', at: [1.7, -1.2], face: [2.5, -1.2], gesture: 'reach', tool: 'book' },
      { kind: 'table', at: [1.5, 1.8], face: [1.5, 1.0], gesture: 'read', tool: 'book' },
    ],
  },
  guardpost: {
    name: 'Posto da Guarda', profession: 'guarda', workers: 0, w: 4, d: 4, shell: 'yard', roof: null, place: 'plaza', clear: 4.5,
    props: [['sentryBox', 0, -0.8], ['weaponRack', 1.5, -0.9], ['brazier', -1.5, 0.6]],
    stations: [{ kind: 'post', at: [0, 0.5], face: [0, 4], gesture: 'guard', capacity: 2 }],
  },
};

/**
 * Ciclo de tarefas de cada profissão (repete enquanto durar o turno).
 * station = `kind` da estação; seconds = duração (s reais; 1 h de jogo = 50 s);
 * consume / produce = estoque da vila mexido ao TERMINAR o passo;
 * needs = só faz o passo se houver esse material (senão pula para `else`).
 */
export const CYCLES = {
  ferreiro: [
    { station: 'rack', seconds: 3 }, { station: 'furnace', seconds: 8, needs: { minerio: 1, madeira: 1 } },
    { station: 'anvil', seconds: 10 }, { station: 'quench', seconds: 4 },
    { station: 'store', seconds: 3, consume: { minerio: 1, madeira: 1 }, produce: { ferramentas: 1 } }, { station: 'bench', seconds: 6 },
  ],
  mineiro: [
    { station: 'rock', seconds: 12 }, { station: 'cart', seconds: 4 }, { station: 'rock', seconds: 10 },
    { station: 'depot', seconds: 4, produce: { pedra: 2, minerio: 1 } },
  ],
  agricultor: [
    { station: 'tools', seconds: 3 }, { station: 'plot', seconds: 11, farm: true }, { station: 'well', seconds: 5 },
    { station: 'plot', seconds: 9, farm: true }, { station: 'barn', seconds: 4, farmStore: true },
  ],
  sacerdote: [{ station: 'altar', seconds: 8 }, { station: 'candles', seconds: 6 }, { station: 'lectern', seconds: 14 }, { station: 'aisle', seconds: 12 }],
  carpinteiro: [
    { station: 'logs', seconds: 4, needs: { madeira: 1 } }, { station: 'saw', seconds: 11 }, { station: 'bench', seconds: 7 },
    { station: 'assemble', seconds: 8 }, { station: 'stack', seconds: 3, consume: { madeira: 1 }, produce: { tabuas: 2 } },
  ],
  padeiro: [
    { station: 'flour', seconds: 4, needs: { farinha: 1 } }, { station: 'knead', seconds: 9 }, { station: 'oven', seconds: 9 },
    { station: 'shelf', seconds: 4, consume: { farinha: 1 }, produce: { pao: 2 } }, { station: 'counter', seconds: 8 },
  ],
  taverneiro: [
    { station: 'pantry', seconds: 3, needs: { pao: 1 } }, { station: 'pot', seconds: 10 },
    { station: 'bar', seconds: 9, consume: { pao: 1 }, produce: { refeicoes: 2 } }, { station: 'tableWork', seconds: 6 },
  ],
  tratador: [{ station: 'hay', seconds: 6 }, { station: 'feed', seconds: 6 }, { station: 'groom', seconds: 10 }, { station: 'muck', seconds: 8 }, { station: 'water', seconds: 5 }],
  mercador: [{ station: 'goods', seconds: 6 }, { station: 'stall', seconds: 22, distribute: true }],
  lenhador: [{ station: 'logs', seconds: 4 }, { station: 'block', seconds: 12 }, { station: 'stack', seconds: 4, produce: { madeira: 2 } }],
  pescador: [{ station: 'shore', seconds: 18 }, { station: 'rack', seconds: 5, produce: { peixe: 1 } }, { station: 'nets', seconds: 9 }, { station: 'shore', seconds: 14 }, { station: 'crate', seconds: 4, produce: { peixe: 1 } }],
  tecelao: [{ station: 'wool', seconds: 4 }, { station: 'spin', seconds: 9 }, { station: 'loom', seconds: 13 }, { station: 'dye', seconds: 6 }, { station: 'rolls', seconds: 3, produce: { tecido: 1 } }],
  oleiro: [{ station: 'clay', seconds: 4 }, { station: 'wheel', seconds: 13 }, { station: 'kiln', seconds: 8 }, { station: 'shelf', seconds: 4, produce: { potes: 1 } }],
  moleiro: [{ station: 'grain', seconds: 4, needs: { trigo: 2 } }, { station: 'stone', seconds: 11 }, { station: 'flour', seconds: 4, consume: { trigo: 2 }, produce: { farinha: 2 } }],
  curandeiro: [{ station: 'herbs', seconds: 5 }, { station: 'table', seconds: 10 }, { station: 'bed', seconds: 8, produce: { remedios: 1 } }],
  escriba: [{ station: 'shelf', seconds: 5 }, { station: 'desk', seconds: 18, produce: { registros: 1 } }, { station: 'table', seconds: 8 }],
};

/** Recursos do estoque da vila (nome para a interface e teto do depósito). */
export const GOODS = {
  pedra: { name: 'Pedra', cap: 60 }, minerio: { name: 'Minério', cap: 40 }, madeira: { name: 'Madeira', cap: 60 }, tabuas: { name: 'Tábuas', cap: 40 },
  trigo: { name: 'Trigo', cap: 60 }, vegetais: { name: 'Vegetais', cap: 40 }, farinha: { name: 'Farinha', cap: 40 }, pao: { name: 'Pão', cap: 40 },
  peixe: { name: 'Peixe', cap: 30 }, tecido: { name: 'Tecido', cap: 20 }, potes: { name: 'Potes', cap: 20 }, ferramentas: { name: 'Ferramentas', cap: 20 },
  refeicoes: { name: 'Refeições', cap: 30 }, remedios: { name: 'Remédios', cap: 15 }, registros: { name: 'Registros', cap: 99 },
};

/** Estoque com que cada vila começa (as cadeias não nascem travadas). */
export const START_STOCK = { madeira: 8, minerio: 4, trigo: 8, farinha: 4, pao: 4 };

/**
 * O mercador põe à venda (lojas do jogo) o que a vila produz: cada unidade
 * distribuída repõe 1 de estoque do item de loja correspondente.
 * recurso da vila → id do item de loja (config/gear.js)
 */
export const MARKET_LINK = { pao: 'pao', vegetais: 'cenoura', pedra: 'pedra', peixe: null, ferramentas: null };

/** Plantação: estágios visuais e quanto cada passo de trabalho adianta. */
export const FARMING = {
  /** 0 terra arada · 1 semeado · 2 broto · 3 crescendo · 4 maduro */
  stages: ['Terra arada', 'Semeado', 'Broto', 'Crescendo', 'Maduro'],
  heights: [0, 0.04, 0.3, 0.65, 1], // altura relativa das plantas por estágio
  workPerStage: 2, // passos de trabalho na leira para avançar um estágio
  growHours: 3, // ou N h de jogo sozinha (do estágio 1 ao 4)
  harvest: { wheat: { trigo: 4 }, veg: { vegetais: 3 } },
};

/**
 * Onde cada tipo de prédio pode ficar (fração do raio da vila) e o que exige.
 * - plaza: perto da praça · core: entre as casas · edge: borda (terreno plano)
 * - rocky: borda, preferindo o ponto mais alto/inclinado por perto · water: margem
 * maxSlope = desnível máximo (m) sob a planta; minDry = altura mínima acima da água.
 */
export const PLACEMENT = {
  rings: { plaza: [0.1, 0.45], core: [0.25, 0.8], edge: [0.7, 1.08], rocky: [0.8, 1.2], water: [0.3, 1.6] },
  maxSlope: { default: 1.1, flat: 0.7, rocky: 2.0 },
  minDry: 0.45,
  tries: 220,
  /** ordem de construção: os essenciais primeiro (pegam os melhores lugares) */
  order: ['market', 'chapel', 'forge', 'farm', 'bakery', 'tavern', 'carpentry', 'mine', 'mill', 'stable', 'lumberyard', 'fishery', 'weavery', 'pottery', 'infirmary', 'library', 'guardpost'],
  /** vilas que não recebem prédios novos (ruínas; vilas suspensas/sobre a água têm arquitetura própria) */
  skipVillages: ['ruinasKaelen', 'copaAlta', 'zambaRios', 'coroaAlta', 'maoCerrada', 'espelhoTurvo', 'brasaViva', 'veuCarmesim', 'mesaFarta'],
  /** biomas sem certo prédio */
  biomeSkip: { deserto: ['lumberyard', 'fishery'], kalahari: ['lumberyard', 'fishery', 'mill'] },
};

/** Materiais das paredes/telhados por região (variedade entre vilas). */
export const STYLE = {
  taiga: { wall: ['log', 'woodDark'], stone: 'stoneDark', roof: { thatch: 'woodDark', tile: 'tilesBrown', wood: 'woodDark' }, post: 'log' },
  desert: { wall: ['sandstone', 'mudBrick', 'adobeOchre'], stone: 'sandstone', roof: { thatch: 'thatch', tile: 'tilesBrown', wood: 'woodLight' }, post: 'woodLight' },
  jungle: { wall: ['wood', 'mudBrickDark'], stone: 'mossStone', roof: { thatch: 'thatch', tile: 'thatch', wood: 'wood' }, post: 'wood' },
  common: { wall: ['adobeWhite', 'adobeOchre', 'mudBrick', 'stoneLight'], stone: 'stone', roof: { thatch: 'thatch', tile: 'tilesRed', wood: 'woodDark' }, post: 'woodDark' },
};

/** Tolerâncias da validação de estação. */
export const STATION_RULES = {
  arriveRadius: 0.75, // m do ponto de interação para valer "chegou"
  floorTolerance: 0.6, // m entre o chão real e a altura registrada da estação
  retrySeconds: 6, // espera antes de tentar de novo uma estação ocupada/inalcançável
  maxReplans: 3, // rotas recalculadas antes de desistir de uma estação
  clearRadius: 0.28, // o ponto de interação não pode estar dentro de um objeto
};

/** Tempo máximo (ms) por quadro gasto calculando rotas (o resto fica para o quadro seguinte). */
export const ROUTE_BUDGET_MS = 4;

/** Navegação em grade (A*) por vila. */
export const NAV = { cell: 1.0, margin: 45, agentRadius: 0.3, maxExpand: 26000, headHeight: 1.7, slopeMax: 1.0 };

/**
 * Visitas no tempo livre (17–20 h): chance de cada destino quando existe na
 * vila e tem lugar; o resto vai para a praça/fogueira como antes.
 */
export const LEISURE_VISITS = { tavern: 0.4, chapel: 0.2, market: 0.25, bakery: 0.1 };

/** Produção abstrata de vilas longe do jogador: ciclos por hora de jogo por trabalhador. */
export const ABSTRACT = { cyclesPerHour: 1.2 };

/** Modo de depuração (tecla F9 ou `?debugwork` na URL). */
export const WORK_DEBUG = { key: 'F9', labelRadius: 45, maxLabels: 30 };

export const rad = deg;
