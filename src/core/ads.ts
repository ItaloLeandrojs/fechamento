import { SheetEditor, indexToCol, shiftFormula, splitRef } from './sheet'
import { child, children, descendants } from './xml'
import type { Workbook } from './workbook'
import { gravarValorGuardado } from './cache'
import { criarFormatoNumero, criarPintorVermelho } from './estilos'
import { normalizarRotulo, valorDoRotulo } from './rotulos'

export const ADS_SHEET = 'ADS'

/** Grupos de operação: dentro do grupo um item pode cair em outra operação prevista. */
export const OPER_GROUPS: string[][] = [
  ['2000', '2010', '2020'], // instalação (ODI); 2000 tem preferência
  ['2030', '2040', '2050', '2060', '2070'], // retirada/sucata (ODD)
]

export function groupOf(oper: string): string[] {
  return OPER_GROUPS.find((g) => g.includes(oper)) ?? [oper]
}

export interface AdsRow {
  row: number
  id: number | null
  item: string
  oper: string
  code: number | null
  /** O código veio gravado como texto ("30050165"): sai convertido em número. */
  codigoEmTexto: boolean
  descricao: string
  unidade: string
  planejado: number
  aplicado: number | null
  ordem: string
}

/** Uma quantidade lançada no site (já somada por código e operação). */
export interface Lancamento {
  code: number
  oper: string
  qty: number
}

export interface Destino {
  code: number
  oper: string
  qty: number
  row: number | null // linha da ADS que recebeu; null = linha nova
  operUsada: string // operação da linha que recebeu ('' = linha nova, operação vazia)
  motivo: 'prevista' | 'outra-operacao' | 'nova'
}

// Colunas da ADS (fixas no modelo da EDP)
const COL = { id: 'A', item: 'B', oper: 'C', descOper: 'D', code: 'E', desc: 'F', unid: 'G', plan: 'H', apl: 'I', adic: 'J', dev: 'K', copiaPlan: 'O', ordem: 'P' }

function num(v: unknown): number {
  return typeof v === 'number' ? v : 0
}

function txt(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim()
}

/**
 * Código como número. Alguns inventários trazem o código como texto; sem isto
 * o item previsto não era reconhecido e o lançamento virava uma linha nova duplicada.
 * `emTexto` (converter para número na planilha) só vale para texto digitado: quando o
 * código é uma fórmula da EDP, outras fórmulas da linha (preço) procuram esse mesmo
 * texto na planilha externa, e trocar por número quebraria o valor da obra (#VALOR!).
 */
function lerCodigo(ed: SheetEditor, ref: string): { code: number | null; emTexto: boolean } {
  if (ed.isError(ref)) return { code: null, emTexto: false }
  const v = ed.value(ref)
  if (typeof v === 'number') return { code: v, emTexto: false }
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) {
    const cel = ed.cell(ref)
    return { code: Number(v.trim()), emTexto: !(cel && ed.formula(cel)) }
  }
  return { code: null, emTexto: false }
}

/** Títulos que a linha 1 da ADS precisa ter: o site grava por coluna fixa. */
const TITULOS: [string, string][] = [
  [COL.code, 'Código'],
  [COL.desc, 'Descrição'],
  [COL.unid, 'Unid.'],
  [COL.plan, 'Planejado'],
  [COL.apl, 'Aplicado'],
  [COL.adic, 'Adicional'],
  [COL.dev, 'Devolvido'],
]

/**
 * Para antes de gravar se as colunas da ADS não forem as do modelo da EDP:
 * gravar o Aplicado numa coluna trocada estragaria o fechamento sem aviso.
 */
export function conferirTitulosAds(ed: SheetEditor) {
  for (const [col, titulo] of TITULOS) {
    const visto = String(ed.value(col + '1') ?? '')
    if (normalizarRotulo(visto) !== normalizarRotulo(titulo)) {
      throw new Error(
        `A aba ADS deste inventário tem as colunas em outra ordem: a coluna ${col} devia ser "${titulo}" e é "${visto.trim() || 'vazia'}". ` +
          'O site não gravou nada para não errar o fechamento. Mande este inventário para conferência.',
      )
    }
  }
}

