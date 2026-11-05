# Visual "Vidro e foto" — Plano de construção

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Os cabeçalhos das tarefas são "### Task N:" de propósito: o script `task-brief` da skill só acha esse formato.

**Goal:** Trocar o visual de todas as telas da plataforma pelo modelo "2 · Vidro e foto" com as regras limpas aprovadas, sem mudar nenhuma regra, contagem, Excel ou fluxo.

**Architecture:** Primeiro a base (tokens novos em `src/index.css`, nível de vidro decidido uma vez no `<html>`, foto da equipe baixada do Supabase depois do login e guardada no IndexedDB), depois uma casca comum (herói com foto, faixa de foto, pílulas, barra flutuante) e por fim cada tela passa para a casca: login, Regiões, Ceará (entrada + Leitura do CAD) e EDP. Lógica nova em funções puras com vitest; telas conferidas pelo `e2e/fluxo.mjs`.

**Tech Stack:** Vite 6, React 19, TypeScript 5.8, Tailwind 4 (`@theme` em `src/index.css`), Supabase JS 2, vitest 2 + fake-indexeddb, Playwright (e2e), Python 3 (`scripts/atualizar_base.py`).

**Spec:** `docs/2026-11-05-visual-vidro-e-foto-design.md`. Referência visual: `..\rascunhos-plataforma\i-tres-modelos.html` (telas `#t-m2-ent` e `#t-m2-res`, classes `.m2 ...`, linhas 157-344). Regras e menu lateral: `..\rascunhos-plataforma\h-site-limpo.html` (`#t-cad`, `#t-edp`, tabela "O que muda").

## Global Constraints

- Ramo `supabase`, **sem push**. Commit por tarefa, mensagem em português, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Começa só depois da mão de obra pelo DXF** estar no ramo e só quando o Italo pedir (Task 0 confere).
- Repositório público: nada de código real da Enel, OT real, nome de colega, foto do pessoal ou chave. Testes e e2e com dados inventados (EXEMPLO-E01, 9001xx, OT 1234567, "Maria Souza").
- Todo texto da tela em português; sem travessão (—) no texto da tela.
- Fonte só Sora (`'Sora Variable'`); números com `.num` (tabular), nunca monoespaçada.
- Cores só por variável de `src/index.css`; nenhuma cor solta (`#…`, `rgb(…)`) em `.tsx`.
- Vidro (`backdrop-filter`) só em peça sobre a foto; desfoque máximo 24 px; nunca animar o desfoque; peça presa (`sticky`/`fixed`) só tem desfoque no nível `completo`.
- Sem `data-vidro` no `<html>` = visual **sem vidro** (sólido): é o padrão seguro.
- Contraste AA medido sobre o fundo sólido (pior caso): texto 4,5:1; texto grande e bordas de controle 3:1.
- Movimento até 300 ms, curva que desacelera; tudo desligado com `prefers-reduced-motion: reduce`.
- Alvos de toque de 48 px no celular; campos com 16 px; `overflow-x: clip`, nunca página mais larga que a tela.
- Política de segurança (`vite.config.ts`) não muda: a foto entra como `blob:` (já liberado em `img-src`) e vem do Supabase (já em `connect-src`).
- Nenhuma regra muda: `src/ceara/*`, `src/state.ts`, `src/etapas.ts`, `src/lib/busca.ts` e os Excels ficam como estão (só leitura).
- Conferência de cada tarefa de tela: `npm test`, `npm run lint`, `npm run build`, `npm run e2e` (ou `E2E_SO=ceara npm run e2e` nas tarefas do Ceará).

## Review Focus

1. **Foto clara atrás do texto:** com uma foto inventada quase branca, o título e o cartão continuam legíveis (o degradê escuro é obrigatório). Teste na Task 4 (contraste com a foto clara do e2e).
2. **Sem conexão / primeiro acesso:** sem foto guardada e sem servidor, as telas abrem com a provisória e o selo; nada fica em branco nem trava esperando a foto. Teste na Task 2 (`garantirFotoEquipe` sem fonte) e Task 4 (e2e com `abortarFoto`).
3. **Voltar com trabalho:** "← Regiões" ou "Sair" com leitura do CAD na tela pede confirmação; "← Ceará" não perde a leitura. Teste na Task 6.
4. **Celular estreito (360 px) com a barra do Excel:** a barra presa não cobre a última linha da lista nem o botão "Ajustar"; a página não fica mais larga que a tela. Teste na Task 7.
5. **Nível sem vidro forçado:** com `?vidro=sem`, nenhuma peça tem `backdrop-filter` e o contraste continua AA. Teste na Task 9.

---

## Mapa de arquivos

