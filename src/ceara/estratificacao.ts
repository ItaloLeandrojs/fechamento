// Estratificação do material dentro da estrutura: o kit da Enel diz o que cada estrutura leva;
// a obra real pode usar menos, mais ou outro material. Aqui ficam só as regras (sem tela):
// o ajuste guarda apenas o que DIFERE do kit, e daí saem retirada (devolução) e adição.
import type { BaseEnel, Linha, ResultadoCeara } from './contagem'
import { otDoNome } from './excel'

export type Unidade = 'UN' | 'M' | 'KG'
export interface MaterialNovo {
  codigo: string
  qtd: number // por estrutura
  /** Só para o digitado à mão fora do catálogo E4E. */
  foraDoCatalogo?: { descricao: string; unidade: Unidade }
}
/** Ajuste de uma estrutura: só o que difere do kit. qtd 0 = não usado. */
export interface Ajuste {
  qtd: Record<string, number>
  novos: MaterialNovo[]
}
/** Chave: código da estrutura sem _S (a mesma chave de base.kits). */
export type Ajustes = Record<string, Ajuste>

export type Situacao = 'igual' | 'nao-usado' | 'diminuiu' | 'a-mais' | 'novo'
export interface ItemKit { codigo: string; descricao: string; unidade: string; qtd: number }
export interface LinhaEstrat {
  codigo: string
  descricao: string
  unidade: string
  noKit: number     // por estrutura (0 para novo)
  usado: number     // por estrutura
  retirada: number  // por estrutura
  fica: number      // por estrutura
  aMais: number     // por estrutura, vai em Adição de material (a mais ou novo)
  situacao: Situacao
  foraDoCatalogo: boolean
}

/** 3 casas em toda conta: 2,45 - 1,23 dá 1,22 e não 1,2200000000000002. */
export const arred = (n: number) => Math.round(n * 1000) / 1000

export function chaveKit(codigoLinha: string): string {
  return codigoLinha.endsWith('_S') ? codigoLinha.slice(0, -2) : codigoLinha
}

/** Kit da estrutura com código repetido somado (uma linha por material, na ordem da 1ª vez). */
export function kitDe(base: BaseEnel, chave: string): ItemKit[] | null {
  const bruto = base.kits[chave]
  if (!bruto) return null
  const itens = new Map<string, ItemKit>()
  for (const [codigo, qtd] of bruto) {
    const antes = itens.get(codigo)
    if (antes) antes.qtd = arred(antes.qtd + qtd)
    else {
      const [descricao, unidade] = base.materiais[codigo] ?? ['', '']
      itens.set(codigo, { codigo, descricao, unidade, qtd: arred(qtd) })
    }
  }
  return [...itens.values()]
}

/** Tira do ajuste o que não muda nada; sem nada sobrando, não há ajuste. */
export function limpar(ajuste: Ajuste, kit: ItemKit[]): Ajuste | undefined {
  const noKit = new Map(kit.map((i) => [i.codigo, i.qtd]))
  const qtd: Record<string, number> = {}
  for (const [codigo, valor] of Object.entries(ajuste.qtd)) {
    const kitQtd = noKit.get(codigo)
    if (kitQtd !== undefined && arred(valor) !== kitQtd) qtd[codigo] = arred(valor)
  }
  // novo com código do kit duplicaria a linha do kit: some também
  const novos = ajuste.novos.filter((n) => n.qtd > 0 && !noKit.has(n.codigo))
  if (Object.keys(qtd).length === 0 && novos.length === 0) return undefined
  return { qtd, novos }
}

export function linhasDoKit(base: BaseEnel, chave: string, ajuste: Ajuste | undefined): LinhaEstrat[] {
  const linhas: LinhaEstrat[] = []
  for (const item of kitDe(base, chave) ?? []) {
    const usado = arred(ajuste?.qtd[item.codigo] ?? item.qtd)
    let situacao: Situacao = 'igual'
    if (usado === 0) situacao = 'nao-usado'
    else if (usado < item.qtd) situacao = 'diminuiu'
    else if (usado > item.qtd) situacao = 'a-mais'
    linhas.push({
      codigo: item.codigo, descricao: item.descricao, unidade: item.unidade,
      noKit: item.qtd, usado,
      retirada: arred(Math.max(item.qtd - usado, 0)),
      fica: arred(Math.min(item.qtd, usado)),
      aMais: arred(Math.max(usado - item.qtd, 0)),
      situacao, foraDoCatalogo: false,
    })
  }
  for (const n of ajuste?.novos ?? []) {
    const [descricao, unidade] = base.materiais[n.codigo] ?? [n.foraDoCatalogo?.descricao ?? '', n.foraDoCatalogo?.unidade ?? '']
    linhas.push({
      codigo: n.codigo, descricao, unidade,
      noKit: 0, usado: arred(n.qtd), retirada: 0, fica: 0, aMais: arred(n.qtd),
      situacao: 'novo', foraDoCatalogo: !base.materiais[n.codigo] && !!n.foraDoCatalogo,
    })
  }
  return linhas
}

export function adicionarNovo(
  ajuste: Ajuste | undefined, kit: ItemKit[], base: BaseEnel, novo: MaterialNovo,
): { ajuste: Ajuste | undefined; noKit: boolean } {
  // já é do kit: a tela leva até a linha do kit, onde se muda a quantidade
  if (kit.some((i) => i.codigo === novo.codigo)) return { ajuste, noKit: true }
  // existe no catálogo: entra como do catálogo, sem o aviso de "fora do catálogo"
  const item: MaterialNovo = base.materiais[novo.codigo] ? { codigo: novo.codigo, qtd: novo.qtd } : { ...novo }
  const novos = [...(ajuste?.novos ?? [])]
  const i = novos.findIndex((n) => n.codigo === item.codigo)
  if (i >= 0) novos[i] = { ...novos[i], qtd: arred(novos[i].qtd + item.qtd) }
  else novos.push(item)
  return { ajuste: limpar({ qtd: { ...(ajuste?.qtd ?? {}) }, novos }, kit), noKit: false }
}

