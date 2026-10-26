# Fechamento v2: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: superpowers:subagent-driven-development. Os passos usam caixas (`- [ ]`) para acompanhar.

**Objetivo:** refazer a interface do Fechamento (tamanho, letras, logo, tela inicial, caminho de etapas) e fazer a ficha de aterramento sair sem linhas e blocos sobrando, aproveitando o motor da v1.

**Arquitetura:** o motor que edita o .xlsx no navegador (`src/core/`) fica e ganha a remoção de linhas. A interface React (`src/App.tsx`, `src/components/`) é refeita tela por tela sobre uma base visual nova (Sora, tamanhos maiores, etapas com estado). Antes das telas restantes há uma amostra de aprovação do Italo.

**Tecnologia:** Vite 6, React 19, TypeScript, Tailwind 4, JSZip 3.10, Phosphor (ícones), Vitest; e2e com o Playwright e o axe já instalados em outros projetos (ver `e2e/fluxo.mjs`).

**Especificação:** `docs/2026-10-23-fechamento-v2-design.md`. As regras de negócio estão em `../ESPECIFICACAO do site Fechamento.md` (fora do repositório) e em `docs/decisoes-e-pendencias.md`.

## Restrições globais

- Tudo em português do Brasil, sem travessão (U+2014) em texto visível.
- Fonte única **Sora** (`@fontsource-variable/sora`), números com `font-variant-numeric: tabular-nums`; **nenhuma** fonte monoespaçada na interface (remover `@fontsource-variable/geist` e `geist-mono` e a classe `.num` com `font-mono`).
- Texto base 16 px; tabelas 15 px; rótulos no mínimo 13 px; títulos de tela 28 a 32 px; botões e campos com 44 a 48 px de altura; alvos de 48 px no celular.
- Área útil até cerca de 1680 px de largura, usando a tela; sem coluna estreita no meio de um monitor de 1920 px.
- Cores: amarelo #F2B705 e grafite; tema claro e escuro pelo sistema (tokens de `src/index.css`); texto amarelo só onde passar contraste AA.
- Não mudar as regras da ADS, o carimbo nem o formato do arquivo (exceto a ficha de aterramento, Tarefa 1).
- Nada sai do navegador; a CSP de `vite.config.ts` continua; nenhum dado pessoal no repositório nem no `dist/`.
- Dados reais de teste só em `e2e/dados/` (fora do git): `inv.xlsx` (inventário de exemplo), `vala1.jpeg`, `med1.jpeg`, `dp.jpeg`, `equip1.jpeg`, `tec.json`.
- Toda tarefa termina com `npm test` passando e `npx tsc -p tsconfig.app.json --noEmit` sem erro; tarefas de tela também com `npm run build && npm run e2e` passando e prints olhados em 1366, 1920 e 390 px.

## Foco da revisão

1. Obra sem aterramento: a ficha fica exatamente como veio (nada apagado). Teste na Tarefa 1.
2. Inventário com outra quantidade de linhas e blocos na ficha (o exemplo 16646689 tem 2 linhas e 3 blocos): apagar só o que sobra, sem errar a conta. Teste na Tarefa 1.
3. Depois de apagar linhas, o rodapé (Registro, Data) e o carimbo continuam no lugar certo e o Excel abre sem pedir reparo. Verificação no Excel na Tarefa 1.
4. Quantidade com vírgula ("2,5") e nome de kit muito comprido não podem quebrar a tela nem a conta. Teste na Tarefa 3 (`numero`) e checagem de rolagem lateral no e2e (Tarefa 9).
5. Monitor de 1920 px e notebook de 1366 px: nada espremido nem cortado (colunas da revisão, botões). Prints e checagem de largura no e2e (Tarefa 9).

---

### Tarefa 1: apagar as linhas e os blocos que sobram na ficha de aterramento

**Arquivos:**
- Criar: `src/core/linhas.ts`
- Modificar: `src/core/fichas.ts` (`aplicarAterramento`), `src/core/sheet.ts` (expor `rowMap` para reconstrução, se precisar)
- Teste: `src/core/linhas.test.ts`

**Interfaces:**
- Produz: `ajustarFormulaApagando(f: string, r1: number, r2: number): string` e `apagarLinhas(wb: Workbook, aba: string, r1: number, r2: number): Promise<void>`, ambos em `src/core/linhas.ts`.
- Consome: `Workbook`, `SheetEditor`, `parseRange`, `splitRef`, `indexToCol` (já existem).

