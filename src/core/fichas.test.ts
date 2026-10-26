import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { setXmlImpl } from './xml'
import { Workbook } from './workbook'
import { SheetEditor } from './sheet'
import { aplicarCarimbo, aplicarDP } from './fichas'

setXmlImpl(DOMParser as never, XMLSerializer as never)

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const EMU_PX = 9525

const txt = (ref: string, t: string) => `<c r="${ref}" t="inlineStr"><is><t>${t}</t></is></c>`
const vazia = (ref: string) => `<c r="${ref}" s="1"/>`
const formula = (ref: string, f: string) => `<c r="${ref}"><f>${f}</f><v>0</v></c>`

interface Layout {
  aba: string
  cols: string // <col .../>
  linhas: Record<number, string>
  mesclagens: string[]
}

async function montar(l: Layout): Promise<Workbook> {
  const sd = Object.entries(l.linhas)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([r, cs]) => `<row r="${r}">${cs}</row>`)
    .join('')
  const z = new JSZip()
  z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>`)
  z.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${NS_MAIN}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${l.aba}" sheetId="1" r:id="rId1"/></sheets></workbook>`)
  z.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`)
  z.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${NS_MAIN}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetFormatPr defaultRowHeight="15"/><cols>${l.cols}</cols><sheetData>${sd}</sheetData><mergeCells count="${l.mesclagens.length}">${l.mesclagens.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells></worksheet>`)
  return Workbook.open(await z.generateAsync({ type: 'uint8array' }))
}

const tec = { nome: 'Fulano', registro: 1234, carimbo: { data: new Uint8Array([137, 80, 78, 71]), width: 400, height: 200, ext: 'png' as const } }
const hoje = new Date(2026, 9, 24)

/** Ficha Equipamento: rótulo "Registro" mesclado em C:E, matrícula só em E, nome em F:K. */
function equipamento(preenchida: boolean): Layout {
  return {
    aba: 'Ficha Equipamento',
    cols: '<col min="3" max="5" width="2.5" customWidth="1"/><col min="6" max="11" width="10" customWidth="1"/>',
    linhas: {
      131: txt('C131', 'Registro') + txt('F131', 'Nome'),
      132: preenchida ? formula('E132', "'Check-list'!K50") : vazia('E132'),
      133: txt('C133', 'Colaborador EDP'),
      139: txt('C139', 'Registro') + txt('F139', 'Nome'),
      140: vazia('C140') + vazia('D140') + (preenchida ? formula('E140', "'Check-list'!K56") + formula('F140', "'Check-list'!M56") : vazia('E140') + vazia('F140')),
      141: vazia('E141'),
    },
    mesclagens: ['C131:E131', 'E132:E133', 'C139:E139', 'E140:E141', 'F140:K140'],
  }
}

async function ancoraCarimbo(wb: Workbook) {
  const dr = await wb.doc('xl/drawings/drawing1.xml')
  const anc = [...Array.from(dr.getElementsByTagName('xdr:twoCellAnchor'))].find((a) => a.getElementsByTagName('xdr:cNvPr')[0]?.getAttribute('name') === 'Carimbo')!
  const n = (pai: string, campo: string) => Number(anc.getElementsByTagName(pai)[0].getElementsByTagName('xdr:' + campo)[0].textContent)
  const ext = anc.getElementsByTagName('a:ext')[0]
  return { deCol: n('xdr:from', 'col'), ateCol: n('xdr:to', 'col'), cx: Number(ext.getAttribute('cx')) }
}

async function aplicarEAbrir(wb: Workbook) {
  await aplicarCarimbo(wb, tec, hoje)
  const wb2 = await Workbook.open(await wb.save())
  const nome = wb2.sheets[0].name
  return { wb2, ed: new SheetEditor(await wb2.sheetDoc(nome), wb2.sharedStrings) }
}

