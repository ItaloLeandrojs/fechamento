# Login da equipe e bases no Supabase: plano de construção

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhar.

**Objetivo:** a base da Enel e os kits da EDP saem do código do site e passam a ficar no Supabase, atrás de um login com e-mail e senha só da equipe. O resto da plataforma continua funcionando como hoje.

**Arquitetura:**
- **No Supabase:**
  - a tabela `perfis` (nome, cargo, matrícula e a marca de senha inicial), onde cada pessoa só lê a própria linha;
  - a tabela `bases`, com a versão de cada base;
  - um bucket privado `bases`, com os arquivos `.json.gz`.
- **No site:**
  - o login é feito com `@supabase/supabase-js`;
  - o site confere a versão e baixa a base só quando ela muda;
  - as bases ficam guardadas no IndexedDB, no banco `fechamento`, que passa à versão 2 (a loja `tecnicos` continua e entra a loja `bases`).
- **No PC do Italo:** um script Python lê a planilha da Enel, confere, grava uma cópia local fora do repositório e sobe para o Supabase com a chave secreta.

**Tecnologia:** Vite 6 + React 19 + TypeScript 5.8, vitest 2, `@supabase/supabase-js` 2, `fake-indexeddb` (só nos testes), Python 3.12 + openpyxl (+ `unittest`, sem pytest), Playwright do curso + axe no e2e.

**Especificação:** `docs/2026-11-04-supabase-login-base-design.md`. Leia junto com este plano.

## Regras gerais
- Todo texto da tela em português, no tom do site. Sem travessão (—) nos textos da tela.
- Nada da Enel, kit da EDP, OT, nota, CPF, e-mail ou nome de colega em arquivo versionado. A chave secreta (`service_role`) nunca entra no site nem no repositório.
- As bases locais ficam em `C:\Users\italo.silva\Desktop\AUTOMACAO KIT MATERIAL\bases\`, fora do repositório (`../bases` a partir do `site-fechamento`):
  - `enel.json`, gravado pelo script;
  - `kits-edp.json`, movido de `src/data/kits.json`.
- Configuração:
  - **do site:** `site-fechamento/.env.local` (já ignorado pelo `*.local`), com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`;
  - **do script:** `AUTOMACAO KIT MATERIAL\supabase.env`, com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
- Senha nova: no mínimo **8 caracteres**. O mesmo valor vale no painel do Supabase (Authentication → Providers → Email → Minimum password length).
- Mensagens fixas da tela (`src/nuvem/mensagens.ts`):
  - `SENHA_ERRADA` = "E-mail ou senha errados."
  - `SEM_INTERNET` = "Sem internet. Confira a conexão e tente de novo."
  - `SERVIDOR_PARADO` = "O servidor não respondeu. Ele pode estar parado: avise o Italo."
  - `MUITAS_TENTATIVAS` = "Muitas tentativas seguidas. Espere um pouco e tente de novo."
  - `CADASTRO_INCOMPLETO` = "Seu cadastro ainda não está completo. Avise o Italo."
  - `PRIMEIRA_VEZ_SEM_INTERNET` = "Na primeira vez é preciso internet para baixar as bases. Conecte e tente de novo."
  - `SENHA_CURTA` = "A senha precisa ter pelo menos 8 caracteres."
  - `SENHAS_DIFERENTES` = "As duas senhas não são iguais."
  - `SENHA_IGUAL` = "Escolha uma senha diferente da inicial."
- Scripts `.ps1` rodam com `-ExecutionPolicy Bypass`. O bash do Claude bloqueia `.ps1`, então use a ferramenta PowerShell.
- Commits pequenos, um por tarefa, no ramo `supabase`, criado a partir do `main`. **Sem push e sem publicação** neste plano.
- Processo do projeto: um agente por tarefa e um revisor antes da próxima. No fim, `npm test`, `npm run build && npm run e2e` e uma revisão do ramo inteiro.

## Foco da revisão
Situações que a especificação não detalha, mas que mais podem atrapalhar quem usa, da mais provável para a menos. Cada uma tem teste na tarefa indicada.

1. **A internet cai no meio da descarga da base:** a base guardada antes continua valendo, nada fica pela metade, e na próxima vez baixa de novo. (Tarefa 3, teste `descarga que falha não estraga a guardada`)
2. **O Italo sobe uma planilha com uma aba renomeada ou com metade das linhas:** o script para antes de subir e explica o motivo. (Tarefa 4, `test_aba_faltando` e `test_queda_grande_pede_confirmacao`)
3. **Duas pessoas usam o mesmo PC:** a foto de uma não aparece no crachá da outra, e o técnico do carimbo não passa de uma para a outra. (Tarefa 6, `foto separada por pessoa`; Tarefa 7, mantém o `estadoDaPessoa(tecnicos)` no Sair)
4. **A sessão expira ou o perfil foi apagado enquanto a pessoa estava fora:** o site volta para a entrada com uma mensagem, sem tela branca. (Tarefa 5, `sem perfil vira cadastro incompleto`; Tarefa 8, cena e2e "sessão vencida")
5. **O e-mail é digitado com espaço ou letra maiúscula:** o login funciona igual. (Tarefa 5, `e-mail é limpo antes de entrar`)

