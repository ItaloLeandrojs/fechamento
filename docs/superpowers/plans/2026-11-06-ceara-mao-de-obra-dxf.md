# Mão de obra pelo DXF (Ceará): plano de construção

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhar.

**Objetivo:** depois de ler o DXF, a Leitura do CAD do Ceará mostra um bloco "Mão de obra" (Instalação e Retirada) contado pelo desenho, com o número de 10 dígitos e a voz com o sufixo A/B, pergunta o que o desenho não diz, guarda as respostas por OT e põe as abas MÃO DE OBRA ADIÇÃO e MÃO DE OBRA DEVOLUÇÃO no Excel.

**Arquitetura:**
- **Lista de vozes:** terceira base no Supabase (`mao-de-obra`), subida por `scripts/atualizar_base.py` a partir da planilha de precificação, com a tabela de regras (papel → voz, regras do cabo, expressões do tensionar) dentro. Opcional no site.
- **Regras puras** (sem React, testadas com vozes inventadas): `src/ceara/maoDeObra.ts` (tipos da base, cidades e sufixo, linhas finais, respostas, busca) e `src/ceara/contagemMO.ts` (o que o desenho dá: postes, cruzetas, armação, trafo, cabo, tensionar, perguntas). A linha viva é lida em `src/ceara/contagem.ts`.
- O site trabalha com **papéis** (`'poste-mt'`, `'tensionar'`...); a voz real vem da base. Nenhuma voz real no código.
- **Respostas por OT** no IndexedDB (`src/lib/banco.ts`, versão 3 → 4).
- **Tela:** `src/components/ceara/useMaoDeObra.ts` (estado, gravação) e `src/components/ceara/MaoDeObra.tsx` (o bloco), separados da tela de hoje para irem depois ao visual Vidro e foto.
- **Excel:** `gerarExcelCeara` ganha as duas abas quando recebe as linhas.

**Tecnologia:** Vite 6 + React 19 + TypeScript 5.8 + Tailwind 4, vitest 2, JSZip, `fake-indexeddb` (testes), Python 3 + openpyxl (script), Playwright + axe no e2e.

**Especificação:** `docs/2026-11-06-ceara-mao-de-obra-dxf-design.md` (autoridade). Rascunho de referência: `AUTOMACAO KIT MATERIAL\rascunhos-plataforma\g-ceara-mao-de-obra.html` (fora do repositório; a especificação vale sobre ele).

## Regras gerais
- **Repositório público:** nenhuma voz real (ex.: o prefixo de 3 letras + 3 números do contrato), número de 10 dígitos, descrição de serviço, OT real, nome de colega ou chave em arquivo versionado: código, testes, e2e, este plano, comentários, mensagens de commit. Testes com vozes inventadas (`XX110`, `XX212`) e números inventados (`9000000001`). O e2e e a conferência leem o que precisam de `../bases/*.json` (fora do git) na hora, sem escrever nenhum valor.
- As vozes reais de cada papel estão na memória do projeto `fechamento-ceara-mao-de-obra.md`; só entram em `../bases/regras-mao-de-obra.json` (fora do git).
- Textos da tela em português, no tom do site, **sem travessão (—)**. Toda cor tem a palavra do lado ("falta responder", "mudado à mão", "confira", "automático", "somada à mão").
- Página nunca mais larga que a tela (390 px); zero violação do axe.
- **Quem não tem a lista de vozes não vê mudança:** a Leitura do CAD conta, compara e baixa o Excel igual a hoje (mesmos bytes de cada parte do .xlsx); o bloco só mostra um aviso.
- IndexedDB 3 → 4 sem perder `tecnicos`, `bases` e `ajustes`.
- Quantidades: `arred` de `src/ceara/estratificacao.ts`; na tela, `formatarQtd` (vírgula).
- OT válida: a regra de hoje em `Ceara.tsx` (`/^\d{7}$|^\d{11}$/`). Sem OT válida, o bloco funciona mas avisa que não está guardando.
- Busca: `normalizar`/`casa` de `src/lib/busca.ts`, a partir de 2 letras, até 20 resultados.
- Sem push. Um commit por tarefa no ramo `supabase`.
- Processo: um agente por tarefa e um revisor antes da próxima. No fim: `npm test`, `npm run lint`, `npm run build`, `node scripts/conferir-dist.mjs`, `npm run e2e`.

## Foco da revisão
Casos que a especificação implica e que mais podem pegar quem usa. Cada um tem teste na tarefa dona do código.
1. **Texto "LINHA VIVA" da legenda, das notas ou solto longe da etiqueta** (o bt-1-poste tem um vermelho solto): não marca poste nenhum. Só o texto exato logo em cima da etiqueta, alinhado. Teste na Tarefa 3 e na conferência (Tarefa 10: nenhuma das 4 obras tem linha viva).
2. **Ler outro DXF da mesma OT** (desenho corrigido): as respostas que ainda cabem ficam; a de um poste ou cabo que sumiu é descartada e a pergunta volta; a mudança à mão de uma voz que sumiu some. Teste em `limparRespostas` (Tarefa 6) e no e2e (Tarefa 9).
3. **Fechar a página logo depois de responder** (dentro do atraso da gravação): não perde. Gravação imediata no `pagehide` e ao sair da tela. Teste no e2e (Tarefa 9, recarregar logo depois de responder).
4. **Trocar a cidade (A ↔ B) ou a área depois de mudar à mão:** o número e o sufixo trocam, a mudança fica (a chave da linha usa a voz sem sufixo). Teste em `montarLinhas` (Tarefa 6).
5. **Voz de um papel que não existe na lista para aquela letra:** a linha aparece em vermelho, "voz fora da lista", e sai vermelha no Excel; nunca some calada. Teste em `montarLinhas` (Tarefa 6) e no Excel (Tarefa 8).

---

### Tarefa 1: lista de vozes no site (base opcional)

**Arquivos:**
- Criar: `src/ceara/maoDeObra.ts` (só os tipos e a lista de papéis nesta tarefa)
- Modificar: `src/lib/banco.ts` (só `NomeBase`), `src/nuvem/bases.ts`, `src/nuvem/supabase.ts`, `supabase/esquema.sql`, `e2e/supabase-falso.mjs`, `e2e/fluxo.mjs` (só `simular`), `scripts/conferir-dist.mjs`, `scripts/conferir-supabase.mjs`
- Teste: `src/nuvem/bases.test.ts`

**Interfaces:**
- Produz (usado em todas as tarefas seguintes):

