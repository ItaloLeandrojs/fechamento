// Mão de obra do Ceará contada pelo DXF já lido (ResultadoCeara): por papel (ex. "poste MT novo",
// "retirada de cruzeta passante"), poste por poste. A voz real de cada papel vem da tabela de regras
// (fora do repositório); aqui só os papéis. Regras: docs/2026-11-06-ceara-mao-de-obra-dxf-design.md.
import type { Etiqueta, ItemEtiqueta, ResultadoCeara } from './contagem'
import type { Aba, BaseMaoDeObra, Papel } from './maoDeObra'

export interface Contagem {
  aba: Aba
  /** um dos dois: papel (postes) ou voz (regra de cabo) */
  papel?: Papel
  voz?: string
  quantidade: number
  origem: string // 'P12', 'sem nº', 'vãos de MT', 'vãos de BT'
  confira?: boolean
  /** falta resposta: aparece em vermelho e não soma */
  falta?: string
}
export type Pergunta =
  | { tipo: 'tensionar'; chave: string; poste: string; texto: string }
  | { tipo: 'fases'; chave: string; cabo: string; metros: number }
export interface RespostasDesenho {
  tensionar: Record<string, boolean>
  fases: Record<string, number>
  /** ligado ou desligado à mão, pela origem do poste ('P12') */
  linhaViva: Record<string, boolean>
}
export interface DesenhoMO {
  contagens: Contagem[]
  perguntas: Pergunta[] // só as que faltam responder
  chavesPerguntas: string[] // todas que valem neste desenho, respondidas ou não
  naoCobrado: string[] // ex. 'P1: a MB3.1 ancora cabo novo, tensionar não cobra'
  semRegra: { poste: string; texto: string }[]
  linhaViva: { poste: string; doDesenho: boolean; vale: boolean }[]
}

/** Item da etiqueta com o (2) já desdobrado: só novo (1), retirado (3) ou existente (null). */
export type ItemDesdobrado = Omit<ItemEtiqueta, 'situacao'> & { situacao: 1 | 3 | null }

/**
 * Item (2) (realocado ou tensionado) vira um (3) e um (1) do mesmo item, nessa ordem e no lugar dele.
 * Depois disso o (1) vale como qualquer (1) para todas as regras (cruzeta, tensionar...).
 */
export function desdobrar(e: Etiqueta): ItemDesdobrado[] {
  return e.itens.flatMap((i): ItemDesdobrado[] => (i.situacao === 2 ? [{ ...i, situacao: 3 }, { ...i, situacao: 1 }] : [{ ...i, situacao: i.situacao }]))
}

/** Código do item sem a marca do cabo da obra (§mt, §tr) e sem _S/_E. */
export const codigoLimpo = (codigo: string) => codigo.replace(/§(mt|tr)$/, '').replace(/_[SE]$/, '')

/** Estrutura de MT: N, M, B, U ou D, bifásica (B) ou monofásica (M) ou não, e o tipo (1 a 4). TR, SPTR e PR não entram. */
const MT = /^[NMBUD][BM]?(\d)/
const ARMACAO_BT = /^S[1-5]([A-Z]?)$/

/** Tipo da estrutura de MT (passante = tipo 1 e 2; o resto é encabeçamento ou derivação) e se é de rede compacta. */
export function estruturaMT(i: Pick<ItemEtiqueta, 'tipo' | 'codigo'>): { encabecamento: boolean; isolada: boolean } | null {
  // a monofásica (MM1, NM3...) ainda não é lida como estrutura pela contagem de hoje: vem como não reconhecida
  if (i.tipo !== 'estrutura' && i.tipo !== 'nao-reconhecido') return null
  const c = codigoLimpo(i.codigo)
  const m = MT.exec(c)
  if (!m) return null
  return { encabecamento: m[1] !== '1' && m[1] !== '2', isolada: /CCN|CSR/.test(c) }
}

