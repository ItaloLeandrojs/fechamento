import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { setXmlImpl } from '../core/xml'
import { Workbook } from '../core/workbook'
import { SheetEditor } from '../core/sheet'
import { linhasDoTexto } from './mtext'
import { lerDxf, type Dxf, type TextoDxf } from './dxf'
import { contarObra, type Catalogo, type Linha } from './contagem'
import { comparar, lerOrcamento } from './orcamento'
import { gerarExcelCeara, nomeDoExcel, otDoNome, serialExcel } from './excel'

setXmlImpl(DOMParser as never, XMLSerializer as never)

describe('texto do CAD', () => {
  it('tira a formatação do MTEXT e quebra as linhas', () => {
    expect(linhasDoTexto('(1)300/9 S2N S2C\\P(1)ATER-SP\\P{\\C0;(0469365,9160985)\\P\\fArial Black|b0|i0|c0|p34;1}')).toEqual(['(1)300/9 S2N S2C', '(1)ATER-SP', '(0469365,9160985)', '1'])
    expect(linhasDoTexto('{\\A1;\\C6;(3)150/8 S2N}\\P(1)600/12 MB4')).toEqual(['(3)150/8 S2N', '(1)600/12 MB4'])
  })
})

const mtext = (bruto: string): TextoDxf => ({ tipo: 'MTEXT', bruto, camada: 'DESCRICAOPROJETADA', x: 0, y: 0, altura: 2.5 })
const text = (bruto: string, x: number, y: number, camada = '0'): TextoDxf => ({ tipo: 'TEXT', bruto, camada, x, y, altura: 2.24 })
const dxfDe = (textos: (string | TextoDxf)[], cotas: Dxf['cotas'] = []): Dxf => ({ versao: 'AC1024', textos: textos.map((t) => (typeof t === 'string' ? mtext(t) : t)), cotas })
const qtd = (l: Linha[]) => Object.fromEntries(l.map((x) => [x.codigo, Math.round(x.quantidade * 100) / 100]))
const cota = (modelo: string, medida: number) => ({ modelo, substituto: '', medida, camada: '' })

// pedaço da base da Enel, só o que os testes usam
const CATALOGO: Catalogo = {
  materiais: { '231235': ['POSTE,CONC,DT, 600/ 9M,GSS002', 'UN'], '171093': ['ELO,FUS,BOT,MT, 6A,K,D13801', 'UN'], '251841': ['SUPORTE,L,AZ,198,CF/PR,D41035', 'PEÇ'] },
  estruturas: { S1B: 'PE-38;ESTRUTURA SECUND.S1', S2N: 'ESTRUTURA SECUND.S2', SPALÇA50: 'ALÇA', SPLAÇO50: 'LAÇO', 'N3.1CAA4S': 'DERIV' },
}

