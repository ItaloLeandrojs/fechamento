# Ceará: estratificar o material dentro da estrutura (05/11/2026)

## Por que
Cada estrutura do Ceará (ex.: TR15CAA4, MB1CAA4S) tem um kit na base da Enel: a lista de materiais e quantidades previstos. Em campo, a equipe usa o material **que tem no almoxarifado**, e ele nem sempre é o do kit. O caso que mais acontece é o do transformador (TR15, TR75):
- o **elo** é de outro código;
- a **chave** é de outro tipo (outro código);
- vários itens do kit **não são usados**;
- o **cabo** usa menos (ex.: 2,45 m no kit, 1,23 m de verdade).

Outro caso: o kit prevê 4 conectores perfurantes, foi preciso trocar e pôr mais 4, e a quantidade vira 8.

O sistema da Enel já deixa **estratificar** a estrutura, e a equipe já faz isso lá, à mão. O site precisa deixar o material de dentro de cada estrutura igual ao usado em campo e entregar isso pronto no Excel, para a pessoa passar ao sistema da Enel.

### Como a equipe lança na Enel (Italo, 05/11 de manhã)
- O apontamento tem 3 abas: **Estrutura**, **Material** e **Mão de obra**.
- **Estratificar** é mexer só no que está **dentro** da estrutura: **tirar** um material do kit ou **diminuir** a quantidade dele (ex.: cabo de 2,45 m para 1,23 m).
- O que entrou **a mais** não vai na estrutura: a estrutura fica igual e a diferença é apontada na aba **Material** (ex.: kit com 4 conectores, usou 8: a estrutura fica com 4 e +4 vão em Material).
- Um **código novo** (ex.: elo de outro código) também vai na aba **Material**, nunca dentro da estrutura.
- Cuidado: a aba Material já pode ter o mesmo código vindo do CAD (ex.: 4 conectores soltos para ligar um ABT). Somado, fica 8, e **não** dá para escrever que os 8 vieram da estratificação.

Rascunho aprovado pelo Italo (05/11): `AUTOMACAO KIT MATERIAL\rascunhos-plataforma\e-ceara-estratificar.html`. Ele está fora do repositório e usa códigos de exemplo.

## Decisões do Italo (05/11, não rediscutir)
- **Ceará primeiro.** A EDP fica para depois.
- **Tudo à mão:** a pessoa decide cada mudança. O site não troca material sozinho.
- **Três ações na lista do kit:**
  1. **tirar** o que não foi usado;
  2. **mudar a quantidade** (para mais ou para menos, com decimais em kg e m);
  3. **adicionar um código** de material procurado no catálogo E4E.
- **Estruturas iguais ajustam juntas:** com 21 MB1 na obra, o ajuste vale para as 21, com a quantidade **por estrutura**. Não há ajuste de um poste só.
- **Saída (revista em 05/11 de manhã):**
  - aba nova **"ESTRATIFICAÇÃO"** no Excel da obra, com o kit inteiro de cada estrutura ajustada e a situação de cada material;
  - o que entrou a mais e os códigos novos **somam na aba Adição de material** de hoje, só com o total, sem marca;
  - a conta de cada código somado (quanto veio do CAD, quanto da estratificação) fica num bloco da aba ESTRATIFICAÇÃO.
- **O ajuste abre embaixo da linha** da estrutura (aprovado).
- **Grava a sugestão ao baixar o Excel** (aprovado).
- **OT diferente descarta os ajustes** (aprovado).
- **Lembrar o último ajuste:** na próxima obra em que a mesma estrutura aparecer, o site pergunta se quer usar o ajuste da última vez. **Nada é aplicado sem a pessoa clicar.**
- **A sugestão fica só no navegador de quem fez.** Não vai para o Supabase nem é compartilhada com a equipe.
- **Material fora do catálogo E4E:** pode ser digitado à mão (código, descrição e unidade). A linha sai em vermelho no Excel para conferir, como o "sem código" de hoje.

## Metas
1. Na Leitura do CAD, cada estrutura da **Adição de estrutura** que tem kit na base pode ser aberta para ajustar o material.
2. O ajuste mostra, linha a linha, o kit original e o que foi usado, com as marcas "não usado", "diminuiu", "a mais" e "novo" (a cor sempre com a palavra do lado).
3. Um resumo "o que mudou em relação ao kit", separando o que sai da estrutura do que vai em Adição de material.
4. "Voltar ao kit original" desfaz tudo daquela estrutura.
5. O Excel baixado ganha a aba de estratificação quando houver pelo menos uma estrutura ajustada, e a Adição de material passa a somar o que entrou a mais e os códigos novos.
6. Sugestão do último ajuste por estrutura, guardada no navegador.

