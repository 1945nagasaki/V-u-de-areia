/**
 * Pacote de itens "Icones.zip" (34 itens + variantes de material), 100% data-driven.
 *
 * Tudo que é número de jogabilidade mora aqui: dano, durabilidade, intervalos,
 * recarga, fome/estamina, empilhamento, preços e estoque. As regras puras ficam
 * em `src/systems/gear/*`, o encaixe no jogo em `GearController.js`.
 *
 * IDs sem espaço nem acento. Itens com material têm uma variante por nível
 * (`adaga_pedra`, `adaga_ouro`, `adaga_metal`); `base` aponta o item original
 * do pacote. Progressão pedida: pedra < ouro < metal.
 *
 * @example
 * import { GEAR_CATALOG, EQUIPMENT } from './gear.js';
 * GEAR_CATALOG.espada_metal.damage;      // 30
 * EQUIPMENT.pistola.magazine;            // 16
 */

/** Níveis de material. `damageCap` é o teto ABSOLUTO de dano por acerto do nível. */
export const TIERS = {
  pedra: { name: 'Pedra', order: 0, damageCap: 10 },
  ouro: { name: 'Ouro', order: 1, damageCap: 20 },
  metal: { name: 'Metal', order: 2, damageCap: 30 },
};
export const TIER_IDS = ['pedra', 'ouro', 'metal'];

/** Como o item é obtido (fora da fabricação: ver CRAFTABLE_IDS). */
export const ACQUISITION = { SHOP: 'shop', WORLD: 'world', EXPLORATION: 'exploration', UNDEFINED: 'undefined' };

/** Limite por espaço da mochila (itens antigos, sem regra própria, usam `legacy`). */
export const STACK = { equipment: 1, relic: 1, food: 20, drink: 10, resource: 100, ammo: 100, capsule: 20, legacy: 100 };

/** Mochila: espaços totais (cada pilha ocupa ceil(qtd / limite) espaços; equipamento = 1). */
export const BACKPACK = { slots: 48 };

/**
 * Armas brancas e ferramentas por nível [pedra, ouro, metal].
 * `interval` = tempo mínimo entre ataques (s); `swing` = duração do golpe;
 * `impactAt` = fração do golpe em que o dano é testado (uma vez por golpe);
 * `range` = alcance (m); `gather` = o que a ferramenta extrai, com `efficiency`
 * multiplicando o PROGRESSO de extração (nunca o dano).
 */
export const MELEE = {
  adaga: {
    name: 'Adaga', description: 'Lâmina curta para ataques rápidos de alcance reduzido.',
    kind: 'weapon', icon: 'knife', grip: 'one',
    damage: [6, 12, 18], durability: [60, 180, 420], interval: 0.45, swing: 0.32, impactAt: 0.5, range: 1.5,
    price: [20, 60, 140],
  },
  espada: {
    name: 'Espada', description: 'Arma de combate corpo a corpo, com maior alcance e dano por golpe.',
    kind: 'weapon', icon: 'sword', grip: 'one',
    damage: [10, 20, 30], durability: [80, 240, 560], interval: 0.9, swing: 0.6, impactAt: 0.5, range: 2.3,
    price: [35, 110, 260],
  },
  machado: {
    name: 'Machado', description: 'Ferramenta especializada em cortar madeira; também pode atingir inimigos.',
    kind: 'tool', icon: 'axe', grip: 'two',
    damage: [8, 16, 24], durability: [70, 210, 490], interval: 1.0, swing: 0.7, impactAt: 0.55, range: 1.9,
    gather: 'wood', efficiency: [1, 1.5, 2],
    price: [25, 80, 190],
  },
  picareta: {
    name: 'Picareta', description: 'Ferramenta especializada em extrair pedra e minério; pouco eficiente em combate.',
    kind: 'tool', icon: 'pickaxe', grip: 'two',
    damage: [4, 8, 12], durability: [90, 270, 630], interval: 1.1, swing: 0.75, impactAt: 0.55, range: 1.9,
    gather: 'stone', efficiency: [1, 1.5, 2],
    price: [25, 80, 190],
  },
};

