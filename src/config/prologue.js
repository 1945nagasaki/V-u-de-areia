/**
 * Prólogo "Missão: Véu de Areia": tela inicial → vídeo de abertura → naufrágio
 * (nadar até a ilha na tempestade, com 10 minutos antes de se afogar).
 * Tudo que é ajuste fica aqui (src/systems/prologue/).
 */
export const PROLOGUE = {
  title: 'Missão: Véu de Areia',
  subtitle: 'Um chamado do Pai. Uma tempestade. Uma ilha.',

  /** Vídeo de abertura (16:9, com áudio). Esc pausa/retoma; segurar Espaço pula. */
  cutscene: {
    // MP4 (H.264/AAC) e WebM (VP9/Opus): o navegador fica com o que souber tocar.
    url: `${(import.meta.env?.BASE_URL ?? '/')}assets/video/abertura.mp4`,
    urlWebm: `${(import.meta.env?.BASE_URL ?? '/')}assets/video/abertura.webm`,
    skipHold: 0.8, // s segurando Espaço para pular
    fadeIn: 0.9, // s do preto para o jogo depois do vídeo
  },

  /** Onde o jogador cai no mar: ao largo da costa oeste, em frente à vila Copa Alta. */
  spawn: {
    village: 'copaAlta', // a vila em frente (luzes na costa ajudam a se orientar)
    distance: 600, // m da praia mais próxima, mar adentro (para oeste)
    facingAway: true, // nasce de costas para a ilha: precisa olhar em volta para achá-la
    hour: 20.5, // noite: a ilha aparece nos relâmpagos e pelas luzes da vila
  },

  /** Tempestade forçada nos biomas da costa durante o prólogo. */
  storm: {
    biomes: ['tropical', 'equatorial', 'savana'],
    hours: 2,
    // Neblina: no máximo isto (a tempestade tropical normal esconde tudo a 300 m; aqui a ilha
    // ainda aparece como silhueta a 600 m quando o relâmpago clareia).
    fogDensityMax: 0.0036,
    windSpeed: 15, // m/s do vento do oceano (padrão 7): ondas bem maiores; volta ao normal na praia
    // Escuridão da tempestade noturna (a névoa da chuva tropical é cinza-claro e clareava a noite):
    // névoa/céu puxados para esta cor, luz ambiente e exposição reduzidas. O clarão do relâmpago
    // soma por cima (fica mais dramático no escuro).
    darkColor: 0x0d1218,
    darkMix: 0.82,
    hemiMul: 0.45,
    exposureMul: 0.62,
  },

  /** Cronômetro de exaustão/afogamento. */
  timer: {
    seconds: 600, // 10 minutos
    // Exaustão: sobe em degraus suaves a partir de 7, 8 e 9 minutos (0..1).
    exhaustionSteps: [{ at: 420, level: 0.33 }, { at: 480, level: 0.66 }, { at: 540, level: 1 }],
    exhaustionRamp: 20, // s de transição em cada degrau
    sprintSlowdown: 0.4, // na exaustão máxima o sprint fica 40% mais lento
    warnAt: [420, 480, 540], // avisos na tela ("Seus braços pesam…")
  },

  /** Nado no prólogo. */
  swim: {
    sprintMultiplier: 1.7, // Shift: braçada forte (× velocidade de nado)
  },

  /** Chegada: pisar em terra firme por este tempo conta como chegar à ilha. */
  landing: { holdSeconds: 0.6, minGround: 0.15 },

  /** Afogamento quando o tempo acaba. */
  drowning: {
    sinkSeconds: 4.5, // a câmera afunda
    sinkDepth: 7, // m abaixo da superfície
    fadeSeconds: 1.6, // escurece até o preto
  },

  /** Salvamento automático ao chegar à ilha. */
  checkpoint: { key: 'veuDeAreia.checkpoint.v1' },

  /** Áudio sintetizado (Web Audio; o jogo não tem arquivos de som). */
  audio: {
    master: 0.9,
    waves: 0.55, // ondas quebrando
    rain: 0.35,
    breath: 0.5, // respiração (sobe com a exaustão)
    stroke: 0.35, // braçadas/respingos
    underwaterCutoff: 420, // Hz do filtro "abafado" debaixo d'água
  },
};