| Arquivo | O que faz |
|---|---|
| `src/index.css` | tokens do modelo 2 + utilitários `.vidro`, `.vidro-preso`, `.solido`, raios |
| `src/plataforma/vidro.ts` (+ `.test.ts`) | decide o nível de vidro (`completo`/`parado`/`sem`) |
| `src/main.tsx` | grava `data-vidro` no `<html>` antes do primeiro `render` |
| `src/lib/banco.ts` (+ teste) | `lerFotoEquipe` / `gravarFotoEquipe` na loja `bases` (chave `foto-equipe`) |
| `src/nuvem/fotoEquipe.ts` (+ `.test.ts`) | `garantirFotoEquipe`: versão, baixar, conferir, guardar |
| `src/nuvem/supabase.ts` | `fonteFotoSupabase` |
| `supabase/esquema.sql`, `docs/supabase-passo-a-passo.md` | nome `foto-equipe` aceito na tabela `bases` |
| `scripts/atualizar_base.py` (+ `test_atualizar_base.py`) | comando `foto` |
| `e2e/supabase-falso.mjs`, `e2e/fixtures/foto-equipe-falsa.webp` | foto inventada no Supabase falso |
| `src/plataforma/casca/` | `FotoEquipe.tsx` (contexto), `Heroi.tsx`, `FaixaFoto.tsx`, `Pilula.tsx`, `PilulaPessoa.tsx`, `BarraFlutuante.tsx`, `casca.css` |
| `src/plataforma/Entrada.tsx`, `NovaSenha.tsx`, `EscolherFoto.tsx`, `Preparando.tsx`, `plataforma.css` | login no vidro |
| `src/plataforma/Painel.tsx` | Regiões com foto, crachá e cartão de vidro |
| `src/components/ceara/EntradaCeara.tsx`, `CascaCeara.tsx`, `Ceara.tsx` | entrada do Ceará, casca das ferramentas, menu lateral |
| `src/components/ceara/abas.ts` (+ `.test.ts`), `AbasResultado.tsx`, `BarraExcel.tsx`, `TabelaBloco.tsx` | resultado da Leitura do CAD |
| `src/components/Inicio.tsx`, `Etapas.tsx`, `Revisao.tsx`, `ui.tsx` | EDP |
| `src/App.tsx` | provedor da foto, conta na casca, confirmação ao voltar do Ceará |
| `e2e/fluxo.mjs` | textos e telas novas, quatro tamanhos, `?vidro=sem` |

---

### Task 0: Ponto de partida (sem código)

**Files:** nenhum.

- [ ] **Step 1:** `git log --oneline -15` e `git status`. Esperado: a mão de obra pelo DXF commitada (bloco "Mão de obra" na Leitura do CAD); nenhuma outra conversa com arquivos do Ceará sem commit. Se a mão de obra não estiver lá, **parar e perguntar ao Italo** (a aba Mão de obra da Task 7 fica de fora até ela chegar).
- [ ] **Step 2:** `npm test && npm run lint && npm run build && npm run e2e`. Esperado: tudo passa. Anotar o número de testes no registro da construção.
- [ ] **Step 3:** Ler `src/components/ceara/Ceara.tsx` como ficou com a mão de obra e anotar no registro: onde mora o estado da mão de obra, quais blocos ela mostra e quantas abas o Excel tem agora. A Task 7 usa isso.

---

### Task 1: Tokens do modelo 2 e nível de vidro

**Files:**
- Create: `src/plataforma/vidro.ts`, `src/plataforma/vidro.test.ts`
- Modify: `src/index.css`, `src/main.tsx`

**Interfaces:**
- Produces:
  - `type NivelVidro = 'completo' | 'parado' | 'sem'`
  - `interface Ambiente { suporta: boolean; menosTransparencia: boolean; ponteiroFino: boolean; toque: boolean; memoria?: number; nucleos?: number; economia?: boolean; pedido?: string | null }`
  - `nivelVidro(a: Ambiente): NivelVidro`
  - `lerAmbiente(): Ambiente` (lê `CSS.supports('backdrop-filter','blur(1px)') || CSS.supports('-webkit-backdrop-filter','blur(1px)')`, `matchMedia('(prefers-reduced-transparency: reduce)')`, `(pointer: fine)`, `(pointer: coarse)`, `navigator.deviceMemory`, `navigator.hardwareConcurrency`, `connection.saveData`, e `pedido` = parâmetro `?vidro=` da URL)
  - CSS: `html[data-vidro]`; classes `.vidro` (cartão e pílula sobre a foto), `.vidro-preso` (barra flutuante), `.solido` (superfície lisa)
  - Tokens (nomes fixos, usados pelas tarefas seguintes): `--bg #0e0e10`, `--surface #18181b`, `--surface-hover #1f1f23`, `--line rgb(255 255 255 / .08)`, `--line-strong rgb(255 255 255 / .16)`, `--text #f5f5f6`, `--muted #b1b1b8`, `--faint #8e8e96`, `--accent #5abd79`, `--accent-text #86d6a1`, `--accent-soft rgb(90 189 121 / .18)`, `--dif #f59a88`, `--aviso #e8c46a`, `--vidro-fundo rgb(28 28 32 / .55)`, `--vidro-borda rgb(255 255 255 / .16)`, `--vidro-brilho rgb(255 255 255 / .12)`, `--vidro-solido #1c1c20`, `--preso-solido rgb(30 30 34 / .96)`, `--botao-claro #ffffff`, `--botao-claro-hover #e9e9ec`, `--botao-claro-texto #111111`; raios `--radius-card 22px`, `--radius-vidro 24px`, `--radius-linha 18px`, `--radius-ctl 999px`. Os tokens antigos que ainda têm uso (`--danger`, `--ok`, `--surface-2`, `--accent-ink`, `--accent-hover`) continuam, com valores conferidos no contraste.

- [ ] **Step 1: testes de `nivelVidro`** em `vidro.test.ts`:

