import { useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, CheckCircle, FileXls, Flask, Info, UploadSimple, WarningCircle } from '@phosphor-icons/react'
import { Marca } from '../Logo'
import { Botao, Painel, Selo, Titulo } from '../ui'
import { formatarQtd } from '../../lib/busca'
import { lerDxf } from '../../ceara/dxf'
import { contarObra, type Linha, type ResultadoCeara } from '../../ceara/contagem'
import { BLOCOS, comparar, lerOrcamento, type Bloco, type LinhaComparada, type Orcamento } from '../../ceara/orcamento'

/**
 * Fechamento Ceará (em teste): lê o DXF do asbuilt e conta estruturas e materiais pelas
 * etiquetas dos postes e pelos vãos. Com o orçamento feito à mão, mostra o que bateu.
 * Mão de obra ainda fica de fora.
 */
export function Ceara({ onVoltar }: { onVoltar: () => void }) {
  const [nomeDxf, setNomeDxf] = useState('')
  const [resultado, setResultado] = useState<ResultadoCeara | null>(null)
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null)
  const [nomeOrc, setNomeOrc] = useState('')
  const [lendo, setLendo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const inDxf = useRef<HTMLInputElement>(null)
  const inOrc = useRef<HTMLInputElement>(null)

  const abrirDxf = async (f: File | undefined) => {
    if (!f) return
    setErro(null)
    if (!/\.dxf$/i.test(f.name)) return setErro(/\.dwg$/i.test(f.name) ? 'Por enquanto o site lê DXF. No ZWCAD ou AutoCAD: Salvar como > DXF, e suba o arquivo .dxf.' : 'Escolha o arquivo .dxf do desenho.')
    setLendo(true)
    try {
      // dá tempo de a tela mostrar "lendo" antes do trabalho pesado
      await new Promise((ok) => setTimeout(ok, 30))
      const r = contarObra(lerDxf(new Uint8Array(await f.arrayBuffer())))
      setResultado(r)
      setNomeDxf(f.name)
      if (!r.etiquetas.length) setErro('Não achei nenhuma etiqueta de poste nesse desenho. Confira se é o asbuilt da obra.')
    } catch (e) {
      setErro('Não consegui ler esse DXF: ' + ((e as Error).message || 'arquivo diferente do esperado.'))
    } finally {
      setLendo(false)
    }
  }

  const abrirOrc = async (f: File | undefined) => {
    if (!f) return
    setErro(null)
    try {
      setOrcamento(await lerOrcamento(new Uint8Array(await f.arrayBuffer())))
      setNomeOrc(f.name)
    } catch {
      setErro('Não consegui ler esse orçamento. Use o "<OT> - ORÇAMENTO.xlsx" com as abas de adição e devolução.')
    }
  }

  const cmp = resultado && orcamento ? comparar(resultado, orcamento) : null
  const total = cmp ? BLOCOS.flatMap((b) => cmp[b.id]) : []
  const iguais = total.filter((l) => l.situacao === 'igual').length

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-20 h-[72px] border-b border-line bg-surface/95 backdrop-blur">
        <div className="h-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-10 flex items-center gap-4">
          <Marca altura={36} />
          <Selo tom="destaque">
            <Flask size={14} weight="bold" /> Ceará · em teste
          </Selo>
          <Botao variante="fantasma" className="ml-auto" onClick={onVoltar} aria-label="Voltar para EDP">
            <ArrowLeft size={20} /> <span className="hidden sm:inline">Voltar para EDP</span>
          </Botao>
        </div>
      </header>

      <main className="max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-10 py-6 md:py-8 grid gap-6 [&>*]:min-w-0">
        <Titulo
          titulo="Fechamento Ceará (em teste)"
          sub="Suba o DXF do asbuilt (no ZWCAD ou AutoCAD: Salvar como > DXF). O site lê a etiqueta de cada poste e os vãos e conta estruturas e materiais. Com o orçamento feito à mão, mostra o que bateu. Mão de obra ainda não entra."
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Envio
            titulo={nomeDxf || 'Desenho (.dxf)'}
            texto={nomeDxf ? 'Clique para trocar o desenho' : 'Obrigatório. Asbuilt salvo em DXF.'}
            icone={<UploadSimple size={28} />}
            feito={!!nomeDxf}
            carregando={lendo}
            onClick={() => inDxf.current?.click()}
          />
          <Envio
            titulo={nomeOrc || 'Orçamento feito à mão (.xlsx)'}
            texto={nomeOrc ? 'Clique para trocar o orçamento' : 'Opcional. Para comparar com a contagem.'}
            icone={<FileXls size={28} />}
            feito={!!nomeOrc}
            onClick={() => inOrc.current?.click()}
          />
          <input ref={inDxf} type="file" accept=".dxf" className="hidden" onChange={(e) => abrirDxf(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
          <input ref={inOrc} type="file" accept=".xlsx" className="hidden" onChange={(e) => abrirOrc(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
        </div>

        {erro && (
          <p role="alert" className="flex gap-2.5 rounded-ctl bg-danger-soft p-3 text-sm text-danger">
            <WarningCircle size={20} weight="bold" className="shrink-0 mt-0.5" /> {erro}
          </p>
        )}

        {resultado && (
          <>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Numero rotulo="Etiquetas de poste lidas" valor={resultado.etiquetas.length} />
              <Numero rotulo="Vãos novos de MT (m)" valor={metros(resultado, 1, /^P\d/)} />
              <Numero rotulo="Vãos novos de BT (m)" valor={metros(resultado, 1, /^AM/)} />
              {cmp ? <Numero rotulo="Linhas iguais ao orçamento" valor={`${iguais} de ${total.length}`} /> : <Numero rotulo="Itens não reconhecidos" valor={resultado.naoReconhecidos.length} />}
            </dl>

            {resultado.avisos.length > 0 && (
              <ul className="grid gap-2">
                {resultado.avisos.map((a, i) => (
                  <li key={i} className="flex gap-2.5 rounded-ctl bg-accent-soft p-3 text-sm text-text">
                    <Info size={20} weight="bold" className="shrink-0 mt-0.5 text-accent-text" /> {a}
                  </li>
                ))}
              </ul>
            )}

            <div className="grid gap-6 xl:grid-cols-2 min-w-0 [&>*]:min-w-0">
              {BLOCOS.map((b) => (
                <TabelaBloco key={b.id} titulo={b.titulo} linhas={cmp ? cmp[b.id] : resultado[b.id].map(semComparar)} comparando={!!cmp} bloco={b.id} />
              ))}
            </div>

            {resultado.naoReconhecidos.length > 0 && (
              <Painel className="p-4 md:p-5">
                <h2 className="text-lg font-semibold">Itens que o site não reconheceu ({resultado.naoReconhecidos.length})</h2>
                <p className="text-sm text-muted">Têm prefixo (1) ou (3), mas o site ainda não sabe o que são. Não entraram na contagem.</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {resultado.naoReconhecidos.map((n, i) => (
                    <li key={i} className="rounded-md bg-surface-2 px-2 py-1 text-sm">
                      <span className="text-muted">{n.poste}</span> <span className="num font-medium">{n.texto}</span>
                    </li>
                  ))}
                </ul>
              </Painel>
            )}

            <Painel className="overflow-clip">
              <h2 className="px-4 md:px-5 py-3 text-lg font-semibold border-b border-line">Etiquetas lidas ({resultado.etiquetas.length})</h2>
              <ul className="divide-y divide-line max-h-[520px] overflow-y-auto" tabIndex={0} aria-label="Etiquetas lidas">
                {[...resultado.etiquetas]
                  .sort((a, b) => (Number(a.poste) || 999) - (Number(b.poste) || 999))
                  .map((e, i) => (
                    <li key={i} className="grid gap-1 px-4 md:px-5 py-2.5 sm:grid-cols-[72px_minmax(0,1fr)]">
                      <span className="num font-semibold">{e.poste ? 'P' + e.poste : 'sem nº'}</span>
                      <span className="text-sm break-words">{e.linhas.filter((l) => !/^\(?\d{5,}/.test(l)).join(' · ')}</span>
                    </li>
                  ))}
              </ul>
            </Painel>
          </>
        )}
      </main>
    </div>
  )
}

function metros(r: ResultadoCeara, sit: 1 | 3, cabo: RegExp): number {
  return r.vaos.filter((v) => v.situacao === sit && cabo.test(v.cabo)).reduce((s, v) => s + v.metros, 0)
}

function semComparar(l: Linha): LinhaComparada {
  return { codigo: l.codigo, descricao: l.descricao, desenho: l.quantidade, orcamento: null, situacao: 'so-desenho', origem: l.origem, palpite: !!l.palpite }
}

function Envio({ titulo, texto, icone, feito, carregando = false, onClick }: { titulo: string; texto: string; icone: ReactNode; feito: boolean; carregando?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={carregando}
      className={`press flex items-center gap-4 rounded-panel border-2 border-dashed p-5 text-left min-h-24 ${feito ? 'border-ok bg-ok-soft/40' : 'border-line-strong bg-surface hover:bg-surface-2'}`}
    >
      <span className={feito ? 'text-ok' : 'text-muted'}>{feito ? <CheckCircle size={28} weight="fill" /> : icone}</span>
      <span className="min-w-0">
        <span className="block font-semibold break-words">{carregando ? 'Lendo o desenho…' : titulo}</span>
        <span className="block text-sm text-muted">{texto}</span>
      </span>
    </button>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor: number | string }) {
  return (
    <div className="flex flex-col-reverse justify-end rounded-panel border border-line bg-surface p-4">
      <dt className="mt-1.5 text-sm text-muted">{rotulo}</dt>
      <dd className="num text-titulo font-semibold leading-none">{typeof valor === 'number' ? formatarQtd(valor) : valor}</dd>
    </div>
  )
}

const SITUACAO: Record<LinhaComparada['situacao'], { texto: string; tom: 'ok' | 'perigo' | 'neutro' | 'destaque' }> = {
  igual: { texto: 'igual', tom: 'ok' },
  diferente: { texto: 'diferente', tom: 'perigo' },
  'so-desenho': { texto: 'só no desenho', tom: 'destaque' },
  'so-orcamento': { texto: 'só no orçamento', tom: 'perigo' },
}

function TabelaBloco({ titulo, linhas, comparando, bloco }: { titulo: string; linhas: LinhaComparada[]; comparando: boolean; bloco: Bloco }) {
  return (
    <Painel className="overflow-clip">
      <h2 className="px-4 md:px-5 py-3 text-lg font-semibold border-b border-line" id={'bloco-' + bloco}>
        {titulo} <span className="num text-muted font-medium">({linhas.length})</span>
      </h2>
      {!linhas.length ? (
        <p className="px-4 md:px-5 py-4 text-sm text-muted">Nada neste bloco.</p>
      ) : (
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-labelledby={'bloco-' + bloco}>
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Código</th>
                <th className="px-2 py-2 font-medium text-right">Desenho</th>
                {comparando && <th className="px-2 py-2 font-medium text-right">Orçamento</th>}
                {comparando && <th className="px-2 py-2 font-medium">Situação</th>}
                <th className="px-4 py-2 font-medium">De onde veio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {linhas.map((l) => (
                <tr key={l.codigo}>
                  <td className="px-4 py-2 align-top">
                    <span className="num font-semibold whitespace-nowrap">{l.codigo}</span>
                    {l.descricao && <span className="block text-xs text-muted">{l.descricao}</span>}
                    {l.palpite && <span className="block text-xs font-medium text-accent-text">regra deduzida, a confirmar</span>}
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Painel>
  )
}
