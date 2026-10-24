import type { Estado } from './state'

export type Secao = 'estruturas' | 'materiais' | 'servicos' | 'aterramento' | 'equipamentos' | 'dp' | 'carimbo' | 'revisao'

export type EstadoEtapa = 'vazio' | 'feito' | 'pendente'

export interface Etapa {
  id: Secao
  rotulo: string
  grupo: 'Lançamentos' | 'Fichas' | 'Fechar'
  estado: EstadoEtapa
  /** quantidade lançada (some quando é zero) */
  n?: number
  /** só na revisão: quantas pendências ainda existem (marcador neutro, sem alarme) */
  restam?: number
}

/**
 * Monta a lista de etapas (o Inventário fica no cabeçalho, não é etapa) com o
 * estado de cada uma: vazio (nada lançado), feito ou pendente (falta algo).
 * As pendências vêm do App, como frases; aqui só se descobre a qual etapa pertencem.
 */
export function montarEtapas(e: Estado, pendencias: string[]): Etapa[] {
  const tem = (re: RegExp) => pendencias.some((p) => re.test(p))
  const pendAterr = tem(/^(Aterramento|A ficha de aterramento)/)
  const pendEquip = tem(/^Equipamento/)
  const pendDP = tem(/^Desligamento/)
  const pendTec = tem(/^Escolha o técnico/)

  const lancado = (n: number): EstadoEtapa => (n > 0 ? 'feito' : 'vazio')
  const nEstr = e.estruturas.reduce((s, x) => s + x.qtd, 0)
  const nMat = e.itens.filter((i) => i.tipo === 'material').length
  const nSrv = e.itens.filter((i) => i.tipo === 'servico').length
  const por = (n: number) => (n > 0 ? n : undefined)

  return [
    { id: 'estruturas', rotulo: 'Estruturas', grupo: 'Lançamentos', estado: lancado(nEstr), n: por(nEstr) },
    { id: 'materiais', rotulo: 'Materiais', grupo: 'Lançamentos', estado: lancado(nMat), n: por(nMat) },
    { id: 'servicos', rotulo: 'Mão de obra', grupo: 'Lançamentos', estado: lancado(nSrv), n: por(nSrv) },
    { id: 'aterramento', rotulo: 'Aterramento', grupo: 'Fichas', estado: pendAterr ? 'pendente' : lancado(e.aterramento.length), n: por(e.aterramento.length) },
    { id: 'equipamentos', rotulo: 'Equipamento', grupo: 'Fichas', estado: pendEquip ? 'pendente' : lancado(e.equipamentos.length), n: por(e.equipamentos.length) },
    { id: 'dp', rotulo: 'Desligamento', grupo: 'Fichas', estado: pendDP ? 'pendente' : lancado(e.temDP ? 1 : 0), n: e.temDP ? 1 : undefined },
    { id: 'carimbo', rotulo: 'Carimbo', grupo: 'Fechar', estado: pendTec ? 'pendente' : e.tecnico !== null ? 'feito' : 'vazio' },
    // a revisão nunca fica vermelha: o "falta" aparece só na etapa que tem a causa
    { id: 'revisao', rotulo: 'Revisar e baixar', grupo: 'Fechar', estado: 'vazio', restam: por(pendencias.length) },
  ]
}
