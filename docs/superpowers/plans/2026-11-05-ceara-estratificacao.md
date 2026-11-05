# Estratificação do material dentro da estrutura (Ceará): plano de construção

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhar.

**Objetivo:** na Leitura do CAD do Ceará, cada estrutura da Adição de estrutura com kit na base pode ser ajustada à mão (tirar, diminuir, aumentar, adicionar código), e o Excel sai com a aba ESTRATIFICAÇÃO e a Adição de material somada.

**Arquitetura:**
- **Regras puras** em `src/ceara/estratificacao.ts`: o kit de uma estrutura, a situação de cada material, a soma na Adição de material, a sugestão do último ajuste e "é a mesma obra?". Sem React, testadas com dados inventados.
- **Excel** (`src/ceara/excel.ts`): recebe os ajustes; sem ajuste, sai idêntico ao de hoje.
- **Banco do navegador** (`src/lib/banco.ts`): versão 3 com a loja `ajustes` para as sugestões.
- **Tela:** componente novo `src/components/ceara/AjusteEstrutura.tsx`, aberto embaixo da linha na tabela da Adição de estrutura (`src/components/ceara/Ceara.tsx`).

**Tecnologia:** Vite 6 + React 19 + TypeScript 5.8, vitest 2, JSZip, `fake-indexeddb` (só nos testes), Playwright + axe no e2e.

**Especificação:** `docs/2026-11-05-ceara-estratificacao-design.md`. Leia junto com este plano; a tabela de situações e as colunas do Excel estão lá.

## Regras gerais
- Repositório público: nada de código, descrição ou kit real da Enel, OT real, e-mail ou nome de colega em arquivo versionado. Testes com códigos inventados (ex.: `900001`, `KITX1`). Arquivos reais só em `e2e/dados` e `../bases` (fora do git).
- Todo texto da tela em português, no tom do site, sem travessão (—). Cor sempre com a palavra do lado.
- Não mexer em: base da Enel guardada, abas Adição de estrutura, Devolução de estrutura e Devolução de material, colunas da Adição de material.
- Obra sem ajuste: o Excel sai com 4 abas e o XML de cada aba igual ao de hoje.
- Quantidades com 3 casas: `arred = (n: number) => Math.round(n * 1000) / 1000` em toda conta (2,45 − 1,23 = 1,22, sem 1,2200000000000002).
- Nada é aplicado sem clique; a sugestão fica só no IndexedDB de quem fez.
- Sem push. Commit no ramo `supabase`, um por tarefa.
- Processo do projeto: um agente por tarefa e um revisor antes da próxima. No fim, `npm test`, `npm run lint`, `npm run build`, `node scripts/conferir-dist.mjs` e `E2E_SO=ceara node e2e/fluxo.mjs`.

## Foco da revisão
Casos que a especificação implica e que mais podem pegar quem usa. Cada um tem teste na tarefa dona do código.
1. **Kit com o mesmo material repetido** (duas linhas do mesmo código no kit da base): vira uma linha só, com a soma. Teste na Tarefa 1.
2. **Usar 0 pelo "−"** num item do kit é o mesmo que desmarcar ("não usado"); um item novo que chega a 0 some do ajuste. Teste na Tarefa 1.
3. **Digitar à mão um código que já existe:** se está no kit, não entra como novo (vai para a linha do kit); se está no catálogo, entra como item do catálogo, sem o aviso "fora do catálogo". Teste na Tarefa 1.
4. **Sugestão com código que saiu da base** (base nova): o código é ignorado e o resto do ajuste é aplicado, com aviso. Teste na Tarefa 1.
5. **Material a mais que também veio do CAD com o mesmo código:** uma linha só na Adição de material (4 + 4 = 8), e o bloco mostra 4 do CAD e 4 da estratificação. Teste na Tarefa 2.

---

### Tarefa 1: regras da estratificação

**Arquivos:**
- Criar: `src/ceara/estratificacao.ts`
- Teste: `src/ceara/estratificacao.test.ts`

**Interfaces:**
- Usa: `BaseEnel` e `Linha` de `src/ceara/contagem.ts` (`base.kits[chave]` é `[codigo, qtd][]`; `base.materiais[codigo]` é `[descricao, unidade]`).
- Produz (exportado, usado nas Tarefas 2 a 4):