- [ ] **Passo 1: testes que falham** em `src/core/linhas.test.ts`:
  - `ajustarFormulaApagando('SUM(A10:A20)+B30', 12, 14)` → `'SUM(A10:A17)+B27'`
  - `ajustarFormulaApagando("'Check-list'!K56", 5, 9)` → sem mudança (outra aba)
  - `ajustarFormulaApagando('B13', 12, 14)` → `'#REF!'`
  - `apagarLinhas` sobre um pacote montado no teste (JSZip com uma aba de 12 linhas, mesclagens B3:C3 e B8:C9, desenho com imagem ancorada na linha 10, definedName `Print_Area` `'Aba'!$B$1:$L$12`, `conditionalFormatting sqref="B2:B12"`): apagar 4 a 6 deve deixar 9 linhas, a célula de B8 em B5, a mesclagem B8:C9 em B5:C6, a âncora da imagem na linha 7 (índice 6), a área de impressão `$B$1:$L$9` e o sqref `B2:B9`.
- [ ] **Passo 2:** `npx vitest run src/core/linhas.test.ts` falha (funções não existem).
- [ ] **Passo 3: implementar** em `src/core/linhas.ts`. Linhas acima de `r2` ficam; as de dentro somem; as de baixo sobem `n = r2 - r1 + 1` (atributos `r` de `<row>` e `<c>`). Fórmulas da aba passam por `ajustarFormulaApagando`: referências da própria aba (sem `Aba!` na frente, ou com o nome desta aba) abaixo de `r2` sobem, absolutas também; ponta de intervalo dentro do trecho apagado encolhe para a borda; referência única dentro vira `#REF!`. Fórmulas compartilhadas: chamar `unshareFormulas` (de `ads.ts`) antes. Ajustar também: `mergeCells` (descartar as que ficam inteiras dentro, subir as de baixo), `dimension`, `sqref` de `conditionalFormatting`, `dataValidation`, `protectedRange`, `rowBreaks/brk@id`, âncoras `from/to` de `xl/drawings/*` da aba, `x:Anchor` do VML da aba (2º e 4º números de linha), `definedName` que cite a aba (área de impressão).
- [ ] **Passo 4:** `npx vitest run src/core/linhas.test.ts` passa.
- [ ] **Passo 5: usar em `aplicarAterramento`.** Depois de preencher e inserir as fotos de `n` pontos (com `n >= 1`), apagar de baixo para cima: primeiro os blocos de foto que sobraram (de `blocos[n].row` até `blocos[blocos.length-1].caixaEsq.r2`, se `n < blocos.length`), depois as linhas da tabela que sobraram (de `linhasTabela[n]` até a última linha da tabela, se houver). Com `n = 0` a função sai sem mexer em nada (já é assim). Teste em `core.test.ts` não é possível sem o inventário real: a verificação é o Passo 6.
- [ ] **Passo 6: verificar no Excel.** `npx tsx scripts/prova.ts "<e2e/dados/inv.xlsx>" "$TEMP/claude/prova/img" "$TEMP/claude/prova/v2.xlsx"` e depois `powershell -File scripts/abrir-no-excel.ps1 "$TEMP/claude/prova/v2.xlsx" "$TEMP/claude/prova/pdf-v2"`. Esperado: "Abriu sem erro"; o PDF da ficha de aterramento mostra só as 2 linhas da tabela e os 2 blocos, o rodapé logo abaixo com Registro, nome, Data e carimbo, sem bloco "Insira aqui a foto" sobrando.
- [ ] **Passo 7:** `npm test` e `tsc` limpos; commit `feat(nucleo): apaga linhas e blocos que sobram na ficha de aterramento`.

### Tarefa 2: logo v2 (C legível e COSAMPA maior) para aprovação

**Arquivos:**
- Modificar: `scripts/gerar-logo.py`, `src/components/logoLetras.ts` (gerado), `src/components/Logo.tsx`, `public/logo-fechamento.svg`, `public/favicon.svg`
- Criar: `docs/amostra/logo-v2.html` (prévia para o Italo; não vai para o `dist`)

**Interfaces:**
- Produz: `Marca({ altura }: { altura?: number })` em `Logo.tsx` (mesmo nome e props da v1); `LOGO_VIEWBOX`, `LOGO_LETRAS`, e novo `LOGO_COSAMPA: { d: string; t?: string }[]` em `logoLetras.ts`.