```ts
const base: Ambiente = { suporta: true, menosTransparencia: false, ponteiroFino: true, toque: false, memoria: 8, nucleos: 8 }
it('computador com mouse tem vidro completo', () => expect(nivelVidro(base)).toBe('completo'))
it('celular bom tem vidro parado', () => expect(nivelVidro({ ...base, ponteiroFino: false, toque: true, memoria: 8, nucleos: 8 })).toBe('parado'))
it('celular com 4 GB fica sem vidro', () => expect(nivelVidro({ ...base, ponteiroFino: false, toque: true, memoria: 4 })).toBe('sem'))
it('celular com 4 núcleos fica sem vidro', () => expect(nivelVidro({ ...base, ponteiroFino: false, toque: true, nucleos: 4 })).toBe('sem'))
it('economia de dados fica sem vidro', () => expect(nivelVidro({ ...base, economia: true })).toBe('sem'))
it('menos transparência fica sem vidro', () => expect(nivelVidro({ ...base, menosTransparencia: true })).toBe('sem'))
it('navegador sem backdrop-filter fica sem vidro', () => expect(nivelVidro({ ...base, suporta: false })).toBe('sem'))
it('memória desconhecida no celular não derruba o vidro', () => expect(nivelVidro({ ...base, ponteiroFino: false, toque: true, memoria: undefined, nucleos: 8 })).toBe('parado'))
it('?vidro= vence a detecção (teste)', () => expect(nivelVidro({ ...base, pedido: 'sem' })).toBe('sem'))
it('?vidro= inválido é ignorado', () => expect(nivelVidro({ ...base, pedido: 'xyz' })).toBe('completo'))
```

