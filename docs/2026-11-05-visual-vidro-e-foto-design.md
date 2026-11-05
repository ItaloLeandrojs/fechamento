# Visual novo da plataforma: "Vidro e foto" + site limpo (05/11/2026)

## Por que
Em 05/11 o Italo achou o site poluído. Os prints de hoje (ramo `supabase`, 1366 e 390 px) mostraram o motivo:
- caixa dentro de caixa: todo bloco tem borda e fundo;
- ajuda sempre aberta;
- 5 tabelas empilhadas e 34 etiquetas na Leitura do CAD;
- "igual" verde em toda linha, então a cor não diz nada;
- "Ajustar material" numa linha própria (9 vezes);
- Excel no meio da página, antes do resultado;
- título repetido (menu + título de 52 px + selo);
- menu cortado no celular;
- o Ceará cai direto no anexar, sem mostrar as ferramentas.

Ele aprovou as **regras limpas** (rascunho H) e, entre três modelos, escolheu o **"2 · Vidro e foto"** (rascunho I). Este documento junta as duas coisas e leva o visual para todas as telas.

Rascunhos (fora do repositório, códigos inventados):
- `AUTOMACAO KIT MATERIAL\rascunhos-plataforma\i-tres-modelos.html`, telas `#m2-ent` (entrada do Ceará) e `#m2-res` (resultado da Leitura do CAD): **é a referência visual**.
- `AUTOMACAO KIT MATERIAL\rascunhos-plataforma\h-site-limpo.html`, aba Diagnóstico e tabela "O que muda": **são as regras**. As telas `#t-cad` (menu lateral, abas, "Só diferenças", barra do Excel) e `#t-edp` mostram as regras no visual antigo.

## O que é o "Vidro e foto"
- Escuro (grafite quase preto, `#0e0e10` no rascunho), com o verde de hoje (`#5abd79`) só onde é ação ou "pronto".
- **Foto grande do pessoal** ocupando o topo das telas de entrada, em tons de cinza e escurecida, com um degradê que desce até o fundo liso.
- **Vidro fosco** (fundo translúcido + desfoque + borda clara de 1 px + brilho fino em cima) só nas peças que ficam **sobre a foto**: o cartão principal da entrada, as pílulas do topo (voltar, pessoa) e a barra flutuante do Excel.
- **Cantos bem redondos:** cartões 22 a 24 px, linhas 18 px, botões e pílulas totalmente redondos.
- Botão principal branco com texto escuro (como no rascunho); botão de baixar o Excel em verde.
- Títulos grandes só nas entradas (no rascunho o "Ceará" chega a 150 px); dentro das ferramentas, título de 30 px a 56 px no máximo.

## Decisões do Italo (05/11, não rediscutir)
1. **Modelo 2 · Vidro e foto** + as regras limpas do rascunho H.
2. **Foto nas entradas.** Login, Regiões (com o crachá) e a entrada de cada região (Ceará e EDP) têm a foto grande e o vidro. Dentro das ferramentas (Leitura do CAD, passos da EDP) entra só uma **faixa de foto** no topo; tabelas ficam em fundo liso; vidro só na barra do Excel e nas pílulas.
3. **Foto do pessoal só depois do login.** O repositório e o site são públicos: a foto real fica guardada no Supabase e só aparece para quem entrou. **O login usa a foto provisória de hoje** (`public/plataforma/entrada.webp`, linha viva com cesto aéreo, do site público da Cosampa). O Italo ainda vai mandar a foto do pessoal; até lá, as telas de dentro usam a mesma provisória com o selo "Foto provisória".
4. **Tema claro fica para depois**, num passo separado. Esta construção já deixa as cores todas em variáveis, para o claro entrar sem refazer nada.
5. **A fonte continua Sora** (já no site, `@fontsource-variable/sora`).
6. **Menu lateral fica no computador** dentro das ferramentas do Ceará (Leitura do CAD e as em teste), no visual novo, como no `#t-cad` do rascunho H. No celular não há menu lateral: a entrada do Ceará é o menu e a pílula "← Ceará" volta para ela.
7. **Ordem:** a **mão de obra pelo DXF** (bloco "Mão de obra" na Leitura do CAD + 2 abas no Excel) é construída **antes**, no visual de hoje. O visual novo vem depois e já refaz a tela com a mão de obra dentro. O caderno do orçamento foi **cancelado** (a Tarefa 1 dele, ac5fbfb, fica).

