// `node scripts/conferir-supabase.mjs`: confere, no Supabase de verdade, que as regras de acesso
// fazem o que o site espera. Lê o .env.local (URL e chave pública) e o ../supabase-teste.env
// (EMAIL_TESTE e SENHA_TESTE de uma conta de teste criada pelo Italo). Nunca usa a chave secreta.
// Imprime OK ou FALHOU em cada item e sai com código 1 se algum falhar.
// Não troca a senha da conta de teste nem grava nada que dê certo: toda escrita tentada aqui
// deveria ser negada.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const PROJ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function lerEnv(arquivo) {
  if (!fs.existsSync(arquivo)) {
    console.error(`Falta o arquivo ${arquivo} (veja docs/supabase-passo-a-passo.md).`)
    process.exit(2)
  }
  const valores = {}
  for (const linha of fs.readFileSync(arquivo, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(linha)
    if (m) valores[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return valores
}

const site = lerEnv(path.join(PROJ, '.env.local'))
const teste = lerEnv(path.join(PROJ, '..', 'supabase-teste.env'))
const URL = (site.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
const CHAVE = site.VITE_SUPABASE_ANON_KEY ?? ''
for (const [nome, valor] of [['VITE_SUPABASE_URL', URL], ['VITE_SUPABASE_ANON_KEY', CHAVE],
  ['EMAIL_TESTE', teste.EMAIL_TESTE], ['SENHA_TESTE', teste.SENHA_TESTE]]) {
  if (!valor) {
    console.error(`Falta ${nome}.`)
    process.exit(2)
  }
}

const novoCliente = () => createClient(URL, CHAVE, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

let falhas = 0
function item(ok, texto, detalhe = '') {
  if (!ok) falhas++
  console.log(`${ok ? 'OK     ' : 'FALHOU '} ${texto}${detalhe ? ` (${detalhe})` : ''}`)
}
// escrita negada: veio erro, ou nenhuma linha foi mexida
const negado = ({ error, data }) => Boolean(error) || (Array.isArray(data) && data.length === 0)

// ---------------------------------------------------------------- com a conta de teste
console.log('Com a conta de teste:')
const logado = novoCliente()
const entrada = await logado.auth.signInWithPassword({ email: teste.EMAIL_TESTE, password: teste.SENHA_TESTE })
item(!entrada.error, 'entra com e-mail e senha', entrada.error?.message)
if (entrada.error) {
  console.log('\nSem login não dá para conferir o resto. Confira o supabase-teste.env.')
  process.exit(1)
}
const uid = entrada.data.user.id

const perfis = await logado.from('perfis').select('id')
item(!perfis.error && perfis.data.length === 1 && perfis.data[0].id === uid,
  'lê só o próprio perfil', perfis.error?.message ?? `${perfis.data?.length} linha(s)`)

const bases = await logado.from('bases').select('nome, arquivo, versao')
const nomes = (bases.data ?? []).map((b) => b.nome).sort().join(',')
// a lista de mão de obra é opcional: 2 linhas (sem ela) ou 3 (com ela)
item(!bases.error && (nomes === 'edp,enel' || nomes === 'edp,enel,mao-de-obra'), 'lê as linhas de bases (edp, enel e, se já subiu, mao-de-obra)', bases.error?.message ?? nomes)

const arquivos = (bases.data ?? []).map((b) => b.arquivo)
for (const arquivo of arquivos) {
  const baixa = await logado.storage.from('bases').download(arquivo)
  const tamanho = baixa.data ? baixa.data.size : 0
  item(!baixa.error && tamanho > 0, `baixa ${arquivo}`, baixa.error?.message ?? `${Math.round(tamanho / 1024)} KB`)
}

item(negado(await logado.from('perfis').insert({ id: uid, nome: 'x' }).select()), 'insert em perfis negado')
item(negado(await logado.from('perfis').update({ nome: 'x' }).eq('id', uid).select()), 'update em perfis negado')
item(negado(await logado.from('bases').insert({ nome: 'edp', versao: 'x', arquivo: 'x', contagens: {} }).select()),
  'insert em bases negado')
item(negado(await logado.from('bases').update({ versao: 'x' }).eq('nome', 'edp').select()), 'update em bases negado')
item(negado(await logado.from('bases').delete().eq('nome', 'edp').select()), 'delete em bases negado')
const sobe = await logado.storage.from('bases').upload(`conferencia-${Date.now()}.txt`, new Blob(['x']))
item(Boolean(sobe.error), 'upload no bucket negado', sobe.error ? '' : 'o arquivo subiu!')
if (arquivos[0]) {
  const apaga = await logado.storage.from('bases').remove([arquivos[0]])
  item(Boolean(apaga.error) || (apaga.data ?? []).length === 0, 'apagar arquivo do bucket negado')
}
await logado.auth.signOut({ scope: 'local' })

// ---------------------------------------------------------------- sem login
console.log('\nSem login:')
const anonimo = novoCliente()
const p0 = await anonimo.from('perfis').select('id')
item(Boolean(p0.error) || p0.data.length === 0, 'perfis vazio', p0.error?.message ?? `${p0.data.length} linha(s)`)
const b0 = await anonimo.from('bases').select('nome')
item(Boolean(b0.error) || b0.data.length === 0, 'bases vazio', b0.error?.message ?? `${b0.data.length} linha(s)`)
for (const arquivo of arquivos) {
  const baixa = await anonimo.storage.from('bases').download(arquivo)
  item(Boolean(baixa.error), `download de ${arquivo} negado`)
  const publico = await fetch(`${URL}/storage/v1/object/public/bases/${arquivo}`)
  item(!publico.ok, `rota pública de ${arquivo} negada`, `status ${publico.status}`)
}
const rpc = await anonimo.rpc('marcar_senha_trocada')
item(Boolean(rpc.error), 'marcar_senha_trocada negado')
const cadastro = await anonimo.auth.signUp({
  email: `conferencia-${Date.now()}@example.com`, password: `Conferencia-${Date.now()}`,
})
item(Boolean(cadastro.error), 'cadastro pelo site recusado', cadastro.error?.message ?? 'a conta foi criada!')
const anon = await anonimo.auth.signInAnonymously()
item(Boolean(anon.error), 'login anônimo recusado', anon.error?.message ?? 'entrou!')

console.log(falhas ? `\n${falhas} item(ns) FALHOU.` : '\nTudo OK.')
process.exit(falhas ? 1 : 0)
