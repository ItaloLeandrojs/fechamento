import { NS, child, children } from './xml'
import type { Workbook } from './workbook'

const STYLES = 'xl/styles.xml'
/** Vermelho e negrito, como as linhas acrescentadas do modelo da EDP. */
const VERMELHO = 'FFFF0000'
/** Formato "Número" sem casas decimais (0), embutido no Excel. */
const FORMATO_NUMERO = '1'

type Troca = (c: Element) => void

interface Estilos {
  doc: Document
  fonts: Element
  cellXfs: Element
  listaFontes: Element[]
  listaXfs: Element[]
}

// uma lista só por arquivo: as trocas (vermelho, formato) criam estilos novos e
// precisam enxergar os que as outras criaram
const abertos = new WeakMap<Workbook, Estilos>()

async function abrirEstilos(wb: Workbook): Promise<Estilos | undefined> {
  const pronto = abertos.get(wb)
  if (pronto) return pronto
  if (!wb.zip.file(STYLES)) return undefined
  const doc = await wb.doc(STYLES)
  const fonts = child(doc.documentElement, 'fonts')
  const cellXfs = child(doc.documentElement, 'cellXfs')
  if (!fonts || !cellXfs) return undefined
  const e = { doc, fonts, cellXfs, listaFontes: children(fonts, 'font'), listaXfs: children(cellXfs, 'xf') }
  abertos.set(wb, e)
  return e
}

/**
 * Troca o estilo de uma célula por uma cópia modificada. Cada estilo usado ganha
 * a cópia só uma vez (borda, fundo e o resto continuam iguais).
 */
function trocaDeEstilo(wb: Workbook, e: Estilos, mudar: (xf: Element) => void): Troca {
  const copia = new Map<number, number>()
  const novoXf = (id: number): number => {
    const pronto = copia.get(id)
    if (pronto !== undefined) return pronto
    const xf = (e.listaXfs[id] ?? e.listaXfs[0]).cloneNode(true) as Element
    mudar(xf)
    e.cellXfs.appendChild(xf)
    e.listaXfs.push(xf)
    const novo = e.listaXfs.length - 1
    e.cellXfs.setAttribute('count', String(e.listaXfs.length))
    copia.set(id, novo)
    // o estilo já trocado não precisa de outra cópia
    copia.set(novo, novo)
    return novo
  }
  return (c: Element) => {
    c.setAttribute('s', String(novoXf(Number(c.getAttribute('s') || 0))))
    wb.touch(STYLES)
  }
}

/** Devolve a função que pinta uma linha inteira de vermelho e negrito. */
export async function criarPintorVermelho(wb: Workbook): Promise<(linha: Element) => void> {
  const e = await abrirEstilos(wb)
  if (!e) return () => {}
  const fonteVermelha = new Map<number, number>()
  const novaFonte = (id: number): number => {
    const pronta = fonteVermelha.get(id)
    if (pronta !== undefined) return pronta
    const f = (e.listaFontes[id] ?? e.listaFontes[0]).cloneNode(true) as Element
    for (const c of children(f, 'color')) f.removeChild(c)
    if (!child(f, 'b')) f.insertBefore(e.doc.createElementNS(NS.main, 'b'), f.firstChild)
    const cor = e.doc.createElementNS(NS.main, 'color')
    cor.setAttribute('rgb', VERMELHO)
    // ordem do esquema: b, i, strike..., sz, color, name, family...
    const depoisDaCor = ['name', 'family', 'charset', 'scheme'].map((n) => child(f, n)).find(Boolean) ?? null
    f.insertBefore(cor, depoisDaCor)
    e.fonts.appendChild(f)
    e.listaFontes.push(f)
    const novo = e.listaFontes.length - 1
    e.fonts.setAttribute('count', String(e.listaFontes.length))
    fonteVermelha.set(id, novo)
    return novo
  }
  const pintar = trocaDeEstilo(wb, e, (xf) => {
    xf.setAttribute('fontId', String(novaFonte(Number(xf.getAttribute('fontId') || 0))))
    xf.setAttribute('applyFont', '1')
  })
  return (linha: Element) => {
    for (const c of children(linha, 'c')) pintar(c)
  }
}

/** Devolve a função que põe a célula no formato "Número" sem casas decimais. */
export async function criarFormatoNumero(wb: Workbook): Promise<Troca> {
  const e = await abrirEstilos(wb)
  if (!e) return () => {}
  const trocar = trocaDeEstilo(wb, e, (xf) => {
    xf.setAttribute('numFmtId', FORMATO_NUMERO)
    xf.setAttribute('applyNumberFormat', '1')
  })
  return (c: Element) => {
    // já está em "Número": não cria cópia à toa
    const xf = e.listaXfs[Number(c.getAttribute('s') || 0)]
    if (xf?.getAttribute('numFmtId') === FORMATO_NUMERO) return
    trocar(c)
  }
}