## Regras limpas (aprovadas no rascunho H)
| Hoje | No visual novo |
|---|---|
| Cada bloco numa caixa com borda e fundo | Uma superfície; espaço e linhas finas separam os grupos. Cartão só onde ele é uma coisa clicável ou flutua sobre a foto |
| Título de 52 a 80 px em toda tela | Título grande só nas entradas (Regiões, Ceará, EDP); nas ferramentas, 30 px no celular, até 56 px no computador |
| Texto de ajuda sempre aberto | Uma linha; o resto abre num botão "Como salvar em DXF?" |
| Cinco tabelas e 34 etiquetas empilhadas | Abas + chave "Só diferenças" (ver Leitura do CAD) |
| "igual" verde em toda linha | "igual" apagado; só o que difere ganha cor (coral `#f59a88`) e borda colorida na linha |
| "Ajustar material" numa linha própria | Botão "Ajustar" na própria linha; o ajuste abre embaixo dela, um aberto por vez (como hoje) |
| Excel no meio da página, antes do resultado | Barra presa embaixo: OT, Área e Baixar Excel |
| Rótulos PRONTO / EM TESTE em maiúsculas com linha | Rótulo pequeno, sem linha; "Em teste" aparece uma vez por grupo |
| Ceará abre no anexar | Ceará abre numa entrada com as cinco ferramentas |
| Números 01, 02, 03 nas regiões | Sem números; a linha inteira é clicável |
| Título repetido (menu + título + selo) | Um título por tela; trilha curta "Ceará › Leitura do CAD" no topo do computador |

## Tela por tela

### 1. Entrada (login, senha nova, escolher foto, preparando)
- Foto provisória em tela cheia (já é assim), com o degradê do modelo 2.
- O formulário vai para um **cartão de vidro** (raio 24 px). Campos e botão redondos; botão "Entrar" branco.
- A linha verde que "liga" (`.pl-energia`) continua.
- Tudo o que o login faz hoje continua igual: mensagens, erros por campo, "Esqueceu a senha? Avise o Italo.", ajuste da foto (diálogo), aviso sem servidor.

### 2. Regiões (com o crachá)
- Foto do pessoal grande ao fundo do topo, como a entrada do Ceará no rascunho.
- Topo: logo FECHAMENTO à esquerda; à direita, pílula de vidro com o nome e as iniciais. As três ações de hoje (Trocar foto, Trocar senha, Sair) abrem a partir dessa pílula (menu pequeno). A mesma pílula, com o mesmo menu, aparece no topo de todas as telas de dentro (Ceará, ferramentas, EDP). Sair com trabalho na tela pede a mesma confirmação do voltar. *(Minha escolha: tira 3 links do topo; o builder decide se é `<details>`/menu ou `<dialog>`, desde que funcione no teclado e no leitor de tela.)*
- **Computador:** o crachá continua pendurado à esquerda, sobre a foto (3D quando o aparelho aguenta, parado nos outros casos, regra de `podeCracha3D` sem mudança). À direita, a saudação ("Boa tarde, Maria.") e a lista das regiões num **cartão de vidro**.
- **Regiões:** EDP, Ceará, Sergipe; sem números; a linha inteira clicável; "Abrir →" nas prontas; "Em breve" apagado em Sergipe, com o aviso de 2,6 s de hoje.
- **Celular:** foto no topo com a saudação; crachá parado logo abaixo, menor; regiões como linhas grandes (48 px ou mais de alvo).
- Avisos de hoje (sessão só nesta aba, bases sem conexão) continuam, numa linha cada, abaixo da saudação.