```ts
export type Unidade = 'UN' | 'M' | 'KG'
export interface MaterialNovo {
  codigo: string
  qtd: number // por estrutura
  /** Só para o digitado à mão fora do catálogo E4E. */
  foraDoCatalogo?: { descricao: string; unidade: Unidade }
}
/** Ajuste de uma estrutura: só o que difere do kit. qtd 0 = não usado. */
export interface Ajuste {
  qtd: Record<string, number>
  novos: MaterialNovo[]
}
/** Chave: código da estrutura sem _S (a mesma chave de base.kits). */
export type Ajustes = Record<string, Ajuste>

export type Situacao = 'igual' | 'nao-usado' | 'diminuiu' | 'a-mais' | 'novo'
export interface ItemKit { codigo: string; descricao: string; unidade: string; qtd: number }
export interface LinhaEstrat {
  codigo: string
  descricao: string
  unidade: string
  noKit: number     // por estrutura (0 para novo)
  usado: number     // por estrutura
  retirada: number  // por estrutura
  fica: number      // por estrutura
  aMais: number     // por estrutura, vai em Adição de material (a mais ou novo)
  situacao: Situacao
  foraDoCatalogo: boolean
}

export const arred: (n: number) => number
export function chaveKit(codigoLinha: string): string           // 'TR15CAA4_S' → 'TR15CAA4'; sem _S no fim, igual
export function kitDe(base: BaseEnel, chave: string): ItemKit[] | null // null sem kit; códigos repetidos somados, na ordem da 1ª vez
export function limpar(ajuste: Ajuste, kit: ItemKit[]): Ajuste | undefined
export function linhasDoKit(base: BaseEnel, chave: string, ajuste: Ajuste | undefined): LinhaEstrat[]
export function adicionarNovo(ajuste: Ajuste | undefined, kit: ItemKit[], base: BaseEnel, novo: MaterialNovo): { ajuste: Ajuste | undefined; noKit: boolean }
export function aplicarSugestao(sugerido: Ajuste, base: BaseEnel, chave: string): { ajuste: Ajuste | undefined; ignorados: string[] }
export function mesmaObra(nomeAnterior: string, nomeNovo: string): boolean
export function ajustesValidos(ajustes: Ajustes, adicaoEstrutura: Linha[]): Ajustes
```

Regras que os testes fixam:
- `linhasDoKit`: primeiro os itens do kit na ordem do kit, depois os novos na ordem em que entraram. Situação e quantidades conforme a tabela da especificação (`igual`, `nao-usado` com usado 0, `diminuiu`, `a-mais`, `novo`). Descrição e unidade do novo vêm de `base.materiais`, ou de `foraDoCatalogo`.
- `limpar`: tira de `qtd` o que é igual ao kit e o que não é código do kit; tira novos com `qtd <= 0`; sem nada, `undefined`.
- `adicionarNovo`: código do kit → não entra como novo, devolve `noKit: true` e o ajuste sem mudança (a tela leva até a linha do kit). Código que já está nos novos → soma `novo.qtd`. Código digitado à mão que existe em `base.materiais` → entra sem `foraDoCatalogo`.
- `aplicarSugestao`: ignora em `qtd` o código que não está mais no kit, e nos novos o código que não está em `base.materiais` (a não ser que tenha `foraDoCatalogo`). Devolve os ignorados.
- `mesmaObra`: OT de `otDoNome` (de `src/ceara/excel.ts`) no nome novo → mesma obra só se a OT do nome anterior for igual; sem OT no nome novo → só se os nomes forem iguais. Nome anterior vazio → `false`.
- `ajustesValidos`: fica só com as chaves que aparecem em `adicaoEstrutura` (por `chaveKit(l.codigo)`).

- [ ] **Passo 1: escrever os testes** em `src/ceara/estratificacao.test.ts`, com uma base inventada:

