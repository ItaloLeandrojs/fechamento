import type { Lancamento } from './core/ads'
import type { TipoBoletim } from './core/boletim'
import type { Foto } from './lib/imagem'

/** Atualiza uma lista sempre a partir do valor mais recente (evita perder mudanças simultâneas). */
export type Atualiza<T> = (fn: (atual: T) => T) => void

export interface ItemKit {
  code: number
  desc: string
  qtd: number
  un: string
}

export interface Kit {
  kit: string
  descricao: string
  itens: ItemKit[]
}

/** Operações com o significado combinado com o escritório. */
export const OPERACOES: { oper: string; nome: string; grupo: 'instalacao' | 'retirada' }[] = [
  { oper: '2000', nome: 'Poste existente', grupo: 'instalacao' },
  { oper: '2020', nome: 'Poste novo', grupo: 'instalacao' },
  { oper: '2010', nome: 'Transformador', grupo: 'instalacao' },
  { oper: '2030', nome: 'Retirada de poste', grupo: 'retirada' },
  { oper: '2040', nome: 'Retirada de condutor', grupo: 'retirada' },
]

/** Item medido em quilo (cabo nu, cordoalha): a quantidade é lançada já em kg, sem conversão. */
export function ehQuilo(un: string): boolean {
  return un.trim().toUpperCase() === 'KG'
}

/** Kit de cabo: todos os materiais em kg, então a quantidade do kit é o peso em kg. */
export function kitEmQuilo(k: Kit): boolean {
  return k.itens.length > 0 && k.itens.every((i) => ehQuilo(i.un))
}

export function nomeOper(oper: string): string {
  return OPERACOES.find((o) => o.oper === oper)?.nome ?? oper
}

export interface EstruturaLanc {
  id: string
  kit: string
  oper: string
  qtd: number
  /**
   * Materiais mudados nesta linha: código → quantidade por estrutura.
   * 0 = material tirado da soma (ex.: as alças dos outros condutores da CE3).
   */
  ajuste?: Record<number, number>
}

/** Quantidade de um material do kit em uma estrutura, já com o ajuste da linha. */
export function qtdNoKit(est: EstruturaLanc, it: ItemKit): number {
  return est.ajuste?.[it.code] ?? it.qtd
}

/** A linha tem algum material mudado em relação ao kit da KIT MATERIAL? */
export function temAjuste(est: EstruturaLanc, k: Kit | undefined): boolean {
  return !!k && k.itens.some((i) => qtdNoKit(est, i) !== i.qtd)
}

export interface ItemLanc {
  id: string
  tipo: 'material' | 'servico'
  code: number
  desc: string
  un: string
  oper: string
  qtd: number
}

export interface PontoUI {
  id: string
  rua: string
  ponto: string
  tipoPoste: 'CONC' | 'MAD' | ''
  ohms: string
  hastes: string
  fotoVala?: Foto
  fotoMedicao?: Foto
}

export interface EquipUI {
  id: string
  ponto: string
  instalado: Record<'potencia' | 'patrimonio' | 'fase' | 'serie' | 'marca' | 'ano' | 'nInstalacao', string>
  tensoes: Record<'NA' | 'NB' | 'NC' | 'AB' | 'AC' | 'BC', string>
  retirado: Record<'potencia' | 'patrimonio' | 'serie' | 'marca' | 'ano' | 'nInstalacao', string>
  fotos: Foto[]
}

export interface Estado {
  estruturas: EstruturaLanc[]
  itens: ItemLanc[]
  aterramento: PontoUI[]
  equipamentos: EquipUI[]
  temDP: boolean
  fotoDP?: Foto
  tecnico: number | null
  /** Parcial ou final: obrigatório, perguntado ao abrir o inventário. */
  boletim: TipoBoletim | null
}

export const estadoInicial: Estado = {
  estruturas: [],
  itens: [],
  aterramento: [],
  equipamentos: [],
  temDP: false,
  tecnico: null,
  boletim: null,
}

let seq = 0
export function novoId(): string {
  seq += 1
  return Date.now().toString(36) + seq.toString(36)
}

export function novoPonto(): PontoUI {
  return { id: novoId(), rua: '', ponto: '', tipoPoste: '', ohms: '', hastes: '' }
}

export function novoEquip(): EquipUI {
  return {
    id: novoId(),
    ponto: '',
    instalado: { potencia: '', patrimonio: '', fase: '', serie: '', marca: '', ano: '', nInstalacao: '' },
    tensoes: { NA: '', NB: '', NC: '', AB: '', AC: '', BC: '' },
    retirado: { potencia: '', patrimonio: '', serie: '', marca: '', ano: '', nInstalacao: '' },
    fotos: [],
  }
}

/** Transforma estruturas (kits × quantidade) e itens avulsos em lançamentos por código. */
export function montarLancamentos(e: Estado, kits: Map<string, Kit>): { lancamentos: Lancamento[]; avisos: string[] } {
  const lancamentos: Lancamento[] = []
  const avisos: string[] = []
  for (const est of e.estruturas) {
    const k = kits.get(est.kit)
    if (!k) {
      avisos.push(`A estrutura ${est.kit} não existe na lista de kits.`)
      continue
    }
    if (!k.itens.length) avisos.push(`A estrutura ${est.kit} não tem materiais cadastrados na KIT MATERIAL; lance os materiais avulsos.`)
    for (const it of k.itens) {
      const q = qtdNoKit(est, it)
      if (q > 0) lancamentos.push({ code: it.code, oper: est.oper, qty: q * est.qtd })
    }
  }
  for (const it of e.itens) lancamentos.push({ code: it.code, oper: it.oper, qty: it.qtd })
  return { lancamentos, avisos }
}

export function numero(s: string): number | null {
  // "19,10" e "1.234,5" (jeito brasileiro) ou "19.10"
  const bruto = s.trim()
  const t = bruto.includes(',') ? bruto.replace(/\./g, '').replace(',', '.') : bruto
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
