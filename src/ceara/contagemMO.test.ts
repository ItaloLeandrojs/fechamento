import { describe, expect, it } from 'vitest'
import { contarObra } from './contagem'
import { contarDesenhoMO, desdobrar, facesBT, type DesenhoMO, type RespostasDesenho } from './contagemMO'
import { dxfDe, mtextEm } from './teste-dxf'
import type { Papel } from './maoDeObra'
import type { TextoDxf } from './dxf'

const vazia = (): RespostasDesenho => ({ tensionar: {}, fases: {}, linhaViva: {} })
const regras = { regrasCabo: [], tensionar: [] }
const contar = (textos: (string | TextoDxf)[], resp: RespostasDesenho = vazia()) => contarDesenhoMO(contarObra(dxfDe(textos)), regras, resp)
/** Soma das quantidades por papel (só os papéis que apareceram). */
const porPapel = (d: DesenhoMO) => {
  const out: Partial<Record<Papel, number>> = {}
  for (const c of d.contagens) if (c.papel) out[c.papel] = (out[c.papel] ?? 0) + c.quantidade
  return out
}
const vivo = (bruto: string) => [mtextEm('LINHA VIVA', 100, 506), mtextEm(bruto, 100, 500)]

describe('mão de obra dos postes', () => {
  it('poste novo de MT leva a primeira cruzeta', () => {
    const d = contar(['(1)600/12 MB1\\P(1)MB3.1\\P1'])
    expect(porPapel(d)).toEqual({ 'poste-mt': 1, 'cruzeta-nu': 1 })
    expect(d.contagens.every((c) => c.aba === 'adicao' && c.origem === 'P1')).toBe(true)
  })

  it('poste novo só de BT', () => {
    const d = contar(['(1)300/9 S2N S2C\\P1'])
    expect(porPapel(d)).toEqual({ 'poste-bt': 1 })
    expect(d.semRegra).toEqual([])
  })

  it('cruzeta em poste existente', () => {
    expect(porPapel(contar(['600/12 N1\\P(1)MB3.1\\P2']))).toEqual({ 'cruzeta-nu': 1 })
  })

  it('troca de poste com estrutura transferida', () => {
    // o N1 sem prefixo passa para o poste novo e é a primeira cruzeta: a MB3.1 é a de mais
    const d = contar(['(3)600/12 (1)600/12\\PN1\\P(1)MB3.1\\P3'])
    expect(porPapel(d)).toEqual({ 'poste-mt': 1, 'retirada-poste-mt': 1, 'cruzeta-nu': 1 })
    expect(d.contagens.find((c) => c.papel === 'retirada-poste-mt')!.aba).toBe('devolucao')
  })

  it('troca de poste de BT por poste de MT: o velho é retirada de BT', () => {
    // a MB4 (1) é do poste novo; o velho só tinha a S2N
    expect(porPapel(contar(['(3)150/8 S2N\\P(1)600/12 MB4\\P(1)S2B\\P12']))).toEqual({ 'poste-mt': 1, 'retirada-poste-bt': 1 })
    // e o contrário: poste de MT trocado por poste só de BT
    expect(porPapel(contar(['(3)600/12 (3)M1 (1)300/9 (1)S2N\\P12']))).toEqual({ 'poste-bt': 1, 'retirada-poste-mt': 1 })
  })

  it('troca de cruzeta pelo tipo que sai', () => {
    const d = contar(['600/12\\P(3)M1\\P(1)M4\\P4'])
    expect(porPapel(d)).toEqual({ 'retirada-cruzeta-passante': 1, 'cruzeta-nu': 1 })
    expect(d.contagens.find((c) => c.papel === 'retirada-cruzeta-passante')!.aba).toBe('devolucao')
    expect(porPapel(contar(['600/12\\P(3)M3.1\\P(1)M4\\P4']))).toEqual({ 'retirada-cruzeta-encabecamento': 1, 'cruzeta-nu': 1 })
  })

  it('dupla, U e D contam 1; compacta é isolada', () => {
    expect(porPapel(contar(['600/12\\P(1)MB4 (1)U3 (1)D1 (1)M1CSR\\P5']))).toEqual({ 'cruzeta-nu': 3, 'cruzeta-isolado': 1 })
    expect(porPapel(contar(['600/12\\P(1)N3CCN50\\P5']))).toEqual({ 'cruzeta-isolado': 1 })
  })

  it('monofásica (MM, NM, BM) é estrutura de MT', () => {
    expect(porPapel(contar(['600/12\\P(1)NM3\\P5']))).toEqual({ 'cruzeta-nu': 1 })
    expect(porPapel(contar(['600/12\\P(3)MM1\\P5']))).toEqual({ 'retirada-cruzeta-passante': 1 })
    expect(porPapel(contar(['(1)600/12 BM1\\P5']))).toEqual({ 'poste-mt': 1 })
  })

  it('trafo não conta como cruzeta', () => {
    const d = contar(['(1)600/12 MB3\\P(1)TR15 (1)TT15KVA\\P6'])
    expect(porPapel(d)).toEqual({ 'poste-mt': 1, trafo: 1, 'estrutura-trafo': 1 })
    expect(d.semRegra).toEqual([])
    // trafo retirado: as duas retiradas
    expect(porPapel(contar(['600/12 MB3\\P(3)TR15 (3)TT15KVA\\P6']))).toEqual({ 'retirada-trafo': 1, 'retirada-estrutura-trafo': 1 })
  })

  it('item (2) é retirada e instalação', () => {
    expect(porPapel(contar(['600/12\\P(2)M1\\P7']))).toEqual({ 'retirada-cruzeta-passante': 1, 'cruzeta-nu': 1 })
    expect(porPapel(contar(['(2)600/12 M1\\P8']))).toEqual({ 'retirada-poste-mt': 1, 'poste-mt': 1 })
    expect(porPapel(contar(['600/12 M3\\P(2)TT15KVA\\P8']))).toEqual({ trafo: 1, 'estrutura-trafo': 1, 'retirada-trafo': 1, 'retirada-estrutura-trafo': 1 })
  })

  it('o (2) desdobrado fica à mão para as outras regras', () => {
    const e = contarObra(dxfDe(['600/12 S1B\\P(2)2xM1\\P7'])).etiquetas[0]
    expect(desdobrar(e).map((i) => [i.situacao, i.texto, i.quantidade])).toEqual([
      [null, '600/12', 1],
      [null, 'S1B', 1],
      [3, '2xM1', 2],
      [1, '2xM1', 2],
    ])
  })

  it('faces da BT', () => {
    expect(facesBT([{ codigo: 'S1B', quantidade: 2 }])).toBe(1)
    expect(facesBT([{ codigo: 'S1B', quantidade: 2 }, { codigo: 'S1C', quantidade: 2 }])).toBe(2)
    expect(facesBT([{ codigo: 'S1B', quantidade: 4 }, { codigo: 'S1C', quantidade: 2 }])).toBe(3)
    expect(facesBT([{ codigo: 'S1N', quantidade: 1 }, { codigo: 'S3', quantidade: 1 }])).toBe(2)
    expect(facesBT([])).toBe(0)
    const d = contar(['300/9\\P(1)2xS1B (1)2xS1C\\P9'])
    expect(porPapel(d)).toEqual({ 'armacao-bt': 2 })
    expect(d.contagens[0]).toMatchObject({ aba: 'adicao', confira: true })
  })

  it('armação: retirada e instalação cada uma com a sua conta; alça e laço fora; poste novo não cobra', () => {
    const d = contar(['300/9\\P(3)2xS1B (1)S2N (1)S2C (1)SPALÇA50 (1)SPLAÇO50\\P9'])
    expect(porPapel(d)).toEqual({ 'retirada-armacao-bt': 1, 'armacao-bt': 2 })
    expect(d.contagens.find((c) => c.papel === 'retirada-armacao-bt')).toMatchObject({ aba: 'devolucao', confira: true })
    expect(d.semRegra).toEqual([])
    // poste retirado leva a BT de dentro; poste novo leva a BT nova
    expect(porPapel(contar(['(3)300/9 (3)S1B (1)300/9 (1)S1B\\P9']))).toEqual({ 'retirada-poste-bt': 1, 'poste-bt': 1 })
  })

  it('linha viva troca as vozes', () => {
    const d = contar(vivo('(1)600/12 M1\\P(1)M3\\P10'))
    expect(porPapel(d)).toEqual({ 'poste-mt': 1, 'lv-instalacao-encabecamento': 1 })
    expect(d.linhaViva).toEqual([{ poste: 'P10', doDesenho: true, vale: true }])
    expect(porPapel(contar(vivo('600/12\\P(3)M1\\P11')))).toEqual({ 'lv-retirada-passante': 1 })
    expect(porPapel(contar(vivo('(3)600/12 M3\\P12')))).toEqual({ 'retirada-poste-lv-encabecamento': 1 })
    expect(porPapel(contar(vivo('(3)600/12 M1\\P12')))).toEqual({ 'retirada-poste-lv-passante': 1 })
    // desligada à mão
    const desligada = contar(vivo('(1)600/12 M1\\P(1)M3\\P10'), { ...vazia(), linhaViva: { P10: false } })
    expect(porPapel(desligada)).toEqual({ 'poste-mt': 1, 'cruzeta-nu': 1 })
    expect(desligada.linhaViva).toEqual([{ poste: 'P10', doDesenho: true, vale: false }])
  })

  it('linha viva ligada à mão num poste sem o texto', () => {
    const d = contar(['600/12\\P(1)M1\\P11'], { ...vazia(), linhaViva: { P11: true } })
    expect(porPapel(d)).toEqual({ 'lv-instalacao-passante': 1 })
    expect(d.linhaViva).toEqual([{ poste: 'P11', doDesenho: false, vale: true }])
    expect(contar(['600/12\\P(1)M1\\P11']).linhaViva).toEqual([])
  })

  it('caixa, conector, cava', () => {
    const d = contar(['300/9\\P(1)SPCXDT-P12PB (1)2xCONEC50-150 (1)CAVA KLC\\P13'])
    expect(porPapel(d)).toEqual({ caixa: 1, 'conector-4-saidas': 2, 'cava-rocha': 1 })
    expect(d.semRegra).toEqual([])
  })

  it('sem regra vai para a nota', () => {
    expect(contar(['600/12\\P(1)CF (1)PR\\P14']).semRegra).toEqual([
      { poste: 'P14', texto: '(1)CF' },
      { poste: 'P14', texto: '(1)PR' },
    ])
    // com trafo novo, a chave, o elo e o aterramento são do trafo; TR, SPTR e o não reconhecido não entram
    const comTrafo = contar(['600/12 M3\\P(1)TR15 (1)TT15KVA (1)SPTR15P\\P(1)3xCF 3xELO1H (1)ATER-SP (1)PR (1)XYZ9\\P14'])
    expect(comTrafo.semRegra).toEqual([{ poste: 'P14', texto: '(1)PR' }])
    // existente não entra; (3) sem regra entra
    expect(contar(['600/12 CF\\P(3)CF\\P14']).semRegra).toEqual([{ poste: 'P14', texto: '(3)CF' }])
  })

  it('multiplicador', () => {
    expect(porPapel(contar(['600/12\\P(1)2xM1\\P15']))).toEqual({ 'cruzeta-nu': 2 })
    // no poste novo, a primeira unidade fica na voz do poste
    expect(porPapel(contar(['(1)600/12 2xM1\\P15']))).toEqual({ 'poste-mt': 1, 'cruzeta-nu': 1 })
  })

  it('contagens iguais somam; etiqueta sem número', () => {
    const d = contar(['600/12\\P(1)M1 (1)N1\\P16', '600/12 (1)M1'])
    expect(d.contagens).toEqual([
      { aba: 'adicao', papel: 'cruzeta-nu', quantidade: 2, origem: 'P16' },
      { aba: 'adicao', papel: 'cruzeta-nu', quantidade: 1, origem: 'sem nº' },
    ])
    expect(d).toMatchObject({ perguntas: [], chavesPerguntas: [], naoCobrado: [] })
  })
})
