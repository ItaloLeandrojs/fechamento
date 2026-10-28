import type { Lancamento } from './core/ads'
import type { TipoBoletim } from './core/boletim'
import type { Operacao } from './core/inventario'
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

/** Código de sucata (material retirado): começa com 9. Não existe kit de sucata. */
export function ehSucata(code: number): boolean {
  return String(code).startsWith('9')
}

/** Material novo (não é sucata nem serviço) lançado numa operação de retirada: vale conferir. */
export function materialNovoEmSucata(code: number, tipoOperacao: Operacao['tipo'] | undefined): boolean {
  return tipoOperacao === 'retirada' && !ehSucata(code) && !ehMaoDeObra(code)
}

/**
 * Ordem da lista de itens conforme a operação escolhida (o que for `primeiro` sobe,
 * sem mudar a ordem entre os demais).
 */
export function primeiroOs<T>(lista: T[], primeiro: (x: T) => boolean): T[] {
  return [...lista.filter(primeiro), ...lista.filter((x) => !primeiro(x))]
}

/**
 * Nome curto da operação, tirado da descrição da EDP desta obra
 * ("POSTE - ODI - ET - 40" → "POSTE"). O número sozinho não diz nada: muda de obra para obra.
 */
export function nomeOperacao(o: Operacao | undefined): string {
  return o?.descricao.split(' - ')[0].trim() ?? ''
}

/** Operações que têm algo lançado, na ordem da obra (e as que não estão na lista, no fim). */
export function operacoesComLancadas(operacoes: Operacao[], lancados: { oper: string }[]): Operacao[] {
  const usadas = new Set(lancados.map((l) => l.oper))
  const fora = [...usadas].filter((o) => !operacoes.some((x) => x.oper === o)).map((oper) => ({ oper, descricao: '', tipo: 'outra' as const }))
  return [...operacoes.filter((o) => usadas.has(o.oper)), ...fora]
}

/** Item medido em quilo (cabo nu, cordoalha): a quantidade é lançada já em kg, sem conversão. */
export function ehQuilo(un: string): boolean {
  return un.trim().toUpperCase() === 'KG'
}

/** Kit de cabo: todos os materiais em kg, então a quantidade do kit é o peso em kg. */
export function kitEmQuilo(k: Kit): boolean {
  return k.itens.length > 0 && k.itens.every((i) => ehQuilo(i.un))
}

/**
 * Mão de obra é todo código que começa com 7 (a aba MaterialServico marca esses
 * como SERVIÇO, com unidade SRV, UN ou PEÇ; a própria ADS da EDP separa o preço
 * de serviço do de material assim). Pela unidade SRV ficavam de fora serviços
 * como o banheiro químico (PEÇ).
 */
export function ehMaoDeObra(code: number): boolean {
  return String(code).startsWith('7')
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
