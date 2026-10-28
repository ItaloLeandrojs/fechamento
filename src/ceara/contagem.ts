// Contagem de estruturas e materiais de uma obra do Ceará (Enel) a partir do DXF do asbuilt.
// Regras: base de conhecimento (Documents\TESTE\APRENDIZADO_CAD\BASE_PARA_CONTAGEM_MATERIAL_E_MAO_DE_OBRA.md)
// e os 3 orçamentos reais conferidos (pasta ../ceara-teste). Mão de obra fica de fora
// por enquanto: o Italo vai explicar obra por obra.
import type { Dxf } from './dxf'
import { linhasDoTexto } from './mtext'

/** (1) novo, (2) realocar/tensionar, (3) retirar; sem prefixo = existente (não conta). */
export type Situacao = 1 | 2 | 3

export interface ItemEtiqueta {
  situacao: Situacao | null
  /** Pedaço como está no desenho, ex. "2xSPALÇA50". */
  texto: string
  quantidade: number
  tipo: TipoItem
  /** Código normalizado (estrutura com cabo e _S/_E; poste "600/12"...). */
  codigo: string
}

export type TipoItem = 'poste' | 'estrutura' | 'trafo' | 'chave' | 'conector' | 'outro-material' | 'nao-reconhecido'

export interface Etiqueta {
  poste: string // número do poste (vazio se a etiqueta não tiver)
  linhas: string[]
  itens: ItemEtiqueta[]
  camada: string
}

export interface Vao {
  situacao: Situacao | null
  cabo: string // ex. "P3AN004", "AM035T", "2AN004"
  metros: number
  origem: 'cota' | 'texto'
}

export interface Linha {
  codigo: string
  descricao: string
  quantidade: number
  /** Postes (ou "vãos") de onde veio, para conferir. */
  origem: string[]
  /** Regra deduzida dos exemplos, ainda a confirmar com o Italo. */
  palpite?: boolean
}

export interface ResultadoCeara {
  etiquetas: Etiqueta[]
  vaos: Vao[]
  adicaoEstrutura: Linha[]
  devolucaoEstrutura: Linha[]
  adicaoMaterial: Linha[]
  devolucaoMaterial: Linha[]
  /** Pedaços de etiqueta com prefixo que o site não soube classificar. */
  naoReconhecidos: { poste: string; texto: string }[]
  avisos: string[]
}

// ---------------- leitura das etiquetas ----------------

// esforço de 100 a 9999 daN ("01/05" é número de folha, não poste)
const POSTE = /^([1-9]\d{2,3})\/(\d{1,2}(?:[.,]\d)?)$/
const COORDENADA = /^\(?-?\d{5,7}(?:[.,]\d+)?\s*,\s*-?\d{6,8}(?:[.,]\d+)?\)?$/
const NUMERO_POSTE = /^P?\d{1,3}[A-Z]?$/
/** Vão de cabo escrito como texto: (1)AM035T29, (3)2AN00438, (1)P2AN00481. */
const VAO_TEXTO = /^(?:\((\d)\))?\s*((?:P\d)?\d?A[MNZ]\d{3}[MT]?|(?:P\d)?\d?(?:CN|AA|LA|SP|CM)\d{3}[MT]?)(\d+(?:[.,]\d+)?)$/

function prefixo(s: string): { sit: Situacao | null; resto: string } {
  const m = /^\(([123])\)\s*(.*)$/.exec(s)
  return m ? { sit: Number(m[1]) as Situacao, resto: m[2] } : { sit: null, resto: s }
}

/** Uma linha da etiqueta em pedaços, cada um com a sua situação (o prefixo do começo vale para a linha inteira). */
function pedacosDaLinha(linha: string): { sit: Situacao | null; texto: string }[] {
  const out: { sit: Situacao | null; texto: string }[] = []
  const inicio = prefixo(linha.trim())
  let sitLinha = inicio.sit
  for (const seg of inicio.resto.split('|')) {
    const p = prefixo(seg.trim())
    if (p.sit) sitLinha = p.sit
    // "CAVA KLC" é um item só
    const junto = p.resto.replace(/CAVA\s+KLC/gi, 'CAVA_KLC')
    for (const t of junto.split(/\s+/).filter(Boolean)) {
      const q = prefixo(t)
      out.push({ sit: q.sit ?? sitLinha, texto: q.resto })
    }
  }
  return out
}