```ts
const BASE: BaseEnel = {
  materiais: {
    '900001': ['CABO TESTE', 'M'], '900002': ['CONECTOR TESTE', 'UN'], '900003': ['ELO TESTE A', 'UN'],
    '900004': ['ELO TESTE B', 'UN'], '900005': ['CHAVE TESTE', 'UN'],
  },
  estruturas: { KITX1: 'ESTRUTURA TESTE', 'N3.1KIT': 'DERIV TESTE' },
  kits: {
    KITX1: [['900001', 2.45], ['900002', 4], ['900003', 1], ['900005', 1]],
    'N3.1KIT': [['900002', 2], ['900002', 1]],
  },
}
```

Testes (nome → o que afirma):
- `chaveKit tira só o _S do fim` → `chaveKit('KITX1_S')` é `'KITX1'`; `chaveKit('N3.1KIT_S')` é `'N3.1KIT'`; `chaveKit('KITX1')` é `'KITX1'`.
- `kit repetido vira uma linha` → `kitDe(BASE, 'N3.1KIT')` é `[{ codigo: '900002', descricao: 'CONECTOR TESTE', unidade: 'UN', qtd: 3 }]`; `kitDe(BASE, 'NAOTEM')` é `null`.
- `as cinco situações` → com `{ qtd: { '900001': 1.23, '900002': 8, '900003': 0 }, novos: [{ codigo: '900004', qtd: 1 }] }`, `linhasDoKit` dá, por código:
  - `900001`: diminuiu, retirada `1.22`, fica `1.23`, aMais 0;
  - `900002`: a-mais, retirada 0, fica 4, aMais 4;
  - `900003`: nao-usado, retirada 1, fica 0;
  - `900005`: igual, retirada 0, fica 1;
  - `900004`: novo, noKit 0, retirada 0, fica 0, aMais 1, descrição `'ELO TESTE B'`.
- `sem ajuste é tudo igual` → `linhasDoKit(BASE, 'KITX1', undefined).every((l) => l.situacao === 'igual')`.
- `usar 0 é não usado e novo em 0 some` → `limpar({ qtd: { '900002': 0 }, novos: [{ codigo: '900004', qtd: 0 }] }, kit)` é `{ qtd: { '900002': 0 }, novos: [] }`; e `limpar({ qtd: { '900001': 2.45 }, novos: [] }, kit)` é `undefined`.
- `adicionar código do kit leva à linha do kit` → `adicionarNovo(undefined, kit, BASE, { codigo: '900002', qtd: 1 })` é `{ ajuste: undefined, noKit: true }`.
- `adicionar de novo soma` → duas vezes `{ codigo: '900004', qtd: 1 }` dá `novos: [{ codigo: '900004', qtd: 2 }]`.
- `digitado à mão que existe no catálogo entra como do catálogo` → `adicionarNovo(undefined, kit, BASE, { codigo: '900004', qtd: 1, foraDoCatalogo: { descricao: 'X', unidade: 'UN' } })` dá novo sem `foraDoCatalogo`.
- `digitado à mão fora do catálogo` → com `{ codigo: '999999', qtd: 1, foraDoCatalogo: { descricao: 'MATERIAL DE TESTE', unidade: 'KG' } }`, `linhasDoKit` traz a linha novo com `foraDoCatalogo: true`, descrição `'MATERIAL DE TESTE'` e unidade `'KG'`.
- `sugestão ignora código que saiu da base` → `aplicarSugestao({ qtd: { '900001': 1, '800000': 0 }, novos: [{ codigo: '800001', qtd: 1 }, { codigo: '999999', qtd: 1, foraDoCatalogo: { descricao: 'M', unidade: 'UN' } }] }, BASE, 'KITX1')` dá `ignorados: ['800000', '800001']` e o ajuste com `900001` e o `999999`.
- `mesma obra pela OT` → `mesmaObra('8000001_ASBUILT a.dxf', '8000001_ASBUILT b.dxf')` true; `mesmaObra('8000001_a.dxf', '8000002_a.dxf')` false; `mesmaObra('obra.dxf', 'obra.dxf')` true; `mesmaObra('obra.dxf', 'outra.dxf')` false; `mesmaObra('', 'obra.dxf')` false.
- `trocar o DXF descarta estrutura que sumiu` → `ajustesValidos({ KITX1: a, SUMIU: a }, [{ codigo: 'KITX1_S', descricao: '', quantidade: 1, origem: [] }])` só tem `KITX1`.

