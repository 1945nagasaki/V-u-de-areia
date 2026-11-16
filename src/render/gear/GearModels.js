import * as THREE from 'three';
import { GEAR_CATALOG } from '../../config/gear.js';

/**
 * Modelos 3D dos itens do pacote (config/gear.js), feitos no próprio projeto
 * com geometria procedural — nenhum arquivo externo, nenhuma licença de
 * terceiros. Os modelos candidatos de sites externos NÃO foram baixados
 * (ver CREDITS-ITEMS.md); quando um GLB for aprovado, basta preencher
 * `model.glb` no catálogo: o carregador abaixo usa o arquivo no lugar.
 *
 * Convenção (igual para todos): a EMPUNHADURA fica na origem, a ponta/cano
 * aponta para +Z e o "lado de cima" é +Y. Peças que se mexem ficam em
 * `userData.parts` (carregador, ferrolho, corda do arco, flecha encaixada).
 *
 * Protótipos são construídos uma vez por id e clonados (geometria e material
 * compartilhados): equipar o mesmo item de novo não aloca nem carrega nada.
 *
 * @example
 * const models = new GearModels();
 * const sword = models.create('espada_metal');   // THREE.Group pronto para a mão
 * hand.add(sword);
 */
export class GearModels {
  constructor({ catalog = GEAR_CATALOG, loader = null } = {}) {
    this.catalog = catalog;
    /** GLTFLoader opcional (só usado por itens com `model.glb`). */
    this.loader = loader;
    this.protos = new Map();
    this.glbs = new Map(); // caminho → Promise<Object3D> (um download por arquivo)
    this.mats = createMaterials();
  }

  /** Clone pronto para a cena (peças móveis religadas em `userData.parts`). */
  create(id) {
    const proto = this.prototype(id);
    const g = proto.clone(true);
    g.userData.parts = {};
    for (const name of Object.keys(proto.userData.parts ?? {})) g.userData.parts[name] = g.getObjectByName(name);
    // a corda do arco é redesenhada a cada puxada: cada cópia precisa da sua geometria
    const s = g.userData.parts.string;
    if (s) s.geometry = s.geometry.clone();
    g.userData.itemId = id;
    return g;
  }

  prototype(id) {
    let p = this.protos.get(id);
    if (p) return p;
    const def = this.catalog[id];
    const build = BUILDERS[def?.model?.builder] ?? BUILDERS.fallback;
    p = build(this.mats, def?.materialTier ?? null, id);
    p.name = `item:${id}`;
    p.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = true; } });
    this.protos.set(id, p);
    // GLB aprovado: troca a malha quando chegar (uma vez), mantendo o procedural até lá.
    if (def?.model?.glb && this.loader) this.loadGlb(def.model.glb).then((scene) => { p.userData.glb = scene; }).catch(() => {});
    return p;
  }

  /** Um download por arquivo, mesmo com muitos pedidos. */
  loadGlb(path) {
    if (!this.glbs.has(path)) this.glbs.set(path, new Promise((res, rej) => this.loader.load(path, (g) => res(g.scene), undefined, rej)));
    return this.glbs.get(path);
  }

  /** Ids com modelo próprio (todos os do catálogo, hoje). */
  has(id) {
    return !!BUILDERS[this.catalog[id]?.model?.builder];
  }
}

/** Nomes dos construtores (para o teste conferir que todo item tem modelo). */
export const MODEL_BUILDERS = () => Object.keys(BUILDERS).filter((k) => k !== 'fallback');

// ---------------------------------------------------------------- materiais

