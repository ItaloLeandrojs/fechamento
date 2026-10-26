import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { setXmlImpl, child, children } from './xml'
import { Workbook } from './workbook'
import { SheetEditor } from './sheet'
import { aplicarAds, conferirTitulosAds, readAds } from './ads'

setXmlImpl(DOMParser as never, XMLSerializer as never)

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

const ESTILOS = `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${NS}"><fonts count="2"><font><sz val="11"/><color theme="1"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FF0000FF"/><name val="Calibri"/></font></fonts><fills count="1"><fill/></fills><borders count="1"><border/></borders><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyBorder="1"/><xf numFmtId="165" fontId="1" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`

const procv = (r: number, col: string, n: number) => `<f>VLOOKUP(E${r},MaterialServico!C:${col},${n},0)</f>`

/** Linha da ADS: A id, C operação, E código, F/G PROCV, H planejado, I aplicado. */
function linha(r: number, code: string, plan: number) {
  return `<row r="${r}"><c r="A${r}" s="1"><v>${r - 1}</v></c><c r="C${r}" t="inlineStr" s="1"><is><t>2000</t></is></c><c r="E${r}" s="1"${code}</c><c r="F${r}" s="1" t="e">${procv(r, 'D', 2)}<v>#N/A</v></c><c r="G${r}" s="1" t="e">${procv(r, 'E', 3)}<v>#N/A</v></c><c r="H${r}" s="1"><v>${plan}</v></c><c r="I${r}" s="2"><v>0</v></c></row>`
}

const tit = (col: string, t: string) => `<c r="${col}1" t="inlineStr"><is><t>${t}</t></is></c>`
const TITULOS = `<row r="1">${tit('A', 'ID')}${tit('E', 'Código')}${tit('F', 'Descrição')}${tit('G', 'Unid.')}${tit('H', 'Planejado')}${tit('I', 'Aplicado')}${tit('J', 'Adicional')}${tit('K', 'Devolvido ')}</row>`

