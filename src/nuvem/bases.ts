// Bases baixadas do servidor (Enel e kits da EDP): baixa só quando a versão muda e guarda neste computador.
import { lerBase, gravarBase, type BaseGuardada } from '../lib/banco'
import type { BaseEnel } from '../ceara/contagem'
import type { Kit } from '../state'
import { PAPEIS, type BaseMaoDeObra } from '../ceara/maoDeObra'
import { PRIMEIRA_VEZ_SEM_INTERNET } from './mensagens'

export interface FonteBases {
  versoes(): Promise<Record<'enel' | 'edp', { versao: string; arquivo: string }> & Partial<Record<'mao-de-obra', { versao: string; arquivo: string }>>>
  baixar(arquivo: string): Promise<Blob>
}

export interface GuardaBases {
  ler: typeof lerBase
  gravar: typeof gravarBase
}

const GUARDA_PADRAO: GuardaBases = { ler: lerBase, gravar: gravarBase }

const NOME_NA_TELA: Record<'enel' | 'edp', string> = { enel: 'da Enel', edp: 'da EDP' }

/** Abre um arquivo .gz (gzip) e devolve o JSON de dentro. Funciona no navegador e no Node. */
export async function abrirGz(blob: Blob): Promise<unknown> {
  return new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).json()
}

function ehObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

export function conferirBaseEnel(x: unknown): BaseEnel {
  if (!ehObjeto(x)) throw new Error('A base da Enel veio em formato inesperado.')
  for (const parte of ['materiais', 'estruturas', 'kits']) {
    const v = x[parte]
    if (!ehObjeto(v) || Object.keys(v).length === 0) throw new Error(`A base da Enel veio sem "${parte}".`)
  }
  return x as unknown as BaseEnel
}

export function conferirKitsEdp(x: unknown): Kit[] {
  if (!Array.isArray(x) || x.length === 0) throw new Error('A base de kits da EDP veio vazia ou em formato inesperado.')
  for (const k of x) {
    if (!ehObjeto(k) || typeof k.kit !== 'string' || !Array.isArray(k.itens)) {
      throw new Error('A base de kits da EDP tem um kit em formato inesperado.')
    }
  }
  return x as Kit[]
}

const eTexto = (x: unknown): x is string => typeof x === 'string'
const AVISO_SEM_LISTA = 'A lista de mão de obra ainda não está no servidor. Na Leitura do CAD, a mão de obra fica de fora.'
const AVISO_LISTA_ANTIGA = 'Não deu para atualizar a lista de mão de obra: usando a cópia guardada neste computador.'

export function conferirBaseMaoDeObra(x: unknown): BaseMaoDeObra {
  const erro = (m: string) => new Error(`A lista de mão de obra veio em formato inesperado: ${m}.`)
  if (!ehObjeto(x)) throw erro('não é um objeto')
  if (!Array.isArray(x.lista) || x.lista.length === 0) throw erro('sem "lista"')
  const vozes = new Set<string>()
  for (const v of x.lista) {
    if (!ehObjeto(v) || !eTexto(v.voz) || !eTexto(v.descricao) || !eTexto(v.unidade)) throw erro('uma voz sem texto')
    if (v.letra !== 'A' && v.letra !== 'B') throw erro('uma voz com letra fora de A/B')
    if (!eTexto(v.numero) || !/^\d{10}$/.test(v.numero)) throw erro('uma voz com número fora do padrão')
    vozes.add(v.voz)
  }
  if (!ehObjeto(x.papeis)) throw erro('sem "papeis"')
  for (const p of PAPEIS) {
    const v = x.papeis[p]
    if (!eTexto(v) || !vozes.has(v)) throw erro(`o papel "${p}" não aponta para uma voz da lista`)
  }
  if (!Array.isArray(x.regrasCabo)) throw erro('sem "regrasCabo"')
  for (const r of x.regrasCabo) {
    if (!ehObjeto(r) || !['mt', 'bt-nu', 'bt-multi'].includes(r.grupo as string) || !['novo', 'retirado'].includes(r.situacao as string)
      || !['metro', 'condutor'].includes(r.por as string)) throw erro('uma regra de cabo com valor inválido')
    if (!eTexto(r.voz) || !vozes.has(r.voz)) throw erro('uma regra de cabo com voz fora da lista')
    if (r.bitolas !== undefined && (!Array.isArray(r.bitolas) || !r.bitolas.every(eTexto))) throw erro('uma regra de cabo com bitolas inválidas')
  }
  if (!Array.isArray(x.tensionar)) throw erro('sem "tensionar"')
  for (const t of x.tensionar) {
    if (!ehObjeto(t) || (t.rede !== 'mt' && t.rede !== 'bt')) throw erro('uma regra de tensionar com rede inválida')
    if (!Array.isArray(t.exige) || t.exige.length === 0 || !t.exige.every(eTexto)) throw erro('uma regra de tensionar sem expressões')
    if (t.rede === 'mt' && t.exige.length > 1) throw erro('regra de tensionar da MT com mais de uma expressão')
    for (const e of t.exige as string[]) {
      try {
        new RegExp(e)
      } catch {
        throw erro('uma expressão de tensionar não compila')
      }
    }
    if (typeof t.qtd !== 'number' || !(t.qtd > 0)) throw erro('uma regra de tensionar com quantidade inválida')
  }
  return x as unknown as BaseMaoDeObra
}

