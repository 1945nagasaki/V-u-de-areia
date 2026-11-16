import * as THREE from 'three';
import * as B from './Builders.js';
import { G, local } from './Builders.js';
import { BUILDINGS, PLACEMENT, STYLE, FARMING } from '../config/workplaces.js';
import { OUTFIT_REGION } from '../config/npcLife.js';
import { WORLD } from '../config/worldConfig.js';
import { mulberry32 } from '../world/Noise.js';

/**
 * Locais de trabalho das vilas: constrói os prédios de `config/workplaces.js`
 * (ferraria, mina, fazenda, capela, carpintaria, padaria, taverna, estábulo,
 * mercado, lenhador, cais, tecelagem, olaria, moinho, enfermaria, escriba,
 * posto da guarda) com móveis e ferramentas, e devolve as ESTAÇÕES de trabalho
 * em coordenadas do mundo — é nelas (e só nelas) que os moradores trabalham.
 *
 * Tudo entra no `StaticBatcher` da vila (uma malha por material) e ganha
 * colisor automático (WorldColliders); cada móvel assenta na altura do chão
 * do seu próprio ponto, então nada flutua em terreno levemente inclinado.
 *
 * @example
 * // dentro de Village.finalize(), antes de fechar a geometria:
 * placeWorkplaces(village);            // preenche village.workplaces
 * village.workplaces[0].stations[0];   // { kind: 'anvil', x, y, z, yaw, gesture: 'hammer', tool: 'hammer', … }
 */

const UP = new THREE.Vector3(0, 1, 0);
/** Geometrias de assento: `collider: 'none'` = o WorldColliders não as transforma em parede (senta-se nelas). */
const SEAT = {
  box: (() => { const g = new THREE.BoxGeometry(1, 1, 1); g.userData.collider = 'none'; return g; })(),
  cyl: (() => { const g = new THREE.CylinderGeometry(1, 1, 1, 10); g.userData.collider = 'none'; return g; })(),
  cyl6: (() => { const g = new THREE.CylinderGeometry(1, 1, 1, 6); g.userData.collider = 'none'; return g; })(),
};
const rad = (d) => (d * Math.PI) / 180;

/**
 * Escolhe lugar e constrói os locais de trabalho de uma vila.
 * Regras: longe de casas/ruas/outros prédios (`village.isFree`), terreno seco
 * e pouco inclinado, mercado e capela perto da praça, fazenda/estábulo/moinho
 * na borda, mina no trecho mais acidentado da borda, cais na margem.
 * @param {import('./Village.js').Village} v
 * @returns {object[]} os locais construídos (também em `v.workplaces`)
 */
export function placeWorkplaces(v) {
  v.workplaces = [];
  if (v.config.abandoned || PLACEMENT.skipVillages.includes(v.config.id)) return v.workplaces;
  const rng = mulberry32((v.x * 7331 + v.z * 911 + 77) | 0);
  const T = v.game.terrain, biome = v.config.biome ?? 'central';
  const style = STYLE[OUTFIT_REGION[biome] ?? 'common'];
  const skip = PLACEMENT.biomeSkip[biome] ?? [];
  const seq = {};
  for (const type of PLACEMENT.order) {
    const spec = BUILDINGS[type];
    if (!spec || skip.includes(type)) continue;
    const spot = findSpot(v, spec, rng, T);
    if (!spot) continue;
    seq[type] = (seq[type] ?? 0) + 1;
    const wp = buildWorkplace(v, type, spec, spot, style, rng, `${v.config.id}:${type}_${String(seq[type]).padStart(2, '0')}`);
    v.workplaces.push(wp);
    v.reserve(spot.x, spot.z, spec.clear);
    // terra batida em volta e trilha da entrada até a rua mais próxima
    v.paintDisc(spot.x, spot.z, Math.max(spec.w, spec.d) / 2 + 1.5, 0x6e5840, 0.7);
    const st = nearestStreet(v, wp.entrance.x, wp.entrance.z);
    if (st && st.d < 60) v.shapes.push({ type: 'segment', ax: wp.entrance.x, az: wp.entrance.z, bx: st.x, bz: st.z, width: 2.2, color: 0x6e5840, strength: 0.75 });
  }
  return v.workplaces;
}

function nearestStreet(v, x, z) {
  let best = null;
  for (const s of v.streets) {
    const ux = s.bx - s.ax, uz = s.bz - s.az, L2 = ux * ux + uz * uz || 1;
    const t = Math.max(0, Math.min(1, ((x - s.ax) * ux + (z - s.az) * uz) / L2));
    const px = s.ax + ux * t, pz = s.az + uz * t, d = Math.hypot(px - x, pz - z);
    if (!best || d < best.d) best = { x: px, z: pz, d };
  }
  return best;
}

/** Desnível e ponto mais baixo sob a planta do prédio. */
function footprint(T, x, z, rot, hw, hd) {
  let min = Infinity, max = -Infinity;
  for (const [a, b] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const p = local(x, z, rot, a * hw, b * hd), h = T.heightAt(p.x, p.z);
    min = Math.min(min, h); max = Math.max(max, h);
  }
  return { min, max, slope: max - min };
}

function findSpot(v, spec, rng, T) {
  const R = v.radius, [f0, f1] = PLACEMENT.rings[spec.place];
  const maxSlope = PLACEMENT.maxSlope[spec.place === 'rocky' ? 'rocky' : spec.flat ? 'flat' : 'default'];
  const dry = WORLD.waterLevel + PLACEMENT.minDry;
  let best = null;
  for (let k = 0; k < PLACEMENT.tries; k++) {
    const a = rng() * Math.PI * 2, r = R * (f0 + rng() * (f1 - f0));
    let x = v.x + Math.cos(a) * r, z = v.z + Math.sin(a) * r;
    let rot = Math.atan2(v.x - x, v.z - z); // frente (+Z local) virada para o centro da vila
    if (spec.place === 'water') {
      // anda para fora até achar água; o cais fica na margem, de frente para ela
      let shore = null;
      for (let d = 0; d < 140; d += 2) {
        const wx = x + Math.cos(a) * d, wz = z + Math.sin(a) * d;
        if (T.heightAt(wx, wz) < WORLD.waterLevel - 0.15) { shore = d; break; }
      }
      if (shore === null) continue;
      const back = shore - spec.d / 2 - 1.5;
      x += Math.cos(a) * back; z += Math.sin(a) * back;
      rot = Math.atan2(Math.cos(a), Math.sin(a)); // frente para a água
    }
    if (!v.isFree(x, z, spec.clear)) continue;
    const f = footprint(T, x, z, rot, spec.w / 2, spec.d / 2);
    if (f.min < dry || f.slope > maxSlope) continue;
    if (spec.place !== 'rocky') return { x, z, rot, min: f.min };
    // mina: entre os lugares válidos, o mais acidentado (mais "rochoso")
    const score = f.slope + (T.heightAt(x, z) - v.y) * 0.05;
    if (!best || score > best.score) best = { x, z, rot, score, min: f.min };
    if (k > 24 && best) break;
  }
  return best;
}

