import { Village } from './Village.js';
import * as B from './Builders.js';
import * as X from './BuildersExtra.js';
import { VILLAGES } from '../config/villages.js';
import { Mechanics } from '../systems/Mechanics.js';
import { terraceLevelAt, levelHeight } from '../world/Terraces.js';

/**
 * PAÇO DAS FACES — cidade do Véu-Carmesim, no Jardim Pálido (Floresta Preta).
 * Design: design/narrative/veu-carmesim.md (Partes IV–VI e XV).
 *
 * Uma bacia de árvores-osso (brancas) com a cidade num platô de 6 m. A borda
 * do platô é o MURO DAS FACES: um muro de arrimo caiado com centenas de
 * cabeças de terracota e de cobre esverdeado olhando para fora, na altura do
 * olhar de quem chega pela bacia — e nichos vazios, dos traidores. O Caminho
 * Branco sobe do sul pelo Portão das Faces (sete nichos, um vazio) até a
 * Praça do Véu (espelho d'água leitosa), a Casa do Pai e, num terraço ao
 * norte, o Santuário da Última Face e a Torre do Ouvido. Na bacia: a Boca do
 * Leite (leste, tanques de decantação), a Boca Funda (oeste, até o mar, com o
 * Bairro dos Arrancados) e a Boca Seca (norte, com sete sulcos).
 */
