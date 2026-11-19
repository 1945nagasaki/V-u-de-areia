// Fontes de animação (Sketchfab, CC Attribution) e como cada uma vira clipes
// das espécies do jogo. Padrões casam o nome do osso SEM o sufixo numérico do
// exportador (ex.: "Bip01_L_Thigh_04" → "Bip01_L_Thigh").
//
// Cadeias (pontos do esqueleto de origem, em ordem):
//   spine: pelve → ... → base do pescoço
//   neck : base do pescoço → ... → cabeça
//   head : cabeça → ponta (focinho/fim da cabeça) — dá a direção da cabeça
//   tail : base → ... → ponta
//   legs : { FL, FR, BL, BR } = [ombro/quadril, cotovelo/joelho, punho/tornozelo]
// Lado (esquerdo/direito) é conferido pela posição real depois do alinhamento.

const BIP01 = {
  spine: [/^Bip01_Pelvis$/, /^Bip01_Spine$/, /^Bip01_Spine1$/, /^Bip01_Spine2$/, /^Bip01_Neck$/],
  neck: [/^Bip01_Neck$/, /^Bip01_Head$/],
  head: [/^Bip01_Head$/, /^Bip01_HeadNub$/],
  tail: [/^(Bip01_Tail|BN_Tail_01)$/, /^(Bip01_Tail1|BN_Tail_02)$/, /^(Bip01_Tail2|BN_Tail_03)$/, /^(Bip01_Tail3|BN_Tail_03_end)$/, /^Bip01_Tail4$/, /^Bip01_TailNub$/],
  legs: {
    FL: [/^Bip01_L_UpperArm$/, /^Bip01_L_Forearm$/, /^Bip01_L_Hand$/],
    FR: [/^Bip01_R_UpperArm$/, /^Bip01_R_Forearm$/, /^Bip01_R_Hand$/],
    BL: [/^Bip01_L_Thigh$/, /^Bip01_L_Calf$/, /^Bip01_L_Foot$/],
    BR: [/^Bip01_R_Thigh$/, /^Bip01_R_Calf$/, /^Bip01_R_Foot$/],
  },
};

const RIGIFY_TIGER = {
  spine: [/^DEF-pelvis$/, /^DEF-spine02$/, /^DEF-spine03$/, /^DEF-spine04$/, /^DEF-spine05$/, /^DEF-spine06$/, /^DEF-neck01$/],
  neck: [/^DEF-neck01$/, /^DEF-neck02$/, /^DEF-neck03$/, /^DEF-head$/],
  head: [/^DEF-head$/, /^DEF-nostrilL$/],
  tail: [/^DEF-tail01$/, /^DEF-tail03$/, /^DEF-tail05$/, /^DEF-tail07$/, /^DEF-tail09$/],
  legs: {
    FL: [/^DEF-upper_armL$/, /^DEF-forearmL$/, /^DEF-handL$/],
    FR: [/^DEF-upper_armR$/, /^DEF-forearmR$/, /^DEF-handR$/],
    BL: [/^DEF-thighL$/, /^DEF-shinL$/, /^DEF-footL$/],
    BR: [/^DEF-thighR$/, /^DEF-shinR$/, /^DEF-footR$/],
  },
};

const RIGIFY_ELEPHANT = {
  spine: [/^DEF-pelvis$/, /^DEF-spine_01$/, /^DEF-spine_02$/, /^DEF-spine_03$/, /^DEF-spine_04$/, /^DEF-neck_01$/],
  neck: [/^DEF-neck_01$/, /^DEF-neck_02$/, /^DEF-head$/],
  head: [/^DEF-head$/, /^DEF-trunk_01$/],
  tail: [/^DEF-tail_01$/, /^DEF-tail_03$/, /^DEF-tail_05$/, /^DEF-tail_08$/],
  legs: {
    FL: [/^DEF-humerusL$/, /^DEF-(forearm|radius|ulna)L$/, /^DEF-manusL$/],
    FR: [/^DEF-humerusR$/, /^DEF-(forearm|radius|ulna)R$/, /^DEF-manusR$/],
    BL: [/^DEF-femurL$/, /^DEF-tibiaL$/, /^DEF-pesL$/],
    BR: [/^DEF-femurR$/, /^DEF-tibiaR$/, /^DEF-pesR$/],
  },
};

