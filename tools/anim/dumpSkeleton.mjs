// Imprime a árvore de ossos de um .glb com a posição de repouso (espaço do modelo).
// Uso: node tools/anim/dumpSkeleton.mjs arquivo.glb
import * as THREE from 'three';
import { loadGlbNode } from './nodeGltf.mjs';

const gltf = await loadGlbNode(process.argv[2]);
gltf.scene.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(gltf.scene);
console.log('caixa', box.min.toArray().map((v) => +v.toFixed(2)), box.max.toArray().map((v) => +v.toFixed(2)));
const v = new THREE.Vector3();
const roots = [];
gltf.scene.traverse((o) => { if (o.isBone && !o.parent?.isBone) roots.push(o); });
const walk = (b, d) => {
  b.getWorldPosition(v);
  console.log(`${'  '.repeat(d)}${b.name} [${v.toArray().map((x) => x.toFixed(2)).join(', ')}]`);
  for (const c of b.children) if (c.isBone) walk(c, d + 1);
};
for (const r of roots) walk(r, 0);
for (const a of gltf.animations) console.log('clip', a.name, a.duration.toFixed(2) + 's', a.tracks.length, 'tracks');
