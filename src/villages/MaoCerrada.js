import { Village } from './Village.js';
import * as B from './Builders.js';
import * as X from './BuildersExtra.js';
import { VILLAGES } from '../config/villages.js';
import { Mechanics } from '../systems/Mechanics.js';

/**
 * AREIA-FUNDA — sede da Mão-Cerrada (organização de Gierigheid), no Saara.
 * Design: design/narrative/mao-cerrada.md (Partes IV–VI e XV).
 *
 * A cidade é uma página de livro-caixa: uma GRADE de Colunas (norte–sul) e
 * Linhas (leste–oeste) entre quadras de 2×2 lotes ("Folhas"). Os bairros se
 * separam pela dívida: Haver (credores, reboco branco, 2 pisos, torres de
 * vento) a leste; Deve (devedores, adobe ocre) a oeste; Quitados no meio.
 * No centro, a Casa da Balança (cúpula); ao sul dela, a praça com o Quadro
 * dos Devedores; ao norte, o Templo do Raio Justo. Muralha retangular com o
 * Portão do Pedágio (leste, para o Cais de Areia) e o Portão do Poço (oeste,
 * para o Palmeiral dos Penhores e as salinas). Escarpa ao norte e a leste
 * (Ridges.js).
 */
export function buildMaoCerrada(game) {
  const cfg = VILLAGES.maoCerrada;
  const v = new Village(game, cfg, 902);
  const { ctx } = v;
  const { M } = ctx;
  const cx = v.x, cz = v.z;
  const r = v.rnd;
  const G = cfg.grid;
  const block = 2 * G.lot;
  const W = G.cols * block + (G.cols + 1) * G.colStreet;
  const D = G.rows * block + (G.rows + 1) * G.rowStreet;
  const x0 = cx - W / 2, z0 = cz - D / 2;
  const bx = (ci) => x0 + G.colStreet + ci * (block + G.colStreet) + block / 2;
  const bz = (ri) => z0 + G.rowStreet + ri * (block + G.rowStreet) + block / 2;
  const ground = (x, z) => ctx.terrain.heightAt(x, z);
  const say = (speaker, title, text) => (g) => Mechanics.talk(g, { speaker, title, text });

  // Quadras ocupadas por marcos: [ci0, ci1, ri0, ri1].
  const mid = Math.floor(G.cols / 2);
  const LANDMARKS = {
    balanca: [mid - 1, mid + 1, 3, 4],
    templo: [mid, mid, 1, 1],
    praca: [mid - 1, mid + 1, 5, 5],
    quartel: [mid + 3, mid + 3, 4, 4],
  };
  const taken = (ci, ri) => Object.values(LANDMARKS).some(([a, b, c, d]) => ci >= a && ci <= b && ri >= c && ri <= d);
  const span = ([a, b, c, d]) => ({
    x: (bx(a) + bx(b)) / 2, z: (bz(c) + bz(d)) / 2,
    w: (b - a + 1) * block + (b - a) * G.colStreet, d: (d - c + 1) * block + (d - c) * G.rowStreet,
  });

  // ------------------------------------------------ Ruas: Colunas e Linhas
  v.paintDisc(cx, cz, Math.hypot(W, D) / 2 + 6, 0xc8a878, 0.5);
  for (let i = 0; i <= G.cols; i++) {
    const x = x0 + G.colStreet / 2 + i * (block + G.colStreet);
    v.street(x, z0, x, z0 + D, G.colStreet, 0xb89868);
  }
  for (let j = 0; j <= G.rows; j++) {
    const z = z0 + G.rowStreet / 2 + j * (block + G.rowStreet);
    v.street(x0, z, x0 + W, z, G.rowStreet, 0xb89868);
  }
  // As duas avenidas dos portões (Linha do meio) pavimentadas de arenito.
  const gateZ = z0 + G.rowStreet / 2 + 5 * (block + G.rowStreet);
  X.pavePath(ctx, { ax: x0 - 12, az: gateZ, bx: x0 + W + 12, bz: gateZ, width: G.rowStreet, kind: 'stone', mat: M.sandstone });

  // ------------------------------------------------ Casas da grade
  for (let ci = 0; ci < G.cols; ci++) {
    const t = (ci + 0.5) / G.cols;
    const district = t >= G.haverFrom ? 'haver' : t >= G.quitados[0] && t < G.quitados[1] ? 'quitados' : 'deve';
    for (let ri = 0; ri < G.rows; ri++) {
      if (taken(ci, ri)) continue;
      const x = bx(ci), z = bz(ri);
      if (district === 'deve' && r() < 0.1) { // pátio vazio com um forno de barro
        B.part(ctx, B.G.sphere, M.mudBrickDark, x, z, 0, ground(x, z), { ly: 0.3, w: 0.9, h: 0.8, d: 0.9 });
        continue;
      }
      for (const half of [-1, 1]) { // metade norte (porta para o norte) e sul
        const hz = z + half * (G.lot / 2);
        const rot = half < 0 ? Math.PI : 0;
        const wall = district === 'haver' ? M.adobeWhite : district === 'quitados' ? M.adobePastel : (r() < 0.5 ? M.adobeOchre : M.mudBrick);
        const h = district === 'haver' ? 6 : district === 'quitados' ? 4 : 3.2;
        B.house(ctx, { x, z: hz, rot, w: block - 1.5, d: G.lot - 1.5, h, wall, roof: 'flat' });
        if (district === 'haver' && r() < 0.5) windTower(ctx, { x: x + (r() - 0.5) * 6, z: hz - half * 1.2, y: ground(x, hz) + h + 0.6 });
      }
      v.reserve(x, z, block / 2);
    }
  }

  // ------------------------------------------------ Casa da Balança (cúpula)
  {
    const s = span(LANDMARKS.balanca);
    const bw = s.w - 6, bd = s.d - 6, bh = 7;
    const y0 = B.groundUnder(ctx, s.x, s.z, 0, bw / 2, bd / 2) - 0.2;
    const P = (geo, mat, o) => B.part(ctx, geo, mat, s.x, s.z, 0, y0, o);
    P(B.G.box, M.sandstone, { ly: 0.5, w: bw + 2, h: 1, d: bd + 2 });
    P(B.G.box, M.adobeWhite, { ly: 1 + bh / 2, w: bw, h: bh, d: bd });
    P(B.G.box, M.sandstone, { ly: 1 + bh + 0.3, w: bw + 0.6, h: 0.6, d: bd + 0.6 });
    P(B.G.sphere, M.adobeWhite, { ly: 1 + bh + 0.6, w: 12, h: 6, d: 12 }); // cúpula achatada (12 m)
    P(B.G.sphere, M.brass, { ly: 1 + bh + 6.9, w: 0.7, h: 0.7, d: 0.7 });
    // Arcada da frente (sul) com 7 colunas e a porta de bronze.
    for (let i = 0; i < 7; i++) P(B.G.cyl, M.sandstone, { lx: -bw / 2 + 4 + i * ((bw - 8) / 6), lz: bd / 2 + 2.5, ly: 1 + 2.6, w: 0.45, h: 5.2, d: 0.45 });
    P(B.G.box, M.sandstone, { lz: bd / 2 + 2.5, ly: 1 + 5.4, w: bw - 6, h: 0.6, d: 1.2 });
    P(B.G.box, M.brass, { lz: bd / 2 + 0.05, ly: 1 + 1.6, w: 2.6, h: 3.2, d: 0.12 });
    ctx.collisions.addBox(s.x, s.z, bw / 2 + 1, bd / 2 + 1, 0, 'house');
    v.reserve(s.x, s.z, Math.max(bw, bd) / 2 + 3);
    const door = { x: s.x, z: s.z + bd / 2 + 4 };
    game.interactions.register({
      id: 'mao-grande-livro', label: 'Pedir para ver o Grande Livro', radius: 3.5,
      position: { x: door.x, y: ground(door.x, door.z) + 1.5, z: door.z },
      onInteract: say('Idrel Kassou', 'O Dedo da Conta',
        '"O Grande Livro não se mostra. Se o seu nome está nele, você já sabe. Se não está, ainda vai estar."'),
    });
    v.addNPC({ id: 'mao-idrel', name: 'Idrel Kassou', title: 'O Dedo da Conta',
      look: { robe: true, shirt: 0xf0e6cc, hat: 'wrap', height: 1.7 }, x: door.x + 3, z: door.z, facing: 0,
      onInteract: say('Idrel Kassou', 'O Dedo da Conta', '"Água, sombra, nome. Tudo tem preço aqui. O meu trabalho é lembrar de cada um."') });
    v.addNPC({ id: 'mao-djaro', name: 'Djaro Siddo', title: 'Escriba do Salão da Conta',
      look: { robe: true, shirt: 0x8a6a48, hat: 'wrap', height: 1.76 }, x: door.x - 3.5, z: door.z + 1, facing: 0,
      onInteract: say('Djaro Siddo', 'Escriba', '"Meu sobrenome é Siddo, como o do antigo dono. Aqui isso é uma dívida que ninguém me deixa pagar."') });
  }

  // ------------------------------------------------ Templo do Raio Justo
  {
    const s = span(LANDMARKS.templo);
    B.church(ctx, { x: s.x, z: s.z, rot: 0, scale: 0.85, wall: M.adobeOchre, sahel: true });
    const px = s.x + 6.5, pz = s.z + 7, py = ground(px, pz);
    B.part(ctx, B.G.cyl, M.iron, px, pz, 0, py, { ly: 6, w: 0.18, h: 12, d: 0.18 }); // Poste do Raio
    for (let k = 0; k < 4; k++) B.part(ctx, B.G.cone8, M.brass, px, pz, 0, py, { ly: 12.2, lx: Math.cos(k * 1.57) * 0.3, lz: Math.sin(k * 1.57) * 0.3, w: 0.08, h: 0.8, d: 0.08 });
    ctx.collisions.addCircle(px, pz, 0.4, 'post');
    v.reserve(s.x, s.z, 11);
    v.addNPC({ id: 'mao-yarade', name: 'Yaradé Ossu', title: 'Sacerdotisa do Raio Justo',
      look: { robe: true, shirt: 0x2a3a6a, hat: 'wrap', height: 1.68 }, x: px - 2, z: pz + 1, facing: 0,
      onInteract: say('Yaradé Ossu', 'Templo do Raio Justo', '"O raio não cobra juros. Cai uma vez, onde quer, e o vidro que deixa é de todos."') });
  }

  // ------------------------------------------------ Praça e Quadro dos Devedores
  {
    const s = span(LANDMARKS.praca);
    B.plaza(ctx, { x: s.x, z: s.z, r: 9, mat: M.sandstone });
    v.npcSpots.push({ x: s.x, z: s.z - 2, r: 6 });
    const qz = s.z + s.d / 2 - 2, qy = ground(s.x, qz), qw = s.w - 8;
    B.part(ctx, B.G.box, M.mudBrick, s.x, qz, 0, qy, { ly: 1.7, w: qw, h: 3.4, d: 0.8 });
    // ~300 placas: latão (deve), quebradas (pagou, cinza) e vermelhas.
    for (let row = 0; row < 6; row++) {
      for (let k = 0; k < 50; k++) {
        const roll = r();
        const mat = roll < 0.72 ? M.brass : roll < 0.92 ? M.stoneDark : M.clothRed;
        const lx = -qw / 2 + 0.6 + k * ((qw - 1.2) / 49);
        B.part(ctx, B.G.box, mat, s.x, qz, 0, qy, { lx, lz: -0.45, ly: 0.6 + row * 0.48, w: 0.42, h: roll >= 0.72 && roll < 0.92 ? 0.18 : 0.32, d: 0.05 });
      }
    }
    ctx.collisions.addBox(s.x, qz, qw / 2, 0.45, 0, 'wall');
    v.reserve(s.x, s.z, Math.max(s.w, s.d) / 2);
    game.interactions.register({
      id: 'mao-quadro', label: 'Ler o Quadro dos Devedores', radius: 4,
      position: { x: s.x, y: qy + 1.6, z: qz - 1.2 },
      onInteract: say('Quadro dos Devedores', 'Praça da Balança',
        'Centenas de placas de latão com Coluna, Linha e Folha. Algumas quebradas ao meio. Poucas, pintadas de vermelho.'),
    });
  }

  // ------------------------------------------------ Quartel dos Cobradores do Dente
  {
    const s = span(LANDMARKS.quartel);
    B.house(ctx, { x: s.x, z: s.z, rot: Math.PI, w: block - 1, d: block - 3, h: 5, wall: M.mudBrickDark, roof: 'flat' });
    v.reserve(s.x, s.z, block / 2 + 1);
    v.addNPC({ id: 'mao-bako', name: 'Bako Sennar', title: 'O Dedo do Dente',
      look: { shirt: 0x2a2420, pants: 0x1c1814, hat: 'wrap', accessory: 'spear', build: 1.2, height: 1.9 },
      x: s.x, z: s.z - block / 2 - 1.5, facing: Math.PI,
      onInteract: say('Bako Sennar', 'Cobradores do Dente', '"Não cobro com raiva. Cobro na hora certa. Ao pôr do sol, todo devedor sabe que eu passo."') });
  }

  // ------------------------------------------------ Poços Selados (grade de bronze)
  for (let k = 0; k < 8; k++) {
    const i = 1 + Math.floor(r() * (G.cols - 1)), j = 1 + Math.floor(r() * (G.rows - 1));
    const x = x0 + G.colStreet / 2 + i * (block + G.colStreet), z = z0 + G.rowStreet / 2 + j * (block + G.rowStreet);
    if (!v.isFree(x, z, 1.6) || Math.abs(z - gateZ) < 3) continue;
    B.well(ctx, { x, z });
    const y = ground(x, z);
    for (let b = -2; b <= 2; b++) {
      B.part(ctx, B.G.box, M.brass, x, z, 0, y, { lx: b * 0.3, ly: 0.95, w: 0.05, h: 0.05, d: 1.5 });
      B.part(ctx, B.G.box, M.brass, x, z, 0, y, { lz: b * 0.3, ly: 0.97, w: 1.5, h: 0.05, d: 0.05 });
    }
    v.reserve(x, z, 2);
    v.npcSpots.push({ x: x + 2.5, z: z + 1.5, r: 2 }); // fila do poço
    if (k < 3) v.addNPC({ id: `mao-guarda-poco-${k}`, name: 'Guarda-Poço', look: { shirt: 0x6a5a40, hat: 'wrap' },
      x: x + 1.6, z: z + 0.4, facing: -1.6,
      onInteract: say('Guarda-Poço', 'Poço Selado', '"Um odre, uma marca no seu nome. Sem marca, sem água. Sem nome, sem marca."') });
  }

  // ------------------------------------------------ Muralha dos Selos (retangular)
  const hx = W / 2 + 8, hz = D / 2 + 8;
  const gateW = 9;
  const walls = [
    [cx - hx, cz - hz, cx + hx, cz - hz], // norte
    [cx - hx, cz + hz, cx + hx, cz + hz], // sul
    [cx + hx, cz - hz, cx + hx, gateZ - gateW / 2], [cx + hx, gateZ + gateW / 2, cx + hx, cz + hz], // leste (Pedágio)
    [cx - hx, cz - hz, cx - hx, gateZ - gateW / 2], [cx - hx, gateZ + gateW / 2, cx - hx, cz + hz], // oeste (Poço)
  ];
  for (const [ax, az, bx2, bz2] of walls) adobeWall(ctx, { ax, az, bx: bx2, bz: bz2, h: 6, t: 1.8 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) mirrorTower(ctx, { x: cx + sx * hx, z: cz + sz * hz });
  for (const sx of [-1, 1]) for (const s of [-1, 1]) {
    const x = cx + sx * hx, z = gateZ + s * (gateW / 2 + 1.6);
    B.part(ctx, B.G.box, M.sandstone, x, z, 0, ground(x, z) - 0.3, { ly: 4.5, w: 3.4, h: 9, d: 3.2 });
    ctx.collisions.addBox(x, z, 1.7, 1.6, 0, 'gate-tower');
  }
  // Escribas e guardas nos portões.
  v.addElder(cx + hx + 4, gateZ - 3, -Math.PI / 2);
  for (const sx of [-1, 1]) v.addNPC({ id: `mao-portao-${sx}`, name: 'Cobrador do Dente', title: 'Portão',
    look: { shirt: 0x2a2420, pants: 0x1c1814, hat: 'wrap', accessory: 'spear' }, x: cx + sx * (hx + 3), z: gateZ + 3.5, facing: sx > 0 ? Math.PI / 2 : -Math.PI / 2 });

  // ------------------------------------------------ Cais de Areia (fora, a leste)
  {
    const kx = cx + hx + 34, kz = gateZ;
    v.paintDisc(kx, kz, 30, 0xb89868, 0.6);
    v.npcSpots.push({ x: kx, z: kz, r: 10 }, { x: kx + 30, z: kz, r: 6 });
    const cloths = [M.clothRed, M.clothBlue, M.clothYellow];
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + Math.PI / 10, x = kx + Math.cos(a) * 18, z = kz + Math.sin(a) * 18;
      if (Math.abs(Math.sin(a)) < 0.35) continue; // deixa livre o eixo da avenida (leste–oeste)
      B.marketStall(ctx, { x, z, rot: Math.atan2(kx - x, kz - z) });
      if (k % 2 === 0) X.spiceSacks(ctx, { ...B.local(x, z, Math.atan2(kx - x, kz - z), 2.4, 0.8), rot: a, n: 4 });
      v.reserve(x, z, 2.5);
    }
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      X.awning(ctx, { ax: kx + Math.cos(a) * 9, az: kz + Math.sin(a) * 9, bx: kx + Math.cos(a + 0.6) * 9, bz: kz + Math.sin(a + 0.6) * 9, y: 3.6, width: 3.4, cloth: cloths[k % 3] });
    }
    for (let k = 0; k < 4; k++) { const x = kx + 26 + k * 4, z = kz + (k % 2 ? 6 : -6); X.cart(ctx, { x, z, rot: Math.PI / 2 }); v.reserve(x, z, 2); }
    for (let k = 0; k < 10; k++) {
      const x = kx - 6 + r() * 12, z = kz + 22 + r() * 6;
      if (v.isFree(x, z, 0.7)) { v.props.push({ type: r() < 0.5 ? 'barrel' : 'crate', x, z, rot: r() * 6 }); v.reserve(x, z, 0.7); }
    }
    B.corral(ctx, { x: kx + 8, z: kz - 34, w: 26, d: 16, gateSide: 1 });
    v.addNPC({ id: 'mao-kaddo', name: 'Kaddo Ambrel', title: 'Mestre de caravana',
      look: { robe: true, shirt: 0x3a5a7a, hat: 'wrap', build: 1.15, height: 1.84 }, x: kx + 3, z: kz + 3, facing: Math.PI,
      onInteract: say('Kaddo Ambrel', 'Cais de Areia', '"Duzentos camelos, uma rota de grão e um sócio que nunca dorme. Adivinha quem fica com o lucro."') });
    v.addNPC({ id: 'mao-hamsa', name: 'Hamsa Telli', title: 'Vendedor de água',
      look: { shirt: 0x9a7a52, hat: 'wrap', height: 1.7 }, x: cx + hx + 8, z: gateZ + 8, facing: -Math.PI / 2,
      onInteract: say('Hamsa Telli', 'Água da Guelta', '"Água da Guelta, quase de graça. Não conte para os Cobradores de onde ela vem."') });
  }

  // ------------------------------------------------ Palmeiral dos Penhores e salinas (oeste)
  {
    const px = cx - hx - 48, pz = cz;
    for (let i = 0; i < 9; i++) for (let j = 0; j < 22; j++) {
      const x = px - 32 + i * 8 + (r() - 0.5) * 1.2, z = pz - 86 + j * 8 + (r() - 0.5) * 1.2;
      if (Math.abs(z - gateZ) < 5) continue; // trilha do Portão do Poço
      v.plants.push({ type: 'palm', x, z, s: 0.8 + r() * 0.4, ry: r() * 6 });
    }
    v.street(cx - hx, gateZ, px - 40, gateZ, 4, 0xb89868);
    // Salinas: tabuleiro branco com placas de sal empilhadas.
    const sx = px - 70, sz = pz + 70;
    v.paintDisc(sx, sz, 22, 0xf2efe6, 0.95);
    for (let k = 0; k < 14; k++) {
      const x = sx + (r() - 0.5) * 30, z = sz + (r() - 0.5) * 30;
      if (Math.hypot(x - sx, z - sz) > 20) continue;
      ctx.batch.add(B.G.box, M.adobeWhite, { x, y: ground(x, z) + 0.25, z, ry: r() * 3, sx: 1.2, sy: 0.5, sz: 0.6 });
    }
    v.addNPC({ id: 'mao-mirah', name: 'Mirah Oubel', title: 'Salineira',
      look: { shirt: 0xe0d6c0, pants: 0x6a5a40, hat: 'wrap', height: 1.66 }, x: sx + 3, z: sz - 3, facing: 2,
      onInteract: say('Mirah Oubel', 'Salinas', '"Cada placa de sal vale um dia de dívida. Eu conto as placas. Um dia vou contar o que eles devem."') });
  }

  // Ruas: alguns pontos ao longo das Colunas e da avenida dos portões.
  for (let i = 1; i < G.cols; i += 2) {
    const x = x0 + G.colStreet / 2 + i * (block + G.colStreet);
    for (const f of [0.25, 0.75]) v.npcSpots.push({ x, z: z0 + D * f, r: 2 });
  }
  for (const f of [0.15, 0.85]) v.npcSpots.push({ x: x0 + W * f, z: gateZ, r: 3 });
  v.addWanderers(28, { shirt: 0xb8a078, hat: 'wrap' });
  v.gate = null;
  v.finalize();
  return v;
}

