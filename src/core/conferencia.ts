import { Workbook } from './workbook'
import { SheetEditor } from './sheet'
import { child } from './xml'
import { ADS_SHEET, readAds } from './ads'
import { dataExcel } from './fichas'
import { nomesDasImagens } from './images'
import { valorDoRotulo } from './rotulos'
import type { DadosFechamento, ResultadoFechamento } from './build'

export interface Conferencia {
  /** O que não bateu, em frases para a tela. Vazio = tudo certo. */
  problemas: string[]
  /** Quantas verificações foram feitas (para mostrar "N itens conferidos"). */
  conferidos: number
}

/** Abas que levam o carimbo da parceira, quando existem no inventário. */
const ABAS_COM_CARIMBO = ['Check-list', 'Ficha Medi', 'Ficha Equipamento', 'Ficha Ramal', 'Reparo', 'DP']
const EXTERNA = /\[\d+\]/
const fmt = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',')

/**
 * Abre o arquivo que acabou de ser gerado e confere, célula por célula, se
 * ficou o que foi lançado. Serve de rede de segurança para inventários com
 * modelo diferente: o que não bater aparece na tela antes de baixar.
 */
export async function conferirArquivo(arquivo: Uint8Array, dados: DadosFechamento, res: Omit<ResultadoFechamento, 'arquivo'>): Promise<Conferencia> {
  const problemas: string[] = []
  let conferidos = 0
  const ok = (cond: boolean, problema: string) => {
    conferidos++
    if (!cond) problemas.push(problema)
  }
  const wb = await Workbook.open(arquivo)
  const ads = new SheetEditor(await wb.sheetDoc(ADS_SHEET), wb.sharedStrings)

  // ---- ADS: aplicado de cada linha que recebeu lançamento
  const porLinha = new Map<number, { codigo: number; qtd: number }>()
  for (const d of res.ads.destinos) {
    if (d.row === null) continue
    const atual = porLinha.get(d.row)
    porLinha.set(d.row, { codigo: d.code, qtd: (atual?.qtd ?? 0) + d.qty })
  }
  for (const [r, { codigo, qtd }] of porLinha) {
    const apl = ads.value('I' + r)
    ok(typeof apl === 'number' && Math.abs(apl - qtd) < 1e-6, `ADS linha ${r}, código ${codigo}: foi lançado ${fmt(qtd)} e o Aplicado ficou ${apl ?? 'vazio'}.`)
    ok(Number(ads.value('E' + r)) === codigo, `ADS linha ${r}: devia ser o código ${codigo} e está ${ads.value('E' + r) ?? 'vazio'}.`)
  }
  // toda linha com código fica com Aplicado escrito (0 quando não foi lançada)
  const linhas = readAds(ads).filter((x) => x.code !== null)
  const semAplicado = linhas.filter((x) => typeof ads.value('I' + x.row) !== 'number').map((x) => x.row)
  ok(!semAplicado.length, `ADS: ${semAplicado.length} linha(s) ficaram sem Aplicado (ex.: linha ${semAplicado[0]}).`)
  const emTexto = linhas.filter((x) => x.codigoEmTexto && !child(ads.cell('E' + x.row)!, 'f')).map((x) => x.row)
  ok(!emTexto.length, `ADS: ${emTexto.length} código(s) continuam gravados como texto (ex.: linha ${emTexto[0]}).`)

  // ---- linhas novas: descrição e unidade de verdade, nada preso à planilha externa
  for (const r of res.ads.linhasNovas) {
    const codigo = ads.value('E' + r)
    ok(typeof codigo === 'number', `ADS linha nova ${r}: o código não ficou como número.`)
    const desc = ads.value('F' + r)
    const un = ads.value('G' + r)
    ok(
      typeof desc === 'string' && desc.trim() !== '' && desc !== '#N/A' && typeof un === 'string' && un.trim() !== '' && un !== '#N/A',
      `O código ${codigo} não está na aba MaterialServico deste inventário: a linha ${r} vai sair sem descrição (#N/D). Confira o código.`,
    )
    const presas = ['F', 'G', 'L', 'M', 'Q'].filter((col) => EXTERNA.test(child(ads.cell(col + r) ?? ads.root, 'f')?.textContent ?? ''))
    ok(!presas.length, `ADS linha nova ${r}: as colunas ${presas.join(', ')} ainda buscam na planilha externa da EDP.`)
  }

  // ---- Check-list: data, parcial/final, e se o total cobre os itens novos
  const ck = wb.sheetByPrefix('Check-list')
  if (ck) {
    const ed = new SheetEditor(await wb.doc(ck.path), wb.sharedStrings)
    if (dados.tecnico) {
      const ref = valorDoRotulo(ed, 'Data da fiscalização', 'Q4')
      ok(ed.value(ref) === dataExcel(dados.hoje ?? new Date()), `Check-list: a data da fiscalização (${ref}) não ficou com a data de hoje.`)
    }
    if (dados.boletim === 'parcial') ok(ed.value('W7') === 'X' && ed.value('X7') === 'PARCIAL', 'Check-list: a caixa PARCIAL (W7) não ficou marcada.')
    if (dados.boletim === 'final') ok(['W5', 'X5', 'W7', 'X7'].every((r) => ed.value(r) === null), 'Check-list: as caixas FINAL/PARCIAL deviam sair em branco.')
    const ultimaNova = Math.max(0, ...res.ads.linhasNovas)
    if (ultimaNova) {
      const curtas = new Set<number>()
      for (const f of Array.from(ed.root.getElementsByTagName('f'))) {
        for (const m of (f.textContent ?? '').matchAll(/ADS!\$?[A-Z]{1,3}\$?\d+:\$?[A-Z]{1,3}\$?(\d+)/g)) if (Number(m[1]) < ultimaNova) curtas.add(Number(m[1]))
      }
      ok(!curtas.size, `Check-list: o Valor de Material/Serviço soma a ADS só até a linha ${[...curtas][0]}, e há itens novos até a linha ${ultimaNova}.`)
    }
  }

  // ---- carimbo em cada aba de assinatura
  if (dados.tecnico?.carimbo) {
    for (const prefixo of ABAS_COM_CARIMBO) {
      const aba = wb.sheetByPrefix(prefixo)
      if (!aba) continue
      ok(res.abasComCarimbo.includes(aba.name) && (await nomesDasImagens(wb, aba.name)).includes('Carimbo'), `A aba "${aba.name}" ficou sem o carimbo.`)
    }
  }

  // ---- fotos nos quadros
  const fotos = new Map<string, string[]>()
  const imagens = async (prefixo: string) => {
    const aba = wb.sheetByPrefix(prefixo)
    if (!aba) return []
    if (!fotos.has(aba.name)) fotos.set(aba.name, await nomesDasImagens(wb, aba.name))
    return fotos.get(aba.name)!
  }
  for (const p of dados.aterramento) {
    const nomes = await imagens('Ficha Medi')
    if (p.fotoVala) ok(nomes.includes(`Vala ${p.ponto}`), `Aterramento: a foto da vala do ponto ${p.ponto} não entrou na ficha.`)
    if (p.fotoMedicao) ok(nomes.includes(`Medição ${p.ponto}`), `Aterramento: a foto da medição do ponto ${p.ponto} não entrou na ficha.`)
  }
  for (const e of dados.equipamentos) {
    const nomes = await imagens('Ficha Equipamento')
    e.fotos.slice(0, 2).forEach((_, k) => ok(nomes.includes(`Equipamento ${e.ponto} ${k + 1}`), `Equipamento do ponto ${e.ponto}: a foto ${k + 1} não entrou na ficha.`))
  }
  if (dados.fotoDP) ok((await imagens('DP')).includes('Desligamento programado'), 'DP: a foto do documento de desligamento não entrou no quadro.')

  return { problemas, conferidos }
}