- [ ] **Step 2:** `npx vitest run src/plataforma/vidro.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar `vidro.ts`. Ordem: `pedido` válido → ele; `!suporta || menosTransparencia || economia` → `sem`; `toque && (memoria <= 4 || nucleos <= 4)` → `sem`; `ponteiroFino && !toque` → `completo`; senão `parado`. Comentário no topo explicando o porquê (ls-celular: desfoque em peça presa engasga ao rolar).
- [ ] **Step 4:** `npx vitest run src/plataforma/vidro.test.ts` → PASS.
- [ ] **Step 5:** Em `src/main.tsx`, antes do `createRoot(...).render`: `document.documentElement.dataset.vidro = nivelVidro(lerAmbiente())` dentro de `try/catch` (erro = não grava nada = sem vidro).
- [ ] **Step 6:** Em `src/index.css`: trocar os tokens do `:root` pelos da lista acima, ligar os novos no `@theme` (`--color-dif`, `--color-surface-hover`, `--radius-card` etc.), e escrever os utilitários. `.vidro` e `.vidro-preso` começam **sólidos** (`background: var(--vidro-solido)` / `var(--preso-solido)`, borda `--vidro-borda`, `box-shadow: inset 0 1px 0 var(--vidro-brilho), 0 24px 60px rgb(0 0 0 / .35)`); `html[data-vidro='completo'] .vidro, html[data-vidro='parado'] .vidro` e `html[data-vidro='completo'] .vidro-preso` ganham `background: var(--vidro-fundo); backdrop-filter: blur(22px) saturate(150%); -webkit-backdrop-filter: …`. Comentário no topo: o site é sempre escuro por enquanto; o claro entra depois trocando só estas variáveis.
- [ ] **Step 7:** `npm test && npm run lint && npm run build`. Esperado: passa. O site ainda tem o layout antigo com as cores novas: conferir num print rápido que nada ficou ilegível (o e2e completo roda na Task 4).
- [ ] **Step 8: Commit** `git add src/index.css src/main.tsx src/plataforma/vidro.ts src/plataforma/vidro.test.ts` → `git commit -m "Visual: tokens do Vidro e foto e nível de vidro por aparelho"`

---

### Task 2: Foto da equipe — guardar e baixar

**Files:**
- Create: `src/nuvem/fotoEquipe.ts`, `src/nuvem/fotoEquipe.test.ts`
- Modify: `src/lib/banco.ts`, `src/lib/banco.test.ts`, `src/nuvem/supabase.ts`

**Interfaces:**
- Produces:
  - `interface FotoGuardada { versao: string; foto: Blob }`
  - `lerFotoEquipe(): Promise<FotoGuardada | null>` e `gravarFotoEquipe(f: FotoGuardada): Promise<void>` em `banco.ts`, na loja `bases` existente com `nome: 'foto-equipe'` (**sem** mudar `VERSAO`, sem mexer em `NomeBase`)
  - `interface FonteFoto { versaoFoto(): Promise<{ versao: string; arquivo: string } | null>; baixar(arquivo: string): Promise<Blob> }`
  - `garantirFotoEquipe(fonte: FonteFoto | null, guarda?: { ler: typeof lerFotoEquipe; gravar: typeof gravarFotoEquipe }): Promise<Blob | null>` — **nunca lança**
  - `fonteFotoSupabase(c: SupabaseClient): FonteFoto` em `supabase.ts` (`from('bases').select('versao,arquivo').eq('nome','foto-equipe').maybeSingle()`; sem linha → `null`; download do balde `bases`)
  - `FOTO_MAXIMA = 1_500_000` (bytes)

- [ ] **Step 1: testes** em `fotoEquipe.test.ts` (com fonte e guarda falsas em memória; `Blob` de tipo `image/webp`):
  - `'sem fonte e sem cópia devolve null'`
  - `'sem fonte devolve a cópia guardada'`
  - `'servidor sem a linha foto-equipe devolve a cópia (ou null) e não baixa'` (conta chamadas de `baixar` = 0)
  - `'mesma versão não baixa de novo'` (chamadas = 0, devolve a guardada)
  - `'versão nova baixa, grava e devolve a nova'` (guarda tem `versao: 'v2'` depois)
  - `'arquivo que não é imagem não grava e devolve a cópia antiga'` (tipo `text/html`)
  - `'arquivo maior que FOTO_MAXIMA não grava'`
  - `'versaoFoto que lança devolve a cópia guardada'`
  - `'baixar que lança devolve a cópia guardada'`
- [ ] **Step 2: testes** em `banco.test.ts` (fake-indexeddb): `'grava e lê a foto da equipe'` (mesma versão e mesmo `size`) e `'foto da equipe não aparece como base'` (`lerBase('enel')` continua `null` depois de gravar a foto).
- [ ] **Step 3:** `npx vitest run src/nuvem/fotoEquipe.test.ts src/lib/banco.test.ts` → FAIL.
- [ ] **Step 4:** Implementar `lerFotoEquipe`/`gravarFotoEquipe` (mesmo padrão de `lerBase`/`gravarBase`, com `comBanco`), `garantirFotoEquipe` e `fonteFotoSupabase`. Conferir a imagem por `blob.type.startsWith('image/')` **ou** pelos 12 primeiros bytes (`RIFF....WEBP`), porque o Storage pode devolver `application/octet-stream`.
- [ ] **Step 5:** `npx vitest run …` → PASS; `npm test && npm run lint`.
- [ ] **Step 6: Commit** `git add src/lib/banco.ts src/lib/banco.test.ts src/nuvem/fotoEquipe.ts src/nuvem/fotoEquipe.test.ts src/nuvem/supabase.ts` → `git commit -m "Foto da equipe: baixar do Supabase depois do login e guardar no navegador"`

---

### Task 3: Foto da equipe no Supabase, no script e no e2e

**Files:**
- Modify: `supabase/esquema.sql`, `docs/supabase-passo-a-passo.md`, `scripts/atualizar_base.py`, `scripts/test_atualizar_base.py`, `e2e/supabase-falso.mjs`, `scripts/conferir-supabase.mjs` (se ele lista os nomes aceitos)
- Create: `e2e/fixtures/foto-equipe-falsa.webp` (imagem **inventada**, sem pessoas: degradê com formas, 1920×1080, menos de 60 KB) e `e2e/fixtures/foto-equipe-clara.webp` (quase branca, para o teste de contraste)

**Interfaces:**
- Consumes: `fonteFotoSupabase` (Task 2): linha `nome = 'foto-equipe'` na tabela `bases`, arquivo no balde `bases`.
- Produces:
  - SQL: `check (nome in ('enel', 'edp', 'foto-equipe'))` no `create table` **e** um bloco idempotente para quem já tem a tabela: `alter table public.bases drop constraint if exists bases_nome_check; alter table public.bases add constraint bases_nome_check check (nome in ('enel','edp','foto-equipe'));`
  - Script: `python scripts/atualizar_base.py foto "<foto.webp>" [--seco]` → confere, sobe `foto-equipe-<versao>.webp`, grava a linha (`contagens: {"bytes": n, "largura": w, "altura": h}`), apaga o arquivo antigo
  - `simularSupabase(page, { …, fotoEquipe?: string, abortarFoto?: boolean })`: com `fotoEquipe` (nome do arquivo em `e2e/fixtures`, pasta versionada: `e2e/dados` fica fora do git por ter dados reais), a linha `foto-equipe` entra na resposta de `/rest/v1/bases` e o arquivo é servido no balde; `abortarFoto` derruba só o download da foto

- [ ] **Step 1: testes Python** em `test_atualizar_base.py`:
  - `test_foto_aceita_webp` (WebP pequeno feito no teste: cabeçalho `RIFF`/`WEBP` + chunk `VP8 `)
  - `test_foto_recusa_nao_webp` (PNG → `ErroBase` com "A foto precisa ser .webp")
  - `test_foto_recusa_grande` (> 1.500.000 bytes → `ErroBase`)
  - `test_foto_recusa_exif` (chunk `EXIF` ou `XMP ` → `ErroBase` "A foto tem dados de câmera (EXIF/GPS): exporte de novo sem eles")
  - `test_foto_versao_muda_com_o_arquivo`
- [ ] **Step 2:** `python -m unittest scripts/test_atualizar_base.py` (sem `-I`: o openpyxl não aparece com `-I`) → FAIL.
- [ ] **Step 3:** Implementar `conferir_foto(caminho) -> dict` (lê os chunks RIFF em Python puro; largura/altura do `VP8 `/`VP8L`/`VP8X`) e o subcomando `foto` reaproveitando `versao`, `subir_arquivo`, `gravar_linha`, `apagar_arquivos` (tipo `image/webp`). `--seco` só confere e mostra.
- [ ] **Step 4:** `python -m unittest scripts/test_atualizar_base.py` → PASS.
- [ ] **Step 5:** SQL e passo a passo: seção nova "10. Foto da equipe" em `docs/supabase-passo-a-passo.md` com (a) rodar o bloco do `alter table` no SQL Editor, (b) `python scripts/atualizar_base.py foto "<caminho>"`, (c) como conferir no painel. Escrever para o Italo, passo a passo, sem jargão.
- [ ] **Step 6:** Gerar as duas fotos inventadas (ex.: `ffmpeg -f lavfi -i "gradients=s=1920x1080:c0=0x3a4a40:c1=0x1a1a1e" -frames:v 1 -c:v libwebp -q:v 70`; a clara com cores quase brancas) e o `simularSupabase` novo.
- [ ] **Step 7:** `npm run lint && npm run e2e` → passa (nada usa a foto ainda).
- [ ] **Step 8: Commit** `git add supabase/esquema.sql docs/supabase-passo-a-passo.md scripts/atualizar_base.py scripts/test_atualizar_base.py e2e/supabase-falso.mjs e2e/fixtures/foto-equipe-falsa.webp e2e/fixtures/foto-equipe-clara.webp` (+ `scripts/conferir-supabase.mjs` se mudou) → `git commit -m "Foto da equipe: nome no Supabase, comando no script e foto inventada no e2e"`

---

### Task 4: Casca comum e a foto em todas as telas de dentro

**Files:**
- Create: `src/plataforma/casca/FotoEquipe.tsx`, `Heroi.tsx`, `FaixaFoto.tsx`, `Pilula.tsx`, `PilulaPessoa.tsx`, `BarraFlutuante.tsx`, `casca.css`
- Modify: `src/plataforma/acesso.tsx`, `src/App.tsx`, `e2e/fluxo.mjs`

**Interfaces:**
- Consumes: `garantirFotoEquipe`, `fonteFotoSupabase` (Task 2); `.vidro`, `.vidro-preso`, tokens (Task 1).
- Produces:
  - `FOTO_PROVISORIA = \`${import.meta.env.BASE_URL}plataforma/entrada.webp\``
  - `<FotoEquipeProvedor fonte={FonteFoto | null} ativo={boolean}>` e `useFotoEquipe(): { src: string; provisoria: boolean }` (cria e revoga o `URL.createObjectURL`; enquanto não há foto, `src = FOTO_PROVISORIA`, `provisoria = true`). `ativo` = já entrou (bases prontas): a foto só é pedida depois do login.
  - `<Heroi titulo: ReactNode; sub?: ReactNode; topo: ReactNode; lado?: ReactNode; children?: ReactNode; tamanho?: 'grande' | 'medio'>` — foto da equipe, cinza 85 %, escurecida, degradê até `--bg`; selo "Foto provisória" quando `provisoria`; `lado` é o cartão de vidro à direita (computador) / embaixo (celular)
  - `<FaixaFoto topo: ReactNode>` — faixa de 200 px (144 px no celular) com a mesma foto desfocada e escura
  - `<Pilula onClick | href, icone, children>` (vidro, 40 px; 48 px no celular)
  - `<PilulaPessoa pessoa: Pessoa; onTrocarFoto; onTrocarSenha; onSair; antesDeSair?: () => boolean>` — nome + iniciais; abre o menu com as 3 ações; `Esc` fecha; foco volta para a pílula; no celular o nome some e fica só a bolinha
  - `<BarraFlutuante rotulo: string; children>` — `position: sticky; bottom: calc(16px + env(safe-area-inset-bottom))`, classe `.vidro-preso`, `role="region"` com `aria-label={rotulo}`
  - `ContaContexto` (em `PilulaPessoa.tsx`): `{ pessoa, onTrocarFoto, onTrocarSenha, onSair }`, provido pelo `App.tsx`, para as telas de dentro não receberem 4 props a mais