### 3. Entrada do Ceará (nova)
Igual ao `#m2-ent`:
- foto grande; título "Ceará" enorme e "Enel · Centro-Sul, Sul e Leste";
- **cartão de vidro** da Leitura do CAD (ícone, "Pronto", uma frase, botão branco "Abrir a Leitura do CAD");
- abaixo, "Em teste" e os quatro cartões lisos: Apartado de sucata, Correções, Nomeação dos arquivos, ARO (cada um abre a página curta de hoje com os passos);
- topo: logo, pílula "← Regiões", pílula da pessoa;
- **celular:** os quatro cartões viram uma fila que desliza para o lado (o próximo aparece na borda), como no rascunho.
- Se a Leitura do CAD já tem um resultado nesta visita, o cartão mostra o nome do arquivo e "Continuar" em vez de "Abrir". *(Minha escolha.)*

### 4. Leitura do CAD
Igual ao `#m2-res`, com o menu lateral no computador:
- faixa de foto de ~200 px no topo, desfocada e escura, com as pílulas por cima;
- **computador:** menu lateral à esquerda ("Início do Ceará", Leitura do CAD, grupo "Em teste"), sem caixa em volta;
- título "Leitura do CAD" + uma linha + botão "Como salvar em DXF?";
- **vazio:** área de soltar o DXF (arrastar ou clicar) e, ao lado, "Comparar com um orçamento feito à mão (.xlsx)", opcional;
- **lendo:** esqueleto das linhas (não um spinner);
- **resultado:**
  - pílulas dos arquivos (DXF, orçamento) com "Trocar arquivos";
  - resumo em 4 números: Postes instalados, Cabo de MT, Cabo de BT, Iguais ao orçamento (sem orçamento: o 4º vira outro número útil, escolha do builder);
  - alertas (poste sem etiqueta etc.) numa linha cada;
  - **abas:** Diferenças (só aparece com orçamento), Estrutura, Material, **Mão de obra**, Etiquetas, cada uma com a quantidade; dentro de cada aba, os grupos Adição e Devolução separados por um título pequeno;
  - **"Só diferenças" vira a aba Diferenças**, como no modelo 2 escolhido (não há chave separada): com orçamento, a tela abre nela; ela junta as linhas de Estrutura e Material que diferem, com os mesmos títulos pequenos (Adição/Devolução de estrutura e de material). Sem orçamento, a aba não aparece e a tela abre em Estrutura. *(Minha escolha: a chave do rascunho H e a aba do rascunho I fazem a mesma coisa; fica a do modelo escolhido.)*
  - **Mão de obra não entra na comparação com o orçamento** (não foi pedido): não conta em "Iguais ao orçamento" nem na aba Diferenças;
  - "Itens que o site não reconheceu" e "Fora da contagem de propósito" (CAVA KLC) viram **alertas de uma linha** com o número ("3 itens que o site não reconheceu") e um botão que abre a lista ali mesmo. Se a mão de obra pelo DXF já contar a CAVA KLC, o alerta dela sai. *(Minha escolha.)*
  - cada linha: código + descrição, Desenho, Orçamento, situação, de onde veio (postes), "Ajustar" (só em Adição de estrutura); "igual" apagado, diferença em coral;
  - o ajuste do material (estratificação) abre embaixo da linha, como hoje; sugestão do último ajuste continua;
  - **barra flutuante do Excel** presa embaixo: "Excel da obra", OT, Área, "Baixar Excel" (verde). No celular a barra mostra "OT 1234567 · Sul" + "Baixar Excel" e um toque abre os campos (como o `ot-resumo` do rascunho H). Avisos de linhas em vermelho e "Baixado" aparecem colados na barra.
- A aba **Mão de obra** segue o que a construção da mão de obra pelo DXF definir (perguntas "Teve desligamento?" etc. ficam dentro da aba). Este documento só dá o visual dela. A mão de obra ainda não existe no código (05/11): o plano começa relendo a tela como ela ficou e encaixa o bloco dela nesta aba; se ela ainda não tiver chegado quando o Italo pedir a construção, a aba fica de fora até chegar.
- **Voltar às Regiões com resultado na tela:** hoje o Ceará perde o resultado em silêncio. Passa a pedir confirmação, como a EDP já faz ("Voltar às regiões? A leitura desta obra será perdida."). Voltar só para a entrada do Ceará não perde nada. *(Minha escolha.)*

