/**
 * Escarpas: um anel parcial de terreno elevado em volta de um centro (por
 * exemplo, o paredão que fecha Areia-Funda ao norte e a leste). Soma uma
 * elevação ao relevo: plana no topo, com face íngreme voltada para dentro
 * e encosta mais suave para fora; as pontas do arco descem aos poucos.
 *
 * Função pura (sem Three.js), testável.
 *
 * @example
 * const r = makeRidge({ x: 0, z: 0, r: 215, width: 50, height: 45, from: -2.4, to: 0.5 });
 * h += ridgeLift(r, x, z);
 */

/**
 * @param {{ x: number, z: number, r: number, width: number, height: number,
 *   from: number, to: number, fade?: number }} o
 *   r = raio da face interna; width = largura do topo + encosta externa;
 *   from/to = arco em radianos (atan2(dz, dx): 0 = leste, −π/2 = norte);
 *   fade = radianos para as pontas descerem.
 */
export function makeRidge(o) {
  return { ...o, fade: o.fade ?? 0.35, face: o.face ?? 8 };
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Quanto o terreno sobe no ponto (0 fora da escarpa). */
export function ridgeLift(R, x, z) {
  const dx = x - R.x, dz = z - R.z;
  const d = Math.hypot(dx, dz);
  if (d < R.r - 1 || d > R.r + R.face + R.width) return 0;
  // Arco: distância angular até o meio do arco, normalizada.
  const a = Math.atan2(dz, dx);
  const mid = (R.from + R.to) / 2, half = (R.to - R.from) / 2;
  const off = Math.abs(Math.atan2(Math.sin(a - mid), Math.cos(a - mid)));
  const arc = 1 - smoothstep(half - R.fade, half, off);
  if (arc <= 0) return 0;
  // Perfil radial: face íngreme (R.face m) para dentro, topo, encosta externa.
  const up = smoothstep(R.r, R.r + R.face, d);
  const down = 1 - smoothstep(R.r + R.face + R.width * 0.4, R.r + R.face + R.width, d);
  return R.height * up * down * arc;
}
