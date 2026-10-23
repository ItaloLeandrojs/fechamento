import { unshareFormulas } from './ads'
import { SheetEditor, indexToCol, parseRange, shiftFormula, splitRef } from './sheet'
import { resolvePath, type Workbook } from './workbook'
import { NS, child, children, descendants } from './xml'

// ---------------- conta das linhas ----------------

/**
 * Novo par de linhas (a, b) de um intervalo depois de apagar as linhas r1..r2.
 * Ponta dentro do trecho apagado encolhe para a borda; intervalo todo dentro some (null).
 */
function ajustarLinhas(a: number, b: number, r1: number, r2: number): [number, number] | null {
  const n = r2 - r1 + 1
  if (b < r1) return [a, b]
  if (a > r2) return [a - n, b - n]
  if (a >= r1 && b <= r2) return null
  const na = a < r1 ? a : a > r2 ? a - n : r1
  const nb = b > r2 ? b - n : r1 - 1
  return [na, nb]
}

/** Intervalo de células ("B8:C9" ou "B8") depois de apagar as linhas; null se sumiu. */
function ajustarIntervalo(ref: string, r1: number, r2: number): string | null {
  const rg = parseRange(ref)
  const novo = ajustarLinhas(rg.r1, rg.r2, r1, r2)
  if (!novo) return null
  const a = indexToCol(rg.c1) + novo[0]
  const b = indexToCol(rg.c2) + novo[1]
  return a === b ? a : `${a}:${b}`
}

/** Lista de intervalos separados por espaço (sqref). Vazio quando tudo sumiu. */
function ajustarSqref(sqref: string, r1: number, r2: number): string {
  return sqref
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => ajustarIntervalo(p, r1, r2))
    .filter((p): p is string => p !== null)
    .join(' ')
}

