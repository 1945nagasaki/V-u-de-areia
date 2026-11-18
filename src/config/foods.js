/**
 * Comidas da coleta e da caça (Missão: Véu de Areia): frutas frescas/assadas,
 * carnes cruas/assadas por espécie, quanto cada uma mata a Fome, e o tempo de
 * assar NA FOGUEIRA (a única forma de cozinhar no jogo).
 *
 * Fonte única: survival.js gera os FOODS (nutrição) a partir daqui; items.js
 * gera os itens; a fogueira (CampfireCooking) lê `roastsTo` e `cookTime`.
 *
 * Fome → nutrição: o jogo mede a fome em 4 barras (proteínas, carboidratos,
 * gorduras, água). `hunger` é repartido nelas por HUNGER_SPLIT[categoria]; a
 * soma das partes é exatamente o `hunger` mostrado no item ("+X de Fome").
 */

/** Estados mostrados no selo da dica do item. */
export const FOOD_STATES = {
  fruta_fresca: 'Fruta Fresca',
  fruta_assada: 'Fruta Assada',
  carne_crua: 'Carne Crua',
  carne_assada: 'Carne Assada',
};

/** Como a Fome de cada categoria vira nutrição (frações somam 1). */
export const HUNGER_SPLIT = {
  fruta: { carbs: 0.8, water: 0.2 },
  carne: { proteins: 0.75, fats: 0.25 },
};

/**
 * Frutas: fresca → assada. `hunger` fresca/assada, `cookTime` s na fogueira.
 * `icon` é um nome de src/ui/Icons.js. `color` pinta o modelo 3D e o ícone.
 */
export const FRUITS = {
  frutas_vermelhas: { name: 'Frutas Vermelhas Silvestres', roasted: 'frutas_vermelhas_assadas', roastedName: 'Frutas Vermelhas Assadas', hunger: 8, roastedHunger: 14, cookTime: 5, color: 0xb0202e },
  tamara: { name: 'Tâmara do Deserto', roasted: 'tamara_assada', roastedName: 'Tâmara Assada', hunger: 10, roastedHunger: 16, cookTime: 5, color: 0x7a3a18 },
  figo_india: { name: 'Figo-da-Índia', roasted: 'figo_india_assado', roastedName: 'Figo-da-Índia Assado', hunger: 12, roastedHunger: 19, cookTime: 6, color: 0xb83a6a },
  marula: { name: 'Fruta de Marula', roasted: 'marula_assada', roastedName: 'Fruta de Marula Assada', hunger: 14, roastedHunger: 22, cookTime: 6, color: 0xd8c040 },
  banana_selvagem: { name: 'Banana Selvagem', roasted: 'banana_assada', roastedName: 'Banana Assada', hunger: 16, roastedHunger: 25, cookTime: 7, color: 0xe8d040 },
  manga: { name: 'Manga Tropical', roasted: 'manga_assada', roastedName: 'Manga Assada', hunger: 18, roastedHunger: 28, cookTime: 7, color: 0xe88a20 },
  coco_fruto: { name: 'Coco', roasted: 'coco_assado', roastedName: 'Coco Assado', hunger: 20, roastedHunger: 30, cookTime: 8, color: 0x6a4a2a },
};

/** Carnes por espécie: crua → assada. */
export const MEATS = {
  carne_ave_crua: { name: 'Carne de Ave Crua', roasted: 'carne_ave_assada', roastedName: 'Carne de Ave Assada', hunger: 10, roastedHunger: 28, cookTime: 8, color: 0xd88a8a },
  carne_coelho_crua: { name: 'Carne de Coelho Crua', roasted: 'carne_coelho_assada', roastedName: 'Carne de Coelho Assada', hunger: 12, roastedHunger: 32, cookTime: 9, color: 0xc86a6a },
  carne_reptil_crua: { name: 'Carne de Réptil Crua', roasted: 'carne_reptil_assada', roastedName: 'Carne de Réptil Assada', hunger: 12, roastedHunger: 32, cookTime: 9, color: 0xb88a7a },
  carne_gazela_crua: { name: 'Carne de Gazela Crua', roasted: 'carne_gazela_assada', roastedName: 'Carne de Gazela Assada', hunger: 15, roastedHunger: 42, cookTime: 12, color: 0xa83a3a },
  carne_javali_crua: { name: 'Carne de Javali Crua', roasted: 'carne_javali_assada', roastedName: 'Carne de Javali Assada', hunger: 18, roastedHunger: 50, cookTime: 15, color: 0x8a2a2a },
};

