# Combate corpo a corpo, skills e IA — guia

Sistema modular em `src/combat/`. A **lógica não conhece a cena**: entidades,
estados, hitboxes e projéteis são matemática pura, testada em
`tests/unit/combat/`. A renderização (arma, poses, efeitos, debug) só escuta
os eventos do `CombatWorld`.

## Arquivos

| Arquivo | Papel |
|---|---|
| `src/config/meleeCombat.js` | **Todos os números**: tempos, alcance, dano, empurrão, recargas, teclas, IA, efeitos, arena |
| `src/config/meleePoses.js` | Poses-chave dos golpes (animação procedural) |
| `src/combat/CombatStates.js` | Máquina de estados e a tabela de transições permitidas |
| `src/combat/Hitbox.js` | Cone (distância + produto escalar + altura), varredura de projétil, cápsula, `HitOnce` |
| `src/combat/Skill.js` | `Skill` e as 4 skills: `ComboSkill`, `DashSkill`, `MeleeSkill` (giratório), `ProjectileSkill` |
| `src/combat/CombatEntity.js` | Entidade compartilhada (jogador e inimigos): fases, esquiva, hitstop, empurrão |
| `src/combat/CombatWorld.js` | Entidades + alvos passivos + projéteis; resolve acertos; emite eventos |
| `src/combat/EnemyAI.js` | Decisão da IA (mesmas entidades e skills) |
| `src/combat/Duelist.js` | Inimigo de treino (Humanoid + entidade + IA) |
| `src/combat/anim/HumanoidCombatAnimator.js` | Animação procedural por fase (personagens de juntas) |
| `src/combat/anim/MixerCombatAnimator.js` | Animação com AnimationMixer (GLTF/FBX): `crossFadeTo` + velocidade por fase |
| `src/combat/render/CombatFeel.js` | Arma, rastro do corte, flash, tremor, VFX das skills, aviso da IA, `DEBUG_HITBOX` |
| `src/systems/MeleeController.js` | Liga tudo ao `Game`: teclas, jogador, alvos antigos, paredes, arena |

## Estados

```
IDLE ⇄ MOVING → STARTUP → ACTIVE → RECOVERY → IDLE
                              RECOVERY → STARTUP   (só o combo, com input na janela)
IDLE/MOVING/RECOVERY → DODGE                        (o único cancelamento)
qualquer vivo → STUNNED (interrompe o golpe) · qualquer → DEAD
```

- Não dá para atacar atordoado.
- Não dá para usar duas skills ao mesmo tempo.
- Não dá para esquivar no STARTUP nem no ACTIVE.
- A tabela de transições permitidas é `TRANSITIONS`, em `CombatStates.js`.

## Onde estão os inputs

São conectados em `src/core/Game.js`, só com **Mãos Livres** no slot.

**Clique esquerdo:** `Game.tryAttack()` → `melee.combo()`. A ordem de
prioridade continua a de antes:

1. item equipado → usa o item;
2. mirando um NPC que conversa → abre o diálogo;
3. senão → golpe do combo.

**As outras teclas:** `melee.handleInput(input)`, chamado no loop **antes**
de `player.update`.

| Tecla | Ação | Onde mudar |
|---|---|---|
| Clique esquerdo | Combo (clique de novo durante o golpe para emendar) | `MELEE.keys.combo` |
| Clique direito | Onda de Choque (sai para onde a câmera olha) | `MELEE.keys.shockwave` |
| Z | Esquiva (+ WASD para a direção; sem tecla, para trás) | `MELEE.keys.dodge` |
| X | Investida Cortante | `MELEE.keys.dash` |
| B | Golpe Giratório | `MELEE.keys.whirlwind` |
| F8 | Liga/desliga o desenho das hitboxes | `MELEE.debugKey` |
| F7 | Câmera lenta (0,25×) para ajustar tempos | `MELEE.slowMoKey`, `MELEE.slowMo` |

Q/R giram a câmera, F é a viagem rápida, C a inspeção e E interagir. Por
isso as skills ficaram em Z/X/B e no botão direito. Com outro item na mão, R
e X continuam sendo recarregar e o arco.

### Ordem no loop (`Game.update`)

```js
this.melee.handleInput(input, { busy });   // aciona skills, trava o andar durante o golpe
this.player.update(dt, input, cameraRig);  // anda + animação base
this.melee.update(dt);                     // fases, hitboxes, projéteis, IA, poses de golpe, efeitos
```

