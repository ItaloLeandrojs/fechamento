# Caderno do orçamento (Ceará): plano de construção

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhar.

**Objetivo:** item novo "Caderno do orçamento" no menu do Ceará: a pessoa monta o orçamento poste por poste (Estrutura | Material | Mão de obra), põe os cabos no bloco Rede com os metros somados como na calculadora, recebe o ARO pronto e sai com três saídas: lançar na Enel linha por linha, Excel e comparação com a Leitura do CAD. Tudo guardado por OT neste computador.

**Arquitetura:**
- **Regras puras** (sem React, testadas com dados inventados): `src/ceara/caderno.ts` (modelo, mudanças, conta dos metros, busca, soma por poste, lançamento, troca de OT), `src/ceara/rede.ts` (cabos → material e mão de obra), `src/ceara/aro.ts`, `src/ceara/cadernoObra.ts` (soma da obra, `Orcamento` para o `comparar`, fila do lançamento).
- **Cabos da Leitura do CAD** (`src/ceara/contagem.ts`): a conversão dos cabos sai de dentro de `contarObra` para uma função exportada, usada pelos dois lados; a Leitura do CAD continua dando o mesmo resultado.
- **Lista de mão de obra:** terceira base no Supabase (`mao-de-obra`), subida pelo `scripts/atualizar_base.py` como a da Enel, com as regras do cabo e do ARO dentro dela. Opcional no site: sem ela, o caderno funciona e a mão de obra fica só digitada à mão.
- **Banco do navegador** (`src/lib/banco.ts`): versão 4 com a loja `cadernos` (chave = pessoa logada + OT).
- **Excel** (`src/ceara/excel.ts`): a montagem do arquivo vira uma função comum; o Excel da Leitura do CAD sai idêntico (hash de cada parte conferido antes e depois).
- **Tela:** pasta nova `src/components/ceara/caderno/`, aberta pelo item novo no `MenuLateral` de `src/components/ceara/Ceara.tsx`.

**Tecnologia:** Vite 6 + React 19 + TypeScript 5.8 + Tailwind 4, vitest 2, JSZip, `fake-indexeddb` (testes), Python 3 + openpyxl (script), Playwright + axe no e2e.

**Especificação:** `docs/2026-11-05-ceara-caderno-design.md` (autoridade). Rascunho aprovado: `AUTOMACAO KIT MATERIAL\rascunhos-plataforma\f-ceara-caderno.html`, versão D (fora do repositório).

## Regras gerais
- **Repositório público:** nenhum código, descrição, kit ou código de mão de obra real da Enel em arquivo versionado (código, testes, e2e, este plano, comentários, mensagens de commit). Testes com códigos inventados (`900001`, `KITX1`, `XX101`). O e2e tira os códigos que precisa das bases locais (`../bases/*.json`, fora do git) na hora, sem escrever nenhum.
- As regras de mão de obra do cabo (com os códigos reais) e as listas do ARO ficam no arquivo `../bases/regras-mao-de-obra.json` (fora do git) e dentro da base no Supabase. Nunca no site, nunca no script.
- Textos da tela em português, no tom do site, **sem travessão (—)**. Toda cor tem a palavra do lado ("feito", "fora da base", "mudado à mão", "a confirmar", "automático").
- Página nunca mais larga que a tela (390 px); zero violação do axe.
- **Quem não usa o caderno não vê mudança:** a Leitura do CAD conta, compara e baixa o Excel igual a hoje (mesmos bytes de cada parte do .xlsx).
- IndexedDB 3 → 4 sem perder `tecnicos`, `bases` e `ajustes`.
- Quantidades: toda conta passa por `arred` de `src/ceara/estratificacao.ts` (3 casas). Na tela, `formatarQtd` (vírgula).
- OT válida: `/^\d{7}$|^\d{11}$/` com 11 dígitos começando com 1722 (a mesma regra da Leitura do CAD, `otValida` em `Ceara.tsx`, que vira função exportada na Tarefa 4).
- Busca: `normalizar`/`casa` de `src/lib/busca.ts`, a partir de 2 letras, até 20 resultados.
- Sem push. Um commit por tarefa no ramo `supabase`.
- Processo do projeto: um agente por tarefa e um revisor antes da próxima. No fim: `npm test`, `npm run lint`, `npm run build`, `node scripts/conferir-dist.mjs`, `npm run e2e`.

## Foco da revisão
Casos que a especificação implica e que mais podem pegar quem usa. Cada um tem teste na tarefa dona do código.
1. **Trocar a OT do caderno aberto para uma OT que já tem caderno guardado:** nada é sobrescrito nem misturado; a tela pergunta qual fica. Teste em `trocarOt` (Tarefa 4) e no e2e (Tarefa 8).
2. **Digitar "0,5" numa quantidade:** o "0" do meio da digitação não tira o item nem o foco; só o "−" até 0 tira. Teste em `mudarQtd` (Tarefa 4) e no e2e (Tarefa 8).
3. **Metros escritos de jeitos diferentes:** espaços, "+" no fim, ponto ou vírgula decimal, letra no meio. Conta inválida aparece como erro e não soma zero calado. Teste em `contaMetros` (Tarefa 4).
4. **Caderno guardado com código que saiu da base nova** (estrutura, material ou atividade): o item continua lá, em vermelho, "não está mais na base", e sai em vermelho no Excel. Teste em `somaDoPoste` (Tarefa 4) e no Excel (Tarefa 6).
5. **Fechar a página ou trocar de ferramenta logo depois de mudar algo** (dentro do atraso da gravação): a mudança não se perde. Gravação imediata no `pagehide` e ao sair da tela; teste no e2e (Tarefa 8, recarregar logo depois do +1).

---

### Tarefa 1: cabos da Leitura do CAD reaproveitáveis

**Arquivos:**
- Modificar: `src/ceara/contagem.ts`
- Teste: `src/ceara/ceara.test.ts` (describe novo "cabos reaproveitados")

**Interfaces:**
- Produz (usado nas Tarefas 4, 5 e 9):

```ts
export type Cabo = /* o tipo que já existe, agora exportado */
export function lerCabo(nome: string): Cabo // a mesma de hoje, exportada
export interface CaboSomado { situacao: 1 | 3; nome: string; metros: number; /** só o caderno passa: vale no lugar das fases da obra */ fases?: number }
/** Soma em `adicao`/`devolucao` o material dos cabos com a regra de hoje (5%, kg, sucata, sem regra = semCodigo, fitas do BT novo uma vez). */
export function converterCabos(cabos: CaboSomado[], fasesMT: number, catalogo: Catalogo | undefined, adicao: Linha[], devolucao: Linha[]): void
/** Nomes de vão com regra de material, sem repetir: MT P1 a P3 × bitolas de MT_NOVO/MT_SUCATA; AM + chaves de BT_NOVO/BT_MULTI_SUCATA; BT nu 1 a 4 × bitolas de BT_NU_SUCATA. */
export function nomesDeCabo(): string[]
/** Código de sucata do material novo (poste por POSTE_NOVO → POSTE_SUCATA pelo mesmo nome; trafo por TRAFO → TRAFO_RETIRADO); null se não houver. */
export function codigoDeSucata(codigoNovo: string): string | null
```

Regras:
- `contarObra` passa a chamar `converterCabos` com o mesmo `porCabo` de hoje, sem `fases`; a ordem das linhas e os textos de `conta` e `origem` não mudam. Com `fases`, ela vale tanto no novo quanto no retirado de MT.
- Nenhum teste existente é mudado.

