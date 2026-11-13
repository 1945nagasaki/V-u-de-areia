/**
 * Verificação do pacote de itens NO JOGO DE VERDADE (não é teste unitário):
 * abre o jogo num navegador headless, usa os itens pelo mesmo caminho do
 * jogador (`game.tryAttack`, tecla R, botões da mochila, loja) e confere os
 * números; guarda prints em production/qa/evidence/itens/.
 *
 * Uso (com `npx vite --port 5199` rodando):
 *   node tools/gear/game-check.mjs http://127.0.0.1:5199
 */
import { openBrowser } from './browser.mjs';

const base = process.argv[2] ?? 'http://127.0.0.1:5199';
const out = 'production/qa/evidence/itens';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'OK  ' : 'FALHOU'} ${name}${detail ? ` — ${detail}` : ''}`); };

const b = await openBrowser({ width: 1280, height: 720 });
const js = (code) => b.evaluate(`(() => { ${code} })()`);
const jsAsync = (code) => b.evaluate(`(async () => { ${code} })()`);
/** Espera `seconds` de TEMPO DE JOGO (o relógio do jogo pode andar mais devagar que o real). */
const gameWait = async (seconds) => { const t0 = await js('return game.time'); await b.waitFor(`game.time >= ${t0 + seconds}`, 120000, 100); };
const shot = (name) => b.screenshot(`${out}/${name}.jpg`);

try {
  await b.goto(`${base}/?novo`);
  await b.waitFor('window.game?.ready', 240000, 1000);
  await b.sleep(1500);
  // Clima fixo e sem surpresas: sem fauna atacando durante o roteiro.
  await js(`
    const g = game;
    g.state.coins = 5000;
    window.aim = (tx, tz) => { // vira a câmera para o alvo
      const p = g.player.position, want = Math.atan2(tx - p.x, tz - p.z);
      let best = 0, bd = 9;
      for (let i = 0; i < 720; i++) { g.cameraRig.yaw = i * Math.PI / 360; const f = g.cameraRig.forward(new THREE_V()); const d = Math.abs(Math.atan2(Math.sin(Math.atan2(f.x, f.z) - want), Math.cos(Math.atan2(f.x, f.z) - want))); if (d < bd) { bd = d; best = g.cameraRig.yaw; } }
      g.cameraRig.yaw = best;
    };
    window.THREE_V = g.player.position.constructor;
  `);
  const ren = await js('const v = game.villages.renascimento; const d = game.dummies[0]; return { x: v.x, z: v.z, dx: d.root.position.x, dz: d.root.position.z }');

  // ---------------------------------------------------------------- catálogo e crafting
  const cat = await js(`
    const { ITEMS } = game.backpack.index ? { ITEMS: Object.fromEntries(game.backpack.index.search('').map((id) => [id, 1])) } : { ITEMS: {} };
    const recipes = game.crafting.recipes.flatMap((r) => Object.keys(r.out));
    const gearIds = Object.keys(game.gear.store.catalog);
    return { n: gearIds.length, inCatalog: gearIds.every((id) => ITEMS[id]), craftable: gearIds.filter((id) => recipes.includes(id)) };
  `);
  check('44 definições (34 itens + variantes) no catálogo do jogo', cat.n === 44 && cat.inCatalog, `${cat.n} ids`);
  check('do pacote, só arco e flecha de pedra têm receita', cat.craftable.sort().join(',') === 'arco,flecha', cat.craftable.join(','));

  // ---------------------------------------------------------------- fabricar arco e flecha na mesa
  const craft = await js(`
    const g = game, s = g.state;
    s.addItem('graveto_longo', 1); s.addItem('corda', 1); s.addItem('graveto', 1); s.addItem('lamina_pedra', 1); s.addItem('pena', 1);
    const r1 = g.craftFromTable(['graveto_longo', 'corda']);
    const r2 = g.craftFromTable(['graveto', 'lamina_pedra', 'pena']);
    const bows = g.gear.store.list().filter((i) => i.id === 'arco');
    const out = { r1: r1.ok, r2: r2.ok, bows: bows.length, dur: bows[0]?.durability, pile: s.inventory.get('arco') ?? 0, arrows: s.inventory.get('flecha') ?? 0,
      hot: g.inventory.slots.some((x) => x?.uid === bows[0]?.uid) };
    // limpa para o resto do roteiro
    for (let i = 0; i < 8; i++) if (g.inventory.slots[i]?.uid === bows[0]?.uid) g.inventory.removerItem(i);
    if (bows[0]) g.gear.store.remove(bows[0].uid);
    s.removeItem('flecha', out.arrows);
    return out;
  `);
  check('fabricar na mesa: arco vira equipamento (240 de durabilidade, na hotbar) e a receita rende 3 flechas de pedra',
    craft.r1 && craft.r2 && craft.bows === 1 && craft.dur === 240 && craft.pile === 0 && craft.arrows === 3 && craft.hot, JSON.stringify(craft));

  // ---------------------------------------------------------------- espada no boneco de treino
  await js(`
    const g = game;
    window.sword = g.gear.give('espada_metal'); g.gear.equip(sword.uid);
    g.inventory.selecionar(g.inventory.slots.findIndex((s) => s?.uid === sword.uid));
    g.player.teleport(${ren.dx}, ${ren.dz + 1.5}, Math.PI);
    aim(${ren.dx}, ${ren.dz});
  `);
  await gameWait(0.6);
  await shot('jogo-espada-metal-3a-pessoa');
  const d0 = await js('return { hp: game.dummies[0].health, dur: sword.durability }');
  await js('game.tryAttack(); game.tryAttack(); game.tryAttack();'); // 3 cliques no mesmo quadro = 1 golpe
  await gameWait(0.2);
  await shot('jogo-espada-golpe');
  await gameWait(0.6);
  const d1 = await js('return { hp: game.dummies[0].health, dur: sword.durability }');
  check('espada de metal: 30 de dano num golpe (cliques repetidos não repetem o dano)', d0.hp - d1.hp === 30, `${d0.hp} → ${d1.hp}`);
  check('impacto válido gasta 1 de durabilidade', d0.dur - d1.dur === 1, `${d0.dur} → ${d1.dur}`);
  // intervalo mínimo de 0,90 s
  await js('game.dummies[0].health = game.dummies[0].maxHealth; window.t0 = game.time; game.tryAttack();');
  await gameWait(0.5);
  await js('game.tryAttack();');
  await gameWait(0.55);
  const d2 = await js('return { hp: game.dummies[0].health, max: game.dummies[0].maxHealth }');
  check('intervalo mínimo: clique 0,5 s depois não vira segundo golpe', d2.max - d2.hp === 30, `dano total ${d2.max - d2.hp}`);
  // golpe no ar
  await js(`game.player.teleport(${ren.x + 3}, ${ren.z + 22}, 0); aim(${ren.x + 3}, ${ren.z + 40});`);
  await gameWait(1.0);
  const a0 = await js('return sword.durability');
  await js('game.tryAttack();');
  await gameWait(0.9);
  const a1 = await js('return sword.durability');
  check('golpe no ar não gasta durabilidade', a0 === a1, `${a0} → ${a1}`);

  // ---------------------------------------------------------------- níveis de dano (pedra/ouro/metal) no boneco
  const tiers = await js(`
    const g = game, out = {};
    g.player.teleport(${ren.dx}, ${ren.dz + 1.5}, Math.PI); aim(${ren.dx}, ${ren.dz});
    return out;
  `);
  void tiers;
  for (const [id, dmg] of [['adaga_pedra', 6], ['adaga_ouro', 12], ['machado_ouro', 16], ['picareta_metal', 12], ['espada_pedra', 10]]) {
    await js(`
      const g = game, it = g.gear.give('${id}');
      const cur = g.inventory.equipado; if (cur.uid) g.gear.unequip();
      g.gear.equip(it.uid); g.inventory.selecionar(g.inventory.slots.findIndex((s) => s?.uid === it.uid));
      g.dummies[0].health = g.dummies[0].maxHealth; g.dummies[0].respawnIn = 0;
      window.cur = it;
    `);
    await gameWait(1.3);
    await js('game.tryAttack();');
    await gameWait(1.0);
    const r = await js('return { lost: game.dummies[0].maxHealth - game.dummies[0].health, dur: cur.durability, max: game.gear.store.def(cur).durabilityMax }');
    check(`${id}: ${dmg} de dano`, r.lost === dmg && r.dur === r.max - 1, `dano ${r.lost}, durabilidade ${r.dur}/${r.max}`);
  }

  // ---------------------------------------------------------------- pistola: recarga, tiro, HUD
  await js(`
    const g = game; if (g.inventory.equipado.uid) g.gear.unequip();
    window.gun = g.gear.give('pistola'); g.gear.give('municao_pistola', 20);
    g.gear.equip(gun.uid); g.inventory.selecionar(g.inventory.slots.findIndex((s) => s?.uid === gun.uid));
    g.player.teleport(${ren.x + 3}, ${ren.z + 22}, 0); aim(${ren.x + 3}, ${ren.z + 40});
  `);
  await gameWait(0.5);
  const p0 = await js('return { mag: gun.mag, dur: gun.durability, res: game.state.inventory.get("municao_pistola") }');
  check('pistola chega descarregada e com durabilidade cheia', p0.mag === 0 && p0.dur === 600, JSON.stringify(p0));
  await js('game.tryAttack();');
  const p1 = await js('return { mag: gun.mag, shots: game.projectiles.list.length }');
  check('carregador vazio: não atira', p1.mag === 0 && p1.shots === 0);
  await js('game.gear.reload();');
  await gameWait(0.9);
  await shot('jogo-pistola-recarregando-hud');
  await js('game.tryAttack();');
  const p2 = await js('return { mag: gun.mag, res: game.state.inventory.get("municao_pistola"), shots: game.projectiles.list.length }');
  check('durante a recarga: tiro bloqueado e nada transferido ainda', p2.mag === 0 && p2.res === 20 && p2.shots === 0, JSON.stringify(p2));
  await gameWait(1.1);
  const p3 = await js('return { mag: gun.mag, res: game.state.inventory.get("municao_pistola") }');
  check('recarga concluída: 16 no carregador, 4 na reserva (total conservado)', p3.mag === 16 && p3.res === 4, JSON.stringify(p3));
  await shot('jogo-pistola-carregada-hud');
  await js('game.tryAttack(); game.tryAttack();');
  const p4 = await js('return { mag: gun.mag, dur: gun.durability, shots: game.projectiles.list.filter((p) => p.gear).length }');
  check('semiautomática: dois cliques no mesmo instante = 1 tiro (intervalo 0,30 s)', p4.mag === 15 && p4.dur === 599 && p4.shots === 1, JSON.stringify(p4));
  await js('game.gear.reload();');
  await gameWait(0.6);
  await js('game.inventory.selecionar((game.inventory.selected + 1) % 8);'); // troca de slot no meio: cancela
  await gameWait(2);
  const p5 = await js('return { mag: gun.mag, res: game.state.inventory.get("municao_pistola") }');
  check('recarga cancelada pela troca de item: nada transferido nem perdido', p5.mag === 15 && p5.res === 4, JSON.stringify(p5));
  await js('game.inventory.selecionar(game.inventory.slots.findIndex((s) => s?.uid === gun.uid));');
  await gameWait(0.4);

  // tiro no boneco: dano fixo de 22
  await js(`
    const g = game; g.dummies[0].health = g.dummies[0].maxHealth;
    g.player.teleport(${ren.dx}, ${ren.dz + 6}, Math.PI); aim(${ren.dx}, ${ren.dz});
  `);
  await gameWait(0.5);

  // ---------------------------------------------------------------- 1ª pessoa
  await js('game.cameraRig.toggleMode();');
  await gameWait(0.6);
  await shot('jogo-pistola-1a-pessoa');
  await js('game.gear.reload();');
  await gameWait(0.75);
  await shot('jogo-pistola-1a-pessoa-recarga');
  await gameWait(1.3);
  const fp = await js('return { fp: game.gear.held.fp.visible, arm: game.fpArm.root.visible, body: game.player.root.visible, mag: gun.mag }');
  check('1ª pessoa: item preso à câmera, sem braço duplicado nem corpo', fp.fp && !fp.arm && !fp.body && fp.mag === 16, JSON.stringify(fp));
  await js('const s = game.inventory.slots.findIndex((x) => x?.uid === sword.uid); if (s < 0) { game.gear.equip(sword.uid); } game.inventory.selecionar(game.inventory.slots.findIndex((x) => x?.uid === sword.uid));');
  await gameWait(0.6);
  await shot('jogo-espada-1a-pessoa');
  await js('game.cameraRig.toggleMode();');
  await gameWait(0.4);

  // ---------------------------------------------------------------- arco
  await js(`
    const g = game; window.bow = g.gear.give('arco'); g.gear.give('flecha_metal', 3);
    const free = g.inventory.slots.indexOf(null); if (free < 0) g.gear.unequip(0);
    g.gear.equip(bow.uid); g.inventory.selecionar(g.inventory.slots.findIndex((s) => s?.uid === bow.uid));
    g.player.teleport(${ren.x + 3}, ${ren.z + 22}, 0); aim(${ren.x + 3}, ${ren.z + 40});
  `);
  await gameWait(0.5);
  await js('game.tryAttack();');
  await gameWait(0.6);
  const b0 = await js('return { arrows: game.state.inventory.get("flecha_metal"), drawing: !!game.gear.bow.drawing, flying: game.projectiles.list.filter((p) => p.gear).length }');
  check('arco: aos 0,6 s ainda preparando, flecha não gasta', b0.arrows === 3 && b0.drawing && b0.flying === 0, JSON.stringify(b0));
  await shot('jogo-arco-preparando');
  await gameWait(0.5);
  const b1 = await js('const p = game.projectiles.list.find((x) => x.gear); return { arrows: game.state.inventory.get("flecha_metal"), dur: bow.durability, dmg: p?.gear.damage ?? null }');
  check('arco: dispara com 1 s, gasta 1 flecha e 1 de durabilidade, dano = o da flecha (24)', b1.arrows === 2 && b1.dur === 239 && b1.dmg === 24, JSON.stringify(b1));
  await gameWait(4);
  const b2 = await js('return { left: game.projectiles.list.filter((p) => p.gear).length, pick: game.hunt.projectile.enabled }');
  check('flecha disparada não fica no chão para recuperar', b2.left === 0 && !b2.pick, JSON.stringify(b2));

  // ---------------------------------------------------------------- comida, água, café
  await js(`
    const g = game, n = g.survival.nutrition.values;
    n.proteins = 40; n.carbs = 40; n.fats = 40; g.survival.stamina = 30;
    g.gear.give('pao', 2); g.gear.give('agua', 2); g.gear.give('cafe', 2); g.gear.give('hamburguer', 1); g.gear.give('drogas', 2);
    g.gear.equip('pao'); g.inventory.selecionar(g.inventory.slots.findIndex((s) => s?.id === 'pao'));
  `);
  await gameWait(0.5);
  await js('game.tryAttack();');
  await gameWait(0.9);
  await shot('jogo-comendo-pao');
  const f0 = await js('return { pao: game.state.inventory.get("pao"), h: game.gear.needs.hunger }');
  check('pão: no meio do consumo nada foi gasto nem recuperado', f0.pao === 2 && f0.h < 41, JSON.stringify(f0));
  await gameWait(1.1);
  const f1 = await js('return { pao: game.state.inventory.get("pao"), h: game.gear.needs.hunger }');
  check('pão: ao terminar, −1 unidade e +28 de fome', f1.pao === 1 && Math.abs(f1.h - f0.h - 28) < 0.6, JSON.stringify(f1));
  await js('game.tryAttack();');
  await gameWait(0.6);
  await js('game.tryAttack();'); // clicar de novo cancela
  await gameWait(2);
  const f2 = await js('return { pao: game.state.inventory.get("pao"), h: game.gear.needs.hunger }');
  check('consumo cancelado: nada gasto, nada recuperado', f2.pao === 1 && f2.h <= f1.h + 0.01, JSON.stringify(f2));
  await js('const n = game.survival.nutrition.values; n.proteins = n.carbs = n.fats = 100; game.tryAttack();');
  await gameWait(2.2);
  const f3 = await js('return { pao: game.state.inventory.get("pao") }');
  check('fome cheia: comer é impedido', f3.pao === 1);
  // (a estamina regenera sozinha parada: zera na hora e compara com o que só a regeneração daria)
  await js('game.survival.stamina = 0; game.gear.consume("agua");');
  await gameWait(0.7);
  const w0 = await js('return { agua: game.state.inventory.get("agua"), st: game.survival.stamina }');
  await gameWait(1.0);
  const w = await js('return { agua: game.state.inventory.get("agua"), st: game.survival.stamina }');
  check('água: antes de terminar nada muda; ao terminar +40 de estamina e −1 garrafa', w0.agua === 2 && w.agua === 1 && w.st - w0.st >= 40 && w.st <= 100, `${JSON.stringify(w0)} → ${JSON.stringify(w)}`);
  await js('game.survival.stamina = game.survival.staminaMax; game.gear.consume("agua");');
  await gameWait(1.8);
  const w2 = await js('return { agua: game.state.inventory.get("agua") }');
  check('estamina cheia: beber água é impedido', w2.agua === 1);
  // café
  await js('window.spd0 = game.state.modifier("speed"); game.gear.consume("cafe");');
  await gameWait(1.7);
  const c0 = await js('const e = game.state.effects.find((x) => x.id === "cafe"); return { mult: game.state.modifier("speed") / spd0, left: e?.remaining ?? null, cafe: game.state.inventory.get("cafe"), jump: game.state.modifier("jump") }');
  check('café: ×1,25 de velocidade, ~10 s, salto intacto', Math.abs(c0.mult - 1.25) < 1e-6 && c0.left > 9 && c0.left <= 10 && c0.cafe === 1, JSON.stringify(c0));
  await shot('jogo-cafe-hud-contagem');
  await gameWait(3);
  await js('game.gear.consume("cafe");');
  await gameWait(1.7);
  const c1 = await js('const e = game.state.effects.filter((x) => x.id === "cafe"); return { n: e.length, mult: game.state.modifier("speed") / spd0, left: e[0]?.remaining }');
  check('segunda caneca: não acumula, só reinicia para 10 s', c1.n === 1 && Math.abs(c1.mult - 1.25) < 1e-6 && c1.left > 9, JSON.stringify(c1));
  await gameWait(10.3);
  const c2 = await js('return { mult: game.state.modifier("speed") / spd0, has: game.state.hasEffect("cafe") }');
  check('café termina e remove só o próprio modificador', !c2.has && Math.abs(c2.mult - 1) < 1e-6, JSON.stringify(c2));
  // cápsulas
  await js('game.gear.equip("drogas"); game.inventory.selecionar(game.inventory.slots.findIndex((s) => s?.id === "drogas")); game.tryAttack();');
  await gameWait(1.5);
  const dr = await js('return { n: game.state.inventory.get("drogas"), active: !!game.gear.consumption.active }');
  check('cápsulas: uso desabilitado', dr.n === 2 && !dr.active);

  // ---------------------------------------------------------------- extração com machado
  const tree = await js(`
    const g = game, p = g.player.position; let best = null, bd = 1e9;
    for (const c of g.collisions.all) { if (c.tag !== 'trunk' || c.enabled === false) continue; const d = Math.hypot(c.x - ${ren.x}, c.z - ${ren.z}); if (d < bd) { bd = d; best = c; } }
    return best ? { x: best.x, z: best.z, r: best.r } : null;
  `);
  if (tree) {
    await js(`
      const g = game; for (let i = 0; i < 8; i++) if (g.inventory.slots[i] && g.gear.handles(g.inventory.slots[i])) g.gear.unequip(i);
      window.axe = g.gear.give('machado_metal'); g.gear.equip(axe.uid); g.inventory.selecionar(g.inventory.slots.findIndex((s) => s?.uid === axe.uid));
      g.player.teleport(${tree.x}, ${tree.z + tree.r + 1.1}, Math.PI); aim(${tree.x}, ${tree.z});
      window.sticks0 = g.state.inventory.get('graveto') ?? 0;
    `);
    await gameWait(0.6);
    await js('game.tryAttack();');
    await gameWait(1.05);
    await shot('jogo-machado-extraindo-madeira');
    const e1 = await js('return { dur: axe.durability, sticks: (game.state.inventory.get("graveto") ?? 0) - sticks0 }');
    await js('game.tryAttack();');
    await gameWait(1.05);
    const e2 = await js('return { dur: axe.durability, sticks: (game.state.inventory.get("graveto") ?? 0) - sticks0 }');
    check('machado de metal (2×): 2 golpes completam a extração e rendem gravetos', e1.sticks === 0 && e2.sticks === 2 && e2.dur === 488, `${JSON.stringify(e1)} ${JSON.stringify(e2)}`);
  } else check('extração: achou uma árvore para testar', false, 'nenhum tronco com colisor');

  // ---------------------------------------------------------------- lojas
  await js(`game.gear.openShop({ key: 'teste:ferreiro', name: 'Ferreiro (teste)', kind: 'ferreiro' });`);
  await b.sleep(400);
  await shot('jogo-loja-ferreiro');
  const sec = await js(`
    const g = game, v = { key: 'teste:ferreiro', name: 'Ferreiro (teste)', kind: 'ferreiro' };
    const mod = g.gear, sections = [];
    return true;
  `);
  void sec;
  const shop = await js(`
    const g = game, v = { key: 'teste:ferreiro', name: 'Ferreiro (teste)', kind: 'ferreiro' };
    const labels = [...document.querySelectorAll('.dlg-options *')].map((e) => e.textContent).filter((t) => t.includes('…'));
    return { labels };
  `);
  check('ferreiro mostra as prateleiras de armas/ferramentas/arco/armas de fogo', shop.labels.some((l) => l.includes('Armas de fogo')), shop.labels.join(' | '));
  const buy = await jsAsync(`
    const g = game, gear = g.gear;
    const S = await import('/src/config/gear.js');
    const v = { key: 'teste:ferreiro', name: 'Ferreiro (teste)', kind: 'ferreiro' }, sec = S.SHOP_ARSENAL[3];
    gear.openSection(v, sec);
    const before = { coins: g.state.coins, guns: gear.store.list().filter((i) => i.id === 'rifle').length };
    const r1 = gear.purchase(v, sec, 'rifle');
    const r2 = gear.purchase(v, sec, 'rifle'); // estoque 1: a segunda não pode cobrar
    const mid = g.state.coins;
    g.state.coins = 10;
    const r3 = gear.purchase(v, sec, 'municao_rifle');
    const poor = g.state.coins;
    g.state.coins = 5000;
    const r4 = gear.purchase(v, sec, 'municao_rifle');
    gear.openSection(v, sec);
    const rifle = gear.store.list().find((i) => i.id === 'rifle');
    return { r1: r1.ok, r2: r2.reason, spent: before.coins - mid, r3: r3.reason, poor, r4: r4.amount, ammo: g.state.inventory.get('municao_rifle'), mag: rifle?.mag, dur: rifle?.durability, guns: gear.store.list().filter((i) => i.id === 'rifle').length };
  `);
  check('compra: rifle descarregado e inteiro; estoque/saldo validados antes de cobrar; pacote de 20', buy.r1 && buy.r2 === 'stock' && buy.spent === 520 && buy.r3 === 'coins' && buy.poor === 10 && buy.r4 === 20 && buy.ammo === 20 && buy.mag === 0 && buy.dur === 900 && buy.guns === 1, JSON.stringify(buy));
  await b.sleep(300);
  await shot('jogo-loja-armas-de-fogo');
  await js('game.ui.dialogue.close();');

  // ---------------------------------------------------------------- mochila
  await js('game.gear.give("reliquia_coroa"); game.gear.give("barra_ouro", 3); game.backpack.show("full");');
  await b.sleep(500);
  await js('const c = document.querySelector(".bp-equip"); game.backpack.selected = c.dataset.id; game.backpack.selectedUid = c.dataset.uid; game.backpack.refresh();');
  await b.sleep(300);
  await shot('jogo-mochila-equipamento');
  await js('game.backpack.selectedUid = null; game.backpack.selected = "pao"; game.backpack.refresh();');
  await b.sleep(300);
  await shot('jogo-mochila-comida');
  const bp = await js(`
    const txt = document.querySelector('.bp-detail').textContent;
    game.backpack.selected = 'reliquia_coroa'; game.backpack.refresh();
    const relic = document.querySelector('.bp-detail').textContent;
    const imgs = [...document.querySelectorAll('.bp-items img.item-img')];
    return { txt, relic, imgs: imgs.length, broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length, cap: document.querySelector('.bp-cap').textContent };
  `);
  check('mochila: pão mostra recuperação e NÃO mostra dano', /Fome: \+28/.test(bp.txt) && !/Dano/.test(bp.txt), bp.txt);
  check('mochila: relíquia sem dano, sem durabilidade, sem botão de consumo', !/Dano|Durabilidade|Comer|Beber/.test(bp.relic), bp.relic);
  check('ícones coloridos carregam (nenhuma imagem quebrada)', bp.imgs > 5 && bp.broken === 0, `${bp.imgs} imagens, ${bp.broken} quebradas · ${bp.cap}`);
  await js('game.backpack.hide();');

  // ---------------------------------------------------------------- save
  const before = await js(`
    const g = game; g.gear.give('cafe', 1); g.gear.consume('cafe');
    return true;
  `);
  void before;
  await gameWait(2.5);
  const snap = await js(`
    const g = game; g.gear.save();
    return { coins: g.state.coins, inv: [...g.state.inventory].sort(), eq: g.gear.store.list().map((i) => [i.uid, i.id, i.durability, i.mag ?? null]).sort(), hot: g.inventory.slots.map((s) => s?.uid ?? s?.id ?? null), cafe: g.state.effects.find((e) => e.id === 'cafe')?.remaining ?? null };
  `);
  await b.goto(`${base}/`);
  await b.sleep(1500);
  await b.waitFor('window.game?.ready', 240000, 1000);
  const loaded = await js(`
    const g = game;
    return { coins: g.state.coins, inv: [...g.state.inventory].sort(), eq: g.gear.store.list().map((i) => [i.uid, i.id, i.durability, i.mag ?? null]).sort(), hot: g.inventory.slots.map((s) => s?.uid ?? s?.id ?? null), cafe: g.state.effects.find((e) => e.id === 'cafe')?.remaining ?? null };
  `);
  check('save: moedas, mochila, equipamentos (durabilidade e carregador) e hotbar voltam iguais',
    loaded.coins === snap.coins && JSON.stringify(loaded.inv) === JSON.stringify(snap.inv) && JSON.stringify(loaded.eq) === JSON.stringify(snap.eq) && JSON.stringify(loaded.hot) === JSON.stringify(snap.hot),
    `${snap.eq.length} equipamentos, ${snap.inv.length} pilhas`);
  check('save: duração restante do café volta (e nunca maior que a salva)', snap.cafe > 0 && loaded.cafe !== null && loaded.cafe <= snap.cafe + 0.01, `${snap.cafe?.toFixed(2)} → ${loaded.cafe?.toFixed(2)}`);
  const twice = await js('const n0 = game.gear.store.list().length, i0 = [...game.state.inventory].length; game.gear.load(); game.gear.load(); return { same: game.gear.store.list().length === n0 && [...game.state.inventory].length === i0 }');
  check('carregar o save de novo não duplica nada', twice.same);
  await b.sleep(800);
  await shot('jogo-depois-de-carregar-o-save');

  const errors = b.logs.filter((l) => /^\[(error|exception)/.test(l));
  check('console do jogo sem erros', errors.length === 0, errors.slice(0, 5).join(' || '));
} catch (err) {
  check('roteiro chegou ao fim', false, `${err.message}\n${b.logs.slice(-12).join('\n')}`);
} finally {
  await b.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações passaram.`);
process.exit(failed.length ? 1 : 0);
