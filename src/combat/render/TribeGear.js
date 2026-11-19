import * as THREE from 'three';

/**
 * Peças visuais das tribos para o Humanoid: máscaras (presas na cabeça),
 * armas (na mão direita, com pontos `tip`/`mid` para o rastro do corte),
 * escudo (mão esquerda) e o emblema do Véu-Carmesim (no peito).
 * Tudo procedural e leve; geometrias e materiais em cache.
 *
 * @example
 *   humanoid.head.add(makeMask('lion'));
 *   const w = makeWeapon('spear'); humanoid.hands[0].add(w.root);
 */

const geos = new Map(), mats = new Map();
const geo = (k, f) => geos.get(k) ?? (geos.set(k, f()), geos.get(k));
const mat = (hex, rough = 0.85, metal = 0) => {
  const k = `${hex}:${rough}:${metal}`;
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal }));
  return mats.get(k);
};
function part(g, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  return o;
}

/** Placa do rosto (casca na frente da cabeça). */
const plate = () => geo('plate', () => new THREE.SphereGeometry(0.118, 16, 12, -Math.PI / 2, Math.PI, 0, Math.PI).scale(0.98, 1.12, 0.9));

/**
 * Máscara de uma tribo, já posicionada para `humanoid.head`.
 * @param {'lion'|'rhino'|'hippo'|'croc'} kind
 */
export function makeMask(kind) {
  const g = new THREE.Group();
  g.name = `mascara-${kind}`;
  if (kind === 'lion') {
    // Leão (Coroa-Alta): rosto ouro velho, crina de pele em volta, focinho.
    g.add(part(plate(), mat(0x9a7a3a, 0.55, 0.4), 0, 0.14, 0.015));
    const mane = part(geo('mane', () => new THREE.TorusGeometry(0.15, 0.07, 8, 18)), mat(0x5a3a20, 1), 0, 0.14, -0.015);
    g.add(mane);
    g.add(part(geo('lionSnout', () => new THREE.BoxGeometry(0.08, 0.06, 0.06)), mat(0x7a5a2a, 0.6, 0.3), 0, 0.1, 0.115));
    for (const s of [-1, 1]) g.add(part(geo('lionEar', () => new THREE.ConeGeometry(0.03, 0.06, 6)), mat(0x5a3a20, 1), s * 0.09, 0.27, 0.0));
    g.add(part(geo('fang', () => new THREE.ConeGeometry(0.008, 0.035, 5).rotateX(Math.PI)), mat(0xe8dcc0, 0.5), 0.02, 0.07, 0.13));
    g.add(part(geo('fang'), mat(0xe8dcc0, 0.5), -0.02, 0.07, 0.13));
  } else if (kind === 'rhino') {
    // Rinoceronte (Mão-Cerrada): couro cinza gasto, chifre frontal grande.
    g.add(part(plate(), mat(0x77746c, 0.95), 0, 0.14, 0.015));
    g.add(part(geo('rhinoNose', () => new THREE.BoxGeometry(0.09, 0.07, 0.08)), mat(0x5a5852, 0.95), 0, 0.1, 0.11));
    const horn = part(geo('rhinoHorn', () => new THREE.ConeGeometry(0.032, 0.17, 8).translate(0, 0.085, 0)), mat(0xd8cfb8, 0.6), 0, 0.13, 0.14);
    horn.rotation.x = 0.95;
    g.add(horn);
    const small = part(geo('rhinoHorn2', () => new THREE.ConeGeometry(0.02, 0.07, 6).translate(0, 0.035, 0)), mat(0xd8cfb8, 0.6), 0, 0.2, 0.12);
    small.rotation.x = 0.6;
    g.add(small);
  } else if (kind === 'hippo') {
    // Hipopótamo (Brasa-Viva): pesada, carvão, focinho largo, presas.
    g.add(part(plate(), mat(0x2a2420, 0.9), 0, 0.15, 0.015));
    g.add(part(geo('hippoSnout', () => new THREE.BoxGeometry(0.2, 0.1, 0.12)), mat(0x3a302a, 0.9), 0, 0.08, 0.12));
    for (const s of [-1, 1]) {
      g.add(part(geo('tusk', () => new THREE.ConeGeometry(0.014, 0.06, 6)), mat(0xe8dcc0, 0.5), s * 0.07, 0.05, 0.17));
      g.add(part(geo('hippoEar', () => new THREE.SphereGeometry(0.025, 8, 6)), mat(0x2a2420, 0.9), s * 0.095, 0.26, -0.01));
      g.add(part(geo('ember', () => new THREE.SphereGeometry(0.012, 6, 4)), new THREE.MeshBasicMaterial({ color: 0xff6a20 }), s * 0.04, 0.17, 0.115)); // olhos de brasa
    }
  } else if (kind === 'croc') {
    // Crânio de crocodilo de verdade como capacete (Pouso-Lento): osso, focinho longo, dentes.
    const bone = mat(0xd9cfb5, 0.75);
    g.add(part(geo('crocDome', () => new THREE.SphereGeometry(0.125, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1, 0.9, 1.15)), bone, 0, 0.17, 0));
    g.add(part(geo('crocSnout', () => new THREE.BoxGeometry(0.1, 0.05, 0.3).translate(0, 0, 0.15)), bone, 0, 0.21, 0.06));
    g.add(part(geo('crocTeeth', () => new THREE.BoxGeometry(0.104, 0.018, 0.26).translate(0, 0, 0.15)), mat(0xf0e8d0, 0.5), 0, 0.18, 0.07));
    for (const s of [-1, 1]) g.add(part(geo('socket', () => new THREE.SphereGeometry(0.02, 8, 6)), mat(0x1a1410, 1), s * 0.05, 0.25, 0.06));
  }
  return g;
}

