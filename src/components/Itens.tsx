import { useMemo, useState, type ReactNode } from 'react'
import { MagnifyingGlass, Package, Plus, Trash, Wrench, X } from '@phosphor-icons/react'
import { casa, formatarQtd, normalizar } from '../lib/busca'
import { nomeOperacao, operacoesComLancadas, ehMaoDeObra, ehQuilo, novoId, type Atualiza, type ItemLanc } from '../state'
import type { ItemCatalogo } from '../core/inventario'
import type { Operacao } from '../core/inventario'
import { Botao, EscolhaOper, Painel, Quantidade, Selo, SeloLancado, Titulo, Unidade, Vazio } from './ui'

export interface CatalogoIndexado extends ItemCatalogo {
  norm: string
}

export interface Previsto {
  code: number
  desc: string
  un: string
  opers: { oper: string; planejado: number }[]
}

interface Props {
  tipo: 'material' | 'servico'
  catalogo: CatalogoIndexado[]
  previstos: Previsto[]
  /** Todas as operações da obra, de instalação e de retirada (sucata). */
  operacoes: Operacao[]
  itens: ItemLanc[]
  onChange: Atualiza<ItemLanc[]>
}

const LIMITE = 60
const LIMITE_PREVISTOS = 200


type Base = { code: number; desc: string; un: string }

