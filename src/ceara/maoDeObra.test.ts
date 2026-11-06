import { describe, expect, it } from 'vitest'
import type { Contagem, DesenhoMO } from './contagemMO'
import {
  PAPEIS,
  areaDaCidade,
  buscarVozes,
  letraDaCidade,
  limparRespostas,
  montarLinhas,
  respostasVazias,
  type BaseMaoDeObra,
  type Papel,
  type VozDaLista,
} from './maoDeObra'

const item = (voz: string, letra: 'A' | 'B', numero: string, descricao: string, variante = false): VozDaLista => ({ voz, letra, numero, descricao, unidade: 'UN', variante })
const base: BaseMaoDeObra = {
  lista: [
    item('XX110', 'A', '9000000001', 'Serviço teste cento e dez A'),
    item('XX110', 'B', '9000000002', 'Serviço teste cento e dez B'),
    item('XX212', 'A', '9000000099', 'Serviço tensionar GRP A - variante', true),
    item('XX212', 'A', '9000000003', 'Serviço tensionar A'),
    item('XX212', 'B', '9000000004', 'Serviço tensionar B'),
    item('XX730', 'A', '9000000005', 'Operação de equipamento A'),
  ],
  papeis: Object.fromEntries(PAPEIS.map((p) => [p, 'XX110'])) as Record<Papel, string>,
  regrasCabo: [],
  tensionar: [],
}
base.papeis.tensionar = 'XX212'
base.papeis['operacao-equipamento'] = 'XX730'

const desenho = (contagens: Contagem[]): DesenhoMO => ({ contagens, perguntas: [], chavesPerguntas: [], naoCobrado: [], semRegra: [], linhaViva: [] })
const resp = (extra: Partial<ReturnType<typeof respostasVazias>> = {}) => ({ ...respostasVazias('1234567'), desligamento: false, ...extra })
const posteMT: Contagem = { aba: 'adicao', papel: 'poste-mt', quantidade: 1, origem: 'P1' }

