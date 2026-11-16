/**
 * Empunhadura e poses dos itens do pacote (data-driven): em que mão o item
 * fica, com que posição/rotação/escala, e a pose dos braços em cada ação.
 *
 * Os modelos seguem a convenção de `GearModels`: empunhadura na origem, ponta
 * para +Z, "cima" em +Y. A mão do boneco (`Humanoid.hands[i]`) tem −Y apontando
 * para os dedos; com o braço esticado para a frente, +Z da mão aponta para cima.
 *
 * Braços: `D` = dominante (`Humanoid.arms[1]`, o mesmo do soco), `S` = apoio
 * (`arms[0]`). Ângulos em radianos: ombro x negativo = braço para a frente;
 * z positivo no dominante / negativo no apoio = abrir para fora.
 *
 * @example
 * import { gripOf, POSES } from './gearGrips.js';
 * gripOf(GEAR_CATALOG.rifle).pose;   // 'rifle'
 */

/** Empunhadura por construtor de modelo (`model.builder`). */
export const GRIPS = {
  adaga: { hand: 'D', pos: [0, -0.075, 0.03], rot: [0.15, 0, 0], scale: 1, pose: 'one', fp: { pos: [0.2, -0.2, -0.42], rot: [0.95, Math.PI, 0.15], scale: 1 } },
  espada: { hand: 'D', pos: [0, -0.075, 0.03], rot: [0.12, 0, 0], scale: 1, pose: 'one', fp: { pos: [0.22, -0.24, -0.46], rot: [1.0, Math.PI, 0.18], scale: 1 } },
  machado: { hand: 'D', pos: [0, -0.075, 0.03], rot: [0.1, 0, 0], scale: 1, pose: 'two', fp: { pos: [0.2, -0.3, -0.46], rot: [0.85, Math.PI, 0.12], scale: 1 } },
  picareta: { hand: 'D', pos: [0, -0.075, 0.03], rot: [0.1, 0, 0], scale: 1, pose: 'two', fp: { pos: [0.2, -0.3, -0.46], rot: [0.85, Math.PI, 0.12], scale: 1 } },
  arco: { hand: 'S', pos: [0, -0.08, 0.02], rot: [0, 0, 0], scale: 1, pose: 'bow', fp: { pos: [-0.12, -0.08, -0.5], rot: [Math.PI / 2, 0, 0.12], scale: 0.9 } },
  pistola: { hand: 'D', pos: [0, -0.085, 0.035], rot: [Math.PI / 2, 0, 0], scale: 1, pose: 'pistol', fp: { pos: [0.14, -0.16, -0.36], rot: [0, Math.PI, 0], scale: 1 } },
  rifle: { hand: 'D', pos: [0, -0.085, 0.035], rot: [Math.PI / 2, 0, 0], scale: 1, pose: 'rifle', fp: { pos: [0.13, -0.17, -0.32], rot: [0, Math.PI, 0], scale: 1 } },
  /** padrão: item pequeno na palma (comida, recursos, munição, relíquias pequenas) */
  default: { hand: 'D', pos: [0, -0.1, 0.045], rot: [0, 0, 0], scale: 1, pose: 'carry', fp: { pos: [0.17, -0.19, -0.36], rot: [0.25, Math.PI - 0.5, 0], scale: 1 } },
  // itens que pedem ajuste próprio
  flecha: { pos: [0, -0.09, 0.04], rot: [0.2, 0, 0], fp: { rot: [0.6, Math.PI, 0] } },
  graveto: { pos: [0, -0.085, 0.03], rot: [0.2, 0, 0] },
  cafe: { pos: [0.01, -0.1, 0.05], rot: [-1.35, 0, 0], drinkTilt: 0.9, fp: { rot: [0, Math.PI - 0.4, 0] } },
  agua: { pos: [0, -0.1, 0.05], rot: [-1.35, 0, 0], drinkTilt: 1.2, fp: { rot: [0, Math.PI, 0] } },
  hamburguer: { pos: [0, -0.11, 0.055], rot: [-1.35, 0, 0], fp: { rot: [0.2, Math.PI, 0] } },
  reliquia_capa: { pos: [0, -0.06, 0.06], rot: [-1.2, 0, 0], scale: 0.8, fp: { pos: [0.14, -0.02, -0.6], rot: [0, Math.PI, 0], scale: 0.7 } },
  reliquia_escudo: { hand: 'S', pos: [-0.04, -0.06, 0.02], rot: [0, -Math.PI / 2, 0], scale: 1, pose: 'shield', fp: { pos: [-0.22, -0.2, -0.5], rot: [0, Math.PI + 0.5, 0], scale: 0.8 } },
  reliquia_espada: { pos: [0, -0.075, 0.03], rot: [0.12, 0, 0], fp: { pos: [0.22, -0.24, -0.46], rot: [1.0, Math.PI, 0.18] } },
  reliquia_coroa: { pos: [0, -0.12, 0.07], rot: [-1.35, 0, 0], fp: { rot: [0.35, Math.PI, 0] } },
  reliquia_cranio: { pos: [0, -0.13, 0.08], rot: [-1.35, 0, 0], fp: { rot: [0.1, Math.PI + 0.5, 0] } },
};

