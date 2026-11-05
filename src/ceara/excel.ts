// Excel da contagem do Ceará, com as colunas da "Solicitação de acréscimos de material - Enel"
// (o arquivo "<OT> - ORÇAMENTO.xlsx" das obras de setembro), só com as 4 abas de estrutura e
// material, sem o título e o TOTAL do modelo. A mão de obra fica de fora até o Italo ensinar. O arquivo é montado do zero
// (sem modelo guardado), para não levar nome de colega nem vínculo com planilha externa.
import JSZip from 'jszip'
import { indexToCol } from '../core/sheet'
import type { BaseEnel, Linha, ResultadoCeara } from './contagem'
import { chaveKit, estruturasAjustadas, linhasDoKit, somarNaAdicao, type Ajustes, type Situacao, type Somado } from './estratificacao'
import { BLOCOS, type Bloco } from './orcamento'

export const AREAS = ['SUL', 'LESTE', 'CENTRO SUL'] as const
export type Area = (typeof AREAS)[number]

export interface Cabecalho {
  ot: string
  area: Area
  data: Date
}

const EMPRESA = 'COSAMPA'

// estilos (índices de cellXfs em styles.xml): cada tipo de célula tem 3 versões seguidas,
// normal, listrada (linha par) e vermelha (sem código ou fora da base)
const S_CABECALHO = 1
const S_CENTRO = 2
const S_ESQUERDA = 5
const S_DATA = 8
const S_LISTRA = 1
const S_VERMELHO = 2

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

type Valor = string | number | null
interface Celula {
  v: Valor
  s?: number
  f?: string
}