describe('linhas da mão de obra', () => {
  it('letra pela cidade', () => {
    expect(letraDaCidade('SUL', 'Crato')).toBe('A')
    expect(letraDaCidade('SUL', 'OUTRA')).toBe('B')
    expect(letraDaCidade('SUL', 'Icó')).toBeNull()
    expect(letraDaCidade('SUL', null)).toBeNull()
  })

  it('área pela cidade A; outra cidade não diz a área', () => {
    expect(areaDaCidade('Crato')).toBe('SUL')
    expect(areaDaCidade('Russas')).toBe('LESTE')
    expect(areaDaCidade('Iguatu')).toBe('CENTRO SUL')
    expect(areaDaCidade('OUTRA')).toBeNull()
    expect(areaDaCidade(null)).toBeNull()
  })

  it('sem cidade, a descrição sai sem o sufixo (como a voz)', () => {
    const comSufixo: BaseMaoDeObra = { ...base, lista: [item('XX110', 'A', '9000000001', 'XX110_A_Servico teste'), item('XX110', 'B', '9000000002', 'XX110_B_Servico teste')] }
    const [l] = montarLinhas(desenho([posteMT]), comSufixo, resp(), 'SUL')
    expect(l.descricao).toBe('Servico teste')
    // com a cidade, fica a descrição da lista, com o sufixo da letra
    expect(montarLinhas(desenho([posteMT]), comSufixo, resp({ cidade: 'OUTRA' }), 'SUL')[0].descricao).toBe('XX110_B_Servico teste')
  })

  it('linha com número e sufixo', () => {
    const [l] = montarLinhas(desenho([posteMT]), base, resp({ cidade: 'Crato' }), 'SUL')
    expect(l.chave).toBe('adicao|XX110')
    expect(l.numero).toBe('9000000001')
    expect(l.falta).toBeUndefined()
  })

  it('variante fica de fora da contagem', () => {
    const c: Contagem = { aba: 'adicao', papel: 'tensionar', quantidade: 1, origem: 'P1' }
    const [l] = montarLinhas(desenho([c]), base, resp({ cidade: 'Crato' }), 'SUL')
    expect(l.numero).toBe('9000000003')
    expect(l.numero).not.toBe('9000000099')
  })

  it('sem cidade fica vermelha', () => {
    const [l] = montarLinhas(desenho([posteMT]), base, resp(), 'SUL')
    expect(l.numero).toBeNull()
    expect(l.falta).toContain('escolha a cidade da obra')
    expect(l.descricao).toBe('Serviço teste cento e dez A')
  })

  it('voz fora da lista', () => {
    const l = montarLinhas(desenho([]), base, resp({ cidade: 'OUTRA', desligamento: true, equipamentos: 2 }), 'SUL').find((x) => x.voz === 'XX730')!
    expect(l.quantidade).toBe(4)
    expect(l.numero).toBeNull()
    expect(l.falta).toBe('voz fora da lista')
  })

  it('desligamento', () => {
    const c = { cidade: 'Crato' }
    expect(montarLinhas(desenho([]), base, resp({ ...c, desligamento: false }), 'SUL')).toEqual([])
    const [l] = montarLinhas(desenho([]), base, resp({ ...c, desligamento: null }), 'SUL')
    expect(l.automatico).toBe(0)
    expect(l.falta).toBe('responda se teve desligamento')
    const [v] = montarLinhas(desenho([]), base, resp({ ...c, desligamento: true }), 'SUL')
    expect(v.origem).toEqual(['desligamento'])
    expect(v.quantidade).toBe(2)
  })

  it('mudança à mão fica ao trocar a cidade', () => {
    const r = resp({ mudancas: { 'adicao|XX110': 5 } })
    const a = montarLinhas(desenho([posteMT]), base, { ...r, cidade: 'Crato' }, 'SUL')[0]
    const b = montarLinhas(desenho([posteMT]), base, { ...r, cidade: 'OUTRA' }, 'SUL')[0]
    for (const l of [a, b]) {
      expect(l.quantidade).toBe(5)
      expect(l.mudada).toBe(true)
      expect(l.automatico).toBe(1)
    }
    expect(a.numero).toBe('9000000001')
    expect(b.numero).toBe('9000000002')
  })

  it('falta não soma', () => {
    const cs: Contagem[] = [
      { aba: 'adicao', papel: 'tensionar', quantidade: 1, origem: 'P1' },
      { aba: 'adicao', papel: 'tensionar', quantidade: 1, origem: 'P2', falta: 'responda o tensionar' },
    ]
    const [l] = montarLinhas(desenho(cs), base, resp({ cidade: 'Crato' }), 'SUL')
    expect(l.automatico).toBe(1)
    expect(l.falta).toContain('responda o tensionar')
    expect(l.origem).toEqual(['P1', 'P2'])
  })

  it('somada à mão', () => {
    const r = resp({ cidade: 'Crato', somadas: [{ aba: 'adicao', voz: 'XX212', quantidade: 2 }] })
    const [l] = montarLinhas(desenho([posteMT]), base, r, 'SUL').slice(-1)
    expect(l.somada).toBe(true)
    expect(l.automatico).toBeNull()
    expect(l.quantidade).toBe(2)
    expect(l.numero).toBe('9000000003')
  })

  it('somada de voz que já é automática na aba é ignorada', () => {
    const r = resp({ cidade: 'Crato', somadas: [{ aba: 'adicao', voz: 'XX110', quantidade: 2 }] })
    const ls = montarLinhas(desenho([posteMT]), base, r, 'SUL')
    expect(ls).toHaveLength(1)
    expect(ls[0].somada).toBe(false)
  })

  it('adição antes de devolução', () => {
    const cs: Contagem[] = [{ aba: 'devolucao', papel: 'retirada-poste-mt', quantidade: 1, origem: 'P1' }, posteMT]
    const abas = montarLinhas(desenho(cs), base, resp({ cidade: 'Crato' }), 'SUL').map((l) => l.aba)
    expect(abas).toEqual(['adicao', 'devolucao'])
  })

  it('limparRespostas', () => {
    const d: DesenhoMO = { ...desenho([posteMT]), chavesPerguntas: ['P1|bt'], linhaViva: [{ poste: 'P1', doDesenho: true, vale: true }] }
    const r = resp({
      cidade: 'Crato',
      tensionar: { 'P1|bt': true, 'P9|mt|M3|1': true },
      fases: { 'fases|X': 3 },
      linhaViva: { P1: true, P9: false },
      mudancas: { 'adicao|XX110': 5, 'devolucao|XX110': 3 },
      somadas: [{ aba: 'devolucao', voz: 'XX212', quantidade: 1 }],
    })
    const limpa = limparRespostas(r, d, montarLinhas(d, base, r, 'SUL'))
    expect(limpa.tensionar).toEqual({ 'P1|bt': true })
    expect(limpa.fases).toEqual({})
    expect(limpa.linhaViva).toEqual({ P1: true })
    expect(limpa.mudancas).toEqual({ 'adicao|XX110': 5 })
    expect(limpa.somadas).toEqual(r.somadas)
    expect(limpa.cidade).toBe('Crato')
  })

  it('busca', () => {
    const achados = buscarVozes(base, 'te', 'A').map((v) => v.numero)
    expect(achados).toContain('9000000003')
    expect(achados).toContain('9000000099')
    expect(achados).not.toContain('9000000004')
    expect(buscarVozes(base, 't', 'A')).toEqual([])
  })
})
