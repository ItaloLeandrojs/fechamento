import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { setXmlImpl } from './xml'
import { Workbook } from './workbook'
import { SheetEditor } from './sheet'
import { ajustarFormulaApagando, apagarLinhas } from './linhas'

setXmlImpl(DOMParser as never, XMLSerializer as never)

describe('ajustarFormulaApagando', () => {
  it('sobe o que está abaixo e encolhe intervalos que pegam o trecho apagado', () => {
    expect(ajustarFormulaApagando('SUM(A10:A20)+B30', 12, 14)).toBe('SUM(A10:A17)+B27')
  })

  it('não mexe em referência de outra aba', () => {
    expect(ajustarFormulaApagando("'Check-list'!K56", 5, 9)).toBe("'Check-list'!K56")
    expect(ajustarFormulaApagando('ADS!B20', 5, 9)).toBe('ADS!B20')
  })

  it('referência única dentro do trecho apagado vira #REF!', () => {
    expect(ajustarFormulaApagando('B13', 12, 14)).toBe('#REF!')
  })

  it('mantém absolutas, textos entre aspas e nomes de função', () => {
    expect(ajustarFormulaApagando('IF(A20="B20",$C$30,LOG10(5))', 5, 9)).toBe('IF(A15="B20",$C$25,LOG10(5))')
  })

  it('com o nome da aba, ajusta a referência qualificada e a área de impressão', () => {
    expect(ajustarFormulaApagando("'Ficha Medição'!$B$1:$L$191", 9, 34, 'Ficha Medição', false)).toBe("'Ficha Medição'!$B$1:$L$165")
    expect(ajustarFormulaApagando("'Outra'!$B$1:$L$191", 9, 34, 'Ficha Medição', false)).toBe("'Outra'!$B$1:$L$191")
    expect(ajustarFormulaApagando('Aba!B20', 5, 9, 'Aba', false)).toBe('Aba!B15')
    // sem prefixo, em outra aba, não é desta aba
    expect(ajustarFormulaApagando('B20', 5, 9, 'Aba', false)).toBe('B20')
  })

  it('linhas inteiras ($1:$3) acompanham quando qualificadas', () => {
    expect(ajustarFormulaApagando('Aba!$20:$22', 5, 9, 'Aba', false)).toBe('Aba!$15:$17')
  })
})

// ---- pacote montado no teste ----

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'

