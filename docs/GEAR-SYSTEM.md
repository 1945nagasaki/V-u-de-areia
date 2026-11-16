# Pacote de itens (Icones.zip) — armas, ferramentas, munição, comida, recursos e relíquias

Visão de código do pacote de 34 itens. Última atualização: 2026-11-12.

## 1. Onde está cada coisa

| O quê | Arquivo |
|---|---|
| **Todos os números** (dano, durabilidade, intervalos, recarga, fome, pilhas, preços, estoque) | `src/config/gear.js` |
| Empunhadura (mão, posição, rotação, escala) e poses dos braços | `src/config/gearGrips.js` |
| Lista dos PNGs coloridos existentes (gerada) | `src/config/gearIcons.js` |
| Regras puras: instâncias, durabilidade, golpe, arma de fogo, arco | `src/systems/gear/Equipment.js` |
| Regras puras: fome/estamina e consumo com tempo | `src/systems/gear/Consumption.js` |
| Regras puras: espaços da mochila, loja/estoque, extração | `src/systems/gear/Trade.js` |
| Regras puras: save (montar e validar) | `src/systems/gear/GearSave.js` |
| Cola com o jogo (clique, R, X, loja, HUD, save) | `src/systems/gear/GearController.js` → `game.gear` |
| Modelos 3D procedurais | `src/render/gear/GearModels.js` |
| Item na mão + animações (3ª e 1ª pessoa) | `src/render/gear/HeldItem.js` |
| HUD do item e ícones | `src/ui/gear/GearHUD.js`, `src/ui/gear/ItemIcon.js` |
| Testes | `tests/unit/gear/*.test.js` (49 testes) |
| Laboratório, ícones e verificação no jogo | `tools/item-lab.html`, `tools/icon-sheet.html`, `tools/gear/*.mjs` |

Pontos de encaixe em arquivos que já existiam (edições pequenas): `Game.js` (cria `game.gear`, `useEquipped`,
`equipFromBackpack`, `updateHunting`, loop, comércio, "armado"), `Combat.js` (`strike`), `config/hunting.js` e
`ProjectileMeshes.js` (bala), `CameraRig.js` (tecla R), `Mechanics.js` (lojista), `UI.js` (hotbar), `BackpackUI.js`
(equipamentos, detalhes, espaços), `ui/jei/*` (ícone colorido), `config/items.js`, `config/gameplay.js` (efeito `cafe`),
`RecipeRegistry.js` (arco/flecha deixam de ser fabricáveis), `PauseMenu.js` (lista de teclas), `style.css`.

## 2. Itens e ids

34 itens originais → 44 definições (`PACK_ITEMS` em `config/gear.js` lista base → variantes).

- **Com 3 níveis** (`_pedra`, `_ouro`, `_metal`): `adaga`, `espada`, `machado`, `picareta`. Flechas: `flecha` (pedra —
  mantém o id antigo do jogo), `flecha_ouro`, `flecha_metal`.
- **Sem nível**: `arco` (madeira), `pistola`, `rifle` (categoria metal), `municao_pistola`, `municao_rifle`.
- **Recursos**: `pedra`, `graveto` (já existiam; mantêm o texto antigo porque têm uso no crafting), `barra_metal`, `barra_ouro`.
- **Comida/bebida**: `biscoito tomate cenoura uva maca banana milho queijo pao hamburguer agua cafe`.
- **Cápsulas**: `drogas` (nome original; uso desabilitado).
- **Relíquias**: `reliquia_capa _coroa _costela _cranio _dente _escudo _espada`.

Campos de toda definição: `id, name, description, category, materialTier, icon, image, model, damage, durabilityMax,
hungerRestore, staminaRestore, useDuration, stackLimit, acquisition, craftable, effects` (+ específicos: `magazine`,
`reloadSeconds`, `ammo`, `gather`, `gatherEfficiency`, `pack`, `price`; relíquias: `unique`, `biomeId`, `originCultureId`).

## 3. Regras (como ficou no jogo)

- **Dano fixo por acerto**, com teto por nível (pedra 10, ouro 20, metal 30). Flechas e balas do pacote **não** usam o
  multiplicador de zona da caça (sem abate por cabeça): `GearController.onProjectileEvent` aplica `p.gear.damage`.
- **Golpe**: clique começa o golpe; o acerto é testado **uma vez**, na janela de impacto (`MeleeSwing`). Intervalos:
  adaga 0,45 · espada 0,90 · machado 1,00 · picareta 1,10 s.
- **Durabilidade**: −1 por impacto válido (alvo registrado no `Combat` ou alvo de extração) e por disparo. Golpe no ar
  não gasta. Em 0: quebrado, inutilizável. Aviso abaixo de 20% (HUD, hotbar, mochila). Sem conserto.
- **Extração**: machado em tronco (`collisions` tag `trunk`), picareta em rocha (`boulder`). Cada impacto soma a
  eficiência (1 / 1,5 / 2) ao progresso; com 4 de trabalho o alvo entrega 2 gravetos / 2 pedras.
