# Biblioteca de animações — estado em 2026-11-17 (animais + humanos)

Relatório pedido pelo "Prompt Mestre — Importação e reformulação de animações
3D reais". Regra seguida: **nada é dado como importado sem o arquivo verificado,
nem como funcionando sem teste**. Os modelos, texturas, materiais e escalas do
jogo **não foram alterados**: só recebem rotações de ossos.

## Como funciona

1. **Fontes**: `tools/sketchfab/sketchfab.py` busca e baixa pela API v3 do
   Sketchfab (token injetado pelo proxy do ambiente, nunca no código). O filtro
   aceita **somente** "CC Attribution" e "CC0 Public Domain". Os downloads
   ficam fora do repositório. O jogo não distribui malha nem textura das fontes.
2. **Retarget offline**: `node tools/anim/retarget.mjs <pasta-das-fontes> [espécies]`.
   - Para cada quadro (30 FPS), mede a direção de cada segmento do esqueleto
     da fonte (coluna, pescoço, cabeça, cauda e 4 pernas) e gira o osso
     equivalente do AutoRig do jogo pelo mesmo *swing*.
   - Isso independe de nomes, proporções e pose de repouso; a torção é
     descartada.
   - Ajustes: a cauda tem o sobe-e-desce amortecido (30 %) e nunca desce
     abaixo do repouso; o sobe-e-desce da pelve é limitado a −25 %…+35 % da
     altura do quadril.
   - O mapa de ossos de cada fonte e os pedidos por espécie ficam em
     `tools/anim/sources.mjs`. O núcleo matemático em `tools/anim/retargetCore.mjs`
     é testado em `tests/unit/anim/retarget-core.test.js`.
3. **Saída**: `public/assets/animations/animals/<espécie>.json`, com os clipes
   no formato `THREE.AnimationClip`, mais `catalog.json`. Cada entrada do
   catálogo traz nome, categoria, espécie, arquivo e clipe de origem, autor,
   licença, URL, duração, FPS, quadros, tipo de rig, estado de validação e
   evidência.
4. **No jogo**:
   - `motion: <url>` em `src/config/animalModels.js` faz o `AnimalModels`
     baixar a biblioteca **sob demanda**, junto com o modelo da espécie.
   - O `AnimalAnimationManager` passa a usar o `AnimationMixer`, com
     `crossFadeTo`, sincronia de fase andar↔correr, ritmo dos passos pela
     velocidade real e olhar aditivo da cabeça.
   - Nadando, a espécie volta ao procedural (ondulação horizontal).
   - Sem clipe de repouso, o clipe atual esmaece até a pose do modelo.
   - Sem clipe de morte, usa o tombo procedural.
5. **Validação**:
   - `tools/fauna/strip.html?id=<espécie>&states=<estados>` renderiza a
     espécie com a entidade real do jogo (`Animal`) quadro a quadro. Os
     estados podem ser os da máquina de estados ou `clip:<chave>` para tocar
     um clipe direto.
   - O mesmo vale para `tools/fauna/viewer.html`; `?motion=0` compara com o
     procedural antigo.
   - O teste `tests/unit/animation/animal-clips.test.js` checa os clipes
     gerados (sem NaN, quatérnios unitários, pernas que se mexem) e a volta
     ao repouso.

## Importadas e validadas (21 clipes, 5 espécies)

Todas foram vistas quadro a quadro nos *strips* (evidências em
`production/qa/evidence/anim-retarget-*-2026-11-17.png`) e carregadas pelo jogo
real (HTTP 200, sem erro no console).

