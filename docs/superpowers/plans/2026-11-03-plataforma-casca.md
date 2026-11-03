# Plataforma no visual B — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O site abre na entrada B. Depois vem o crachá da Cosampa e as regiões. A EDP inteira passa para o visual B, sempre escuro, com o mesmo funcionamento. Nada é publicado.

**Architecture:**
- `src/plataforma/` tem:
  - a lógica pura (pessoa no localStorage, regiões, redução da foto) com testes;
  - as telas Entrada e Painel;
  - `cracha/` (arte em canvas do modelo Cosampa, crachá parado e 3D sob demanda).
- O `App.tsx` escolhe a tela pelo estado: sem pessoa → Entrada; sem região → Painel; com "edp" → fluxo atual.
- O visual B entra trocando os tokens de `src/index.css`. Ficam só escuros, com o destaque verde. Os componentes da EDP já usam esses tokens (`bg-surface`, `text-muted`, `accent`...); depois cada tela recebe o acabamento.

**Tech Stack:**
- O que já existe: React 19, Vite 6, Tailwind 4, Vitest, Playwright (`e2e/fluxo.mjs`) e axe.
- Novo:
  - three ^0.186.1, @react-three/fiber ^9.8.1, @react-three/drei ^10.7.9, @react-three/rapier ^2.2.0 e meshline ^3.3.1 (só no chunk do crachá 3D);
  - @fontsource/poppins (pesos 300, 400, 600 e 700).

**Spec:** `docs/2026-11-03-plataforma-casca-design.md`

## Global Constraints
- **Ramo `plataforma`**, criado a partir do `main` na Task 1. Nunca fazer merge no main nem publicar sem o OK do Italo.
- **Tokens B (sempre escuro):**
  - `--bg #131315`, `--surface #1c1c1f`, `--surface-2 #2f2f35`;
  - `--line rgb(255 255 255 / .13)`;
  - `--text #f4f4f5`, `--muted #a1a1aa`;
  - `--accent #5abd79`, `--accent-ink #0b0b0c`, `--accent-text #7fd09a`, `--accent-soft #16281d`.
  - `--danger`/`--ok` com contraste AA sobre #1c1c1f. `color-scheme: dark`, sem o bloco `prefers-color-scheme`.
- **Os dados do crachá real** (`Downloads\CRACHÁ COSAMPA_COMPARTILHADO (44) (2)\*.png`) nunca são copiados para o projeto: servem só de referência visual. Nenhum nome real em código, teste ou fixture. Nos testes, use "Maria Souza", "Técnica de campo", matrícula "0000".
- **Textos exatos:**
  - Rótulos: "Nome", "Cargo", "Matrícula (opcional)", "Foto (opcional)". Botão "Entrar". Nota "Seus dados ficam guardados só neste navegador.".
  - "Trocar pessoa", "← Regiões". Subtítulo do painel "Escolha a região que você vai fechar hoje.".
  - Aviso "<Região> ainda está em construção.". Estados das regiões: "Abrir →" e "Em breve".
  - Descrições das regiões:
    - EDP: "Inventário vira ADS, com conferência automática antes de baixar.";
    - Ceará: "Contagem de estrutura e material pelo CAD, com o orçamento pronto em Excel.";
    - Sergipe: "Book de obras da Energisa montado com as fotos de cada estrutura.".
  - Confirmação: "Voltar às regiões? O que foi lançado nesta obra será perdido.".
  - Verso do crachá: Setor "FECHAMENTO", Empresa "GRUPO COSAMPA". Aviso: "Este crachá é de uso pessoal e intransferível. Uso obrigatório durante a permanência na empresa.". Sem número de emergência.
- **localStorage:** chave `fechamento-pessoa`, com o valor `{"nome","cargo","matricula","foto"}`. A `foto` é um dataURL JPEG com no máximo 480 px no lado maior. Todo acesso fica em try/catch e o site funciona sem storage.
- **CSP** do `vite.config.ts` mantida; só entra `'wasm-unsafe-eval'` no `script-src`. Nada vem de CDN: fontes locais, `Environment` só com `Lightformer`, `card.glb` em `public/`.
- O Lanyard e o `LICENCA-REACT-BITS.txt` do pacote ficam com o aviso de licença (MIT + Commons Clause, David Haz).
- Português, sem travessão (U+2014) em texto visível. Mesmo funcionamento da EDP: nenhum teste antigo pode ser apagado ou afrouxado.

