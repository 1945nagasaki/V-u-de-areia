/**
 * Teia alimentar por ESPÉCIE (quem come o quê) e necessidades de pasto e água.
 *
 * Substitui, para as espécies listadas com `prey`, a regra antiga "nível
 * trófico come nível trófico" (config/ecosystem.js): um leão não caça lobo
 * nem leopardo só porque estão num nível abaixo. Espécie sem `prey` aqui
 * continua na regra por nível (criaturas de fantasia: javali corrompido,
 * cérbero; pequenos venenosos).
 *
 * `feeding` (tipo alimentar — biologia, ver design/fauna/catalogo-fauna.md):
 *   grazer   pastador (capim)            browser  come folhas/ramos
 *   mixed    capim e folhas              omnivore plantas + animais pequenos
 *   carnivore caça                       scavenger come carcaças (pode acumular com carnivore)
 * `forage`: recursos vegetais que consome ('grass' = capim, 'browse' = folhagem).
 * `browseHigh`: alcança folhas no alto (girafa) — a cabeça fica erguida ao comer.
 * `water`: 'daily' precisa beber sempre · 'rare' aguenta muito sem beber ·
 *   'aquatic' vive na água (não procura bebedouro).
 * `native`: false = espécie que NÃO é da fauna africana (mantida no jogo por
 *   decisão do dono, sinalizada no catálogo). `model`: observação sobre o modelo 3D.
 *
 * Todos os NÚMEROS abaixo (taxas, raios, limiares) são ajustes de jogabilidade,
 * não dados científicos.
 *
 * @example
 *   import { FOOD_WEB } from './foodWeb.js';
 *   FOOD_WEB.species.leao.prey;        // ['zebra', 'girafa', 'javali', 'avestruz']
 *   FOOD_WEB.species.girafa.feeding;   // 'browser'
 */
export const FOOD_WEB = {
  species: {
    // ---- savana
    leao: { feeding: 'carnivore', scavenges: true, prey: ['zebra', 'girafa', 'javali', 'avestruz'], water: 'daily', native: true },
    zebra: { feeding: 'grazer', forage: ['grass'], water: 'daily', native: true },
    girafa: { feeding: 'browser', forage: ['browse'], browseHigh: true, water: 'rare', native: true },
    // ---- kalahari
    hiena: { feeding: 'carnivore', scavenges: true, prey: ['zebra', 'avestruz', 'suricato', 'javali'], water: 'daily', native: true },
    avestruz: { feeding: 'omnivore', forage: ['grass', 'browse'], water: 'rare', native: true },
    suricato: { feeding: 'insectivore', water: 'rare', native: true },
    // ---- floresta equatorial
    leopardo: { feeding: 'carnivore', prey: ['suricato', 'javali', 'avestruz', 'capivara'], water: 'daily', native: true, model: 'malha de onça-pintada (Jaguar): substituir por um leopardo' },
    gorila: { feeding: 'browser', forage: ['browse'], water: 'rare', native: true },
    jacare: { feeding: 'carnivore', scavenges: true, prey: ['zebra', 'capivara', 'javali', 'avestruz'], water: 'aquatic', native: true, model: 'malha de aligátor: substituir por um crocodilo-do-nilo' },
    // ---- deserto
    camelo: { feeding: 'mixed', forage: ['grass', 'browse'], water: 'rare', native: true },
    // ---- não africanas (mantidas e sinalizadas)
    lobo: { feeding: 'carnivore', prey: ['alce', 'javali'], water: 'daily', native: false },
    urso: { feeding: 'omnivore', forage: ['browse'], prey: ['alce'], water: 'daily', native: false },
    alce: { feeding: 'browser', forage: ['browse'], water: 'daily', native: false },
    onca: { feeding: 'carnivore', prey: ['capivara', 'javali'], water: 'daily', native: false, model: 'malha de leopardo-das-neves' },
    capivara: { feeding: 'grazer', forage: ['grass'], water: 'daily', native: false },
    arara: { feeding: 'frugivore', water: 'rare', native: false },
    // corvo: necrófago (CARCASS.scavengers); javali corrompido, cérbero, víbora e escorpião: regra por nível.
  },

  /** Fome dos herbívoros e consumo de vegetação. */
  forage: {
    hungerPerSecond: 1 / 300, // de saciado a faminto em 5 min sem comer
    seekAbove: 0.45, // com fome acima disto, vai procurar comida
    stopBelow: 0.08, // para de comer quando a fome cai abaixo disto
    reach: 1.1, // m — só come quem chegou de fato ao ponto
    bitePerSecond: 0.02, // unidades de vegetação por segundo
    hungerPerUnit: 1.6, // quanto a fome cai por unidade realmente comida
    searchRadius: 90, // m — até onde procura um pedaço com comida
    minPatch: 0.05, // abaixo disto o pedaço está rapado: procura outro
  },

  /** Sede (todas as espécies terrestres com `water` 'daily' ou 'rare'). */
  thirst: {
    perSecond: { daily: 1 / 420, rare: 1 / 1500 },
    seekAbove: 0.6,
    stopBelow: 0.05,
    drinkPerSecond: 1 / 7, // bebe tudo em ~7 s na beira d'água
    searchRadius: 220, // m — além disto não sabe onde há água
  },

  /**
   * Campo de vegetação: o mundo em células; cada uma guarda capim e folhagem
   * de 0 até a capacidade do bioma, cai ao ser comida e rebrota sozinha.
   * A capacidade vem de config/biomes.js (a mesma que planta a vegetação):
   * capim = `grass.density`; folhagem = soma das densidades de árvores/arbustos × `browsePerDensity`.
   */
  field: {
    cell: 24, // m
    regrowPerSecond: 1 / 600, // fração da capacidade por segundo (rapado → cheio em 10 min)
    browsePerDensity: 0.06,
    // tipos de planta de config/biomes.js que dão folha comestível (rocha, árvore morta e árvore negra não)
    browseTypes: ['acacia', 'baobab', 'shrub', 'dryShrub', 'camelthorn', 'bush', 'broadleaf', 'kapok', 'banana', 'palm', 'pine', 'spruce'],
    maxCapacity: 1,
  },
};

