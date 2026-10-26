// Testes com inventários reais de outras obras (pasta ../inventarios-teste, fora do git:
// cada teste pula onde o arquivo não existe).
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { setXmlImpl, child } from './xml'
import { Workbook } from './workbook'
import { SheetEditor } from './sheet'
import { gerarFechamento } from './build'

setXmlImpl(DOMParser as never, XMLSerializer as never)

const AMIGO = '../inventarios-teste/do-amigo/original.xlsx'

describe.skipIf(!existsSync(AMIGO))('inventário com fórmulas para a planilha externa da EDP (nota 4001933383)', () => {
  // material novo, material em kg novo e serviço novo (código 7…), nenhum previsto nesta obra
  const lancamentos = [
    { code: 30053440, oper: '2000', qty: 3 },
    { code: 30057582, oper: '2000', qty: 0.33 },
    { code: 71000919, oper: '2000', qty: 1 },
  ]

  async function gerar() {
    const res = await gerarFechamento(readFileSync(AMIGO), { lancamentos, aterramento: [], equipamentos: [], boletim: 'final' })
    const wb = await Workbook.open(res.arquivo)
    return { res, ed: new SheetEditor(await wb.sheetDoc('ADS'), wb.sharedStrings) }
  }

  it('linha nova com descrição e unidade da MaterialServico, já calculadas para o Modo Protegido', async () => {
    const { res, ed } = await gerar()
    expect(res.ads.linhasNovas).toHaveLength(3)
    const porCodigo = new Map(res.ads.linhasNovas.map((r) => [ed.value('E' + r), r]))
    const r1 = porCodigo.get(30053440)!
    const r2 = porCodigo.get(30057582)!
    const r3 = porCodigo.get(71000919)!
    expect(ed.value('F' + r1)).toBe('CON CUNHA RD CN5 AL PROT CORR GAL')
    expect(ed.value('G' + r1)).toBe('PEÇ')
    expect(ed.value('G' + r2)).toBe('KG')
    expect(ed.value('G' + r3)).toBe('SRV')
    for (const r of [r1, r2, r3]) {
      for (const col of ['F', 'G', 'M', 'Q', 'L']) {
        const f = child(ed.cell(col + r)!, 'f')?.textContent ?? ''
        expect(f, `${col}${r} não pode depender da planilha externa`).not.toMatch(/\[\d+\]/)
      }
      expect(child(ed.cell('F' + r)!, 'f')?.textContent).toBe(`TRIM(VLOOKUP(E${r},MaterialServico!C:D,2,0))`)
      expect(child(ed.cell('G' + r)!, 'f')?.textContent).toBe(`TRIM(VLOOKUP(E${r},MaterialServico!C:E,3,0))`)
    }
  })

  it('nenhuma célula da linha nova continua presa à planilha externa (sairia #N/D)', async () => {
    const { res, ed } = await gerar()
    for (const r of res.ads.linhasNovas) {
      for (const c of Array.from(ed.row(r)!.getElementsByTagName('c'))) {
        const f = child(c, 'f')?.textContent ?? ''
        expect(f, c.getAttribute('r')!).not.toMatch(/\[\d+\]/)
      }
    }
  })

  it('preço: serviço (7…) pelo contrato na coluna M, material pelo código na Q', async () => {
    const { res, ed } = await gerar()
    const r = res.ads.linhasNovas.find((x) => ed.value('E' + x) === 71000919)!
    expect(child(ed.cell('M' + r)!, 'f')?.textContent).toBe(`IFERROR(IF(LEFT(E${r},1)="7",VLOOKUP(E${r}&'Check-list'!$G$6,MaterialServico!A:F,6,0),0),"0")`)
    expect(child(ed.cell('Q' + r)!, 'f')?.textContent).toBe(`IFERROR(IF(LEFT(E${r},1)<>"7",VLOOKUP(E${r},MaterialServico!B:F,5,0),0),"0")`)
  })

  it('as linhas previstas continuam com as fórmulas da EDP, inclusive o código (o preço procura o código em texto)', async () => {
    const { ed } = await gerar()
    expect(ed.value('E2')).toBe('10050572')
    expect(child(ed.cell('E2')!, 'f')?.textContent).toMatch(/\[1\]Dados/)
    expect(child(ed.cell('F2')!, 'f')?.textContent).toMatch(/\[1\]Dados/)
    expect(ed.value('F2')).toMatch(/^CABO PROT XLPE/)
  })

  it('o lançamento de um item previsto cai na linha prevista (sem duplicar), mesmo com o código em texto', async () => {
    const res = await gerarFechamento(readFileSync(AMIGO), { lancamentos: [{ code: 10050572, oper: '2000', qty: 90 }], aterramento: [], equipamentos: [] })
    expect(res.ads.linhasNovas).toEqual([])
    expect(res.ads.destinos[0]).toMatchObject({ row: 2, motivo: 'prevista' })
  })
})
