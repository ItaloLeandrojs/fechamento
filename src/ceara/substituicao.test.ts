import { describe, expect, it } from 'vitest'
import { contarObra, type BaseEnel } from './contagem'
import { ajustesDoDesenho } from './estratificacao'
import { dxfDe } from './teste-dxf'

// base inventada com os códigos de verdade da cruzeta (231260 concreto MB, 231342 fibra MB)
const BASE: BaseEnel = {
  materiais: { '231260': ['CRUZETA,CONC,1900,MB', 'UN'], '231342': ['CRUZETA,FIBRA,1900,MB', 'UN'], '900001': ['OUTRO', 'UN'] },
  estruturas: { M1CAA4S: 'M1', 'MB3.1CAA4S': 'MB3.1', S2B: 'S2B' },
  kits: {
    M1CAA4S: [['231260', 1], ['900001', 2]],
    'MB3.1CAA4S': [['231260', 2], ['900001', 1]],
    S2B: [['900001', 1]],
  },
}

describe('cruzeta de fibra escrita no poste tira a de concreto do kit (Italo, 09/11)', () => {
  it('zera a 231260 das estruturas novas do poste com CRUZ.POLI.MB', () => {
    const r = contarObra(dxfDe(['(1)600/12 M1CAA4S_S\\P(1)MB3.1CAA4S_S\\P(1)S2B_S\\P(1)3xCRUZ.POLI.MB\\P2']), BASE)
    const { ajustes, avisos } = ajustesDoDesenho(r, BASE)
    expect(ajustes).toEqual({ M1CAA4S: { qtd: { '231260': 0 }, novos: [] }, 'MB3.1CAA4S': { qtd: { '231260': 0 }, novos: [] } })
    expect(avisos).toEqual([])
  })

  it('a mesma estrutura em outro poste sem fibra: não mexe e avisa', () => {
    const r = contarObra(dxfDe(['(1)600/12 M1CAA4S_S\\P(1)3xCRUZ.POLI.MB\\P2', '(1)600/12 M1CAA4S_S\\P3']), BASE)
    const { ajustes, avisos } = ajustesDoDesenho(r, BASE)
    expect(ajustes).toEqual({})
    expect(avisos).toEqual(['A M1CAA4S_S está em poste com CRUZ.POLI.MB (P2) e em poste sem (P3): na estratificação, tire à mão o 231260 do kit.'])
  })

  it('sem cruzeta de fibra: nada', () => {
    const r = contarObra(dxfDe(['(1)600/12 M1CAA4S_S\\P2']), BASE)
    expect(ajustesDoDesenho(r, BASE)).toEqual({ ajustes: {}, avisos: [] })
  })
})

describe('conector cunha VII escrito no poste do trafo (Italo, 09/11)', () => {
  it('é o mesmo das chaves do trafo: não soma os 3 automáticos', () => {
    const r = contarObra(dxfDe(['(1)600/12\\P(1)TT15KVA\\P(1)3xCONEC.CUN.BIM VII\\P9']))
    const q = Object.fromEntries(r.adicaoMaterial.map((l) => [l.codigo, l.quantidade]))
    expect(q['274921']).toBe(3)
    expect(q['251841']).toBe(3)
  })

  it('sem ele escrito, continuam os 3 automáticos', () => {
    const r = contarObra(dxfDe(['(1)600/12\\P(1)TT15KVA\\P9']))
    expect(r.adicaoMaterial.find((l) => l.codigo === '274921')!.quantidade).toBe(3)
  })
})
