import JSZip from 'jszip'
import { NS, REL_TYPE, child, children, descendants, parseXml, serializeXml } from './xml'

export interface SheetInfo {
  name: string
  path: string // ex.: xl/worksheets/sheet2.xml
  el: Element // <sheet> dentro do workbook.xml
}

/** Junta um caminho relativo de um .rels com a pasta da parte de origem. */
export function resolvePath(fromPart: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  const parts = fromPart.split('/')
  parts.pop()
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.') parts.push(seg)
  }
  return parts.join('/')
}

export function relsPathOf(part: string): string {
  const i = part.lastIndexOf('/')
  return part.slice(0, i) + '/_rels/' + part.slice(i + 1) + '.rels'
}

/**
 * Pacote .xlsx aberto. Só as partes que forem pedidas são lidas como XML;
 * as outras voltam para o arquivo novo exatamente como vieram.
 */
export class Workbook {
  zip: JSZip
  private docs = new Map<string, Document>()
  private dirty = new Set<string>()
  sheets: SheetInfo[] = []
  sharedStrings: string[] = []

  private constructor(zip: JSZip) {
    this.zip = zip
  }

  static async open(data: ArrayBuffer | Uint8Array): Promise<Workbook> {
    const zip = await JSZip.loadAsync(data)
    const wb = new Workbook(zip)
    await wb.init()
    return wb
  }

  private async init() {
    const book = await this.doc('xl/workbook.xml')
    const rels = await this.doc('xl/_rels/workbook.xml.rels')
    const byId = new Map<string, string>()
    for (const r of descendants(rels, 'Relationship')) {
      byId.set(r.getAttribute('Id')!, resolvePath('xl/workbook.xml', r.getAttribute('Target')!))
    }
    for (const s of descendants(book, 'sheet')) {
      const rid = s.getAttributeNS(NS.rel, 'id') ?? s.getAttribute('r:id')
      this.sheets.push({ name: s.getAttribute('name')!, path: byId.get(rid!)!, el: s })
    }
    const sst = this.zip.file('xl/sharedStrings.xml')
    if (sst) this.sharedStrings = lerTextosCompartilhados(await sst.async('string'))
  }

  has(path: string) {
    return this.zip.file(path) !== null
  }

  async doc(path: string): Promise<Document> {
    let d = this.docs.get(path)
    if (!d) {
      const f = this.zip.file(path)
      if (!f) throw new Error('Parte não encontrada no arquivo: ' + path)
      d = parseXml(await f.async('string'))
      this.docs.set(path, d)
    }
    return d
  }

  /** Diz se a parte contém um texto, sem montar o XML (rápido para abas grandes). */
  async contains(path: string, needle: string): Promise<boolean> {
    if (this.docs.has(path)) return true
    const f = this.zip.file(path)
    return f ? (await f.async('string')).includes(needle) : false
  }

  /** Cria uma parte XML nova (ainda não existente no pacote). */
  newDoc(path: string, xml: string): Document {
    const d = parseXml(xml)
    this.docs.set(path, d)
    this.dirty.add(path)
    return d
  }

  touch(path: string) {
    this.dirty.add(path)
  }

  sheet(name: string): SheetInfo | undefined {
    return this.sheets.find((s) => s.name === name)
  }

  sheetByPrefix(prefix: string): SheetInfo | undefined {
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    return this.sheets.find((s) => norm(s.name).startsWith(norm(prefix)))
  }

  async sheetDoc(name: string): Promise<Document> {
    const s = this.sheet(name)
    if (!s) throw new Error('Aba não encontrada: ' + name)
    return this.doc(s.path)
  }

