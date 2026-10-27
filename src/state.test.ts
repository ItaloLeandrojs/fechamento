import { describe, expect, it } from 'vitest'
import { ehMaoDeObra, estadoInicial, montarLancamentos, temAjuste, type EstruturaLanc, type Kit } from './state'

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
