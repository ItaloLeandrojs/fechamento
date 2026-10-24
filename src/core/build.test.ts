// Integração com o inventário real (e2e/dados/inv.xlsx, fora do git: o teste pula onde ele não existe).
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { setXmlImpl } from './xml'
import { Workbook } from './workbook'
import { SheetEditor, indexToCol } from './sheet'
import { gerarFechamento } from './build'

setXmlImpl(DOMParser as never, XMLSerializer as never)

const INV = 'e2e/dados/inv.xlsx'
const tecnico = { nome: 'Fulano de Tal', registro: 4321 }

describe.skipIf(!existsSync(INV))('gerarFechamento com o inventário real', () => {
  it('o rodapé de cada ficha já sai com a matrícula, o nome e a data no valor guardado (Modo Protegido)', async () => {
    const res = await gerarFechamento(readFileSync(INV), {
      lancamentos: [],
      tecnico,
      aterramento: [{ rua: 'RUA A', ponto: 'P1', tipoPoste: 'CONC', ohms: 10, hastes: 3 }],
      equipamentos: [],
      hoje: new Date(2026, 9, 24),
    })
    const wb = await Workbook.open(res.arquivo)
    const aba = wb.sheetByPrefix('Ficha Medi')!
    const ed = new SheetEditor(await wb.doc(aba.path), wb.sharedStrings)
    const parc = ed.findText('Colaborador Parceira')[0]
    const linha = parc.row - 1
    const valores = [ed.value(indexToCol(parc.col - 1) + linha), ed.value(indexToCol(parc.col) + linha)]
    expect(valores).toEqual([4321, 'FULANO DE TAL'])
    // a data do rodapé (puxada da Check-list Q4) também vem atualizada: 24/10/2026 = 46319
    const data = ed.findText('Data:')[0]
    expect(ed.value(indexToCol(data.col + 2) + data.row)).toBe(46319)
  })
})
