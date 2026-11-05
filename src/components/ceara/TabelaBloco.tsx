import { Fragment, useId } from 'react'
import { SlidersHorizontal } from '@phosphor-icons/react'
import { Botao, Painel, Selo } from '../ui'
import { formatarQtd } from '../../lib/busca'
import type { BaseEnel, Linha } from '../../ceara/contagem'
import type { Bloco, LinhaComparada } from '../../ceara/orcamento'
import { chaveKit, kitDe, type Ajuste, type Ajustes } from '../../ceara/estratificacao'
import type { SugestaoGuardada } from '../../lib/banco'
import { AjusteEstrutura } from './AjusteEstrutura'

export type LinhaTela = LinhaComparada & Pick<Linha, 'semCodigo' | 'foraDaBase' | 'conta'>

/** O que a Adição de estrutura precisa para ajustar o material de cada estrutura. */
export interface Estratificar {
  base: BaseEnel
  /** Linhas da obra (do desenho), para o ajuste saber quantidade e postes. */
  obra: Linha[]
  ajustes: Ajustes
  aberta: string | null
  onAbrir: (chave: string | null) => void
  onMudar: (chave: string, a: Ajuste | undefined) => void
  sugestoes: Record<string, SugestaoGuardada>
  tocadas: ReadonlySet<string>
  recusadas: ReadonlySet<string>
  onUsarSugestao: (chave: string) => void
  onRecusar: (chave: string) => void
  avisoSugestao: string
}

const SITUACAO: Record<LinhaComparada['situacao'], { texto: string; tom: 'ok' | 'perigo' | 'neutro' | 'destaque' }> = {
  igual: { texto: 'igual', tom: 'ok' },
  diferente: { texto: 'diferente', tom: 'perigo' },
  'so-desenho': { texto: 'só no desenho', tom: 'destaque' },
  'so-orcamento': { texto: 'só no orçamento', tom: 'perigo' },
}

export function TabelaBloco({ titulo, linhas, comparando, bloco, estrat }: { titulo: string; linhas: LinhaTela[]; comparando: boolean; bloco: Bloco; estrat?: Estratificar }) {
  const id = useId()
  const colunas = 3 + (comparando ? 2 : 0)
  return (
    <Painel className="overflow-clip">
      <h2 className="px-4 md:px-5 py-4 text-xl font-semibold tracking-[-0.02em] border-b border-line" id={'bloco-' + bloco}>
        {titulo} <span className="num text-muted font-medium">({linhas.length})</span>
      </h2>
      {estrat && (
        <p role="status" className="px-4 md:px-5 text-sm text-text empty:py-0 py-3 border-line empty:border-0 border-b">
          {estrat.avisoSugestao}
        </p>
      )}
      {!linhas.length ? (
        <p className="px-4 md:px-5 py-4 text-sm text-muted">Nada neste bloco.</p>
      ) : (
        // @container: o ajuste aberto ocupa só a largura visível do painel, mesmo com a tabela rolando de lado
        <div className="@container overflow-x-auto" tabIndex={0} role="region" aria-labelledby={'bloco-' + bloco}>
          <table className="w-full text-sm">
            <thead className="border-b border-line-strong text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Código</th>
                <th className="px-2 py-2 font-medium text-right">Desenho</th>
                {comparando && <th className="px-2 py-2 font-medium text-right">Orçamento</th>}
                {comparando && <th className="px-2 py-2 font-medium">Situação</th>}
                <th className="px-4 py-2 font-medium">De onde veio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {linhas.map((l) => {
                const chave = chaveKit(l.codigo)
                const daObra = estrat?.obra.find((o) => o.codigo === l.codigo)
                const ajustavel = !!estrat && !!daObra && !l.foraDaBase && !!kitDe(estrat.base, chave)?.length
                const ajuste = ajustavel ? estrat.ajustes[chave] : undefined
                const aberta = ajustavel && estrat.aberta === chave
                const sugere = ajustavel && !ajuste && !!estrat.sugestoes[chave] && !estrat.tocadas.has(chave) && !estrat.recusadas.has(chave)
                const idAjuste = `${id}-${chave}`
                return (
                  <Fragment key={l.codigo}>
                    <tr>
                      <td className="px-4 py-2 align-top">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className={`num font-semibold whitespace-nowrap ${l.semCodigo || l.foraDaBase ? 'text-danger' : ''}`}>{l.codigo}</span>
                          {ajuste && <Selo tom="aviso">estratificada</Selo>}
                        </span>
                        {l.descricao && <span className="block text-xs text-muted">{l.descricao}</span>}
                        {l.conta && <span className="block text-xs text-muted num">{l.conta}</span>}
                        {l.semCodigo && <span className="block text-xs font-medium text-danger">sem código: preencher no Excel</span>}
                        {l.foraDaBase && <span className="block text-xs font-medium text-danger">não existe na base da Enel</span>}
                        {l.palpite && <span className="block text-xs font-medium text-text">regra deduzida, a confirmar</span>}
                        {ajustavel && (
                          <Botao
                            variante="secundario"
                            className="mt-2 text-sm"
                            aria-expanded={aberta}
                            aria-controls={aberta ? idAjuste : undefined}
                            onClick={() => estrat.onAbrir(aberta ? null : chave)}
                          >
                            <SlidersHorizontal size={18} /> Ajustar material
                          </Botao>
                        )}
                      </td>
                      <td className="px-2 py-2 align-top text-right num">{l.desenho === null ? '-' : formatarQtd(l.desenho)}</td>
                      {comparando && <td className="px-2 py-2 align-top text-right num">{l.orcamento === null ? '-' : formatarQtd(l.orcamento)}</td>}
                      {comparando && (
                        <td className="px-2 py-2 align-top">
                          <Selo tom={SITUACAO[l.situacao].tom}>{SITUACAO[l.situacao].texto}</Selo>
                        </td>
                      )}
                      <td className="px-4 py-2 align-top text-xs text-muted">{l.origem.slice(0, 12).join(', ')}{l.origem.length > 12 ? ` e mais ${l.origem.length - 12}` : ''}</td>
                    </tr>
                    {sugere && (
                      <tr>
                        <td colSpan={colunas} className="p-0">
                          {/* largura visível do painel, presa à esquerda quando a tabela rola de lado */}
                          <div className="sticky left-0 w-[100cqw] flex flex-wrap items-center gap-x-3 gap-y-2 px-4 md:px-5 py-3 bg-bg">
                            <p className="text-sm min-w-0">Na última obra você ajustou esta estrutura</p>
                            <span className="flex gap-2">
                              <Botao variante="secundario" className="text-sm" onClick={() => estrat.onUsarSugestao(chave)}>
                                Usar o mesmo ajuste
                              </Botao>
                              <Botao variante="fantasma" className="text-sm" aria-label={`Não usar o ajuste da última obra em ${l.codigo}`} onClick={() => estrat.onRecusar(chave)}>
                                Não
                              </Botao>
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {aberta && daObra && (
                      <tr id={idAjuste}>
                        <td colSpan={colunas} className="p-0">
                          <div className="sticky left-0 w-[100cqw] bg-bg border-y border-line-strong">
                            <AjusteEstrutura linha={daObra} base={estrat.base} ajuste={ajuste} onChange={(a) => estrat.onMudar(chave, a)} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Painel>
  )
}
