import * as THREE from 'three';
import { STORM } from '../config/survival.js';

/**
 * Tempestade visual: chuva (linhas caindo em volta da câmera), nuvens escuras
 * (domo cinza), relâmpagos (flash de luz) e a mistura da iluminação de
 * tempestade sobre a do bioma. `intensity` 1 = tempestade, 0 = céu limpo.
 * A cor "sun-bleached" pós-tempestade aparece em `bleach` (0..1).
 *
 * Integração:
 *   weather.update(dt, camera, intensity, rng) → { thunder: boolean }
 *   weather.applyTo(environment)  (depois de environment.update)
 */
export class Weather {
  constructor(scene, cfg = STORM) {
    this.cfg = cfg;
    this.intensity = 1;
    this.bleach = 0;
    this.flash = 0;
    this.nextBolt = 3;
    this.storm = parse(cfg.ambience);
    this.bleached = parse(cfg.bleached);

    // Chuva: segmentos de linha (cada gota = 2 vértices).
    const n = cfg.rainCount;
    this.drops = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.drops[i * 3] = (Math.random() - 0.5) * cfg.rainArea * 2;
      this.drops[i * 3 + 1] = Math.random() * cfg.rainHeight;
      this.drops[i * 3 + 2] = (Math.random() - 0.5) * cfg.rainArea * 2;
    }
    this.positions = new Float32Array(n * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.rainMat = new THREE.LineBasicMaterial({ color: 0xaab4c0, transparent: true, opacity: 0.45, depthWrite: false, fog: false });
    this.rain = new THREE.LineSegments(geo, this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.renderOrder = 3;
    scene.add(this.rain);

    // Nuvens: domo escuro com manchas, acima do céu do bioma.
    this.cloudMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide, fog: false,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uFlash: { value: 0 } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: /* glsl */ `
        uniform float uTime, uOpacity, uFlash; varying vec3 vDir;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){
          vec2 p = vDir.xz / max(0.15, vDir.y + 0.25) * 2.2 + vec2(uTime * 0.05, uTime * 0.02);
          float c = n(p) * 0.5 + n(p * 2.1) * 0.3 + n(p * 4.3) * 0.2;
          vec3 col = mix(vec3(0.06,0.07,0.08), vec3(0.22,0.24,0.27), c) + uFlash * vec3(0.55,0.6,0.7);
          float a = uOpacity * smoothstep(-0.25, 0.1, vDir.y);
          gl_FragColor = vec4(col, a);
          #include <colorspace_fragment>
        }`,
    });
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), this.cloudMat);
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = 0;
    scene.add(this.clouds);
  }

  /**
   * @param {number} intensity 1 tempestade … 0 limpo
   * @param {number} bleach 0..1 quanto do ar "branqueado de sol" pós-tempestade
   * @returns {{ thunder: boolean }}
   */
  update(dt, camera, intensity, bleach, rng = Math.random) {
    this.intensity = intensity;
    this.bleach = bleach;
    const cfg = this.cfg;
    const on = intensity > 0.01;
    this.rain.visible = on;
    this.clouds.visible = on;
    let thunder = false;
    this.flash = Math.max(0, this.flash - dt * 4);
    if (on) {
      const cp = camera.position;
      const A = cfg.rainArea, H = cfg.rainHeight;
      const fall = cfg.rainSpeed * dt;
      const len = 0.9;
      const pos = this.positions, d = this.drops;
      const visibleCount = Math.floor((d.length / 3) * Math.min(1, intensity * 1.2));
      for (let i = 0; i < d.length / 3; i++) {
        let y = d[i * 3 + 1] - fall;
        if (y < 0) y += H;
        d[i * 3 + 1] = y;
        const j = i * 6;
        if (i >= visibleCount) { pos[j + 1] = pos[j + 4] = -9999; continue; }
        // Posição relativa à câmera, embrulhada numa caixa (a chuva te segue).
        const x = cp.x + wrap(d[i * 3] - cp.x, A);
        const z = cp.z + wrap(d[i * 3 + 2] - cp.z, A);
        const yy = cp.y - H * 0.4 + y;
        pos[j] = x; pos[j + 1] = yy; pos[j + 2] = z;
        pos[j + 3] = x + 0.12; pos[j + 4] = yy - len; pos[j + 5] = z + 0.05;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      this.rainMat.opacity = 0.45 * intensity;

      this.nextBolt -= dt;
      if (this.nextBolt <= 0 && intensity > 0.5) {
        this.nextBolt = cfg.lightningMin + rng() * (cfg.lightningMax - cfg.lightningMin);
        this.flash = 1;
        thunder = true;
      }
      this.clouds.position.copy(camera.position);
      this.cloudMat.uniforms.uTime.value += dt;
      this.cloudMat.uniforms.uOpacity.value = Math.min(1, intensity * 1.15);
      this.cloudMat.uniforms.uFlash.value = this.flash * intensity;
    }
    return { thunder };
  }

  /** Mistura a luz de tempestade (e a de pós-tempestade) sobre o ambiente do bioma. */
  applyTo(env) {
    const s = env.state;
    const k = this.intensity, b = this.bleach * (1 - k);
    if (k < 0.001 && b < 0.001) return;
    const mix = (target, w) => {
      for (const key of ['fogColor', 'skyTop', 'skyHorizon', 'sunColor', 'hemiSky', 'hemiGround']) _c.copy(s[key]).lerp(target[key], w), out[key] = _c.clone();
      for (const key of ['fogDensity', 'sunIntensity', 'hemiIntensity', 'exposure']) out[key] = s[key] + (target[key] - s[key]) * w;
    };
    const out = {};
    if (k >= b) mix(this.storm, k); else mix(this.bleached, b);
    env.scene.fog.color.copy(out.fogColor);
    env.scene.fog.density = out.fogDensity;
    env.hemi.color.copy(out.hemiSky);
    env.hemi.groundColor.copy(out.hemiGround);
    env.hemi.intensity = out.hemiIntensity + this.flash * 2.5 * k;
    env.sun.color.copy(out.sunColor);
    env.sun.intensity = out.sunIntensity;
    env.renderer.toneMappingExposure = out.exposure + this.flash * 0.6 * k;
    env.skyUniforms.uTop.value.copy(out.skyTop);
    env.skyUniforms.uHorizon.value.copy(out.skyHorizon);
    env.skyUniforms.uSunStrength.value = Math.min(1, out.sunIntensity / 2);
  }
}

const _c = new THREE.Color();

function parse(a) {
  const o = {};
  for (const [k, v] of Object.entries(a)) o[k] = k.includes('Color') || k.startsWith('sky') || k.startsWith('hemiS') || k === 'hemiGround' ? new THREE.Color(v) : v;
  return o;
}

function wrap(v, A) {
  return ((((v + A) % (2 * A)) + 2 * A) % (2 * A)) - A;
}