- [ ] **Passo 1: escrever os testes** (com `dxfDe`/`cota` do próprio arquivo; nenhum código literal de material):
  - `converterCabos dá o que a Leitura do CAD dá` → para `(1)AM035T` 97 m, `contarObra(dxfDe([... '\\A1;(1)AM035T97']))` e `converterCabos([{ situacao: 1, nome: 'AM035T', metros: 97 }], 3, undefined, a, d)` dão as mesmas linhas de cabo e fitas na adição (código, quantidade 102, conta `'97 m + 5%'`); `d` vazio.
  - `fases do caderno valem no MT` → `{ situacao: 1, nome: 'P2AN004', metros: 100, fases: 2 }` com `fasesMT` 3: quantidade `17.85`, conta `'kg: 100 m x 2 fases x 1,05 x 0,085'`.
  - `cabo sem regra vai sem código` → `{ situacao: 1, nome: 'XYZ1', metros: 10 }`: uma linha `{ codigo: 'CABO XYZ1', semCodigo: true, quantidade: 10 }`.
  - `nomes de cabo` → contém `'AM035T'`, `'P3AN004'`, `'2AN004'`; nenhum repetido; `lerCabo(n).grupo !== 'outro'` para todos.
  - `sucata pelo mesmo nome` → com `contarObra(dxfDe(['(1)600/12 S1N\\P1', '(3)600/12\\P2', '(1)TT15KVA\\P3', '(3)TT15KVA\\P4']))`: `codigoDeSucata(<código do poste na adição>)` é o código do poste na devolução; o mesmo para o trafo; `codigoDeSucata('900001')` é `null`.
- [ ] **Passo 2: rodar e ver falhar:** `npx vitest run src/ceara/ceara.test.ts` → FALHA (funções não exportadas).
- [ ] **Passo 3: escrever** as funções em `contagem.ts`, tirando o laço dos cabos de dentro de `contarObra`.
- [ ] **Passo 4: rodar e ver passar:** `npx vitest run src/ceara` → PASSA, com todos os testes antigos sem mudança (inclusive as obras reais, quando os arquivos existem neste PC).
- [ ] **Passo 5: commit** `git commit -m "Ceará: conversão dos cabos reaproveitável fora da Leitura do CAD"`

---

### Tarefa 2: lista de mão de obra no site (base opcional)

**Arquivos:**
- Criar: `src/ceara/maoDeObra.ts`
- Modificar: `src/lib/banco.ts` (só `NomeBase`), `src/nuvem/bases.ts`, `src/nuvem/supabase.ts`, `supabase/esquema.sql`, `e2e/supabase-falso.mjs`, `e2e/fluxo.mjs` (só a função `simular`), `scripts/conferir-dist.mjs`, `scripts/conferir-supabase.mjs`
- Teste: `src/nuvem/bases.test.ts`

**Interfaces:**
- Produz:

