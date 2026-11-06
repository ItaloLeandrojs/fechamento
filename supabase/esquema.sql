-- Esquema do Supabase do site Fechamento.
-- Pode ser rodado mais de uma vez (SQL Editor -> colar tudo -> Run).
-- Escrita nas tabelas e no bucket so acontece pela chave secreta do script
-- (service_role), que ignora as regras de linha. O site so le.

-- ---------------------------------------------------------------
-- 1. Perfis: uma linha por pessoa que entra no site
-- ---------------------------------------------------------------
create table if not exists public.perfis (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  nome          text not null default '',
  cargo         text not null default '',
  matricula     text not null default '',
  senha_inicial boolean not null default true
);

alter table public.perfis enable row level security;

-- Cada pessoa le so a propria linha. Nao ha regra de insert/update/delete.
drop policy if exists "perfis: ler a propria linha" on public.perfis;
create policy "perfis: ler a propria linha"
  on public.perfis for select
  to authenticated
  using (id = (select auth.uid()));

-- Privilegios explicitos: ninguem escreve, anon nem le.
revoke all on public.perfis from anon, authenticated;
grant select on public.perfis to authenticated;

-- ---------------------------------------------------------------
-- 2. Bases: qual versao de cada base esta no bucket
-- ---------------------------------------------------------------
create table if not exists public.bases (
  nome          text primary key check (nome in ('enel', 'edp', 'mao-de-obra')),
  versao        text not null,
  arquivo       text not null,
  atualizado_em timestamptz not null default now(),
  contagens     jsonb not null
);

-- Terceira base, opcional: a lista de mao de obra do Ceara. Troca o check de bases ja criadas.
alter table public.bases drop constraint if exists bases_nome_check;
alter table public.bases add constraint bases_nome_check check (nome in ('enel', 'edp', 'mao-de-obra'));

alter table public.bases enable row level security;

-- Quem esta logado le; ninguem escreve pelo site.
drop policy if exists "bases: ler logado" on public.bases;
create policy "bases: ler logado"
  on public.bases for select
  to authenticated
  using (true);

revoke all on public.bases from anon, authenticated;
grant select on public.bases to authenticated;

-- ---------------------------------------------------------------
-- 3. Gatilho: cria o perfil quando o Italo cria a conta
-- ---------------------------------------------------------------
create or replace function public.criar_perfil_do_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.criar_perfil_do_usuario() from public, anon, authenticated;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_do_usuario();

-- ---------------------------------------------------------------
-- 4. Troca de senha: a pessoa marca que ja trocou a senha inicial
-- ---------------------------------------------------------------
create or replace function public.marcar_senha_trocada()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.perfis
     set senha_inicial = false
   where id = auth.uid();
$$;

revoke all on function public.marcar_senha_trocada() from public, anon;
grant execute on function public.marcar_senha_trocada() to authenticated;

-- ---------------------------------------------------------------
-- 5. Bucket privado 'bases' (arquivos <nome>-<versao>.json.gz)
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('bases', 'bases', false)
on conflict (id) do update set public = false;

-- Quem esta logado baixa; nao ha regra de escrita.
drop policy if exists "bases: baixar logado" on storage.objects;
create policy "bases: baixar logado"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'bases');