```ts
// src/ceara/maoDeObra.ts
export type Letra = 'A' | 'B'
export type Aba = 'adicao' | 'devolucao'
export const PAPEIS = [
  'poste-mt', 'poste-bt', 'retirada-poste-mt', 'retirada-poste-bt',
  'retirada-poste-lv-passante', 'retirada-poste-lv-encabecamento', 'cava-rocha',
  'cruzeta-nu', 'cruzeta-isolado', 'retirada-cruzeta-passante', 'retirada-cruzeta-encabecamento',
  'lv-instalacao-passante', 'lv-retirada-passante', 'lv-instalacao-encabecamento', 'lv-retirada-encabecamento',
  'armacao-bt', 'retirada-armacao-bt',
  'trafo', 'estrutura-trafo', 'retirada-trafo', 'retirada-estrutura-trafo',
  'caixa', 'conector-4-saidas', 'tensionar', 'operacao-equipamento',
] as const
export type Papel = (typeof PAPEIS)[number]
/** Uma linha da lista de precificação, sem o R$. `voz` sem sufixo (ex. XX110); `variante`: "GRP A -" ou "(TELECONT)". */
export interface VozDaLista { voz: string; letra: Letra; numero: string; descricao: string; unidade: string; variante: boolean }
export interface RegraCabo { grupo: 'mt' | 'bt-nu' | 'bt-multi'; situacao: 'novo' | 'retirado'; voz: string; por: 'metro' | 'condutor'; bitolas?: string[] }
/** MT: `exige` tem uma expressão e vale por estrutura. BT: todas as expressões acham uma estrutura (1) do poste; vale a de maior `qtd` do poste. */
export interface RegraTensionar { rede: 'mt' | 'bt'; exige: string[]; qtd: number }
export interface BaseMaoDeObra { lista: VozDaLista[]; papeis: Record<Papel, string>; regrasCabo: RegraCabo[]; tensionar: RegraTensionar[] }

// src/lib/banco.ts
export type NomeBase = 'enel' | 'edp' | 'mao-de-obra'

// src/nuvem/bases.ts
export function conferirBaseMaoDeObra(x: unknown): BaseMaoDeObra
export interface FonteBases {
  versoes(): Promise<Record<'enel' | 'edp', { versao: string; arquivo: string }> & Partial<Record<'mao-de-obra', { versao: string; arquivo: string }>>>
  baixar(arquivo: string): Promise<Blob>
}
export async function garantirBases(fonte: FonteBases, guarda?: GuardaBases): Promise<{ enel: BaseEnel; edp: Kit[]; maoDeObra: BaseMaoDeObra | null; avisos: string[] }>
```

Regras:
- `conferirBaseMaoDeObra` lança quando: `lista` não é lista ou está vazia; uma voz tem `numero` fora de `/^\d{10}$/`, `letra` fora de A/B ou `voz`/`descricao`/`unidade` que não é texto; falta um dos `PAPEIS` em `papeis` ou o papel aponta para voz que não está na `lista`; regra de cabo com `grupo`, `situacao` ou `por` fora dos valores acima, `voz` fora da lista ou `bitolas` que não é lista de textos; tensionar com `rede` inválida, `exige` vazio, expressão que não compila, rede `mt` com mais de uma expressão, ou `qtd` que não é número > 0.
- `garantirBases`, para `mao-de-obra` (enel e edp como hoje):
  - sem linha no servidor e sem cópia → `null` e o aviso `A lista de mão de obra ainda não está no servidor. Na Leitura do CAD, a mão de obra fica de fora.`;
  - sem linha no servidor e com cópia → a cópia, sem aviso;
  - download ou conferência falhou → a cópia com o aviso `Não deu para atualizar a lista de mão de obra: usando a cópia guardada neste computador.` ou, sem cópia, `null` com o primeiro aviso. **Nunca** lança `PRIMEIRA_VEZ_SEM_INTERNET` por causa dela.
- `fonteSupabase.versoes`: `enel` e `edp` obrigatórias como hoje; `mao-de-obra` só se a linha existir.
- `supabase/esquema.sql`: trecho idempotente que troca o `check` da tabela `bases` para `nome in ('enel', 'edp', 'mao-de-obra')` (`drop constraint if exists` + `add constraint`). Quem roda no Supabase é o Italo (pedir antes).
- `e2e/supabase-falso.mjs`: parâmetro `maoDeObra` (caminho do JSON local); com ele, a tabela `bases` tem a 3ª linha e o balde serve `mao-de-obra.json.gz`. `fluxo.mjs` passa `../bases/mao-de-obra.json` quando o arquivo existe.
- `conferir-dist.mjs`: com `../bases/mao-de-obra.json`, sorteia também 20 `numero` e 20 `descricao` da `lista` (mesma regra de semente e tamanho mínimo de hoje) e confere que não estão no `dist`; sem o arquivo, segue e avisa.
- `conferir-supabase.mjs`: aceita `edp,enel` ou `edp,enel,mao-de-obra`.

- [ ] **Passo 1: escrever os testes** em `src/nuvem/bases.test.ts` (o `montar` ganha a 3ª base opcional; `MO` = lista com `XX110` A `9000000001` e B `9000000002`, `XX212` A e B, `papeis` com todos os `PAPEIS` apontando para `XX110` (e `tensionar` para `XX212`), `regrasCabo: [{ grupo: 'bt-multi', situacao: 'novo', voz: 'XX110', por: 'metro' }]`, `tensionar: [{ rede: 'mt', exige: ['^KT3'], qtd: 1 }]`):
  - `sem lista de mão de obra no servidor, segue sem ela` → `maoDeObra` `null`, `enel`/`edp` normais, aviso com `ainda não está no servidor`.
  - `com lista no servidor, baixa e guarda` → `maoDeObra.lista.length` igual; `guardado.get('mao-de-obra').versao` é a do servidor.
  - `download da lista falhou` → com cópia: a cópia e o aviso `Não deu para atualizar a lista`; sem cópia: `null`, sem lançar.
  - `conferir lista de mão de obra` → recusa `{}`, `numero: '123'`, `letra: 'C'`, papel faltando, papel com `XX999`, regra de cabo com `por: 'km'`, tensionar com `exige: ['(']`, `exige: []`, `{ rede: 'mt', exige: ['^A', '^B'] }` e `qtd: 0`; aceita `MO`.
  - os testes de hoje continuam passando sem mudar o que afirmam.
- [ ] **Passo 2: rodar e ver falhar:** `npx vitest run src/nuvem/bases.test.ts` → FALHA.
- [ ] **Passo 3: escrever** o código e os trechos acima (o tipo `Bases` de `Preparando.tsx` acompanha `garantirBases`).
- [ ] **Passo 4: rodar e ver passar:** `npm test`, `npx tsc -b`, `npm run lint` → sem erro.
- [ ] **Passo 5: commit** `git commit -m "Base opcional da lista de mão de obra do Ceará"`

---

### Tarefa 2: script que sobe a lista de vozes

**Arquivos:**
- Modificar: `scripts/atualizar_base.py`
- Teste: `scripts/test_atualizar_base.py`
- Fora do git (criar, não versionar): `..\bases\regras-mao-de-obra.json`, `..\bases\mao-de-obra.json`

**Interfaces:**
- Comando: `python3 scripts/atualizar_base.py mao-de-obra "<planilha de precificação.xlsx>" --regras ..\bases\regras-mao-de-obra.json [--seco] [--sim]`
- Produz `../bases/mao-de-obra.json` no formato `BaseMaoDeObra` da Tarefa 1 e a linha `mao-de-obra` na tabela `bases` (arquivo `mao-de-obra-<versao>.json.gz`).

