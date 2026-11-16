/**
 * Fobias permanentes (trauma) e doenças zoonóticas (mordidas de animais).
 * Todos os números de equilíbrio moram aqui; as regras ficam em
 * src/systems/PhobiaManager.js e src/systems/DiseaseManager.js.
 */

/**
 * Quando um trauma vira fobia.
 * - threshold: fração da barra de sanidade perdida num "evento" de trauma
 * - windowSeconds: drenos pontuais (não contínuos) dentro desta janela contam
 *   como o mesmo evento (um ataque surpresa + golpe crítico + morte vista).
 *   Nenhum gatilho isolado do jogo chega a 30 pontos; sem a janela, a fobia
 *   só viria por `severe`.
 * - severe: drenos marcados `{ severe: true }` (ex.: preso nas mandíbulas)
 *   disparam a checagem sozinhos, sem precisar somar o limiar.
 */
export const TRAUMA = {
  threshold: 0.3,
  windowSeconds: 20,
};

/**
 * Banco de fobias. `tags` = tags de sanidade (drainSanity) que puxam o sorteio
 * para esta fobia; `effects` = números aplicados enquanto o gatilho está ativo.
 */
export const PHOBIAS = {
  nictofobia: {
    name: 'Nictofobia', icon: 'eye', tags: ['ESCURIDAO'],
    description: 'Medo da escuridão. No escuro sem fogo por perto, a mente se desfaz rápido e o fôlego demora a voltar.',
    effects: { darkDrainMult: 3, staminaRegenMult: 0.5 }, // +200% de perda; regen 50% mais lenta
  },
  zoofobia: {
    name: 'Zoofobia', icon: 'paw', tags: ['ANIMAL'],
    description: 'Medo de animais. Qualquer bicho por perto — até os mansos — faz o coração disparar.',
    effects: { radius: 16, sanityPerSecond: 0.9, shake: 0.018, heartbeat: true },
  },
  necrofobia: {
    name: 'Necrofobia', icon: 'skull', tags: ['MORTE'],
    description: 'Medo da morte. Corpos, ossadas e carcaças dão enjoo e roubam a sanidade.',
    effects: { radius: 9, sanityPerSecond: 2.4, nausea: true },
  },
  traumatofobia: {
    name: 'Traumatofobia', icon: 'blood', tags: ['SANGUE'],
    description: 'Medo de sangue e feridas. Com ferida aberta, o pânico atrapalha os passos e a cura demora.',
    effects: { healRate: 0.5, wobble: 0.35, sanityPerSecond: 0.4 },
  },
};

/** Ícones e títulos dos estágios das doenças. */
export const DISEASE_STAGES = ['Incubação', 'Sintomas leves', 'Fase avançada'];

/**
 * Doenças zoonóticas. Não passam sozinhas: só `cure` (remédio do JEI) ou a morte.
 * - chance: por ataque bem-sucedido do vetor (2%, exatamente)
 * - vectors: espécies de config/fauna.js que transmitem
 * - stages: segundos de jogo desde o contágio em que cada estágio começa
 * - debuffs[estágio]: números aplicados naquele estágio (0 = incubação, sem sintomas)
 */
export const BITE_INFECTION_CHANCE = 0.02;

export const DISEASES = {
  raiva: {
    name: 'Raiva', icon: 'mind', cure: 'soro_antirrabico',
    vectors: ['lobo', 'hiena'], // os canídeos do mapa (morcego e raposa: quando existirem, entram aqui)
    description: 'Vírus da saliva de canídeos. Fatal sem soro antirrábico.',
    stages: [0, 180, 480],
    debuffs: [
      {},
      { staminaRegenMult: 0.7, symptoms: ['Formigamento na mordida', 'Ansiedade'] },
      {
        staminaRegenMult: 0.3, staminaDrainPerSecond: 1.5, hpPerSecond: 0.06,
        hydrophobia: { sanityPerSecond: 3, spasmEvery: 4 },
        confusion: { every: [14, 30], seconds: 1 },
        symptoms: ['Hidrofobia: pânico na água', 'Confusão: comandos trocados', 'Exaustão', 'Perda de vida'],
      },
    ],
  },
  maculosa: {
    name: 'Febre Maculosa', icon: 'bug', cure: 'cha_ervas',
    vectors: ['javali', 'alce'], // carrapatos do pelo; e do capim (TICKS)
    description: 'Bactéria de carrapato. Febre alta e dor nas juntas.',
    stages: [0, 120, 360],
    debuffs: [
      {},
      { speed: 0.85, fever: 0.4, symptoms: ['Febre', 'Dor de cabeça'] },
      { speed: 0.65, fever: 1, carryLimit: 18, symptoms: ['Febre alta: visão turva e avermelhada', 'Dor nas juntas: −35% de velocidade', 'Não aguenta mochila pesada (sem correr com mais de 18 itens)'] },
    ],
  },
  leptospirose: {
    name: 'Leptospirose', icon: 'wave', cure: 'cha_ervas',
    vectors: ['capivara'], // + água de rio/poço sem ferver (WATER_LEPTO)
    description: 'Bactéria da urina de roedores em água parada.',
    stages: [0, 150, 420],
    debuffs: [
      {},
      { speed: 0.9, chills: 0.01, symptoms: ['Dores musculares', 'Calafrios'] },
      {
        speed: 0.8, chills: 0.02,
        feverPeak: { every: 75, seconds: 8, hpFractionPerSecond: 0.02 }, // 2% da vida máxima por segundo no pico
        symptoms: ['Dores musculares intensas', 'Tremores de frio', 'Picos de febre: −2% de vida por segundo'],
      },
    ],
  },
  tetano: {
    name: 'Tétano', icon: 'germ', cure: 'cataplasma_antibiotico',
    vectors: ['leao', 'onca', 'leopardo', 'urso'],
    description: 'Bactéria das garras. Rigidez muscular e mordida purulenta.',
    stages: [0, 120, 360],
    debuffs: [
      {},
      { rigidity: { every: 30, seconds: 4 }, symptoms: ['Mandíbula travada', 'Rigidez: sem correr às vezes'] },
      { rigidity: { every: 16, seconds: 6 }, infectBite: true, speed: 0.9, symptoms: ['Rigidez forte: sem correr por vários segundos', 'Mordida purulenta (trate a ferida)'] },
    ],
  },
};

/** Água sem ferver também pode ter leptospirose (além dos parasitas). */
export const WATER_LEPTO = { agua_rio: 0.02, agua_poco: 0.01 };

/** Carrapatos no capim alto: chance por minuto andando nestes biomas. */
export const TICKS = { biomes: ['savana', 'taiga'], perMinuteMoving: 0.004, disease: 'maculosa' };