```ts
// src/ceara/maoDeObra.ts
export type GrupoCabo = 'mt' | 'bt-nu' | 'bt-multi'
export interface RegraCabo {
  grupo: GrupoCabo
  situacao: 'novo' | 'tensionado' | 'retirado'
  codigo: string
  /** 'metro': metros de rede (todos os condutores contam como um); 'condutor': metros × condutores */
  por: 'metro' | 'condutor'
  /** bitolas do código do vão ('004', '035'...); sem a lista, vale para todas */
  bitolas?: string[]
  /** o site sugere e a pessoa confirma (ex.: tensionar só quando ancorado) */
  confirmar?: boolean
}
export interface ListasAro { poste: string[]; cinta: string[]; trafo: string[] } // começos da descrição do material
export interface BaseMaoDeObra {
  atividades: Record<string, [descricao: string, unidade: string]>
  regrasCabo: RegraCabo[]
  aro: ListasAro
}
/** Usada quando a base não chegou: começos genéricos, sem código. */
export const ARO_PADRAO: ListasAro = { poste: ['POSTE'], cinta: ['CINTA'], trafo: ['TRANSFORMADOR'] }

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
- `conferirBaseMaoDeObra`: lança se `atividades` não for objeto com pelo menos uma entrada, se `regrasCabo` não for lista, se uma regra tiver `grupo`/`situacao`/`por` fora dos valores acima ou `codigo` que não está em `atividades`, ou se `aro` não tiver as três listas.
- `garantirBases`, para `mao-de-obra` (enel e edp como hoje):
  - sem linha no servidor e sem cópia guardada → `null` e o aviso `A lista de mão de obra ainda não está no servidor. No caderno, a mão de obra fica só digitada à mão.`;
  - sem linha no servidor e com cópia → a cópia, sem aviso;
  - download ou conferência falhou → a cópia com o aviso de sempre (`Não deu para atualizar a base da mão de obra: ...`) ou, sem cópia, `null` e o aviso acima. **Nunca** lança `PRIMEIRA_VEZ_SEM_INTERNET` por causa dela.
- `fonteSupabase.versoes`: `enel` e `edp` obrigatórias como hoje; `mao-de-obra` só se a linha existir.
- `supabase/esquema.sql`: trecho idempotente que troca o `check` da tabela `bases` para `nome in ('enel', 'edp', 'mao-de-obra')` (`drop constraint if exists` + `add constraint`). Quem roda no Supabase é o Italo, com o controlador (pedir antes).
- `e2e/supabase-falso.mjs`: parâmetro novo `maoDeObra` (caminho do JSON local); com ele, a tabela `bases` tem a 3ª linha e o balde serve `mao-de-obra.json.gz`; sem ele, só as duas de hoje. `fluxo.mjs` passa `../bases/mao-de-obra.json` quando o arquivo existe.
- `conferir-dist.mjs`: com `../bases/mao-de-obra.json`, sorteia também 20 descrições de `atividades` (mesma regra de semente e tamanho mínimo); sem o arquivo, segue só com as duas de hoje e avisa.
- `conferir-supabase.mjs`: aceita `edp,enel` ou `edp,enel,mao-de-obra`.

- [ ] **Passo 1: escrever os testes** em `src/nuvem/bases.test.ts` (o `montar` ganha a 3ª base opcional; `MO = { atividades: { XX101: ['ATIVIDADE TESTE', 'm de rede'] }, regrasCabo: [{ grupo: 'bt-multi', situacao: 'novo', codigo: 'XX101', por: 'metro' }], aro: ARO_PADRAO }`):
  - `sem lista de mão de obra no servidor, segue sem ela` → versões sem `mao-de-obra`, nada guardado: `maoDeObra` `null`, `enel`/`edp` normais, aviso com `ainda não está no servidor`.
  - `com lista no servidor, baixa e guarda` → `maoDeObra.atividades.XX101` igual; `guardado.get('mao-de-obra').versao` é a do servidor.
  - `download da lista falhou e há cópia` → devolve a cópia e avisa; sem cópia → `null`, sem lançar.
  - `conferir lista de mão de obra` → recusa `{}`, recusa regra com `codigo: 'XX999'` fora de `atividades`, recusa `por: 'km'`, aceita `MO`.
  - os testes de hoje continuam passando sem mudar o que afirmam.
- [ ] **Passo 2: rodar e ver falhar:** `npx vitest run src/nuvem/bases.test.ts` → FALHA.
- [ ] **Passo 3: escrever** o código e os trechos acima (o `Preparando` e o `useAcesso` não mudam: o tipo `Bases` acompanha `garantirBases`).
- [ ] **Passo 4: rodar e ver passar:** `npm test`, `npx tsc -b`, `npm run lint` → sem erro.
- [ ] **Passo 5: commit** `git commit -m "Base opcional da lista de mão de obra do Ceará"`

---

### Tarefa 3: script que sobe a lista de mão de obra

**Arquivos:**
- Modificar: `scripts/atualizar_base.py`
- Teste: `scripts/test_atualizar_base.py`
- Fora do git (criar, não versionar): `..\bases\regras-mao-de-obra.json`

**Interfaces:**
- Comando: `python scripts/atualizar_base.py mao-de-obra "<PxQ.xlsx>" --listagem "<Listagem de atividades.xlsx>" --regras ..\bases\regras-mao-de-obra.json [--seco] [--sim]`
- Produz `../bases/mao-de-obra.json` = `{ "atividades": {codigo: [descricao, unidade]}, "regrasCabo": [...], "aro": {...} }` (o formato de `BaseMaoDeObra` da Tarefa 2) e a linha `mao-de-obra` na tabela `bases`, arquivo `mao-de-obra-<versao>.json.gz`.

```python
def ler_pxq(caminho) -> dict          # {codigo: [descricao, unidade]}
def ler_listagem(caminho) -> dict     # idem
def ler_regras(caminho) -> dict       # {'regrasCabo': [...], 'aro': {...}}
def montar_mao_de_obra(pxq, listagem, regras) -> dict
def conferir_mao_de_obra(base) -> list[str]   # 'PARA: ...' como conferir()
def contagens_mao_de_obra(base) -> dict       # {'atividades': n, 'regras': n}
```

Regras:
- PxQ: cabeçalho na linha 3, colunas `B` (`novo codigo`), `E` (`descri`), `H` (`unidade`), conferidas com `_conferir_cabecalho`; o mesmo código aparece uma vez por área: fica a primeira.
- Listagem: cabeçalho na linha 8, colunas `A` (`voz`), `C` (`descri`), `E` (`unidade`); o mesmo código aparece por tipo (urbana, rural): fica a primeira.
- `montar_mao_de_obra`: todos os códigos do PxQ (contrato novo) e, depois, os da Listagem que não estão no PxQ. Descrição e unidade com `_texto`.
- `conferir_mao_de_obra` para (`PARA:`) com: nenhuma atividade; regra com código fora das atividades; `grupo`, `situacao` ou `por` fora dos valores da Tarefa 2; `aro` sem `poste`, `cinta` ou `trafo`. Queda de mais de 2% nas contagens: aviso, como na Enel.
- `executar('mao-de-obra', ...)` segue o mesmo caminho da Enel (grava `../bases/mao-de-obra.json`, `--seco` compara com a cópia local, sobe o arquivo, grava a linha, apaga o antigo). `NOMES_CONTAGEM` ganha `atividades` e `regras`.
- `regras-mao-de-obra.json` (fora do git): o implementador escreve com as regras que o Italo já explicou (memória do projeto `fechamento-ceara-mao-de-obra.md`): lançamento por metro de rede, uma voz para condutor nu e outra para pré-reunido; retirada por condutor; tensionar com `confirmar: true`. `aro` com `POSTE`, `CINTA`, `TRANSFORMADOR`. **Mostrar o arquivo ao Italo antes de subir.** Grupo sem regra conhecida (ex.: MT) fica sem regra: o site pede a mão de obra à mão.

- [ ] **Passo 1: escrever os testes** em `scripts/test_atualizar_base.py` com planilhas montadas na hora (códigos `XX101`, `XX102`, `XX103`; descrições inventadas):
  - `test_le_pxq_um_por_codigo` (o mesmo código em duas áreas vira um);
  - `test_le_listagem_um_por_codigo` (urbana e rural viram um);
  - `test_pxq_primeiro_listagem_completa` (código só da Listagem entra; código dos dois fica com a descrição do PxQ);
  - `test_cabecalho_mudou_para` (coluna E do PxQ sem "descri" → `ErroBase` com a coluna);
  - `test_regra_com_codigo_fora_para` e `test_regra_com_por_invalido_para`;
  - `test_seco_grava_json_sem_internet` (`--seco` grava `mao-de-obra.json` numa pasta temporária, sem chamar `_chamar`).
- [ ] **Passo 2: rodar e ver falhar:** `python -m unittest scripts/test_atualizar_base.py -v` → FALHA.
- [ ] **Passo 3: escrever** as funções e o subcomando.
- [ ] **Passo 4: rodar e ver passar:** `python -m unittest scripts/test_atualizar_base.py -v` → PASSA (os testes de hoje também).
- [ ] **Passo 5: gerar a cópia local:** escrever `..\bases\regras-mao-de-obra.json` e rodar com `--seco` sobre as planilhas de `..\ceara-teste\referencia\`. Esperado: contagens impressas, `..\bases\mao-de-obra.json` gravado, nada enviado. Subir de verdade (sem `--seco`) só depois do OK do Italo e do `check` novo da Tarefa 2 rodado no Supabase.
- [ ] **Passo 6: commit** (só o script e o teste): `git commit -m "Script: lista de mão de obra do Ceará para o Supabase"`

---

### Tarefa 4: regras do caderno (modelo, metros, busca, soma por poste, lançamento)

**Arquivos:**
- Criar: `src/ceara/caderno.ts`
- Teste: `src/ceara/caderno.test.ts`

**Interfaces:**
- Usa: `BaseEnel` (Tarefa 1), `BaseMaoDeObra` (Tarefa 2), `Area` de `excel.ts`, `arred` de `estratificacao.ts`, `normalizar`/`casa` de `busca.ts`.
- Produz:

```ts
export type Coluna = 'estrutura' | 'material' | 'maoDeObra'
/** 1 = novo (adição), 3 = retirado (devolução). Mão de obra é sempre 1. */
export type SituacaoItem = 1 | 3
export interface ItemCaderno {
  codigo: string
  qtd: number
  situacao: SituacaoItem
  /** digitado à mão, fora da base: vai em vermelho */
  digitado?: { descricao: string; unidade: string }
}
export interface PosteCaderno { id: string; nome: string; feito: boolean; itens: Record<Coluna, ItemCaderno[]> }
export type SituacaoRede = 1 | 2 | 3 | 'S'
export interface LinhaRede { id: string; cabo: string; /** só no S; vazio = o mesmo cabo */ caboRetirado?: string; situacao: SituacaoRede; metros: string }
export interface Rede {
  linhas: LinhaRede[]
  itens: Record<'material' | 'maoDeObra', ItemCaderno[]>        // à mão (cabo sem regra, extras)
  mao: Record<string, number>                                    // chaveLinha → quantidade final mudada à mão (0 = tirar)
  confirmadas: string[]                                          // chaves de linhas "a confirmar" já confirmadas
  feito: boolean
}
export type ItemAro = 'cinta' | 'poste' | 'cabo' | 'trafo'
export interface Caderno {
  versao: 1
  ot: string
  area: Area
  postes: PosteCaderno[]
  rede: Rede
  aroMao: Partial<Record<ItemAro, number>>
  /** chaveLinha → quantidade no momento em que foi marcada como lançada */
  lancadas: Record<string, number>
}
export interface LinhaSoma {
  chave: string // chaveLinha(coluna, situacao, codigo)
  coluna: Coluna
  situacao: SituacaoItem
  codigo: string
  descricao: string
  unidade: string
  qtd: number
  foraDaBase: boolean   // digitado à mão ou código que não está (mais) na base
  origem: string[]      // nomes dos postes, ou 'Rede'
  conta?: string        // só cabos
}
export interface ItemBusca { codigo: string; descricao: string; unidade: string; norm: string }