```python
def ler_precificacao(caminho) -> list[dict]   # [{voz, letra, numero, descricao, unidade, variante}]
def ler_regras(caminho) -> dict               # {'papeis': {...}, 'regrasCabo': [...], 'tensionar': [...]}
def montar_mao_de_obra(lista, regras) -> dict
def conferir_mao_de_obra(base) -> list[str]   # 'PARA: ...' e avisos, como conferir()
def contagens_mao_de_obra(base) -> dict       # {'vozes': n, 'regras': n}
```

Regras:
- Planilha: aba 1, cabeçalho na linha 1; conferir com `_conferir_cabecalho` usando pedaços sem acento: A `digo`, B `descri`, D `unidade`, G `zona` (o C, com o R$, nunca é lido).
- Cada linha: a descrição começa com `<3 letras><3 números>_<A|B>_`; daí saem `voz` e `letra`. Linha que não começa assim é pulada e contada (o total pulado aparece no resumo). `numero` pelo `_codigo` (10 dígitos). `variante` = o resto da descrição começa com `GRP A` ou `(TELECONT)`.
- Uma entrada por (`voz`, `letra`, `numero`): a planilha repete a mesma por departamento; fica a descrição da linha do departamento SUL quando existir, senão a primeira.
- `conferir_mao_de_obra` para (`PARA:`) com: lista vazia; letra da descrição diferente da zona (Urbana = A, Rural = B); papel ou regra apontando para voz sem entrada **não variante**; papel ou regra apontando para voz com **mais de uma** entrada não variante na mesma letra; os mesmos erros de formato da `conferirBaseMaoDeObra`. Aviso (não para): outras vozes com mais de uma entrada não variante na mesma letra (listar as vozes) e queda de mais de 2% nas contagens.
- `executar('mao-de-obra', ...)` segue o caminho da Enel (grava `../bases/mao-de-obra.json`, `--seco` compara com a cópia local, sobe o arquivo, grava a linha, apaga o antigo). `NOMES_CONTAGEM` ganha `vozes` e `regras`.
- `regras-mao-de-obra.json` (fora do git): o implementador escreve com as vozes da memória `fechamento-ceara-mao-de-obra.md` (seções de 28/10, 05/11 e 06/11), um papel por voz, as regras do cabo e as do tensionar:
  - cabo: instalação `por: 'metro'` (pré-reunido com voz própria; condutor nu, BT e MT, uma voz para as bitolas pequenas e outra para acima de 120 mm²); retirada `por: 'condutor'` (BT nu e pré-reunido numa voz; MT pela bitola);
  - tensionar MT: `^(M|MB|N|NB|B|BB|U|UB)3` qtd 1 e `^(M|MB|N|NB|B|BB|U|UB)4` qtd 2;
  - tensionar BT: `['^S2N$', '^S2C$']` qtd 2; e qtd 1 para cada ancoragem sozinha: `^S2[A-Z]?$`, `^S3[A-Z]?$`, `^S4[A-Z]?$`, `^SPALÇA`.
  - Antes de subir: conferir contra as chaves de `../bases/enel.json` que cada expressão acha as estruturas certas e nenhuma de outro tipo, e **mostrar ao Italo** o arquivo e uma amostra do que cada expressão acha.

- [ ] **Passo 1: escrever os testes** em `scripts/test_atualizar_base.py` com planilhas montadas na hora (vozes `XX110`, `XX212`; números `9000000001`...; descrições inventadas):
  - `test_le_precificacao_uma_por_numero` (a mesma voz em 3 departamentos vira uma; fica a descrição do SUL);
  - `test_variantes_marcadas` (`XX212_A_GRP A - ...` e `XX212_A_(TELECONT) ...` com `variante` True; `XX212_A_TENSIONAR ...` False);
  - `test_linha_sem_prefixo_pulada`;
  - `test_cabecalho_mudou_para` (coluna G sem "zona" → `ErroBase` com a coluna);
  - `test_letra_diferente_da_zona_para`;
  - `test_papel_com_voz_ambigua_para` (duas entradas não variantes de `XX110` na letra A);
  - `test_regra_com_voz_fora_para` e `test_tensionar_expressao_invalida_para`;
  - `test_seco_grava_json_sem_internet` (`--seco` grava `mao-de-obra.json` numa pasta temporária, sem chamar `_chamar`).
- [ ] **Passo 2: rodar e ver falhar:** `python3 -m unittest scripts/test_atualizar_base.py -v` → FALHA.
- [ ] **Passo 3: escrever** as funções e o subcomando.
- [ ] **Passo 4: rodar e ver passar:** `python3 -m unittest scripts/test_atualizar_base.py -v` → PASSA (os de hoje também).
- [ ] **Passo 5: gerar a cópia local:** escrever `..\bases\regras-mao-de-obra.json` e rodar com `--seco` sobre a planilha de `Downloads` (nome na memória). Esperado: contagens e avisos impressos, `..\bases\mao-de-obra.json` gravado, nada enviado. Subir de verdade só depois do OK do Italo e do `check` novo rodado no Supabase.
- [ ] **Passo 6: commit** (só o script e o teste): `git commit -m "Script: lista de mão de obra do Ceará para o Supabase"`

---

### Tarefa 3: linha viva na leitura das etiquetas

**Arquivos:**
- Modificar: `src/ceara/contagem.ts`
- Teste: `src/ceara/ceara.test.ts` (describe novo "linha viva")

**Interfaces:**
- Produz (usado na Tarefa 4):

```ts
export interface Etiqueta { /* campos de hoje */ linhaViva?: true }
```

Regras:
- Vale o texto que, depois de `linhasDoTexto` e sem espaços extras, é **exatamente** `LINHA VIVA` (maiúsculas ou não), sozinho num TEXT ou MTEXT, **logo em cima** de uma etiqueta: alinhado em x como o número solto de `darNumerosSoltos` e a no máximo 6 alturas de letra acima do topo da etiqueta (escolha do plano; ajustar só se a conferência da Tarefa 10 pedir). Cada texto marca uma etiqueta só, a mais perto.
- Também vale `LINHA VIVA` como **primeira linha** do MTEXT da etiqueta: sai das `linhas`/`itens` e marca a etiqueta.
- "ACESSO À LINHA VIVA", "MOTIVO NECESSIDADE MÃO DE OBRA LINHA VIVA" e qualquer texto com mais palavras não valem. Texto `LINHA VIVA` sem etiqueta logo embaixo não marca nada.
- O campo só existe quando é `true` (os resultados de hoje continuam iguais nos testes que comparam `etiquetas`).

- [ ] **Passo 1: escrever os testes** (com `mtextEm`):
  - `LINHA VIVA em cima marca o poste` → `mtextEm('LINHA VIVA', 100, 506)` + `mtextEm('(1)600/12 M1\\P1', 100, 500)`: a etiqueta do P1 tem `linhaViva: true`.
  - `LINHA VIVA como primeira linha` → `'LINHA VIVA\\P(1)600/12 M1\\P1'`: `linhaViva: true` e os itens só do poste e do M1.
  - `legenda e nota não valem` → `mtextEm('ACESSO À LINHA VIVA', 100, 506)` em cima da etiqueta e `mtextEm('LINHA VIVA', 900, 900)` longe: nenhuma etiqueta marcada.
  - `só a etiqueta de baixo` → um `LINHA VIVA` entre duas etiquetas empilhadas na mesma coluna: só a de baixo (que tem o texto em cima) fica marcada; a de cima, que tem o texto embaixo, não.
  - os testes de hoje continuam passando sem mudar o que afirmam.