- [ ] **Passo 1:** no `gerar-logo.py`, trocar o C de FECHAMENTO por um C de anel aberto: mesma altura e sobra do O da Cosampa (y 416 a 1314), espessura 234,7, abertura à direita de cerca de ±40°, pontas cortadas na vertical. Manter C/O/A/M originais nas outras letras.
- [ ] **Passo 2:** a linha de cima vira a palavra **COSAMPA com os glifos originais da marca** (C, O, S, A, M, P, A do SVG da Cosampa), em escala de cerca de 0,32 da altura de FECHAMENTO, alinhada à esquerda, em grafite; o A de FECHAMENTO continua amarelo.
- [ ] **Passo 3:** gerar a prévia `docs/amostra/logo-v2.html` com a logo v1 e a v2 lado a lado, nos fundos claro e escuro, em 3 tamanhos (cabeçalho 40 px de altura, 24 px e grande), mais o favicon.
- [ ] **Passo 4:** regenerar `logoLetras.ts`, `public/logo-fechamento.svg`, `public/favicon.svg` (o A amarelo sobre grafite continua); `Logo.tsx` desenha `LOGO_COSAMPA` em vez do `<text>`.
- [ ] **Passo 5:** `tsc` limpo; commit `feat(logo): C legível e COSAMPA com os glifos da marca`.

### Tarefa 3: base visual nova, cabeçalho, etapas e tela inicial

**Arquivos:**
- Modificar: `package.json` (trocar Geist por `@fontsource-variable/sora`), `src/index.css`, `src/components/ui.tsx`, `src/components/Inicio.tsx`, `src/App.tsx`
- Criar: `src/components/Etapas.tsx`, `src/etapas.ts`
- Teste: `src/etapas.test.ts`

**Interfaces:**
- Produz: em `src/etapas.ts`, `type EstadoEtapa = 'vazio' | 'feito' | 'pendente'`, `interface Etapa { id: Secao; rotulo: string; grupo: 'Lançamentos' | 'Fichas' | 'Fechar'; estado: EstadoEtapa; n?: number }` e `montarEtapas(e: Estado, pendencias: string[]): Etapa[]` (mover o tipo `Secao` para cá). `Etapas({ etapas, atual, onIr })` em `Etapas.tsx`. Componentes de `ui.tsx` mantêm nomes e props (`Botao`, `Campo`, `Painel`, `Titulo`, `Vazio`, `EscolhaOper`, `Quantidade`, `Selo`).
- Consome: `Estado`, `numero` de `src/state.ts`.

- [ ] **Passo 1: testes que falham** em `src/etapas.test.ts`: `montarEtapas(estadoInicial, ['Escolha o técnico do carimbo.'])` devolve 8 etapas na ordem Estruturas, Materiais, Mão de obra, Aterramento, Equipamento, Desligamento, Carimbo, Revisar e baixar (o Inventário fica no cabeçalho, não é etapa) com Carimbo `'pendente'`; com 2 estruturas lançadas, Estruturas `'feito'` e `n: 2`. Também `numero('2,5') === 2.5`, `numero('1.234,5') === 1234.5`, `numero('19.10') === 19.1`, `numero('') === null`.
- [ ] **Passo 2:** os testes falham.
- [ ] **Passo 3: implementar** `montarEtapas` e a base visual: Sora em tudo; `.num` só com `tabular-nums`; tokens de tamanho; `Botao` 44 px (primário 48 px), `Campo` 48 px com texto 16 px, `EscolhaOper` 44 px; `Titulo` 30 px.
- [ ] **Passo 4: cabeçalho e etapas** em `App.tsx`/`Etapas.tsx`: largura até 1680 px; cabeçalho de 72 px com `Marca altura={36}` e Nota, tipo de obra e ordens em 15 a 16 px; coluna de etapas de 260 px no computador (grupos, ícone, rótulo 15 px, contador ou "falta"/"ok"), faixa rolável no topo no celular.
- [ ] **Passo 5: tela inicial** (`Inicio.tsx`): sem frase de propaganda; título curto ("Fechamento de obra"), uma linha do que acontece, a área de soltar o arquivo grande no centro (mínimo 280 px de altura), o aviso de que nada sai do computador e, se houver técnicos guardados, "N técnicos neste computador".
- [ ] **Passo 6:** testes, `tsc`, build e e2e passam; prints de início e de uma tela qualquer nas três larguras olhados; commit `feat(visual): Sora, tamanhos maiores, etapas e tela inicial`.

### Tarefa 4: tela de Estruturas e amostra de aprovação