- A foto: `<img>` com `alt="Equipe do fechamento"` quando é a da equipe e `alt=""` quando é a provisória; troca com esmaecer de 240 ms (sem animação com reduzir movimento); `decoding="async"`.

- [ ] **Step 1: e2e primeiro** (em `plataforma()` do `fluxo.mjs`, com `simular(page, { fotoEquipe: 'foto-equipe-falsa.webp' })`):
  - depois do login, nas Regiões, a `<img>` do herói tem `src` começando com `blob:` e `alt="Equipe do fechamento"`; o selo "Foto provisória" não aparece;
  - com `abortarFoto: true`: a `<img>` usa `plataforma/entrada.webp`, o selo aparece e a tela abre normalmente (sem espera);
  - recarregar sem rede para a foto (`abortarFoto: true` depois de uma visita com foto): a foto guardada (`blob:`) aparece;
  - a tela de login **nunca** pede a foto (nenhum pedido a `foto-equipe` antes do login: `page.on('request')`).
- [ ] **Step 2:** `npm run e2e` → FAIL nos novos.
- [ ] **Step 3:** Implementar os componentes e `casca.css` partindo de `.m2 .topo2`, `.heroi`, `.vidro`, `.pilula`, `.volta`, `.faixa-foto`, `.flut` do rascunho (linhas 157-227 e 313-344), com os tokens da Task 1. CSS do celular sem media query; computador com `@media (min-width: 861px)`.
- [ ] **Step 4:** Ligar: `acesso.tsx` expõe a fonte da foto (`nuvem ? fonteFotoSupabase(nuvem) : null`); `App.tsx` envolve as telas de dentro com `FotoEquipeProvedor` (`ativo` quando `pessoa && bases`) e `ContaContexto`. As telas ainda não usam a casca (Tasks 5-8); para o e2e do Step 1 o `Painel` já monta um `<Heroi>` provisório em cima do conteúdo atual.
- [ ] **Step 5:** `npm test && npm run lint && npm run build && npm run e2e` → PASS.
- [ ] **Step 6:** Teste de contraste do Review Focus 1: `simular(page, { fotoEquipe: 'foto-equipe-clara.webp' })`, rodar o `axe` nas Regiões (regra `color-contrast`) → 0 violações.
- [ ] **Step 7: Commit** `git add src/plataforma/casca src/plataforma/acesso.tsx src/App.tsx e2e/fluxo.mjs` → `git commit -m "Casca do Vidro e foto: herói, faixa, pílulas, barra flutuante e foto da equipe"`

---

### Task 5: Login e Regiões

**Files:**
- Modify: `src/plataforma/Entrada.tsx`, `NovaSenha.tsx`, `EscolherFoto.tsx`, `Preparando.tsx`, `AjusteFoto.tsx` (só se o diálogo usar classe que mudou), `Painel.tsx`, `plataforma.css`, `e2e/fluxo.mjs` (`plataforma()`, `cenasDoLogin()`)