const REF = /^(\$?)([A-Z]{1,3})(\$?)(\d+)(?::(\$?)([A-Z]{1,3})(\$?)(\d+))?(?![\d(A-Za-z_])/
const LINHAS_INTEIRAS = /^(\$?)(\d+):(\$?)(\d+)(?![\d(A-Za-z_])/

/** Troca uma referência (já separada pela expressão REF) pela nova. */
function refAjustada(m: RegExpExecArray, r1: number, r2: number): string {
  const [, d1, c1, d2, l1, d3, c2, d4, l2] = m
  const a = Number(l1)
  const b = l2 !== undefined ? Number(l2) : a
  const novo = ajustarLinhas(a, b, r1, r2)
  if (!novo) return '#REF!'
  if (l2 === undefined) return d1 + c1 + d2 + novo[0]
  return d1 + c1 + d2 + novo[0] + ':' + d3 + c2 + d4 + novo[1]
}

/**
 * Ajusta uma fórmula depois que as linhas r1..r2 da aba foram apagadas.
 * Sem prefixo de aba, a referência é da própria aba (a menos que `semPrefixoEhDaAba`
 * seja falso, como nos nomes definidos e nas fórmulas de outras abas). Com prefixo,
 * só muda se o nome for o de `aba`. Linhas inteiras ($5:$9) só são tratadas com prefixo.
 */
export function ajustarFormulaApagando(f: string, r1: number, r2: number, aba?: string, semPrefixoEhDaAba = true): string {
  let out = ''
  let i = 0
  while (i < f.length) {
    const ch = f[i]
    if (ch === '"') {
      const j = f.indexOf('"', i + 1)
      const fim = j < 0 ? f.length : j + 1
      out += f.slice(i, fim)
      i = fim
      continue
    }
    const prev = i > 0 ? f[i - 1] : ''
    let nomeAba: string | null = null
    let tamPrefixo = 0
    if (ch === "'") {
      // 'Nome da aba'!ref (apóstrofo duplo vale um apóstrofo)
      let j = i + 1
      let nome = ''
      while (j < f.length) {
        if (f[j] === "'" && f[j + 1] === "'") {
          nome += "'"
          j += 2
        } else if (f[j] === "'") break
        else nome += f[j++]
      }
      if (j < f.length && f[j + 1] === '!') {
        nomeAba = nome
        tamPrefixo = j + 2 - i
      } else {
        out += f.slice(i, Math.min(j + 1, f.length))
        i = Math.min(j + 1, f.length)
        continue
      }
    } else if (!/[A-Za-z0-9_.$]/.test(prev)) {
      const mp = /^([A-Za-z_À-￿][\w.À-￿]*)!/.exec(f.slice(i))
      if (mp) {
        nomeAba = mp[1]
        tamPrefixo = mp[0].length
      }
    }

    if (nomeAba !== null) {
      const prefixo = f.slice(i, i + tamPrefixo)
      const resto = f.slice(i + tamPrefixo)
      const meu = aba !== undefined && nomeAba === aba
      const mr = REF.exec(resto)
      if (mr) {
        const novo = meu ? refAjustada(mr, r1, r2) : mr[0]
        out += novo === '#REF!' ? novo : prefixo + novo
        i += tamPrefixo + mr[0].length
        continue
      }
      const ml = LINHAS_INTEIRAS.exec(resto)
      if (ml) {
        const novo = meu ? ajustarLinhas(Number(ml[2]), Number(ml[4]), r1, r2) : [Number(ml[2]), Number(ml[4])]
        out += novo ? prefixo + ml[1] + novo[0] + ':' + ml[3] + novo[1] : '#REF!'
        i += tamPrefixo + ml[0].length
        continue
      }
      out += prefixo
      i += tamPrefixo
      continue
    }

    if (!/[A-Za-z0-9_.!]/.test(prev)) {
      const m = REF.exec(f.slice(i))
      if (m) {
        out += semPrefixoEhDaAba ? refAjustada(m, r1, r2) : m[0]
        i += m[0].length
        continue
      }
    }
    out += ch
    i++
  }
  return out
}

// ---------------- apagar linhas da aba ----------------

/** Reescreve o atributo de intervalo; some com o elemento se o intervalo sumiu. */
function ajustarAtributo(el: Element, attr: string, r1: number, r2: number, lista: boolean): boolean {
  const atual = el.getAttribute(attr)
  if (!atual) return false
  const novo = lista ? ajustarSqref(atual, r1, r2) : (ajustarIntervalo(atual, r1, r2) ?? '')
  if (novo === atual) return false
  if (!novo) el.parentNode?.removeChild(el)
  else el.setAttribute(attr, novo)
  return true
}

function ajustarCelulasEFormulas(ed: SheetEditor, r1: number, r2: number) {
  const n = r2 - r1 + 1
  for (const row of children(ed.sheetData, 'row')) {
    const r = Number(row.getAttribute('r'))
    if (r >= r1 && r <= r2) {
      ed.sheetData.removeChild(row)
      continue
    }
    if (r > r2) {
      row.setAttribute('r', String(r - n))
      for (const c of children(row, 'c')) c.setAttribute('r', indexToCol(splitRef(c.getAttribute('r')!).col) + (r - n))
    }
  }
  for (const f of descendants(ed.sheetData, 'f')) {
    if (f.textContent) f.textContent = ajustarFormulaApagando(f.textContent, r1, r2)
    const ref = f.getAttribute('ref') // fórmula de matriz
    if (ref) {
      const novo = ajustarIntervalo(ref, r1, r2)
      if (novo) f.setAttribute('ref', novo)
      else f.removeAttribute('ref')
    }
  }
}

function ajustarMesclagens(root: Element, r1: number, r2: number) {
  const mc = child(root, 'mergeCells')
  if (!mc) return
  for (const m of children(mc, 'mergeCell')) {
    const ref = m.getAttribute('ref')!
    const novo = ajustarIntervalo(ref, r1, r2)
    // mesclagem que sobrou com uma célula só não é mais mesclagem
    if (!novo || !novo.includes(':')) mc.removeChild(m)
    else m.setAttribute('ref', novo)
  }
  const resto = children(mc, 'mergeCell').length
  if (resto) mc.setAttribute('count', String(resto))
  else root.removeChild(mc)
}

function ajustarQuebrasDePagina(root: Element, r1: number, r2: number) {
  const n = r2 - r1 + 1
  const rb = child(root, 'rowBreaks')
  if (!rb) return
  for (const b of children(rb, 'brk')) {
    const id = Number(b.getAttribute('id'))
    if (id >= r1 && id <= r2) rb.removeChild(b)
    else if (id > r2) b.setAttribute('id', String(id - n))
  }
  const resto = children(rb, 'brk').length
  if (resto) {
    rb.setAttribute('count', String(resto))
    if (rb.getAttribute('manualBreakCount')) rb.setAttribute('manualBreakCount', String(resto))
  } else root.removeChild(rb)
}

/**
 * A fórmula de formatação condicional e de validação de dados fica escrita para a
 * célula do canto superior esquerdo do sqref. Ao apagar linhas, essa célula sobe
 * junto com o sqref, então as referências da fórmula passam pela mesma conta.
 * Se a primeira área do sqref perdeu o começo (ou sumiu), o canto novo é outro e
 * as referências relativas acompanham a diferença.
 */
function ajustarFormulasDoGrupo(sqrefAntigo: string, sqrefNovo: string, formulas: Element[], r1: number, r2: number) {
  const n = r2 - r1 + 1
  const antes = parseRange(sqrefAntigo.trim().split(/\s+/)[0]).r1
  const depois = parseRange(sqrefNovo.trim().split(/\s+/)[0]).r1
  const esperado = antes > r2 ? antes - n : antes >= r1 ? r1 : antes
  for (const f of formulas) {
    const t = f.textContent ?? ''
    if (!t) continue
    f.textContent = shiftFormula(ajustarFormulaApagando(t, r1, r2), depois - esperado)
  }
}

function ajustarReferenciasDaAba(root: Element, r1: number, r2: number) {
  const dim = child(root, 'dimension')
  if (dim) ajustarAtributo(dim, 'ref', r1, r2, false)
  for (const tag of ['protectedRange', 'ignoredError']) {
    for (const el of descendants(root, tag)) ajustarAtributo(el, 'sqref', r1, r2, true)
  }
  // formatação condicional e validação de dados: sqref e fórmulas juntos
  const nomes: Record<string, string[]> = { conditionalFormatting: ['formula'], dataValidation: ['formula1', 'formula2'] }
  for (const [tag, nomesFormula] of Object.entries(nomes)) {
    for (const el of descendants(root, tag)) {
      const antigo = el.getAttribute('sqref')
      if (!antigo) continue
      const novo = ajustarSqref(antigo, r1, r2)
      if (!novo) el.parentNode?.removeChild(el)
      else {
        if (novo !== antigo) el.setAttribute('sqref', novo)
        ajustarFormulasDoGrupo(antigo, novo, nomesFormula.flatMap((nm) => descendants(el, nm)), r1, r2)
      }
    }
  }
  for (const tag of ['hyperlink', 'autoFilter', 'sortState', 'sortCondition']) {
    for (const el of descendants(root, tag)) ajustarAtributo(el, 'ref', r1, r2, false)
  }
  // versões novas (extLst): <xm:sqref>B2:B12</xm:sqref> com as fórmulas (<xm:f>) no elemento ao lado
  for (const el of descendants(root, 'sqref')) {
    const antigo = el.textContent ?? ''
    const novo = ajustarSqref(antigo, r1, r2)
    const grupo = el.parentNode as Element
    if (!novo) grupo.parentNode?.removeChild(grupo)
    else {
      if (novo !== antigo) el.textContent = novo
      ajustarFormulasDoGrupo(antigo, novo, descendants(grupo, 'f'), r1, r2)
    }
  }
}

/** Ajusta os desenhos (imagens e formas) da aba: sobem, encolhem ou somem se estavam só no trecho apagado. */
async function ajustarDesenhos(wb: Workbook, sheetPath: string, root: Element, r1: number, r2: number) {
  const dEl = child(root, 'drawing')
  if (!dEl) return
  const rid = dEl.getAttributeNS(NS.rel, 'id') ?? dEl.getAttribute('r:id')
  const rel = descendants(await wb.rels(sheetPath), 'Relationship').find((r) => r.getAttribute('Id') === rid)
  if (!rel) return
  const path = resolvePath(sheetPath, rel.getAttribute('Target')!)
  const doc = await wb.doc(path)
  const n = r2 - r1 + 1
  const linha = (pt: Element) => child(pt, 'row')
  /** Move um ponto (from ou to) e diz se estava dentro do trecho apagado. */
  const mover = (pt: Element): boolean => {
    const el = linha(pt)
    if (!el) return false
    const r = Number(el.textContent) + 1
    if (r > r2) {
      el.textContent = String(r - 1 - n)
      return false
    }
    if (r >= r1) {
      el.textContent = String(r1 - 1)
      const off = child(pt, 'rowOff')
      if (off) off.textContent = '0'
      return true
    }
    return false
  }
  let mudou = false
  for (const anc of [...descendants(doc, 'twoCellAnchor'), ...descendants(doc, 'oneCellAnchor')]) {
    const de = child(anc, 'from')
    const ate = child(anc, 'to')
    if (!de) continue
    const deDentro = mover(de)
    const ateDentro = ate ? mover(ate) : true
    // objeto que vivia só no trecho apagado vai embora junto com ele
    if (deDentro && ateDentro) anc.parentNode!.removeChild(anc)
    mudou = true
  }
  if (mudou) wb.touch(path)
}

/** Camada VML da aba (caixas de seleção, fotos vinculadas): sobe âncoras e linhas. */
async function ajustarVml(wb: Workbook, sheetPath: string, root: Element, r1: number, r2: number) {
  const leg = child(root, 'legacyDrawing')
  if (!leg) return
  const rid = leg.getAttributeNS(NS.rel, 'id') ?? leg.getAttribute('r:id')
  const rel = descendants(await wb.rels(sheetPath), 'Relationship').find((r) => r.getAttribute('Id') === rid)
  const f = rel ? wb.zip.file(resolvePath(sheetPath, rel.getAttribute('Target')!)) : null
  if (!rel || !f) return
  const n = r2 - r1 + 1
  const mover0 = (r0: number) => {
    const r = r0 + 1
    return r > r2 ? r0 - n : r >= r1 ? r1 - 1 : r0
  }
  const vml = await f.async('string')
  const novo = vml
    .replace(/<x:Anchor>([^<]*)<\/x:Anchor>/g, (_m, t: string) => {
      const p = t.split(',')
      if (p.length >= 8) {
        p[2] = ' ' + mover0(Number(p[2]))
        p[6] = ' ' + mover0(Number(p[6]))
      }
      return `<x:Anchor>${p.map((x, i) => (i === 0 ? x.trim() : x)).join(',')}</x:Anchor>`
    })
    .replace(/<x:Row>(\d+)<\/x:Row>/g, (_m, r: string) => `<x:Row>${mover0(Number(r))}</x:Row>`)
  if (novo !== vml) wb.zip.file(resolvePath(sheetPath, rel.getAttribute('Target')!), novo)
}

/** Nomes definidos (área de impressão, títulos) e fórmulas de outras abas que citam esta aba. */
async function ajustarForaDaAba(wb: Workbook, nomeAba: string, sheetPath: string, r1: number, r2: number) {
  const book = await wb.doc('xl/workbook.xml')
  for (const dn of descendants(book, 'definedName')) {
    const t = dn.textContent ?? ''
    const novo = ajustarFormulaApagando(t, r1, r2, nomeAba, false)
    if (novo !== t) {
      dn.textContent = novo
      wb.touch('xl/workbook.xml')
    }
  }
  for (const s of wb.sheets) {
    if (s.path === sheetPath || !(await wb.contains(s.path, nomeAba))) continue
    const d = await wb.doc(s.path)
    let mudou = false
    for (const f of descendants(d, 'f')) {
      const t = f.textContent ?? ''
      if (!t.includes(nomeAba)) continue
      const novo = ajustarFormulaApagando(t, r1, r2, nomeAba, false)
      if (novo !== t) {
        f.textContent = novo
        mudou = true
      }
    }
    if (mudou) wb.touch(s.path)
  }
}

/**
 * Apaga as linhas r1..r2 (contando de 1) de uma aba, como o Excel faz: as de baixo
 * sobem e tudo que aponta para elas (fórmulas, mesclagens, formatação condicional,
 * imagens, área de impressão) acompanha.
 */
export async function apagarLinhas(wb: Workbook, aba: string, r1: number, r2: number): Promise<void> {
  if (r2 < r1) return
  const info = wb.sheet(aba)
  if (!info) throw new Error('Aba não encontrada: ' + aba)
  const doc = await wb.doc(info.path)
  wb.touch(info.path)
  const ed = new SheetEditor(doc, wb.sharedStrings)
  unshareFormulas(ed)
  ajustarCelulasEFormulas(ed, r1, r2)
  ajustarMesclagens(ed.root, r1, r2)
  ajustarQuebrasDePagina(ed.root, r1, r2)
  ajustarReferenciasDaAba(ed.root, r1, r2)
  await ajustarDesenhos(wb, info.path, ed.root, r1, r2)
  await ajustarVml(wb, info.path, ed.root, r1, r2)
  await ajustarForaDaAba(wb, info.name, info.path, r1, r2)
}
