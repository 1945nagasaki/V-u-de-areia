import * as THREE from 'three';

/**
 * Ferramentas e cargas que os moradores seguram ao trabalhar (martelo,
 * picareta, enxada, serra, vassoura, balde, saco, tora…). Malhas simples,
 * feitas uma vez por tipo e clonadas (geometria e material compartilhados).
 *
 * Convenção igual à dos itens do jogador: a empunhadura fica na origem e a
 * ferramenta sobe por +Z (para cima do punho quando o antebraço está na
 * horizontal). Presa à mão direita do boneco (`Humanoid.hands[0]`, a mesma
 * dos gestos de trabalho), acompanha o braço — nunca flutua.
 *
 * @example
 * const tools = new WorkTools();
 * const hammer = tools.create('hammer');     // THREE.Group
 * humanoid.hands[0].add(hammer);
 */
export class WorkTools {
  constructor() {
    this.protos = new Map();
    const m = (color, roughness = 0.85, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    this.M = {
      wood: m(0x6e4726), woodLight: m(0xa9824f), iron: m(0x8a8f96, 0.4, 0.8), dark: m(0x2a2a2e, 0.6, 0.5), straw: m(0xc9a54a, 0.95),
      cloth: m(0xd8d0bc, 0.95), sack: m(0xb9a077, 0.95), stone: m(0x7a7873, 0.95), ore: m(0x9a6a3a, 0.6, 0.5), log: m(0x5a3e26, 0.9),
      fish: m(0xa8b4bc, 0.5, 0.3), paper: m(0xe8dcc0, 0.9), red: m(0x8a2a22, 0.8), clay: m(0x9a5a3a, 0.9), flame: new THREE.MeshBasicMaterial({ color: 0xffb040 }),
      feather: m(0xe9e4d8, 0.9), water: m(0x4aa8e8, 0.2),
    };
  }

  has(id) {
    return !!BUILD[id];
  }

  /** Cópia pronta para prender na mão (com a posição/rotação de empunhadura já aplicadas). */
  create(id) {
    let p = this.protos.get(id);
    if (!p) {
      p = (BUILD[id] ?? BUILD.sack)(this.M);
      p.name = `tool:${id}`;
      p.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.protos.set(id, p);
    }
    const g = p.clone(true);
    g.userData.toolId = id;
    return g;
  }
}

/** Tipos de ferramenta/carga existentes (para o teste da configuração). */
export const TOOL_KINDS = () => Object.keys(BUILD);

const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); return o; };
const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
/** cabo ao longo de +Z, de z0 a z1 */
const shaft = (r, z0, z1, mat) => mesh(new THREE.CylinderGeometry(r, r, z1 - z0, 6).rotateX(Math.PI / 2), mat, 0, 0, (z0 + z1) / 2);
/** grupo já na empunhadura: palma em (0, −0.075, 0.03) */
const held = (...kids) => { const g = new THREE.Group(); for (const k of kids) g.add(k); g.position.set(0, -0.075, 0.03); return g; };
/** carga levada na frente do corpo com os dois braços */
const carried = (...kids) => { const g = new THREE.Group(); for (const k of kids) g.add(k); g.position.set(0.16, -0.12, 0.12); return g; };

