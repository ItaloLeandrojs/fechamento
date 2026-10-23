import { useMemo, useState } from 'react'
import { CheckCircle, DownloadSimple, WarningCircle } from '@phosphor-icons/react'
import { decidirDestinos, groupOf, type AdsRow, type Lancamento } from '../core/ads'
import type { ItemCatalogo } from '../core/inventario'
import { formatarQtd } from '../lib/busca'
import { Botao, Painel, Selo, Titulo } from './ui'

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
}

export function Revisao({ ads, catalogo, lancamentos, avisos, pendencias, gerando, resultado, erro, onGerar }: Props) {
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

  return (
    <div>
      <Titulo titulo="Revisar e baixar" sub="Confira como a ADS vai ficar. Todo item que não foi lançado fica com Aplicado 0 e o planejado vai para Devolvido." />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
        <div className="grid gap-5 min-w-0">
          <Painel className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-5 py-3 border-b border-line">
              <h2 className="font-semibold">Linhas previstas da ADS</h2>
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={soMudancas} onChange={(e) => setSoMudancas(e.target.checked)} className="accent-[var(--accent)] w-4 h-4" />
                Só as que ficam diferentes do planejado
              </label>
            </div>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela das linhas previstas da ADS">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted text-left">
                  <tr className="border-b border-line">
                    <th className="px-4 py-2 font-medium">Op.</th>
                    <th className="px-2 py-2 font-medium">Código</th>
                    <th className="px-2 py-2 font-medium">Descrição</th>
                    <th className="px-2 py-2 font-medium text-right">Plan.</th>
                    <th className="px-2 py-2 font-medium text-right">Aplic.</th>
                    <th className="px-2 py-2 font-medium text-right">Adic.</th>
                    <th className="px-4 py-2 font-medium text-right">Dev.</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((l) => {
                    const dif = +(l.aplicado - l.planejado).toFixed(6)
                    return (
                      <tr key={l.row} className="border-b border-line last:border-0">
                        <td className="px-4 py-2 num">{l.oper}</td>
                        <td className="px-2 py-2 num text-muted">{l.code}</td>
                        <td className="px-2 py-2 max-w-[240px] xl:max-w-[360px]">
                          <span className="block truncate">{l.desc}</span>
                          {l.mudouOper && <Selo tom="destaque">recebeu de outra operação</Selo>}
                        </td>
                        <td className="px-2 py-2 num text-right text-muted">{formatarQtd(l.planejado)}</td>
                        <td className="px-2 py-2 num text-right font-medium">{formatarQtd(l.aplicado)}</td>
                        <td className="px-2 py-2 num text-right text-ok">{dif > 0 ? formatarQtd(dif) : ''}</td>
                        <td className="px-4 py-2 num text-right text-danger">{dif < 0 ? formatarQtd(-dif) : ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {!visiveis.length && <p className="px-5 py-8 text-sm text-muted text-center">Nenhuma linha diferente do planejado.</p>}
            </div>
          </Painel>

          {novas.length > 0 && (
            <Painel className="overflow-hidden">
              <div className="px-4 md:px-5 py-3 border-b border-line">
                <h2 className="font-semibold">Linhas novas no fim da ADS ({novas.length})</h2>
                <p className="text-xs text-muted mt-0.5">Itens que não estavam previstos. Entram sem ID e com a operação em branco, para a pessoa preencher.</p>
              </div>
              <ul className="divide-y divide-line">
                {novas.map((l) => (
                  <li key={l.code + l.desc + l.aplicado} className="flex items-center gap-3 px-4 md:px-5 py-2 text-sm">
                    <span className="num text-muted w-20 shrink-0">{l.code}</span>
                    <span className="flex-1 truncate">{l.desc}</span>
                    <span className="num font-medium">
                      {formatarQtd(l.aplicado)} {l.un}
                    </span>
                  </li>
                ))}
              </ul>
            </Painel>
          )}
        </div>

        <Painel className="p-4 md:p-5 lg:sticky lg:top-20 grid gap-4">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted">Linhas com aplicado</dt>
              <dd className="num text-xl font-semibold">{totalAplicado}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Linhas novas</dt>
              <dd className="num text-xl font-semibold">{novas.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Foram para outra operação</dt>
              <dd className="num text-xl font-semibold">{mudouOper}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Ficam com zero</dt>
              <dd className="num text-xl font-semibold">{linhas.length - totalAplicado}</dd>
            </div>
          </dl>

          {[...pendencias, ...avisos].length > 0 && (
            <ul className="grid gap-2">
              {pendencias.map((p) => (
                <li key={p} className="flex gap-2 text-sm text-danger bg-danger-soft rounded-ctl p-2.5">
                  <WarningCircle size={18} className="shrink-0 mt-0.5" /> {p}
                </li>
              ))}
              {avisos.map((p) => (
                <li key={p} className="flex gap-2 text-sm text-accent-text bg-accent-soft rounded-ctl p-2.5">
                  <WarningCircle size={18} className="shrink-0 mt-0.5" /> {p}
                </li>
              ))}
            </ul>
          )}

          <Botao variante="primario" className="h-12 text-base" onClick={onGerar} disabled={gerando || pendencias.length > 0}>
            <DownloadSimple size={18} weight="bold" /> {gerando ? 'Gerando…' : 'Gerar e baixar a planilha'}
          </Botao>
          {resultado && (
            <p role="status" className="flex gap-2 text-sm text-ok bg-ok-soft rounded-ctl p-2.5">
              <CheckCircle size={18} className="shrink-0 mt-0.5" /> {resultado}
            </p>
          )}
          {erro && (
            <p role="alert" className="flex gap-2 text-sm text-danger bg-danger-soft rounded-ctl p-2.5">
              <WarningCircle size={18} className="shrink-0 mt-0.5" /> {erro}
            </p>
          )}
          <p className="text-xs text-muted">Abra o arquivo no Excel e confira antes de enviar. O Excel recalcula os valores ao abrir e pode perguntar se quer salvar.</p>
        </Painel>
      </div>
    </div>
  )
}