/**
 * Tabela de carne por espécie (speciesLootTable): ao morrer, o animal deixa no
 * chão a carne da sua espécie. Para um animal novo, basta uma linha aqui.
 * O jogo ainda não tem gazela nem coelho: os parentes mais próximos usam a
 * mesma carne (cervídeos/ruminantes → gazela; roedores pequenos → coelho).
 */
export const SPECIES_LOOT = {
  javali: { meat: 'carne_javali_crua', amount: 1 },
  gazela: { meat: 'carne_gazela_crua', amount: 1 },
  cervo: { meat: 'carne_gazela_crua', amount: 1 },
  alce: { meat: 'carne_gazela_crua', amount: 2 },
  camelo: { meat: 'carne_gazela_crua', amount: 2 },
  zebra: { meat: 'carne_gazela_crua', amount: 2 },
  girafa: { meat: 'carne_gazela_crua', amount: 3 },
  coelho: { meat: 'carne_coelho_crua', amount: 1 },
  capivara: { meat: 'carne_coelho_crua', amount: 1 },
  suricato: { meat: 'carne_coelho_crua', amount: 1 },
  ave: { meat: 'carne_ave_crua', amount: 1 },
  arara: { meat: 'carne_ave_crua', amount: 1 },
  corvo: { meat: 'carne_ave_crua', amount: 1 },
  avestruz: { meat: 'carne_ave_crua', amount: 2 },
  lagarto: { meat: 'carne_reptil_crua', amount: 1 },
  vibora: { meat: 'carne_reptil_crua', amount: 1 },
  jacare: { meat: 'carne_reptil_crua', amount: 2 },
};

/** Item de carne no chão: realce e coleta. */
export const MEAT_LOOT = {
  pickupRadius: 2.4,
  despawnSeconds: 600, // some se ninguém pegar
  highlight: { color: 0xffd38a, pulse: 2.4 }, // anel pulsando em volta
};

/** Textos fixos das dicas (tooltips). */
export const FOOD_TEXT = {
  howToRoast: 'Como assar: Só pode ser assado em uma Fogueira acesa. Aproxime-se da fogueira e pressione [E] para colocar o alimento no fogo.',
  roasted: 'Preparo: Assado exclusivamente na Fogueira.',
  cookTime: (s) => `Tempo para assar na fogueira: ${s} segundos`,
  restores: (n) => `Restaura: +${n} de Fome`,
};

/**
 * Todos os itens de comida da coleta/caça, já "achatados":
 * { id: { name, state, hunger, cookTime, roastsTo, roastedFrom, category, color } }.
 * Itens assados guardam `cookTime` (o tempo que levaram) para a dica.
 */
export const FOOD_ITEMS = (() => {
  const out = {};
  const add = (table, category, fresh, done) => {
    for (const [id, f] of Object.entries(table)) {
      out[id] = { name: f.name, category, state: fresh, hunger: f.hunger, cookTime: f.cookTime, roastsTo: f.roasted, color: f.color };
      out[f.roasted] = { name: f.roastedName, category, state: done, hunger: f.roastedHunger, cookTime: f.cookTime, roastedFrom: id, color: f.color };
    }
  };
  add(FRUITS, 'fruta', 'fruta_fresca', 'fruta_assada');
  add(MEATS, 'carne', 'carne_crua', 'carne_assada');
  return out;
})();

/**
 * Nutrição (formato de FOODS em survival.js) de um item de FOOD_ITEMS: a Fome
 * repartida pelas barras. Carne crua mantém o risco de contaminação.
 * @param {{ hunger: number, category: 'fruta'|'carne', state: string }} f
 */
export function nutritionFor(f) {
  const n = {};
  for (const [bar, frac] of Object.entries(HUNGER_SPLIT[f.category])) n[bar] = f.hunger * frac;
  if (f.state === 'carne_crua') n.contamination = 'rawMeat';
  return n;
}
