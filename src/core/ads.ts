import { SheetEditor, shiftFormula, splitRef } from './sheet'
import { child, descendants } from './xml'
import type { Workbook } from './workbook'
import { gravarValorGuardado } from './cache'
import { criarFormatoNumero, criarPintorVermelho } from './estilos'

export const ADS_SHEET = 'ADS'

/** Grupos de operação: dentro do grupo um item pode cair em outra operação prevista. */
export const OPER_GROUPS: string[][] = [
  ['2000', '2010', '2020'], // instalação (ODI); 2000 tem preferência
  ['2030', '2040'], // retirada (ODD)
]

export function groupOf(oper: string): string[] {
  return OPER_GROUPS.find((g) => g.includes(oper)) ?? [oper]
}

export interface AdsRow {
  row: number
  id: number | null
  item: string
  oper: string
  code: number | null
  /** O código veio gravado como texto ("30050165"): sai convertido em número. */
  codigoEmTexto: boolean
  descricao: string
  unidade: string
  planejado: number
  aplicado: number | null
  ordem: string
}

/** Uma quantidade lançada no site (já somada por código e operação). */
export interface Lancamento {
  code: number
  oper: string
  qty: number
}

export interface Destino {
  code: number
  oper: string
  qty: number
  row: number | null // linha da ADS que recebeu; null = linha nova
  operUsada: string // operação da linha que recebeu ('' = linha nova, operação vazia)
  motivo: 'prevista' | 'outra-operacao' | 'nova'
}

// Colunas da ADS (fixas no modelo da EDP)
const COL = { id: 'A', item: 'B', oper: 'C', descOper: 'D', code: 'E', desc: 'F', unid: 'G', plan: 'H', apl: 'I', adic: 'J', dev: 'K', copiaPlan: 'O', ordem: 'P' }

function num(v: unknown): number {
  return typeof v === 'number' ? v : 0
}

function txt(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim()
}

/**
 * Código como número. Alguns inventários trazem o código gravado como texto;
 * sem isto o item previsto não era reconhecido e o lançamento virava uma linha
 * nova duplicada.
 */
function lerCodigo(ed: SheetEditor, ref: string): { code: number | null; emTexto: boolean } {
  if (ed.isError(ref)) return { code: null, emTexto: false }
  const v = ed.value(ref)
  if (typeof v === 'number') return { code: v, emTexto: false }
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return { code: Number(v.trim()), emTexto: true }
  return { code: null, emTexto: false }
}

export function readAds(ed: SheetEditor): AdsRow[] {
  const out: AdsRow[] = []
  for (let r = 2; r <= ed.lastRow; r++) {
    if (!ed.row(r)) continue
    const { code, emTexto } = lerCodigo(ed, COL.code + r)
    const apl = ed.value(COL.apl + r)
    const idV = ed.value(COL.id + r)
    out.push({
      row: r,
      id: typeof idV === 'number' ? idV : null,
      item: txt(ed.value(COL.item + r)),
      oper: ed.isError(COL.oper + r) ? '' : txt(ed.value(COL.oper + r)),
      code,
      codigoEmTexto: emTexto,
      descricao: ed.isError(COL.desc + r) ? '' : txt(ed.value(COL.desc + r)),
      unidade: ed.isError(COL.unid + r) ? '' : txt(ed.value(COL.unid + r)),
      planejado: num(ed.value(COL.plan + r)),
      aplicado: typeof apl === 'number' ? apl : null,
      ordem: txt(ed.value(COL.ordem + r)),
    })
  }
  return out
}

/** Decide em que linha da ADS cada lançamento entra (regras combinadas com o Italo). */
export function decidirDestinos(rows: AdsRow[], lancs: Lancamento[]): Destino[] {
  const byCode = new Map<number, AdsRow[]>()
  for (const r of rows) {
    if (r.code === null) continue
    const list = byCode.get(r.code) ?? []
    list.push(r)
    byCode.set(r.code, list)
  }
  // soma lançamentos repetidos (mesmo código e operação)
  const soma = new Map<string, Lancamento>()
  for (const l of lancs) {
    if (!(l.qty > 0)) continue
    const k = l.code + '|' + l.oper
    const prev = soma.get(k)
    if (prev) prev.qty += l.qty
    else soma.set(k, { ...l })
  }
  const out: Destino[] = []
  for (const l of soma.values()) {
    const cands = byCode.get(l.code) ?? []
    const exata = cands.find((r) => r.oper === l.oper)
    if (exata) {
      out.push({ ...l, row: exata.row, operUsada: exata.oper, motivo: 'prevista' })
      continue
    }
    const grupo = groupOf(l.oper)
    const noGrupo = cands.filter((r) => grupo.includes(r.oper))
    const escolhida = noGrupo.find((r) => r.oper === grupo[0]) ?? noGrupo[0]
    if (escolhida) {
      out.push({ ...l, row: escolhida.row, operUsada: escolhida.oper, motivo: 'outra-operacao' })
      continue
    }
    out.push({ ...l, row: null, operUsada: '', motivo: 'nova' })
  }
  return out
}