/** Empunhadura final de um item (padrão + ajuste do construtor). */
export function gripOf(def) {
  const g = GRIPS[def?.model?.builder] ?? {};
  return { ...GRIPS.default, ...g, fp: { ...GRIPS.default.fp, ...(g.fp ?? {}) } };
}

/**
 * Poses dos braços. Cada entrada: `[ombroX, ombroZ, cotovelo]` do dominante
 * (`D`) e do apoio (`S`); `S: null` deixa o braço de apoio na animação normal.
 * `aim: true` soma a inclinação da câmera ao ombro (mira para onde se olha).
 */
export const POSES = {
  carry: { idle: { D: [-0.4, 0.08, -1.15], S: null } },
  shield: { idle: { D: null, S: [-0.55, -0.25, -1.3] } },
  one: {
    idle: { D: [-0.35, 0.1, -1.05], S: null },
    wind: { D: [-2.55, 0.2, -1.25], S: [-0.5, 0.2, -1.2], torso: 0.3 },
    strike: { D: [-0.55, -0.05, -0.2], S: [-0.3, 0.25, -1.0], torso: -0.45 },
  },
  two: {
    idle: { D: [-0.55, -0.12, -0.95], S: [-0.75, 0.42, -1.2] },
    wind: { D: [-2.5, -0.1, -1.1], S: [-2.35, 0.5, -1.35], torso: 0.2, lean: -0.12 },
    strike: { D: [-0.75, -0.12, -0.25], S: [-0.9, 0.45, -0.55], torso: -0.25, lean: 0.3 },
  },
  pistol: {
    idle: { D: [-1.5, -0.14, -0.08], S: [-1.38, 0.5, -0.42], aim: true },
    reload: { D: [-0.6, -0.2, -1.25], S: [-0.55, 0.5, -1.45] },
    /** mão de apoio desce até a cintura para buscar o carregador novo */
    fetch: { D: [-0.6, -0.2, -1.25], S: [0.05, 0.1, -0.5] },
  },
  rifle: {
    idle: { D: [-0.45, -0.1, -1.12], S: [-0.95, 0.5, -0.55], aim: true },
    reload: { D: [-0.7, -0.1, -1.0], S: [-0.95, 0.55, -1.1] },
    fetch: { D: [-0.7, -0.1, -1.0], S: [0.05, 0.1, -0.5] },
  },
  bow: {
    idle: { D: null, S: [-0.7, -0.1, -0.7] },
    /** braço do arco esticado; a mão dominante vai até a corda… */
    nock: { D: [-1.42, -0.42, -0.35], S: [-1.5, -0.05, -0.06], aim: true },
    /** …e puxa até o rosto */
    full: { D: [-1.0, 0.12, -2.4], S: [-1.5, -0.05, -0.06], aim: true },
  },
  /** comer / beber: a mão dominante leva o item à boca */
  mouth: { D: [-0.75, -0.3, -2.45], S: null, head: -0.12 },
};

/** Tempos (frações 0..1) das fases da animação. */
export const ANIM = {
  equipSeconds: 0.22,
  holsterSeconds: 0.16,
  swingWind: 0.36, // até aqui: preparo; depois: golpe (o impacto do jogo cai dentro do golpe)
  swingStrike: 0.62,
  recoilSeconds: 0.16,
  /** recarga: tirar o carregador, buscar outro, encaixar, puxar o ferrolho */
  reload: { lower: 0.12, magOut: 0.3, fetch: 0.55, magIn: 0.78, rack: 0.9 },
  magazineDrop: 0.14, // m que o carregador desce ao sair
  slideTravel: 0.035, // m do ferrolho
  bowDrawMeters: 0.4, // quanto a corda vem para trás
  mouthAt: 0.3, // fração do consumo em que o item chega à boca
};
