# Trabalho dos moradores (profissões, prédios e estações): o que falta terminar

Estado em 2026-11-12, 22h. O código está no commit `25435e2` (branch `completo`). Este arquivo é a lista do que **ainda não está pronto**.

## 1. O que já está feito (e testado)

- **Regra principal:** nenhum morador trabalha sem estação.
  - O gesto de trabalho só toca depois de chegar e ocupar uma estação válida. A estação precisa existir, ser da profissão, estar livre, ter chão embaixo e estar a até 0,75 m do morador.
  - Quem não tem prédio na vila fica sem ofício e passa o turno na praça, em vez de gesticular no ar.
  - Código: `src/systems/work/AgentWork.js`, `src/systems/work/Workstations.js`.
- **17 tipos de prédio com móveis e estações:** ferraria, mina, fazenda, capela, carpintaria, padaria, taverna, estábulo, mercado, lenhador, cais, tecelagem, olaria, moinho, enfermaria, escriba e posto da guarda.
  - Configuração em `src/config/workplaces.js`; construção em `src/villages/Workplaces.js`.
  - Todos são geometria procedural, sem modelos externos.
- **Empregos:** cada prédio abre vagas da sua profissão (`assignJobs`). Guardas, crianças e idosos não mudam.
- **Ciclo de tarefas por profissão.** Exemplo, o ferreiro: prateleira → fornalha → bigorna → têmpera → guardar → bancada.
- **Produção real:** o recurso só sai se houver material no estoque da vila.
- **Cadeias de produção:** trigo → farinha → pão → refeições; madeira → tábuas; minério + madeira → ferramentas.
- **Plantação:** leiras com 5 estágios visuais. Trabalhar nelas faz avançar; depois de semeadas, crescem sozinhas com o tempo.
- **Mercador → lojas:** o que o mercador distribui repõe o estoque da banca do mercador da vila (`MARKET_LINK`).
- **Navegação A\*:** uma grade por vila, montada a partir dos colisores reais, respeitando faixa de altura, água e encosta.
  - As rotas são pedidas só quando o destino muda, com no máximo 4 ms por quadro; o que passar disso fica para o quadro seguinte.
  - Morador preso: recalcula a rota e, depois de 3 tentativas, desiste por ora. Trabalho e visita nunca usam teletransporte.
- **Rotina no relógio do jogo:**
  - 06–07 acordar · 07–12 trabalho · 12–13 almoço · 13–17 trabalho · 17–20 taverna, capela, mercado ou padaria · 20 em diante volta para casa.
  - Estados de IA expostos em `agent.aiState`.
- **Ferramenta na mão** (`src/render/WorkTools.js`): presa à mão direita do boneco. Carga nos braços ao andar até estações de carga.
- **Gestos novos** em `NPCAgent.applyGesture`: minerar, serrar, sovar, mexer, varrer, ler, escrever, rezar, pregar, carregar e outros.
- **Efeitos** (`src/render/WorkFx.js`):
  - Fumaça nas chaminés das vilas ativas.
  - Faíscas, lascas, serragem e vapor no instante do golpe.
  - Pás do moinho girando.
- **Vila longe:** produz por simulação abstrata, sem animação.
- **Modo de depuração:** tecla **F9** ou `?debugwork` na URL (`src/ui/WorkDebug.js`). Mostra:
  - estações (verde livre, vermelho ocupada, laranja com falha);
  - entradas, rotas, colisores e células bloqueadas;
  - etiqueta por morador: profissão, estado, estação, motivo de falha e altura do chão.
- **Testes:** `tests/unit/work/work-rules.test.js` (19 testes). Ao todo, `npm test` = 519 testes passando.

## 2. Resultado da última verificação no jogo (`tools/gear/work-check.mjs`, modo rápido) — 17 de 19 OK

**Prédios por vila:**
- Renascimento, Perseguição, Abstração, Bússola e Presa de Gelo: 16 prédios cada.
- Al-Zahir: 15 prédios.
- Zamba dos Rios: 0 (ver §3.3).
- 100% dos adultos com emprego.

**Estações:** 524 no total, nenhuma dentro de objeto ou sem chão. 107 foram recuadas automaticamente para fora do móvel. Nenhum prédio flutuando.

**Comportamento:**
- Às 9 h, 26 de 26 empregados estão em estações válidas.
- Andando de verdade, até 18 trabalham ao mesmo tempo.
- Lotação respeitada.
- Ferramenta presa na mão de quem trabalha com boneco.
- Produção: madeira, pão, tábuas, tecido, remédios e registros. A vila longe também produz (+115).
- Fim de tarde: 19 moradores em visita e ninguém nas estações. À noite, nenhuma estação ocupada.
- Console sem erros. A grade de navegação montou 1 milhão de células em 1,0 s.

**Falhou (a corrigir):**