/** Muro reto de adobe (tijolo de barro), com ameias e colisão. */
function adobeWall(ctx, { ax, az, bx, bz, h = 6, t = 1.8 }) {
  const { M } = ctx;
  const len = Math.hypot(bx - ax, bz - az);
  if (len < 0.5) return;
  const n = Math.max(1, Math.round(len / 12));
  const ry = Math.atan2(bx - ax, bz - az);
  for (let k = 0; k < n; k++) {
    const t0 = k / n, t1 = (k + 1) / n;
    const x = ax + (bx - ax) * (t0 + t1) / 2, z = az + (bz - az) * (t0 + t1) / 2;
    const y0 = ctx.terrain.heightAt(x, z) - 0.6;
    const seg = len / n + 0.1;
    ctx.batch.add(B.G.box, M.mudBrick, { x, y: y0 + h / 2, z, ry, sx: t, sy: h, sz: seg });
    for (let m = 0; m < 4; m++) {
      const f = t0 + (t1 - t0) * (m + 0.5) / 4;
      ctx.batch.add(B.G.box, M.mudBrick, { x: ax + (bx - ax) * f, y: y0 + h + 0.5, z: az + (bz - az) * f, ry, sx: t * 0.8, sy: 1, sz: seg / 8 });
    }
  }
  ctx.collisions.addWall(ax, az, bx, bz, t, 'wall');
}

