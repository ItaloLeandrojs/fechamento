import { useMemo, useState } from 'react'
import { CheckCircle, DownloadSimple, Info, WarningCircle } from '@phosphor-icons/react'
import { decidirDestinos, gruposDaAds, type AdsRow, type Lancamento } from '../core/ads'
import type { ItemCatalogo } from '../core/inventario'
import { formatarQtd } from '../lib/busca'
import { Botao, Painel, Selo, Titulo, Vazio } from './ui'

interface LinhaPrevia {
  row: number | null
  code: number
  desc: string
  un: string
  oper: string
  planejado: number
  aplicado: number
  nova: boolean
  mudouOper: boolean
}

interface Props {
  ads: AdsRow[]
  catalogo: Map<number, ItemCatalogo>
  lancamentos: Lancamento[]
  avisos: string[]
  pendencias: string[]
  gerando: boolean
  resultado: string | null
  erro: string | null
  onGerar: () => void
  /** O que a conferência automática achou no arquivo gerado (null = nada pendente). */
  problemasArquivo: string[] | null
  onBaixarMesmoAssim: () => void
}

/** Diferença entre o aplicado e o planejado, sem ruído de ponto flutuante. */
const difDe = (l: LinhaPrevia) => +(l.aplicado - l.planejado).toFixed(6)

function Numero({ valor, tom }: { valor: number; tom?: 'ok' | 'perigo' }) {
  if (valor === 0 && tom) return <span className="text-muted">-</span>
  return <span className={`num ${tom === 'ok' ? 'text-ok font-semibold' : tom === 'perigo' ? 'text-danger font-semibold' : ''}`}>{formatarQtd(valor)}</span>
}

