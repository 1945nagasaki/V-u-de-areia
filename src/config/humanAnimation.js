/**
 * Animações humanas reais (retargetadas para o Humanoid; ver
 * docs/ANIMATION-LIBRARY.md). Tudo aqui é ajuste: o que não estiver mapeado,
 * ou não tiver carregado, segue com a animação procedural de antes.
 */
export const HUMAN_ANIMATION = {
  enabled: true,
  /** Pasta das bibliotecas (`<categoria>.json`), servida com o jogo. */
  base: `${(import.meta.env?.BASE_URL ?? '/')}assets/animations/humans/`,
  /** Categorias baixadas no início (as outras ficam para quando forem pedidas). */
  preload: ['locomotion', 'social', 'professions'],

  locomotion: {
    // Cada boneco sorteia um idle da lista (variedade na praça).
    idle: ['idleVillager', 'idleVillager2'],
    walk: 'walkRelaxed',
    run: 'run',
    // Velocidade (m/s) em que o andar vira corrida (mistura entre as duas).
    runFrom: 2.0,
    runTo: 3.0,
    // Ritmo do clipe = velocidade real ÷ velocidade natural do clipe, dentro destes limites.
    minRate: 0.6,
    maxRate: 1.9,
    /** Peso dos clipes sobre o procedural (1 = só clipe). */
    weight: 1,
  },

  /**
   * Gesto (o mesmo nome que NPCAgent.gestureNow devolve) → clipe.
   * `full`: corpo inteiro quando o NPC está de pé parado (senão, só tronco, cabeça e braços).
   * `clips`: variações sorteadas por NPC.
   */
  gestures: {
    hammer: { clips: ['smith'], full: true },
    mine: { clips: ['labor'], full: true },
    hoe: { clips: ['laborB'], full: true },
    craft: { clips: ['craft'] },
    knead: { clips: ['craft'] },
    shape: { clips: ['craft'] },
    weave: { clips: ['craft'] },
    mend: { clips: ['repair'], full: true },
    stir: { clips: ['cook'] },
    bake: { clips: ['cook'] },
    eat: { clips: ['eat'] },
    talk: { clips: ['talkA', 'talkB', 'talkC'] },
    preach: { clips: ['talkC'] },
    fists: { clips: ['guardIdle'], full: true },
    slump: { clips: ['idleTired'], full: true },
  },
  /** s — entrada/saída suave de um gesto. */
  gestureFade: 0.3,
};
