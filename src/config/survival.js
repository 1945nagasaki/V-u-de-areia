/**
 * Valores data-driven do prólogo no mar, da sobrevivência, do craft, da
 * fogueira e da progressão (XP + Árvore de Skills).
 * Missão: Véu de Areia. Ajuste aqui sem mexer na lógica.
 */

/** Prólogo: nado na tempestade até a Costa do Deserto. */
export const PROLOGUE = {
  /** Linha (z, em m) da costa leste onde fica a praia de chegada (deserto puro). */
  landingZ: -800,
  /** Distância (m) mar adentro, a partir da linha da praia, onde o jogador acorda. */
  spawnOffshore: 140,
  /** Cronômetro de afogamento (s): 10 minutos. */
  drownSeconds: 600,
  /** Correnteza que guia o nadador até a praia (m/s). */
  currentSpeed: 0.9,
  /** Faixa (m) junto às bordas do mapa considerada "oceano aberto". */
  oceanBand: 520,
  /** Peso mínimo do bioma Deserto para a água deixar o jogador pisar em terra. */
  desertThreshold: 0.6,
  /** Segundos da transição tempestade → céu limpo. */
  clearSeconds: 7,
  /** Aviso ao bater nos penhascos/correntes fora do deserto (s entre avisos). */
  barrierToastCooldown: 4,
};

/** Clima da tempestade (visual). */
export const STORM = {
  rainCount: 9000,
  rainArea: 70, // m em volta da câmera
  rainHeight: 38,
  rainSpeed: 34, // m/s
  lightningMin: 5, // s entre relâmpagos
  lightningMax: 13,
  ambience: {
    fogColor: 0x262a30, fogDensity: 0.0042,
    skyTop: 0x15181d, skyHorizon: 0x3a3f46,
    sunColor: 0x8090a0, sunIntensity: 0.35,
    hemiSky: 0x5a6470, hemiGround: 0x1e2226, hemiIntensity: 0.55,
    exposure: 0.8,
  },
  /** Ambiente "sun-bleached" logo após a tempestade (mistura com o bioma). */
  bleached: {
    fogColor: 0xf4dfb8, fogDensity: 0.0006,
    skyTop: 0x6d9bd0, skyHorizon: 0xfbe8c4,
    sunColor: 0xfff4dc, sunIntensity: 4.3,
    hemiSky: 0xe8eefa, hemiGround: 0xc49a5c, hemiIntensity: 1.15,
    exposure: 1.05,
  },
};

/** Vida, estamina e fome. */
export const SURVIVAL = {
  baseStamina: 100,
  staminaSprintDrain: 18, // por segundo correndo
  staminaRegen: 14, // por segundo sem correr
  staminaRegenDelay: 1.0, // s depois de parar de correr
  staminaMinToSprint: 12, // precisa disso para voltar a correr depois de zerar
  maxHunger: 100,
  hungerDrain: 100 / 900, // ≈ 15 min de 100 → 0 andando
  hungerSprintMultiplier: 2.5,
  starveDamagePerSecond: 0.8, // Fome em 0 → perde vida
  starveFloor: 0, // a fome pode matar
};

/** Recursos da Mochila (inventário em grade). */
export const RESOURCES = {
  madeira: { nome: 'Galho Seco', icone: '🪵', desc: 'Madeira trazida pelo mar. Base de quase tudo.' },
  pedra: { nome: 'Pedra', icone: '🪨', desc: 'Pedra lisa de praia.' },
  carne_crua: { nome: 'Carne Crua', icone: '🥩', desc: 'Come crua (+12 Fome, pode enjoar) ou cozinhe na fogueira.', food: 12 },
  carne_assada: { nome: 'Carne Assada', icone: '🍖', desc: 'Cozida na fogueira: +40 Fome e +10 Vida.', food: 40, heal: 10 },
  ervas: { nome: 'Ervas do Deserto', icone: '🌿', desc: 'Amargas. +6 Fome e +8 Vida.', food: 6, heal: 8 },
  tamara: { nome: 'Tâmaras', icone: '🌰', desc: 'Frutas doces de palmeira: +18 Fome.', food: 18 },
  fogueira: { nome: 'Fogueira', icone: '🔥', desc: 'Posicione na areia e acenda com [E].', placeable: true },
  lanca: { nome: 'Lança de Pedra', icone: '🗡️', desc: 'Arma corpo a corpo: +60% de dano.', weapon: { damageMultiplier: 1.6 } },
  machado: { nome: 'Machado de Pedra', icone: '🪓', desc: 'Ferramenta e arma: +35% de dano.', weapon: { damageMultiplier: 1.35 } },
  tocha: { nome: 'Tocha', icone: '🕯️', desc: 'Luz portátil para a noite (em breve).' },
};

/** Receitas de criação. */
export const RECIPES = [
  { id: 'fogueira', out: 'fogueira', qty: 1, needs: { madeira: 3, pedra: 2 } },
  { id: 'lanca', out: 'lanca', qty: 1, needs: { madeira: 2, pedra: 1 } },
  { id: 'machado', out: 'machado', qty: 1, needs: { madeira: 2, pedra: 2 } },
  { id: 'tocha', out: 'tocha', qty: 1, needs: { madeira: 1, ervas: 1 } },
];

/** Mochila inicial (náufrago) e recursos espalhados na praia. */
export const STARTER = {
  bag: { carne_crua: 1 },
  /** Pontos de coleta perto da praia: [recurso, quantidade, dx, dz] a partir do ponto de chegada (dx<0 = terra). */
  pickups: [
    ['madeira', 2, -8, -3], ['madeira', 1, -12, 4], ['madeira', 2, -6, 8],
    ['pedra', 1, -10, -6], ['pedra', 2, -15, 1], ['pedra', 1, -9, 10],
    ['ervas', 1, -18, -5], ['tamara', 2, -20, 6], ['carne_crua', 1, -14, -9],
  ],
};

/** Fogueira. */
export const CAMPFIRE = {
  lightIntensity: 26,
  lightDistance: 18,
  interactRadius: 2.6,
  cookSeconds: 0, // instantâneo por enquanto
};

/** XP e Árvore de Skills. */
export const PROGRESSION = {
  /** XP para o próximo nível = base + nível × step (o nível é só indicativo). */
  levelBase: 100,
  levelStep: 50,
  rewards: {
    animal: 15, // matar animal (presa)
    creature: 40, // derrotar criatura hostil (predador)
    mission: 100, // completar missão
    tutorial: 60, // XP inicial do tutorial (passo 9)
  },
  maxTier: 5,
  /** Custo em XP do tier n (1-based): costBase + (n-1) × costStep. */
  costBase: 50,
  costStep: 25,
  skills: {
    vida: { nome: 'VIDA', desc: 'Vida Máxima', perTier: { maxHealth: 20 } },
    energia: { nome: 'ENERGIA', desc: 'Estamina Máxima e Velocidade', perTier: { maxStamina: 15, speed: 0.05 } },
    forca: { nome: 'FORÇA', desc: 'Dano Corpo a Corpo', perTier: { melee: 0.25 } },
  },
};

/** Câmera: zoom com a tecla C. */
export const ZOOM = { normalFov: 75, zoomFov: 40, sprintFov: 82 };

/** Chave do checkpoint no localStorage. */
export const SAVE_KEY = 'veu-de-areia-save-v1';