| Espécie do jogo | Clipes | Fonte | Usados pela máquina de estados |
|---|---|---|---|
| Jacaré (`jacare`) | idle, walk, run, attack | Crocodile — planeta-elefante | todos |
| Leão (`leao`) | idle, walk, trot, run, roar, attack | Siberian Tiger — Animal Animator; Tiger — Blender Artist | idle, walk, run, attack (trot e roar ficam na biblioteca) |
| Mamute (`mamute`) | idle, walk, run, eat, attack | African Elephant Bull — Animal Animator | todos |
| Rinoceronte (`rinoceronte`) | walk, run | Rhinoceros Walking / Grey Rhino Running — LasquetiSpice | todos (parado volta ao repouso do modelo) |
| Hipopótamo Esfolado (`hipoEsfolado`) | idle, walk, run, attack | Hippopotamus — planeta-elefante | todos (morte procedural) |

Créditos CC BY: `public/assets/animations/CREDITS.md`.

## Reprovadas (geradas, vistas e retiradas do jogo)

| Clipe | Problema visto | Como corrigir |
|---|---|---|
| leao.eat (Tiger/Eat) | Fica em pose de bote: o corpo não desce até a carcaça | Liberar a descida da pelve por clipe (limite de −25 % só para locomoção) |
| leao.lie (Tiger/Idle_Lie Prone) | Patas esticadas com o corpo no alto, sem deitar | Mesmo ajuste, e transferir a altura absoluta da pelve |
| hipoEsfolado.death (Hippopotamus/Die) | A queda é um giro do corpo todo e o retarget só passa a direção dos ossos, então fica agachado de lado | Transferir a rotação da pelve (raiz) além da direção dos segmentos |

## Humanas (82 clipes, 4 categorias)

O boneco humano do jogo (`src/entities/Humanoid.js`) é feito de peças com
juntas (quadril→joelho→pé, ombro→cotovelo→mão, tronco, cabeça), sem malha com
esqueleto. Por isso tem um retarget próprio:

- **Ferramenta**: `node tools/anim/retargetHuman.mjs <pasta-das-fontes> [categoria|chave…]`.
  As fontes e os pedidos estão em `tools/anim/humanSources.mjs`.
- **Como converte**:
  - **Coxa, canela, braço e antebraço**: seguem a **direção** do segmento da
    fonte, no referencial da junta-mãe. Isso independe da pose de repouso e
    das proporções.
  - **Tronco**: orientação absoluta (bacia→pescoço × ombro→ombro).
  - **Bacia e cabeça**: rotação relativa ao quadro 0 de um idle da fonte.
  - **Pé**: direção tornozelo→ponta.
  - **Mão**: amortecida e limitada a 46°.
- **Chão**: cinemática direta com as medidas reais do boneco.
  - Clipes de pé: o pé mais baixo fica exatamente no chão.
  - Corridas, pulos, quedas e mortes: só não atravessam o chão, contando
    também bacia, peito e cabeça.
- **Laços**: os últimos 0,2 s se misturam até o quadro 0, sem emenda.
- **Cadência**: medida no próprio clipe. É a velocidade com que o pé de apoio
  desliza para trás, nas proporções do boneco. Junto vai a fase em que a
  perna 0 está à frente.
- **Saída**: `public/assets/animations/humans/{locomotion,social,professions,transitions}.json`
  e `catalog.json`.
- **No jogo** (configurado em `src/config/humanAnimation.js`):
  - **Carregamento**: a `HumanClipLibrary` baixa locomoção, social e
    profissões no início. As transições ficam para quando forem pedidas.
    Até chegarem, ou se falharem, o boneco usa o procedural de antes.
  - **Locomoção** (todos os humanos, inclusive o jogador): parado, andando e
    correndo vêm dos clipes. A corrida entra pela velocidade (2→3 m/s).
  - **Ritmo dos passos**: velocidade real ÷ velocidade natural do clipe, para
    o pé não escorregar.
  - **Andar ↔ correr**: os dois compartilham a fase, alinhada pela perna 0.
  - **Por cima**: rampa, IK dos pés, pulo, nado e voo continuam procedurais.
  - **Gestos dos NPCs**: martelar, minerar, capinar, ofício, consertar,
    cozinhar, comer, conversar (3 variações por NPC), pregar, punhos e
    exausto viram clipes.
    - Sentado ou andando, o clipe vale só para tronco, cabeça e braços.
    - De pé no posto de trabalho, vale para o corpo inteiro.
    - Entrada e saída levam 0,3 s.
    - Gesto sem clipe continua procedural.