export function Itens({ tipo, catalogo, previstos, operacoes, itens, onChange }: Props) {
  const [busca, setBusca] = useState('')
  const [oper, setOper] = useState(operacoes[0]?.oper ?? '')
  const servico = tipo === 'servico'

  const meus = useMemo(() => itens.filter((i) => i.tipo === tipo), [itens, tipo])
  const prevDoTipo = useMemo(() => previstos.filter((p) => ehMaoDeObra(p.code) === servico), [previstos, servico])

  const q = busca.trim()

  // previstos que casam com a busca; a lista mostrada é cortada no limite
  const prevCasam = useMemo(() => (q ? prevDoTipo.filter((p) => casa(normalizar(`${p.code} ${p.desc}`), q)) : prevDoTipo), [q, prevDoTipo])
  const prevFiltrados = useMemo(() => prevCasam.slice(0, q ? LIMITE : LIMITE_PREVISTOS), [q, prevCasam])
  const prevCortados = prevCasam.length > prevFiltrados.length

  // cadastro completo, sem repetir os previstos que já aparecem na lista de cima
  // (um previsto que só casa pelo texto do cadastro continua aparecendo aqui)
  const { cadastro, cadastroCortado } = useMemo(() => {
    const lista: CatalogoIndexado[] = []
    if (!q) return { cadastro: lista, cadastroCortado: false }
    const mostrados = new Set(prevFiltrados.map((p) => p.code))
    for (const c of catalogo) {
      if (ehMaoDeObra(c.code) !== servico || mostrados.has(c.code) || !casa(c.norm, q)) continue
      if (lista.length >= LIMITE) return { cadastro: lista, cadastroCortado: true } // achou o 61º: há mais
      lista.push(c)
    }
    return { cadastro: lista, cadastroCortado: false }
  }, [q, catalogo, prevFiltrados, servico])

  // quanto de cada código já foi lançado (em qualquer operação), para dar retorno na lista de busca
  const lancadoPorCodigo = useMemo(() => {
    const m = new Map<number, number>()
    for (const i of meus) m.set(i.code, (m.get(i.code) ?? 0) + i.qtd)
    return m
  }, [meus])

  const adicionar = (c: Base) =>
    onChange((lista) => {
      const ex = lista.find((i) => i.tipo === tipo && i.code === c.code && i.oper === oper)
      return ex ? lista.map((i) => (i === ex ? { ...i, qtd: i.qtd + 1 } : i)) : [...lista, { id: novoId(), tipo, code: c.code, desc: c.desc, un: c.un, oper, qtd: 1 }]
    })

  const titulo = servico ? 'Mão de obra' : 'Materiais avulsos'
  const sub = servico
    ? 'Serviços (código que começa com 7) que entram além das estruturas. Procure pelo nome do serviço ou pelo código.'
    : 'Materiais que faltaram nas estruturas ou foram aplicados soltos. Os previstos da obra aparecem primeiro.'
  const nomeItem = servico ? 'serviço' : 'material'
  const nomeItens = servico ? 'serviços' : 'materiais'

  const nCasam = prevCasam.length + cadastro.length
  const textoInfo = !q
    ? prevDoTipo.length
      ? prevCortados
        ? `Sugestões: ${prevFiltrados.length} dos ${prevDoTipo.length} ${nomeItens} previstos nesta obra. Escreva para procurar os outros`
        : `Sugestões: ${nomeItens} previstos nesta obra`
      : `Escreva o nome ou o código do ${nomeItem} para procurar no cadastro`
    : prevCortados || cadastroCortado
      ? `Mostrando ${[
          prevCasam.length ? (prevCortados ? `${prevFiltrados.length} dos ${prevCasam.length} previstos` : `os ${prevCasam.length} previstos`) : '',
          cadastro.length ? (cadastroCortado ? `os ${LIMITE} primeiros do cadastro` : `${cadastro.length} do cadastro`) : '',
        ]
          .filter(Boolean)
          .join(' e ')}: escreva mais para refinar`
      : `${nCasam} ${nCasam === 1 ? `${nomeItem} encontrado` : `${nomeItens} encontrados`}`

  const faixa = (texto: string) => (
    <li className="bg-surface-2 px-4 h-10 flex items-center text-sm font-semibold">
      {texto}
    </li>
  )

  const linha = (c: Base, selosExtra?: ReactNode) => {
    const jaLancado = lancadoPorCodigo.get(c.code) ?? 0
    return (
      <li key={c.code} className="flex items-center gap-3 px-3 md:px-4 py-2 min-h-16">
        <div className="min-w-0 flex-1 px-2 py-1.5">
          <p className="text-base font-semibold break-words line-clamp-2" title={c.desc || undefined}>{c.desc || 'Sem descrição'}</p>
          <p className="text-sm text-muted">
            <span className="num">{c.code}</span> · <Unidade un={c.un} />
          </p>
          {(selosExtra || jaLancado > 0) && (
            <p className="mt-1 flex flex-wrap items-center gap-1.5">
              {selosExtra}
              {jaLancado > 0 && <SeloLancado qtd={jaLancado} singular="lançado" plural="lançados" />}
            </p>
          )}
        </div>
        <Botao variante="secundario" onClick={() => adicionar(c)} aria-label={`Adicionar ${c.desc} na operação ${oper}`} className="max-sm:px-2.5 max-sm:min-w-12 shrink-0">
          <Plus size={18} weight="bold" /> <span className="max-sm:hidden">Adicionar</span>
          <span className="num sm:hidden text-sm font-semibold">{oper}</span>
        </Botao>
      </li>
    )
  }

  const semResultado = q ? !prevFiltrados.length && !cadastro.length : !prevDoTipo.length

  return (
    <div>
      <Titulo titulo={titulo} sub={sub} />
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.7fr)] gap-6 items-start">
        <Painel>
          <div className="grid gap-4 p-4 md:p-5 xl:p-4 border-b border-line">
            <div className="grid gap-2">
              <span className="text-xs font-medium text-muted">Lançar na operação</span>
              <EscolhaOper compacto operacoes={operacoes} valor={oper} onChange={setOper} />
            </div>
            <label className="relative block">
              <span className="sr-only">Buscar {nomeItem}</span>
              <MagnifyingGlass size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={servico ? 'Ex.: estr prim, ramal, poste' : 'Ex.: isolador pino, cinta 200, 30058120'}
                className="h-12 w-full rounded-ctl border border-line-strong bg-surface pl-11 pr-12 text-base placeholder:text-muted/80 focus:border-text focus:outline-none"
              />
              {busca && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => setBusca('')}
                  className="press absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center size-11 rounded-ctl text-muted hover:text-text hover:bg-surface-2"
                >
                  <X size={18} weight="bold" />
                </button>
              )}
            </label>
            <div className="flex items-center justify-between gap-3 text-sm text-muted">
              <p>{textoInfo}</p>
              {meus.length > 0 && (
                <a href="#lancadas" className="xl:hidden shrink-0 font-medium text-text underline underline-offset-4 decoration-line-strong">
                  Lançados: {meus.length}
                </a>
              )}
            </div>
          </div>

          <ul className="divide-y divide-line">
            {prevFiltrados.length > 0 && faixa(`Previstos nesta obra (${prevCortados ? `${prevFiltrados.length} de ${prevCasam.length}` : prevFiltrados.length})`)}
            {prevFiltrados.map((p) =>
              linha(
                p,
                p.opers.map((o) => (
                  <Selo key={o.oper} tom="destaque">
                    <span className="num">{o.oper}</span> previsto {formatarQtd(o.planejado)}
                  </Selo>
                )),
              ),
            )}
            {cadastro.length > 0 && faixa(cadastroCortado ? `Cadastro completo (os ${LIMITE} primeiros)` : 'Cadastro completo')}
            {cadastro.map((c) => linha(c))}
          </ul>
          {semResultado &&
            (q ? (
              <Vazio icone={<MagnifyingGlass size={32} />} titulo="Nada encontrado" texto="Tente menos palavras, ou abreviações como aparecem no cadastro (ex.: ISOL, PARAF, CINTA)." />
            ) : (
              <Vazio icone={servico ? <Wrench size={32} /> : <Package size={32} />} titulo="Nenhum previsto deste tipo" texto="Digite na busca para procurar no cadastro completo do inventário." />
            ))}
        </Painel>

        <Painel className="p-4 md:p-5 xl:sticky xl:top-[88px] xl:max-h-[calc(100dvh-104px)] xl:overflow-y-auto scroll-mt-24">
          <div id="lancadas" className="flex items-end justify-between gap-3 scroll-mt-24">
            <h2 className="text-lg font-semibold">Lançados</h2>
            <p className="flex items-baseline gap-2">
              <span className="num text-titulo font-semibold leading-none">{meus.length}</span>
              <span className="text-sm text-muted">{meus.length === 1 ? 'item' : 'itens'}</span>
            </p>
          </div>
          {!meus.length ? (
            <Vazio icone={servico ? <Wrench size={32} /> : <Package size={32} />} titulo="Nada lançado ainda" texto="Escolha a operação, procure o item e clique em Adicionar." />
          ) : (
            operacoesComLancadas(operacoes, meus).map((o) => {
              const doGrupo = meus.filter((i) => i.oper === o.oper)
              return (
                <div key={o.oper} className="mt-4">
                  <div className="flex items-center justify-between gap-3 rounded-ctl bg-surface-2 px-3 h-10">
                    <h3 className="text-sm font-semibold">
                      <span className="num">{o.oper}</span> <span className="font-medium text-muted">{nomeOperacao(o)}</span>
                    </h3>
                    <span className="num text-sm font-semibold">{doGrupo.length}</span>
                  </div>
                  <ul className="divide-y divide-line">
                    {doGrupo.map((i) => (
                      <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 px-1">
                        <div className="flex-1 basis-56 min-w-0">
                          <p className="text-base font-semibold break-words line-clamp-2" title={i.desc}>{i.desc}</p>
                          <p className="text-sm text-muted">
                            <span className="num">{i.code}</span> · <Unidade un={i.un} />
                          </p>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <Quantidade grande valor={i.qtd} onChange={(n) => onChange((l) => l.map((x) => (x.id === i.id ? { ...x, qtd: n } : x)))} rotulo={`Quantidade de ${i.desc}`} emQuilo={ehQuilo(i.un)} />
                          <Botao
                            variante="perigo"
                            icone
                            className="border border-line-strong"
                            aria-label={`Remover ${i.desc}`}
                            title="Remover"
                            onClick={() => onChange((l) => l.filter((x) => x.id !== i.id))}
                          >
                            <Trash size={20} />
                          </Botao>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })
          )}
        </Painel>
      </div>
    </div>
  )
}
