import { describe, expect, it } from 'vitest'
import { ehMaoDeObra, estadoInicial, montarLancamentos, operacoesDaAds, temAjuste, type EstruturaLanc, type Kit } from './state'

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

describe('operações da ADS', () => {
  const operacoes = operacoesDaAds([
    { oper: '2000', descricao: 'R-RAMAL LIGAÇÃO - ODI - CT - 40' },
    { oper: '2010', descricao: 'POSTE - ODI - CT - 40' },
    { oper: '2020', descricao: 'CONDUTOR (VÃO/RM LIG) - ODI - CT - 40' },
    { oper: '2030', descricao: 'POSTE - ODD - ET - 40' },
    { oper: '2040', descricao: 'CONDUTOR (VÃO/RM LIG) - ODD - CT - 40' },
    { oper: '2050', descricao: 'TRANSF. DISTR. AÉREO - ODD - CT - 40' },
    { oper: '2060', descricao: 'POSTE - ODD - CT - 40' },
    { oper: '2070', descricao: 'R-RAMAL LIGAÇÃO - ODD - CT - 40' },
  ])

  it('usa todas as operações e descrições do inventário, inclusive as novas', () => {
    expect(operacoes.map((o) => o.oper)).toEqual(['2000', '2010', '2020', '2030', '2040', '2050', '2060', '2070'])
    expect(operacoes.find((o) => o.oper === '2050')).toMatchObject({ nome: 'TRANSF. DISTR. AÉREO', grupo: 'retirada' })
  })

  it('separa instalação para estruturas e deixa retirada para lançamento avulso', () => {
    expect(operacoes.filter((o) => o.grupo === 'instalacao').map((o) => o.oper)).toEqual(['2000', '2010', '2020'])
    expect(operacoes.filter((o) => o.grupo === 'retirada').map((o) => o.oper)).toEqual(['2030', '2040', '2050', '2060', '2070'])
  })
})
