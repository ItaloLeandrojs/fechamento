# Ceará: caderno do orçamento no site (05/11/2026)

## Por que
Hoje a equipe faz o orçamento de cada obra num caderno de papel: olha o CAD na tela, vai poste por poste fazendo pauzinho e anota em colunas (Estrutura, Material, Mão de obra) e no bloco do ARO. Depois digita tudo no sistema da Enel, uma linha por vez, e soma os cabos na calculadora.

O que mais toma tempo ou dá erro (Italo, 05/11):
- **contar no CAD** (perder a conta dos pauzinhos);
- **digitar na Enel**, linha por linha.

O caderno no site substitui o papel **por enquanto**, enquanto a Leitura do CAD não fica 100%. Ele não depende da leitura automática para funcionar. Quando a leitura ficar boa, a comparação entre os dois mostra isso.

Rascunho aprovado (05/11): `AUTOMACAO KIT MATERIAL\rascunhos-plataforma\f-ceara-caderno.html`, versão **D** (fora do repositório, códigos de exemplo). As versões A, B e C do mesmo arquivo foram descartadas.

## Decisões do Italo (05/11, não rediscutir)
- **Onde fica:** item novo **"Caderno do orçamento"** no menu lateral do Ceará, ao lado da Leitura do CAD.
- **Poste por poste em colunas:** a lista de postes à esquerda. Em cada poste, três colunas, **Estrutura | Material | Mão de obra**, com busca por código ou nome e o botão **+1** (e −) em cada item.
- **A lista de postes começa vazia.** A pessoa cria os postes com "+ Poste", como no papel. Não puxa do DXF.
- **Embaixo:**
  - a **soma de cada poste**, nas três colunas;
  - a **soma da obra**, nas três colunas.
- **Cabo num bloco só, "Rede"** (último item da lista, depois dos postes). Ir de vão em vão foi recusado: é mais lento que a calculadora, e muita obra mexe só no poste.
  - Uma linha por cabo.
  - **Situação**, no jeito do CAD: (1) novo; (2) tensionado ou realocado; (3) retirado; ou substituído (retira o velho e põe o novo).
  - **Metros** num campo que soma como a calculadora: "32+35+30" dá 97.
  - **O site calcula sozinho**, a partir dos metros puros:
    - o **material** do cabo do jeito da Enel, com a porcentagem e a conversão em kg, como a Leitura do CAD já faz;
    - a **mão de obra** do cabo pelos metros.
  - Dá para mudar à mão o que o site calculou.
- **ARO automático, com mudança à mão.** Os itens são Cinta, Poste, Cabo (m) e Trafo.
  - Calculados **pelo material**.
  - O Cabo do ARO usa os **metros puros** dos cabos novos e substituídos, **sem a porcentagem e sem a conversão em kg**.
  - Valor mudado à mão mostra "mudado à mão", o valor que o automático daria e "voltar ao automático".
- **Mão de obra com busca de verdade:** a lista de atividades (Listagem de atividades / PxQ) sobe para a base no Supabase, como a base da Enel. A busca acha código, descrição e unidade.
- **Saídas, as três:**
  1. **Lançar na Enel:**
     - uma linha por vez, na ordem das abas (Estrutura, Material, Mão de obra);
     - botões "Copiar código" e "Copiar quantidade";
     - "Lançada, próxima" e "Voltar uma", com a barra de quantas já foram.
  2. **Excel:** as 4 abas de hoje (adição e devolução de estrutura e de material), mais a mão de obra e o ARO.
  3. **Comparar com a Leitura do CAD:** a Leitura do CAD compara com o caderno da mesma OT, sem precisar subir o Excel do orçamento.
- **Guardado por OT neste computador.** Dá para fechar a página e voltar.

## Metas
1. Fazer o orçamento de uma obra inteira no site mais rápido que no papel: sem pauzinho e sem calculadora.
2. Lançar na Enel sem redigitar código: copiar e colar, com o ponto onde parou marcado.
3. O ARO sai pronto, com conferência.
4. O caderno serve de "orçamento feito à mão" para conferir a Leitura do CAD.

## Fora do escopo agora
- Puxar postes ou itens do DXF para dentro do caderno.
- Regras automáticas de mão de obra por poste (cruzetas, armação por face, linha viva...). No poste, a mão de obra é escolhida à mão. Só a do **cabo** e o **tensionar** (pelas estruturas e pela marcação do cabo no poste) são automáticos.
- Compartilhar o caderno com a equipe pelo Supabase. Ele fica no navegador de quem fez.
- EDP e Sergipe.

## Não pode acontecer (mesmo funcionando)
- Perder o caderno ao fechar a página, ou misturar o caderno de uma OT com o de outra.
- O ARO mudado à mão voltar ao automático sem a pessoa pedir.
- O Cabo do ARO sair com a porcentagem ou em kg.
- Código, descrição, kit ou lista de mão de obra real da Enel no repositório (ele é público). A lista de atividades só no Supabase e na pasta `../bases` (fora do git), como a base da Enel. Testes com dados inventados.
- Mudar o Excel e a comparação da Leitura do CAD para quem não usa o caderno.
- Página mais larga que a tela no celular, ou erro do axe.