// ---------------- classificação de cada pedaço ----------------

interface Classe {
  tipo: TipoItem
  base: string
  /** Estrutura de MT sem o cabo no nome: recebe o cabo da obra. */
  precisaCabo?: 'mt' | 'tr'
}

function normalizarGrafia(t: string): string {
  return t
    .toUpperCase()
    .replace(/^SB(\d)/, 'S$1') // SB2 = S2B (erro de escrita conhecido)
    .replace(/CAA10\b/, 'CAA1/0')
    .replace(/SPALÇ(\d)/, 'SPALÇA$1')
    .replace(/_[ES]$/, '')
}

function classificar(t0: string): Classe {
  const t = normalizarGrafia(t0)
  if (POSTE.test(t)) return { tipo: 'poste', base: t.replace('.', ',') }
  if (/^T[TM]\d+KVA$/.test(t)) return { tipo: 'trafo', base: t }
  if (/^(CF|CS|PR|TP)$/.test(t) || /^ELO\d+K$/.test(t)) return { tipo: 'chave', base: t }
  if (/^CONEC/.test(t)) return { tipo: 'conector', base: t }
  if (/^ATER-?S?P?$/.test(t)) return { tipo: 'estrutura', base: 'ATER-SP' }
  if (/^SPCXD[TM]-?P12P[NAB]$/.test(t)) return { tipo: 'estrutura', base: t.replace(/^SPCXD([TM])-?/, 'SPCXD$1-') }
  if (/^SPTRM?\d+P?$/.test(t)) return { tipo: 'estrutura', base: t }
  if (/^S[1-5][NABC]?$/.test(t)) return { tipo: 'estrutura', base: t }
  if (/^SP(ALÇA|LAÇO)\d+$/.test(t)) return { tipo: 'outro-material', base: t }
  if (/^CAVA_KLC$/.test(t)) return { tipo: 'outro-material', base: 'CAVA KLC' }
  // transformação na MT: TR15 → TR15CAA4 (com o cabo da obra)
  const tr = /^TR(U?\d+)(CAA[\d/]+)?$/.exec(t)
  if (tr) return { tipo: 'estrutura', base: 'TR' + tr[1] + (tr[2] ?? ''), precisaCabo: tr[2] ? undefined : 'tr' }
  // estrutura de MT: cruzeta (N M B U D) + B bifásica + tipo (1 2 3 3.1 3.3 4) + cabo/chave
  const mt = /^([NMBUD])(B?)(\d(?:\.\d)?)(.*)$/.exec(t)
  if (mt) {
    const resto = mt[4]
    if (resto === '' || /^(CAA[\d/]+S?|CCN\d+(\/\d+)?|CSR|CAL\d+)$/.test(resto)) {
      return { tipo: 'estrutura', base: mt[1] + mt[2] + mt[3] + resto, precisaCabo: resto === '' && mt[1] !== 'U' ? 'mt' : undefined }
    }
  }
  if (/^PRCAA[\d/]+$/.test(t)) return { tipo: 'estrutura', base: t }
  return { tipo: 'nao-reconhecido', base: t }
}

// ---------------- cabo de MT da obra ----------------

