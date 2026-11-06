# Ceará: mão de obra contada pelo DXF na Leitura do CAD (06/11/2026)

## Por que
Hoje a Leitura do CAD já conta estrutura e material pelo DXF, mas a mão de obra ainda é feita à mão: a pessoa olha o desenho poste por poste, decide cada voz e digita. É onde mais se perde tempo e onde mais se erra (cruzeta a mais, cabo por fase em vez de por metro de rede, tensionar esquecido ou cobrado à toa, sufixo A/B trocado).

O caderno do orçamento foi **cancelado** pelo Italo (05/11 à tarde). O foco agora: **o site conta a mão de obra sozinho pelo DXF**, dentro da Leitura do CAD, e a pessoa só confere e responde o que o desenho não diz. Da Tarefa 1 do caderno fica a conversão dos cabos reaproveitável (commit ac5fbfb, `converterCabos` em `src/ceara/contagem.ts`).

Rascunho de referência (fora do repositório, códigos de exemplo): `AUTOMACAO KIT MATERIAL\rascunhos-plataforma\g-ceara-mao-de-obra.html`. Ele mostra o bloco, as perguntas e as regras; as decisões deste documento valem sobre ele onde forem diferentes (ex.: a cidade agora é escolhida à mão, e o tensionar pergunta por poste).

## Metas
1. Depois de ler o DXF, a mão de obra da obra sai pronta, separada em instalação e retirada, com o número de 10 dígitos (o que se digita no sistema da Enel) e a voz com o sufixo certo.
2. O que o desenho não diz é perguntado na tela, num lugar só, e o que falta responder fica em vermelho.
3. O Excel da obra sai com as duas abas de mão de obra, no formato do orçamento.
4. Cada voz mostra de onde veio (P1, P12, vãos de BT...), para a pessoa conferir com o desenho.

## Fora do escopo agora
- **Comparar a mão de obra com o orçamento feito à mão** (não foi pedido). A comparação de hoje (estrutura e material) não muda.
- **Base Técnica no Supabase** e a cidade vinda sozinha pela OT. Fica para o ARO. Nesta etapa a cidade é escolhida à mão.
- Ramal e medidor: não entram na contagem de obra de rede. Se aparecerem, a pessoa soma à mão pela busca.
- O visual novo "Vidro e foto" (já tem documento e plano próprios; vem depois).
- EDP e Sergipe.

## Não pode acontecer (mesmo funcionando)
- **Número de voz, código de voz real, OT real, nome de colega ou chave em arquivo versionado.** O repositório é público. A lista de vozes e a tabela de regras ficam só no Supabase e em `../bases` (fora do git). Testes com vozes inventadas (ex.: `XX101`).
- Cobrar tensionar onde o cabo ancorado é novo, ou cobrar sem a pessoa ver de onde veio.
- O site "chutar" em silêncio o que o desenho não diz (desligamento, fases do MT, cabo ancorado quando não há certeza, cidade). Sem resposta, a linha fica em vermelho e não soma.
- Um valor mudado à mão voltar ao automático sem a pessoa pedir, ou se misturar com o de outra OT.
- Mudar o Excel, a tela ou a comparação de hoje para quem não usa a mão de obra: sem a lista de vozes no servidor, a Leitura do CAD funciona como hoje e o bloco avisa que a lista não chegou.
- Página mais larga que a tela no celular, ou erro do axe.

## Como funciona (o que foi decidido)

### Onde fica na tela
- Um bloco novo **"Mão de obra"** na Leitura do CAD, logo abaixo dos blocos de Estrutura e Material, depois de ler o DXF.
- Ele é um **componente próprio** (arquivo e estado separados da tela de hoje), para ser levado depois à aba "Mão de obra" do visual Vidro e foto sem reescrever as regras.
- No alto do bloco, **as perguntas da obra**:
  - **Cidade da obra:** lista com as 11 cidades que usam o sufixo **A** (por área, abaixo) e a opção "Outra cidade (B)". A área (SUL, LESTE, CENTRO SUL) já é escolhida hoje na Leitura do CAD; a lista mostra as cidades daquela área. Sem cidade escolhida, as vozes ficam sem sufixo e em vermelho.
  - **"Teve desligamento?"** Sim / Não (foi TET). Se sim, **"Quantos equipamentos operados?"** (passo − / +). A voz de operação em equipamento MT entra com **2 × equipamentos** (abrir e fechar). Em TET não entra. Sem resposta, fica em vermelho.
