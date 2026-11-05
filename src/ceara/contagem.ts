// Contagem de estruturas e materiais de uma obra do Ceará (Enel) a partir do DXF do asbuilt.
// Regras: base de conhecimento (Documents\TESTE\APRENDIZADO_CAD\BASE_PARA_CONTAGEM_MATERIAL_E_MAO_DE_OBRA.md),
// os 3 orçamentos reais conferidos (pasta ../ceara-teste), as regras de cabo da planilha
// "CONVERSÃO DE CABOS 5%" e as respostas do Italo (28/10 e 04/11/2026). Mão de obra fica
// de fora por enquanto: o Italo vai explicar obra por obra.
import type { Dxf, TextoDxf } from './dxf'
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

export type TipoItem = 'poste' | 'estrutura' | 'trafo' | 'chave' | 'elo' | 'conector' | 'outro-material' | 'ignorado' | 'nao-reconhecido'

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
  /** Código da Enel; sem código conhecido, o nome do item (ex. "POSTE 600/8") e semCodigo. */
  codigo: string
  descricao: string
  quantidade: number
  /** Postes (ou "vãos") de onde veio, para conferir. */
  origem: string[]
  /** Regra deduzida dos exemplos, ainda a confirmar com o Italo. */
  palpite?: boolean
  /** O site não sabe o código: vai em vermelho no Excel, para preencher à mão. */
  semCodigo?: boolean
  /** Estrutura que não existe na base de kits da Enel (grafia errada ou estrutura nova). */
  foraDaBase?: boolean
  /** Conta que deu a quantidade (cabos), para mostrar na tela; não vai para o Excel. */
  conta?: string
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
  /** Pedaços com prefixo que não entram de propósito (ex. CAVA KLC: só marca a cava, vai na mão de obra). */
  ignorados: { poste: string; texto: string }[]
  avisos: string[]
}

/** Base DE-PARA da Enel Ceará: material (código → [descrição, unidade]) e kits de estrutura (nome → descrição). */
export interface Catalogo {
  materiais: Record<string, [string, string]>
  estruturas: Record<string, string>
}