export function readAds(ed: SheetEditor): AdsRow[] {
  const out: AdsRow[] = []
  for (let r = 2; r <= ed.lastRow; r++) {
    if (!ed.row(r)) continue
    const { code, emTexto } = lerCodigo(ed, COL.code + r)
    const apl = ed.value(COL.apl + r)
    const idV = ed.value(COL.id + r)
    out.push({
      row: r,
      id: typeof idV === 'number' ? idV : null,
      item: txt(ed.value(COL.item + r)),
      oper: ed.isError(COL.oper + r) ? '' : txt(ed.value(COL.oper + r)),
      code,
      codigoEmTexto: emTexto,
      descricao: ed.isError(COL.desc + r) ? '' : txt(ed.value(COL.desc + r)),
      unidade: ed.isError(COL.unid + r) ? '' : txt(ed.value(COL.unid + r)),
      planejado: num(ed.value(COL.plan + r)),
      aplicado: typeof apl === 'number' ? apl : null,
      ordem: txt(ed.value(COL.ordem + r)),
    })
  }
  return out
}

/** Decide em que linha da ADS cada lançamento entra (regras combinadas com o Italo). */
export function decidirDestinos(rows: AdsRow[], lancs: Lancamento[]): Destino[] {
  const byCode = new Map<number, AdsRow[]>()
  for (const r of rows) {
    if (r.code === null) continue
    const list = byCode.get(r.code) ?? []
    list.push(r)
    byCode.set(r.code, list)
  }
  // soma lançamentos repetidos (mesmo código e operação)
  const soma = new Map<string, Lancamento>()
  for (const l of lancs) {
    if (!(l.qty > 0)) continue
    const k = l.code + '|' + l.oper
    const prev = soma.get(k)
    if (prev) prev.qty += l.qty
    else soma.set(k, { ...l })
  }
  const out: Destino[] = []
  for (const l of soma.values()) {
    const cands = byCode.get(l.code) ?? []
    const exata = cands.find((r) => r.oper === l.oper)
    if (exata) {
      out.push({ ...l, row: exata.row, operUsada: exata.oper, motivo: 'prevista' })
      continue
    }
    const grupo = groupOf(l.oper)
    const noGrupo = cands.filter((r) => grupo.includes(r.oper))
    const escolhida = noGrupo.find((r) => r.oper === grupo[0]) ?? noGrupo[0]
    if (escolhida) {
      out.push({ ...l, row: escolhida.row, operUsada: escolhida.oper, motivo: 'outra-operacao' })
      continue
    }
    out.push({ ...l, row: null, operUsada: '', motivo: 'nova' })
  }
  return out
}

/**
 * Troca fórmulas compartilhadas por fórmulas comuns, célula a célula.
 * Assim dá para apagar ou copiar qualquer célula sem quebrar as vizinhas.
 */
export function unshareFormulas(ed: SheetEditor) {
  const masters = new Map<string, { text: string; col: number; row: number }>()
  const fs = descendants(ed.sheetData, 'f')
  for (const f of fs) {
    if (f.getAttribute('t') === 'shared' && f.getAttribute('ref') && f.textContent) {
      const { col, row } = splitRef((f.parentNode as Element).getAttribute('r')!)
      masters.set(f.getAttribute('si')!, { text: f.textContent, col, row })
    }
  }
  for (const f of fs) {
    if (f.getAttribute('t') !== 'shared') continue
    const m = masters.get(f.getAttribute('si')!)
    if (!m) continue
    if (!f.textContent) {
      const { col, row } = splitRef((f.parentNode as Element).getAttribute('r')!)
      f.textContent = shiftFormula(m.text, row - m.row, col - m.col)
    }
    f.removeAttribute('t')
    f.removeAttribute('ref')
    f.removeAttribute('si')
  }
}

