import { useMemo, useState } from 'react'
import { Lightning, MagnifyingGlass, Package, Plus, Trash, Wrench } from '@phosphor-icons/react'
import { casa, formatarQtd, normalizar } from '../lib/busca'
import { OPERACOES, nomeOper, novoId, type Atualiza, type ItemLanc } from '../state'
import type { ItemCatalogo } from '../core/inventario'
import { Botao, EscolhaOper, Painel, Quantidade, Selo, Titulo, Vazio } from './ui'

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
  itens: ItemLanc[]
  onChange: Atualiza<ItemLanc[]>
}

const ehServico = (un: string) => un.trim().toUpperCase() === 'SRV'

export function Itens({ tipo, catalogo, previstos, itens, onChange }: Props) {
  const [busca, setBusca] = useState('')
  const [oper, setOper] = useState('2000')
  const doTipo = (un: string) => (tipo === 'servico' ? ehServico(un) : !ehServico(un))

  const meus = itens.filter((i) => i.tipo === tipo)
  const prevDoTipo = useMemo(() => previstos.filter((p) => doTipo(p.un)), [previstos, tipo]) // eslint-disable-line react-hooks/exhaustive-deps
  const prevCodes = useMemo(() => new Set(prevDoTipo.map((p) => p.code)), [prevDoTipo])

  const resultados = useMemo(() => {
    const q = busca.trim()
    if (!q) return []
    const lista: CatalogoIndexado[] = []
    for (const c of catalogo) {
      if (!doTipo(c.un) || !casa(c.norm, q)) continue
      lista.push(c)
      if (lista.length >= 400) break
    }
    // previstos primeiro
    return lista.sort((a, b) => Number(prevCodes.has(b.code)) - Number(prevCodes.has(a.code))).slice(0, 60)
  }, [busca, catalogo, prevCodes, tipo]) // eslint-disable-line react-hooks/exhaustive-deps

  const prevFiltrados = useMemo(() => {
    const q = busca.trim()
    return q ? prevDoTipo.filter((p) => casa(normalizar(`${p.code} ${p.desc}`), q)) : prevDoTipo
  }, [busca, prevDoTipo])

  const adicionar = (c: { code: number; desc: string; un: string }) =>
    onChange((lista) => {
      const ex = lista.find((i) => i.tipo === tipo && i.code === c.code && i.oper === oper)
      return ex ? lista.map((i) => (i === ex ? { ...i, qtd: i.qtd + 1 } : i)) : [...lista, { id: novoId(), tipo, code: c.code, desc: c.desc, un: c.un, oper, qtd: 1 }]
    })

  const titulo = tipo === 'servico' ? 'Mão de obra' : 'Materiais avulsos'
  const sub =
    tipo === 'servico'
      ? 'Serviços (unidade SRV) que entram além das estruturas. Procure pelo nome do serviço ou pelo código.'
      : 'Materiais que faltaram nas estruturas ou foram aplicados soltos. Os previstos da obra aparecem primeiro.'

  const linhaCatalogo = (c: { code: number; desc: string; un: string }, extra?: React.ReactNode) => (
    <li key={c.code} className="flex items-center gap-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{c.desc || 'Sem descrição'}</p>
        <p className="text-xs text-muted flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="num">{c.code}</span>
          <span>{c.un}</span>
          {extra}
        </p>
      </div>
      <Botao variante="secundario" onClick={() => adicionar(c)} aria-label={`Adicionar ${c.desc} na operação ${oper}`}>
        <Plus size={16} weight="bold" /> <span className="num">{oper}</span>
      </Botao>
    </li>
  )

  return (
    <div>
      <Titulo titulo={titulo} sub={sub} />
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-5 items-start">
        <Painel className="p-4 md:p-5">
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <span className="text-xs font-medium text-muted">Lançar na operação</span>
              <EscolhaOper valor={oper} onChange={setOper} />
            </div>
            <label className="relative block">
              <span className="sr-only">Buscar {tipo === 'servico' ? 'serviço' : 'material'}</span>
              <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={tipo === 'servico' ? 'Ex.: estr prim, ramal, poste' : 'Ex.: isolador pino, cinta 200, 30058120'}
                className="h-11 w-full rounded-ctl border border-line-strong bg-surface pl-10 pr-3 text-sm focus:border-text focus:outline-none"
              />
            </label>
          </div>

          {prevFiltrados.length > 0 && (
            <>
              <h2 className="mt-5 text-xs font-medium text-muted">Previstos nesta obra ({prevFiltrados.length})</h2>
              <ul className="divide-y divide-line">
                {prevFiltrados.slice(0, busca.trim() ? 30 : 200).map((p) =>
                  linhaCatalogo(
                    p,
                    p.opers.map((o) => (
                      <Selo key={o.oper} tom="destaque">
                        <span className="num">{o.oper}</span> prev. {formatarQtd(o.planejado)}
                      </Selo>
                    )),
                  ),
                )}
              </ul>
            </>
          )}

          {busca.trim() && (
            <>
              <h2 className="mt-5 text-xs font-medium text-muted">Cadastro completo</h2>
              <ul className="divide-y divide-line">{resultados.filter((r) => !prevCodes.has(r.code)).map((c) => linhaCatalogo(c))}</ul>
              {!resultados.length && !prevFiltrados.length && (
                <Vazio icone={<MagnifyingGlass size={28} />} titulo="Nada encontrado" texto="Tente menos palavras, ou abreviações como aparecem no cadastro (ex.: ISOL, PARAF, CINTA)." />
              )}
            </>
          )}
          {!busca.trim() && !prevDoTipo.length && (
            <Vazio icone={tipo === 'servico' ? <Wrench size={28} /> : <Package size={28} />} titulo="Nenhum previsto deste tipo" texto="Digite na busca para procurar no cadastro completo do inventário." />
          )}
        </Painel>

        <Painel className="p-4 md:p-5 xl:sticky xl:top-20">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Lançados</h2>
            <span className="text-sm text-muted num">{meus.length} {meus.length === 1 ? 'item' : 'itens'}</span>
          </div>
          {!meus.length ? (
            <Vazio icone={<Lightning size={28} />} titulo="Nada lançado ainda" texto="Escolha a operação, procure o item e clique no botão com o número da operação." />
          ) : (
            OPERACOES.filter((o) => meus.some((i) => i.oper === o.oper)).map((o) => (
              <div key={o.oper} className="mt-3">
                <p className="text-xs font-medium text-muted mb-1">
                  <span className="num">{o.oper}</span> {nomeOper(o.oper)}
                </p>
                <ul className="divide-y divide-line">
                  {meus
                    .filter((i) => i.oper === o.oper)
                    .map((i) => (
                      <li key={i.id} className="flex items-center gap-2 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{i.desc}</p>
                          <p className="text-xs text-muted">
                            <span className="num">{i.code}</span> {i.un}
                          </p>
                        </div>
                        <Quantidade valor={i.qtd} onChange={(n) => onChange((l) => l.map((x) => (x.id === i.id ? { ...x, qtd: n } : x)))} rotulo={`Quantidade de ${i.desc}`} />
                        <Botao variante="perigo" className="w-10 px-0" aria-label={`Remover ${i.desc}`} onClick={() => onChange((l) => l.filter((x) => x.id !== i.id))}>
                          <Trash size={16} />
                        </Botao>
                      </li>
                    ))}
                </ul>
              </div>
            ))
          )}
        </Painel>
      </div>
    </div>
  )
}