- Depois, **duas tabelas, Instalação e Retirada**, com: nº do serviço (10 dígitos), voz com o sufixo e a descrição, unidade, quantidade (com − / + e campo para digitar, decimais com vírgula) e "de onde veio".
- **Perguntas por linha** (ficam dentro da tabela, na voz a que pertencem):
  - fases do cabo de MT quando o nome do vão não diz;
  - o cabo ancorado no tensionar, quando o site não tem certeza (abaixo).
- Uma nota curta com o que foi **conferido e não cobrado** (ex.: "tensionar: a MB3.1 do P1 ancora cabo novo") e os avisos que já existem (poste sem etiqueta etc.).

### Sufixo A/B por cidade (Italo, 05/11)
A só nestas cidades; B em todas as outras da área.
- CENTRO SUL: Icó, Iguatu, Senador Pompeu, Tauá.
- SUL: Crato, Juazeiro (do Norte), Barbalha.
- LESTE: Jaguaribe, Aracati, Limoeiro (do Norte), Russas.

A cidade fica guardada com a OT neste computador (mesmo lugar das outras respostas, abaixo).

### Regras de contagem (Italo, 28/10 e 05/11; os códigos ficam fora do repositório)
As vozes reais de cada regra estão na memória do projeto `fechamento-ceara-mao-de-obra.md` e vão para a tabela de regras em `../bases` (abaixo). Aqui, só a regra.

**Poste**
- Poste novo: **uma voz de poste por poste novo**, de MT se o poste tem estrutura de MT, senão a de BT. Ela já inclui a primeira cruzeta e **toda a BT** do poste novo (armação de BT em poste novo não cobra).
- Retirada de poste: uma por poste retirado, de MT ou de BT (pelas estruturas do poste), com as estruturas de dentro já incluídas. No poste com linha viva, as vozes de retirada de poste de linha viva (passante ou encabeçamento, pelo tipo).
- **CAVA KLC:** mais uma escavação na rocha por CAVA KLC (o material da cava continua fora, como hoje).
- **Troca de poste** (poste (3) e poste (1) na mesma etiqueta; Italo, 06/11): voz do poste novo + voz de retirada do velho. As estruturas sem prefixo que passam do velho para o novo não cobram: a primeira cruzeta (nova ou transferida) e a BT já estão na voz do poste novo. Só cada cruzeta (1) **a mais** cobra instalação de cruzeta.

**Item (2) na etiqueta** (estrutura, poste ou trafo realocado ou tensionado; Italo, 06/11)
- Cobra **a retirada e a instalação do mesmo item**, com as regras de cada um (ex.: cruzeta realocada = retirada pelo tipo + instalação de cruzeta; poste realocado = retirada de poste + voz de poste novo).
- O material continua como hoje (item (2) não entra no material).
- O tensionar continua saindo só pelas regras do poste (abaixo).

**Cruzeta de MT**
- Poste novo: a primeira cruzeta já está na voz do poste. **Cada cruzeta a mais** no poste novo cobra a voz de instalação de cruzeta.
- Poste existente: **cada cruzeta nova** cobra a voz de instalação de cruzeta.
- Troca (sai uma, entra outra): retirada da que sai + instalação da nova.
- Retirada **pelo tipo que sai**: passante (tipo 1 e 2) tem uma voz; encabeçamento ou derivação (3, 3.1, 3.3, 4) tem outra.
- **Toda estrutura de MT conta 1** (Italo, 06/11): N, M, B, U e D, simples ou dupla (MB4, N4, U4... = 1 cada).
- **Rede compacta** (estruturas com CCN ou CSR no nome) usa a voz de cruzeta para **cabo isolado**; as outras, a de **condutor nu** (Italo, 06/11).
- **A estrutura do trafo (TR...) nunca conta como cruzeta** (já está na voz da estrutura do trafo).
- Poste com **linha viva**: as vozes de linha viva (instalação passante, retirada passante, instalação com encabeçamento, retirada com encabeçamento) no lugar das de cruzeta.
- **Poste novo com linha viva** (Italo, 06/11): a primeira cruzeta continua dentro da voz do poste; cada cruzeta a mais usa a voz de linha viva.