/** Bitola do cabo de MT da obra, pelos vãos: AN004 → 4, AN010 → 1/0, AN266 → 266. */
function bitolaMT(vaos: Vao[]): string | null {
  const conta = new Map<string, number>()
  for (const v of vaos) {
    const m = /^P\d(?:AN|CA)(\d{3})/.exec(v.cabo)
    if (!m) continue
    const b = m[1] === '004' ? '4' : m[1] === '010' ? '1/0' : String(Number(m[1]))
    conta.set(b, (conta.get(b) ?? 0) + v.metros)
  }
  return [...conta].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

// ---------------- materiais com código conhecido ----------------

/** Códigos de material vistos nos orçamentos reais (seção 5.2 da base). */
const POSTE_NOVO: Record<string, [string, string]> = {
  '600/12': ['231233', 'POSTE,CONC,DT, 600/12M'],
  '300/9': ['231228', 'POSTE,CONC,DT, 300/9M'],
}
const POSTE_SUCATA: Record<string, [string, string]> = {
  '150/8': ['231602', 'POSTE,SUCATA,CONC, 150/8D'],
}
const TRAFO: Record<string, [string, string]> = {
  TT15KVA: ['111279', 'TRAFO,3F, 15KVA,13.8'],
}
const KG_POR_M_CAA4 = 0.08925 // CAA 4 AWG, por condutor (conferido: 2181 m x 2 x 0,08925 = 389,31 kg)
const KG_POR_M_CA4_SUCATA = 0.05803 // conferido numa obra real: 152 m → 8,82 kg
const SOBRA_CABO_BT = 1.05 // 266 m → 279; 22 m → 23

// ---------------- contagem ----------------

function somar(lista: Linha[], codigo: string, descricao: string, qtd: number, origem: string, palpite = false) {
  const ex = lista.find((l) => l.codigo === codigo)
  if (ex) {
    ex.quantidade += qtd
    if (origem && !ex.origem.includes(origem)) ex.origem.push(origem)
    ex.palpite ||= palpite
  } else lista.push({ codigo, descricao, quantidade: qtd, origem: origem ? [origem] : [], palpite })
}

export function contarObra(dxf: Dxf): ResultadoCeara {
  const avisos: string[] = []
  const vaos: Vao[] = []
  const etiquetas: Etiqueta[] = []

  // vãos que vêm como cota: o estilo traz o cabo, ex. "(1)P3AN004<>"
  for (const c of dxf.cotas) {
    const modelo = c.substituto && c.substituto !== '<>' ? c.substituto.replace(/<>/, '') : c.modelo.replace('<>', '')
    const p = prefixo(modelo.trim())
    if (!/^(P\d)?\d?A[MN]\d{3}/.test(p.resto)) continue
    vaos.push({ situacao: p.sit, cabo: p.resto.trim(), metros: Math.round(c.medida), origem: 'cota' })
  }

  for (const t of dxf.textos) {
    const linhas = linhasDoTexto(t.bruto)
    if (!linhas.length) continue
    // vão escrito como texto de uma linha só
    if (linhas.length === 1) {
      const v = VAO_TEXTO.exec(linhas[0].replace(/\s+/g, ''))
      if (v) {
        vaos.push({ situacao: v[1] ? (Number(v[1]) as Situacao) : null, cabo: v[2], metros: Number(v[3].replace(',', '.')), origem: 'texto' })
        continue
      }
    }
    // etiqueta de poste: tem poste (esforço/altura) ou estrutura, com ou sem prefixo
    const uteis = linhas.filter((l) => !COORDENADA.test(l.replace(/\s/g, '')))
    let poste = ''
    if (uteis.length > 1 && NUMERO_POSTE.test(uteis[uteis.length - 1])) poste = uteis.pop()!.replace(/^P/, '')
    const itens: ItemEtiqueta[] = []
    for (const l of uteis) {
      for (const p of pedacosDaLinha(l)) {
        const mult = /^(\d+)[xX](.+)$/.exec(p.texto)
        const qtd = mult ? Number(mult[1]) : 1
        const nome = mult ? mult[2] : p.texto
        const c = classificar(nome)
        itens.push({ situacao: p.sit, texto: p.texto, quantidade: qtd, tipo: c.tipo, codigo: c.base + (c.precisaCabo ? '§' + c.precisaCabo : '') })
      }
    }
    const temPoste = itens.some((i) => i.tipo === 'poste')
    const reconhecidos = itens.filter((i) => i.tipo !== 'nao-reconhecido').length
    // texto solto que não é etiqueta (legenda, carimbo, nota): fica de fora
    if (!temPoste && (reconhecidos === 0 || reconhecidos < itens.length / 2)) continue
    etiquetas.push({ poste, linhas, itens, camada: t.camada })
  }

  // etiqueta repetida do mesmo poste (versão antiga não apagada): conta uma só e avisa
  const vistos = new Map<string, Etiqueta>()
  for (const e of [...etiquetas]) {
    if (!e.poste) continue
    const chave = e.poste + '|' + e.linhas.join('/')
    if (vistos.has(chave)) {
      etiquetas.splice(etiquetas.indexOf(e), 1)
      avisos.push(`Etiqueta do poste ${e.poste} aparece duas vezes iguais no desenho: contei uma vez só.`)
    } else vistos.set(chave, e)
  }

  // cabo da obra para completar o nome das estruturas de MT
  const bitola = bitolaMT(vaos)
  const fasesMT = (() => {
    const mts = etiquetas.flatMap((e) => e.itens).filter((i) => i.tipo === 'estrutura' && /^[NMBD]B?\d/.test(i.codigo))
    if (!mts.length) return 3
    const bif = mts.filter((i) => /^[NMBD]B\d/.test(i.codigo)).length
    return bif > mts.length / 2 ? 2 : 3
  })()
  if (!bitola && etiquetas.some((e) => e.itens.some((i) => i.codigo.includes('§') && (i.situacao === 1 || i.situacao === 3)))) {
    avisos.push('Não achei o cabo de MT da obra nos vãos: as estruturas de MT ficaram sem o cabo no nome (confira).')
  }
  const completar = (codigo: string) =>
    codigo
      .replace(/§mt$/, bitola ? `CAA${bitola}S` : '')
      .replace(/§tr$/, bitola ? `CAA${bitola}` : '')

  const adicaoEstrutura: Linha[] = []
  const devolucaoEstrutura: Linha[] = []
  const adicaoMaterial: Linha[] = []
  const devolucaoMaterial: Linha[] = []
  const naoReconhecidos: { poste: string; texto: string }[] = []

  for (const e of etiquetas) {
    const origem = e.poste ? 'P' + e.poste : 'sem nº'
    for (const i of e.itens) {
      if (i.situacao === null || i.situacao === 2) continue // existente ou realocação: não soma
      const add = i.situacao === 1
      if (i.tipo === 'nao-reconhecido') {
        naoReconhecidos.push({ poste: origem, texto: `(${i.situacao})${i.texto}` })
        continue
      }
      if (i.tipo === 'estrutura') {
        const cod = completar(i.codigo) + (add ? '_S' : '_E')
        somar(add ? adicaoEstrutura : devolucaoEstrutura, cod, '', i.quantidade, origem)
      } else if (i.tipo === 'poste') {
        const tab = add ? POSTE_NOVO : POSTE_SUCATA
        const [cod, desc] = tab[i.codigo] ?? [`POSTE ${i.codigo}`, add ? 'poste novo (código a definir)' : 'poste sucata (código a definir)']
        somar(add ? adicaoMaterial : devolucaoMaterial, cod, desc, i.quantidade, origem)
      } else if (i.tipo === 'trafo') {
        const [cod, desc] = TRAFO[i.codigo] ?? [i.codigo, 'transformador (código a definir)']
        somar(add ? adicaoMaterial : devolucaoMaterial, cod, desc, i.quantidade, origem)
      } else if (i.tipo === 'conector') {
        const cod = /50-150/.test(i.codigo) ? '990257' : /PERF/.test(i.codigo) ? '275695' : i.codigo
        const desc = cod === '990257' ? 'CONEC,PERF,50-150' : cod === '275695' ? 'CONEC,PERF,25-120 TR/DR' : 'conector (código a definir)'
        somar(add ? adicaoMaterial : devolucaoMaterial, cod, desc, i.quantidade, origem)
      } else if (i.tipo === 'chave' && i.codigo === 'CF' && add) {
        // chave fusível: elo + suporte + conector cunha, um de cada por chave (deduzido do orçamento real da obra com trafo)
        somar(adicaoMaterial, '171089', 'ELO,FUS,BOT,MT, 1A,H', i.quantidade, origem, true)
        somar(adicaoMaterial, '251841', 'SUPORTE,L,AZ,198,CF/PR', i.quantidade, origem, true)
        somar(adicaoMaterial, '274921', 'CONEC,CUN,BIM,VII', i.quantidade, origem, true)
      } else {
        somar(add ? adicaoMaterial : devolucaoMaterial, i.codigo, 'código a definir', i.quantidade, origem)
      }
    }
  }

  // cabos
  const metros = (f: (v: Vao) => boolean) => vaos.filter(f).reduce((s, v) => s + v.metros, 0)
  const mtNovo = metros((v) => v.situacao === 1 && /^P\d(AN|CA)004/.test(v.cabo))
  if (mtNovo) somar(adicaoMaterial, '310604', `CABO,AL NU,CAA, 4AWG (kg: ${mtNovo} m x ${fasesMT} fases x ${KG_POR_M_CAA4})`, Math.round(mtNovo * fasesMT * KG_POR_M_CAA4 * 100) / 100, 'vãos de MT', true)
  const btNovo = metros((v) => v.situacao === 1 && /^AM0\d\d[MT]?$/.test(v.cabo))
  if (btNovo) somar(adicaoMaterial, '330993', `CB,P-REU,BT,AL (m: ${btNovo} m + 5%)`, Math.round(btNovo * SOBRA_CABO_BT), 'vãos de BT', true)
  const nuRetirado = metros((v) => v.situacao === 3 && /^\d?AN004$/.test(v.cabo))
  if (nuRetirado) somar(devolucaoMaterial, '310836', `CABO,NU CA, 4AWG, SUCATA (kg: ${nuRetirado} m x ${KG_POR_M_CA4_SUCATA})`, Math.round(nuRetirado * KG_POR_M_CA4_SUCATA * 100) / 100, 'vãos retirados', true)

  // trafo novo sem chave escrita na etiqueta (a chave vem como símbolo): 3 elos, 3 suportes e 3
  // conectores cunha, como no orçamento real da obra com trafo
  const trafosNovos = etiquetas.flatMap((e) => e.itens.filter((i) => i.tipo === 'trafo' && i.situacao === 1).map((i) => ({ i, e })))
  const temCF = etiquetas.some((e) => e.itens.some((i) => i.codigo === 'CF' && i.situacao === 1))
  if (!temCF) {
    for (const { i, e } of trafosNovos) {
      const origem = 'P' + e.poste + ' (trafo)'
      somar(adicaoMaterial, '171089', 'ELO,FUS,BOT,MT, 1A,H', 3 * i.quantidade, origem, true)
      somar(adicaoMaterial, '251841', 'SUPORTE,L,AZ,198,CF/PR', 3 * i.quantidade, origem, true)
      somar(adicaoMaterial, '274921', 'CONEC,CUN,BIM,VII', 3 * i.quantidade, origem, true)
    }
  }

  // poste sem etiqueta no meio da numeração (ex.: P1 a P35 sem o P34): falta no desenho
  const numeros = etiquetas.map((e) => Number(e.poste)).filter((n) => Number.isInteger(n) && n > 0)
  if (numeros.length) {
    const max = Math.max(...numeros)
    const faltam = Array.from({ length: max }, (_, k) => k + 1).filter((n) => !numeros.includes(n))
    if (faltam.length && faltam.length <= 10) avisos.push(`Sem etiqueta no desenho: ${faltam.map((n) => 'P' + n).join(', ')} (a numeração vai até P${max}). Esses postes não entraram na contagem.`)
  }

  // fitas isolantes: 1 de cada por obra (fixo nos 3 orçamentos)
  if (adicaoEstrutura.length || adicaoMaterial.length) {
    somar(adicaoMaterial, '860342', 'FITA,ISOL,19MM,20M', 1, 'obra', true)
    somar(adicaoMaterial, '860344', 'FITA,ISOL,AUTOFUS,19X10', 1, 'obra', true)
  }

  return { etiquetas, vaos, adicaoEstrutura, devolucaoEstrutura, adicaoMaterial, devolucaoMaterial, naoReconhecidos, avisos }
}
