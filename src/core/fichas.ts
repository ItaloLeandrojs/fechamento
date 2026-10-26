import { SheetEditor, indexToCol, type Range } from './sheet'
import { caixaDoIntervalo, encaixar, inserirImagem, removerFotosVinculadas, removerImagensNaFaixa, type Caixa, type Imagem } from './images'
import { apagarLinhas } from './linhas'
import { normalizarRotulo, valorDoRotulo } from './rotulos'
import type { Workbook } from './workbook'

const EMU_PX = 9525

export interface Tecnico {
  nome: string
  registro: number | string
  carimbo?: Imagem
}

export interface PontoAterramento {
  rua: string
  ponto: string
  tipoPoste: 'CONC' | 'MAD' | ''
  ohms: number | null
  hastes: number | null
  fotoVala?: Imagem
  fotoMedicao?: Imagem
}

export interface DadosInstalado {
  potencia?: string
  patrimonio?: string
  fase?: string
  serie?: string
  marca?: string
  ano?: string
  nInstalacao?: string
  tensoes?: Partial<Record<'NA' | 'NB' | 'NC' | 'AB' | 'AC' | 'BC', number>>
}

export interface DadosRetirado {
  potencia?: string
  patrimonio?: string
  serie?: string
  marca?: string
  ano?: string
  nInstalacao?: string
}

export interface Equipamento {
  ponto: string
  instalado: DadosInstalado
  retirado: DadosRetirado
  fotos: Imagem[] // até 2
}

/** Dia de hoje no formato de data do Excel (dias desde 30/12/1899). */
export function dataExcel(d: Date): number {
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((utc - Date.UTC(1899, 11, 30)) / 86400000)
}

/** "2025" ou "03/2025" → data do Excel do dia 1º (o campo da ficha é mês/ano). */
export function mesAnoExcel(s: string | undefined): number | string | null {
  if (!s || !s.trim()) return null
  const m = /^\s*(?:(\d{1,2})\s*[/-]\s*)?(\d{4})\s*$/.exec(s)
  if (!m) return s.trim()
  return dataExcel(new Date(Number(m[2]), m[1] ? Number(m[1]) - 1 : 0, 1))
}

/** Número quando o texto é um número puro; senão o próprio texto. */
function numOuTexto(s: string | undefined): number | string | null {
  if (s === undefined || s.trim() === '') return null
  const t = s.trim().replace(',', '.')
  return /^-?\d+(\.\d+)?$/.test(t) && !/^0\d/.test(t) ? Number(t) : s.trim()
}

async function editor(wb: Workbook, nome: string): Promise<SheetEditor> {
  const info = wb.sheet(nome)!
  wb.touch(info.path)
  return new SheetEditor(await wb.doc(info.path), wb.sharedStrings)
}

function rangeOuCelula(ed: SheetEditor, col: number, row: number): Range {
  return ed.mergeAt(indexToCol(col) + row) ?? { c1: col, r1: row, c2: col, r2: row }
}

// ---------------- carimbo ----------------

/** Abas de cadastro, que nunca levam carimbo. */
const SEM_CARIMBO = ['ADS', 'MaterialServico', 'Colaborador', 'Plan1']

interface Rodape {
  linhaInicio: number // primeira linha do rodapé (rótulo "Registro" de cima)
  linhaNome: number
  registro: string // célula do registro da parceira
  nome: string // célula do nome
  nomeRange: Range
  topoLivre: number | null // EMU: fim do bloco de cima (Colaborador EDP), se houver
}

/**
 * O rodapé de assinatura tem dois blocos "Registro": o de cima é da EDP e o de
 * baixo é da parceira (Cosampa). Cada inventário vem um pouco diferente
 * (fórmula para a Check-list, valor digitado, rótulo trocado), então a busca
 * é pela posição, e não pelo texto "Colaborador Parceira".
 */
