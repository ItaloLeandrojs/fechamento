import { describe, expect, it } from 'vitest'
import { REGIOES } from './regioes'

describe('regiões da plataforma', () => {
  it('tem EDP, Ceará e Sergipe, nessa ordem, com número e estado', () => {
    expect(REGIOES.map((r) => [r.id, r.numero, r.nome, r.estado])).toEqual([
      ['edp', '01', 'EDP', 'pronto'],
      ['ceara', '02', 'Ceará', 'em-breve'],
      ['sergipe', '03', 'Sergipe', 'em-breve'],
    ])
  })

  it('as descrições são as combinadas', () => {
    const d = Object.fromEntries(REGIOES.map((r) => [r.id, r.descricao]))
    expect(d.edp).toBe('Inventário vira ADS, com conferência automática antes de baixar.')
    expect(d.ceara).toBe('Contagem de estrutura e material pelo CAD, com o orçamento pronto em Excel.')
    expect(d.sergipe).toBe('Book de obras da Energisa montado com as fotos de cada estrutura.')
  })
})