// ---------------------------------------------------------------- construção

/**
 * Constrói um local de trabalho e devolve a ficha com as estações no mundo.
 * @returns {{ id: string, type: string, name: string, profession: string, workers: number, x: number, z: number, rot: number,
 *   y: number, w: number, d: number, entrance: { x: number, z: number }, wait: { x: number, z: number },
 *   stations: object[], plots: object[], smoke: object[], sails: THREE.Object3D|null }}
 */
export function buildWorkplace(v, type, spec, { x, z, rot, min }, style, rng, id) {
  const ctx = v.ctx, M = ctx.M, T = ctx.terrain;
  const y0 = T.heightAt(x, z);
  // paredes e esteios descem até o canto mais baixo do terreno (+ fundação enterrada): nada fica no ar
  const sink = Math.max(0, y0 - (min ?? y0)) + 0.4;
  const vary = 0.94 + rng() * 0.12; // prédios do mesmo tipo não saem idênticos
  const wallMat = M[spec.wall === 'stone' ? style.stone : style.wall[Math.floor(rng() * style.wall.length)]] ?? M.adobeOchre;
  const postMat = M[style.post] ?? M.woodDark;
  const roofMat = spec.roof ? B.doubleSided(M[style.roof[spec.roof]] ?? M.thatch) : null;
  const wp = {
    id, type, name: spec.name, profession: spec.profession, workers: spec.workers, x, z, rot, y: y0, w: spec.w, d: spec.d, shell: spec.shell, base: y0 - sink,
    entrance: local(x, z, rot, 0, spec.d / 2 + 1.4), wait: local(x, z, rot, (rng() - 0.5) * 2, spec.d / 2 + 2.6),
    stations: [], plots: [], smoke: [], sails: null, fires: [],
  };
  const P = (geo, mat, o) => B.part(ctx, geo, mat, x, z, rot, y0, o);
  const w = spec.w, d = spec.d, hWall = 2.7 * vary * (spec.tall ?? 1), t = 0.26;

  // Pegada: a vegetação e o capim não nascem dentro do prédio (o jogo desliga depois, como as das casas).
  const foot = ctx.collisions.addBox(x, z, w / 2 + 0.6, d / 2 + 0.6, rot, 'workshop');
  foot.footprint = true;
  // ---- casca
  if (spec.shell === 'open') {
    // galpão: fundo e laterais fechados, frente aberta sobre dois esteios
    P(G.box, wallMat, { lz: -d / 2 + t / 2, ly: (hWall - sink) / 2, w, h: hWall + sink, d: t });
    for (const s of [-1, 1]) P(G.box, wallMat, { lx: s * (w / 2 - t / 2), lz: -d * 0.12, ly: (hWall - sink) / 2, w: t, h: hWall + sink, d: d * 0.76 - t });
    for (const s of [-1, 1]) P(G.cyl6, postMat, { lx: s * (w / 2 - 0.16), lz: d / 2 - 0.16, ly: (hWall - sink) / 2, w: 0.13, h: hWall + sink, d: 0.13 });
    P(G.box, postMat, { lz: d / 2 - 0.16, ly: hWall - 0.08, w: w, h: 0.16, d: 0.16 });
  } else if (spec.shell === 'closed') {
    const gap = 1.6, doorH = 2.15;
    B.shellRing(P, wallMat, { w, d, tt: t, hh: hWall + sink, ly: (hWall - sink) / 2, gap, top: doorH });
    for (const s of [-1, 1]) P(G.box, postMat, { lx: s * (gap / 2 + 0.07), lz: d / 2 - t / 2, ly: doorH / 2, w: 0.14, h: doorH, d: t + 0.06 });
    P(G.box, postMat, { lz: d / 2 - t / 2, ly: doorH + 0.07, w: gap + 0.28, h: 0.14, d: t + 0.06 });
    // janelas (vãos escuros) nas laterais
    for (const s of [-1, 1]) for (const lz of [-d * 0.2, d * 0.18]) P(G.box, M.darkOpening, { lx: s * (w / 2 - t / 2), lz, ly: 1.55, w: t + 0.04, h: 0.7, d: 0.8 });
  }
  if (roofMat) {
    const over = 0.7, rh = (spec.roof === 'thatch' ? 2.1 : 1.6) * vary;
    P(G.roofSlopes, roofMat, { ly: hWall, w: w + over, h: rh, d: d + over });
    if (spec.shell !== 'yard') P(G.gables, wallMat, { ly: hWall, w: w - 0.02, h: rh * d / (d + over), d });
    wp.roofTop = y0 + hWall + rh;
  }
  if (spec.chimney) {
    const [cx, cz] = spec.chimney, top = hWall + 2.2;
    P(G.box, M[style.stone] ?? M.stone, { lx: cx, lz: cz - 0.55, ly: top / 2, w: 0.75, h: top, d: 0.6 });
    const c = local(x, z, rot, cx, cz - 0.55);
    if (spec.smoke) wp.smoke.push({ x: c.x, y: y0 + top + 0.1, z: c.z });
  }
  if (spec.bell) { // sineira sobre a entrada
    P(G.box, wallMat, { lz: d / 2 - 0.5, ly: hWall + 2.2, w: 1.5, h: 2.2, d: 1.0 });
    P(G.box, M.darkOpening, { lz: d / 2 - 0.5, ly: hWall + 2.5, w: 0.7, h: 0.9, d: 1.04 });
    P(G.cone8, M.brass, { lz: d / 2 - 0.5, ly: hWall + 2.45, w: 0.24, h: 0.42, d: 0.24 });
    P(G.pyramid, roofMat ?? M.tilesRed, { lz: d / 2 - 0.5, ly: hWall + 3.3 + 0.5, w: 1.8, h: 1.0, d: 1.3 });
    P(G.box, M.woodDark, { lz: d / 2 - 0.5, ly: hWall + 4.75, w: 0.07, h: 0.7, d: 0.07 });
    P(G.box, M.woodDark, { lz: d / 2 - 0.5, ly: hWall + 4.85, w: 0.4, h: 0.07, d: 0.07 });
  }
  if (spec.sails) wp.sails = buildSails(ctx, local(x, z, rot, 0, d / 2 + 0.35), y0 + hWall * 0.78, rot);

  // ---- móveis e ferramentas
  for (const [kind, lx, lz, rdeg = 0, opts = {}] of spec.props) {
    const fn = PROPS[kind];
    if (!fn) throw new Error(`Workplaces: móvel desconhecido "${kind}" em ${type}`);
    fn(kit(v, wp, x, z, rot, lx, lz, rad(rdeg), rng), opts);
  }

  // ---- estações (coordenadas do mundo, altura do chão real de cada ponto)
  spec.stations.forEach((s, i) => {
    const p = local(x, z, rot, s.at[0], s.at[1]), f = local(x, z, rot, s.face[0], s.face[1]);
    wp.stations.push({
      id: `${id}:${s.kind}_${String(i + 1).padStart(2, '0')}`, buildingId: id, profession: spec.profession, kind: s.kind, role: s.role ?? 'worker',
      x: p.x, y: T.heightAt(p.x, p.z), z: p.z, yaw: Math.atan2(f.x - p.x, f.z - p.z), target: { x: f.x, z: f.z },
      gesture: s.gesture, tool: s.tool ?? null, carry: s.carry ?? null, fx: s.fx ?? null, sit: !!s.sit, capacity: s.capacity ?? 1, plot: s.plot,
    });
  });
  return wp;
}