- **Arco**: clique → 1 s de preparo → dispara sozinho. Dano = só o da flecha. 1 flecha por disparo, gasta no disparo.
  Flecha disparada some ao cravar (sem recuperar). **X** troca o tipo de flecha.
- **Armas de fogo**: semiautomáticas; carregador e reserva (mochila) separados; **R** recarrega; tiro bloqueado na
  recarga; `transferir = min(capacidade − carregador, reserva)`; cancelar (trocar de item) não transfere nem perde.
  Compradas chegam descarregadas. Só funcionam na superfície.
- **Tecla R**: com arma de fogo na mão, recarrega; sem ela, continua girando a câmera (uso antigo). Não há conflito
  com o R do catálogo (só vale com a mochila aberta).
- **Comida/bebida**: ação com tempo; efeito e gasto só ao terminar; clicar de novo cancela; trocar de item cancela se
  começou pela mão. Comer com fome cheia / beber água com estamina cheia é impedido. Café pode sempre.
- **Fome**: o jogo tem proteínas, carboidratos e gorduras. "Fome/saciedade" = média das três; "recuperar N" = +N em
  cada uma (teto 100). A Água do pacote recupera **estamina** (não a barra de hidratação). Ver `SurvivalNeeds`.
- **Café**: efeito de status `cafe` (`×1,25` em `speed`, 10 s). `PlayerState.addEffect` renova a duração em vez de
  acumular. `speed` vale para andar/correr/nadar; salto, ataque, recarga e projéteis não usam esse modificador.
- **Mochila**: 48 espaços; cada pilha ocupa `ceil(qtd / limite)`; equipamento = 1 espaço. O limite é verificado nas
  **compras**; a coleta antiga do jogo continua sem bloqueio.
- **Lojas**: ferreiro (morador) = armas, ferramentas, flechas, munição + a lista antiga; mercador e lojista fixo =
  comida, bebida, recursos + a lista antiga. Estoque por vendedor, reposto a cada 24 h de jogo. Relíquias e cápsulas
  não são vendidas.
- **Save** (`localStorage`, chave `rpg_africa.gear.v1`): moedas, mochila, hotbar, equipamentos (durabilidade e
  carregador), efeitos com duração restante, estoque das lojas. Grava a cada 20 s, ao comprar e ao fechar a página.
  Carregar **substitui** o estado. Abrir com `?novo` apaga o save. **Não salva** posição, vida, ferimentos, crimes.

## 4. Decisões tomadas sem confirmação do dono (rever)

1. **Arco e flecha de pedra são fabricáveis** (decisão do dono em 2026-11-12): voltaram as receitas `arco`,
   `arco_tripas` e `flecha` (3 flechas de ponta de pedra). Também se compram no ferreiro. Flechas de ouro e de
   metal e todo o resto do pacote só se compram (`CRAFTABLE_IDS` em `config/gear.js`). O arco fabricado é o mesmo
   item: nasce com durabilidade cheia (240) e segue as regras do pacote.
2. **Banana** passou a seguir a tabela do pacote (fome 15, consumo de 1,2 s) em vez dos macros antigos.
3. **Fome = média das três barras** (ver acima).
4. **Arma branca em morador = nocaute/agressão** (mesma regra do soco); flecha/bala em morador segue a lei antiga
   (pernas derrubam, o resto mata).
5. **Preços e estoques** são provisórios (`ECONOMY.balancePending = true`).
6. Não há **venda** de recursos para NPCs (só compra).

## 5. Pendências

- **Ícones do Icones.zip**: o arquivo não estava no computador. Os PNGs atuais (512×512, fundo transparente, contorno)
  são renderizações dos modelos 3D — **provisórios**. Quando o ZIP chegar: guardar os originais em
  `assets-src/icones-originais/`, colorir preservando a silhueta e salvar com os mesmos nomes em
  `public/assets/icons/items/`. Atlas não foi gerado (era opcional).
- **Modelos externos**: nenhum foi baixado; os links não vieram no texto do pedido. Ver `CREDITS-ITEMS.md`.
- **Relíquias**: `biomeId` e `originCultureId` nulos até o mapa/história definirem a associação.
- **Som**: tiros, golpes e recarga não têm áudio.
- Flechas/balas não colidem com casas (igual às lanças antigas): só com o chão e com hitboxes.

## 6. Como verificar

```bash
npm test                                   # 487 testes (49 do pacote em tests/unit/gear)
npx vite --port 5199 --strictPort          # em outro terminal
node tools/gear/game-check.mjs             # 41 verificações no jogo real + prints em production/qa/evidence/itens
node tools/gear/lab-shots.mjs              # poses na mão (3ª e 1ª pessoa)
node tools/gear/export-item-icons.mjs      # regenera os ícones provisórios
```

No console do jogo: `game.gear.give('pistola')`, `game.gear.give('municao_pistola', 32)`, `game.gear.equip('pao')`,
`game.gear.resetSave()`. Laboratório: `/tools/item-lab.html?item=rifle&action=reload&t=0.4` (inclui as relíquias).
