import { Workbook } from './workbook'
import { SheetEditor } from './sheet'
import { ADS_SHEET, conferirTitulosAds, readAds, tipoDaOperacao, type AdsRow, type TipoOperacao } from './ads'
import { valorDoRotulo } from './rotulos'
import { diagnosticarInventario, type Diagnostico } from './diagnostico'
import cadastroExtra from '../data/cadastro-extra.json'

export interface ItemCatalogo {
  code: number
  desc: string
  un: string
}

/** Nome oculto que o site grava em todo arquivo gerado, com a data. */
export const MARCA_GERADO = 'FechamentoSiteGerado'

/** Operação da ADS desta obra, com a descrição da EDP e o tipo (instalação, retirada ou outra). */
export interface Operacao {
  oper: string
  descricao: string
  tipo: TipoOperacao
}

export interface ResumoInventario {
  nota: string
  empreiteira: string
  tipoObra: string
  ordens: string[]
  ads: AdsRow[]
  catalogo: ItemCatalogo[]
  /** Operações que aparecem na ADS, com a descrição da EDP. */
  operacoes: Operacao[]
  abas: string[]
  /** O arquivo parece já ter sido fechado (pelo site ou à mão): melhor usar o original da EDP. */
  avisoJaFechado: string | null
  /** Raio-x: modelo da ADS e o que é diferente dos inventários já testados. */
  diagnostico: Diagnostico
}

function txt(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim()
}

/**
 * Lê o cadastro MaterialServico direto do texto do XML (a aba tem ~40 mil
 * linhas e montar o XML inteiro na memória seria lento). Só colunas C, D e E.
 */
export async function lerCatalogo(wb: Workbook): Promise<ItemCatalogo[]> {
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

/**
 * Itens cadastrados no próprio site (src/data/cadastro-extra.json) para quando a
 * MaterialServico do inventário não os traz. Entram na busca; na ADS, a linha
 * sai com descrição e unidade escritas direto (o PROCV daria #N/D).
 */
export function comCadastroExtra(catalogo: ItemCatalogo[]): ItemCatalogo[] {
  const tem = new Set(catalogo.map((c) => c.code))
  return [...catalogo, ...(cadastroExtra as ItemCatalogo[]).filter((c) => !tem.has(c.code))]
}

export async function lerInventario(data: ArrayBuffer | Uint8Array): Promise<ResumoInventario> {
  const wb = await Workbook.open(data)
  if (!wb.sheet(ADS_SHEET)) throw new Error('Este arquivo não tem a aba ADS. Confira se é o inventário da obra.')
  const adsEditor = new SheetEditor(await wb.sheetDoc(ADS_SHEET), wb.sharedStrings)
  conferirTitulosAds(adsEditor)
  const ads = readAds(adsEditor)

  let nota = ''
  let empreiteira = ''
  let tipoObra = ''
  const ordens: string[] = []
  const check = wb.sheetByPrefix('Check-list')
  if (check) {
    const ed = new SheetEditor(await wb.doc(check.path), wb.sharedStrings)
    nota = txt(ed.value(valorDoRotulo(ed, 'Nota / OV', 'G4')))
    empreiteira = txt(ed.value(valorDoRotulo(ed, 'Empreiteira', 'G5')))
    tipoObra = txt(ed.value(valorDoRotulo(ed, 'Tipo Obra', 'G9')))
    // as ordens ficam na linha do rótulo e na de baixo (G10 e G11)
    const ordem = valorDoRotulo(ed, 'Ordem/Diagrama', 'G10')
    const [colOrdem, linhaOrdem] = [ordem.replace(/\d+$/, ''), Number(ordem.replace(/^[A-Z]+/, ''))]
    for (const ref of [ordem, colOrdem + (linhaOrdem + 1)]) {
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
  const operacoes = [...opMap].map(([oper, descricao]) => ({ oper, descricao, tipo: tipoDaOperacao(descricao) })).sort((a, b) => a.oper.localeCompare(b.oper))

  const marca = await wb.definedName(MARCA_GERADO)
  const comAplicado = ads.filter((r) => r.code !== null && (r.aplicado ?? 0) > 0).length
  const avisoJaFechado = marca
    ? `Este arquivo já foi gerado pelo site (${marca.replace(/"/g, '')}). Gerar de novo em cima dele pode dar diferença: o certo é usar o inventário original da EDP.`
    : comAplicado
      ? `Este inventário já vem com Aplicado preenchido em ${comAplicado} linha(s) da ADS: parece que ele já foi fechado. O certo é usar o inventário original da EDP.`
      : null

  const diagnostico = await diagnosticarInventario(wb)

  return { nota, empreiteira, tipoObra, ordens, ads, catalogo: comCadastroExtra(await lerCatalogo(wb)), operacoes, abas: wb.sheets.map((s) => s.name), avisoJaFechado, diagnostico }
}
