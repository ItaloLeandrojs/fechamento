import { describe, expect, it } from 'vitest'
import type { BaseEnel, Linha, ResultadoCeara } from './contagem'
import {
  adicionarNovo, ajustesValidos, aplicarSugestao, chaveKit, kitDe, limpar, linhasDoKit, mesmaObra, somarNaAdicao, sugestoesAoBaixar, type Ajuste,
} from './estratificacao'

// base inventada, só para os testes
const BASE: BaseEnel = {
  materiais: {
    '900001': ['CABO TESTE', 'M'], '900002': ['CONECTOR TESTE', 'UN'], '900003': ['ELO TESTE A', 'UN'],
    '900004': ['ELO TESTE B', 'UN'], '900005': ['CHAVE TESTE', 'UN'],
  },
  estruturas: { KITX1: 'ESTRUTURA TESTE', 'N3.1KIT': 'DERIV TESTE' },
  kits: {
    KITX1: [['900001', 2.45], ['900002', 4], ['900003', 1], ['900005', 1]],
    'N3.1KIT': [['900002', 2], ['900002', 1]],
  },
}
const kit = kitDe(BASE, 'KITX1')!

describe('estratificação do material', () => {
  it('chaveKit tira só o _S do fim', () => {
    expect(chaveKit('KITX1_S')).toBe('KITX1')
    expect(chaveKit('N3.1KIT_S')).toBe('N3.1KIT')
    expect(chaveKit('KITX1')).toBe('KITX1')
  })

  it('kit repetido vira uma linha', () => {
    expect(kitDe(BASE, 'N3.1KIT')).toEqual([{ codigo: '900002', descricao: 'CONECTOR TESTE', unidade: 'UN', qtd: 3 }])
    expect(kitDe(BASE, 'NAOTEM')).toBeNull()
  })

  it('as cinco situações', () => {
    const ajuste: Ajuste = { qtd: { '900001': 1.23, '900002': 8, '900003': 0 }, novos: [{ codigo: '900004', qtd: 1 }] }
    const l = Object.fromEntries(linhasDoKit(BASE, 'KITX1', ajuste).map((x) => [x.codigo, x]))
    expect(l['900001']).toMatchObject({ situacao: 'diminuiu', retirada: 1.22, fica: 1.23, aMais: 0 })
    expect(l['900002']).toMatchObject({ situacao: 'a-mais', retirada: 0, fica: 4, aMais: 4 })
    expect(l['900003']).toMatchObject({ situacao: 'nao-usado', usado: 0, retirada: 1, fica: 0 })
    expect(l['900005']).toMatchObject({ situacao: 'igual', retirada: 0, fica: 1 })
    expect(l['900004']).toMatchObject({ situacao: 'novo', noKit: 0, retirada: 0, fica: 0, aMais: 1, descricao: 'ELO TESTE B' })
    expect(linhasDoKit(BASE, 'KITX1', ajuste).map((x) => x.codigo)).toEqual(['900001', '900002', '900003', '900005', '900004'])
  })

  it('item com 0 no kit e usado 0 é igual, não "não usado"', () => {
    const base: BaseEnel = { ...BASE, kits: { KITZ: [['900001', 0], ['900002', 2]] } }
    const l = Object.fromEntries(linhasDoKit(base, 'KITZ', undefined).map((x) => [x.codigo, x]))
    expect(l['900001']).toMatchObject({ situacao: 'igual', noKit: 0, usado: 0, retirada: 0, aMais: 0 })
    // usado a mais num item de kit 0 continua "a mais"
    const comAjuste = linhasDoKit(base, 'KITZ', { qtd: { '900001': 3 }, novos: [] }).find((x) => x.codigo === '900001')
    expect(comAjuste).toMatchObject({ situacao: 'a-mais', aMais: 3 })
  })

  it('sem ajuste é tudo igual', () => {
    expect(linhasDoKit(BASE, 'KITX1', undefined).every((l) => l.situacao === 'igual')).toBe(true)
  })

  it('usar 0 é não usado e novo em 0 some', () => {
    expect(limpar({ qtd: { '900002': 0 }, novos: [{ codigo: '900004', qtd: 0 }] }, kit)).toEqual({ qtd: { '900002': 0 }, novos: [] })
    expect(limpar({ qtd: { '900001': 2.45 }, novos: [] }, kit)).toBeUndefined()
  })

  it('adicionar código do kit leva à linha do kit', () => {
    expect(adicionarNovo(undefined, kit, BASE, { codigo: '900002', qtd: 1 })).toEqual({ ajuste: undefined, noKit: true })
  })

  it('adicionar de novo soma', () => {
    const a = adicionarNovo(undefined, kit, BASE, { codigo: '900004', qtd: 1 })
    const b = adicionarNovo(a.ajuste, kit, BASE, { codigo: '900004', qtd: 1 })
    expect(b.ajuste?.novos).toEqual([{ codigo: '900004', qtd: 2 }])
    expect(b.noKit).toBe(false)
  })

  it('digitado à mão que existe no catálogo entra como do catálogo', () => {
    const r = adicionarNovo(undefined, kit, BASE, { codigo: '900004', qtd: 1, foraDoCatalogo: { descricao: 'X', unidade: 'UN' } })
    expect(r.ajuste?.novos).toEqual([{ codigo: '900004', qtd: 1 }])
  })

  it('digitado à mão fora do catálogo', () => {
    const r = adicionarNovo(undefined, kit, BASE, { codigo: '999999', qtd: 1, foraDoCatalogo: { descricao: 'MATERIAL DE TESTE', unidade: 'KG' } })
    const nova = linhasDoKit(BASE, 'KITX1', r.ajuste).find((l) => l.codigo === '999999')
    expect(nova).toMatchObject({ situacao: 'novo', foraDoCatalogo: true, descricao: 'MATERIAL DE TESTE', unidade: 'KG', aMais: 1 })
  })

  it('sugestão ignora código que saiu da base', () => {
    const r = aplicarSugestao({
      qtd: { '900001': 1, '800000': 0 },
      novos: [{ codigo: '800001', qtd: 1 }, { codigo: '999999', qtd: 1, foraDoCatalogo: { descricao: 'M', unidade: 'UN' } }],
    }, BASE, 'KITX1')
    expect(r.ignorados).toEqual(['800000', '800001'])
    expect(r.ajuste).toEqual({ qtd: { '900001': 1 }, novos: [{ codigo: '999999', qtd: 1, foraDoCatalogo: { descricao: 'M', unidade: 'UN' } }] })
  })

  it('limpar descarta novo cujo código é do kit', () => {
    expect(limpar({ qtd: {}, novos: [{ codigo: '900002', qtd: 1 }] }, kit)).toBeUndefined()
  })

  it('sugestão com novo que agora é do kit vai para ignorados', () => {
    const r = aplicarSugestao({ qtd: {}, novos: [{ codigo: '900002', qtd: 1 }] }, BASE, 'KITX1')
    expect(r).toEqual({ ajuste: undefined, ignorados: ['900002'] })
  })

  it('mesma obra pela OT', () => {
    expect(mesmaObra('8000001_ASBUILT a.dxf', '8000001_ASBUILT b.dxf')).toBe(true)
    expect(mesmaObra('8000001_a.dxf', '8000002_a.dxf')).toBe(false)
    expect(mesmaObra('obra.dxf', 'obra.dxf')).toBe(true)
    expect(mesmaObra('obra.dxf', 'outra.dxf')).toBe(false)
    expect(mesmaObra('', 'obra.dxf')).toBe(false)
  })

  it('trocar o DXF descarta estrutura que sumiu', () => {
    const a: Ajuste = { qtd: { '900001': 1 }, novos: [] }
    const r = ajustesValidos({ KITX1: a, SUMIU: a }, [{ codigo: 'KITX1_S', descricao: '', quantidade: 1, origem: [] }])
    expect(Object.keys(r)).toEqual(['KITX1'])
  })
})

