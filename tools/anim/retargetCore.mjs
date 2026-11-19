// Núcleo do retarget (puro: só matemática do three.js, sem carregar arquivos).
//
// Ideia: cada osso do AutoRig é um SEGMENTO (do pivô dele até o pivô do filho).
// Para cada quadro do clipe de origem medimos a direção do segmento equivalente
// no esqueleto de origem e giramos o osso do jogo pelo mesmo "swing"
// (rotação mínima de repouso → pose). Isso independe dos nomes, das
// proporções e da pose de repouso de cada esqueleto: só a DIREÇÃO dos ossos
// passa de um para o outro. A torção (twist) em volta do próprio osso é
// descartada — num quadrúpede ela quase não aparece e é a maior fonte de
// membros "enrolados" no retarget.
import * as THREE from 'three';

const _q = new THREE.Quaternion();

/**
 * Base de alinhamento: leva o espaço do modelo de origem para o do jogo
 * (Y para cima, frente em +Z), a partir de três pontos de repouso.
 * @param {THREE.Vector3} pelvis
 * @param {THREE.Vector3} head
 * @param {THREE.Vector3} feet média dos pés
 * @returns {THREE.Matrix4} rotação pura
 */
export function alignmentBasis(pelvis, head, feet) {
  const up = new THREE.Vector3().subVectors(pelvis, feet).normalize();
  const fwd = new THREE.Vector3().subVectors(head, pelvis);
  fwd.addScaledVector(up, -fwd.dot(up)).normalize(); // frente perpendicular ao "para cima"
  const right = new THREE.Vector3().crossVectors(up, fwd).normalize(); // +X do jogo
  // Linhas = eixos de origem expressos no jogo: M * v_origem = v_jogo.
  return new THREE.Matrix4().set(
    right.x, right.y, right.z, 0,
    up.x, up.y, up.z, 0,
    fwd.x, fwd.y, fwd.z, 0,
    0, 0, 0, 1,
  );
}

/**
 * Ponto ao longo de uma polilinha, pela fração do comprimento (0..1).
 * @param {THREE.Vector3[]} pts
 */
export function pointAlong(pts, f, out = new THREE.Vector3()) {
  if (pts.length === 1) return out.copy(pts[0]);
  const lens = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) { const l = pts[i].distanceTo(pts[i - 1]); lens.push(l); total += l; }
  let d = Math.min(1, Math.max(0, f)) * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) return out.lerpVectors(pts[i], pts[i + 1], lens[i] > 1e-9 ? Math.min(1, d / lens[i]) : 0);
    d -= lens[i];
  }
  return out.copy(pts[pts.length - 1]);
}

/**
 * Swing de repouso → pose: rotação mínima que leva `restDir` em `poseDir`.
 * @returns {THREE.Quaternion}
 */
export function swing(restDir, poseDir, out = new THREE.Quaternion()) {
  const a = restDir.clone().normalize(), b = poseDir.clone().normalize();
  if (a.lengthSq() < 1e-12 || b.lengthSq() < 1e-12) return out.identity();
  return out.setFromUnitVectors(a, b);
}

/**
 * Rotações LOCAIS dos ossos do jogo para um quadro.
 * @param {{ name: string, parent: string|null }[]} order ossos do jogo, pais antes dos filhos
 * @param {Map<string, THREE.Quaternion>} worldSwing swing no espaço do modelo por osso (identidade se não mapeado)
 * @returns {Map<string, THREE.Quaternion>} quatérnio local de cada osso
 *
 * Os ossos do AutoRig nascem SEM rotação (orientação = do modelo); então a
 * rotação de mundo desejada de cada osso é o próprio swing, e a local é
 * `inverso(mundo do pai) × mundo do osso`.
 */
export function localsFromWorld(order, worldSwing) {
  const world = new Map();
  const local = new Map();
  for (const b of order) {
    const w = worldSwing.get(b.name) ?? new THREE.Quaternion();
    world.set(b.name, w);
    const pw = b.parent ? world.get(b.parent) : null;
    local.set(b.name, pw ? _q.copy(pw).invert().multiply(w).clone() : w.clone());
  }
  return local;
}