---

### Tarefa 1: Esquema do Supabase e passo a passo do Italo

**Arquivos:**
- Criar: `supabase/esquema.sql`
- Criar: `docs/supabase-passo-a-passo.md`

**Interfaces:**
- Produz:
  - tabela `public.perfis(id uuid pk → auth.users on delete cascade, email text, nome text not null default '', cargo text not null default '', matricula text not null default '', senha_inicial boolean not null default true)`;
  - tabela `public.bases(nome text pk check (nome in ('enel','edp')), versao text not null, arquivo text not null, atualizado_em timestamptz not null default now(), contagens jsonb not null)`;
  - bucket privado `bases`;
  - função `public.marcar_senha_trocada()` (security definer, põe `senha_inicial = false` só na linha de `auth.uid()`).

- [ ] **Passo 1: escrever `supabase/esquema.sql`**, que pode rodar mais de uma vez (`if not exists`, `create or replace`, `drop policy if exists`). Conteúdo:
  - **as duas tabelas, com RLS ligado:**
    - `perfis`: só `select` com `id = auth.uid()`;
    - `bases`: só `select` para `authenticated`;
    - nenhuma regra de `insert`, `update` ou `delete` para `anon` nem para `authenticated`;
  - **o gatilho `after insert on auth.users`:** cria a linha em `perfis` com o `email` (função security definer com `set search_path = ''`);
  - **`marcar_senha_trocada()`:** `grant execute` só para `authenticated` e `revoke` de `public` e de `anon`;
  - **o bucket `bases`:** `insert into storage.buckets (id, name, public) values ('bases','bases', false) on conflict do nothing`;
  - **regra em `storage.objects`:** `select` para `authenticated` com `bucket_id = 'bases'`; sem regra de escrita.
- [ ] **Passo 2: escrever `docs/supabase-passo-a-passo.md`** para o Italo, em português simples, com uma seção para cada assunto:
  1. **Criar a conta e o projeto.** É ele quem faz, com o e-mail dele e o aceite dos termos. Plano Free, região South America (São Paulo), senha do banco guardada no gerenciador de senhas.
  2. **Rodar o esquema.** SQL Editor → colar o `supabase/esquema.sql` → Run.
  3. **Fechar o cadastro e ajustar a senha:**
     - Authentication → Sign In / Providers → desligar "Allow new users to sign up";
     - Email → "Confirm email" desligado;
     - tamanho mínimo da senha 8.
  4. **Pegar as chaves:**
     - Project Settings → API: a URL e a chave `anon`/publishable vão para `.env.local`;
     - a `service_role`/secret vai **só** para `AUTOMACAO KIT MATERIAL\supabase.env`. Explicar com destaque que essa chave nunca é colada em outro lugar.
  5. **Criar a conta de um colega:**
     - Authentication → Users → Add user → Create new user, com e-mail, senha inicial e "Auto Confirm User";
     - Table Editor → `perfis` → preencher nome, cargo e matrícula na linha do e-mail.
  6. **Trocar a senha de alguém:** Users → a pessoa → Reset password / Update password, e depois `perfis.senha_inicial` = true.
  7. **Tirar uma pessoa:** Users → Delete user (o perfil some junto).
  8. **Despausar:** Dashboard → Restore project.
  9. **Atualizar a base da Enel:** o comando da Tarefa 4.
- [ ] **Passo 3: conferir** que o SQL não tem nenhum e-mail, nome ou chave (`grep -n "@\|eyJ" supabase/esquema.sql` sem resultado, a não ser comentários).
- [ ] **Passo 4: commit**
```bash
git add supabase/esquema.sql docs/supabase-passo-a-passo.md
git commit -m "feat(supabase): esquema com regras de acesso e passo a passo do painel"
```

### Tarefa 2: Banco do navegador com as lojas `tecnicos` e `bases`

**Arquivos:**
- Criar: `src/lib/banco.ts`, `src/lib/banco.test.ts`
- Modificar: `src/lib/tecnicos.ts:18-28`, que passa a usar `abrirBanco()`
- Modificar: `package.json` (devDependency `fake-indexeddb`)

**Interfaces:**
- Produz:
  - `abrirBanco(): Promise<IDBDatabase>`: banco `fechamento` na versão 2. O `onupgradeneeded` cria `tecnicos` (keyPath `registro`) e `bases` (keyPath `nome`) só quando faltam.
  - `lerBase<T>(nome: 'enel' | 'edp'): Promise<{ nome; versao: string; dados: T } | null>`
  - `gravarBase(registro: { nome: 'enel' | 'edp'; versao: string; dados: unknown }): Promise<void>`
  - Ambas devolvem `null`, ou não fazem nada, quando o navegador não tem IndexedDB, como `listarTecnicos` faz hoje.