/** Flechas: 1 disparo por unidade; a PONTA define o dano final do tiro. */
export const ARROWS = {
  name: 'Flecha', description: 'Projétil cuja ponta define o dano final do disparo.',
  damage: [8, 16, 24], price: [2, 5, 9],
  /** ids por nível (a de pedra mantém o id antigo `flecha` do jogo) */
  ids: ['flecha', 'flecha_ouro', 'flecha_metal'],
};

/**
 * Itens do pacote que TAMBÉM podem ser fabricados na mesa da mochila (pedido do
 * dono em 2026-11-12): o arco e a flecha de ponta de pedra, com as receitas que
 * o jogo já tinha. Todo o resto do pacote só se compra.
 */
/**
 * Flecha só de madeira (pedido do dono em 2026-11-12): um graveto com a ponta afiada e endurecida no
 * fogo, sem pedra nem pena. Fora dos níveis de material — é a mais fraca de todas e só se fabrica.
 */
export const WOOD_ARROW = {
  id: 'flecha_madeira', name: 'Flecha de Madeira',
  description: 'Graveto de ponta afiada e endurecida no fogo, sem pedra nem pena. A flecha mais fraca.',
  damage: 4, price: 1,
};

export const CRAFTABLE_IDS = ['arco', 'flecha', WOOD_ARROW.id];

/** Arco de madeira: dano próprio 0, usa só o dano da flecha. */
export const BOW = {
  id: 'arco', name: 'Arco', description: 'Arco de madeira para disparar flechas a distância.',
  durability: 240, draw: 1.0, damage: 0, speed: 46, price: 40,
  /** Ordem de uso quando há mais de um tipo na mochila (X troca). */
  ammo: [...ARROWS.ids, WOOD_ARROW.id], // a de madeira por último: sem escolha (X), gasta as melhores antes
  recoverArrows: false,
};

/**
 * Armas de fogo (semiautomáticas: um tiro por clique). O dano é da ARMA; a
 * munição só habilita o tiro. Sem bala extra na câmara: o total é `magazine`.
 * `interval` = tempo mínimo entre tiros; `reload` = s; `speed` = m/s do projétil.
 */
export const FIREARMS = {
  pistola: {
    name: 'Pistola', description: 'Arma compacta para confrontos próximos e médios. Utiliza munição de pistola.',
    damage: 22, magazine: 16, reload: 1.8, interval: 0.3, durability: 600, ammo: 'municao_pistola',
    speed: 190, kick: 0.035, grip: 'pistol', price: 320, icon: 'gun',
  },
  rifle: {
    name: 'Rifle', description: 'Arma de maior alcance e precisão. Utiliza munição de rifle.',
    damage: 30, magazine: 20, reload: 2.6, interval: 0.5, durability: 900, ammo: 'municao_rifle',
    speed: 340, kick: 0.05, grip: 'rifle', price: 520, icon: 'gun',
  },
};

/** Munição de arma de fogo: vendida em pacote (`pack` unidades). */
export const AMMO = {
  municao_pistola: { name: 'Munição de Pistola', description: 'Cartuchos para a pistola. Cada tiro gasta uma unidade.', pack: 16, packPrice: 48, weapon: 'pistola' },
  municao_rifle: { name: 'Munição de Rifle', description: 'Cartuchos para o rifle. Cada tiro gasta uma unidade.', pack: 20, packPrice: 80, weapon: 'rifle' },
};

/**
 * Comida e bebida. `hunger` = fome recuperada (0..100), `stamina` = estamina,
 * `time` = s de consumo (o efeito e o gasto só acontecem ao TERMINAR).
 * `drink` muda a animação e o limite de pilha.
 */
