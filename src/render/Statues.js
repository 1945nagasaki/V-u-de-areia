import * as THREE from 'three';

const _box = new THREE.Box3();
const _size = new THREE.Vector3();

/**
 * Estátuas feitas dos modelos 3D reais dos animais (pose de repouso), com
 * material de pedra no lugar da pelagem. Criadas depois que o cache de
 * modelos está cheio; sem o modelo, a estátua é simplesmente omitida (o
 * pedestal continua lá).
 *
 * @example
 * placeStatues(scene, animalModels, [{ model: 'leao', x, y, z, rot, length: 4 }], materials.stone);
 *
 * @param {THREE.Object3D} parent
 * @param {{ instance(id: string): { object: THREE.Object3D } | null }} models
 * @param {{ model: string, x: number, y: number, z: number, rot?: number, length: number }[]} list
 * @param {THREE.Material} material
 * @returns {number} quantas estátuas foram criadas
 */
export function placeStatues(parent, models, list, material) {
  let made = 0;
  for (const s of list) {
    const inst = models?.instance(s.model);
    if (!inst) continue;
    const obj = inst.object;
    obj.traverse((o) => {
      if (!o.isMesh) return;
      o.material = material;
      o.castShadow = true;
      o.receiveShadow = true;
    });
    obj.rotation.set(0, 0, 0);
    obj.position.set(0, 0, 0);
    obj.updateMatrixWorld(true);
    _box.setFromObject(obj);
    _box.getSize(_size);
    const len = Math.max(_size.x, _size.z) || 1;
    const k = s.length / len;
    obj.scale.multiplyScalar(k);
    obj.position.set(s.x, s.y - _box.min.y * k, s.z);
    obj.rotation.y = s.rot ?? 0;
    obj.name = `statue-${s.model}`;
    parent.add(obj);
    made++;
  }
  return made;
}
