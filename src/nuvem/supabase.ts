// Cliente do Supabase e a fonte das bases (tabela "bases" + balde privado "bases").
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { FonteBases } from './bases'
import { armazenamentoDaSessao } from './armazenamento'
import { erroDoBanco } from './sessao'

export { armazenamentoDaSessao }

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const CHAVE = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const guarda = armazenamentoDaSessao()

/** Painel usa isto como "semGuardar": a sessão não sobrevive ao fechar a aba. */
export const sessaoSoNestaAba = guarda.soNestaAba

/** null quando faltam as variáveis (modo dev sem .env.local). */
export const nuvem: SupabaseClient | null = URL && CHAVE
  ? createClient(URL, CHAVE, { auth: { persistSession: true, autoRefreshToken: true, storage: guarda.storage } })
  : null

export function fonteSupabase(c: SupabaseClient): FonteBases {
  return {
    async versoes() {
      const { data, error, status } = await c.from('bases').select('nome,versao,arquivo')
      if (error) throw erroDoBanco(error, status)
      const linhas = (data ?? []) as { nome: string; versao: string; arquivo: string }[]
      const achar = (nome: 'enel' | 'edp') => {
        const l = linhas.find((x) => x.nome === nome)
        if (!l) throw new Error(`Falta a base "${nome}" no servidor.`)
        return { versao: l.versao, arquivo: l.arquivo }
      }
      return { enel: achar('enel'), edp: achar('edp') }
    },
    async baixar(arquivo) {
      const { data, error } = await c.storage.from('bases').download(arquivo)
      if (error) throw error
      return data
    },
  }
}
