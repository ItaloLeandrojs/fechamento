# Supabase: passo a passo do Italo

Este guia é para você, Italo. Cada seção é um assunto. Os nomes dos botões ficam em inglês, do jeito que aparecem no Supabase.

Antes de começar, saiba o que são as duas chaves:

- **Chave pública** (`anon` ou `publishable`): pode ficar no site. Sozinha ela não abre nada.
- **Chave secreta** (`service_role` ou `secret`): abre tudo. **Nunca** vai para o site, para o GitHub, para e-mail ou para conversa. Fica só em um arquivo no seu PC.

---

## 1. Criar a conta e o projeto

Isso é você quem faz, com o seu e-mail e aceitando os termos.

1. Abra https://supabase.com e clique em **Start your project**.
2. Entre com o seu e-mail (ou GitHub) e aceite os termos.
3. Clique em **New project**.
4. Preencha:
   - **Name:** `fechamento`.
   - **Database Password:** clique em **Generate a password**. Copie e guarde no seu gerenciador de senhas agora. Depois não dá para ver de novo.
   - **Region:** **South America (São Paulo)**. Confira antes de criar: o painel pode escolher os EUA sozinho, e a região não muda depois.
   - **Pricing Plan:** **Free**.
5. Clique em **Create new project** e espere uns 2 minutos.

---

## 2. Rodar o esquema

O esquema cria as tabelas, o depósito de arquivos e as regras de acesso.

1. No menu da esquerda, clique em **SQL Editor**.
2. Clique em **New query**.
3. Abra o arquivo `supabase/esquema.sql` do projeto, copie tudo e cole.
4. Clique em **Run**.
5. Deve aparecer **Success. No rows returned**.

Pode rodar de novo sem medo. Ele não duplica nada.

---

## 3. Fechar o cadastro e ajustar a senha

Só você cria contas. Ninguém pode se cadastrar sozinho.

1. Menu **Authentication**, depois **Sign In / Providers**.
2. Desligue **Allow new users to sign up** e **Confirm email**. Deixe **Allow anonymous sign-ins** e **Allow manual linking** desligados. Clique em **Save changes**.
3. Na lista **Auth Providers**, clique em **Email**:
   - Em **Minimum password length**, ponha **8**.
   - Deixe desligados **Secure password change** e **Require current password when updating**.
   - Deixe **Password requirements** em **No required characters (default)**.
4. Clique em **Save**.

Não ligue **Password requirements**, **Secure password change** nem **Require current password when updating**: o site não sabe lidar com essas regras e a troca de senha falharia.

(Conferido no painel real em 04/11/2026.)

---

## 4. Pegar as chaves

**Copie as chaves no seu Chrome ou Edge, não no navegador de dentro do app do Claude.** Lá o botão de copiar dá "Unable to copy to clipboard" e o que se cola é outra coisa.

1. Menu **Project Settings** (a engrenagem), depois **API Keys**.
2. A **Project URL** aparece na página inicial do projeto (`https://<código>.supabase.co`).
3. Copie a **Publishable key** (começa com `sb_publishable_`).
4. Crie o arquivo `site-fechamento\.env.local` com estas duas linhas, trocando os valores:

```
VITE_SUPABASE_URL=cole_aqui_a_Project_URL
VITE_SUPABASE_ANON_KEY=cole_aqui_a_chave_anon
```

Esse arquivo já é ignorado pelo Git. Não vai para o GitHub.

### Chave secreta (atenção)

1. Na mesma tela, em **Secret keys**, clique no olho para mostrar a chave (começa com `sb_secret_`) e copie.
2. Crie o arquivo `AUTOMACAO KIT MATERIAL\supabase.env` (na pasta de fora do site) com:

```
SUPABASE_URL=cole_aqui_a_Project_URL
SUPABASE_SERVICE_ROLE_KEY=cole_aqui_a_chave_secreta
```

**Esta chave só pode estar neste arquivo.** Não cole no `.env.local`, no código, no GitHub, em e-mail nem no chat. Quem tem essa chave apaga e lê tudo. Se vazar, em **Project Settings > API Keys**:

- Com as chaves novas (`sb_secret_...` e `sb_publishable_...`): gere uma chave secreta nova, troque no `supabase.env` e apague/revogue a que vazou.
- Com as chaves antigas (JWT, `service_role` e `anon`): girar o **JWT secret** troca as duas. Depois é preciso pôr a `service_role` nova no `supabase.env`, a `anon` nova no `.env.local` e montar o site de novo.

O projeto `Fechamento Cosampa` (criado em 04/11/2026) usa as chaves novas.

---

## 5. Criar a conta de um colega

1. Menu **Authentication → Users**.
2. Clique em **Add user** e depois **Create new user**.
3. Preencha o **Email** e uma **Password** inicial (mínimo 8 caracteres).
4. Marque **Auto Confirm User**.
5. Clique em **Create user**.
6. Menu **Table Editor**, tabela `perfis`. A linha do e-mail já apareceu sozinha.
7. Preencha **nome**, **cargo** e **matricula** nessa linha e salve.

No primeiro acesso o site pede para a pessoa trocar a senha inicial.

---

## 6. Trocar a senha de alguém

O painel não tem um campo para definir a senha de alguém, então a troca é feita pelo **SQL Editor**:

1. Menu **SQL Editor**, nova consulta.
2. Rode (trocando `SENHA-NOVA` e o e-mail da pessoa):

```
update auth.users set encrypted_password = extensions.crypt('SENHA-NOVA', extensions.gen_salt('bf')), updated_at = now() where email = '...';
update public.perfis set senha_inicial = true where email = '...';
```

Assim, no próximo acesso, o site pede a troca de novo.

O texto da consulta fica no histórico do SQL Editor. Tudo bem: é uma senha inicial, e a pessoa troca no próximo login.

**Não use "Send password recovery"**: o e-mail padrão do Supabase não chega aos colegas e o site não trata o link de recuperação.

Plano B, se o SQL não funcionar: apague o usuário (seção 7) e crie de novo (seção 5), preenchendo o perfil outra vez. A foto guardada no navegador da pessoa se perde, porque o id muda.

> A conferir no painel real na Tarefa 9: este passo ainda não foi testado num projeto de verdade.

---

## 7. Tirar uma pessoa

1. **Authentication → Users**, clique na pessoa.
2. Clique em **Delete user** e confirme.

O perfil dela some junto.

---

## 8. Despausar o projeto

No plano Free, o projeto pausa depois de cerca de 1 semana sem uso. O site mostra "O servidor não respondeu".

1. Entre em https://supabase.com/dashboard.
2. Clique no projeto `fechamento`.
3. Clique em **Restore project**.
4. Espere alguns minutos.

Os dados continuam lá. Se ficar pausado muito tempo (meses), o Supabase pode apagar. Entre de vez em quando.

---

## 9. Atualizar as bases (Enel e EDP)

São duas bases, e cada uma tem a sua subida. **Suba as duas antes do primeiro login da equipe.** Depois, só a que mudou.

1. Abra o terminal na pasta `site-fechamento`.
2. Enel, trocando o caminho pela planilha nova:

```
python scripts/atualizar_base.py enel "<caminho da planilha nova.xlsx>"
```

3. EDP, com o `kits-edp.json`:

```
python scripts/atualizar_base.py edp ../bases/kits-edp.json
```

4. O script confere o arquivo, gera a base e envia para o Supabase.

Para só conferir, sem enviar nada, acrescente `--seco` no fim:

```
python scripts/atualizar_base.py enel "<caminho da planilha nova.xlsx>" --seco
```

O script usa o arquivo `AUTOMACAO KIT MATERIAL\supabase.env` da seção 4.

---

## 10. Conferir as regras de acesso

Depois de mexer no esquema ou nas configurações de login, rode:

```
node scripts/conferir-supabase.mjs
```

Ele usa uma conta de teste (crie como na seção 5) e o arquivo `AUTOMACAO KIT MATERIAL\supabase-teste.env`, fora do site:

```
EMAIL_TESTE=e-mail da conta de teste
SENHA_TESTE=senha atual da conta de teste
```

Deve terminar com **Tudo OK**. Ele confere que a conta lê só o próprio perfil e as bases e não grava nada, e que sem login não se lê nada, não se baixa nada, ninguém se cadastra e não há login anônimo. Se a conta de teste já trocou a senha no site, ponha a senha nova no arquivo.
