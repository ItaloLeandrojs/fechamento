import { describe, expect, it } from 'vitest'
import { decidirDestinos, growRangeEnds, type AdsRow } from './ads'
import { shiftFormula } from './sheet'
import { dataExcel, mesAnoExcel } from './fichas'
import { encaixar } from './images'

const linha = (row: number, code: number, oper: string, planejado = 1): AdsRow => ({
  row, id: row, item: '', oper, code, descricao: '', unidade: '', planejado, aplicado: null, ordem: '',
})

describe('regras da ADS', () => {
  const rows = [
    linha(2, 111, '2000'),
    linha(3, 222, '2000'),
    linha(4, 222, '2020'),
    linha(5, 333, '2000'),
    linha(6, 333, '2010'),
    linha(7, 444, '2030'),
    linha(8, 555, '2010'),
  ]

  it('previsto na operação escolhida vai nela', () => {
    expect(decidirDestinos(rows, [{ code: 222, oper: '2020', qty: 4 }])[0]).toMatchObject({ row: 4, motivo: 'prevista' })
  })

  it('previsto só em outra operação de instalação vai na prevista', () => {
    expect(decidirDestinos(rows, [{ code: 111, oper: '2020', qty: 1 }])[0]).toMatchObject({ row: 2, operUsada: '2000' })
    expect(decidirDestinos(rows, [{ code: 555, oper: '2000', qty: 1 }])[0]).toMatchObject({ row: 8, operUsada: '2010' })
  })

  it('com 2000 e 2010 previstos e lançado 2020, prefere a 2000', () => {
    expect(decidirDestinos(rows, [{ code: 333, oper: '2020', qty: 1 }])[0]).toMatchObject({ row: 5, operUsada: '2000' })
  })

  it('retirada cai na outra operação de retirada', () => {
    expect(decidirDestinos(rows, [{ code: 444, oper: '2040', qty: 2 }])[0]).toMatchObject({ row: 7, operUsada: '2030' })
  })

  it('retirada nunca cai em operação de instalação', () => {
    expect(decidirDestinos(rows, [{ code: 111, oper: '2030', qty: 1 }])[0]).toMatchObject({ row: null, motivo: 'nova' })
  })

  it('não previsto vira linha nova', () => {
    expect(decidirDestinos(rows, [{ code: 999, oper: '2000', qty: 3 }])[0]).toMatchObject({ row: null, operUsada: '', motivo: 'nova' })
  })

  it('soma lançamentos repetidos e ignora quantidade zero', () => {
    const d = decidirDestinos(rows, [
      { code: 111, oper: '2000', qty: 2 },
      { code: 111, oper: '2000', qty: 3 },
      { code: 222, oper: '2000', qty: 0 },
    ])
    expect(d).toHaveLength(1)
    expect(d[0].qty).toBe(5)
  })
})

describe('fórmulas', () => {
  it('desloca só referências relativas', () => {
    expect(shiftFormula('IF(I2<>"",(M2*I2)+(I2*Q2),(H2*M2))', 5)).toBe('IF(I7<>"",(M7*I7)+(I7*Q7),(H7*M7))')
    expect(shiftFormula("IFERROR(VLOOKUP(E2&'Check-list'!$G$6,MaterialServico!A:F,6,0),\"0\")", 3)).toBe("IFERROR(VLOOKUP(E5&'Check-list'!$G$6,MaterialServico!A:F,6,0),\"0\")")
    expect(shiftFormula('VLOOKUP(P2&C2,Plan1!Q:S,3,0)', 1)).toBe('VLOOKUP(P3&C3,Plan1!Q:S,3,0)')
  })

  it('estica intervalos que terminavam na última linha', () => {
    expect(growRangeEnds('B2:N123 P2:P123', 123, 130)).toBe('B2:N130 P2:P130')
    expect(growRangeEnds('SUMIF(ADS!$G2:$G$123,"M",ADS!$L$2:$L$123)', 123, 130)).toBe('SUMIF(ADS!$G2:$G$130,"M",ADS!$L$2:$L$130)')
    expect(growRangeEnds('A1:A1234', 123, 130)).toBe('A1:A1234')
  })
})

describe('datas e imagens', () => {
  it('data do Excel', () => {
    expect(dataExcel(new Date(2026, 9, 23))).toBe(46318)
    expect(mesAnoExcel('03/2025')).toBe(45717)
    expect(mesAnoExcel('2025')).toBe(45658)
  })

  it('encaixa a foto inteira e centralizada', () => {
    const c = encaixar({ x: 0, y: 0, w: 1000, h: 500 }, { width: 300, height: 400 }, 0)
    expect(c.h).toBe(500)
    expect(c.w).toBe(375)
    expect(c.x).toBe(313)
  })
})