export function Revisao({ ads, catalogo, lancamentos, avisos, pendencias, gerando, resultado, erro, onGerar, problemasArquivo, onBaixarMesmoAssim }: Props) {
  const [soMudancas, setSoMudancas] = useState(true)

  const { linhas, novas, mudouOper } = useMemo(() => {
    const destinos = decidirDestinos(ads, lancamentos)
    const porLinha = new Map<number, number>()
    for (const d of destinos) if (d.row !== null) porLinha.set(d.row, (porLinha.get(d.row) ?? 0) + d.qty)
    const linhas: LinhaPrevia[] = ads
      .filter((r) => r.code !== null)
      .map((r) => ({
        row: r.row,
        code: r.code!,
        desc: r.descricao || catalogo.get(r.code!)?.desc || '',
        un: r.unidade || catalogo.get(r.code!)?.un || '',
        oper: r.oper,
        planejado: r.planejado,
        aplicado: porLinha.get(r.row) ?? 0,
        nova: false,
        mudouOper: destinos.some((d) => d.row === r.row && d.motivo === 'outra-operacao'),
      }))
    const agrup = new Map<string, LinhaPrevia>()
    const groupOf = gruposDaAds(ads)
    for (const d of destinos) {
      if (d.row !== null) continue
      const k = d.code + '|' + groupOf(d.oper).join(',')
      const ex = agrup.get(k)
      if (ex) ex.aplicado += d.qty
      else {
        const c = catalogo.get(d.code)
        agrup.set(k, { row: null, code: d.code, desc: c?.desc ?? 'Código fora do cadastro do inventário', un: c?.un ?? '', oper: '', planejado: 0, aplicado: d.qty, nova: true, mudouOper: false })
      }
    }
    return { linhas, novas: [...agrup.values()], mudouOper: destinos.filter((d) => d.motivo === 'outra-operacao').length }
  }, [ads, catalogo, lancamentos])

  const visiveis = soMudancas ? linhas.filter((l) => l.aplicado !== l.planejado) : linhas
  const totalAplicado = linhas.filter((l) => l.aplicado > 0).length
  const bloqueado = pendencias.length > 0

  const totais = [
    { rotulo: 'Linhas com aplicado', valor: totalAplicado },
    { rotulo: 'Linhas novas', valor: novas.length },
    { rotulo: 'Foram para outra operação', valor: mudouOper },
    { rotulo: 'Ficam com zero', valor: linhas.length - totalAplicado },
  ]

  return (
    <div className={`max-[1319px]:pb-36`}>
      <Titulo titulo="Revisar e baixar" sub="Confira como a ADS vai ficar. Todo item que não foi lançado fica com Aplicado 0 e o planejado vai para Devolvido." />

      <div className={`grid grid-cols-1 min-[1320px]:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start`}>
        {/* resumo, pendências e botão: em cima no celular, ao lado (preso) no computador */}
        <div className={`min-[1320px]:order-2 min-[1320px]:sticky min-[1320px]:top-[88px] min-[1320px]:max-h-[calc(100dvh-104px)] flex flex-col rounded-panel border border-line bg-surface`}>
          <div tabIndex={0} role="region" aria-label="Resumo da revisão" className="min-h-0 flex-1 overflow-y-auto grid gap-5 p-4 md:p-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
              {totais.map((t) => (
                <div key={t.rotulo} className="flex flex-col-reverse justify-end">
                  <dt className="mt-1.5 text-sm text-muted leading-snug">{t.rotulo}</dt>
                  <dd className="num text-titulo font-semibold leading-none">{t.valor}</dd>
                </div>
              ))}
            </dl>

            {bloqueado && (
              <section aria-labelledby="rev-pend" className="grid gap-2">
                <h2 id="rev-pend" className="text-sm font-semibold text-danger">
                  Falta resolver ({pendencias.length})
                </h2>
                <ul className="grid gap-2">
                  {pendencias.map((p) => (
                    <li key={p} className="flex gap-2.5 text-sm text-danger bg-danger-soft rounded-ctl p-3">
                      <WarningCircle size={20} weight="bold" className="shrink-0 mt-0.5" /> <span className="min-w-0 break-words">{p}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {avisos.length > 0 && (
              <section aria-labelledby="rev-avisos" className="grid gap-2">
                <h2 id="rev-avisos" className="text-sm font-semibold text-accent-text">
                  Para conferir ({avisos.length})
                </h2>
                <ul className="grid gap-2">
                  {avisos.map((p) => (
                    <li key={p} className="flex gap-2.5 text-sm text-accent-text bg-accent-soft rounded-ctl p-3">
                      <Info size={20} weight="bold" className="shrink-0 mt-0.5" /> <span className="min-w-0 break-words">{p}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="text-sm text-muted">Abra o arquivo no Excel e confira antes de enviar. O Excel recalcula os valores ao abrir e pode perguntar se quer salvar.</p>
          </div>

          {/* a mesma caixa é o rodapé do painel (computador) e a barra presa na base da tela (celular e tela pequena) */}
          <div
            className={`shrink-0 grid gap-2.5 border-t border-line p-4 md:px-5 max-[1319px]:fixed max-[1319px]:inset-x-0 max-[1319px]:bottom-0 max-[1319px]:z-30 max-[1319px]:bg-surface max-[1319px]:shadow-panel max-[1319px]:pb-[max(1rem,env(safe-area-inset-bottom))] max-[1319px]:border-line-strong`}
          >
            {resultado && (
              <p role="status" className="flex gap-2.5 text-sm text-ok bg-ok-soft rounded-ctl p-3">
                <CheckCircle size={20} weight="bold" className="shrink-0 mt-0.5" /> <span className="min-w-0 break-words">{resultado}</span>
              </p>
            )}
            {problemasArquivo && (
              <section role="alert" aria-labelledby="rev-conf" className="grid gap-2 max-h-[40dvh] overflow-y-auto rounded-ctl bg-danger-soft p-3 text-sm text-danger">
                <h2 id="rev-conf" className="flex gap-2 font-semibold">
                  <WarningCircle size={20} weight="bold" className="shrink-0" />
                  A conferência do arquivo achou {problemasArquivo.length === 1 ? '1 problema' : `${problemasArquivo.length} problemas`}. Ele ainda não foi baixado.
                </h2>
                <ul className="grid gap-1.5 list-disc pl-5">
                  {problemasArquivo.map((p, i) => (
                    <li key={i} className="break-words">
                      {p}
                    </li>
                  ))}
                </ul>
                <p className="text-text">Corrija e gere de novo. Se precisar do arquivo assim mesmo, baixe e confira no Excel antes de enviar.</p>
                <Botao variante="secundario" className="w-full text-sm" onClick={onBaixarMesmoAssim}>
                  <DownloadSimple size={18} /> Baixar mesmo assim
                </Botao>
              </section>
            )}
            {erro && (
              <p role="alert" className="flex gap-2.5 text-sm text-danger bg-danger-soft rounded-ctl p-3">
                <WarningCircle size={20} weight="bold" className="shrink-0 mt-0.5" /> <span className="min-w-0 break-words">{erro}</span>
              </p>
            )}
            {bloqueado && (
              <p className="text-sm text-danger">
                Resolva {pendencias.length === 1 ? 'a pendência' : `as ${pendencias.length} pendências`} para baixar.
              </p>
            )}
            <Botao variante="primario" className="h-14 w-full min-w-0 text-base" onClick={onGerar} disabled={gerando || bloqueado}>
              <DownloadSimple size={22} weight="bold" /> {gerando ? 'Gerando…' : 'Gerar e baixar a planilha'}
            </Botao>
          </div>
        </div>

        <div className={`grid gap-6 min-w-0 min-[1320px]:order-1`}>
          <Painel className="overflow-clip">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 md:px-5 py-3 border-b border-line">
              <div>
                <h2 className="text-lg font-semibold">Linhas previstas da ADS</h2>
                <p className="text-sm text-muted">
                  Mostrando <span className="num">{visiveis.length}</span> de <span className="num">{linhas.length}</span>
                </p>
              </div>
              <label className="press flex items-center gap-3 min-h-12 -mr-2 pr-2 rounded-ctl text-sm cursor-pointer">
                <input type="checkbox" checked={soMudancas} onChange={(e) => setSoMudancas(e.target.checked)} className="accent-[var(--accent)] size-5 shrink-0" />
                Só as que ficam diferentes do planejado
              </label>
            </div>

            {!visiveis.length ? (
              <Vazio icone={<CheckCircle size={32} />} titulo="Nenhuma linha diferente do planejado" texto="Tudo ficaria igual à ADS que veio. Desmarque o filtro para ver todas as linhas." />
            ) : (
              <>
                {/* computador: tabela com cabeçalho preso ao rolar a página, todas as colunas cabem */}
                <table className="hidden lg:table w-full table-fixed text-sm">
                  <caption className="sr-only">Linhas previstas da ADS: planejado, aplicado, adicional e devolvido</caption>
                  <colgroup>
                    <col className="w-[60px]" />
                    <col className="w-[88px]" />
                    <col />
                    <col className="w-[80px]" />
                    <col className="w-[76px]" />
                    <col className="w-[80px]" />
                    <col className="w-[92px]" />
                  </colgroup>
                  <thead className="text-xs text-muted text-left">
                    <tr>
                      {[
                        ['Op.', 'pl-4 pr-1'],
                        ['Código', 'px-2'],
                        ['Descrição', 'px-2'],
                        ['Planejado', 'px-2 text-right'],
                        ['Aplicado', 'px-2 text-right'],
                        ['Adicional', 'px-2 text-right'],
                        ['Devolvido', 'pl-2 pr-4 text-right'],
                      ].map(([nome, cls]) => (
                        <th key={nome} scope="col" className={`sticky top-[72px] z-10 bg-surface-2 py-2.5 font-semibold shadow-[0_1px_0_var(--line)] ${cls}`}>
                          {nome}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visiveis.map((l) => {
                      const dif = difDe(l)
                      return (
                        <tr key={l.row} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                          <td className="pl-4 pr-1 py-2.5 num align-top">{l.oper}</td>
                          <td className="px-2 py-2.5 num text-muted align-top">{l.code}</td>
                          <td className="px-2 py-2.5 align-top">
                            <span className="line-clamp-2 break-words leading-snug" title={l.desc}>
                              {l.desc}
                            </span>
                            {l.mudouOper && (
                              <span className="mt-1 inline-block">
                                <Selo tom="destaque">recebeu de outra operação</Selo>
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-right text-muted align-top">
                            <Numero valor={l.planejado} />
                          </td>
                          <td className="px-2 py-2.5 text-right font-semibold align-top">
                            <Numero valor={l.aplicado} />
                          </td>
                          <td className="px-2 py-2.5 text-right align-top">
                            <Numero valor={dif > 0 ? dif : 0} tom="ok" />
                          </td>
                          <td className="pl-2 pr-4 py-2.5 text-right align-top">
                            <Numero valor={dif < 0 ? -dif : 0} tom="perigo" />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* celular e tela pequena: um cartão por linha, com as quatro quantidades rotuladas */}
                <ul className="lg:hidden divide-y divide-line">
                  {visiveis.map((l) => {
                    const dif = difDe(l)
                    return (
                      <li key={l.row} className="px-4 md:px-5 py-3.5 grid gap-2.5">
                        <div className="min-w-0">
                          <p className="text-sm text-muted">
                            Operação <span className="num font-semibold text-text">{l.oper}</span> <span aria-hidden>·</span> código <span className="num">{l.code}</span>
                          </p>
                          <p className="mt-0.5 text-base line-clamp-2 break-words" title={l.desc}>{l.desc}</p>
                          {l.mudouOper && (
                            <span className="mt-1.5 inline-block">
                              <Selo tom="destaque">recebeu de outra operação</Selo>
                            </span>
                          )}
                        </div>
                        <dl className="grid grid-cols-4 gap-2 rounded-ctl bg-surface-2 px-3 py-2.5 text-center">
                          {[
                            ['Planej.', <Numero key="p" valor={l.planejado} />, 'text-muted'],
                            ['Aplic.', <Numero key="a" valor={l.aplicado} />, 'font-semibold'],
                            ['Adic.', <Numero key="d" valor={dif > 0 ? dif : 0} tom="ok" />, ''],
                            ['Dev.', <Numero key="v" valor={dif < 0 ? -dif : 0} tom="perigo" />, ''],
                          ].map(([nome, valor, cls]) => (
                            <div key={nome as string} className="min-w-0">
                              <dt className="text-xs text-muted">{nome}</dt>
                              <dd className={`text-base ${cls}`}>{valor}</dd>
                            </div>
                          ))}
                        </dl>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </Painel>

          {novas.length > 0 && (
            <Painel className="overflow-clip">
              <div className="px-4 md:px-5 py-3 border-b border-line">
                <h2 className="text-lg font-semibold">
                  Linhas novas no fim da ADS (<span className="num">{novas.length}</span>)
                </h2>
                <p className="text-sm text-muted mt-0.5 max-w-[80ch]">Itens que não estavam previstos. Entram sem ID e com a operação em branco, para a pessoa preencher.</p>
              </div>
              <ul className="divide-y divide-line">
                {novas.map((l) => (
                  <li key={l.code + l.desc + l.aplicado} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[84px_minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-0.5 px-4 md:px-5 py-3 text-sm">
                    <span className="num text-muted max-sm:col-span-2">{l.code}</span>
                    <span className="min-w-0 line-clamp-2 break-words" title={l.desc}>
                      {l.desc}
                    </span>
                    <span className="num font-semibold whitespace-nowrap text-right">
                      {formatarQtd(l.aplicado)} {l.un}
                    </span>
                  </li>
                ))}
              </ul>
            </Painel>
          )}
        </div>
      </div>
    </div>
  )
}
