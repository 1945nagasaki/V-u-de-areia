import { Village } from './Village.js';
import * as B from './Builders.js';
import * as X from './BuildersExtra.js';
import { VILLAGES } from '../config/villages.js';
import { Mechanics } from '../systems/Mechanics.js';

/**
 * MESA-FARTA — cidade de Vraatsug, o Primeiro Anfitrião, na savana.
 * Design: design/narrative/mesa-farta.md (Partes IV–VI e XV).
 *
 * Concêntrica em torno da comida: no centro, a GRANDE MESA (sete círculos de
 * bancos de pedra, o lugar de cada um mostra o seu status) e a Casa do
 * Primeiro Anfitrião; ao norte, o Celeiro-Mor dentro do Muro dos Celeiros,
 * cercado pelo Cinto Seco (o capim morre em volta da Capa). Os moradores
 * vivem em PRATOS: anéis de casas redondas em volta da casa de um Anfitrião.
 * Mercado dos Sacos (sudeste), Rua dos Pilões (sul), Janela das Sobras no
 * Portão do Mingau, Casa dos Ancestrais (nordeste, figuras-relicário de latão),
 * Guarda da Mesa e Grande Tanque (leste), Salão Vazio (ruína, oeste); cerca de
 * espinho com três portões e campos de sorgo fora dela.
 */