export const otValida: (ot: string) => boolean
export const chaveLinha: (coluna: Coluna, situacao: SituacaoItem, codigo: string) => string // 'material:1:900001'
export function cadernoNovo(ot: string, area: Area): Caderno        // sem postes, rede vazia
export function cadernoVazio(c: Caderno): boolean                    // sem item em poste nenhum e sem linha na Rede
export function novoPoste(c: Caderno): Caderno                       // 'P' + (maior número usado + 1)
export function tirarPoste(c: Caderno, id: string): Caderno          // só tira poste sem item; com item, devolve igual
export function marcarFeito(c: Caderno, id: string): { caderno: Caderno; proximo: string | null } // próximo poste; depois do último, null (a tela vai para a Rede)
export function adicionarItem(c: Caderno, posteId: string | 'rede', coluna: Coluna, item: ItemCaderno): Caderno // mesmo código e situação: soma qtd
export function mudarQtd(c: Caderno, posteId: string | 'rede', coluna: Coluna, codigo: string, situacao: SituacaoItem, n: number, digitado: boolean): Caderno
export function mudarSituacao(c: Caderno, posteId: string, coluna: 'estrutura' | 'material', codigo: string, de: SituacaoItem, para: SituacaoItem): Caderno // junta se já existe a outra
export function contaMetros(texto: string): { metros: number; valida: boolean }
export function descrever(coluna: Coluna, codigo: string, base: BaseEnel, mo: BaseMaoDeObra | null): { descricao: string; unidade: string; naBase: boolean }
export function indiceDeBusca(coluna: Coluna, base: BaseEnel, mo: BaseMaoDeObra | null): ItemBusca[]
export function buscar(indice: ItemBusca[], termo: string, max?: number): ItemBusca[] // max padrão 20
export function somaDoPoste(p: PosteCaderno, base: BaseEnel, mo: BaseMaoDeObra | null): LinhaSoma[]
export function juntar(...listas: LinhaSoma[][]): LinhaSoma[] // soma por chave; ordem: estrutura, material, maoDeObra; dentro, situação 1 e depois 3; dentro, a ordem da 1ª vez
export function estaLancada(c: Caderno, l: LinhaSoma): boolean   // c.lancadas[l.chave] === l.qtd
export function marcarLancada(c: Caderno, l: LinhaSoma): Caderno
export function desmarcarLancada(c: Caderno, l: LinhaSoma): Caderno
export function trocarOt(atual: Caderno, otNova: string, guardado: Caderno | null): { acao: 'usar' | 'abrir-guardado' | 'perguntar'; caderno: Caderno }
```

Regras que os testes fixam:
- `mudarQtd`: com `digitado`, 0 deixa o item com qtd 0 (não some, não soma); pelo "−" (`digitado: false`) chegando a 0, o item sai. Negativo vira 0. Tudo por `arred`.
- `contaMetros`: aceita dígitos, `+`, espaço, vírgula ou ponto decimal (ambos são decimal; ponto como milhar não existe aqui). Vazio ou só espaço → `{ metros: 0, valida: true }`. `+` sobrando no começo ou no fim é ignorado. `++`, letra, `-`, `*` → `{ metros: 0, valida: false }`.
- `descrever`: estrutura em `base.estruturas` (unidade `UN`), material em `base.materiais`, mão de obra em `mo.atividades`; `naBase: false` com descrição vazia quando não acha (sem `mo`, toda atividade é `naBase: false`). O `digitado` do item vale por cima.
- `indiceDeBusca`: estrutura = chaves de `base.estruturas` (código + descrição); material = `base.materiais` (código + descrição + unidade); mão de obra = `mo.atividades` (código + descrição + unidade), lista vazia sem `mo`. `norm` = `normalizar` de tudo junto, feito uma vez.
- `somaDoPoste`: uma `LinhaSoma` por item com qtd > 0; `foraDaBase` quando há `digitado` ou `descrever(...).naBase` é falso; `origem: [p.nome]`.
- `trocarOt`: `otNova` igual à atual → `usar`; sem `guardado` → `usar` (o caderno muda de OT; a tela grava na nova e apaga a antiga); com `guardado` e o atual vazio → `abrir-guardado` (devolve o guardado); com `guardado` e o atual com itens → `perguntar` (devolve o atual sem mudar).

- [ ] **Passo 1: escrever os testes** em `src/ceara/caderno.test.ts` com:

```ts
const BASE: BaseEnel = {
  materiais: { '900001': ['POSTE TESTE 9 M', 'UN'], '900002': ['CINTA TESTE', 'UN'], '900003': ['TRANSFORMADOR TESTE', 'UN'], '900004': ['CONECTOR TESTE', 'UN'] },
  estruturas: { KITX1: 'ESTRUTURA TESTE', KITX2: 'DERIVAÇÃO TESTE' },
  kits: { KITX1: [['900004', 2]] },
}
const MO: BaseMaoDeObra = { atividades: { XX101: ['LANÇAMENTO DE CABO TESTE', 'm de rede'], XX102: ['POSTE TESTE', 'Unidade'] }, regrasCabo: [], aro: ARO_PADRAO }
```

Testes (nome → o que afirma):
- `OT válida` → `'1234567'` e `'17221234567'` sim; `'123456'`, `'12345678901'`, `'1234a67'` não.
- `postes começam vazios e numeram em sequência` → `cadernoNovo('1234567', 'SUL').postes` vazio; três `novoPoste` dão `P1`, `P2`, `P3`; tirar o `P2` vazio e criar outro dá `P4`; `tirarPoste` de poste com item não tira.
- `+1 no mesmo código soma; novo e retirado ficam separados` → `adicionarItem` duas vezes `{ codigo: '900001', qtd: 1, situacao: 1 }` dá uma linha com 2; com `situacao: 3` dá outra linha.
- `digitar 0 não tira; o menos até 0 tira` → `mudarQtd(..., 0, true)` mantém o item com 0 e `somaDoPoste` não traz a linha; `mudarQtd(..., 0, false)` tira; `mudarQtd(..., 0.5, true)` deixa 0,5.
- `mudar situação junta` → item 900001 qtd 1 em (1) e qtd 2 em (3); mudar o (1) para (3) dá uma linha (3) com 3.
- `conta dos metros` → `'32+35+30'` 97; `' 32 + 35 '` 67; `'32,5+10'` 42.5; `'32.5+10'` 42.5; `'32+'` 32; `''` `{ 0, true }`; `'32++35'`, `'32+a'`, `'-5'`, `'3*2'` `{ 0, false }`.
- `busca` → `buscar(indiceDeBusca('material', BASE, MO), 'p')` vazio (1 letra); `'cinta'` acha 900002; `'900 teste'` acha os 4; `buscar(..., 'conector', 1)` tem 1; `buscar(indiceDeBusca('maoDeObra', BASE, MO), 'metro rede')` acha XX101 (pela unidade); `indiceDeBusca('maoDeObra', BASE, null)` vazio; `'derivacao'` acha KITX2 (sem acento).
- `soma do poste e código que saiu da base` → poste com KITX1 (1), 900001 (1), 900099 (1, não está em BASE), XX102 (1) e `{ codigo: '999999', digitado: { descricao: 'PEÇA TESTE', unidade: 'UN' } }`: `foraDaBase` só no 900099 e no 999999; descrição do 999999 é `'PEÇA TESTE'`; `origem` `['P1']`.
- `soma da obra junta e ordena` → `juntar` de P1 e P2 com 900001 (1) em cada: uma linha qtd 2, `origem: ['P1', 'P2']`; ordem estrutura, material (1), material (3), mão de obra.
- `lançada sai da marca ao mudar a quantidade` → `marcarLancada` com qtd 2: `estaLancada` verdadeiro; a mesma chave com qtd 3: falso.
- `trocar a OT não mistura cadernos` → os quatro casos de `trocarOt` acima.
- [ ] **Passo 2: rodar e ver falhar:** `npx vitest run src/ceara/caderno.test.ts` → FALHA.
- [ ] **Passo 3: escrever `src/ceara/caderno.ts`** (funções puras, sempre devolvendo objeto novo; `id` de poste e de linha com `crypto.randomUUID()`).
- [ ] **Passo 4: rodar e ver passar:** `npx vitest run src/ceara/caderno.test.ts`; `npx tsc -b` sem erro.
- [ ] **Passo 5: commit** `git commit -m "Ceará: regras do caderno do orçamento"`

---

### Tarefa 5: Rede, ARO e soma da obra

**Arquivos:**
- Criar: `src/ceara/rede.ts`, `src/ceara/aro.ts`, `src/ceara/cadernoObra.ts`
- Teste: `src/ceara/rede.test.ts`

**Interfaces:**
- Usa: Tarefa 1 (`lerCabo`, `converterCabos`), Tarefa 2 (`BaseMaoDeObra`, `RegraCabo`, `ARO_PADRAO`), Tarefa 4 (tipos, `contaMetros`, `chaveLinha`, `juntar`, `somaDoPoste`).
- Produz:

```ts
// rede.ts
export interface LinhaRedeCalculada { id: string; metros: number; valida: boolean; caboConhecido: boolean; semRegraMaoDeObra: boolean }
export interface RedeCalculada {
  linhas: LinhaRedeCalculada[]
  /** o que vai para a soma: automático com a mão por cima, os confirmados e os itens à mão */
  soma: LinhaSoma[]
  /** chaveLinha → quantidade que o automático daria (para "mudado à mão") */
  automatico: Record<string, number>
  /** sugeridas por regra com `confirmar`, ainda não confirmadas: não entram na soma */
  aConfirmar: LinhaSoma[]
  /** metros puros das linhas (1) e S válidas, para o ARO */
  metrosNovos: number
}
export function calcularRede(rede: Rede, base: BaseEnel, mo: BaseMaoDeObra | null): RedeCalculada