const ehArmacao = (i: ItemDesdobrado) => i.tipo === 'estrutura' && ARMACAO_BT.test(codigoLimpo(i.codigo))

/** Faces de armação de BT: soma, por letra, de teto(n/2); S sem letra conta como letra própria. */
export function facesBT(armacoes: { codigo: string; quantidade: number }[]): number {
  const porLetra = new Map<string, number>()
  for (const a of armacoes) {
    const c = codigoLimpo(a.codigo)
    const letra = ARMACAO_BT.exec(c)?.[1] ?? c
    porLetra.set(letra, (porLetra.get(letra) ?? 0) + a.quantidade)
  }
  let faces = 0
  for (const n of porLetra.values()) faces += Math.ceil(n / 2)
  return faces
}

export function contarDesenhoMO(r: ResultadoCeara, _regras: Pick<BaseMaoDeObra, 'regrasCabo' | 'tensionar'>, resp: RespostasDesenho): DesenhoMO {
  const contagens: Contagem[] = []
  const semRegra: DesenhoMO['semRegra'] = []
  const linhaViva: DesenhoMO['linhaViva'] = []

  /** Contagens iguais (mesma aba, papel e origem) somam. */
  const somar = (aba: Aba, papel: Papel, quantidade: number, origem: string, confira = false) => {
    if (quantidade <= 0) return
    const ex = contagens.find((c) => c.aba === aba && c.papel === papel && c.origem === origem)
    if (ex) {
      ex.quantidade += quantidade
      if (confira) ex.confira = true
    } else contagens.push({ aba, papel, quantidade, origem, ...(confira ? { confira: true } : {}) })
  }

  for (const e of r.etiquetas) {
    const origem = e.poste ? 'P' + e.poste : 'sem nº'
    const itens = desdobrar(e)
    const tratados = new Set<ItemDesdobrado>()
    const de = (filtro: (i: ItemDesdobrado) => boolean, situacao?: 1 | 3) => {
      const achados = itens.filter((i) => filtro(i) && (situacao === undefined || i.situacao === situacao))
      for (const i of achados) tratados.add(i)
      return achados
    }
    const total = (l: ItemDesdobrado[]) => l.reduce((s, i) => s + i.quantidade, 0)

    const mts = itens.flatMap((i) => {
      const mt = estruturaMT(i)
      return mt ? [{ item: i, ...mt }] : []
    })
    const respLv = resp.linhaViva[origem]
    const lv = typeof respLv === 'boolean' ? respLv : e.linhaViva === true
    if (e.linhaViva || typeof respLv === 'boolean') linhaViva.push({ poste: origem, doDesenho: e.linhaViva === true, vale: lv })

    // poste de MT ou de BT pelas estruturas dele: o novo leva as (1) e as que passam (sem prefixo);
    // o retirado, as (3) e as sem prefixo (na troca, a (1) do poste novo não faz o velho ser de MT)
    const doPoste = (s: 1 | 3) => (i: { situacao: 1 | 3 | null }) => i.situacao === s || i.situacao === null
    const temMT = (s: 1 | 3) =>
      mts.some((m) => doPoste(s)(m.item)) ||
      itens.some((i) => doPoste(s)(i) && (i.tipo === 'trafo' || (i.tipo === 'estrutura' && /^TR/.test(codigoLimpo(i.codigo)))))

    // poste
    const postes1 = de((i) => i.tipo === 'poste', 1)
    const postes3 = de((i) => i.tipo === 'poste', 3)
    somar('adicao', temMT(1) ? 'poste-mt' : 'poste-bt', total(postes1), origem)
    const retiradaPoste: Papel =
      lv && temMT(3)
        ? mts.some((m) => doPoste(3)(m.item) && m.encabecamento)
          ? 'retirada-poste-lv-encabecamento'
          : 'retirada-poste-lv-passante'
        : temMT(3)
          ? 'retirada-poste-mt'
          : 'retirada-poste-bt'
    somar('devolucao', retiradaPoste, total(postes3), origem)

    // cruzeta de MT: cada unidade conta 1 (dupla, U e D também)
    for (const m of mts) tratados.add(m.item)
    const unidades = mts.filter((m) => m.item.situacao === 1).flatMap((m) => Array.from({ length: m.item.quantidade }, () => m))
    // poste novo: a primeira cruzeta (a de cima) já está na voz do poste, se nenhuma passa do poste velho
    if (postes1.length && !mts.some((m) => m.item.situacao === null)) unidades.shift()
    for (const m of unidades) {
      const papel: Papel = lv ? (m.encabecamento ? 'lv-instalacao-encabecamento' : 'lv-instalacao-passante') : m.isolada ? 'cruzeta-isolado' : 'cruzeta-nu'
      somar('adicao', papel, 1, origem)
    }
    // retirada pelo tipo que sai; no poste retirado ela já está na voz do poste
    if (!postes3.length) {
      for (const m of mts.filter((x) => x.item.situacao === 3)) {
        const papel: Papel = lv
          ? m.encabecamento
            ? 'lv-retirada-encabecamento'
            : 'lv-retirada-passante'
          : m.encabecamento
            ? 'retirada-cruzeta-encabecamento'
            : 'retirada-cruzeta-passante'
        somar('devolucao', papel, m.item.quantidade, origem)
      }
    }

    // armação de BT, por face; no poste novo ou retirado ela está na voz do poste
    const armacoes1 = de(ehArmacao, 1)
    const armacoes3 = de(ehArmacao, 3)
    const faces = (l: ItemDesdobrado[]) => facesBT(l.map((i) => ({ codigo: i.codigo, quantidade: i.quantidade })))
    if (!postes1.length) somar('adicao', 'armacao-bt', faces(armacoes1), origem, true)
    if (!postes3.length) somar('devolucao', 'retirada-armacao-bt', faces(armacoes3), origem, true)

    // trafo, caixa, conector de 4 saídas, cava na rocha
    const trafos1 = de((i) => i.tipo === 'trafo', 1)
    const trafos3 = de((i) => i.tipo === 'trafo', 3)
    somar('adicao', 'trafo', total(trafos1), origem)
    somar('adicao', 'estrutura-trafo', total(trafos1), origem)
    somar('devolucao', 'retirada-trafo', total(trafos3), origem)
    somar('devolucao', 'retirada-estrutura-trafo', total(trafos3), origem)
    somar('adicao', 'caixa', total(de((i) => i.tipo === 'estrutura' && /^SPCXD/.test(codigoLimpo(i.codigo)), 1)), origem)
    somar('adicao', 'conector-4-saidas', total(de((i) => i.tipo === 'conector' && /50-150/.test(i.codigo), 1)), origem)
    somar('adicao', 'cava-rocha', total(de((i) => i.tipo === 'ignorado' && i.codigo === 'CAVA KLC', 1)), origem)

    // o resto com prefixo vai para a nota "sem regra de mão de obra, confira"
    const doTrafo = trafos1.length > 0
    for (const i of itens) {
      if (i.situacao === null || tratados.has(i) || i.tipo === 'nao-reconhecido') continue
      const c = codigoLimpo(i.codigo)
      if (i.tipo === 'estrutura' && /^(TR|SPTR|SPALÇA|SPLAÇO)/.test(c)) continue
      // chave, elo e aterramento do trafo novo já estão na voz da estrutura do trafo
      if (doTrafo && (c === 'CF' || i.tipo === 'elo' || c === 'ATER-SP')) continue
      semRegra.push({ poste: origem, texto: `(${i.situacao})${i.texto.replace('CAVA_KLC', 'CAVA KLC')}` })
    }
  }

  return { contagens, perguntas: [], chavesPerguntas: [], naoCobrado: [], semRegra, linhaViva }
}
