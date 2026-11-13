# Catálogo da fauna — estado em 2026-11-12

Documento de trabalho: o que existe no jogo, o que falta, de onde vêm os modelos,
quais as licenças e em que fontes se apoia o comportamento de cada espécie.
Regra de leitura: **"anunciado"** = o que a página do autor diz, sem teste;
**"testado"** = carregado no projeto e visto na área de teste (`tools/fauna/viewer.html`).

## 1. Pacote "Ultimate Animal Pack | 100 Animals | 50% off"

**O arquivo `ultimate_animal_pack_100_animals__50_off.glb` não está no projeto** (nem em
Downloads/Desktop/Documents quando procurado). O inventário completo fica pendente; a
ferramenta está pronta:

```
node tools/fauna/inventory-glb.mjs <caminho>/ultimate_animal_pack_100_animals__50_off.glb --out design/fauna/inventario-pacote.md
```

O que já se sabe:

- **Sete modelos do jogo vêm desse pacote** (confirmado pelos metadados gravados nos próprios
  arquivos): `leao`, `hiena`, `lobo`, `urso`, `jacare`, `javali`, `alce`. Metadados: autor
  **WildMesh 3D** (https://sketchfab.com/WildMesh_3D), licença **CC-BY-NC-4.0**, origem
  https://sketchfab.com/3d-models/ultimate-animal-pack-100-animals-50-off-c7be3f41fb3a4ed6be31d0bcd86a4684.
- **Restrição:** CC-BY-NC = uso **não comercial**, com atribuição ao autor. Enquanto esses sete
  modelos estiverem no jogo, ele não pode ser vendido nem monetizado com eles. A página do
  Sketchfab remete a uma versão paga (Patreon/Fab) cuja licença comercial não foi lida.
- **Chegaram ao projeto como malhas estáticas**: 0 esqueletos e 0 clipes em cada um dos sete
  (testado com a ferramenta). O lobo do pacote original tem, segundo a inspeção informada pelo
  dono, 1 skin e 2 clipes (`Wolf_Howl`, `Wolf_WalkFast_F`); esses dados se perderam na separação
  feita antes (`Animais_comprimido.glb`). Com o arquivo original dá para refazer a separação do
  lobo preservando skin e clipes.
- **Conteúdo anunciado na página do Sketchfab (não testado):** "100 animated 3D animals";
  409,8 mil triângulos na cena; lista realista (63 nomes) e estilizada (36 nomes). Das espécies
  da savana pedidas aparecem os nomes: Lion, Lioness, Leopard, Hyena, Wildebeest, Buffalo,
  Elephant, Rhinoceros, Warthog, Crocodile (estilizado), Ostrich (estilizado). **Não aparecem:**
  guepardo, cão-selvagem, zebra, impala (só "Gazelle"), girafa, hipopótamo, abutre (só "Buzzard").
  A página não diz se o download gratuito traz o pacote inteiro ou só uma cena de prévia — a
  inspeção do dono (47 malhas, 1 skin, 2 clipes) indica que **não** são 100 animais animados.
- Itens do pacote que não são fauna africana e ficam fora: tigre, puma, lince, urso, alce, veado,
  canguru, mamute, animais de fazenda e domésticos, peixes, "Jaws", etc. "Jaguar" e "Alligator"
  não podem ser usados como leopardo ou crocodilo-do-nilo.

## 2. Modelos atualmente no jogo (testado: `inventory-glb.mjs` em cada arquivo)

| Espécie no jogo | Arquivo | Triângulos | Esqueleto / clipes no arquivo | Origem e licença | Observação |
|---|---|---|---|---|---|
| Leão | leao.glb | 16.474 | nenhum | WildMesh 3D, CC-BY-NC-4.0 | a malha é de uma **leoa** (sem juba) |
| Hiena | hiena.glb | 15.768 | nenhum | WildMesh 3D, CC-BY-NC-4.0 | espécie da malha não informada |
| Javali Corrompido | javali.glb | 19.604 | nenhum | WildMesh 3D, CC-BY-NC-4.0 | criatura de fantasia |
| Jacaré do Rio | jacare.glb | 29.321 | nenhum | WildMesh 3D, CC-BY-NC-4.0 | **aligátor**: substituir por crocodilo-do-nilo |
| Lobo | lobo.glb | 16.262 | nenhum | WildMesh 3D, CC-BY-NC-4.0 | **não africano** |
| Urso Pardo | urso.glb | 13.640 | nenhum | WildMesh 3D, CC-BY-NC-4.0 | **não africano** |
| Alce | alce.glb | 15.744 | nenhum | WildMesh 3D, CC-BY-NC-4.0 | **não africano** |
| Zebra | zebra.glb | 936 | nenhum | Poly by Google, CC-BY 3.0 | |
| Girafa | girafa.glb | 1.100 | nenhum | Poly by Google, CC-BY 3.0 | |
| Avestruz | avestruz.glb | 918 | nenhum | Poly by Google, CC-BY 3.0 | |
| Gorila | gorila.glb | 576 | nenhum | Poly by Google, CC-BY 3.0 | |
| Camelo | camelo.glb | 822 | nenhum | Poly by Google, CC-BY 3.0 | dromedário: Norte da África |
| Leopardo | leopardo.glb | 1.020 | nenhum | Poly by Google, CC-BY 3.0 | malha de **onça-pintada (Jaguar)**: substituir |
| Onça | onca.glb | 988 | nenhum | Poly by Google, CC-BY 3.0 | malha de leopardo-das-neves; **não africana** |
| Capivara | capivara.glb | 864 | nenhum | Poly by Google, CC-BY 3.0 | **não africana** |
| Arara-Vermelha | arara.glb | 651 | nenhum | Poly by Google, CC-BY 3.0 | **não africana** |
| Corvo | corvo.glb | 682 | nenhum | Poly by Google, CC-BY 3.0 | |
| Escorpião Gigante | escorpiao.glb | 724 | nenhum | Poly by Google, CC-BY 3.0 | fantasia |
| Víbora do Deserto | vibora.glb | 1.618 | 1 skin, 4 clipes (Attack, Idle, Jump, …) | Quaternius, CC0 | |
| Cérbero | cerbero.glb | 1.962 | 1 skin, 24 clipes (Attack, Death, Eating, Gallop, …) | Quaternius (lobo), CC0 | fantasia |
| Suricato | — | — | corpo procedural | — | sem modelo |

**Animação:** só a víbora e o cérbero tocam clipes originais. Todos os outros usam o esqueleto
gerado pelo jogo (16–19 ossos) e os ciclos procedurais (andar, trote/galope, ataque em 3 fases,
nado, salto, pastar/folhas/beber, morte). Isso preserva malha, UVs e materiais, mas **não é**
animação feita por animador nem validada contra a anatomia de cada espécie.

Decisão do dono (2026-11-12): as espécies não africanas e os dois modelos trocados **ficam no
jogo, sinalizados** (em laranja na área de teste; `native: false` / `model` em `config/foodWeb.js`).

## 3. Geografia

O mapa do jogo é uma África estilizada com sete biomas. Correspondência usada no catálogo:

| Bioma do jogo | Região real aproximada | Fauna atual | Problema |
|---|---|---|---|
| savana | savanas do leste e sul | zebra, leão, girafa | comunidade ainda pequena (ver pendentes) |
| kalahari | Kalahari / semiárido do sul | hiena, suricato, avestruz | — |
| equatorial | floresta da bacia do Congo | gorila, leopardo, "jacaré" | modelos do leopardo e do crocodilo a trocar |
| deserto | Saara | escorpião, camelo, víbora | — |
| taiga | **não existe na África** | lobo, alce, urso | bioma e fauna não africanos |
| tropical | floresta úmida | onça, capivara, arara | fauna sul-americana |
| preta | fantasia | javali corrompido, corvo, cérbero | fora do escopo zoológico |

Madagascar não está representado no mapa; quando houver, entra como comunidade separada
(lêmures, fossa — nenhum grande mamífero do continente).

## 4. Espécies: prontas, parciais e pendentes

**No jogo com dieta própria e pasto/sede simulados:** leão, zebra, girafa, hiena, avestruz,
leopardo*, gorila, crocodilo* ("jacaré"), camelo (* = modelo a substituir), mais as não africanas.

**Pendentes — sem modelo, não nascem no mundo** (`PENDING_SPECIES` em `config/foodWeb.js`):
guepardo, cão-selvagem-africano, gnu-azul, impala, búfalo-africano, elefante-africano,
rinoceronte-branco, rinoceronte-negro, hipopótamo, facóquero, abutre-de-dorso-branco.
Nenhuma reaproveita o modelo de outra espécie.

**Expansões futuras (outros grupos, ainda não pesquisados):** antílopes (cudo, órix, elande,
topi), babuínos e outros primatas, chacais, caracal e serval, mangustos, aves (secretário, grou,
calau, águia-pescadora, flamingo), répteis (varano, píton, tartarugas), fauna de montanha
(gelada, lobo-etíope, íbex-núbio) e de áreas alagadas (lechwe, sitatunga).

## 5. Candidatos de modelos (anunciado pelos autores — nada testado, nada baixado)

Pagos (apresentados à parte; **não comprados**):

- **"Low Poly + Realistic Savanna Animals – Animated"**, Romandy Development —
  https://www.fab.com/listings/d34eb080-35e1-4a45-8c76-5fbc1c4ff6a9 — R$ 167,44 (preço exibido
  na página). 10 animais com esqueleto e clipes: leão, elefante, girafa, zebra, rinoceronte-branco,
  hipopótamo, gnu-azul, guepardo, hiena-malhada, crocodilo-do-nilo. Formatos FBX e glTF 2.0 (.glb).
  828–14.770 triângulos (estilizado, 4 níveis) e 3.740–6.796 (realista). Clipes: Attack, Death,
  Eat, Howl, Idle, Roar, Run, Walk ("nem todo modelo tem todos"). Termos da licença não legíveis
  na página. **Faltam:** leopardo, cão-selvagem, impala, búfalo, facóquero, avestruz, abutre.
  É o candidato mais completo para a comunidade de savana, e o único com clipes por espécie.
