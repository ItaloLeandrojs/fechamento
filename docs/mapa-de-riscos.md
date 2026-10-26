# Mapa de riscos do site Fechamento

26/10/2026. Lista do que pode dar errado ao gerar a ADS, levantada lendo o código inteiro e os erros que já apareceram.

## A causa comum dos erros até agora

O site foi testado com **um inventário real só** (nota 16646602). Ele procura células fixas, textos e nomes de aba que existem nesse inventário. Quando o inventário de outra obra vem um pouco diferente, o site erra. Pior: às vezes ele erra **sem avisar**. Foi assim com:

- o código gravado como texto, que gerava linha duplicada;
- a aba DP sem a palavra LIVRE;
- as descrições vazias nas linhas novas.

**Gravidade**
- **Alta:** o arquivo sai errado sem nenhum aviso.
- **Média:** o site para com uma mensagem de erro, ou o erro aparece no Excel.
- **Baixa:** incômodo, sem dado errado.

## 1. Inventário diferente do modelo testado

| # | Situação | O que acontece hoje | Gravidade | Proteção proposta |
|---|---|---|---|---|
| 1 | Linha nova da ADS sem a fórmula PROCV na descrição (F) e na unidade (G), ou com a fórmula apontando para outra aba | Descrição e unidade vazias (**o erro de agora**). Sem a unidade, o "Valor de Material" da Check-list não soma aquele material | Alta | Se faltar a fórmula, o site escreve a fórmula do modelo e o valor já calculado; sem a aba MaterialServico, escreve o texto da descrição |
| 2 | Colunas da ADS em outra ordem (o site supõe E código, F descrição, G unidade, H planejado, I aplicado, J adicional, K devolvido, O e P) | Quantidades gravadas na coluna errada | Alta | Ler os títulos da linha 1 antes de gravar; se não baterem, parar e avisar |
| 3 | Linha sem código no meio ou no fim da ADS que não é reserva (total, observação, assinatura) | O site usa essa linha para um item novo e apaga o que tinha nela | Alta | Só reaproveitar linha de reserva de verdade (com o mesmo jeito das linhas da tabela); o resto fica intacto e a linha nova vai para baixo |
| 4 | Código gravado como texto | Corrigido em 26/10 | - | Já coberto por teste |
| 5 | Check-list com a nota, o tipo de obra ou as ordens em outra célula (o site lê G4, G5, G9, G10 e G11) | Nome do arquivo baixado errado ("obra - ADS.xlsx") e cabeçalho do site vazio | Média | Achar pelos rótulos ("Nota / OV", "Tipo Obra", "Ordem/Diagrama") em vez da célula fixa |
| 6 | Data da fiscalização em outra célula (o site grava em Q4) | Data do dia não entra, ou cai em outra célula | Alta | Achar pelo rótulo "Data da fiscalização" |
| 7 | Caixas FINAL/PARCIAL em outro lugar (o site usa W5:X7) | Caixas a mais ao lado das existentes | Média | Achar pelos textos FINAL e PARCIAL; só criar em W5:X7 se não existirem |
| 8 | Aba sem o rótulo "Registro" no rodapé | Aba fica sem carimbo, sem aviso | Alta | Mostrar, depois de gerar, a lista de abas que receberam carimbo e as que deviam ter recebido |
| 9 | Ficha de aterramento com outro cabeçalho ou outro desenho dos quadros "Ponto" | O site para com erro; ou, se o desenho mudar pouco, a foto cai no quadro errado | Média/Alta | Conferência do arquivo gerado (item 22) |
| 10 | Ficha de equipamento com outro desenho (o site usa distâncias fixas a partir do "Ponto": +3, +4, +7, +9 linhas) | Dados do transformador em células erradas, sem aviso | Alta | Achar cada campo pelo rótulo (Potência, Patrimônio, Série...) |
| 11 | Aba DP sem LIVRE | Corrigido em 26/10 (acha o maior quadro) | - | Já coberto por teste |
| 12 | Aba com nome diferente ("ADS ", "Ficha Medicao", "D.P.") | O site para com erro de aba não encontrada | Média | Aceitar variações de nome (sem acento, espaço, maiúscula) |
| 13 | MaterialServico com as colunas em outra ordem (o site lê C código, D descrição, E unidade) | Busca de materiais vazia e descrições erradas | Alta | Achar as colunas pelo título |
| 14 | Inventário de outro tipo de obra (MT, reparo, subterrânea), com abas a mais ou a menos | Não testado | ? | Testar com inventários reais de cada tipo |

## 2. Jeito de usar

| # | Situação | O que acontece hoje | Gravidade | Proteção proposta |
|---|---|---|---|---|
| 15 | Subir de novo um arquivo que já passou pelo site | As linhas vermelhas de antes passam a contar como previstas (planejado 0); a ficha de aterramento já vem com as linhas apagadas | Alta | Marcar por dentro o arquivo gerado e avisar ao abrir: "este arquivo já foi gerado pelo site, use o inventário original" |
| 16 | Navegador com a versão antiga do site guardada | A pessoa usa um site com erro já corrigido | Média | Mostrar a versão e a data no rodapé, e avisar quando houver versão nova |
| 17 | Abrir o arquivo baixado no Modo Protegido do Excel | Fórmulas que dependem da ADS mostram o valor antigo até clicar em Habilitar edição: Valor de Material da Check-list, coluna de valor da ADS. A matrícula, o nome, a data, a descrição e a unidade já foram corrigidos | Média | Guardar o valor calculado também nessas somas, ou avisar na tela: "abra e clique em Habilitar edição antes de conferir os valores" |
| 18 | Código que não existe na MaterialServico desta obra | Descrição #N/D na linha nova (é o que o Excel calcula) | Média | Avisar na revisão, antes de baixar, com o código |
| 19 | Foto do iPhone em HEIC, foto muito grande, celular com pouca memória | HEIC pode não abrir no computador; muitas fotos grandes podem travar o celular | Média | Mensagem clara para HEIC; reduzir cada foto logo ao anexar (já reduz para 1600 px) |
| 20 | Fechar ou recarregar a página no meio | O navegador avisa, mas o que foi lançado se perde se a pessoa confirmar | Média | Guardar o rascunho da obra no navegador e oferecer continuar |
| 21 | Técnico do carimbo cadastrado em outro computador | O carimbo não aparece na lista | Baixa | Já explicado na tela; importar o arquivo dos técnicos |

## 3. A rede de segurança que falta (proposta)

**22. Conferência automática do arquivo gerado.** Depois de gerar, e antes de baixar, o site abre o próprio arquivo e confere:

- cada material lançado tem o aplicado certo na ADS, com descrição e unidade;
- todos os códigos estão como número;
- toda linha nova está vermelha;
- o carimbo saiu em cada aba de assinatura, e a data e o técnico estão certos;
- as fotos estão nos quadros: aterramento, equipamento e DP;
- as caixas Parcial e Final estão como escolhido;
- o Valor de Material bate com a soma da ADS.

Se algo não bater, o site mostra o que foi e não esconde. Assim, um inventário diferente vira um aviso na tela, e não um arquivo errado enviado.

**Testes com vários inventários reais.** É o que mais reduz erro. O ideal é juntar de 5 a 10 inventários originais da EDP, de tipos diferentes:

- BT Zero, MT, reparo;
- com e sem transformador;
- com mais de 8 pontos de aterramento;
- o do seu amigo.

Cada um vira um teste automático que roda antes de toda publicação. Esses arquivos ficam fora do GitHub, na pasta e2e/dados.