export function buildVeuCarmesim(game) {
  const cfg = VILLAGES.veuCarmesim;
  const v = new Village(game, cfg, 5555);
  const { ctx } = v;
  const { M } = ctx;
  const cx = v.x, cz = v.z;
  const r = v.rnd;
  const zone = game.terraceZones.veuCarmesim;
  const L = zone.levels;
  const hw = zone.stair.width / 2;
  const H = (i) => levelHeight(zone, i);
  const ground = (x, z) => ctx.terrain.heightAt(x, z);
  const say = (speaker, title, text) => (g) => Mechanics.talk(g, { speaker, title, text });
  const P = (dx, dz) => ({ x: cx + dx, z: cz + dz });
  const faceTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
  const plat = L[1], top = L[2];

  // Chão de caulim (branco) na bacia e no platô.
  v.paintDisc(cx, cz, L[0].r, 0xd8d4c8, 0.45);
  v.paintDisc(plat.cx, plat.cz, plat.r - 2, 0xe6e2d8, 0.6);

  // ------------------------------------------------ Muro das Faces (borda do platô)
  {
    const yLo = H(0) - 1, yHi = H(1) + 3.2;
    const segs = Math.round((2 * Math.PI * plat.r) / 6);
    for (let k = 0; k < segs; k++) {
      const a0 = (k / segs) * Math.PI * 2, a1 = ((k + 1) / segs) * Math.PI * 2, am = (a0 + a1) / 2;
      const mx = plat.cx + Math.cos(am) * (plat.r - 0.6), mz = plat.cz + Math.sin(am) * (plat.r - 0.6);
      if (Math.abs(mx - zone.x) < hw + 1.5 && mz > plat.cz) continue; // Portão das Faces
      const len = 2 * plat.r * Math.sin(Math.PI / segs) + 0.15;
      const rot = -am;
      ctx.batch.add(B.G.box, M.adobeWhite, { x: mx, y: (yLo + yHi) / 2, z: mz, ry: rot, sx: 1.4, sy: yHi - yLo, sz: len });
      ctx.collisions.addBox(mx, mz, 0.8, len / 2, rot, 'wall');
      // Duas fileiras de cabeças na face externa (para quem chega pela bacia).
      const ox = Math.cos(am), oz = Math.sin(am);
      for (let row = 0; row < 2; row++) {
        for (let m = 0; m < 5; m++) {
          const t = (m + 0.5) / 5 - 0.5;
          const hx = mx + ox * 0.78 - oz * t * len, hz = mz + oz * 0.78 + ox * t * len;
          const y = H(0) + 1.55 + row * 1.25;
          const roll = r();
          if (roll < 0.06) { // nicho vazio (traidor arrancado), marcado com cal vermelha
            ctx.batch.add(B.G.box, M.clothRed, { x: hx, y, z: hz, ry: rot, sx: 0.05, sy: 0.55, sz: 0.4 });
            continue;
          }
          head(ctx, { x: hx, y, z: hz, rot: Math.atan2(ox, oz), mat: roll < 0.55 ? M.terracotta : M.copperPatina });
        }
      }
    }
    // Portão das Faces: arco com sete nichos (seis cabeças e o lugar vazio de Akin).
    const gz = plat.cz + plat.r - 0.6;
    for (const s of [-1, 1]) {
      const x = zone.x + s * (hw + 1.4);
      ctx.batch.add(B.G.box, M.adobeWhite, { x, y: (yLo + yHi + 3) / 2, z: gz, sx: 2.4, sy: yHi + 3 - yLo, sz: 2.4 });
      ctx.collisions.addCircle(x, gz, 1.5, 'gate');
    }
    ctx.batch.add(B.G.box, M.adobeWhite, { x: zone.x, y: yHi + 2.4, z: gz, sx: zone.stair.width + 5, sy: 1.6, sz: 2.4 });
    for (let k = 0; k < 7; k++) {
      const x = zone.x - 4.5 + k * 1.5, y = yHi + 2.4;
      if (k === 3) { ctx.batch.add(B.G.box, M.darkOpening, { x, y, z: gz + 1.22, sx: 0.6, sy: 0.8, sz: 0.05 }); continue; }
      head(ctx, { x, y: y - 0.1, z: gz + 1.25, rot: 0, mat: M.copperPatina });
    }
    game.interactions.register({
      id: 'veu-portao-faces', label: 'Olhar o nicho vazio', radius: 4, position: { x: zone.x, y: H(0) + 2, z: gz + 4 },
      onInteract: say('Portão das Faces', 'Sete nichos', 'Seis rostos de cobre e um nicho vazio no meio: "o lugar de Akin, até que volte inteiro".'),
    });
  }

  // ------------------------------------------------ Praça do Véu e Casa do Pai
  const pz = P(0, 4);
  B.plaza(ctx, { x: pz.x, z: pz.z, r: 20, mat: M.stoneLight });
  ctx.batch.add(B.G.disc, M.waterMilk, { x: pz.x, y: ground(pz.x, pz.z) + 0.12, z: pz.z, sx: 6, sy: 1, sz: 6 });
  ctx.batch.add(B.G.torus, M.stoneLight, { x: pz.x, y: ground(pz.x, pz.z) + 0.15, z: pz.z, rx: Math.PI / 2, sx: 6.2, sy: 6.2, sz: 1.6 });
  ctx.collisions.addCircle(pz.x, pz.z, 6.3, 'pond');
  v.reserve(pz.x, pz.z, 21);
  v.npcSpots.push({ x: pz.x - 12, z: pz.z + 6, r: 6 }, { x: pz.x + 12, z: pz.z - 4, r: 6 });
  {
    const c = P(30, -22);
    B.house(ctx, { x: c.x, z: c.z, rot: faceTo(c.x, c.z, pz.x, pz.z), w: 26, d: 16, h: 6.5, wall: M.adobeWhite, roof: 'tile', roofMat: M.stoneLight });
    v.reserve(c.x, c.z, 16);
    const door = B.local(c.x, c.z, faceTo(c.x, c.z, pz.x, pz.z), 0, 10);
    v.addNPC({ id: 'veu-pai', name: 'O Pai do Véu', title: 'Onkuisheid (Véu-Carmesim)',
      look: { robe: true, shirt: 0xe8e0d0, hat: 'wrap', accessory: 'staff', height: 1.82 }, x: door.x, z: door.z, facing: faceTo(door.x, door.z, pz.x, pz.z),
      onInteract: say('O Pai do Véu', 'Casa do Pai', '"Sente-se, filho. Aqui ninguém fica no chão sozinho. Diga o que perdeu, e eu digo o que ainda podemos ter."') });
    v.addNPC({ id: 'veu-ayowe', name: 'Ayowe Ilanji', title: 'A Primeira Velada',
      look: { robe: true, shirt: 0x9a1a22, hat: 'wrap', height: 1.7 }, x: door.x + 3, z: door.z + 1, facing: -2.2,
      onInteract: say('Ayowe Ilanji', 'Casas de Perfume', '"O desejo mantém a espera viva. E a espera mantém a cidade de pé. Quer provar o perfume?"') });
  }
  // Escola dos Retratos (oeste da Praça), com o Mestre dos Moldes.
  {
    const e = P(-30, -22);
    B.house(ctx, { x: e.x, z: e.z, rot: faceTo(e.x, e.z, pz.x, pz.z), w: 22, d: 12, h: 5, wall: M.adobeWhite, roof: 'tile', roofMat: M.terracotta });
    v.reserve(e.x, e.z, 14);
    for (let k = 0; k < 6; k++) head(ctx, { ...B.local(e.x, e.z, faceTo(e.x, e.z, pz.x, pz.z), -6 + k * 2.4, 7.4), y: ground(e.x, e.z) + 1.1, rot: faceTo(e.x, e.z, pz.x, pz.z), mat: M.terracotta });
    const d = B.local(e.x, e.z, faceTo(e.x, e.z, pz.x, pz.z), 0, 9);
    v.addNPC({ id: 'veu-okaro', name: 'Okaro Benne', title: 'O Mestre dos Moldes', look: { robe: true, shirt: 0x8a6a4a, hat: 'wrap', height: 1.66 },
      x: d.x, z: d.z, facing: faceTo(d.x, d.z, pz.x, pz.z),
      onInteract: say('Okaro Benne', 'Escola dos Retratos', '"Guardo o molde de cada rosto do muro. Quando um molde racha sozinho, alguém morreu longe daqui."') });
  }

  // ------------------------------------------------ Terraço das Preces: Santuário e Torre do Ouvido
  {
    const s = { x: top.cx, z: top.cz - 6 }, y0 = H(2) - 0.2;
    B.part(ctx, B.G.box, M.adobeWhite, s.x, s.z, 0, y0, { ly: 4, w: 20, h: 8, d: 14 });
    B.part(ctx, B.G.box, M.stoneLight, s.x, s.z, 0, y0, { ly: 8.2, w: 21, h: 0.5, d: 15 });
    B.part(ctx, B.G.sphere, M.whitePaint, s.x, s.z, 0, y0, { ly: 8.4, w: 5, h: 3, d: 5 });
    B.part(ctx, B.G.box, M.woodDark, s.x, s.z, 0, y0, { lz: 7.05, ly: 2, w: 2, h: 4, d: 0.2 }); // a única porta alta (4 m)
    B.part(ctx, B.G.box, M.woodDark, s.x, s.z, 0, y0, { lz: 7.1, ly: 2, w: 2.6, h: 4.4, d: 0.1 });
    head(ctx, { x: s.x, y: y0 + 5.2, z: s.z + 7.15, rot: 0, mat: M.whitePaint }); // cabeça sem traços
    ctx.collisions.addBox(s.x, s.z, 10, 7, 0, 'house');
    v.presences.push({ x: s.x, z: s.z, reach: 6, name: 'O Sussurro' });
    game.interactions.register({
      id: 'veu-santuario', label: 'Dizer o seu nome diante da porta', radius: 3.5, position: { x: s.x, y: y0 + 1.6, z: s.z + 9 },
      onInteract: say('Santuário da Última Face', 'O Sussurro',
        'Uma voz grave e serena repete o seu nome, na sua língua. Nenhuma das Mãos Brancas parece ter ouvido.'),
    });
    v.addNPC({ id: 'veu-asebi', name: 'Asebi Moro', title: 'Capitã das Mãos Brancas', look: { robe: true, shirt: 0xf0ece4, hat: 'wrap', accessory: 'spear', height: 1.78 },
      x: s.x + 4, z: s.z + 10, facing: 0,
      onInteract: say('Asebi Moro', 'Mãos Brancas', '"A minha lealdade é ao Crânio. Se o Pai falhar, o Crânio escolhe outro. Não diga que eu disse."') });
    const t = { x: top.cx + 16, z: top.cz + 6 }, ty = H(2) - 0.3;
    B.part(ctx, B.G.cyl, M.adobeWhite, t.x, t.z, 0, ty, { ly: 9, w: 3, h: 18, d: 3 });
    for (let k = 0; k < 6; k++) B.part(ctx, B.G.box, M.stoneLight, t.x, t.z, 0, ty, { lx: Math.cos(k) * 3.1, lz: Math.sin(k) * 3.1, ly: 18.6, w: 0.4, h: 1.6, d: 0.4 });
    B.part(ctx, B.G.cyl, M.adobeWhite, t.x, t.z, 0, ty, { ly: 19.6, w: 3.4, h: 0.4, d: 3.4 });
    for (let k = 0; k < 7; k++) B.part(ctx, B.G.cone8, M.brass, t.x, t.z, 0, ty, { lx: Math.cos(k * 0.9) * 1.6, lz: Math.sin(k * 0.9) * 1.6, ly: 18.6, w: 0.35, h: 0.6, d: 0.35 });
    ctx.collisions.addCircle(t.x, t.z, 3.2, 'tower');
    v.addNPC({ id: 'veu-nnaru', name: 'Nnaru', title: 'O Leitor de Latido', look: { shirt: 0xe0dcd0, pants: 0x8a8070, hat: 'wrap', height: 1.7 },
      x: t.x - 4, z: t.z + 2, facing: Math.PI,
      onInteract: say('Nnaru', 'Torre do Ouvido', '"O sétimo sino não tem badalo. Os velhos dizem que ele toca sozinho quando o corpo estiver inteiro."') });
  }

  // ------------------------------------------------ Feira da Névoa (sul da Praça)
  for (let k = 0; k < 8; k++) {
    const side = k % 2 ? 1 : -1, row = Math.floor(k / 2);
    const x = cx + side * (hw + 6), z = cz + 34 + row * 8;
    B.marketStall(ctx, { x, z, rot: side > 0 ? -Math.PI / 2 : Math.PI / 2 });
    v.reserve(x, z, 2.5);
  }
  X.awning(ctx, { ax: cx - hw - 3, az: cz + 30, bx: cx - hw - 3, bz: cz + 60, y: 3.8, width: 3, cloth: M.clothRed });
  X.awning(ctx, { ax: cx + hw + 3, az: cz + 30, bx: cx + hw + 3, bz: cz + 60, y: 3.8, width: 3, cloth: M.clothRed });
  v.npcSpots.push({ x: cx, z: cz + 46, r: 5 });
  v.addNPC({ id: 'veu-massu', name: 'Massu Rendi', title: 'Cambista da Organização', look: { shirt: 0x2a2420, pants: 0x1c1814, hat: 'wrap' },
    x: cx + hw + 9, z: cz + 50, facing: -Math.PI / 2,
    onInteract: say('Massu Rendi', 'Feira da Névoa', '"Vim cobrar o metal do Paço. Agora uma voz diz o meu nome à noite. Não sei mais para quem eu trabalho."') });

  // ------------------------------------------------ Fundição, Quartel e Taverna
  {
    const f = P(62, 56);
    B.house(ctx, { x: f.x, z: f.z, rot: faceTo(f.x, f.z, cx, f.z), w: 16, d: 10, h: 4, wall: M.adobeWhite, roof: 'tin' });
    for (let k = 0; k < 3; k++) { const d = B.local(f.x, f.z, faceTo(f.x, f.z, cx, f.z), -5 + k * 5, 8.5); B.part(ctx, B.G.sphere, M.terracotta, d.x, d.z, 0, ground(d.x, d.z), { ly: 0.4, w: 1.4, h: 1.6, d: 1.4 }); ctx.collisions.addCircle(d.x, d.z, 1.4, 'furnace'); }
    v.reserve(f.x, f.z, 12);
    v.addNPC({ id: 'veu-sisi', name: 'Sisi Lunara', title: 'Mestra da Fundição', look: { shirt: 0x6a4a2a, pants: 0x3a2a1c, hat: 'wrap' }, x: f.x - 12, z: f.z, facing: -Math.PI / 2,
      onInteract: say('Sisi Lunara', 'Fundição de Cera Perdida', '"As cabeças fundidas perto do Santuário saem com a pátina branca, não verde. Não sei explicar."') });
  }
  { const q = P(72, -14); B.house(ctx, { x: q.x, z: q.z, rot: faceTo(q.x, q.z, cx, cz), w: 16, d: 11, h: 4.5, wall: M.stoneLight, roof: 'tile', roofMat: M.stoneLight }); v.reserve(q.x, q.z, 11); }
  {
    const t = P(-58, 52);
    B.house(ctx, { x: t.x, z: t.z, rot: faceTo(t.x, t.z, cx, t.z), w: 13, d: 9, h: 5, wall: M.adobeWhite, roof: 'tile', roofMat: M.terracotta });
    v.reserve(t.x, t.z, 9);
    const d = B.local(t.x, t.z, faceTo(t.x, t.z, cx, t.z), 0, 6.5);
    v.addNPC({ id: 'veu-yewa', name: 'Yewa Kantu', title: 'Taberneira do Sino Calado', look: { robe: true, shirt: 0x7a2a2a, hat: 'wrap' }, x: d.x, z: d.z, facing: faceTo(d.x, d.z, cx, d.z),
      onInteract: say('Yewa Kantu', 'Taverna do Sino Calado', '"Aqui os sinos têm o badalo amarrado. Pode falar baixo o que lá fora não se fala."') });
    v.npcSpots.push({ x: d.x + 2, z: d.z + 2, r: 4 });
  }

  // ------------------------------------------------ Bairro dos Pátios (casas caiadas no platô)
  for (let k = 0, n = 0; k < 400 && n < 58; k++) {
    const a = r() * Math.PI * 2, d = 24 + Math.sqrt(r()) * (plat.r - 32);
    const x = plat.cx + Math.cos(a) * d, z = plat.cz + Math.sin(a) * d;
    if (terraceLevelAt(zone, x, z) !== 1 || Math.abs(x - zone.x) < hw + 6) continue;
    if (Math.hypot(x - top.cx, z - top.cz) < top.r + 8 || Math.hypot(x - plat.cx, z - plat.cz) > plat.r - 9) continue;
    if (!v.isFree(x, z, 6)) continue;
    const w = 9 + r() * 3, dd = 8 + r() * 3, rot = faceTo(x, z, pz.x, pz.z);
    B.house(ctx, { x, z, rot, w, d: dd, h: 3.8, wall: M.adobeWhite, roof: 'tile', roofMat: r() < 0.7 ? M.stoneLight : M.terracotta });
    const hd = B.local(x, z, rot, 1.8, dd / 2 + 0.25);
    head(ctx, { x: hd.x, y: ground(hd.x, hd.z) + 1.7, z: hd.z, rot, mat: M.terracotta }); // cabeça de família no nicho da porta
    v.reserve(x, z, Math.hypot(w, dd) / 2 + 1);
    n++;
  }

  // ------------------------------------------------ As Bocas (bacia)
  {
    const b = cfg.bocaLeite, lx = cx + b.dx, lz = cz + b.dz, wy = H(0) - b.waterBelow;
    ctx.batch.add(B.G.box, M.waterMilk, { x: lx, y: wy, z: lz, sx: b.hw * 2 + 2, sy: 0.05, sz: b.hd * 2 + 2 });
    // Tanques de decantação em 7 degraus, do branco ao transparente.
    for (let k = 0; k < 7; k++) {
      const x = lx - b.hw - 6 - k * 0.1, z = lz - 14 + k * 4.5, y = H(0) + 1.6 - k * 0.25;
      ctx.batch.add(B.G.box, M.stoneLight, { x, y: y - 0.5, z, sx: 8, sy: 1, sz: 4 });
      ctx.batch.add(B.G.box, k < 3 ? M.waterMilk : M.waterOasis, { x, y: y + 0.02, z, sx: 7.2, sy: 0.04, sz: 3.2 });
      ctx.collisions.addBox(x, z, 4, 2, 0, 'tank');
    }
    v.npcSpots.push({ x: lx - b.hw - 12, z: lz, r: 4 });
  }
  {
    const fx = cx - 148, fz = cz + 20;
    game.interactions.register({
      id: 'veu-boca-funda', label: 'Olhar a Boca Funda', radius: 6, position: { x: fx + 16, y: H(0) + 1.4, z: fz },
      onInteract: say('Boca Funda', 'Dolina', 'Nunca se mediu o fundo. As cabeças dos traidores foram jogadas aqui no Silêncio.'),
    });
    for (let k = 0; k < 6; k++) {
      const x = fx + 10 + (k % 3) * 11, z = fz + 26 + Math.floor(k / 3) * 12;
      if (!v.isFree(x, z, 5)) continue;
      B.ruinedHouse(ctx, { x, z, rot: r() * 6, w: 8, d: 6, h: 3, seed: 700 + k });
      v.reserve(x, z, 5.5);
    }
    v.addNPC({ id: 'veu-ibe', name: 'Ibe Tenwa', title: 'O Último dos Arrancados', look: { robe: true, shirt: 0x4a443a, hat: 'wrap', height: 1.64 },
      x: fx + 18, z: fz + 20, facing: Math.PI,
      onInteract: say('Ibe Tenwa', 'Bairro dos Arrancados', '"Tiraram a cabeça da minha família do muro. Mas eu sei de quem é a cara raspada lá no Santuário."') });
  }
  {
    const sx = cx, sz = cz - 160, y = H(0) - 8 + 0.2;
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      ctx.batch.add(B.G.box, M.darkOpening, { x: sx + Math.cos(a) * 4, y, z: sz + Math.sin(a) * 4, ry: -a, sx: 7, sy: 0.08, sz: 0.5 });
    }
    game.interactions.register({
      id: 'veu-boca-seca', label: 'Olhar a Boca Seca', radius: 7, position: { x: sx, y: H(0) + 1.4, z: sz + 14 },
      onInteract: say('Boca Seca', 'Zona proibida', 'Esvaziou na noite da Queda. No fundo seco, sete sulcos partem do centro, como se apontassem para algum lugar.'),
    });
  }

  // ------------------------------------------------ Árvores-osso (brancas) e o Caminho Branco
  for (let k = 0, n = 0; k < 300 && n < 90; k++) {
    const a = r() * Math.PI * 2, d = L[0].r - 20 + r() * 80;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (Math.abs(x - zone.x) < 10 && z > cz) continue; // Caminho Branco
    if (!v.isFree(x, z, 2.5)) continue;
    boneTree(ctx, { x, z, h: 9 + r() * 7 });
    v.reserve(x, z, 2.5);
    n++;
  }
  v.street(zone.x, cz + L[0].r + 70, zone.x, plat.cz + plat.r - 2, zone.stair.width, 0xd8d4c8);
  for (let z = cz + L[0].r + 60; z > plat.cz + plat.r + 6; z -= 30) {
    for (const s of [-1, 1]) {
      const x = zone.x + s * (hw + 1.5), y = ground(x, z);
      ctx.batch.add(B.G.box, M.adobeWhite, { x, y: y + 0.7, z, sx: 0.6, sy: 1.4, sz: 0.6 });
      head(ctx, { x, y: y + 1.65, z, rot: 0, mat: M.copperPatina }); // cabeça-marco virada para a cidade
      ctx.collisions.addCircle(x, z, 0.4, 'post');
    }
  }

  v.addElder(zone.x + hw + 3, plat.cz + plat.r + 8, 0);
  v.addWanderers(20, { robe: true, shirt: 0xe8e0d0, hat: 'wrap' });
  v.finalize();
  return v;
}

