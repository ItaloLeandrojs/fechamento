import { describe, expect, it } from 'vitest'
import { ehMaoDeObra, ehSucata, materialNovoEmSucata, primeiroOs, estadoInicial, montarLancamentos, temAjuste, type EstruturaLanc, type Kit } from './state'

const ce3: Kit = {
  kit: 'CE3',
  descricao: 'Estrutura CE3',
  itens: [
    { code: 1, desc: 'ALÇA CONDUTOR 4 AWG', qtd: 3, un: 'PEÇ' },
    { code: 2, desc: 'ALÇA CONDUTOR 1/0 AWG', qtd: 3, un: 'PEÇ' },
    { code: 3, desc: 'ISOLADOR', qtd: 3, un: 'PEÇ' },
  ],
}
const kits = new Map([[ce3.kit, ce3]])
const lancar = (est: EstruturaLanc) => montarLancamentos({ ...estadoInicial, estruturas: [est] }, kits).lancamentos

describe('ajuste dos materiais da estrutura', () => {
  it('sem ajuste, entram todos os materiais do kit vezes a quantidade', () => {
    expect(lancar({ id: 'a', kit: 'CE3', oper: '2000', qtd: 2 })).toEqual([
      { code: 1, oper: '2000', qty: 6 },
      { code: 2, oper: '2000', qty: 6 },
      { code: 3, oper: '2000', qty: 6 },
    ])
  })

  it('material tirado (0) não entra na soma, e quantidade mudada vale por estrutura', () => {
    expect(lancar({ id: 'a', kit: 'CE3', oper: '2000', qtd: 2, ajuste: { 2: 0, 3: 1 } })).toEqual([
      { code: 1, oper: '2000', qty: 6 },
      { code: 3, oper: '2000', qty: 2 },
    ])
  })

  it('temAjuste só acusa diferença real em relação ao kit', () => {
    expect(temAjuste({ id: 'a', kit: 'CE3', oper: '2000', qtd: 1 }, ce3)).toBe(false)
    expect(temAjuste({ id: 'a', kit: 'CE3', oper: '2000', qtd: 1, ajuste: { 1: 3 } }, ce3)).toBe(false)
    expect(temAjuste({ id: 'a', kit: 'CE3', oper: '2000', qtd: 1, ajuste: { 2: 0 } }, ce3)).toBe(true)
  })
})

describe('mão de obra', () => {
  it('é o código que começa com 7, qualquer que seja a unidade', () => {
    expect(ehMaoDeObra(71003305)).toBe(true) // banheiro químico, unidade PEÇ
    expect(ehMaoDeObra(71000919)).toBe(true) // SRV
    expect(ehMaoDeObra(30053440)).toBe(false)
    expect(ehMaoDeObra(20012345)).toBe(false) // material com unidade SRV na MaterialServico
  })
})

describe('sucata', () => {
  it('código 9… é sucata; material novo numa operação de retirada pede conferência', () => {
    expect(ehSucata(90011604)).toBe(true)
    expect(ehSucata(30053440)).toBe(false)
    expect(materialNovoEmSucata(30053440, 'retirada')).toBe(true)
    expect(materialNovoEmSucata(90011604, 'retirada')).toBe(false) // sucata na sucata: certo
    expect(materialNovoEmSucata(71000919, 'retirada')).toBe(false) // serviço de desativação
    expect(materialNovoEmSucata(30053440, 'instalacao')).toBe(false)
    expect(materialNovoEmSucata(30053440, 'outra')).toBe(false)
  })

  it('primeiroOs sobe os que pedem e mantém a ordem dos demais', () => {
    expect(primeiroOs([3, 9, 1, 92, 5], (n) => String(n).startsWith('9'))).toEqual([9, 92, 3, 1, 5])
  })
})
