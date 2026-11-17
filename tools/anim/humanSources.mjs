// Fontes humanas (Sketchfab, CC Attribution) → clipes do Humanoid do jogo.
//
// Mapa de cada esqueleto: padrões casam o nome do osso SEM o último sufixo
// numérico do exportador ("Arm_2_R_09" → "Arm_2_R"). Lados L/R podem vir
// trocados nos nomes: o retarget confere pela posição real.
//   pelvis: osso da bacia (rotação do quadril)
//   neck  : base do pescoço (topo do tronco)
//   head  : osso da cabeça (rotação)
//   arm   : [ombro (início do braço), cotovelo, punho] por lado
//   leg   : [quadril, joelho, tornozelo, ponta do pé] por lado
//   foot  : osso do pé · hand: osso da mão · shin/forearm: osso da canela/antebraço

const side = (L, R) => ({ L, R });

const NERD = {
  pelvis: /^Spine_1$/, neck: /^Spine_5$/, head: /^Head$/,
  arm: side([/^Arm_2_L$/, /^Arm_3_L$/, /^Hand_1_L$/], [/^Arm_2_R$/, /^Arm_3_R$/, /^Hand_1_R$/]),
  leg: side([/^Leg_1_L$/, /^Leg_2_L$/, /^Leg_3_L$/, /^Leg_4_L$/], [/^Leg_1_R$/, /^Leg_2_R$/, /^Leg_3_R$/, /^Leg_4_R$/]),
};

const RG3D = {
  pelvis: /^rootx$/, neck: /^neckx$/, head: /^headx$/,
  arm: side([/^arm_stretchl$/, /^forearm_stretchl$/, /^handl$/], [/^arm_stretchr$/, /^forearm_stretchr$/, /^handr$/]),
  leg: side([/^thigh_stretchl$/, /^leg_stretchl$/, /^footl$/, /^toes_01l$/], [/^thigh_stretchr$/, /^leg_stretchr$/, /^footr$/, /^toes_01r$/]),
};

const BIZ = {
  pelvis: /^Hips$/, neck: /^Neck$/, head: /^Head$/,
  arm: side([/^Upper_Arm_L$/, /^Lower_Arm_L$/, /^Hand_L$/], [/^Upper_Arm_R$/, /^Lower_Arm_R$/, /^Hand_R$/]),
  leg: side([/^Upper_Leg_L$/, /^Lower_Leg_L$/, /^Foot_L$/, /^Toes_L$/], [/^Upper_Leg_R$/, /^Lower_Leg_R$/, /^Foot_R$/, /^Toes_R$/]),
};

const ADV = {
  pelvis: /^hips_Rig$/, neck: /^neck_Rig$/, head: /^Head_Rig$/,
  arm: side([/^upper_arm_L_Rig$/, /^lower_arm_L_Rig$/, /^hand_L_Rig$/], [/^upper_arm_R_Rig$/, /^lower_arm_R_Rig$/, /^hand_R_Rig$/]),
  leg: side([/^upper_leg_L_Rig$/, /^lower_leg_L_Rig$/, /^feet_L_Rig$/, /^toes_L_Rig$/], [/^upper_leg_R_Rig$/, /^lower_leg_R_Rig$/, /^feet_R_Rig$/, /^toes_R_Rig$/]),
};

/** ref: clipe cujo quadro 0 é a postura "em pé, braços caídos" (= repouso do Humanoid). */
export const HUMAN_SOURCES = {
  nerd: { dir: 'nerd', map: NERD, ref: 'Loop Idle Default' },
  marie: { dir: 'marie', map: RG3D, ref: 'Idle' },
  viking: { dir: 'vworker', map: RG3D, ref: 'IdleA_1_40' },
  business: { dir: 'business', map: BIZ, ref: 'idle' },
  adventurer: { dir: 'adventurer', map: ADV, ref: 'idle' },
};

/**
 * Chave do jogo → [fonte, clipe, laço?]. Agrupadas por categoria (um arquivo
 * por categoria em public/assets/animations/humans/, carregado sob demanda).
 */
