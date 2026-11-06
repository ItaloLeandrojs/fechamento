// Mão de obra do Ceará: tipos da lista de vozes (base opcional "mao-de-obra"), os papéis que a Leitura do CAD usa e as linhas finais.
import { casa, normalizar } from '../lib/busca'
import { arred } from './estratificacao'
import type { Contagem, DesenhoMO, RespostasDesenho } from './contagemMO'
import type { Area } from './excel'
export type Letra = 'A' | 'B'
export type Aba = 'adicao' | 'devolucao'
export const PAPEIS = [
  'poste-mt', 'poste-bt', 'retirada-poste-mt', 'retirada-poste-bt',
  'retirada-poste-lv-passante', 'retirada-poste-lv-encabecamento', 'cava-rocha',
  'cruzeta-nu', 'cruzeta-isolado', 'retirada-cruzeta-passante', 'retirada-cruzeta-encabecamento',
  'lv-instalacao-passante', 'lv-retirada-passante', 'lv-instalacao-encabecamento', 'lv-retirada-encabecamento',
  'armacao-bt', 'retirada-armacao-bt',
  'trafo', 'estrutura-trafo', 'retirada-trafo', 'retirada-estrutura-trafo',
  'caixa', 'conector-4-saidas', 'tensionar', 'operacao-equipamento',
] as const
export type Papel = (typeof PAPEIS)[number]
/** Uma linha da lista de precificação, sem o R$. `voz` sem sufixo (ex. XX110); `variante`: "GRP A -" ou "(TELECONT)". */
export interface VozDaLista { voz: string; letra: Letra; numero: string; descricao: string; unidade: string; variante: boolean }
export interface RegraCabo { grupo: 'mt' | 'bt-nu' | 'bt-multi'; situacao: 'novo' | 'retirado'; voz: string; por: 'metro' | 'condutor'; bitolas?: string[] }
/** MT: `exige` tem uma expressão e vale por estrutura. BT: todas as expressões acham uma estrutura (1) do poste; vale a de maior `qtd` do poste. */
export interface RegraTensionar { rede: 'mt' | 'bt'; exige: string[]; qtd: number }
export interface BaseMaoDeObra { lista: VozDaLista[]; papeis: Record<Papel, string>; regrasCabo: RegraCabo[]; tensionar: RegraTensionar[] }

// ---------------- linhas finais: sufixo, número, desligamento, mudanças à mão, busca ----------------
export const CIDADES_A: Record<Area, string[]> = {
  'CENTRO SUL': ['Icó', 'Iguatu', 'Senador Pompeu', 'Tauá'],
  SUL: ['Crato', 'Juazeiro do Norte', 'Barbalha'],
  LESTE: ['Jaguaribe', 'Aracati', 'Limoeiro do Norte', 'Russas'],
}
export const OUTRA_CIDADE = 'OUTRA'

/** Área de uma cidade A (cada uma está numa área só); null para OUTRA_CIDADE ou sem cidade. */
export function areaDaCidade(cidade: string | null): Area | null {
  if (!cidade) return null
  return (Object.keys(CIDADES_A) as Area[]).find((a) => CIDADES_A[a].includes(cidade)) ?? null
}

/** A se a cidade é uma das da área; B com OUTRA_CIDADE; null sem cidade ou com cidade de outra área. */
export function letraDaCidade(area: Area, cidade: string | null): Letra | null {
  if (!cidade) return null
  if (cidade === OUTRA_CIDADE) return 'B'
  return CIDADES_A[area].includes(cidade) ? 'A' : null
}

export interface RespostasMO extends RespostasDesenho {
  ot: string
  cidade: string | null
  desligamento: boolean | null
  equipamentos: number
  /** chave da linha → quantidade digitada */
  mudancas: Record<string, number>
  somadas: { aba: Aba; voz: string; quantidade: number }[]
}

export function respostasVazias(ot: string): RespostasMO {
  return { ot, tensionar: {}, fases: {}, linhaViva: {}, cidade: null, desligamento: null, equipamentos: 1, mudancas: {}, somadas: [] }
}

export interface LinhaMO {
  chave: string // `${aba}|${voz}`, voz sem sufixo
  aba: Aba
  voz: string
  numero: string | null
  descricao: string
  unidade: string
  automatico: number | null // null nas somadas à mão
  quantidade: number
  mudada: boolean
  somada: boolean
  origem: string[]
  falta?: string
  confira?: boolean
}

const juntarTextos = (textos: string[]) => [...new Set(textos)].join('; ')
/** Sem letra, a descrição da lista (que começa com `<voz>_A_` ou `<voz>_B_`) sai sem o sufixo, como a voz. */
const semSufixo = (voz: string, descricao: string) => (descricao.startsWith(`${voz}_A_`) || descricao.startsWith(`${voz}_B_`) ? descricao.slice(voz.length + 3) : descricao)

/** Número, descrição e unidade da voz pela letra da cidade; o que faltar vira texto de `falta`. */
function dadosDaVoz(base: BaseMaoDeObra, voz: string, letra: Letra | null): { numero: string | null; descricao: string; unidade: string; falta: string[] } {
  const daVoz = base.lista.filter((x) => x.voz === voz)
  if (letra) {
    const e = daVoz.find((x) => !x.variante && x.letra === letra)
    if (e) return { numero: e.numero, descricao: e.descricao, unidade: e.unidade, falta: [] }
    const qualquer = daVoz.find((x) => x.letra === letra)
    return { numero: null, descricao: qualquer?.descricao ?? '', unidade: qualquer?.unidade ?? '', falta: ['voz fora da lista'] }
  }
  const e = daVoz.find((x) => !x.variante && x.letra === 'A') ?? daVoz.find((x) => !x.variante && x.letra === 'B') ?? daVoz[0]
  return { numero: null, descricao: semSufixo(voz, e?.descricao ?? ''), unidade: e?.unidade ?? '', falta: e ? ['escolha a cidade da obra'] : ['escolha a cidade da obra', 'voz fora da lista'] }
}