export const CONSUMABLES = {
  biscoito: { name: 'Biscoito', portion: '1 unidade', hunger: 5, stamina: 0, time: 1, price: 1, icon: 'cookie', description: 'Pequeno lanche para aliviar um pouco a fome.' },
  tomate: { name: 'Tomate', portion: '1 unidade', hunger: 7, stamina: 0, time: 1, price: 2, icon: 'fruit', description: 'Alimento leve para uma recuperação pequena.' },
  cenoura: { name: 'Cenoura', portion: '1 unidade', hunger: 8, stamina: 0, time: 1, price: 2, icon: 'carrot', description: 'Raiz crocante para uma refeição rápida e leve.' },
  uva: { name: 'Uva', portion: 'cacho pequeno', hunger: 10, stamina: 0, time: 1.2, price: 3, icon: 'grapes', description: 'Pequena porção de frutas.' },
  maca: { name: 'Maçã', portion: '1 unidade', hunger: 12, stamina: 0, time: 1.2, price: 3, icon: 'fruit', description: 'Fruta que recupera uma quantidade moderada de fome.' },
  banana: { name: 'Banana', portion: '1 unidade', hunger: 15, stamina: 0, time: 1.2, price: 3, icon: 'fruit', description: 'Lanche de recuperação intermediária.' },
  milho: { name: 'Milho', portion: '1 espiga pronta para comer', hunger: 20, stamina: 0, time: 1.5, price: 5, icon: 'corn', description: 'Porção maior para reduzir a fome durante a exploração.' },
  queijo: { name: 'Queijo', portion: '1 pedaço', hunger: 22, stamina: 0, time: 1.5, price: 6, icon: 'cheese', description: 'Porção compacta e substancial.' },
  pao: { name: 'Pão', portion: '1 porção grande', hunger: 28, stamina: 0, time: 1.8, price: 7, icon: 'bread', description: 'Alimento reforçado para viagens longas.' },
  hamburguer: { name: 'Hambúrguer', portion: '1 unidade inteira', hunger: 45, stamina: 0, time: 2.5, price: 12, icon: 'burger', description: 'Refeição grande que recupera bastante fome.' },
  agua: { name: 'Água', portion: '1 garrafa', hunger: 0, stamina: 40, time: 1.5, price: 4, icon: 'bottle', drink: true, description: 'Recupera estamina ao beber.' },
  cafe: { name: 'Café', portion: '1 caneca', hunger: 0, stamina: 0, time: 1.5, price: 6, icon: 'cup', drink: true, effect: 'cafe', description: 'Aumenta a velocidade de movimento em 25% durante 10 segundos.' },
};

/** Fome e estamina vão de 0 a 100. */
export const NEEDS = { max: 100 };

/**
 * Café: ×1,25 na velocidade de andar/correr por 10 s de jogo. Não acumula:
 * outra caneca só reinicia a duração. (Entra em STATUS_EFFECTS como `cafe`.)
 */
export const COFFEE = { id: 'cafe', speedMultiplier: 1.25, seconds: 10 };

/** Recursos: dano 0, sem durabilidade, sem fome/estamina. `price` = compra no mercador. */
export const RESOURCE_ITEMS = {
  pedra: { name: 'Pedra', icon: 'stone', price: 1, description: 'Recurso mineral bruto para coleta e negociação; reservado a sistemas futuros.', keepLegacyText: true },
  graveto: { name: 'Graveto', icon: 'stick', price: 1, description: 'Pequeno pedaço de madeira para coleta e negociação; reservado a sistemas futuros.', keepLegacyText: true },
  barra_metal: { name: 'Barra de Metal', icon: 'ingot', price: 30, description: 'Material refinado de ferro/aço, usado como recurso comercial nesta etapa.' },
  barra_ouro: { name: 'Barra de Ouro', icon: 'ingot', price: 90, description: 'Recurso valioso para negociação e sistemas futuros.' },
};