- [ ] **Passo 2: rodar e ver falhar:** `npx vitest run src/ceara/ceara.test.ts` → FALHA.
- [ ] **Passo 3: escrever** a leitura em `contarObra` (guardar os textos `LINHA VIVA` com a caixa, como os números soltos, e ligar depois das etiquetas montadas).
- [ ] **Passo 4: rodar e ver passar:** `npx vitest run src/ceara` → PASSA.
- [ ] **Passo 5: commit** `git commit -m "Ceará: linha viva pelo texto em cima da etiqueta"`

---

### Tarefa 4: mão de obra dos postes (poste, cruzeta, armação, trafo, caixa, conector, cava)

**Arquivos:**
- Criar: `src/ceara/contagemMO.ts`
- Teste: `src/ceara/contagemMO.test.ts`

**Interfaces:**
- Consome: `ResultadoCeara`, `Etiqueta.linhaViva` (Tarefa 3), `Papel`, `Aba`, `BaseMaoDeObra` (Tarefa 1).
- Produz (usado nas Tarefas 5 e 6):

```ts
export interface Contagem {
  aba: Aba
  /** um dos dois: papel (postes) ou voz (regra de cabo) */
  papel?: Papel
  voz?: string
  quantidade: number
  origem: string // 'P12', 'sem nº', 'vãos de MT', 'vãos de BT'
  confira?: boolean
  /** falta resposta: aparece em vermelho e não soma */
  falta?: string
}
export type Pergunta =
  | { tipo: 'tensionar'; chave: string; poste: string; texto: string }
  | { tipo: 'fases'; chave: string; cabo: string; metros: number }
export interface RespostasDesenho {
  tensionar: Record<string, boolean>
  fases: Record<string, number>
  /** ligado ou desligado à mão, pela origem do poste ('P12') */
  linhaViva: Record<string, boolean>
}
export interface DesenhoMO {
  contagens: Contagem[]
  perguntas: Pergunta[]          // só as que faltam responder
  chavesPerguntas: string[]      // todas que valem neste desenho, respondidas ou não
  naoCobrado: string[]           // ex. 'P1: a MB3.1 ancora cabo novo, tensionar não cobra'
  semRegra: { poste: string; texto: string }[]
  linhaViva: { poste: string; doDesenho: boolean; vale: boolean }[]
}
export function contarDesenhoMO(r: ResultadoCeara, regras: Pick<BaseMaoDeObra, 'regrasCabo' | 'tensionar'>, resp: RespostasDesenho): DesenhoMO
/** Faces de armação de BT: soma, por letra, de teto(n/2); S sem letra conta como letra própria. */
export function facesBT(armacoes: { codigo: string; quantidade: number }[]): number
```

Regras (por etiqueta, com a situação de cada item; nesta tarefa, só as contagens dos postes; cabo e tensionar na Tarefa 5):
- **Item (2) vira um (3) e um (1)** do mesmo item antes de tudo (poste (2) = troca; estrutura (2) = retirada + instalação; trafo (2) = retirada + instalação). Vão (2) não muda.
- Classes pelo código do item (sem o `§mt`/`§tr` e sem `_S`/`_E`):
  - **estrutura de MT:** `/^[NMBUD]B?(\d)/`; passante se o dígito é 1 ou 2, senão encabeçamento; **isolada** se o código tem `CCN` ou `CSR`. TR, SPTR e PR não são estrutura de MT;
  - **armação de BT:** `/^S[1-5][A-Z]?$/`;
  - trafo (`tipo: 'trafo'`), caixa (`/^SPCXD/`), conector de 4 saídas (`tipo: 'conector'` com `50-150`), CAVA (`ignorado` com base `CAVA KLC`).
- `temMT` = a etiqueta tem estrutura de MT, TR ou trafo (com qualquer situação). `lv` = `resp.linhaViva[origem]` se existir, senão `etiqueta.linhaViva`.
- **Poste (1):** `poste-mt` se `temMT`, senão `poste-bt`, × quantidade, `adicao`.
- **Poste (3):** com `lv` e `temMT`: `retirada-poste-lv-encabecamento` se alguma estrutura de MT da etiqueta é de encabeçamento, senão `retirada-poste-lv-passante`; sem `lv`: `retirada-poste-mt`/`retirada-poste-bt`. `devolucao`.
- **Cruzeta (1)** (estruturas de MT (1), cada uma × quantidade, `MB4` = 1): com poste (1) na etiqueta e **nenhuma** estrutura de MT sem prefixo, a primeira unidade (a de cima, na ordem da etiqueta) fica na voz do poste. As outras: com `lv`, `lv-instalacao-passante`/`lv-instalacao-encabecamento` pelo tipo; sem `lv`, `cruzeta-isolado` se isolada, senão `cruzeta-nu`. `adicao`.
- **Cruzeta (3)**, só se a etiqueta não tem poste (3): pelo tipo, `retirada-cruzeta-passante`/`-encabecamento` (com `lv`, `lv-retirada-passante`/`-encabecamento`). `devolucao`.
- **Armação de BT:** sem poste (1), `facesBT` das armações (1) → `armacao-bt` (`adicao`, `confira`); sem poste (3), `facesBT` das (3) → `retirada-armacao-bt` (`devolucao`, `confira`). Quantidade 0 não gera contagem.
- **Trafo (1):** `trafo` + `estrutura-trafo` × quantidade (`adicao`). **Trafo (3):** `retirada-trafo` + `retirada-estrutura-trafo` (`devolucao`).
- **Caixa (1):** `caixa`. **Conector 50-150 (1):** `conector-4-saidas`. **CAVA KLC (1):** `cava-rocha`. Todas × quantidade, `adicao`.
- **Sem regra:** todo item (1) ou (3) (já com o (2) desdobrado) que não entrou acima vai para `semRegra` com o poste e o texto, **menos**: `nao-reconhecido` (já tem lista própria), TR, SPTR, SPALÇA/SPLAÇO, e CF, ELO e ATER-SP numa etiqueta com trafo (1).
- `linhaViva`: uma entrada por etiqueta com `etiqueta.linhaViva` ou com resposta em `resp.linhaViva`.
- Contagens iguais (mesma aba, papel e origem) somam.