// Reprovados na revisão visual (2026-11-17):
//   business/cycle_talking: o corpo não se mexe (é animação do rosto: maxilar/fonemas).
export const HUMAN_JOBS = {
  locomotion: {
    idle: ['nerd', 'Loop Idle Default', true],
    idleAlt: ['nerd', 'Loop Idle Default 1', true],
    idleTired: ['adventurer', 'idle_tired', true],
    idleWounded: ['nerd', 'Loop Idle Wounded 1', true],
    idleWounded2: ['nerd', 'Loop Idle Wounded 2', true],
    idleVillager: ['viking', 'IdleA_1_40', true],
    idleVillager2: ['viking', 'IdleB_1_40', true],
    walk: ['nerd', 'Walk Forward', true],
    walkRelaxed: ['viking', 'Walking_1_24', true],
    walkHeavy: ['viking', 'WalkingB_1_24', true],
    walkTired: ['viking', 'Walking_C_1_24', true],
    walkCarry: ['marie', 'Walking_something', true],
    walkBack: ['nerd', 'Walk Backward', true],
    walkStrafeLeft: ['adventurer', 'walk_left', true],
    walkStrafeRight: ['adventurer', 'walk_right', true],
    walkForwardLeft: ['nerd', 'Walk Forward Left', true],
    walkForwardRight: ['nerd', 'Walk Forward Right', true],
    run: ['nerd', 'Run Forward', true],
    runBack: ['nerd', 'Run Backward', true],
    runStrafeLeft: ['nerd', 'Run Strafe Left', true],
    runStrafeRight: ['nerd', 'Run Strafe Right', true],
    sneak: ['nerd', 'Sneak Forward', true],
    sneakIdle: ['nerd', 'Sneak Idle', true],
    sneakBack: ['nerd', 'Sneak Back', true],
    hop: ['nerd', 'Hop', false],
    climb: ['nerd', 'Climb', true],
    turnLeft: ['business', 'turning_left', false],
    turnRight: ['business', 'turning_right', false],
    fall: ['adventurer', 'falling', true],
  },
  social: {
    wave: ['nerd', 'HI!', false],
    callHelp: ['nerd', 'Help!', false],
    refuse: ['nerd', 'No!', false],
    puzzled: ['nerd', 'What?', false],
    talkA: ['marie', 'TalkingA', true],
    talkB: ['marie', 'TalkingB', true],
    talkC: ['marie', 'TalkingC', true],
    pay: ['viking', 'Pay_A_1_60', false],
    giveTake: ['marie', 'TakeOGive', false],
    kneelPoint: ['viking', 'BuildingTaunt', false],
    bravado: ['nerd', 'Personality Bravado', true],
    stoic: ['nerd', 'Personality Stoic', true],
    fidget: ['nerd', 'Personality Techno Nut', true],
    vain: ['nerd', 'Personality Pre-Madonna', true],
    simple: ['nerd', 'Personality Simpleton', true],
    wary: ['nerd', 'Personality Typical Survivor', true],
    eat: ['nerd', 'Eat', true],
    drink: ['nerd', 'Open Soda Can Quietly', false],
    unwrap: ['nerd', 'Unwrap Ramen', false],
    sitIdle: ['business', 'sitting_idle', true],
  },
  professions: {
    smith: ['viking', 'Blacksmith_WorkA', true],
    sow: ['viking', 'Farmer_Seeding_1_45', true],
    gather: ['viking', 'GatheringGround_1_55', true],
    labor: ['viking', 'WorkingA', true],
    laborB: ['viking', 'WorkingB', true],
    cook: ['viking', 'SaltbaeCook', true],
    readyWork: ['viking', 'ReadytoWorkA_1_40', true],
    craft: ['nerd', 'Crafting', true],
    repair: ['nerd', 'Loop Repair', true],
    grab: ['marie', 'Grabbing', false],
    smash: ['marie', 'Smashing', true],
    haul: ['marie', 'Rope', true],
    guardIdle: ['nerd', 'Idle Combat Unarmed', true],
    meleeIdle: ['nerd', 'Melee Idle Combat', true],
    punchRight: ['nerd', 'Right Cross', false],
    punchLeft: ['nerd', 'Left Cross', false],
    kick: ['nerd', 'Kick Right', false],
    swing: ['nerd', 'Melee Swing', false],
    strike: ['viking', 'Melee_1_40', false],
    stab: ['nerd', 'Stab Knife', false],
  },
  transitions: {
    sitDown: ['business', 'sitting_start', false],
    standUp: ['business', 'sitting_end', false],
    riseUp: ['viking', 'RiseUP', false],
    wakeUp: ['adventurer', 'crashed_wake', false],
    idleToSneak: ['nerd', 'Idle-To-Sneak', false],
    jumpStart: ['nerd', 'Jump Start', false],
    jumpLand: ['nerd', 'Jump Land', false],
    land: ['adventurer', 'landing', false],
    takeHit: ['nerd', 'Take Damage', false],
    fallWounded: ['marie', 'FallingWounded', false],
    deathA: ['viking', 'DeathA_1_52', false],
    deathB: ['viking', 'DeathB_1_55', false],
    lieDead: ['viking', 'DeathQuiet', true],
  },
};