/** Drogas.png: cápsulas com efeito ainda não definido. Cadastrado, sem uso. */
export const CAPSULE = { id: 'drogas', name: 'Drogas', icon: 'pill', description: 'Cápsulas de efeito ainda não definido.' };

/**
 * Relíquias: só cadastro e modelo nesta etapa. Sem dano, sem bônus, sem
 * consumo, sem venda, sem crafting, sem posição no mapa.
 * `biomeId` e `originCultureId` ficam nulos ATÉ o mapa e a história do projeto
 * definirem a associação (uma relíquia única por bioma, do povo de origem).
 */
export const RELICS = {
  reliquia_capa: { name: 'Capa', icon: 'cape', description: 'Manto antigo preservado como relíquia.' },
  reliquia_coroa: { name: 'Coroa', icon: 'crown', description: 'Adorno cerimonial de origem ainda a identificar.' },
  reliquia_costela: { name: 'Costela', icon: 'bone', description: 'Fragmento ósseo preservado como artefato.' },
  reliquia_cranio: { name: 'Crânio', icon: 'skull', description: 'Crânio preservado como peça de uma coleção de relíquias.' },
  reliquia_dente: { name: 'Dente', icon: 'tooth', description: 'Dente antigo preservado como artefato.' },
  reliquia_escudo: { name: 'Escudo', icon: 'shield', description: 'Escudo cerimonial com marcas de uso.' },
  reliquia_espada: { name: 'Espada', icon: 'sword', description: 'Lâmina antiga preservada como relíquia.' },
};

/**
 * Extração com ferramenta: cada impacto válido soma `efficiency` ao progresso
 * do alvo; ao chegar em `work`, o alvo entrega `yield` e o progresso zera.
 * `tags` = etiquetas dos colisores do mundo (Vegetation: 'trunk', 'boulder').
 */
export const EXTRACTION = {
  wood: { tags: ['trunk'], work: 4, yield: { graveto: 2 }, label: 'madeira', verb: 'Cortando' },
  stone: { tags: ['boulder'], work: 4, yield: { pedra: 2 }, label: 'pedra', verb: 'Minerando' },
  /** folga (m) entre o alcance da ferramenta e a borda do tronco/rocha */
  reachPad: 0.25,
  /** esquece o progresso de um alvo abandonado depois de N s */
  forgetSeconds: 30,
};

/** Aviso de durabilidade baixa (fração). */
export const DURABILITY = { warnBelow: 0.2 };

/**
 * Lojas. Armas, ferramentas, flechas e munição: só com o ferreiro.
 * Comida, bebida e recursos: mercador / lojista. `stock` = unidades (ou
 * pacotes) por vendedor, reposto a cada `restockHours` horas de jogo.
 *
 * BALANCEAMENTO ECONÔMICO PENDENTE: os preços foram centralizados aqui com
 * valores provisórios; o pedido não definiu preços.
 */
export const ECONOMY = {
  balancePending: true,
  restockHours: 24,
  stock: { equipment: 2, firearm: 1, arrow: 40, ammoPack: 6, food: 12, drink: 8, resource: 30, ingot: 6 },
};

/**
 * Efeitos visuais/sonoros de bolso (sem asset externo).
 * `tracerLength` = m do traço da bala em voo.
 */
export const FX = { tracerLength: 1.4, muzzleFlashSeconds: 0.05 };

/** Save do pacote (inventário, equipamentos, durabilidade, munição, efeitos, estoque das lojas). */
export const SAVE = { key: 'rpg_africa.gear.v1', version: 1, autosaveSeconds: 20 };

// ---------------------------------------------------------------- catálogo

const img = (id) => `assets/icons/items/${id}.png`;
const tierOf = (i) => TIER_IDS[i];