- [ ] **Passo 2: rodar e ver falhar:** `npx vitest run src/ceara/estratificacao.test.ts` → FALHA (módulo não existe).
- [ ] **Passo 3: escrever `src/ceara/estratificacao.ts`** com as assinaturas acima. Toda conta passa por `arred`.
- [ ] **Passo 4: rodar e ver passar:** `npx vitest run src/ceara/estratificacao.test.ts` → PASSA. `npx tsc -b` sem erro.
- [ ] **Passo 5: commit**

```bash
git add src/ceara/estratificacao.ts src/ceara/estratificacao.test.ts
git commit -m "Ceará: regras da estratificação do material dentro da estrutura"
```

---

### Tarefa 2: Excel com a aba ESTRATIFICAÇÃO e a Adição de material somada

**Arquivos:**
- Modificar: `src/ceara/estratificacao.ts` (soma na Adição de material)
- Modificar: `src/ceara/excel.ts` (`gerarExcelCeara`, aba nova)
- Teste: `src/ceara/estratificacao.test.ts` e `src/ceara/ceara.test.ts` (describe "Excel da contagem")

**Interfaces:**
- Usa: tudo da Tarefa 1.
- Produz:

```ts
// estratificacao.ts
export interface Somado {
  codigo: string
  descricao: string
  unidade: string
  doCad: number
  daEstratificacao: number // Σ aMais × qtd da estrutura na obra
  total: number
  estruturas: string       // "KITX1_S (1), N3.1KIT_S (21)", na ordem da Adição de estrutura
  foraDoCatalogo: boolean
}
export function somarNaAdicao(r: ResultadoCeara, base: BaseEnel, ajustes: Ajustes): { adicaoMaterial: Linha[]; somados: Somado[] }

// excel.ts (terceiro parâmetro novo, opcional)
export async function gerarExcelCeara(r: ResultadoCeara, cab: Cabecalho, estrat?: { base: BaseEnel; ajustes: Ajustes }): Promise<Uint8Array>
```

Regras:
- `somarNaAdicao`: parte de `r.adicaoMaterial` sem mudar a ordem; código que já está (e não é `semCodigo`) soma na mesma linha e ganha `origem` "estratificação"; código novo entra no fim, na ordem da Adição de estrutura e, dentro dela, na ordem de `linhasDoKit`. Linha de material fora do catálogo entra com `foraDaBase: true` (sai vermelha no Excel, com o código na célula). Só entra o que tem `aMais > 0`.
- Excel com `estrat` e pelo menos uma chave em `ajustes` que está na obra: 5 abas, a 5ª chamada `ESTRATIFICAÇÃO`; a Adição de material usa `somarNaAdicao(...).adicaoMaterial`. Sem isso, o mesmo arquivo de hoje.
- Aba `ESTRATIFICAÇÃO`:
  - linha 1, cabeçalho (estilo `S_CABECALHO`): `ESTRUTURA | QTD DE ESTRUTURAS NA OBRA | CÓDIGO | DESCRIÇÃO | UNIDADE | QTD NO KIT | QTD RETIRADA | FICA NA ESTRUTURA | SITUAÇÃO`;
  - depois, para cada estrutura ajustada (na ordem da Adição de estrutura), todas as `linhasDoKit`; ESTRUTURA é o código da linha da Adição de estrutura (com `_S`), igual à aba Adição de estrutura; código numérico como número (`numeroOuTexto`); SITUAÇÃO em palavra: `igual`, `não usado`, `diminuiu`, `a mais`, `novo`; linha fora do catálogo vermelha;
  - uma linha em branco, depois a linha `SOMADO EM ADIÇÃO DE MATERIAL` (estilo cabeçalho, só na coluna A), depois o cabeçalho `CÓDIGO | DESCRIÇÃO | UNIDADE | DO CAD | DA ESTRATIFICAÇÃO | TOTAL NA ADIÇÃO DE MATERIAL | DE QUAIS ESTRUTURAS` e uma linha por `Somado`;
  - painel congelado na linha 1, sem `autoFilter` (dois blocos), impressão deitada como as outras; sem entrada nova em `definedNames`.