/** Pás do moinho: giram devagar (objeto dinâmico da vila). */
function buildSails(ctx, p, y, rot) {
  const g = new THREE.Group();
  const wood = ctx.M.woodDark, cloth = ctx.M.whitePaint ?? ctx.M.woodLight;
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    const beam = new THREE.Mesh(G.box, wood); beam.scale.set(0.09, 3.4, 0.09); beam.position.y = 1.7;
    const sail = new THREE.Mesh(G.box, cloth); sail.scale.set(0.75, 2.5, 0.03); sail.position.set(0.42, 2.0, 0);
    arm.add(beam, sail);
    g.add(arm);
  }
  const hub = new THREE.Mesh(G.cyl, wood); hub.scale.set(0.2, 0.5, 0.2); hub.rotation.x = Math.PI / 2;
  g.add(hub);
  g.position.set(p.x, y, p.z);
  g.rotation.y = rot;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  ctx.dynamic.add(g);
  return g;
}

/**
 * Atalhos de um móvel: peças em coordenadas LOCAIS DO MÓVEL (ox, oz giram com
 * ele), assentadas na altura do chão do ponto do móvel.
 */
function kit(v, wp, X, Z, rot, plx, plz, th, rng) {
  const ctx = v.ctx, c = Math.cos(th), s = Math.sin(th);
  const toWorld = (ox, oz) => local(X, Z, rot, plx + ox * c + oz * s, plz - ox * s + oz * c);
  const origin = toWorld(0, 0), gy = ctx.terrain.heightAt(origin.x, origin.z);
  const add = (geo) => (mat, ox, oy, oz, w, h, d, o = {}) => {
    const p = toWorld(ox, oz);
    ctx.batch.add(geo, mat, { x: p.x, y: gy + oy, z: p.z, rx: o.rx ?? 0, ry: rot + th + (o.ry ?? 0), rz: o.rz ?? 0, sx: w, sy: h, sz: d });
  };
  return {
    v, wp, ctx, M: ctx.M, rng, gy, origin, toWorld, yaw: rot + th,
    box: add(G.box), cyl: add(G.cyl), cyl6: add(G.cyl6), seatBox: add(SEAT.box), seatCyl: add(SEAT.cyl), seatCyl6: add(SEAT.cyl6), cone: add(G.cone8), ball: add(G.sphere), rock: add(G.rock), pyr: add(G.pyramid), disc: add(G.disc),
    /** fogo vivo: chama animada + luz real quando o jogador está perto */
    fire(ox, oy, oz, size = 0.35, intensity = 16) {
      const p = toWorld(ox, oz);
      const m = new THREE.Mesh(G.cone8, ctx.M.flame);
      m.scale.set(size * 0.6, size * 1.6, size * 0.6);
      m.position.set(p.x, gy + oy + size * 0.8, p.z);
      m.userData.base = m.scale.clone();
      ctx.dynamic.add(m);
      const fire = { x: p.x, y: gy + oy + size, z: p.z, color: 0xff8a3a, intensity, range: 12, flames: [m], warm: true };
      v.fires.push(fire);
      wp.fires.push(fire);
    },
    lamp(ox, oy, oz) {
      const p = toWorld(ox, oz);
      v.fires.push({ x: p.x, y: gy + oy, z: p.z, color: 0xffc77a, intensity: 9, range: 10 });
    },
  };
}

// ---------------------------------------------------------------- kit de móveis

const sackRow = (K, mat, n, x0 = 0) => { for (let i = 0; i < n; i++) K.ball(mat, x0 + (i - (n - 1) / 2) * 0.55, 0.3 + (i % 2) * 0.02, (i % 2) * 0.12, 0.3, 0.34, 0.26, { ry: i * 0.6 }); };
const logs = (K, mat, n, len, r = 0.16) => {
  let k = 0;
  for (let row = 0; k < n; row++) for (let i = 0; i < 4 - row && k < n; i++, k++) K.cyl(mat, 0, r + row * r * 1.75, (i - (3 - row) / 2) * r * 2.05, r, len, r, { rz: Math.PI / 2 });
};
const stall = (K, cloth, goodsMats) => {
  const M = K.M;
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.cyl6(M.wood, a * 1.45, 1.2, b * 0.95, 0.05, 2.4, 0.05);
  K.box(cloth, 0, 2.45, 0, 3.3, 0.05, 2.5, { rx: -0.1 });
  K.box(M.woodLight, 0, 0.84, 0.25, 2.8, 0.08, 1.1);
  K.box(M.woodDark, 0, 0.42, 0.25, 2.6, 0.8, 0.9);
  for (let i = 0; i < 6; i++) K.ball(goodsMats[i % goodsMats.length], -1.1 + i * 0.44, 0.97, 0.25 + (i % 2) * 0.2 - 0.1, 0.17, 0.12, 0.15);
};