// aro.ts
export interface LinhaAro { item: ItemAro; rotulo: 'Cinta' | 'Poste' | 'Cabo (m)' | 'Trafo'; automatico: number; valor: number; mudadoAMao: boolean; deOnde: string }
export function calcularAro(c: Caderno, soma: LinhaSoma[], metrosNovos: number, mo: BaseMaoDeObra | null): LinhaAro[] // ordem: Cinta, Poste, Cabo (m), Trafo

// cadernoObra.ts
export function somaDaObra(c: Caderno, base: BaseEnel, mo: BaseMaoDeObra | null): { soma: LinhaSoma[]; rede: RedeCalculada; aro: LinhaAro[] }
export function somaPorPoste(c: Caderno, base: BaseEnel, mo: BaseMaoDeObra | null): { nome: string; feito: boolean; linhas: LinhaSoma[] }[] // os postes e, no fim, 'Rede'
/** Sem a mão de obra; estrutura com _S na adição e _E na devolução, como a Leitura do CAD. */
export function paraOrcamento(soma: LinhaSoma[]): Orcamento
/** Código como vai para a Enel e para o Excel (estrutura com _S/_E). */
export function codigoEnel(l: LinhaSoma): string
```

Regras:
- **Metros:** soma por (situação, cabo) como `contarObra`. S gera (1) com `cabo` e (3) com `caboRetirado || cabo`. Linha (2) não é material. Linha inválida (`valida: false`) não entra em nada.
- **Material:** `converterCabos(cabosSomados, 3, base, adicao, devolucao)` com `fases: lerCabo(nome).fases ?? 3` nos cabos de MT. Linhas que voltam com `semCodigo` (cabo desconhecido) não entram na soma: a linha da Rede fica `caboConhecido: false` e a tela pede o material à mão. As outras viram `LinhaSoma` de material com `origem: ['Rede']` e `conta`.
- **Mão de obra:** para cada (situação, cabo), a 1ª regra de `mo.regrasCabo` com o mesmo `grupo` de `lerCabo`, a situação (`1` → `novo`, `2` → `tensionado`, `3` → `retirado`; S → `novo` e `retirado`) e a bitola na lista (ou sem lista). `por: 'metro'` → metros; `por: 'condutor'` → metros × condutores (MT: fases ou 3; BT nu: condutores ou 1; BT pré-reunido: 1). Soma por código. Sem regra (ou sem `mo`): `semRegraMaoDeObra: true` na linha.
- **Mão:** `rede.mao[chave]` substitui a quantidade automática da chave (0 tira da soma); `automatico[chave]` guarda a que o site daria. Regra com `confirmar` vai para `aConfirmar` até a chave estar em `rede.confirmadas`. `rede.itens` entram como em `somaDoPoste`, com `origem: ['Rede']`.
- **ARO:** `poste`, `cinta`, `trafo` = soma das `LinhaSoma` de material, situação 1, cuja descrição normalizada começa com um dos começos da lista (`mo?.aro ?? ARO_PADRAO`, também normalizados). `cabo` = `metrosNovos`. `c.aroMao[item]` definido → `valor` = ele, `mudadoAMao: true`; o `automatico` continua calculado. `deOnde`: `soma dos materiais de poste em adição`, `soma dos materiais de cinta`, `metros dos cabos novos e substituídos, sem porcentagem e sem kg`, `soma dos materiais de transformador`.
- **Soma da obra:** `juntar(...postes.map(somaDoPoste), rede.soma)`.

- [ ] **Passo 1: escrever os testes** em `src/ceara/rede.test.ts` (BASE e MO da Tarefa 4, com `regrasCabo`: `{ bt-multi, novo, XX101, metro }`, `{ bt-nu, retirado, XX105, condutor }`, `{ bt-multi, tensionado, XX104, metro, confirmar: true }` e `XX104`/`XX105` em `atividades`; nenhum código de material escrito: as quantidades e `conta` do cabo são comparadas com `converterCabos`):
  - `novo: metros, material com 5% e mão de obra por metro` → linha `{ cabo: 'AM035T', situacao: 1, metros: '32+35+30' }`: `metros` 97; material de adição com quantidade 102 e `conta '97 m + 5%'`; XX101 com 97; `metrosNovos` 97.
  - `substituído põe o novo e retira o velho` → `{ cabo: 'AM035T', caboRetirado: '2AN004', situacao: 'S', metros: '100' }`: material na adição (o novo) e na devolução (o velho, em kg, como `converterCabos`); XX101 100; XX105 200 (2 condutores); `metrosNovos` 100.
  - `retirado não vai para o ARO` → `{ cabo: '2AN004', situacao: 3, metros: '50' }`: `metrosNovos` 0; XX105 100.
  - `tensionado espera confirmar` → `{ cabo: 'AM035T', situacao: 2, metros: '40' }`: nenhum material; XX104 em `aConfirmar` com 40 e fora da `soma`; com a chave em `confirmadas`, XX104 40 na `soma`.
  - `cabo desconhecido fica à mão` → `{ cabo: '3#4CAA', situacao: 1, metros: '30' }`: `caboConhecido: false`, `semRegraMaoDeObra: true`, nada na soma; `metrosNovos` 30 (o ARO conta metros puros).
  - `mudar à mão e o automático guardado` → `mao[chave de XX101] = 90` com 97 m: soma 90, `automatico` 97; `mao = 0` tira a linha.
  - `conta inválida não soma` → `metros: '32+a'`: `valida: false`, nada na soma, `metrosNovos` 0.
  - `sem lista de mão de obra` → `calcularRede(..., null)`: material igual, nenhuma mão de obra, `semRegraMaoDeObra: true`.
  - `ARO pelo material e pelos metros puros` → P1 com 900001 (1) e 900002 (2), P2 com 900001 (1, situação 3) e 900003 (1), Rede com 97 m novos: Cinta 2, Poste 1, Cabo (m) 97, Trafo 1.
  - `ARO mudado à mão não volta sozinho` → `aroMao.poste = 5`: `valor` 5, `mudadoAMao`, `automatico` 1; depois de mais um poste novo no caderno, `valor` continua 5 e `automatico` 2.
  - `para o comparar da Leitura do CAD` → `paraOrcamento` de uma soma com KITX1 (1) novo e (3) retirado, 900001 (2) e XX101 (5): `adicaoEstrutura` tem `KITX1_S` 1, `devolucaoEstrutura` `KITX1_E` 1, `adicaoMaterial` `900001` 2, e nenhum bloco tem XX101.
  - `soma por poste com a Rede no fim` → nomes `['P1', 'P2', 'Rede']`.
- [ ] **Passo 2: rodar e ver falhar:** `npx vitest run src/ceara/rede.test.ts` → FALHA.
- [ ] **Passo 3: escrever** `rede.ts`, `aro.ts` e `cadernoObra.ts`.
- [ ] **Passo 4: rodar e ver passar:** `npx vitest run src/ceara`; `npx tsc -b` sem erro.
- [ ] **Passo 5: commit** `git commit -m "Ceará: Rede, ARO e soma da obra do caderno"`

---

### Tarefa 6: Excel do caderno (Leitura do CAD idêntica)

**Arquivos:**
- Modificar: `src/ceara/excel.ts`
- Teste: `src/ceara/ceara.test.ts` (describe "Excel da contagem")

**Interfaces:**
- Usa: Tarefas 4 e 5.
- Produz:

```ts
export async function gerarExcelCaderno(soma: LinhaSoma[], aro: LinhaAro[], cab: Cabecalho): Promise<Uint8Array>
export function nomeDoExcelCaderno(ot: string): string // '<OT> - ORÇAMENTO.xlsx' (o mesmo nome do orçamento feito à mão)
```

Regras:
- A montagem do zip (`[Content_Types].xml`, rels, `workbook.xml` com `definedNames`, `styles.xml`) vira uma função interna usada pelos dois Excel; `gerarExcelCeara` continua com a mesma assinatura e o mesmo resultado.
- Abas, nesta ordem: as 4 de `BLOCOS` (mesmas colunas e estilos de hoje, com `codigoEnel` e `foraDaBase` → vermelho; a Adição de material com RESPONSÁVEL como hoje), `MÃO DE OBRA` (DATA, ÁREA, EMPRESA, OT, CÓDIGO, DESCRIÇÃO, QTD, com filtro, sem RESPONSÁVEL) e `ARO` (cabeçalho `ITEM | QUANTIDADE | COMO SAIU`; uma linha por item na ordem do ARO; COMO SAIU `automático` ou `mudado à mão (o automático daria N)`, N com vírgula; sem filtro).
- Sem estilo novo.

- [ ] **Passo 1: travar o Excel de hoje:** teste `Excel da Leitura do CAD não muda (hash de cada parte)` → para o `r` do teste "4 abas no modelo da Enel" e para o `r` com estratificação (os dois já no arquivo), o sha256 (`node:crypto`) do texto de cada arquivo dentro do zip. Rodar **antes de mexer** em `excel.ts`, copiar os hashes para o teste como literais e ver passar.
- [ ] **Passo 2: escrever os testes do caderno** (soma montada à mão com códigos inventados):
  - `6 abas na ordem` → nomes `['ADIÇÃO ESTRUTURA', 'DEVOLUÇÃO ESTRUTURA', 'ADIÇÃO MATÉRIAL', 'DEVOLUÇÃO MATÉRIAL', 'MÃO DE OBRA', 'ARO']`; `nomeDoExcelCaderno('1234567')` é `'1234567 - ORÇAMENTO.xlsx'`.
  - `lido de volta igual ao comparar` → `lerOrcamento(bytes)` igual, bloco a bloco (código e quantidade), a `paraOrcamento(soma)`.
  - `mão de obra e ARO` → na MÃO DE OBRA, `E2` `'XX101'` e `G2` 97; no ARO, `A1` `'ITEM'`, a linha do Poste com `B` 5 e `C` `'mudado à mão (o automático daria 1)'`, a do Cabo (m) com `C` `'automático'`.
  - `fora da base em vermelho` → linha de material com `foraDaBase` sai com estilo `S_CENTRO + S_VERMELHO` na coluna E (atributo `s="4"` no XML).
- [ ] **Passo 3: rodar e ver falhar:** `npx vitest run src/ceara/ceara.test.ts` → FALHA só nos testes novos do caderno.
- [ ] **Passo 4: escrever** a função comum e `gerarExcelCaderno`.
- [ ] **Passo 5: rodar e ver passar:** `npx vitest run src/ceara` → PASSA, com os hashes do Passo 1 iguais.
- [ ] **Passo 6: conferir no Excel de verdade:** gerar um arquivo com dados inventados por script no scratchpad e abrir com `scripts/abrir-no-excel.ps1`: abre sem aviso de reparo, 6 abas legíveis.
- [ ] **Passo 7: commit** `git commit -m "Ceará: Excel do caderno com mão de obra e ARO"`

---

### Tarefa 7: banco do navegador versão 4 (cadernos por OT e pessoa)

**Arquivos:**
- Modificar: `src/lib/banco.ts`, `src/plataforma/acesso.tsx`
- Teste: `src/lib/banco.test.ts`

**Interfaces:**
- Usa: `Caderno` (Tarefa 4, `import type`) e `otValida` (Tarefa 4).
- Produz:

```ts
export const LOJA_CADERNOS = 'cadernos'
export interface CadernoGuardado { chave: string; pessoa: string; ot: string; atualizado: string; caderno: Caderno } // chave = `${pessoa}:${ot}`, atualizado ISO
export async function lerCaderno(pessoa: string, ot: string): Promise<CadernoGuardado | null>   // sem IndexedDB: null
export async function gravarCaderno(pessoa: string, caderno: Caderno, agora?: Date): Promise<boolean> // false sem IndexedDB ou com OT inválida
export async function apagarCaderno(pessoa: string, ot: string): Promise<boolean>
export async function listarCadernos(pessoa: string): Promise<{ ot: string; atualizado: string }[]> // só os da pessoa, mais novo primeiro

