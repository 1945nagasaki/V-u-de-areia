# Créditos — pacote de itens (modelos 3D e ícones)

Última atualização: 2026-11-12.

## Situação real de cada recurso

| Estado | O que significa | Quantos |
|---|---|---|
| **Encontrado** | Indicado no pedido como candidato (nome do modelo e do autor) | 34 |
| **Baixado** | Arquivo trazido para o projeto | **0** |
| **Adaptado** | Convertido/alterado a partir de um arquivo baixado | **0** |
| **Validado no jogo** | Visto na mão do personagem e no laboratório | 44 modelos **procedurais próprios** |

**Nenhum modelo externo foi baixado nem usado.** O texto do pedido trazia só os nomes ("Dagger — Quaternius"…),
sem os endereços das páginas; sem abrir cada página não dá para conferir licença, autoria e arquivos, e o pedido
exige essa conferência antes de integrar. Para não afirmar licença que não foi lida, **nenhuma licença é declarada
abaixo**.

## O que está no jogo hoje

Todos os 44 modelos (34 itens + variantes de material) foram **feitos neste projeto**, com geometria procedural do
Three.js, em `src/render/gear/GearModels.js`. Não derivam de nenhum arquivo de terceiros; seguem a licença do
próprio projeto. Por serem feitos aqui:

- pedra tem **geometria própria** (lascas facetadas, amarração de fibra), não é recoloração do aço;
- pistola e rifle têm **carregador e ferrolho separados** (a recarga tira e recoloca o carregador);
- o arco tem **corda e flecha móveis**.

Os **ícones** em `public/assets/icons/items/*.png` são renderizações desses modelos (provisórios — os desenhos do
`Icones.zip` ainda não foram coloridos porque o arquivo não estava no computador).

## Candidatos externos (pendentes de conferência)

Para cada um: abrir a página, anotar **autor, endereço, licença exata e alterações**, e só então baixar para
`public/assets/models/items/` e preencher `model.glb` em `src/config/gear.js` (o carregador de `GearModels` já usa
o GLB quando o campo existe). As licenças **não são todas iguais** — conferir uma a uma.

| Item | Candidato indicado | Endereço | Licença | Estado |
|---|---|---|---|---|
| Adaga | Dagger — Quaternius | não informado | não conferida | não baixado |
| Espada | Sword — Quaternius | não informado | não conferida | não baixado |
| Machado | Axe — CreativeTrio | não informado | não conferida | não baixado |
| Picareta | Pickaxe — CreativeTrio | não informado | não conferida | não baixado |
| Arco | Bow — CreativeTrio | não informado | não conferida | não baixado |
| Flecha | Arrow — CreativeTrio | não informado | não conferida | não baixado |
| Pistola | Glock — CreativeTrio | não informado | não conferida | não baixado |
| Rifle | Rifle — CreativeTrio | não informado | não conferida | não baixado |
| Munição de pistola | 9x19mm — J-Toastie | não informado | não conferida | não baixado |
| Munição de rifle | 7.62x39mm — J-Toastie | não informado | não conferida | não baixado |
| Pedra | Rock — Quaternius | não informado | não conferida | não baixado |
| Graveto | Twig — Kenney | não informado | não conferida | não baixado |
| Barra de metal | Metal Block — Quaternius (adaptar para barra) | não informado | não conferida | não baixado |
| Barra de ouro | Gold Ingots — Quaternius (separar uma barra) | não informado | não conferida | não baixado |
| Banana | Banana — Kenney | não informado | não conferida | não baixado |
| Biscoito | Cookie Chocolate — Kenney | não informado | não conferida | não baixado |
| Café | Cup Tea — Kenney (trocar o conteúdo) | não informado | não conferida | não baixado |
| Cenoura | Carrot — Kenney | não informado | não conferida | não baixado |
| Água | Water Bottle — Quaternius | não informado | não conferida | não baixado |
| Hambúrguer | Hamburger — jeremy | não informado | não conferida | não baixado |
| Maçã | Apple — Kenney | não informado | não conferida | não baixado |
| Milho | Corn — Kenney | não informado | não conferida | não baixado |
| Pão | Bread — Kenney | não informado | não conferida | não baixado |
| Queijo | Cheese Cut — Kenney | não informado | não conferida | não baixado |
| Tomate | Tomato — Zoe XR | não informado | não conferida | não baixado |
| Uva | Grapes — Kenney | não informado | não conferida | não baixado |
| Cápsulas / Drogas | Pill — Poly by Google | não informado | não conferida | não baixado |
| Relíquia Capa | Cloak, cape — POTVORA (pode precisar de otimização) | não informado | não conferida | não baixado |
| Relíquia Coroa | Crown — Poly by Google | não informado | não conferida | não baixado |
| Relíquia Costela | Rib-cage bones low poly prop — Eirik Sundby | não informado | não conferida | não baixado |
| Relíquia Crânio | Skull — Quaternius | não informado | não conferida | não baixado |
| Relíquia Dente | Tooth — sugamo | não informado | não conferida | não baixado |
| Relíquia Escudo | Shield — Quaternius | não informado | não conferida | não baixado |
| Relíquia Espada | Skull Sword — Mora (pode exigir adaptação visual) | não informado | não conferida | não baixado |

## Relíquias e origem cultural

Os modelos das relíquias são genéricos e **não comprovam origem cultural**. Nenhuma relíquia foi associada a bioma
ou povo: `biomeId` e `originCultureId` estão nulos em `src/config/gear.js` até o mapa e a história do projeto
definirem a associação.