## Como funciona (o que foi decidido)

### A tela
- **Cabeçalho:** a OT (7 dígitos, ou 11 começando com 1722) e "Salvo neste computador".
  - Sem OT válida, o caderno não salva.
  - Um seletor abre os cadernos já guardados.
- **À esquerda:** a lista P1, P2... com a marca "feito", "+ Poste" e, no fim, "Rede".
- **No centro:** o poste aberto, com as marcações "Cabo MT" e "Cabo BT", as três colunas, a busca no topo de cada coluna e os botões −/+1 em cada item, e o botão "Feito, próximo →".
- **Embaixo:** a tabela "Soma de cada poste" (uma linha por poste e a Rede) e "Soma da obra" nas três colunas.
- **À direita:** o ARO.
- **No fim:** os botões "Lançar na Enel", "Comparar com a Leitura do CAD" e "Baixar Excel".

### Itens do poste
- A busca da Estrutura procura nos kits da base da Enel.
- A busca do Material procura no catálogo E4E.
- A busca da Mão de obra procura na lista de atividades nova.
- Usar `normalizar`/`casa` de `src/lib/busca.ts`. A busca começa com 2 letras e mostra até cerca de 20 resultados, como na estratificação.
- Código que não está na base pode ser digitado à mão e fica marcado em vermelho, como o "sem código" de hoje.
- Cada item tem a quantidade, o −, o +1 e o campo para digitar (decimais com vírgula).

### Estrutura e material são colunas separadas (como no papel)
- A coluna Material é o material **avulso**, igual à aba Adição de material da Leitura do CAD. O material de dentro do kit **não** é somado na coluna Material: a estrutura carrega o kit dela, como no sistema da Enel.
- Assim o caderno vira um `Orcamento` (`src/ceara/orcamento.ts`) direto, por bloco e código, e entra em `comparar` sem mudar nada.
- Estratificar a estrutura dentro do caderno fica fora desta fase (já existe na Leitura do CAD).

### Situação de cada item (adição ou devolução)
- O Excel tem adição e devolução separadas.
- No poste, cada item entra como **novo** (adição) por padrão e pode virar **retirado** (devolução).
- **Escolha minha:** um seletor curto na linha do item, (1) ou (3).
- **Código do retirado (Italo, 05/11): depende do material.** Poste, cabo e trafo têm código de sucata próprio; o resto volta com o mesmo código. Ao marcar (3), o site **sugere** o código de sucata quando conhece (a mesma regra da Leitura do CAD em `src/ceara/contagem.ts`), e a pessoa confere e pode trocar.
- Poste retirado não entra no Poste do ARO (o ARO conta o que foi instalado).

