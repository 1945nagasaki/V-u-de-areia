/**
 * Coleta de frutas no mundo (FruitNodes): onde cada fruta nasce, quanto tempo
 * leva para crescer de novo, alcance do streaming e a aparência dos modelos.
 *
 * As frutas em si (nome, Fome, cor) vêm de FRUITS em foods.js; aqui só há as
 * regras de colocação. Cada nó é de um de três tipos físicos:
 *  - 'tree'   pendurado na copa de uma árvore real da Vegetation;
 *  - 'bush'   em cima de um arbusto/cacto (0,5–1,2 m do chão);
 *  - 'ground' caído no chão (em volta do tronco ou espalhado na areia/terra).
 *
 * Regras (`rules`), avaliadas por célula da grade de streaming:
 *  - `host`: liga a fruta às árvores/arbustos reais daquele tipo (ids de
 *    `vegetation` em biomes.js). Por hospedeiro, a PRIMEIRA regra que casar
 *    (tipo + bioma + altura) e passar no sorteio `chance` fica com ele.
 *  - `scatter`: pontos sorteados na célula (`attempts` tentativas), sem
 *    hospedeiro real. Com `procHost: 'bush'` nasce um arbusto procedural simples
 *    embaixo do cacho.
 *  - `fallen`: frutas caídas em volta do tronco do mesmo hospedeiro.
 * `minH`/`maxH` = altura do terreno acima do nível do mar (m) — `maxH` baixo
 * = beira d'água (coqueiros do litoral).
 */
