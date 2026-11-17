# Créditos — animações

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
