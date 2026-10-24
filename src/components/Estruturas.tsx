import { useMemo, useState } from 'react'
import { CaretDown, MagnifyingGlass, Plus, Stack, Trash, X } from '@phosphor-icons/react'
import { casa, formatarQtd } from '../lib/busca'
import { OPERACOES, nomeOper, novoId, type Atualiza, type EstruturaLanc, type Kit } from '../state'
import { Botao, EscolhaOper, Painel, Quantidade, Selo, SeloLancado, Titulo, Vazio } from './ui'

export interface KitIndexado extends Kit {
  norm: string
}

interface Props {
  kits: KitIndexado[]
  previstos: Set<number> // códigos que estão planejados na ADS
  estruturas: EstruturaLanc[]
  onChange: Atualiza<EstruturaLanc[]>
}

const LIMITE = 60

export function Estruturas({ kits, previstos, estruturas, onChange }: Props) {
  const [busca, setBusca] = useState('')
  const [oper, setOper] = useState('2000')
  const [aberto, setAberto] = useState<string | null>(null)

  const comPontos = useMemo(
    () => kits.map((k) => ({ k, nPrev: k.itens.filter((i) => previstos.has(i.code)).length })),
    [kits, previstos],
  )

  const resultados = useMemo(() => {
    const lista = busca.trim() ? comPontos.filter(({ k }) => casa(k.norm, busca)) : comPontos.filter((x) => x.nPrev > 0)
    return lista.sort((a, b) => b.nPrev / Math.max(1, b.k.itens.length) - a.nPrev / Math.max(1, a.k.itens.length)).slice(0, LIMITE)
  }, [busca, comPontos])

  const adicionar = (kit: string) =>
    onChange((lista) => {
      const existente = lista.find((e) => e.kit === kit && e.oper === oper)
      return existente ? lista.map((e) => (e === existente ? { ...e, qtd: e.qtd + 1 } : e)) : [...lista, { id: novoId(), kit, oper, qtd: 1 }]
    })

  const porKit = useMemo(() => new Map(kits.map((k) => [k.kit, k])), [kits])
  const total = estruturas.reduce((s, e) => s + e.qtd, 0)
  // quanto de cada kit já foi lançado (em qualquer operação), para dar retorno na lista de busca
  const lancadoPorKit = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of estruturas) m.set(e.kit, (m.get(e.kit) ?? 0) + e.qtd)
    return m
  }, [estruturas])

  const textoInfo = !busca.trim()
    ? 'Sugestões: estruturas com materiais previstos nesta obra'
    : resultados.length === LIMITE
      ? `Mostrando as ${LIMITE} primeiras: escreva mais para refinar`
      : `${resultados.length} ${resultados.length === 1 ? 'estrutura encontrada' : 'estruturas encontradas'}`

  return (
    <div>
      <Titulo titulo="Estruturas" sub="Procure o kit pelo nome ou pela descrição. Os materiais dele entram somados na ADS." />
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.7fr)] gap-6 items-start">
        <Painel>
          <div className="grid gap-4 p-4 md:p-5 xl:p-4 border-b border-line">
            <div className="grid gap-2">
              <span className="text-xs font-medium text-muted">Lançar na operação</span>
              <EscolhaOper compacto valor={oper} onChange={setOper} />
            </div>
            <label className="relative block">
              <span className="sr-only">Buscar estrutura</span>
              <MagnifyingGlass size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Ex.: CE3, trafo 75, afastador, KP-AF"
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
              {estruturas.length > 0 && (
                <a href="#lancadas" className="xl:hidden shrink-0 font-medium text-text underline underline-offset-4 decoration-line-strong">
                  Lançadas: {formatarQtd(total)}
                </a>
              )}
            </div>
          </div>

          <ul className="divide-y divide-line">
            {resultados.map(({ k, nPrev }) => {
              const exp = aberto === k.kit
              const jaLancado = lancadoPorKit.get(k.kit) ?? 0
              return (
                <li key={k.kit}>
                  <div className="flex items-center gap-3 px-3 md:px-4 py-2 min-h-16">
                    <button
                      type="button"
                      onClick={() => setAberto(exp ? null : k.kit)}
                      className="press flex-1 min-w-0 flex items-center gap-3 text-left rounded-ctl px-2 py-1.5 hover:bg-surface-2"
                      aria-expanded={exp}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-base font-semibold break-words">{k.kit}</span>
                          {nPrev > 0 && (
                            <Selo tom="destaque">
                              {nPrev} de {k.itens.length} previstos
                            </Selo>
                          )}
                          {!k.itens.length && <Selo tom="perigo">sem material</Selo>}
                          {jaLancado > 0 && <SeloLancado qtd={jaLancado} singular="lançada" plural="lançadas" />}
                        </span>
                        <span className="block text-sm text-muted line-clamp-2">{k.descricao || 'Sem descrição'}</span>
                      </span>
                      <CaretDown size={18} className={`shrink-0 text-muted transition-transform ${exp ? 'rotate-180' : ''}`} />
                    </button>
                    <Botao variante="secundario" onClick={() => adicionar(k.kit)} aria-label={`Adicionar ${k.kit} na operação ${oper}`} className="max-sm:px-2.5 max-sm:min-w-12 shrink-0">
                      <Plus size={18} weight="bold" /> <span className="max-sm:hidden">Adicionar</span>
                      <span className="num sm:hidden text-sm font-semibold">{oper}</span>
                    </Botao>
                  </div>
                  {exp && (
                    <ul className="entra mx-3 md:mx-4 mb-3 grid gap-2 rounded-ctl bg-surface-2 p-3 md:p-4 text-sm">
                      {k.itens.map((i) => (
                        <li key={i.code} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[76px_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5">
                          <span className="num text-muted max-sm:col-span-2 max-sm:text-xs">{i.code}</span>
                          <span className="min-w-0">{i.desc}</span>
                          <span className="flex flex-col items-end sm:flex-row sm:items-baseline sm:gap-3">
                            <span className="num whitespace-nowrap font-medium">
                              {formatarQtd(i.qtd)} {i.un}
                            </span>
                            {previstos.has(i.code) && <span className="text-xs font-medium text-accent-text">previsto</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
          {!resultados.length && <Vazio icone={<MagnifyingGlass size={32} />} titulo="Nenhuma estrutura encontrada" texto="Tente outra parte do nome, por exemplo só o número (CE3) ou uma palavra da descrição." />}
        </Painel>

        <Painel className="p-4 md:p-5 xl:sticky xl:top-[88px] xl:max-h-[calc(100dvh-104px)] xl:overflow-y-auto scroll-mt-24">
          <div id="lancadas" className="flex items-end justify-between gap-3 scroll-mt-24">
            <h2 className="text-lg font-semibold">Lançadas</h2>
            <p className="flex items-baseline gap-2">
              <span className="num text-titulo font-semibold leading-none">{formatarQtd(total)}</span>
              <span className="text-sm text-muted">{total === 1 ? 'estrutura' : 'estruturas'}</span>
            </p>
          </div>
          {!estruturas.length ? (
            <Vazio icone={<Stack size={32} />} titulo="Nenhuma estrutura ainda" texto="Escolha a operação, procure o kit e clique em Adicionar." />
          ) : (
            OPERACOES.filter((o) => estruturas.some((e) => e.oper === o.oper)).map((o) => {
              const doGrupo = estruturas.filter((e) => e.oper === o.oper)
              return (
                <div key={o.oper} className="mt-4">
                  <div className="flex items-center justify-between gap-3 rounded-ctl bg-surface-2 px-3 h-10">
                    <h3 className="text-sm font-semibold">
                      <span className="num">{o.oper}</span> <span className="font-medium text-muted">{nomeOper(o.oper)}</span>
                    </h3>
                    <span className="num text-sm font-semibold">{formatarQtd(doGrupo.reduce((s, e) => s + e.qtd, 0))}</span>
                  </div>
                  <ul className="divide-y divide-line">
                    {doGrupo.map((e) => (
                      <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 px-1">
                        <div className="flex-1 basis-56 min-w-0">
                          <p className="text-base font-semibold break-words">{e.kit}</p>
                          <p className="text-sm text-muted line-clamp-2">{porKit.get(e.kit)?.descricao}</p>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <Quantidade grande valor={e.qtd} onChange={(n) => onChange((l) => l.map((x) => (x.id === e.id ? { ...x, qtd: n } : x)))} rotulo={`Quantidade de ${e.kit}`} />
                          <Botao
                            variante="perigo"
                            icone
                            className="border border-line-strong"
                            aria-label={`Remover ${e.kit}`}
                            title="Remover"
                            onClick={() => onChange((l) => l.filter((x) => x.id !== e.id))}
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