### 5. Ferramentas em teste do Ceará
Mesma casca da Leitura do CAD (faixa de foto, menu lateral no computador), com o texto curto de hoje sem caixa em volta.

### 6. EDP
- **Entrada da EDP** (hoje `Inicio.tsx`): foto grande; título "EDP" ou "Fechamento de obra"; **cartão de vidro** com a área de soltar o inventário (.xlsx), a frase "O arquivo é lido no seu computador. Nada é enviado e o original não muda." e os erros de hoje.
- **Passos da EDP** (`Etapas`, `Revisao`, `Boletim`, `Fichas`...): faixa de foto no topo, regras limpas (menos caixas, ajuda recolhida, título 30 px), cantos redondos novos. A barra de baixo da Revisão vira a mesma barra flutuante. **Nenhuma regra, passo ou saída da EDP muda.**

## Vidro no celular e versão sem vidro
O desfoque (`backdrop-filter`) pesa ao rolar em celular fraco. Regras:
1. **Três níveis**, decididos uma vez, antes da primeira pintura, por uma classe no `<html>`:
   - **vidro completo:** computador com mouse;
   - **vidro parado:** celular bom. Desfoque só no que **não se move sobre conteúdo que rola** (cartão da entrada e pílulas sobre a foto parada). A barra flutuante do Excel e qualquer coisa presa (`sticky`/`fixed`) usam fundo **sólido** (`rgb(30 30 34 / .96)`), sem desfoque (regra da ls-celular);
   - **sem vidro:** aparelho fraco, economia de dados, `prefers-reduced-transparency: reduce`, ou navegador sem `backdrop-filter`. Todas as peças de vidro viram sólidas (`#1c1c20` com a mesma borda clara), com o mesmo contraste.
2. "Fraco" segue o mesmo espírito do `podeCracha3D`: `navigator.deviceMemory <= 4`, `navigator.hardwareConcurrency <= 4` em tela de toque, ou `connection.saveData`. *(Minha escolha dos números; o builder pode ajustar depois do teste no celular do Italo.)*
3. Desfoque de no máximo 20 a 24 px; nunca animar o desfoque.
4. O texto precisa passar no contraste **sem** o vidro (a foto pode ser clara em algum ponto): o degradê escuro por baixo do texto é obrigatório, não enfeite.
5. A prova de que está liso é o celular do Italo; o teste automático só prova layout e contraste.

## A foto
- **Login:** foto provisória de hoje, no HTML, com `fetchpriority="high"` e `srcset` (versão de celular ~960 px e de computador 1920 px, WebP).
- **Telas de dentro:** a foto do pessoal, baixada **depois do login** do Supabase (armazenamento privado, só para quem entrou, como as bases de hoje no bucket `bases`). Fica guardada no banco do navegador (IndexedDB) para abrir sem conexão e não baixar de novo; tem versão, para trocar a foto sem mexer no site.
- Enquanto a foto do pessoal não chega (primeiro acesso, sem conexão e sem cópia, ou o Italo ainda não mandou), usa a provisória com o selo "Foto provisória". Quando a foto chega, entra com um esmaecer curto (200 a 300 ms; sem animação com "reduzir movimento").
- Tratamento igual ao rascunho: cinza (`grayscale(.85)`) e escurecida, com o degradê até o fundo. Faixas das ferramentas: a mesma foto, mais escura e levemente desfocada.
- O Italo manda a foto; eu preparo (recorte, WebP de celular e de computador, sem dados de GPS/EXIF) e subo pelo mesmo caminho das bases. A foto **nunca** entra no repositório nem na pasta `dist`.
- **Faz parte deste trabalho mudar o Supabase:** hoje a tabela `bases` só aceita `enel` e `edp`. Entra o nome novo (ex.: `foto-equipe`) no `supabase/esquema.sql`, no carregador das bases e no `scripts/atualizar_base.py` (ou um script irmão só para a foto). **Quem roda o SQL no painel do Supabase é o Italo**, com o passo a passo no `docs/supabase-passo-a-passo.md`.
- O caminho inteiro (baixar, guardar no navegador, trocar de versão, esmaecer, cair na provisória) é construído e testado com uma **foto inventada** no Supabase falso do e2e. A foto real entra quando o Italo mandar, sem mexer no código.
- Texto alternativo: "Equipe do fechamento" (sem nomes).