/** Aplica uma sugestão guardada; o que não existe mais na base nova é ignorado e devolvido para avisar. */
export function aplicarSugestao(sugerido: Ajuste, base: BaseEnel, chave: string): { ajuste: Ajuste | undefined; ignorados: string[] } {
  const kit = kitDe(base, chave) ?? []
  const ignorados: string[] = []
  const qtd: Record<string, number> = {}
  for (const [codigo, valor] of Object.entries(sugerido.qtd)) {
    if (kit.some((i) => i.codigo === codigo)) qtd[codigo] = valor
    else ignorados.push(codigo)
  }
  const novos: MaterialNovo[] = []
  for (const n of sugerido.novos) {
    // agora é do kit (base nova): não pode ser novo
    if (kit.some((i) => i.codigo === n.codigo)) ignorados.push(n.codigo)
    else if (base.materiais[n.codigo]) novos.push({ codigo: n.codigo, qtd: n.qtd })
    else if (n.foraDoCatalogo) novos.push(n)
    else ignorados.push(n.codigo)
  }
  return { ajuste: limpar({ qtd, novos }, kit), ignorados }
}

/** Mesma obra pela OT do nome do arquivo; sem OT no nome novo, só se o nome for igual. */
export function mesmaObra(nomeAnterior: string, nomeNovo: string): boolean {
  if (!nomeAnterior) return false
  const ot = otDoNome(nomeNovo)
  return ot ? otDoNome(nomeAnterior) === ot : nomeAnterior === nomeNovo
}

/** Ao trocar o DXF, fica só o ajuste de estrutura que ainda aparece na obra. */
export function ajustesValidos(ajustes: Ajustes, adicaoEstrutura: Linha[]): Ajustes {
  const chaves = new Set(adicaoEstrutura.map((l) => chaveKit(l.codigo)))
  return Object.fromEntries(Object.entries(ajustes).filter(([chave]) => chaves.has(chave)))
}

export interface Somado {
  codigo: string
  descricao: string
  unidade: string
  doCad: number
  daEstratificacao: number // Σ aMais × qtd da estrutura na obra
  total: number
  estruturas: string // "KITX1_S (1), N3.1KIT_S (21)", na ordem da Adição de estrutura
  foraDoCatalogo: boolean
}

/** Estruturas da obra que têm ajuste, na ordem da Adição de estrutura. */
export function estruturasAjustadas(adicaoEstrutura: Linha[], ajustes: Ajustes): Linha[] {
  return adicaoEstrutura.filter((l) => ajustes[chaveKit(l.codigo)])
}

/** Soma o material a mais (e o novo) das estruturas ajustadas na Adição de material do CAD. */
export function somarNaAdicao(r: ResultadoCeara, base: BaseEnel, ajustes: Ajustes): { adicaoMaterial: Linha[]; somados: Somado[] } {
  const extra = new Map<string, Somado & { quais: string[] }>()
  for (const est of estruturasAjustadas(r.adicaoEstrutura, ajustes)) {
    for (const l of linhasDoKit(base, chaveKit(est.codigo), ajustes[chaveKit(est.codigo)])) {
      if (l.aMais <= 0) continue
      const s = extra.get(l.codigo) ?? { codigo: l.codigo, descricao: l.descricao, unidade: l.unidade, doCad: 0, daEstratificacao: 0, total: 0, estruturas: '', foraDoCatalogo: l.foraDoCatalogo, quais: [] }
      s.daEstratificacao = arred(s.daEstratificacao + l.aMais * est.quantidade)
      s.quais.push(`${est.codigo} (${est.quantidade})`)
      extra.set(l.codigo, s)
    }
  }
  const doCad = new Map(r.adicaoMaterial.filter((l) => !l.semCodigo).map((l) => [l.codigo, l.quantidade]))
  const adicaoMaterial: Linha[] = r.adicaoMaterial.map((l) => {
    const s = l.semCodigo ? undefined : extra.get(l.codigo)
    return s ? { ...l, quantidade: arred(l.quantidade + s.daEstratificacao), origem: [...l.origem, 'estratificação'] } : l
  })
  for (const s of extra.values()) {
    if (doCad.has(s.codigo)) continue
    adicaoMaterial.push({
      codigo: s.codigo, descricao: s.descricao, quantidade: s.daEstratificacao, origem: ['estratificação'],
      ...(s.foraDoCatalogo ? { foraDaBase: true } : {}),
    })
  }
  // um Somado por material, na ordem da Adição de material final
  const somados: Somado[] = []
  for (const l of adicaoMaterial) {
    const s = l.semCodigo ? undefined : extra.get(l.codigo)
    if (!s) continue
    const antes = doCad.get(s.codigo) ?? 0
    somados.push({
      codigo: s.codigo, descricao: s.descricao, unidade: s.unidade, doCad: antes,
      daEstratificacao: s.daEstratificacao, total: arred(antes + s.daEstratificacao),
      estruturas: s.quais.join(', '), foraDoCatalogo: s.foraDoCatalogo,
    })
  }
  return { adicaoMaterial, somados }
}