## Fora do escopo agora
- **EDP.** Lá já existe "ajustar materiais" (`src/components/AjusteMateriais.tsx`: desmarcar e mudar quantidade). "Adicionar código" vai para lá numa fase própria.
- **Devolução de estrutura** (retirada): não tem ajuste.
- **Troca automática** (ex.: escolher o elo pela potência do trafo).
- **Ajuste compartilhado** com a equipe pelo Supabase.
- **Mão de obra.**

## Não pode acontecer (mesmo funcionando)
- Mudar a base da Enel guardada. O ajuste é da obra; o kit da base continua igual.
- Mudar as abas Adição de estrutura, Devolução de estrutura e Devolução de material. A estrutura continua na Adição de estrutura com a mesma quantidade.
- Mudar a Adição de material **sem ajuste**: obra sem estrutura ajustada sai com o Excel idêntico ao de hoje (4 abas).
- Mudar as colunas da Adição de material ou pôr nela marca de "veio da estratificação" (o total somado engana; a conta fica na aba ESTRATIFICAÇÃO).
- Pôr material a mais ou código novo **dentro** da estrutura (na Enel ele vai em Material).
- Aplicar a sugestão do último ajuste sem clique.
- Código, descrição ou kit real da Enel no repositório (ele é público): testes com dados inventados e arquivos reais só em `e2e/dados` (fora do git).
- Página mais larga que a tela no celular, ou erro do axe.

## Como funciona (o que foi decidido)

### Onde fica
- Na tabela **Adição de estrutura** da Leitura do CAD (`TabelaBloco` em `src/components/ceara/Ceara.tsx`), cada linha com kit na base ganha o botão **"Ajustar material"**.
- Linha que já foi ajustada mostra o selo "estratificada".
- Linha `foraDaBase` (estrutura sem kit na base) não tem o botão.
- O ajuste abre **embaixo da própria linha**, como o `AjusteMateriais` da EDP (aprovado em 05/11; o rascunho mostrava a estrutura sozinha numa página).

### A lista do kit
- O kit vem de `BaseEnel.kits[<código sem _S>]` (`[código, qtd][]`), e a descrição e a unidade vêm de `materiais[código]`.
- O cabeçalho mostra: o código da estrutura, a descrição, quantas há na obra e de quais postes, e o texto "quantidades por estrutura".
- Cada material do kit tem:
  - uma caixa **Entra** (desmarcada = "não usado", a linha fica riscada e apagada, com 0 usado);
  - a quantidade **no kit**;
  - a quantidade **usada**, com − e + de 1 em 1 e campo para digitar (aceita vírgula; nunca negativa).
- A linha diz o que vai acontecer na Enel, sempre em palavra:
  - usada menor que o kit: "diminuiu: retira X da estrutura";
  - usada maior que o kit: "a mais: estrutura fica igual, +X em Adição de material";
  - item novo: "novo: vai em Adição de material".
- O resumo "o que mudou em relação ao kit" separa **sai da estrutura** (não usado e diminuiu) de **vai em Adição de material** (a mais e novo).
- Abaixo do kit, a busca **"Adicionar material do almoxarifado"** procura no catálogo E4E (`materiais`) por código ou descrição.
  - Usar `normalizar`/`casa` de `src/lib/busca.ts`.
  - A busca começa com 2 letras e mostra no máximo cerca de 20 resultados.
  - Adicionar entra com quantidade 1 por estrutura; adicionar de novo o mesmo código soma 1.
  - O item adicionado tem o selo "novo" e o botão "tirar".
- Um código que já está no kit não entra como "novo": a busca leva até a linha dele no kit (escolha minha, para não duplicar).
- **Sem achar na busca:** "Não achei no catálogo: digitar à mão" abre três campos.
  - Os campos são código, descrição e unidade (UN, M ou KG).
  - O item entra como "novo" com o aviso "fora do catálogo: conferir".
  - No Excel, a linha dele na Adição de material e no bloco da aba ESTRATIFICAÇÃO sai em vermelho, com o mesmo estilo das linhas sem código das abas de hoje.
  - Na sugestão do último ajuste, ele é guardado e reaplicado como qualquer item novo, sem a checagem "código existe na base".

### O que fica guardado na obra
- **Por estrutura:**
  - os códigos do kit tirados;
  - as quantidades mudadas (só o que difere do kit);
  - os materiais novos (código e quantidade por estrutura).
- Sem diferença, a estrutura volta a ser "kit puro".
- **Trocar o DXF:**
  - **Mesma obra** (mesma OT tirada do nome do arquivo): mantém os ajustes das estruturas que continuam e descarta os das que sumiram.
  - **OT diferente, ou sem OT no nome e nome de arquivo diferente:** é outra obra. Descarta todos os ajustes, e as sugestões guardadas voltam a aparecer.
  - Assim nada passa de uma obra para outra sem clique (aprovado em 05/11).
- **Sair do Ceará** (← Regiões) descarta tudo.

