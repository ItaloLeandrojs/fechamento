import { SheetEditor } from './sheet'
import { child, children } from './xml'
import type { Workbook } from './workbook'

export type TipoBoletim = 'parcial' | 'final'

/** Caixas fora da área de impressão da Check-list, ao lado do cabeçalho. */
const CAIXA_FINAL = 'W5'
const ROTULO_FINAL = 'X5'
const CAIXA_PARCIAL = 'W7'
const ROTULO_PARCIAL = 'X7'
/** Caixa e texto de uma linha da lista ("X" em C22, "ADS Preenchidas..." em E22): modelo de estilo. */
const MODELO_CAIXA = 'C22'
const MODELO_TEXTO = 'E22'

/**
 * Parcial: as caixas FINAL (vazia) e PARCIAL (com X) aparecem na Check-list.
 * Final: as quatro células ficam em branco, sem caixa, como se não existissem.
 */
export async function aplicarTipoBoletim(wb: Workbook, tipo: TipoBoletim): Promise<void> {
  const aba = wb.sheetByPrefix('Check-list')
  if (!aba) return
  const ed = new SheetEditor(await wb.doc(aba.path), wb.sharedStrings)
  wb.touch(aba.path)
  const celulas = [CAIXA_FINAL, ROTULO_FINAL, CAIXA_PARCIAL, ROTULO_PARCIAL]

  if (tipo === 'final') {
    for (const ref of celulas) {
      ed.setBlank(ref)
      ed.cell(ref)?.removeAttribute('s')
    }
    return
  }

  // inventário que veio sem as caixas: usa o estilo das caixas e textos da própria lista
  const caixa = await estiloDeCaixa(wb, ed)
  const texto = ed.cell(MODELO_TEXTO)?.getAttribute('s')
  for (const ref of [CAIXA_FINAL, CAIXA_PARCIAL]) {
    const c = ed.cell(ref, true)!
    if (caixa && !(await estiloTemCaixa(wb, c.getAttribute('s')))) c.setAttribute('s', caixa)
  }
  for (const ref of [ROTULO_FINAL, ROTULO_PARCIAL]) {
    const c = ed.cell(ref, true)!
    if (texto && !c.getAttribute('s')) c.setAttribute('s', texto)
  }

  ed.setBlank(CAIXA_FINAL)
  ed.setString(ROTULO_FINAL, 'FINAL')
  ed.setString(CAIXA_PARCIAL, 'X')
  ed.setString(ROTULO_PARCIAL, 'PARCIAL')
}

async function estiloDeCaixa(wb: Workbook, ed: SheetEditor): Promise<string | undefined> {
  for (const ref of [CAIXA_PARCIAL, CAIXA_FINAL, MODELO_CAIXA]) {
    const s = ed.cell(ref)?.getAttribute('s')
    if (s && (await estiloTemCaixa(wb, s))) return s
  }
  return undefined
}

/** O estilo desenha caixa (borda ou fundo)? */
async function estiloTemCaixa(wb: Workbook, s: string | null | undefined): Promise<boolean> {
  if (!s || !wb.zip.file('xl/styles.xml')) return false
  const doc = await wb.doc('xl/styles.xml')
  const xfs = child(doc.documentElement, 'cellXfs')
  const xf = xfs && children(xfs, 'xf')[Number(s)]
  if (!xf) return false
  return Number(xf.getAttribute('borderId') || 0) > 0 || Number(xf.getAttribute('fillId') || 0) > 0
}