// acesso.tsx: o objeto devolvido por useAcesso ganha
idPessoa: string | null // perfil.id quando pronto, como `pessoa`
```

Regras:
- `VERSAO` 3 → 4; `onupgradeneeded` cria `cadernos` (`keyPath: 'chave'`) sem tocar nas outras lojas. Atualizar o comentário do topo.
- O padrão de `lerBase`/`gravarBase` (`comBanco`, `try/catch` que engole a falta de IndexedDB).

- [ ] **Passo 1: escrever os testes** em `src/lib/banco.test.ts`:
  - o teste de migração espera `db.version` 4;
  - `migra da versão 3 sem perder técnicos, bases e ajustes` (abrir a versão 3 com as três lojas, um registro em cada; `abrirBanco`; ler os três de volta; `lerCaderno('p1', '1234567')` é `null`);
  - `grava, lê e lista por pessoa` (`p1` com OT 1234567 e 7654321, `p2` com 1234567: `listarCadernos('p1')` tem 2, o mais novo primeiro; o caderno de `p2` não muda o de `p1`);
  - `OT inválida não grava` (`gravarCaderno('p1', cadernoNovo('123', 'SUL'))` é `false` e nada fica guardado);
  - `apagar` (`apagarCaderno('p1', '1234567')` e `lerCaderno` volta `null`);
  - no teste "sem IndexedDB": `gravarCaderno` é `false`, `lerCaderno` `null`, `listarCadernos` `[]`, sem lançar erro.
- [ ] **Passo 2: rodar e ver falhar:** `npx vitest run src/lib/banco.test.ts` → FALHA.
- [ ] **Passo 3: escrever** as funções e o `idPessoa` no `useAcesso`.
- [ ] **Passo 4: rodar e ver passar:** `npm test`, `npx tsc -b`.
- [ ] **Passo 5: commit** `git commit -m "Banco do navegador versão 4: caderno do orçamento por OT"`

---

### Tarefa 8: tela do caderno, parte 1 (OT, postes, três colunas, somas, guardar)

**Arquivos:**
- Criar: `src/components/ceara/caderno/Caderno.tsx`, `src/components/ceara/caderno/ColunaItens.tsx`, `src/components/ceara/caderno/Somas.tsx`, `src/components/ceara/caderno/guardar.ts`
- Modificar: `src/components/ceara/Ceara.tsx`, `src/App.tsx`
- Modificar: `e2e/fluxo.mjs` (função nova `cearaCaderno()`, chamada logo depois de `ceara()`, também com `E2E_SO=ceara`)

**Interfaces:**
- Usa: Tarefas 2, 4, 5, 7; `Botao`, `Campo`, `Painel`, `Selo`, `Titulo`, `Quantidade` de `ui.tsx`; o padrão de busca e foco de `AjusteEstrutura.tsx`.
- Produz:

```ts
// nome do componente diferente do tipo Caderno da Tarefa 4
export function CadernoOrcamento(props: { base: BaseEnel; mo: BaseMaoDeObra | null; pessoa: string }): JSX.Element
// guardar.ts
export type EstadoGuardar = 'salvo' | 'salvando' | 'sem-ot' | 'sem-banco'
export function useGuardarCaderno(pessoa: string, caderno: Caderno): EstadoGuardar // grava 400 ms depois da última mudança; grava na hora no pagehide e ao desmontar
```

**Em `Ceara.tsx` e `App.tsx`:** `Ferramenta` ganha `'caderno'` (ícone `Notebook`), item `Caderno do orçamento` no grupo `Pronto`, logo depois da Leitura do CAD. `Ceara` recebe `maoDeObra` e `pessoa` (`acesso.idPessoa`); o `App` passa `bases.maoDeObra`. O comentário do topo de `Ceara.tsx` diz que o caderno existe.

**A tela (rascunho D):**
- Título `Caderno do orçamento`, com subtítulo curto (o que é e que fica salvo neste computador).
- **Cabeçalho:** `Campo` OT (só dígitos, até 11), área (os mesmos botões SUL / LESTE / CENTRO SUL da Leitura do CAD) e o estado da gravação com palavra: `Salvo neste computador`, `Salvando...`, `Não está sendo salvo: digite a OT (7 dígitos, ou 11 começando com 1722)`, `Não está sendo salvo: este navegador não guarda dados`. Seletor `Abrir caderno guardado` (`<select>` com `listarCadernos`, texto `1234567, salvo em 05/11 14:32`) e botão `Novo caderno` (grava o atual e abre um vazio, sem OT).
  - A OT vale ao sair do campo ou com Enter (não a cada tecla: no meio de uma OT de 11 dígitos, os 7 primeiros já parecem uma OT). Com OT válida: `lerCaderno` + `trocarOt`. `perguntar` mostra um aviso com `Abrir o guardado` e `Ficar com este (substitui o guardado)`; até a resposta, nada é gravado. `usar` com OT anterior válida e diferente: grava na nova e `apagarCaderno` da antiga.
- **À esquerda:** lista dos postes (`P1`, `P2`... com o selo `feito`), botão `+ Poste` e, no fim, `Rede` (o bloco da Rede vem na Tarefa 9; aqui o item já aparece e abre um painel vazio com o título). Lista vazia: `Nenhum poste ainda. Crie com "+ Poste", como no papel.` Poste aberto com `aria-current`. No celular, a lista vira uma faixa rolável de lado, como o `MenuLateral`.
- **No centro, o poste aberto:** título `Poste P1`, três `ColunaItens` (Estrutura, Material, Mão de obra) lado a lado no computador e uma embaixo da outra abaixo de `lg`; `Feito, próximo →` (marca e abre o próximo; no último, abre a Rede) e `Tirar este poste` (só com poste vazio).
- **`ColunaItens`:** busca `type="search"` rotulada `Buscar estrutura` / `Buscar material` / `Buscar mão de obra`; resultados como botões `Adicionar <código> <descrição>` (até 20; `Nada na base com "<texto>"`); depois de adicionar, a busca limpa e o foco volta para ela. Mão de obra sem lista: texto `A lista de mão de obra não chegou: digite o código à mão.`. Botão `Não achei: digitar à mão` abre Código, Descrição e Unidade (como no `AjusteEstrutura`). Cada item: código, descrição, `Quantidade` (passo 1, rótulo `Quantidade de <código>`), e, em Estrutura e Material, um seletor `(1) novo` / `(3) retirado` rotulado `Situação de <código>`. Ao passar um material para (3), se `codigoDeSucata` conhece, aparece `Na devolução, este material costuma voltar como <código de sucata>.` com o botão `Trocar para <código>`. Fora da base: selo `fora da base` (digitado) ou `não está mais na base` (código salvo que sumiu), em vermelho com a palavra.
- **Embaixo (`Somas.tsx`):** `Soma de cada poste` (tabela em região rolável com `tabIndex=0`, uma linha por poste e a Rede, três colunas com `qtd código`) e `Soma da obra` (três colunas, adição e devolução separadas por subtítulo `Novo` / `Retirado`).

**No e2e (`cearaCaderno()`, a 1366 e a 390, tema escuro, com o falso servindo `mao-de-obra.json`):** os códigos vêm de `../bases/enel.json` e `../bases/mao-de-obra.json` lidos no próprio teste (a 1ª estrutura de `estruturas`; o 1º material cuja descrição começa com `POSTE`; a 1ª atividade), nunca escritos.
- abrir `Caderno do orçamento` pelo menu; OT `1234567` + Enter; `+ Poste`; adicionar um material; `Novo caderno`; OT `7654321` + Enter; ver `Salvo neste computador`;
- `+ Poste` três vezes; no P1, buscar e adicionar uma estrutura, um material poste e uma atividade; `Aumentar` duas vezes na estrutura; digitar `0,5` na quantidade da atividade (foco continua e o valor fica `0,5`);
- `Feito, próximo →` leva ao P2 e o P1 mostra `feito`;
- na `Soma da obra`, a estrutura com 3;
- clicar `Aumentar` no material e **recarregar na hora**: depois do login, voltar ao caderno, abrir pelo seletor a OT `7654321` e ver o material com 2;
- trocar a OT deste caderno (com itens) para `1234567` + Enter: aparece a pergunta e nada é gravado; `Abrir o guardado` mostra o caderno de 1 poste; abrir de novo a `7654321` pelo seletor e ver os 3 postes;
- axe (`${tag} caderno poste`) e largura (`scrollWidth <= largura + 1`); print `13-ceara-caderno.png`.

- [ ] **Passo 1: escrever o e2e** acima.
- [ ] **Passo 2: rodar e ver falhar:** `npm run build && E2E_SO=ceara node e2e/fluxo.mjs` → falha em "Caderno do orçamento".
- [ ] **Passo 3: escrever** os componentes, o hook e as mudanças em `Ceara.tsx`/`App.tsx`.
- [ ] **Passo 4: rodar e ver passar:** `npx tsc -b`, `npm run lint`, `npm test`, `npm run build && E2E_SO=ceara node e2e/fluxo.mjs` → "Tudo passou.", zero axe, sem página mais larga.
- [ ] **Passo 5: olhar os prints** `1366-dark-13-ceara-caderno.png` e `390-dark-13-ceara-caderno.png` ao lado do rascunho D.
- [ ] **Passo 6: commit** `git commit -m "Ceará: caderno do orçamento, postes e somas"`

---

### Tarefa 9: tela do caderno, parte 2 (Rede e ARO)

**Arquivos:**
- Criar: `src/components/ceara/caderno/BlocoRede.tsx`, `src/components/ceara/caderno/PainelAro.tsx`
- Modificar: `src/components/ceara/caderno/Caderno.tsx`, `e2e/fluxo.mjs` (`cearaCaderno()`)

**Interfaces:**
- Usa: Tarefas 1 (`nomesDeCabo`), 4, 5; `ColunaItens` da Tarefa 8.

**`BlocoRede`:**
- Tabela (região rolável) com uma linha por cabo: `Cabo` (campo com `list` de um `<datalist>` de `nomesDeCabo()`, rótulo `Cabo da linha N`), `Situação` (`(1) novo`, `(2) tensionado ou realocado`, `(3) retirado`, `substituído (retira o velho e põe o novo)`), `Cabo retirado` (só no substituído, vazio = o mesmo), `Metros` (rótulo `Metros da linha N, pode somar: 32+35+30`), `Total` (os metros da conta, ou `conta com erro` em vermelho com a palavra) e `Tirar linha N`. Botão `+ Cabo`.
- Cabo que o site não conhece: `cabo sem regra: lance o material à mão abaixo`; sem regra de mão de obra: `sem regra de mão de obra: lance à mão abaixo`.
- Embaixo, duas colunas: `Vai para Material` e `Vai para Mão de obra`, com as linhas de `rede.soma` (código, descrição, a `conta`, quantidade em `Quantidade`); mudar a quantidade grava em `rede.mao` e mostra o selo `mudado à mão` com `o automático daria N` e `Voltar ao automático`. As de `aConfirmar` aparecem com o selo `a confirmar`, o texto `Só vale se o cabo for ancorado.` quando a regra é de tensionar, e o botão `Confirmar <código>`. Abaixo de cada coluna, a busca de `ColunaItens` para pôr à mão (vai em `rede.itens`).
- `Feito` na Rede marca `rede.feito`.

**`PainelAro`** (à direita no computador, embaixo no celular): título `ARO`, `calculado da soma`; uma linha por `LinhaAro` com `Campo` numérico rotulado pelo item; selo `automático` + `deOnde`, ou selo `mudado à mão` + `o automático daria N` + botão `Voltar ao automático` (some e o foco vai para o campo do item). Digitar grava em `aroMao`; só o botão volta.

**No e2e:**
- abrir `Rede`; `+ Cabo`; cabo `AM035T`, situação `(1) novo`, metros `32+35+30` → Total 97; em `Vai para Material`, quantidade 102; em `Vai para Mão de obra`, 97 (regra do pré-reunido novo do `regras-mao-de-obra.json`);
- ARO: `Cabo (m)` 97 e `Poste` 1 (o material poste do P1);
- digitar 5 no Poste → `mudado à mão` e `o automático daria 1`; `Voltar ao automático` → 1 e `automático`;
- metros `32+a` → `conta com erro`, depois corrigir para `32+35+30`;
- recarregar, voltar ao caderno `7654321` pelo seletor e ver a linha da Rede com Total 97;
- axe (`${tag} caderno rede`) e largura; print `14-ceara-caderno-rede.png`.

- [ ] **Passo 1: escrever o e2e.**
- [ ] **Passo 2: rodar e ver falhar:** `npm run build && E2E_SO=ceara node e2e/fluxo.mjs` → falha em "+ Cabo".
- [ ] **Passo 3: escrever** os componentes.
- [ ] **Passo 4: rodar e ver passar:** os mesmos comandos da Tarefa 8.
- [ ] **Passo 5: olhar os prints** a 1366 e 390.
- [ ] **Passo 6: commit** `git commit -m "Ceará: Rede e ARO no caderno"`

---

### Tarefa 10: saídas (Lançar na Enel, Excel, Comparar com a Leitura do CAD)

**Arquivos:**
- Criar: `src/components/ceara/caderno/LancarEnel.tsx`
- Modificar: `src/components/ceara/caderno/Caderno.tsx`, `src/components/ceara/Ceara.tsx`, `e2e/fluxo.mjs` (`cearaCaderno()`)

**Interfaces:**
- Usa: Tarefas 5 (`somaDaObra`, `paraOrcamento`, `codigoEnel`), 6 (`gerarExcelCaderno`, `nomeDoExcelCaderno`), 7 (`lerCaderno`).
- Muda: `CadernoOrcamento` recebe também `leitura: { ot: string; lida: boolean }` e `onComparar: (orc: Orcamento, ot: string) => void`.

**Botões no fim do caderno:** `Lançar na Enel`, `Comparar com a Leitura do CAD`, `Baixar Excel` (este desabilitado sem OT válida, como na Leitura do CAD).

**`LancarEnel`** (abre no lugar do poste, com `Voltar ao caderno`):
- Fila = `soma` da obra na ordem de `juntar`; texto da aba em cima: `Estrutura, adição`, `Estrutura, devolução`, `Material, adição`, `Material, devolução`, `Mão de obra`.
- Duas caixas grandes: Código (`codigoEnel`) com `Copiar código` e Quantidade (`formatarQtd`, com vírgula) com `Copiar quantidade`; descrição embaixo. Copiar usa `navigator.clipboard.writeText`; deu certo → `Copiado` em `role="status"`; falhou → `Não deu para copiar: selecione o número e use Ctrl+C.`
- `Lançada, próxima →` (`marcarLancada` e avança) e `← Voltar uma` (volta sem desmarcar; linha já lançada mostra o selo `lançada`). Abre na 1ª linha não lançada.
- Barra `role="progressbar"` com `aria-valuenow`/`aria-valuemax` e o texto `N de M lançadas`. Tudo lançado: `Tudo lançado.`
- As marcas ficam em `caderno.lancadas` (gravadas com o caderno).

**Excel:** `gerarExcelCaderno(soma, aro, { ot, area, data: new Date() })`, baixado como `nomeDoExcelCaderno(ot)`; `Baixado: <nome>` em `role="status"`; com linhas `foraDaBase`, a frase `N linhas saem em vermelho no Excel...` como na Leitura do CAD.

**Comparar:**
- No caderno: com `leitura.lida` e `leitura.ot === caderno.ot` → `onComparar(paraOrcamento(soma), ot)`. Senão: `Leia o DXF da OT <ot> na Leitura do CAD e volte aqui.` em `role="status"`.
- Em `Ceara.tsx`: `onComparar` põe o orçamento no estado da Leitura do CAD (`setOrcamento`, `setNomeOrc('Caderno da OT <ot>')`) e abre a Leitura do CAD. Na Leitura do CAD, com resultado lido e `ot` válida, `lerCaderno(pessoa, ot)`; se existe, aparece o botão `Comparar com o caderno` ao lado do envio do orçamento, que faz o mesmo. A mão de obra fica fora (o `Orcamento` não tem esse bloco). Quem não tem caderno não vê o botão.

**No e2e:**
- `Lançar na Enel`: `ctx.grantPermissions(['clipboard-read', 'clipboard-write'])`; `Copiar código` → `navigator.clipboard.readText()` igual ao código mostrado; `Lançada, próxima →` → `1 de N lançadas`; voltar ao caderno, aumentar a quantidade da 1ª linha, voltar ao lançar → `0 de N lançadas`;
- `Baixar Excel` → nome `7654321 - ORÇAMENTO.xlsx`; com JSZip, `workbook.xml` tem as 6 abas na ordem;
- Comparar: na Leitura do CAD, ler o `ceara.dxf` com OT `7654321`; no caderno, `Comparar com a Leitura do CAD` abre a Leitura do CAD com `Linhas iguais ao orçamento`; o botão `Comparar com o caderno` aparece na Leitura do CAD;
- axe (`${tag} caderno lançar`, `${tag} comparar com o caderno`) e largura; print `15-ceara-caderno-lancar.png`;
- o fluxo `ceara()` de hoje passa sem mudança (Leitura do CAD sem caderno da OT `1234567` não mostra `Comparar com o caderno`).

- [ ] **Passo 1: escrever o e2e.**
- [ ] **Passo 2: rodar e ver falhar:** `npm run build && E2E_SO=ceara node e2e/fluxo.mjs` → falha em "Lançar na Enel".
- [ ] **Passo 3: escrever** `LancarEnel.tsx` e as mudanças.
- [ ] **Passo 4: rodar e ver passar:** os mesmos comandos da Tarefa 8.
- [ ] **Passo 5: olhar os prints** e abrir o Excel baixado em `e2e/saida` no Excel do PC.
- [ ] **Passo 6: commit** `git commit -m "Ceará: lançar na Enel, Excel e comparação do caderno"`

---

### Tarefa 11: conferência final e mostrar ao Italo

**Arquivos:** nenhum novo (só correções que a revisão pedir).

- [ ] **Passo 1: rodar tudo:** `npm test`, `npm run lint`, `npm run build`, `node scripts/conferir-dist.mjs` ("dist limpo", agora também com a lista de mão de obra), `python -m unittest scripts/test_atualizar_base.py`, `npm run e2e` (o fluxo inteiro) → "Tudo passou.", zero axe.
- [ ] **Passo 2: revisão do ramo inteiro** por um agente que não construiu, com a especificação e este plano, olhando o "Foco da revisão" e o "Não pode acontecer" da especificação.
- [ ] **Passo 3: nada real no git:** `git diff 9f154be --stat`; procurar no diff códigos de 6 dígitos fora dos inventados (`9000xx`, `999999`), códigos de três letras + três dígitos fora de `XX1xx`, e `git status` sem `regras-mao-de-obra.json` nem `mao-de-obra.json`.
- [ ] **Passo 4: subir a lista de mão de obra** só com o OK do Italo: rodar o trecho novo do `esquema.sql` no Supabase, depois `python scripts/atualizar_base.py mao-de-obra ...` sem `--seco`, e `node scripts/conferir-supabase.mjs`.
- [ ] **Passo 5: deixar em localhost:4400** (`npm run build`; `node servir.mjs`) e mostrar ao Italo com os prints a 1366 e 390 px e um Excel de exemplo.
- [ ] **Passo 6: atualizar a memória** (`fechamento-plataforma-ideias.md`) e a passagem, se a conversa ficar grande.