function celula(ref: string, c: Celula): string {
  const s = c.s ? ` s="${c.s}"` : ''
  if (c.f) return `<c r="${ref}"${s}><f>${esc(c.f)}</f><v>${c.v ?? 0}</v></c>`
  if (c.v === null || c.v === '') return `<c r="${ref}"${s}/>`
  if (typeof c.v === 'number') return `<c r="${ref}"${s}><v>${c.v}</v></c>`
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`
}

/** Dia no número de série do Excel (dias desde 30/12/1899). */
export function serialExcel(d: Date): number {
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000)
}

/** Código numérico vai como número (como no modelo); estrutura e OT com letra vão como texto. */
const numeroOuTexto = (s: string): Valor => (/^\d{1,15}$/.test(s) ? Number(s) : s)

function aba(bloco: Bloco, linhas: Linha[], cab: Cabecalho): string {
  const material = bloco === 'adicaoMaterial' || bloco === 'devolucaoMaterial'
  const titulos = material ? ['DATA', 'ÁREA', 'EMPRESA', 'OT', 'CÓDIGO', 'DESCRIÇÃO', 'QTD'] : ['DATA', 'ÁREA', 'EMPRESA', 'OT', 'CÓDIGO', 'QTD']
  const ultima = 1 + Math.max(linhas.length, 1)
  const rows: string[] = []
  const linha = (n: number, cels: Celula[], extra = '') => rows.push(`<row r="${n}"${extra}>${cels.map((c, i) => celula(indexToCol(i + 1) + n, c)).join('')}</row>`)

  // sem título nem TOTAL (pedido do Italo, 04/11): o cabeçalho é a linha 1
  const cabecalho: Celula[] = titulos.map((t) => ({ v: t, s: S_CABECALHO }))
  // o modelo traz RESPONSÁVEL ao lado do cabeçalho da adição de material; fica em branco para preencher
  if (bloco === 'adicaoMaterial') cabecalho.push({ v: 'RESPONSÁVEL', s: S_CABECALHO }, { v: null, s: S_CENTRO })
  linha(1, cabecalho, ' ht="24" customHeight="1"')

  const data = serialExcel(cab.data)
  linhas.forEach((l, i) => {
    const versao = l.semCodigo || l.foraDaBase ? S_VERMELHO : i % 2 ? S_LISTRA : 0
    const centro = S_CENTRO + versao
    const comeco: Celula[] = [
      { v: data, s: S_DATA + versao },
      { v: cab.area, s: centro },
      { v: EMPRESA, s: centro },
      { v: numeroOuTexto(cab.ot), s: centro },
      // sem código conhecido: a célula fica vazia e o nome vai na descrição, para preencher à mão
      { v: l.semCodigo ? null : numeroOuTexto(l.codigo), s: centro },
    ]
    const descricao = l.semCodigo ? `${l.codigo}: ${l.descricao}` : l.descricao
    const qtd = { v: l.quantidade, s: centro }
    linha(2 + i, material ? [...comeco, { v: descricao, s: S_ESQUERDA + versao }, qtd] : [...comeco, qtd], ' ht="18" customHeight="1"')
  })

  const larguras = material ? [12, 12, 12, 12, 12, 52, 10, 16, 16] : [12, 12, 12, 12, 22, 10]
  const fim = indexToCol(titulos.length)
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
    `<dimension ref="A1:${fim}${ultima}"/>` +
    '<sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    `<cols>${larguras.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` +
    `<sheetData>${rows.join('')}</sheetData>` +
    `<autoFilter ref="A1:${fim}${ultima}"/>` +
    '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
    // impressão deitada, a largura toda numa página (a altura cresce o quanto precisar)
    '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>' +
    '</worksheet>'
  )
}

const PALAVRA: Record<Situacao, string> = { igual: 'igual', 'nao-usado': 'não usado', diminuiu: 'diminuiu', 'a-mais': 'a mais', novo: 'novo' }
const ABA_ESTRAT = 'ESTRATIFICAÇÃO'

/** Aba ESTRATIFICAÇÃO: o que cada estrutura ajustada leva de fato e o que foi somado na Adição de material. */
function abaEstratificacao(r: ResultadoCeara, base: BaseEnel, ajustes: Ajustes, somados: Somado[]): string {
  const rows: string[] = []
  let n = 0
  const linha = (cels: Celula[], extra = ' ht="18" customHeight="1"') => {
    n++
    rows.push(`<row r="${n}"${extra}>${cels.map((c, i) => celula(indexToCol(i + 1) + n, c)).join('')}</row>`)
  }
  const cab = (t: string[]): Celula[] => t.map((v) => ({ v, s: S_CABECALHO }))
  linha(cab(['ESTRUTURA', 'QTD DE ESTRUTURAS NA OBRA', 'CÓDIGO', 'DESCRIÇÃO', 'UNIDADE', 'QTD NO KIT', 'QTD RETIRADA', 'FICA NA ESTRUTURA', 'SITUAÇÃO']), ' ht="32" customHeight="1"')

  let i = 0
  for (const est of estruturasAjustadas(r.adicaoEstrutura, ajustes)) {
    for (const l of linhasDoKit(base, chaveKit(est.codigo), ajustes[chaveKit(est.codigo)])) {
      const versao = l.foraDoCatalogo ? S_VERMELHO : i % 2 ? S_LISTRA : 0
      const c = S_CENTRO + versao
      linha([
        { v: est.codigo, s: c }, { v: est.quantidade, s: c }, { v: numeroOuTexto(l.codigo), s: c },
        { v: l.descricao, s: S_ESQUERDA + versao }, { v: l.unidade, s: c },
        { v: l.noKit, s: c }, { v: l.retirada, s: c }, { v: l.fica, s: c }, { v: PALAVRA[l.situacao], s: c },
      ])
      i++
    }
  }

  // segundo bloco: o que entrou na Adição de material
  linha([])
  linha([{ v: 'SOMADO EM ADIÇÃO DE MATERIAL', s: S_CABECALHO }], ' ht="24" customHeight="1"')
  linha(cab(['CÓDIGO', 'DESCRIÇÃO', 'UNIDADE', 'DO CAD', 'DA ESTRATIFICAÇÃO', 'TOTAL NA ADIÇÃO DE MATERIAL', 'DE QUAIS ESTRUTURAS']), ' ht="32" customHeight="1"')
  somados.forEach((s, j) => {
    const versao = s.foraDoCatalogo ? S_VERMELHO : j % 2 ? S_LISTRA : 0
    const c = S_CENTRO + versao
    linha([
      { v: numeroOuTexto(s.codigo), s: c }, { v: s.descricao, s: S_ESQUERDA + versao }, { v: s.unidade, s: c },
      { v: s.doCad, s: c }, { v: s.daEstratificacao, s: c }, { v: s.total, s: c }, { v: s.estruturas, s: S_ESQUERDA + versao },
    ])
  })

  // largura pelo maior texto da coluna nos dois blocos (cabeçalho ou descrição)
  const larguras = [30, 50, 14, 52, 22, 30, 24, 20, 16]
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
    `<dimension ref="A1:I${n}"/>` +
    '<sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    `<cols>${larguras.map((w, k) => `<col min="${k + 1}" max="${k + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` +
    `<sheetData>${rows.join('')}</sheetData>` +
    '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
    '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>' +
    '</worksheet>'
  )
}

// visual "grafite sóbrio" (Italo, 04/11): cabeçalho grafite com letra branca, linhas listradas
// bem claras, bordas finas cinza; sem código ou fora da base com fundo rosado e letra vermelha escura
const GRAFITE = 'FF2E3338'
const LISTRA = 'FFF3F4F6'
const BORDA = 'FFD0D4D9'
const ROSADO = 'FFFDE2E1'
const VERMELHO_ESCURO = 'FF9C0006'

/** Célula de dado: as 3 versões (normal, listrada, vermelha) de um formato e alinhamento. */
const tresVersoes = (numFmt: number, alinhamento: string) =>
  [
    [0, 0],
    [0, 2],
    [1, 3],
  ]
    .map(
      ([fonte, fundo]) =>
        `<xf numFmtId="${numFmt}" fontId="${fonte}" fillId="${fundo}" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment ${alinhamento} vertical="center"/></xf>`,
    )
    .join('')

const ESTILOS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>' +
  '<fonts count="3">' +
  '<font><sz val="11"/><color rgb="FF1F2328"/><name val="Calibri"/><family val="2"/></font>' +
  `<font><sz val="11"/><color rgb="${VERMELHO_ESCURO}"/><name val="Calibri"/><family val="2"/></font>` +
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>' +
  '</fonts>' +
  '<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  [LISTRA, ROSADO, GRAFITE].map((c) => `<fill><patternFill patternType="solid"><fgColor rgb="${c}"/><bgColor indexed="64"/></patternFill></fill>`).join('') +
  '</fills>' +
  '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
  `<border>${['left', 'right', 'top', 'bottom'].map((l) => `<${l} style="thin"><color rgb="${BORDA}"/></${l}>`).join('')}<diagonal/></border></borders>` +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="11">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
  tresVersoes(0, 'horizontal="center"') +
  tresVersoes(0, 'horizontal="left" indent="1"') +
  tresVersoes(164, 'horizontal="center"') +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>'

/** Monta o .xlsx com as abas Adição/Devolução de estrutura e de material; com ajuste de estratificação, ganha a 5ª aba. */
export async function gerarExcelCeara(r: ResultadoCeara, cab: Cabecalho, estrat?: { base: BaseEnel; ajustes: Ajustes }): Promise<Uint8Array> {
  const zip = new JSZip()
  const comEstrat = !!estrat && estruturasAjustadas(r.adicaoEstrutura, estrat.ajustes).length > 0
  const soma = comEstrat ? somarNaAdicao(r, estrat!.base, estrat!.ajustes) : undefined
  const n = BLOCOS.length + (comEstrat ? 1 : 0)
  const folhas = Array.from({ length: n }, (_, i) => i + 1)
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      folhas.map((i) => `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
      '</Types>',
  )
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>',
  )
  zip.file(
    'xl/workbook.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<bookViews><workbookView/></bookViews>' +
      `<sheets>${[...BLOCOS.map((b) => b.aba), ...(comEstrat ? [ABA_ESTRAT] : [])].map((nome, i) => `<sheet name="${esc(nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>` +
      `<definedNames>${BLOCOS.map((b, i) => `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(b.aba)}'!$A$1:$${indexToCol(b.id.endsWith('Material') ? 7 : 6)}$${1 + Math.max((b.id === 'adicaoMaterial' && soma ? soma.adicaoMaterial : r[b.id]).length, 1)}</definedName>`).join('')}</definedNames>` +
      '<calcPr calcId="191029" fullCalcOnLoad="1"/>' +
      '</workbook>',
  )
  zip.file(
    'xl/_rels/workbook.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      folhas.map((i) => `<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`).join('') +
      `<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      '</Relationships>',
  )
  zip.file('xl/styles.xml', ESTILOS)
  BLOCOS.forEach((b, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, aba(b.id, b.id === 'adicaoMaterial' && soma ? soma.adicaoMaterial : r[b.id], cab)))
  if (comEstrat && soma) zip.file(`xl/worksheets/sheet${n}.xml`, abaEstratificacao(r, estrat!.base, estrat!.ajustes, soma.somados))
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}

/** OT do nome do arquivo: 7 dígitos começando com 7 ou 8, ou 11 começando com 1722 (ex. "8000000_ASBUILT 0000000000 Cosampa.dxf"). */
export function otDoNome(nome: string): string {
  return /(?:^|\D)(1722\d{7}|[78]\d{6})(?!\d)/.exec(nome)?.[1] ?? ''
}

export function nomeDoExcel(ot: string): string {
  return `${ot.trim() || 'OBRA'} - ESTRUTURA E MATERIAL.xlsx`
}
