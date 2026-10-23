# Fechamento: decisões e pendências

Especificação completa: `..\ESPECIFICACAO do site Fechamento.md` (fora do repositório).

## Como funciona
- O site lê o inventário da EDP no navegador e grava a cópia preenchida editando o XML do .xlsx direto (JSZip). Nada vai para servidor.
- A ADS recebe o Aplicado pelas regras combinadas (operação prevista, depois outra do mesmo grupo, 2000 tem preferência; retirada 2030/2040 nunca cai em instalação; o que não está previsto vira linha nova, com ID e operação vazios). Linhas não lançadas ficam com Aplicado 0. Adicional e Devolvido são gravados como valor, só quando positivos.
- O `calcChain.xml` é apagado e o Excel recalcula tudo ao abrir (`fullCalcOnLoad`).
- Carimbo: o rodapé de cada aba é achado pelo último rótulo "Registro". O site grava a matrícula e o nome, coloca a data de hoje na Check-list (Q4) e cola a imagem do carimbo acima do nome. Remove o carimbo antigo: a imagem e a "foto vinculada" (câmera do Excel, `=IMAGEM`), que puxava do ARO.
- Técnicos: arquivo `tecnicos-fechamento.json` (fora do repositório, com CPF nos carimbos). Ele é carregado uma vez e fica no IndexedDB do navegador.
- Logo: COSAMPA / FECHAMENTO no desenho da marca Cosampa (C, O, A e M originais), com o A em amarelo. Gerada por `scripts/gerar-logo.py`.

## Conferências feitas (23/10/2026)
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
5. Ainda não foi medido: celular de verdade, computador sem o antivírus Kaspersky, leitor de tela de verdade.