/** Base completa da Enel: o catálogo mais os kits de estrutura. A chave de 'kits' é o CODIGO_KIT (sem _E), como em 'estruturas'. */
export interface BaseEnel extends Catalogo {
  kits: Record<string, [codigo: string, qtd: number][]>
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

/**
 * Etiqueta escrita em TEXTs soltos, uma linha por TEXT (ex. obra de Limoeiro, camada 0):
 * junta as linhas empilhadas na mesma coluna. Duas linhas são da mesma etiqueta quando
 * começam no mesmo x (até uma altura de letra) e estão a no máximo 2,2 alturas uma da outra.
 */
/** Retângulo aproximado de um texto no desenho (a largura é estimada pelo número de letras). */
export interface Caixa {
  x0: number
  x1: number
  topo: number
  base: number
  h: number
}

const ENTRELINHA = 1.67
const LARGURA_LETRA = 0.8

/** MTEXT: o ponto de inserção é o canto de cima; as linhas descem. TEXT: o ponto é a base da letra. */
function caixaDoTexto(t: TextoDxf, linhas: string[]): Caixa {
  const h = t.altura > 0 ? t.altura : 2.5
  const largura = Math.max(1, ...linhas.map((l) => l.length)) * LARGURA_LETRA * h
  if (t.tipo === 'MTEXT') return { x0: t.x, x1: t.x + largura, topo: t.y, base: t.y - Math.max(1, linhas.length) * ENTRELINHA * h, h }
  return { x0: t.x, x1: t.x + largura, topo: t.y + h, base: t.y, h }
}

function juntarCaixas(c: Caixa[]): Caixa {
  return {
    x0: Math.min(...c.map((x) => x.x0)),
    x1: Math.max(...c.map((x) => x.x1)),
    topo: Math.max(...c.map((x) => x.topo)),
    base: Math.min(...c.map((x) => x.base)),
    h: Math.max(...c.map((x) => x.h)),
  }
}

export function agruparTextos(textos: TextoDxf[]): { linhas: string[]; camada: string; caixa: Caixa }[] {
  const t = textos.map((x) => ({ ...x, h: x.altura > 0 ? x.altura : 2.5 })).sort((a, b) => a.x - b.x)
  const pai = t.map((_, i) => i)
  const raiz = (i: number): number => (pai[i] === i ? i : (pai[i] = raiz(pai[i])))
  for (let i = 0; i < t.length; i++) {
    for (let j = i + 1; j < t.length; j++) {
      const h = Math.max(t[i].h, t[j].h)
      if (t[j].x - t[i].x > h) break
      if (t[i].camada === t[j].camada && Math.abs(t[i].y - t[j].y) <= 2.2 * h) pai[raiz(j)] = raiz(i)
    }
  }
  const grupos = new Map<number, typeof t>()
  t.forEach((x, i) => grupos.set(raiz(i), [...(grupos.get(raiz(i)) ?? []), x]))
  return [...grupos.values()].map((g) => ({
    camada: g[0].camada,
    linhas: g.sort((a, b) => b.y - a.y).flatMap((x) => linhasDoTexto(x.bruto)),
    caixa: juntarCaixas(g.map((x) => caixaDoTexto(x, linhasDoTexto(x.bruto)))),
  }))
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
    .replace(/^SPALCA/, 'SPALÇA')
    .replace(/^SPLACO/, 'SPLAÇO')
    .replace(/SPALÇ(\d)/, 'SPALÇA$1')
    .replace(/_[ES]$/, '')
}

function classificar(t0: string): Classe {
  const t = normalizarGrafia(t0)
  if (POSTE.test(t)) return { tipo: 'poste', base: t.replace('.', ',') }
  if (/^T[TM]\d+KVA$/.test(t)) return { tipo: 'trafo', base: t }
  if (/^(CF|CS|PR|TP)$/.test(t)) return { tipo: 'chave', base: t }
  if (/^ELO\d+[KH]$/.test(t)) return { tipo: 'elo', base: t }
  if (/^CONEC/.test(t)) return { tipo: 'conector', base: t }
  if (/^ATER-?S?P?$/.test(t)) return { tipo: 'estrutura', base: 'ATER-SP' }
  if (/^SPCXD[TM]-?P12P[NAB]$/.test(t)) return { tipo: 'estrutura', base: t.replace(/^SPCXD([TM])-?/, 'SPCXD$1-') }
  if (/^SPTRM?\d+P?$/.test(t)) return { tipo: 'estrutura', base: t }
  if (/^S[1-5][NABC]?$/.test(t)) return { tipo: 'estrutura', base: t }
  // alça e laço do cabo pré-reunido são estruturas (SPALÇA50, SPLAÇO50), confirmado pelo Italo em 04/11
  if (/^SP(ALÇA|LAÇO)\d+(CU)?$/.test(t)) return { tipo: 'estrutura', base: t }
  // a cava só marca que teve cava no poste: entra na mão de obra, não no material
  if (/^CAVA_KLC$/.test(t)) return { tipo: 'ignorado', base: 'CAVA KLC' }
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

/** Itens de uma linha de etiqueta, já classificados. */
function itensDaLinha(l: string): ItemEtiqueta[] {
  return pedacosDaLinha(l).map((p) => {
    const mult = /^(\d+)[xX](.+)$/.exec(p.texto)
    const nome = mult ? mult[2] : p.texto
    const c = classificar(nome)
    return { situacao: p.sit, texto: p.texto, quantidade: mult ? Number(mult[1]) : 1, tipo: c.tipo, codigo: c.base + (c.precisaCabo ? '§' + c.precisaCabo : '') }
  })
}

// ---------------- cabos ----------------

export type Cabo =
  | { grupo: 'mt'; fases: number | null; bitola: string }
  | { grupo: 'bt-nu'; condutores: number | null; bitola: string }
  | { grupo: 'bt-multi'; bitola: string; fases: 'M' | 'T' | '' }
  | { grupo: 'outro' }

/** P3AN004 (MT, 3 fases, CAA 4); 2AN004 (BT nu, 2 condutores); AM050T (BT multiplexado 50 mm², trifásico). */
export function lerCabo(c: string): Cabo {
  const mt = /^P(\d)?(?:AN|CA)(\d{3})$/.exec(c)
  if (mt) return { grupo: 'mt', fases: mt[1] ? Number(mt[1]) : null, bitola: mt[2] }
  const nu = /^(\d)?AN(\d{3})$/.exec(c)
  if (nu) return { grupo: 'bt-nu', condutores: nu[1] ? Number(nu[1]) : null, bitola: nu[2] }
  const multi = /^AM(\d{3})([MT]?)$/.exec(c)
  if (multi) return { grupo: 'bt-multi', bitola: multi[1], fases: multi[2] as 'M' | 'T' | '' }
  return { grupo: 'outro' }
}

/** Bitola do código do vão escrita como no nome da estrutura: 004 → 4, 010 → 1/0, 266 → 266. */
const bitolaNome = (b: string) => (b === '004' ? '4' : b === '010' ? '1/0' : String(Number(b)))

/** Bitola do cabo de MT da obra, pelos vãos (a de mais metros). */
function bitolaMT(vaos: Vao[]): string | null {
  const conta = new Map<string, number>()
  for (const v of vaos) {
    const c = lerCabo(v.cabo)
    if (c.grupo === 'mt') conta.set(c.bitola, (conta.get(c.bitola) ?? 0) + v.metros)
  }
  const b = [...conta].sort((a, b) => b[1] - a[1])[0]?.[0]
  return b ? bitolaNome(b) : null
}

// Planilha "CONVERSÃO DE CABOS-16-05-5%", aba "Conversão de Cabos 5%"
/** Cabo de MT novo, kg = metros × fases × 1,05 × coeficiente. */
const MT_NOVO: Record<string, [string, number]> = { '004': ['310604', 0.085], '010': ['310605', 0.216], '266': ['310652', 0.546] }
/** Cabo de MT retirado (sucata), kg = metros × fases × coeficiente, sem os 5%. */
const MT_SUCATA: Record<string, [string, number]> = { '004': ['310838', 0.085], '010': ['330943', 0.216], '266': ['330944', 0.546] }
/** Cabo de BT nu retirado, kg = metros × condutores × coeficiente. */
const BT_NU_SUCATA: Record<string, [string, number]> = { '004': ['310836', 0.058] }
/** Cabo de BT pré-reunido novo, em metros + 5%. A chave é bitola + fases do código do vão. */
const BT_NOVO: Record<string, string> = { '035T': '330993', '050T': '330994', '025T': '330757', '025M': '330786' }
/** Cabo de BT pré-reunido retirado, em metros. O 3x35 (330945) saiu da base da Enel, não da planilha de conversão. */
const BT_MULTI_SUCATA: Record<string, [string, boolean]> = { '025M': ['330886', false], '025T': ['330888', false], '050T': ['330887', false], '035T': ['330945', true] }
const SOBRA = 1.05

/** Arredonda ao inteiro mais perto (0,5 sobe), sem o erro de ponto flutuante (10 × 1,05 = 10,500000000000002). */
const inteiro = (n: number) => Math.round(Math.round(n * 1e6) / 1e6)
const duasCasas = (n: number) => Math.round(n * 100) / 100
const br = (n: number) => String(n).replace('.', ',')

// ---------------- materiais com código conhecido ----------------

/** Postes de concreto DT (base de material da Enel). */
const POSTE_NOVO: Record<string, string> = {
  '150/9': '231227', '300/9': '231228', '600/9': '231235', '300/11': '231230', '300/12': '231232', '600/12': '231233', '1000/12': '231238',
  '150/10,5': '231274', '300/10,5': '231275', '600/10,5': '231276', '1000/10,5': '231277',
}
const POSTE_SUCATA: Record<string, string> = {
  '150/8': '231602', '300/8': '231603', '150/9': '231604', '300/9': '231605', '600/9': '231606', '150/10': '231672', '300/10': '231576', '600/10': '231577',
  '150/10,5': '231658', '300/10,5': '231659', '600/10,5': '231573', '1000/10,5': '231574', '300/11': '231579', '600/11': '231580',
  '300/12': '231582', '600/12': '231584', '1000/12': '231586',
}
/** Trafo trifásico 13,8 kV (TT..KVA). */
const TRAFO: Record<string, string> = {
  TT15KVA: '111279', TT30KVA: '111280', TT45KVA: '111281', TT75KVA: '111283', 'TT112.5KVA': '111212', TT112KVA: '111212', TT150KVA: '111290', TT225KVA: '111291', TT300KVA: '111292',
}
/** Trafo trifásico 13,8 kV retirado: até 30 kVA volta como sucata, acima como salvado (Italo, 04/11).
 *  O de 500 kVA só tem código de sucata na base, e o Italo mandou usar esse. */
const TRAFO_RETIRADO: Record<string, string> = {
  TT10KVA: '111734', TT15KVA: '111736', TT30KVA: '111738',
  TT45KVA: '111739', TT75KVA: '111741', 'TT112.5KVA': '111743', TT112KVA: '111743', TT150KVA: '111745', TT225KVA: '111747', TT300KVA: '111749',
  TT500KVA: '111751',
}
/** Códigos dos orçamentos reais que não estão na base DE-PARA. */
const DESCRICAO_FIXA: Record<string, string> = {
  '860342': 'FITA,ISOL,19MM,20M,PR,D22001',
  '860344': 'FITA,ISOL,AUTOFUS,19X10,D22002',
  '990257': 'CONEC,PERF,50-150',
}
const SUPORTE_CF = '251841' // SUPORTE,L,AZ,198,CF/PR: nunca vem em estrutura, um por chave fusível
const CONECTOR_CUNHA = '274921' // CONEC,CUN,BIM,VII: um por chave (obra real)

/** Cabo já somado em metros, por situação (1 novo, 3 retirado). */
export interface CaboSomado {
  situacao: 1 | 3
  nome: string
  metros: number
  /** só o caderno passa: vale no lugar das fases da obra */
  fases?: number
}

/** Soma em `adicao`/`devolucao` o material dos cabos com a regra de hoje (5%, kg, sucata, sem regra = semCodigo, fitas do BT novo uma vez). */
export function converterCabos(cabos: CaboSomado[], fasesMT: number, catalogo: Catalogo | undefined, adicaoMaterial: Linha[], devolucaoMaterial: Linha[]): void {
  const desc = (codigo: string, reserva: string) => catalogo?.materiais[codigo]?.[0] ?? DESCRICAO_FIXA[codigo] ?? reserva
  const material = (codigo: string, reserva = '', palpite = false): Omit<Linha, 'origem' | 'quantidade'> => ({ codigo, descricao: desc(codigo, reserva), palpite })
  const semCodigo = (nome: string, descricao: string): Omit<Linha, 'origem' | 'quantidade'> => ({ codigo: nome, descricao, semCodigo: true })
  let btNovo = false
  for (const { situacao, nome, metros, fases: fasesDoCaderno } of cabos) {
    const cabo = lerCabo(nome)
    const novo = situacao === 1
    const lista = novo ? adicaoMaterial : devolucaoMaterial
    const semRegra = () => somar(lista, semCodigo(`CABO ${nome}`, `${metros} m ${novo ? 'novos' : 'retirados'}: cabo sem regra de conversão`), metros, 'vãos')
    if (cabo.grupo === 'mt') {
      const fases = fasesDoCaderno ?? (novo ? fasesMT : (cabo.fases ?? fasesMT))
      const t = (novo ? MT_NOVO : MT_SUCATA)[cabo.bitola]
      if (!t) semRegra()
      else if (novo) somar(lista, { ...material(t[0]), conta: `kg: ${metros} m x ${fases} fases x 1,05 x ${br(t[1])}` }, duasCasas(metros * fases * SOBRA * t[1]), 'vãos de MT')
      // retirado: as fases vêm do código do vão (P2 = 2 fases), ainda a confirmar com uma obra real
      else somar(lista, { ...material(t[0], '', true), conta: `kg: ${metros} m x ${fases} fases x ${br(t[1])}` }, duasCasas(metros * fases * t[1]), 'vãos de MT')
    } else if (cabo.grupo === 'bt-multi') {
      const k = cabo.bitola + cabo.fases
      if (novo) {
        const cod = BT_NOVO[k]
        if (!cod) semRegra()
        else {
          somar(lista, { ...material(cod), conta: `${metros} m + 5%` }, inteiro(metros * SOBRA), 'vãos de BT')
          btNovo = true
        }
      } else {
        const t = BT_MULTI_SUCATA[k]
        if (!t) semRegra()
        else somar(lista, { ...material(t[0], '', t[1]), conta: `${metros} m` }, metros, 'vãos de BT')
      }
    } else if (cabo.grupo === 'bt-nu' && !novo) {
      const t = BT_NU_SUCATA[cabo.bitola]
      if (!t) semRegra()
      else {
        // 2AN004 = 2 condutores (resposta do Italo, 04/11); sem o número, 1 condutor e a confirmar
        const condutores = cabo.condutores ?? 1
        somar(lista, { ...material(t[0], '', cabo.condutores === null), conta: `kg: ${metros} m x ${condutores} condutor${condutores > 1 ? 'es' : ''} x ${br(t[1])}` }, duasCasas(metros * condutores * t[1]), 'vãos retirados')
      }
    } else semRegra()
  }

  // fitas isolantes: 1 de cada, só quando há cabo de BT novo
  if (btNovo) {
    somar(adicaoMaterial, material('860342'), 1, 'cabo BT novo')
    somar(adicaoMaterial, material('860344'), 1, 'cabo BT novo')
  }
}

/** Nomes de vão com regra de material, sem repetir: MT P1 a P3 × bitolas de MT_NOVO/MT_SUCATA; AM + chaves de BT_NOVO/BT_MULTI_SUCATA; BT nu 1 a 4 × bitolas de BT_NU_SUCATA. */
export function nomesDeCabo(): string[] {
  const nomes = new Set<string>()
  for (const b of new Set([...Object.keys(MT_NOVO), ...Object.keys(MT_SUCATA)])) for (const f of [1, 2, 3]) nomes.add(`P${f}AN${b}`)
  for (const k of new Set([...Object.keys(BT_NOVO), ...Object.keys(BT_MULTI_SUCATA)])) nomes.add(`AM${k}`)
  for (const b of Object.keys(BT_NU_SUCATA)) for (const c of [1, 2, 3, 4]) nomes.add(`${c}AN${b}`)
  return [...nomes]
}

/** Código de sucata do material novo (poste por POSTE_NOVO → POSTE_SUCATA pelo mesmo nome; trafo por TRAFO → TRAFO_RETIRADO); null se não houver. */
export function codigoDeSucata(codigoNovo: string): string | null {
  for (const [novos, sucatas] of [[POSTE_NOVO, POSTE_SUCATA], [TRAFO, TRAFO_RETIRADO]] as const) {
    const nome = Object.keys(novos).find((n) => novos[n] === codigoNovo)
    if (nome && sucatas[nome]) return sucatas[nome]
  }
  return null
}

// ---------------- contagem ----------------

function somar(lista: Linha[], l: Omit<Linha, 'origem' | 'quantidade'>, qtd: number, origem: string) {
  const ex = lista.find((x) => x.codigo === l.codigo)
  if (ex) {
    ex.quantidade += qtd
    if (origem && !ex.origem.includes(origem)) ex.origem.push(origem)
    ex.palpite ||= l.palpite
  } else lista.push({ ...l, quantidade: qtd, origem: origem ? [origem] : [] })
}

export function contarObra(dxf: Dxf, catalogo?: Catalogo): ResultadoCeara {
  const avisos: string[] = []
  const vaos: Vao[] = []
  const etiquetas: Etiqueta[] = []
  const desc = (codigo: string, reserva: string) => catalogo?.materiais[codigo]?.[0] ?? DESCRICAO_FIXA[codigo] ?? reserva
  /** Material com código conhecido (descrição da base da Enel). */
  const material = (codigo: string, reserva = '', palpite = false): Omit<Linha, 'origem' | 'quantidade'> => ({ codigo, descricao: desc(codigo, reserva), palpite })
  /** Material sem código: o nome vai no lugar do código, em vermelho no Excel. */
  const semCodigo = (nome: string, descricao: string): Omit<Linha, 'origem' | 'quantidade'> => ({ codigo: nome, descricao, semCodigo: true })

  // vãos que vêm como cota: o estilo traz o cabo, ex. "(1)P3AN004<>"
  for (const c of dxf.cotas) {
    const modelo = c.substituto && c.substituto !== '<>' ? c.substituto.replace(/<>/, '') : c.modelo.replace('<>', '')
    const p = prefixo(modelo.trim())
    if (!/^(P\d)?\d?A[MN]\d{3}/.test(p.resto)) continue
    vaos.push({ situacao: p.sit, cabo: p.resto.trim(), metros: Math.round(c.medida), origem: 'cota' })
  }

  // textos: vão de uma linha só, etiqueta em MTEXT (uma por poste) ou TEXTs soltos empilhados
  const blocos: { linhas: string[]; camada: string; soltos: boolean; caixa: Caixa }[] = []
  const soltos: TextoDxf[] = []
  for (const t of dxf.textos) {
    const linhas = linhasDoTexto(t.bruto)
    if (!linhas.length) continue
    if (linhas.length === 1) {
      const v = VAO_TEXTO.exec(linhas[0].replace(/\s+/g, ''))
      if (v) {
        vaos.push({ situacao: v[1] ? (Number(v[1]) as Situacao) : null, cabo: v[2], metros: Number(v[3].replace(',', '.')), origem: 'texto' })
        continue
      }
    }
    if (t.tipo === 'TEXT') soltos.push(t)
    else blocos.push({ linhas, camada: t.camada, soltos: false, caixa: caixaDoTexto(t, linhas) })
  }
  for (const g of agruparTextos(soltos)) blocos.push({ ...g, soltos: true })

  // número do poste escrito à parte (ex.: "01", às vezes junto da coordenada): fica em cima ou embaixo da etiqueta
  const numerosSoltos: { numero: string; caixa: Caixa; usado: boolean }[] = []
  const semNumero: { etiqueta: Etiqueta; caixa: Caixa }[] = []

  for (const b of blocos) {
    // etiqueta de poste: tem poste (esforço/altura) ou estrutura, com ou sem prefixo
    let uteis = b.linhas.filter((l) => !COORDENADA.test(l.replace(/\s/g, '')))
    if (uteis.length === 1 && NUMERO_POSTE.test(uteis[0])) {
      numerosSoltos.push({ numero: uteis[0].replace(/^P/, ''), caixa: b.caixa, usado: false })
      continue
    }
    // o número do poste fecha a etiqueta embaixo ou abre em cima
    let poste = ''
    if (uteis.length > 1 && NUMERO_POSTE.test(uteis[uteis.length - 1])) poste = uteis.pop()!.replace(/^P/, '')
    else if (uteis.length > 1 && NUMERO_POSTE.test(uteis[0])) poste = uteis.shift()!.replace(/^P/, '')
    // texto solto juntado pela posição: tira as linhas que não são da etiqueta (nome de rua, nota...)
    if (b.soltos) uteis = uteis.filter((l) => linhaDeEtiqueta(itensDaLinha(l)))
    const itens = uteis.flatMap(itensDaLinha)
    const temPoste = itens.some((i) => i.tipo === 'poste')
    const reconhecidos = itens.filter((i) => i.tipo !== 'nao-reconhecido').length
    // texto solto que não é etiqueta (legenda, carimbo, nota): fica de fora
    if (!itens.length || (!temPoste && (reconhecidos === 0 || reconhecidos < itens.length / 2))) continue
    const etiqueta: Etiqueta = { poste, linhas: poste ? [...uteis, poste] : uteis, itens, camada: b.camada }
    etiquetas.push(etiqueta)
    if (!poste) semNumero.push({ etiqueta, caixa: b.caixa })
  }
  darNumerosSoltos(semNumero, numerosSoltos)

  // etiqueta repetida do mesmo poste (versão antiga não apagada): conta uma só e avisa
  const vistos = new Map<string, Etiqueta>()
  for (const e of [...etiquetas]) {
    if (!e.poste) continue
    const chave = JSON.stringify([e.poste, e.linhas])
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
  const ignorados: { poste: string; texto: string }[] = []

  for (const e of etiquetas) {
    const origem = e.poste ? 'P' + e.poste : 'sem nº'
    for (const i of e.itens) {
      if (i.situacao === null || i.situacao === 2) continue // existente ou realocação: não soma
      const add = i.situacao === 1
      const lista = add ? adicaoMaterial : devolucaoMaterial
      if (i.tipo === 'nao-reconhecido') {
        naoReconhecidos.push({ poste: origem, texto: `(${i.situacao})${i.texto}` })
      } else if (i.tipo === 'ignorado') {
        ignorados.push({ poste: origem, texto: `(${i.situacao})${i.texto.replace('_', ' ')}` })
      } else if (i.tipo === 'estrutura') {
        const base = completar(i.codigo)
        const descricao = catalogo?.estruturas[base] ?? ''
        somar(add ? adicaoEstrutura : devolucaoEstrutura, { codigo: base + (add ? '_S' : '_E'), descricao, foraDaBase: !!catalogo && !descricao }, i.quantidade, origem)
      } else if (i.tipo === 'poste') {
        const cod = (add ? POSTE_NOVO : POSTE_SUCATA)[i.codigo]
        somar(lista, cod ? material(cod) : semCodigo(`POSTE ${i.codigo}`, add ? 'poste novo: código a definir' : 'poste retirado (sucata): código a definir'), i.quantidade, origem)
      } else if (i.tipo === 'trafo') {
        const cod = (add ? TRAFO : TRAFO_RETIRADO)[i.codigo]
        somar(lista, cod ? material(cod) : semCodigo(i.codigo, add ? 'transformador: código a definir' : 'transformador retirado: código a definir'), i.quantidade, origem)
      } else if (i.tipo === 'conector') {
        const cod = /50-150/.test(i.codigo) ? '990257' : /PERF/.test(i.codigo) ? '275695' : null
        somar(lista, cod ? material(cod) : semCodigo(i.codigo, 'conector: código a definir'), i.quantidade, origem)
      } else if (i.tipo === 'elo' && add) {
        const m = /^ELO(\d+)([KH])$/.exec(i.codigo)!
        const cod = Object.keys(catalogo?.materiais ?? {}).find((k) => new RegExp(`^ELO,FUS,BOT,MT, *${m[1]}A,${m[2]},`).test(catalogo!.materiais[k][0]))
        somar(lista, cod ? material(cod) : semCodigo(i.codigo, 'elo fusível: código a definir'), i.quantidade, origem)
      } else if (i.tipo === 'chave' && i.codigo === 'CF' && add) {
        // chave fusível: suporte e conector cunha, um de cada por chave; o elo só se estiver escrito
        somar(adicaoMaterial, material(SUPORTE_CF), i.quantidade, origem)
        somar(adicaoMaterial, material(CONECTOR_CUNHA), i.quantidade, origem)
      } else {
        somar(lista, semCodigo(i.codigo, 'código a definir'), i.quantidade, origem)
      }
    }
  }

  // trafo novo sem chave escrita na etiqueta (a chave vem como símbolo): 3 chaves, cada uma com
  // suporte e conector cunha, como na obra real com trafo e na de Limoeiro. O elo não: ele vem
  // dentro da estrutura do trafo (TR15, TR75, TR150...), confirmado pelo Italo em 04/11
  const temCF = etiquetas.some((e) => e.itens.some((i) => i.codigo === 'CF' && i.situacao === 1))
  if (!temCF) {
    for (const e of etiquetas) {
      for (const i of e.itens.filter((x) => x.tipo === 'trafo' && x.situacao === 1)) {
        const origem = (e.poste ? 'P' + e.poste : 'sem nº') + ' (trafo)'
        somar(adicaoMaterial, material(SUPORTE_CF), 3 * i.quantidade, origem)
        somar(adicaoMaterial, material(CONECTOR_CUNHA), 3 * i.quantidade, origem)
      }
    }
  }

  // cabos: soma os metros por situação e por cabo
  const porCabo = new Map<string, CaboSomado>()
  for (const v of vaos) {
    if (v.situacao !== 1 && v.situacao !== 3) continue // existente ou tensionado: não é material
    const k = v.situacao + v.cabo
    const atual = porCabo.get(k) ?? { situacao: v.situacao, nome: v.cabo, metros: 0 }
    atual.metros += v.metros
    porCabo.set(k, atual)
  }
  converterCabos([...porCabo.values()], fasesMT, catalogo, adicaoMaterial, devolucaoMaterial)

  // poste sem etiqueta no meio da numeração (ex.: P1 a P35 sem o P34): falta no desenho
  const numeros = etiquetas.map((e) => Number(e.poste)).filter((n) => Number.isInteger(n) && n > 0)
  if (numeros.length) {
    const max = Math.max(...numeros)
    const faltam = Array.from({ length: max }, (_, k) => k + 1).filter((n) => !numeros.includes(n))
    if (faltam.length && faltam.length <= 10) avisos.push(`Sem etiqueta no desenho: ${faltam.map((n) => 'P' + n).join(', ')} (a numeração vai até P${max}). Esses postes não entraram na contagem.`)
  }

  const fora = [...adicaoEstrutura, ...devolucaoEstrutura].filter((l) => l.foraDaBase).map((l) => l.codigo)
  if (fora.length) avisos.push(`Estrutura que não existe na base da Enel: ${fora.join(', ')}. Confira a grafia no desenho; no Excel ela sai em vermelho.`)
  const sem = [...adicaoMaterial, ...devolucaoMaterial].filter((l) => l.semCodigo).map((l) => l.codigo)
  if (sem.length) avisos.push(`Material sem código conhecido: ${sem.join(', ')}. No Excel a linha sai em vermelho, para preencher o código à mão.`)

  return { etiquetas, vaos, adicaoEstrutura, devolucaoEstrutura, adicaoMaterial, devolucaoMaterial, naoReconhecidos, ignorados, avisos }
}

/** Até quantas alturas de letra o número pode ficar longe da etiqueta, em cima ou embaixo. */
const DISTANCIA_NUMERO = 15

/**
 * Etiqueta sem número dentro dela: procura um número escrito à parte logo em cima ou logo embaixo
 * (alinhado com a etiqueta). Um número ao lado não serve, mesmo se estiver mais perto (regra do Italo,
 * 04/11). Cada número vai para uma etiqueta só: os pares mais próximos são ligados primeiro.
 * Sem número em cima nem embaixo, a etiqueta fica "sem nº" (às vezes a pessoa esquece mesmo).
 */
function darNumerosSoltos(semNumero: { etiqueta: Etiqueta; caixa: Caixa }[], numeros: { numero: string; caixa: Caixa; usado: boolean }[]): void {
  const pares: { e: (typeof semNumero)[number]; n: (typeof numeros)[number]; distancia: number }[] = []
  for (const e of semNumero) {
    const folga = e.caixa.h
    for (const n of numeros) {
      // alinhado: a faixa de x do número cruza a faixa de x da etiqueta
      if (n.caixa.x1 < e.caixa.x0 - folga || n.caixa.x0 > e.caixa.x1 + folga) continue
      const embaixo = e.caixa.base - n.caixa.topo
      const emCima = n.caixa.base - e.caixa.topo
      const distancia = Math.max(embaixo, emCima)
      if (distancia < -folga || distancia > DISTANCIA_NUMERO * e.caixa.h) continue
      pares.push({ e, n, distancia })
    }
  }
  pares.sort((a, b) => a.distancia - b.distancia)
  const ligadas = new Set<Etiqueta>()
  for (const p of pares) {
    if (p.n.usado || ligadas.has(p.e.etiqueta)) continue
    p.n.usado = true
    ligadas.add(p.e.etiqueta)
    p.e.etiqueta.poste = p.n.numero
    p.e.etiqueta.linhas = [...p.e.etiqueta.linhas, p.n.numero]
  }
}

/** Linha de texto solto que faz parte de uma etiqueta: tem prefixo, poste, ou a maioria dos itens reconhecidos. */
function linhaDeEtiqueta(itens: ItemEtiqueta[]): boolean {
  if (!itens.length) return false
  if (itens.some((i) => i.situacao !== null || i.tipo === 'poste')) return true
  const ok = itens.filter((i) => i.tipo !== 'nao-reconhecido').length
  return ok > 0 && ok >= itens.length / 2
}
