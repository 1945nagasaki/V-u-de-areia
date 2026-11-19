import { Village } from './Village.js';
import * as B from './Builders.js';
import * as X from './BuildersExtra.js';
import { VILLAGES } from '../config/villages.js';
import { Mechanics } from '../systems/Mechanics.js';

/**
 * AS COVAS — a Pouso-Lento (tribo Luiheid), num vale entre dunas do Kalahari.
 * Design: design/narrative/pouso-lento.md (Partes IV–VI e XV).
 *
 * Poder lento e espalhado: não há palácio. As famílias vivem em COVAS, pátios
 * rebaixados 2,4 m no chão (frescos de dia), com uma casa baixa de cúpula
 * num canto e uma escada de terra. No centro, o OLHO LENTO, poço fundo onde a
 * água do próprio jogo fica 6 m abaixo do chão (com os crocodilos sagrados,
 * GUARDIANS em fauna.js). A oeste, a RODA: bacia rasa de assembleia com
 * bancos em círculo e, no meio, o Lugar de Ninguém (um assento de barro
 * vazio). Ao norte, a laje de calcário (Ridges) com o Santuário da Costela.
 * Mercado da Lua (sul, de noite), Celeiros Enterrados, Árvore dos Tecelões,
 * Vigias da Duna, Hortas de Mureta e o Canal do Imperador soterrado.
 */
