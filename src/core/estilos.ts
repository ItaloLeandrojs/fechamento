import { NS, child, children } from './xml'
import type { Workbook } from './workbook'

const STYLES = 'xl/styles.xml'
/** Vermelho e negrito, como as linhas acrescentadas do modelo da EDP. */
const VERMELHO = 'FFFF0000'

/**
 * Prepara a troca de estilo das células para a versão em vermelho e negrito.
 * Cada estilo usado ganha uma cópia vermelha só uma vez (borda, fundo e formato
 * do número continuam os mesmos); a função devolvida pinta uma linha inteira.
 */
export async function criarPintorVermelho(wb: Workbook): Promise<(linha: Element) => void> {
  if (!wb.zip.file(STYLES)) return () => {}
  const doc = await wb.doc(STYLES)
  const root = doc.documentElement
  const fonts = child(root, 'fonts')
  const cellXfs = child(root, 'cellXfs')
  if (!fonts || !cellXfs) return () => {}

  const listaFontes = children(fonts, 'font')
  const listaXfs = children(cellXfs, 'xf')
  const fonteVermelha = new Map<number, number>()
  const xfVermelho = new Map<number, number>()

  const novaFonte = (id: number): number => {
    const pronta = fonteVermelha.get(id)
    if (pronta !== undefined) return pronta
    const base = listaFontes[id] ?? listaFontes[0]
    const f = base.cloneNode(true) as Element
    for (const c of children(f, 'color')) f.removeChild(c)
    if (!child(f, 'b')) f.insertBefore(doc.createElementNS(NS.main, 'b'), f.firstChild)
    const cor = doc.createElementNS(NS.main, 'color')
    cor.setAttribute('rgb', VERMELHO)
    // ordem do esquema: b, i, strike..., sz, color, name, family...
    const depoisDaCor = ['name', 'family', 'charset', 'scheme'].map((n) => child(f, n)).find(Boolean) ?? null
    f.insertBefore(cor, depoisDaCor)
    fonts.appendChild(f)
    listaFontes.push(f)
    const novo = listaFontes.length - 1
    fonts.setAttribute('count', String(listaFontes.length))
    fonteVermelha.set(id, novo)
    return novo
  }

  const novoXf = (id: number): number => {
    const pronto = xfVermelho.get(id)
    if (pronto !== undefined) return pronto
    const base = listaXfs[id] ?? listaXfs[0]
    const xf = base.cloneNode(true) as Element
    xf.setAttribute('fontId', String(novaFonte(Number(xf.getAttribute('fontId') ?? 0))))
    xf.setAttribute('applyFont', '1')
    cellXfs.appendChild(xf)
    listaXfs.push(xf)
    const novo = listaXfs.length - 1
    cellXfs.setAttribute('count', String(listaXfs.length))
    xfVermelho.set(id, novo)
    // o estilo pintado já é vermelho: pintar de novo não cria outra cópia
    xfVermelho.set(novo, novo)
    return novo
  }

  return (linha: Element) => {
    for (const c of children(linha, 'c')) c.setAttribute('s', String(novoXf(Number(c.getAttribute('s') ?? 0))))
    wb.touch(STYLES)
  }
}