- [ ] **Passo 1: testes que falham**, em `src/lib/banco.test.ts`, com `import 'fake-indexeddb/auto'` e `new IDBFactory()` antes de cada teste:
  - `migra da versão 1 sem perder técnicos`: abre a versão 1 crua com a loja `tecnicos` e um registro; `abrirBanco()` → `listarTecnicos()` devolve o registro e `lerBase('enel')` devolve `null`.
  - `grava e lê uma base`: `gravarBase({nome:'enel', versao:'abc', dados:{x:1}})` → `lerBase('enel')` igual.
  - `gravar de novo substitui`: segunda versão `'def'` → `lerBase` tem `versao` `'def'`.
- [ ] **Passo 2:** `npx vitest run src/lib/banco.test.ts` → FALHA (módulo não existe).
- [ ] **Passo 3:** `npm i -D fake-indexeddb`. Implementar `banco.ts` e trocar o `abrir()` de `tecnicos.ts` por `abrirBanco()`.
- [ ] **Passo 4:** `npx vitest run src/lib` → PASSA. `npm test` inteiro → PASSA.
- [ ] **Passo 5: commit** `feat(banco): IndexedDB versão 2 com loja de bases, técnicos preservados`.

### Tarefa 3: Formato das bases e "baixa só quando muda"

**Arquivos:**
- Criar: `src/nuvem/bases.ts`, `src/nuvem/bases.test.ts`
- Modificar: `src/ceara/contagem.ts:70-73` (o tipo `BaseEnel`, junto do `Catalogo`)

**Interfaces:**
- Consome: `lerBase` e `gravarBase` (Tarefa 2) e `Kit` (`src/state.ts:16`).
- Produz:
  - `interface BaseEnel extends Catalogo { kits: Record<string, [codigo: string, qtd: number][]> }`, em `contagem.ts`. A chave é o `CODIGO_KIT` (sem `_E`), como em `estruturas`.
  - `interface FonteBases { versoes(): Promise<Record<'enel' | 'edp', { versao: string; arquivo: string }>>; baixar(arquivo: string): Promise<Blob> }`
  - `interface GuardaBases { ler: typeof lerBase; gravar: typeof gravarBase }`
  - `garantirBases(fonte: FonteBases, guarda?: GuardaBases): Promise<{ enel: BaseEnel; edp: Kit[]; avisos: string[] }>`. Lança `Error(PRIMEIRA_VEZ_SEM_INTERNET)` quando não consegue falar com o servidor e falta alguma base guardada.
  - `abrirGz(blob: Blob): Promise<unknown>`: `DecompressionStream('gzip')` + JSON.
  - `conferirBaseEnel(x: unknown): BaseEnel` e `conferirKitsEdp(x: unknown): Kit[]`: lançam um erro se o formato vier errado (objeto sem `materiais`, `estruturas` ou `kits`; lista vazia).

- [ ] **Passo 1: testes que falham**, com uma `FonteBases` e uma `GuardaBases` falsas em memória que contam as descargas:
  - `sem nada guardado baixa as duas e guarda`: `baixar` chamado 2 vezes; `guarda` tem `enel@v1` e `edp@v1`.
  - `mesma versão não baixa`: guarda já tem `v1`, fonte diz `v1` → `baixar` chamado 0 vezes.
  - `versão nova baixa só a que mudou`: enel `v2`, edp `v1` → 1 descarga, `guarda.enel.versao === 'v2'`.
  - `sem internet usa a guardada`: `versoes()` rejeita, guarda tem as duas → devolve as guardadas, e `avisos` contém uma frase com "sem conexão".
  - `sem internet e sem guardada`: rejeita com a mensagem `PRIMEIRA_VEZ_SEM_INTERNET`.
  - `descarga que falha não estraga a guardada`: guarda `v1`, fonte `v2`, `baixar` rejeita → devolve `v1` com aviso; guarda continua `v1`.
  - `arquivo com formato errado não é guardado`: `baixar` devolve o gz de `{}` → guarda continua `v1` e há um aviso.
  - `abrirGz lê o que o gzip do Node gravou`: `zlib.gzipSync(JSON.stringify({a:1}))` → `{a:1}`.
- [ ] **Passo 2:** `npx vitest run src/nuvem/bases.test.ts` → FALHA.
- [ ] **Passo 3: implementar** `bases.ts`. A ordem para cada base: confere a versão → baixa → `abrirGz` → `conferir…` → `gravar`. Só depois de tudo dar certo a nova vale.
- [ ] **Passo 4:** o teste → PASSA.
- [ ] **Passo 5: commit** `feat(bases): baixa a base só quando muda e guarda no navegador`.

