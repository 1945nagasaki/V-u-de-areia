# Créditos — animações

## Animais

As animações em `animals/` foram **retargetadas** (movimento copiado osso a
osso, sem geometria nem texturas) a partir dos modelos abaixo, todos sob
**CC Attribution 4.0** (https://creativecommons.org/licenses/by/4.0/).
Nenhuma malha, textura ou material dessas fontes é distribuída no jogo: só a
direção dos ossos, quadro a quadro, aplicada aos esqueletos dos modelos do jogo.
Ferramenta: `tools/anim/retarget.mjs`. Catálogo: `animals/catalog.json`.

| Arquivo do jogo | Clipes | Fonte (Sketchfab) | Autor | Licença |
|---|---|---|---|---|
| `animals/jacare.json` | idle, walk, run, attack | [Crocodile](https://sketchfab.com/3d-models/crocodile-172fe452ff70488191ba92779e5f4c31) | planeta-elefante | CC BY 4.0 |
| `animals/hipoEsfolado.json` | idle, walk, run, attack | [Hippopotamus](https://sketchfab.com/3d-models/hippopotamus-b6f94ccfd88442b9b92a9484d27561a5) | planeta-elefante | CC BY 4.0 |
| `animals/leao.json` | idle, walk, trot, run, roar | [Siberian Tiger - Rigged, Animated, Fur (Amur)](https://sketchfab.com/3d-models/siberian-tiger-rigged-animated-fur-amur-860f119b7a9f485096136789eedee908) | Animal Animator | CC BY 4.0 |
| `animals/leao.json` | attack | [Tiger](https://sketchfab.com/3d-models/tiger-67bbedd727a047869ef7c7b608445484) | Blender Artist | CC BY 4.0 |
| `animals/mamute.json` | idle, walk, run, eat, attack | [African Elephant Bull - Rigged & Animated](https://sketchfab.com/3d-models/african-elephant-bull-rigged-animated-436483857ce84c77bd0f6c76fb3d4d2d) | Animal Animator | CC BY 4.0 |
| `animals/rinoceronte.json` | walk | [Animated Rhinoceros Walking Animal Loop](https://sketchfab.com/3d-models/animated-rhinoceros-walking-animal-loop-32abc12d4fe44bd0b116b294194d9615) | LasquetiSpice | CC BY 4.0 |
| `animals/rinoceronte.json` | run | [Animated 3D Grey Rhino Running Loop](https://sketchfab.com/3d-models/animated-3d-grey-rhino-running-loop-2345603eec5e4e54a293c39833684525) | LasquetiSpice | CC BY 4.0 |

Alteração (exigida pela CC BY): as animações foram convertidas para outro
esqueleto, reamostradas a 30 quadros/s, com o sobe-e-desce da cauda amortecido
(30 %) e o deslocamento vertical do corpo limitado.

## Humanos

As animações em `humans/` (82 clipes: locomoção, social, profissões e
transições) foram **retargetadas** para o boneco humano do jogo (`Humanoid`,
feito de peças com juntas). Nenhuma malha, textura ou material das fontes vai
para o jogo: só a rotação das juntas, quadro a quadro. Todas sob **CC BY 4.0**.
Ferramenta: `tools/anim/retargetHuman.mjs`; catálogo: `humans/catalog.json`
(diz a fonte e o clipe de origem de cada animação).

| Fonte (Sketchfab) | Autor | Usada para |
|---|---|---|
| [Nerd Survivor](https://sketchfab.com/3d-models/nerd-survivor-8820dc9256a84aed8598eef5b67afad9) | HighPolyDensity | idles, andar/correr (frente, trás, lados), furtivo, pulo, escalada, gestos (acenar, pedir ajuda, recusar), personalidades, comer/beber, ofício, conserto, luta, transições |
| [Viking Framps Worker](https://sketchfab.com/3d-models/viking-framps-worker-cef34035d74c4dfdb9cad45fa36da294) | RG3D (Reifus.Rufus) | idles e andares de aldeão, ferreiro, semear, colher, trabalho braçal, cozinhar, pagar, levantar, mortes |
| [Marie Survivor](https://sketchfab.com/3d-models/marie-survivor-05e8bdf53c3f411ba2517430a22368c9) | RG3D (Reifus.Rufus) | conversar (3), dar/receber, andar carregando, pegar do chão, pisar, puxar corda, cair ferido |
| [Business Man - Low Polygon game character](https://sketchfab.com/3d-models/business-man-low-polygon-game-character-b6f6740f883b4749abac47af0045a9dd) | manoeldarochadeoliveira | sentar, sentado, levantar, girar no lugar |
| [Male Adventurer](https://sketchfab.com/3d-models/male-adventurer-3f5f7d12c07445fe9b8c4958935970e2) | manoeldarochadeoliveira | idle cansado, andar de lado, queda, aterrissar, acordar do chão |

Alteração (exigida pela CC BY): convertidas para outro esqueleto (direção dos
segmentos + rotação da bacia/cabeça), reamostradas a 30 quadros/s (15 nos
clipes longos), com pés presos ao chão, mão e pé amortecidos, emenda dos laços
suavizada e deslocamento do corpo removido (o jogo move o personagem).