**Armação de BT em poste existente**
- Instalação e retirada: **uma por face do poste**.
- O desenho não diz a face. **Conta confirmada pelo Italo (06/11):** faces = soma, para cada letra, da metade das estruturas daquela letra arredondada para cima. Exemplos: 2×S1B = 1; 2 S1B + 2 S1C = 2; 4 S1B + 2 S1C = 3.
  - Vale para as armações **S1 a S5 de qualquer letra** (B, C, N, A); S sem letra conta como uma letra própria.
  - Alça e laço do pré-reunido (SPALÇA, SPLAÇO) **não** são armação.
  - Na troca de armação no mesmo poste, a retirada (3) e a instalação (1) têm cada uma a sua conta.
  - A linha mostra "confira" e pode ser mudada à mão.
- Poste novo: não cobra (está na voz do poste).

**Trafo, caixa e conector**
- Trafo novo: a voz do trafo + a voz da estrutura e aparelhagem do trafo. A proteção de MT (chaves) do trafo já está dentro: não soma voz de chave.
- Trafo retirado: as duas vozes de retirada correspondentes.
- Caixa de proteção ou derivação nova (SPCXD...): uma por caixa.
- **Conector de 4 saídas:** um para cada CONEC50-150 novo do desenho.

**Cabo** (pelos vãos, como a conversão de material de hoje)
- **Instalação por metro de rede:** todos os condutores do circuito contam como um (100 m de MT com 3 fases = 100). Uma voz para o pré-reunido de BT; para o condutor nu (BT e MT), uma voz para as bitolas pequenas e outra para acima de 120 mm².
- **Retirada por condutor:** metros × condutores (100 m de MT com 3 fases = 300). O pré-reunido de BT retirado conta **1 condutor**. No MT, a voz de retirada depende da bitola.
- **MT sem fases no nome do vão:** o site pergunta as fases na linha; até a resposta, a linha fica vermelha com "falta o número de fases" e não soma.
- Vão (2) tensionado ou realocado não gera voz de cabo: o tensionar sai dos postes.

**Tensionar** (voz cobrada por vão)
- Sai do **poste**, pela estrutura nova que **ancora** o cabo:
  - MT: estrutura do tipo 3 (3, 3.1, 3.2, 3.3) = 1; do tipo 4 (4, 4.1) = 2; tipo 1 e 2 (passante) nunca.
  - BT: as duas estruturas de ancoragem no poste (S2N + S2C, com ou sem alças) = 2; só a de passagem com o laço = 0.
  - BT, **1 por ancoragem** (Italo, 06/11): uma estrutura de ancoragem de BT sozinha (S2, S3, S4, ou SPALÇA no fim da rede pré-reunida) = 1. **Escolha minha:** a alça que acompanha S2N/S2C no mesmo poste não soma a mais (é a mesma ancoragem).
- **Só cobra se o cabo que aquela estrutura ancora é existente** (vão sem (1): sem prefixo ou (2)). Na derivação (3.1), o que vale é o cabo **derivado**.
- Poste com linha viva: **não cobra** (já vai na voz da cruzeta de linha viva).
- **Decisão do Italo (06/11): automático onde há certeza, pergunta onde não há.**
  - O site acha os postes candidatos (estrutura nova de ancoragem, sem linha viva).
  - **Resolve sozinho** quando há certeza. O Italo confirmou (06/11) que **o cabo existente sempre aparece no desenho** (cota ou texto sem prefixo), então valem estes casos de certeza: na rede daquele cabo (MT ou BT), a obra só tem vão novo ou retirado → não cobra; a obra só tem vão existente (sem prefixo ou (2)) → cobra. O construtor pode também ligar os vãos aos postes pela posição no desenho (as pontas da cota) e resolver quando todos os vãos ligados ao poste são do mesmo tipo, mas só se a ligação for segura; na dúvida, pergunta.
  - **Onde não há certeza, pergunta na linha do poste:** "O cabo que a MB3.1 do P12 ancora é existente?" Sim / Não. Até responder, a linha fica vermelha e não soma.
  - O que foi conferido e não cobrado aparece na nota do bloco.