export function montarLinhas(d: DesenhoMO, base: BaseMaoDeObra, resp: RespostasMO, area: Area): LinhaMO[] {
  const letra = letraDaCidade(area, resp.cidade)
  const contagens: Contagem[] = [...d.contagens]
  if (resp.desligamento === true) {
    contagens.push({ aba: 'adicao', papel: 'operacao-equipamento', quantidade: 2 * resp.equipamentos, origem: 'desligamento' })
  } else if (resp.desligamento === null) {
    contagens.push({ aba: 'adicao', papel: 'operacao-equipamento', quantidade: 0, origem: 'desligamento', falta: 'responda se teve desligamento' })
  }

  // ordem: PAPEIS, depois as de cabo (pela ordem de regrasCabo)
  const ordemDe = (c: Contagem, voz: string) => {
    if (c.papel) return PAPEIS.indexOf(c.papel)
    const i = base.regrasCabo.findIndex((r) => r.voz === voz)
    return PAPEIS.length + (i < 0 ? base.regrasCabo.length : i)
  }
  interface Acum { aba: Aba; voz: string; ordem: number; soma: number; origem: string[]; falta: string[]; confira: boolean }
  const acum = new Map<string, Acum>()
  for (const c of contagens) {
    const voz = c.voz ?? (c.papel ? base.papeis[c.papel] || c.papel : '')
    const chave = `${c.aba}|${voz}`
    const a = acum.get(chave) ?? { aba: c.aba, voz, ordem: Infinity, soma: 0, origem: [], falta: [], confira: false }
    a.ordem = Math.min(a.ordem, ordemDe(c, voz))
    if (c.falta) a.falta.push(c.falta)
    else a.soma = arred(a.soma + c.quantidade)
    if (!a.origem.includes(c.origem)) a.origem.push(c.origem)
    if (c.confira) a.confira = true
    acum.set(chave, a)
  }

  const automaticas: { ordem: number; linha: LinhaMO }[] = []
  for (const [chave, a] of acum) {
    const dados = dadosDaVoz(base, a.voz, letra)
    const falta = juntarTextos([...a.falta, ...dados.falta])
    const mudada = chave in resp.mudancas
    if (a.soma === 0 && !falta && !mudada) continue
    automaticas.push({
      ordem: a.ordem,
      linha: {
        chave, aba: a.aba, voz: a.voz, numero: dados.numero, descricao: dados.descricao, unidade: dados.unidade,
        automatico: a.soma, quantidade: mudada ? resp.mudancas[chave] : a.soma, mudada, somada: false, origem: a.origem,
        ...(falta ? { falta } : {}), ...(a.confira ? { confira: true } : {}),
      },
    })
  }
  const porAba = (aba: Aba) => automaticas.filter((x) => x.linha.aba === aba).sort((x, y) => x.ordem - y.ordem).map((x) => x.linha)
  const linhas = [...porAba('adicao'), ...porAba('devolucao')]

  // somadas à mão: a automática visível da mesma aba e voz vale, a somada é ignorada
  const visiveis = new Set(linhas.map((l) => l.chave))
  for (const s of resp.somadas) {
    const chave = `${s.aba}|${s.voz}`
    if (visiveis.has(chave)) continue
    const dados = dadosDaVoz(base, s.voz, letra)
    linhas.push({
      chave, aba: s.aba, voz: s.voz, numero: dados.numero, descricao: dados.descricao, unidade: dados.unidade,
      automatico: null, quantidade: s.quantidade, mudada: false, somada: true, origem: ['somada à mão'],
      ...(dados.falta.length ? { falta: juntarTextos(dados.falta) } : {}),
    })
  }
  return linhas
}

/** `casa` sobre voz, descrição e unidade; a partir de 2 letras; até 20; com letra, só dela; variantes entram. */
export function buscarVozes(base: BaseMaoDeObra, termo: string, letra: Letra | null): VozDaLista[] {
  if (normalizar(termo).length < 2) return []
  const out: VozDaLista[] = []
  for (const v of base.lista) {
    if (letra && v.letra !== letra) continue
    if (!casa(normalizar(`${v.voz} ${v.descricao} ${v.unidade}`), termo)) continue
    out.push(v)
    if (out.length === 20) break
  }
  return out
}

/** Tira as respostas que não cabem mais no desenho: tensionar e fases fora de `chavesPerguntas`,
 *  linha viva de poste que sumiu, mudança de linha automática que sumiu. As somadas ficam. */
export function limparRespostas(resp: RespostasMO, d: DesenhoMO, linhas: LinhaMO[]): RespostasMO {
  const validas = new Set(d.chavesPerguntas)
  const postes = new Set(d.linhaViva.map((l) => l.poste))
  const automaticas = new Set(linhas.filter((l) => !l.somada).map((l) => l.chave))
  const filtrar = <T>(o: Record<string, T>, ok: (k: string) => boolean) => Object.fromEntries(Object.entries(o).filter(([k]) => ok(k))) as Record<string, T>
  return {
    ...resp,
    tensionar: filtrar(resp.tensionar, (k) => validas.has(k)),
    fases: filtrar(resp.fases, (k) => validas.has(k)),
    linhaViva: filtrar(resp.linhaViva, (k) => postes.has(k)),
    mudancas: filtrar(resp.mudancas, (k) => automaticas.has(k)),
  }
}
