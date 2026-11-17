/**
 * Geometria de acerto (pura, sem cena, sem alocar por consulta).
 *
 * Alvos são cilindros verticais: { x, y (pés), z, radius, height }.
 *
 * - `inCone`: distância (até a BORDA do alvo, não o centro) + cone frontal pelo
 *   produto escalar entre a frente do atacante e a direção até o alvo, com a
 *   tolerância angular do raio do alvo (um alvo grande de lado ainda é pego
 *   pela borda) + faixa de altura.
 * - `segmentHitsCylinder`: varredura de um segmento (posição anterior → atual)
 *   contra o cilindro, inflado pelo raio do projétil — o projétil não "pula"
 *   o alvo entre dois quadros, por mais rápido que seja.
 * - `HitOnce`: cada golpe acerta cada alvo uma vez só por execução.
 *
 * @example
 *   const t = { x: 0, y: 0, z: 2, radius: 0.4, height: 1.8 };
 *   inCone({ x: 0, y: 0, z: 0 }, { x: 0, z: 1 }, t, { range: 2.1, angle: 100, height: [0.1, 2] }); // true
 */

/**
 * O alvo está dentro do cone de ataque?
 * @param {{x:number,y:number,z:number}} origin pés do atacante
 * @param {{x:number,z:number}} forward frente do atacante (no chão, normalizada)
 * @param {{x:number,y:number,z:number,radius:number,height:number}} t alvo
 * @param {{ range: number, angle: number, height?: [number, number] }} shape angle = abertura TOTAL em graus (360 = em volta)
 */
export function inCone(origin, forward, t, shape) {
  const dx = t.x - origin.x, dz = t.z - origin.z;
  const dist = Math.hypot(dx, dz);
  if (dist - t.radius > shape.range) return false;
  // Altura: a faixa [h0, h1] acima dos pés do atacante tem que cruzar o cilindro do alvo.
  if (shape.height) {
    const lo = origin.y + shape.height[0], hi = origin.y + shape.height[1];
    if (t.y > hi || t.y + t.height < lo) return false;
  }
  if (shape.angle >= 360 || dist < 1e-6) return true;
  // Dentro do próprio corpo do atacante: acerta se estiver na metade da frente.
  const cos = (dx * forward.x + dz * forward.z) / dist;
  const half = (shape.angle * Math.PI) / 360;
  // Tolerância: o raio do alvo visto daqui alarga o cone (pega a borda do corpo).
  const widen = Math.asin(Math.min(1, t.radius / Math.max(dist, t.radius)));
  return cos >= Math.cos(Math.min(Math.PI, half + widen));
}

/**
 * O segmento a→b (esfera de raio r varrida) toca o cilindro do alvo?
 * @returns {number} fração 0..1 do segmento no primeiro contato, ou -1
 */
export function segmentHitsCylinder(ax, ay, az, bx, by, bz, r, t) {
  // No plano: menor distância do segmento ao eixo do cilindro.
  const R = t.radius + r;
  const ex = bx - ax, ez = bz - az;
  const L2 = ex * ex + ez * ez;
  let u = 0;
  if (L2 > 1e-12) {
    // Entrada no círculo (primeira raiz de |a + u e - c|² = R²); senão o ponto mais perto.
    const fx = ax - t.x, fz = az - t.z;
    const b = 2 * (fx * ex + fz * ez), c = fx * fx + fz * fz - R * R;
    if (c <= 0) u = 0; // já começa dentro
    else {
      const disc = b * b - 4 * L2 * c;
      if (disc < 0) return -1;
      u = (-b - Math.sqrt(disc)) / (2 * L2);
      if (u < 0 || u > 1) return -1;
    }
  } else if ((ax - t.x) ** 2 + (az - t.z) ** 2 > R * R) return -1;
  const y = ay + (by - ay) * u;
  if (y + r < t.y || y - r > t.y + t.height) return -1;
  return u;
}

/**
 * Cápsula horizontal (trajeto da investida) contra o cilindro do alvo.
 * @returns {boolean}
 */
export function capsuleHitsCylinder(ax, az, bx, bz, r, y0, y1, t) {
  const ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez;
  let u = L2 > 1e-12 ? ((t.x - ax) * ex + (t.z - az) * ez) / L2 : 0;
  u = Math.max(0, Math.min(1, u));
  const px = ax + ex * u - t.x, pz = az + ez * u - t.z;
  if (px * px + pz * pz > (r + t.radius) ** 2) return false;
  return !(t.y > y1 || t.y + t.height < y0);
}

/**
 * Registro de "já acertou" de UMA execução de golpe.
 * Reutilizável: `reset()` no começo de cada golpe (sem alocar).
 */
export class HitOnce {
  constructor() { this.set = new Set(); }
  reset() { this.set.clear(); }
  /** true na primeira vez que vê o alvo nesta execução; depois false. */
  claim(target) {
    if (this.set.has(target)) return false;
    this.set.add(target);
    return true;
  }
  has(target) { return this.set.has(target); }
  get size() { return this.set.size; }
}
