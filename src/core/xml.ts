// Leitura e escrita de XML que funciona no navegador (DOMParser nativo)
// e no Node (testes), onde o DOMParser vem do @xmldom/xmldom.

type ParserCtor = new () => { parseFromString(s: string, type: string): Document }
type SerializerCtor = new () => { serializeToString(n: Node): string }

let Parser: ParserCtor | undefined = (globalThis as { DOMParser?: ParserCtor }).DOMParser
let Serializer: SerializerCtor | undefined = (globalThis as { XMLSerializer?: SerializerCtor }).XMLSerializer

export function setXmlImpl(p: ParserCtor, s: SerializerCtor) {
  Parser = p
  Serializer = s
}

export const NS = {
  main: 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
  rel: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  pkgRel: 'http://schemas.openxmlformats.org/package/2006/relationships',
  ct: 'http://schemas.openxmlformats.org/package/2006/content-types',
  xdr: 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
}

export const REL_TYPE = {
  drawing: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing',
  image: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
  calcChain: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/calcChain',
}

export function parseXml(text: string): Document {
  if (!Parser) throw new Error('DOMParser indisponível')
  const doc = new Parser().parseFromString(text, 'application/xml')
  const err = doc.getElementsByTagName('parsererror')[0]
  if (err) throw new Error('XML inválido: ' + (err.textContent ?? '').slice(0, 200))
  return doc
}

export function serializeXml(doc: Document): string {
  if (!Serializer) throw new Error('XMLSerializer indisponível')
  let s = new Serializer().serializeToString(doc)
  if (!s.startsWith('<?xml')) s = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + s
  return s
}

/** Filhos diretos com o nome local pedido (sem depender de prefixo). */
export function children(el: Element, localName: string): Element[] {
  const out: Element[] = []
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (n as Element).localName === localName) out.push(n as Element)
  }
  return out
}

export function child(el: Element, localName: string): Element | undefined {
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (n as Element).localName === localName) return n as Element
  }
  return undefined
}

/** Todos os descendentes com o nome local pedido. */
export function descendants(root: Document | Element, localName: string): Element[] {
  const all = root.getElementsByTagName('*')
  const out: Element[] = []
  for (let i = 0; i < all.length; i++) if (all[i].localName === localName) out.push(all[i])
  return out
}

export function removeChildren(el: Element) {
  while (el.firstChild) el.removeChild(el.firstChild)
}