describe('sugestão do último ajuste', () => {
  it('ao baixar, grava os ajustados e apaga os que voltaram ao kit', () => {
    const a: Ajuste = { qtd: { '900001': 1 }, novos: [] }
    expect(sugestoesAoBaixar({ KITX1: a }, new Set(['KITX1', 'KITX2']), new Date('2026-11-05T12:00:00Z'))).toEqual({
      gravar: [{ estrutura: 'KITX1', ajuste: a, data: '2026-11-05T12:00:00.000Z' }],
      apagar: ['KITX2'],
    })
  })
})

describe('material a mais somado na Adição de material', () => {
  const lin = (codigo: string, quantidade: number, descricao = ''): Linha => ({ codigo, descricao, quantidade, origem: ['P1'] })
  const r = {
    adicaoEstrutura: [lin('KITX1_S', 2)],
    adicaoMaterial: [lin('900002', 4, 'CONECTOR TESTE')],
  } as unknown as ResultadoCeara

  it('4 do CAD + a mais vira uma linha só', () => {
    const { adicaoMaterial, somados } = somarNaAdicao(r, BASE, { KITX1: { qtd: { '900002': 6 }, novos: [] } })
    expect(adicaoMaterial).toHaveLength(1)
    expect(adicaoMaterial[0]).toMatchObject({ codigo: '900002', quantidade: 8 })
    expect(adicaoMaterial[0].origem).toContain('estratificação')
    expect(somados).toEqual([{
      codigo: '900002', descricao: 'CONECTOR TESTE', unidade: 'UN', doCad: 4, daEstratificacao: 4, total: 8,
      estruturas: 'KITX1_S (2)', foraDoCatalogo: false,
    }])
  })

  it('código novo entra no fim', () => {
    const { adicaoMaterial, somados } = somarNaAdicao(r, BASE, { KITX1: { qtd: {}, novos: [{ codigo: '900004', qtd: 1 }] } })
    expect(adicaoMaterial.map((l) => l.codigo)).toEqual(['900002', '900004'])
    expect(adicaoMaterial[1]).toMatchObject({ quantidade: 2, descricao: 'ELO TESTE B' })
    expect(somados).toMatchObject([{ codigo: '900004', doCad: 0, daEstratificacao: 2, total: 2 }])
  })

  it('fora do catálogo sai vermelho', () => {
    const novo = { codigo: '999999', qtd: 1, foraDoCatalogo: { descricao: 'PEÇA TESTE', unidade: 'UN' as const } }
    const { adicaoMaterial, somados } = somarNaAdicao(r, BASE, { KITX1: { qtd: {}, novos: [novo] } })
    expect(adicaoMaterial[1]).toMatchObject({ codigo: '999999', foraDaBase: true, quantidade: 2 })
    expect(somados[0]).toMatchObject({ codigo: '999999', foraDoCatalogo: true })
  })

  it('diminuir e tirar não vão para a Adição de material', () => {
    const { adicaoMaterial, somados } = somarNaAdicao(r, BASE, { KITX1: { qtd: { '900001': 1.23, '900003': 0 }, novos: [] } })
    expect(adicaoMaterial).toEqual(r.adicaoMaterial)
    expect(somados).toEqual([])
  })
})