/** Emblema da seita (Véu-Carmesim): círculo vermelho com uma fenda, no peito. Para `humanoid.torso`. */
export function makeEmblem(color) {
  const g = new THREE.Group();
  g.add(part(geo('emblem', () => new THREE.CircleGeometry(0.06, 20)), new THREE.MeshStandardMaterial({ color, roughness: 0.7, side: THREE.DoubleSide }), 0, 0.42, 0.098));
  g.add(part(geo('slit', () => new THREE.PlaneGeometry(0.012, 0.085)), new THREE.MeshStandardMaterial({ color: 0x120808, side: THREE.DoubleSide }), 0, 0.42, 0.1));
  return g;
}

/** Escudo grande na mão esquerda (Mesa-Farta). Para `humanoid.hands[1]`. */
export function makeShield(color) {
  const s = part(geo('shield', () => new THREE.CylinderGeometry(0.32, 0.32, 0.04, 20).rotateZ(Math.PI / 2)), mat(color, 0.95), 0.05, -0.08, 0.02);
  s.add(part(geo('boss', () => new THREE.SphereGeometry(0.06, 10, 8)), mat(0x5a4a3a, 0.6, 0.3), 0.03, 0, 0));
  return s;
}

/**
 * Arma na mão direita. A lâmina/haste segue o +Z da mão.
 * @param {'machete'|'spear'|'club'|'bronze'|'bone'} kind
 * @returns {{ root: THREE.Group, tip: THREE.Object3D, mid: THREE.Object3D, mat: THREE.MeshStandardMaterial }}
 */
export function makeWeapon(kind = 'machete') {
  const root = new THREE.Group();
  root.name = `arma-${kind}`;
  const steel = (hex, rough, metal) => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal, emissive: 0x000000 });
  let m, len;
  const handle = (l = 0.13) => part(new THREE.CylinderGeometry(0.018, 0.02, l, 8).rotateX(Math.PI / 2), mat(0x3a2414, 0.9));
  if (kind === 'spear') {
    // Lança com ponta de chifre (Mão-Cerrada): haste longa, segurada no meio.
    m = steel(0xd8cfb8, 0.6, 0);
    root.add(part(new THREE.CylinderGeometry(0.016, 0.018, 1.7, 8).rotateX(Math.PI / 2).translate(0, 0, 0.3), mat(0x5a3e26, 0.9)));
    root.add(part(new THREE.ConeGeometry(0.035, 0.24, 8).rotateX(Math.PI / 2).translate(0, 0, 1.27), m));
    len = 1.38;
  } else if (kind === 'club') {
    // Porrete pesado (Mesa-Farta).
    m = steel(0x5a3e26, 0.9, 0);
    root.add(handle(0.2));
    root.add(part(new THREE.CylinderGeometry(0.075, 0.035, 0.62, 10).rotateX(Math.PI / 2).translate(0, 0, 0.38), m));
    for (let i = 0; i < 5; i++) root.add(part(geo('knob', () => new THREE.SphereGeometry(0.025, 6, 4)), mat(0xd8cfb8, 0.6), Math.sin(i * 2.4) * 0.07, Math.cos(i * 2.4) * 0.07, 0.55 + (i % 2) * 0.08));
    len = 0.68;
  } else if (kind === 'bronze') {
    // Lâmina de bronze larga e ornamentada (Brasa-Viva).
    m = steel(0xa0703a, 0.38, 0.85);
    root.add(handle());
    root.add(part(new THREE.BoxGeometry(0.014, 0.085, 0.66).translate(0, 0.01, 0.4), m));
    root.add(part(new THREE.BoxGeometry(0.12, 0.03, 0.03).translate(0, 0, 0.07), m));
    len = 0.76;
  } else if (kind === 'bone') {
    // Faca-gancho de osso (Pouso-Lento).
    m = steel(0xd9cfb5, 0.7, 0);
    root.add(handle());
    root.add(part(new THREE.BoxGeometry(0.014, 0.04, 0.42).translate(0, 0.0, 0.28), m));
    const hook = part(new THREE.BoxGeometry(0.014, 0.1, 0.035), m, 0, 0.04, 0.48);
    hook.rotation.x = 0.6;
    root.add(hook);
    len = 0.5;
  } else {
    // Facão (padrão).
    m = steel(0xb8bcc2, 0.32, 0.85);
    root.add(handle());
    root.add(part(new THREE.BoxGeometry(0.012, 0.055, 0.62).translate(0, 0.01, 0.38), m));
    root.add(part(new THREE.ConeGeometry(0.03, 0.09, 4).rotateX(Math.PI / 2).scale(0.4, 1, 1).translate(0, 0.012, 0.73), m));
    len = 0.74;
  }
  root.position.set(0, -0.075, 0.02);
  root.traverse((o) => { if (o.isMesh) o.userData.noFlash = true; });
  const tip = new THREE.Object3D(); tip.position.set(0, 0, len);
  const mid = new THREE.Object3D(); mid.position.set(0, 0, len * 0.3);
  root.add(tip, mid);
  return { root, tip, mid, mat: m };
}