export function acharRodape(ed: SheetEditor): Rodape | undefined {
  const regs = ed.findText('Registro').sort((a, b) => a.row - b.row)
  if (!regs.length) return undefined
  const baixo = regs[regs.length - 1]
  const regRow = baixo.row + 1
  // o rótulo "Registro" pode ser mesclado em várias colunas (Ficha Equipamento: C:E) e a matrícula
  // ocupar só uma delas (E): vale a primeira coluna do rótulo, na linha de baixo, que tenha
  // conteúdo, fórmula ou que abra uma mesclagem
  const rotulo = rangeOuCelula(ed, baixo.col, baixo.row)
  let regCol = rotulo.c1
  for (let c = rotulo.c1; c <= rotulo.c2; c++) {
    const ref = indexToCol(c) + regRow
    const cel = ed.cell(ref)
    const m = ed.mergeAt(ref)
    if ((cel && (ed.formula(cel) || ed.cellValue(cel) !== null)) || (m && m.c1 === c && (m.c2 > m.c1 || m.r2 > m.r1))) {
      regCol = c
      break
    }
  }
  const regRange = rangeOuCelula(ed, regCol, regRow)
  // nome: primeira célula à direita do registro que tenha conteúdo ou abra uma mesclagem
  let nomeCol = regRange.c2 + 1
  for (let c = regRange.c2 + 1; c <= regRange.c2 + 8; c++) {
    const ref = indexToCol(c) + regRow
    const cel = ed.cell(ref)
    if ((cel && (ed.formula(cel) || ed.cellValue(cel) !== null)) || ed.mergeAt(ref)?.c1 === c) {
      nomeCol = c
      break
    }
  }
  const nomeRange = rangeOuCelula(ed, nomeCol, regRow)
  let topoLivre: number | null = null
  const cima = regs.length > 1 ? regs[regs.length - 2] : undefined
  if (cima && cima.row < baixo.row) {
    // bloco de cima: rótulo, registro, "Colaborador EDP" → livre a partir do fim dessa terceira linha
    const fim = { c1: cima.col, r1: cima.row + 2, c2: cima.col, r2: cima.row + 2 }
    const cx = caixaDoIntervalo(ed, fim)
    topoLivre = cx.y + cx.h
  }
  return { linhaInicio: (cima ?? baixo).row, linhaNome: regRow, registro: indexToCol(regCol) + regRow, nome: indexToCol(nomeCol) + regRow, nomeRange, topoLivre }
}

/** Grava o valor só se a célula não puxar da Check-list (aí a fórmula já resolve). */
function gravarSeNaoVemDaCheckList(ed: SheetEditor, ref: string, v: string | number | null, ehCheckList: boolean) {
  const cel = ed.cell(ref)
  const f = cel ? ed.formula(cel)?.textContent ?? '' : ''
  if (!ehCheckList && /Check-list/i.test(f)) return
  ed.set(ref, v)
}

/**
 * Grava registro, nome e data e cola a imagem do carimbo acima da linha do
 * nome da parceira, em toda aba que tenha o rodapé de assinatura.
 */
export async function aplicarCarimbo(wb: Workbook, tec: Tecnico, hoje: Date): Promise<string[]> {
  const comCarimbo: string[] = []
  const check = wb.sheetByPrefix('Check-list')
  for (const s of wb.sheets) {
    if (SEM_CARIMBO.includes(s.name)) continue
    const ed = new SheetEditor(await wb.doc(s.path), wb.sharedStrings)
    const rod = acharRodape(ed)
    if (!rod) continue
    wb.touch(s.path)
    const ehCheck = s === check
    gravarSeNaoVemDaCheckList(ed, rod.registro, numOuTexto(String(tec.registro)), ehCheck)
    gravarSeNaoVemDaCheckList(ed, rod.nome, tec.nome.toUpperCase(), ehCheck)
    if (ehCheck) ed.setNumber(valorDoRotulo(ed, 'Data da fiscalização', 'Q4'), dataExcel(hoje))
    if (!tec.carimbo) continue
    await removerImagensNaFaixa(wb, s.name, rod.linhaInicio - 4, rod.linhaNome + 1)
    await removerFotosVinculadas(wb, s.name)

    const caixaNome = caixaDoIntervalo(ed, rod.nomeRange)
    const espaco = rod.topoLivre !== null ? caixaNome.y - rod.topoLivre - 4 * EMU_PX : 95 * EMU_PX
    const maxH = Math.max(40 * EMU_PX, Math.min(95 * EMU_PX, espaco))
    const maxW = Math.min(210 * EMU_PX, Math.max(caixaNome.w, 150 * EMU_PX))
    const esc = Math.min(maxW / tec.carimbo.width, maxH / tec.carimbo.height)
    const w = Math.round(tec.carimbo.width * esc)
    const h = Math.round(tec.carimbo.height * esc)
    const largura = Math.max(caixaNome.w, w)
    const alvo: Caixa = { x: Math.round(caixaNome.x + (largura - w) / 2), y: caixaNome.y - h - 2 * EMU_PX, w, h }
    await inserirImagem(wb, s.name, tec.carimbo, alvo, 'Carimbo')
    comCarimbo.push(s.name)
  }
  return comCarimbo
}

