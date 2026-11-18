/**
 * Comportamento das sete tribos com estranhos (cânone 2026-11-18, ver
 * design/art/prompts-tribos-ia.md) e os guerreiros de cada capital.
 *
 * Regras (`rule`):
 *   onSight     — ataca qualquer forasteiro: vê de longe (`sight`) e, se o
 *                 jogador entra na cidade, o bando inteiro é alertado.
 *   territorial — em paz do lado de fora; entrar no território (raio da vila)
 *                 é ataque. Avisa na margem (`warnMargin`).
 *   provoked    — em paz; bater em qualquer um da tribo (morador ou
 *                 guerreiro, com qualquer arma) faz o bando caçar o jogador
 *                 por `grudge` segundos.
 *   ambush      — guerreiros escondidos na mata saem quando o jogador chega
 *                 a `ambushRadius` de um deles ou pisa num laço (armadilha).
 *
 * Os guerreiros usam as mesmas CombatEntity/Skill/EnemyAI do combate
 * (src/combat). Números de luta: multiplicadores sobre MELEE.duelist.
 */
export const TRIBE_BEHAVIOR = {
  /** Os bandos só existem/agem com o jogador a até (raio da vila + isto). */
  activeMargin: 80,
  warriors: 4,
  /** Depois de cair, o guerreiro volta quando o jogador estiver longe (ou após `respawn` s). */
  respawn: 180,
  /** Raio (m) em volta do jogador em que os moradores fogem quando a luta começa. */
  fleeRadius: 45,
  fleeSeconds: 12,
  /** Ronda: cada guerreiro anda até um ponto a até `radius` m do posto a cada [min, max] s. */
  patrol: { radius: 9, every: [6, 12] },

  tribes: {
    coroaAlta: {
      name: 'Guerreiro da Coroa-Alta', rule: 'onSight', sight: 40,
      // Os mais fortes: corpo enorme, crina de leão, máscara de leão.
      health: 1.6, damage: 1.5, startup: 1.5, build: 1.3, height: 1.95,
      look: { skin: 0x4a2c1c, shirt: 0x6a1010, pants: 0x3a2416, cape: 0x5a3a20, boots: 0x2a1d14, hair: null },
      mask: 'lion', weapon: 'machete',
      spotted: 'Os Coroa-Alta te viram. Forasteiros morrem aqui.',
    },
    maoCerrada: {
      name: 'Saqueador da Mão-Cerrada', rule: 'onSight', sight: 38,
      health: 1.05, damage: 1.2, startup: 1.45, build: 1.0, height: 1.82,
      look: { skin: 0x5c3a24, shirt: 0x77746c, pants: 0x3b3a38, cape: 0xa8a090, straps: 0x2a2520, hair: null },
      mask: 'rhino', weapon: 'spear',
      spotted: 'Saqueadores da Mão-Cerrada! Eles vêm pelo saque.',
    },
    espelhoTurvo: {
      name: 'Estrategista do Espelho-Turvo', rule: 'ambush', ambushRadius: 10, revealRadius: 35, grudge: 90,
      // Magros e calculistas: golpe sai mais rápido, aguentam menos. Sem máscara.
      health: 0.9, damage: 1.0, startup: 1.2, build: 0.9, height: 1.8,
      look: { skin: 0x6e4529, shirt: 0x4a5a2a, pants: 0x8a7a30, straps: 0x6a6a30, hair: 0x111111 },
      mask: null, weapon: 'machete',
      traps: 5, trapPin: 1.6, // laços no caminho: prendem o jogador por N s e disparam a emboscada
      ambushDepth: 9, ambushFlank: 6, // m: tocaia para dentro da mata e para o lado da trilha, junto a cada laço
      spotted: 'Emboscada do Espelho-Turvo!',
      trapped: 'Um laço escondido prendeu sua perna!',
    },
    brasaViva: {
      name: 'Brutamontes da Brasa-Viva', rule: 'territorial', warnMargin: 25, grudge: 40, // saiu do território: ainda perseguem por 40 s
      // Segundo mais forte. Peito nu (camisa da cor da pele), máscara de hipopótamo.
      health: 1.45, damage: 1.4, startup: 1.55, build: 1.25, height: 1.92,
      look: { skin: 0x3b2417, shirt: 0x3b2417, pants: 0x3a2a1a, straps: 0x1a1410, hair: null },
      mask: 'hippo', weapon: 'bronze',
      warn: 'Totens de aviso: território da Brasa-Viva. Daqui para dentro, eles atacam.',
      spotted: 'Você entrou no território da Brasa-Viva!',
    },
    veuCarmesim: {
      name: 'Fiel do Véu-Carmesim', rule: 'provoked', grudge: 120,
      // Roupa civil comum com o emblema carmesim da seita.
      health: 0.95, damage: 0.9, startup: 1.6, build: 1.0, height: 1.78,
      look: { skin: 0x5c3a24, shirt: 0x9a9a98, pants: 0x55504a, hair: 0x1a1008 },
      mask: null, emblem: 0xa01818, weapon: 'machete',
      spotted: 'O Véu-Carmesim não perdoa quem fere os seus.',
    },
    mesaFarta: {
      name: 'Comensal da Mesa-Farta', rule: 'provoked', grudge: 120,
      // Corpulentos, porretes pesados e escudos grandes: lentos, mas batem forte.
      health: 1.35, damage: 1.3, startup: 1.9, build: 1.45, height: 1.84,
      look: { skin: 0x4a2c1c, shirt: 0xb08a40, pants: 0x4a3220, straps: 0x3a2416, hair: 0x111111 },
      mask: null, weapon: 'club', shield: 0x6a4a28,
      spotted: 'A festa acabou: a Mesa-Farta vai esmagar quem fez confusão.',
    },
    pousoLento: {
      name: 'Caçador do Pouso-Lento', rule: 'territorial', warnMargin: 25, grudge: 300, // "caçam até o fim"
      health: 1.05, damage: 1.1, startup: 1.7, build: 1.05, height: 1.8,
      look: { skin: 0x6e4529, shirt: 0xc8b088, pants: 0x7a6a48, cape: 0x5a5a30, hair: null },
      mask: 'croc', weapon: 'bone',
      warn: 'Ossos de crocodilo na areia: território do Pouso-Lento. Eles só querem ficar em paz.',
      spotted: 'Você perturbou o Pouso-Lento. Agora eles caçam até o fim.',
    },
  },
};
