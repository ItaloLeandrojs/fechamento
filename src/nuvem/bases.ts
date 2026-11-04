// Bases baixadas do servidor (Enel e kits da EDP): baixa só quando a versão muda e guarda neste computador.
import { lerBase, gravarBase, type BaseGuardada, type NomeBase } from '../lib/banco'
import type { BaseEnel } from '../ceara/contagem'
import type { Kit } from '../state'
import { PRIMEIRA_VEZ_SEM_INTERNET } from './mensagens'

export interface FonteBases {
  versoes(): Promise<Record<NomeBase, { versao: string; arquivo: string }>>
  baixar(arquivo: string): Promise<Blob>
}

export interface GuardaBases {
  ler: typeof lerBase
  gravar: typeof gravarBase
}

const GUARDA_PADRAO: GuardaBases = { ler: lerBase, gravar: gravarBase }

const NOME_NA_TELA: Record<NomeBase, string> = { enel: 'da Enel', edp: 'da EDP' }

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

const CONFERIR: { enel: (x: unknown) => BaseEnel; edp: (x: unknown) => Kit[] } = {
  enel: conferirBaseEnel,
  edp: conferirKitsEdp,
}

/**
 * Devolve as duas bases prontas. Para cada uma: confere a versão, baixa, abre, confere o formato e só então grava.
 * Se uma falhar, vale a cópia guardada dela (com aviso). Sem cópia nenhuma, lança PRIMEIRA_VEZ_SEM_INTERNET.
 */
export async function garantirBases(
  fonte: FonteBases,
  guarda: GuardaBases = GUARDA_PADRAO,
): Promise<{ enel: BaseEnel; edp: Kit[]; avisos: string[] }> {
  const avisos: string[] = []
  let versoes: Awaited<ReturnType<FonteBases['versoes']>> | null = null
  try {
    versoes = await fonte.versoes()
  } catch {
    avisos.push('Sem conexão com o servidor: usando as bases guardadas neste computador.')
  }

  async function obter<T>(nome: NomeBase): Promise<T> {
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

  const [enel, edp] = await Promise.all([obter<BaseEnel>('enel'), obter<Kit[]>('edp')])
  return { enel, edp, avisos }
}
