/**
 * Missões: faixas de recompensa por dificuldade, catálogo de missões, textos do
 * rastreador/banner e o som de conclusão. Tudo aqui é dado; a lógica fica em
 * src/systems/missions/MissionManager.js (pura) e MissionDirector.js (ligação com o jogo).
 *
 * "Moedas de Ouro" = as moedas do jogador (`game.state.coins`): não há segunda moeda.
 */

/**
 * Faixas de recompensa por dificuldade. `gold` e `xp` são [mín, máx] inclusivos;
 * `max: Infinity` = sem teto (Extrema: 500–1000+).
 */
export const MISSION_DIFFICULTY = {
  facil: { label: 'Fácil', gold: [25, 50], xp: [10, 75] },
  media: { label: 'Média', gold: [80, 150], xp: [75, 200] },
  dificil: { label: 'Difícil', gold: [220, 400], xp: [200, 500] },
  extrema: { label: 'Extrema', gold: [500, Infinity], xp: [500, Infinity] },
};

/** Tipos de objetivo que o jogo sabe contar. */
export const OBJECTIVE_TYPES = {
  collect_food: 'collect_food', // fruta colhida ou carne coletada entrou na mochila
  craft_item: 'craft_item', // `objectiveItem` saiu da mesa de crafting da mochila
};

/**
 * Catálogo. `objectiveText` usa {n} para o alvo; o rastreador acrescenta "[atual/alvo]".
 */
export const MISSIONS = {
  buscar_comida: {
    id: 'buscar_comida',
    title: 'Buscar Comida',
    description: 'O tutorial acabou: agora a ilha é sua. Junte comida para os próximos dias.',
    difficulty: 'facil',
    objectiveType: OBJECTIVE_TYPES.collect_food,
    objectiveText: 'Colete {n} comidas (frutas ou carnes)',
    targetCount: 5,
    xpReward: 50,
    goldReward: 35,
    next: 'craftar_adaga', // começa assim que esta termina (recompensas já dadas)
  },
  craftar_adaga: {
    id: 'craftar_adaga',
    title: 'Craftar uma Adaga de Pedra',
    description: 'Comida não basta. Lasque duas pedras e amarre num graveto: uma lâmina para caçar e se defender.',
    difficulty: 'facil',
    objectiveType: OBJECTIVE_TYPES.craft_item,
    objectiveItem: 'adaga_pedra',
    objectiveText: 'Crafte uma Adaga de Pedra no menu de Craft',
    targetCount: 1,
    xpReward: 60,
    goldReward: 40,
  },
};

/** Missão que começa quando o tutorial de 9 passos termina. */
export const POST_TUTORIAL_MISSION = 'buscar_comida';

/** Chave própria do save das missões (limpa no Novo Jogo). */
export const MISSION_SAVE_KEY = 'veuDeAreia.missions.v1';

/** Textos da interface (rastreador e banner). */
export const MISSION_TEXT = {
  trackerHeader: 'MISSÃO ATIVA • Dificuldade: {difficulty}',
  reward: 'Recompensa: +{xp} XP | {gold} Moedas de Ouro',
  banner: 'MISSÃO CONCLUÍDA: {title} (+{xp} XP | +{gold} Moedas de Ouro)',
  started: 'Nova missão: {title}',
  backpackGold: 'Ouro: {gold}',
};

/** Banner de conclusão e som (Web Audio, sem arquivos). */
export const MISSION_FX = {
  bannerSeconds: 4.5,
  sound: {
    volume: 0.22,
    notes: [523.25, 659.25, 783.99, 1046.5], // dó-mi-sol-dó: arpejo curto de "concluído"
    noteGap: 0.09, // s entre notas
    noteLength: 0.32, // s de cada nota
  },
};

/** Troca {chave} pelos valores. */
export function fillText(template, values) {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in values ? String(values[k]) : m));
}
