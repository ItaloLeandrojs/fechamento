import { SheetEditor, type CellValue } from './sheet'
import { NS, child, descendants } from './xml'
import type { Workbook } from './workbook'

/** Abas grandes de cadastro: não têm referência simples a outra aba que precise de valor guardado. */
const IGNORAR = ['MaterialServico']

/** `'Check-list'!K56`, `Check-list!$K$56`, `DP!A1`: uma referência simples a uma célula de outra aba. */
const REF_SIMPLES = /^(?:'((?:[^']|'')+)'|([A-Za-z0-9_.À-ú]+))!\$?([A-Z]{1,3})\$?(\d+)$/

/**
 * Grava, nas fórmulas que só copiam uma célula de outra aba, o valor que essa célula tem agora.
 *
 * O Excel abre arquivo baixado no Modo de Exibição Protegido, e nesse modo ele não recalcula:
 * mostra o último valor guardado no arquivo. Sem isto, o rodapé das fichas (matrícula, nome,
 * data), que puxa da Check-list, aparecia com o valor antigo do inventário (às vezes 0).
 * Ao habilitar a edição o Excel recalcula tudo de qualquer jeito (fullCalcOnLoad).
 */
export async function atualizarValoresGuardados(wb: Workbook): Promise<void> {
  const editores = new Map<string, SheetEditor>()
  const editor = async (nome: string): Promise<SheetEditor | undefined> => {
    if (editores.has(nome)) return editores.get(nome)
    const aba = wb.sheet(nome)
    if (!aba) return undefined
    const ed = new SheetEditor(await wb.doc(aba.path), wb.sharedStrings)
    editores.set(nome, ed)
    return ed
  }

  for (const aba of wb.sheets) {
    if (IGNORAR.includes(aba.name) || !(await wb.contains(aba.path, '!'))) continue
    const doc = await wb.doc(aba.path)
    let mudou = false
    for (const f of descendants(doc, 'f')) {
      // só fórmula de célula: <xm:f> da formatação condicional x14 também se chama "f"
      const c = f.parentNode as Element
      if (f.namespaceURI !== NS.main || c.localName !== 'c') continue
      // compartilhada ou matricial: fica como está (nos inventários, o rodapé usa fórmula comum)
      if (f.getAttribute('t')) continue
      const m = REF_SIMPLES.exec((f.textContent ?? '').trim())
      if (!m) continue
      const origem = m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2]
      if (origem === aba.name || IGNORAR.includes(origem)) continue
      const ed = await editor(origem)
      if (!ed) continue
      const alvo = ed.cell(m[3] + m[4])
      const valor: CellValue = alvo ? ed.cellValue(alvo) : null
      gravarValorGuardado(c, f, valor, alvo?.getAttribute('t') === 'e')
      mudou = true
    }
    if (mudou) wb.touch(aba.path)
  }
}

/** Troca só o <v> (e o tipo) da célula, mantendo a fórmula e o estilo. */
export function gravarValorGuardado(c: Element, f: Element, valor: CellValue, ehErro: boolean) {
  const doc = c.ownerDocument!
  for (const v of [child(c, 'v'), child(c, 'is')]) if (v) c.removeChild(v)
  c.removeAttribute('t')
  const v = doc.createElementNS(NS.main, 'v')
  if (ehErro) {
    c.setAttribute('t', 'e')
    v.textContent = String(valor ?? '#N/A')
  } else if (typeof valor === 'number') {
    v.textContent = String(valor)
  } else if (typeof valor === 'boolean') {
    c.setAttribute('t', 'b')
    v.textContent = valor ? '1' : '0'
  } else if (valor === null) {
    v.textContent = '0' // célula vazia: o Excel mostra 0
  } else {
    c.setAttribute('t', 'str') // texto, inclusive texto vazio
    v.textContent = valor
  }
  c.insertBefore(v, f.nextSibling) // ordem do esquema: f, v, extLst
}
