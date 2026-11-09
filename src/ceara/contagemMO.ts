// Mão de obra do Ceará contada pelo DXF já lido (ResultadoCeara): por papel (ex. "poste MT novo",
// "retirada de cruzeta passante"), poste por poste. A voz real de cada papel vem da tabela de regras
// (fora do repositório); aqui só os papéis. Regras: docs/2026-11-06-ceara-mao-de-obra-dxf-design.md.
import { lerCabo, MATERIAL_SOLTO, type Etiqueta, type ItemEtiqueta, type ResultadoCeara } from './contagem'
import { arred } from './estratificacao'
import type { Aba, BaseMaoDeObra, Papel } from './maoDeObra'

export interface Contagem {
  aba: Aba
  /** um dos dois: papel (postes) ou voz (regra de cabo) */
  papel?: Papel
  voz?: string
  quantidade: number
  origem: string // 'P12', 'sem nº', 'vãos de MT', 'vãos de BT'
  confira?: boolean
  /** falta resposta: aparece em vermelho e não soma */
  falta?: string
}
export type Pergunta =
  | { tipo: 'fases'; chave: string; cabo: string; metros: number }
  | { tipo: 'poste'; chave: string; poste: string; texto: string }
export interface RespostasDesenho {
  /** respostas do tensionar de antes de 09/11: o site não pergunta mais, ficam só nas respostas guardadas */
  tensionar: Record<string, boolean>
  fases: Record<string, number>
  /** poste sem nada na etiqueta que diga a rede: a MT passa nele? (chave `poste|P6|1`); falta em respostas antigas */
  posteMT?: Record<string, boolean>
  /** ligado ou desligado à mão, pela origem do poste ('P12') */
  linhaViva: Record<string, boolean>
}
export interface DesenhoMO {
  contagens: Contagem[]
  perguntas: Pergunta[] // só as que faltam responder
  chavesPerguntas: string[] // todas que valem neste desenho, respondidas ou não
  naoCobrado: string[] // ex. 'P1: linha viva, o tensionar vai na voz da cruzeta'
  semRegra: { poste: string; texto: string }[]
  linhaViva: { poste: string; doDesenho: boolean; vale: boolean }[]
  /** postes com estrutura nova que ancora cabo: o site não cobra o tensionar, só pede para conferir */
  tensionarConfira: { poste: string; estruturas: string[] }[]
}

/** Item da etiqueta com o (2) já desdobrado: só novo (1), retirado (3) ou existente (null). */
export type ItemDesdobrado = Omit<ItemEtiqueta, 'situacao'> & { situacao: 1 | 3 | null }

/**
 * Item (2) (realocado ou tensionado) vira um (3) e um (1) do mesmo item, nessa ordem e no lugar dele.
 * Depois disso o (1) vale como qualquer (1) para todas as regras (cruzeta, tensionar...).
 */
export function desdobrar(e: Etiqueta): ItemDesdobrado[] {
  return e.itens.flatMap((i): ItemDesdobrado[] => (i.situacao === 2 ? [{ ...i, situacao: 3 }, { ...i, situacao: 1 }] : [{ ...i, situacao: i.situacao }]))
}

/** Código do item sem a marca do cabo da obra (§mt, §tr) e sem _S/_E. */
export const codigoLimpo = (codigo: string) => codigo.replace(/§(mt|tr)$/, '').replace(/_[SE]$/, '')

/** Estrutura de MT: N, M, B, U ou D, bifásica (B) ou monofásica (M) ou não, e o tipo (1 a 4). TR, SPTR e PR não entram. */
const MT = /^[NMBUD][BM]?(\d)/
/** Monofásica inteira: tipo e o mesmo resto que `classificar` aceita (nada, CAA..., CCN..., CSR ou CAL...). */
const MONOFASICA = /^[NMBUD]M\d(?:\.\d)?(?:CAA[\d/]+S?|CCN\d+(?:\/\d+)?|CSR|CAL\d+)?$/
const ARMACAO_BT = /^S[1-5]([A-Z]?)$/

