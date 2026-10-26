import { SheetEditor } from './sheet'
import { child } from './xml'
import type { Workbook } from './workbook'
import { ADS_SHEET, linhasDeReserva, readAds } from './ads'
import { acharRodape, blocosDeFoto, conferirVagaEquipamento, maiorQuadro, vagasEquipamento } from './fichas'
import { acharRotulo, normalizarRotulo } from './rotulos'

export interface Diagnostico {
  /** De onde vêm as contas da ADS: o que define o "modelo" do inventário. */
  modelo: string
  /** O que é diferente dos modelos já testados (vazio = modelo conhecido). */
  diferencas: string[]
}

const MODELOS: Record<string, string> = {
  procv: 'PROCV na aba MaterialServico',
  externa: 'fórmulas ligadas à planilha externa da EDP',
  colada: 'valores colados, sem fórmula',
}

/** Abas que o site preenche: sem elas, ou com outro desenho, aquela parte não funciona. */
const ABAS = ['Check-list', 'Ficha Medi', 'Ficha Equipamento', 'Ficha Ramal', 'Reparo', 'DP', 'MaterialServico']
const ROTULOS_CHECKLIST = ['Nota / OV', 'Contrato', 'Tipo Obra', 'Data da fiscalização', 'Valor de Material']
const TITULOS_VALOR: [string, string][] = [
  ['L', 'Valor'],
  ['M', 'Valor Serviço'],
  ['Q', 'Valor Material'],
]
const TITULOS_MATERIAL: [string, string][] = [
  ['A', 'Concatenado'],
  ['C', 'Material'],
  ['D', 'TxtBreveMaterial'],
  ['E', 'UMB'],
  ['F', 'PreçoUnit'],
]

/**
 * Raio-x do inventário ao abrir: confere tudo de que o site depende, como nos
 * inventários já testados (14 em 26/10/2026, de três modelos de ADS). Não muda
 * nada no arquivo. O que vier diferente vira aviso na tela, para a pessoa
 * conferir no Excel e mandar o inventário para ser testado.
 */
export async function diagnosticarInventario(wb: Workbook): Promise<Diagnostico> {
  const diferencas: string[] = []

  for (const prefixo of ABAS) if (!wb.sheetByPrefix(prefixo)) diferencas.push(`Não tem a aba "${prefixo}".`)

  // ---- ADS: de onde vêm descrição e preço, colunas de valor, reservas
  const ads = new SheetEditor(await wb.sheetDoc(ADS_SHEET), wb.sharedStrings)
  const rows = readAds(ads)
  const tipos = new Set<string>()
  for (const r of rows) {
    if (r.code === null) continue
    const f = child(ads.cell('F' + r.row) ?? ads.root, 'f')?.textContent ?? ''
    tipos.add(/\[\d+\]/.test(f) ? 'externa' : f.includes('MaterialServico') ? 'procv' : f ? 'outra' : 'colada')
  }
  const lista = [...tipos]
  const modelo = lista.length === 1 && MODELOS[lista[0]] ? MODELOS[lista[0]] : 'misturado ou desconhecido'
  if (!rows.some((r) => r.code !== null)) diferencas.push('A ADS não tem nenhum item previsto com código.')
  else if (lista.length !== 1 || !MODELOS[lista[0]]) diferencas.push('A descrição da ADS vem de um jeito que o site ainda não viu (mistura de fórmula, valor colado ou outra fórmula).')
  for (const [col, titulo] of TITULOS_VALOR) {
    const visto = String(ads.value(col + '1') ?? '')
    if (normalizarRotulo(visto) !== normalizarRotulo(titulo)) diferencas.push(`ADS: a coluna ${col} devia ser "${titulo}" e é "${visto.trim() || 'vazia'}" (o valor dos itens novos pode não sair).`)
  }
  const { bloqueio } = linhasDeReserva(ads, rows)
  if (bloqueio !== null) diferencas.push(`ADS: a linha ${bloqueio}, abaixo dos itens, tem conteúdo; os itens novos só cabem nas linhas vazias antes dela.`)

  // ---- MaterialServico: colunas que as fórmulas das linhas novas usam (lida só a linha 1: a aba é enorme)
  const ms = wb.sheet('MaterialServico')
  if (ms) {
    const xml = await wb.zip.file(ms.path)!.async('string')
    const linha1 = /<row\b[^>]*\br="1"[^>]*>([\s\S]*?)<\/row>/.exec(xml)?.[1] ?? ''
    for (const [col, titulo] of TITULOS_MATERIAL) {
      const c = new RegExp(`<c r="${col}1"([^>]*?)(?:/>|>([\\s\\S]*?)</c>)`).exec(linha1)
      const corpo = c?.[2] ?? ''
      const indice = /<v>(\d+)<\/v>/.exec(corpo)?.[1]
      const v = /t="s"/.test(c?.[1] ?? '') && indice !== undefined ? (wb.sharedStrings[Number(indice)] ?? '') : (/<t[^>]*>([\s\S]*?)<\/t>/.exec(corpo)?.[1] ?? '')
      if (normalizarRotulo(v) !== normalizarRotulo(titulo)) diferencas.push(`MaterialServico: a coluna ${col} devia ser "${titulo}" e é "${v.trim() || 'vazia'}".`)
    }
  }

  // ---- Check-list: rótulos que o site procura
  const ck = wb.sheetByPrefix('Check-list')
  if (ck) {
    const ed = new SheetEditor(await wb.doc(ck.path), wb.sharedStrings)
    for (const r of ROTULOS_CHECKLIST) if (!acharRotulo(ed, r)) diferencas.push(`Check-list: não achei o campo "${r}".`)
  }

  // ---- fichas
  const editor = async (prefixo: string) => {
    const aba = wb.sheetByPrefix(prefixo)
    return aba ? { aba, ed: new SheetEditor(await wb.doc(aba.path), wb.sharedStrings) } : undefined
  }
  const aterr = await editor('Ficha Medi')
  if (aterr) {
    if (!aterr.ed.findText('RUA / AVENIDA / ESTRADA').length) diferencas.push('Ficha de aterramento: não achei a tabela ("RUA / AVENIDA / ESTRADA").')
    if (!blocosDeFoto(aterr.ed).length) diferencas.push('Ficha de aterramento: não achei os quadros de foto "Ponto".')
  }
  const equip = await editor('Ficha Equipamento')
  if (equip) {
    const vagas = vagasEquipamento(equip.ed)
    if (!vagas.length) diferencas.push('Ficha de equipamento: não achei os lugares "Ponto".')
    else {
      try {
        conferirVagaEquipamento(equip.ed, vagas[0])
      } catch {
        diferencas.push('Ficha de equipamento: o desenho é diferente (os rótulos não estão no lugar de sempre).')
      }
    }
  }
  const dp = await editor('DP')
  if (dp && !dp.ed.findText('LIVRE').length && !maiorQuadro(dp.ed)) diferencas.push('DP: não achei o quadro da foto do desligamento.')

  // ---- rodapé de assinatura (onde entram matrícula, nome e carimbo)
  for (const prefixo of ['Check-list', 'Ficha Medi', 'Ficha Equipamento', 'Ficha Ramal', 'Reparo', 'DP']) {
    const e = await editor(prefixo)
    if (e && !acharRodape(e.ed)) diferencas.push(`A aba "${e.aba.name}" não tem o rodapé de assinatura ("Registro"): o carimbo não entra nela.`)
  }

  return { modelo, diferencas }
}