/** Torre de canto (14 m) com o disco de bronze que sinaliza com o sol. */
function mirrorTower(ctx, { x, z }) {
  const { M } = ctx;
  const y0 = ctx.terrain.heightAt(x, z) - 0.5;
  ctx.batch.add(B.G.box, M.mudBrickDark, { x, y: y0 + 7, z, sx: 5, sy: 14, sz: 5 });
  ctx.batch.add(B.G.box, M.mudBrick, { x, y: y0 + 14.4, z, sx: 5.6, sy: 0.8, sz: 5.6 });
  ctx.batch.add(B.G.cyl, M.brass, { x, y: y0 + 16, z, rx: Math.PI / 2, ry: Math.PI / 4, sx: 1.1, sy: 0.08, sz: 1.1 });
  ctx.collisions.addBox(x, z, 2.6, 2.6, 0, 'tower');
}

/** Torre de vento (badgir) sobre o telhado: prisma com aberturas no topo. */
function windTower(ctx, { x, z, y }) {
  const { M } = ctx;
  ctx.batch.add(B.G.box, M.adobeWhite, { x, y: y + 2, z, sx: 1.6, sy: 4, sz: 1.6 });
  for (const [ox, oz] of [[0.81, 0], [-0.81, 0], [0, 0.81], [0, -0.81]]) {
    ctx.batch.add(B.G.box, M.darkOpening, { x: x + ox, y: y + 3.3, z: z + oz, sx: Math.abs(oz) > 0 ? 0.9 : 0.04, sy: 1.1, sz: Math.abs(ox) > 0 ? 0.9 : 0.04 });
  }
}
