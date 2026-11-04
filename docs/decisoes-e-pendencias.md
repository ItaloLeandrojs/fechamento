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
- 35 testes unitários, `tsc` e `eslint` sem erro.
- `npm run e2e` ("Tudo passou."): a obra inteira em 5 rodadas (1366 claro e escuro, 1920 claro, 390 claro e escuro), sem internet, com o axe em 11 análises por rodada (55 no total, zero violações, incluindo a revisão rolada com a barra de baixo sobre o conteúdo) e 35 prints. Em cada tela confere rolagem lateral (nenhuma). Também confere:
  - a coluna "Devolvido" da revisão dentro da tela e do painel em 1366 e 1920 (e "Dev." do cartão em 390);
  - kit de nome comprido (`KP-SMDT-P9/300-(CCM_BTZero)`) com quantidade "2,5": o campo mantém "2,5" e a revisão mostra aplicado 2,5 x a quantidade do material no kit;
  - duas fotos do ponto de aterramento e duas fotos do equipamento (dois arquivos diferentes) escolhidas ao mesmo tempo: as duas ficam, diferentes, cada uma no seu quadro ("Foto 1" e "Foto 2" no equipamento);
  - foco visível (WCAG 2.4.11): com a página rolada até o campo ficar sob o cabeçalho preso, o foco da busca, do "Limpar busca" e do filtro da revisão traz o elemento para baixo do cabeçalho (e acima da barra de baixo no celular); `scroll-padding-top: 96px` em `src/index.css` corrige (sem ele o teste falhava em todas as rodadas);
  - nome (`<nota> - ADS.xlsx`) e tamanho do arquivo baixado.
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

## Correções da revisão final (24/10/2026)
- Ficha de equipamento (era a pendência 5, resolvida): o rótulo "Registro" é mesclado em C:E e a matrícula fica só na coluna E. O site gravava na primeira coluna do rótulo (estreita, aparecia "##") e media o carimbo pela coluna errada (pequeno e sobre o rótulo). Agora `acharRodape` procura a matrícula dentro das colunas do rótulo, na linha de baixo (primeira célula com conteúdo, fórmula ou que abra uma mesclagem) e o nome vem logo depois. Teste em `src/core/fichas.test.ts` (fórmulas da Check-list, modelo em branco e o layout da Check-list). No Excel de verdade: matrícula dentro do quadro, sem "##", e o carimbo centralizado sobre a linha do nome.
- `apagarLinhas` remove contêineres que ficaram vazios (`protectedRanges`, `hyperlinks`, `dataValidations`, `ignoredErrors`, x14 `conditionalFormattings`, `ext` e `extLst`) e acerta o `count`, para o Excel não oferecer reparo em outros modelos.
- Técnicos: erro do IndexedDB ao salvar ou apagar aparece na tela; matrícula repetida pede confirmação antes de trocar o nome e o carimbo de outra pessoa.
- Materiais e mão de obra: quando a lista de previstos ou o cadastro é cortado no limite, o texto diz quantos aparecem de quantos; um previsto que só casa pelo texto do cadastro não some mais. Descrições cortadas em 2 linhas ganharam `title` com o texto inteiro.

