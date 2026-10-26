import { SheetEditor, indexToCol, splitRef } from './sheet'
import { children } from './xml'

/** Texto comparável: sem acento, sem dois-pontos, espaços simples, minúsculo. */
export function normalizarRotulo(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/:/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Célula cujo texto, normalizado, é igual ao rótulo pedido (a primeira, de cima para baixo). */
export function acharRotulo(ed: SheetEditor, rotulo: string): { ref: string; col: number; row: number } | undefined {
  const alvo = normalizarRotulo(rotulo)
  for (const linha of children(ed.sheetData, 'row')) {
    for (const c of children(linha, 'c')) {
      const v = ed.cellValue(c)
      if (typeof v === 'string' && normalizarRotulo(v) === alvo) {
        const ref = c.getAttribute('r')!
        return { ref, ...splitRef(ref) }
      }
    }
  }
  return undefined
}

/**
 * Célula do valor de um rótulo da mesma linha (ex.: "Nota / OV :" em C4 → G4):
 * a primeira à direita do rótulo que tenha conteúdo, fórmula ou abra uma mesclagem.
 * Sem o rótulo, vale a célula de sempre do modelo da EDP.
 */
export function valorDoRotulo(ed: SheetEditor, rotulo: string, padrao: string): string {
  const r = acharRotulo(ed, rotulo)
  if (!r) return padrao
  const fim = ed.mergeAt(r.ref)?.c2 ?? r.col
  for (let c = fim + 1; c <= fim + 10; c++) {
    const ref = indexToCol(c) + r.row
    const cel = ed.cell(ref)
    const m = ed.mergeAt(ref)
    if ((cel && (ed.formula(cel) || ed.cellValue(cel) !== null)) || (m && m.c1 === c && m.r1 === r.row)) return ref
  }
  return padrao
}