## Movimento
- Pouco e com função: entrada da tela (subir 4 px e aparecer, como o `.entra` de hoje), "press" nos botões (`scale(0.97)` a `0.99`), troca de aba sem pulo de altura, ajuste abrindo embaixo da linha, foto esmaecendo ao chegar.
- Duração até 300 ms, curva que desacelera no fim; tudo desligado com "reduzir movimento".
- Nada de animação no desfoque, nada de paralaxe na foto.

## Cores (variáveis em `src/index.css`)
- Trocar os tokens do visual B pelos do modelo 2 e somar os novos: fundo, superfície lisa, vidro (fundo, borda, brilho), texto, apagado, verde (ação e "pronto"), coral (diferença), amarelo (só "Em teste"), raios (cartão, linha, controle).
- Componentes usam só as variáveis; nenhuma cor solta nos `.tsx`. Isso é o que deixa o tema claro para depois.
- Contraste mínimo AA: texto normal 4,5:1, texto grande e bordas de controle 3:1, medido sobre o fundo sólido (pior caso).

## Metas
- O Italo olha e acha bonito e limpo, no computador e no celular dele.
- Ninguém perde nada do que faz hoje: login, crachá, regiões, Leitura do CAD (com ajuste, sugestão, orçamento, Excel), ferramentas em teste, EDP inteira.
- Menos coisa na tela: uma superfície, cor só no que importa, Excel sempre à mão.
- Funciona liso no celular do Italo; aparelho fraco cai na versão sem vidro sem quebrar.

## Fora deste trabalho
- Tema claro (passo separado, depois).
- Sergipe.
- Qualquer mudança nas regras de contagem, Excel, estratificação, EDP ou login.
- Construir a mão de obra pelo DXF (outro trabalho, vem antes).
- "Últimas leituras" (era ideia do modelo 3, o site não guarda isso).
- Publicar: só com o OK do Italo, depois da conta da equipe.

## O que seria um fracasso
- Ficar bonito no print e engasgar ao rolar no celular.
- Texto ilegível sobre a foto em algum ponto.
- Vidro em tudo ("cara de modelo pronto"): vidro só sobre a foto.
- Perder uma função de hoje ou mudar um número do Excel.
- Foto do pessoal (ou nome de colega) no repositório ou no site aberto.
- Página mais larga que a tela no celular, ou erro do axe.

## Cuidados
- Ramo `supabase`, sem push.
- Repositório público: nada de código real da Enel, OT real, nome de colega, foto do pessoal ou chave. Testes e e2e com dados inventados.
- Construir só depois da mão de obra pelo DXF e só quando o Italo pedir; antes de começar, conferir o `git log` e se outra conversa está mexendo nos arquivos do Ceará.
- Conferência no fim: `npm test`, `npm run lint`, `npm run build`, `npm run e2e` (atualizado para os textos novos), axe nas telas, quatro tamanhos (1440×900, 412×915, 360×800, 390×844), "reduzir movimento", versão sem vidro forçada, e o teste no celular do Italo.

## Deixado para quem constrói
- Nomes das classes e como dividir os componentes (ex.: um `Casca` comum para faixa de foto + pílulas + menu lateral).
- Como fazer o menu da pílula da pessoa e o detalhe da barra do Excel no celular, desde que funcionem no teclado e no leitor de tela.
- O 4º número do resumo sem orçamento.
- Ajuste fino de tamanhos, espaços e sombras, partindo do rascunho `#m2-ent`/`#m2-res`.