export const FORAGE = {
  /** Semente da colocação (mesma semente = mesmos nós). */
  seed: 0x0f12a7e,
  /** Lado (m) da célula da grade de streaming. */
  cellSize: 64,
  /** Raio (m) em volta do jogador onde os nós ficam ativos/visíveis. */
  activeRadius: 120,
  /** Máximo de nós ativos ao mesmo tempo (os mais próximos ganham). */
  maxActive: 600,
  /** Máximo de arbustos procedurais (hospedeiros sem árvore real) visíveis. */
  maxHostBushes: 200,
  /** O jogador anda isto (m) antes de recalcular quais nós estão ativos. */
  restreamDistance: 6,
  /** Distância (m, no plano) para colher; o [E] aparece dentro dela. */
  interactRadius: 2.4,
  /** Segundos que a fruta leva para "inchar" de volta ao reaparecer. */
  growInSeconds: 2.5,
  /** Rótulo do [E] e o aviso ao colher. */
  text: {
    label: (name) => `Colher ${name}`,
    toast: (n, name) => `+${n} ${name}`,
  },
  /** Quantas unidades cada colheita dá. */
  yield: 1,
  /** Escala do modelo por tipo de nó (pendurado fica maior para ser visto de baixo). */
  kindScale: { tree: 1.5, bush: 1.0, ground: 1.0 },
  /** Variação aleatória da escala de cada nó (± fração). */
  scaleJitter: 0.15,
  /** Altura (m) mínima/máxima de uma fruta de arbusto acima da base. */
  bushY: [0.5, 1.2],
  /** Inclinação máxima (rad) de uma fruta caída no chão. */
  groundTilt: 0.9,
  /** Afunda (m) a fruta caída no chão para não flutuar. */
  groundSink: 0.02,

  /**
   * Hospedeiros reais (tipos de vegetation): onde fica a "copa" no espaço local
   * do modelo. `hang` = fração [mín, máx] da altura do modelo; `offset` =
   * deslocamento local (x, z) do centro da copa em relação ao tronco (a
   * palmeira é curvada); `spread` = raio local [mín, máx] em volta desse centro.
   * Para arbustos, `top` = fração da altura onde a fruta pousa.
   */
  hosts: {
    palm: { hang: [0.84, 0.88], offset: [1.65, 0.45], spread: [0.25, 0.6] },
    banana: { hang: [0.55, 0.65], offset: [0, 0], spread: [0.22, 0.4] },
    broadleaf: { hang: [0.42, 0.58], offset: [0, 0], spread: [1.8, 3.6] },
    acacia: { hang: [0.72, 0.85], offset: [0, 0], spread: [1.2, 3.2] },
    shrub: { top: 0.65, spread: [0.1, 0.45] },
    dryShrub: { top: 0.7, spread: [0.05, 0.3] },
    bush: { top: 0.48, spread: [0.3, 0.9] },
  },

  /** Arbusto procedural (hospedeiro de regras `scatter` com procHost: 'bush'). */
  procBush: { radius: 0.55, height: 0.75, color: 0x3c5a2a, scale: [0.8, 1.2] },

  /** Tempo de rebrota (s) [mín, máx] por fruta: cada nó sorteia o seu nessa faixa. */
  regrow: {
    frutas_vermelhas: [180, 260],
    tamara: [240, 360],
    figo_india: [220, 320],
    marula: [240, 360],
    banana_selvagem: [260, 380],
    manga: [280, 400],
    coco_fruto: [300, 420],
  },

  rules: [
    // Coco: coqueiros da beira d'água + cocos caídos na areia.
    {
      fruit: 'coco_fruto', kind: 'tree', host: 'palm', biomes: ['tropical', 'equatorial', 'savana', 'deserto', 'kalahari'],
      maxH: 6, chance: 0.85, count: [2, 4],
      fallen: { chance: 0.6, count: [1, 2], ring: [0.8, 2.6] },
    },
    {
      fruit: 'coco_fruto', kind: 'ground', scatter: { attempts: 6, chance: 0.5 }, biomes: ['deserto', 'kalahari', 'tropical', 'savana'],
      minH: 0.25, maxH: 2.5, count: [1, 2], cluster: 1.2,
    },
    // Tâmara: tamareiras do deserto (oásis) + espalhadas no chão árido.
    {
      fruit: 'tamara', kind: 'tree', host: 'palm', biomes: ['deserto', 'kalahari'],
      chance: 0.9, count: [2, 3],
      fallen: { chance: 0.7, count: [1, 3], ring: [0.8, 3.0] },
    },
    {
      fruit: 'tamara', kind: 'ground', scatter: { attempts: 3, chance: 0.18 }, biomes: ['deserto', 'kalahari'],
      minH: 1, count: [1, 2], cluster: 1.5,
    },
    // Figo-da-Índia: moitas e cactos do deserto baixo e do Kalahari.
    {
      fruit: 'figo_india', kind: 'bush', host: ['dryShrub', 'shrub'], biomes: ['deserto', 'kalahari'],
      chance: 0.35, count: [1, 2],
    },
    // Frutas vermelhas: moitas na savana, beira das florestas e na taiga.
    {
      fruit: 'frutas_vermelhas', kind: 'bush', host: 'shrub', biomes: ['savana'],
      chance: 0.2, count: [1, 3],
    },
    {
      fruit: 'frutas_vermelhas', kind: 'bush', host: 'bush', biomes: ['tropical', 'equatorial', 'preta'],
      chance: 0.08, count: [1, 3],
    },
    {
      fruit: 'frutas_vermelhas', kind: 'bush', scatter: { attempts: 4, chance: 0.35 }, biomes: ['taiga'],
      minH: 1, maxH: 200, count: [2, 3], cluster: 0.5, procHost: 'bush',
    },
    // Marula: árvores da savana + frutas caídas no capim embaixo.
    {
      fruit: 'marula', kind: 'tree', host: 'acacia', biomes: ['savana'],
      chance: 0.35, count: [2, 4],
      fallen: { chance: 0.7, count: [1, 3], ring: [1.0, 3.5] },
    },
    // Banana: cachos nas bananeiras da floresta tropical/equatorial.
    {
      fruit: 'banana_selvagem', kind: 'tree', host: 'banana', biomes: ['tropical', 'equatorial'],
      chance: 0.6, count: [1, 1],
    },
    // Manga: penduradas nas árvores da mata + caídas sob a copa.
    {
      fruit: 'manga', kind: 'tree', host: 'broadleaf', biomes: ['tropical', 'equatorial'],
      chance: 0.12, count: [2, 4],
      fallen: { chance: 0.6, count: [1, 2], ring: [1.0, 3.5] },
    },
  ],

  /**
   * Modelos low-poly (medidas em m). A cor principal de cada fruta é
   * FRUITS[id].color; aqui ficam formas e cores secundárias (talos).
   */
  models: {
    coco_fruto: { shape: 'sphere', radius: 0.12, stretch: [1, 1.12, 1], segments: [8, 6] },
    manga: { shape: 'sphere', radius: 0.08, stretch: [0.85, 1.25, 0.75], segments: [8, 6], stem: { color: 0x3a5a20, radius: 0.008, length: 0.04 } },
    marula: { shape: 'cluster', radius: 0.035, count: 3, spread: 0.045, stretch: [1, 1, 1], segments: [6, 5], tints: [0xd8c040, 0xb8c048] },
    tamara: { shape: 'cluster', radius: 0.018, count: 7, spread: 0.04, stretch: [0.8, 1.4, 0.8], segments: [5, 4], stem: { color: 0xc89048, radius: 0.004, length: 0.12 } },
    frutas_vermelhas: { shape: 'cluster', radius: 0.022, count: 9, spread: 0.05, stretch: [1, 1, 1], segments: [5, 4], tints: [0xb0202e, 0x801828] },
    figo_india: { shape: 'cluster', radius: 0.035, count: 3, spread: 0.05, stretch: [0.8, 1.3, 0.8], segments: [6, 5] },
    banana_selvagem: { shape: 'bunch', radius: 0.022, length: 0.14, fingers: 10, tiers: 2, tierGap: 0.07, tilt: 0.75, stem: { color: 0x5a4a28, radius: 0.015, length: 0.32 } },
  },

  /** Plim curto sintetizado ao colher (Web Audio, sem arquivo). */
  sound: { volume: 0.05, type: 'triangle', freq: 720, freqEnd: 360, attack: 0.005, decay: 0.16 },
};