- **"Ultimate Animal Mega Bundle (100 animals)"**, WildMesh 3D / AnimalMesh 3D (CGTrader) — a página
  não pôde ser lida. Pelo anúncio do autor no fórum da Unreal: FBX e .blend (sem glTF), "licença
  comercial", só alguns modelos com esqueleto e animação.

Gratuitos:

- **poly.pizza (Poly by Google e outros), CC-BY 3.0, OBJ/glTF, estáticos** — mesmo estilo dos
  modelos low-poly já usados no jogo: guepardo (https://poly.pizza/m/ew0sr-amXFo), hiena-malhada
  (https://poly.pizza/m/0yU1LU3Nkpu), cão-selvagem-africano (https://poly.pizza/m/fOTaXMg2WXE),
  elefante (https://poly.pizza/m/a27MA0rXyyj), rinoceronte (https://poly.pizza/m/9deYXdpoeTC),
  hipopótamo (https://poly.pizza/m/6fQJsxfOGUP), crocodilo (https://poly.pizza/m/fnUp2MrGjmr),
  leão (https://poly.pizza/m/3XAJojWxSWz). Sem esqueleto: usariam o esqueleto gerado pelo jogo.
  São **visualmente bem mais simples** que os sete modelos do WildMesh (≈1 mil contra ≈16 mil
  triângulos) — misturar os dois estilos na mesma savana é uma decisão do dono.
- **Sketchfab, CC-BY 4.0:** "African Elephant" de Joseph AYYAD, descrito como pacote de animação,
  3,1 mil triângulos (https://sketchfab.com/3d-models/african-elephant-facb060916534e7eae8e6a5a8056185f).
- **Quaternius "Ultimate Animated Animals" (CC0):** o site não respondeu; pelo espelho da GDevelop
  o pacote tem animais de fazenda, floresta e mar (alpaca, veado, touro, raposa, lobo, cavalo…) —
  **nenhuma** das espécies de savana.

Sem nenhum modelo gratuito adequado encontrado: leopardo, gnu, impala, búfalo-africano, facóquero,
abutre africano (só "Turkey vulture", americano) e crocodilo-do-nilo identificado como tal.

## 6. Comportamento real por espécie (fontes) e o que virou regra de jogo

Fontes lidas em 2026-11-12: Animal Diversity Web (ADW, `animaldiversity.org/accounts/<Gênero_espécie>/`)
e San Diego Zoo Wildlife Alliance (SDZ, `animals.sandiegozoo.org/animals/<nome>`). Os resumos
abaixo foram extraídos por leitura automática das páginas: **confira o texto original antes de
citar números**. "n/d" = a fonte lida não informa.

| Espécie | Alimentação (fonte) | Água | Social | Atividade | Caça / defesa (fonte) | Fontes |
|---|---|---|---|---|---|---|
| Leão *Panthera leo* | carnívoro; caça e rouba presas; no Serengeti zebra, gnu, gazela, búfalo, facóquero são 90% da dieta | n/d | bando de 2–40 (média 13) | noturno/crepuscular; descansa até 21 h | caça cooperativa das fêmeas, emboscada; sucesso 17% sozinho, 30% em grupo (ADW) | ADW Panthera_leo; SDZ lion |
| Leopardo *P. pardus* | carnívoro; presas de 10–40 kg; também carniça; guarda a presa na árvore | bebe pouco (até 10 dias sem beber, SDZ) | solitário | noturno | emboscada: chega a 3–10 m e salta, raramente persegue | ADW Panthera_pardus; SDZ leopard |
| Guepardo *Acinonyx jubatus* | carnívoro; gazelas, impala; raramente carniça | não precisa beber (SDZ) | fêmeas sós; machos em coalizão | diurno | corrida curta; **fontes divergem** sobre aproximação e sucesso ("maioria falha" ADW × "cerca de metade" SDZ); perde presas para leões e hienas | ADW Acinonyx_jubatus; SDZ cheetah |
| Hiena-malhada *Crocuta crocuta* | caçadora **e** necrófaga (70% de abates próprios num estudo no Kalahari, ADW) | n/d | clã de 3–80, liderado por fêmeas; grupos de caça de 2–5 | **divergente** (diurna ADW × noturna SDZ) | perseguição longa de animais jovens/fracos; grupos expulsam leões de uma carcaça | ADW Crocuta_crocuta; SDZ spotted-hyena |
| Cão-selvagem *Lycaon pictus* | carnívoro; impala, gnus e zebras velhos/doentes; **não** come carniça | n/d | matilha de 7–15 | diurno (manhã e fim de tarde) | perseguição cooperativa de resistência, por quilômetros | ADW Lycaon_pictus |
| Zebra-da-planície *Equus quagga* | pastadora (≈90% capim) | depende de água | haréns de 1 macho + 1–6 éguas; manadas | diurna; um vigia à noite | foge, coice e mordida; garanhão na retaguarda; círculo em volta do ferido | ADW Equus_burchellii; SDZ zebra |
| Gnu-azul *Connochaetes taurinus* | pastador de capim curto | **bebedor obrigatório** | manadas; milhares na migração | dia e noites de luar | agrupam-se, batem as patas, alarme | ADW Connochaetes_taurinus |
| Impala *Aepyceros melampus* | misto (capim; folhas na seca) | prefere água por perto | manadas de 15–100 fêmeas | diurna | foge com saltos de até 3 m | ADW Aepyceros_melampus |
| Búfalo-africano *Syncerus caffer* | pastador | a menos de 20 km de água | manadas de até mais de mil | ativo nas 24 h | manada, debandada, **contra-ataque**; touros enfrentam leões | ADW Syncerus_caffer |
| Girafa *Giraffa* | come folhas (acácia), flores, vagens | bebe só de vez em quando | grupos frouxos de 10–20 | diurna | corre, coices mortais; uma vigia enquanto as outras bebem | SDZ giraffe; ADW Giraffa_camelopardalis |
| Elefante-da-savana *Loxodonta africana* | misto: capim, folhas, casca, raízes, frutos | ≈50 galões por dia (ADW) | manada matriarcal de 6–70; machos sós | ativo quase 24 h | círculo de alerta com filhotes no meio; presas | SDZ elephant; ADW Loxodonta_africana |
| Rinoceronte-branco *Ceratotherium simum* | pastador (lábio quadrado) | até 2× por dia | territorial | dia (inverno) / crepúsculo (verão) | foge; fêmea defende o filhote | ADW Ceratotherium_simum |
| Rinoceronte-negro *Diceros bicornis* | come ramos e arbustos (lábio preênsil) | a menos de 25 km de água | solitário | manhã e fim de tarde | **investe** contra predadores | ADW Diceros_bicornis |
| Hipopótamo *Hippopotamus amphibius* | pastador noturno (≈40 kg por noite) | vive na água; pasta a menos de 1,6 km dela | grupos de 20–100 | noturno | bocejo de ameaça; adultos sem predadores | ADW Hippopotamus_amphibius |
| Facóquero *Phacochoerus africanus* | onívoro, sobretudo pastador; ajoelha para comer; cava raízes | n/d | grupos familiares de até 18 | diurno; tocas à noite | foge e entra em tocas | ADW Phacochoerus_africanus |
| Crocodilo-do-nilo *Crocodylus niloticus* | carnívoro, sobretudo peixe; também zebras, carniça | aquático | n/d | n/d | n/d — **fonte fraca**: ADW indisponível; usado National Geographic e página geral de crocodilianos do SDZ | natgeo nile-crocodile; SDZ crocodilian |
| Avestruz *Struthio camelus* | **divergente**: herbívoro (ADW) × onívoro (SDZ) | não precisa beber | bandos de 5–50 | diurno | corre; coice forte | ADW Struthio_camelus; SDZ ostrich |
| Abutre-de-dorso-branco *Gyps africanus* | necrófago; acha carcaças pela vista, segue outros abutres | n/d | colonial; hierarquia na carcaça | diurno | — **fonte fraca**: ADW indisponível; usado The Peregrine Fund | peregrinefund white-backed-vulture; SDZ vulture |

Velocidades citadas pelas fontes (não usadas como valores do jogo): leoa até 53 km/h (SDZ);
leopardo até 58–60 km/h; guepardo 80–112 km/h por poucas centenas de metros; hiena até 50–60 km/h;
cão-selvagem até 55 km/h; avestruz até 70 km/h; girafa até 56 km/h; elefante até 24 km/h;
rinoceronte-branco até 40 km/h; hipopótamo até 30 km/h em terra. Para zebra as fontes divergem
(55 mph ADW × "mais de 40 mph" SDZ). Sem número nas fontes lidas: gnu, impala, rinoceronte-negro,
facóquero, abutre.

### Biologia × jogabilidade

Vem das fontes (estrutura das regras): quem é pastador, quem come folhas, quem é misto ou onívoro;
quem caça o quê; quem é necrófago; quem depende de água; quem vive em grupo.

É ajuste de jogo, **não** dado científico: todas as taxas e limiares em `config/foodWeb.js` e
`config/ecosystem.js` (fome em 5 min, rebrota em 10 min, raio de busca, chance estatística de
abate), as velocidades `walk`/`run` de `config/fauna.js`, vida e dano. As fontes não dão taxas de
sucesso para a maioria das espécies, então o jogo **não** tem taxa de sucesso por espécie.

Desvios conhecidos em relação às fontes, a corrigir quando houver modelos: a hiena do jogo caça
suricatos (as fontes citam gnu, zebra, gazela); o leão não tem gnu/búfalo/facóquero (pendentes);
o avestruz está como onívoro (fontes divergem); gorilas e camelos não têm predador no jogo.

## 7. O que está implementado na simulação

- **Teia alimentar por espécie** (`config/foodWeb.js`): presas próprias de leão, hiena, leopardo,
  crocodilo, lobo, urso e onça. O leão deixou de caçar lobo, hiena, leopardo, gorila e camelo; o
  lobo passou a caçar alce (antes não tinha presa no próprio bioma). Javali corrompido, cérbero,
  víbora e escorpião seguem na regra antiga por nível.
- **Tipos alimentares:** pastador (zebra, capivara), comedor de folhas (girafa, gorila, alce),
  misto (camelo), onívoro (avestruz, urso), carnívoro, necrófago (hiena, corvo, leão e crocodilo
  aproveitam carcaças).
- **Vegetação como recurso** (`systems/fauna/Foraging.js`): capim e folhagem por célula de 24 m,
  com capacidade vinda de `config/biomes.js`; o que é comido sai da célula e rebrota. Sem
  vegetação dentro d'água nem nas vilas.
- **Fome de herbívoro e sede**: sobem com o tempo; o animal escolhe um lugar, **anda até lá** e só
  então come/bebe — a fome cai pelo que saiu de fato do pedaço. Ameaça, caçada e carcaça têm
  prioridade; há histerese para não trocar de ideia a cada quadro.
- **Animação de alimentação:** pastar (cabeça no chão), folhas (girafa com a cabeça erguida,
  puxando ramos; demais à meia altura), beber (boca na água), carcaça (arrancar pedaços).
- Já existiam e continuam: fome e energia dos predadores, caça só com fome, escolha de presa por
  distância/saúde/idade/manqueira, matilhas (lobo, hiena), manadas com vigia e círculo defensivo,
  carcaças e necrófagos, caçadas distantes resolvidas por estatística, grade espacial, decisão a
  cada 0,25 s, dano no momento do impacto da animação.

**Ainda não implementado:** sede/fome matando herbívoros (hoje só direcionam o comportamento);
tromba do elefante e demais espécies pendentes; emboscada × corrida × resistência como estratégias
distintas por espécie (hoje: tocaia/salto do leopardo, flanco das matilhas, bote do crocodilo);
desistência por perda de contato visual; atividade diurna/noturna por espécie; reprodução;
simulação simplificada de animais distantes além da estatística de caçadas.

## 8. Validação

- **Testes automáticos:** 438 passam; 15 novos em `tests/unit/fauna/foraging.test.js` (teia
  alimentar, vegetação que acaba e rebrota, margem, fome que só cai comendo, sede, medo antes da
  fome). Conferido que falham quando a regra é quebrada (comer sem chegar; dieta por nível).
- **Área de teste** (`tools/fauna/viewer.html`): todas as espécies abrem sem erro no console;
  capturas em `production/qa/evidence/fauna/` (leão andando com esqueleto e caixa de colisão,
  girafa nas folhas, zebra pastando e bebendo, leopardo saltando, crocodilo nadando, etc.).
- **No jogo** (savana, 4 zebras + 1 girafa, 70 s): girafa foi à folhagem e a fome caiu de 0,80
  para 0,18; uma zebra foi à margem e a sede caiu de 0,96 para 0,12; as outras pastaram. Leitura
  de estado, sem imagem (a captura não enquadrou os animais).
- **Custo:** passo do ecossistema com 60 animais: 0,0131 → 0,0143 ms por quadro (medido em Node).
  FPS do jogo não foi medido de novo nesta etapa.
- **Não validado:** fluidez das animações em movimento por um observador; encontros entre vários
  grupos; navegação com obstáculos; deformações de malha durante transições.