### Tarefa 4: Script de atualização da base (PC do Italo)

**Arquivos:**
- Criar: `scripts/atualizar_base.py`, `scripts/test_atualizar_base.py`
- Apagar: `scripts/gerar-catalogo-enel.py`, porque a leitura dele passa para `ler_enel`

**Interfaces:**
- Produz (Python, só stdlib + openpyxl):
  - `ler_enel(caminho) -> dict` com `{'materiais': {codigo: [descricao, unidade]}, 'estruturas': {kit: descricao}, 'kits': {kit: [[codigo_e4e, qtd], ...]}}`. As colunas da `KIT_ESTRUTURAS E4E` (linha 2 é o cabeçalho) são: B `CODIGO_KIT`, D `Descrição_KIT`, F `CODIGO_MATERIAL_E4E`, I `QTD_MATERIA DO KIT`. "Considerar" e "Quantidade Real" são ignoradas. As colunas da `MATERIAL E4E` são as do `gerar-catalogo-enel.py` (C, D e E a partir da linha 3).
  - `conferir(nova: dict, anterior: dict | None) -> list[str]`: devolve problemas que **param** o script (aba ou coluna faltando já sai como exceção em `ler_enel`; base vazia) e avisos de queda.
  - `contagens(base) -> {'materiais': n, 'estruturas': n, 'linhas_kit': n}`
  - `versao(gz: bytes) -> str`: os 12 primeiros caracteres hex do sha256.
  - Linha de comando:
    - `python scripts/atualizar_base.py enel "<planilha.xlsx>" [--seco] [--sim]`;
    - `python scripts/atualizar_base.py edp ../bases/kits-edp.json [--seco] [--sim]`.
  - Passos do comando: lê, confere, grava `../bases/enel.json` (só para `enel`), mostra o antes e o depois, sobe `bases/<nome>-<versao>.json.gz` (content-type `application/gzip`), faz upsert da linha em `bases` e apaga do bucket o arquivo da versão anterior. Com `--seco`, para antes de subir. A queda que pede confirmação é de **mais de 2%** em qualquer contagem: sem `--sim`, o script pergunta "Continuar? (s/n)".
  - O Supabase é chamado por `urllib.request`:
    - Storage: `POST /storage/v1/object/bases/<arquivo>` e `DELETE /storage/v1/object/bases` com `{"prefixes":[...]}`;
    - REST: `POST /rest/v1/bases` com `Prefer: resolution=merge-duplicates`;
    - cabeçalhos `apikey` e `Authorization: Bearer <service_role>` lidos de `../../supabase.env` (o caminho é relativo ao script). Se o arquivo não existir, a mensagem diz onde criar.

- [ ] **Passo 1: testes que falham**, em `scripts/test_atualizar_base.py` (`unittest`). Eles montam com openpyxl, numa pasta temporária, uma planilha **inventada** com as duas abas no layout real (linha 1 "DE/PARA", linha 2 cabeçalho, 3 materiais, 2 kits com 2 itens cada, um com "Considerar" = "Sim" e "Quantidade Real" diferente):
  - `test_le_kits_pela_qtd_do_kit`: `ler_enel(...)['kits']['KITA'] == [['100001', 2], ['100002', 1]]`, usando a qtd da coluna I, não a "Quantidade Real".
  - `test_aba_faltando`: planilha sem `KIT_ESTRUTURAS E4E` → `ler_enel` lança um erro cuja mensagem cita o nome da aba.
  - `test_queda_grande_pede_confirmacao`: anterior com 100 estruturas, nova com 97 → `conferir` devolve um aviso com "100" e "97".
  - `test_base_vazia_para`: nova sem materiais → `conferir` devolve um problema que para o script.
  - `test_versao_estavel`: o mesmo gz dá a mesma versão, com 12 caracteres.
- [ ] **Passo 2:** `python -m unittest scripts/test_atualizar_base.py -v` → FALHA (módulo não existe).
- [ ] **Passo 3: implementar** `atualizar_base.py`. Gerar o gz com `gzip.compress(json.dumps(base, ensure_ascii=False, separators=(',',':'), sort_keys=True).encode(), mtime=0)`, para a versão só mudar quando o conteúdo muda.
- [ ] **Passo 4:** os testes → PASSAM.
- [ ] **Passo 5: rodar a seco com a planilha real**: `python scripts/atualizar_base.py enel "../ceara-teste/referencia/Base - Estruturas DE PARA.xlsx" --seco`. Esperado: contagens perto de 13.800 materiais, 6.521 estruturas e ~76.600 linhas de kit, e `../bases/enel.json` gravado.
- [ ] **Passo 6: mover** `src/data/kits.json` para `../bases/kits-edp.json` (`git rm --cached` + mover o arquivo) e acrescentar `src/data/kits.json` ao `.gitignore`, ao lado da linha do `enel-catalogo.json`.
- [ ] **Passo 7: commit** `feat(bases): script que confere e sobe a base da Enel e os kits da EDP`.

