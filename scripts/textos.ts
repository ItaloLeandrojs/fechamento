// Lista os textos de uma aba (diagnóstico). Uso: npx tsx scripts/textos.ts <xlsx> <aba> [filtro]
import { readFileSync } from 'node:fs'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { setXmlImpl, children } from '../src/core/xml'
import { Workbook } from '../src/core/workbook'
import { SheetEditor } from '../src/core/sheet'
setXmlImpl(DOMParser as never, XMLSerializer as never)
const [arq, aba, filtro] = process.argv.slice(2)
const wb = await Workbook.open(readFileSync(arq))
const ed = new SheetEditor(await wb.sheetDoc(aba), wb.sharedStrings)
for (const row of children(ed.sheetData, 'row')) for (const c of children(row, 'c')) {
  const v = ed.cellValue(c); const f = children(c, 'f')[0]?.textContent
  if ((v !== null && v !== '') || f) { const s = `${c.getAttribute('r')} = ${JSON.stringify(v)}${f ? '  [=' + f + ']' : ''}`; if (!filtro || new RegExp(filtro, 'i').test(s)) console.log(s) }
}