### Rede
- As linhas e a conta dos metros estão nas decisões acima.
- **Como escolhe o cabo (Italo, 05/11): pelo nome do vão**, o que está escrito no vão do desenho (ex.: AM035T, 3#4CAA). O site lista os nomes que a Leitura do CAD já sabe ler (`lerCabo` em `src/ceara/contagem.ts`) e, com eles, calcula bitola, fases, material e mão de obra.
- Nome que o site não conhece: a linha aceita o nome digitado, e material e mão de obra ficam à mão, em vermelho, como o "cabo sem regra de conversão" de hoje.
- Material do cabo:
  - usar a mesma regra de conversão da Leitura do CAD (`src/ceara/contagem.ts`, conversão de cabos com a porcentagem e o kg);
  - novo e substituído entram em adição de material;
  - retirado e substituído entram em devolução, com a mesma regra da Leitura do CAD para retirada.
- Mão de obra do cabo (Italo, 05/11 à tarde; os códigos ficam fora do repo, na tabela de regras da base):
  - **Instalação por metro de rede:** todos os condutores do circuito contam como um (100 m de MT com 3 fases = 100). Uma voz para o pré-reunido de BT; para o condutor nu (BT e MT) a voz depende da bitola (uma para as bitolas pequenas e outra para as acima de 120 mm²).
  - **Retirada por condutor:** metros × condutores (100 m de MT com 3 fases = 300). O pré-reunido de BT retirado conta como **1 condutor**. No MT a voz de retirada também depende da bitola.
  - **MT sem as fases no nome do vão:** o site **pergunta as fases na linha**. Até a pessoa informar, a linha fica em vermelho com "falta o número de fases" e não soma material nem mão de obra.
  - Linha (2) tensionado ou realocado na Rede não gera material nem mão de obra: o tensionar sai dos postes (abaixo).
  - O código exato de cada caso fica numa tabela de regras guardada **na base**, não no código do site, porque o repositório é público.

### Cabo em cada poste e o tensionar (Italo, 05/11 à tarde)
- Cada poste tem **duas marcações de cabo, uma para MT e outra para BT**, no mesmo jeito do CAD: (1) novo, (2) existente tensionado, (3) retirado, ou **sem nada = existente** (o padrão).
- O **tensionar** (voz cobrada por vão) entra **sozinho** na Mão de obra do poste, marcado "automático", e pode ser mudado à mão ("mudado à mão", "voltar ao automático"):
  - **MT:** com o cabo de MT existente (sem nada ou (2)) e estrutura nova de MT do **tipo 3** (inclui 3.1 e 3.3) → 1 tensionar; do **tipo 4** → 2 (um para cada lado). Tipo 1 ou 2 não cobra.
  - **BT:** com o cabo de BT existente e as duas estruturas de BT de ancoragem que o Italo citou no poste (com ou sem alças) → 2 (um para cada lado). Só a estrutura de passagem com o laço não cobra.
  - Cabo (1) novo ou (3) retirado no poste: não cobra (o lançamento do cabo novo já inclui o tensionamento).
  - Quais estruturas são tipo 3, tipo 4 e as de BT fica na tabela de regras da base (expressões sobre o nome da estrutura), não no site.

### ARO
- **Poste:** soma dos materiais de poste em adição.
- **Cinta:** soma dos materiais de cinta.
- **Trafo:** soma dos materiais de transformador.
- **Cabo (m):** soma dos metros puros da Rede com situação (1) novo ou substituído.
- **Escolha minha:** o que é poste, cinta e trafo vem da descrição do catálogo (começa com POSTE, CINTA, TRANSFORMADOR). Isso fica numa lista na base, para ajustar sem mexer no site.

### Lançar na Enel
- Uma linha por **código somado da obra** (não por poste), na ordem Estrutura, Material e Mão de obra. Dentro de cada uma, adição e depois devolução (escolha minha).
- O que já foi lançado fica guardado com o caderno. Mudar a quantidade de uma linha já lançada tira a marca dela.

### Excel
- Mesmo modelo de `src/ceara/excel.ts`.
- As 4 abas de hoje com as somas do caderno.
- Mais a aba **"MÃO DE OBRA"** (mesmas colunas da adição de material: DATA, ÁREA, EMPRESA, OT, CÓDIGO, DESCRIÇÃO, QTD).
- Mais a aba **"ARO"** (item e quantidade, marcando o que foi mudado à mão).
- **Escolha minha:** a área (SUL / LESTE / CENTRO SUL) é escolhida no caderno, como na Leitura do CAD.

### Comparar com a Leitura do CAD
- Na Leitura do CAD, quando existe caderno guardado com a mesma OT, aparece "Comparar com o caderno". O resultado é igual ao de hoje com o Excel do orçamento (`comparar` de `src/ceara/orcamento.ts`).
- O botão do caderno leva à Leitura do CAD com a comparação pronta, se o DXF da mesma OT estiver lido. Se não estiver, avisa para ler o DXF.
- **Escolha minha:** a mão de obra fica fora da comparação, porque a Leitura do CAD ainda não conta mão de obra.

### Guardar
- Loja nova no IndexedDB (`src/lib/banco.ts`, versão 3 → 4), com a chave = OT + pessoa logada (escolha minha: dois logins no mesmo navegador não sobrescrevem o caderno um do outro).
- Grava a cada mudança, com um pequeno atraso.
- Sem IndexedDB, o caderno funciona, mas avisa "não está sendo salvo".

### Lista de mão de obra na base
- Mesmo caminho da base da Enel: o script Python do PC do Italo lê a planilha, grava uma cópia em `../bases` e sobe para o Supabase (bucket privado `bases`, tabela `bases`, versão).
- O site baixa depois do login e guarda no IndexedDB.
- Ela leva também as tabelas de regras do cabo e do ARO.
- **Faz parte deste trabalho:** escrever o script (Python, no PC do Italo, fora do site) que lê a Listagem de atividades / PxQ de `ceara-teste\referencia` e sobe a lista, no mesmo padrão do script da base da Enel.

## Testes
- Unidade, com dados inventados:
  - a conta dos metros ("32+35+30", vírgula decimal, linha vazia);
  - material e mão de obra da Rede para cada situação;
  - o ARO automático e o mudado à mão;
  - soma por poste e da obra;
  - adição e devolução;
  - Excel com as abas novas, e Excel da Leitura do CAD sem caderno idêntico ao de hoje;
  - guardar e ler por OT (fake-indexeddb), e a migração 3 → 4 sem perder `tecnicos`, `bases` e `ajustes`.
- e2e:
  - criar 3 postes, adicionar itens pela busca nas três colunas e usar +1;
  - Rede com "32+35+30";
  - conferir o ARO;
  - mudar à mão e voltar ao automático;
  - recarregar a página e ver tudo de volta;
  - Lançar na Enel (copiar e marcar);
  - baixar e conferir as abas;
  - comparar com a Leitura do CAD do `ceara.dxf`;
  - axe e largura em 1366 e 390 px.

## Fica para quem constrói
- Nomes de arquivos e funções.
- Textos curtos da tela, seguindo o rascunho D.
- Como a tela fica no celular. O uso principal é no computador, ao lado do CAD, mas não pode quebrar no celular.
- O formato da tabela de regras do cabo e do ARO na base.
