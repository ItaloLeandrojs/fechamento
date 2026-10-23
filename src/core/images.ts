import { SheetEditor, type Range } from './sheet'
import { NS, REL_TYPE, child, descendants, parseXml } from './xml'
import { relsPathOf, resolvePath, type Workbook } from './workbook'

export interface Imagem {
  data: Uint8Array
  width: number // px
  height: number // px
  ext: 'jpeg' | 'png'
}

const EMU_PX = 9525

/** Caixa em EMU, medida a partir do canto da aba. */
export interface Caixa {
  x: number
  y: number
  w: number
  h: number
}

function prefix(widths: number[]): number[] {
  const p = [0]
  for (let i = 1; i < widths.length; i++) p.push(p[i - 1] + widths[i])
  return p // p[i] = borda direita da coluna i (ou de baixo da linha i)
}

/** Caixa (em EMU) ocupada por um intervalo de células. */
export function caixaDoIntervalo(ed: SheetEditor, r: Range): Caixa {
  const cx = prefix(ed.colWidthsEmu(r.c2 + 2))
  const ry = prefix(ed.rowHeightsEmu(r.r2 + 2))
  return { x: cx[r.c1 - 1], y: ry[r.r1 - 1], w: cx[r.c2] - cx[r.c1 - 1], h: ry[r.r2] - ry[r.r1 - 1] }
}

/** Encaixa a imagem inteira, centralizada, dentro da caixa (com margem). */
export function encaixar(caixa: Caixa, img: { width: number; height: number }, margemPx = 4): Caixa {
  const m = margemPx * EMU_PX
  const bw = Math.max(1, caixa.w - 2 * m)
  const bh = Math.max(1, caixa.h - 2 * m)
  const esc = Math.min(bw / img.width, bh / img.height)
  const w = Math.round(img.width * esc)
  const h = Math.round(img.height * esc)
  return { x: Math.round(caixa.x + (caixa.w - w) / 2), y: Math.round(caixa.y + (caixa.h - h) / 2), w, h }
}

/** Converte uma posição absoluta (EMU) em célula + deslocamento (índices 0, como o Excel grava). */
function paraCelula(pos: number, tamanhos: number[]): { idx: number; off: number } {
  let acc = 0
  for (let i = 1; i < tamanhos.length; i++) {
    if (pos < acc + tamanhos[i] || i === tamanhos.length - 1) {
      return { idx: i - 1, off: Math.max(0, Math.round(pos - acc)) }
    }
    acc += tamanhos[i]
  }
  return { idx: 0, off: 0 }
}

const DRAWING_CT = 'application/vnd.openxmlformats-officedocument.drawing+xml'