### Tarefa 5: Cliente do Supabase, sessão, perfil e CSP

**Arquivos:**
- Criar: `src/nuvem/mensagens.ts`, `src/nuvem/supabase.ts`, `src/nuvem/sessao.ts`, `src/nuvem/sessao.test.ts`
- Modificar: `vite.config.ts:5-27` (CSP e trava de build)
- Modificar: `package.json` (dependência `@supabase/supabase-js@^2`)
- Criar: `.env.exemplo`, com as duas variáveis vazias e um comentário dizendo de onde vêm

**Interfaces:**
- Produz:
  - `mensagens.ts`: as constantes das Regras gerais.
  - `supabase.ts`:
    - `nuvem: SupabaseClient | null`: `null` quando faltam as variáveis (modo dev sem `.env.local`);
    - `fonteSupabase(c: SupabaseClient): FonteBases`: `versoes` lê `from('bases').select('nome,versao,arquivo')`; `baixar` usa `storage.from('bases').download(arquivo)`.
    - `armazenamentoDaSessao(storage?: Storage | null): { storage: SupportedStorage; soNestaAba: boolean }`: usa o `localStorage` quando ele aceita gravar e ler de volta. Quando não aceita (janela anônima, política da empresa), passa para um mapa em memória com `soNestaAba: true`. O cliente é criado com `auth.storage` = esse armazenamento, e `soNestaAba` vira o `semGuardar` do painel.
  - `sessao.ts`, com o cliente injetado nos parâmetros para os testes:
    - `type Perfil = { id: string; nome: string; cargo: string; matricula: string; senhaInicial: boolean }`
    - `entrar(c, email: string, senha: string): Promise<Perfil>`: limpa o e-mail com `trim().toLowerCase()`. Lança `Error(<mensagem>)`.
    - `perfilAtual(c): Promise<Perfil | null>`: `null` sem sessão. Lança `CADASTRO_INCOMPLETO` quando há sessão mas não há linha em `perfis` ou o nome está vazio.
    - `trocarSenha(c, nova: string, confirma: string, atual?: string): Promise<void>`: valida `SENHA_CURTA`, `SENHAS_DIFERENTES` e `SENHA_IGUAL` (só quando `atual` for dado) antes de chamar `auth.updateUser`, e depois chama `rpc('marcar_senha_trocada')`.
    - `sair(c): Promise<void>`: `auth.signOut({ scope: 'local' })`.
    - `mensagemDeErro(e: unknown, online = navigator.onLine): string`.
  - `vite.config.ts`: usa `loadEnv(mode, process.cwd(), 'VITE_')`. No build, sem `VITE_SUPABASE_URL`, lança `Error('Falta VITE_SUPABASE_URL no .env.local (veja docs/supabase-passo-a-passo.md)')`. O `connect-src` fica `'self' blob: data: <URL do Supabase>`. O comentário do topo é atualizado (o site agora fala só com o próprio Supabase).

- [ ] **Passo 1: testes que falham**, em `src/nuvem/sessao.test.ts`, com um cliente falso (objeto com `auth.signInWithPassword`, `auth.getSession`, `auth.updateUser`, `auth.signOut`, `from().select().eq().maybeSingle()` e `rpc`):
  - `e-mail é limpo antes de entrar`: `entrar(c, '  Maria@Cosampa.com ', 'x')` → o falso recebe `maria@cosampa.com`.
  - `senha errada vira SENHA_ERRADA`: o erro do falso com `code: 'invalid_credentials'` → mensagem `SENHA_ERRADA`.
  - `429 vira MUITAS_TENTATIVAS`: erro com `status: 429`.
  - `falha de rede offline vira SEM_INTERNET`: `mensagemDeErro(new TypeError('Failed to fetch'), false)`.
  - `falha de rede online vira SERVIDOR_PARADO`: o mesmo erro com `online = true`.
  - `sem perfil vira cadastro incompleto`: sessão existe, `maybeSingle` devolve `null` → `perfilAtual` rejeita com `CADASTRO_INCOMPLETO`.
  - `senha curta não chama o servidor`: `trocarSenha(c, '1234567', '1234567')` → `SENHA_CURTA`, e `updateUser` chamado 0 vezes.
  - `troca de senha marca a senha trocada`: senha válida → `updateUser` chamado com `{ password }` e `rpc('marcar_senha_trocada')` chamado 1 vez.
  - `storage bloqueado fica só nesta aba`: um `Storage` que lança no `setItem` → `armazenamentoDaSessao(s).soNestaAba === true`, e o armazenamento devolvido grava e lê em memória.