## Review Focus
1. **localStorage bloqueado, cheio ou com JSON quebrado:** a entrada abre e o Entrar funciona na sessão. Foto grande demais para o storage: grava sem foto e avisa "A foto não coube neste navegador; o crachá fica com as iniciais.". Teste em `pessoa.test.ts`.
2. **Nome ou cargo compridos** ("Ana Beatriz de Albuquerque Cavalcanti", "Analista de planejamento e fechamento"): a fonte diminui e nada sai do crachá. Teste em `arte.test.ts`, que confere o tamanho de fonte usado com um canvas falso.
3. **Celular, reduzir movimento ou sem WebGL:** nunca baixa o chunk 3D nem o `card.glb`. O e2e confere isso em 390 px.
4. **Contraste do verde e do texto apagado** sobre o grafite, em todas as telas da EDP, incluindo os estados de erro e de alerta: axe sem violações no e2e.
5. **Arquivo de foto que não é imagem, ou HEIC do iPhone:** mensagem "Não consegui abrir essa foto. Use JPG ou PNG." e o formulário continua. Teste em `foto.test.ts`.

---

### Task 1: Ramo, lógica da pessoa, regiões e foto

**Files:**
- Create: `src/plataforma/pessoa.ts`, `src/plataforma/regioes.ts`, `src/plataforma/foto.ts`
- Test: `src/plataforma/pessoa.test.ts`, `src/plataforma/regioes.test.ts`, `src/plataforma/foto.test.ts`

**Interfaces:**
- Produces:
  - `interface Pessoa { nome: string; cargo: string; matricula: string; foto: string | null }`
  - `lerPessoa(storage?: Storage): Pessoa | null`
  - `gravarPessoa(p: Pessoa, storage?: Storage): { gravouFoto: boolean }` (se estourar a cota, regrava sem a foto e devolve `false`)
  - `apagarPessoa(storage?: Storage): void`
  - `iniciais(nome: string): string`, `primeiroNome(nome: string): string`
  - `saudacao(hora: number): 'Bom dia' | 'Boa tarde' | 'Boa noite'`
  - `type RegiaoId = 'edp' | 'ceara' | 'sergipe'`
  - `interface Regiao { id: RegiaoId; numero: string; nome: string; descricao: string; estado: 'pronto' | 'em-breve' }`
  - `REGIOES: Regiao[]`
  - `reduzirFoto(arquivo: File, lado?: number /* 480 */): Promise<string>` (dataURL JPEG 0.85; rejeita com `Error('foto-invalida')` quando a imagem não decodifica)

- [ ] **Step 1:** `git switch -c plataforma` (a partir do `main` limpo).
- [ ] **Step 2: Testes que falham:**
  - `iniciais('Maria Souza') === 'MS'`, `iniciais('  maria  ') === 'M'`;
  - `primeiroNome(' Maria Souza ') === 'Maria'`;
  - `saudacao(9/12/18)` dá Bom dia, Boa tarde e Boa noite;
  - gravar e ler num storage falso devolve o mesmo objeto; JSON quebrado dá `null`;
  - num storage que lança, `lerPessoa` dá `null` e nada lança;
  - um storage cujo `setItem` lança `QuotaExceededError` só quando o valor tem foto devolve `{gravouFoto:false}`, e o lido tem `foto === null`;
  - `REGIOES` tem os ids, números, estados e descrições da seção Global Constraints;
  - `reduzirFoto` com um `File` de texto rejeita `foto-invalida` (com `createImageBitmap` simulado lançando).
- [ ] **Step 3:** `npx vitest run src/plataforma` deve FALHAR.
- [ ] **Step 4:** Implementar os três arquivos.
- [ ] **Step 5:** `npx vitest run` deve passar inteiro.
- [ ] **Step 6: Commit** `feat(plataforma): pessoa, regiões e redução de foto`

### Task 2: Tema B no site inteiro

