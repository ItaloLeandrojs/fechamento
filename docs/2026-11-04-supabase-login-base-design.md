# Login da equipe e bases no Supabase: especificação (04/11/2026)

## Por que
O Ceará conta estrutura e material pela base da Enel (`src/data/enel-catalogo.json`, gerado da planilha DE-PARA). Hoje essa base entra no código do site: no `npm run build` ela vai para o `dist`, e publicar seria deixar a base da Enel aberta na internet (o repositório e o site são públicos). Por isso o Ceará não pode ir ao ar.

Num site público, a chave do Supabase fica visível no navegador. Por isso só um **login de verdade** protege a base. A entrada de hoje (nome e cargo no `localStorage`) não protege nada.

**Objetivo:** a base da Enel e os kits da EDP saem do código do site e passam a ficar no Supabase. Só quem entra com e-mail e senha consegue ler. Com isso, o Ceará pode ser publicado (a publicação é um passo à parte, só com o OK do Italo).

## Decisões do Italo (04/11, não rediscutir)
- **Conta:** o Italo ainda não tem conta no Supabase. Ele cria a conta no plano grátis, no nome dele, e faz o cadastro e o aceite dos termos ele mesmo; eu só guio. Se o projeto pausar depois de 7 dias sem uso, ele despausa no painel.
- **Login só da equipe:** e-mail e senha, valendo para a **plataforma inteira** (EDP também). Ninguém se cadastra sozinho.
- **Cadastro:** o Italo cria cada conta **pelo painel do Supabase**, com e-mail, senha inicial, **nome, cargo e matrícula**.
- **Senha esquecida:** o Italo troca pelo painel. Sem "esqueci a senha" por e-mail.
- **Senha própria:** no **primeiro login** a pessoa é obrigada a criar a própria senha (a inicial do Italo deixa de valer), e pode trocar de novo depois, pelo painel do site. Assim o Italo não sabe a senha de ninguém. Quando ele troca uma senha pelo painel do Supabase, a pessoa também é obrigada a criar a dela no login seguinte.
- **Sem internet:** só precisa funcionar se a internet cair com o site **já aberto**. Para abrir o site é preciso internet, como hoje. Sem service worker.
- **Foto:** continua escolhida pela pessoa e guardada **só no navegador dela**, com o ajuste em círculo de hoje. Nunca vai para o servidor.
- **Crachá:** nome, cargo e matrícula vêm do cadastro. A pessoa não digita mais esses dados.
- **Sessão:** a pessoa fica conectada até clicar em **Sair**.
- **Base:** vai completa: materiais (MATERIAL E4E), estruturas e o que vai dentro de cada kit (KIT_ESTRUTURAS E4E, ~76 mil linhas, já pensando no item 3, "abrir a estrutura e ver os materiais").
- **Kits da EDP** (`src/data/kits.json`, 450 kits) também vão para o Supabase, atrás do login. O que já está no histórico do GitHub continua lá (o Italo escolheu não reescrever o histórico).
- **Como o site pega as bases:** baixa uma vez depois do login e guarda no navegador. Só baixa de novo quando houver versão nova.
- **Ao sair:** a base guardada **continua** no navegador (escolha do Italo; ele aceitou que ela fique no PC depois do Sair).
- **Atualizar quando a Enel mandar planilha nova:** o Italo salva a planilha na pasta e roda um **script no PC dele**. O script confere a planilha e troca a base inteira.

## Metas
1. Nenhum dado da Enel e nenhum kit da EDP dentro do `dist` nem do repositório.
2. Entrada da plataforma com e-mail e senha, no visual B (Grafite) de hoje.
3. Crachá e painel com nome, cargo e matrícula do cadastro, e a foto do navegador.
4. Ceará e EDP funcionando como hoje depois do login, lendo as bases guardadas.
5. Script de atualização da base, rodado pelo Italo, com conferência antes de subir.
6. Instruções curtas para o Italo: criar o projeto, criar uma conta de colega, trocar uma senha, despausar e atualizar a base.