- [ ] **Passo 1: escrever os testes** em `src/ceara/contagemMO.test.ts` (montando o `ResultadoCeara` com `contarObra(dxfDe([...]))`; levar `dxfDe`/`mtextEm` para um arquivo de ajuda de teste `src/ceara/teste-dxf.ts` usado pelos dois arquivos de teste; `resp` vazia = `{ tensionar: {}, fases: {}, linhaViva: {} }`; somar por papel com uma função de ajuda do teste):
  - `poste novo de MT leva a primeira cruzeta` → `'(1)600/12 MB1\\P(1)MB3.1\\P1'`: `poste-mt` 1, `cruzeta-nu` 1.
  - `poste novo só de BT` → `'(1)300/9 S2N S2C\\P1'`: `poste-bt` 1, nenhuma `armacao-bt`.
  - `cruzeta em poste existente` → `'600/12 N1\\P(1)MB3.1\\P2'`: `cruzeta-nu` 1, nenhum poste.
  - `troca de poste com estrutura transferida` → `'(3)600/12 (1)600/12\\PN1\\P(1)MB3.1\\P3'` (o N1 sem prefixo passa para o poste novo): `poste-mt` 1, `retirada-poste-mt` 1, `cruzeta-nu` 1, nenhuma `retirada-cruzeta-*`.
  - `troca de cruzeta pelo tipo que sai` → `'600/12\\P(3)M1\\P(1)M4\\P4'`: `retirada-cruzeta-passante` 1, `cruzeta-nu` 1; com `(3)M3.1`: `retirada-cruzeta-encabecamento`.
  - `dupla, U e D contam 1; compacta é isolada` → `'600/12\\P(1)MB4 (1)U3 (1)D1 (1)M1CSR\\P5'`: `cruzeta-nu` 3, `cruzeta-isolado` 1.
  - `trafo não conta como cruzeta` → `'(1)600/12 MB3\\P(1)TR15 (1)TT15KVA\\P6'`: `poste-mt` 1, `trafo` 1, `estrutura-trafo` 1, nenhuma `cruzeta-*`.
  - `item (2) é retirada e instalação` → `'600/12\\P(2)M1\\P7'`: `retirada-cruzeta-passante` 1 e `cruzeta-nu` 1; `'(2)600/12 M1\\P8'`: `retirada-poste-mt` 1 e `poste-mt` 1.
  - `faces da BT` → `facesBT` de 2×S1B = 1; 2 S1B + 2 S1C = 2; 4 S1B + 2 S1C = 3; S1N + S3 = 2; `'300/9\\P(1)2xS1B (1)2xS1C\\P9'`: `armacao-bt` 2 com `confira`.
  - `linha viva troca as vozes` → etiqueta com `linhaViva: true` (texto em cima) `'(1)600/12 M1\\P(1)M3\\P10'`: `poste-mt` 1 e `lv-instalacao-encabecamento` 1; `'600/12\\P(3)M1\\P11'` com linha viva: `lv-retirada-passante` 1; `'(3)600/12 M3\\P12'` com linha viva: `retirada-poste-lv-encabecamento` 1; desligar à mão (`resp.linhaViva.P10 = false`) volta a `cruzeta-nu`.
  - `caixa, conector, cava` → `'300/9\\P(1)SPCXDT-P12PB (1)2xCONEC50-150 (1)CAVA KLC\\P13'`: `caixa` 1, `conector-4-saidas` 2, `cava-rocha` 1.
  - `sem regra vai para a nota` → `'600/12\\P(1)CF (1)PR\\P14'`: `semRegra` com P14 `CF` e `PR`; com trafo (1) na etiqueta, o CF não aparece.
  - `multiplicador` → `'600/12\\P(1)2xM1\\P15'`: `cruzeta-nu` 2.
- [ ] **Passo 2: rodar e ver falhar:** `npx vitest run src/ceara/contagemMO.test.ts` → FALHA.
- [ ] **Passo 3: escrever** `contarDesenhoMO` (só a parte dos postes) e `facesBT`.
- [ ] **Passo 4: rodar e ver passar:** `npx vitest run src/ceara` → PASSA.
- [ ] **Passo 5: commit** `git commit -m "Ceará: mão de obra dos postes pelo desenho"`

---

### Tarefa 5: cabo e tensionar, com as perguntas

**Arquivos:**
- Modificar: `src/ceara/contagemMO.ts`
- Teste: `src/ceara/contagemMO.test.ts`

**Interfaces:**
- Consome e produz os tipos da Tarefa 4 (sem mudar a assinatura de `contarDesenhoMO`).

Regras:
- **Cabo:** os vãos (1) e (3) somados por situação e nome (como `contarObra`). Para cada um, `lerCabo(nome)` e a primeira `RegraCabo` com o mesmo `grupo`, `situacao` (1 = novo, 3 = retirado) e `bitolas` contendo a bitola (sem `bitolas`, vale para todas). `por: 'metro'` → metros; `por: 'condutor'` → metros × condutores: MT pelas fases do nome; BT nu pelos condutores do nome (sem número, 1 e `confira`); pré-reunido = 1. `origem` `vãos de MT` ou `vãos de BT`; `voz` da regra; aba `adicao` no novo e `devolucao` no retirado.
- **MT retirado sem fases no nome:** `resp.fases['fases|' + nome]` se existir; senão a pergunta `{ tipo: 'fases', chave: 'fases|' + nome, cabo: nome, metros }` e a contagem com `quantidade` 0 e `falta: 'falta o número de fases'`. A instalação não pergunta (é por metro de rede).
- Cabo sem regra (grupo `outro` ou sem regra que case) → `semRegra` com `poste: 'vãos'` e o nome.
- **Tensionar**, por etiqueta, com as estruturas (1) já com o (2) desdobrado:
  - com `lv`: não cobra; `naoCobrado` `P10: linha viva, o tensionar vai na voz da cruzeta`.
  - **MT, por estrutura:** `qtd` = a maior das regras `mt` cuja expressão acha o código (estrutura × quantidade conta uma vez cada).
  - **BT, por poste:** a maior `qtd` das regras `bt` em que todas as expressões acham uma estrutura (1) do poste.
  - **Certeza pela rede** (MT = vãos de grupo `mt`; BT = `bt-nu` e `bt-multi`): vão existente = sem prefixo ou (2); vão novo = (1) ou (3). Sem vão existente na rede → não cobra (`naoCobrado`: `P1: a MB3.1 ancora cabo novo, tensionar não cobra`). Só vão existente → cobra (`papel: 'tensionar'`, `adicao`). Dos dois → usa `resp.tensionar[chave]` (true cobra, false vai para `naoCobrado`); sem resposta, a pergunta e a contagem com `falta: 'responda o tensionar'`.
  - **Chave:** MT `'<origem>|mt|<código sem _S>|<n>'` (n = 1, 2... pela ordem desse código na etiqueta, contando o multiplicador); BT `'<origem>|bt'`. Texto da pergunta: MT `O cabo que a <código> do <origem> ancora é existente?`; BT `O cabo de BT que o <origem> ancora é existente?`.
- `chavesPerguntas` = todas as chaves de tensionar e de fases que valem neste desenho (respondidas ou não).