## Ceará: estrutura e material pelo CAD (04/11/2026)
- Região "Ceará" pronta no painel (o atalho `#ceara-teste` continua abrindo a mesma tela). Lê o DXF do asbuilt e baixa "<OT> - ESTRUTURA E MATERIAL.xlsx" com 4 abas (adição e devolução de estrutura e de material), no modelo da Solicitação de acréscimos da Enel: DATA (hoje), ÁREA (SUL, LESTE ou CENTRO SUL), EMPRESA (COSAMPA), OT (do nome do arquivo, editável). RESPONSÁVEL em branco. Visual (Italo, 04/11): sem o título "SOLICITAÇÃO DE ACRÉSCIMOS..." e sem a linha TOTAL, cabeçalho na linha 1 em grafite com letra branca, linhas listradas bem claras, bordas finas cinza, sem linhas de grade; sem código ou fora da base com fundo rosado e letra vermelha escura; impressão deitada, largura numa página. Mão de obra fica de fora ("orçamento", para o Italo, é a mão de obra).
- Etiqueta em TEXTs soltos (obra de Limoeiro): as linhas empilhadas na mesma coluna (mesmo x até uma altura de letra, até 2,2 alturas de distância, mesma camada) viram uma etiqueta; linhas sem item de etiqueta (nome de rua, nota) saem.
- Alça e laço (SPALÇA50, SPLAÇO50) são estruturas. CAVA KLC não entra (aparece em "Fora da contagem de propósito").
- Cabo: MT novo em kg = metros × fases × 1,05 × coeficiente (CAA 4 0,085; 1/0 0,216; 266,8 0,546); MT retirado sem os 5% e com as fases do código do vão (confirmado pelo Italo em 04/11). BT pré-reunido novo por bitola (AM035T 330993, AM050T 330994, AM025T 330757, AM025M 330786), metros + 5% arredondado ao mais perto. BT nu retirado em kg = metros × condutores do código (2AN004 = 2; sem número = 1, confirmado em 04/11) × 0,058. Tensionado (2) não é material.
- Trafo retirado (trifásico 13,8 kV): até 30 kVA volta como SUCATA (10 = 111734, 15 = 111736, 30 = 111738), acima como SALVADO (45 = 111739, 75 = 111741, 112,5 = 111743, 150 = 111745, 225 = 111747, 300 = 111749). O de 500 kVA só tem sucata na base (111751), e o Italo mandou usar esse. Os trafos RECUP da base não entram. Potência fora da lista sai em vermelho. Nome do arquivo baixado confirmado.
- Elo: para o Italo, "o elo vem sempre dentro das estruturas do transformador" (TR15, TR75, TR150...). O site não soma mais o elo 171089 sozinho (nem no trafo novo, nem na chave fusível); só entra o elo escrito no desenho (ex.: 3xELO6K). Feito em 04/11; na obra de Limoeiro os 3 elos da contagem do Italo ficam dentro da TR15CAA4.
- Chave fusível: suporte 251841 e conector cunha por chave; trafo novo sem chave escrita = 3 chaves. Fitas 860342/860344 só com cabo BT novo. Conector perfurante só o que está escrito no desenho.
- Códigos e descrições vêm da base DE-PARA da Enel (`scripts/gerar-catalogo-enel.py` gera `src/data/enel-catalogo.json`, FORA do git: a base é da Enel e o repositório é público; vai para o Supabase antes de publicar). Estrutura que não existe na base e material sem código saem em vermelho no Excel.
- Conferido: 3 obras com orçamento real (estruturas iguais, menos a MB4 da mt-trafo, em que vale o desenho) e a de Limoeiro (igual à contagem do Italo). O Excel gerado abre no Excel sem reparo.

## Pendências pequenas da plataforma resolvidas (04/11/2026)
- Chave da arte do crachá em JSON (antes juntava com "|": "A|B" + "C" dava a mesma chave que "A" + "B|C").
- Cargo comprido: numa linha se couber com letra de pelo menos 26 px do modelo; senão vai para 2 linhas de 28 px (bases 796 e 828), quebradas no espaço que deixa as linhas mais parelhas. Continua até 60 letras.
- Navegador que não guarda nada: entra com um clique, com a foto, e o painel avisa "Este navegador não guarda seus dados; na próxima vez você terá de preencher de novo." (`gravarPessoa` devolve `guardou`). O aviso "a foto não coube" ficou só para a cota estourada.
- "← Regiões" na EDP pede confirmação também quando só a foto do DP foi posta; só ter escolhido parcial ou final não conta.

## Pendências
1. Ficha de aterramento com mais de 8 pontos: hoje o site avisa e bloqueia; falta criar os blocos extras.
2. Ficha de equipamento: lugar fixo para os equipamentos da ficha; acima disso o site dá erro claro.
3. O modelo da EDP traz o bloco 1 da ficha de aterramento cortado entre as páginas 1 e 2 na impressão (vem do inventário original, não do site).
4. Na aba DP, o nome do colaborador da EDP vem de `VLOOKUP` na aba Colaborador e aparece `#N/D` quando a matrícula não está lá (é do modelo da EDP).
5. Ainda não foi medido: celular de verdade, computador sem o antivírus Kaspersky, leitor de tela de verdade.