describe('aplicarCarimbo com o rótulo "Registro" mesclado', () => {
  it('células com fórmula da Check-list: nada na coluna estreita e carimbo centrado sobre o nome', async () => {
    const wb = await montar(equipamento(true))
    await aplicarCarimbo(wb, tec, hoje)
    const wb2 = await Workbook.open(await wb.save())
    const ed = new SheetEditor(await wb2.sheetDoc('Ficha Equipamento'), wb2.sharedStrings)
    expect(ed.value('C140')).toBeNull()
    expect(ed.value('D140')).toBeNull()
    expect(ed.formula(ed.cell('E140')!)!.textContent).toBe("'Check-list'!K56")
    expect(ed.formula(ed.cell('F140')!)!.textContent).toBe("'Check-list'!M56")
    const a = await ancoraCarimbo(wb2)
    expect(a.deCol).toBeGreaterThanOrEqual(5) // F (índice 0)
    expect(a.ateCol).toBeLessThanOrEqual(10) // K
    expect(a.cx).toBeGreaterThan(150 * EMU_PX)
  })

  it('modelo em branco: matrícula na coluna E, nome em F e C continua vazia', async () => {
    const wb = await montar(equipamento(false))
    const { ed } = await aplicarEAbrir(wb)
    expect(ed.value('E140')).toBe(1234)
    expect(ed.value('F140')).toBe('FULANO')
    expect(ed.value('C140')).toBeNull()
    expect(ed.value('D140')).toBeNull()
  })

  it('layout da Check-list (rótulo K:L, matrícula K:L embaixo, nome em M:S) continua igual', async () => {
    const wb = await montar({
      aba: 'Check-list',
      cols: '<col min="11" max="19" width="10" customWidth="1"/>',
      linhas: {
        4: txt('A4', 'Data'),
        47: txt('K47', 'Registro'),
        55: txt('K55', 'Registro') + txt('M55', 'Nome'),
        56: vazia('K56') + vazia('M56'),
      },
      mesclagens: ['K47:L47', 'K55:L55', 'K56:L57', 'M56:S56'],
    })
    const { ed } = await aplicarEAbrir(wb)
    expect(ed.value('K56')).toBe(1234)
    expect(ed.value('M56')).toBe('FULANO')
    expect(ed.value('L56')).toBeNull()
  })
})

/** Aba DP: cabeçalho, o quadro grande B6:Z42 (escrito LIVRE no inventário original) e o rodapé. */
function dp(comLivre: boolean): Layout {
  return {
    aba: 'DP',
    cols: '<col min="2" max="26" width="4" customWidth="1"/>',
    linhas: {
      2: txt('B2', 'DESLIGAMENTO PROGRAMADO'),
      5: txt('B5', 'Tipo de Obra :') + txt('F5', 'PROJETO BT ZERO'),
      6: comLivre ? txt('B6', 'LIVRE') : vazia('B6'),
      46: txt('D46', 'Registro'),
    },
    mesclagens: ['B2:Z3', 'B5:E5', 'F5:Q5', 'B6:Z42', 'D46:E46'],
  }
}

const fotoDP = { data: new Uint8Array([255, 216, 255]), width: 1000, height: 1400, ext: 'jpeg' as const }

async function fotosDaDP(wb: Workbook) {
  const dr = await wb.doc('xl/drawings/drawing1.xml')
  return [...Array.from(dr.getElementsByTagName('xdr:twoCellAnchor'))].map((a) => Number(a.getElementsByTagName('xdr:from')[0].getElementsByTagName('xdr:row')[0].textContent) + 1)
}

describe('aplicarDP', () => {
  it('inventário original: apaga o LIVRE e põe a foto dentro do quadro', async () => {
    const wb = await montar(dp(true))
    await aplicarDP(wb, fotoDP)
    const ed = new SheetEditor(await wb.sheetDoc('DP'), wb.sharedStrings)
    expect(ed.value('B6')).toBeNull()
    const linhas = await fotosDaDP(wb)
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toBeGreaterThanOrEqual(6)
    expect(linhas[0]).toBeLessThanOrEqual(42)
  })

  it('sem a palavra LIVRE (arquivo já gerado antes ou apagado à mão): acha o quadro pelo tamanho', async () => {
    const wb = await montar(dp(false))
    await aplicarDP(wb, fotoDP)
    const linhas = await fotosDaDP(wb)
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toBeGreaterThanOrEqual(6)
    expect(linhas[0]).toBeLessThanOrEqual(42)
  })

  it('arquivo já gerado de novo: troca a foto antiga em vez de empilhar outra', async () => {
    const wb = await montar(dp(true))
    await aplicarDP(wb, fotoDP)
    const wb2 = await Workbook.open(await wb.save())
    await aplicarDP(wb2, fotoDP)
    expect(await fotosDaDP(wb2)).toHaveLength(1)
  })
})
