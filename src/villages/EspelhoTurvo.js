import { Village } from './Village.js';
import * as B from './Builders.js';
import * as X from './BuildersExtra.js';
import { VILLAGES } from '../config/villages.js';
import { Mechanics } from '../systems/Mechanics.js';

/**
 * VALE DO ESPELHO-TURVO — sede da tribo de Afguns, na Floresta Tropical.
 * Design: design/narrative/espelho-turvo.md (Partes IV–VI e XV).
 *
 * Um vale com um lago reto (Lago Nhanzu) no eixo norte–sul. As duas margens
 * são construídas IGUAIS por espelhamento (`pair`): a margem oeste é a
 * "Segunda", onde Afguns governa da Casa Segunda; a leste, a "Primeira", com
 * a Casa Primeira vazia (falta-lhe uma coluna, de propósito). No meio da água,
 * 6 m fora do eixo, a Ilhota do Erro (Santuário do Escudo), ligada à margem
 * oeste por pedras de passagem. Pontes de corda cruzam o lago; Casas de
 * Lavagem guardam as duas entradas (norte, junto à cachoeira, e sul).
 *
 * Espelhar = mesma posição com x refletido e rotação negada (sem escala
 * negativa nas matrizes, que inverteria as faces).
 */
export function buildEspelhoTurvo(game) {
  const cfg = VILLAGES.espelhoTurvo;
  const v = new Village(game, cfg, 1712);
  const { ctx } = v;
  const { M } = ctx;
  const cx = v.x, cz = v.z;
  const r = v.rnd;
  const LAKE0 = cfg.lake;
  const floor = ctx.terrain.heightAt(cx - LAKE0.hw - 12, cz); // chão das margens (área aplainada)
  const waterY = floor - cfg.lake.waterBelow;
  const ground = (x, z) => ctx.terrain.heightAt(x, z);
  const say = (speaker, title, text) => (g) => Mechanics.talk(g, { speaker, title, text });
  /** Constrói o mesmo elemento nas duas margens: fn(x, z, rot, lado) com lado −1 = oeste, +1 = leste. */
  const pair = (lx, lz, rot, fn) => { fn(cx - lx, cz + lz, rot, -1); fn(cx + lx, cz + lz, -rot, 1); };
  const LAKE = cfg.lake;

  // ------------------------------------------------ Lago Nhanzu (água própria)
  ctx.batch.add(B.G.box, M.waterOasis, { x: cx, y: waterY, z: cz, sx: LAKE.hw * 2 + 3, sy: 0.05, sz: LAKE.hd * 2 + 3 });
  v.reserve(cx, cz, 0);
  // Cais de pedra nas duas bordas compridas.
  pair(LAKE.hw + 1, 0, 0, (x, z) => {
    ctx.batch.add(B.G.box, M.basalt, { x, y: floor - 0.3, z, sx: 1.6, sy: 1.0, sz: LAKE.hd * 2 });
  });

  // Cachoeira na ponta norte (faixa vertical de água) e corredeiras ao sul.
  {
    const z = cz - LAKE.hd - 12, top = ground(cx, z - 10);
    ctx.batch.add(B.G.box, M.waterOasis, { x: cx, y: (top + waterY) / 2, z: z + 4, sx: 14, sy: Math.max(4, top - waterY), sz: 0.3 });
    ctx.batch.add(B.G.box, M.waterOasis, { x: cx, y: waterY, z: z + 8, sx: 18, sy: 0.05, sz: 10 });
    v.npcSpots.push({ x: cx + 14, z: z + 10, r: 3 });
  }

  // ------------------------------------------------ Ilhota do Erro (Santuário do Escudo)
  {
    const ix = cx + 6, iz = cz;
    ctx.batch.add(B.G.cyl, M.basalt, { x: ix, y: waterY - 0.8, z: iz, sx: 11, sy: 2 + 0.9, sz: 8 });
    ctx.surfaces.addBox({ x: ix, z: iz, hw: 9, hd: 6.5, rot: 0, y: waterY + 0.65 });
    const y0 = waterY + 0.65;
    B.part(ctx, B.G.box, M.basaltDark, ix, iz, 0, y0, { ly: 2, w: 12, h: 4, d: 8 });
    B.part(ctx, B.G.pyramid, M.thatch, ix, iz, 0, y0, { ly: 5.4, w: 13.5, h: 3, d: 9.5 });
    B.part(ctx, B.G.box, M.darkOpening, ix, iz, -Math.PI / 2, y0, { lz: 4.05, ly: 1.05, w: 1.2, h: 2.1, d: 0.1 });
    ctx.collisions.addBox(ix, iz, 6, 4, 0, 'house');
    // Pedras de passagem da margem oeste até a ilhota (secas na Água Parada).
    const sx0 = cx - LAKE.hw, n = 12;
    for (let k = 1; k < n; k++) {
      const x = sx0 + (k / n) * (ix - 6 - sx0), z = iz + Math.sin(k * 1.3) * 0.6;
      ctx.batch.add(B.G.cyl6, M.basalt, { x, y: waterY - 0.3, z, ry: k, sx: 0.9, sy: 1.0, sz: 0.9 });
      ctx.surfaces.addDisc({ x, z, r: 0.95, y: waterY + 0.2 });
    }
    game.interactions.register({
      id: 'espelho-ilhota', label: 'Pedir para entrar na Ilhota', radius: 3.5,
      position: { x: ix - 7, y: y0 + 1.5, z: iz },
      onInteract: say('Akweli Doro', 'Par do Escudo', '"O Escudo não se mostra a quem só veio olhar. Volte com um Par, e talvez o Mestre deixe."'),
    });
    for (const s of [-1, 1]) v.addNPC({ id: `espelho-par-escudo-${s}`, name: s < 0 ? 'Hune Doro' : 'Akweli Doro', title: 'Par do Escudo',
      look: { robe: true, shirt: 0x1e2a24, hat: 'wrap', accessory: 'spear', height: 1.8 }, x: ix - 7, z: iz + s * 1.8, facing: -Math.PI / 2 });
  }

  // ------------------------------------------------ Casa Segunda (oeste) e Casa Primeira (leste)
  pair(54, -6, Math.PI / 2, (x, z, rot, side) => {
    pairPalace(ctx, { x, z, rot, missingColumn: side > 0 });
    v.reserve(x, z, 17);
  });
  // Afguns diante da Casa Segunda, de máscara.
  v.addNPC({ id: 'espelho-afguns', name: 'Afguns', title: 'O Mestre (Espelho-Turvo)',
    look: { robe: true, shirt: 0xd8d4c8, hat: 'wrap', accessory: 'staff', height: 1.72, build: 0.9 },
    x: cx - 40, z: cz - 6, facing: Math.PI / 2,
    onInteract: say('Afguns', 'O Mestre', '"Lave as mãos antes de falar comigo. Depois diga: em que você é o segundo melhor?"') });
  game.interactions.register({
    id: 'espelho-casa-primeira', label: 'Olhar a Casa Primeira', radius: 4,
    position: { x: cx + 40, y: floor + 1.6, z: cz - 6 },
    onInteract: say('Casa Primeira', 'O palácio vazio',
      'Igual à Casa Segunda, menos uma coluna. Ninguém mora aqui. Ela espera quem vencer o Mestre.'),
  });

  // ------------------------------------------------ Salão das Formas (leste) e Casa dos Estudos (oeste)
  pair(60, -58, Math.PI / 2, (x, z, rot, side) => {
    B.house(ctx, { x, z, rot, w: 18, d: 12, h: 5, wall: side > 0 ? M.adobeRed : M.adobeWhite, roof: 'thatch' });
    v.reserve(x, z, 12);
  });
  // Pátio de treino (areia) diante do Salão das Formas, com dois Pares treinando.
  {
    const x = cx + 42, z = cz - 58;
    v.paintDisc(x, z, 7, 0xd8c8a0, 0.9);
    v.npcSpots.push({ x, z, r: 5 });
    v.addNPC({ id: 'espelho-dauro', name: 'Dauro Kesse', title: 'Mestre de formas', look: { shirt: 0x7a2a22, pants: 0x2a2018, hat: 'wrap', accessory: 'spear', build: 1.1 },
      x: x - 1.5, z, facing: Math.PI / 2,
      onInteract: say('Dauro Kesse', 'Salão das Formas', '"Sou o melhor aqui e nunca vou votar. Aqui o primeiro aprende; quem decide é o segundo."') });
    v.addNPC({ id: 'espelho-sela', name: 'Sela Imvuro', title: 'A Primeira Avaliadora', look: { robe: true, shirt: 0x2a4a3a, hat: 'wrap', height: 1.68 },
      x: x + 3, z: z + 3, facing: -2.4,
      onInteract: say('Sela Imvuro', 'Avaliadora', '"Não julgo quem é melhor. Julgo quem errou menos hoje. Amanhã a conta recomeça."') });
  }
  v.addNPC({ id: 'espelho-ritu', name: 'Ritu Soba', title: 'Sábia das Amostras', look: { robe: true, shirt: 0x4a4a6a, hat: 'wrap', height: 1.62 },
    x: cx - 44, z: cz - 52, facing: Math.PI / 2,
    onInteract: say('Ritu Soba', 'Casa dos Estudos', '"Troco cartas com uma jovem do Véu. Ela estuda a Palidez; eu, o que o Escudo devolve."') });

  // ------------------------------------------------ Mercados (Fora a oeste, Dentro a leste)
  pair(48, 32, 0, (x, z, rot, side) => {
    for (let k = 0; k < 6; k++) {
      const sx = x + side * ((k % 3) * 6 - 6), sz = z + Math.floor(k / 3) * 7 - 3.5;
      B.marketStall(ctx, { x: sx, z: sz, rot: side > 0 ? -Math.PI / 2 : Math.PI / 2 });
      v.reserve(sx, sz, 2.4);
    }
    v.npcSpots.push({ x, z, r: 6 });
  });

  // ------------------------------------------------ Bairros-Par (casas longas, espelhadas)
  const rows = [52, 66, 80, 94];
  for (const lz of rows) {
    for (const lx of [44, 62, 80, 98]) {
      if (Math.hypot(lx, lz) > cfg.radius - 12) continue;
      const rot = lz % 28 === 24 ? 0 : Math.PI; // portas alternam para as ruas
      pair(lx, lz, rot, (x, z, rr, side) => {
        B.house(ctx, { x, z, rot: rr, w: 10, d: 5.5, h: 3.2, wall: side > 0 ? M.adobeRed : M.adobeOchre, roof: 'thatch' });
        v.reserve(x, z, 6);
      });
    }
  }
  // Ruas das margens (passeios de laterita) e as transversais dos bairros.
  pair(LAKE.hw + 4.5, 0, 0, (x) => v.street(x, cz - LAKE.hd, x, cz + LAKE.hd, 4, 0x9a5a3a));
  for (const lz of [45, 59, 73, 87, 101]) pair(70, lz, 0, (x, z, rot, side) => v.street(x - side * 30, z, x + side * 34, z, 3, 0x9a5a3a));

  // ------------------------------------------------ Jardins de Ervas (norte, simétricos)
  for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
    pair(44 + i * 9, -90 - j * 8, 0, (x, z) => {
      if (j % 2) v.plants.push({ type: 'banana', x, z, s: 0.9, ry: 0 });
      else B.bush(ctx, { x, z, s: 0.8 });
    });
  }
  pair(54, -88, 0, (x, z) => v.npcSpots.push({ x, z, r: 6 }));

  // ------------------------------------------------ Pontes de corda sobre o lago
  for (const lz of [-90, 70]) {
    const a = { x: cx - LAKE.hw - 1, z: cz + lz, y: floor + 0.25 }, b = { x: cx + LAKE.hw + 1, z: cz + lz, y: floor + 0.25 };
    X.ropeBridge(ctx, { a, b, width: 1.6, sag: 0.7 });
    pair(LAKE.hw + 3, lz, 0, (x, z) => v.npcSpots.push({ x, z, r: 2 }));
  }

  // ------------------------------------------------ Casas dos Pares (guarda) e torres camufladas
  pair(70, 118, 0, (x, z, rot) => {
    X.watchTower(ctx, { x, z, rot: Math.PI, h: 12 });
    v.reserve(x, z, 4);
  });

  // ------------------------------------------------ Casas de Lavagem (entradas sul e norte)
  for (const [lz, rot, id] of [[LAKE.hd + 14, Math.PI, 'sul'], [-LAKE.hd - 2, 0, 'norte']]) {
    const x = id === 'sul' ? cx : cx - 40, z = cz + lz;
    B.house(ctx, { x, z, rot, w: 12, d: 8, h: 3.6, wall: M.adobeWhite, roof: 'thatch' });
    v.reserve(x, z, 9);
    const door = B.local(x, z, rot, 0, 6);
    game.interactions.register({
      id: `espelho-lavagem-${id}`, label: 'Lavar-se', radius: 3.2,
      position: { x: door.x, y: ground(door.x, door.z) + 1.2, z: door.z },
      onInteract: (g) => {
        g.survival?.wash?.();
        Mechanics.talk(g, { speaker: 'Nyela Tumbi', title: 'Casa de Lavagem',
          text: '"Pronto. Agora você pode tocar nas coisas do vale. Se sujar de novo, volte. Volte sempre."' });
      },
    });
  }
  v.addNPC({ id: 'espelho-nyela', name: 'Nyela Tumbi', title: 'Lavadora-Chefe', look: { robe: true, shirt: 0xf0f0e8, hat: 'wrap', height: 1.64 },
    x: cx + 3, z: cz + LAKE.hd + 20, facing: Math.PI });

  // Ancião (lore) no Portão do Corte, ao sul.
  v.addElder(cx - 4, cz + LAKE.hd + 22, Math.PI);
  v.addWanderers(22, { shirt: 0xd8c8a0, hat: 'wrap' });
  v.finalize();
  return v;
}