describe('contagem pelas etiquetas', () => {
  it('prefixo do começo vale para a linha; estrutura de MT ganha o cabo da obra; (3) vai para devolução', () => {
    const r = contarObra(dxfDe(['(1)600/12 MB1\\P(1)MB3.1\\P(0356400,9245150)\\P1', '{\\C6;(3)150/8 S2N}\\P(1)600/12 MB4\\P(1)2xS2B\\P2'], [cota('(1)P2AN004<>', 80.4)]))
    expect(qtd(r.adicaoEstrutura)).toEqual({ 'MB1CAA4S_S': 1, 'MB3.1CAA4S_S': 1, 'MB4CAA4S_S': 1, S2B_S: 2 })
    expect(qtd(r.devolucaoEstrutura)).toEqual({ S2N_E: 1 })
    expect(qtd(r.adicaoMaterial)['231233']).toBe(2) // 2 postes 600/12 novos
    expect(qtd(r.devolucaoMaterial)['231602']).toBe(1) // poste 150/8 sucata
  })

  it('existente (sem prefixo) e realocado (2) não somam; número de folha não é poste', () => {
    const r = contarObra(dxfDe(['600/12 N1 S4A\\P(2)SPCXDT-P12PB\\P3', '01/05']))
    expect(r.adicaoEstrutura).toEqual([])
    expect(r.devolucaoEstrutura).toEqual([])
    expect(r.etiquetas).toHaveLength(1)
  })

  it('avisa o poste sem etiqueta no meio da numeração', () => {
    const r = contarObra(dxfDe(['(1)300/9 S2N\\P1', '(1)300/9 S2N\\P3']))
    expect(r.avisos.join(' ')).toMatch(/P2/)
  })

  it('junta os TEXTs soltos empilhados numa etiqueta só (obra de Limoeiro) e larga o texto de rua ao lado', () => {
    const r = contarObra(
      dxfDe([
        text('(1)600/12 M1CAA4S_S', 595082.3, 9436295.4),
        text('(1)TR15CAA4_S', 595082.3, 9436291.9),
        text('(1)TT15KVA SPTR15P_S', 595082.3, 9436288.5),
        text('(1)2xS1B_S', 595082.4, 9436284.9),
        text('RUA DAS FLORES', 595082.3, 9436281.4), // logo abaixo, mesma coluna: não é etiqueta
        text('600/12 M1', 595100.2, 9436255.2), // outro poste, existente
      ]),
    )
    expect(r.etiquetas).toHaveLength(2)
    expect(r.etiquetas[0].linhas).toEqual(['(1)600/12 M1CAA4S_S', '(1)TR15CAA4_S', '(1)TT15KVA SPTR15P_S', '(1)2xS1B_S'])
    expect(qtd(r.adicaoEstrutura)).toEqual({ M1CAA4S_S: 1, TR15CAA4_S: 1, SPTR15P_S: 1, S1B_S: 2 })
    // trafo novo sem chave escrita: 3 chaves, cada uma com elo, suporte e conector cunha
    expect(qtd(r.adicaoMaterial)).toEqual({ '231233': 1, '111279': 1, '251841': 3, '274921': 3 }) // o elo vem dentro da TR15CAA4
  })

  it('TEXT em coluna diferente ou camada diferente não se junta', () => {
    const r = contarObra(dxfDe([text('(1)300/9 S2N_S', 10, 100), text('(1)S2C_S', 30, 97), text('(1)ATER-SP', 10, 97, 'OUTRA')]))
    expect(r.etiquetas).toHaveLength(3)
  })

  it('alça e laço são estruturas; CAVA KLC não entra', () => {
    const r = contarObra(dxfDe(['(1)300/9 2xS1N_S\\P(1)2xSPALÇA50_S\\P(1)SPLAÇO50_S\\P(1)CAVA KLC\\P1']))
    expect(qtd(r.adicaoEstrutura)).toEqual({ S1N_S: 2, SPALÇA50_S: 2, SPLAÇO50_S: 1 })
    expect(r.adicaoMaterial.map((l) => l.codigo)).toEqual(['231228'])
    expect(r.ignorados).toEqual([{ poste: 'P1', texto: '(1)CAVA KLC' }])
    expect(r.naoReconhecidos).toEqual([])
  })
})

describe('cabos', () => {
  it('BT novo pelo código da bitola, +5% arredondado ao mais perto; fitas só com BT novo', () => {
    const r = contarObra(dxfDe(['\\A1;(1)AM050T40', '\\A1;(1)AM050T50', '\\A1;(1)AM035T10', '(1)300/9 S2N S2C\\P1']))
    // 90 m x 1,05 = 94,5 → 95; 10 m x 1,05 = 10,5 → 11 (0,5 sobe)
    expect(qtd(r.adicaoMaterial)).toMatchObject({ '330994': 95, '330993': 11, '860342': 1, '860344': 1 })
    const semBT = contarObra(dxfDe(['(1)300/9 S2N S2C\\P1']))
    expect(semBT.adicaoMaterial.map((l) => l.codigo)).toEqual(['231228'])
  })

  it('MT novo em kg = metros x fases x 1,05 x coeficiente (fases pelas estruturas)', () => {
    const r = contarObra(dxfDe(['(1)600/12 MB1\\P1', '(1)600/12 MB1\\P2'], [cota('(1)P3AN004<>', 2181)]))
    expect(qtd(r.adicaoMaterial)['310604']).toBe(389.31) // 2181 x 2 x 1,05 x 0,085, como no orçamento real
    const t = contarObra(dxfDe(['(1)600/12 M1\\P1'], [cota('(1)P3AN010<>', 100)]))
    expect(qtd(t.adicaoMaterial)['310605']).toBe(68.04) // 100 x 3 x 1,05 x 0,216
  })

  it('BT nu retirado em kg = metros x condutores do código x 0,058', () => {
    const r = contarObra(dxfDe(['\\A1;(3)2AN00438', '\\A1;(3)2AN00438', '\\A1;(3)2AN00438']))
    expect(qtd(r.devolucaoMaterial)).toEqual({ '310836': 13.22 }) // 114 x 2 x 0,058
    expect(r.devolucaoMaterial[0].palpite).toBe(false)
  })

  it('trafo retirado: sucata até 30 kVA, salvado acima (500 kVA só tem sucata)', () => {
    const r = contarObra(dxfDe(['(3)TT30KVA\\P1', '(3)TT45KVA\\P2', '(3)TT500KVA\\P3', '(3)TT20KVA\\P4']))
    expect(qtd(r.devolucaoMaterial)).toEqual({ '111738': 1, '111739': 1, '111751': 1, TT20KVA: 1 })
    expect(r.devolucaoMaterial.find((l) => l.codigo === '111738')!.palpite).toBe(false)
    expect(r.devolucaoMaterial.find((l) => l.codigo === 'TT20KVA')!.semCodigo).toBe(true)
  })

  it('MT retirado em kg, sem os 5%, e BT pré-reunido retirado em metros', () => {
    const r = contarObra(dxfDe(['\\A1;(3)AM050T30'], [cota('(3)P2AN004<>', 100)]))
    expect(qtd(r.devolucaoMaterial)).toEqual({ '310838': 17, '330887': 30 }) // 100 x 2 x 0,085
  })

  it('cabo tensionado (2) não é material; cabo sem regra vai sem código', () => {
    const r = contarObra(dxfDe(['\\A1;(2)AM050T30', '\\A1;(1)AM095T20']))
    expect(r.adicaoMaterial).toEqual([expect.objectContaining({ codigo: 'CABO AM095T', semCodigo: true, quantidade: 20 })])
  })
})

