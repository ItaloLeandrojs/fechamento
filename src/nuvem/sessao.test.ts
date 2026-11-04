import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { entrar, perfilAtual, trocarSenha, mensagemDeErro } from './sessao'
import { armazenamentoDaSessao } from './armazenamento'
import {
  SENHA_ERRADA, MUITAS_TENTATIVAS, SEM_INTERNET, SERVIDOR_PARADO, CADASTRO_INCOMPLETO, SENHA_CURTA,
} from './mensagens'

const SESSAO = { user: { id: 'u1' } }
const LINHA = { id: 'u1', nome: 'Maria', cargo: 'Planejadora', matricula: '123', senha_inicial: false }

/** Cliente falso: só o que sessao.ts usa. */
function falso(o: { signIn?: unknown; sessao?: unknown; linha?: unknown; update?: unknown } = {}) {
  const f = {
    signInWithPassword: vi.fn(async () => o.signIn ?? { data: { session: SESSAO, user: SESSAO.user }, error: null }),
    getSession: vi.fn(async () => ({ data: { session: 'sessao' in o ? o.sessao : SESSAO }, error: null })),
    updateUser: vi.fn(async () => o.update ?? { data: {}, error: null }),
    signOut: vi.fn(async () => ({ error: null })),
    maybeSingle: vi.fn(async () => ({ data: 'linha' in o ? o.linha : LINHA, error: null })),
    rpc: vi.fn(async () => ({ data: null, error: null })),
  }
  const c = {
    auth: { signInWithPassword: f.signInWithPassword, getSession: f.getSession, updateUser: f.updateUser, signOut: f.signOut },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: f.maybeSingle }) }) }),
    rpc: f.rpc,
  } as unknown as SupabaseClient
  return { c, f }
}

describe('sessão', () => {
  it('e-mail é limpo antes de entrar', async () => {
    const { c, f } = falso()
    await entrar(c, '  Maria@Cosampa.com ', 'x')
    expect(f.signInWithPassword).toHaveBeenCalledWith({ email: 'maria@cosampa.com', password: 'x' })
  })

  it('senha errada vira SENHA_ERRADA', async () => {
    const { c } = falso({ signIn: { data: {}, error: { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' } } })
    await expect(entrar(c, 'a@b.c', 'x')).rejects.toThrow(SENHA_ERRADA)
  })

  it('429 vira MUITAS_TENTATIVAS', async () => {
    const { c } = falso({ signIn: { data: {}, error: { status: 429, message: 'rate limit' } } })
    await expect(entrar(c, 'a@b.c', 'x')).rejects.toThrow(MUITAS_TENTATIVAS)
  })

  it('falha de rede offline vira SEM_INTERNET', () => {
    expect(mensagemDeErro(new TypeError('Failed to fetch'), false)).toBe(SEM_INTERNET)
  })

  it('falha de rede online vira SERVIDOR_PARADO', () => {
    expect(mensagemDeErro(new TypeError('Failed to fetch'), true)).toBe(SERVIDOR_PARADO)
  })

  it('mensagem já conhecida passa direto e o resto vira SERVIDOR_PARADO', () => {
    expect(mensagemDeErro(new Error(CADASTRO_INCOMPLETO), true)).toBe(CADASTRO_INCOMPLETO)
    expect(mensagemDeErro('qualquer coisa', true)).toBe(SERVIDOR_PARADO)
    expect(mensagemDeErro({ status: 540, message: 'x' }, true)).toBe(SERVIDOR_PARADO)
  })

  it('sem perfil vira cadastro incompleto', async () => {
    const { c } = falso({ linha: null })
    await expect(perfilAtual(c)).rejects.toThrow(CADASTRO_INCOMPLETO)
  })

  it('sem sessão devolve null e com perfil devolve senhaInicial', async () => {
    expect(await perfilAtual(falso({ sessao: null }).c)).toBeNull()
    expect(await perfilAtual(falso().c)).toEqual({ id: 'u1', nome: 'Maria', cargo: 'Planejadora', matricula: '123', senhaInicial: false })
  })

  it('senha curta não chama o servidor', async () => {
    const { c, f } = falso()
    await expect(trocarSenha(c, '1234567', '1234567')).rejects.toThrow(SENHA_CURTA)
    expect(f.updateUser).toHaveBeenCalledTimes(0)
  })

  it('troca de senha marca a senha trocada', async () => {
    const { c, f } = falso()
    await trocarSenha(c, 'senhaboa123', 'senhaboa123', 'inicial123')
    expect(f.updateUser).toHaveBeenCalledWith({ password: 'senhaboa123' })
    expect(f.rpc).toHaveBeenCalledTimes(1)
    expect(f.rpc).toHaveBeenCalledWith('marcar_senha_trocada')
  })
})

describe('armazenamento da sessão', () => {
  it('storage bloqueado fica só nesta aba', async () => {
    const ruim = { getItem: () => null, removeItem: () => {}, setItem: () => { throw new Error('bloqueado') } } as unknown as Storage
    const a = armazenamentoDaSessao(ruim)
    expect(a.soNestaAba).toBe(true)
    await a.storage.setItem('k', 'v')
    expect(await a.storage.getItem('k')).toBe('v')
  })

  it('storage que funciona é usado de verdade', () => {
    const m = new Map<string, string>()
    const bom = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } as unknown as Storage
    const a = armazenamentoDaSessao(bom)
    expect(a.soNestaAba).toBe(false)
    expect(a.storage).toBe(bom)
  })
})