const PROPS = {
  // ---- ferraria
  furnace(K) {
    const M = K.M;
    K.box(M.stoneDark, 0, 0.7, 0, 1.7, 1.4, 1.2);
    K.box(M.darkOpening, 0, 0.75, 0.56, 0.8, 0.6, 0.12);
    K.box(M.stone, 0, 1.5, 0, 1.9, 0.2, 1.4);
    K.cyl(M.leather, -1.15, 0.6, 0.1, 0.32, 0.9, 0.22, { rz: Math.PI / 2 }); // fole
    K.fire(0, 0.5, 0.45, 0.32, 22);
  },
  anvil(K) {
    const M = K.M;
    K.cyl(M.log, 0, 0.3, 0, 0.3, 0.6, 0.3);
    K.box(M.iron, 0, 0.7, 0, 0.26, 0.2, 0.2);
    K.box(M.iron, 0, 0.86, 0, 0.62, 0.13, 0.24);
    K.cone(M.iron, 0.42, 0.86, 0, 0.1, 0.24, 0.1, { rz: -Math.PI / 2 });
    K.wp.anvilTop = K.gy + 0.93;
  },
  bench(K) {
    const M = K.M;
    K.box(M.woodLight, 0, 0.86, 0, 2.0, 0.09, 0.8);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.box(M.woodDark, a * 0.9, 0.42, b * 0.32, 0.1, 0.84, 0.1);
    K.box(M.iron, -0.5, 0.95, 0, 0.35, 0.06, 0.08);
    K.box(M.wood, 0.4, 0.96, 0.1, 0.5, 0.1, 0.16);
  },
  waterBarrel(K) {
    K.cyl(K.M.wood, 0, 0.45, 0, 0.36, 0.9, 0.36);
    K.cyl(K.M.iron, 0, 0.7, 0, 0.375, 0.04, 0.375);
    K.cyl(K.M.water, 0, 0.88, 0, 0.32, 0.02, 0.32);
  },
  toolRack(K) {
    const M = K.M;
    K.box(M.woodDark, 0, 1.1, 0, 1.5, 1.5, 0.1);
    for (let i = 0; i < 4; i++) { K.box(M.wood, -0.52 + i * 0.35, 1.05, 0.09, 0.04, 0.9, 0.04); K.box(M.iron, -0.52 + i * 0.35, 1.52, 0.09, 0.14, 0.12, 0.05); }
  },
  pitchforkRack(K) { PROPS.toolRack(K); },
  weaponRack(K) { PROPS.toolRack(K); },
  shelf(K) {
    const M = K.M;
    K.box(M.woodDark, 0, 0.95, 0, 1.6, 1.9, 0.08);
    for (const y of [0.5, 1.05, 1.6]) K.box(M.wood, 0, y, 0.18, 1.6, 0.05, 0.4);
    for (let i = 0; i < 4; i++) K.box(M.iron, -0.55 + i * 0.36, 1.13, 0.18, 0.18, 0.1, 0.12);
  },
  orePile(K) { for (let i = 0; i < 6; i++) K.rock(i % 2 ? K.M.iron : K.M.stoneDark, (i % 3 - 1) * 0.28, 0.14 + (i > 2 ? 0.17 : 0), ((i >> 1) % 2 - 0.5) * 0.3, 0.2, 0.16, 0.19, { ry: i }); },
  coalPile(K) { for (let i = 0; i < 6; i++) K.rock(K.M.charred, (i % 3 - 1) * 0.25, 0.12 + (i > 2 ? 0.15 : 0), ((i >> 1) % 2 - 0.5) * 0.28, 0.18, 0.14, 0.17, { ry: i * 2 }); },
  lantern(K) { K.box(K.M.iron, 0, 2.2, 0.1, 0.16, 0.24, 0.16); K.box(K.M.flame, 0, 2.2, 0.1, 0.1, 0.14, 0.1); K.lamp(0, 2.2, 0.3); },
  // ---- mina
  mineEntrance(K) {
    const M = K.M;
    for (let i = 0; i < 9; i++) { // morro de pedra em volta da boca
      const a = (i / 9) * Math.PI - Math.PI, r = 2.6 + (i % 3) * 0.4;
      K.rock(i % 2 ? M.stoneDark : M.stone, Math.cos(a) * r * 0.9, 0.9 + (i % 2) * 0.5, -0.9 + Math.sin(a) * 1.3, 1.5, 1.5 + (i % 3) * 0.4, 1.4, { ry: i * 1.3 });
    }
    K.rock(M.stone, 0, 2.7, -1.6, 2.6, 1.0, 1.8);
    for (const s of [-1, 1]) K.cyl6(M.log, s * 0.95, 1.1, 0.25, 0.13, 2.2, 0.13);
    K.cyl6(M.log, 0, 2.25, 0.25, 0.13, 2.3, 0.13, { rz: Math.PI / 2 });
    for (const s of [-1, 1]) K.cyl6(M.log, s * 0.95, 1.05, -0.9, 0.12, 2.1, 0.12);
    K.box(M.darkOpening, 0, 1.05, -0.35, 1.7, 2.1, 0.5);
  },
  oreRock(K) {
    const M = K.M;
    K.rock(M.stoneDark, 0, 0.55, 0, 0.85, 0.75, 0.75);
    K.rock(M.stone, 0.35, 0.3, 0.3, 0.45, 0.4, 0.42, { ry: 1 });
    for (let i = 0; i < 4; i++) K.rock(M.iron, Math.cos(i * 1.7) * 0.45, 0.6 + Math.sin(i * 2.3) * 0.3, Math.sin(i * 1.7) * 0.4, 0.14, 0.12, 0.13, { ry: i });
  },
  rails(K) {
    for (const s of [-1, 1]) K.box(K.M.iron, s * 0.4, 0.07, -0.6, 0.06, 0.06, 5.4);
    for (let i = 0; i < 7; i++) K.box(K.M.woodDark, 0, 0.03, -3.0 + i * 0.8, 1.1, 0.05, 0.16);
  },
  mineCart(K) {
    const M = K.M;
    K.box(M.woodDark, 0, 0.55, 0, 0.95, 0.5, 1.3);
    K.box(M.iron, 0, 0.3, 0, 1.0, 0.06, 1.35);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.cyl(M.iron, a * 0.5, 0.2, b * 0.42, 0.2, 0.07, 0.2, { rz: Math.PI / 2 });
    for (let i = 0; i < 4; i++) K.rock(i % 2 ? M.iron : M.stoneDark, (i % 2 - 0.5) * 0.4, 0.85, (i > 1 ? 0.3 : -0.3), 0.2, 0.15, 0.2, { ry: i });
  },
  crate(K) { K.box(K.M.wood, 0, 0.35, 0, 0.7, 0.7, 0.7); K.box(K.M.woodDark, 0, 0.71, 0, 0.74, 0.04, 0.74); },
  torch(K) { K.cyl6(K.M.woodDark, 0, 0.9, 0, 0.05, 1.8, 0.05); K.fire(0, 1.75, 0, 0.16, 10); },
  oreDepot(K) {
    const M = K.M;
    K.box(M.woodDark, 0, 0.4, 0, 1.8, 0.8, 1.3);
    K.box(M.darkOpening, 0, 0.78, 0, 1.6, 0.06, 1.1);
    for (let i = 0; i < 5; i++) K.rock(i % 2 ? M.iron : M.stone, -0.6 + i * 0.3, 0.9, (i % 2 - 0.5) * 0.4, 0.2, 0.15, 0.19, { ry: i });
  },
  // ---- fazenda
  barn(K) {
    const M = K.M, w = 5, d = 4.2, h = 3;
    K.box(M.woodDark, 0, h / 2 - 0.3, -d / 2 + 0.1, w, h + 0.6, 0.2);
    for (const s of [-1, 1]) K.box(M.woodDark, s * (w / 2 - 0.1), h / 2 - 0.3, 0, 0.2, h + 0.6, d - 0.4);
    for (const s of [-1, 1]) K.box(M.woodDark, s * 1.9, h / 2 - 0.3, d / 2 - 0.1, 1.2, h + 0.6, 0.2);
    K.box(M.woodDark, 0, h - 0.25, d / 2 - 0.1, 2.6, 0.7, 0.2);
    const p = K.toWorld(0, 0);
    K.ctx.batch.add(G.roofSlopes, B.doubleSided(M.thatch), { x: p.x, y: K.gy + h, z: p.z, ry: K.yaw, sx: w + 0.8, sy: 1.9, sz: d + 0.8 });
    K.ctx.batch.add(G.gables, M.woodDark, { x: p.x, y: K.gy + h, z: p.z, ry: K.yaw, sx: w, sy: 1.9 * d / (d + 0.8), sz: d });
    sackRow({ ...K, ball: (m, ox, oy, oz, ...r) => K.ball(m, ox, oy, oz - 1.2, ...r) }, M.basket, 4);
    for (let i = 0; i < 3; i++) K.box(M.cropDry, -1.6 + i * 0.5, 0.3, -1.3, 0.45, 0.6, 0.6);
  },
  cropPlot(K, { w = 8, d = 5, crop = 'wheat', id = 0 }) {
    const ctx = K.ctx, M = K.M, wheat = crop === 'wheat';
    K.box(M.soilRows ?? M.dirt, 0, 0.03, 0, w, 0.06, d);
    const spacing = wheat ? 0.42 : 0.7, rowGap = wheat ? 0.55 : 0.85;
    const cols = Math.floor(w / spacing), rows = Math.floor(d / rowGap);
    const geo = wheat ? cropGeoWheat() : cropGeoVeg();
    const mesh = new THREE.InstancedMesh(geo, wheat ? M.cropDry : M.cropGreen, cols * rows);
    const base = [];
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const p = K.toWorld(-w / 2 + (i + 0.5) * spacing + (K.rng() - 0.5) * 0.08, -d / 2 + (j + 0.5) * rowGap);
      base.push({ x: p.x, y: ctx.terrain.heightAt(p.x, p.z), z: p.z, s: 0.8 + K.rng() * 0.4, r: K.rng() * 6.28 });
    }
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    ctx.dynamic.add(mesh);
    const plot = { id, crop, mesh, base, shown: -1 };
    K.wp.plots[id] = plot;
    setPlotStage(plot, (id * 2) % 5);
  },
  farmWell(K) {
    const M = K.M;
    K.cyl(M.stone, 0, 0.42, 0, 0.75, 0.84, 0.75);
    K.cyl(M.water, 0, 0.8, 0, 0.6, 0.02, 0.6);
    for (const s of [-1, 1]) K.cyl6(M.woodDark, s * 0.72, 1.15, 0, 0.06, 2.3, 0.06);
    K.cyl6(M.woodDark, 0, 2.25, 0, 0.06, 1.55, 0.06, { rz: Math.PI / 2 });
    K.pyr(M.thatch, 0, 2.75, 0, 2.0, 0.8, 1.6);
    K.cyl(M.wood, 0.2, 0.98, 0.5, 0.15, 0.24, 0.15);
  },
  grainSacks(K) { sackRow(K, K.M.basket, 4); },
  flourSacks(K) { sackRow(K, K.M.whitePaint ?? K.M.adobeWhite, 3); },
  handCart(K) {
    const M = K.M;
    K.box(M.wood, 0, 0.62, 0, 1.1, 0.12, 1.6);
    for (const s of [-1, 1]) { K.box(M.woodDark, s * 0.55, 0.85, 0, 0.06, 0.4, 1.6); K.cyl(M.woodDark, s * 0.66, 0.42, -0.2, 0.42, 0.07, 0.42, { rz: Math.PI / 2 }); K.box(M.woodDark, s * 0.4, 0.62, 1.35, 0.06, 0.06, 1.1); }
    for (let i = 0; i < 3; i++) K.ball(M.produceOrange, -0.3 + i * 0.3, 0.8, 0, 0.16, 0.14, 0.16);
  },
  fencePerimeter(K, { w, d, gate = 3 }) {
    const hw = w / 2, hd = d / 2, run = (ax, az, bx, bz) => { const a = K.toWorld(ax, az), b = K.toWorld(bx, bz); B.fenceRun(K.ctx, { ax: a.x, az: a.z, bx: b.x, bz: b.z }); };
    run(-hw, -hd, hw, -hd); run(-hw, -hd, -hw, hd); run(hw, -hd, hw, hd);
    run(-hw, hd, -gate / 2, hd); run(gate / 2, hd, hw, hd); // porteira aberta na frente
  },
  // ---- capela / escriba
  altar(K) {
    const M = K.M;
    K.box(M.stoneLight ?? M.stone, 0, 0.5, 0, 1.7, 1.0, 0.75);
    K.box(M.clothRed, 0, 1.02, 0, 1.8, 0.04, 0.85);
    K.box(M.gold ?? M.brass, 0, 1.45, -0.1, 0.07, 0.8, 0.07);
    K.box(M.gold ?? M.brass, 0, 1.6, -0.1, 0.4, 0.07, 0.07);
  },
  candles(K) {
    const M = K.M;
    K.cyl6(M.iron, 0, 0.55, 0, 0.04, 1.1, 0.04);
    K.cyl(M.iron, 0, 0.03, 0, 0.2, 0.06, 0.2);
    for (let i = -1; i <= 1; i++) { K.cyl(M.whitePaint ?? M.bone, i * 0.14, 1.2, 0, 0.03, 0.22, 0.03); K.cone(M.flame, i * 0.14, 1.36, 0, 0.025, 0.08, 0.025); }
    K.lamp(0, 1.4, 0.2);
  },
  lectern(K) { K.cyl6(K.M.woodDark, 0, 0.55, 0, 0.07, 1.1, 0.07); K.box(K.M.woodDark, 0, 1.15, 0, 0.6, 0.06, 0.45, { rx: 0.45 }); K.box(K.M.bone, 0, 1.2, 0, 0.42, 0.04, 0.3, { rx: 0.45 }); },
  pew(K) { // banco de igreja: assento (sem colisor) e encosto atrás de quem senta (+Z, longe do altar)
    const M = K.M;
    K.seatBox(M.wood, 0, 0.45, 0, 1.9, 0.07, 0.42);
    K.box(M.wood, 0, 0.75, 0.22, 1.9, 0.6, 0.06);
    for (const s of [-1, 1]) K.seatBox(M.woodDark, s * 0.9, 0.24, 0, 0.07, 0.48, 0.42);
  },
  bookTable(K) {
    const M = K.M;
    K.box(M.wood, 0, 0.78, 0, 1.2, 0.07, 0.7);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.box(M.woodDark, a * 0.52, 0.38, b * 0.28, 0.08, 0.76, 0.08);
    for (let i = 0; i < 3; i++) K.box([M.clothRed, M.clothBlue, M.clothGreen][i], -0.3 + i * 0.3, 0.86 + (i % 2) * 0.04, 0, 0.24, 0.07, 0.32, { ry: i * 0.3 });
  },
  bookshelf(K) {
    const M = K.M;
    K.box(M.woodDark, 0, 1.05, 0, 1.9, 2.1, 0.4);
    for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) K.box([M.clothRed, M.clothBlue, M.clothGreen, M.leather, M.clothYellow][(i + r) % 5], -0.76 + i * 0.19, 0.38 + r * 0.5, 0.12, 0.13, 0.36, 0.22);
  },
  writingDesk(K) {
    const M = K.M;
    K.box(M.wood, 0, 0.8, 0, 1.3, 0.07, 0.7, { rx: 0.08 });
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.box(M.woodDark, a * 0.58, 0.39, b * 0.28, 0.08, 0.78, 0.08);
    K.box(M.bone, 0, 0.86, 0.05, 0.42, 0.02, 0.3);
    K.cyl(M.iron, 0.45, 0.9, -0.15, 0.05, 0.1, 0.05);
  },
  stool(K) { K.seatCyl(K.M.wood, 0, 0.44, 0, 0.2, 0.07, 0.2); for (let i = 0; i < 3; i++) K.seatCyl6(K.M.woodDark, Math.cos(i * 2.1) * 0.13, 0.21, Math.sin(i * 2.1) * 0.13, 0.03, 0.42, 0.03); },
  // ---- carpintaria / lenhador
  sawhorse(K) {
    const M = K.M;
    for (const s of [-1, 1]) { K.box(M.woodDark, s * 0.7, 0.4, 0, 0.1, 0.8, 0.7); }
    K.box(M.woodDark, 0, 0.82, 0, 1.6, 0.1, 0.12);
    K.cyl(M.log, 0, 0.98, 0, 0.14, 2.0, 0.14, { rz: Math.PI / 2 });
  },
  trestle(K) { for (const s of [-1, 1]) K.box(K.M.woodDark, s * 0.6, 0.38, 0, 0.08, 0.76, 0.6); K.box(K.M.woodLight, 0, 0.8, 0, 1.6, 0.06, 0.8); K.box(K.M.woodLight, 0.2, 0.86, 0, 0.9, 0.05, 0.5); },
  logPile(K) { logs(K, K.M.log, 9, 2.2); },
  plankStack(K) { for (let i = 0; i < 6; i++) K.box(i % 2 ? K.M.woodLight : K.M.wood, 0, 0.06 + i * 0.07, (i % 2) * 0.04, 2.2, 0.06, 0.7); },
  choppingBlock(K) { K.cyl(K.M.log, 0, 0.3, 0, 0.36, 0.6, 0.36); K.cyl(K.M.woodLight, 0, 0.72, 0, 0.13, 0.24, 0.13); },
  firewoodStack(K) { for (let r = 0; r < 4; r++) for (let i = 0; i < 5; i++) K.cyl6(K.M.woodLight, -0.6 + i * 0.3, 0.14 + r * 0.26, 0, 0.13, 0.7, 0.13, { rx: Math.PI / 2 }); },
  axeStump(K) { K.cyl(K.M.log, 0, 0.25, 0, 0.3, 0.5, 0.3); K.box(K.M.wood, 0.05, 0.75, 0, 0.05, 0.7, 0.05, { rz: -0.5 }); K.box(K.M.iron, 0.2, 0.52, 0, 0.2, 0.14, 0.04); },
  woodShed(K) {
    const M = K.M;
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.cyl6(M.log, a * 2.6, 1.0 + (b < 0 ? 0 : 0.25), b * 0.8, 0.09, 2.0 + (b < 0 ? 0 : 0.5), 0.09);
    K.box(M.woodDark, 0, 2.3, 0, 5.8, 0.07, 2.3, { rx: 0.16 });
  },
  // ---- padaria / taverna
  oven(K) {
    const M = K.M;
    K.box(M.stone, 0, 0.45, 0, 1.7, 0.9, 1.3);
    K.ball(M.adobeWhite ?? M.stoneLight, 0, 0.95, 0, 0.85, 0.75, 0.68);
    K.box(M.darkOpening, 0, 1.05, 0.6, 0.6, 0.42, 0.14);
    K.fire(0, 0.95, 0.5, 0.2, 14);
  },
  kneadTable(K) {
    const M = K.M;
    K.box(M.woodLight, 0, 0.86, 0, 1.8, 0.09, 0.85);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.box(M.woodDark, a * 0.8, 0.42, b * 0.34, 0.1, 0.84, 0.1);
    K.ball(M.adobeWhite ?? M.bone, 0, 0.95, 0.05, 0.26, 0.1, 0.22);
    K.ball(M.adobeWhite ?? M.bone, 0.55, 0.94, -0.1, 0.16, 0.08, 0.15);
  },
  breadShelf(K) {
    const M = K.M;
    K.box(M.woodDark, 0, 0.95, 0, 1.7, 1.9, 0.08);
    for (const y of [0.5, 1.05, 1.6]) { K.box(M.wood, 0, y, 0.2, 1.7, 0.05, 0.42); for (let i = 0; i < 4; i++) K.ball(M.basket, -0.6 + i * 0.4, y + 0.1, 0.2, 0.17, 0.09, 0.11); }
  },
  counter(K) { K.box(K.M.woodDark, 0, 0.5, 0, 2.6, 1.0, 0.6); K.box(K.M.woodLight, 0, 1.03, 0, 2.8, 0.07, 0.72); for (let i = 0; i < 3; i++) K.ball(K.M.basket, -0.8 + i * 0.8, 1.14, 0, 0.19, 0.1, 0.12); },
  basket(K) { K.cyl(K.M.basket, 0, 0.2, 0, 0.3, 0.4, 0.3); for (let i = 0; i < 3; i++) K.ball(K.M.produceYellow, Math.cos(i * 2.1) * 0.12, 0.44, Math.sin(i * 2.1) * 0.12, 0.13, 0.1, 0.13); },
  fireplace(K) {
    const M = K.M;
    K.box(M.stoneDark, 0, 0.9, -0.15, 1.9, 1.8, 0.7);
    K.box(M.darkOpening, 0, 0.6, 0.2, 1.1, 0.9, 0.2);
    K.box(M.stone, 0, 1.85, -0.05, 2.1, 0.14, 0.9);
    K.fire(0, 0.2, 0.2, 0.34, 20);
  },
  barCounter(K) {
    const M = K.M;
    K.box(M.woodDark, 0, 0.52, 0, 3.4, 1.04, 0.6);
    K.box(M.wood, 0, 1.07, 0, 3.6, 0.07, 0.75);
    for (let i = 0; i < 4; i++) K.cyl(M.pottery, -1.2 + i * 0.8, 1.2, 0.05, 0.07, 0.18, 0.07);
  },
  kegs(K) { for (let i = 0; i < 2; i++) { K.cyl(K.M.wood, -0.5 + i * 1.0, 0.5, 0, 0.42, 0.9, 0.42, { rx: Math.PI / 2 }); K.box(K.M.woodDark, -0.5 + i * 1.0, 0.1, 0, 0.7, 0.2, 0.8); } },
  cookPot(K) {
    const M = K.M;
    for (let i = 0; i < 3; i++) K.cyl6(M.iron, Math.cos(i * 2.1) * 0.5, 0.75, Math.sin(i * 2.1) * 0.5, 0.03, 1.6, 0.03, { rz: Math.cos(i * 2.1) * 0.3, rx: -Math.sin(i * 2.1) * 0.3 });
    K.ball(M.iron, 0, 0.62, 0, 0.36, 0.3, 0.36);
    K.fire(0, 0.05, 0, 0.2, 10);
  },
  table(K) { K.cyl(K.M.wood, 0, 0.76, 0, 0.6, 0.07, 0.6); K.cyl(K.M.woodDark, 0, 0.37, 0, 0.09, 0.74, 0.09); K.cyl(K.M.pottery, 0.2, 0.86, 0.1, 0.06, 0.14, 0.06); K.cyl(K.M.pottery, -0.2, 0.84, -0.15, 0.11, 0.05, 0.11); },
  pantry(K) { PROPS.shelf(K); for (let i = 0; i < 3; i++) K.cyl(K.M.pottery, -0.5 + i * 0.5, 0.2, 0.25, 0.16, 0.4, 0.16); },
  // ---- estábulo
  stall(K) {
    const M = K.M;
    for (const s of [-1, 1]) { K.box(M.woodDark, s * 1.5, 0.75, 0, 0.1, 1.5, 2.2); }
    K.box(M.woodDark, 0, 0.75, -1.1, 3.0, 1.5, 0.1);
    K.box(M.cropDry, 0, 0.05, 0, 2.7, 0.1, 2.0);
  },
  horse(K) {
    const g = B.animal(K.ctx, { x: K.origin.x, z: K.origin.z, kind: 'donkey' });
    g.rotation.y = K.yaw;
    g.scale.setScalar(1.35);
    K.v.animals.push(g);
  },
  hayPile(K) { K.ball(K.M.cropDry, 0, 0.45, 0, 0.9, 0.6, 0.8); K.ball(K.M.cropDry, 0.5, 0.25, 0.4, 0.5, 0.35, 0.45); },
  trough(K) { K.box(K.M.woodDark, 0, 0.3, 0, 2.0, 0.45, 0.6); K.box(K.M.cropDry, 0, 0.5, 0, 1.8, 0.1, 0.45); for (const s of [-1, 1]) K.box(K.M.woodDark, s * 0.85, 0.1, 0, 0.12, 0.2, 0.6); },
  waterTrough(K) { K.box(K.M.stone, 0, 0.28, 0, 1.8, 0.56, 0.7); K.box(K.M.water, 0, 0.55, 0, 1.6, 0.03, 0.5); },
  // ---- mercado
  stallFood(K) { stall(K, K.M.clothRed, [K.M.produceRed, K.M.produceGreen, K.M.produceYellow, K.M.produceOrange]); },
  stallCloth(K) { stall(K, K.M.clothBlue, [K.M.clothRed, K.M.clothYellow, K.M.clothGreen]); },
  stallTools(K) { stall(K, K.M.clothGreen, [K.M.iron, K.M.wood, K.M.pottery]); },
  // ---- cais
  netRack(K) {
    const M = K.M;
    for (const s of [-1, 1]) K.cyl6(M.woodDark, s * 1.0, 0.95, 0, 0.06, 1.9, 0.06);
    K.cyl6(M.woodDark, 0, 1.85, 0, 0.05, 2.1, 0.05, { rz: Math.PI / 2 });
    K.box(M.rope, 0, 1.15, 0, 1.9, 1.3, 0.03);
  },
  fishRack(K) {
    const M = K.M;
    for (const s of [-1, 1]) K.cyl6(M.woodDark, s * 0.9, 0.8, 0, 0.05, 1.6, 0.05);
    K.cyl6(M.woodDark, 0, 1.55, 0, 0.04, 1.9, 0.04, { rz: Math.PI / 2 });
    for (let i = 0; i < 5; i++) K.ball(M.hideLight ?? M.bone, -0.7 + i * 0.35, 1.3, 0, 0.06, 0.2, 0.03);
  },
  fishCrate(K) { K.box(K.M.wood, 0, 0.3, 0, 0.9, 0.6, 0.7); for (let i = 0; i < 4; i++) K.ball(K.M.hideLight ?? K.M.bone, -0.25 + i * 0.17, 0.63, 0, 0.07, 0.04, 0.22); },
  boatAshore(K) { K.ctx.batch.add(G.hull, K.M.woodDark, { x: K.origin.x, y: K.gy + 0.35, z: K.origin.z, ry: K.yaw, sx: 0.75, sy: 0.5, sz: 2.2 }); K.box(K.M.wood, 0, 0.36, 0, 1.2, 0.05, 0.3); },
  jetty(K) {
    // pranchas baixas até a beira (o topo fica a um palmo do chão: anda-se por cima)
    for (let i = 0; i < 5; i++) K.box(K.M.wood, 0, 0.08, -1.2 + i * 0.62, 2.2, 0.08, 0.55);
  },
  // ---- tecelagem / olaria / moinho / enfermaria
  loom(K) {
    const M = K.M;
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.box(M.woodDark, a * 0.8, 0.85, b * 0.5, 0.09, 1.7, 0.09);
    for (const y of [0.5, 1.65]) K.box(M.woodDark, 0, y, 0, 1.7, 0.09, 0.09);
    K.box(M.clothYellow, 0, 1.05, 0, 1.45, 1.0, 0.03);
    K.box(M.wood, 0, 0.95, 0.5, 1.7, 0.06, 0.12);
  },
  spinningWheel(K) { K.cyl(K.M.woodDark, 0.3, 0.75, 0, 0.5, 0.05, 0.5, { rx: Math.PI / 2 }); K.box(K.M.wood, -0.1, 0.45, 0, 1.1, 0.08, 0.3); for (const s of [-1, 1]) K.box(K.M.woodDark, s * 0.45 - 0.1, 0.22, 0, 0.07, 0.44, 0.3); K.cyl6(K.M.wood, -0.5, 0.7, 0, 0.03, 0.5, 0.03); },
  clothRolls(K) { for (let i = 0; i < 5; i++) K.cyl([K.M.clothRed, K.M.clothBlue, K.M.clothGreen, K.M.clothYellow][i % 4], -0.55 + i * 0.28, 0.2 + (i % 2) * 0.22, 0, 0.11, 1.2, 0.11, { rx: Math.PI / 2 }); },
  woolBasket(K) { K.cyl(K.M.basket, 0, 0.22, 0, 0.36, 0.44, 0.36); K.ball(K.M.whitePaint ?? K.M.bone, 0, 0.5, 0, 0.32, 0.2, 0.32); },
  dyeVat(K) { K.cyl(K.M.wood, 0, 0.35, 0, 0.5, 0.7, 0.5); K.cyl(K.M.clothBlue, 0, 0.69, 0, 0.45, 0.02, 0.45); },
  kiln(K) {
    const M = K.M;
    K.cyl(M.mudBrick, 0, 0.55, 0, 0.85, 1.1, 0.85);
    K.ball(M.mudBrick, 0, 1.1, 0, 0.85, 0.7, 0.85);
    K.box(M.darkOpening, 0, 0.5, 0.78, 0.5, 0.5, 0.16);
    K.fire(0, 0.3, 0.7, 0.2, 14);
  },
  potterWheel(K) { K.cyl(K.M.stone, 0, 0.55, 0, 0.36, 0.07, 0.36); K.cyl(K.M.woodDark, 0, 0.27, 0, 0.07, 0.54, 0.07); K.cyl(K.M.pottery, 0, 0.72, 0, 0.14, 0.26, 0.11); },
  clayPile(K) { K.ball(K.M.mudBrickDark ?? K.M.mudBrick, 0, 0.22, 0, 0.5, 0.3, 0.45); K.ball(K.M.mudBrick, 0.3, 0.15, 0.2, 0.3, 0.2, 0.28); },
  potShelf(K) {
    const M = K.M;
    K.box(M.woodDark, 0, 0.95, 0, 1.6, 1.9, 0.08);
    for (const y of [0.5, 1.05, 1.6]) { K.box(M.wood, 0, y, 0.2, 1.6, 0.05, 0.42); for (let i = 0; i < 4; i++) K.cyl(M.pottery, -0.55 + i * 0.37, y + 0.14, 0.2, 0.11, 0.24, 0.08); }
  },
  millstone(K) {
    const M = K.M;
    K.cyl(M.stone, 0, 0.45, 0, 0.8, 0.3, 0.8);
    K.cyl(M.stoneDark, 0, 0.75, 0, 0.72, 0.28, 0.72);
    K.cyl(M.woodDark, 0, 1.6, 0, 0.09, 2.2, 0.09);
    K.box(M.woodDark, 0, 0.15, 0, 1.9, 0.3, 1.9);
  },
  hopper(K) { K.pyr(K.M.wood, 0, 1.5, 0, 1.0, 0.8, 1.0, { rx: Math.PI }); for (const s of [-1, 1]) K.box(K.M.woodDark, s * 0.45, 0.7, 0, 0.08, 1.4, 0.08); },
  bed(K) { K.box(K.M.woodDark, 0, 0.3, 0, 0.95, 0.25, 2.0); K.box(K.M.whitePaint ?? K.M.bone, 0, 0.47, 0.05, 0.85, 0.1, 1.8); K.box(K.M.clothBlue, 0, 0.53, 0.4, 0.87, 0.06, 1.1); K.box(K.M.woodDark, 0, 0.6, -0.97, 0.95, 0.8, 0.07); },
  herbTable(K) { PROPS.kneadTable(K); for (let i = 0; i < 3; i++) K.cyl(K.M.pottery, -0.5 + i * 0.3, 0.98, -0.2, 0.06, 0.14, 0.06); },
  herbRack(K) {
    const M = K.M;
    K.box(M.woodDark, 0, 1.1, 0, 1.5, 1.5, 0.08);
    for (let i = 0; i < 6; i++) K.cone(i % 2 ? M.cropGreen : M.cropDry, -0.6 + i * 0.24, 1.35 - (i % 2) * 0.2, 0.1, 0.07, 0.4, 0.07, { rx: Math.PI });
  },
  // ---- guarda
  sentryBox(K) {
    const M = K.M;
    K.box(M.woodDark, 0, 1.2, -0.45, 1.3, 2.4, 0.1);
    for (const s of [-1, 1]) K.box(M.woodDark, s * 0.6, 1.2, 0, 0.1, 2.4, 1.0);
    K.pyr(M.tilesRed ?? M.thatch, 0, 2.75, 0, 1.9, 0.7, 1.7);
  },
  brazier(K) { K.cyl(K.M.iron, 0, 0.75, 0, 0.3, 0.2, 0.2); for (let i = 0; i < 3; i++) K.cyl6(K.M.iron, Math.cos(i * 2.1) * 0.2, 0.35, Math.sin(i * 2.1) * 0.2, 0.025, 0.7, 0.025); K.fire(0, 0.8, 0, 0.22, 14); },
};

