import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { setXmlImpl, child } from './xml'
import { Workbook } from './workbook'
import { SheetEditor } from './sheet'
import { atualizarValoresGuardados } from './cache'

setXmlImpl(DOMParser as never, XMLSerializer as never)

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

/** Pacote mínimo com várias abas: { nome: conteúdo de <sheetData> }. */
async function montar(abas: Record<string, string>): Promise<Workbook> {
  const nomes = Object.keys(abas)
  const z = new JSZip()
  z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>`)
  z.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${NS}" xmlns:r="${REL}"><sheets>${nomes.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`)
  z.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${nomes.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`)
  nomes.forEach((n, i) => z.file(`xl/worksheets/sheet${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${NS}"><sheetData>${abas[n]}</sheetData></worksheet>`))
  return Workbook.open(await z.generateAsync({ type: 'uint8array' }))
}

const celula = async (wb: Workbook, aba: string, ref: string) => {
  const ed = new SheetEditor(await wb.sheetDoc(aba), wb.sharedStrings)
  const c = ed.cell(ref)!
  return { t: c.getAttribute('t') || null, v: child(c, 'v')?.textContent ?? null, f: child(c, 'f')?.textContent ?? null }
}

describe('atualizarValoresGuardados', () => {
  it('grava nas fórmulas que puxam de outra aba o valor atual daquela célula (o Excel mostra isso no Modo Protegido)', async () => {
    const wb = await montar({
      'Check-list': `<row r="4"><c r="Q4"><v>46319</v></c></row><row r="56"><c r="K56"><v>1234</v></c><c r="M56" t="inlineStr"><is><t>FULANO DE TAL</t></is></c></row>`,
      'Ficha Medição Aterramento': `<row r="31"><c r="J31"><f>'Check-list'!Q4</f><v>46318</v></c></row><row r="38"><c r="D38"><f>'Check-list'!K56</f><v>0</v></c><c r="E38"><f>'Check-list'!M56</f><v>0</v></c></row>`,
    })
    await atualizarValoresGuardados(wb)
    const wb2 = await Workbook.open(await wb.save())
    expect(await celula(wb2, 'Ficha Medição Aterramento', 'D38')).toEqual({ t: null, v: '1234', f: "'Check-list'!K56" })
    expect(await celula(wb2, 'Ficha Medição Aterramento', 'E38')).toEqual({ t: 'str', v: 'FULANO DE TAL', f: "'Check-list'!M56" })
    expect(await celula(wb2, 'Ficha Medição Aterramento', 'J31')).toEqual({ t: null, v: '46319', f: "'Check-list'!Q4" })
  })

  it('célula de origem vazia vira 0 (como o Excel calcula) e erro continua erro', async () => {
    const wb = await montar({
      'Check-list': `<row r="56"><c r="C56"/><c r="F56" t="e"><f>VLOOKUP(C56,Colaborador!A:B,2,0)</f><v>#N/A</v></c></row>`,
      DP: `<row r="47"><c r="D47"><f>'Check-list'!C56</f><v>9</v></c><c r="E47" t="str"><f>'Check-list'!F56</f><v>velho</v></c></row>`,
    })
    await atualizarValoresGuardados(wb)
    expect(await celula(wb, 'DP', 'D47')).toEqual({ t: null, v: '0', f: "'Check-list'!C56" })
    expect(await celula(wb, 'DP', 'E47')).toEqual({ t: 'e', v: '#N/A', f: "'Check-list'!F56" })
  })

  it('origem em texto compartilhado, $ absoluto e texto vazio', async () => {
    const z = await montar({
      'Check-list': `<row r="56"><c r="M56" t="s"><v>0</v></c><c r="N56" t="str"><f>""</f><v></v></c></row>`,
      Ficha: `<row r="1"><c r="A1"><f>'Check-list'!$M$56</f><v>0</v></c><c r="B1"><f>'Check-list'!N56</f><v>0</v></c></row>`,
    })
    z.sharedStrings = ['NOME COMPARTILHADO']
    await atualizarValoresGuardados(z)
    expect(await celula(z, 'Ficha', 'A1')).toEqual({ t: 'str', v: 'NOME COMPARTILHADO', f: "'Check-list'!$M$56" })
    // texto vazio aparece vazio (não 0) no Modo Protegido
    expect(await celula(z, 'Ficha', 'B1')).toEqual({ t: 'str', v: '', f: "'Check-list'!N56" })
  })

  it('ignora <xm:f> da formatação condicional x14 (não é célula: escrever ali corrompe o arquivo)', async () => {
    const wb = await montar({
      'Check-list': `<row r="1"><c r="A1"><v>5</v></c></row>`,
      Ficha: `<row r="1"><c r="B1"><v>1</v></c></row>`,
    })
    const aba = wb.sheet('Ficha')!
    const doc = await wb.doc(aba.path)
    const ext = new DOMParser().parseFromString(
      `<extLst xmlns="${NS}" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main"><ext uri="{78C0D931-6437-407d-A8EE-F0AAD7539E65}"><x14:conditionalFormattings><x14:conditionalFormatting><x14:cfRule type="dataBar" id="{1}"><x14:dataBar><x14:cfvo type="num"><xm:f>'Check-list'!$A$1</xm:f></x14:cfvo></x14:dataBar></x14:cfRule><xm:sqref>B1</xm:sqref></x14:conditionalFormatting></x14:conditionalFormattings></ext></extLst>`,
      'application/xml',
    ).documentElement
    doc.documentElement.appendChild(doc.importNode(ext, true))
    await atualizarValoresGuardados(wb)
    const cfvo = doc.getElementsByTagName('x14:cfvo')[0]
    expect(cfvo.getAttribute('t') || null).toBeNull()
    expect(cfvo.getElementsByTagName('v').length).toBe(0)
  })

  it('o <v> fica logo depois do <f> (ordem do esquema)', async () => {
    const wb = await montar({
      'Check-list': `<row r="56"><c r="K56"><v>1234</v></c></row>`,
      Ficha: `<row r="1"><c r="A1"><f>'Check-list'!K56</f><v>0</v><extLst/></c></row>`,
    })
    await atualizarValoresGuardados(wb)
    const ed = new SheetEditor(await wb.sheetDoc('Ficha'), wb.sharedStrings)
    const nomes = Array.from(ed.cell('A1')!.childNodes).filter((n) => n.nodeType === 1).map((n) => (n as Element).localName)
    expect(nomes).toEqual(['f', 'v', 'extLst'])
  })

  it('não mexe em fórmula que não é uma referência simples a outra aba', async () => {
    const wb = await montar({
      'Check-list': `<row r="56"><c r="K56"><v>1234</v></c></row>`,
      Ficha: `<row r="1"><c r="A1"><f>'Check-list'!K56*2</f><v>1</v></c><c r="B1"><f>SUM('Check-list'!K56:K57)</f><v>2</v></c><c r="C1"><f>Ficha!D1</f><v>3</v></c><c r="D1"><f>[1]Check-list!K56</f><v>4</v></c></row>`,
    })
    await atualizarValoresGuardados(wb)
    expect((await celula(wb, 'Ficha', 'A1')).v).toBe('1') // expressão
    expect((await celula(wb, 'Ficha', 'B1')).v).toBe('2') // intervalo
    expect((await celula(wb, 'Ficha', 'C1')).v).toBe('3') // a própria aba
    expect((await celula(wb, 'Ficha', 'D1')).v).toBe('4') // outro arquivo
  })
})
