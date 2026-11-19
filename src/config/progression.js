/**
 * XP, Árvore de Skills, tutorial de sobrevivência, zoom e fogueira posicionável.
 * Valores data-driven — ajuste aqui sem mexer na lógica (src/systems/Progression.js,
 * src/systems/Tutorial.js, src/systems/ProgressionDirector.js).
 * Story: VEU-DE-AREIA-01 (trazido da sessão paralela e adaptado ao jogo atual).
 */

/** XP e Árvore de Skills. */
export const PROGRESSION = {
  /** XP para o próximo nível = base + (nível-1) × step (o nível é só indicativo). */
  levelBase: 100,
  levelStep: 50,
  rewards: {
    animal: 15, // abater um animal (presa)
    creature: 40, // abater um predador / derrotar um guerreiro
    mission: 100, // completar missão
    tutorial: 60, // XP do último passo do tutorial (dá para a 1ª evolução)
    landing: 25, // chegar à ilha no prólogo
  },
  maxTier: 5,
  /** Custo em XP do tier n (1-based): costBase + (n-1) × costStep. */
  costBase: 50,
  costStep: 25,
  skills: {
    vida: { nome: 'VIDA', desc: 'Vida Máxima', perTier: { maxHealth: 20 } },
    energia: { nome: 'ENERGIA', desc: 'Fôlego e Velocidade', perTier: { maxStamina: 15, speed: 0.05 } },
    forca: { nome: 'FORÇA', desc: 'Dano Corpo a Corpo', perTier: { melee: 0.25 } },
  },
  /** Onde o progresso fica salvo (localStorage). */
  saveKey: 'veuDeAreia.progress.v1',
};

/**
 * Tutorial de 9 passos (começa ao chegar à ilha no prólogo).
 * Cada passo espera um evento do jogo e avança quando o acumulado chega em `need`.
 */
export const TUTORIAL_STEPS = [
  { id: 'mover', titulo: 'Movimentação', texto: 'Use <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> para caminhar pela praia.', event: 'walk', need: 8 },
  { id: 'correr', titulo: 'Correr', texto: 'Segure <kbd>Shift</kbd> para correr (gasta fôlego).', event: 'sprint', need: 1.2 },
  { id: 'zoom', titulo: 'Zoom', texto: 'Segure <kbd>Z</kbd> para dar zoom e observar o horizonte (toque rápido trava o zoom).', event: 'zoom', need: 1 },
  { id: 'bater', titulo: 'Bater', texto: 'Com as mãos livres, <kbd>Clique</kbd> para golpear (3 golpes).', event: 'punch', need: 3 },
  { id: 'mochila', titulo: 'Mochila', texto: 'Pressione <kbd>I</kbd> ou <kbd>Tab</kbd> para abrir a Mochila.', event: 'inventory', need: 1 },
  { id: 'craftar', titulo: 'Craftar', texto: 'Na mesa da mochila, junte <b>2 Gravetos e 2 Pedras</b> e crie uma <b>Fogueira</b>.', event: 'craft', need: 1 },
  { id: 'comer', titulo: 'Comer', texto: 'Fome e sede caem com o tempo (barras do HUD). Coma ou beba algo da mochila.', event: 'food', need: 1 },
  { id: 'fogueira', titulo: 'Fogueira', texto: 'Na mochila, escolha a Fogueira e <b>Posicionar</b>. Depois <kbd>E</kbd> perto dela para acender.', event: 'campfire', need: 1 },
  { id: 'skills', titulo: 'Árvore de Skills', texto: 'Pressione <kbd>K</kbd> e evolua Vida, Energia ou Força com o XP ganho.', event: 'skill', need: 1, grantXp: true },
];

/** Kit do náufrago ao começar o tutorial (só completa o que faltar). */
export const TUTORIAL_KIT = { graveto: 2, pedra: 2, banana: 1 };

/** Zoom (tecla Z): segurar = zoom enquanto segura; toque curto (< tapSeconds) trava/destrava. */
export const ZOOM = { key: 'KeyZ', fov: 40, tapSeconds: 0.25 };

/** Fogueira posicionável (item 'fogueira'). */
export const CAMPFIRE = {
  placeDistance: 2, // m à frente do jogador
  interactRadius: 2.6,
  light: { color: 0xff8a3a, intensity: 26, range: 18, y: 0.7 },
};
