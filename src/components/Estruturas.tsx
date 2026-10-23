import { useMemo, useState } from 'react'
import { CaretDown, MagnifyingGlass, Plus, Stack, Trash } from '@phosphor-icons/react'
import { casa, formatarQtd } from '../lib/busca'
import { OPERACOES, nomeOper, novoId, type Atualiza, type EstruturaLanc, type Kit } from '../state'
import { Botao, EscolhaOper, Painel, Quantidade, Selo, Titulo, Vazio } from './ui'

export interface KitIndexado extends Kit {
  norm: string
}

interface Props {
  kits: KitIndexado[]
  previstos: Set<number> // códigos que estão planejados na ADS
  estruturas: EstruturaLanc[]
  onChange: Atualiza<EstruturaLanc[]>
}

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
    return lista.sort((a, b) => b.nPrev / Math.max(1, b.k.itens.length) - a.nPrev / Math.max(1, a.k.itens.length)).slice(0, 60)
  }, [busca, comPontos])

  const adicionar = (kit: string) =>
    onChange((lista) => {
      const existente = lista.find((e) => e.kit === kit && e.oper === oper)
      return existente ? lista.map((e) => (e === existente ? { ...e, qtd: e.qtd + 1 } : e)) : [...lista, { id: novoId(), kit, oper, qtd: 1 }]
    })

  const porKit = useMemo(() => new Map(kits.map((k) => [k.kit, k])), [kits])
  const total = estruturas.reduce((s, e) => s + e.qtd, 0)

  return (
    <div>
      <Titulo titulo="Estruturas" sub="Procure o kit pelo nome ou pela descrição. Os materiais de cada estrutura entram somados na ADS, na operação escolhida." />
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-5 items-start">
        <Painel className="p-4 md:p-5">
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <span className="text-xs font-medium text-muted">Lançar na operação</span>
              <EscolhaOper valor={oper} onChange={setOper} />
            </div>
            <label className="relative block">
              <span className="sr-only">Buscar estrutura</span>
              <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Ex.: CE3, trafo 75, afastador, KP-AF"
                className="h-11 w-full rounded-ctl border border-line-strong bg-surface pl-10 pr-3 text-sm focus:border-text focus:outline-none"
              />
            </label>
            <p className="text-xs text-muted">
              {busca.trim() ? `${resultados.length === 60 ? 'Mais de 60' : resultados.length} estruturas encontradas` : 'Sugestões: estruturas com materiais previstos nesta obra'}
            </p>
          </div>

          <ul className="mt-3 divide-y divide-line">
            {resultados.map(({ k, nPrev }) => {
              const exp = aberto === k.kit
              return (
                <li key={k.kit} className="py-2.5">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setAberto(exp ? null : k.kit)} className="press flex-1 min-w-0 text-left rounded-md -m-1 p-1 hover:bg-surface-2" aria-expanded={exp}>
                      <span className="flex items-center gap-2">
                        <span className="num text-sm font-semibold truncate">{k.kit}</span>
                        {nPrev > 0 && <Selo tom="destaque">{nPrev} de {k.itens.length} previstos</Selo>}
                        {!k.itens.length && <Selo tom="perigo">sem material</Selo>}
                        <CaretDown size={14} className={`text-muted transition-transform ${exp ? 'rotate-180' : ''}`} />
                      </span>
                      <span className="block text-xs text-muted truncate">{k.descricao || 'Sem descrição'}</span>
                    </button>
                    <Botao variante="secundario" onClick={() => adicionar(k.kit)} aria-label={`Adicionar ${k.kit} na operação ${oper}`}>
                      <Plus size={16} weight="bold" /> <span className="num">{oper}</span>
                    </Botao>
                  </div>
                  {exp && (
                    <ul className="entra mt-2 ml-1 grid gap-1 text-xs">
                      {k.itens.map((i) => (
                        <li key={i.code} className="flex gap-2">
                          <span className="num text-muted w-[72px] shrink-0">{i.code}</span>
                          <span className="flex-1 truncate">{i.desc}</span>
                          <span className="num">{formatarQtd(i.qtd)} {i.un}</span>
                          {previstos.has(i.code) && <span className="text-accent-text" title="Previsto na obra">●</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
          {!resultados.length && <Vazio icone={<MagnifyingGlass size={28} />} titulo="Nenhuma estrutura encontrada" texto="Tente outra parte do nome, por exemplo só o número (CE3) ou uma palavra da descrição." />}
        </Painel>

        <Painel className="p-4 md:p-5 xl:sticky xl:top-20">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Lançadas</h2>
            <span className="text-sm text-muted num">{total} {total === 1 ? 'estrutura' : 'estruturas'}</span>
          </div>
          {!estruturas.length ? (
            <Vazio icone={<Stack size={28} />} titulo="Nenhuma estrutura ainda" texto="Escolha a operação, procure o kit e clique no botão com o número da operação." />
          ) : (
            OPERACOES.filter((o) => estruturas.some((e) => e.oper === o.oper)).map((o) => (
              <div key={o.oper} className="mt-3">
                <p className="text-xs font-medium text-muted mb-1">
                  <span className="num">{o.oper}</span> {nomeOper(o.oper)}
                </p>
                <ul className="divide-y divide-line">
                  {estruturas
                    .filter((e) => e.oper === o.oper)
                    .map((e) => (
                      <li key={e.id} className="flex items-center gap-2 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="num text-sm font-medium truncate">{e.kit}</p>
                          <p className="text-xs text-muted truncate">{porKit.get(e.kit)?.descricao}</p>
                        </div>
                        <Quantidade valor={e.qtd} onChange={(n) => onChange((l) => l.map((x) => (x.id === e.id ? { ...x, qtd: n } : x)))} rotulo={`Quantidade de ${e.kit}`} />
                        <Botao variante="perigo" className="w-10 px-0" aria-label={`Remover ${e.kit}`} onClick={() => onChange((l) => l.filter((x) => x.id !== e.id))}>
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