/** Tipos de móvel disponíveis (para o teste conferir a configuração). */
export const PROP_KINDS = Object.keys(PROPS);

let _wheat = null, _veg = null;
function cropGeoWheat() {
  if (!_wheat) {
    const stem = new THREE.CylinderGeometry(0.012, 0.016, 0.9, 4).translate(0, 0.45, 0);
    const ear = new THREE.ConeGeometry(0.045, 0.24, 5).translate(0, 0.98, 0);
    _wheat = mergeGeos([stem, ear, stem.clone().rotateZ(0.12).translate(0.07, 0, 0.03), ear.clone().rotateZ(0.12).translate(-0.05, 0, 0.03)]);
  }
  return _wheat;
}
function cropGeoVeg() {
  if (!_veg) _veg = mergeGeos([new THREE.SphereGeometry(0.2, 6, 4).scale(1, 0.75, 1).translate(0, 0.16, 0), new THREE.ConeGeometry(0.16, 0.34, 5).translate(0, 0.42, 0)]);
  return _veg;
}
function mergeGeos(list) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const n = parts.reduce((s, g) => s + g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); o += g.attributes.position.count * 3; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

/**
 * Mostra a leira num estágio de crescimento (0 terra arada … 4 maduro):
 * a altura das plantas muda; em terra arada elas somem.
 * @param {{ mesh: THREE.InstancedMesh, base: object[], shown: number }} plot
 * @param {number} stage
 */
export function setPlotStage(plot, stage) {
  if (plot.shown === stage) return;
  plot.shown = stage;
  const k = FARMING.heights[stage] ?? 0, mesh = plot.mesh;
  mesh.visible = k > 0;
  if (!mesh.visible) return;
  plot.base.forEach((b, i) => {
    _q.setFromAxisAngle(UP, b.r);
    const w = b.s * (0.45 + 0.55 * k);
    mesh.setMatrixAt(i, _m.compose(_p.set(b.x, b.y, b.z), _q, _s.set(w, b.s * k, w)));
  });
  mesh.count = plot.base.length;
  mesh.instanceMatrix.needsUpdate = true;
}