/**
 * Espécies da comunidade de savana e rios AINDA SEM MODELO 3D: cadastradas
 * para o catálogo e para a teia alimentar ficar pronta, mas não nascem no
 * mundo (não estão em BIOME_FAUNA) até existir um modelo próprio — nenhuma
 * reaproveita o modelo de outra espécie.
 */
export const PENDING_SPECIES = {
  guepardo: { name: 'Guepardo', sci: 'Acinonyx jubatus', feeding: 'carnivore', habitat: 'savana' },
  cao_selvagem: { name: 'Cão-selvagem-africano', sci: 'Lycaon pictus', feeding: 'carnivore', habitat: 'savana' },
  gnu: { name: 'Gnu-azul', sci: 'Connochaetes taurinus', feeding: 'grazer', habitat: 'savana' },
  impala: { name: 'Impala', sci: 'Aepyceros melampus', feeding: 'mixed', habitat: 'savana' },
  bufalo: { name: 'Búfalo-africano', sci: 'Syncerus caffer', feeding: 'grazer', habitat: 'savana' },
  elefante: { name: 'Elefante-africano-da-savana', sci: 'Loxodonta africana', feeding: 'mixed', habitat: 'savana' },
  rinoceronte_branco: { name: 'Rinoceronte-branco', sci: 'Ceratotherium simum', feeding: 'grazer', habitat: 'savana' },
  rinoceronte_negro: { name: 'Rinoceronte-negro', sci: 'Diceros bicornis', feeding: 'browser', habitat: 'savana' },
  hipopotamo: { name: 'Hipopótamo', sci: 'Hippopotamus amphibius', feeding: 'grazer', habitat: 'rios' },
  facoquero: { name: 'Facóquero', sci: 'Phacochoerus africanus', feeding: 'omnivore', habitat: 'savana' },
  abutre: { name: 'Abutre-de-dorso-branco', sci: 'Gyps africanus', feeding: 'scavenger', habitat: 'savana' },
};