- [ ] **Passo 2:** `npx vitest run src/nuvem/sessao.test.ts` → FALHA.
- [ ] **Passo 3:** `npm i @supabase/supabase-js@^2`. Implementar `mensagens.ts`, `supabase.ts` (`createClient` com `auth: { persistSession: true, autoRefreshToken: true }`) e `sessao.ts`. Atualizar o `vite.config.ts` e criar o `.env.exemplo`.
- [ ] **Passo 4:** o teste → PASSA. Com um `.env.local` de mentira (`VITE_SUPABASE_URL=https://exemplo.supabase.co`), `npm run build` passa e `grep -o "connect-src[^;]*" dist/index.html` mostra o endereço. Sem `.env.local`, o build falha com a mensagem acima.
- [ ] **Passo 5: commit** `feat(nuvem): login, perfil e troca de senha com mensagens em português`.

### Tarefa 6: Foto separada por pessoa e o que sobra do `pessoa.ts`

**Arquivos:**
- Modificar: `src/plataforma/pessoa.ts`, `src/plataforma/pessoa.test.ts`

**Interfaces:**
- Consome: `Perfil` (Tarefa 5).
- Produz:
  - `Pessoa` continua `{ nome; cargo; matricula; foto: string | null }`, e o crachá não muda.
  - `pessoaDoPerfil(p: Perfil, foto: string | null): Pessoa`
  - `lerFoto(id: string, storage?): string | null` e `gravarFoto(id: string, foto: string | null, storage?): { gravou: boolean }`, com a chave `fechamento-foto:<id>`. `null` apaga.
  - `fotoAntiga(storage?): string | null`: a `foto` do registro antigo `fechamento-pessoa`.
  - `esquecerPessoaAntiga(storage?): void`: remove `fechamento-pessoa`.
  - Saem: `lerPessoa`, `gravarPessoa` e `apagarPessoa`. Os usos em `App.tsx` e `Entrada.tsx` são trocados na Tarefa 7.
  - Ficam: `iniciais`, `primeiroNome` e `saudacao`.

- [ ] **Passo 1: testes que falham**, com um `Storage` falso em memória como os de hoje:
  - `foto separada por pessoa`: `gravarFoto('a', 'data:A')`, `gravarFoto('b', 'data:B')` → `lerFoto('a') === 'data:A'`.
  - `foto que não cabe`: um storage que lança no `setItem` → `{ gravou: false }`, sem lançar.
  - `foto antiga é achada e esquecida`: o storage com `fechamento-pessoa` = `{nome:'X', foto:'data:F'}` → `fotoAntiga() === 'data:F'`; depois de `esquecerPessoaAntiga()` → `null`.
  - `pessoaDoPerfil junta perfil e foto`.
  - Os testes atuais de `iniciais`, `primeiroNome` e `saudacao` continuam.
- [ ] **Passo 2:** `npx vitest run src/plataforma/pessoa.test.ts` → FALHA.
- [ ] **Passo 3: implementar.** Cada acesso ao storage é protegido com try/catch, como em `storagePadrao()`.
- [ ] **Passo 4:** o teste → PASSA. `npx tsc -b` acusa os usos antigos em `App.tsx` e `Entrada.tsx`, e isso é esperado (são corrigidos na Tarefa 7). Por isso o commit desta tarefa e o da 7 podem ir juntos, se o revisor preferir o build sempre verde.
- [ ] **Passo 5: commit** `feat(pessoa): foto guardada por pessoa e migração da foto antiga`.

### Tarefa 7: Telas e caminho do login até as regiões

**Arquivos:**
- Modificar: `src/plataforma/Entrada.tsx`, que vira o formulário de e-mail e senha no mesmo fundo, título e linha verde
- Criar: `src/plataforma/NovaSenha.tsx`
- Criar: `src/plataforma/EscolherFoto.tsx`, com a parte de foto que sai da `Entrada.tsx` atual (botão, `AjusteFoto`, erros `ERRO_FOTO` e `FOTO_NAO_COUBE`)
- Criar: `src/plataforma/Preparando.tsx`, com "Preparando as bases..." e o erro com o botão "Tentar de novo"
- Modificar: `src/plataforma/Painel.tsx`, onde "Trocar pessoa" sai e entram "Trocar foto", "Trocar senha" e "Sair"
- Modificar: `src/App.tsx:42-130` e `:219-245` (caminho de telas, kits da EDP vindos da base)
- Modificar: `src/components/ceara/Ceara.tsx:11-14,41`, que recebe `base: BaseEnel` por prop em vez de `import()`
- Modificar: `src/plataforma/plataforma.css`, só o que as telas novas pedirem, no visual B