**Interfaces:**
- Consumes: `Heroi`, `PilulaPessoa`, `ContaContexto`, `.vidro` (Tasks 1 e 4).
- Produces: nada novo para as próximas tarefas.

- [ ] **Step 1: e2e** (ajustar os existentes e somar):
  - login: o formulário está dentro de um elemento com a classe `vidro`; com `?vidro=completo` ele tem `backdrop-filter` diferente de `none`; com `?vidro=sem`, `none`;
  - login continua usando `plataforma/entrada.webp` e o selo "Foto provisória" (computador);
  - Regiões: sem os números 01/02/03 (nenhum `.pl-num`); clicar em qualquer ponto da linha da EDP abre a EDP; Sergipe mostra o aviso "Sergipe ainda está em construção." por ~2,6 s;
  - Regiões: "Trocar foto", "Trocar senha" e "Sair" ficam dentro do menu da pílula da pessoa (abrir com clique e com `Enter`; `Esc` fecha e o foco volta para a pílula);
  - crachá: no computador com mouse continua o 3D (canvas presente); no celular (390×844) o parado;
  - os avisos de hoje (`semGuardar`, bases sem conexão) aparecem abaixo da saudação.
- [ ] **Step 2:** `npm run e2e` → FAIL nos novos.
- [ ] **Step 3:** Login: o `.pl-bloco` passa a ser um cartão `.vidro` (raio `--radius-vidro`), campos e botão redondos, botão "Entrar" claro (`--botao-claro`), linha verde `.pl-energia` mantida. Nenhum texto, erro ou comportamento muda.
- [ ] **Step 4:** Regiões: `Painel.tsx` monta `<Heroi titulo={saudação} sub="Escolha a região que você vai fechar hoje." topo={logo + PilulaPessoa} lado={cartão .vidro com a lista}>`; crachá pendurado à esquerda sobre a foto no computador (o `pl-suporte` de hoje, sem a linha do cabeçalho); no celular: foto + saudação, crachá parado menor (máx. 200 px) e a lista. Tirar `.pl-num` e o `r.numero` da tela (o campo pode continuar em `regioes.ts`).
- [ ] **Step 5:** `npm test && npm run lint && npm run build && npm run e2e` → PASS.
- [ ] **Step 6: Commit** `git add src/plataforma e2e/fluxo.mjs` → `git commit -m "Visual: login e Regiões no Vidro e foto"`

---

### Task 6: Entrada do Ceará, casca das ferramentas e menu lateral

**Files:**
- Create: `src/components/ceara/EntradaCeara.tsx`, `src/components/ceara/CascaCeara.tsx`
- Modify: `src/components/ceara/Ceara.tsx`, `src/components/Etapas.tsx` (só o visual do `MenuLateral`, sem mudar a interface), `src/App.tsx`, `e2e/fluxo.mjs` (`ceara()`)

**Interfaces:**
- Consumes: `Heroi`, `FaixaFoto`, `Pilula`, `PilulaPessoa`, `ContaContexto` (Task 4); `MenuLateral` (já existe).
- Produces:
  - `type TelaCeara = 'entrada' | Ferramenta` (o `Ferramenta` de hoje: `'cad' | 'sucata' | 'correcoes' | 'nomeacao' | 'aro'`); o `Ceara` começa em `'entrada'`
  - `<EntradaCeara temLeitura: boolean; nomeDxf?: string; onAbrir: (f: Ferramenta) => void; onRegioes: () => void>`
  - `<CascaCeara atual: Ferramenta; onIr: (t: TelaCeara) => void; onRegioes: () => void; children>` — faixa de foto + pílulas ("← Ceará" no celular; trilha "Ceará › Leitura do CAD" no computador) + `MenuLateral` só a partir de 861 px ("Início do Ceará", Leitura do CAD, grupo "Em teste")
  - `CONFIRMA_REGIOES_CEARA = 'Voltar às regiões? A leitura desta obra será perdida.'` em `Ceara.tsx`; `onRegioes` e o "Sair" da pílula pedem `confirm` quando há `resultado`

- [ ] **Step 1: e2e** em `ceara()`:
  - abrir o Ceará mostra o título "Ceará", "Enel · Centro-Sul, Sul e Leste", o cartão "Leitura do CAD" com "Pronto" e "Abrir a Leitura do CAD", e os quatro cartões de "Em teste" (o texto "Em teste" aparece uma vez como título do grupo);
  - cada cartão em teste abre a página curta de hoje com os passos;
  - com uma leitura feita, voltar a "Ceará" mostra o cartão com o nome do DXF e "Continuar"; abrir de novo mostra a mesma leitura (nada perdido);
  - "← Regiões" com leitura: aparece o `confirm` com `CONFIRMA_REGIOES_CEARA`; "Cancelar" fica; "OK" vai para as Regiões. Sem leitura: vai direto (Review Focus 3);
  - computador (1440×900): menu lateral visível na Leitura do CAD; celular (390×844): sem menu lateral, com a pílula "Ceará"; 360×800: a fila de cartões desliza para o lado e a página não fica mais larga que a tela (`scrollWidth <= innerWidth`).
