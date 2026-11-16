import * as THREE from 'three';
import { MINIMAP, WORLD_MAP } from '../config/minimap.js';
import { WORLD } from '../config/worldConfig.js';

/**
 * Mapa grande (tecla M) na MESMA versão do minimapa do canto: em vez da imagem
 * pintada de referência, uma foto do mundo 3D de verdade tirada de cima
 * (terreno com os biomas, rios, lago, pontes e os ícones das construções).
 *
 * Usa a mesma camada do minimapa (`MINIMAP.layer`), então mostra exatamente o
 * que o mapinha mostra — só que o continente inteiro de uma vez. A foto é
 * tirada quando o mapa abre (uma renderização, fora do loop), e copiada para
 * um canvas 2D onde a interface desenha nomes das vilas e a seta do jogador.
 *
 * Luz própria e fixa (de cima): o mapa fica legível de noite e em tempestade.
 * O mar entra como um plano simples: a água do jogo segue a câmera principal e
 * não cobre o continente inteiro.
 *
 * @example
 * const wm = new WorldMapRenderer(renderer, scene, { hide: [water.mesh], lights: [env.sun, env.hemi] });
 * wm.capture();                       // ao abrir o mapa
 * ctx.drawImage(wm.canvas, 0, 0, W, H);
 */
export class WorldMapRenderer {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} scene
   * @param {{ hide?: THREE.Object3D[], lights?: THREE.Light[], cfg?: typeof WORLD_MAP, world?: { width: number, depth: number, waterLevel: number } }} [o]
   *   `hide` = objetos que não entram na foto (a água que segue a câmera);
   *   `lights` = luzes do jogo desligadas durante a foto (entram as do mapa)
   */
  constructor(renderer, scene, { hide = [], lights = [], cfg = WORLD_MAP, world = WORLD } = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.hide = hide.filter(Boolean);
    this.lights = lights.filter(Boolean);
    this.cfg = cfg;
    this.world = world;
    const W = cfg.width, H = cfg.height, layer = MINIMAP.layer;

    this.camera = new THREE.OrthographicCamera(-world.width / 2, world.width / 2, world.depth / 2, -world.depth / 2, 1, MINIMAP.height * 2);
    this.camera.layers.set(layer);
    this.camera.up.set(0, 0, -1); // norte (−Z) para cima, como no minimapa
    this.camera.position.set(0, MINIMAP.height, 0);
    this.camera.lookAt(0, 0, 0);

    // Foto em alta (supersample) → redução com tone mapping → bytes para o canvas.
    this.target = new THREE.WebGLRenderTarget(W * cfg.supersample, H * cfg.supersample, { type: THREE.HalfFloatType });
    this.out = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, depthBuffer: false });
    this.blitScene = new THREE.Scene();
    this.blitCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.blitScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { uMap: { value: this.target.texture } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D uMap; varying vec2 vUv;
        void main() { gl_FragColor = texture2D(uMap, vUv);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false,
    })));

    // Só existem durante a foto (invisíveis no resto do tempo: o minimapa do canto não os vê).
    this.rig = new THREE.Group();
    this.rig.name = 'world-map-rig';
    this.rig.visible = false;
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(world.width * 1.1, world.depth * 1.1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: cfg.sea.color, transparent: true, opacity: cfg.sea.opacity, depthWrite: false }),
    );
    sea.position.y = world.waterLevel;
    sea.renderOrder = 5; // por cima do terreno submerso, por baixo dos ícones (10)
    sea.frustumCulled = false;
    const sun = new THREE.DirectionalLight(cfg.light.sunColor, cfg.light.sun);
    sun.position.set(...cfg.light.direction).multiplyScalar(MINIMAP.height);
    const hemi = new THREE.HemisphereLight(cfg.light.sky, cfg.light.ground, cfg.light.hemi);
    this.rig.add(sea, sun, sun.target, hemi);
    this.rig.traverse((o) => o.layers.set(layer));
    this.rig.userData.noCollide = true;
    scene.add(this.rig);

    /** Canvas 2D com a última foto (null em ambiente sem DOM). */
    this.canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (this.canvas) { this.canvas.width = W; this.canvas.height = H; }
    this.pixels = new Uint8Array(W * H * 4);
    this.ready = false;
    this._clear = new THREE.Color();
  }

  /**
   * Tira a foto do continente e copia para `this.canvas`.
   * Restaura todo o estado do renderizador e da cena que mexer.
   * @returns {HTMLCanvasElement|null}
   */
  capture() {
    const r = this.renderer, scene = this.scene, cfg = this.cfg;
    // ---- guarda o estado
    const prevTarget = r.getRenderTarget(), prevAlpha = r.getClearAlpha(), prevAutoShadow = r.shadowMap.autoUpdate;
    r.getClearColor(this._clear);
    const fog = scene.fog, background = scene.background;
    const hidden = this.hide.map((o) => o.visible), lit = this.lights.map((l) => l.visible);

    // ---- cena do mapa: sem neblina, sem céu, luz fixa de cima, mar plano
    scene.fog = null;
    scene.background = null;
    for (const o of this.hide) o.visible = false;
    for (const l of this.lights) l.visible = false;
    this.rig.visible = true;
    r.shadowMap.autoUpdate = false; // não refaz sombras para a foto
    try {
      r.setRenderTarget(this.target);
      r.setClearColor(cfg.sea.deep, 1);
      r.clear();
      r.render(scene, this.camera);
      r.setRenderTarget(this.out);
      r.render(this.blitScene, this.blitCamera);
      r.readRenderTargetPixels(this.out, 0, 0, cfg.width, cfg.height, this.pixels);
    } finally {
      // ---- devolve tudo como estava
      this.rig.visible = false;
      this.hide.forEach((o, i) => { o.visible = hidden[i]; });
      this.lights.forEach((l, i) => { l.visible = lit[i]; });
      scene.fog = fog;
      scene.background = background;
      r.shadowMap.autoUpdate = prevAutoShadow;
      r.setClearColor(this._clear, prevAlpha);
      r.setRenderTarget(prevTarget);
    }
    if (this.canvas) {
      const ctx = this.canvas.getContext('2d');
      ctx.putImageData(new ImageData(flipRows(this.pixels, cfg.width, cfg.height), cfg.width, cfg.height), 0, 0);
    }
    this.ready = true;
    return this.canvas;
  }
}

/**
 * O WebGL devolve as linhas de baixo para cima; o canvas quer de cima para baixo.
 * @param {Uint8Array} src RGBA @param {number} w @param {number} h
 * @returns {Uint8ClampedArray} cópia com as linhas invertidas
 */
export function flipRows(src, w, h) {
  const out = new Uint8ClampedArray(src.length), row = w * 4;
  for (let y = 0; y < h; y++) out.set(src.subarray(y * row, (y + 1) * row), (h - 1 - y) * row);
  return out;
}