// ---------------- ficha de medição de aterramento ----------------

export async function aplicarAterramento(wb: Workbook, pontos: PontoAterramento[]): Promise<void> {
  if (!pontos.length) return
  const aba = wb.sheetByPrefix('Ficha Medi')
  if (!aba) throw new Error('A aba "Ficha Medição Aterramento" não existe neste inventário.')
  const ed = await editor(wb, aba.name)

  // tabela: começa duas linhas abaixo do cabeçalho "RUA / AVENIDA / ESTRADA"
  const cab = ed.findText('RUA / AVENIDA / ESTRADA')[0]
  if (!cab) throw new Error('Cabeçalho da tabela de aterramento não encontrado.')
  const col = (rotulo: string, padrao: number) => ed.findText(rotulo).find((c) => c.row >= cab.row && c.row <= cab.row + 1)?.col ?? padrao
  const cPonto = col('Numero do Ponto (Projeto)', 7)
  const cConc = col('CONC', 8)
  const cMad = col('MAD', 9)
  const cOhms = col('MEDIÇÃO FINAL (Ohms)', 10)
  const cHastes = col('QT. HASTES', 12)

  const blocos = blocosDeFoto(ed)
  const primeiraFoto = blocos.length ? blocos[0].row : ed.lastRow
  const linhasTabela: number[] = []
  for (let r = cab.row + 2; r < primeiraFoto; r++) if (ed.mergeAt(indexToCol(cab.col) + r)) linhasTabela.push(r)

  if (pontos.length > linhasTabela.length) {
    throw new Error(
      `A tabela da ficha de aterramento deste inventário tem ${linhasTabela.length} linha(s) e foram lançados ${pontos.length} pontos. ` +
        'Se ela já foi preenchida antes, as linhas que sobravam foram apagadas: use o inventário original da EDP.',
    )
  }
  if (pontos.length > blocos.length) {
    throw new Error(
      `A ficha de aterramento deste inventário tem ${blocos.length} quadro(s) de foto e foram lançados ${pontos.length} pontos. ` +
        'Se ela já foi preenchida antes, os quadros que sobravam foram apagados: use o inventário original da EDP.',
    )
  }

  pontos.forEach((p, i) => {
    const r = linhasTabela[i]
    ed.set(indexToCol(cab.col) + r, p.rua || null)
    ed.set(indexToCol(cPonto) + r, p.ponto || null)
    ed.set(indexToCol(cConc) + r, p.tipoPoste === 'CONC' ? 'X' : null)
    ed.set(indexToCol(cMad) + r, p.tipoPoste === 'MAD' ? 'X' : null)
    ed.set(indexToCol(cOhms) + r, p.ohms)
    ed.set(indexToCol(cHastes) + r, p.hastes)
  })

  for (let i = 0; i < pontos.length; i++) {
    const p = pontos[i]
    const b = blocos[i]
    ed.set(b.valorEsq, p.ponto)
    ed.set(b.valorDir, p.ponto)
    if (p.fotoVala) {
      ed.setBlank(indexToCol(b.caixaEsq.c1) + b.caixaEsq.r1)
      await inserirImagem(wb, aba.name, p.fotoVala, encaixar(caixaDoIntervalo(ed, b.caixaEsq), p.fotoVala), `Vala ${p.ponto}`)
    }
    if (p.fotoMedicao) {
      ed.setBlank(indexToCol(b.caixaDir.c1) + b.caixaDir.r1)
      await inserirImagem(wb, aba.name, p.fotoMedicao, encaixar(caixaDoIntervalo(ed, b.caixaDir), p.fotoMedicao), `Medição ${p.ponto}`)
    }
  }

  // tira o que sobrou da ficha, de baixo para cima (os números das linhas de cima continuam valendo):
  // primeiro os quadros de foto sem ponto, depois as linhas da tabela sem ponto
  if (pontos.length < blocos.length) await apagarLinhas(wb, aba.name, blocos[pontos.length].row, blocos[blocos.length - 1].caixaEsq.r2)
  if (pontos.length < linhasTabela.length) await apagarLinhas(wb, aba.name, linhasTabela[pontos.length], linhasTabela[linhasTabela.length - 1])
  wb.unhideSheet(aba.name)
}