/** Cabeça-retrato (terracota ou cobre) no estilo sereno: crânio alongado, pescoço curto, estrias. */
function head(ctx, { x, y, z, rot, mat }) {
  const { M } = ctx;
  ctx.batch.add(B.G.rock, mat, { x, y: y + 0.08, z, ry: rot, sx: 0.17, sy: 0.24, sz: 0.19 });
  ctx.batch.add(B.G.cyl6, mat, { x, y: y - 0.2, z, ry: rot, sx: 0.08, sy: 0.18, sz: 0.08 });
  if (mat === M.terracotta) ctx.batch.add(B.G.box, M.woodDark, { x: x + Math.sin(rot) * 0.17, y: y + 0.05, z: z + Math.cos(rot) * 0.17, ry: rot, sx: 0.12, sy: 0.02, sz: 0.01 });
}

/** Árvore-osso do Jardim Pálido: casca branca e lisa, copa prateada. */
function boneTree(ctx, { x, z, h = 12 }) {
  const { M } = ctx;
  const y0 = ctx.terrain.heightAt(x, z) - 0.2;
  const rr = 0.3 + ctx.rnd() * 0.15;
  ctx.batch.add(B.G.cyl6, M.boneBark, { x, y: y0 + h / 2, z, rz: (ctx.rnd() - 0.5) * 0.1, sx: rr, sy: h, sz: rr });
  for (let i = 0; i < 4; i++) {
    const yy = y0 + h * (0.55 + ctx.rnd() * 0.35), a = ctx.rnd() * Math.PI * 2, len = 1.4 + ctx.rnd() * 1.8;
    const tip = { x: x + Math.cos(a) * len, y: yy + len * 0.6, z: z + Math.sin(a) * len };
    X.beam(ctx, M.boneBark, { x, y: yy, z }, tip, 0.08);
    ctx.batch.add(B.G.rock, M.paleLeaf, { x: tip.x, y: tip.y + 0.6, z: tip.z, ry: a, sx: 1.6 + ctx.rnd(), sy: 1.1, sz: 1.5 + ctx.rnd() });
  }
  ctx.batch.add(B.G.rock, M.paleLeaf, { x, y: y0 + h + 0.4, z, sx: 2.4, sy: 1.6, sz: 2.4 });
  ctx.collisions.addCircle(x, z, rr + 0.15, 'tree');
}