async function montar(titulos = TITULOS): Promise<Workbook> {
  const abas = {
    ADS: titulos +
      linha(2, ` t="inlineStr"><is><t> 30050165 </t></is>`, 5) + // código gravado como texto
      linha(3, `><v>10050572</v>`, 2),
    MaterialServico: `<row r="1"><c r="C1"><v>30050165</v></c><c r="D1" t="inlineStr"><is><t>ALÇA PREFORMADA</t></is></c><c r="E1" t="inlineStr"><is><t>PEÇ</t></is></c></row>` +
      `<row r="2"><c r="C2"><v>90011604</v></c><c r="D2" t="inlineStr"><is><t>PINO ISOLADOR</t></is></c><c r="E2" t="inlineStr"><is><t>PEÇ</t></is></c></row>`,
  }
  const nomes = Object.keys(abas) as (keyof typeof abas)[]
  const z = new JSZip()
  z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>`)
  z.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${NS}" xmlns:r="${REL}"><sheets>${nomes.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`)
  z.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${nomes.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`)
  z.file('xl/styles.xml', ESTILOS)
  nomes.forEach((n, i) => z.file(`xl/worksheets/sheet${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${NS}"><sheetData>${abas[n]}</sheetData></worksheet>`))
  return Workbook.open(await z.generateAsync({ type: 'uint8array' }))
}

const catalogo = new Map([
  [30050165, { desc: 'ALÇA PREFORMADA', un: 'PEÇ' }],
  [90011604, { desc: 'PINO ISOLADOR', un: 'PEÇ' }],
])

async function gerar(lancs: { code: number; oper: string; qty: number }[]) {
  const wb = await montar()
  const res = await aplicarAds(wb, lancs, catalogo)
  const wb2 = await Workbook.open(await wb.save())
  const ed = new SheetEditor(await wb2.sheetDoc('ADS'), wb2.sharedStrings)
  const estilos = await wb2.doc('xl/styles.xml')
  const fontes = children(child(estilos.documentElement, 'fonts')!, 'font')
  const xfs = children(child(estilos.documentElement, 'cellXfs')!, 'xf')
  const fonteDe = (ref: string) => fontes[Number(xfs[Number(ed.cell(ref)!.getAttribute('s') ?? 0)].getAttribute('fontId'))]
  return { res, ed, fonteDe, xfs, fontes }
}

describe('código da ADS', () => {
  it('reconhece o código gravado como texto: o lançamento cai na linha prevista, sem duplicar', async () => {
    const { res, ed } = await gerar([{ code: 30050165, oper: '2000', qty: 5 }])
    expect(res.linhasNovas).toEqual([])
    expect(res.destinos[0]).toMatchObject({ row: 2, motivo: 'prevista' })
    expect(ed.value('I2')).toBe(5)
  })

  it('o código em texto sai como número, e a descrição já aparece no Modo Protegido', async () => {
    const { ed } = await gerar([])
    const e2 = ed.cell('E2')!
    expect(e2.getAttribute('t') || null).toBeNull()
    expect(ed.value('E2')).toBe(30050165)
    expect(ed.value('F2')).toBe('ALÇA PREFORMADA')
    expect(ed.cell('F2')!.getAttribute('t')).toBe('str')
    expect(child(ed.cell('F2')!, 'f')?.textContent).toBe('VLOOKUP(E2,MaterialServico!C:D,2,0)')
    // código que já era número fica como estava
    expect(ed.value('E3')).toBe(10050572)
    expect(ed.value('F3')).toBe('#N/A')
  })

  it('readAds lê o código em texto e marca que precisa converter', async () => {
    const wb = await montar()
    const rows = readAds(new SheetEditor(await wb.sheetDoc('ADS'), wb.sharedStrings))
    expect(rows.find((r) => r.row === 2)).toMatchObject({ code: 30050165, codigoEmTexto: true })
    expect(rows.find((r) => r.row === 3)).toMatchObject({ code: 10050572, codigoEmTexto: false })
  })
})

describe('formato da coluna de código', () => {
  it('todo código sai no formato Número (0), prevista ou nova, sem perder a borda', async () => {
    const { ed, xfs } = await gerar([{ code: 90011604, oper: '2000', qty: 3 }])
    for (const ref of ['E2', 'E3', 'E4']) {
      const xf = xfs[Number(ed.cell(ref)!.getAttribute('s'))]
      expect(xf.getAttribute('numFmtId'), ref).toBe('1')
      expect(xf.getAttribute('applyNumberFormat'), ref).toBe('1')
      expect(xf.getAttribute('applyBorder'), ref).toBe('1')
    }
    // o cabeçalho e as outras colunas não mudam de formato
    expect(ed.cell('E1')!.getAttribute('s') || null).toBeNull()
    expect(xfs[Number(ed.cell('H2')!.getAttribute('s'))].getAttribute('numFmtId')).toBe('0')
  })
})

describe('linha nova (item não previsto)', () => {
  it('sai inteira em vermelho e negrito, com borda e formato de número mantidos', async () => {
    const { res, ed, fonteDe, xfs } = await gerar([{ code: 90011604, oper: '2000', qty: 3 }])
    expect(res.linhasNovas).toEqual([4])
    expect(ed.value('E4')).toBe(90011604)
    for (const ref of ['A4', 'C4', 'E4', 'F4', 'G4', 'H4', 'I4']) {
      const f = fonteDe(ref)
      expect(child(f, 'color')?.getAttribute('rgb'), ref).toBe('FFFF0000')
      expect(child(f, 'b'), ref).toBeTruthy()
    }
    // a cópia vermelha mantém o resto do estilo (aqui: a borda e o formato 165 do Aplicado)
    expect(xfs[Number(ed.cell('E4')!.getAttribute('s'))].getAttribute('applyBorder')).toBe('1')
    expect(xfs[Number(ed.cell('I4')!.getAttribute('s'))].getAttribute('numFmtId')).toBe('165')
    // as linhas previstas continuam como eram
    expect(child(fonteDe('F3'), 'color')?.getAttribute('theme')).toBe('1')
    // descrição e unidade guardadas para o Modo Protegido
    expect(ed.value('F4')).toBe('PINO ISOLADOR')
    expect(ed.value('G4')).toBe('PEÇ')
  })

  it('código fora do catálogo fica com #N/A guardado (como o Excel calcula)', async () => {
    const { ed } = await gerar([{ code: 12345678, oper: '2000', qty: 1 }])
    expect(ed.cell('F4')!.getAttribute('t')).toBe('e')
    expect(ed.value('F4')).toBe('#N/A')
  })

  it('várias linhas novas reaproveitam o mesmo estilo vermelho (não cria um por linha)', async () => {
    const uma = await gerar([{ code: 90011604, oper: '2000', qty: 3 }])
    const duas = await gerar([
      { code: 90011604, oper: '2000', qty: 3 },
      { code: 12345678, oper: '2000', qty: 1 },
    ])
    expect(duas.res.linhasNovas).toEqual([4, 5])
    expect(duas.xfs.length).toBe(uma.xfs.length)
    expect(duas.fontes.length).toBe(uma.fontes.length)
    // a segunda linha nova continua vermelha e em Número
    const xf5 = duas.xfs[Number(duas.ed.cell('E5')!.getAttribute('s'))]
    expect(xf5.getAttribute('numFmtId')).toBe('1')
    expect(child(duas.fonteDe('E5'), 'color')?.getAttribute('rgb')).toBe('FFFF0000')
    // só as 2 fontes usadas na ADS ganharam uma cópia vermelha
    expect(uma.fontes.length).toBe(2 + 2)
  })
})

describe('títulos da ADS', () => {
  it('para antes de gravar quando as colunas estão em outra ordem', async () => {
    const trocada = TITULOS.replace('<t>Aplicado</t>', '<t>Adicional</t>').replace('<t>Adicional</t></is></c><c r="K1"', '<t>Aplicado</t></is></c><c r="K1"')
    const wb = await montar(trocada)
    await expect(aplicarAds(wb, [{ code: 30050165, oper: '2000', qty: 1 }])).rejects.toThrow(/coluna I devia ser "Aplicado"/)
  })

  it('aceita diferença de acento, espaço e maiúscula no título', async () => {
    const wb = await montar(TITULOS.replace('<t>Descrição</t>', '<t>DESCRICAO </t>'))
    const ed = new SheetEditor(await wb.sheetDoc('ADS'), wb.sharedStrings)
    expect(() => conferirTitulosAds(ed)).not.toThrow()
  })
})

describe('linhas de reserva', () => {
  const reserva = (r: number) => `<row r="${r}"><c r="A${r}" s="1"><v>${r - 1}</v></c><c r="E${r}" s="1" t="e"><v>#N/A</v></c><c r="F${r}" s="1" t="e">${procv(r, 'D', 2)}<v>#N/A</v></c></row>`
  const total = (r: number) => `<row r="${r}"><c r="F${r}" t="inlineStr"><is><t>TOTAL</t></is></c><c r="H${r}"><f>SUM(H2:H${r - 1})</f><v>7</v></c></row>`

  async function comLinhas(extra: string) {
    const z = await montar()
    const aba = z.sheet('ADS')!
    const doc = await z.doc(aba.path)
    const sd = doc.getElementsByTagName('sheetData')[0]
    const tmp = new DOMParser().parseFromString(`<x xmlns="${NS}">${extra}</x>`, 'application/xml').documentElement
    for (const r of Array.from(tmp.getElementsByTagName('row'))) sd.appendChild(doc.importNode(r, true))
    z.touch(aba.path)
    return Workbook.open(await z.save())
  }

  it('usa as reservas do modelo (fórmula com erro) antes de criar linha nova', async () => {
    const wb = await comLinhas(reserva(4) + reserva(5))
    const res = await aplicarAds(wb, [{ code: 90011604, oper: '2000', qty: 3 }], catalogo)
    expect(res.linhasNovas).toEqual([4])
  })

  it('não escreve por cima de uma linha de total: para e avisa', async () => {
    const wb = await comLinhas(reserva(4) + total(5))
    await expect(
      aplicarAds(wb, [{ code: 90011604, oper: '2000', qty: 3 }, { code: 12345678, oper: '2000', qty: 1 }], catalogo),
    ).rejects.toThrow(/linha 5 tem conteúdo/)
  })

  it('com reserva suficiente antes do total, o total fica intacto', async () => {
    const wb = await comLinhas(reserva(4) + total(5))
    await aplicarAds(wb, [{ code: 90011604, oper: '2000', qty: 3 }], catalogo)
    const ed = new SheetEditor(await wb.sheetDoc('ADS'), wb.sharedStrings)
    expect(ed.value('F5')).toBe('TOTAL')
    expect(ed.value('E4')).toBe(90011604)
  })
})