| Falha | Pista |
|---|---|
| 2 moradores contados como "trabalhando no ar" (serra da carpintaria, forno da padaria): estado WORKING com a estação ocupada, mas a mais de 0,8 m dela | São moradores com boneco. O `collisions.move` empurra o boneco para fora do móvel DEPOIS de chegar. Opções: no `syncModel`, se o morador sair da estação (> `arriveRadius`), largar a estação e voltar a andar; ou recuar mais essas estações no `settleStation` (exigir folga do raio do corpo, 0,3 m, além de `clearRadius`) |
| Modo de depuração: 19 marcadores, mas 0 etiquetas | Provável: no momento do print não havia morador com boneco dentro de `labelRadius`, ou a projeção falha no headless. Conferir abrindo o jogo com `?debugwork` |
| 571 de 782 rotas "sem caminho" (não reprovou, mas é muito) | Muitas são rotas de casa: o ponto de dormir pode cair numa célula bloqueada pela mobília. Esses moradores caem no `legacyRoute`. Abrir F9 perto das casas e ver as células vermelhas |

## 3. O que falta fazer

1. **Corrigir as 3 falhas da §2** e rodar de novo `node tools/gear/work-check.mjs http://127.0.0.1:5199` (com `npx vite --port 5199 --strictPort` rodando; sem `rapido` = espera mais tempo de jogo).
2. **Olhar os prints** em `production/qa/evidence/trabalho/` (um por prédio) para ver:
   - proporções, móveis e telhados;
   - telhado de galpão sem empena (`shell: 'open'`);
   - leiras em estágios;
   - a ferramenta alinhada à mão em cada gesto.
   - As poses dos gestos novos foram escritas sem conferência visual: ajustar ângulos em `applyGesture`.
3. **Duas vilas sem oficinas** (`PLACEMENT.skipVillages`): Zamba dos Rios (palafitas) e Copa Alta (árvores) têm arquitetura própria. Lá todos os adultos ficam sem ofício. Falta criar estações nas estruturas que já existem (cais das palafitas, plataformas das árvores).
4. **Interior das casas fechadas** (capela, taverna, moinho, enfermaria, escriba): não estão registrados no `InteriorManager`. Por isso:
   - a câmera em 3ª pessoa pode atravessar a parede lá dentro;
   - os móveis não seguem o sistema de interiores das casas.
5. **Navegação:** a grade é montada uma vez no carregamento. Custou cerca de 2 s para 1,27 milhão de células, antes de reduzir a margem para 45 m: medir de novo. Se pesar:
   - montar a grade só quando a vila ativa;
   - ou usar células de 1,5 m.
   - `NavGrid.refresh` já existe para reconstruir um trecho quando um prédio for adicionado ou removido, mas nada chama isso ainda.
6. **Portas trancadas à noite:** o colisor da porta entra depois da grade, então a grade não o enxerga. Hoje funciona porque o caminho para casa cai no `legacyRoute` quando o A\* não acha saída. Verificar.
7. **Produção → economia do jogador:** só pão, cenoura e pedra (via mercador) chegam às lojas. Falta decidir se ferramentas e peixe da vila devem aparecer no ferreiro e no mercador.
8. **Equilíbrio** (`CYCLES`, `START_STOCK`, `GOODS.cap`, `ABSTRACT.cyclesPerHour`): números provisórios.
9. **Variedade visual:** hoje varia o material por região, a altura (±6%), a orientação e a escolha de paredes. Faltam:
   - formato de telhado diferente;
   - janelas e portas variadas;
   - cercas e decoração por vila.
10. **Desempenho:** não foi medido no navegador com GPU (o teste roda sem). Abrir o jogo, ir a Renascimento às 9 h e conferir o FPS com e sem F9.
11. **Documentação:**
    - criar `docs/WORK-SYSTEM.md` com a visão de código (este arquivo cobre só as pendências);
    - atualizar `docs/HANDOFF.md`, que ainda não cita o sistema de trabalho;
    - atualizar o diálogo (`config/dialogues.js`), que só tem falas das profissões antigas.

## 4. Mudanças de comportamento que o dono pode querer rever

- **Horários:** a rotina passou de 7h30/17h30/21h30 para **7h/17h/20h**, como no pedido.
- **Profissão sorteada:** agora é substituída pela vaga no prédio. Caçador e artesão sumiram de quem tem emprego; quem sobra fica "sem ofício".
- **Agricultor, mercador, ferreiro, lenhador e pescador** trabalham agora nos prédios novos, não nos pontos antigos (anel na borda, barracas da praça, quintal).

## 5. Arquivos

- **Novos:**
  - `src/config/workplaces.js`
  - `src/systems/work/{Workstations,Production,NavGrid,AgentWork,VillageWork}.js`
  - `src/villages/Workplaces.js`
  - `src/render/{WorkTools,WorkFx}.js`
  - `src/ui/WorkDebug.js`
  - `tests/unit/work/work-rules.test.js`
  - `tools/gear/work-check.mjs`
- **Alterados:**
  - `src/entities/NPCAgent.js` (estação, rota sem teletransporte, ferramenta, gestos)
  - `src/systems/npc/NPCManager.js`
  - `src/villages/Village.js`
  - `src/config/npcLife.js` (horários, profissões novas)
  - `src/config/minimap.js` (ícone das oficinas)
  - `src/core/Game.js` (F9)
  - `src/style.css`
  - `tests/unit/villages/living-world.test.js`
