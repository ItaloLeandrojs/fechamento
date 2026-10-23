import { Workbook } from './workbook'
import { SheetEditor } from './sheet'
import { ADS_SHEET, readAds, type AdsRow } from './ads'

export interface ItemCatalogo {
  code: number
  desc: string
  un: string
}

export interface ResumoInventario {
  nota: string
  empreiteira: string
  tipoObra: string
  ordens: string[]
  ads: AdsRow[]
  catalogo: ItemCatalogo[]
  /** Operações que aparecem na ADS, com a descrição da EDP. */
  operacoes: { oper: string; descricao: string }[]
  abas: string[]
}

function txt(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim()
}

/**
 * Lê o cadastro MaterialServico direto do texto do XML (a aba tem ~40 mil
 * linhas e montar o XML inteiro na memória seria lento). Só colunas C, D e E.
 */
async function lerCatalogo(wb: Workbook): Promise<ItemCatalogo[]> {
  const aba = wb.sheet('MaterialServico')
  if (!aba) return []
  const xml = await wb.zip.file(aba.path)!.async('string')
  const ss = wb.sharedStrings
  const vistos = new Set<number>()
  const out: ItemCatalogo[] = []
  const reRow = /<row\b[^>]*>([\s\S]*?)<\/row>/g
  const reCell = /<c r="([CDE])\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
  let m: RegExpExecArray | null
  while ((m = reRow.exec(xml))) {
    const linha = m[1]
    let code: number | null = null
    let desc = ''
    let un = ''
    reCell.lastIndex = 0
    let c: RegExpExecArray | null
    while ((c = reCell.exec(linha))) {
      const body = c[3]
      if (!body) continue
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? /<t[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1]
      if (v === undefined) continue
      const val = /t="s"/.test(c[2]) ? ss[Number(v)] ?? '' : v
      if (c[1] === 'C') code = Number(val)
      else if (c[1] === 'D') desc = val.trim()
      else un = val.trim()
    }
    if (code === null || !Number.isFinite(code) || vistos.has(code)) continue
    vistos.add(code)
    out.push({ code, desc: desc.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'), un })
  }
  return out
}

export async function lerInventario(data: ArrayBuffer | Uint8Array): Promise<ResumoInventario> {
  const wb = await Workbook.open(data)
  if (!wb.sheet(ADS_SHEET)) throw new Error('Este arquivo não tem a aba ADS. Confira se é o inventário da obra.')
  const ads = readAds(new SheetEditor(await wb.sheetDoc(ADS_SHEET), wb.sharedStrings))

  let nota = ''
  let empreiteira = ''
  let tipoObra = ''
  const ordens: string[] = []
  const check = wb.sheetByPrefix('Check-list')
  if (check) {
    const ed = new SheetEditor(await wb.doc(check.path), wb.sharedStrings)
    nota = txt(ed.value('G4'))
    empreiteira = txt(ed.value('G5'))
    tipoObra = txt(ed.value('G9'))
    for (const ref of ['G10', 'G11']) {
      const o = txt(ed.value(ref))
      if (o && o !== '0') ordens.push(o)
    }
  }
  if (!nota) nota = ads.find((r) => r.ordem)?.ordem ?? 'obra'

  // descrição de cada operação (coluna D da ADS)
  const opMap = new Map<string, string>()
  const adsEd = new SheetEditor(await wb.sheetDoc(ADS_SHEET), wb.sharedStrings)
  for (const r of ads) {
    if (!r.oper || opMap.has(r.oper)) continue
    const d = adsEd.isError('D' + r.row) ? '' : txt(adsEd.value('D' + r.row))
    opMap.set(r.oper, d)
  }
  const operacoes = [...opMap].map(([oper, descricao]) => ({ oper, descricao })).sort((a, b) => a.oper.localeCompare(b.oper))

  return { nota, empreiteira, tipoObra, ordens, ads, catalogo: await lerCatalogo(wb), operacoes, abas: wb.sheets.map((s) => s.name) }
}
