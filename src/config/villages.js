/**
 * Dados das vilas (lore, estatísticas e posição no mapa).
 * A geometria de cada vila fica em src/villages/<Vila>.js.
 *
 * u, v = posição na imagem de referência (0..1).
 * radius = raio útil da vila (m). flatten = área de terreno aplainada.
 * biome = bioma onde fica (um assentamento por bioma).
 * abandoned = ruína: sem abrigo do clima, não vira ponto de renascer.
 * lore = conversa do ancião (E): { speaker, title, look, pages: [texto…] }.
 *   Cada página é uma tela do diálogo; "Continuar" passa para a próxima.
 *   `exposure` (opcional) soma exposição paranormal ao terminar de ler.
 */
export const VILLAGES = {
  renascimento: {
    id: 'renascimento',
    name: 'Vila Renascimento',
    region: 'Centro da África — ilha do lago central',
    u: 0.5, v: 0.486,
    radius: 215,
    flatten: { radius: 205, blend: 22, height: 4.2 },
    population: 5000,
    demographics: { adultos: 65, criancas: 5, idosos: 30 },
    founded: 'A vila mais velha do continente.',
    description:
      'Construída na ilha do grande lago, ligada ao continente por oito pontes. ' +
      'Ruas de terra batida irradiam da praça central, onde fica o poço d\'água.',
    structures: [
      'Casas de adobe', 'Lojas e mercadinhos', 'Praça central', 'Poço d\'água',
      'Igreja bem cuidada', 'Uma casa em ruínas no canto da vila',
    ],
  },
  perseguicao: {
    id: 'perseguicao',
    name: 'Vila Perseguição',
    region: 'Leste Africano',
    u: 0.82, v: 0.47,
    radius: 135,
    flatten: { radius: 150, blend: 45 },
    population: 1467,
    demographics: { adultos: 43, criancas: 15, idosos: 42 },
    founded: 'Existe desde a Partilha da África.',
    description:
      'Vila antiga e apertada, cercada por mini estacas. A feira é a maior da região ' +
      'e a Praça da Saudade guarda memórias que ninguém gosta de contar.',
    structures: [
      'Muitas casas', 'Feira grande', 'Cerca de mini estacas',
      'Poucas áreas de plantação', 'Praça da Saudade',
    ],
  },
  abstracao: {
    id: 'abstracao',
    name: 'Vila Abstração',
    region: 'Noroeste Africano',
    u: 0.18, v: 0.21,
    radius: 120,
    flatten: { radius: 135, blend: 45 },
    population: 2000,
    populationNote: 'Cresceu de 500 para 2.000 "populistas" após a invasão.',
    demographics: null,
    faction: 'Controlada à força pela tribo Hoogmoed',
    founded: 'Invadida pela tribo Hoogmoed.',
    description:
      'Muito pobre e saqueada. Um muro de troncos cerca as casas simples; ' +
      'o líder da tribo faz suas reuniões na casa grande.',
    structures: [
      'Muro de troncos', 'Igreja grande', 'Duas lojas comerciais', 'Feira humilde',
      'Várias casas simples', 'Casa medicinal', 'Casa grande do líder Hoogmoed',
    ],
  },
  bussola: {
    id: 'bussola',
    name: 'Vila Bússola do Sul',
    region: 'Sul — às margens do rio',
    u: 0.42, v: 0.82,
    radius: 125,
    flatten: { radius: 150, blend: 40 },
    population: 3000,
    populationNote: 'Mais de 3.000 habitantes.',
    demographics: null,
    faction: 'Aliada e parceira comercial da tribo Luiheid',
    founded: 'Em guerra constante com algumas tribos.',
    description:
      'A vila mais rica do continente. A muralha com canhões e guardas é ' +
      'impenetrável: só entra quem conquista a confiança do prefeito.',
    structures: [
      'Muralha com canhões e guardas', 'Maior catedral do jogo', 'Mansão do prefeito',
      'Casas menores', 'Duas feiras', 'Área comercial', 'Grandes plantações',
      'Fazenda de animais', 'Porto de pesca no rio', 'Grande relógio (cofre embaixo)',
    ],
  },

  // ===================== Novos assentamentos (um por bioma) =====================
  presaDeGelo: {
    id: 'presaDeGelo',
    name: 'Acampamento Presa de Gelo',
    biome: 'taiga',
    region: 'Norte — montanhas da Taiga',
    u: 0.4355, v: 0.0868,
    radius: 118,
    flatten: { radius: 130, blend: 45 },
    population: 520,
    demographics: { adultos: 80, criancas: 5, idosos: 15 },
    founded: 'Fundado por mineiros que seguiram um veio de ferro até a neve.',
    description:
      'Fortaleza rústica de caçadores e mineiros: paliçada de troncos congelados, dezenas de ' +
      'cabanas de tora e pedra viradas para as grandes fogueiras que nunca se apagam.',
    structures: ['Paliçada com portões', 'Dezenas de cabanas de tora', 'Torres de vigia altas', 'Varais de caça', 'Fogueiras centrais', 'Ruas de pedra com lanternas', 'Entrada da mina'],
    lore: {
      speaker: 'Ulmar, o Caçador-Chefe', title: 'Acampamento Presa de Gelo',
      look: { shirt: 0x5a4632, pants: 0x2e2a26, hat: 'wrap', height: 1.86, build: 1.15 },
      pages: [
        '"Chegue perto do fogo, estrangeiro. Aqui em cima o frio mata mais rápido que lobo."',
        '"Meu avô veio atrás do ferro que brilha nas pedras. Achou ferro… e achou a fome. As fogueiras são a nossa lei: quem deixa uma apagar, dorme do lado de fora."',
        '"As peles nos varais pagam o sal que vem do sul. As torres? Para ver a nevasca chegando — e as coisas que andam dentro dela."',
      ],
    },
  },
  alZahir: {
    id: 'alZahir',
    name: 'Oásis de Al-Zahir',
    biome: 'deserto',
    region: 'Centro do Deserto',
    u: 0.645, v: 0.28,
    radius: 150,
    flatten: { radius: 162, blend: 40 },
    population: 2400,
    demographics: { adultos: 60, criancas: 25, idosos: 15 },
    faction: 'Território neutro: nenhuma arma é sacada perto da água',
    founded: 'Erguido em volta do único lago que não seca no deserto.',
    description:
      'Cidade-oásis em volta do lago com palmeiras — a única área segura do deserto. ' +
      'Quarteirões de adobe de dois andares, ruas cobertas por tecidos e feiras de especiarias lotadas.',
    structures: ['Lago com palmeiras', 'Quarteirões de adobe (1–2 andares)', 'Ruas cobertas por toldos', 'Feiras densas de especiarias', 'Tendas das caravanas', 'Poço das caravanas'],
    lore: {
      speaker: 'Mestra Nadira', title: 'Guardiã da Água · Al-Zahir',
      look: { shirt: 0x2f5d8a, robe: true, hat: 'wrap', height: 1.7 },
      pages: [
        '"Bem-vindo à sombra de Al-Zahir. Beba primeiro, pergunte depois."',
        '"Zahir era um cameleiro que se perdeu na tempestade. Quando a areia baixou, ele estava de joelhos na beira deste lago. Ele jurou que ninguém morreria de sede aqui — e nós ainda cumprimos o juramento."',
        '"Por isso a regra: perto da água ninguém briga. Lá fora a areia decide quem vive."',
      ],
    },
  },
  copaAlta: {
    id: 'copaAlta',
    name: 'Povoado da Copa Alta',
    biome: 'tropical',
    region: 'Oeste — coração da Floresta Tropical',
    u: 0.0723, v: 0.6701,
    radius: 120,
    flatten: { radius: 128, blend: 40 },
    population: 1300,
    demographics: { adultos: 55, criancas: 30, idosos: 15 },
    founded: 'Subiram para as árvores depois da "Noite das Garras".',
    description:
      'Uma rede vertical de casas no alto das árvores gigantes, ligadas por uma teia de pontes ' +
      'de corda (dá para andar nelas). No chão ficam só as raízes, as escadas em caracol e os predadores.',
    structures: ['Dezenas de casas nas árvores', 'Teia de pontes suspensas', 'Escadas em caracol nos troncos', 'Árvores gigantes', 'Lanternas nas plataformas'],
    lore: {
      speaker: 'Avó Imani', title: 'Contadora de Histórias · Copa Alta',
      look: { shirt: 0x4a7a3a, robe: true, hair: 0xd0d0d0, hunch: 0.2, height: 1.6 },
      pages: [
        '"Shh… fale baixo, as onças escutam lá de baixo."',
        '"Antes vivíamos no chão. Até a Noite das Garras: em uma noite, metade das casas ficou vazia. Na manhã seguinte meu pai amarrou a primeira corda nesta árvore."',
        '"Hoje nenhuma criança daqui pisa no chão antes dos doze anos. A floresta dá tudo — fruta, água da chuva, remédio — desde que você fique em cima dela."',
      ],
    },
  },
  areiasVivas: {
    id: 'areiasVivas',
    name: 'Acampamento das Areias Vivas',
    biome: 'kalahari',
    region: 'Sul — onde a savana vira Kalahari',
    u: 0.5176, v: 0.8993,
    radius: 100,
    flatten: { radius: 112, blend: 35 },
    population: 340,
    populationNote: 'Nômades: o acampamento muda de lugar a cada estação.',
    demographics: { adultos: 50, criancas: 35, idosos: 15 },
    founded: 'Nunca foi fundado — só montado e desmontado, há gerações.',
    description:
      'Grande acampamento nômade de caçadores e coletores: dezenas de tendas de couro, áreas de ' +
      'suprimentos, cercados para os animais de carga e tótens gigantes de osso nos limites.',
    structures: ['Dezenas de tendas de couro', 'Áreas de suprimentos', 'Cercados de animais de carga', 'Tótens gigantes de osso', 'Fogueiras comunais'],
    lore: {
      speaker: 'Kxao, o Rastreador', title: 'Acampamento das Areias Vivas',
      look: { shirt: 0x8a5a2a, pants: 0x5a4a3a, height: 1.68, build: 0.95 },
      pages: [
        '"Você anda alto demais, estrangeiro. A areia ouve seus pés de longe."',
        '"Chamam de Areias Vivas porque o chão aqui se mexe: as dunas andam, a água some e volta. Quem fica parado, morre. Por isso nada aqui é de pedra."',
        '"Os tótens de osso avisam: daqui para dentro, a caça é nossa. Os ossos são de quem esqueceu disso."',
      ],
    },
  },
  zambaRios: {
    id: 'zambaRios',
    name: 'Zamba dos Rios',
    biome: 'equatorial',
    region: 'Leste — margens da Floresta Equatorial',
    u: 0.7168, v: 0.5243,
    radius: 125,
    flatten: { radius: 48, blend: 28, height: 2.2 },
    population: 1500,
    demographics: { adultos: 58, criancas: 27, idosos: 15 },
    founded: 'Pescadores que seguiram os peixes rio abaixo e nunca voltaram.',
    description:
      'Vila fluvial extensa: dezenas de casas de palafita sobre a água, ligadas por uma rede de ' +
      'trapiches, com uma feira flutuante de jangadas e canoas amarradas nas pilastras.',
    structures: ['Dezenas de palafitas', 'Rede de trapiches', 'Feira flutuante', 'Canoas amarradas', 'Defumadouro de peixe'],
    lore: {
      speaker: 'Mestre Bakary', title: 'Barqueiro-Mor · Zamba dos Rios',
      look: { shirt: 0x1f6a6a, pants: 0x2a2a30, hat: 'straw', height: 1.78 },
      pages: [
        '"Cuidado onde pisa — metade desta vila é água, a outra metade é madeira molhada."',
        '"O rio é estrada, despensa e cemitério. Levamos peixe defumado até a Bússola do Sul e voltamos com ferro e notícias."',
        '"Na cheia, a água sobe até o assoalho. Por isso as casas ficam em palafitas: o rio é visita, não dono."',
      ],
    },
  },
  coroaAlta: {
    id: 'coroaAlta',
    name: 'Cidadela do Cume-Leão',
    /** Capital de uma das sete tribos de Akin (design/narrative/). */
    tribe: 'Coroa-Alta',
    biome: 'taiga',
    region: 'Norte — maciço granítico da Taiga',
    u: 0.55, v: 0.11,
    radius: 130,
    /**
     * Cidade em 5 terraços (design/narrative/coroa-alta.md, Parte XV):
     * Pé, Pata, Ombro, Juba e Topo. Cada nível sobe e se desloca para o
     * norte; a Escada do Pé ao Topo sobe pelo eixo, do sul para o norte.
     */
    terraces: {
      blend: 45, edge: 2.5, stair: { width: 12, run: 18 },
      levels: [
        { name: 'O Pé', r: 130, shift: 0, y: 0 },
        { name: 'A Pata', r: 100, shift: 22, y: 9 },
        { name: 'O Ombro', r: 74, shift: 42, y: 18 },
        { name: 'A Juba', r: 50, shift: 60, y: 27 },
        { name: 'O Topo', r: 30, shift: 80, y: 36 },
      ],
    },
    /** Portão do Pé: abre no Gongo da manhã e fecha no Gongo da noite (horas do jogo). */
    gateHours: [5, 21],
    population: 2310,
    populationNote: 'Cerca de 2.310 na Cidadela; o reino inteiro passa de 3.000.',
    demographics: null,
    faction: 'Capital da tribo Hoogmoed — o Reino de Coroa-Alta',
    founded: 'Nasceu do muro que o clã mais forte ergueu no Cume para guardar o gado do inverno.',
    description:
      'Uma montanha cortada em cinco terraços, cada um com sua muralha. Quanto mais alto se mora, ' +
      'mais alto se é. No topo, o Salão do Primeiro Degrau e a alcateia real.',
    structures: [
      'Cinco terraços murados', 'Escada do Pé ao Topo', 'Avenida dos Leões', 'Salão do Primeiro Degrau',
      'Salão da Face Branca', 'Quartel da Guarda Leonina', 'Mercado do Patamar', 'Forja Real da Pata',
      'Gongo do Topo', 'Cabanas do Pé e fogueiras comunitárias',
    ],
    lore: {
      speaker: 'Guarda do Portão do Pé', title: 'Cidadela do Cume-Leão',
      look: { shirt: 0x6a2a1c, pants: 0x2a2622, hat: 'wrap', accessory: 'spear', height: 1.88, build: 1.1 },
      pages: [
        '"De que altura você vem, estrangeiro? Aqui isso importa mais que o seu nome."',
        '"Cinco terraços. O Pé é dos mineiros; o Topo é do Primeiro. Ninguém sobe a Escada sem licença."',
        '"Não diga \'imperador\' dentro dos muros. Esse título está guardado — e não é para você."',
      ],
    },
  },
  maoCerrada: {
    id: 'maoCerrada',
    name: 'Areia-Funda',
    tribe: 'Mão-Cerrada',
    biome: 'deserto',
    region: 'Nordeste — Saara, ao pé do Maciço do Dente',
    u: 0.82, v: 0.18,
    radius: 170,
    /** Chão da grade bem abaixo do deserto em volta: a cidade fica numa bacia. */
    flatten: { radius: 170, blend: 40, height: 12 },
    /** Escarpa que fecha a cidade ao norte e a leste (design/narrative/mao-cerrada.md, Parte II). */
    ridges: [{ r: 215, width: 60, height: 42, from: -2.6, to: -0.2 }],
    /**
     * Grade de livro-caixa: Colunas (N–S, 6 m) e Linhas (L–O, 4 m) entre
     * quadras de 2×2 lotes de 8 m. Haver (credores) a leste, Deve a oeste,
     * Quitados numa faixa no meio.
     */
    grid: { cols: 11, rows: 10, lot: 8, colStreet: 6, rowStreet: 4, haverFrom: 0.62, quitados: [0.5, 0.6] },
    gateHours: [4, 22],
    population: 2900,
    populationNote: 'Cerca de 2.900 dentro da muralha; metade deve à Organização.',
    demographics: null,
    faction: 'Sede da organização de Gierigheid — a tribo Mão-Cerrada',
    founded: 'Cresceu em volta do Aquífero Velho; a Cidade Velha está soterrada ao sul.',
    description:
      'Uma cidade em grade como uma página de livro-caixa: cada lote é uma Folha, cada morador uma conta. ' +
      'A leste os credores, a oeste os devedores, no centro a Casa da Balança e, sob ela, os cofres.',
    structures: [
      'Grade de Colunas e Linhas', 'Casa da Balança (cúpula)', 'Quadro dos Devedores', 'Templo do Raio Justo',
      'Quartel dos Cobradores do Dente', 'Poços Selados', 'Muralha dos Selos', 'Cais de Areia', 'Palmeiral dos Penhores',
    ],
    lore: {
      speaker: 'Escriba do Portão do Pedágio', title: 'Areia-Funda',
      look: { robe: true, shirt: 0xd8c8a0, hat: 'wrap', accessory: 'staff', height: 1.74 },
      pages: [
        '"Nome, Coluna e Folha, por favor. Aqui cada pessoa é uma conta, e cada conta tem dono."',
        '"Água se compra no poço. Sombra se compra no Cais. A Organização vende as duas e anota tudo."',
        '"Viu o Quadro na praça? Placa inteira, deve. Quebrada, pagou. Vermelha… melhor não perguntar."',
      ],
    },
  },
  espelhoTurvo: {
    id: 'espelhoTurvo',
    name: 'Vale do Espelho-Turvo',
    tribe: 'Espelho-Turvo',
    biome: 'tropical',
    region: 'Oeste — vale escondido na Floresta Tropical',
    u: 0.18, v: 0.58,
    radius: 150,
    flatten: { radius: 150, blend: 35 },
    /** Lago Nhanzu: o eixo do vale, acima do nível do mar (água própria, não a global). */
    trenches: [{ hw: 30, hd: 125, depth: 2.6, edge: 4 }],
    lake: { hw: 30, hd: 125, waterBelow: 1.1 },
    /** Encostas leste e oeste do vale e a soleira da cachoeira ao norte. */
    ridges: [
      { r: 122, width: 45, height: 24, from: -0.95, to: 0.95 },
      { r: 122, width: 45, height: 24, from: Math.PI - 0.95, to: Math.PI + 0.95 },
      { r: 140, width: 30, height: 18, from: -Math.PI / 2 - 0.35, to: -Math.PI / 2 + 0.35, fade: 0.15 },
    ],
    population: 3000,
    populationNote: 'Cerca de 3.000, metade em cada margem; cada morador tem um Par.',
    demographics: null,
    faction: 'Sede da tribo de Afguns — o Espelho-Turvo',
    founded: 'Uma escola de formas que virou cidade, escondida num vale com um lago reto no meio.',
    description:
      'Duas margens iguais de um lago reto: a Segunda a oeste, onde Afguns governa, e a Primeira a leste, ' +
      'com um palácio vazio. No meio da água, a Ilhota do Erro guarda o Escudo de Akin.',
    structures: [
      'Lago Nhanzu', 'Casa Segunda e Casa Primeira', 'Salão das Formas', 'Casa dos Estudos',
      'Ilhota do Erro', 'Pontes do lago', 'Casas de Lavagem', 'Bairros-Par', 'Cachoeira',
    ],
    lore: {
      speaker: 'Lavadora do Portão do Corte', title: 'Vale do Espelho-Turvo',
      look: { robe: true, shirt: 0xe8e8e0, hat: 'wrap', height: 1.7 },
      pages: [
        '"Ninguém entra sujo no vale. Lave as mãos, o rosto e o nome. Depois a gente conversa."',
        '"Aqui cada um tem um Par. Você também vai ter, se ficar. É assim que se aprende a perder."',
        '"A casa do outro lado do lago está vazia. Ela espera o Primeiro. O Mestre espera mais ainda."',
      ],
    },
  },
  brasaViva: {
    id: 'brasaViva',
    name: 'Dique-Rubro',
    tribe: 'Brasa-Viva',
    biome: 'equatorial',
    region: 'Leste — várzea da Floresta Equatorial, junto ao mar',
    u: 0.92, v: 0.46,
    radius: 165,
    /** Chão dentro do Dique (base) e a Ilha dos Pilares, terrapleno 6 m mais alto no centro. */
    terraces: {
      base: 8, blend: 40, edge: 3, stair: { width: 10, run: 14 },
      levels: [
        { name: 'Dentro do Dique', r: 150, shift: 0, y: 0 },
        { name: 'Ilha dos Pilares', r: 27, shift: 0, y: 6 },
      ],
    },
    /** O Dique: anel de terra de 5 m com três Portas (norte, oeste e a Comporta leste). */
    ridges: [
      { r: 150, width: 18, height: 5, from: -Math.PI / 2 + 0.12, to: -0.12, fade: 0.04 },
      { r: 150, width: 18, height: 5, from: 0.12, to: Math.PI - 0.12, fade: 0.04 },
      { r: 150, width: 18, height: 5, from: -Math.PI + 0.12, to: -Math.PI / 2 - 0.12, fade: 0.04 },
    ],
    /** Lagoa dos Grandes (sudoeste, fora do Dique): fundo abaixo do mar, a água do jogo a enche. */
    lagoon: { dx: -150, dz: 165, hw: 55, hd: 36 },
    trenches: [{ dx: -150, dz: 165, hw: 55, hd: 36, depth: 16, edge: 10 }],
    population: 4100,
    populationNote: 'Cerca de 4.100, a maioria trabalhadores das fornalhas, por turno.',
    demographics: null,
    faction: 'Cidade de Toorn — a Brasa-Viva (dívida com a organização de Gierigheid)',
    founded: 'Cresceu como forja do império sobre terraplenos de barro, protegida da cheia por um dique.',
    description:
      'Uma cidade-forja cercada por um dique de terra. No centro, a Ilha dos Pilares; a leste, as Mil ' +
      'Fornalhas. Fora do Dique ficam a Lagoa dos Grandes e o Lodo, onde Toorn nasceu.',
    structures: [
      'O Dique e suas três Portas', 'Ilha dos Pilares', 'Salão das Placas', 'Torre de Toorn', 'As Mil Fornalhas',
      'Bairros do Turno', 'Fosso do Lodo', 'Santuário da Têmpera', 'Posto dos Cobradores do Dente', 'O Lodo', 'Lagoa dos Grandes',
    ],
    lore: {
      speaker: 'Foleiro da Porta da Calçada', title: 'Dique-Rubro',
      look: { shirt: 0x7a3a22, pants: 0x3a2a1c, hat: 'wrap', build: 1.15 },
      pages: [
        '"Ouve o fole? Três turnos, dia e noite. Vermelho, Branco e Negro. A cidade nunca apaga."',
        '"O Dique segura a cheia. A dívida, ninguém segura. Na Entrega da Cheia, os Cobradores levam o melhor metal."',
        '"Não fale alto perto do Mestre Toorn. E não pergunte do pai dele. Nunca."',
      ],
    },
  },
  veuCarmesim: {
    id: 'veuCarmesim',
    name: 'Paço das Faces',
    tribe: 'Véu-Carmesim',
    biome: 'preta',
    region: 'Sudeste — Jardim Pálido, no interior da Floresta Preta',
    u: 0.84, v: 0.87,
    radius: 175,
    /**
     * Fundo da bacia (Terra-Branca), o platô da cidade (+6 m) e o terraço do
     * Santuário da Última Face ao norte (+12 m). O Caminho Branco sobe do sul.
     */
    terraces: {
      base: 32, blend: 45, edge: 3, stair: { width: 9, run: 14 },
      levels: [
        { name: 'Bacia', r: 175, shift: 0, y: 0 },
        { name: 'Platô', r: 118, shift: 8, y: 6 },
        { name: 'Terraço das Preces', r: 34, shift: 80, y: 12 },
      ],
    },
    /** As Bocas: Leite (leste, água leitosa própria), Funda (oeste, até o mar) e Seca (norte). */
    trenches: [
      { dx: 148, dz: 10, hw: 15, hd: 15, depth: 4, edge: 5 },
      { dx: -148, dz: 20, hw: 13, hd: 13, depth: 40, edge: 6 },
      { dx: 0, dz: -160, hw: 14, hd: 10, depth: 8, edge: 4 },
    ],
    bocaLeite: { dx: 148, dz: 10, hw: 15, hd: 15, waterBelow: 2.2 },
    population: 1600,
    populationNote: 'Cerca de 1.600 devotos; chegam mais do que o Jardim consegue alimentar.',
    demographics: null,
    faction: 'Cidade do Pai do Véu (Onkuisheid) — guarda do Crânio de Akin',
    founded: 'Era Terra-Branca, vila de oleiros e retratistas, até Akin chamá-la de "a casa da minha face".',
    description:
      'Uma cidade branca numa bacia de árvores pálidas. Milhares de rostos de cobre e terracota olham ' +
      'de cima dos muros. Ao norte, a Torre do Ouvido e o Santuário da Última Face.',
    structures: [
      'Muros das Faces', 'Praça do Véu', 'Casa do Pai', 'Santuário da Última Face', 'Torre do Ouvido',
      'Feira da Névoa', 'Fundição de Cera Perdida', 'Boca do Leite', 'Boca Funda', 'Boca Seca', 'Bairro dos Arrancados',
    ],
    lore: {
      speaker: 'Velada do Portão das Faces', title: 'Paço das Faces',
      look: { robe: true, shirt: 0x9a1a22, hat: 'wrap', height: 1.68 },
      pages: [
        '"Bem-vindo à Casa do Pai. Qual é o seu nome? E o nome de quem você perdeu?"',
        '"Os rostos no muro são de quem jurou lealdade. Eles olham, mas não julgam. Ainda."',
        '"Ao pôr do sol a névoa fica vermelha. Não se assuste se os rostos parecerem sorrir."',
      ],
    },
  },
  ruinasKaelen: {
    id: 'ruinasKaelen',
    name: 'Ruínas de Kaelen',
    biome: 'preta',
    region: 'Coração da Floresta Preta',
    u: 0.7168, v: 0.8576,
    radius: 150,
    flatten: { radius: 160, blend: 45 },
    abandoned: true,
    population: 0,
    populationNote: 'Ninguém sabe para onde foram.',
    demographics: null,
    faction: 'Zona corrompida: a névoa engrossa perto do centro',
    founded: 'Conhecida como Vila das Sombras.',
    description:
      'Kaelen foi um reino próspero até a noite em que todos sumiram. Hoje restam dezenas de casas ' +
      'desmoronadas, muros cobertos de musgo negro, uma catedral partida e luzes que flutuam sem dono.',
    structures: ['Dezenas de casas desmoronadas', 'Muros com musgo negro', 'Catedral arruinada', 'Torres partidas', 'Árvores mortas', 'Luzes errantes', 'Pedra de Kaelen'],
    lore: {
      speaker: 'Pedra de Kaelen', title: 'Inscrição gasta',
      pages: [
        'As letras estão meio apagadas, como se alguém tivesse tentado raspá-las.',
        '"…no sétimo dia a névoa não foi embora. Os cães pararam de latir. As crianças falavam com alguém no poço…"',
        '"…quem ler isto: não siga as luzes. Elas sabem o seu nome."',
      ],
      exposure: 5,
    },
  },
};

/** Áreas extras aplainadas (plantações da Bússola do Sul fora da muralha). */
export const EXTRA_FLAT_ZONES = [
  { u: 0.36, v: 0.84, radius: 95, blend: 40 },
  { u: 0.385, v: 0.9, radius: 55, blend: 30 },
];
