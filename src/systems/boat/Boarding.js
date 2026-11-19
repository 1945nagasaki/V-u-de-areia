/**
 * Embarque e desembarque (regras puras, sem Three.js).
 *
 * - `findLanding`: onde o jogador pode pôr os pés ao sair do barco. Procura em anéis em volta do
 *   barco o ponto de TERRA FIRME mais perto (acima d'água, sem parede/rocha/casa em cima, em
 *   encosta andável e não muito mais alto que a borda). Sem terra ao alcance, devolve a saída para a
 *   água ao lado do barco (o jogador nada) — mas só se ali também não houver colisor.
 * - `hopPath`: trajetória do pulo (ida ou volta) em arco, com subida e descida suaves.
 *
 * @example
 *   const spot = findLanding({ x, z }, yaw, { groundAt, isWater, blocked }, BOARDING);
 *   if (spot) startHop(from, spot);       // spot.water = vai cair n'água
 */

/**
 * @param {{x: number, z: number}} c centro do barco
 * @param {number} yaw rumo do barco (rad)
 * @param {{ groundAt: (x: number, z: number) => number, isWater: (x: number, z: number) => boolean,
 *   blocked: (x: number, z: number) => boolean, deckY: number, waterExit?: {x: number, z: number} }} env
 *   `deckY`: altura do assoalho agora; `waterExit`: ponto de saída para a água (ao lado do barco)
 * @param {{ minRadius: number, maxRadius: number, step: number, dirs: number, maxClimb: number, maxSlope: number }} cfg
 * @returns {{ x: number, z: number, y: number, water: boolean } | null} null = não dá para sair aqui
 */
export function findLanding(c, yaw, env, cfg) {
  const { groundAt, isWater, blocked, deckY } = env;
  let best = null, bd = Infinity;
  for (let r = cfg.minRadius; r <= cfg.maxRadius + 1e-9; r += cfg.step) {
    for (let k = 0; k < cfg.dirs; k++) {
      const a = yaw + (k / cfg.dirs) * Math.PI * 2;
      const x = c.x + Math.sin(a) * r, z = c.z + Math.cos(a) * r;
      if (isWater(x, z) || blocked(x, z)) continue;
      const y = groundAt(x, z);
      if (y - deckY > cfg.maxClimb) continue; // barranco alto demais para subir de um pulo
      // encosta: compara com o chão 0,6 m em volta
      const e = 0.6, sl = Math.max(Math.abs(groundAt(x + e, z) - y), Math.abs(groundAt(x - e, z) - y), Math.abs(groundAt(x, z + e) - y), Math.abs(groundAt(x, z - e) - y)) / e;
      if (sl > cfg.maxSlope) continue;
      if (r < bd) { bd = r; best = { x, z, y, water: false }; }
    }
    if (best) return best; // anel mais próximo com terra: pára aqui
  }
  const w = env.waterExit;
  if (w && !blocked(w.x, w.z)) return { x: w.x, z: w.z, y: null, water: true };
  return null;
}

/**
 * Ponto de um pulo em arco de `a` até `b` em t ∈ [0, 1] (suavizado), com altura extra `lift` no meio.
 * @param {{x: number, y: number, z: number}} a
 * @param {{x: number, y: number, z: number}} b
 * @param {{x: number, y: number, z: number}} out alterado e devolvido
 */
export function hopPath(a, b, t, lift, out) {
  const u = Math.min(1, Math.max(0, t));
  const s = u * u * (3 - 2 * u);
  out.x = a.x + (b.x - a.x) * s;
  out.z = a.z + (b.z - a.z) * s;
  out.y = a.y + (b.y - a.y) * s + Math.sin(u * Math.PI) * lift;
  return out;
}
