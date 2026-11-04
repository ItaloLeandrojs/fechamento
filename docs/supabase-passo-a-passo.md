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
   - **Region:** **South America (São Paulo)**.
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

1. Menu **Authentication**.
2. Abra **Sign In / Providers** (em alguns painéis o nome é **Providers**).
3. Desligue **Allow new users to sign up**. Clique em **Save**.
4. Ainda ali, clique em **Email**:
   - Desligue **Confirm email**.
   - Em **Minimum password length**, ponha **8**.
5. Clique em **Save**.

---

## 4. Pegar as chaves

1. Menu **Project Settings** (a engrenagem), depois **API**. Em painéis novos pode estar em **API Keys**.
2. Copie a **Project URL**.
3. Copie a chave `anon` / **publishable**.
4. Crie o arquivo `site-fechamento\.env.local` com estas duas linhas, trocando os valores:

```
VITE_SUPABASE_URL=cole_aqui_a_Project_URL
VITE_SUPABASE_ANON_KEY=cole_aqui_a_chave_anon
```

Esse arquivo já é ignorado pelo Git. Não vai para o GitHub.

### Chave secreta (atenção)

1. Na mesma tela, ache a chave `service_role` / **secret**. Clique em **Reveal** e copie.
2. Crie o arquivo `AUTOMACAO KIT MATERIAL\supabase.env` (na pasta de fora do site) com:

```
SUPABASE_URL=cole_aqui_a_Project_URL
SUPABASE_SERVICE_ROLE_KEY=cole_aqui_a_chave_secreta
```

**Esta chave só pode estar neste arquivo.** Não cole no `.env.local`, no código, no GitHub, em e-mail nem no chat. Quem tem essa chave apaga e lê tudo. Se vazar, vá em **Project Settings → API** e gere uma nova.

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

1. **Authentication → Users**, clique na pessoa.
2. Use **Reset password** ou **Update password** e ponha a nova senha.
3. Vá em **Table Editor → `perfis`**, ache a linha dela e mude `senha_inicial` para **true**.

Assim, no próximo acesso, o site pede a troca de novo.

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

## 9. Atualizar a base da Enel

Quando sair uma planilha nova da Enel:

1. Abra o terminal na pasta `site-fechamento`.
2. Rode, trocando o caminho pela planilha nova:

```
python scripts/atualizar_base.py enel "<caminho da planilha nova.xlsx>"
```

3. O script confere a planilha, gera a base e envia para o Supabase.

Para só conferir, sem enviar nada, acrescente `--seco` no fim:

```
python scripts/atualizar_base.py enel "<caminho da planilha nova.xlsx>" --seco
```

O script usa o arquivo `AUTOMACAO KIT MATERIAL\supabase.env` da seção 4.