interface BlocoFoto {
  row: number
  valorEsq: string
  valorDir: string
  caixaEsq: Range
  caixaDir: Range
}

/** Blocos "Ponto ___ / Ponto ___" com os dois quadros de foto logo abaixo. */
export function blocosDeFoto(ed: SheetEditor): BlocoFoto[] {
  const rotulos = ed.findText('Ponto')
  const porLinha = new Map<number, number[]>()
  for (const r of rotulos) porLinha.set(r.row, [...(porLinha.get(r.row) ?? []), r.col])
  const out: BlocoFoto[] = []
  for (const [row, cols] of [...porLinha].sort((a, b) => a[0] - b[0])) {
    if (cols.length < 2) continue
    cols.sort((a, b) => a - b)
    const [ce, cd] = cols
    const caixaEsq = ed.mergeAt(indexToCol(ce) + (row + 1))
    const caixaDir = ed.mergeAt(indexToCol(cd) + (row + 1))
    if (!caixaEsq || !caixaDir) continue
    const valor = (c: number) => indexToCol(rangeOuCelula(ed, c, row).c2 + 1) + row
    out.push({ row, valorEsq: valor(ce), valorDir: valor(cd), caixaEsq, caixaDir })
  }
  return out
}

// ---------------- ficha de equipamento ----------------

/** Rótulos que precisam estar no lugar de sempre (coluna, linhas abaixo do "Ponto"). */
const ROTULOS_EQUIPAMENTO: [number, number, string][] = [
  [3, 1, 'POTÊNCIA (KVA)'],
  [6, 1, 'PATRIMÔNIO'],
  [10, 1, 'SÉRIE'],
  [12, 1, 'MARCA'],
  [3, 6, 'POTÊNCIA (KVA)'],
  [6, 6, 'PATRIMÔNIO'],
  [8, 6, 'SÉRIE'],
  [11, 6, 'MARCA'],
]

/**
 * Os dados do transformador são gravados a uma distância fixa do "Ponto".
 * Se o desenho da ficha for outro, para em vez de gravar no lugar errado.
 */
/** Lugares de equipamento da ficha: rótulo "Ponto" na coluna B (esquerda) ou T (direita). */
export function vagasEquipamento(ed: SheetEditor): { row: number; col: number }[] {
  return ed
    .findText('Ponto')
    .filter((r) => r.col === 2 || r.col === 20)
    .sort((a, b) => a.row - b.row || a.col - b.col)
}

/** Confere o desenho de um lugar de equipamento (para com erro explicado se for outro). */
export function conferirVagaEquipamento(ed: SheetEditor, vaga: { row: number; col: number }) {
  const d = vaga.col - 2
  conferirDesenhoEquipamento(ed, (col, row) => indexToCol(col + d) + row, vaga.row)
}

function conferirDesenhoEquipamento(ed: SheetEditor, at: (col: number, row: number) => string, p: number) {
  for (const [col, dl, rotulo] of ROTULOS_EQUIPAMENTO) {
    const ref = at(col, p + dl)
    const visto = String(ed.value(ref) ?? '')
    if (normalizarRotulo(visto) !== normalizarRotulo(rotulo)) {
      throw new Error(
        `A ficha de equipamento deste inventário tem outro desenho: em ${ref} devia estar "${rotulo}" e está "${visto.trim() || 'vazio'}". ` +
          'O site não preencheu a ficha para não errar. Mande este inventário para conferência.',
      )
    }
  }
}