/** Tipo da estrutura de MT (passante = tipo 1 e 2; o resto é encabeçamento ou derivação) e se é de rede compacta. */
export function estruturaMT(i: Pick<ItemEtiqueta, 'tipo' | 'codigo'>): { encabecamento: boolean; isolada: boolean } | null {
  if (i.tipo !== 'estrutura' && i.tipo !== 'nao-reconhecido') return null
  const c = codigoLimpo(i.codigo)
  // a monofásica (MM1, NM3...) ainda não é lida como estrutura pela contagem de hoje: vem como não reconhecida.
  // Do não reconhecido, só ela, com o resto que a contagem aceita (banco de trafo, regulador e afastamento não são cruzeta)
  if (i.tipo === 'nao-reconhecido' && !MONOFASICA.test(c)) return null
  const m = MT.exec(c)
  if (!m) return null
  return { encabecamento: m[1] !== '1' && m[1] !== '2', isolada: /CCN|CSR/.test(c) }
}

const ehArmacao = (i: ItemDesdobrado) => i.tipo === 'estrutura' && ARMACAO_BT.test(codigoLimpo(i.codigo))

/** Faces de armação de BT: soma, por letra, de teto(n/2); S sem letra conta como letra própria. */
export function facesBT(armacoes: { codigo: string; quantidade: number }[]): number {
  const porLetra = new Map<string, number>()
  for (const a of armacoes) {
    const c = codigoLimpo(a.codigo)
    const letra = ARMACAO_BT.exec(c)?.[1] ?? c
    porLetra.set(letra, (porLetra.get(letra) ?? 0) + a.quantidade)
  }
  let faces = 0
  for (const n of porLetra.values()) faces += Math.ceil(n / 2)
  return faces
}

