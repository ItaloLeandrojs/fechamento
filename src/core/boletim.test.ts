import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { setXmlImpl } from './xml'
import { Workbook } from './workbook'
import { SheetEditor } from './sheet'
import { aplicarTipoBoletim } from './boletim'

setXmlImpl(DOMParser as never, XMLSerializer as never)

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

// xf 0 comum, 1 caixa (borda + fundo), 2 texto da lista, 3 caixa do W5/W7 do modelo
const ESTILOS = `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${NS}"><fonts count="1"><font/></fonts><fills count="3"><fill/><fill/><fill/></fills><borders count="2"><border/><border/></borders><cellXfs count="4"><xf fontId="0" fillId="0" borderId="0"/><xf fontId="0" fillId="2" borderId="1"/><xf fontId="0" fillId="0" borderId="0" applyAlignment="1"/><xf fontId="0" fillId="2" borderId="1" applyAlignment="1"/></cellXfs></styleSheet>`

const LISTA = `<row r="22"><c r="C22" s="1" t="inlineStr"><is><t>X</t></is></c><c r="E22" s="2" t="inlineStr"><is><t>ADS Preenchidas</t></is></c></row>`
const COM_CAIXAS = `<row r="5"><c r="W5" s="3"/><c r="X5" s="2" t="inlineStr"><is><t>FINAL</t></is></c></row><row r="7"><c r="W7" s="3" t="inlineStr"><is><t>X</t></is></c><c r="X7" s="2" t="inlineStr"><is><t>PARCIAL</t></is></c></row>` + LISTA

async function montar(sheetData: string): Promise<Workbook> {
  const z = new JSZip()
  z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>`)
  z.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${NS}" xmlns:r="${REL}"><sheets><sheet name="Check-list" sheetId="1" r:id="rId1"/></sheets></workbook>`)
  z.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`)
  z.file('xl/styles.xml', ESTILOS)
  z.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${NS}"><sheetData>${sheetData}</sheetData></worksheet>`)
  return Workbook.open(await z.generateAsync({ type: 'uint8array' }))
}

async function gerar(sheetData: string, tipo: 'parcial' | 'final') {
  const wb = await montar(sheetData)
  await aplicarTipoBoletim(wb, tipo)
  const wb2 = await Workbook.open(await wb.save())
  const ed = new SheetEditor(await wb2.sheetDoc('Check-list'), wb2.sharedStrings)
  const ler = (ref: string) => ({ v: ed.value(ref), s: ed.cell(ref)?.getAttribute('s') || null })
  return { W5: ler('W5'), X5: ler('X5'), W7: ler('W7'), X7: ler('X7'), C22: ler('C22') }
}

describe('boletim parcial ou final (Check-list W5:X7)', () => {
  it('parcial: caixa FINAL vazia e caixa PARCIAL com X, mantendo o estilo do modelo', async () => {
    const r = await gerar(COM_CAIXAS, 'parcial')
    expect(r.W5).toEqual({ v: null, s: '3' })
    expect(r.X5).toEqual({ v: 'FINAL', s: '2' })
    expect(r.W7).toEqual({ v: 'X', s: '3' })
    expect(r.X7).toEqual({ v: 'PARCIAL', s: '2' })
  })

  it('parcial num inventário sem as caixas: cria as duas com o estilo da lista da Check-list', async () => {
    const r = await gerar(LISTA, 'parcial')
    expect(r.W5).toEqual({ v: null, s: '1' })
    expect(r.X5).toEqual({ v: 'FINAL', s: '2' })
    expect(r.W7).toEqual({ v: 'X', s: '1' })
    expect(r.X7).toEqual({ v: 'PARCIAL', s: '2' })
  })

  it('final: as quatro células ficam em branco, sem caixa, e o resto da lista não muda', async () => {
    const r = await gerar(COM_CAIXAS, 'final')
    for (const ref of ['W5', 'X5', 'W7', 'X7'] as const) expect(r[ref], ref).toEqual({ v: null, s: null })
    expect(r.C22).toEqual({ v: 'X', s: '1' })
  })

  it('final num inventário sem as caixas não cria nada', async () => {
    const r = await gerar(LISTA, 'final')
    for (const ref of ['W5', 'X5', 'W7', 'X7'] as const) expect(r[ref], ref).toEqual({ v: null, s: null })
  })
})