- Mantém os estilos que já existem (`S_CENTRO`, `S_ESQUERDA`, versões listrada e vermelha). Não cria estilo novo.

- [ ] **Passo 1: escrever os testes de `somarNaAdicao`** em `src/ceara/estratificacao.test.ts` (base da Tarefa 1; `r` montado à mão com `adicaoEstrutura: [{ codigo: 'KITX1_S', quantidade: 2, ... }]` e `adicaoMaterial: [{ codigo: '900002', quantidade: 4, ... }]`):
  - `4 do CAD + a mais vira uma linha só` → com `{ KITX1: { qtd: { '900002': 6 }, novos: [] } }` (a mais 2 × 2 estruturas): `adicaoMaterial` tem uma linha `900002` com `quantidade: 8`; `somados` é `[{ codigo: '900002', doCad: 4, daEstratificacao: 4, total: 8, estruturas: 'KITX1_S (2)', ... }]`.
  - `código novo entra no fim` → com um novo `900004` qtd 1: última linha `900004`, quantidade 2, `doCad: 0`.
  - `fora do catálogo sai vermelho` → novo `999999` com `foraDoCatalogo`: a linha tem `foraDaBase: true` e o `Somado` tem `foraDoCatalogo: true`.
  - `diminuir e tirar não vão para a Adição de material` → com `{ qtd: { '900001': 1.23, '900003': 0 } }`: `adicaoMaterial` igual a `r.adicaoMaterial` e `somados` vazio.
- [ ] **Passo 2: escrever os testes do Excel** em `src/ceara/ceara.test.ts`, describe "Excel da contagem" (usar uma `BaseEnel` inventada nesse arquivo, `CATALOGO` + `kits`):
  - `sem ajuste, o mesmo Excel de hoje` → `gerarExcelCeara(r, cab)` e `gerarExcelCeara(r, cab, { base, ajustes: {} })`: os dois com 4 abas e o texto de `xl/worksheets/sheet1.xml` a `sheet4.xml` e `xl/workbook.xml` iguais (ler com JSZip).
  - `com ajuste, a 5ª aba` → nomes `['ADIÇÃO ESTRUTURA', 'DEVOLUÇÃO ESTRUTURA', 'ADIÇÃO MATÉRIAL', 'DEVOLUÇÃO MATÉRIAL', 'ESTRATIFICAÇÃO']`; na ESTRATIFICAÇÃO, `A1` `'ESTRUTURA'`, `I1` `'SITUAÇÃO'`; a linha do cabo diminuído tem `G` = `1.22`, `H` = `1.23`, `I` = `'diminuiu'`; acha a célula `'SOMADO EM ADIÇÃO DE MATERIAL'` na coluna A e, duas linhas abaixo, `D`/`E`/`F` = do CAD / da estratificação / total.
  - `Adição de material somada e lida de volta` → `lerOrcamento(bytes).adicaoMaterial.get('900002').quantidade` é o total somado; as abas de estrutura e a Devolução de material lidas de volta iguais às de `r`.
- [ ] **Passo 3: rodar e ver falhar:** `npx vitest run src/ceara` → FALHA (`somarNaAdicao` não existe; Excel com 4 abas).
- [ ] **Passo 4: escrever `somarNaAdicao`** e mudar `gerarExcelCeara` (as listas de folhas, `[Content_Types].xml`, `workbook.xml` e `workbook.xml.rels` passam a contar 4 ou 5 folhas; a aba nova numa função própria `abaEstratificacao(...)`).
- [ ] **Passo 5: rodar e ver passar:** `npx vitest run src/ceara` → PASSA, incluindo o teste antigo "4 abas no modelo da Enel".
- [ ] **Passo 6: conferir no Excel de verdade:** gerar um arquivo de teste com um script no scratchpad (base inventada) e abrir no Excel do PC: abre sem aviso de reparo, a aba ESTRATIFICAÇÃO legível, vermelho na linha fora do catálogo.
- [ ] **Passo 7: commit**