export function buildMesaFarta(game) {
  const cfg = VILLAGES.mesaFarta;
  const v = new Village(game, cfg, 6060);
  const { ctx } = v;
  const { M } = ctx;
  const cx = v.x, cz = v.z;
  const r = v.rnd;
  const ground = (x, z) => ctx.terrain.heightAt(x, z);
  const say = (speaker, title, text) => (g) => Mechanics.talk(g, { speaker, title, text });
  const P = (dx, dz) => ({ x: cx + dx, z: cz + dz });
  const faceTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  const R = cfg.radius;

  v.paintDisc(cx, cz, R - 4, 0xa88a5a, 0.35);

  // ------------------------------------------------ A Grande Mesa (sete círculos)
  v.reserve(cx, cz, 46);
  v.paintDisc(cx, cz, 44, 0x8a6a44, 0.75);
  for (let ring = 0; ring < 7; ring++) {
    const rr = 8 + ring * 5.6, n = Math.round((2 * Math.PI * rr) / 2.4);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.16) continue; // corredor sul
      if (Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) < 0.16) continue; // corredor norte
      const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      ctx.batch.add(B.G.box, ring < 2 ? M.stoneLight : M.stone, { x, y: ground(x, z) + 0.25, z, ry: -a, sx: 0.7, sy: 0.5, sz: 2.1 });
    }
  }
  // Mesa central: o estrado do Primeiro Anfitrião com cestos e potes.
  B.part(ctx, B.G.cyl, M.woodDark, cx, cz, 0, ground(cx, cz), { ly: 0.45, w: 3.4, h: 0.9, d: 3.4 });
  for (let k = 0; k < 8; k++) { const a = k * 0.785; B.part(ctx, B.G.sphere, k % 2 ? M.basket : M.terracotta ?? M.adobeRed, cx + Math.cos(a) * 2.3, cz + Math.sin(a) * 2.3, 0, ground(cx, cz) + 0.9, { ly: 0.2, w: 0.35, h: 0.3, d: 0.35 }); }
  ctx.collisions.addCircle(cx, cz, 3.5, 'table');
  v.npcSpots.push({ x: cx + 14, z: cz + 6, r: 6 }, { x: cx - 14, z: cz - 6, r: 6 }, { x: cx + 22, z: cz + 22, r: 6 });
  v.addNPC({ id: 'mesa-vraatsug', name: 'Vraatsug', title: 'O Primeiro Anfitrião (Mesa-Farta)',
    look: { robe: true, shirt: 0xc8862a, hat: 'wrap', accessory: 'staff', build: 1.35, height: 1.86 }, x: cx, z: cz + 5, facing: 0,
    onInteract: say('Vraatsug', 'A Grande Mesa', '"Sente-se no círculo que lhe cabe. Eu já tive fome. Akin também tinha celeiros cheios, e fechados."') });
  v.addNPC({ id: 'mesa-wale', name: 'Wale Ndiko', title: 'Contador de Mesa', look: { robe: true, shirt: 0x6a5a3a, hat: 'wrap' },
    x: cx + 6, z: cz + 9, facing: 2.6,
    onInteract: say('Wale Ndiko', 'Contador de Mesa', '"Conto quem senta onde. Subir um círculo vale mais que um saco de ouro. Cair um, pior que fome."') });
  {
    const h = P(0, -54);
    B.house(ctx, { x: h.x, z: h.z, rot: 0, w: 22, d: 12, h: 5, wall: M.adobeOchre, roof: 'thatch' });
    for (let i = 0; i < 6; i++) { const c = B.local(h.x, h.z, 0, -9 + i * 3.6, 8); B.part(ctx, B.G.cyl, M.woodDark, c.x, c.z, 0, ground(c.x, c.z), { ly: 2.4, w: 0.25, h: 4.8, d: 0.25 }); ctx.collisions.addCircle(c.x, c.z, 0.3, 'post'); }
    v.reserve(h.x, h.z, 13);
  }

  // ------------------------------------------------ Celeiro-Mor, Muro dos Celeiros e o Cinto Seco
  const cel = P(0, -112);
  v.paintDisc(cel.x, cel.z, 52, 0xb8a070, 0.9); // o Cinto Seco: capim morto
  v.reserve(cel.x, cel.z, 36);
  {
    const y0 = ground(cel.x, cel.z) - 0.3;
    B.part(ctx, B.G.cyl, M.mudBrick, cel.x, cel.z, 0, y0, { ly: 5, w: 13, h: 10, d: 13 });
    B.part(ctx, B.G.cone, M.thatch, cel.x, cel.z, 0, y0, { ly: 14, w: 15, h: 8, d: 15 });
    B.part(ctx, B.G.box, M.woodDark, cel.x, cel.z, 0, y0, { lz: 13.05, ly: 1.6, w: 2.4, h: 3.2, d: 0.2 });
    B.part(ctx, B.G.box, M.brass, cel.x, cel.z, 0, y0, { lz: 13.2, ly: 1.6, w: 0.5, h: 0.5, d: 0.08 }); // a fechadura da Chave-Mestra
    ctx.collisions.addCircle(cel.x, cel.z, 13.4, 'granary');
    for (let k = 0; k < 6; k++) { // Celeiros Grandes em volta
      const a = -Math.PI / 2 + (k - 2.5) * 0.42, x = cel.x + Math.cos(a) * 26, z = cel.z + Math.sin(a) * 26 + 10;
      granary(ctx, { x, z, r: 3.2 });
    }
    // Muro dos Celeiros: arco ao sul com o portão do Celeiro.
    for (let k = 0; k < 18; k++) {
      const a = Math.PI / 2 - 1.2 + k * (2.4 / 17);
      if (Math.abs(a - Math.PI / 2) < 0.12) continue;
      const x = cel.x + Math.cos(a) * 34, z = cel.z + Math.sin(a) * 34;
      ctx.batch.add(B.G.box, M.mudBrick, { x, y: ground(x, z) + 1.6, z, ry: -a, sx: 1, sy: 3.2, sz: 5.6 });
      ctx.collisions.addBox(x, z, 0.5, 2.8, -a, 'wall');
    }
    game.interactions.register({
      id: 'mesa-celeiro', label: 'Olhar o capim morto', radius: 5, position: { x: cel.x + 8, y: ground(cel.x + 8, cel.z + 22) + 1, z: cel.z + 22 },
      onInteract: say('O Cinto Seco', 'Celeiro-Mor', 'O grão sob a Capa não estraga. Em volta, o capim seca um pouco mais a cada ano.'),
    });
    v.addNPC({ id: 'mesa-thiago', name: 'Thiago', title: 'A Chave-Mestra do Celeiro-Mor',
      look: { shirt: 0x8a5a2a, pants: 0x3a2a1c, hat: 'wrap', height: 1.78 }, x: cel.x + 4, z: cel.z + 38, facing: Math.PI,
      onInteract: say('Thiago', 'Chave-Mestra', '"Eu abro o Celeiro-Mor. Só eu e o Anfitrião sabemos para onde vai o grão que sai à noite."') });
  }

  // ------------------------------------------------ Os Pratos: anéis de casas em volta de um Anfitrião
  const pratos = [];
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + 0.2, d = 102 + (k % 2) * 18;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (Math.hypot(x - cel.x, z - cel.z) < 60) continue; // Cinto Seco e celeiros
    if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.25) continue; // Portão do Mingau
    pratos.push({ x, z });
  }
  for (const [i, pr] of pratos.entries()) {
    B.house(ctx, { x: pr.x, z: pr.z, rot: faceTo(pr.x, pr.z, cx, cz), w: 8, d: 6, h: 3.4, wall: M.adobeOchre, roof: 'thatch' }); // casa do Anfitrião
    v.reserve(pr.x, pr.z, 6);
    const n = 6 + (i % 3);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + i, x = pr.x + Math.cos(a) * 14, z = pr.z + Math.sin(a) * 14;
      if (!v.isFree(x, z, 3.2) || Math.hypot(x - cx, z - cz) > R - 8) continue;
      B.rondavel(ctx, { x, z, r: 2.7, h: 2.4, wall: r() < 0.5 ? M.adobeOchre : M.mudBrick, rot: faceTo(x, z, pr.x, pr.z) });
      v.reserve(x, z, 3.4);
    }
    v.npcSpots.push({ x: pr.x + 6, z: pr.z + 6, r: 4 });
  }
  if (pratos[0]) v.addNPC({ id: 'mesa-nkeru', name: 'Nkeru Sabu', title: 'Matriarca de Prato', look: { robe: true, shirt: 0x9a4a2a, hat: 'wrap', height: 1.62 },
    x: pratos[0].x + 5, z: pratos[0].z + 5, facing: 0,
    onInteract: say('Nkeru Sabu', 'Os Pratos', '"No meu Prato ninguém come antes das crianças. O Primeiro Anfitrião esqueceu que a regra também é dele."') });

  // ------------------------------------------------ Mercado dos Sacos (sudeste) e a Casa de Câmbio
  {
    const m = P(62, 58);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, x = m.x + Math.cos(a) * 12, z = m.z + Math.sin(a) * 12;
      B.marketStall(ctx, { x, z, rot: faceTo(x, z, m.x, m.z) });
      if (k % 2) X.spiceSacks(ctx, { ...B.local(x, z, faceTo(x, z, m.x, m.z), 2.3, 0.6), rot: a, n: 5 });
      v.reserve(x, z, 2.5);
    }
    v.npcSpots.push({ x: m.x, z: m.z, r: 7 });
    const c = P(84, 74);
    B.house(ctx, { x: c.x, z: c.z, rot: faceTo(c.x, c.z, m.x, m.z), w: 8, d: 6, h: 3.4, wall: M.adobeWhite, roof: 'flat' });
    v.reserve(c.x, c.z, 6);
    const d = B.local(c.x, c.z, faceTo(c.x, c.z, m.x, m.z), 0, 5);
    v.addNPC({ id: 'mesa-imara', name: 'Imara Toss', title: 'Cambista da Organização', look: { shirt: 0x2a2420, pants: 0x1c1814, hat: 'wrap' },
      x: d.x, z: d.z, facing: faceTo(d.x, d.z, m.x, m.z),
      onInteract: say('Imara Toss', 'Casa de Câmbio', '"Grão a prazo, sal à vista, juros de areia. O seu Anfitrião já deve aqui, sabia? Todo mundo deve."') });
  }

  // ------------------------------------------------ Rua dos Pilões (sul) e a Janela das Sobras
  for (let k = 0; k < 10; k++) {
    const x = cx - 46 + k * 9 + (k >= 5 ? 14 : 0), z = cz + 88 + (k % 2) * 5;
    if (!v.isFree(x, z, 1.5)) continue;
    B.part(ctx, B.G.cyl, M.woodDark, x, z, 0, ground(x, z), { ly: 0.4, w: 0.35, h: 0.8, d: 0.35 }); // pilão
    B.part(ctx, B.G.cyl, M.woodLight, x, z, 0, ground(x, z), { ly: 1.2, lx: 0.1, w: 0.05, h: 1.6, d: 0.05, rz: 0.15 }); // mão do pilão
    ctx.collisions.addCircle(x, z, 0.5, 'post');
    v.reserve(x, z, 1.5);
  }
  {
    const j = P(-8, 136);
    B.house(ctx, { x: j.x, z: j.z, rot: Math.PI / 2, w: 9, d: 6, h: 3.2, wall: M.adobeOchre, roof: 'thatch' });
    v.reserve(j.x, j.z, 6.5);
    for (let k = 0; k < 6; k++) v.npcSpots.push({ x: j.x + 8, z: j.z - 6 + k * 2.2, r: 0.6 }); // a fila
    v.addNPC({ id: 'mesa-adjoa', name: 'Mãe Adjoa Fulu', title: 'Janela das Sobras', look: { robe: true, shirt: 0xb8862a, hat: 'wrap', height: 1.6 },
      x: j.x + 5, z: j.z + 1, facing: Math.PI / 2,
      onInteract: say('Mãe Adjoa Fulu', 'Janela das Sobras', '"Aqui ninguém pergunta o seu nome. Só se você comeu hoje. A fila anda devagar, mas anda."') });
    v.addNPC({ id: 'mesa-kesi', name: 'Kesi', title: 'A menina Sem-Nome', look: { shirt: 0x6a5a4a, height: 1.2 },
      x: j.x + 9, z: j.z + 5, facing: Math.PI,
      onInteract: say('Kesi', 'Sem-Nome', '"Não tenho Prato, então não tenho nome. A Mãe Adjoa disse que vai me dar um, quando sobrar."') });
  }

  // ------------------------------------------------ Casa dos Ancestrais (nordeste): figuras-relicário
  {
    const a = P(74, -52), rot = faceTo(a.x, a.z, cx, cz);
    B.house(ctx, { x: a.x, z: a.z, rot, w: 14, d: 9, h: 4, wall: M.adobeRed, roof: 'thatch' });
    for (let k = 0; k < 7; k++) {
      const q = B.local(a.x, a.z, rot, -6 + k * 2, 7.5), y = ground(q.x, q.z);
      B.part(ctx, B.G.cyl, M.basket, q.x, q.z, rot, y, { ly: 0.35, w: 0.45, h: 0.7, d: 0.45 }); // cesto
      B.part(ctx, B.G.cyl, M.woodDark, q.x, q.z, rot, y, { ly: 1.05, w: 0.06, h: 0.7, d: 0.06 });
      B.part(ctx, B.G.sphere, M.brass, q.x, q.z, rot, y, { ly: 1.7, w: 0.32, h: 0.46, d: 0.05 }); // rosto oval de latão
      ctx.collisions.addCircle(q.x, q.z, 0.5, 'post');
    }
    v.reserve(a.x, a.z, 10);
    const d = B.local(a.x, a.z, rot, 4, 9.5);
    v.addNPC({ id: 'mesa-ombe', name: 'Ombe Kaio', title: 'Polidor-Chefe', look: { robe: true, shirt: 0x3a2a1c, hat: 'wrap' }, x: d.x, z: d.z, facing: rot,
      onInteract: say('Ombe Kaio', 'Casa dos Ancestrais', '"Polir o latão é lembrar. Cada rosto guarda um cesto; cada cesto, alguém que já sentou à Mesa."') });
  }

  // ------------------------------------------------ Guarda da Mesa e Grande Tanque (leste)
  {
    const g = P(112, -8);
    B.house(ctx, { x: g.x, z: g.z, rot: -Math.PI / 2, w: 16, d: 10, h: 4, wall: M.mudBrick, roof: 'thatch' });
    v.reserve(g.x, g.z, 10);
    v.addNPC({ id: 'mesa-dabo', name: 'Capitão Dabo Liro', title: 'Guarda da Mesa', look: { shirt: 0x7a4a1a, pants: 0x3a2a1c, hat: 'wrap', accessory: 'spear', build: 1.2 },
      x: g.x - 10, z: g.z, facing: -Math.PI / 2,
      onInteract: say('Dabo Liro', 'Guarda da Mesa', '"Os Hoogmoed estão em Abstração, a meia hora daqui. Comem o nosso grão e afiam as lanças."') });
    const t = cfg.tank, tx = cx + t.dx, tz = cz + t.dz;
    ctx.batch.add(B.G.box, M.waterOasis, { x: tx, y: ground(tx + t.hw + 4, tz) - t.waterBelow, z: tz, sx: t.hw * 2 + 2, sy: 0.05, sz: t.hd * 2 + 2 });
    v.npcSpots.push({ x: tx - t.hw - 4, z: tz, r: 3 });
  }

  // ------------------------------------------------ Salão Vazio (ruína do celeiro imperial, oeste)
  for (let k = 0; k < 3; k++) {
    const x = cx - 112, z = cz - 30 + k * 12;
    B.ruinedHouse(ctx, { x, z, rot: Math.PI / 2, w: 11, d: 7, h: 3.4, seed: 900 + k });
    v.reserve(x, z, 7);
  }

  // ------------------------------------------------ Cerca de espinho, portões, campos e baobás
  const gates = [Math.PI / 2, Math.PI, 0]; // Mingau (sul), Gado (oeste), Manada (leste)
  B.stakeFence(ctx, { x: cx, z: cz, r: R - 3, gates, gateWidth: 9 });
  for (const g of gates) v.street(cx + Math.cos(g) * 46, cz + Math.sin(g) * 46, cx + Math.cos(g) * (R + 40), cz + Math.sin(g) * (R + 40), 5, 0x8a6a44);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.4, x = cx + Math.cos(a) * (R + 45), z = cz + Math.sin(a) * (R + 45);
    if (gates.some((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.3)) continue;
    B.field(ctx, { x, z, rot: -a, w: 34, d: 22, crop: 'maize' });
    if (k === 1) v.addNPC({ id: 'mesa-tano', name: 'Velho Tano', title: 'Espantador de Manada', look: { shirt: 0x8a7a5a, hat: 'wrap', accessory: 'staff' }, x: x + 4, z: z + 4, facing: a,
      onInteract: say('Velho Tano', 'Campos de sorgo', '"Os elefantes sabem o caminho do sorgo melhor que os Anfitriões. Eu só lembro a eles de quem é."') });
  }
  for (let k = 0; k < 10; k++) {
    const a = r() * Math.PI * 2, d = 50 + r() * 100;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (v.isFree(x, z, 4) && Math.hypot(x - cel.x, z - cel.z) > 55) { v.plants.push({ type: 'baobab', x, z, s: 0.9 + r() * 0.4, ry: r() * 6 }); v.reserve(x, z, 4); }
  }

  v.addElder(cx + 8, cz + R - 2, Math.PI);
  v.addWanderers(24, { shirt: 0xc8862a, hat: 'wrap' });
  v.finalize();
  return v;
}

/** Celeiro de barro sobre pés de pedra, com chapéu de palha. */
function granary(ctx, { x, z, r = 3 }) {
  const { M } = ctx;
  const y0 = ctx.terrain.heightAt(x, z);
  for (let k = 0; k < 4; k++) B.part(ctx, B.G.cyl6, M.stone, x, z, 0, y0, { lx: Math.cos(k * 1.57 + 0.78) * r * 0.6, lz: Math.sin(k * 1.57 + 0.78) * r * 0.6, ly: 0.4, w: 0.3, h: 0.8, d: 0.3 });
  B.part(ctx, B.G.cyl, M.mudBrick, x, z, 0, y0, { ly: 0.8 + 1.8, w: r, h: 3.6, d: r });
  B.part(ctx, B.G.cone, M.thatch, x, z, 0, y0, { ly: 0.8 + 3.6 + 1.3, w: r + 0.6, h: 2.6, d: r + 0.6 });
  ctx.collisions.addCircle(x, z, r + 0.2, 'granary');
}