/**
 * Troca fórmulas compartilhadas por fórmulas comuns, célula a célula.
 * Assim dá para apagar ou copiar qualquer célula sem quebrar as vizinhas.
 */
export function unshareFormulas(ed: SheetEditor) {
  const masters = new Map<string, { text: string; col: number; row: number }>()
  const fs = descendants(ed.sheetData, 'f')
  for (const f of fs) {
    if (f.getAttribute('t') === 'shared' && f.getAttribute('ref') && f.textContent) {
      const { col, row } = splitRef((f.parentNode as Element).getAttribute('r')!)
      masters.set(f.getAttribute('si')!, { text: f.textContent, col, row })
    }
  }
  for (const f of fs) {
    if (f.getAttribute('t') !== 'shared') continue
    const m = masters.get(f.getAttribute('si')!)
    if (!m) continue
    if (!f.textContent) {
      const { col, row } = splitRef((f.parentNode as Element).getAttribute('r')!)
      f.textContent = shiftFormula(m.text, row - m.row, col - m.col)
    }
    f.removeAttribute('t')
    f.removeAttribute('ref')
    f.removeAttribute('si')
  }
}

/** Estica referências que terminavam na última linha antiga (ex.: B2:N123 → B2:N130). */
export function growRangeEnds(text: string, oldLast: number, newLast: number): string {
  const re = new RegExp(`:(\\$?[A-Z]{1,3})(\\$?)${oldLast}(?!\\d)`, 'g')
  return text.replace(re, (_m, c: string, d: string) => `:${c}${d}${newLast}`)
}

async function growAdsReferences(wb: Workbook, ed: SheetEditor, oldLast: number, newLast: number) {
  const root = ed.root
  const dim = child(root, 'dimension')
  if (dim) dim.setAttribute('ref', growRangeEnds(dim.getAttribute('ref')!, oldLast, newLast))
  for (const tag of ['conditionalFormatting', 'protectedRange', 'dataValidation']) {
    for (const el of descendants(root, tag)) {
      const a = el.getAttribute('sqref')
      if (a) el.setAttribute('sqref', growRangeEnds(a, oldLast, newLast))
    }
  }
  for (const el of descendants(root, 'sortState')) el.setAttribute('ref', growRangeEnds(el.getAttribute('ref')!, oldLast, newLast))
  for (const el of descendants(root, 'sortCondition')) el.setAttribute('ref', growRangeEnds(el.getAttribute('ref')!, oldLast, newLast))

  // nomes definidos (área de impressão) e fórmulas de outras abas que somam a ADS
  const book = await wb.doc('xl/workbook.xml')
  for (const dn of descendants(book, 'definedName')) {
    const t = dn.textContent ?? ''
    if (/^'?ADS'?!/.test(t)) {
      dn.textContent = growRangeEnds(t, oldLast, newLast)
      wb.touch('xl/workbook.xml')
    }
  }
  for (const s of wb.sheets) {
    if (s.name === ADS_SHEET || !(await wb.contains(s.path, 'ADS!'))) continue
    const d = await wb.doc(s.path)
    let mudou = false
    for (const f of descendants(d, 'f')) {
      const t = f.textContent ?? ''
      if (!t.includes('ADS!')) continue
      const novo = t.replace(/ADS!\$?[A-Z]{1,3}\$?\d+:\$?[A-Z]{1,3}\$?\d+/g, (m) => growRangeEnds(m, oldLast, newLast))
      if (novo !== t) {
        f.textContent = novo
        mudou = true
      }
    }
    if (mudou) wb.touch(s.path)
  }
}

export interface AdsResultado {
  destinos: Destino[]
  linhasNovas: number[]
  zeradas: number // linhas com código que ficaram com Aplicado 0
  mudaramDeValor: number // linhas que já tinham Aplicado e mudaram
}

/** Descrição e unidade de cada código (aba MaterialServico). */
export type Catalogo = Map<number, { desc: string; un: string }>