```bash
git add src/ceara/estratificacao.ts src/ceara/estratificacao.test.ts src/ceara/excel.ts src/ceara/ceara.test.ts
git commit -m "Ceará: aba ESTRATIFICAÇÃO e material a mais somado na Adição de material"
```

---

### Tarefa 3: sugestão do último ajuste no banco do navegador

**Arquivos:**
- Modificar: `src/lib/banco.ts`
- Modificar: `src/ceara/estratificacao.ts` (o que gravar ao baixar)
- Teste: `src/lib/banco.test.ts`, `src/ceara/estratificacao.test.ts`

**Interfaces:**
- Usa: `Ajuste`, `Ajustes` da Tarefa 1.
- Produz:

```ts
// banco.ts
export const LOJA_AJUSTES = 'ajustes'
export interface SugestaoGuardada { estrutura: string; ajuste: Ajuste; data: string } // estrutura = chave sem _S; data ISO
export async function lerSugestoes(): Promise<Record<string, SugestaoGuardada>> // sem IndexedDB: {}
export async function gravarSugestoes(gravar: SugestaoGuardada[], apagar: string[]): Promise<void> // uma transação; sem IndexedDB: não faz nada

// estratificacao.ts
export function sugestoesAoBaixar(ajustes: Ajustes, tocadas: ReadonlySet<string>, data: Date): { gravar: SugestaoGuardada[]; apagar: string[] }
```

Regras:
- `VERSAO` passa de 2 para 3; `onupgradeneeded` cria `ajustes` (`keyPath: 'estrutura'`) sem mexer em `tecnicos` e `bases`. Atualizar o comentário do topo.
- `sugestoesAoBaixar`: grava toda chave de `ajustes`; apaga toda chave de `tocadas` que não está em `ajustes` (voltou ao kit puro nesta obra). Estrutura que a pessoa não tocou não apaga a sugestão dela.
- `estratificacao.ts` importa só o tipo `SugestaoGuardada` (`import type`), para as regras continuarem sem IndexedDB.

- [ ] **Passo 1: escrever os testes**
  - em `src/lib/banco.test.ts`, mudar o teste da migração para esperar `db.version` 3 e acrescentar:
    - `migra da versão 2 sem perder técnicos e bases` (abrir a versão 2 com `tecnicos` e `bases`, gravar um de cada, abrir com `abrirBanco` e ler os dois de volta; `lerSugestoes()` é `{}`);
    - `grava, lê e apaga sugestões` (grava `KITX1` e `KITX2`, depois `gravarSugestoes([], ['KITX1'])`: sobra só `KITX2`, com o ajuste igual ao gravado);
    - no teste "sem IndexedDB", `lerSugestoes()` é `{}` e `gravarSugestoes` não lança erro.
  - em `src/ceara/estratificacao.test.ts`: `ao baixar, grava os ajustados e apaga os que voltaram ao kit` → `sugestoesAoBaixar({ KITX1: a }, new Set(['KITX1', 'KITX2']), new Date('2026-11-05T12:00:00Z'))` é `{ gravar: [{ estrutura: 'KITX1', ajuste: a, data: '2026-11-05T12:00:00.000Z' }], apagar: ['KITX2'] }`.
- [ ] **Passo 2: rodar e ver falhar:** `npx vitest run src/lib/banco.test.ts src/ceara/estratificacao.test.ts` → FALHA.
- [ ] **Passo 3: escrever** as funções no padrão de `lerBase`/`gravarBase` (`comBanco`, `try/catch` que engole a falta de IndexedDB).
- [ ] **Passo 4: rodar e ver passar:** `npm test` → PASSA (todos, não só estes).
- [ ] **Passo 5: commit**

```bash
git add src/lib/banco.ts src/lib/banco.test.ts src/ceara/estratificacao.ts src/ceara/estratificacao.test.ts
git commit -m "Banco do navegador versão 3: sugestão do último ajuste por estrutura"
```

---

### Tarefa 4: tela do ajuste na Leitura do CAD e e2e

**Arquivos:**
- Criar: `src/components/ceara/AjusteEstrutura.tsx`
- Modificar: `src/components/ceara/Ceara.tsx`
- Modificar: `e2e/fluxo.mjs` (função `ceara()`)

