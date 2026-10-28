// Lê o "<OT> - ORÇAMENTO.xlsx" feito à mão (Solicitação de acréscimos de material - Enel)
// para comparar com a contagem do desenho.
import { Workbook } from '../core/workbook'
import { SheetEditor, indexToCol } from '../core/sheet'
import { normalizarRotulo } from '../core/rotulos'
import type { Linha, ResultadoCeara } from './contagem'

export type Bloco = 'adicaoEstrutura' | 'devolucaoEstrutura' | 'adicaoMaterial' | 'devolucaoMaterial'

export const BLOCOS: { id: Bloco; titulo: string; aba: string }[] = [
  { id: 'adicaoEstrutura', titulo: 'Adição de estrutura', aba: 'ADIÇÃO ESTRUTURA' },
  { id: 'devolucaoEstrutura', titulo: 'Devolução de estrutura', aba: 'DEVOLUÇÃO ESTRUTURA' },
  { id: 'adicaoMaterial', titulo: 'Adição de material', aba: 'ADIÇÃO MATÉRIAL' },
  { id: 'devolucaoMaterial', titulo: 'Devolução de material', aba: 'DEVOLUÇÃO MATÉRIAL' },
]

export type Orcamento = Record<Bloco, Map<string, { quantidade: number; descricao: string }>>

/** Número do Excel; texto só com vírgula é decimal brasileiro ("8,82"); com ponto e vírgula, o ponto é milhar. */
const numero = (v: unknown) => {
  if (typeof v === 'number') return v
  const s = String(v ?? '').trim()
  return Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s) || 0
}

export async function lerOrcamento(bytes: Uint8Array): Promise<Orcamento> {
  const wb = await Workbook.open(bytes)
  const out = {} as Orcamento
  for (const b of BLOCOS) {
    const mapa = new Map<string, { quantidade: number; descricao: string }>()
    out[b.id] = mapa
    const aba = wb.sheets.find((s) => normalizarRotulo(s.name) === normalizarRotulo(b.aba))
    if (!aba) continue
    const ed = new SheetEditor(await wb.sheetDoc(aba.name), wb.sharedStrings)
    // cabeçalho: a linha que tem "CÓDIGO" e "QTD"
    let cab = 0
    const col: Record<string, string> = {}
    for (let r = 1; r <= 10 && !cab; r++) {
      for (let c = 1; c <= 15; c++) {
        const v = normalizarRotulo(String(ed.value(indexToCol(c) + r) ?? ''))
        if (v === 'codigo') col.codigo = indexToCol(c)
        if (v === 'qtd') col.qtd = indexToCol(c)
        if (v === 'descricao') col.desc = indexToCol(c)
      }
      if (col.codigo && col.qtd) cab = r
    }
    if (!cab) continue
    for (let r = cab + 1; r <= ed.lastRow; r++) {
      const codigo = String(ed.value(col.codigo + r) ?? '').trim()
      if (!codigo) continue
      const atual = mapa.get(codigo)
      mapa.set(codigo, { quantidade: (atual?.quantidade ?? 0) + numero(ed.value(col.qtd + r)), descricao: col.desc ? String(ed.value(col.desc + r) ?? '').trim() : '' })
    }
  }
  return out
}

export interface LinhaComparada {
  codigo: string
  descricao: string
  desenho: number | null
  orcamento: number | null
  situacao: 'igual' | 'diferente' | 'so-desenho' | 'so-orcamento'
  origem: string[]
  palpite: boolean
}

export function comparar(r: ResultadoCeara, orc: Orcamento): Record<Bloco, LinhaComparada[]> {
  const out = {} as Record<Bloco, LinhaComparada[]>
  for (const b of BLOCOS) {
    const desenho = new Map<string, Linha>(r[b.id].map((l) => [l.codigo, l]))
    const codigos = [...new Set([...desenho.keys(), ...orc[b.id].keys()])]
    out[b.id] = codigos.map((codigo) => {
      const d = desenho.get(codigo)
      const o = orc[b.id].get(codigo)
      const dq = d ? Math.round(d.quantidade * 100) / 100 : null
      const oq = o ? Math.round(o.quantidade * 100) / 100 : null
      const situacao = dq === null ? 'so-orcamento' : oq === null ? 'so-desenho' : Math.abs(dq - oq) < 0.011 ? 'igual' : 'diferente'
      return { codigo, descricao: d?.descricao || o?.descricao || '', desenho: dq, orcamento: oq, situacao, origem: d?.origem ?? [], palpite: !!d?.palpite }
    })
  }
  return out
}