  /** Lê o .rels de uma parte (cria vazio se não existir). */
  async rels(part: string): Promise<Document> {
    const p = relsPathOf(part)
    if (this.has(p) || this.docs.has(p)) return this.doc(p)
    return this.newDoc(p, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<Relationships xmlns="${NS.pkgRel}"></Relationships>`)
  }

  async addRel(part: string, type: string, target: string): Promise<string> {
    const rels = await this.rels(part)
    const root = rels.documentElement
    const used = new Set(children(root, 'Relationship').map((r) => r.getAttribute('Id')))
    let n = 1
    while (used.has('rId' + n)) n++
    const r = rels.createElementNS(NS.pkgRel, 'Relationship')
    r.setAttribute('Id', 'rId' + n)
    r.setAttribute('Type', type)
    r.setAttribute('Target', target)
    root.appendChild(r)
    this.touch(relsPathOf(part))
    return 'rId' + n
  }

  async ensureDefaultContentType(ext: string, type: string) {
    const ct = await this.doc('[Content_Types].xml')
    const root = ct.documentElement
    if (children(root, 'Default').some((d) => d.getAttribute('Extension')?.toLowerCase() === ext)) return
    const d = ct.createElementNS(NS.ct, 'Default')
    d.setAttribute('Extension', ext)
    d.setAttribute('ContentType', type)
    root.insertBefore(d, root.firstChild)
    this.touch('[Content_Types].xml')
  }

  async addOverride(partName: string, type: string) {
    const ct = await this.doc('[Content_Types].xml')
    const o = ct.createElementNS(NS.ct, 'Override')
    o.setAttribute('PartName', '/' + partName)
    o.setAttribute('ContentType', type)
    ct.documentElement.appendChild(o)
    this.touch('[Content_Types].xml')
  }

  addBinary(path: string, data: Uint8Array) {
    // foto já vem comprimida (JPEG/PNG): guardar sem recomprimir é bem mais rápido
    this.zip.file(path, data, { compression: 'STORE' })
  }

  /** Próximo nome livre do tipo xl/media/image7.jpeg. */
  freeName(dir: string, base: string, ext: string): string {
    let n = 1
    while (this.zip.file(`${dir}/${base}${n}.${ext}`) || this.docs.has(`${dir}/${base}${n}.${ext}`)) n++
    return `${dir}/${base}${n}.${ext}`
  }

  /**
   * Excel guarda a ordem de cálculo em calcChain.xml. Como trocamos fórmulas
   * por valores, a cadeia antiga ficaria inválida (o Excel acusaria "reparo").
   * Apagar é seguro: o Excel recria. E pedimos recálculo total ao abrir.
   */
  async dropCalcChainAndRecalc() {
    if (this.has('xl/calcChain.xml')) {
      this.zip.remove('xl/calcChain.xml')
      const rels = await this.doc('xl/_rels/workbook.xml.rels')
      for (const r of descendants(rels, 'Relationship')) {
        if (r.getAttribute('Type') === REL_TYPE.calcChain) r.parentNode!.removeChild(r)
      }
      this.touch('xl/_rels/workbook.xml.rels')
      const ct = await this.doc('[Content_Types].xml')
      for (const o of descendants(ct, 'Override')) {
        if (o.getAttribute('PartName') === '/xl/calcChain.xml') o.parentNode!.removeChild(o)
      }
      this.touch('[Content_Types].xml')
    }
    const book = await this.doc('xl/workbook.xml')
    let calcPr = child(book.documentElement, 'calcPr')
    if (!calcPr) {
      calcPr = book.createElementNS(NS.main, 'calcPr')
      const after = child(book.documentElement, 'definedNames') ?? child(book.documentElement, 'sheets')!
      book.documentElement.insertBefore(calcPr, after.nextSibling)
    }
    calcPr.setAttribute('fullCalcOnLoad', '1')
    this.touch('xl/workbook.xml')
  }

  unhideSheet(name: string) {
    const s = this.sheet(name)
    if (s && s.el.getAttribute('state')) {
      s.el.removeAttribute('state')
      this.touch('xl/workbook.xml')
    }
  }

  async save(): Promise<Uint8Array> {
    for (const path of this.dirty) {
      const d = this.docs.get(path)
      if (d) this.zip.file(path, serializeXml(d))
    }
    return this.zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  }
}

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decodificar(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
    return ENTIDADES[e] ?? m
  })
}

/**
 * Lê os textos compartilhados (sharedStrings.xml) sem montar o XML inteiro:
 * são dezenas de milhares de textos e o DOM do navegador fica lento.
 * Junta os pedaços de texto rico e ignora a parte fonética (<rPh>).
 */
export function lerTextosCompartilhados(xml: string): string[] {
  const out: string[] = []
  const reSi = /<si>([\s\S]*?)<\/si>|<si\/>/g
  let m: RegExpExecArray | null
  while ((m = reSi.exec(xml))) {
    const corpo = (m[1] ?? '').replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')
    let txt = ''
    const reT = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g
    let t: RegExpExecArray | null
    while ((t = reT.exec(corpo))) txt += t[1] ?? ''
    out.push(decodificar(txt))
  }
  return out
}