/**
 * Estica referências que terminavam entre `desde` e a nova última linha (ex.: B2:N123 → B2:N130).
 * `desde` é a última linha prevista: algumas ADS somam só até ela, e os itens novos que
 * entram nas reservas logo abaixo ficariam fora do total da Check-list e da impressão.
 */
export function growRangeEnds(text: string, desde: number, newLast: number): string {
  return text.replace(/:(\$?[A-Z]{1,3})(\$?)(\d+)(?!\d)/g, (m, c: string, d: string, n: string) =>
    Number(n) >= desde && Number(n) < newLast ? `:${c}${d}${newLast}` : m,
  )
}

async function growAdsReferences(wb: Workbook, ed: SheetEditor, desde: number, newLast: number) {
  const root = ed.root
  const dim = child(root, 'dimension')
  if (dim) dim.setAttribute('ref', growRangeEnds(dim.getAttribute('ref')!, desde, newLast))
  for (const tag of ['conditionalFormatting', 'protectedRange', 'dataValidation']) {
    for (const el of descendants(root, tag)) {
      const a = el.getAttribute('sqref')
      if (a) el.setAttribute('sqref', growRangeEnds(a, desde, newLast))
    }
  }
  for (const el of descendants(root, 'sortState')) el.setAttribute('ref', growRangeEnds(el.getAttribute('ref')!, desde, newLast))
  for (const el of descendants(root, 'sortCondition')) el.setAttribute('ref', growRangeEnds(el.getAttribute('ref')!, desde, newLast))
  for (const el of descendants(root, 'autoFilter')) el.setAttribute('ref', growRangeEnds(el.getAttribute('ref')!, desde, newLast))

  // nomes definidos (área de impressão) e fórmulas de outras abas que somam a ADS
  const book = await wb.doc('xl/workbook.xml')
  for (const dn of descendants(book, 'definedName')) {
    const t = dn.textContent ?? ''
    if (/^'?ADS'?!/.test(t)) {
      dn.textContent = growRangeEnds(t, desde, newLast)
      wb.touch('xl/workbook.xml')
    }
  }
  for (const s of wb.sheets) {
    if (s.name === ADS_SHEET || !(await wb.contains(s.path, 'ADS!'))) continue
    const d = await wb.doc(s.path)
    let mudou = false
    for (const f of descendants(d, 'f')) {
      const t = f.textContent ?? ''
      if (!t.includes('ADS!')) continue
      const novo = t.replace(/ADS!\$?[A-Z]{1,3}\$?\d+:\$?[A-Z]{1,3}\$?\d+/g, (m) => growRangeEnds(m, desde, newLast))
      if (novo !== t) {
        f.textContent = novo
        mudou = true
      }
    }
    if (mudou) wb.touch(s.path)
  }
}

export interface AdsResultado {
  destinos: Destino[]
  linhasNovas: number[]
  zeradas: number // linhas com código que ficaram com Aplicado 0
  mudaramDeValor: number // linhas que já tinham Aplicado e mudaram
}

/** Fórmula que busca em outro arquivo (ex.: [1]Dados, a planilha da EDP que gerou o inventário). */
const EXTERNA = /\[\d+\]/

/**
 * Fórmulas padrão da linha nova, todas na MaterialServico da própria planilha
 * (usadas quando a linha prevista do inventário não tem uma fórmula interna para copiar).
 * Preço: serviço (código 7…) pelo contrato (coluna A = código + contrato),
 * material só pelo código. Valor = preço x aplicado, como no modelo da EDP.
 * TRIM: a MaterialServico traz unidades como "KG " (com espaço) e o Valor de
 * Material da Check-list soma por unidade exata ("KG"); sem isso o item ficava de fora.
 */
