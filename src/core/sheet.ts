import { NS, child, children, descendants, removeChildren } from './xml'

export function colToIndex(col: string): number {
  let n = 0
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

export function indexToCol(n: number): string {
  let s = ''
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function splitRef(ref: string): { col: number; row: number } {
  const m = /^\$?([A-Z]+)\$?(\d+)$/.exec(ref)
  if (!m) throw new Error('Referência inválida: ' + ref)
  return { col: colToIndex(m[1]), row: Number(m[2]) }
}

export interface Range {
  c1: number
  r1: number
  c2: number
  r2: number
}

export function parseRange(ref: string): Range {
  const [a, b] = ref.split(':')
  const p = splitRef(a)
  const q = b ? splitRef(b) : p
  return { c1: p.col, r1: p.row, c2: q.col, r2: q.row }
}

/**
 * Desloca as referências relativas (sem $) de uma fórmula. Pula textos entre
 * aspas e nomes de aba entre apóstrofos; não mexe em colunas inteiras (C:D).
 */
export function shiftFormula(f: string, dRow: number, dCol = 0): string {
  if (!dRow && !dCol) return f
  let out = ''
  let i = 0
  while (i < f.length) {
    const ch = f[i]
    if (ch === '"' || ch === "'") {
      const j = f.indexOf(ch, i + 1)
      const end = j < 0 ? f.length : j + 1
      out += f.slice(i, end)
      i = end
      continue
    }
    const m = /^(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\d(A-Za-z_])/.exec(f.slice(i))
    const prev = i > 0 ? f[i - 1] : ''
    if (m && !/[A-Za-z0-9_.]/.test(prev)) {
      const col = m[1] ? m[2] : indexToCol(colToIndex(m[2]) + dCol)
      const row = m[3] ? m[4] : String(Number(m[4]) + dRow)
      out += m[1] + col + m[3] + row
      i += m[0].length
      continue
    }
    out += ch
    i++
  }
  return out
}

export type CellValue = number | string | boolean | null

/** Edição de uma aba (<worksheet>) direto no XML, preservando estilos. */
export class SheetEditor {
  doc: Document
  root: Element
  sheetData: Element
  private rowMap = new Map<number, Element>()
  private ss: string[]

  constructor(doc: Document, sharedStrings: string[]) {
    this.doc = doc
    this.root = doc.documentElement
    this.sheetData = child(this.root, 'sheetData')!
    this.ss = sharedStrings
    for (const r of children(this.sheetData, 'row')) this.rowMap.set(Number(r.getAttribute('r')), r)
  }

  get lastRow(): number {
    let m = 0
    for (const k of this.rowMap.keys()) if (k > m) m = k
    return m
  }

  row(r: number, create = false): Element | undefined {
    let el = this.rowMap.get(r)
    if (!el && create) {
      el = this.doc.createElementNS(NS.main, 'row')
      el.setAttribute('r', String(r))
      let next: Element | null = null
      for (const [k, v] of this.rowMap) if (k > r && (!next || k < Number(next.getAttribute('r')))) next = v
      this.sheetData.insertBefore(el, next)
      this.rowMap.set(r, el)
    }
    return el
  }

  cell(ref: string, create = false): Element | undefined {
    const { col, row } = splitRef(ref)
    const rowEl = this.row(row, create)
    if (!rowEl) return undefined
    let before: Element | null = null
    for (const c of children(rowEl, 'c')) {
      const cc = splitRef(c.getAttribute('r')!).col
      if (cc === col) return c
      if (cc > col) {
        before = c
        break
      }
    }
    if (!create) return undefined
    const c = this.doc.createElementNS(NS.main, 'c')
    c.setAttribute('r', indexToCol(col) + row)
    // herda o estilo da coluna, se houver
    const colStyle = this.columnStyle(col)
    if (colStyle) c.setAttribute('s', colStyle)
    rowEl.insertBefore(c, before)
    return c
  }

  private columnStyle(col: number): string | undefined {
    const cols = child(this.root, 'cols')
    if (!cols) return undefined
    for (const c of children(cols, 'col')) {
      if (Number(c.getAttribute('min')) <= col && col <= Number(c.getAttribute('max'))) return c.getAttribute('style') ?? undefined
    }
    return undefined
  }

  /** Valor como o Excel mostraria (usa o valor guardado das fórmulas). */
  value(ref: string): CellValue {
    const c = this.cell(ref)
    return c ? this.cellValue(c) : null
  }

  cellValue(c: Element): CellValue {
    const t = c.getAttribute('t')
    if (t === 'inlineStr') {
      return descendants(c, 't').map((x) => x.textContent ?? '').join('')
    }
    const v = child(c, 'v')
    if (!v) return null
    const txt = v.textContent ?? ''
    if (t === 's') return this.ss[Number(txt)] ?? ''
    if (t === 'str' || t === 'e') return txt
    if (t === 'b') return txt === '1'
    const n = Number(txt)
    return Number.isFinite(n) ? n : txt
  }

  isError(ref: string): boolean {
    return this.cell(ref)?.getAttribute('t') === 'e'
  }

  formula(c: Element): Element | undefined {
    return child(c, 'f')
  }

  private clear(c: Element) {
    removeChildren(c)
    c.removeAttribute('t')
    c.removeAttribute('vm')
    c.removeAttribute('cm')
  }

  setNumber(ref: string, n: number) {
    const c = this.cell(ref, true)!
    this.clear(c)
    const v = this.doc.createElementNS(NS.main, 'v')
    v.textContent = String(Math.round(n * 1e6) / 1e6)
    c.appendChild(v)
  }

  setString(ref: string, s: string) {
    const c = this.cell(ref, true)!
    this.clear(c)
    c.setAttribute('t', 'inlineStr')
    const is = this.doc.createElementNS(NS.main, 'is')
    const t = this.doc.createElementNS(NS.main, 't')
    t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve')
    t.textContent = s
    is.appendChild(t)
    c.appendChild(is)
  }

  /** Troca o conteúdo por uma fórmula (sem valor guardado: o Excel calcula ao abrir). */
  setFormula(ref: string, formula: string) {
    const c = this.cell(ref, true)!
    this.clear(c)
    const f = this.doc.createElementNS(NS.main, 'f')
    f.textContent = formula
    c.appendChild(f)
  }

  setBlank(ref: string) {
    const c = this.cell(ref)
    if (c) this.clear(c)
  }

  /** Grava qualquer valor: número, texto ou vazio. */
  set(ref: string, v: CellValue) {
    if (v === null || v === '') this.setBlank(ref)
    else if (typeof v === 'number') this.setNumber(ref, v)
    else this.setString(ref, String(v))
  }

  merges(): Range[] {
    const mc = child(this.root, 'mergeCells')
    return mc ? children(mc, 'mergeCell').map((m) => parseRange(m.getAttribute('ref')!)) : []
  }

  mergeAt(ref: string): Range | undefined {
    const { col, row } = splitRef(ref)
    return this.merges().find((m) => m.c1 <= col && col <= m.c2 && m.r1 <= row && row <= m.r2)
  }

  /** Procura células cujo texto (sem acento, minúsculo) seja igual ao pedido. */
  findText(text: string): { ref: string; col: number; row: number }[] {
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
    const want = norm(text)
    const out: { ref: string; col: number; row: number }[] = []
    for (const rowEl of children(this.sheetData, 'row')) {
      for (const c of children(rowEl, 'c')) {
        const v = this.cellValue(c)
        if (typeof v === 'string' && norm(v) === want) {
          const ref = c.getAttribute('r')!
          out.push({ ref, ...splitRef(ref) })
        }
      }
    }
    return out
  }

  /** Copia a linha `src` para a posição nova `dst` (fórmulas ajustadas, sem valores guardados). */
  copyRow(src: number, dst: number) {
    const el = this.row(src)!.cloneNode(true) as Element
    el.setAttribute('r', String(dst))
    for (const c of children(el, 'c')) {
      const { col } = splitRef(c.getAttribute('r')!)
      c.setAttribute('r', indexToCol(col) + dst)
      const f = child(c, 'f')
      if (f) {
        f.textContent = shiftFormula(f.textContent ?? '', dst - src)
        const v = child(c, 'v')
        if (v) c.removeChild(v)
        if (c.getAttribute('t') === 'e' || c.getAttribute('t') === 'str') c.removeAttribute('t')
      }
    }
    let next: Element | null = null
    for (const [k, v] of this.rowMap) if (k > dst && (!next || k < Number(next.getAttribute('r')))) next = v
    this.sheetData.insertBefore(el, next)
    this.rowMap.set(dst, el)
  }

  // ---------- medidas (para posicionar imagens) ----------

  /** Larguras das colunas 1..maxCol em EMU (coluna oculta = 0). */
  colWidthsEmu(maxCol: number): number[] {
    const fmt = child(this.root, 'sheetFormatPr')
    const defW = Number(fmt?.getAttribute('defaultColWidth') ?? (Number(fmt?.getAttribute('baseColWidth') ?? 8) + 0.71))
    const w: number[] = new Array(maxCol + 1).fill(charsToEmu(defW))
    const cols = child(this.root, 'cols')
    if (cols) {
      for (const c of children(cols, 'col')) {
        const min = Number(c.getAttribute('min'))
        const max = Math.min(Number(c.getAttribute('max')), maxCol)
        const hidden = c.getAttribute('hidden') === '1'
        const width = Number(c.getAttribute('width') ?? defW)
        for (let i = min; i <= max; i++) w[i] = hidden ? 0 : charsToEmu(width)
      }
    }
    w[0] = 0
    return w
  }

  /** Alturas das linhas 1..maxRow em EMU (linha oculta = 0). */
  rowHeightsEmu(maxRow: number): number[] {
    const fmt = child(this.root, 'sheetFormatPr')
    const defH = Number(fmt?.getAttribute('defaultRowHeight') ?? 15)
    const h: number[] = new Array(maxRow + 1).fill(defH * 12700)
    for (const [r, el] of this.rowMap) {
      if (r > maxRow) continue
      if (el.getAttribute('hidden') === '1') h[r] = 0
      else if (el.getAttribute('ht')) h[r] = Number(el.getAttribute('ht')) * 12700
    }
    h[0] = 0
    return h
  }
}

/** Largura de coluna em caracteres → EMU (fonte padrão de 7 px por dígito). */
function charsToEmu(chars: number): number {
  const px = Math.floor(((256 * chars + Math.floor(128 / 7)) / 256) * 7)
  return px * 9525
}