export function buildPousoLento(game) {
  const cfg = VILLAGES.pousoLento;
  const v = new Village(game, cfg, 7171);
  const { ctx } = v;
  const { M } = ctx;
  const cx = v.x, cz = v.z;
  const r = v.rnd;
  const floor = cfg.flatten.height;
  const ground = (x, z) => ctx.terrain.heightAt(x, z);
  const say = (speaker, title, text) => (g) => Mechanics.talk(g, { speaker, title, text });
  const P = (dx, dz) => ({ x: cx + dx, z: cz + dz });
  const faceTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

  v.paintDisc(cx, cz, cfg.radius - 4, 0xc89a62, 0.35);

  // ------------------------------------------------ Olho Lento (poço sagrado)
  v.reserve(cx, cz, 16);
  for (let k = 0; k < 24; k++) { // mureta baixa de pedra em volta da boca do poço
    const a = (k / 24) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.2) continue; // degraus ao sul
    const x = cx + Math.cos(a) * 14.5, z = cz + Math.sin(a) * 14.5;
    ctx.batch.add(B.G.box, M.sandstone, { x, y: floor + 0.35, z, ry: -a, sx: 0.8, sy: 0.7, sz: 3.9 });
    ctx.collisions.addBox(x, z, 0.4, 1.95, -a, 'wall');
  }
  game.interactions.register({
    id: 'pouso-olho', label: 'Olhar o Olho Lento', radius: 4, position: { x: cx, y: floor + 1.2, z: cz + 15 },
    onInteract: say('Nhara Kesi', 'Guardiã do Olho', '"Os Grandes do poço não têm pressa. Quem cai lá dentro também aprende a não ter."'),
  });
  v.addNPC({ id: 'pouso-nhara', name: 'Nhara Kesi', title: 'Guardiã do Olho', look: { robe: true, shirt: 0x6a4a2a, hat: 'wrap', height: 1.66 },
    x: cx + 4, z: cz + 16.5, facing: Math.PI });
  v.npcSpots.push({ x: cx - 8, z: cz + 18, r: 3 }, { x: cx + 12, z: cz - 14, r: 3 });

  // ------------------------------------------------ As Covas (pátios rebaixados)
  for (const [dx, dz] of cfg.covas) {
    const x = cx + dx, z = cz + dz, rot = faceTo(x, z, cx, cz);
    const y = ground(x, z);
    // Casa baixa de cúpula no lado de fora do pátio (a sombra do dia).
    const hq = B.local(x, z, rot, 0, -2.2);
    B.part(ctx, B.G.sphere, M.mudBrick, hq.x, hq.z, rot, y, { ly: 0.2, w: 2.6, h: 2.1, d: 1.9 });
    B.part(ctx, B.G.box, M.darkOpening, hq.x, hq.z, rot, y, { lz: 1.86, ly: 0.75, w: 0.9, h: 1.5, d: 0.08 });
    ctx.collisions.addBox(hq.x, hq.z, 2.4, 1.7, rot, 'house');
    // Mureta de barro na borda e a escada de terra (do lado do Olho).
    for (const s of [-1, 1]) {
      const m = B.local(x, z, rot, s * 6.4, 0);
      ctx.batch.add(B.G.box, M.mudBrickDark, { x: m.x, y: floor + 0.3, z: m.z, ry: rot, sx: 0.5, sy: 0.6, sz: 11 });
    }
    const st = B.local(x, z, rot, 0, 6.2);
    for (let k = 0; k < 4; k++) {
      const q = B.local(x, z, rot, 0, 6.6 - k * 0.7);
      ctx.batch.add(B.G.box, M.sandstone, { x: q.x, y: floor - 0.3 - k * 0.6, z: q.z, ry: rot, sx: 1.6, sy: 0.6, sz: 0.6 });
    }
    if (r() < 0.3) { const pot = B.local(x, z, rot, 2, 1); ctx.batch.add(B.G.sphere, M.terracotta ?? M.adobeRed, { x: pot.x, y: ground(pot.x, pot.z) + 0.3, z: pot.z, sx: 0.35, sy: 0.4, sz: 0.35 }); }
    v.reserve(x, z, 7);
    v.reserve(st.x, st.z, 1);
  }

  // ------------------------------------------------ A Roda e o Lugar de Ninguém
  {
    const rd = P(-40, 0), y = ground(rd.x, rd.z);
    for (let ring = 0; ring < 3; ring++) {
      const rr = 6 + ring * 3.2, n = Math.round((2 * Math.PI * rr) / 1.8);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.3) continue; // entrada sul
        const x = rd.x + Math.cos(a) * rr, z = rd.z + Math.sin(a) * rr;
        ctx.batch.add(B.G.box, M.mudBrick, { x, y: ground(x, z) + 0.22, z, ry: -a, sx: 0.6, sy: 0.45, sz: 1.5 });
      }
    }
    B.part(ctx, B.G.cyl, M.mudBrickDark, rd.x, rd.z, 0, y, { ly: 0.25, w: 0.6, h: 0.5, d: 0.6 }); // o assento vazio
    B.part(ctx, B.G.box, M.mudBrickDark, rd.x, rd.z, 0, y, { lz: -0.5, ly: 0.75, w: 1.1, h: 1, d: 0.15 });
    ctx.collisions.addCircle(rd.x, rd.z, 0.6, 'seat');
    v.reserve(rd.x, rd.z, 17);
    game.interactions.register({
      id: 'pouso-lugar-de-ninguem', label: 'Olhar o Lugar de Ninguém', radius: 3, position: { x: rd.x, y: y + 1, z: rd.z + 1.5 },
      onInteract: say('O Lugar de Ninguém', 'A Roda', 'Um assento de barro vazio no meio da Roda. Ninguém se senta nele. É ali que ninguém manda.'),
    });
    v.addNPC({ id: 'pouso-luiheid', name: 'Luiheid', title: 'O Primeiro a Sentar (Pouso-Lento)',
      look: { robe: true, shirt: 0xb89868, hat: 'wrap', accessory: 'staff', height: 1.74, build: 0.95 }, x: rd.x + 6.2, z: rd.z - 1, facing: -Math.PI / 2,
      onInteract: say('Luiheid', 'A Roda', '"Akin queria que todos corressem para ele. Eu só parei. Vou pensar três noites no que você me pediu."') });
    v.addNPC({ id: 'pouso-dikelo', name: 'Dikelo Sana', title: 'Mestra dos Sentados', look: { robe: true, shirt: 0x8a6a4a, hat: 'wrap' }, x: rd.x - 6.2, z: rd.z + 1, facing: Math.PI / 2,
      onInteract: say('Dikelo Sana', 'Os Sentados', '"Parar não é preguiça. É recusar a pressa dos outros. A pressa matou mais gente que a seca."') });
    v.addNPC({ id: 'pouso-ilo', name: 'Ilo Mabé', title: 'Voz dos Acordados', look: { shirt: 0x6a3a2a, pants: 0x3a2a1c, hat: 'wrap' }, x: rd.x + 3, z: rd.z + 9.5, facing: Math.PI,
      onInteract: say('Ilo Mabé', 'Os Acordados', '"Na Seca dos Nove, a Roda esperou demais. Enterramos gente esperando. Nós não esperamos mais."') });
    v.npcSpots.push({ x: rd.x, z: rd.z + 8, r: 4 }, { x: rd.x - 8, z: rd.z - 4, r: 3 });
  }

  // ------------------------------------------------ Laje do norte: Santuário da Costela
  {
    const s = P(0, -72), y = ground(s.x, s.z) - 0.2;
    B.part(ctx, B.G.box, M.stoneLight, s.x, s.z, 0, y, { ly: 1.1, w: 14, h: 2.2, d: 10 });
    B.part(ctx, B.G.box, M.sandstone, s.x, s.z, 0, y, { ly: 2.3, w: 15, h: 0.3, d: 11 });
    B.part(ctx, B.G.box, M.darkOpening, s.x, s.z, 0, y, { lz: 5.05, ly: 0.9, w: 1.6, h: 1.8, d: 0.1 }); // escada que desce
    ctx.collisions.addBox(s.x, s.z, 7, 5, 0, 'house');
    v.presences.push({ x: s.x, z: s.z, reach: 4, name: 'A Calma' });
    game.interactions.register({
      id: 'pouso-costela', label: 'Descer ao Santuário', radius: 3, position: { x: s.x, y: y + 1.2, z: s.z + 7 },
      onInteract: say('Santuário da Costela', 'A Calma', 'A escada desce para o fresco. A vontade de descer some no terceiro degrau. Você senta e respira.'),
    });
    v.addNPC({ id: 'pouso-enzo', name: 'Enzo', title: 'Guardião da laje', look: { shirt: 0xd8c8a8, pants: 0x6a5038, hat: 'wrap', height: 1.76 },
      x: s.x + 5, z: s.z + 8, facing: Math.PI,
      onInteract: say('Enzo', 'Santuário da Costela', '"Já tentaram levar a Costela três vezes. Todos sentaram aqui na laje. Um deles ficou até hoje."') });
  }

  // ------------------------------------------------ Árvore dos Tecelões e Campo das Ferramentas
  {
    const t = P(22, -38);
    v.plants.push({ type: 'acacia', x: t.x, z: t.z, s: 1.6, ry: 0.4 });
    v.reserve(t.x, t.z, 6);
    for (let k = 0; k < 10; k++) {
      const x = t.x + 8 + r() * 10, z = t.z - 4 + r() * 10;
      if (v.isFree(x, z, 0.6)) { v.props.push({ type: k % 3 ? 'plank' : 'log', x, z, rot: r() * 6 }); v.reserve(x, z, 0.6); }
    }
    v.addNPC({ id: 'pouso-moti', name: 'Moti', title: 'A Lembradeira', look: { robe: true, shirt: 0x5a4a3a, hat: 'wrap', height: 1.58 }, x: t.x - 3, z: t.z + 3, facing: 2.3,
      onInteract: say('Moti', 'Campo das Ferramentas', '"No dia da Grande Parada, cada família largou a ferramenta de Akin aqui. Ninguém nunca voltou para pegar."') });
    v.npcSpots.push({ x: t.x - 2, z: t.z + 5, r: 3 });
  }

  // ------------------------------------------------ Mercado da Lua (sul) e Celeiros Enterrados
  {
    const m = P(0, 62);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2, x = m.x + Math.cos(a) * 11, z = m.z + Math.sin(a) * 9;
      B.marketStall(ctx, { x, z, rot: faceTo(x, z, m.x, m.z), poor: k % 2 === 0 });
      v.reserve(x, z, 2.4);
    }
    for (const s of [-1, 1]) v.addLamp(X.lampPost(ctx, { x: m.x + s * 5, z: m.z, rot: 0 }));
    v.npcSpots.push({ x: m.x, z: m.z, r: 5 });
    v.addNPC({ id: 'pouso-feso', name: 'Feso Garan', title: 'Cambista da Organização', look: { shirt: 0x2a2420, pants: 0x1c1814, hat: 'wrap' }, x: m.x + 13, z: m.z + 3, facing: -Math.PI / 2,
      onInteract: say('Feso Garan', 'Mercado da Lua', '"Aqui ninguém aceita presente. Presente aceito vira dívida, dizem. Gente esperta, essa."') });
    v.addNPC({ id: 'pouso-lissa', name: 'Lissa Orun', title: 'Velada do Véu-Carmesim', look: { robe: true, shirt: 0x9a1a22, hat: 'wrap', height: 1.66 }, x: m.x - 13, z: m.z - 2, facing: Math.PI / 2,
      onInteract: say('Lissa Orun', 'Velada', '"Vim falar do Pai do Véu. Eles escutam, sorriem e dormem. É a recusa mais educada do continente."') });
    for (let k = 0; k < 4; k++) { const h = P(26 + k * 4, 70); B.hatch(ctx, { x: h.x, z: h.z, rot: 0 }); v.reserve(h.x, h.z, 1.6); }
  }
  // Pátio dos Ofícios (sudeste): a ferreira que fugiu da dívida.
  {
    const o = P(62, 48);
    B.house(ctx, { x: o.x, z: o.z, rot: faceTo(o.x, o.z, cx, cz), w: 8, d: 6, h: 2.8, wall: M.mudBrick, roof: 'flat' });
    v.reserve(o.x, o.z, 6);
    const d = B.local(o.x, o.z, faceTo(o.x, o.z, cx, cz), 0, 5);
    v.addNPC({ id: 'pouso-sereba', name: 'Sereba Onu', title: 'A Ferreira Pousada', look: { shirt: 0x5a3a22, pants: 0x3a2a1c, build: 1.1 }, x: d.x, z: d.z, facing: faceTo(d.x, d.z, cx, cz),
      onInteract: say('Sereba Onu', 'Pátio dos Ofícios', '"Fugi de Dique-Rubro com uma dívida que não era minha. Se um Cobrador do Dente aparecer, você não me viu."') });
  }
  // Hortas de Mureta (sudoeste).
  for (let k = 0; k < 3; k++) { const f = P(-72 - k * 6, 56 + k * 14); B.field(ctx, { x: f.x, z: f.z, rot: 0.6, w: 22, d: 12, crop: 'maize' }); }

  // ------------------------------------------------ Vigias da Duna e Ruas de Duna
  for (const s of [-1, 1]) {
    const w = P(s * 118, -18);
    X.watchTower(ctx, { x: w.x, z: w.z, rot: s > 0 ? -Math.PI / 2 : Math.PI / 2, h: 9 });
    v.reserve(w.x, w.z, 4);
    v.street(cx + s * 24, cz, cx + s * (cfg.radius + 60), cz, 4, 0xb08a58);
  }
  // Canal do Imperador (noroeste, soterrado): muros de pedra partidos meio enterrados.
  for (let k = 0; k < 10; k++) {
    const x = cx - 150 - k * 9, z = cz - 150 + k * 4;
    if (r() < 0.25) continue;
    ctx.batch.add(B.G.box, M.sandstone, { x, y: ground(x, z) + 0.2, z, ry: 0.42, rz: (r() - 0.5) * 0.2, sx: 1, sy: 1 + r(), sz: 7 });
    ctx.batch.add(B.G.box, M.sandstone, { x: x + 4, y: ground(x + 4, z + 2) + 0.2, z: z + 2, ry: 0.42, sx: 1, sy: 0.8 + r(), sz: 7 });
  }

  v.addElder(cx + cfg.radius - 6, cz + 3, -Math.PI / 2);
  v.addWanderers(16, { shirt: 0xc8a070, pants: 0x6a5038, hat: 'wrap' });
  v.finalize();
  return v;
}