/**
 * Casa Segunda / Casa Primeira: palácio de laterita com alpendre de colunas e
 * telhado de palha alto. A Primeira não tem uma das colunas (Parte VI).
 */
function pairPalace(ctx, { x, z, rot, missingColumn = false }) {
  const { M } = ctx;
  B.house(ctx, { x, z, rot, w: 24, d: 14, h: 6, wall: M.adobeRed, roof: 'thatch' });
  const y0 = B.groundUnder(ctx, x, z, rot, 12, 7) - 0.25;
  const P = (geo, mat, o) => B.part(ctx, geo, mat, x, z, rot, y0, o);
  for (let i = 0; i < 6; i++) {
    if (missingColumn && i === 4) continue;
    P(B.G.cyl, M.woodDark, { lx: -10 + i * 4, lz: 9.2, ly: 2.6, w: 0.28, h: 5.2, d: 0.28 });
    ctx.collisions.addCircle(B.local(x, z, rot, -10 + i * 4, 9.2).x, B.local(x, z, rot, -10 + i * 4, 9.2).z, 0.35, 'post');
  }
  P(B.G.box, M.woodDark, { lz: 9.2, ly: 5.3, w: 22, h: 0.4, d: 0.5 });
  P(B.G.box, M.thatch, { lz: 8.4, ly: 5.6, w: 24, h: 0.3, d: 3.6, rx: -0.25 });
}