**Linha viva no desenho**
- Vale o texto **"LINHA VIVA" logo em cima das etiquetas do poste** onde a linha viva trabalha, por poste. A legenda, as notas ("ACESSO À LINHA VIVA", "MOTIVO NECESSIDADE...") e o bloco LVIVA do modelo **não valem**. As 4 obras de teste não têm linha viva válida.
- **Escolha minha:** cada poste mostra se está "com linha viva" e a pessoa pode ligar ou desligar à mão (o texto pode estar torto ou faltar no desenho). Ligar ou desligar refaz as vozes do poste.

**Desligamento**
- Só com desligamento: 2 por equipamento operado (perguntado no alto do bloco). Em TET não entra.

**Itens da etiqueta sem regra de mão de obra** (escolha minha)
- Chave, para-raios, elo, aterramento fora do trafo, religador e o que mais não tiver regra: não somam voz e aparecem na nota do bloco como "sem regra de mão de obra, confira" (com o poste), para a pessoa somar à mão pela busca se precisar. Nada fica de fora calado.

### Instalação × Retirada (adição × devolução)
- **Decisão do Italo (06/11):** instalação vai para a aba **MÃO DE OBRA ADIÇÃO**; retirada vai para **MÃO DE OBRA DEVOLUÇÃO**. Tensionar e operação em equipamento vão para a ADIÇÃO. Nos 3 orçamentos reais isso estava misturado; os orçamentos é que estavam bagunçados.

### Mudar à mão (escolha minha)
- Qualquer quantidade pode ser mudada à mão. A linha mostra "mudado à mão", o valor que o automático daria e "voltar ao automático".
- **"+ Voz"** em cada tabela: busca na lista de vozes por código, descrição ou unidade (`normalizar`/`casa` de `src/lib/busca.ts`, a partir de 2 letras, até cerca de 20 resultados, como na estratificação). Serve para ramal, medidor ou o que o site não contou. Voz somada à mão pode ser apagada.
- Tudo (cidade, desligamento e equipamentos, fases, respostas do tensionar, linha viva ligada/desligada, mudanças e vozes somadas) fica **guardado por OT neste computador** (IndexedDB, mesma ideia dos ajustes da estratificação). Ler outro DXF da mesma OT traz as respostas de volta; uma resposta que não cabe mais no desenho novo (ex.: o poste mudou) é descartada, e a linha volta a perguntar.

### Lista de vozes (número de 10 dígitos)
- **Fonte:** a planilha de precificação que o Italo aprovou (nome na memória; está em `Downloads`), sem o R$. A aba SERVIÇOS E4E da base DE PARA tem números antigos: **não usar**.
- O que se viu na planilha (06/11): uma linha por voz × departamento (as três áreas) × zona (Urbana = A, Rural = B). O número de 10 dígitos **muda com A/B e não muda com a área**. A descrição já começa com a voz e o sufixo (ex.: `XX110_B_Instalacao ...`).
- Algumas vozes têm **variantes** com o mesmo começo (ex.: "GRP A - ..." e "(TELECONT) ..."). **Escolha minha:** a contagem usa a voz comum, sem essas variantes; elas ficam na busca para quem precisar somar à mão.
- **Caminho:** o mesmo da base da Enel. Um script Python no PC do Italo lê a planilha, grava `../bases/mao-de-obra.json` e sobe ao Supabase (bucket privado `bases`, tabela `bases`, com versão). O site baixa depois do login e guarda no IndexedDB. A base é **opcional**: sem ela, a Leitura do CAD funciona como hoje e o bloco avisa.
- A mesma base leva a **tabela de regras** (`../bases/regras-mao-de-obra.json`, fora do git): o papel de cada regra → a voz, as bitolas do cabo e as expressões das estruturas do tensionar. O site trabalha com os papéis (ex.: "poste MT novo", "retirada de cruzeta passante"); a voz real vem da tabela. **Mostrar a tabela ao Italo antes de subir.**
- Reaproveitar do plano do caderno (`docs/superpowers/plans/2026-11-05-ceara-caderno.md`) a **Tarefa 2** (base opcional da lista no site, `NomeBase` `'mao-de-obra'`, `garantirBases`, `check` do Supabase, supabase falso do e2e) e a **Tarefa 3** (script que sobe a lista), **trocando a fonte** do PxQ/Listagem pela planilha de precificação e as regras do caderno pelos papéis deste documento. A parte do ARO das Tarefas 2 e 3 não entra.

