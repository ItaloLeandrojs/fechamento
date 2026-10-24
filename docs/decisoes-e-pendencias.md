# Fechamento: decisões e pendências

Especificação completa: `..\ESPECIFICACAO do site Fechamento.md` (fora do repositório).

## Como funciona
- O site lê o inventário da EDP no navegador e grava a cópia preenchida editando o XML do .xlsx direto (JSZip). Nada vai para servidor.
- A ADS recebe o Aplicado pelas regras combinadas (operação prevista, depois outra do mesmo grupo, 2000 tem preferência; retirada 2030/2040 nunca cai em instalação; o que não está previsto vira linha nova, com ID e operação vazios). Linhas não lançadas ficam com Aplicado 0. Adicional e Devolvido são gravados como valor, só quando positivos.
- O `calcChain.xml` é apagado e o Excel recalcula tudo ao abrir (`fullCalcOnLoad`).
- Carimbo: o rodapé de cada aba é achado pelo último rótulo "Registro". O site grava a matrícula e o nome, coloca a data de hoje na Check-list (Q4) e cola a imagem do carimbo acima do nome. Remove o carimbo antigo: a imagem e a "foto vinculada" (câmera do Excel, `=IMAGEM`), que puxava do ARO.
- Técnicos: arquivo `tecnicos-fechamento.json` (fora do repositório, com CPF nos carimbos). Ele é carregado uma vez e fica no IndexedDB do navegador.
- Logo: COSAMPA / FECHAMENTO no desenho da marca Cosampa (C, O, A e M originais), com o A em amarelo. Gerada por `scripts/gerar-logo.py`.

## O que a v2 mudou (24/10/2026)
- Todas as telas refeitas: fonte única Sora (números tabulares, sem fonte monoespaçada), texto base 16 px, campos e botões de 44 a 48 px, área útil até cerca de 1680 px, tema claro e escuro pelo sistema, amarelo #F2B705 com grafite.
- Revisão com tabela de todas as colunas (Op., Código, Descrição, Planejado, Aplicado, Adicional, Devolvido) no computador e um cartão por linha no celular; resumo e botão presos ao lado (computador) ou na base (celular).
- Ficha de aterramento: com pelo menos um ponto, o site apaga as linhas da tabela e os blocos de fotos que sobram, e o rodapé (Registro, Data) e o carimbo ficam logo abaixo. Sem nenhum ponto, a ficha fica como veio.
- Regras da ADS, carimbo e formato do arquivo: sem mudança.

## Conferências feitas (24/10/2026, v2)
- 31 testes unitários e `tsc` sem erro.
- `npm run e2e` ("Tudo passou."): a obra inteira em 5 rodadas (1366 claro e escuro, 1920 claro, 390 claro e escuro), sem internet, com o axe em 11 análises por rodada (55 no total, zero violações, incluindo a revisão rolada com a barra de baixo sobre o conteúdo) e 35 prints. Em cada tela confere rolagem lateral (nenhuma). Também confere:
  - a coluna "Devolvido" da revisão dentro da tela e do painel em 1366 e 1920 (e "Dev." do cartão em 390);
  - kit de nome comprido (`KP-SMDT-P9/300-(CCM_BTZero)`) com quantidade "2,5": o campo mantém "2,5" e a revisão mostra aplicado 2,5 x a quantidade do material no kit;
  - duas fotos do ponto de aterramento e duas fotos do equipamento escolhidas ao mesmo tempo: as duas ficam e são diferentes;
  - foco visível (WCAG 2.4.11): com a página rolada até o campo ficar sob o cabeçalho preso, o foco da busca, do "Limpar busca" e do filtro da revisão traz o elemento para baixo do cabeçalho (e acima da barra de baixo no celular); `scroll-padding-top: 96px` em `src/index.css` corrige (sem ele o teste falhava em todas as rodadas);
  - nome (`16646602 - ADS.xlsx`) e tamanho do arquivo baixado.
- `html-validate` (configuração recomendada) em `dist/index.html`: válido, 0 erros e 0 avisos.
- Arquivo baixado pelo navegador aberto no Excel de verdade (`scripts/abrir-no-excel.ps1`), sem pedir reparo, fichas exportadas em PDF: aterramento só com a linha e o bloco usados e o rodapé logo abaixo; equipamento com todos os campos, tensões e as duas fotos; DP com a foto inteira; carimbo, matrícula e data nas abas.
- Dados de teste do e2e (pasta `e2e/dados`, valores de equipamento inventados) ficam fora do git, assim como `e2e/prints` e `e2e/saida`.

## Comando do html-validate
Feito com a instalação do projeto cosampa-site (nada entra neste): `createRequire('<package.json do cosampa-site>')('html-validate')`, `new HtmlValidate({ extends: ['html-validate:recommended'] }).validateFile('dist/index.html')`.

## Conferências feitas (23/10/2026, versão anterior)
- 11 testes unitários (regras da ADS, fórmulas, datas, encaixe de foto).
- `e2e/fluxo.mjs`: a obra inteira em 1366 e 390 px, tema claro e escuro, sem internet, com o axe em 9 telas por rodada. Zero violações. Sem rolagem lateral.
- `html-validate` limpo; política de segurança (CSP) no site montado.
- O arquivo gerado (pelo Node e pelo navegador) abre no Excel sem erro. Fichas exportadas em PDF e conferidas: tabela, fotos, carimbo, matrícula e data.
- O site montado não contém CPF nem nomes de técnicos.

## Pendências
1. Ficha de aterramento com mais de 8 pontos: hoje o site avisa e bloqueia; falta criar os blocos extras.
2. Ficha de equipamento: lugar fixo para os equipamentos da ficha; acima disso o site dá erro claro.
3. O modelo da EDP traz o bloco 1 da ficha de aterramento cortado entre as páginas 1 e 2 na impressão (vem do inventário original, não do site).
4. Na aba DP, o nome do colaborador da EDP vem de `VLOOKUP` na aba Colaborador e aparece `#N/D` quando a matrícula não está lá (é do modelo da EDP).
5. Ficha de equipamento no Excel: na segunda página o carimbo (imagem) fica pequeno e encosta no rótulo "Registro", e há um "##" numa coluna estreita ao lado da matrícula; confirmar se já vem assim no modelo da EDP.
6. Ainda não foi medido: celular de verdade, computador sem o antivírus Kaspersky, leitor de tela de verdade.