## Fora deste projeto
- Dashboards, ranking, valor das obras (ideia de 24/10, depois).
- Foto, carimbo, CPF ou técnicos no servidor. Os técnicos continuam no IndexedDB do navegador, como hoje.
- "Esqueci a senha" por e-mail, cadastro pelo site, tela de administrador.
- A tela de abrir a estrutura e ver o kit do Ceará (item 3). A base já sobe com os kits, mas a tela vem num projeto seguinte.
- Mão de obra do Ceará.
- Publicar o site. É outro passo, só com o OK do Italo, pelo procedimento isolado do dist.

## O que seria fracasso mesmo funcionando
- A base aparecer para quem não entrou (chave pública com tabela ou arquivo sem regra de acesso, arquivo no `dist`, base num endereço público).
- A chave secreta do Supabase (service_role) ir para o site, para o git ou para algum arquivo dentro do repositório.
- Um colega conseguir ler o cadastro de outro (e-mail, matrícula).
- A EDP parar de funcionar para quem já usa (ela roda no navegador e não pode depender do servidor para nada além do login e da primeira descarga dos kits).
- Uma planilha errada da Enel substituir a base boa sem aviso.

## Como funciona (o que já está decidido)

### Supabase
- Projeto grátis, no nome do Italo. A região é decisão do construtor (São Paulo é o natural).
- **Cadastro aberto desligado** no painel ("Allow new users to sign up" desligado). As contas são criadas pelo Italo em Authentication → Add user, já confirmadas.
- **Perfil:** uma tabela com o id do usuário, nome, cargo e matrícula. Regra de acesso: cada pessoa lê **só a própria linha** e ninguém escreve pelo site (só o Italo, pelo painel).
- **Bases:** só quem está logado lê. Ninguém escreve pelo site; quem escreve é só o script, com a chave secreta.
- **Versão:** o site precisa saber, com uma consulta pequena, se a base guardada é a mais nova (por exemplo um número de versão ou uma data mais um resumo do conteúdo).
- **Regras de acesso ligadas em tudo.** Toda tabela e todo arquivo têm regra explícita. A conferência final testa, sem login, que nada volta.

### Site
- **Entrada:** a tela atual (foto de fundo, "Fechamento" gigante, linha verde) troca o formulário de nome/cargo/matrícula/foto por **e-mail e senha**, com mensagens claras em português: senha errada, sem internet e servidor parado ("avise o Italo").
- **Foto:** depois do primeiro login, a pessoa pode pôr a foto (opcional) com o mesmo ajuste de hoje, e pode trocar depois. A foto fica guardada no navegador, separada por pessoa (duas pessoas no mesmo PC não misturam a foto). *(minha decisão: separar por pessoa)*
- **Sair:** botão no painel. Apaga a sessão e a foto fica. A base também fica, por decisão do Italo.
- **Bases:** depois do login, o site confere a versão. Se a guardada for velha ou não houver nenhuma, ele baixa e guarda. A EDP e o Ceará leem da base guardada, e não mais de `src/data/*.json`.
- **Primeiro login e troca de senha:** depois de entrar com a senha inicial, a tela pede a senha nova duas vezes (mínimo de caracteres decidido pelo construtor, com regra igual no painel do Supabase) antes de abrir o painel. No painel há "Trocar senha". Como marcar que a senha ainda é a inicial fica com o construtor, mas a marca só pode ser mudada pela própria pessoa ao trocar a senha ou pelo Italo.
- **Sem internet:** com o site já aberto, se a internet cair, a EDP e o Ceará continuam (rodam no navegador com as bases guardadas). Sem bases guardadas, a tela diz que precisa de internet na primeira vez. Abrir o site sem internet não faz parte deste projeto.
- **Apresentação no PC (`servir.mjs`, localhost:4400):** passa a precisar de internet e de login como o site no ar (o navegador trata esse endereço como outro site, então pede login e baixa as bases de novo ali). Isso é consequência aceita da escolha acima.
- **Atalho `#ceara-teste`:** hoje abre o Ceará sem passar pela entrada. Passa a exigir login também.
- **Política de segurança (CSP em `vite.config.ts`):** libera conexão só com o endereço do projeto do Supabase. Nada mais de fora. O comentário de lá ("o site não fala com nenhum servidor") é atualizado.
- **Navegador sem storage** (janela anônima, política da empresa): o login vale só naquela aba e o painel avisa, como já acontece hoje com a pessoa.
- **Quem já usa hoje:** os dados antigos de `fechamento-pessoa` deixam de valer. Na primeira entrada, se o navegador tiver uma foto antiga, o site oferece usar essa foto e apaga o registro antigo. *(minha decisão)*