export async function aplicarEquipamentos(wb: Workbook, equips: Equipamento[]): Promise<void> {
  if (!equips.length) return
  const aba = wb.sheetByPrefix('Ficha Equipamento')
  if (!aba) throw new Error('A aba "Ficha Equipamento" não existe neste inventário.')
  const ed = await editor(wb, aba.name)

  // cada faixa tem dois equipamentos: esquerda (a partir de B) e direita (a partir de T)
  const vagas = vagasEquipamento(ed)
  if (equips.length > vagas.length) throw new Error(`A ficha tem lugar para ${vagas.length} equipamentos e foram lançados ${equips.length}.`)

  for (let i = 0; i < equips.length; i++) {
    const e = equips[i]
    const { row: p, col: c0 } = vagas[i]
    const d = c0 - 2 // deslocamento de colunas (0 à esquerda, 18 à direita)
    const at = (col: number, row: number) => indexToCol(col + d) + row
    conferirDesenhoEquipamento(ed, at, p)
    ed.set(at(5, p), e.ponto || null)
    const ins = e.instalado
    ed.set(at(3, p + 3), numOuTexto(ins.potencia))
    ed.set(at(6, p + 3), numOuTexto(ins.patrimonio))
    ed.set(at(8, p + 3), ins.fase || null)
    ed.set(at(10, p + 3), numOuTexto(ins.serie))
    ed.set(at(12, p + 3), ins.marca || null)
    ed.set(at(14, p + 3), mesAnoExcel(ins.ano))
    ed.set(at(16, p + 3), ins.nInstalacao || null)
    const tens = ins.tensoes ?? {}
    const colTensao: Record<string, number> = { NA: 5, NB: 7, NC: 9, AB: 11, AC: 13, BC: 15 }
    for (const [k, c] of Object.entries(colTensao)) ed.set(at(c, p + 4), tens[k as keyof typeof tens] ?? null)
    const ret = e.retirado
    ed.set(at(3, p + 7), numOuTexto(ret.potencia))
    ed.set(at(6, p + 7), numOuTexto(ret.patrimonio))
    ed.set(at(8, p + 7), numOuTexto(ret.serie))
    ed.set(at(11, p + 7), ret.marca || null)
    ed.set(at(14, p + 7), mesAnoExcel(ret.ano))
    ed.set(at(16, p + 7), ret.nInstalacao || null)

    const caixas = [ed.mergeAt(at(4, p + 9)), ed.mergeAt(at(11, p + 9))]
    for (let k = 0; k < Math.min(2, e.fotos.length); k++) {
      const cx = caixas[k]
      if (!cx) continue
      ed.setBlank(indexToCol(cx.c1) + cx.r1)
      await inserirImagem(wb, aba.name, e.fotos[k], encaixar(caixaDoIntervalo(ed, cx), e.fotos[k]), `Equipamento ${e.ponto} ${k + 1}`)
    }
  }
  wb.unhideSheet(aba.name)
}

// ---------------- desligamento programado ----------------

/** Maior intervalo mesclado da aba (na DP, o quadro da foto: B6:Z42). Pequeno demais não conta. */
export function maiorQuadro(ed: SheetEditor): Range | undefined {
  const area = (m: Range) => (m.c2 - m.c1 + 1) * (m.r2 - m.r1 + 1)
  const maior = ed.merges().sort((a, b) => area(b) - area(a))[0]
  return maior && maior.r2 - maior.r1 >= 10 && area(maior) >= 100 ? maior : undefined
}

export async function aplicarDP(wb: Workbook, foto: Imagem | undefined): Promise<void> {
  if (!foto) return
  const aba = wb.sheet('DP')
  if (!aba) throw new Error('A aba "DP" não existe neste inventário.')
  const ed = await editor(wb, aba.name)
  const livre = ed.findText('LIVRE')[0]
  // sem o LIVRE (arquivo que já passou pelo site, ou apagado à mão): o quadro é o maior bloco mesclado da aba
  const caixa = livre ? rangeOuCelula(ed, livre.col, livre.row) : maiorQuadro(ed)
  if (!caixa) throw new Error('Não achei o quadro da foto na aba DP (o espaço grande escrito LIVRE). Use o inventário original da EDP.')
  if (livre) ed.setBlank(livre.ref)
  // foto de um fechamento anterior no mesmo quadro: sai, para não ficar uma em cima da outra
  await removerImagensNaFaixa(wb, aba.name, caixa.r1, caixa.r2)
  await inserirImagem(wb, aba.name, foto, encaixar(caixaDoIntervalo(ed, caixa), foto, 6), 'Desligamento programado')
}