- [ ] **Passo 1: escrever os testes** (regras de teste: cabo `bt-multi` novo `XX243` metro; `mt` novo `XX201` metro com `bitolas: ['004']`; `mt` retirado `XX208` condutor; `bt-nu` retirado `XX211` condutor; tensionar `mt` `^(M|MB|N|NB|B|BB|U|UB)3` 1 e `^(M|MB|N|NB|B|BB|U|UB)4` 2; `bt` `['^S2N$','^S2C$']` 2 e `['^S2[A-Z]?$']` 1):
  - `cabo por metro de rede` → `cota('(1)P3AN004<>', 100)`: `XX201` 100 (não 300).
  - `retirada por condutor` → `cota('(3)P3AN004<>', 100)`: `XX208` 300; `'\\A1;(3)2AN00438'`: `XX211` 76; `'\\A1;(3)AM035T50'` com regra `bt-multi` retirado `XX211`: 50.
  - `MT retirado sem fases pergunta` → a leitura de hoje só aceita vão de MT com o número de fases (`P3AN004`), então o teste monta o vão à mão: `{ ...contarObra(dxfDe([...])), vaos: [{ situacao: 3, cabo: 'PAN004', metros: 100, origem: 'cota' }] }`: pergunta `fases|PAN004`, contagem com `falta`; com `resp.fases['fases|PAN004'] = 2`: 200, sem pergunta. **Não** mudar a leitura dos vãos nesta tarefa (mudaria o material de hoje).
  - `tensionar só com cabo existente` → poste existente `'600/12\\P(1)M3\\P1'` com só `cota('P3AN004<>', 50)`: `tensionar` 1; com só `cota('(1)P3AN004<>', 50)`: nada e `naoCobrado` com P1; tipo 1 (`(1)M1`) nunca; tipo 4 (`(1)M4`) = 2.
  - `rede misturada pergunta` → `(1)M3` com vãos `P3AN004` e `(1)P3AN004`: pergunta com chave `P1|mt|M3|1` e texto `O cabo que a M3 do P1 ancora é existente?`; `resp.tensionar['P1|mt|M3|1'] = true` → `tensionar` 1; `false` → `naoCobrado`.
  - `duas estruturas iguais têm chaves diferentes` → `(1)2xM3`: chaves `P1|mt|M3|1` e `P1|mt|M3|2`.
  - `BT: par S2N + S2C = 2, ancoragem sozinha = 1, alça não soma` → com vão BT existente: `(1)S2N (1)S2C (1)SPALÇA50` = 2; `(1)S2B` = 1.
  - `linha viva não tensiona` → etiqueta com linha viva e `(1)M3` com cabo existente: nada e `naoCobrado`.
  - `chavesPerguntas tem as respondidas` → depois de responder, a chave continua em `chavesPerguntas` e sai de `perguntas`.
- [ ] **Passo 2: rodar e ver falhar:** `npx vitest run src/ceara/contagemMO.test.ts` → FALHA.
- [ ] **Passo 3: escrever** a parte do cabo e do tensionar.
- [ ] **Passo 4: rodar e ver passar:** `npx vitest run src/ceara` → PASSA.
- [ ] **Passo 5: commit** `git commit -m "Ceará: cabo e tensionar da mão de obra, com perguntas"`

---

### Tarefa 6: linhas finais (sufixo, número, desligamento, mudanças, busca)

**Arquivos:**
- Modificar: `src/ceara/maoDeObra.ts`
- Teste: `src/ceara/maoDeObra.test.ts`

**Interfaces:**
- Consome: `DesenhoMO`, `RespostasDesenho` (Tarefa 4), `BaseMaoDeObra` (Tarefa 1), `Area` de `src/ceara/excel.ts`.
- Produz (usado nas Tarefas 7, 8 e 9):

```ts
export const CIDADES_A: Record<Area, string[]> = {
  'CENTRO SUL': ['Icó', 'Iguatu', 'Senador Pompeu', 'Tauá'],
  SUL: ['Crato', 'Juazeiro do Norte', 'Barbalha'],
  LESTE: ['Jaguaribe', 'Aracati', 'Limoeiro do Norte', 'Russas'],
}
export const OUTRA_CIDADE = 'OUTRA'
/** A se a cidade é uma das da área; B com OUTRA_CIDADE; null sem cidade ou com cidade de outra área. */
export function letraDaCidade(area: Area, cidade: string | null): Letra | null
export interface RespostasMO extends RespostasDesenho {
  ot: string
  cidade: string | null
  desligamento: boolean | null
  equipamentos: number
  /** chave da linha → quantidade digitada */
  mudancas: Record<string, number>
  somadas: { aba: Aba; voz: string; quantidade: number }[]
}
export function respostasVazias(ot: string): RespostasMO // equipamentos 1, o resto vazio/null
export interface LinhaMO {
  chave: string // `${aba}|${voz}`, voz sem sufixo
  aba: Aba
  voz: string
  numero: string | null
  descricao: string
  unidade: string
  automatico: number | null // null nas somadas à mão
  quantidade: number
  mudada: boolean
  somada: boolean
  origem: string[]
  falta?: string
  confira?: boolean
}
export function montarLinhas(d: DesenhoMO, base: BaseMaoDeObra, resp: RespostasMO, area: Area): LinhaMO[]
export function buscarVozes(base: BaseMaoDeObra, termo: string, letra: Letra | null): VozDaLista[]
/** Tira as respostas que não cabem mais no desenho: tensionar e fases fora de `chavesPerguntas`,
 *  linha viva de poste que sumiu, mudança de linha automática que sumiu. As somadas ficam. */
export function limparRespostas(resp: RespostasMO, d: DesenhoMO, linhas: LinhaMO[]): RespostasMO
```

Regras:
- Papel → voz por `base.papeis`; cabo já vem com `voz`. Contagens da mesma aba e voz viram uma linha: `automatico` = soma das contagens sem `falta`; `origem` sem repetir, na ordem; `falta` = os textos de falta, sem repetir, juntados com `; `; `confira` se alguma tiver.
- **Desligamento:** `true` → `operacao-equipamento` com 2 × `equipamentos` (`adicao`, origem `desligamento`); `false` → nada; `null` → a linha com `automatico` 0 e `falta: 'responda se teve desligamento'`.
- **Número e descrição:** a primeira entrada **não variante** de `base.lista` com a voz e a letra da cidade. Sem letra: `numero` null, `descricao` = a da letra A ou B que existir, `falta` acrescido de `escolha a cidade da obra`. Com letra e sem entrada: `numero` null, `falta` acrescido de `voz fora da lista`. `unidade` da entrada.
- `quantidade` = `resp.mudancas[chave]` se existir, senão `automatico`; `mudada` se a chave está em `mudancas`.
- Somadas à mão: uma linha cada (`somada: true`, `automatico: null`, origem `somada à mão`). A busca não deixa somar voz que já está na aba (Tarefa 9); se mesmo assim a voz somada também for automática na mesma aba (ex.: o desenho novo passou a contar ela), fica só a linha automática e a somada é ignorada.
- Linha automática com `quantidade` 0, sem `falta` e sem mudança não aparece.
- Ordem: `adicao` antes de `devolucao`; dentro de cada uma, a ordem de `PAPEIS` e depois as de cabo (pela ordem de `regrasCabo`), depois as somadas.
- `buscarVozes`: `casa` sobre voz, descrição e unidade; a partir de 2 letras; até 20; com letra, só dela; variantes entram.