describe('materiais e base da Enel', () => {
  it('suporte 251841 por chave fusível escrita; elo só o escrito', () => {
    const r = contarObra(dxfDe(['600/12 M4CAA4S_E\\P(1)N3.1CAA4S\\P(1)3xCF 3xELO6K\\P1']), CATALOGO)
    expect(qtd(r.adicaoMaterial)).toEqual({ '251841': 3, '274921': 3, '171093': 3 })
    const semElo = contarObra(dxfDe(['600/12 M4CAA4S_E\\P(1)N3.1CAA4S\\P(1)3xCF\\P1']), CATALOGO)
    expect(qtd(semElo.adicaoMaterial)).toEqual({ '251841': 3, '274921': 3 })
  })

  it('postes pelo esforço e altura; poste sem código vai em vermelho', () => {
    const r = contarObra(dxfDe(['(1)600/9 S2N\\P(3)300/9 S2N\\P1', '(1)400/9 S2N\\P2']), CATALOGO)
    expect(qtd(r.adicaoMaterial)).toEqual({ '231235': 1, 'POSTE 400/9': 1 })
    expect(r.adicaoMaterial[0].descricao).toBe('POSTE,CONC,DT, 600/ 9M,GSS002')
    expect(r.adicaoMaterial[1].semCodigo).toBe(true)
    expect(qtd(r.devolucaoMaterial)).toEqual({ '231605': 1 })
    expect(r.avisos.join(' ')).toMatch(/POSTE 400\/9/)
  })

  it('estrutura fora da base da Enel é marcada e avisada', () => {
    const r = contarObra(dxfDe(['(1)300/9 S2N S9X\\P(1)S1B\\P1']), CATALOGO)
    expect(r.adicaoEstrutura.find((l) => l.codigo === 'S2N_S')).toMatchObject({ foraDaBase: false, descricao: 'ESTRUTURA SECUND.S2' })
    // S9X não é estrutura para o leitor; S1B existe na base
    expect(r.naoReconhecidos.map((n) => n.texto)).toEqual(['(1)S9X'])
    const fora = contarObra(dxfDe(['(1)300/9 S5C\\P1']), CATALOGO)
    expect(fora.adicaoEstrutura[0]).toMatchObject({ codigo: 'S5C_S', foraDaBase: true })
    expect(fora.avisos.join(' ')).toMatch(/S5C_S/)
  })
})