### Excel
- Mesmo modelo de `src/ceara/excel.ts`: as 4 abas de hoje sem mudança e mais **MÃO DE OBRA ADIÇÃO** e **MÃO DE OBRA DEVOLUÇÃO**, com as colunas do orçamento: DATA, ÁREA, EMPRESA, OT, CÓDIGO (o número de 10 dígitos), DESCRIÇÃO (a descrição da lista, que começa com a voz e o sufixo), QTD.
- Linha sem resposta (vermelha na tela) sai em vermelho no Excel, como o "sem código" de hoje.
- Sem a lista de vozes, o Excel sai com as 4 abas de hoje, idêntico ao de hoje.

### Conferência com as obras de teste
- Script fora do repositório (scratchpad), como o de 05/11, rodando a contagem nova sobre as 4 obras de `..\ceara-teste`.
- Esperado (05/11): batem a voz de poste, cabo de BT e MT, trafo e estrutura do trafo, caixa, retirada de poste de BT e conector de 4 saídas. Diferenças já conhecidas e aceitas:
  - bt-8-postes, retirada de cabo de BT: o desenho tem 114 m de 2 condutores (228); o orçamento usou 76 m (152). Fica o do desenho.
  - mt-trafo, instalação de cruzeta: o desenho dá 1 (só o P1, MB1 + MB3.1); o orçamento tinha 3 e estava errado (Italo, 28/10 e 05/11).
- Mostrar a conferência ao Italo antes de dar por pronto.

## Testes
- Unidade, com vozes inventadas e etiquetas montadas na hora:
  - cada regra de poste (novo, retirado, troca), item (2) = retirada + instalação, cruzeta (poste novo, existente, troca, dupla = 1, U e D contam, compacta na voz do isolado, TR não conta, linha viva em poste novo), armação de BT pela conta das faces (letras, sem letra, alça e laço fora), trafo, caixa, conector, CAVA, itens sem regra na nota;
  - cabo por metro de rede e por condutor, pré-reunido = 1, MT sem fases (vermelho, não soma);
  - tensionar: tipo 1 nunca, tipo 3 = 1, tipo 4 = 2, BT S2N + S2C = 2, ancoragem de BT sozinha = 1, derivação olhando o cabo derivado, linha viva não cobra, os casos de certeza e a pergunta;
  - linha viva: texto em cima da etiqueta vale, legenda e notas não; ligar e desligar à mão;
  - sufixo A/B pela cidade e escolha do número de 10 dígitos (sem as variantes);
  - desligamento Sim/Não e 2 × equipamentos;
  - mudar à mão, voltar ao automático, voz somada, guardar e ler por OT (fake-indexeddb), migração do banco sem perder as lojas de hoje;
  - Excel com as duas abas novas; sem lista, Excel idêntico ao de hoje.
- e2e: ler o `ceara.dxf` de teste, escolher a cidade, responder desligamento, responder um tensionar, mudar uma quantidade, recarregar e ver as respostas de volta, baixar o Excel e conferir as abas; axe e largura em 1366 e 390 px.
- No fim: `npm test`, `npm run lint`, `npm run build`, `npm run e2e`.

## Fica para quem constrói
- Nomes de arquivos, funções e lojas do IndexedDB.
- O formato exato da tabela de regras e dos papéis.
- Como ligar os vãos aos postes pela posição (se ligar), e quando essa ligação é segura.
- Os textos curtos da tela, seguindo o rascunho g e o visual de hoje.
- Como o bloco fica no celular (uso principal no computador, ao lado do CAD; não pode quebrar no celular).
