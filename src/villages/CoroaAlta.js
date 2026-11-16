import * as THREE from 'three';
import { Village } from './Village.js';
import * as B from './Builders.js';
import * as X from './BuildersExtra.js';
import { VILLAGES } from '../config/villages.js';
import { Mechanics } from '../systems/Mechanics.js';
import { terraceLevelAt, levelHeight } from '../world/Terraces.js';

/**
 * CIDADELA DO CUME-LEÃO — capital de Coroa-Alta (tribo Hoogmoed), na Taiga.
 * Design: design/narrative/coroa-alta.md (Partes IV–VI e XV).
 *
 * A montanha é cortada em 5 terraços (Terraces.js): o Pé (mineiros), a Pata
 * (forjas), o Ombro (mercado e mestres), a Juba (nobreza, Face Branca, Guarda)
 * e o Topo (o Salão do Primeiro Degrau). A altura onde se mora é a classe.
 * A Escada do Pé ao Topo sobe pelo eixo sul→norte, com um Portão de Degrau
 * em cada muralha e a Avenida dos Leões: 14 estátuas, cada par maior que o
 * anterior (modelo real do leão, em granito — ver `statues`).
 */
export function buildCoroaAlta(game) {
  const v = new Village(game, VILLAGES.coroaAlta, 1601);
  const { ctx } = v;
  const { M } = ctx;
  const zone = game.terraceZones.coroaAlta;
  const L = zone.levels;
  const ax = zone.x; // eixo da Escada (x constante; sobe de +z para −z)
  const hw = zone.stair.width / 2;
  const H = (i) => levelHeight(zone, i);
  const ground = (x, z) => ctx.terrain.heightAt(x, z);
  /** Estátuas a criar quando os modelos 3D estiverem prontos (Game → Statues). */
  v.statues = [];
  const r = v.rnd;

  /** Ponto dentro do nível i, longe das bordas, da escada e do que já existe. */
  const inLevel = (i, x, z, margin) => {
    if (terraceLevelAt(zone, x, z) !== i) return false;
    const l = L[i];
    if (Math.hypot(x - l.cx, z - l.cz) > l.r - margin) return false;
    const up = L[i + 1];
    if (up && Math.hypot(x - up.cx, z - up.cz) < up.r + margin) return false;
    return Math.abs(x - ax) > hw + margin;
  };
  const spotIn = (i, pad, margin = 7, tries = 60) => {
    const l = L[i];
    for (let t = 0; t < tries; t++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * l.r;
      const x = l.cx + Math.cos(a) * d, z = l.cz + Math.sin(a) * d;
      if (inLevel(i, x, z, margin) && v.isFree(x, z, pad)) return { x, z };
    }
    return null;
  };
  const faceTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

  // ---------------------------------------------------------------- Escada
  const prof = zone.prof; // [z, y] do sul (Portão do Pé) ao norte (Topo)
  const zSouth = prof[0][0] + 20, zNorth = prof[prof.length - 1][0] + 6;
  v.street(ax, zSouth, ax, zNorth, zone.stair.width, 0x6a6660);
  // Degraus de granito nas rampas (1 degrau a cada ~0,6 m de corrida).
  for (let k = 1; k < prof.length - 1; k += 2) {
    const [z0] = prof[k], [z1] = prof[k + 1];
    const n = Math.round((z0 - z1) / 0.6);
    for (let s = 0; s < n; s++) {
      const z = z0 - (s + 0.5) * ((z0 - z1) / n);
      const y = ground(ax, z);
      ctx.batch.add(B.G.box, M.stone, { x: ax, y: y - 0.12, z, sx: zone.stair.width - 0.6, sy: 0.4, sz: (z0 - z1) / n + 0.05 });
    }
    // Muretas laterais da rampa.
    for (const sgn of [-1, 1]) {
      const zm = (z0 + z1) / 2, len = Math.hypot(z0 - z1, ground(ax, z1) - ground(ax, z0));
      const ym = (ground(ax, z0) + ground(ax, z1)) / 2;
      const tilt = Math.atan2(ground(ax, z1) - ground(ax, z0), z0 - z1);
      ctx.batch.add(B.G.box, M.stoneDark, { x: ax + sgn * (hw + 0.3), y: ym + 0.5, z: zm, rx: tilt, sx: 0.6, sy: 1.6, sz: len });
      ctx.collisions.addBox(ax + sgn * (hw + 0.3), zm, 0.3, (z0 - z1) / 2, 0, 'wall');
    }
  }
  v.reserve(ax, (zSouth + zNorth) / 2, 0); // a escada é tratada por inLevel (faixa do eixo)

  // ------------------------------------------- Muralhas (uma por terraço)
  // Muro de arrimo na borda de cada nível, do chão de baixo até o parapeito
  // de cima. A colisão é a própria borda (só o vão da Escada fica aberto).
  for (let i = 1; i < L.length; i++) {
    const l = L[i];
    const yLo = H(i - 1) - 1.5, yHi = H(i) + 1.3;
    const segs = Math.max(24, Math.round((2 * Math.PI * l.r) / 6));
    for (let k = 0; k < segs; k++) {
      const a0 = (k / segs) * Math.PI * 2, a1 = ((k + 1) / segs) * Math.PI * 2, am = (a0 + a1) / 2;
      const mx = l.cx + Math.cos(am) * (l.r - 0.6), mz = l.cz + Math.sin(am) * (l.r - 0.6);
      if (Math.abs(mx - ax) < hw + 1.2 && mz > l.cz) continue; // vão da Escada
      const len = 2 * l.r * Math.sin(Math.PI / segs) + 0.15;
      const rot = -am; // eixo longo tangente ao anel
      ctx.batch.add(B.G.box, M.stone, { x: mx, y: (yLo + yHi) / 2, z: mz, ry: rot, sx: 1.6, sy: yHi - yLo, sz: len });
      ctx.batch.add(B.G.box, M.stoneDark, { x: mx, y: yHi + 0.15, z: mz, ry: rot, sx: 1.9, sy: 0.3, sz: len });
      ctx.collisions.addBox(mx, mz, 0.9, len / 2, rot, 'wall');
    }
    // Portão de Degrau: dois pilares com cabeça de leão de ferro (nas cumeeiras do Salão o mesmo).
    const zg = l.cz + l.r - 0.6;
    for (const sgn of [-1, 1]) {
      const px = ax + sgn * (hw + 1.4);
      ctx.batch.add(B.G.box, M.stoneDark, { x: px, y: (yLo + yHi + 3) / 2, z: zg, sx: 2.2, sy: yHi + 3 - yLo, sz: 2.2 });
      ctx.batch.add(B.G.sphere, M.iron, { x: px, y: yHi + 3.5, z: zg, sx: 0.7, sy: 0.6, sz: 0.7 });
      ctx.collisions.addCircle(px, zg, 1.4, 'gate');
    }
    // Grade de ferro aberta, encostada no pilar oeste.
    for (let b = 0; b < 7; b++) {
      ctx.batch.add(B.G.cyl6, M.iron, { x: ax - hw - 0.2, y: H(i) + 1.9, z: zg - 0.6 - b * 0.7, sx: 0.06, sy: 3.8, sz: 0.06 });
    }
    // Guardas no portão.
    for (const sgn of [-1, 1]) {
      v.addNPC({ id: `coroa-guarda-${i}-${sgn}`, name: 'Guarda Leonina', look: { shirt: 0x6a2a1c, pants: 0x2a2622, hat: 'wrap', accessory: 'spear', build: 1.1 },
        x: ax + sgn * (hw - 1), z: zg - 2.5, facing: 0 });
    }
  }

  // Muralha externa do Pé com o Portão do Pé ao sul: aberto do Gongo da
  // manhã (5 h) ao Gongo da noite (21 h); fechado à noite, como todo portão.
  const outer = B.fortressWall(ctx, { x: L[0].cx, z: L[0].cz, r: L[0].r - 3, gateAngle: Math.PI / 2, height: 7, thickness: 2.4, towers: 10 });
  v.gate = outer.gate;
  const GATE_HOURS = [5, 21];
  v.tick = () => {
    const h = game.gameClock?.hour ?? 12;
    const open = h >= GATE_HOURS[0] && h < GATE_HOURS[1];
    if (open !== v.gate.open) v.gate.setOpen(open);
  };
  v.tick();

  // ------------------------------------------- Avenida dos Leões (14 estátuas)
  // Pares nos patamares da Escada; cada par maior que o anterior.
  const landing = []; // z de patamares (trechos planos do eixo) por nível
  for (let i = 0; i < L.length - 1; i++) {
    const zStart = i === 0 ? L[0].cz + L[0].r - 14 : prof[2 * i][0] - 3;
    const zEnd = prof[2 * i + 1][0] + 3;
    landing.push([zStart, zEnd]);
  }
  const pairs = [3, 2, 1, 1]; // Pé, Pata, Ombro, Juba = 7 pares
  let n = 0;
  pairs.forEach((count, i) => {
    const [zs, ze] = landing[i];
    for (let c = 0; c < count; c++) {
      const z = zs + ((c + 1) / (count + 1)) * (ze - zs);
      for (const sgn of [-1, 1]) {
        const x = ax + sgn * (hw + 3.2);
        const len = 2.4 + n * 0.22; // 2,4 m → 5,3 m
        const y = ground(x, z);
        ctx.batch.add(B.G.box, M.stoneDark, { x, y: y + 0.6, z, sx: 1.6 + len * 0.25, sy: 1.2, sz: len * 0.75 });
        v.statues.push({ model: 'leao', x, z, y: y + 1.2, rot: sgn > 0 ? -Math.PI / 2 : Math.PI / 2, length: len });
        ctx.collisions.addCircle(x, z, 0.9 + len * 0.2, 'statue');
        v.reserve(x, z, 1 + len * 0.3);
      }
      n += 1;
    }
  });

  // Lanternas ao longo da Escada.
  for (let z = zSouth - 6; z > zNorth + 4; z -= 14) {
    for (const sgn of [-1, 1]) {
      const x = ax + sgn * (hw + 1.2);
      v.addLamp(X.lampPost(ctx, { x, z, rot: sgn > 0 ? Math.PI / 2 : -Math.PI / 2 }));
    }
  }

  // --------------------------------------------------- O Topo (5º terraço)
  const top = L[4];
  const pz = top.cz - 4; // Salão do Primeiro Degrau, de frente para a Escada (sul)
  const palace = throneHall(ctx, { x: ax, z: pz });
  v.reserve(ax, pz, 18);
  // Gongo do Topo, na chegada da Escada.
  const gz = top.cz + top.r - 9, gx = ax + 7;
  gong(ctx, { x: gx, z: gz, rot: Math.PI / 2 });
  v.reserve(gx, gz, 3);
  game.interactions.register({
    id: 'coroa-gongo', label: 'Ver o Gongo do Topo', radius: 3.5,
    position: { x: gx, y: ground(gx, gz) + 1.6, z: gz },
    onInteract: (g) => Mechanics.talk(g, { speaker: 'Gongo do Topo', title: 'Ferro de 2 m',
      text: 'Uma batida é a hora. Sete batidas, uma vez por ano: o Juramento diante da Porta de Ferro Cego.' }),
  });
  // Estátua maior no Topo: o leão sentado de frente, sobre o pedestal "Ninguém acima".
  {
    const x = ax - 8, z = gz, y = ground(x, z);
    ctx.batch.add(B.G.box, M.stoneDark, { x, y: y + 1.5, z, sx: 4, sy: 3, sz: 4 });
    v.statues.push({ model: 'leao', x, z, y: y + 3, rot: Math.PI, length: 6.5 });
    ctx.collisions.addCircle(x, z, 2.8, 'statue');
    v.reserve(x, z, 3.5);
    game.interactions.register({
      id: 'coroa-pedestal', label: 'Ler o pedestal', radius: 3.6, position: { x, y: y + 1.5, z: z + 2.2 },
      onInteract: (g) => Mechanics.talk(g, { speaker: 'Pedestal de granito', title: 'Avenida dos Leões', text: '"NINGUÉM ACIMA."' }),
    });
  }
  // Porta de Ferro Cego (Santuário da Coroa Recusada), atrás do Salão.
  {
    const x = ax, z = top.cz - top.r + 5, y = ground(x, z);
    B.part(ctx, B.G.box, M.iron, x, z, 0, y, { ly: 1.6, w: 2.2, h: 3.2, d: 0.25 });
    B.part(ctx, B.G.box, M.stoneDark, x, z, 0, y, { ly: 2, lz: -0.6, w: 4.6, h: 4.4, d: 1 });
    ctx.collisions.addBox(x, z - 0.4, 2.3, 0.6, 0, 'wall');
    v.reserve(x, z, 3);
    game.interactions.register({
      id: 'coroa-porta-ferro', label: 'Examinar a porta de ferro', radius: 3, position: { x, y: y + 1.5, z: z + 0.8 },
      onInteract: (g) => Mechanics.talk(g, { speaker: 'Porta de Ferro Cego', title: 'Santuário da Coroa Recusada',
        text: 'Lisa, sem fechadura visível. O ferro está gelado mesmo ao sol, e a geada desenha sete pontas.' }),
    });
  }
  // Jardins do Orgulho Real: pátio de rochas a leste do Salão.
  for (let k = 0; k < 7; k++) {
    const x = ax + 15 + r() * 8, z = top.cz - 8 + r() * 14;
    if (inLevel(4, x, z, 3)) { B.rock(ctx, { x, z, s: 1 + r() * 1.4 }); v.reserve(x, z, 1.5); }
  }

  // -------------------------------------------- A Juba (4º terraço): nobreza
  const juba = L[3];
  // Salão da Face Branca (a única fachada branca da cidade), a oeste da Escada.
  {
    const x = ax - 26, z = juba.cz + 18;
    B.church(ctx, { x, z, rot: faceTo(x, z, ax, z), scale: 1.2, wall: M.adobeWhite });
    v.reserve(x, z, 14);
    v.addNPC({ id: 'coroa-nadra', name: 'Nadra Selume', title: 'Juíza da Face Branca',
      look: { robe: true, shirt: 0xe8e4dc, hat: 'wrap', height: 1.7 }, x: x + 7, z: z + 2, facing: Math.PI / 2,
      onInteract: (g) => Mechanics.talk(g, { speaker: 'Nadra Selume', title: 'Juíza da Face Branca',
        text: '"A máscara tira o meu rosto para que só a lei fale. Até diante do Primeiro. Em tese."' }) });
  }
  // Quartel da Guarda Leonina, a leste.
  {
    const x = ax + 27, z = juba.cz + 16;
    B.house(ctx, { x, z, rot: faceTo(x, z, ax, z), w: 16, d: 10, h: 5, wall: M.stoneDark, roof: 'tile', roofMat: M.stoneDark });
    v.reserve(x, z, 11);
    v.addNPC({ id: 'coroa-kesh', name: 'Kesh Varo', title: 'Capitão da Guarda Leonina',
      look: { shirt: 0x6a2a1c, pants: 0x2a2622, hat: 'wrap', accessory: 'spear', build: 1.2, height: 1.9 },
      x: x - 9, z: z + 1, facing: -Math.PI / 2,
      onInteract: (g) => Mechanics.talk(g, { speaker: 'Kesh Varo', title: 'Capitão da Guarda Leonina',
        text: '"Vença um duelo no pátio e talvez o Primeiro saiba seu nome. Perca, e ninguém saberá."' }) });
  }
  // Câmara dos Mantos (torre baixa) com o Livro das Alturas.
  {
    const x = ax - 14, z = juba.cz - 22, y = ground(x, z);
    B.part(ctx, B.G.box, M.stone, x, z, 0, y - 0.3, { ly: 4, w: 7, h: 8, d: 7 });
    B.part(ctx, B.G.pyramid, M.stoneDark, x, z, 0, y - 0.3, { ly: 9.6, w: 8, h: 3.2, d: 8 });
    B.part(ctx, B.G.box, M.darkOpening, x, z, faceTo(x, z, ax, z), y, { lz: 3.55, ly: 1.1, w: 1.4, h: 2.2, d: 0.1 });
    ctx.collisions.addBox(x, z, 3.6, 3.6, 0, 'house');
    v.reserve(x, z, 6);
    v.addNPC({ id: 'coroa-sevra', name: 'Sevra Dun', title: 'Arquivista da Câmara dos Mantos',
      look: { robe: true, shirt: 0x3a3440, hat: 'wrap', height: 1.66 }, x: x + 4.5, z: z + 2, facing: Math.PI / 2,
      onInteract: (g) => Mechanics.talk(g, { speaker: 'Sevra Dun', title: 'O Livro das Alturas',
        text: '"Corrijo o nome do Primeiro para o Topo. Na manhã seguinte, ele está no 1º terraço outra vez."' }) });
  }
  // Mansões da Juba (granito, telhado de ardósia, 2 pisos).
  for (let k = 0; k < 8; k++) {
    const p = spotIn(3, 8, 7); if (!p) break;
    const w = 12 + r() * 3, d = 9 + r() * 2;
    B.house(ctx, { x: p.x, z: p.z, rot: faceTo(p.x, p.z, juba.cx, juba.cz), w, d, h: 6, wall: M.stone, roof: 'tile', roofMat: M.stoneDark });
    v.reserve(p.x, p.z, Math.hypot(w, d) / 2 + 1.5);
  }

  // -------------------------------------- O Ombro (3º terraço): mercado
  const ombro = L[2];
  {
    // Mercado do Patamar: bancas dos dois lados do patamar da Escada.
    const [zs, ze] = landing[2];
    const zm = (zs + ze) / 2;
    for (const sgn of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const x = ax + sgn * (hw + 8 + (k % 2) * 5), z = zm - 6 + Math.floor(k / 2) * 9;
        if (!inLevel(2, x, z, 2.5) || !v.isFree(x, z, 2)) continue;
        B.marketStall(ctx, { x, z, rot: sgn > 0 ? -Math.PI / 2 : Math.PI / 2 });
        v.reserve(x, z, 2.4);
      }
    }
    const bx = ax + hw + 4, bz = zm + 9, by = ground(bx, bz);
    B.part(ctx, B.G.cyl, M.iron, bx, bz, 0, by, { ly: 1.4, w: 0.1, h: 2.8, d: 0.1 });
    B.part(ctx, B.G.box, M.iron, bx, bz, 0, by, { ly: 2.7, w: 2.4, h: 0.12, d: 0.12 });
    for (const s of [-1, 1]) B.part(ctx, B.G.cyl, M.brass, bx, bz, 0, by, { lx: s * 1.1, ly: 2.2, w: 0.4, h: 0.08, d: 0.4 });
    ctx.collisions.addCircle(bx, bz, 0.6, 'post');
    game.interactions.register({
      id: 'coroa-balanca', label: 'Ver a balança do Primeiro', radius: 3, position: { x: bx, y: by + 1.5, z: bz },
      onInteract: (g) => Mechanics.talk(g, { speaker: 'Oboro Lennt', title: 'Balança do Primeiro',
        text: '"Todo latão que sobe a Escada passa por aqui. E tudo que passa por aqui deve alguma coisa a alguém."' }),
    });
    v.reserve(bx, bz, 2);
  }
  // Taverna do Último Patamar.
  {
    const p = spotIn(2, 9, 7);
    if (p) {
      B.house(ctx, { x: p.x, z: p.z, rot: faceTo(p.x, p.z, ax, p.z), w: 13, d: 9, h: 5.5, wall: M.stone, roof: 'tile', roofMat: M.woodDark });
      v.reserve(p.x, p.z, 9.5);
    }
  }
  for (let k = 0; k < 16; k++) {
    const p = spotIn(2, 5.5, 6); if (!p) break;
    const w = 8 + r() * 2, d = 6 + r() * 1.5;
    X.logCabin(ctx, { x: p.x, z: p.z, rot: faceTo(p.x, p.z, ombro.cx, ombro.cz), w, d, stories: r() < 0.6 ? 2 : 1, logMat: M.woodDark });
    v.reserve(p.x, p.z, Math.hypot(w, d) / 2 + 1);
  }

  // -------------------------------------- A Pata (2º terraço): forjas
  const pata = L[1];
  {
    const x = ax + 24, z = pata.cz + pata.r - 26;
    B.house(ctx, { x, z, rot: faceTo(x, z, ax, z), w: 14, d: 9, h: 4.5, wall: M.stoneDark, roof: 'tin' });
    const chim = B.local(x, z, faceTo(x, z, ax, z), 4, -2);
    ctx.batch.add(B.G.box, M.stoneDark, { x: chim.x, y: ground(chim.x, chim.z) + 6, z: chim.z, sx: 1.4, sy: 12, sz: 1.4 });
    const fire = B.local(x, z, faceTo(x, z, ax, z), 0, 7.5);
    v.addFire(X.bonfire(ctx, { x: fire.x, z: fire.z, size: 0.8 }), { intensity: 30, range: 16 });
    v.reserve(x, z, 11);
    v.addNPC({ id: 'coroa-ilvo', name: 'Ilvo Tarkan', title: 'Mestre da Forja Real',
      look: { shirt: 0x4a3a2c, pants: 0x2a2622, build: 1.25 }, x: fire.x + 2, z: fire.z, facing: -Math.PI / 2,
      onInteract: (g) => Mechanics.talk(g, { speaker: 'Ilvo Tarkan', title: 'Forja Real da Pata',
        text: '"Reforjo a coroa de ferro do Primeiro todo ano. Este ano ele pediu sete pontas. Como a outra."' }) });
  }
  for (let k = 0; k < 30; k++) {
    const p = spotIn(1, 5, 6); if (!p) break;
    const w = 7 + r() * 2, d = 5.5 + r() * 1.5, rot = faceTo(p.x, p.z, pata.cx, pata.cz);
    if (r() < 0.5) X.logCabin(ctx, { x: p.x, z: p.z, rot, w, d, stories: r() < 0.3 ? 2 : 1, logMat: M.log });
    else B.house(ctx, { x: p.x, z: p.z, rot, w, d, h: 3.2, wall: M.stone, roof: 'tile', roofMat: M.woodDark });
    v.reserve(p.x, p.z, Math.hypot(w, d) / 2 + 1);
    if (r() < 0.25) { const q = B.local(p.x, p.z, rot, w / 2 + 1.4, 0); if (v.isFree(q.x, q.z, 1)) { X.cart(ctx, { x: q.x, z: q.z, rot }); v.reserve(q.x, q.z, 1.6); } }
  }

  // -------------------------------------- O Pé (1º terraço): mineiros
  const pe = L[0];
  // Quatro fogueiras comunitárias que nunca se apagam.
  const fires = [];
  for (const [fx, fz] of [[-48, 70], [48, 70], [-70, 20], [70, 20]]) {
    const x = ax + fx, z = pe.cz + fz;
    if (!inLevel(0, x, z, 4)) continue;
    v.addFire(X.bonfire(ctx, { x, z, size: 1.4 }), { intensity: 50, range: 26 });
    v.reserve(x, z, 7);
    fires.push({ x, z });
  }
  if (fires[0]) {
    const f = fires[0];
    v.addNPC({ id: 'coroa-mae-ossa', name: 'Mãe Ossa', title: 'Mineira aposentada',
      look: { shirt: 0x5a4a3a, pants: 0x3a3028, hat: 'wrap', height: 1.55 }, x: f.x + 3, z: f.z + 1.5, facing: -2,
      onInteract: (g) => Mechanics.talk(g, { speaker: 'Mãe Ossa', title: 'Fogueira do Pé',
        text: '"Eu limpei o nariz daquele menino antes de ele virar o Primeiro. Lá de cima ninguém lembra disso."' }) });
  }
  for (let k = 0; k < 70; k++) {
    const p = spotIn(0, 4.2, 9); if (!p) break;
    const w = 6 + r() * 1.5, d = 5 + r() * 1, rot = faceTo(p.x, p.z, pe.cx, pe.cz);
    X.logCabin(ctx, { x: p.x, z: p.z, rot, w, d, stories: 1, logMat: r() < 0.5 ? M.frozenLog : M.log });
    v.reserve(p.x, p.z, Math.hypot(w, d) / 2 + 0.8);
    const q = B.local(p.x, p.z, rot, w / 2 + 1.2, 0);
    if (r() < 0.45 && v.isFree(q.x, q.z, 1)) { X.woodpile(ctx, { x: q.x, z: q.z, rot, logMat: M.frozenLog }); v.reserve(q.x, q.z, 1.1); }
  }
  for (let k = 0; k < 10; k++) { const p = spotIn(0, 2.6, 9); if (!p) break; X.hideRack(ctx, { x: p.x, z: p.z, rot: r() * 6.28 }); v.reserve(p.x, p.z, 2.6); }
  for (let k = 0; k < 16; k++) { const p = spotIn(0, 0.9, 8); if (!p) break; v.props.push({ type: 'log', x: p.x, z: p.z, rot: r() * 6.28 }); v.reserve(p.x, p.z, 0.9); }

  // Ruas: anéis no meio de cada nível ligados à Escada (caminho dos transeuntes).
  for (let i = 0; i < L.length - 1; i++) {
    const l = L[i], up = L[i + 1];
    const rr = (l.r + up.r - (l.cz - up.cz)) / 2; // meio da faixa ao sul
    const segs = 28;
    for (let k = 0; k < segs; k++) {
      const a = (k / segs) * Math.PI * 2, b = ((k + 1) / segs) * Math.PI * 2;
      const pa = { x: l.cx + Math.cos(a) * rr, z: l.cz + Math.sin(a) * rr }, pb = { x: l.cx + Math.cos(b) * rr, z: l.cz + Math.sin(b) * rr };
      if (inLevel(i, pa.x, pa.z, 3) && inLevel(i, pb.x, pb.z, 3)) v.street(pa.x, pa.z, pb.x, pb.z, 3.2, 0x5a5650);
    }
  }

  // Ancião (lore): o guarda do Portão do Pé.
  v.addElder(ax + hw + 3, pe.cz + pe.r - 12, Math.PI);
  v.addNPC({ id: 'coroa-iru', name: 'Iru', title: 'Vigia do Pé',
    look: { shirt: 0x4a4038, pants: 0x2e2a26, hat: 'wrap', height: 1.72 }, x: ax - hw - 3, z: pe.cz + pe.r - 16, facing: Math.PI,
    onInteract: (g) => Mechanics.talk(g, { speaker: 'Iru', title: 'Vigia do Pé',
      text: '"De noite a gente escala as muralhas. Não para roubar: para provar que a altura não se herda."' }) });
  v.addWanderers(22, { shirt: 0x5a4632, pants: 0x2e2a26, hat: 'wrap' });

  v.palace = palace;
  v.finalize();
  return v;
}