const FORMULA_PADRAO: Record<string, (r: number, contrato: string) => string> = {
  [COL.desc]: (r) => `TRIM(VLOOKUP(E${r},MaterialServico!C:D,2,0))`,
  [COL.unid]: (r) => `TRIM(VLOOKUP(E${r},MaterialServico!C:E,3,0))`,
  L: (r) => `IF(I${r}<>"",(M${r}*I${r})+(I${r}*Q${r}),(H${r}*M${r})+(H${r}*Q${r}))`,
  M: (r, contrato) => `IFERROR(IF(LEFT(E${r},1)="7",VLOOKUP(E${r}&${contrato},MaterialServico!A:F,6,0),0),"0")`,
  Q: (r) => `IFERROR(IF(LEFT(E${r},1)<>"7",VLOOKUP(E${r},MaterialServico!B:F,5,0),0),"0")`,
}
/** Título que a coluna precisa ter para receber a fórmula de valor e preço. */
const TITULO_VALOR: Record<string, string> = { L: 'Valor', M: 'Valor Serviço', Q: 'Valor Material' }
/** Colunas que o site preenche à parte (código, quantidades); o resto da linha nova é arrumado aqui. */
const PREENCHIDAS = new Set<string>([COL.id, COL.item, COL.oper, COL.descOper, COL.code, COL.plan, COL.apl, COL.adic, COL.dev, COL.copiaPlan])

/**
 * Arruma a linha nova para qualquer modelo de inventário, com as mesmas contas
 * das linhas previstas dele:
 * - descrição e unidade: sempre a fórmula padrão (com TRIM);
 * - valor e preços: a fórmula da última linha prevista, se for da própria planilha;
 *   se ela buscar em outro arquivo (ex.: [1]Dados, que não conhece o item novo)
 *   ou for só um valor colado, a fórmula padrão. A célula que faltar é criada;
 * - o resto que buscava fora ou trazia erro colado (#N/D das reservas) fica vazio.
 */
function prepararLinhaNova(ed: SheetEditor, r: number, modelo: number | null, temCatalogo: boolean, contrato: string) {
  const formulas = new Map<string, string>()
  if (temCatalogo) {
    for (const [col, padrao] of Object.entries(FORMULA_PADRAO)) {
      const titulo = TITULO_VALOR[col]
      if (titulo && normalizarRotulo(String(ed.value(col + '1') ?? '')) !== normalizarRotulo(titulo)) continue
      const fm = modelo !== null && titulo ? (child(ed.cell(col + modelo) ?? ed.root, 'f')?.textContent ?? '') : ''
      // só copia fórmula que acompanha a linha: travada ($62) ou constante traria o preço do item previsto
      const acompanha = fm && !EXTERNA.test(fm) && shiftFormula(fm, 1) !== fm
      formulas.set(col, acompanha ? shiftFormula(fm, r - modelo!) : padrao(r, contrato))
    }
  }
  for (const [col, f] of formulas) ed.setFormula(col + r, f)
  for (const c of children(ed.row(r)!, 'c')) {
    const ref = c.getAttribute('r')!
    const col = ref.replace(/\d+$/, '')
    if (formulas.has(col) || PREENCHIDAS.has(col)) continue
    const f = child(c, 'f')?.textContent ?? ''
    // erro ou texto vazio colado (reservas do modelo colado): texto vazio numa conta dá #VALOR!, célula vazia conta zero
    const coladoVazio = !f && (c.getAttribute('t') === 'e' || (typeof ed.cellValue(c) === 'string' && String(ed.cellValue(c)).trim() === ''))
    if (EXTERNA.test(f) || coladoVazio) ed.setBlank(ref)
    else if (f) {
      // fórmula interna: o valor guardado era o da linha vazia
      const v = child(c, 'v')
      if (v) c.removeChild(v)
      c.removeAttribute('t')
    }
  }
}