### Script de atualização (no PC do Italo)
- Lê a planilha da Enel (o mesmo formato da `Base - Estruturas DE PARA.xlsx`). Para os itens de cada kit usa a coluna `QTD_MATERIA DO KIT`. As colunas "Considerar" e "Quantidade Real" são ignoradas: só 14 das 76 mil linhas estão marcadas "Sim", e a outra planilha (V1) nem tem essas colunas. *(minha decisão)*
- **Kits da EDP:** sobem **uma vez só**, a partir do `src/data/kits.json` atual. O arquivo sai do repositório e fica guardado fora dele (por exemplo `AUTOMACAO KIT MATERIAL\bases\kits-edp.json`). O contrato da EDP acabou e os kits não mudam mais, então não há geração a partir do `.xlsb`. O script tem uma opção para subir esse arquivo de novo se um dia precisar. *(minha decisão)*
- **Confere antes de subir:** as abas e colunas esperadas existem; os totais (materiais, estruturas, linhas de kit) não estão vazios; e compara com a versão no ar ("eram 6.521 estruturas, agora são 6.540; 3 sumiram: ..."). Se cair muito, para e pede confirmação.
- Sobe a base inteira e só então troca a versão (quem estiver usando nunca pega metade velha e metade nova).
- A chave secreta fica num arquivo **fora do repositório** (por exemplo `AUTOMACAO KIT MATERIAL\supabase.env`), nunca no git.
- Roda com um comando só, escrito nas instruções. Lembrar que scripts `.ps1` precisam de `-ExecutionPolicy Bypass`.
- O `scripts/gerar-catalogo-enel.py` atual vira esse script (ou é substituído por ele). `src/data/enel-catalogo.json` e `src/data/kits.json` deixam de existir no projeto.

### Testes e conferência
- Os testes unitários que hoje leem `src/data/*.json` passam a usar dados de exemplo pequenos e inventados (nada da Enel nem da EDP no git) e, quando houver, a base real guardada fora do repositório, como já é feito com os inventários.
- O e2e não pode depender do Supabase de verdade (sem internet, sem senha em arquivo do projeto): o login e as bases são simulados no teste. A conta e as bases de verdade são conferidas uma vez à mão, com o Italo.
- **Antes de qualquer publicação:** procurar no `dist` por textos que só existem na base (uma descrição da Enel, um nome de kit da EDP) e confirmar que não aparecem. Conferir sem login que a tabela de perfis e as bases não respondem.
- Continua valendo o processo do projeto: um agente por tarefa com revisor, `npm test`, `npm run build && npm run e2e` com axe, e a revisão final por um agente que não construiu.

## Riscos aceitos pelo Italo
- E-mail, nome, cargo e matrícula dos colegas ficam no Supabase da conta pessoal dele (sem CPF, foto ou carimbo).
- A base fica no PC depois do Sair.
- O plano grátis pausa depois de 7 dias sem uso.

## Deixado para quem construir
- Como o perfil é preenchido: o "Add user" do painel não aceita nome, cargo e matrícula. Uma linha na tabela de perfis (pelo editor de tabelas) ou um gatilho, desde que o Italo faça tudo pelo painel e as instruções mostrem o passo a passo.
- Quando conferir a versão das bases (no login, ao abrir uma região...) e o que acontece com uma conta apagada ou sem perfil.
- O limite de queda que faz o script parar e pedir confirmação.
- A forma de guardar as bases no Supabase (tabelas ou arquivos privados) e no navegador (IndexedDB é o natural; o banco `fechamento` já existe, versão 1, com a loja `tecnicos`; subir a versão sem perder os técnicos).
- Usar ou não a biblioteca `@supabase/supabase-js`.
- O desenho exato da tela de login e do passo da foto, dentro do visual B.
- Como simular o Supabase no e2e.