**Arquivos:**
- Modificar: `src/components/Estruturas.tsx`
- Criar: `docs/amostra/` com os prints `inicio-1920.png`, `estruturas-1920.png`, `estruturas-1366.png`, `estruturas-390.png`, `logo-v2.png`

**Interfaces:**
- Consome: props atuais de `Estruturas` (`kits`, `previstos`, `estruturas`, `onChange: Atualiza<EstruturaLanc[]>`), `ui.tsx` da Tarefa 3.

- [ ] **Passo 1:** busca grande (48 px, texto 16 px) no topo; operação em botões de 44 px; resultados em linhas de 64 px com nome do kit em 16 px semibold, descrição em 14 px, selo "X de Y previstos" e botão de adicionar claro; lista de lançadas ao lado (a partir de 1280 px) agrupada por operação, com quantidade grande.
- [ ] **Passo 2:** build, e2e e prints nas três larguras (salvar os da amostra em `docs/amostra/`).
- [ ] **Passo 3:** commit `feat(estruturas): tela nova` e **PARAR**: o controlador mostra a amostra ao Italo e só segue com a aprovação dele.

### Tarefa 5: Materiais e Mão de obra

**Arquivos:** Modificar `src/components/Itens.tsx`.

**Interfaces:** consome as props atuais de `Itens` e o padrão visual aprovado na Tarefa 4.

- [ ] **Passo 1:** mesmo padrão da Tarefa 4: previstos primeiro, com os selos de operação e planejado; cadastro completo depois; lançados ao lado.
- [ ] **Passo 2:** build, e2e e prints nas três larguras; commit `feat(itens): materiais e mão de obra no padrão novo`.

### Tarefa 6: fichas (Aterramento, Equipamento, Desligamento)

**Arquivos:** Modificar `src/components/Fichas.tsx`, `src/components/FotoSlot.tsx`.

- [ ] **Passo 1:** cada ponto ou equipamento num cartão com campos de 48 px, fotos maiores (quadros de pelo menos 200 px de largura no computador), rótulos 13 px ou mais; aviso de limite de 8 pontos mantido.
- [ ] **Passo 2:** texto da tela de aterramento explicando que linhas e blocos que sobrarem saem da ficha.
- [ ] **Passo 3:** build, e2e e prints; commit `feat(fichas): aterramento, equipamento e DP no padrão novo`.

### Tarefa 7: Carimbo

**Arquivos:** Modificar `src/components/Carimbo.tsx`.

- [ ] **Passo 1:** cartões dos técnicos maiores (carimbo em área de 140 px de altura, nome 16 px, matrícula 14 px), seleção clara; carregar e cadastrar continuam.
- [ ] **Passo 2:** build, e2e e prints; commit `feat(carimbo): tela no padrão novo`.

### Tarefa 8: Revisar e baixar

**Arquivos:** Modificar `src/components/Revisao.tsx`.

- [ ] **Passo 1:** tabela em 15 px com cabeçalho preso ao rolar, todas as colunas visíveis em 1366 e 1920 px, descrição com corte em reticências; totais em números grandes; botão de baixar de 56 px sempre à vista (preso no painel lateral no computador e no rodapé no celular); pendências e avisos legíveis.
- [ ] **Passo 2:** build, e2e e prints; commit `feat(revisao): tela no padrão novo`.

### Tarefa 9: testes de ponta a ponta e qualidade

**Arquivos:** Modificar `e2e/fluxo.mjs`.

- [ ] **Passo 1:** acrescentar a rodada de 1920x1080 (claro) às atuais; em toda captura conferir `scrollWidth <= largura`; conferir que a revisão mostra a coluna "Dev." visível (`boundingBox` dentro da tela) em 1366 e 1920; lançar um kit com nome comprido e uma quantidade "2,5".
- [ ] **Passo 2:** `npm run build && npm run e2e`: "Tudo passou."; `html-validate` limpo (comando em `docs/decisoes-e-pendencias.md`); olhar todos os prints.
- [ ] **Passo 3:** abrir no Excel um arquivo gerado pelo navegador (`scripts/abrir-no-excel.ps1`) e conferir a ficha de aterramento sem sobras e o carimbo.
- [ ] **Passo 4:** atualizar `docs/decisoes-e-pendencias.md`; commit `test: e2e da v2 e conferência no Excel`.

Depois da Tarefa 9: revisão final do ramo por um agente novo, correções, mostrar ao Italo e só então publicar (`gh-pages`, como na v1).
