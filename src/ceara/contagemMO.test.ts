import { describe, expect, it } from 'vitest'
import { contarObra } from './contagem'
import { contarDesenhoMO, desdobrar, facesBT, type DesenhoMO, type RespostasDesenho } from './contagemMO'
import { cota, dxfDe, mtextEm } from './teste-dxf'
import type { BaseMaoDeObra, Papel } from './maoDeObra'
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
    expect(porPapel(contar(['600/12\\P(1)NM3.1CCN25\\P5']))).toEqual({ 'cruzeta-isolado': 1 })
  })

  it('kit de MT que não é cruzeta (banco de trafo, regulador, afastamento) não conta', () => {
    expect(porPapel(contar(['600/12\\P(1)B2TRAFO225AL (1)B2REG100CCN25 (1)B2AFTCAA4-266\\P5']))).toEqual({})
    // não faz o poste ser de MT
    expect(porPapel(contar(['(1)300/9 S2N\\P(1)B2REG100CCN25\\P5']))).toEqual({ 'poste-bt': 1 })
    // e, sem prefixo, não segura a primeira cruzeta do poste novo
    expect(porPapel(contar(['(1)600/12\\PB2TRAFO225AL\\P(1)M1\\P5']))).toEqual({ 'poste-mt': 1 })
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
    // poste novo com linha viva (Italo, 09/11): tipo 3 ou 4 no poste = encabeçamento; só 1 e 2 = passante.
    // A primeira cruzeta vai na voz do poste e as outras continuam cobrando a cruzeta de linha viva
    const d = contar(vivo('(1)600/12 M1\\P(1)M3\\P10'))
    expect(porPapel(d)).toEqual({ 'poste-lv-encabecamento': 1, 'lv-instalacao-encabecamento': 1 })
    expect(porPapel(contar(vivo('(1)600/12 M1\\P(1)M2\\P10')))).toEqual({ 'poste-lv-passante': 1, 'lv-instalacao-passante': 1 })
    // troca de poste com linha viva, como o P02 do asbuilt 59718008
    expect(porPapel(contar(vivo('(3)150/10,5 (3)N1\\P(1)600/12 M1\\P(1)MB3.1\\P2')))).toEqual({
      'poste-lv-encabecamento': 1, 'retirada-poste-lv-passante': 1, 'lv-instalacao-encabecamento': 1,
    })
    // poste novo de BT com linha viva: continua o poste de BT
    expect(porPapel(contar(vivo('(1)300/9 S2N\\P13')))).toEqual({ 'poste-bt': 1 })
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

type Regras = Pick<BaseMaoDeObra, 'regrasCabo' | 'tensionar'>
const regrasTeste: Regras = {
  regrasCabo: [
    { grupo: 'bt-multi', situacao: 'novo', voz: 'XX243', por: 'metro' },
    { grupo: 'mt', situacao: 'novo', voz: 'XX201', por: 'metro', bitolas: ['004'] },
    { grupo: 'mt', situacao: 'retirado', voz: 'XX208', por: 'condutor' },
    { grupo: 'bt-nu', situacao: 'retirado', voz: 'XX211', por: 'condutor' },
  ],
  tensionar: [
    { rede: 'mt', exige: ['^(M|MB|N|NB|B|BB|U|UB)3'], qtd: 1 },
    { rede: 'mt', exige: ['^(M|MB|N|NB|B|BB|U|UB)4'], qtd: 2 },
    { rede: 'bt', exige: ['^S2N$', '^S2C$'], qtd: 2 },
    { rede: 'bt', exige: ['^S[234][A-Z]?$'], qtd: 1 },
    { rede: 'bt', exige: ['^SPALÇA'], qtd: 1 },
  ],
}
const contarMO = (textos: (string | TextoDxf)[], cotas: ReturnType<typeof cota>[] = [], resp: RespostasDesenho = vazia(), rg: Regras = regrasTeste) =>
  contarDesenhoMO(contarObra(dxfDe(textos, cotas)), rg, resp)
/** Contagens de cabo (com voz), sem as que faltam responder. */
const porVoz = (d: DesenhoMO) =>
  d.contagens.filter((c) => c.voz && !c.falta).map(({ aba, voz, quantidade, origem, confira }) => ({ aba, voz, quantidade, origem, ...(confira ? { confira } : {}) }))
const tensionar = (d: DesenhoMO) => porPapel(d).tensionar ?? 0
const mtExistente = cota('P3AN004<>', 50)
const mtNovo = cota('(1)P3AN004<>', 50)

describe('mão de obra do cabo', () => {
  it('cabo por metro de rede', () => {
    expect(porVoz(contarMO([], [cota('(1)P3AN004<>', 100)]))).toEqual([{ aba: 'adicao', voz: 'XX201', quantidade: 100, origem: 'vãos de MT' }])
    // pré-reunido novo, também por metro
    expect(porVoz(contarMO([], [cota('(1)AM035T<>', 40)]))).toEqual([{ aba: 'adicao', voz: 'XX243', quantidade: 40, origem: 'vãos de BT' }])
  })

  it('retirada por condutor', () => {
    expect(porVoz(contarMO([], [cota('(3)P3AN004<>', 100)]))).toEqual([{ aba: 'devolucao', voz: 'XX208', quantidade: 300, origem: 'vãos de MT' }])
    expect(porVoz(contarMO(['\\A1;(3)2AN00438']))).toEqual([{ aba: 'devolucao', voz: 'XX211', quantidade: 76, origem: 'vãos de BT' }])
    // pré-reunido retirado conta 1 condutor
    const comMulti: Regras = { ...regrasTeste, regrasCabo: [...regrasTeste.regrasCabo, { grupo: 'bt-multi', situacao: 'retirado', voz: 'XX211', por: 'condutor' }] }
    expect(porVoz(contarMO(['\\A1;(3)AM035T50'], [], vazia(), comMulti))).toEqual([{ aba: 'devolucao', voz: 'XX211', quantidade: 50, origem: 'vãos de BT' }])
    // BT nu sem o número de condutores: 1 e confira
    expect(porVoz(contarMO(['\\A1;(3)AN00438']))).toEqual([{ aba: 'devolucao', voz: 'XX211', quantidade: 38, origem: 'vãos de BT', confira: true }])
  })

  it('vãos somam por situação e nome; existente e (2) não cobram cabo', () => {
    const d = contarMO(
      [],
      [cota('(1)P3AN004<>', 50), cota('(1)P3AN004<>', 30), cota('(3)P3AN004<>', 10), cota('(3)P2AN004<>', 20), cota('P3AN004<>', 99), cota('(2)P3AN004<>', 99)],
    )
    expect(porVoz(d)).toEqual([
      { aba: 'adicao', voz: 'XX201', quantidade: 80, origem: 'vãos de MT' },
      { aba: 'devolucao', voz: 'XX208', quantidade: 70, origem: 'vãos de MT' },
    ])
  })

  it('MT retirado sem fases pergunta', () => {
    const r = { ...contarObra(dxfDe([])), vaos: [{ situacao: 3 as const, cabo: 'PAN004', metros: 100, origem: 'cota' as const }] }
    const d = contarDesenhoMO(r, regrasTeste, vazia())
    expect(d.perguntas).toEqual([{ tipo: 'fases', chave: 'fases|PAN004', cabo: 'PAN004', metros: 100 }])
    expect(d.chavesPerguntas).toEqual(['fases|PAN004'])
    expect(d.contagens).toEqual([{ aba: 'devolucao', voz: 'XX208', quantidade: 0, origem: 'vãos de MT', falta: 'falta o número de fases' }])
    const respondida = contarDesenhoMO(r, regrasTeste, { ...vazia(), fases: { 'fases|PAN004': 2 } })
    expect(respondida.perguntas).toEqual([])
    expect(respondida.chavesPerguntas).toEqual(['fases|PAN004'])
    expect(respondida.contagens).toEqual([{ aba: 'devolucao', voz: 'XX208', quantidade: 200, origem: 'vãos de MT' }])
    // a instalação é por metro de rede: não pergunta
    const novo = contarDesenhoMO({ ...r, vaos: [{ ...r.vaos[0], situacao: 1 }] }, regrasTeste, vazia())
    expect(novo).toMatchObject({ perguntas: [], chavesPerguntas: [] })
    expect(porVoz(novo)).toEqual([{ aba: 'adicao', voz: 'XX201', quantidade: 100, origem: 'vãos de MT' }])
  })

  it('cabo sem regra vai para a nota', () => {
    // bitola sem regra e cabo de outro grupo
    const d = contarMO(['\\A1;(1)CN03550'], [cota('(1)P3AN266<>', 100)])
    expect(porVoz(d)).toEqual([])
    expect(d.semRegra).toEqual([
      { poste: 'vãos', texto: '(1)P3AN266' },
      { poste: 'vãos', texto: '(1)CN035' },
    ])
  })
})

describe('tensionar: só aviso para conferir (Italo, 09/11)', () => {
  it('não cobra nem pergunta: aponta o poste com estrutura nova que ancora', () => {
    for (const cotas of [[mtExistente], [mtNovo], [mtExistente, mtNovo]]) {
      const d = contarMO(['600/12\\P(1)M3\\P1'], cotas)
      expect(tensionar(d)).toBe(0)
      expect(d).toMatchObject({ perguntas: [], chavesPerguntas: [], naoCobrado: [] })
      expect(d.tensionarConfira).toEqual([{ poste: 'P1', estruturas: ['M3'] }])
    }
  })

  it('passante, existente e retirada não entram; o (2) entra', () => {
    expect(contarMO(['600/12\\P(1)M1\\P1']).tensionarConfira).toEqual([])
    expect(contarMO(['600/12 M3\\P(3)M4\\P1']).tensionarConfira).toEqual([])
    expect(contarMO(['600/12\\P(2)M3\\P1']).tensionarConfira).toEqual([{ poste: 'P1', estruturas: ['M3'] }])
  })

  it('BT: ancoragem e alça entram; o par S2N + S2C só junto; MT e BT no mesmo poste', () => {
    expect(contarMO(['300/9\\P(1)2xS2B (1)SPALÇA50\\P3']).tensionarConfira).toEqual([{ poste: 'P3', estruturas: ['S2B', 'SPALÇA50'] }])
    expect(contarMO(['300/9\\P(1)S1B\\P3']).tensionarConfira).toEqual([])
    expect(contarMO(['600/12\\P(1)M3 (1)S2B\\P3']).tensionarConfira).toEqual([{ poste: 'P3', estruturas: ['M3', 'S2B'] }])
  })

  it('linha viva: o tensionar vai na voz da cruzeta, sem aviso de conferir', () => {
    const d = contarMO(vivo('600/12\\P(1)M3\\P10'))
    expect(d.tensionarConfira).toEqual([])
    expect(d.naoCobrado).toEqual(['P10: linha viva, o tensionar vai na voz da cruzeta'])
    expect(contarMO(vivo('600/12\\P(1)M3\\P10'), [], { ...vazia(), linhaViva: { P10: false } }).tensionarConfira).toEqual([{ poste: 'P10', estruturas: ['M3'] }])
  })
})

describe('poste de MT ou BT pela rede que passa (09/11)', () => {
  it('poste novo só com material de MT solto (sem cruzeta) é de MT', () => {
    const d = contar(['(1)600/12\\P(1)4xALÇA.CAA4\\P(1)4xISOL.ANC.POL\\P(1)4xMANILHA\\P3'])
    expect(porPapel(d)).toEqual({ 'poste-mt': 1 })
    expect(d.semRegra).toEqual([])
  })

  it('isolador de pino polimérico também marca a MT', () => {
    expect(porPapel(contar(['(1)600/12\\P(1)2xISOL.PIN.POL\\P8']))).toEqual({ 'poste-mt': 1 })
  })

  it('MT e BT no mesmo poste: é de MT; só BT: é de BT', () => {
    expect(porPapel(contar(['(1)600/12\\P(1)2xISOL.PIN.POL (1)S2B\\P4']))).toEqual({ 'poste-mt': 1 })
    expect(porPapel(contar(['(1)300/9 S2N\\P5']))).toEqual({ 'poste-bt': 1 })
  })

  it('poste sem nada que diga a rede: pergunta, e a resposta decide', () => {
    const d = contar(['(1)600/12\\P6'])
    expect(d.perguntas).toEqual([{ tipo: 'poste', chave: 'poste|P6|1', poste: 'P6', texto: 'A rede de MT passa no poste novo do P6?' }])
    expect(d.contagens).toEqual([{ aba: 'adicao', papel: 'poste-mt', quantidade: 1, origem: 'P6', falta: 'responda se a MT passa no poste' }])
    expect(porPapel(contar(['(1)600/12\\P6'], { ...vazia(), posteMT: { 'poste|P6|1': true } }))).toEqual({ 'poste-mt': 1 })
    const bt = contar(['(1)600/12\\P6'], { ...vazia(), posteMT: { 'poste|P6|1': false } })
    expect(porPapel(bt)).toEqual({ 'poste-bt': 1 })
    expect(bt.perguntas).toEqual([])
    expect(bt.chavesPerguntas).toEqual(['poste|P6|1'])
  })

  it('poste retirado sem nada que diga a rede também pergunta', () => {
    const d = contar(['(3)600/12 (1)600/12\\PN1\\P7'])
    expect(d.perguntas).toEqual([])
    const so = contar(['(3)150/10,5\\P7'])
    expect(so.perguntas.map((p) => p.chave)).toEqual(['poste|P7|3'])
  })

  it('CONEC.4VIAS conta como conector de 4 saídas; CAVA EM ROCHA como cava na rocha', () => {
    const d = contar(['600/12\\P(1)4xCONEC.4VIAS (1)CAVA EM ROCHA\\P9'])
    expect(porPapel(d)).toEqual({ 'conector-4-saidas': 4, 'cava-rocha': 1 })
    expect(d.semRegra).toEqual([])
  })
})
