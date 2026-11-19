// Carrega um .glb no Node com o GLTFLoader do three.js, sem WebGL: tira as
// texturas (o Node não decodifica imagens) e decodifica Draco/meshopt antes.
// Só para ferramentas offline (retarget); o jogo usa o carregador normal.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let io = null;
async function getIO() {
  if (!io) {
    io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
    });
  }
  return io;
}

/** @returns {Promise<import('three/addons/loaders/GLTFLoader.js').GLTF>} */
export async function loadGlbNode(path) {
  const nio = await getIO();
  const doc = await nio.read(path);
  for (const t of doc.getRoot().listTextures()) t.dispose();
  for (const ext of doc.getRoot().listExtensionsUsed()) {
    if (/draco|meshopt|texture_webp|texture_basisu/i.test(ext.extensionName)) ext.dispose();
  }
  const bin = await nio.writeBinary(doc);
  const buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
  return new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej));
}