- [ ] **Step 2:** `E2E_SO=ceara npm run e2e` → FAIL.
- [ ] **Step 3:** Implementar `EntradaCeara` (partindo de `#t-m2-ent`; no celular os cartões `.c2` em fila com `scroll-snap`, `role="region"`, `aria-label="Ferramentas em teste"`, `tabindex="0"`), `CascaCeara` e o estado `TelaCeara` no `Ceara.tsx`. Mover o cabeçalho de hoje (OT/Área no topo) para a barra do Excel da Task 7: nesta tarefa ele só sai do topo.
- [ ] **Step 4:** Visual do `MenuLateral` sem caixa em volta: item atual com fundo `--surface` e texto `--text`, rótulo "Em teste" pequeno, sem linha. A EDP usa o mesmo componente: conferir que os passos da EDP continuam iguais no e2e.
- [ ] **Step 5:** `npm test && npm run lint && npm run build && npm run e2e` → PASS.
- [ ] **Step 6: Commit** `git add src/components/ceara src/components/Etapas.tsx src/App.tsx e2e/fluxo.mjs` → `git commit -m "Ceará: entrada com as ferramentas, casca com foto e menu lateral no computador"`

---

### Task 7: Resultado da Leitura do CAD (abas, linhas, barra do Excel)

**Files:**
- Create: `src/components/ceara/abas.ts`, `src/components/ceara/abas.test.ts`, `src/components/ceara/AbasResultado.tsx`, `src/components/ceara/BarraExcel.tsx`
- Modify: `src/components/ceara/Ceara.tsx`, `src/components/ceara/TabelaBloco.tsx`, `src/components/ceara/AjusteEstrutura.tsx` (só visual), `e2e/fluxo.mjs` (`ceara()`)

**Interfaces:**
- Consumes: `BarraFlutuante` (Task 4); `CascaCeara` (Task 6); `LinhaTela`, `TabelaBloco` (já existem); o estado da mão de obra anotado na Task 0.
- Produces:
  - `type Aba = 'dif' | 'est' | 'mat' | 'mo' | 'eti'`
  - `abasVisiveis(o: { temOrcamento: boolean; temMaoDeObra: boolean }): Aba[]` → com orçamento `['dif','est','mat',…]`; `'mo'` só se `temMaoDeObra`; sempre termina em `'eti'`
  - `abaInicial(temOrcamento: boolean): Aba` → `'dif'` ou `'est'`
  - `soDiferencas(linhas: LinhaTela[]): LinhaTela[]` → só `situacao !== 'igual'` (mantém a ordem)
  - `contarIguais(blocos: LinhaTela[][]): { iguais: number; total: number }` → só blocos de Estrutura e Material (mão de obra **não** entra)
  - `<BarraExcel ot; area; onOt; onArea; onBaixar; podeBaixar: boolean; vermelhas: number; baixado: string>` — computador: "Excel da obra", OT, Área, "Baixar Excel" (verde); celular: botão "OT 1234567 · Sul" (`aria-expanded`) que abre os campos + "Baixar Excel"; aviso de linhas vermelhas e "Baixado" como `role="status"` colados na barra

- [ ] **Step 1: testes** em `abas.test.ts`:

```ts
it('com orçamento abre em Diferenças', () => expect(abaInicial(true)).toBe('dif'))
it('sem orçamento abre em Estrutura', () => expect(abaInicial(false)).toBe('est'))
it('sem orçamento não há aba Diferenças', () => expect(abasVisiveis({ temOrcamento: false, temMaoDeObra: true })).toEqual(['est', 'mat', 'mo', 'eti']))
it('sem mão de obra não há a aba', () => expect(abasVisiveis({ temOrcamento: true, temMaoDeObra: false })).toEqual(['dif', 'est', 'mat', 'eti']))
it('só diferenças tira as iguais e mantém a ordem', () => expect(soDiferencas([l('A', 'igual'), l('B', 'diferente'), l('C', 'so-desenho')]).map((x) => x.codigo)).toEqual(['B', 'C']))
it('iguais contam só estrutura e material', () => expect(contarIguais([[l('A', 'igual'), l('B', 'diferente')], [l('C', 'igual')]])).toEqual({ iguais: 2, total: 3 }))
```
(`l(codigo, situacao)` monta uma `LinhaTela` inventada; usar os valores reais do tipo `situacao` de `TabelaBloco.tsx`.)

- [ ] **Step 2:** `npx vitest run src/components/ceara/abas.test.ts` → FAIL; implementar `abas.ts`; → PASS.
- [ ] **Step 3: e2e** em `ceara()` (DXF e orçamento inventados de hoje):
  - vazio: título "Leitura do CAD", uma linha e o botão "Como salvar em DXF?" (`aria-expanded` muda; o texto abre embaixo); área de soltar; "Comparar com um orçamento feito à mão (.xlsx)" opcional;
  - lendo: esqueleto presente (sem spinner);
  - resultado sem orçamento: abre em "Estrutura"; não há aba "Diferenças"; 4 números no resumo;
  - com orçamento: abre em "Diferenças"; ela só tem linhas que diferem; "Iguais ao orçamento" bate com `contarIguais`; nenhuma linha "igual" usa a cor `--dif`;
  - abas com `role="tablist"`/`tab`/`tabpanel`, setas do teclado trocam de aba;
  - "Ajustar" na própria linha de Adição de estrutura; o ajuste abre embaixo; só um aberto por vez; a sugestão do último ajuste continua aparecendo (fluxo de hoje);
  - "Itens que o site não reconheceu" e "Fora da contagem de propósito" viram uma linha cada com o número e um botão que abre a lista;
  - barra do Excel presa embaixo: com OT válida, "Baixar Excel" baixa o mesmo arquivo de hoje (nome e abas iguais aos do e2e atual); com linhas vermelhas, o aviso aparece colado na barra;
  - 360×800: a barra não cobre a última linha (o fim da lista tem folga ≥ altura da barra) e `scrollWidth <= innerWidth` (Review Focus 4).
