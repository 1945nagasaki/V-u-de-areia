import { Village } from './Village.js';
import * as B from './Builders.js';
import * as X from './BuildersExtra.js';
import { VILLAGES } from '../config/villages.js';
import { Mechanics } from '../systems/Mechanics.js';
import { levelHeight } from '../world/Terraces.js';

/**
 * DIQUE-RUBRO — cidade de Toorn (Brasa-Viva), na várzea da Floresta Equatorial.
 * Design: design/narrative/brasa-viva.md (Partes IV–VI e XV).
 *
 * Organizada por fogo e por água: um Dique de terra de 5 m (Ridges) cerca a
 * cidade, com a Porta do Porto (norte), a Porta da Calçada (oeste) e a
 * Comporta (leste, para o mar). No centro, a Ilha dos Pilares (terrapleno de
 * 6 m, Terraces) com o Salão das Placas, a Torre de Toorn e a Grande
 * Cisterna. A leste, as Mil Fornalhas; a oeste e ao norte, os Bairros do Turno
 * (Vermelho, Branco, Negro); ao sul, o Quartel e o Fosso do Lodo. Fora do
 * Dique: o Lodo (casas de palha em montes baixos) e a Lagoa dos Grandes,
 * cujo fundo fica abaixo do mar — a água do próprio jogo a enche.
 */