function createMaterials() {
  const m = (color, roughness = 0.8, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  return {
    // níveis: pedra fosca e lascada, ouro quente, aço frio de brilho contido
    pedra: m(0x8b8983, 0.96, 0, { flatShading: true }),
    pedraDark: m(0x64625e, 0.98, 0, { flatShading: true }),
    ouro: m(0xdba628, 0.34, 0.92),
    ouroDark: m(0xa9741a, 0.45, 0.85),
    metal: m(0xbcc4cc, 0.3, 0.9),
    metalDark: m(0x7d8790, 0.42, 0.85),
    wood: m(0x6e4726, 0.85),
    woodDark: m(0x4a2f1a, 0.9),
    woodLight: m(0xa9824f, 0.8),
    leather: m(0x8a5a2b, 0.9),
    fiber: m(0xc8b27a, 0.95),
    gun: m(0x2a2d31, 0.45, 0.75),
    gunDark: m(0x17191c, 0.6, 0.6),
    brass: m(0xc79a3a, 0.35, 0.9),
    copper: m(0xb4683a, 0.4, 0.85),
    bone: m(0xe6dcc4, 0.75),
    boneDark: m(0xb7a98a, 0.85),
    black: m(0x15120f, 0.9),
    cloth: m(0x7a1f24, 0.95, 0, { side: THREE.DoubleSide }),
    clothTrim: m(0xc9a24a, 0.6, 0.5, { side: THREE.DoubleSide }),
    bronze: m(0x6f7a52, 0.6, 0.7),
    gemRed: m(0xb3202c, 0.2, 0.1),
    gemBlue: m(0x2c5fb3, 0.2, 0.1),
    feather: m(0xe9e4d8, 0.9, 0, { side: THREE.DoubleSide }),
    // comida
    banana: m(0xf2cf3a, 0.6), bananaTip: m(0x5a4320, 0.8),
    cookie: m(0xc48a4a, 0.9), chocolate: m(0x3d2414, 0.7),
    mug: m(0xe8e2d6, 0.5), coffee: m(0x2a160b, 0.3),
    carrot: m(0xe8782a, 0.7), green: m(0x4f9a3a, 0.8), greenDark: m(0x2f6a2a, 0.85),
    water: m(0x4aa8e8, 0.1, 0, { transparent: true, opacity: 0.55 }), cap: m(0x2f6fd0, 0.5),
    bun: m(0xc98a45, 0.75), bunTop: m(0xd9a05a, 0.7), patty: m(0x4a2a18, 0.85), cheese: m(0xf0b730, 0.6), lettuce: m(0x6ab04a, 0.8), tomato: m(0xd0312a, 0.55),
    apple: m(0xc8242a, 0.45), corn: m(0xf0c62e, 0.6), bread: m(0xc88f4c, 0.85), breadCut: m(0x8f5f2c, 0.9),
    grape: m(0x6b2f8f, 0.4), pillRed: m(0xd23a3a, 0.35), pillWhite: m(0xf0ece4, 0.35), pillBlue: m(0x3a78d2, 0.35),
  };
}

// ---------------------------------------------------------------- utilitários de malha

const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); return o; };
const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
/** Cilindro deitado ao longo de Z. */
const rod = (r0, r1, len, mat, x = 0, y = 0, z = 0, seg = 10) => mesh(new THREE.CylinderGeometry(r1, r0, len, seg).rotateX(Math.PI / 2), mat, x, y, z);
/** Cilindro em pé (eixo Y). */
const post = (r0, r1, len, mat, x = 0, y = 0, z = 0, seg = 12) => mesh(new THREE.CylinderGeometry(r1, r0, len, seg), mat, x, y, z);
const ball = (r, mat, x, y, z, seg = 12) => mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4)), mat, x, y, z);
const group = (...kids) => { const g = new THREE.Group(); for (const k of kids) if (k) g.add(k); return g; };
const part = (g, name, o) => { o.name = name; (g.userData.parts ??= {})[name] = o; return o; };

/** Ruído determinístico pela posição (vértices iguais se mexem juntos: sem frestas). */
function hash3(x, y, z, seed) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453;
  return s - Math.floor(s);
}

/** Pedra lascada: desloca os vértices e deixa as faces planas. */
function chipped(geo, amount, seed = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + (hash3(Math.round(x * 500), Math.round(y * 500), Math.round(z * 500), seed) - 0.5) * 2 * amount;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** Lâmina plana (perfil no plano XZ, espessura em Y): `pts` = [[x, z], …] de meio perfil simétrico. */
function bladeGeo(half, thickness) {
  const s = new THREE.Shape();
  s.moveTo(half[0][0], half[0][1]);
  for (const [x, z] of half.slice(1)) s.lineTo(x, z);
  for (const [x, z] of [...half].reverse().slice(1)) s.lineTo(-x, z);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thickness * 0.4, bevelEnabled: true, bevelThickness: thickness * 0.3, bevelSize: Math.min(0.012, half[0][0] * 0.6), bevelSegments: 1 });
  g.translate(0, 0, -thickness * 0.2);
  g.rotateX(Math.PI / 2); // (x, y, z) → (x, -z, y): perfil vira XZ, espessura vira Y
  return g;
}