describe('Excel da contagem', () => {
  it('OT pelo nome do arquivo', () => {
    expect(otDoNome('8000000_ASBUILT 0000000000 Cosampa.dxf')).toBe('8000000')
    expect(otDoNome('ASBUILT 17220001234.dxf')).toBe('17220001234')
    expect(otDoNome('ASBUILT.dxf')).toBe('')
    expect(nomeDoExcel('1234567')).toBe('1234567 - ESTRUTURA E MATERIAL.xlsx')
  })

  it('4 abas no modelo da Enel, que o leitor de orçamento lê de volta igual', async () => {
    const r = contarObra(dxfDe(['(1)600/9 S2N\\P(1)2xSPALÇA50_S\\P(3)300/9 S2N\\P1', '(1)400/9 S5C\\P2', '\\A1;(1)AM050T40']), CATALOGO)
    const bytes = await gerarExcelCeara(r, { ot: '1234567', area: 'LESTE', data: new Date(2026, 10, 4) })
    const wb = await Workbook.open(bytes)
    expect(wb.sheets.map((s) => s.name)).toEqual(['ADIÇÃO ESTRUTURA', 'DEVOLUÇÃO ESTRUTURA', 'ADIÇÃO MATÉRIAL', 'DEVOLUÇÃO MATÉRIAL'])
    const est = new SheetEditor(await wb.sheetDoc('ADIÇÃO ESTRUTURA'), wb.sharedStrings)
    expect(est.value('A1')).toBe('SOLICITAÇÃO DE ACRÉSCIMOS DE MATERIAL - ENEL')
    expect([est.value('A4'), est.value('B4'), est.value('C4'), est.value('D4'), est.value('E4'), est.value('F4')]).toEqual([serialExcel(new Date(2026, 10, 4)), 'LESTE', 'COSAMPA', 1234567, 'S2N_S', 1])
    const mat = new SheetEditor(await wb.sheetDoc('ADIÇÃO MATÉRIAL'), wb.sharedStrings)
    expect(mat.value('E4')).toBe(231235)
    expect(mat.value('H3')).toBe('RESPONSÁVEL')
    // poste sem código: código vazio e o nome na descrição
    const semCodigo = [4, 5, 6, 7, 8].find((n) => String(mat.value('F' + n) ?? '').startsWith('POSTE 400/9'))
    expect(semCodigo).toBeDefined()
    expect(mat.value('E' + semCodigo)).toBeNull()

    const lido = await lerOrcamento(bytes)
    for (const b of ['adicaoEstrutura', 'devolucaoEstrutura', 'adicaoMaterial', 'devolucaoMaterial'] as const) {
      const comCodigo = r[b].filter((l) => !l.semCodigo)
      expect([...lido[b].entries()].map(([c, v]) => [c, v.quantidade])).toEqual(comCodigo.map((l) => [l.codigo, l.quantidade]))
    }
  })
})

// obras reais (pasta ../ceara-teste, fora do git): DXF salvo pelo ZWCAD + orçamento feito à mão
const OBRAS = ['mt-trafo', 'bt-8-postes', 'bt-1-poste'].filter((o) => existsSync(`../ceara-teste/${o}/obra.dxf`))
const catalogoReal = existsSync('src/data/enel-catalogo.json') ? (JSON.parse(readFileSync('src/data/enel-catalogo.json', 'utf8')) as Catalogo) : undefined

describe.skipIf(!OBRAS.length)('obras reais do Ceará contra o orçamento feito à mão', () => {
  it.each(OBRAS)('%s: estruturas batem (menos as diferenças já conhecidas)', async (ot) => {
    const r = contarObra(lerDxf(new Uint8Array(readFileSync(`../ceara-teste/${ot}/obra.dxf`))), catalogoReal)
    const cmp = comparar(r, await lerOrcamento(new Uint8Array(readFileSync(`../ceara-teste/${ot}/orcamento-real.xlsx`))))
    const diferentes = [...cmp.adicaoEstrutura, ...cmp.devolucaoEstrutura].filter((l) => l.situacao !== 'igual').map((l) => l.codigo)
    // mt-trafo: o desenho tem MB4 em 9 postes e o orçamento conta 4; vale o desenho (Italo, 04/11)
    expect(diferentes).toEqual(ot === 'mt-trafo' ? ['MB4CAA4S_S'] : [])
    expect(r.adicaoEstrutura.filter((l) => l.foraDaBase)).toEqual([])
  }, 120000)
})

describe.skipIf(!existsSync('../ceara-teste/limoeiro/obra.dxf'))('obra de Limoeiro (TEXTs soltos) contra a contagem do Italo', () => {
  it('estrutura e material iguais aos dele', () => {
    const r = contarObra(lerDxf(new Uint8Array(readFileSync('../ceara-teste/limoeiro/obra.dxf'))), catalogoReal)
    expect(qtd(r.adicaoEstrutura)).toEqual({ M1CAA4S_S: 1, TR15CAA4_S: 1, SPTR15P_S: 1, S1B_S: 2 })
    expect(qtd(r.adicaoMaterial)).toEqual({ '231233': 1, '111279': 1, '251841': 3, '274921': 3 }) // o elo vem dentro da TR15CAA4
    expect(r.devolucaoEstrutura).toEqual([])
    expect(r.devolucaoMaterial).toEqual([])
  }, 120000)
})