Durante STARTUP, ACTIVE, RECOVERY, DODGE e STUNNED o controle não move o
corpo (`player.combatLock`). Quem move o corpo nesses estados:

- o avanço do golpe (lunge);
- a investida;
- a esquiva;
- o empurrão.

## Ajustar os tempos e o alcance da hitbox

Tudo fica em `MELEE.skills` (`src/config/meleeCombat.js`):

```js
dash: { startup: 0.16, active: 0.22, recovery: 0.3, distance: 6.5, width: 1.1, damage: 16, knockback: 3, ... }
```

- **`startup`**: tempo de antecipação. Na IA é o aviso, multiplicado por
  `duelist.skillScale.startup`. Quanto maior, mais fácil desviar.
- **`active`**: a única janela em que a hitbox existe. Curta demais pode
  "piscar" num quadro só, mas ainda acerta: a hitbox é testada no 1º quadro
  do ACTIVE.
- **`recovery`**: punição depois do golpe. A esquiva cancela.
- **`range`**: alcance do golpe, medido até a borda do corpo do alvo.
- **`angle`**: abertura total do cone (`360` = em volta).
- **`height`**: faixa vertical acertável.
- **Combo**: cada golpe tem os mesmos campos em `steps[i]`. `inputWindow` é
  quanto tempo depois do ACTIVE o clique ainda emenda o próximo golpe.
- **Golpes 1 e 2 do combo**: precisam de `knockback` pequeno. Um empurrão
  grande tira o alvo do alcance do golpe seguinte, e há um teste de
  regressão para isso.

**Como testar:** ligue **F8** para ver a hitbox e **F7** para câmera lenta.
O cone, o anel, a cápsula ou a esfera em wireframe aparecem só enquanto o
golpe está no ACTIVE. A animação procedural e o adaptador de
`AnimationMixer` leem os mesmos tempos, então o corte visual sai sempre junto
com a hitbox.

Sensação de impacto, em `MELEE.feel`:
- `hitstop`: 45 ms, nos dois personagens;
- `heavyHitstop`;
- `flashTime` e as cores do flash;
- `shake` (tremor de câmera);
- `knockbackDamp`: quanto o empurrão desliza.

## IA

Configurada em `MELEE.ai`:

- **Aggro:** `aggroRadius`.
- **Distância → skill:**
  - colado, com vida baixa ou cercado → Golpe Giratório;
  - corpo a corpo → Combo;
  - entre `dashRange` → Investida;
  - entre `shockwaveRange` → Onda de Choque.
- **Aviso:** a arma brilha e um anel laranja aparece no chão durante todo o
  STARTUP.
- **Tudo em recarga:** circula de lado (`strafeDistance`, `strafeSwitch`).
  A IA descansa `duelist.comboCooldown` entre combos, e é nesse intervalo que
  ela circula.
- **Inimigo novo:** crie um `CombatEntity` com um `body` (pos, facing, move,
  face) e as skills de `createSkills(...)`, e passe-o a um `EnemyAI`. O
  `Duelist.js` é o exemplo completo.

## Personagem com AnimationMixer (GLTF)

```js
const anim = new MixerCombatAnimator(mixer, gltf.animations, {
  map: { slashRight: 'Attack1', slashLeft: 'Attack2', overhead: 'Attack3', thrust: 'Stab', spin: 'Spin',
         idle: 'Idle', move: 'Run', stunned: 'Hit', dead: 'Death', dodge: 'Roll' },
  marks: { Attack1: [0.35, 0.55] }, // fração do clipe onde o corte começa/termina
  fade: 0.12,
});
// no loop: anim.update(entity, dt)
```

Cada fase da skill toca o trecho correspondente do clipe:

| Fase | Trecho do clipe |
|---|---|
| STARTUP | antes da marca |
| ACTIVE | entre as marcas |
| RECOVERY | depois |

A velocidade é ajustada para cada trecho caber exatamente no tempo da fase.
O hitstop congela o clipe.

## Alvos que já existiam

NPCs, o boneco de treino, os animais e os caçadores continuam registrados no
`Combat` antigo (`game.combat.register`). O `MeleeController` lê esse registro
e transforma cada um num alvo cilíndrico, sem mudar nenhuma dessas classes:

- `userData.hitRadius`, `hitHeight` e `hitCentered` ajustam o tamanho;
- a IA nunca bate nesses alvos (time `neutral`);
- o jogador bate.