function sheetXml(): string {
  let rows = ''
  for (let r = 1; r <= 12; r++) {
    const extra = r === 11 ? `<c r="D11"><f>SUM(B2:B12)</f><v>0</v></c>` : ''
    rows += `<row r="${r}"><c r="B${r}" t="inlineStr"><is><t>L${r}</t></is></c>${extra}</row>`
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${NS_MAIN}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="B1:L12"/><sheetData>${rows}</sheetData>`
    + `<mergeCells count="2"><mergeCell ref="B3:C3"/><mergeCell ref="B8:C9"/></mergeCells>`
    + `<conditionalFormatting sqref="B2:B12"><cfRule type="cellIs" priority="1" operator="equal"><formula>0</formula></cfRule></conditionalFormatting>`
    + `<drawing r:id="rId1"/></worksheet>`
}

const DRAWING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:twoCellAnchor><xdr:from><xdr:col>1</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>9</xdr:row><xdr:rowOff>5</xdr:rowOff></xdr:from><xdr:to><xdr:col>3</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>10</xdr:row><xdr:rowOff>7</xdr:rowOff></xdr:to><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Img"/></xdr:nvPicPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`

async function montar(aba = 'Aba'): Promise<Workbook> {
  const z = new JSZip()
  z.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${NS_MAIN}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${aba}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'${aba}'!$B$1:$L$12</definedName></definedNames></workbook>`)
  z.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`)
  z.file('xl/worksheets/sheet1.xml', sheetXml())
  z.file('xl/worksheets/_rels/sheet1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`)
  z.file('xl/drawings/drawing1.xml', DRAWING)
  return Workbook.open(await z.generateAsync({ type: 'uint8array' }))
}

/** Salva, reabre e devolve as partes que importam. */
async function reabrir(wb: Workbook) {
  const wb2 = await Workbook.open(await wb.save())
  const ed = new SheetEditor(await wb2.doc('xl/worksheets/sheet1.xml'), [])
  return { wb2, ed, sheet: ed.root, drawing: await wb2.doc('xl/drawings/drawing1.xml'), book: await wb2.doc('xl/workbook.xml') }
}

describe('apagarLinhas', () => {
  it('apaga 4 a 6 e acerta linhas, mesclagens, imagem, área de impressão e formatação condicional', async () => {
    const wb = await montar()
    await apagarLinhas(wb, 'Aba', 4, 6)
    const { ed, sheet, drawing, book } = await reabrir(wb)

    expect(ed.lastRow).toBe(9)
    expect(ed.value('B3')).toBe('L3')
    expect(ed.value('B4')).toBe('L7') // a antiga linha 7 subiu para a 4
    expect(ed.value('B5')).toBe('L8') // célula de B8 em B5
    expect(ed.value('B9')).toBe('L12')
    expect(ed.row(10)).toBeUndefined()
    expect(ed.row(5)!.getAttribute('r')).toBe('5')

    const merges = ed.merges().map((m) => `${m.c1},${m.r1},${m.c2},${m.r2}`)
    expect(merges).toEqual(['2,3,3,3', '2,5,3,6']) // B3:C3 e B8:C9 → B5:C6
    expect(sheet.getElementsByTagName('mergeCells')[0].getAttribute('count')).toBe('2')

    const dim = sheet.getElementsByTagName('dimension')[0].getAttribute('ref')
    expect(dim).toBe('B1:L9')
    expect(sheet.getElementsByTagName('conditionalFormatting')[0].getAttribute('sqref')).toBe('B2:B9')

    // fórmula da própria aba acompanha: SUM(B2:B12) na célula D11 (agora D8)
    expect(ed.cell('D8')!.getElementsByTagName('f')[0].textContent).toBe('SUM(B2:B9)')

    // imagem ancorada na linha 10 (índice 9) vai para a linha 7 (índice 6)
    const from = drawing.getElementsByTagName('xdr:from')[0]
    expect(from.getElementsByTagName('xdr:row')[0].textContent).toBe('6')
    const to = drawing.getElementsByTagName('xdr:to')[0]
    expect(to.getElementsByTagName('xdr:row')[0].textContent).toBe('7')

    const pa = book.getElementsByTagName('definedName')[0].textContent
    expect(pa).toBe("'Aba'!$B$1:$L$9")
  })

  it('acha a aba pelo nome mesmo com acento, e a área de impressão com aspas', async () => {
    const wb = await montar('Ficha Medição Aterramento')
    await apagarLinhas(wb, 'Ficha Medição Aterramento', 4, 6)
    const { book } = await reabrir(wb)
    expect(book.getElementsByTagName('definedName')[0].textContent).toBe("'Ficha Medição Aterramento'!$B$1:$L$9")
  })

  it('a fórmula relativa da formatação condicional sobe junto com o sqref', async () => {
    const wb = await montar()
    const d = await wb.doc('xl/worksheets/sheet1.xml')
    const cf = d.getElementsByTagName('conditionalFormatting')[0]
    cf.setAttribute('sqref', 'B8')
    cf.getElementsByTagName('formula')[0].textContent = 'ISERROR(B8)'
    // validação de dados na linha 9 que olha a linha 2 (acima do trecho apagado) e a 10 (abaixo)
    const dvs = d.createElementNS(NS_MAIN, 'dataValidations')
    const dv = d.createElementNS(NS_MAIN, 'dataValidation')
    dv.setAttribute('sqref', 'C9')
    const f1 = d.createElementNS(NS_MAIN, 'formula1')
    f1.textContent = 'AND(B2>0,B10>0)'
    dv.appendChild(f1)
    dvs.appendChild(dv)
    d.documentElement.insertBefore(dvs, cf)
    wb.touch('xl/worksheets/sheet1.xml')
    await apagarLinhas(wb, 'Aba', 4, 6)
    const { sheet } = await reabrir(wb)
    const c = sheet.getElementsByTagName('conditionalFormatting')[0]
    expect(c.getAttribute('sqref')).toBe('B5')
    expect(c.getElementsByTagName('formula')[0].textContent).toBe('ISERROR(B5)')
    const v = sheet.getElementsByTagName('dataValidation')[0]
    expect(v.getAttribute('sqref')).toBe('C6')
    expect(v.getElementsByTagName('formula1')[0].textContent).toBe('AND(B2>0,B7>0)')
  })

  it('a fórmula de formatação condicional da extLst (xm:f) também acompanha', async () => {
    const wb = await montar()
    const d = await wb.doc('xl/worksheets/sheet1.xml')
    const ext = new DOMParser().parseFromString(
      `<x14:conditionalFormatting xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main"><x14:cfRule type="expression"><xm:f>ISERROR(B8)</xm:f></x14:cfRule><xm:sqref>B8</xm:sqref></x14:conditionalFormatting>`,
      'application/xml',
    ).documentElement
    d.documentElement.appendChild(d.importNode(ext, true))
    wb.touch('xl/worksheets/sheet1.xml')
    await apagarLinhas(wb, 'Aba', 4, 6)
    const { sheet } = await reabrir(wb)
    expect(sheet.getElementsByTagName('xm:sqref')[0].textContent).toBe('B5')
    expect(sheet.getElementsByTagName('xm:f')[0].textContent).toBe('ISERROR(B5)')
  })

  it('não deixa contêiner vazio (protectedRanges, hyperlinks, extLst) e acerta o count do que sobrou', async () => {
    const wb = await montar()
    const d = await wb.doc('xl/worksheets/sheet1.xml')
    const raiz = d.documentElement
    const trecho = (xml: string) =>
      d.importNode(
        new DOMParser().parseFromString(
          `<w xmlns="${NS_MAIN}" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main">${xml}</w>`,
          'application/xml',
        ).documentElement.firstChild!,
        true,
      )
    const cf = raiz.getElementsByTagName('conditionalFormatting')[0]
    // tudo dentro das linhas 4 a 6, que vão embora
    raiz.insertBefore(trecho('<protectedRanges><protectedRange name="p" sqref="B5"/></protectedRanges>'), cf)
    // dois itens: um some (linha 5), outro fica (linha 10, que sobe para a 7)
    raiz.insertBefore(trecho('<dataValidations count="2"><dataValidation sqref="C5"><formula1>1</formula1></dataValidation><dataValidation sqref="C10"><formula1>1</formula1></dataValidation></dataValidations>'), cf)
    raiz.insertBefore(trecho('<hyperlinks><hyperlink ref="B5" location="A1"/></hyperlinks>'), raiz.getElementsByTagName('drawing')[0])
    raiz.appendChild(
      trecho(
        '<extLst><ext uri="{78C0D931-6437-407d-A8EE-F0AAD7539E65}"><x14:conditionalFormattings><x14:conditionalFormatting><x14:cfRule type="expression"><xm:f>ISERROR(B5)</xm:f></x14:cfRule><xm:sqref>B5</xm:sqref></x14:conditionalFormatting></x14:conditionalFormattings></ext></extLst>',
      ),
    )
    wb.touch('xl/worksheets/sheet1.xml')
    await apagarLinhas(wb, 'Aba', 4, 6)
    const { sheet } = await reabrir(wb)
    for (const tag of ['protectedRanges', 'hyperlinks', 'extLst', 'ext', 'conditionalFormattings']) expect(sheet.getElementsByTagName(tag).length).toBe(0)
    const dvs = sheet.getElementsByTagName('dataValidations')[0]
    expect(dvs.getAttribute('count')).toBe('1')
    expect(dvs.getElementsByTagName('dataValidation')[0].getAttribute('sqref')).toBe('C7')
  })

  it('apagar o fim da aba não deixa referência quebrada', async () => {
    const wb = await montar()
    await apagarLinhas(wb, 'Aba', 10, 12)
    const { ed, sheet, book } = await reabrir(wb)
    expect(ed.lastRow).toBe(9)
    expect(sheet.getElementsByTagName('conditionalFormatting')[0].getAttribute('sqref')).toBe('B2:B9')
    expect(book.getElementsByTagName('definedName')[0].textContent).toBe("'Aba'!$B$1:$L$9")
  })
})

// ---- ficha de aterramento com quantidades diferentes de linhas e blocos ----

function fichaXml(linhasTabela: number, blocos: number): string {
  const cel = (ref: string, txt: string) => `<c r="${ref}" t="inlineStr"><is><t>${txt}</t></is></c>`
  const rows: Record<number, string> = { 5: cel('B5', 'RUA / AVENIDA / ESTRADA') }
  const merges: string[] = ['B5:F6']
  for (let i = 0; i < linhasTabela; i++) merges.push(`B${7 + i}:F${7 + i}`)
  let r = 7 + linhasTabela + 2
  for (let b = 0; b < blocos; b++) {
    rows[r] = cel(`B${r}`, 'Ponto') + cel(`F${r}`, 'Ponto')
    merges.push(`B${r}:C${r}`, `F${r}:G${r}`, `B${r + 1}:E${r + 8}`, `F${r + 1}:L${r + 8}`)
    r += 10
  }
  rows[r] = cel(`D${r}`, 'Registro')
  rows[r + 5] = cel(`D${r + 5}`, 'Registro')
  const sd = Object.entries(rows).map(([k, v]) => `<row r="${k}">${v}</row>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${NS_MAIN}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="B1:L${r + 6}"/><sheetData>${sd}</sheetData><mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells></worksheet>`
}

async function montarFicha(linhasTabela: number, blocos: number): Promise<Workbook> {
  const z = new JSZip()
  z.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${NS_MAIN}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Ficha Medição Aterramento" sheetId="1" r:id="rId1"/></sheets></workbook>`)
  z.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`)
  z.file('xl/worksheets/sheet1.xml', fichaXml(linhasTabela, blocos))
  return Workbook.open(await z.generateAsync({ type: 'uint8array' }))
}

const ponto = (n: number) => ({ rua: 'RUA ' + n, ponto: 'P' + n, tipoPoste: 'CONC' as const, ohms: 10 + n, hastes: 3 })

describe('aplicarAterramento apaga o que sobra', () => {
  it('com 2 pontos numa ficha de 5 linhas e 3 blocos, ficam 2 linhas, 2 blocos e o rodapé logo abaixo', async () => {
    const { aplicarAterramento } = await import('./fichas')
    const wb = await montarFicha(5, 3)
    await aplicarAterramento(wb, [ponto(1), ponto(2)])
    const wb2 = await Workbook.open(await wb.save())
    const ed = new SheetEditor(await wb2.sheetDoc('Ficha Medição Aterramento'), wb2.sharedStrings)
    // tabela: linhas 7 e 8 preenchidas; mais nada com mesclagem B:F além do cabeçalho
    expect(ed.value('B7')).toBe('RUA 1')
    expect(ed.value('B8')).toBe('RUA 2')
    expect(ed.merges().filter((m) => m.c1 === 2 && m.c2 === 6 && m.r1 === m.r2).map((m) => m.r1)).toEqual([7, 8])
    // blocos: dois rótulos "Ponto" por bloco, com o ponto preenchido ao lado
    const rotulos = ed.findText('Ponto')
    expect(rotulos.map((r) => r.row)).toEqual([11, 11, 21, 21])
    expect(ed.value('D11')).toBe('P1')
    expect(ed.value('D21')).toBe('P2')
    // rodapé: logo abaixo do último quadro (que termina na linha 29; sobram as 2 linhas de respiro do original)
    expect(ed.findText('Registro').map((r) => r.row)).toEqual([32, 37])
    expect(ed.lastRow).toBe(37)
  })

  it('com 3 pontos numa ficha de 3 linhas e 3 blocos, não apaga nada', async () => {
    const { aplicarAterramento } = await import('./fichas')
    const wb = await montarFicha(3, 3)
    const antes = await wb.zip.file('xl/worksheets/sheet1.xml')!.async('string')
    await aplicarAterramento(wb, [ponto(1), ponto(2), ponto(3)])
    const wb2 = await Workbook.open(await wb.save())
    const ed = new SheetEditor(await wb2.sheetDoc('Ficha Medição Aterramento'), wb2.sharedStrings)
    expect(ed.findText('Ponto').map((r) => r.row)).toEqual([12, 12, 22, 22, 32, 32])
    expect(ed.findText('Registro').map((r) => r.row)).toEqual([42, 47])
    expect(antes).toContain('<row r="47">')
  })

  it('sem pontos de aterramento a ficha fica exatamente como veio', async () => {
    const { aplicarAterramento } = await import('./fichas')
    const wb = await montarFicha(5, 3)
    const antes = await wb.zip.file('xl/worksheets/sheet1.xml')!.async('string')
    await aplicarAterramento(wb, [])
    const wb2 = await Workbook.open(await wb.save())
    expect(await wb2.zip.file('xl/worksheets/sheet1.xml')!.async('string')).toBe(antes)
  })
})
