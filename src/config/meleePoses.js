/**
 * Poses-chave dos golpes (animação procedural do Humanoid, arma na mão direita).
 *
 * Direções no referencial do TRONCO do personagem, como v(direita, cima, frente):
 *   upR/foreR = braço e antebraço direitos (a arma), upL/foreL = esquerdos.
 * torso/hips/head = [inclina p/ frente, gira p/ esquerda, tomba] em rad.
 * stance 0..1 = base de luta (perna esquerda à frente, joelhos dobrados, corpo desce).
 * spin = voltas do corpo inteiro (Golpe Giratório) ao longo da fase.
 *
 * Cada animação tem: windup (fim do STARTUP: antecipação, puxa a arma),
 * strike (fim do ACTIVE: fim do corte) e volta para `guard` no RECOVERY.
 */
const v = (right, up, fwd) => [-right, up, fwd];

export const MELEE_POSES = {
  guard: {
    upR: v(0.35, -0.75, 0.55), foreR: v(0.05, 0.25, 1),
    upL: v(-0.3, -0.85, 0.35), foreL: v(-0.25, -0.2, 0.95),
    torso: [0.08, 0, 0], head: [-0.05, 0, 0], stance: 0.35,
  },
  slashRight: {
    windup: { upR: v(0.9, 0.45, -0.15), foreR: v(0.55, 0.65, -0.55), upL: v(-0.3, -0.45, 0.8), foreL: v(-0.25, 0, 1), torso: [0.04, -0.6, 0], head: [0, 0.45, 0], stance: 0.5 },
    strike: { upR: v(-0.6, 0.0, 0.8), foreR: v(-0.95, -0.05, 0.4), upL: v(-0.45, -0.7, 0.4), foreL: v(-0.3, -0.3, 0.9), torso: [0.14, 0.65, 0], head: [0, -0.5, 0], stance: 0.7 },
  },
  slashLeft: {
    windup: { upR: v(-0.7, 0.35, 0.55), foreR: v(-0.55, 0.55, -0.6), upL: v(-0.4, -0.7, 0.4), foreL: v(-0.2, -0.3, 0.9), torso: [0.04, 0.55, 0], head: [0, -0.4, 0], stance: 0.5 },
    strike: { upR: v(0.95, 0.05, 0.35), foreR: v(0.9, -0.1, 0.45), upL: v(-0.25, -0.5, 0.8), foreL: v(-0.2, -0.1, 1), torso: [0.14, -0.65, 0], head: [0, 0.45, 0], stance: 0.7 },
  },
  overhead: {
    windup: { upR: v(0.15, 0.95, -0.3), foreR: v(0.05, 0.55, -0.85), upL: v(-0.1, 0.95, -0.25), foreL: v(0.15, 0.55, -0.85), torso: [-0.28, 0, 0], head: [0.2, 0, 0], stance: 0.4 },
    strike: { upR: v(0.08, -0.15, 1), foreR: v(0, -0.6, 0.8), upL: v(-0.05, -0.15, 1), foreL: v(0.12, -0.55, 0.85), torso: [0.5, 0, 0], head: [-0.25, 0, 0], stance: 1 },
  },
  thrust: {
    windup: { upR: v(0.5, 0.05, -0.85), foreR: v(0.1, 0.1, 1), upL: v(-0.4, -0.2, 0.9), foreL: v(-0.3, 0.1, 0.95), torso: [0.18, -0.55, 0], head: [-0.1, 0.5, 0], stance: 0.9 },
    strike: { upR: v(0.05, 0.12, 1), foreR: v(0, 0.08, 1), upL: v(-0.7, -0.3, -0.6), foreL: v(-0.6, -0.5, -0.5), torso: [0.38, 0.35, 0], head: [-0.25, -0.3, 0], stance: 1 },
  },
  spin: {
    windup: { upR: v(0.95, 0.1, -0.3), foreR: v(0.9, 0.05, -0.4), upL: v(-0.9, 0.0, 0.4), foreL: v(-0.8, 0.0, 0.5), torso: [0.22, -0.9, 0], head: [0.1, 0.6, 0], stance: 1 },
    strike: { upR: v(1, 0.05, 0.15), foreR: v(1, 0, 0.3), upL: v(-1, 0.05, 0.1), foreL: v(-1, 0, 0.2), torso: [0.15, 0.2, 0], head: [0, 0, 0], stance: 0.9, spin: 1 },
  },
  dodge: {
    upR: v(0.3, -0.5, 0.6), foreR: v(0.1, 0.4, 0.9), upL: v(-0.3, -0.5, 0.6), foreL: v(-0.1, 0.4, 0.9),
    torso: [0.55, 0, 0], head: [-0.3, 0, 0], stance: 1,
  },
  stunned: {
    upR: v(0.6, -0.4, -0.3), foreR: v(0.5, 0.2, 0.3), upL: v(-0.6, -0.4, -0.3), foreL: v(-0.5, 0.2, 0.3),
    torso: [-0.4, 0, 0.12], head: [-0.35, 0, 0], stance: 0.2,
  },
  /** s do crossfade de entrada (pose base → golpe) e de saída (fim do RECOVERY → base). */
  fadeIn: 0.12,
  fadeOut: 0.15,
};