/** Célula do contrato na Check-list, achada pelo rótulo, como referência absoluta ('Check-list'!$G$6). */
async function referenciaDoContrato(wb: Workbook): Promise<string> {
  const ck = wb.sheetByPrefix('Check-list')
  if (!ck) return "'Check-list'!$G$6"
  const ref = valorDoRotulo(new SheetEditor(await wb.doc(ck.path), wb.sharedStrings), 'Contrato', 'G6')
  const { col, row } = splitRef(ref)
  return `'${ck.name.replace(/'/g, "''")}'!$${indexToCol(col)}$${row}`
}

/**
 * Linhas onde podem entrar os itens não previstos: as que vêm depois do último
 * item previsto, sem código e sem nada digitado de B a Q (fórmula, erro e vazio
 * podem; é assim que o modelo da EDP deixa as reservas; a coluna A traz o ID).
 * A primeira linha com texto ou número digitado (total, observação...) encerra
 * as reservas: nada é escrito por cima dela.
 */
export function linhasDeReserva(ed: SheetEditor, rows: AdsRow[]): { reservas: number[]; bloqueio: number | null } {
  const ultimaPrevista = rows.reduce((m, r) => (r.code !== null ? Math.max(m, r.row) : m), 1)
  const reservas: number[] = []
  for (const r of rows) {
    if (r.row <= ultimaPrevista || r.code !== null) continue
    const temDigitado = children(ed.row(r.row)!, 'c').some((c) => {
      const col = c.getAttribute('r')!.replace(/\d+$/, '')
      if (col === COL.id || col.length > 1 || col > 'Q' || child(c, 'f') || c.getAttribute('t') === 'e') return false
      const v = ed.cellValue(c)
      return typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')
    })
    if (temDigitado) return { reservas, bloqueio: r.row }
    reservas.push(r.row)
  }
  return { reservas, bloqueio: null }
}

/** Descrição e unidade de cada código (aba MaterialServico). */
export type Catalogo = Map<number, { desc: string; un: string }>

/**
 * Grava o valor guardado da descrição (F) e da unidade (G), que são PROCV na
 * MaterialServico: o Modo Protegido do Excel não recalcula e mostraria vazio.
 */
function guardarDescricao(ed: SheetEditor, r: number, code: number, catalogo: Catalogo) {
  const item = catalogo.get(code)
  for (const [col, campo] of [[COL.desc, 'desc'], [COL.unid, 'un']] as const) {
    const c = ed.cell(col + r)
    const f = c && child(c, 'f')
    if (!c || !f || !(f.textContent ?? '').includes('MaterialServico')) continue
    if (item) gravarValorGuardado(c, f, item[campo], false)
    else gravarValorGuardado(c, f, '#N/A', true)
  }
}