/**
 * Salão do Primeiro Degrau: corpo de granito escuro, telhado íngreme de
 * ardósia, torre central de 26 m e portas de 4 m com tachas de latão.
 */
function throneHall(ctx, { x, z }) {
  const { M } = ctx;
  const w = 30, d = 16, h = 9;
  const y0 = B.groundUnder(ctx, x, z, 0, w / 2, d / 2) - 0.3;
  const P = (geo, mat, o) => B.part(ctx, geo, mat, x, z, 0, y0, o);
  P(B.G.box, M.stoneDark, { ly: 0.6, w: w + 2, h: 1.2, d: d + 2 });
  P(B.G.box, M.stone, { ly: 1.2 + h / 2, w, h, d });
  P(B.G.pyramid, M.stoneDark, { ly: 1.2 + h + 4, w: w + 1.4, h: 8, d: d + 1.4 });
  P(B.G.box, M.stone, { ly: 13, w: 6, h: 26, d: 6 }); // torre
  P(B.G.pyramid, M.stoneDark, { ly: 28.5, w: 7, h: 5, d: 7 });
  P(B.G.box, M.woodDark, { lz: d / 2 + 0.05, ly: 1.2 + 2, w: 3.4, h: 4, d: 0.2 }); // portas
  for (let i = 0; i < 24; i++) P(B.G.sphere, M.brass, { lz: d / 2 + 0.17, lx: -1.4 + (i % 6) * 0.56, ly: 1.7 + Math.floor(i / 6) * 0.9, w: 0.12, h: 0.12, d: 0.08 });
  for (const s of [-1, 1]) {
    P(B.G.sphere, M.iron, { lx: s * (w / 2), ly: 1.2 + h + 0.5, w: 1.1, h: 1, d: 1.1 }); // cabeças de leão nas pontas
    P(B.G.box, M.stoneDark, { lx: s * 3, lz: d / 2 + 1.2, ly: 0.6 + 0.3, w: 1.2, h: 1.8, d: 1.2 });
  }
  ctx.collisions.addBox(x, z, w / 2 + 1, d / 2 + 1, 0, 'house');
  ctx.surfaces?.addBox({ x, z: z + d / 2 + 1.5, hw: w / 2 + 1, hd: 1.5, rot: 0, y: y0 + 1.2 });
  return { x, z, y0 };
}

/** Gongo de ferro de 2 m num pórtico de lariço. */
function gong(ctx, { x, z, rot = 0 }) {
  const { M } = ctx;
  const y0 = ctx.terrain.heightAt(x, z);
  const P = (geo, mat, o) => B.part(ctx, geo, mat, x, z, rot, y0, o);
  for (const s of [-1, 1]) P(B.G.cyl, M.log, { lx: s * 1.4, ly: 1.7, w: 0.22, h: 3.4, d: 0.22 });
  P(B.G.cyl, M.log, { ly: 3.35, w: 0.2, h: 3.2, d: 0.2, rz: Math.PI / 2 });
  P(B.G.cyl, M.iron, { ly: 2, w: 1, h: 0.12, d: 1, rx: Math.PI / 2 });
  ctx.collisions.addBox(x, z, 1.7, 0.4, rot, 'post');
  return new THREE.Vector3(x, y0, z);
}
