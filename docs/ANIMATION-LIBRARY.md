# Biblioteca de animações — estado em 2026-11-17

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

## Pendentes

A meta do prompt é 100 animações: 25 de locomoção humana, 20 sociais, 20 de
profissões, 10 de transição e 25 de animais. **Feito: 21 de animais. Falta o
restante:**

- **Humanas (75)**: locomoção, social, profissões e transições. Nenhuma foi
  importada ainda.
  - O `Humanoid` do jogo é feito de peças com juntas, não de malha com
    esqueleto. Precisa de um passo de retarget próprio: fonte humanoide →
    juntas do `Humanoid`.
  - As bibliotecas citadas (Quaternius UAL, KayKit, Mixamo…) não estão
    acessíveis neste ambiente: o GitHub e os sites delas estão fora da rede
    liberada, e o Mixamo exige login da Adobe.
  - Caminho possível: humanoides CC0/CC BY do próprio Sketchfab, já liberado,
    ou o dono do jogo enviar os arquivos `.glb`/`.fbx`.
- **Animais faltando da lista prioritária**: babuíno e píton. A píton precisa
  de outro rig, de cobra (cadeia única), e o modelo `serpente` do jogo não é
  riggado.
- **Clipes extras do leão**: trot e roar estão na biblioteca mas a máquina
  de estados ainda não tem estados para eles (trote em velocidade média;
  rugido no aviso territorial).
- **IK de pés, inclinação em rampa e camadas aditivas**: com clipes, o
  ajuste em rampa e o pé no chão ainda são os do procedural (só fora d'água).
  Falta IK sobre o resultado do mixer.
- **Revalidação**: rodar o `retarget.mjs` de novo regrava o catálogo, e as
  entradas perdem o estado `validado-visual` (voltam a `gerado`) até nova
  revisão dos strips.