- **Testes** (`tests/unit/animation/human-clips.test.js`): verificam
  - clipes válidos;
  - laços sem emenda (regressão do martelo, que saltava 0,9 rad);
  - cadência = velocidade real;
  - pernas vindas do clipe;
  - procedural sem biblioteca;
  - gesto sentado que não mexe nas pernas;
  - entrada e saída sem salto;
  - clipe sem laço parado no último quadro.

| Categoria | Clipes |
|---|---|
| Locomoção (29) | idle, idleAlt, idleTired, idleWounded, idleWounded2, idleVillager, idleVillager2, walk, walkRelaxed, walkHeavy, walkTired, walkCarry, walkBack, walkStrafeLeft, walkStrafeRight, walkForwardLeft, walkForwardRight, run, runBack, runStrafeLeft, runStrafeRight, sneak, sneakIdle, sneakBack, hop, climb, turnLeft, turnRight, fall |
| Social (20) | wave, callHelp, refuse, puzzled, talkA, talkB, talkC, pay, giveTake, kneelPoint, bravado, stoic, fidget, vain, simple, wary, eat, drink, unwrap, sitIdle |
| Profissões e guarda (20) | smith, sow, gather, labor, laborB, cook, readyWork, craft, repair, grab, smash, haul · guardIdle, meleeIdle, punchRight, punchLeft, kick, swing, strike, stab |
| Transições (13) | sitDown, standUp, riseUp, wakeUp, idleToSneak, jumpStart, jumpLand, land, takeHit, fallWounded, deathA, deathB, lieDead |

Fontes, todas CC BY:
- Nerd Survivor (HighPolyDensity);
- Viking Framps Worker (RG3D);
- Marie Survivor (RG3D);
- Business Man (manoeldarochadeoliveira);
- Male Adventurer (manoeldarochadeoliveira).

Créditos em `public/assets/animations/CREDITS.md`.

**Reprovada:** `business/cycle_talking`. O corpo não se mexe: é animação do
rosto (maxilar e fonemas), e o boneco não tem rosto articulado.

**Ficam na biblioteca, sem uso automático:**
- `turnLeft`/`turnRight` giram o corpo inteiro, e no jogo o giro vem da raiz
  do personagem.
- Transições e mortes ainda não estão ligadas a eventos do jogo.

## Pendentes

Meta do prompt: 100 animações, sendo 25 de locomoção humana, 20 sociais, 20 de
profissões, 10 de transição e 25 de animais.

**Feito: 103.**
- Humanas (82): 29 de locomoção, 20 sociais, 20 de profissões e guarda,
  13 de transição.
- Animais (21).

Falta ou está incompleto:

- **Animais: 21 de 25.** Faltam babuíno e píton. A píton precisa de um rig
  de cobra (cadeia única), e o modelo `serpente` do jogo não é riggado.
- **Profissões**: 12 são de ofício e 8 de luta/guarda. Faltam ofícios
  específicos: pescar, cortar lenha com machado, serrar, tecer, amassar pão
  (hoje "ofício" genérico ou procedural).
- **Clipes reprovados dos animais**: leao.eat, leao.lie e hipoEsfolado.death
  (ver acima).
- **Transições e mortes humanas**: estão na biblioteca, mas não ligadas a
  eventos do jogo (sentar/levantar no banco, cair nocauteado, acordar). Hoje
  essas poses continuam procedurais.
- **Leão**: trote e rugido estão na biblioteca, sem estado que os use.
- **IK e camadas**: o IK dos pés e a inclinação em rampa dos humanos rodam
  por cima do clipe; nos animais com clipes, ainda não.
- **Revalidação**: rodar os retargets de novo regrava o catálogo, e as
  entradas voltam a `gerado` até nova revisão dos strips.