export function contarDesenhoMO(r: ResultadoCeara, regras: Pick<BaseMaoDeObra, 'regrasCabo' | 'tensionar'>, resp: RespostasDesenho): DesenhoMO {
  const contagens: Contagem[] = []
  const perguntas: Pergunta[] = []
  const chavesPerguntas: string[] = []
  const naoCobrado: string[] = []
  const semRegra: DesenhoMO['semRegra'] = []
  const linhaViva: DesenhoMO['linhaViva'] = []
  const tensionarConfira: DesenhoMO['tensionarConfira'] = []

  /** Contagens iguais (mesma aba, papel ou voz e origem) somam; as que faltam responder ficam cada uma na sua linha. */
  const juntar = (c: Contagem) => {
    if (c.falta) return void contagens.push(c)
    if (c.quantidade <= 0) return
    const ex = contagens.find((x) => !x.falta && x.aba === c.aba && x.papel === c.papel && x.voz === c.voz && x.origem === c.origem)
    if (ex) {
      ex.quantidade = arred(ex.quantidade + c.quantidade)
      if (c.confira) ex.confira = true
    } else contagens.push(c)
  }
  const somar = (aba: Aba, papel: Papel, quantidade: number, origem: string, confira = false) =>
    juntar({ aba, papel, quantidade, origem, ...(confira ? { confira: true } : {}) })
  const perguntar = (p: Pergunta, respondida: boolean) => {
    if (!chavesPerguntas.includes(p.chave)) chavesPerguntas.push(p.chave)
    if (!respondida && !perguntas.some((x) => x.chave === p.chave)) perguntas.push(p)
  }
  const naoCobra = (texto: string) => {
    if (!naoCobrado.includes(texto)) naoCobrado.push(texto)
  }

  // ---------------- cabo, pelos vãos (1) e (3) somados por situação e nome ----------------
  const porCabo = new Map<string, { situacao: 1 | 3; nome: string; metros: number }>()
  for (const v of r.vaos) {
    if (v.situacao !== 1 && v.situacao !== 3) continue // existente ou (2): o tensionar sai dos postes
    const k = v.situacao + v.cabo
    const atual = porCabo.get(k) ?? { situacao: v.situacao, nome: v.cabo, metros: 0 }
    atual.metros = arred(atual.metros + v.metros)
    porCabo.set(k, atual)
  }
  for (const { situacao, nome, metros } of porCabo.values()) {
    const cabo = lerCabo(nome)
    const regra =
      cabo.grupo === 'outro'
        ? undefined
        : regras.regrasCabo.find(
            (g) => g.grupo === cabo.grupo && g.situacao === (situacao === 1 ? 'novo' : 'retirado') && (!g.bitolas || g.bitolas.includes(cabo.bitola)),
          )
    if (cabo.grupo === 'outro' || !regra) {
      semRegra.push({ poste: 'vãos', texto: `(${situacao})${nome}` })
      continue
    }
    const base = { aba: (situacao === 1 ? 'adicao' : 'devolucao') as Aba, voz: regra.voz, origem: cabo.grupo === 'mt' ? 'vãos de MT' : 'vãos de BT' }
    if (regra.por === 'metro') {
      juntar({ ...base, quantidade: metros })
      continue
    }
    // por condutor: MT pelas fases do nome (sem elas, pergunta); BT nu pelos condutores do nome; pré-reunido = 1
    if (cabo.grupo === 'mt') {
      let fases = cabo.fases
      if (fases === null) {
        const chave = 'fases|' + nome
        const dada = resp.fases[chave]
        const ok = typeof dada === 'number' && dada > 0
        perguntar({ tipo: 'fases', chave, cabo: nome, metros }, ok)
        if (!ok) {
          contagens.push({ ...base, quantidade: 0, falta: 'falta o número de fases' })
          continue
        }
        fases = dada
      }
      juntar({ ...base, quantidade: arred(metros * fases) })
    } else if (cabo.grupo === 'bt-nu') {
      juntar({ ...base, quantidade: arred(metros * (cabo.condutores ?? 1)), ...(cabo.condutores === null ? { confira: true } : {}) })
    } else juntar({ ...base, quantidade: metros })
  }

  // ---------------- tensionar (só para conferir): as expressões vêm da tabela de regras ----------------
  const comExpressoes = (rede: 'mt' | 'bt') => regras.tensionar.filter((t) => t.rede === rede).map((t) => ({ qtd: t.qtd, exige: t.exige.map((x) => new RegExp(x)) }))
  const tensionarMT = comExpressoes('mt')
  const tensionarBT = comExpressoes('bt')

  for (const e of r.etiquetas) {
    const origem = e.poste ? 'P' + e.poste : 'sem nº'
    const itens = desdobrar(e)
    const tratados = new Set<ItemDesdobrado>()
    const de = (filtro: (i: ItemDesdobrado) => boolean, situacao?: 1 | 3) => {
      const achados = itens.filter((i) => filtro(i) && (situacao === undefined || i.situacao === situacao))
      for (const i of achados) tratados.add(i)
      return achados
    }
    const total = (l: ItemDesdobrado[]) => l.reduce((s, i) => s + i.quantidade, 0)

    const mts = itens.flatMap((i) => {
      const mt = estruturaMT(i)
      return mt ? [{ item: i, ...mt }] : []
    })
    const respLv = resp.linhaViva[origem]
    const lv = typeof respLv === 'boolean' ? respLv : e.linhaViva === true
    if (e.linhaViva || typeof respLv === 'boolean') linhaViva.push({ poste: origem, doDesenho: e.linhaViva === true, vale: lv })

    // poste de MT ou de BT pela rede que passa nele (Italo, 09/11): MT se a etiqueta tem estrutura de MT,
    // trafo ou material solto que só existe na MT (isolador, alça CAA, cruzeta), mesmo com BT junto;
    // BT se só tem estrutura de BT; sem nada que diga, pergunta. O novo leva as (1) e as que passam
    // (sem prefixo); o retirado, as (3) e as sem prefixo (na troca, a (1) do poste novo não faz o velho ser de MT)
    const doPoste = (s: 1 | 3) => (i: { situacao: 1 | 3 | null }) => i.situacao === s || i.situacao === null
    const temMT = (s: 1 | 3) =>
      mts.some((m) => doPoste(s)(m.item)) ||
      itens.some(
        (i) =>
          doPoste(s)(i) &&
          (i.tipo === 'trafo' ||
            (i.tipo === 'estrutura' && /^TR/.test(codigoLimpo(i.codigo))) ||
            (i.tipo === 'outro-material' && MATERIAL_SOLTO[i.codigo]?.mt === true)),
      )
    const temBT = (s: 1 | 3) => itens.some((i) => doPoste(s)(i) && i.tipo === 'estrutura' && /^(S[1-5]|SPALÇA|SPLAÇO|SPCXD)/.test(codigoLimpo(i.codigo)))
    /** true = MT, false = BT, null = falta a resposta (só pergunta quando há poste nessa situação). */
    const ehMT = (s: 1 | 3, temPoste: boolean): boolean | null => {
      if (temMT(s)) return true
      if (temBT(s) || !temPoste) return false
      const chave = `poste|${origem}|${s}`
      const dada = resp.posteMT?.[chave]
      const texto = s === 1 ? `A rede de MT passa no poste novo do ${origem}?` : `A rede de MT passava no poste retirado do ${origem}?`
      perguntar({ tipo: 'poste', chave, poste: origem, texto }, typeof dada === 'boolean')
      return typeof dada === 'boolean' ? dada : null
    }
    const falta = 'responda se a MT passa no poste'

    // poste
    const postes1 = de((i) => i.tipo === 'poste', 1)
    const postes3 = de((i) => i.tipo === 'poste', 3)
    const mt1 = ehMT(1, postes1.length > 0)
    const mt3 = ehMT(3, postes3.length > 0)
    if (mt1 === null) contagens.push({ aba: 'adicao', papel: 'poste-mt', quantidade: total(postes1), origem, falta })
    else {
      // poste novo de MT com linha viva (Italo, 09/11): estrutura tipo 3 ou 4 no poste = encabeçamento, só 1 e 2 = passante
      const instalacaoPoste: Papel =
        lv && mt1
          ? mts.some((m) => doPoste(1)(m.item) && m.encabecamento)
            ? 'poste-lv-encabecamento'
            : 'poste-lv-passante'
          : mt1
            ? 'poste-mt'
            : 'poste-bt'
      somar('adicao', instalacaoPoste, total(postes1), origem)
    }
    const retiradaPoste: Papel =
      lv && mt3
        ? mts.some((m) => doPoste(3)(m.item) && m.encabecamento)
          ? 'retirada-poste-lv-encabecamento'
          : 'retirada-poste-lv-passante'
        : mt3
          ? 'retirada-poste-mt'
          : 'retirada-poste-bt'
    if (mt3 === null) contagens.push({ aba: 'devolucao', papel: 'retirada-poste-mt', quantidade: total(postes3), origem, falta })
    else somar('devolucao', retiradaPoste, total(postes3), origem)

    // cruzeta de MT: cada unidade conta 1 (dupla, U e D também)
    for (const m of mts) tratados.add(m.item)
    const unidades = mts.filter((m) => m.item.situacao === 1).flatMap((m) => Array.from({ length: m.item.quantidade }, () => m))
    // poste novo: a primeira cruzeta (a de cima) já está na voz do poste, se nenhuma passa do poste velho
    // (uma unidade só por etiqueta, mesmo com 2x no poste novo)
    if (postes1.length && !mts.some((m) => m.item.situacao === null)) unidades.shift()
    for (const m of unidades) {
      const papel: Papel = lv ? (m.encabecamento ? 'lv-instalacao-encabecamento' : 'lv-instalacao-passante') : m.isolada ? 'cruzeta-isolado' : 'cruzeta-nu'
      somar('adicao', papel, 1, origem)
    }
    // retirada pelo tipo que sai; no poste retirado ela já está na voz do poste
    if (!postes3.length) {
      for (const m of mts.filter((x) => x.item.situacao === 3)) {
        const papel: Papel = lv
          ? m.encabecamento
            ? 'lv-retirada-encabecamento'
            : 'lv-retirada-passante'
          : m.encabecamento
            ? 'retirada-cruzeta-encabecamento'
            : 'retirada-cruzeta-passante'
        somar('devolucao', papel, m.item.quantidade, origem)
      }
    }

    // armação de BT, por face; no poste novo ou retirado ela está na voz do poste
    const armacoes1 = de(ehArmacao, 1)
    const armacoes3 = de(ehArmacao, 3)
    const faces = (l: ItemDesdobrado[]) => facesBT(l.map((i) => ({ codigo: i.codigo, quantidade: i.quantidade })))
    if (!postes1.length) somar('adicao', 'armacao-bt', faces(armacoes1), origem, true)
    if (!postes3.length) somar('devolucao', 'retirada-armacao-bt', faces(armacoes3), origem, true)

    // trafo, caixa, conector de 4 saídas, cava na rocha
    const trafos1 = de((i) => i.tipo === 'trafo', 1)
    const trafos3 = de((i) => i.tipo === 'trafo', 3)
    somar('adicao', 'trafo', total(trafos1), origem)
    somar('adicao', 'estrutura-trafo', total(trafos1), origem)
    somar('devolucao', 'retirada-trafo', total(trafos3), origem)
    somar('devolucao', 'retirada-estrutura-trafo', total(trafos3), origem)
    somar('adicao', 'caixa', total(de((i) => i.tipo === 'estrutura' && /^SPCXD/.test(codigoLimpo(i.codigo)), 1)), origem)
    somar('adicao', 'conector-4-saidas', total(de((i) => i.tipo === 'conector' && /50-150|4VIAS/.test(i.codigo), 1)), origem)
    somar('adicao', 'cava-rocha', total(de((i) => i.tipo === 'ignorado' && i.codigo === 'CAVA KLC', 1)), origem)

    // o resto com prefixo vai para a nota "sem regra de mão de obra, confira"
    const doTrafo = trafos1.length > 0
    for (const i of itens) {
      // material solto da estrutura estratificada no desenho: a mão de obra é a do poste e das estruturas
      if (i.situacao === null || tratados.has(i) || i.tipo === 'nao-reconhecido' || i.tipo === 'outro-material') continue
      const c = codigoLimpo(i.codigo)
      if (i.tipo === 'estrutura' && /^(TR|SPTR|SPALÇA|SPLAÇO)/.test(c)) continue
      // chave, elo e aterramento do trafo novo já estão na voz da estrutura do trafo
      if (doTrafo && (c === 'CF' || i.tipo === 'elo' || c === 'ATER-SP')) continue
      semRegra.push({ poste: origem, texto: `(${i.situacao})${i.texto.replace(/CAVA_(KLC|EM_ROCHA)/, (m) => m.replace(/_/g, ' '))}` })
    }

    // tensionar: o site não cobra mais (Italo, 09/11). Só aponta os postes com estrutura (1) (o (2) já
    // desdobrado) que ancora cabo, pelas expressões da tabela de regras, para a pessoa conferir e pôr a voz à mão
    const unidadesBT = itens.filter((i) => i.situacao === 1 && i.tipo === 'estrutura' && !estruturaMT(i)).map((i) => codigoLimpo(i.codigo))
    const ancoras = [
      ...mts.filter((m) => m.item.situacao === 1).map((m) => codigoLimpo(m.item.codigo)).filter((c) => tensionarMT.some((t) => t.exige.every((x) => x.test(c)))),
      // BT: regra de uma expressão acha cada estrutura; regra de várias (par S2N + S2C) só vale com todas no poste
      ...tensionarBT.flatMap((t) => {
        const achados = t.exige.map((x) => unidadesBT.filter((c) => x.test(c)))
        return achados.every((l) => l.length) ? achados.flat() : []
      }),
    ]
    if (!ancoras.length) continue
    // linha viva: a voz da cruzeta de linha viva já leva o tensionar
    if (lv) naoCobra(`${origem}: linha viva, o tensionar vai na voz da cruzeta`)
    else tensionarConfira.push({ poste: origem, estruturas: [...new Set(ancoras)] })
  }

  // na ordem dos postes (P1, P5, P11...), "sem nº" no fim
  const numero = (p: string) => (/^P\d+$/.test(p) ? Number(p.slice(1)) : Infinity)
  tensionarConfira.sort((a, b) => numero(a.poste) - numero(b.poste))
  return { contagens, perguntas, chavesPerguntas, naoCobrado, semRegra, linhaViva, tensionarConfira }
}