### A aba nova no Excel (revista em 05/11 de manhã)
- Nome: **"ESTRATIFICAÇÃO"**.
- Entra depois das 4 abas de hoje, no mesmo estilo de `src/ceara/excel.ts`, e só aparece se houver ajuste.
- **Bloco 1: o kit de cada estrutura ajustada.**
  - Lista **todos** os materiais do kit e os novos daquela estrutura, não só os que mudaram (aprovado).
  - Uma estrutura embaixo da outra, na ordem da Adição de estrutura.
  - Colunas (aprovadas): Estrutura | Qtd de estruturas na obra | Código | Descrição | Unidade | Qtd no kit | Qtd retirada | Fica na estrutura | Situação. As três quantidades são **por estrutura**.
  - Situação (aprovada):

    | Situação | Qtd retirada | Fica na estrutura | Vai em Adição de material |
    |---|---|---|---|
    | igual | 0 | o kit | nada |
    | não usado | o kit inteiro | 0 | nada |
    | diminuiu | kit − usado (ex.: 2,45 − 1,23 = 1,22) | o usado (1,23) | nada |
    | a mais | 0 | o kit | usado − kit, por estrutura |
    | novo | 0 (fora do kit: Qtd no kit 0) | 0 | o usado, por estrutura |
- **Bloco 2: "SOMADO EM ADIÇÃO DE MATERIAL"**, embaixo do bloco 1, com uma linha em branco entre eles.
  - Uma linha por código que a estratificação mandou para a Adição de material.
  - Colunas (aprovadas): Código | Descrição | Unidade | Do CAD | Da estratificação | Total na Adição de material | De quais estruturas.
  - "Da estratificação" = soma, em cada estrutura, de (a mais ou novo, por estrutura) × qtd dessa estrutura na obra.
  - "De quais estruturas" lista o código e a quantidade, ex.: "TR15CAA4 (1), MB1CAA4S (21)".
  - "Do CAD" é 0 quando o código não veio do desenho.

### A Adição de material com estratificação
- As colunas, o estilo e o cabeçalho continuam os de hoje.
- Código que já está na aba (veio do CAD): a quantidade vira o total somado, na mesma linha.
- Código que não estava: entra no fim da aba, na ordem em que aparece na Adição de estrutura.
- Soma por código. Linha do CAD **sem código** não soma com nada.
- Material digitado à mão (fora do catálogo) entra em vermelho.

### Sugestão do último ajuste
- Fica numa loja nova do IndexedDB, `ajustes`, em `src/lib/banco.ts`. A versão do banco passa de 2 para 3, sem mexer em `tecnicos` e `bases`.
- A chave é o código da estrutura sem _S.
- O valor é o ajuste e a data.
- **Grava ao baixar o Excel** (o ajuste ficou final), para cada estrutura ajustada (aprovado em 05/11). Uma estrutura que volta ao kit puro e é baixada assim apaga a sugestão dela.
- Quando uma estrutura com sugestão guardada aparece na Adição de estrutura de outra obra:
  - a linha mostra "Na última obra você ajustou esta estrutura" com **[Usar o mesmo ajuste]** e **[Não]**;
  - "Não" esconde o aviso só nesta obra.
- Ao usar, o código que não existe mais na base (base nova) é ignorado, com um aviso curto.
- Sem IndexedDB (navegador bloqueado), a sugestão simplesmente não aparece. O resto funciona.

## Testes
- Unidade, com dados inventados:
  - aplicar o ajuste (tirar, mudar, adicionar, voltar ao kit);
  - a aba de estratificação (colunas, as 5 situações, retirada e "fica" com decimais, ex.: 2,45 − 1,23 = 1,22 sem erro de arredondamento);
  - o bloco "Somado em Adição de material" (do CAD + da estratificação × estruturas na obra; "de quais estruturas");
  - a Adição de material somando no mesmo código (4 do CAD + 4 a mais = 8, uma linha só), código novo no fim, digitado à mão em vermelho;
  - Excel sem ajuste continua com 4 abas, idêntico ao de hoje (byte a byte nas abas);
  - gravar e ler a sugestão (fake-indexeddb, como em `src/lib/banco.test.ts`).
- e2e (`E2E_SO=ceara node e2e/fluxo.mjs`):
  - ajustar uma estrutura do `ceara.dxf` (tirar um item, mudar uma quantidade, adicionar um código);
  - baixar e conferir que a aba existe e que a Adição de material somou;
  - depois de sair por "← Regiões" e carregar o desenho de novo, a sugestão aparece e "Usar o mesmo ajuste" refaz o ajuste;
  - adicionar um material digitado à mão e conferir a linha vermelha no Excel;
  - axe e largura em 1366 e 390 px.
- tsc, eslint, build e `node scripts/conferir-dist.mjs` limpos.

## Fica para quem constrói
- Nomes de arquivos e funções (sugestão: `src/ceara/estratificacao.ts` para as regras e um componente `AjusteEstrutura.tsx`).
- Textos curtos da tela, seguindo o rascunho.
- Como a tabela de ajuste fica no celular (pode rolar de lado dentro do painel, como as outras tabelas).