/** Abre (ou cria) o desenho da aba, onde ficam as imagens flutuantes. */
async function desenhoDaAba(wb: Workbook, sheetPath: string): Promise<{ path: string; doc: Document }> {
  const sheetDoc = await wb.doc(sheetPath)
  const dEl = child(sheetDoc.documentElement, 'drawing')
  if (dEl) {
    const rid = dEl.getAttributeNS(NS.rel, 'id') ?? dEl.getAttribute('r:id')
    const rels = await wb.rels(sheetPath)
    const rel = descendants(rels, 'Relationship').find((r) => r.getAttribute('Id') === rid)!
    const path = resolvePath(sheetPath, rel.getAttribute('Target')!)
    return { path, doc: await wb.doc(path) }
  }
  const path = wb.freeName('xl/drawings', 'drawing', 'xml')
  const doc = wb.newDoc(path, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<xdr:wsDr xmlns:xdr="${NS.xdr}" xmlns:a="${NS.a}"></xdr:wsDr>`)
  await wb.addOverride(path, DRAWING_CT)
  const rid = await wb.addRel(sheetPath, REL_TYPE.drawing, '../drawings/' + path.split('/').pop())
  const el = sheetDoc.createElementNS(NS.main, 'drawing')
  el.setAttributeNS(NS.rel, 'r:id', rid)
  // ordem exigida pelo esquema: drawing vem antes destes elementos
  const depois = ['legacyDrawing', 'legacyDrawingHF', 'drawingHF', 'picture', 'oleObjects', 'controls', 'webPublishItems', 'tableParts', 'extLst']
  let ref: Element | null = null
  for (let n = sheetDoc.documentElement.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && depois.includes((n as Element).localName)) {
      ref = n as Element
      break
    }
  }
  sheetDoc.documentElement.insertBefore(el, ref)
  wb.touch(sheetPath)
  return { path, doc }
}

/**
 * Apaga as imagens que começam entre as linhas r1 e r2 (contando de 1).
 * Serve para tirar o carimbo antigo que alguns inventários já trazem no rodapé.
 */
export async function removerImagensNaFaixa(wb: Workbook, sheetName: string, r1: number, r2: number): Promise<number> {
  const info = wb.sheet(sheetName)!
  const sheetDoc = await wb.doc(info.path)
  if (!child(sheetDoc.documentElement, 'drawing')) return 0
  const { path, doc } = await desenhoDaAba(wb, info.path)
  let n = 0
  for (const tag of ['twoCellAnchor', 'oneCellAnchor', 'absoluteAnchor']) {
    for (const anc of descendants(doc, tag)) {
      if (!descendants(anc, 'pic').length) continue // só imagens; formas e controles ficam
      const from = child(anc, 'from')
      const row = from ? Number(child(from, 'row')?.textContent ?? -1) + 1 : -1
      if (row >= r1 && row <= r2) {
        anc.parentNode!.removeChild(anc)
        n++
      }
    }
  }
  if (n) wb.touch(path)
  return n
}

/**
 * Remove as "fotos vinculadas" (câmera do Excel, fórmula =IMAGEM) da camada VML
 * da aba. É assim que os inventários trazem o carimbo antigo, puxado do ARO.
 * Comentários e caixas de seleção, que também moram no VML, ficam intactos.
 */
export async function removerFotosVinculadas(wb: Workbook, sheetName: string): Promise<number> {
  const info = wb.sheet(sheetName)!
  const sheetDoc = await wb.doc(info.path)
  const leg = child(sheetDoc.documentElement, 'legacyDrawing')
  if (!leg) return 0
  const rid = leg.getAttributeNS(NS.rel, 'id') ?? leg.getAttribute('r:id')
  const rels = await wb.rels(info.path)
  const rel = descendants(rels, 'Relationship').find((r) => r.getAttribute('Id') === rid)
  if (!rel) return 0
  const vmlPath = resolvePath(info.path, rel.getAttribute('Target')!)
  const f = wb.zip.file(vmlPath)
  if (!f) return 0
  const vml = await f.async('string')
  let n = 0
  const novo = vml.replace(/<v:shape\s[^>]*>[\s\S]*?<\/v:shape>/g, (bloco) => {
    if (/ObjectType="Pict"/.test(bloco) && /<x:FmlaPict>/.test(bloco)) {
      n++
      return ''
    }
    return bloco
  })
  if (n) wb.zip.file(vmlPath, novo)
  return n
}

/** Coloca uma imagem flutuante na aba, na caixa pedida (em EMU). */
export async function inserirImagem(wb: Workbook, sheetName: string, img: Imagem, alvo: Caixa, nome: string) {
  const info = wb.sheet(sheetName)!
  const ed = new SheetEditor(await wb.doc(info.path), wb.sharedStrings)
  const { path, doc } = await desenhoDaAba(wb, info.path)

  const media = wb.freeName('xl/media', 'image', img.ext)
  wb.addBinary(media, img.data)
  await wb.ensureDefaultContentType(img.ext, img.ext === 'png' ? 'image/png' : 'image/jpeg')
  const rid = await wb.addRel(path, REL_TYPE.image, '../media/' + media.split('/').pop())

  // posição em células: precisa de colunas/linhas suficientes para cobrir a imagem
  const larg = ed.colWidthsEmu(400)
  const alt = ed.rowHeightsEmu(Math.max(ed.lastRow + 200, 400))
  const de = { c: paraCelula(alvo.x, larg), r: paraCelula(alvo.y, alt) }
  const ate = { c: paraCelula(alvo.x + alvo.w, larg), r: paraCelula(alvo.y + alvo.h, alt) }

  const root = doc.documentElement
  let maxId = 1
  for (const c of descendants(root, 'cNvPr')) maxId = Math.max(maxId, Number(c.getAttribute('id')) || 0)

  const xml = `<xdr:twoCellAnchor xmlns:xdr="${NS.xdr}" xmlns:a="${NS.a}" xmlns:r="${NS.rel}" editAs="oneCell">`
    + `<xdr:from><xdr:col>${de.c.idx}</xdr:col><xdr:colOff>${de.c.off}</xdr:colOff><xdr:row>${de.r.idx}</xdr:row><xdr:rowOff>${de.r.off}</xdr:rowOff></xdr:from>`
    + `<xdr:to><xdr:col>${ate.c.idx}</xdr:col><xdr:colOff>${ate.c.off}</xdr:colOff><xdr:row>${ate.r.idx}</xdr:row><xdr:rowOff>${ate.r.off}</xdr:rowOff></xdr:to>`
    + `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${maxId + 1}" name="${escapeXml(nome)}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>`
    + `<xdr:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>`
    + `<xdr:spPr><a:xfrm><a:off x="${alvo.x}" y="${alvo.y}"/><a:ext cx="${alvo.w}" cy="${alvo.h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>`
    + `<xdr:clientData/></xdr:twoCellAnchor>`
  root.appendChild(doc.importNode(parseXml(xml).documentElement, true))
  wb.touch(path)
  wb.touch(relsPathOf(path))
}

function escapeXml(s: string) {
  return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!)
}