/** @returns {Record<string, object>} definições centralizadas (ver campos em docs/GEAR-SYSTEM.md) */
function buildCatalog() {
  const C = {};
  const add = (id, d) => {
    C[id] = {
      id, materialTier: null, damage: 0, durabilityMax: null, hungerRestore: 0, staminaRestore: 0, useDuration: 0,
      craftable: CRAFTABLE_IDS.includes(id), effects: [], gear: true, image: img(id), model: { builder: d.base ?? id, glb: null },
      ...d,
    };
  };

  for (const [base, m] of Object.entries(MELEE)) {
    TIER_IDS.forEach((tier, i) => add(`${base}_${tier}`, {
      base, name: `${m.name} de ${TIERS[tier].name}`, description: m.description, category: m.kind === 'tool' ? 'ferramenta' : 'arma',
      kind: m.kind, icon: m.icon, materialTier: tier, damage: m.damage[i], durabilityMax: m.durability[i],
      attackInterval: m.interval, stackLimit: STACK.equipment, acquisition: ACQUISITION.SHOP, hotbar: true, equipment: 'melee',
      price: m.price[i], gather: m.gather ?? null, gatherEfficiency: m.efficiency?.[i] ?? null,
    }));
  }

  add(BOW.id, {
    base: 'arco', name: BOW.name, description: BOW.description, category: 'arma', kind: 'weapon', icon: 'bow',
    materialTier: null, damage: BOW.damage, durabilityMax: BOW.durability, useDuration: BOW.draw,
    stackLimit: STACK.equipment, acquisition: ACQUISITION.SHOP, hotbar: true, equipment: 'bow', price: BOW.price,
  });

  for (const [id, f] of Object.entries(FIREARMS)) {
    add(id, {
      base: id, name: f.name, description: f.description, category: 'arma', kind: 'weapon', icon: f.icon,
      materialTier: 'metal', damage: f.damage, durabilityMax: f.durability, attackInterval: f.interval,
      magazine: f.magazine, reloadSeconds: f.reload, ammo: f.ammo,
      stackLimit: STACK.equipment, acquisition: ACQUISITION.SHOP, hotbar: true, equipment: 'firearm', price: f.price,
    });
  }

  add(WOOD_ARROW.id, {
    base: 'flecha', name: WOOD_ARROW.name, description: WOOD_ARROW.description, category: 'municao', kind: 'ammo', icon: 'arrow',
    materialTier: null, damage: WOOD_ARROW.damage, stackLimit: STACK.ammo, acquisition: ACQUISITION.SHOP, price: WOOD_ARROW.price,
    model: { builder: 'flecha', glb: null },
  });

  ARROWS.ids.forEach((id, i) => add(id, {
    base: 'flecha', name: `Flecha de ${TIERS[tierOf(i)].name}`, description: ARROWS.description, category: 'municao', kind: 'ammo', icon: 'arrow',
    materialTier: tierOf(i), damage: ARROWS.damage[i], stackLimit: STACK.ammo, acquisition: ACQUISITION.SHOP, price: ARROWS.price[i],
    model: { builder: 'flecha', glb: null },
  }));

  for (const [id, a] of Object.entries(AMMO)) {
    add(id, {
      base: id, name: a.name, description: a.description, category: 'municao', kind: 'ammo', icon: 'bullet',
      stackLimit: STACK.ammo, acquisition: ACQUISITION.SHOP, pack: a.pack, price: a.packPrice,
    });
  }

  for (const [id, c] of Object.entries(CONSUMABLES)) {
    add(id, {
      base: id, name: c.name, description: c.description, portion: c.portion, category: c.drink ? 'bebida' : 'alimento', kind: 'food', icon: c.icon,
      hungerRestore: c.hunger, staminaRestore: c.stamina, useDuration: c.time, drink: !!c.drink,
      effects: c.effect ? [c.effect] : [], stackLimit: c.drink ? STACK.drink : STACK.food,
      acquisition: ACQUISITION.SHOP, consumable: true, hotbar: true, inHand: true, price: c.price,
    });
  }

  for (const [id, r] of Object.entries(RESOURCE_ITEMS)) {
    add(id, {
      base: id, name: r.name, description: r.description, keepLegacyText: !!r.keepLegacyText, category: 'recurso', kind: 'material', icon: r.icon,
      stackLimit: STACK.resource, acquisition: ACQUISITION.SHOP, hotbar: true, inHand: true, price: r.price,
    });
  }

  add(CAPSULE.id, {
    base: CAPSULE.id, name: CAPSULE.name, description: CAPSULE.description, category: 'capsula', kind: 'material', icon: CAPSULE.icon,
    stackLimit: STACK.capsule, acquisition: ACQUISITION.UNDEFINED, consumable: false, useDisabled: true, hotbar: true, inHand: true,
  });

  for (const [id, r] of Object.entries(RELICS)) {
    add(id, {
      base: id, name: r.name, description: r.description, category: 'reliquia', kind: 'relic', icon: r.icon,
      stackLimit: STACK.relic, acquisition: ACQUISITION.EXPLORATION, unique: true, biomeId: null, originCultureId: null,
      hotbar: true, inHand: true,
    });
  }
  return C;
}