/**
 * Grava o valor guardado da descrição (F) e da unidade (G), que são PROCV na
 * MaterialServico: o Modo Protegido do Excel não recalcula e mostraria vazio.
 */
function guardarDescricao(ed: SheetEditor, r: number, code: number, catalogo: Catalogo) {
  const item = catalogo.get(code)
  for (const [col, campo] of [[COL.desc, 'desc'], [COL.unid, 'un']] as const) {
    const c = ed.cell(col + r)
    const f = c && child(c, 'f')
    if (!c || !f || !(f.textContent ?? '').includes('MaterialServico')) continue
    if (item) gravarValorGuardado(c, f, item[campo], false)
    else gravarValorGuardado(c, f, '#N/A', true)
  }
}

/** Grava o Aplicado (e Adicional/Devolvido) na ADS. */
export async function aplicarAds(wb: Workbook, lancs: Lancamento[], catalogo: Catalogo = new Map()): Promise<AdsResultado> {
  const info = wb.sheet(ADS_SHEET)!
  const ed = new SheetEditor(await wb.doc(info.path), wb.sharedStrings)
  wb.touch(info.path)
  unshareFormulas(ed)

  const rows = readAds(ed)
  const destinos = decidirDestinos(rows, lancs)

  const porLinha = new Map<number, number>()
  for (const d of destinos) if (d.row !== null) porLinha.set(d.row, (porLinha.get(d.row) ?? 0) + d.qty)

  // coluna do código no formato "Número" (no modelo da EDP ela vem como "Geral")
  const formatoNumero = await criarFormatoNumero(wb)

  let zeradas = 0
  let mudaram = 0
  const escreverQuantidades = (r: number, plan: number, apl: number) => {
    ed.setNumber(COL.apl + r, apl)
    const dif = Math.round((apl - plan) * 1e6) / 1e6
    if (dif > 0) ed.setNumber(COL.adic + r, dif)
    else ed.setBlank(COL.adic + r)
    if (dif < 0) ed.setNumber(COL.dev + r, -dif)
    else ed.setBlank(COL.dev + r)
  }

  for (const r of rows) {
    if (r.code === null) continue
    if (r.codigoEmTexto) {
      ed.setNumber(COL.code + r.row, r.code)
      guardarDescricao(ed, r.row, r.code, catalogo)
    }
    formatoNumero(ed.cell(COL.code + r.row)!)
    const apl = porLinha.get(r.row) ?? 0
    if (apl === 0) zeradas++
    if (r.aplicado !== null && Math.abs(r.aplicado - apl) > 1e-9) mudaram++
    escreverQuantidades(r.row, r.planejado, apl)
  }

  // linhas novas: soma por código dentro do mesmo grupo de operação
  const novas = new Map<string, { code: number; qty: number }>()
  for (const d of destinos) {
    if (d.row !== null) continue
    const k = d.code + '|' + groupOf(d.oper).join(',')
    const prev = novas.get(k)
    if (prev) prev.qty += d.qty
    else novas.set(k, { code: d.code, qty: d.qty })
  }

  // linhas de reserva (sem código) no fim da ADS, na ordem
  const reservas = rows.filter((r) => r.code === null).map((r) => r.row)
  const oldLast = ed.lastRow
  let last = oldLast
  const linhasNovas: number[] = []
  const pintarVermelho = await criarPintorVermelho(wb)
  for (const [chave, n] of novas) {
    let r = reservas.shift()
    if (r === undefined) {
      last += 1
      ed.copyRow(last - 1, last)
      r = last
    }
    linhasNovas.push(r)
    ed.setBlank(COL.id + r)
    ed.setBlank(COL.item + r)
    ed.setBlank(COL.oper + r)
    ed.setBlank(COL.descOper + r)
    ed.setNumber(COL.code + r, n.code)
    formatoNumero(ed.cell(COL.code + r)!)
    ed.setNumber(COL.plan + r, 0)
    if (ed.cell(COL.copiaPlan + r)) ed.setNumber(COL.copiaPlan + r, 0)
    escreverQuantidades(r, 0, n.qty)
    guardarDescricao(ed, r, n.code, catalogo)
    // item que não estava previsto: a linha inteira em vermelho
    pintarVermelho(ed.row(r)!)
    // registra em que linha cada lançamento novo caiu
    for (const d of destinos) {
      if (d.motivo === 'nova' && d.code + '|' + groupOf(d.oper).join(',') === chave) d.row = r
    }
  }
  if (last > oldLast) await growAdsReferences(wb, ed, oldLast, last)

  return { destinos, linhasNovas, zeradas, mudaramDeValor: mudaram }
}