**Interfaces:**
- Consome: `nuvem` e `fonteSupabase` (Tarefa 5); `entrar`, `perfilAtual`, `trocarSenha` e `sair` (Tarefa 5); `garantirBases` (Tarefa 3); `pessoaDoPerfil`, `lerFoto`, `gravarFoto`, `fotoAntiga` e `esquecerPessoaAntiga` (Tarefa 6).
- Produz:
  - `Entrada({ onEntrou: (p: Perfil) => void, aviso?: string })`
  - `NovaSenha({ obrigatoria: boolean, onPronto: () => void, onCancelar?: () => void })`. Com `obrigatoria`, não tem Cancelar e o título é "Crie a sua senha".
  - `EscolherFoto({ fotoAtual: string | null, sugerida: string | null, onPronto: (foto: string | null) => void })`. A `sugerida` é a foto antiga, oferecida com "Usar a foto que já estava aqui".
  - `Ceara({ base: BaseEnel, onVoltar })`
  - Painel: `onSair`, `onTrocarFoto` e `onTrocarSenha` no lugar de `onTrocar`. A prop `semGuardar` continua (agora quer dizer "a sessão vale só nesta aba").
- Caminho do `App`, nesta ordem:
  1. Enquanto `perfilAtual(nuvem)` responde: tela vazia no fundo grafite, sem piscar a entrada.
  2. `nuvem === null` → a `Entrada` mostra "Site sem configuração do servidor." e desliga o botão.
  3. Sem perfil → `Entrada`. O erro do `perfilAtual` vira o `aviso`.
  4. `senhaInicial` → `NovaSenha obrigatoria`.
  5. Primeira vez neste navegador (`lerFoto(id)` é `null` e a pessoa ainda não pulou) → `EscolherFoto`. Pular grava a marca `fechamento-foto-pulou:<id>`.
  6. `Preparando` (`garantirBases`) → guarda `bases` no estado. Os `avisos` aparecem no painel.
  7. `Painel`, depois a região. A EDP usa `bases.edp` no lugar do `import('./data/kits.json')`; o Ceará recebe `bases.enel`.
- **`#ceara-teste`:** só abre o Ceará depois do passo 6. Antes disso, segue o caminho normal e abre o Ceará ao chegar.
- **Sair:** chama `sair(nuvem)` e limpa obra, estado (`estadoDaPessoa(tecnicos)`), seção, resultados e região, como o `onTrocar` de hoje. As bases ficam no IndexedDB (decisão do Italo). A foto fica.
- **Sessão vencida:** quando `onAuthStateChange` avisa `SIGNED_OUT`, volta para a `Entrada` com o aviso "Sua sessão terminou. Entre de novo.". Se havia trabalho (`temTrabalho`), antes de sair mostra um `confirm` com essa frase e "O que foi lançado nesta obra será perdido.".
- Textos e tamanhos seguem o visual B atual: Sora 16 px, foco visível em verde, alvos de 48 px no celular e rótulos em todo campo (`E-mail`, `Senha`, `Senha nova` e `Repita a senha nova`). `autocomplete`: `email`, `current-password` e `new-password`.

- [ ] **Passo 1: ligar o caminho no `App.tsx` e nas telas novas.** Não há teste unitário de componente no projeto. O comportamento é provado no e2e da Tarefa 8, e esta tarefa termina com `npx tsc -b` e `npm test` verdes.
- [ ] **Passo 2:** em `Ceara.tsx`, trocar o `carregarCatalogo()` pela prop `base`, e apagar o aviso "Não consegui carregar a base da Enel..." (a base sempre chega pronta).
- [ ] **Passo 3: conferir na mão** com `npm run dev` e um `.env.local` de mentira. A entrada aparece; entrar mostra `SERVIDOR_PARADO` ou `SEM_INTERNET`, sem tela branca. Print da entrada a 1366 e a 390 px.
- [ ] **Passo 4:** `npx tsc -b && npm test` → PASSA. Depois, `grep -rn "data/kits.json\|enel-catalogo" src` → nenhum resultado.
- [ ] **Passo 5: commit** `feat(plataforma): entrada com login, senha própria, foto por pessoa e bases do servidor`.

### Tarefa 8: Testes com as bases fora do repositório, e2e com Supabase simulado e conferência do dist

**Arquivos:**
- Modificar: `src/ceara/ceara.test.ts:190`, que lê `../bases/enel.json` (o `skipIf` continua quando o arquivo não existe)
- Modificar: `e2e/fluxo.mjs:30` (`KITS` de `../bases/kits-edp.json`), `:41-48` (`entrar`) e a cena do Ceará em `:455-482`
- Criar: `e2e/supabase-falso.mjs`
- Criar: `scripts/conferir-dist.mjs`

