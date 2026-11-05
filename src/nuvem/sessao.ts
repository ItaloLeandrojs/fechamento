// Entrar, sair, perfil e troca de senha. O cliente vem por parâmetro (os testes passam um falso).
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  SENHA_ERRADA, SEM_INTERNET, SERVIDOR_PARADO, MUITAS_TENTATIVAS, CADASTRO_INCOMPLETO,
  PRIMEIRA_VEZ_SEM_INTERNET, SENHA_CURTA, SENHAS_DIFERENTES, SENHA_IGUAL, SENHA_FRACA, SERVIDOR_REAUTENTICAR,
} from './mensagens'

export type Perfil = { id: string; nome: string; cargo: string; matricula: string; senhaInicial: boolean }

const MIN_SENHA = 8
const CONHECIDAS = new Set([
  SENHA_ERRADA, SEM_INTERNET, SERVIDOR_PARADO, MUITAS_TENTATIVAS, CADASTRO_INCOMPLETO,
  PRIMEIRA_VEZ_SEM_INTERNET, SENHA_CURTA, SENHAS_DIFERENTES, SENHA_IGUAL,
  SENHA_FRACA, SERVIDOR_REAUTENTICAR,
])

function estaOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

/** Traduz qualquer erro (Supabase, rede, nosso) numa das mensagens fixas da tela. */
export function mensagemDeErro(e: unknown, online: boolean = estaOnline()): string {
  if (e instanceof Error && CONHECIDAS.has(e.message)) return e.message
  const x = (typeof e === 'object' && e !== null ? e : {}) as { code?: unknown; status?: unknown; name?: unknown }
  const status = typeof x.status === 'number' ? x.status : undefined
  if (x.code === 'invalid_credentials' || ((status === 400 || status === 401) && !x.code)) return SENHA_ERRADA
  if (status === 429 || x.code === 'over_request_rate_limit') return MUITAS_TENTATIVAS
  // o Supabase recusa (422) a senha nova igual à atual, mesmo sem o site saber a senha atual
  if (x.code === 'same_password') return SENHA_IGUAL
  if (x.code === 'weak_password') return SENHA_FRACA
  if (x.code === 'reauthentication_needed') return SERVIDOR_REAUTENTICAR
  const rede = e instanceof TypeError || x.name === 'AuthRetryableFetchError' || status === 0
  if (rede) return online ? SERVIDOR_PARADO : SEM_INTERNET
  return SERVIDOR_PARADO
}

/** Erro de uma chamada ao banco. O postgrest-js não lança na falha de rede: devolve status 0 fora do `error`. */
export function erroDoBanco(error: unknown, status: number | undefined, online: boolean = estaOnline()): Error {
  return new Error(mensagemDeErro(status === 0 ? { ...(error as object), status: 0 } : error, online))
}

type LinhaPerfil = { id: string; nome: string | null; cargo: string | null; matricula: string | null; senha_inicial: boolean | null }

async function buscarPerfil(c: SupabaseClient, userId: string): Promise<LinhaPerfil | null> {
  const { data, error, status } = await c.from('perfis').select('id,nome,cargo,matricula,senha_inicial').eq('id', userId).maybeSingle()
  if (error) throw erroDoBanco(error, status)
  return data as LinhaPerfil | null
}

function montarPerfil(data: LinhaPerfil | null): Perfil {
  if (!data || !String(data.nome ?? '').trim()) throw new Error(CADASTRO_INCOMPLETO)
  return { id: data.id, nome: data.nome ?? '', cargo: data.cargo ?? '', matricula: data.matricula ?? '', senhaInicial: !!data.senha_inicial }
}

/** O servidor respondeu e recusou a sessão (ex.: conta apagada, sessão revogada). Falha de rede, 429 e 5xx não contam. */
function sessaoRecusada(e: unknown): boolean {
  const x = (typeof e === 'object' && e !== null ? e : {}) as { status?: unknown; name?: unknown }
  if (x.name === 'AuthRetryableFetchError' || typeof x.status !== 'number') return false
  return x.status >= 400 && x.status < 500 && x.status !== 429
}

/** Esquece a sessão guardada neste navegador, sem falar com o servidor. */
async function esquecerSessao(c: SupabaseClient): Promise<void> {
  try {
    await c.auth.signOut({ scope: 'local' })
  } catch {
    // não há o que fazer: a tela de entrada aparece do mesmo jeito
  }
}

export async function entrar(c: SupabaseClient, email: string, senha: string): Promise<Perfil> {
  let id: string
  try {
    const { data, error } = await c.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha })
    if (error) throw error
    id = data.user.id
  } catch (e) {
    throw new Error(mensagemDeErro(e))
  }
  return montarPerfil(await buscarPerfil(c, id))
}

/**
 * Sessão guardada neste navegador. Se a conta foi apagada (o servidor recusa a sessão vencida, ou a
 * sessão ainda vale mas o perfil sumiu junto), a sessão é esquecida e a pessoa vê a entrada limpa.
 * Perfil que existe sem nome continua sendo "cadastro incompleto".
 */
export async function perfilAtual(c: SupabaseClient): Promise<Perfil | null> {
  let id: string | undefined
  try {
    const { data, error } = await c.auth.getSession()
    if (error) {
      if (!data?.session && sessaoRecusada(error)) {
        await esquecerSessao(c)
        return null
      }
      throw error
    }
    id = data.session?.user.id
  } catch (e) {
    throw new Error(mensagemDeErro(e))
  }
  if (!id) return null
  const linha = await buscarPerfil(c, id)
  if (!linha) {
    await esquecerSessao(c)
    return null
  }
  return montarPerfil(linha)
}

export async function trocarSenha(c: SupabaseClient, nova: string, confirma: string, atual?: string): Promise<void> {
  if (nova.length < MIN_SENHA) throw new Error(SENHA_CURTA)
  if (nova !== confirma) throw new Error(SENHAS_DIFERENTES)
  if (atual !== undefined && nova === atual) throw new Error(SENHA_IGUAL)
  try {
    const { error } = await c.auth.updateUser({ password: nova })
    if (error) throw error
    const r = await c.rpc('marcar_senha_trocada')
    if (r.error) throw erroDoBanco(r.error, r.status)
  } catch (e) {
    throw new Error(mensagemDeErro(e))
  }
}

export async function sair(c: SupabaseClient): Promise<void> {
  await c.auth.signOut({ scope: 'local' })
}