const CONFERIR: { enel: (x: unknown) => BaseEnel; edp: (x: unknown) => Kit[]; 'mao-de-obra': (x: unknown) => BaseMaoDeObra } = {
  enel: conferirBaseEnel,
  edp: conferirKitsEdp,
  'mao-de-obra': conferirBaseMaoDeObra,
}

/**
 * Devolve as bases prontas. Para cada uma: confere a versão, baixa, abre, confere o formato e só então grava.
 * Se uma falhar, vale a cópia guardada dela (com aviso). Sem cópia nenhuma, lança PRIMEIRA_VEZ_SEM_INTERNET.
 * A lista de mão de obra é opcional: sem ela (ou sem cópia), devolve null com aviso e nunca lança.
 */
export async function garantirBases(
  fonte: FonteBases,
  guarda: GuardaBases = GUARDA_PADRAO,
): Promise<{ enel: BaseEnel; edp: Kit[]; maoDeObra: BaseMaoDeObra | null; avisos: string[] }> {
  const avisos: string[] = []
  let versoes: Awaited<ReturnType<FonteBases['versoes']>> | null = null
  try {
    versoes = await fonte.versoes()
  } catch {
    avisos.push('Sem conexão com o servidor: usando as bases guardadas neste computador.')
  }

  async function obter<T>(nome: 'enel' | 'edp'): Promise<T> {
    const guardada = await guarda.ler<T>(nome)
    const atual = versoes?.[nome]
    if (!atual) {
      if (!guardada) throw new Error(PRIMEIRA_VEZ_SEM_INTERNET)
      return guardada.dados
    }
    if (guardada && guardada.versao === atual.versao) return guardada.dados
    try {
      const dados = CONFERIR[nome](await abrirGz(await fonte.baixar(atual.arquivo))) as T
      await guarda.gravar({ nome, versao: atual.versao, dados } satisfies BaseGuardada<unknown>)
      return dados
    } catch {
      if (!guardada) throw new Error(PRIMEIRA_VEZ_SEM_INTERNET)
      avisos.push(`Não deu para atualizar a base ${NOME_NA_TELA[nome]}: usando a cópia guardada neste computador.`)
      return guardada.dados
    }
  }

  async function obterMaoDeObra(): Promise<BaseMaoDeObra | null> {
    const guardada = await guarda.ler<BaseMaoDeObra>('mao-de-obra')
    const atual = versoes?.['mao-de-obra']
    if (!atual) {
      // sem linha no servidor (ou sem conexão): a cópia vale em silêncio; sem cópia, segue sem a lista
      if (!guardada) avisos.push(AVISO_SEM_LISTA)
      return guardada?.dados ?? null
    }
    if (guardada && guardada.versao === atual.versao) return guardada.dados
    try {
      const dados = conferirBaseMaoDeObra(await abrirGz(await fonte.baixar(atual.arquivo)))
      await guarda.gravar({ nome: 'mao-de-obra', versao: atual.versao, dados } satisfies BaseGuardada<unknown>)
      return dados
    } catch {
      if (!guardada) {
        avisos.push(AVISO_SEM_LISTA)
        return null
      }
      avisos.push(AVISO_LISTA_ANTIGA)
      return guardada.dados
    }
  }

  const [enel, edp, maoDeObra] = await Promise.all([obter<BaseEnel>('enel'), obter<Kit[]>('edp'), obterMaoDeObra()])
  return { enel, edp, maoDeObra, avisos }
}
