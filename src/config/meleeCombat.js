/**
 * Combate corpo a corpo, skills e IA de combate (src/combat/).
 *
 * Tempos em segundos, distâncias em metros, ângulos em graus.
 * Cada golpe tem três fases:
 *   STARTUP  — antecipação (o atacante puxa a arma; a IA brilha: hora de desviar)
 *   ACTIVE   — a ÚNICA janela em que a hitbox existe
 *   RECOVERY — volta à guarda (só a esquiva pode cancelar)
 * Ajustar o alcance/tempo de um golpe = mexer em `skills.<id>` aqui; com
 * `DEBUG_HITBOX` ligado (ou a tecla `debugKey` no jogo) a área aparece em wireframe.
 */
export const MELEE = {
  /** Desenha a área de cada golpe (cone/anel/esfera) só enquanto ela existe (ACTIVE). */
  DEBUG_HITBOX: false,
  /** Tecla que liga/desliga o desenho das hitboxes durante o jogo. */
  debugKey: 'F8',
  /** Câmera lenta para ajustar o tempo dos golpes (liga/desliga). */
  slowMoKey: 'F7',
  slowMo: 0.25,

  /**
   * Teclas do jogador — só valem com "Mãos Livres" no slot (com outro item, o
   * clique continua sendo o uso do item). Q/R giram a câmera, F é viagem
   * rápida, C inspeção, E interagir: por isso Z/X/B e o botão direito.
   */
  keys: {
    combo: 'mouseLeft', // clique esquerdo (mirando um NPC que conversa, o clique continua abrindo o diálogo)
    shockwave: 'mouseRight', // clique direito: dispara para onde a câmera olha
    dodge: 'KeyZ', // + direção (WASD); sem direção, para trás
    dash: 'KeyX',
    whirlwind: 'KeyB',
  },

  player: {
    team: 'player',
    radius: 0.4,
    height: 1.8,
    hitstun: 0.28, // s em STUNNED ao levar um golpe
    /** Esquiva: o único cancelamento permitido (de IDLE/MOVING/RECOVERY). */
    dodge: { distance: 3.2, duration: 0.28, iframes: 0.24, cooldown: 0.55 },
    /** Arma que aparece na mão ao entrar em combate e some depois de `holsterAfter` s sem lutar. */
    holsterAfter: 4,
  },

  /** Sensação de impacto. */
  feel: {
    hitstop: 0.045, // s de pausa do atacante e do alvo ao acertar
    flashTime: 0.12, // s do brilho no alvo
    flashColor: 0xffffff,
    flashColorHurt: 0xff4030, // quando quem leva o golpe é o jogador
    shake: { hit: 0.06, heavy: 0.11, taken: 0.09, decay: 9 }, // m de tremor da câmera e queda por segundo
    knockbackDamp: 9, // 1/s — o empurrão desacelera suave
  },

  /** Golpes. `angle`: abertura TOTAL do cone (360 = em volta). `height`: faixa vertical acertável acima dos pés do atacante. */
  skills: {
    combo: {
      name: 'Combo Básico',
      cooldown: 0,
      // Um passo por golpe; o input do próximo vale durante a janela (fim do ACTIVE + RECOVERY).
      steps: [
        { startup: 0.12, active: 0.08, recovery: 0.26, range: 2.1, angle: 100, damage: 8, knockback: 1.2, animation: 'slashRight', lunge: 0.35 },
        { startup: 0.10, active: 0.08, recovery: 0.26, range: 2.1, angle: 100, damage: 10, knockback: 1.6, animation: 'slashLeft', lunge: 0.35 },
        { startup: 0.18, active: 0.10, recovery: 0.42, range: 2.4, angle: 70, damage: 18, knockback: 4.5, animation: 'overhead', lunge: 0.6, heavy: true },
      ],
      inputWindow: 0.3, // s depois do fim do ACTIVE em que o próximo clique continua o combo
      height: [0.1, 2.0],
    },
    dash: {
      name: 'Investida Cortante',
      cooldown: 4,
      startup: 0.16, active: 0.22, recovery: 0.3,
      distance: 6.5, // m percorridos durante o ACTIVE
      width: 1.1, // m — raio da cápsula que acerta no trajeto
      damage: 16, knockback: 3,
      animation: 'thrust',
      height: [0.1, 2.0],
    },
    whirlwind: {
      name: 'Golpe Giratório',
      cooldown: 7,
      startup: 0.25, active: 0.3, recovery: 0.4,
      range: 2.8, angle: 360,
      damage: 14, knockback: 5.5,
      animation: 'spin',
      height: [0.1, 2.0],
    },
    shockwave: {
      name: 'Onda de Choque',
      cooldown: 5,
      startup: 0.28, active: 0.08, recovery: 0.36,
      damage: 14, knockback: 2.5,
      animation: 'overhead',
      projectile: { speed: 18, range: 22, radius: 0.55, height: 1.0 },
    },
  },

  /** Inimigo de treino (Duelista): mesmas classes de entidade e skills do jogador. */
  duelist: {
    name: 'Duelista',
    team: 'enemy',
    health: 90,
    radius: 0.4,
    height: 1.8,
    walkSpeed: 1.6,
    runSpeed: 3.6,
    hitstun: 0.32,
    respawn: 25, // s depois de cair
    // Mais lento que o jogador: o brilho do STARTUP dá tempo de reagir.
    skillScale: { startup: 1.6, damage: 0.6, cooldown: 1.3 },
    // A IA descansa entre combos (o jogador não tem essa espera): é quando ela circula de lado.
    comboCooldown: 2.6,
    look: { skin: 0x3b2417, shirt: 0x7a1e1e, pants: 0x2a2018, hat: 'wrap', straps: 0x2a1a10 },
  },

  /** IA de combate. */
  ai: {
    aggroRadius: 14, // vê o jogador
    leashRadius: 30, // desiste longe do posto
    think: 0.25, // s entre decisões
    comboRange: 2.0, // corpo a corpo
    dashRange: [4.5, 8], // longe: investida
    shockwaveRange: [6, 16], // bem longe: onda
    whirlwindHealth: 0.4, // fração de vida abaixo da qual prefere o giratório colado
    surroundedCount: 2, // ou com tantos inimigos perto
    strafeDistance: [3.2, 4.5], // distância tática enquanto tudo está em recarga
    strafeSwitch: [1.2, 2.6], // s até trocar o lado do strafe
    telegraph: { color: 0xff6a20, intensity: 2.4 }, // brilho na arma/corpo durante o STARTUP
  },

  /** Arena de treino perto do início (Renascimento). */
  arena: {
    village: 'renascimento',
    offset: [-26, 34], // m do centro da vila
    radius: 9,
    duelists: 2,
    activeRadius: 70, // só existem/agem com o jogador a até esta distância
  },

  /** Cores dos efeitos. */
  vfx: {
    slash: 0xfff1c8,
    slashHeavy: 0xffc060,
    dash: 0x9fd8ff,
    whirlwind: 0xffe08a,
    shockwave: 0x7fe0ff,
    debug: { cone: 0xff3040, projectile: 0x40ff80, opacity: 0.28 },
  },
};
