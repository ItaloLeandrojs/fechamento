import { describe, expect, it } from 'vitest'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { setXmlImpl, parseXml } from './xml'
import { SheetEditor } from './sheet'
import { valorDoRotulo } from './rotulos'

setXmlImpl(DOMParser as never, XMLSerializer as never)

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const txt = (ref: string, t: string) => `<c r="${ref}" t="inlineStr"><is><t>${t}</t></is></c>`
const editor = (linhas: string, merges: string[]) =>
  new SheetEditor(parseXml(`<worksheet xmlns="${NS}"><sheetData>${linhas}</sheetData><mergeCells>${merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells></worksheet>`), [])

describe('valorDoRotulo (Check-list)', () => {
  it('acha o valor à direita do rótulo mesclado, como no modelo da EDP', () => {
    const ed = editor(`<row r="4">${txt('C4', 'Nota / OV :')}<c r="G4"><v>12345678</v></c>${txt('M4', 'Data da fiscalização ')}<c r="Q4" s="1"/></row>`, ['C4:F4', 'M4:P4', 'Q4:R4'])
    expect(valorDoRotulo(ed, 'Nota / OV', 'G4')).toBe('G4')
    // célula vazia mas que abre uma mesclagem também vale (a data ainda não foi preenchida)
    expect(valorDoRotulo(ed, 'Data da fiscalização', 'Q4')).toBe('Q4')
  })

  it('se o modelo mudar de lugar, segue o rótulo', () => {
    const ed = editor(`<row r="5">${txt('B5', 'Data da fiscalização:')}<c r="H5"><v>0</v></c></row>`, ['B5:E5'])
    expect(valorDoRotulo(ed, 'Data da fiscalização', 'Q4')).toBe('H5')
  })

  it('sem o rótulo, usa a célula de sempre', () => {
    const ed = editor(`<row r="4">${txt('C4', 'Outra coisa')}</row>`, [])
    expect(valorDoRotulo(ed, 'Data da fiscalização', 'Q4')).toBe('Q4')
  })
})