**Interfaces:**
- Usa: Tarefas 1 a 3; `Quantidade`, `Botao`, `Campo`, `Selo` de `src/components/ui.tsx`; `normalizar`, `casa`, `formatarQtd` de `src/lib/busca.ts`; `ehQuilo` de `src/state.ts`.
- Produz:

```ts
export function AjusteEstrutura(props: {
  linha: Linha            // a linha da Adição de estrutura (código com _S, quantidade, origem = postes)
  base: BaseEnel
  ajuste: Ajuste | undefined
  onChange: (a: Ajuste | undefined) => void // sempre já passado por limpar()
}): JSX.Element
```

**O componente (seguir o rascunho `AUTOMACAO KIT MATERIAL\rascunhos-plataforma\e-ceara-estratificar.html` e o `AjusteMateriais` da EDP):**
- Cabeçalho: código, descrição (`base.estruturas`), "N na obra: P1, P4..." (de `linha.origem`) e "Quantidades por estrutura".
- Uma linha por `linhasDoKit`:
  - caixa **Entra** com `aria-label` `Entra: <descrição>` (desmarcar põe 0; marcar volta à qtd do kit);
  - qtd no kit;
  - `Quantidade` com `rotulo` `Quantidade usada de <descrição> por estrutura`, `emQuilo={ehQuilo(unidade)}`, `passo={1}`;
  - texto da situação em palavra: "não usado", "diminuiu: retira X da estrutura", "a mais: estrutura fica igual, +X em Adição de material", "novo: vai em Adição de material" (e "fora do catálogo: conferir" quando for o caso); item novo tem o botão `Tirar <descrição>`.
- Resumo "O que mudou em relação ao kit", em dois grupos: **Sai da estrutura** (não usado, diminuiu) e **Vai em Adição de material** (a mais, novo). Sem mudança, o resumo não aparece.
- Busca com `Campo` rotulado `Adicionar material do almoxarifado`: a partir de 2 letras, até 20 resultados de `base.materiais` (texto `código descrição` normalizado uma vez, com `useMemo`); cada resultado é um botão `Adicionar <código> <descrição>`. Código do kit (`noKit: true`): rola até a linha do kit e põe o foco na quantidade dela.
- Botão `Não achei no catálogo: digitar à mão` abre `Código`, `Descrição` e `Unidade` (`select` UN, M, KG) e o botão `Adicionar`; código e descrição obrigatórios.
- `Voltar ao kit original` (só com ajuste) chama `onChange(undefined)`.
- Celular: a lista não alarga a página; a tabela pode rolar de lado dentro do painel.

**Em `Ceara.tsx`:**
- Estado novo: `ajustes: Ajustes`, `aberta: string | null` (chave da estrutura aberta; renomear o `aberta` atual do menu para `ferramenta`), `tocadas: Set<string>`, `sugestoes: Record<string, SugestaoGuardada>` (lidas com `lerSugestoes()` num `useEffect` ao montar), `recusadas: Set<string>`, `avisoSugestao: string`.
- `abrirDxf`: depois de contar, se `mesmaObra(nomeDxf, f.name)` → `setAjustes(a => ajustesValidos(a, r.adicaoEstrutura))`; senão zera `ajustes`, `tocadas`, `recusadas` e fecha o ajuste aberto.
- `TabelaBloco` da Adição de estrutura (só esse bloco) recebe por props o que precisa; cada linha com `kitDe(base, chaveKit(l.codigo))` e sem `foraDaBase` ganha o botão `Ajustar material` (`aria-expanded`, `aria-controls`); linha ajustada mostra `Selo` "estratificada"; o `AjusteEstrutura` abre numa `<tr>` logo abaixo, com `<td colSpan>` do número de colunas.
- Sugestão: linha com `sugestoes[chave]`, sem ajuste, fora de `tocadas` e de `recusadas` mostra "Na última obra você ajustou esta estrutura" com `Usar o mesmo ajuste` (aplica `aplicarSugestao`, marca em `tocadas`; ignorados → `avisoSugestao` "Não existe mais na base: <códigos>. O resto do ajuste foi usado.") e `Não` (põe em `recusadas`).
- Toda mudança vinda do `AjusteEstrutura` marca a chave em `tocadas`.
- `baixar`: `gerarExcelCeara(resultado, cab, { base, ajustes })`; depois `sugestoesAoBaixar(...)` → `gravarSugestoes(...)` e atualiza `sugestoes` em memória.
- Painel "Excel da obra": com ajuste, o texto diz "5 abas: ... e a ESTRATIFICAÇÃO. O material a mais e os códigos novos somam na Adição de material." O contador de linhas vermelhas conta também os materiais fora do catálogo.