/** Cabo com faixa de couro/fibra: ao longo de Z, de z0 a z1. */
function handle(M, z0, z1, r = 0.015, wrap = M.leather, wood = M.wood) {
  const len = z1 - z0, mid = (z0 + z1) / 2;
  return group(rod(r, r * 0.92, len, wood, 0, 0, mid, 8), rod(r * 1.14, r * 1.14, Math.min(0.11, len * 0.45), wrap, 0, 0, Math.max(z0 + 0.055, 0), 8));
}

/** Amarração de fibra (voltas em volta do cabo) na altura z. */
function lashing(M, z, r, turns = 3) {
  const g = new THREE.Group();
  for (let i = 0; i < turns; i++) {
    const t = mesh(new THREE.TorusGeometry(r, r * 0.22, 5, 10), M.fiber, 0, 0, z + (i - (turns - 1) / 2) * r * 0.55);
    t.rotation.z = i * 0.7;
    g.add(t);
  }
  return g;
}

// ---------------------------------------------------------------- construtores

const BUILDERS = {
  fallback: (M) => group(box(0.08, 0.08, 0.08, M.woodLight)),

  adaga(M, tier) {
    const g = group(handle(M, -0.055, 0.05, 0.014));
    if (tier === 'pedra') {
      g.add(mesh(chipped(new THREE.OctahedronGeometry(1, 1).scale(0.026, 0.01, 0.1), 0.16, 3), M.pedra, 0, 0, 0.13), lashing(M, 0.05, 0.017, 4));
    } else {
      const mat = M[tier], dark = M[`${tier}Dark`];
      g.add(mesh(bladeGeo([[0.019, 0], [0.017, 0.12], [0, 0.2]], 0.006), mat, 0, 0, 0.058));
      g.add(box(0.07, 0.014, 0.012, dark, 0, 0, 0.055), ball(0.014, dark, 0, 0, -0.062, 8));
    }
    return g;
  },

  espada(M, tier) {
    const g = group(handle(M, -0.09, 0.07, 0.016));
    if (tier === 'pedra') {
      // tábua de madeira com lascas de pedra nas duas bordas e na ponta
      g.add(box(0.05, 0.016, 0.52, M.woodDark, 0, 0, 0.33));
      for (let i = 0; i < 7; i++) for (const s of [-1, 1]) {
        const shard = mesh(chipped(new THREE.OctahedronGeometry(1, 0).scale(0.02, 0.008, 0.034), 0.25, i * 2 + s), M.pedra, s * 0.032, 0, 0.13 + i * 0.066);
        shard.rotation.y = s * 0.25;
        g.add(shard);
      }
      g.add(mesh(chipped(new THREE.OctahedronGeometry(1, 0).scale(0.028, 0.01, 0.05), 0.2, 9), M.pedra, 0, 0, 0.61), lashing(M, 0.075, 0.019, 4));
    } else {
      const mat = M[tier], dark = M[`${tier}Dark`];
      g.add(mesh(bladeGeo([[0.026, 0], [0.022, 0.5], [0, 0.6]], 0.007), mat, 0, 0, 0.085));
      g.add(box(0.012, 0.004, 0.42, dark, 0, 0, 0.32)); // sulco central
      g.add(box(0.16, 0.02, 0.018, dark, 0, 0, 0.078), ball(0.02, dark, 0, 0, -0.1, 8));
    }
    return g;
  },

  machado(M, tier) {
    // cabo sobe por +Z; o fio fica para −Y (para a frente quando o braço aponta adiante)
    const g = group(handle(M, -0.1, 0.5, 0.017));
    if (tier === 'pedra') {
      const head = mesh(chipped(new THREE.OctahedronGeometry(1, 1).scale(0.05, 0.11, 0.07), 0.14, 5), M.pedra, 0, -0.06, 0.43);
      g.add(head, lashing(M, 0.4, 0.021, 3), lashing(M, 0.46, 0.021, 3));
    } else {
      const mat = M[tier], dark = M[`${tier}Dark`];
      const s = new THREE.Shape();
      s.moveTo(-0.03, 0.02); s.lineTo(0.03, 0.02); s.lineTo(0.045, -0.1); s.quadraticCurveTo(0, -0.16, -0.065, -0.1); s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1 });
      geo.translate(0, 0, -0.006).rotateY(Math.PI / 2); // perfil no plano ZY
      g.add(mesh(geo, mat, 0, 0, 0.43), box(0.04, 0.05, 0.07, dark, 0, 0, 0.43));
    }
    return g;
  },

  picareta(M, tier) {
    const g = group(handle(M, -0.1, 0.52, 0.017));
    if (tier === 'pedra') {
      for (const s of [-1, 1]) {
        const tip = mesh(chipped(new THREE.ConeGeometry(0.034, 0.2, 5).rotateX(s < 0 ? Math.PI : 0), 0.16, 7 + s), M.pedra, 0, s * 0.1, 0.47);
        tip.rotation.x = s * 0.25;
        g.add(tip);
      }
      g.add(lashing(M, 0.45, 0.022, 3), lashing(M, 0.5, 0.022, 3));
    } else {
      const mat = M[tier], dark = M[`${tier}Dark`];
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.21, -0.06), new THREE.Vector3(0, 0, 0.04), new THREE.Vector3(0, 0.21, -0.06));
      const head = mesh(new THREE.TubeGeometry(curve, 12, 0.016, 6), mat, 0, 0, 0.47);
      g.add(head, box(0.045, 0.06, 0.06, dark, 0, 0, 0.49));
      for (const s of [-1, 1]) {
        const tip = mesh(new THREE.ConeGeometry(0.016, 0.07, 6), mat, 0, s * 0.235, 0.4);
        tip.rotation.x = s > 0 ? -0.45 : Math.PI + 0.45;
        g.add(tip);
      }
    }
    return g;
  },

  arco(M) {
    // segurado em pé: limbos ao longo de ±Z, barriga para −Y (frente), corda do lado +Y (arqueiro)
    const g = new THREE.Group();
    const tipY = 0.13, tipZ = 0.62;
    for (const s of [-1, 1]) {
      const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, s * 0.07), new THREE.Vector3(0, -0.1, s * 0.36), new THREE.Vector3(0, tipY, s * tipZ));
      g.add(mesh(new THREE.TubeGeometry(c, 14, 0.013, 6), M.wood));
      g.add(ball(0.016, M.woodDark, 0, tipY, s * tipZ, 6));
    }
    g.add(rod(0.019, 0.019, 0.15, M.leather, 0, 0, 0, 8));
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, tipY, -tipZ, 0, tipY, 0, 0, tipY, tipZ]), 3));
    const string = part(g, 'string', new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xe8dcc0 })));
    string.userData.rest = tipY;
    g.add(string);
    const arrow = part(g, 'arrow', BUILDERS.flecha(M, 'pedra'));
    arrow.rotation.x = Math.PI / 2; // ponta para −Y (frente)
    arrow.visible = false;
    g.add(arrow);
    return g;
  },

  flecha(M, tier) {
    const g = group(rod(0.006, 0.006, 0.72, M.woodLight, 0, 0, 0, 6));
    if (tier === 'pedra') g.add(mesh(chipped(new THREE.OctahedronGeometry(1, 0).scale(0.016, 0.006, 0.035), 0.2, 2), M.pedra, 0, 0, 0.385), lashing(M, 0.35, 0.008, 2));
    else g.add(mesh(new THREE.ConeGeometry(0.014, 0.06, 4).rotateX(Math.PI / 2).scale(1, 0.45, 1), M[tier ?? 'metal'], 0, 0, 0.385));
    for (let i = 0; i < 3; i++) {
      const f = mesh(new THREE.PlaneGeometry(0.03, 0.09).translate(0.018, 0, 0).rotateX(Math.PI / 2), M.feather, 0, 0, -0.29);
      f.rotation.z = (i / 3) * Math.PI * 2;
      g.add(f);
    }
    return g;
  },

  pistola(M) {
    const g = new THREE.Group();
    const gripM = box(0.03, 0.105, 0.045, M.gunDark, 0, -0.035, -0.005);
    gripM.rotation.x = -0.22;
    g.add(gripM, box(0.03, 0.03, 0.15, M.gun, 0, 0.032, 0.05));
    g.add(part(g, 'slide', group(box(0.032, 0.028, 0.185, M.gun, 0, 0.06, 0.045), box(0.006, 0.01, 0.012, M.gunDark, 0, 0.078, -0.035), box(0.004, 0.008, 0.008, M.gunDark, 0, 0.078, 0.13))));
    g.add(rod(0.007, 0.007, 0.02, M.gunDark, 0, 0.06, 0.145, 8)); // boca do cano
    const guard = mesh(new THREE.TorusGeometry(0.02, 0.004, 5, 12, Math.PI), M.gunDark, 0, 0.012, 0.045);
    guard.rotation.set(0, Math.PI / 2, Math.PI);
    g.add(guard, box(0.006, 0.02, 0.006, M.gunDark, 0, 0.008, 0.04));
    const mag = part(g, 'magazine', group(box(0.022, 0.1, 0.03, M.metalDark, 0, -0.04, -0.006), box(0.026, 0.008, 0.036, M.gunDark, 0, -0.092, -0.006)));
    mag.rotation.x = -0.22;
    g.add(mag);
    g.userData.muzzle = new THREE.Vector3(0, 0.06, 0.16);
    return g;
  },

  rifle(M) {
    const g = new THREE.Group();
    const grip = box(0.03, 0.09, 0.04, M.woodDark, 0, -0.035, 0);
    grip.rotation.x = -0.3;
    g.add(grip);
    g.add(box(0.04, 0.055, 0.26, M.gun, 0, 0.04, 0.08)); // caixa da culatra
    const stock = box(0.035, 0.07, 0.28, M.wood, 0, 0.012, -0.2);
    stock.rotation.x = 0.1;
    g.add(stock, box(0.04, 0.1, 0.02, M.gunDark, 0, 0.0, -0.345));
    g.add(box(0.042, 0.045, 0.24, M.wood, 0, 0.035, 0.33)); // guarda-mão de madeira
    g.add(rod(0.009, 0.008, 0.36, M.gunDark, 0, 0.045, 0.63, 8), rod(0.006, 0.006, 0.22, M.gunDark, 0, 0.065, 0.46, 6));
    g.add(box(0.006, 0.022, 0.008, M.gunDark, 0, 0.068, 0.78), box(0.014, 0.016, 0.03, M.gunDark, 0, 0.076, 0.02));
    g.add(part(g, 'slide', box(0.012, 0.012, 0.04, M.metalDark, 0.026, 0.05, 0.1))); // alavanca do ferrolho
    const mag = part(g, 'magazine', new THREE.Group());
    for (let i = 0; i < 4; i++) {
      const seg = box(0.026, 0.04, 0.05, M.metalDark, 0, -0.01 - i * 0.034, 0.13 + i * i * 0.004);
      seg.rotation.x = i * 0.09;
      mag.add(seg);
    }
    g.add(mag);
    g.userData.muzzle = new THREE.Vector3(0, 0.045, 0.81);
    return g;
  },

  municao_pistola: (M) => cartridges(M, 0.0046, 0.019, 0.011),
  municao_rifle: (M) => cartridges(M, 0.0056, 0.038, 0.02),

  pedra: (M) => group(mesh(chipped(new THREE.IcosahedronGeometry(0.055, 1).scale(1.15, 0.8, 1), 0.2, 4), M.pedra)),

  graveto(M) {
    const g = group(rod(0.011, 0.008, 0.34, M.wood, 0, 0, 0.09, 6));
    const twig = rod(0.006, 0.004, 0.1, M.woodDark, 0.02, 0.01, 0.17, 5);
    twig.rotation.y = 0.7;
    g.add(twig, rod(0.012, 0.012, 0.002, M.woodLight, 0, 0, -0.081, 6));
    return g;
  },

  barra_metal: (M) => ingot(M.metal, M.metalDark),
  barra_ouro: (M) => ingot(M.ouro, M.ouroDark),

  banana(M) {
    const b = mesh(new THREE.TorusGeometry(0.085, 0.019, 6, 14, Math.PI * 0.62), M.banana, 0, -0.085, 0.02);
    b.rotation.set(0, Math.PI / 2, 0.6);
    const g = group(b);
    for (const a of [0.6, 0.6 + Math.PI * 0.62]) g.add(ball(0.011, M.bananaTip, 0, -0.085 + Math.sin(a) * 0.085, 0.02 + Math.cos(a) * -0.085, 6));
    return g;
  },

  biscoito(M) {
    const g = group(post(0.045, 0.043, 0.012, M.cookie, 0, 0, 0.02, 14));
    for (let i = 0; i < 6; i++) g.add(ball(0.006, M.chocolate, Math.cos(i * 2.2) * 0.026 * (i % 2 ? 1 : 0.5), 0.007, 0.02 + Math.sin(i * 2.2) * 0.026 * (i % 2 ? 1 : 0.5), 5));
    return g;
  },

  cafe(M) {
    const g = group(post(0.034, 0.038, 0.08, M.mug, 0, 0.0, 0.0, 16), post(0.034, 0.034, 0.004, M.coffee, 0, 0.039, 0, 16));
    const h = mesh(new THREE.TorusGeometry(0.024, 0.006, 6, 12, Math.PI), M.mug, 0.038, 0, 0);
    h.rotation.z = -Math.PI / 2;
    g.add(h);
    return g;
  },

  cenoura(M) {
    const g = group(mesh(new THREE.ConeGeometry(0.022, 0.16, 8).rotateX(-Math.PI / 2), M.carrot, 0, 0, 0.04));
    for (let i = 0; i < 4; i++) {
      const leaf = mesh(new THREE.ConeGeometry(0.008, 0.07, 4).rotateX(Math.PI / 2), M.green, Math.cos(i * 1.6) * 0.009, Math.sin(i * 1.6) * 0.009, 0.15);
      leaf.rotation.set(Math.sin(i * 1.6) * -0.3, Math.cos(i * 1.6) * 0.3, 0);
      g.add(leaf);
    }
    return g;
  },

  agua(M) {
    return group(post(0.03, 0.03, 0.13, M.water, 0, 0.0, 0, 14), post(0.03, 0.013, 0.035, M.water, 0, 0.082, 0, 14), post(0.014, 0.014, 0.018, M.cap, 0, 0.108, 0, 10),
      post(0.0305, 0.0305, 0.04, M.pillWhite, 0, 0.0, 0, 14));
  },

  hamburguer(M) {
    const top = mesh(new THREE.SphereGeometry(0.058, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1), M.bunTop, 0, 0.022, 0);
    const g = group(post(0.056, 0.05, 0.022, M.bun, 0, -0.03, 0, 14), post(0.06, 0.06, 0.016, M.patty, 0, -0.008, 0, 14),
      box(0.105, 0.004, 0.105, M.cheese, 0, 0.003, 0), post(0.064, 0.064, 0.006, M.lettuce, 0, 0.01, 0, 9), post(0.05, 0.05, 0.006, M.tomato, 0, 0.017, 0, 12), top);
    for (let i = 0; i < 7; i++) g.add(ball(0.0035, M.pillWhite, Math.cos(i * 2.4) * 0.03, 0.058 - 0.012 * (i % 2), Math.sin(i * 2.4) * 0.03, 4));
    return g;
  },

  maca(M) {
    return group(mesh(new THREE.SphereGeometry(0.046, 14, 10).scale(1, 0.92, 1), M.apple), post(0.003, 0.003, 0.025, M.woodDark, 0, 0.05, 0, 5),
      mesh(new THREE.SphereGeometry(0.014, 6, 4).scale(1, 0.25, 0.55), M.green, 0.014, 0.056, 0));
  },

  milho(M) {
    const g = group(mesh(new THREE.CapsuleGeometry(0.026, 0.11, 4, 10).rotateX(Math.PI / 2), M.corn, 0, 0, 0.05));
    for (let i = 0; i < 3; i++) {
      const husk = mesh(new THREE.ConeGeometry(0.03, 0.13, 4, 1, true).rotateX(-Math.PI / 2).scale(1, 0.35, 1), M.green, Math.cos(i * 2.1) * 0.014, Math.sin(i * 2.1) * 0.014, 0.01);
      husk.rotation.z = i * 2.1 + Math.PI / 2;
      husk.material = M.green;
      g.add(husk);
    }
    return g;
  },

  pao(M) {
    const g = group(mesh(new THREE.CapsuleGeometry(0.04, 0.1, 4, 10).rotateX(Math.PI / 2).scale(1, 0.72, 1), M.bread, 0, 0, 0.03));
    for (let i = -1; i <= 1; i++) { const cut = box(0.05, 0.004, 0.008, M.breadCut, 0, 0.028, 0.03 + i * 0.035); cut.rotation.y = 0.5; g.add(cut); }
    return g;
  },

  queijo(M) {
    const g = group(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.045, 10, 1, false, 0, Math.PI / 3.2), M.cheese, 0, 0, -0.03));
    for (const [x, y, z, r] of [[0.03, 0.023, 0.03, 0.008], [0.05, 0.023, 0.045, 0.006], [0.02, 0.0, 0.058, 0.007]]) g.add(ball(r, M.ouroDark, x, y, z - 0.03, 6));
    return g;
  },

  tomate(M) {
    const g = group(mesh(new THREE.SphereGeometry(0.044, 14, 10).scale(1, 0.82, 1), M.tomato));
    for (let i = 0; i < 5; i++) { const s = mesh(new THREE.ConeGeometry(0.007, 0.03, 3).rotateZ(-Math.PI / 2), M.greenDark, Math.cos(i * 1.257) * 0.014, 0.036, Math.sin(i * 1.257) * 0.014); s.rotation.y = -i * 1.257; g.add(s); }
    g.add(post(0.003, 0.003, 0.014, M.greenDark, 0, 0.042, 0, 4));
    return g;
  },

  uva(M) {
    const g = group(post(0.003, 0.003, 0.03, M.woodDark, 0, 0.055, 0, 4));
    const rows = [[0, 0.035, 4], [0.019, 0.012, 5], [0.014, -0.012, 4], [0, -0.034, 1]];
    for (const [r, y, n] of rows) for (let i = 0; i < n; i++) g.add(ball(0.016, M.grape, Math.cos((i / n) * 6.283 + y * 40) * (r + (n === 4 && r === 0 ? 0.013 : 0)), y, Math.sin((i / n) * 6.283 + y * 40) * (r + (n === 4 && r === 0 ? 0.013 : 0)), 8));
    return g;
  },

  drogas(M) {
    const g = new THREE.Group();
    const caps = [[M.pillRed, M.pillWhite, 0, 0, 0.3], [M.pillBlue, M.pillWhite, 0.022, 0.004, -0.6], [M.pillRed, M.pillWhite, -0.02, 0.006, 1.4]];
    for (const [a, b, x, y, rot] of caps) {
      const c = group(mesh(new THREE.CapsuleGeometry(0.008, 0.012, 3, 8).rotateX(Math.PI / 2), a, 0, 0, -0.008), mesh(new THREE.CapsuleGeometry(0.008, 0.012, 3, 8).rotateX(Math.PI / 2), b, 0, 0, 0.008));
      c.position.set(x, y, 0.02);
      c.rotation.y = rot;
      g.add(c);
    }
    return g;
  },

  // ---- relíquias (só visualização/inspeção; nenhuma tem uso de combate)
  reliquia_capa(M) {
    const cape = mesh(new THREE.CylinderGeometry(0.1, 0.24, 0.5, 12, 6, true, -Math.PI * 0.55, Math.PI * 1.1), M.cloth, 0, -0.24, 0);
    const p = cape.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + Math.sin(p.getY(i) * 18 + p.getZ(i) * 30) * 0.012); // dobras do tecido
    cape.geometry.computeVertexNormals();
    const trim = mesh(new THREE.CylinderGeometry(0.242, 0.244, 0.03, 12, 1, true, -Math.PI * 0.55, Math.PI * 1.1), M.clothTrim, 0, -0.475, 0);
    return group(cape, trim, ball(0.02, M.ouro, 0.06, 0.0, 0.085, 8), ball(0.02, M.ouro, -0.06, 0.0, 0.085, 8), rod(0.005, 0.005, 0.12, M.ouroDark, 0, 0, 0.085, 5).rotateY(Math.PI / 2));
  },

  reliquia_coroa(M) {
    const g = group(mesh(new THREE.CylinderGeometry(0.085, 0.08, 0.045, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xdba628, roughness: 0.34, metalness: 0.92, side: THREE.DoubleSide })));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.add(mesh(new THREE.ConeGeometry(0.018, i % 2 ? 0.04 : 0.065, 4), M.ouro, Math.cos(a) * 0.083, 0.022 + (i % 2 ? 0.02 : 0.032), Math.sin(a) * 0.083));
      g.add(ball(0.009, i % 2 ? M.gemBlue : M.gemRed, Math.cos(a) * 0.087, 0, Math.sin(a) * 0.087, 6));
    }
    return g;
  },

  reliquia_costela(M) {
    const c = new THREE.CubicBezierCurve3(new THREE.Vector3(0, 0, -0.02), new THREE.Vector3(0.02, 0.1, 0.06), new THREE.Vector3(0.02, 0.16, 0.2), new THREE.Vector3(0, 0.1, 0.3));
    const rib = mesh(new THREE.TubeGeometry(c, 16, 0.012, 6), M.bone);
    rib.scale.set(0.7, 1, 1);
    return group(rib, ball(0.016, M.boneDark, 0, 0, -0.02, 6), ball(0.009, M.boneDark, 0, 0.1, 0.3, 6));
  },

  reliquia_cranio(M) {
    const g = group(mesh(new THREE.SphereGeometry(0.075, 14, 10).scale(0.88, 0.95, 1.05), M.bone, 0, 0.02, 0), box(0.085, 0.045, 0.06, M.bone, 0, -0.05, 0.045), box(0.07, 0.022, 0.05, M.boneDark, 0, -0.085, 0.04));
    for (const s of [-1, 1]) g.add(ball(0.02, M.black, s * 0.03, 0.005, 0.066, 8));
    const nose = mesh(new THREE.ConeGeometry(0.011, 0.024, 3), M.black, 0, -0.03, 0.078);
    g.add(nose);
    for (let i = -2; i <= 2; i++) g.add(box(0.011, 0.014, 0.006, M.bone, i * 0.014, -0.068, 0.075));
    return g;
  },

  reliquia_dente(M) {
    const crown = mesh(new THREE.ConeGeometry(0.022, 0.09, 8).rotateX(Math.PI / 2), M.bone, 0, 0, 0.07);
    crown.scale.set(1, 0.8, 1);
    const root = mesh(new THREE.ConeGeometry(0.022, 0.06, 8).rotateX(-Math.PI / 2), M.boneDark, 0, 0, -0.005);
    root.scale.set(1, 0.8, 1);
    return group(crown, root, rod(0.0225, 0.0225, 0.006, M.ouroDark, 0, 0, 0.025, 8));
  },

  reliquia_escudo(M) {
    const g = group(mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.022, 20).rotateX(Math.PI / 2), M.wood), mesh(new THREE.TorusGeometry(0.26, 0.014, 6, 24), M.metalDark),
      mesh(new THREE.SphereGeometry(0.06, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), M.metal, 0, 0, 0.011));
    for (let i = 0; i < 4; i++) { const band = box(0.5, 0.03, 0.006, M.metalDark, 0, 0, 0.013); band.rotation.z = (i / 4) * Math.PI; g.add(band); }
    // marcas de uso: cortes escuros na madeira
    for (const [x, y, r, l] of [[0.1, 0.12, 0.6, 0.11], [-0.13, 0.05, -0.4, 0.08], [0.04, -0.15, 1.1, 0.1]]) { const cut = box(l, 0.008, 0.004, M.black, x, y, 0.0125); cut.rotation.z = r; g.add(cut); }
    g.add(box(0.03, 0.16, 0.02, M.leather, 0, 0, -0.03)); // alça atrás
    return g;
  },

  reliquia_espada(M) {
    // lâmina antiga de bronze oxidado, guarda trabalhada e pomo de osso
    const g = group(handle(M, -0.09, 0.07, 0.016, M.fiber, M.woodDark));
    g.add(mesh(bladeGeo([[0.03, 0], [0.036, 0.12], [0.02, 0.46], [0, 0.56]], 0.008), M.bronze, 0, 0, 0.085));
    for (const [z, x] of [[0.2, 0.031], [0.33, -0.027], [0.42, 0.022]]) g.add(box(0.012, 0.012, 0.02, M.black, x, 0, z)); // dentes gastos no fio
    const guard = mesh(new THREE.TorusGeometry(0.07, 0.011, 6, 14, Math.PI), M.ouroDark, 0, 0, 0.06);
    guard.rotation.x = Math.PI / 2;
    g.add(guard, ball(0.012, M.gemRed, 0, 0.012, 0.09, 6), ball(0.024, M.bone, 0, 0, -0.105, 8));
    return g;
  },
};

function cartridges(M, r, caseLen, tipLen) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const c = group(rod(r, r, caseLen, M.brass, 0, 0, 0, 8), mesh(new THREE.ConeGeometry(r, tipLen, 8).rotateX(Math.PI / 2), M.copper, 0, 0, caseLen / 2 + tipLen / 2), rod(r * 1.15, r * 1.15, 0.0015, M.brass, 0, 0, -caseLen / 2, 8));
    c.position.set((i - 1) * r * 2.6, 0, i === 1 ? 0.004 : 0);
    g.add(c);
  }
  return g;
}

function ingot(mat, dark) {
  const body = mesh(new THREE.CylinderGeometry(0.036, 0.05, 0.036, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 2.1), mat);
  return group(body, box(0.03, 0.002, 0.07, dark, 0, 0.0185, 0));
}