**Interfaces:**
- Produz:
  - `simularSupabase(page, { url, enel, edp, senhaInicial = false, perfil })` em `e2e/supabase-falso.mjs`. Usa `page.route` em `${url}/auth/v1/**`, `${url}/rest/v1/**` e `${url}/storage/v1/**` e devolve:
    - token falso;
    - a linha de `perfis` (`nome: 'Maria Souza'`, `cargo: 'Técnica de campo'`, `matricula: '1234'`);
    - as linhas de `bases`;
    - os gz feitos com `zlib.gzipSync` de `../bases/enel.json` e `../bases/kits-edp.json`.
    - A URL vem de `VITE_SUPABASE_URL` no `.env.local`.
  - `node scripts/conferir-dist.mjs`: lê 20 descrições da Enel (`../bases/enel.json`) e 20 descrições de kits da EDP (`../bases/kits-edp.json`) escolhidas ao acaso e procura cada uma em todos os arquivos de `dist/`. Sai com código 1 e lista o que achou, ou imprime "dist limpo: nenhuma base dentro". As frases procuradas nunca são escritas no código.

- [ ] **Passo 1:** em `entrar(page)`, chamar `simularSupabase` antes do `goto`, preencher `E-mail` e `Senha` e conferir a saudação `Maria.` e a EDP como hoje.
- [ ] **Passo 2: cenas novas no e2e**, cada uma com axe e print a 1366 e 390 px:
  - "senha errada": o falso devolve 400 `invalid_credentials` → aparece `SENHA_ERRADA`;
  - "primeiro login": `senhaInicial: true` → a tela "Crie a sua senha" aparece; senha curta mostra `SENHA_CURTA`; senha boa abre a foto e depois o painel;
  - "sem internet na primeira vez": `rest/v1/bases` aborta, num perfil de navegador vazio → `PRIMEIRA_VEZ_SEM_INTERNET` e "Tentar de novo";
  - "sessão vencida": depois de entrar, o falso passa a negar o token, e um `refreshSession` disparado na página volta para a entrada com "Sua sessão terminou";
  - "Sair": volta para a entrada; entrar de novo não baixa as bases (o falso conta 0 descargas).
- [ ] **Passo 3:** a cena do Ceará entra pelo painel (o atalho `#ceara-teste` passa pelo login). O resto da cena continua igual.
- [ ] **Passo 4: rodar tudo:** `npm test` → PASSA; `npm run build && npm run e2e` → "Tudo passou." com zero violações do axe; `node scripts/conferir-dist.mjs` → "dist limpo".
- [ ] **Passo 5: commit** `test: e2e com Supabase simulado, telas de login no axe e conferência do dist`.

### Tarefa 9: Ligar o Supabase de verdade, com o Italo

Esta tarefa não tem código novo de site. Os passos marcados **(Italo)** são dele: cadastro, aceite e criação de contas. O Claude só guia e confere.

**Arquivos:**
- Criar: `scripts/conferir-supabase.mjs`
- Modificar: `docs/decisoes-e-pendencias.md` (registro do que ficou pronto)

**Interfaces:**
- Produz: `node scripts/conferir-supabase.mjs`, que lê `.env.local` e um `../supabase-teste.env` (fora do git, com `EMAIL_TESTE` e `SENHA_TESTE` de uma conta de teste criada pelo Italo) e confere:
  - sem login: `perfis` vazio, `bases` vazio, o download do arquivo da base negado, `rpc('marcar_senha_trocada')` negado;
  - com a conta de teste: lê só 1 perfil (o próprio), lê as 2 linhas de `bases`, baixa a base, `insert`/`update` em `perfis` e `bases` negados, `upload` no bucket negado.
  - Imprime OK ou FALHOU para cada item e sai com código 1 se algum falhar.

- [ ] **Passo 1 (Italo):** criar a conta e o projeto e rodar o esquema, seguindo `docs/supabase-passo-a-passo.md` (seções 1 a 4). O Claude confere com ele, tela por tela, sem digitar senha nem chave.
- [ ] **Passo 2 (Italo):** criar `.env.local` e `supabase.env` com as chaves do passo a passo.
- [ ] **Passo 3:** subir as bases:
  - `python scripts/atualizar_base.py enel "../ceara-teste/referencia/Base - Estruturas DE PARA.xlsx"`;
  - `python scripts/atualizar_base.py edp ../bases/kits-edp.json`.
  - Esperado: duas linhas em `bases` e dois arquivos no bucket.
- [ ] **Passo 4 (Italo):** criar a conta de teste (seção 5) e o `supabase-teste.env`.
- [ ] **Passo 5:** `node scripts/conferir-supabase.mjs` → todos OK.
- [ ] **Passo 6:** com `npm run build && node servir.mjs`, o Italo entra com a conta de teste em http://localhost:4400/. Ele troca a senha, põe a foto, abre a EDP e o Ceará e roda uma obra de cada.
- [ ] **Passo 7:** registrar em `docs/decisoes-e-pendencias.md` o que ficou pronto e o que falta (publicar com o OK do Italo; o item 3, abrir a estrutura e ver o kit). Commit `docs: Supabase ligado e conferido`.
- [ ] **Passo 8:** **parar.** A publicação (merge no `main`, push e gh-pages pelo procedimento isolado do dist, com o `conferir-dist.mjs` antes) só acontece com o OK do Italo, em outra etapa.