- [ ] **Passo 1: escrever os testes** em `src/ceara/maoDeObra.test.ts` (base de teste com `XX110` A/B, `XX212` A/B e uma variante `XX212_A_GRP A - ...` de número `9000000099` posta **antes** da não variante na `lista`, todos os papéis em `XX110` menos `tensionar` em `XX212` e `operacao-equipamento` em `XX730` só na letra A):
  - `letra pela cidade` → SUL `Crato` = A; SUL `OUTRA` = B; SUL `Icó` (de CENTRO SUL) = null; `null` = null.
  - `linha com número e sufixo` → contagem `poste-mt` 1 com cidade `Crato` em SUL: `numero` o de `XX110` A, `chave` `adicao|XX110`.
  - `variante fica de fora da contagem` → `tensionar` com letra A usa o número não variante, nunca `9000000099`.
  - `sem cidade fica vermelha` → `numero` null, `falta` contém `escolha a cidade da obra`.
  - `voz fora da lista` → desligamento `true`, 2 equipamentos, cidade B: linha `XX730` com `quantidade` 4, `numero` null, `falta` `voz fora da lista`.
  - `desligamento` → `false`: sem linha; `null`: linha com `falta` `responda se teve desligamento`.
  - `mudança à mão fica ao trocar a cidade` → `mudancas['adicao|XX110'] = 5`: `quantidade` 5, `mudada` true, `automatico` 1, com `Crato` e com `OUTRA` (o número troca, a mudança fica).
  - `falta não soma` → duas contagens `tensionar` (1 resolvida, 1 com `falta`): `automatico` 1, `falta` presente.
  - `somada à mão` → `somadas: [{ aba: 'adicao', voz: 'XX212', quantidade: 2 }]`: linha `somada` com `automatico` null.
  - `limparRespostas` → tira `tensionar['P9|mt|M3|1']` que não está em `chavesPerguntas`, `linhaViva.P9` de poste que sumiu e `mudancas['devolucao|XX110']` sem linha automática; fica o resto e as somadas.
  - `busca` → `buscarVozes(base, 'te', 'A')` acha `XX212` e a variante; `'t'` (1 letra) → `[]`.
- [ ] **Passo 2: rodar e ver falhar:** `npx vitest run src/ceara/maoDeObra.test.ts` → FALHA.
- [ ] **Passo 3: escrever** as funções.
- [ ] **Passo 4: rodar e ver passar:** `npx vitest run src/ceara` → PASSA.
- [ ] **Passo 5: commit** `git commit -m "Ceará: linhas da mão de obra com sufixo, número e respostas"`

---

### Tarefa 7: respostas guardadas por OT (banco versão 4)

**Arquivos:**
- Modificar: `src/lib/banco.ts`
- Teste: `src/lib/banco.test.ts`

**Interfaces:**
- Consome: `RespostasMO` (Tarefa 6).
- Produz (usado na Tarefa 9):

```ts
export const LOJA_MAO_DE_OBRA = 'maoDeObra' // keyPath 'ot'
export async function lerRespostasMO(ot: string): Promise<RespostasMO | null> // null também sem IndexedDB
/** true só se gravou */
export async function gravarRespostasMO(r: RespostasMO): Promise<boolean>
```

Regras:
- `VERSAO = 4`; o `onupgradeneeded` só cria a loja nova se faltar (as de hoje ficam).
- Sem IndexedDB: `lerRespostasMO` → `null`, `gravarRespostasMO` → `false`, sem lançar.

- [ ] **Passo 1: escrever os testes** (fake-indexeddb, como os de hoje):
  - `grava e lê por OT` → grava `respostasVazias('8000001')` com `cidade: 'OUTRA'`; ler `'8000001'` devolve igual; ler `'8000002'` → `null`.
  - `migração 3 → 4 não perde nada` → abrir na versão 3 com um técnico, uma base e uma sugestão; abrir pela função de hoje: os três continuam lá e a loja `maoDeObra` existe.
  - `sem IndexedDB` → com `indexedDB` indefinido: `null` e `false`.
- [ ] **Passo 2: rodar e ver falhar:** `npx vitest run src/lib/banco.test.ts` → FALHA.
- [ ] **Passo 3: escrever** as funções.
- [ ] **Passo 4: rodar e ver passar:** `npm test` → PASSA.
- [ ] **Passo 5: commit** `git commit -m "Banco do navegador versão 4: respostas da mão de obra por OT"`

---

### Tarefa 8: abas da mão de obra no Excel

**Arquivos:**
- Modificar: `src/ceara/excel.ts`
- Teste: `src/ceara/ceara.test.ts` (describe do Excel)

**Interfaces:**
- Consome: `LinhaMO` (Tarefa 6).
- Produz (usado na Tarefa 9):

```ts
export async function gerarExcelCeara(r: ResultadoCeara, cab: Cabecalho, estrat?: { base: BaseEnel; ajustes: Ajustes }, mo?: LinhaMO[]): Promise<Uint8Array>
```

Regras:
- Com `mo` (mesmo vazio): depois das 4 abas de hoje, `MÃO DE OBRA ADIÇÃO` e `MÃO DE OBRA DEVOLUÇÃO`, com as colunas e o visual da adição de material (DATA, ÁREA, EMPRESA, OT, CÓDIGO, DESCRIÇÃO, QTD). A ESTRATIFICAÇÃO, quando existe, fica por último.
- Linha: CÓDIGO = `numero` (como número, igual aos códigos de hoje) ou, sem número, a `voz`; DESCRIÇÃO; QTD = `quantidade`. Vermelha quando tem `falta` ou não tem `numero`.
- Sem `mo`: o arquivo de hoje, byte a byte em cada parte.

- [ ] **Passo 1: escrever os testes:**
  - `Excel sem mão de obra igual ao de hoje` → as partes do .xlsx gerado sem `mo` têm o mesmo hash de antes da mudança (com data fixa; calcular os hashes no começo da tarefa, antes de mexer, e fixar no teste).
  - `abas da mão de obra` → `mo` com uma linha `adicao` (`numero` `9000000001`, quantidade 2) e uma `devolucao` com `falta`: o `workbook.xml` tem as duas abas nessa ordem depois das 4; a de adição tem a OT e `9000000001`; a linha de devolução usa o estilo vermelho.
  - `com estratificação e mão de obra` → 7 abas, ESTRATIFICAÇÃO por último.
  - `lerOrcamento` do arquivo gerado continua lendo as 4 abas de estrutura e material.
- [ ] **Passo 2: rodar e ver falhar:** `npx vitest run src/ceara/ceara.test.ts` → FALHA.
- [ ] **Passo 3: escrever** (generalizar a montagem de `aba()` para receber as linhas da mão de obra; as abas de hoje sem mudança).
- [ ] **Passo 4: rodar e ver passar:** `npm test` → PASSA.
- [ ] **Passo 5: commit** `git commit -m "Ceará: abas de mão de obra no Excel da obra"`

---

### Tarefa 9: o bloco "Mão de obra" na Leitura do CAD

**Arquivos:**
- Criar: `src/components/ceara/useMaoDeObra.ts`, `src/components/ceara/MaoDeObra.tsx`
- Modificar: `src/components/ceara/Ceara.tsx`, `src/App.tsx` (passar `bases.maoDeObra`), `e2e/fluxo.mjs` (função `ceara`)

**Interfaces:**
- Consome: tudo das Tarefas 1 a 8.
- Produz:

```ts
// useMaoDeObra.ts
export function useMaoDeObra(resultado: ResultadoCeara | null, base: BaseMaoDeObra | null, area: Area, ot: string): {
  resp: RespostasMO
  mudar: (f: (r: RespostasMO) => RespostasMO) => void
  desenho: DesenhoMO | null
  linhas: LinhaMO[] | null // null sem resultado ou sem base
  guardando: boolean       // false sem OT válida ou sem IndexedDB
}
// MaoDeObra.tsx
export function MaoDeObra(props: { base: BaseMaoDeObra | null; area: Area; estado: ReturnType<typeof useMaoDeObra> })
// Ceara.tsx
export function Ceara(props: { base: BaseEnel; maoDeObra: BaseMaoDeObra | null; onVoltar: () => void })
```

Regras:
- **Estado:** ao ter OT válida, lê `lerRespostasMO(ot)`; sem nada guardado, `respostasVazias(ot)`. Cada mudança grava com atraso de 400 ms; grava na hora no `pagehide` e ao desmontar. Ao trocar de OT, grava a anterior antes de ler a nova. A cada desenho lido (e depois de ler as respostas), aplica `limparRespostas`.
- **Onde:** logo depois da grade dos 4 blocos de estrutura e material, antes de "Itens que o site não reconheceu".
- **Sem lista** (`base` null): só um painel "Mão de obra" com o texto `A lista de mão de obra ainda não chegou ao site. A contagem de estrutura e material continua normal.`; o Excel sai como hoje.
- **Topo do bloco:**
  - "Cidade da obra": as cidades de `CIDADES_A[area]` e "Outra cidade (B)", com a letra que vale escrita ao lado ("sufixo A" / "sufixo B");
  - "Teve desligamento?" Sim / Não, foi TET; com Sim, "Equipamentos operados" com − / + (mínimo 1) e "abrir e fechar = 2 cada";
  - sem OT válida: `Sem OT válida: as respostas não ficam guardadas.`
- **Linha viva:** uma linha por poste de `desenho.linhaViva`, com "com linha viva" / "sem linha viva" e o botão para trocar (mudar `resp.linhaViva`).
- **Tabelas "Instalação" e "Retirada"** (`adicao`/`devolucao`): Nº do serviço, Voz (voz com o sufixo e a descrição), Unid., Quantidade (− / + e campo, vírgula decimal; digitar grava em `mudancas`, ou na somada), De onde veio, e as marcas "falta responder: <falta>", "mudado à mão" + "voltar ao automático (<automático>)", "confira", "somada à mão" + "tirar".
  - Pergunta de tensionar na linha do tensionar: o texto e Sim / Não, uma por pergunta pendente.
  - Pergunta de fases na linha do cabo: "Fases" com campo de 1 a 3.
  - "+ Voz" no pé de cada tabela: busca com `buscarVozes` (letra da cidade); voz que já está na aba aparece "já na tabela" e não soma.
- **Nota no pé:** `naoCobrado` e `semRegra` ("sem regra de mão de obra, confira": poste e texto).
- **Excel:** `baixar` passa `linhas` (só quando há base) a `gerarExcelCeara`; o texto do painel do Excel conta as abas certas; o número de linhas vermelhas soma as da mão de obra. Mudança na mão de obra limpa o "Baixado".
- Atualizar o comentário do topo de `Ceara.tsx` (a mão de obra não fica mais de fora) e o texto da lista "Fora da contagem de propósito" (a CAVA entra na mão de obra).
- **e2e** (`ceara()`, com a lista no falso; sem `../bases/mao-de-obra.json`, pula esta parte e avisa): depois de ler o `ceara.dxf`:
  - o bloco "Mão de obra" aparece com "Instalação" e "Retirada";
  - escolher "Outra cidade (B)"; responder "Teve desligamento?" Sim com 1 equipamento;
  - responder todas as perguntas de tensionar com "Não" e conferir que nenhuma linha fica com "falta responder";
  - mudar uma quantidade à mão e ver "mudado à mão"; **recarregar logo em seguida**, ler o mesmo DXF e ver cidade, desligamento, respostas e mudança de volta;
  - baixar o Excel: as abas `MÃO DE OBRA ADIÇÃO` e `MÃO DE OBRA DEVOLUÇÃO` existem, a coluna CÓDIGO das linhas é `/^\d{10}$/` e a OT está nas linhas;
  - axe sem violação e largura da página ≤ largura da janela em 1366 e 390 px; prints `12-ceara-mao-de-obra`.

- [ ] **Passo 1: escrever** o e2e acima em `e2e/fluxo.mjs` e rodar `E2E_SO=ceara npm run e2e` → FALHA (bloco não existe).
- [ ] **Passo 2: escrever** `useMaoDeObra`, `MaoDeObra` e a ligação em `Ceara.tsx` e `App.tsx`.
- [ ] **Passo 3: rodar** `npm test`, `npx tsc -b`, `npm run lint` → sem erro; `E2E_SO=ceara npm run e2e` → PASSA; olhar os prints em 1366 e 390, claro e escuro.
- [ ] **Passo 4: commit** `git commit -m "Ceará: bloco Mão de obra na Leitura do CAD"`

---

### Tarefa 10: conferência com as 4 obras e mostrar ao Italo

**Arquivos:** nenhum versionado. Script no scratchpad (fora do repositório), como o de 05/11.

- [ ] **Passo 1: rodar a conferência:** script `tsx` no scratchpad que, para cada obra de `..\ceara-teste` (`bt-1-poste`, `bt-8-postes`, `mt-trafo`, `limoeiro`), lê `obra.dxf` com `lerDxf`/`contarObra` (base `../bases/enel.json`), roda `contarDesenhoMO` e `montarLinhas` com `../bases/mao-de-obra.json`, cidade `OUTRA` (B; Limoeiro com `Limoeiro do Norte` em LESTE = A), desligamento como no orçamento real e todas as perguntas de tensionar respondidas como o Italo explicou (na mt-trafo, o derivado do P1 é novo), e compara com as abas de mão de obra do `orcamento-real.xlsx` (sem o orçamento na Limoeiro: comparar com a proposta da memória). Imprimir só no terminal; nada gravado no repositório.
- [ ] **Passo 2: esperado:** batem poste, cabo de BT e de MT, trafo e estrutura do trafo, caixa, retirada de poste de BT e conector de 4 saídas; **nenhuma** obra com linha viva. Diferenças aceitas: bt-8-postes, retirada de cabo de BT (desenho 228, orçamento 152); mt-trafo, instalação de cruzeta (desenho 1, orçamento 3). Qualquer outra diferença: parar e investigar antes de mostrar.
- [ ] **Passo 3: conferência final do projeto:** `npm test`, `npm run lint`, `npm run build`, `node scripts/conferir-dist.mjs`, `npm run e2e` → tudo passa.
- [ ] **Passo 4: mostrar ao Italo** o resultado da conferência (tabela por obra, voz por voz, sem salvar no repositório), a tabela de regras `../bases/regras-mao-de-obra.json` com a amostra das expressões, e os prints do bloco. Subir a lista ao Supabase só com o OK dele (e o `check` novo rodado por ele no Supabase).