**No e2e (`ceara()`, nas duas larguras, antes de "Baixar Excel"):**
- na região da Adição de estrutura, clicar o primeiro `Ajustar material`;
- desmarcar a primeira caixa `Entra:`; clicar `Aumentar` na segunda quantidade;
- buscar `conector` e clicar o primeiro `Adicionar`;
- `Não achei no catálogo: digitar à mão` com `999999`, `MATERIAL DE TESTE`, `UN`, `Adicionar`;
- conferir o selo "estratificada" e o axe com o ajuste aberto (`${tag} ajuste`), print `12-ceara-ajuste.png`;
- baixar e ler o arquivo com JSZip: `xl/workbook.xml` tem a aba `ESTRATIFICAÇÃO`; a aba Adição de material (`sheet3.xml`) tem a célula do `999999` com `s="4"` (vermelho centralizado: `S_CENTRO + S_VERMELHO` de `excel.ts`);
- só a 1366: clicar `← Regiões`, abrir o Ceará de novo pelo painel, carregar o mesmo DXF, esperar "Na última obra você ajustou esta estrutura", clicar `Usar o mesmo ajuste` e conferir o selo "estratificada";
- o teste de largura (`scrollWidth`) já existente também vale com o ajuste aberto (medir antes de fechar).

- [ ] **Passo 1: escrever o e2e** acima em `e2e/fluxo.mjs`.
- [ ] **Passo 2: rodar e ver falhar:** `npm run build && E2E_SO=ceara node e2e/fluxo.mjs` → falha em "Ajustar material".
- [ ] **Passo 3: escrever `AjusteEstrutura.tsx`** e as mudanças em `Ceara.tsx`.
- [ ] **Passo 4: rodar e ver passar:** `npx tsc -b`, `npm run lint`, `npm test`, `npm run build && E2E_SO=ceara node e2e/fluxo.mjs` → "Tudo passou.", zero violações do axe, sem página mais larga que a tela.
- [ ] **Passo 5: olhar os prints** `e2e/prints/1366-dark-12-ceara-ajuste.png` e `390-dark-12-ceara-ajuste.png` contra o rascunho: nada cortado, palavras ao lado das cores.
- [ ] **Passo 6: commit**

```bash
git add src/components/ceara/AjusteEstrutura.tsx src/components/ceara/Ceara.tsx e2e/fluxo.mjs
git commit -m "Ceará: ajustar o material de cada estrutura na Leitura do CAD"
```

---

### Tarefa 5: conferência final e mostrar ao Italo

**Arquivos:** nenhum novo (só correções que a revisão pedir).

- [ ] **Passo 1: rodar tudo:** `npm test`, `npm run lint`, `npm run build`, `node scripts/conferir-dist.mjs` ("dist limpo"), `npm run e2e` (o fluxo inteiro, não só o Ceará) → "Tudo passou."
- [ ] **Passo 2: revisão do ramo inteiro** por um agente que não construiu, com a especificação e este plano, olhando em especial o "Foco da revisão" e "Não pode acontecer" da especificação.
- [ ] **Passo 3: conferir que nada real entrou no git:** `git diff 2b45d81 --stat` e procurar no diff códigos de 6 dígitos que não sejam os inventados (`9000xx`, `999999`, `800000`, `800001`).
- [ ] **Passo 4: deixar em localhost:4400** (`npm run build`; `node servir.mjs` já serve o `dist`) e mostrar ao Italo, com prints a 1366 e 390 px e um Excel de exemplo da obra de teste.
- [ ] **Passo 5: atualizar a memória** (`fechamento-plataforma-ideias.md`) e a passagem, se a conversa ficar grande.