const BUILD = {
  hammer: (M) => held(shaft(0.014, -0.08, 0.3, M.wood), box(0.06, 0.13, 0.06, M.iron, 0, 0, 0.3)),
  tongs: (M) => held(shaft(0.008, -0.06, 0.42, M.dark), mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.48, 5).rotateX(Math.PI / 2).rotateY(0.06), M.dark, 0.012, 0, 0.18), box(0.05, 0.04, 0.09, M.ore, 0, 0, 0.46)),
  pickaxe(M) {
    const head = mesh(new THREE.TorusGeometry(0.2, 0.016, 5, 10, Math.PI * 0.8), M.iron, 0, 0.12, 0.5);
    head.rotation.set(0, Math.PI / 2, Math.PI * 0.6);
    return held(shaft(0.016, -0.1, 0.55, M.wood), head, box(0.04, 0.05, 0.06, M.iron, 0, 0, 0.52));
  },
  hoe: (M) => held(shaft(0.015, -0.2, 0.95, M.wood), box(0.16, 0.2, 0.02, M.iron, 0, -0.1, 0.94)),
  axe: (M) => held(shaft(0.016, -0.1, 0.5, M.wood), box(0.02, 0.16, 0.12, M.iron, 0, -0.07, 0.43)),
  saw: (M) => held(box(0.03, 0.09, 0.1, M.wood, 0, 0, 0), box(0.004, 0.09, 0.5, M.iron, 0, -0.01, 0.3)),
  broom: (M) => held(shaft(0.013, -0.3, 0.9, M.wood), box(0.2, 0.05, 0.22, M.straw, 0, 0, 1.0)),
  pitchfork: (M) => held(shaft(0.014, -0.3, 0.9, M.wood), box(0.16, 0.012, 0.012, M.iron, 0, 0, 0.9), ...[-0.07, 0, 0.07].map((x) => box(0.012, 0.012, 0.22, M.iron, x, 0, 1.01))),
  peel: (M) => held(shaft(0.013, -0.2, 0.95, M.wood), box(0.24, 0.015, 0.3, M.woodLight, 0, 0, 1.08), mesh(new THREE.SphereGeometry(0.09, 8, 6).scale(1, 0.5, 1.2), M.sack, 0, 0.04, 1.08)),
  ladle: (M) => held(shaft(0.009, -0.05, 0.42, M.wood), mesh(new THREE.SphereGeometry(0.04, 8, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.iron, 0, -0.02, 0.44)),
  bucket: (M) => held(mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.22, 10), M.wood, 0, -0.2, 0.02), mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.01, 10), M.water, 0, -0.1, 0.02), mesh(new THREE.TorusGeometry(0.12, 0.006, 4, 10, Math.PI), M.iron, 0, -0.08, 0.02)),
  rag: (M) => held(box(0.16, 0.02, 0.14, M.cloth, 0, -0.03, 0.06)),
  brush: (M) => held(box(0.06, 0.03, 0.16, M.wood, 0, -0.02, 0.05), box(0.055, 0.03, 0.15, M.straw, 0, -0.05, 0.05)),
  taper: (M) => held(shaft(0.006, -0.03, 0.3, M.woodLight), mesh(new THREE.ConeGeometry(0.014, 0.05, 5).rotateX(Math.PI / 2), M.flame, 0, 0, 0.33)),
  book: (M) => held(box(0.2, 0.035, 0.27, M.red, 0, -0.01, 0.1), box(0.18, 0.02, 0.25, M.paper, 0, 0.012, 0.1)),
  quill: (M) => held(shaft(0.004, -0.02, 0.1, M.dark), box(0.03, 0.004, 0.16, M.feather, 0, 0, 0.17)),
  rod: (M) => held(mesh(new THREE.CylinderGeometry(0.006, 0.014, 2.4, 5).rotateX(Math.PI / 2), M.woodLight, 0, 0, 1.1), mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 1.6, 3), M.paper, 0, -0.8, 2.3)),
  // ---- cargas
  ore: (M) => carried(box(0.34, 0.2, 0.3, M.wood, 0, 0, 0.12), ...[0, 1, 2].map((i) => mesh(new THREE.IcosahedronGeometry(0.07, 0), i % 2 ? M.ore : M.stone, -0.09 + i * 0.09, 0.13, 0.12))),
  sack: (M) => carried(mesh(new THREE.SphereGeometry(0.2, 8, 6).scale(1, 0.75, 1.3), M.sack, 0, 0, 0.14)),
  log: (M) => carried(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 7).rotateZ(Math.PI / 2), M.log, 0, 0, 0.14)),
  plank: (M) => carried(box(1.2, 0.04, 0.18, M.woodLight, 0, 0, 0.14), box(1.2, 0.04, 0.18, M.woodLight, 0, 0.045, 0.15)),
  hay: (M) => carried(mesh(new THREE.SphereGeometry(0.24, 7, 5).scale(1.2, 0.8, 1), M.straw, 0, 0, 0.16)),
  fish: (M) => carried(...[0, 1, 2].map((i) => mesh(new THREE.SphereGeometry(0.05, 6, 4).scale(0.6, 1, 3), M.fish, -0.07 + i * 0.07, 0, 0.14))),
  basket: (M) => carried(mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.2, 9), M.straw, 0, 0, 0.14), mesh(new THREE.SphereGeometry(0.17, 7, 5).scale(1, 0.5, 1), M.cloth, 0, 0.1, 0.14)),
  clay: (M) => carried(mesh(new THREE.SphereGeometry(0.15, 7, 5).scale(1, 0.75, 1), M.clay, 0, 0, 0.14)),
};
