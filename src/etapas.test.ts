import { describe, expect, it } from 'vitest'
import { montarEtapas } from './etapas'
import { estadoInicial, numero, type Estado } from './state'

describe('montarEtapas', () => {
  it('lista as 8 etapas na ordem, com o carimbo pendente quando falta técnico', () => {
    const etapas = montarEtapas(estadoInicial, ['Escolha o técnico do carimbo.'])
    expect(etapas.map((e) => e.rotulo)).toEqual(['Estruturas', 'Materiais', 'Mão de obra', 'Aterramento', 'Equipamento', 'Desligamento', 'Carimbo', 'Revisar e baixar'])
    expect(etapas.map((e) => e.grupo)).toEqual(['Lançamentos', 'Lançamentos', 'Lançamentos', 'Fichas', 'Fichas', 'Fichas', 'Fechar', 'Fechar'])
    expect(etapas.find((e) => e.id === 'carimbo')?.estado).toBe('pendente')
    expect(etapas.find((e) => e.id === 'estruturas')?.estado).toBe('vazio')
  })

  it('marca estruturas como feitas e conta as lançadas', () => {
    const e: Estado = { ...estadoInicial, estruturas: [{ id: 'a', kit: 'KP-CE1-P23', oper: '2020', qtd: 1 }, { id: 'b', kit: 'KP-CE3', oper: '2000', qtd: 1 }] }
    const etapas = montarEtapas(e, [])
    const est = etapas.find((x) => x.id === 'estruturas')
    expect(est?.estado).toBe('feito')
    expect(est?.n).toBe(2)
    expect(etapas.find((x) => x.id === 'carimbo')?.estado).toBe('vazio')
  })

  it('carimbo fica feito com técnico escolhido e a revisão pendente se há pendências', () => {
    const etapas = montarEtapas({ ...estadoInicial, tecnico: 123 }, ['Aterramento: o ponto 1 está sem número.'])
    expect(etapas.find((x) => x.id === 'carimbo')?.estado).toBe('feito')
    expect(etapas.find((x) => x.id === 'revisao')?.estado).toBe('pendente')
  })

  it('aponta pendência de aterramento e de desligamento sem foto', () => {
    const e: Estado = { ...estadoInicial, tecnico: 1, temDP: true, aterramento: [{ id: 'p', rua: '', ponto: '', tipoPoste: '', ohms: '', hastes: '' }] }
    const etapas = montarEtapas(e, ['Aterramento: o ponto 1 está sem número.', 'Desligamento programado marcado, mas sem a foto do documento.'])
    expect(etapas.find((x) => x.id === 'aterramento')?.estado).toBe('pendente')
    expect(etapas.find((x) => x.id === 'dp')?.estado).toBe('pendente')
    expect(etapas.find((x) => x.id === 'aterramento')?.n).toBe(1)
  })
})

describe('numero', () => {
  it('lê números no jeito brasileiro e no jeito simples', () => {
    expect(numero('2,5')).toBe(2.5)
    expect(numero('1.234,5')).toBe(1234.5)
    expect(numero('19.10')).toBe(19.1)
    expect(numero('')).toBeNull()
  })
})