/** Todas as definições do pacote, por id. */
export const GEAR_CATALOG = buildCatalog();

/** Os 34 itens originais do pacote → ids cadastrados (variantes de material listadas à parte). */
export const PACK_ITEMS = {
  adaga: ['adaga_pedra', 'adaga_ouro', 'adaga_metal'],
  espada: ['espada_pedra', 'espada_ouro', 'espada_metal'],
  machado: ['machado_pedra', 'machado_ouro', 'machado_metal'],
  picareta: ['picareta_pedra', 'picareta_ouro', 'picareta_metal'],
  arco: ['arco'], pistola: ['pistola'], rifle: ['rifle'],
  flecha: [...ARROWS.ids], municao_pistola: ['municao_pistola'], municao_rifle: ['municao_rifle'],
  pedra: ['pedra'], graveto: ['graveto'], barra_metal: ['barra_metal'], barra_ouro: ['barra_ouro'],
  ...Object.fromEntries(Object.keys(CONSUMABLES).map((id) => [id, [id]])),
  drogas: ['drogas'],
  ...Object.fromEntries(Object.keys(RELICS).map((id) => [id, [id]])),
};

/** Vitrine do ferreiro (armas, ferramentas, flechas, munição), por seção. */
export const SHOP_ARSENAL = [
  { title: 'Adagas e espadas', ids: ['adaga_pedra', 'adaga_ouro', 'adaga_metal', 'espada_pedra', 'espada_ouro', 'espada_metal'], stock: 'equipment' },
  { title: 'Machados e picaretas', ids: ['machado_pedra', 'machado_ouro', 'machado_metal', 'picareta_pedra', 'picareta_ouro', 'picareta_metal'], stock: 'equipment' },
  { title: 'Arco e flechas', ids: ['arco', ...ARROWS.ids, WOOD_ARROW.id], stock: { arco: 'equipment', default: 'arrow' } },
  { title: 'Armas de fogo e munição', ids: ['pistola', 'rifle', 'municao_pistola', 'municao_rifle'], stock: { pistola: 'firearm', rifle: 'firearm', default: 'ammoPack' } },
];

/** Vitrine do mercador / lojista (comida, bebida, recursos). */
export const SHOP_PROVISIONS = [
  { title: 'Comida', ids: Object.keys(CONSUMABLES).filter((id) => !CONSUMABLES[id].drink), stock: 'food' },
  { title: 'Água e café', ids: ['agua', 'cafe'], stock: 'drink' },
  { title: 'Recursos', ids: ['pedra', 'graveto', 'barra_metal', 'barra_ouro'], stock: { barra_metal: 'ingot', barra_ouro: 'ingot', default: 'resource' } },
];

/** Unidades de estoque inicial de `id` numa seção de vitrine. */
export function stockFor(section, id) {
  const key = typeof section.stock === 'string' ? section.stock : (section.stock[id] ?? section.stock.default);
  return ECONOMY.stock[key];
}
