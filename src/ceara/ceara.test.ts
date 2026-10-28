import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { setXmlImpl } from '../core/xml'
import { linhasDoTexto } from './mtext'
import { lerDxf, type Dxf } from './dxf'
import { contarObra } from './contagem'
import { comparar, lerOrcamento } from './orcamento'

setXmlImpl(DOMParser as never, XMLSerializer as never)

describe('texto do CAD', () => {
  it('tira a formatação do MTEXT e quebra as linhas', () => {
    expect(linhasDoTexto('(1)300/9 S2N S2C\\P(1)ATER-SP\\P{\\C0;(0469365,9160985)\\P\\fArial Black|b0|i0|c0|p34;1}')).toEqual(['(1)300/9 S2N S2C', '(1)ATER-SP', '(0469365,9160985)', '1'])
    expect(linhasDoTexto('{\\A1;\\C6;(3)150/8 S2N}\\P(1)600/12 MB4')).toEqual(['(3)150/8 S2N', '(1)600/12 MB4'])
  })
})

const dxfDe = (textos: string[], cotas: Dxf['cotas'] = []): Dxf => ({ versao: 'AC1024', textos: textos.map((bruto) => ({ tipo: 'MTEXT' as const, bruto, camada: 'DESCRICAOPROJETADA', x: 0, y: 0 })), cotas })

describe('contagem pelas etiquetas', () => {
  it('prefixo do começo vale para a linha; estrutura de MT ganha o cabo da obra; (3) vai para devolução', () => {
    const r = contarObra(
      dxfDe(['(1)600/12 MB1\\P(1)MB3.1\\P(0356400,9245150)\\P1', '{\\C6;(3)150/8 S2N}\\P(1)600/12 MB4\\P(1)2xS2B\\P2'], [{ modelo: '(1)P2AN004<>', substituto: '', medida: 80.4, camada: '' }]),
    )
    expect(r.adicaoEstrutura.map((l) => `${l.codigo}=${l.quantidade}`).sort()).toEqual(['MB1CAA4S_S=1', 'MB3.1CAA4S_S=1', 'MB4CAA4S_S=1', 'S2B_S=2'])
    expect(r.devolucaoEstrutura.map((l) => `${l.codigo}=${l.quantidade}`)).toEqual(['S2N_E=1'])
    expect(r.adicaoMaterial.find((l) => l.codigo === '231233')?.quantidade).toBe(2) // 2 postes 600/12 novos
    expect(r.devolucaoMaterial.find((l) => l.codigo === '231602')?.quantidade).toBe(1) // poste 150/8 sucata
  })

  it('existente (sem prefixo) e realocado (2) não somam; número de folha não é poste', () => {
    const r = contarObra(dxfDe(['600/12 N1 S4A\\P(2)SPCXDT-P12PB\\P3', '01/05']))
    expect(r.adicaoEstrutura).toEqual([])
    expect(r.devolucaoEstrutura).toEqual([])
    expect(r.etiquetas).toHaveLength(1)
  })

  it('vão de BT em texto soma os metros e o material leva 5% de sobra', () => {
    const r = contarObra(dxfDe(['\\A1;(1)AM035T29', '\\A1;(1)AM035T31', '(1)300/9 S2N S2C\\P1']))
    expect(r.adicaoMaterial.find((l) => l.codigo === '330993')?.quantidade).toBe(63) // 60 m + 5%
  })

  it('avisa o poste sem etiqueta no meio da numeração', () => {
    const r = contarObra(dxfDe(['(1)300/9 S2N\\P1', '(1)300/9 S2N\\P3']))
    expect(r.avisos.join(' ')).toMatch(/P2/)
  })
})

// obras reais (pasta ../ceara-teste, fora do git): DXF salvo pelo ZWCAD + orçamento feito à mão
const OBRAS = ['mt-trafo', 'bt-8-postes', 'bt-1-poste'].filter((o) => existsSync(`../ceara-teste/${o}/obra.dxf`))

describe.skipIf(!OBRAS.length)('obras reais do Ceará contra o orçamento feito à mão', () => {
  it.each(OBRAS)('%s: estruturas batem (menos as diferenças já conhecidas)', async (ot) => {
    const r = contarObra(lerDxf(new Uint8Array(readFileSync(`../ceara-teste/${ot}/obra.dxf`))))
    const cmp = comparar(r, await lerOrcamento(new Uint8Array(readFileSync(`../ceara-teste/${ot}/orcamento-real.xlsx`))))
    const diferentes = [...cmp.adicaoEstrutura, ...cmp.devolucaoEstrutura].filter((l) => l.situacao !== 'igual').map((l) => l.codigo)
    // mt-trafo: o desenho tem MB4 em 9 postes e o orçamento conta 4 (perguntado ao Italo)
    expect(diferentes).toEqual(ot === 'mt-trafo' ? ['MB4CAA4S_S'] : [])
  }, 120000)
})