/** Grava o Aplicado (e Adicional/Devolvido) na ADS. */
export async function aplicarAds(wb: Workbook, lancs: Lancamento[], catalogo: Catalogo = new Map(), extras: Catalogo = new Map()): Promise<AdsResultado> {
  const info = wb.sheet(ADS_SHEET)!
  const ed = new SheetEditor(await wb.doc(info.path), wb.sharedStrings)
  conferirTitulosAds(ed)
  wb.touch(info.path)
  unshareFormulas(ed)

  const rows = readAds(ed)
  const destinos = decidirDestinos(rows, lancs)

  const porLinha = new Map<number, number>()
  for (const d of destinos) if (d.row !== null) porLinha.set(d.row, (porLinha.get(d.row) ?? 0) + d.qty)

  // coluna do código no formato "Número" (no modelo da EDP ela vem como "Geral")
  const formatoNumero = await criarFormatoNumero(wb)

  let zeradas = 0
  let mudaram = 0
  const escreverQuantidades = (r: number, plan: number, apl: number) => {
    ed.setNumber(COL.apl + r, apl)
    const dif = Math.round((apl - plan) * 1e6) / 1e6
    if (dif > 0) ed.setNumber(COL.adic + r, dif)
    else ed.setBlank(COL.adic + r)
    if (dif < 0) ed.setNumber(COL.dev + r, -dif)
    else ed.setBlank(COL.dev + r)
  }

  for (const r of rows) {
    if (r.code === null) continue
    if (r.codigoEmTexto) {
      ed.setNumber(COL.code + r.row, r.code)
      guardarDescricao(ed, r.row, r.code, catalogo)
    }
    formatoNumero(ed.cell(COL.code + r.row)!)
    const apl = porLinha.get(r.row) ?? 0
    if (apl === 0) zeradas++
    if (r.aplicado !== null && Math.abs(r.aplicado - apl) > 1e-9) mudaram++
    escreverQuantidades(r.row, r.planejado, apl)
  }

  // linhas novas: soma por código dentro do mesmo grupo de operação
  const novas = new Map<string, { code: number; qty: number }>()
  for (const d of destinos) {
    if (d.row !== null) continue
    const k = d.code + '|' + groupOf(d.oper).join(',')
    const prev = novas.get(k)
    if (prev) prev.qty += d.qty
    else novas.set(k, { code: d.code, qty: d.qty })
  }

  const { reservas, bloqueio } = linhasDeReserva(ed, rows)
  const contrato = await referenciaDoContrato(wb)
  // a última linha prevista é o modelo das contas (valor e preços) da linha nova
  const ultimaPrevista = rows.reduce<number | null>((m, x) => (x.code !== null ? Math.max(m ?? 0, x.row) : m), null)
  const oldLast = ed.lastRow
  let last = oldLast
  const linhasNovas: number[] = []
  const pintarVermelho = await criarPintorVermelho(wb)
  for (const [chave, n] of novas) {
    let r = reservas.shift()
    if (r === undefined) {
      if (bloqueio !== null) {
        throw new Error(
          `A ADS não tem linhas livres para os ${novas.size} itens não previstos: a linha ${bloqueio} tem conteúdo e o site não escreve por cima dela. ` +
            'Abra o inventário, insira linhas em branco antes dela e tente de novo.',
        )
      }
      last += 1
      ed.copyRow(last - 1, last)
      r = last
    }
    linhasNovas.push(r)
    ed.setBlank(COL.id + r)
    ed.setBlank(COL.item + r)
    ed.setBlank(COL.oper + r)
    ed.setBlank(COL.descOper + r)
    ed.setNumber(COL.code + r, n.code)
    formatoNumero(ed.cell(COL.code + r)!)
    ed.setNumber(COL.plan + r, 0)
    if (ed.cell(COL.copiaPlan + r)) ed.setNumber(COL.copiaPlan + r, 0)
    escreverQuantidades(r, 0, n.qty)
    prepararLinhaNova(ed, r, ultimaPrevista, !!wb.sheet('MaterialServico'), contrato)
    const extra = !catalogo.has(n.code) ? extras.get(n.code) : undefined
    if (extra) {
      // cadastrado no site e ausente da MaterialServico desta obra: o PROCV daria #N/D
      ed.setString(COL.desc + r, extra.desc)
      ed.setString(COL.unid + r, extra.un)
    } else guardarDescricao(ed, r, n.code, catalogo)
    // item que não estava previsto: a linha inteira em vermelho
    pintarVermelho(ed.row(r)!)
    // registra em que linha cada lançamento novo caiu
    for (const d of destinos) {
      if (d.motivo === 'nova' && d.code + '|' + groupOf(d.oper).join(',') === chave) d.row = r
    }
  }
  // somas e área de impressão passam a cobrir até a última linha nova (no fim da planilha ou nas reservas)
  const ateNova = Math.max(...linhasNovas)
  if (linhasNovas.length) await growAdsReferences(wb, ed, Math.min(ultimaPrevista ?? oldLast, oldLast), ateNova)

  return { destinos, linhasNovas, zeradas, mudaramDeValor: mudaram }
}

