import { Workbook } from './workbook'
import { aplicarAds, type AdsResultado, type Lancamento } from './ads'
import { aplicarAterramento, aplicarCarimbo, aplicarDP, aplicarEquipamentos, type Equipamento, type PontoAterramento, type Tecnico } from './fichas'
import type { Imagem } from './images'
import { atualizarValoresGuardados } from './cache'
import { lerCatalogo } from './inventario'
import { aplicarTipoBoletim, type TipoBoletim } from './boletim'

export interface DadosFechamento {
  lancamentos: Lancamento[]
  tecnico?: Tecnico
  aterramento: PontoAterramento[]
  equipamentos: Equipamento[]
  fotoDP?: Imagem
  /** Parcial marca as caixas FINAL/PARCIAL da Check-list; final deixa em branco. */
  boletim?: TipoBoletim
  hoje?: Date
}

export interface ResultadoFechamento {
  arquivo: Uint8Array
  ads: AdsResultado
  abasComCarimbo: string[]
}

/** Gera o inventário preenchido a partir do arquivo original da EDP (que não é alterado). */
export async function gerarFechamento(original: ArrayBuffer | Uint8Array, dados: DadosFechamento): Promise<ResultadoFechamento> {
  const wb = await Workbook.open(original)
  const catalogo = new Map((await lerCatalogo(wb)).map((i) => [i.code, { desc: i.desc, un: i.un }]))
  const ads = await aplicarAds(wb, dados.lancamentos, catalogo)
  await aplicarAterramento(wb, dados.aterramento)
  await aplicarEquipamentos(wb, dados.equipamentos)
  await aplicarDP(wb, dados.fotoDP)
  if (dados.boletim) await aplicarTipoBoletim(wb, dados.boletim)
  const abasComCarimbo = dados.tecnico ? await aplicarCarimbo(wb, dados.tecnico, dados.hoje ?? new Date()) : []
  // depois de tudo gravado: o Modo Protegido do Excel mostra o valor guardado, sem recalcular
  await atualizarValoresGuardados(wb)
  await wb.dropCalcChainAndRecalc()
  return { arquivo: await wb.save(), ads, abasComCarimbo }
}