**Files:**
- Modify: `src/index.css` (tokens B só escuros; remover o bloco `prefers-color-scheme`), `src/components/Logo.tsx` (`Marca` passa a desenhar o logo do Grupo Cosampa em `var(--text)`, sem o A amarelo; mesmo nome e props), `index.html` (`color-scheme` só `dark`; description e og:description "Ferramentas da equipe de fechamento da Cosampa: Ceará, Sergipe e EDP.")
- Create: `public/plataforma/logo-cosampa.svg`, `public/plataforma/simbolo-cosampa.svg` (de `Desktop\LINKEDIN\cosampa-site\public\`)

**Interfaces:**
- Produces: tokens com os mesmos nomes de hoje (`--bg`, `--surface`, `--surface-2`, `--line`, `--line-strong`, `--text`, `--muted`, `--accent*`, `--danger*`, `--ok*`, `--shadow`) e os valores B.

- [ ] **Step 1:** Trocar os tokens. Rodar `npm run build` e `npm run e2e`. Hoje o e2e roda claro e escuro: deixar só `dark` nas rodadas (o site não tem mais tema claro) e anotar no commit.
- [ ] **Step 2:** Abrir o fluxo EDP no navegador (preview "fechamento") e corrigir os pontos em que uma cor fixa (hex no JSX/CSS fora dos tokens) quebra no escuro: `grep -rn "#[0-9a-fA-F]\{3,6\}" src/components`.
- [ ] **Step 3:** `npm test`, `npm run build` e `npm run e2e` verdes, com axe sem violações.
- [ ] **Step 4: Commit** `feat(plataforma): visual B (grafite e verde) no site inteiro`

### Task 3: Crachá da Cosampa (arte, parado e 3D)

**Files:**
- Create:
  - `src/plataforma/cracha/arte.ts` (porte do `arte.js` do `Desktop\cracha-3d.zip`, com o mesmo `LAYOUT`);
  - `src/plataforma/cracha/CrachaParado.tsx`, `src/plataforma/cracha/Cracha3D.tsx`, `src/plataforma/cracha/Lanyard.tsx` (do zip), `src/plataforma/cracha/LICENCA-REACT-BITS.txt`;
  - `src/plataforma/cracha/podeCracha3D.ts`;
  - `public/plataforma/cracha/card.glb` (do zip).
- Modify: `package.json`, `vite.config.ts` (CSP), `src/main.tsx` (importar `@fontsource/poppins/300.css`, `400.css`, `600.css` e `700.css`)
- Test: `src/plataforma/cracha/arte.test.ts`

**Interfaces:**
- Consumes: `Pessoa`, `iniciais`
- Produces:
  - `frente(p: Pessoa): Promise<string>`, `verso(p: Pessoa): Promise<string>`, `cordao(): Promise<string>` (dataURLs; canvas em 2× de 649×1039);
  - `podeCracha3D(): boolean` (false com `(max-width: 820px)`, `(pointer: coarse)`, `prefers-reduced-motion: reduce`, `connection.saveData`, `deviceMemory <= 2` ou sem WebGL);
  - `CrachaParado({ pessoa })` (`<img>` da frente; clique/Enter vira para o verso; alt "Crachá de <nome>, <cargo>");
  - `Cracha3D({ pessoa })` com `export default`, carregado por `lazy()` e com error boundary que cai no `CrachaParado`.

- [ ] **Step 1:** Testes com um canvas falso que grava as chamadas de `fillText` e a `font`:
  - `frente({nome:'Maria Souza', cargo:'Técnica de campo', matricula:'', foto:null})` escreve "MARIA SOUZA", "TÉCNICA DE CAMPO" e as iniciais "MS";
  - `verso` escreve "Nome:", "Setor:", "Matrícula:", "Empresa:", "FECHAMENTO", "GRUPO COSAMPA" e o aviso de uso pessoal, e não escreve nenhum telefone (`/\(\d{2}\)/` ausente);
  - com nome de 40 letras, o tamanho da fonte do nome fica menor que 48 e a largura medida ≤ `LAYOUT.apelido.max`.
  - Rodar: deve FALHAR.
- [ ] **Step 2:** Implementar `arte.ts`. Trocar `modeloNeutroFrente` e `modeloNeutroVerso` por `modeloCosampaFrente(g)` e `modeloCosampaVerso(g)`, que desenham o modelo em branco descrito na especificação: cores `PRETO #090F10`, `FUNDO #D1D3D4`, anéis `#BDBFC1`, logo de `public/plataforma/logo-cosampa.svg` (escuro na frente, branco no verso). Tirar o carregamento do Google Fonts: a Poppins vem do @fontsource, e o código só espera `document.fonts.load`. Rodar os testes: devem passar.
- [ ] **Step 3:** Conferir a arte lado a lado com `Downloads\CRACHÁ COSAMPA_COMPARTILHADO (44) (2)\` (só olhando; não copiar nada). Gerar um PNG de frente e outro de verso de "Maria Souza" em `e2e/prints/cracha-*` e comparar curva, anéis, pontos, círculo, posições e logo.
- [ ] **Step 4:** Portar o Lanyard e o `Cracha3D` do zip. O `card.glb` vem de `${import.meta.env.BASE_URL}plataforma/cracha/card.glb`. Na CSP, `'wasm-unsafe-eval'`, com um comentário. Instalar as dependências.
- [ ] **Step 5:** `npm run build`:
  - o 3D sai num chunk separado;
  - o chunk inicial cresce no máximo 10 KB gzip (anote antes/depois no commit);
  - `npx vite preview`: o crachá puxável em 1366 px, sem erro de CSP.
- [ ] **Step 6: Commit** `feat(plataforma): crachá da Cosampa em canvas, parado e 3D`

### Task 4: Entrada e painel, ligados ao App

**Files:**
- Create: `src/plataforma/Entrada.tsx`, `src/plataforma/Painel.tsx`, `src/plataforma/plataforma.css`
- Create: `public/plataforma/entrada.webp` (cópia de `Desktop\LINKEDIN\cosampa-site\public\fotos\servicos-eletricos-4-1920.webp`)
- Modify: `src/App.tsx`, `src/components/Inicio.tsx`, `src/components/ceara/Ceara.tsx` (o "Voltar" limpa o `#ceara-teste`)

**Interfaces:**
- Consumes: Tasks 1 e 3.
- Produces:
  - `Entrada({ onEntrar }: { onEntrar: (p: Pessoa) => void })`
  - `Painel({ pessoa, onAbrir, onTrocar }: { pessoa: Pessoa; onAbrir: (id: RegiaoId) => void; onTrocar: () => void })`
  - No App: `pessoa` (`useState(() => lerPessoa())`) e `regiao: RegiaoId | null`.

- [ ] **Step 1: Entrada**, portando a seção ENTRADA do `rascunhos-plataforma\b-grafite.html`:
  - foto em grayscale com os gradientes;
  - logo branco; selo "Foto provisória";
  - h1 "Fechamento" com a linha verde (sem animação em reduzir movimento);
  - formulário em painel. A foto mostra uma miniatura redonda ao ser escolhida; erro de foto dá a mensagem da Review Focus 5. Nome ou cargo vazios (só espaços) não entram e o foco vai ao primeiro vazio.
  - Uma coluna abaixo de 820 px.
- [ ] **Step 2: Painel**, portando a seção PAINEL do rascunho:
  - cabeçalho com "Trocar pessoa";
  - crachá à esquerda: `Cracha3D` quando `podeCracha3D()`, senão `CrachaParado`;
  - `h1` com foco ao abrir e a saudação;
  - `<ul>` de regiões; "em breve" com `aria-disabled`, sem navegar, e o aviso em `role="status"` por 2,6 s.
- [ ] **Step 3: App:**
  - `#ceara-teste` abre `<Ceara/>` direto;
  - sem pessoa: `<Entrada/>`;
  - sem região: `<Painel/>`;
  - `regiao === 'edp'`: o fluxo atual.
  - No `Inicio`, trocar as abas EDP/Ceará pelo "← Regiões".
  - Na obra aberta, o cabeçalho ganha "← Regiões", que com `temTrabalho` usa `confirm()` com o texto exato e, se confirmado, limpa obra e estado.
- [ ] **Step 4:** `npm test` e `npx tsc -b` limpos. No navegador:
  - entrar com foto;
  - ver o crachá 3D (1366) e o parado (390);
  - o aviso do Ceará;
  - abrir a EDP, voltar, trocar pessoa e recarregar (abre no painel).
- [ ] **Step 5: Commit** `feat(plataforma): entrada e painel com crachá; EDP dentro da plataforma`

### Task 5: Acabamento B nas telas de lançamento da EDP

**Files:**
- Modify: `src/components/Inicio.tsx`, `Etapas.tsx`, `Estruturas.tsx`, `Itens.tsx`, `AjusteMateriais.tsx`, `Boletim.tsx`, `ui.tsx`, e o cabeçalho da obra em `src/App.tsx`

- [ ] **Step 1:** Levar a linguagem do painel B para essas telas:
  - títulos grandes com tracking negativo;
  - listas com divisórias finas em vez de caixas onde não há hierarquia;
  - números em `tabular-nums`;
  - estados com o verde só no que é ação ou "feito";
  - cabeçalho grafite com o logo, o nome da obra e "← Regiões".
  - Sem mudar texto, ordem, campos nem comportamento.
- [ ] **Step 2:** `npm test` e `npm run e2e` verdes. Comparar os prints `e2e/prints/1366-dark-*` e `390-*` antes e depois, um por um.
- [ ] **Step 3: Commit** `feat(plataforma): visual B nas etapas de lançamento da EDP`

### Task 6: Acabamento B nas fichas, carimbo, revisão e Ceará em teste

**Files:**
- Modify: `src/components/Fichas.tsx`, `FotoSlot.tsx`, `Carimbo.tsx`, `Revisao.tsx`, `src/components/ceara/Ceara.tsx`

- [ ] **Step 1:** Mesmo tratamento da Task 5. Na revisão, a conferência reprovada e o "Baixar mesmo assim" continuam bem visíveis (vermelho AA) e o download principal fica no verde.
- [ ] **Step 2:** `npm test` e `npm run e2e` verdes (incluindo `ceara()` em `#ceara-teste`, `modeloDiferente`, `operacoesDaObra` e `soDesativacao`). Comparar os prints.
- [ ] **Step 3: Commit** `feat(plataforma): visual B nas fichas, carimbo, revisão e Ceará em teste`

### Task 7: E2E da plataforma

**Files:**
- Modify: `e2e/fluxo.mjs`, `docs/mapa-de-riscos.md`

- [ ] **Step 1:** Criar `async function entrar(page, { foto } = {})`:
  - preenche Nome "Maria Souza" e Cargo "Técnica de campo";
  - clica em Entrar e depois em "EDP".
  - Usar em todas as rodadas que hoje começam no inventário. O `ceara()` abre `URL_SITE + '#ceara-teste'`.
- [ ] **Step 2:** Novo passo `plataforma()` em 1366×768 e 390×844 (móvel):
  - axe na entrada e no painel;
  - nome vazio não entra;
  - foto inválida (um .txt) mostra a mensagem;
  - foto válida aparece no crachá parado;
  - o aviso "O Ceará ainda está em construção.";
  - "Trocar pessoa" volta;
  - recarregar abre no painel;
  - em 390 px nenhum pedido termina em `.glb`;
  - "← Regiões" com lançamento dispara o `dialog` com o texto exato.
  - Prints em `e2e/prints/plataforma-*`.
- [ ] **Step 3:** `npm run build`, `npm test` e `npm run e2e` verdes. Olhar todos os prints.
- [ ] **Step 4: Commit** `test(plataforma): e2e da entrada, painel e crachá`

### Task 8: Revisão final (sem publicar)
- [ ] Um agente novo, no modelo mais forte, lê o ramo inteiro com a especificação, este plano e a Review Focus. Ele só lê e roda testes.
- [ ] Críticos e importantes: corrigir com um teste que falhe antes. Os menores vão para `docs/mapa-de-riscos.md`.
- [ ] Mostrar ao Italo os prints e o site local (preview "fechamento" no ramo `plataforma`). Nada de merge nem de publicação sem o OK dele.