export function buildBrasaViva(game) {
  const cfg = VILLAGES.brasaViva;
  const v = new Village(game, cfg, 2525);
  const { ctx } = v;
  const { M } = ctx;
  const cx = v.x, cz = v.z;
  const r = v.rnd;
  const zone = game.terraceZones.brasaViva;
  const floor = levelHeight(zone, 0), islandY = levelHeight(zone, 1);
  const ground = (x, z) => ctx.terrain.heightAt(x, z);
  const say = (speaker, title, text) => (g) => Mechanics.talk(g, { speaker, title, text });
  const free = (x, z, pad) => v.isFree(x, z, pad);
  const P = (lx, lz) => ({ x: cx + lx, z: cz + lz });

  // Chão de laterita batida dentro do Dique (o 'rubro' do nome).
  v.paintDisc(cx, cz, 146, 0x7a3e26, 0.55);
  v.paintDisc(cx, cz, 30, 0x6a3420, 0.8);

  // ------------------------------------------------ Ilha dos Pilares (centro)
  v.reserve(cx, cz, 28);
  {
    // Salão das Placas: pilares de madeira escura cobertos de placas de bronze.
    const s = P(0, -8);
    B.house(ctx, { x: s.x, z: s.z, rot: 0, w: 24, d: 12, h: 6, wall: M.adobeRed, roof: 'tin' });
    const y0 = B.groundUnder(ctx, s.x, s.z, 0, 12, 6) - 0.25;
    for (let i = 0; i < 8; i++) {
      const lx = -10.5 + i * 3;
      B.part(ctx, B.G.box, M.woodDark, s.x, s.z, 0, y0, { lx, lz: 8, ly: 2.8, w: 0.6, h: 5.6, d: 0.6 });
      for (let k = 0; k < 4; k++) B.part(ctx, B.G.box, M.brass, s.x, s.z, 0, y0, { lx, lz: 8.32, ly: 1 + k * 1.15, w: 0.5, h: 0.8, d: 0.05 });
      const c = B.local(s.x, s.z, 0, lx, 8); ctx.collisions.addCircle(c.x, c.z, 0.45, 'post');
    }
    B.part(ctx, B.G.box, M.tin ?? M.iron, s.x, s.z, 0, y0, { lz: 7, ly: 5.9, w: 25, h: 0.25, d: 4.2 });
    game.interactions.register({
      id: 'brasa-placas', label: 'Ler as placas de bronze', radius: 3.5,
      position: { x: s.x - 4.5, y: y0 + 2, z: s.z + 9 },
      onInteract: say('Irede Amo', 'Escriba das placas',
        '"Cada placa é um ano. As antigas contam guerras; as novas, só a dívida. Esta aqui é a da Cheia da Dívida."'),
    });
    v.addNPC({ id: 'brasa-irede', name: 'Irede Amo', title: 'Escriba das placas', look: { robe: true, shirt: 0x5a3a22, hat: 'wrap', height: 1.7 },
      x: s.x - 6, z: s.z + 10, facing: Math.PI });
    // Torre de Toorn (18 m) e a Grande Cisterna.
    const t = P(14, 10), ty = ground(t.x, t.z) - 0.3;
    B.part(ctx, B.G.box, M.mudBrickDark, t.x, t.z, 0, ty, { ly: 9, w: 6, h: 18, d: 6 });
    B.part(ctx, B.G.box, M.adobeRed, t.x, t.z, 0, ty, { ly: 18.4, w: 6.8, h: 0.8, d: 6.8 });
    B.part(ctx, B.G.pyramid, M.woodDark, t.x, t.z, 0, ty, { ly: 20.6, w: 7, h: 3.6, d: 7 });
    ctx.collisions.addBox(t.x, t.z, 3.1, 3.1, 0, 'tower');
    v.reserve(t.x, t.z, 5);
    const ci = P(-14, 11), cy = ground(ci.x, ci.z);
    B.part(ctx, B.G.cyl, M.stoneDark, ci.x, ci.z, 0, cy, { ly: 0.6, w: 4.2, h: 1.2, d: 4.2 });
    ctx.batch.add(B.G.disc, M.waterOasis, { x: ci.x, y: cy + 1.1, z: ci.z, sx: 3.8, sy: 1, sz: 3.8 });
    ctx.collisions.addCircle(ci.x, ci.z, 4.3, 'well');
    v.reserve(ci.x, ci.z, 5);
    v.addNPC({ id: 'brasa-toorn', name: 'Toorn', title: 'Mestre do Dique (Brasa-Viva)',
      look: { shirt: 0x5a1a12, pants: 0x2a1a12, hat: 'wrap', build: 1.35, height: 1.95 }, x: cx + 3, z: cz + 4, facing: 0,
      onInteract: say('Toorn', 'Ilha dos Pilares', '"Fala logo o que quer. E fala de longe. Quem chega perto demais costuma estar cobrando."') });
    v.npcSpots.push({ x: cx, z: cz + 14, r: 6 });
  }

  // ------------------------------------------------ Santuário da Têmpera (a Tina), sudeste da Ilha
  {
    const s = P(36, 30);
    B.house(ctx, { x: s.x, z: s.z, rot: Math.atan2(cx - s.x, cz - s.z), w: 12, d: 10, h: 4.5, wall: M.mudBrickDark, roof: 'flat' });
    v.reserve(s.x, s.z, 9);
    game.interactions.register({
      id: 'brasa-tina', label: 'Ouvir a Tina', radius: 3.5, position: { x: s.x - 4, y: ground(s.x, s.z) + 1.4, z: s.z - 4 },
      onInteract: say('Edeyo Fanmi', 'Santuário da Têmpera',
        '"A água da Tina nunca esfria. A Espada dorme ali dentro. Ninguém entra sem a guarda e sem a lagoa saber."'),
    });
    v.addNPC({ id: 'brasa-edeyo', name: 'Edeyo Fanmi', title: 'Guardiã da Lagoa e da Têmpera', look: { robe: true, shirt: 0x1e3a3a, hat: 'wrap', height: 1.66 },
      x: s.x - 5, z: s.z - 5, facing: -2.3 });
  }

  // ------------------------------------------------ As Mil Fornalhas (leste)
  for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
    const p = P(62 + i * 14, -42 + j * 22 + (i % 2) * 6);
    if (Math.hypot(p.x - cx, p.z - cz) > 135 || !free(p.x, p.z, 4)) continue;
    furnace(ctx, { x: p.x, z: p.z });
    if ((i + j) % 3 === 0) v.fires.push({ x: p.x + 2.2, y: ground(p.x, p.z) + 1, z: p.z, color: 0xff7a2a, intensity: 22, range: 12, warm: true }); // boca da fornalha
    v.reserve(p.x, p.z, 4.5);
  }
  {
    const o = P(76, -20);
    v.addNPC({ id: 'brasa-oyelu', name: 'Oyelu Fanran', title: 'Mestre das Mil Fornalhas', look: { shirt: 0x6a4a2a, pants: 0x2a1e14, build: 1.2 },
      x: o.x, z: o.z, facing: -Math.PI / 2,
      onInteract: say('Oyelu Fanran', 'Mil Fornalhas', '"Bronze bom pede estanho, e o estanho é da Organização. Cada lingote já nasce devendo."') });
    v.addNPC({ id: 'brasa-nkem', name: 'Nkem Basse', title: 'Mestra dos Foleiros', look: { shirt: 0x8a2a1a, pants: 0x3a2a1c, hat: 'wrap' },
      x: o.x + 4, z: o.z + 6, facing: 2,
      onInteract: say('Nkem Basse', 'Guilda dos Foleiros', '"Se os foles param, a cidade para. Foi assim que derrubamos os Senhores do Dique."') });
    v.npcSpots.push({ x: o.x, z: o.z, r: 8 }, { x: o.x + 14, z: o.z + 30, r: 6 });
  }
  // Pátio do Metal: pilhas de lingotes e carvão.
  for (let k = 0; k < 8; k++) {
    const p = P(40 + (k % 4) * 5, -66 + Math.floor(k / 4) * 5);
    ctx.batch.add(B.G.box, k % 2 ? M.brass : M.stoneDark, { x: p.x, y: ground(p.x, p.z) + 0.4, z: p.z, ry: r(), sx: 2.4, sy: 0.8, sz: 1.2 });
    ctx.collisions.addCircle(p.x, p.z, 1.2, 'crate');
  }

  // ------------------------------------------------ Bairros do Turno (oeste e norte)
  const turnos = [M.adobeRed, M.adobeWhite, M.mudBrickDark]; // Vermelho, Branco, Negro
  const banners = [M.clothRed, M.clothYellow, M.clothBlue];
  for (let k = 0; k < 90; k++) {
    const a = Math.PI * (0.55 + r() * 1.25), d = 45 + r() * 90; // de sudoeste a nordeste, pelo oeste e norte
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (x > cx + 50 || !free(x, z, 5)) continue;
    const t = d < 75 ? 0 : d < 105 ? 1 : 2;
    const rot = Math.atan2(cx - x, cz - z);
    B.house(ctx, { x, z, rot, w: 7 + r() * 2, d: 5.5 + r(), h: 3.2, wall: turnos[t], roof: r() < 0.5 ? 'thatch' : 'tin' });
    v.reserve(x, z, 5.2);
    if (r() < 0.15) { const b = B.local(x, z, rot, 3.6, 4); B.banner(ctx, { x: b.x, z: b.z, cloth: banners[t] }); }
  }

  // ------------------------------------------------ Quartel do Dique e Fosso do Lodo (sul)
  {
    const q = P(-20, 70);
    B.house(ctx, { x: q.x, z: q.z, rot: Math.PI, w: 18, d: 10, h: 4.5, wall: M.mudBrickDark, roof: 'tin' });
    v.reserve(q.x, q.z, 11);
    const f = P(18, 78);
    v.paintDisc(f.x, f.z, 9, 0x4a3420, 0.95);
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      B.part(ctx, B.G.cyl, M.log, f.x + Math.cos(a) * 9.5, f.z + Math.sin(a) * 9.5, 0, ground(f.x, f.z), { ly: 0.6, w: 0.18, h: 1.2, d: 0.18 });
    }
    v.reserve(f.x, f.z, 11);
    v.npcSpots.push({ x: f.x, z: f.z, r: 7 });
    v.addNPC({ id: 'brasa-bayo', name: 'Bayo Teke', title: 'Capitão da Guarda do Dique', look: { shirt: 0x3a2a1c, pants: 0x2a1e14, hat: 'wrap', accessory: 'spear', build: 1.2 },
      x: q.x + 10, z: q.z - 7, facing: 0,
      onInteract: say('Bayo Teke', 'Quartel do Dique', '"O Fosso resolve as brigas da cidade. Toorn nunca perdeu ali. Ninguém lembra de ele ter ganho rindo."') });
  }

  // ------------------------------------------------ Bairro Afogado (ruínas, sudeste, junto ao Dique)
  for (let k = 0; k < 7; k++) {
    const a = 0.75 + k * 0.1, x = cx + Math.cos(a) * 128, z = cz + Math.sin(a) * 128;
    if (!free(x, z, 4.5)) continue;
    B.ruinedHouse(ctx, { x, z, rot: a + Math.PI / 2, w: 7, d: 5.5, h: 2.6, seed: 300 + k });
    v.reserve(x, z, 5);
  }

  // ------------------------------------------------ Portas do Dique, Crista e Posto dos Cobradores
  const doors = [[-Math.PI / 2, 'Porta do Porto'], [Math.PI, 'Porta da Calçada'], [0, 'Comporta']];
  for (const [a, name] of doors) {
    const x = cx + Math.cos(a) * 156, z = cz + Math.sin(a) * 156;
    const nx = -Math.sin(a), nz = Math.cos(a);
    for (const s of [-1, 1]) {
      const px = x + nx * s * 9, pz = z + nz * s * 9;
      B.part(ctx, B.G.box, M.mudBrickDark, px, pz, -a, ground(px, pz) - 0.5, { ly: 3.5, w: 2.4, h: 7, d: 2.4 });
      ctx.collisions.addBox(px, pz, 1.2, 1.2, -a, 'gate-tower');
    }
    v.street(cx + Math.cos(a) * 30, cz + Math.sin(a) * 30, cx + Math.cos(a) * 200, cz + Math.sin(a) * 200, 5, 0x6a4a30);
    v.npcSpots.push({ x: cx + Math.cos(a) * 140, z: cz + Math.sin(a) * 140, r: 4 });
    if (name === 'Comporta') {
      // Posto dos Cobradores do Dente, junto à Comporta (para onde vai a Entrega da Cheia).
      const pc = { x: x - 14, z: z + 14 };
      B.house(ctx, { x: pc.x, z: pc.z, rot: -Math.PI / 2, w: 9, d: 6, h: 3.5, wall: M.adobeOchre, roof: 'flat' });
      v.reserve(pc.x, pc.z, 6.5);
      v.addNPC({ id: 'brasa-seko', name: 'Seko Varrah', title: 'Cobrador do Dente residente',
        look: { shirt: 0x2a2420, pants: 0x1c1814, hat: 'wrap', build: 1.1 }, x: pc.x - 5, z: pc.z - 4, facing: Math.PI,
        onInteract: say('Seko Varrah', 'Posto dos Cobradores', '"Doze toneladas e um terço do pedágio, na Entrega da Cheia. E a pergunta de sempre: e a Espada?"') });
      const pier = { ax: x + 6, az: z, bx: x + 34, bz: z };
      if (ground(pier.bx, pier.bz) < 0) B.pier(ctx, { ...pier, width: 4, boats: 2 });
    }
  }
  // Crista do Dique: bancas no alto do Dique, setor norte.
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + 0.22 + k * 0.11;
    const x = cx + Math.cos(a) * 160, z = cz + Math.sin(a) * 160;
    B.marketStall(ctx, { x, z, rot: Math.atan2(cx - x, cz - z) + Math.PI, poor: k % 3 === 0 });
    v.reserve(x, z, 2.4);
  }
  v.npcSpots.push({ x: cx + Math.cos(-1.0) * 160, z: cz + Math.sin(-1.0) * 160, r: 5 });

  // ------------------------------------------------ O Lodo (fora do Dique, sul): palha em montes baixos
  for (let k = 0; k < 26; k++) {
    const x = cx - 60 + r() * 120, z = cz + 182 + r() * 34;
    if (!free(x, z, 3.2) || ground(x, z) < 0.6) continue;
    B.rondavel(ctx, { x, z, r: 2.6, h: 2.3, wall: M.mudBrick, rot: r() * 6 });
    v.reserve(x, z, 3.5);
  }
  {
    const m = P(0, 192);
    v.addNPC({ id: 'brasa-ma-ndofe', name: 'Ma Ndofe', title: 'A Velha do Lodo', look: { robe: true, shirt: 0x5a4a3a, hat: 'wrap', height: 1.55 },
      x: m.x, z: m.z, facing: Math.PI,
      onInteract: say('Ma Ndofe', 'O Lodo', '"Ele era um menino doce, sabia? Dividia peixe com os outros. A cheia leva tudo. Até isso."') });
    v.npcSpots.push({ x: m.x + 4, z: m.z - 3, r: 5 });
  }

  // ------------------------------------------------ Lagoa dos Grandes (fora do Dique, sudoeste)
  {
    const L = cfg.lagoon, lx = cx + L.dx, lz = cz + L.dz;
    for (let k = 0; k < 5; k++) {
      const a = -0.9 + k * 0.32, x = lx + Math.cos(a) * (L.hw + 6), z = lz + Math.sin(a) * (L.hd + 6);
      if (ground(x, z) < 0.5) continue;
      B.part(ctx, B.G.box, M.stoneDark, x, z, 0, ground(x, z), { ly: 0.5, w: 1.2, h: 1, d: 0.8 }); // altares
      ctx.collisions.addCircle(x, z, 0.7, 'post');
    }
    game.interactions.register({
      id: 'brasa-lagoa', label: 'Olhar a Lagoa dos Grandes', radius: 6,
      position: { x: lx + L.hw + 8, y: ground(lx + L.hw + 8, lz) + 1.4, z: lz },
      onInteract: say('Lagoa dos Grandes', 'Hipopótamos sagrados',
        'Dizem que pescadores acharam a Espada aqui, entre os Grandes, ainda quente. A água borbulha sem vento.'),
    });
  }

  // Ancião (lore) na Porta da Calçada, e Ikoro, o jovem carvoeiro.
  v.addElder(cx - 146, cz + 6, -Math.PI / 2);
  v.addNPC({ id: 'brasa-ikoro', name: 'Ikoro', title: 'Jovem carvoeiro', look: { shirt: 0x2a2420, pants: 0x3a2a1c, height: 1.62 },
    x: cx - 140, z: cz - 6, facing: -Math.PI / 2,
    onInteract: say('Ikoro', 'Calçada das Carvoarias', '"Carvão para mil fornalhas. Eu carrego, outro queima, a Organização conta. E eu continuo devendo."') });
  v.addWanderers(26, { shirt: 0x7a3a22, pants: 0x3a2a1c, hat: 'wrap' });
  v.finalize();
  return v;
}

/** Fornalha de barro com chaminé (forja de bronze), boca acesa. */
function furnace(ctx, { x, z }) {
  const { M } = ctx;
  const y0 = ctx.terrain.heightAt(x, z) - 0.2;
  ctx.batch.add(B.G.cyl, M.mudBrickDark, { x, y: y0 + 1.1, z, sx: 1.8, sy: 2.2, sz: 1.8 });
  ctx.batch.add(B.G.cone8, M.mudBrick, { x, y: y0 + 3.2, z, sx: 1.6, sy: 2, sz: 1.6 });
  ctx.batch.add(B.G.cyl, M.mudBrickDark, { x, y: y0 + 5.6, z, sx: 0.5, sy: 3, sz: 0.5 });
  ctx.batch.add(B.G.box, M.flame ?? M.clothRed, { x: x + 1.75, y: y0 + 0.8, z, sx: 0.1, sy: 0.7, sz: 0.8 });
  ctx.collisions.addCircle(x, z, 2, 'furnace');
}