- [ ] **Step 4:** `E2E_SO=ceara npm run e2e` → FAIL nos novos.
- [ ] **Step 5:** Implementar `AbasResultado`, `BarraExcel` e o novo layout do resultado no `Ceara.tsx` partindo de `#t-m2-res` (resumo `.sum2`, abas `.seg2`, linhas `.l2`, coral só em `.dif`, "igual" em `--faint`) e da barra `.excel-bar`/`ot-resumo` do rascunho H. `TabelaBloco` perde a caixa (`Painel`) em volta e ganha as linhas redondas; os títulos Adição/Devolução ficam pequenos. A aba "Mão de obra" recebe o bloco que a Task 0 anotou, sem mudar a lógica dele.
- [ ] **Step 6:** `npm test && npm run lint && npm run build && npm run e2e` → PASS. Conferir que o Excel baixado é idêntico ao de antes (o e2e já compara as abas).
- [ ] **Step 7: Commit** `git add src/components/ceara e2e/fluxo.mjs` → `git commit -m "Leitura do CAD: abas com Diferenças, linhas limpas e barra do Excel flutuante"`

---

### Task 8: EDP

**Files:**
- Modify: `src/components/Inicio.tsx`, `src/components/Etapas.tsx`, `src/components/Revisao.tsx`, `src/components/ui.tsx` (`Painel`, `Botao`, `Titulo`, `Selo`: só visual), `src/App.tsx` (casca dos passos), `e2e/fluxo.mjs` (`rodada`, `conferirRevisao`)

**Interfaces:**
- Consumes: `Heroi`, `FaixaFoto`, `Pilula`, `PilulaPessoa`, `BarraFlutuante` (Task 4).
- Produces: nada novo.

- [ ] **Step 1: e2e** (ajustar os existentes):
  - entrada da EDP: herói com foto; cartão `.vidro` com a área de soltar o inventário e "O arquivo é lido no seu computador. Nada é enviado e o original não muda."; erros de hoje (arquivo que não é .xlsx) aparecem dentro do cartão;
  - passos: faixa de foto no topo, menu lateral de hoje; títulos dos passos com 30 px no celular; a ajuda longa recolhida num botão;
  - Revisão: a barra de baixo vira `BarraFlutuante` (sólida no celular); o botão de baixar a ADS continua visível em 390×844 e 360×800;
  - **todas as checagens de regra e saída da EDP de hoje continuam iguais** (ADS, fichas, carimbo, boletim).
- [ ] **Step 2:** `npm run e2e` → FAIL nos novos.
- [ ] **Step 3:** `Inicio.tsx` no `Heroi` (título "EDP", sub "Fechamento de obra"); passos com `FaixaFoto` + pílulas; `ui.tsx`: `Painel` sem borda e com fundo `--surface` só onde é cartão de verdade, raios novos, `Botao` primário claro/verde conforme o rascunho; `Selo` "Em teste" pequeno, sem maiúsculas.
- [ ] **Step 4:** `npm test && npm run lint && npm run build && npm run e2e` → PASS.
- [ ] **Step 5: Commit** `git add src/components src/App.tsx e2e/fluxo.mjs` → `git commit -m "EDP no Vidro e foto: entrada com foto e passos limpos"`

---

### Task 9: Conferência final e mostrar ao Italo

**Files:** `e2e/fluxo.mjs` (só checagens); correções que a revisão pedir.

- [ ] **Step 1: e2e nos quatro tamanhos** (1440×900, 412×915, 360×800, 390×844) para login, Regiões, entrada do Ceará, Leitura do CAD com resultado e EDP: `axe` sem violações, `scrollWidth <= innerWidth`, alvos ≥ 48 px no celular.
- [ ] **Step 2: `?vidro=sem`** em todas essas telas: nenhum elemento com `backdrop-filter` diferente de `none` (`[...document.querySelectorAll('*')].filter(e => getComputedStyle(e).backdropFilter !== 'none').length === 0`) e `axe` `color-contrast` sem violações (Review Focus 5). **`?vidro=parado`**: a barra do Excel e a da Revisão sem desfoque.
- [ ] **Step 3: reduzir movimento** (`reducedMotion: 'reduce'`): nenhuma animação de entrada nem esmaecer da foto.
- [ ] **Step 4:** `npm test && npm run lint && npm run build && npm run e2e` e `node scripts/conferir-dist.mjs` → tudo passa; o `dist` não tem nenhuma foto além de `plataforma/entrada.webp` (`foto-equipe` não aparece).
- [ ] **Step 5:** Lighthouse celular do login (3 rodadas, antivírus bloqueado com `--blocked-url-patterns="*kaspersky-labs.com*"`): anotar a nota; não pode cair em relação à de hoje.
- [ ] **Step 6:** Prints em 1440 e 390 de cada tela, lado a lado com o rascunho `#m2-ent`/`#m2-res`, e uma revisão final por um agente que não construiu (ls-qualidade).
- [ ] **Step 7:** Mostrar ao Italo e pedir o teste **no celular dele** (rolar a Leitura do CAD com resultado; abrir a entrada do Ceará). Dizer com clareza que o teste automático não prova que está liso no aparelho. Ajustar os números do nível de vidro (Task 1) se ele sentir engasgo.
- [ ] **Step 8: Commit** das correções (se houver) → `git commit -m "Visual: correções da conferência final"`. **Sem push.** Publicar só com o OK do Italo.