const RHINO = {
  spine: [/^Root4$/, /^Spine5$/, /^Spine16$/, /^Spine27$/, /^Spine38$/, /^Neck9$/],
  neck: [/^Neck9$/, /^Head10$/],
  head: [/^Head10$/, /^L_Nose41$/],
  tail: [/^Tail77$/, /^Tail178$/, /^Tail279$/, /^Tail380$/, /^Tail481$/],
  legs: {
    FL: [/^L_Shoulder44$/, /^L_Elbow45$/, /^L_Wrist46$/],
    FR: [/^R_Shoulder55$/, /^R_Elbow56$/, /^R_Wrist57$/],
    BL: [/^L_Hip63$/, /^L_Knee64$/, /^L_Ankle65$/],
    BR: [/^R_Hip70$/, /^R_Knee71$/, /^R_Ankle72$/],
  },
};

/** Arquivos baixados (pasta de trabalho, fora do repositório) e créditos. */
export const SOURCES = {
  // ref: clipe (quadro 0) que representa a postura natural de pé; os movimentos são medidos a partir dela.
  crocodilo: { dir: 'crocodilo', map: BIP01, uid: '172fe452ff70488191ba92779e5f4c31', ref: 'crocodileidle' },
  hipopotamo: { dir: 'hipopotamo', map: BIP01, uid: 'b6f94ccfd88442b9b92a9484d27561a5', ref: 'Idle' },
  tigre: { dir: 'tigre', map: BIP01, uid: '67bbedd727a047869ef7c7b608445484', ref: 'Walk' },
  tigreSiberiano: { dir: 'tigre_siberiano', map: RIGIFY_TIGER, uid: '860f119b7a9f485096136789eedee908', ref: '01_Idle' },
  elefanteBull: { dir: 'elefante_bull', map: RIGIFY_ELEPHANT, uid: '436483857ce84c77bd0f6c76fb3d4d2d', ref: '01_Idle' },
  rinoWalk: { dir: 'rino_walk', map: RHINO, uid: '32abc12d4fe44bd0b116b294194d9615', ref: 'Animation' },
  rinoRun: { dir: 'rino_run', map: RHINO, uid: '2345603eec5e4e54a293c39833684525', ref: 'Animation' },
};

/**
 * Espécie do jogo → clipes. Cada clipe: [fonte, nome do clipe na fonte, laço?].
 * As chaves (idle, walk, run, attack, eat, death) são as que o
 * AnimalAnimationManager usa.
 */
export const JOBS = {
  // Reprovados na validação visual (2026-11-17), fora do jogo até corrigir:
  //   leao.eat / leao.lie (tigre/Eat, Idle_Lie Prone): o corpo precisa descer
  //     até o chão e o limite de sobe-e-desce da pelve impede → pose de bote.
  //   hipoEsfolado.death (hipopotamo/Die): a queda é um giro do corpo inteiro,
  //     e o retarget só transfere a direção dos ossos → fica agachado de lado.
  //     Sem clipe, o jogo usa o tombo procedural.
  jacare: { idle: ['crocodilo', 'crocodileidle', true], walk: ['crocodilo', 'crocodilerun', true], run: ['crocodilo', 'crocodilerun', true], attack: ['crocodilo', 'crocodileattack', false] },
  leao: { idle: ['tigreSiberiano', '01_Idle', true], walk: ['tigreSiberiano', '02_Walk', true], trot: ['tigreSiberiano', '03_Trot', true], run: ['tigreSiberiano', '04_Gallop', true], roar: ['tigreSiberiano', '05_Roar', false], attack: ['tigre', 'Attack', false] },
  mamute: { idle: ['elefanteBull', '01_Idle', true], walk: ['elefanteBull', '02_Walk', true], run: ['elefanteBull', '03_Run', true], eat: ['elefanteBull', '04_Eating', true], attack: ['elefanteBull', '05_Attack', false] },
  rinoceronte: { walk: ['rinoWalk', 'Animation', true], run: ['rinoRun', 'Animation', true] },
  hipoEsfolado: { idle: ['hipopotamo', 'Idle', true], walk: ['hipopotamo', 'Walk', true], run: ['hipopotamo', 'Run', true], attack: ['hipopotamo', 'Attack', false] },
};
