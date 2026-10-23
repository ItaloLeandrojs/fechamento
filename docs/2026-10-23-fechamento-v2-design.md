# Fechamento v2: documento de design

Escrito em 23/10/2026, depois que o Italo reprovou a v1 ("letras não ficaram legal, enquadramento muito reduzido, não ficou no padrão"). A v1 está no ar em https://italoleandrojs.github.io/fechamento/ e no commit `3c56fbe`.

## 1. Intenção

Uma ferramenta de trabalho para o escritório fechar obras da EDP: subir o inventário, lançar estruturas, materiais e mão de obra pelo nome, anexar fotos, escolher o técnico e baixar a planilha preenchida. Precisa parecer um sistema profissional da Cosampa, confortável para usar horas por dia num monitor grande e legível num notebook.

## 2. Para quem

O pessoal do escritório de fechamento (12 a 13 pessoas), num PC com monitor de 1920 px ou num notebook de 1366 px. Às vezes no celular, só para consultar.

## 3. O que fica da v1 (já conferido no Excel de verdade)

- O motor em `src/core/` (ADS, fichas, imagens, carimbo, remoção do carimbo antigo, calcChain, CSP) e os 11 testes.
- `src/data/kits.json` (450 kits), `scripts/gerar-logo.py`, `e2e/fluxo.mjs` (que será adaptado), `scripts/abrir-no-excel.ps1`.
- As regras da ADS e todas as decisões da `ESPECIFICACAO do site Fechamento.md` (pasta acima do repositório).

## 4. O que muda

### 4.1 Planilha: ficha de aterramento sem sobras
Hoje o inventário vem com 28 linhas na tabela e 8 blocos de foto. O exemplo do Italo (16646689) fica só com o que foi usado: 2 linhas e os blocos dos pontos. **O site passa a apagar as linhas da tabela e os blocos de foto que sobrarem**, puxando para cima o que vem embaixo (rodapé com Registro, Data e carimbo), sem quebrar mesclagens, imagens, área de impressão, fórmulas nem formatação condicional. Se a obra não tiver aterramento, a ficha fica como veio.

### 4.2 Tamanho e enquadramento
- Usar a largura da tela: área útil até cerca de 1680 px, com margens proporcionais. Nada de coluna estreita no meio de um monitor grande.
- Texto base 16 px; tabelas 15 px; rótulos 13 px no mínimo; títulos de tela 28 a 32 px.
- Botões e campos com 44 a 48 px de altura; alvos de toque de 48 px no celular.
- Conferir em 1366, 1920 e 390 px, print por print.

### 4.3 Letras
- **Sora** (a mesma do site novo da Cosampa) em tudo, com números alinhados (`tabular-nums`) na própria fonte.
- Sem fonte monoespaçada na interface (o "1 estrutura" em fonte de máquina de escrever foi um dos defeitos apontados).

### 4.4 Logo
- O C em meia-lua lido como "(" em FECHAMENTO: redesenhar o C para ser lido como C, mantendo o estilo da marca.
- "COSAMPA" em cima maior e legível.
- Mostrar ao Italo antes de aplicar (amostra de aprovação, item 6).

### 4.5 Tela inicial
- Sem frase de propaganda. Uma tela direta: a área para soltar o inventário em destaque, uma linha explicando o que acontece e o aviso de que nada sai do computador.
- Se já houver técnicos guardados no navegador, dizer quantos.

### 4.6 Caminho do trabalho
- Sequência clara de etapas: **Inventário, Estruturas, Materiais, Mão de obra, Aterramento, Equipamento, Desligamento, Carimbo, Revisar e baixar**, agrupadas (Lançamentos, Fichas, Fechar), cada uma com o estado (vazio, com itens, pendente).
- Cabeçalho com os dados da obra maiores e legíveis (Nota, tipo de obra, ordens).
- Listas com cartões e linhas mais altas, controles de quantidade claros, busca grande.
- Revisão: tabela legível com cabeçalho preso, totais em destaque e o botão de baixar sempre à vista.

### 4.7 Cores
Mantém o que o Italo escolheu: amarelo energia (#F2B705) com grafite, tema claro e escuro seguindo o sistema. Amarelo só em destaque (botão principal, etapa atual, o A da logo); texto amarelo só onde passar contraste AA.

## 5. O que não é objetivo
- Mudar as regras da ADS, o carimbo ou o formato do arquivo gerado (exceto o item 4.1).
- Blocos extras para mais de 8 pontos de aterramento (continua pendente; o site avisa).
- Servidor, login ou salvar rascunho.

## 6. Processo (igual ao da Cosampa)
1. Este documento, depois o plano em tarefas (`docs/superpowers/plans/`).
2. **Amostra de aprovação:** logo, tela inicial e uma tela de trabalho (Estruturas) prontas e em print nas três larguras. Só seguir com o "ok" do Italo.
3. Cada tarefa feita por um agente e revisada por outro (confere o plano e a qualidade do código); só então a próxima.
4. A cada tela, prints em 1366, 1920 e 390 px olhados um por um.
5. No fim: testes, axe, html-validate, Excel de verdade, e um revisor novo lendo tudo. Depois mostrar ao Italo e só então publicar.

## 7. Metas de qualidade
- Zero violações do axe (WCAG A/AA) nos dois temas, em 1366 e 390 px.
- Sem rolagem lateral em nenhuma tela.
- Zero erros no console (fora o ruído conhecido do antivírus).
- O arquivo gerado abre no Excel sem erro e as fichas saem certas em PDF.
- Texto em português revisado, sem travessão.
