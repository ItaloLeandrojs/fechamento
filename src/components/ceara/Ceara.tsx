import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { CheckCircle, ClipboardText, CompassTool, DownloadSimple, Envelope, FileXls, FileZip, Info, Trash, UploadSimple, WarningCircle } from '@phosphor-icons/react'
import { Marca } from '../Logo'
import { MenuLateral } from '../Etapas'
import { Botao, Campo, Painel, Selo, Titulo } from '../ui'
import type { ItemMenu } from '../../etapas'
import { formatarQtd } from '../../lib/busca'
import { lerDxf } from '../../ceara/dxf'
import { contarObra, type BaseEnel, type Linha, type ResultadoCeara } from '../../ceara/contagem'
import { BLOCOS, comparar, lerOrcamento, type Orcamento } from '../../ceara/orcamento'
import { AREAS, gerarExcelCeara, nomeDoExcel, otDoNome, type Area } from '../../ceara/excel'
import { ajustesValidos, aplicarSugestao, chaveKit, estruturasAjustadas, mesmaObra, somarNaAdicao, sugestoesAoBaixar, type Ajuste, type Ajustes } from '../../ceara/estratificacao'
import { gravarSugestoes, lerSugestoes, type SugestaoGuardada } from '../../lib/banco'
import type { BaseMaoDeObra, RespostasMO } from '../../ceara/maoDeObra'
import { TabelaBloco, type Estratificar, type LinhaTela } from './TabelaBloco'
import { MaoDeObra } from './MaoDeObra'
import { useMaoDeObra } from './useMaoDeObra'

type Ferramenta = 'cad' | 'sucata' | 'correcoes' | 'nomeacao' | 'aro'

const TAM = 20
const ICONES: Record<Ferramenta, ReactNode> = {
  cad: <CompassTool size={TAM} />,
  sucata: <Trash size={TAM} />,
  correcoes: <Envelope size={TAM} />,
  nomeacao: <FileZip size={TAM} />,
  aro: <ClipboardText size={TAM} />,
}

/** Ferramentas que ainda não funcionam: o que cada uma vai fazer, em passos. */
const EM_TESTE: Record<Exclude<Ferramenta, 'cad'>, { titulo: string; passos: string[] }> = {
  sucata: {
    titulo: 'Apartado de sucata',
    passos: ['Montar o e-mail do apartado de sucata da obra, com os dados já preenchidos.', 'Você confere e envia.'],
  },
  correcoes: {
    titulo: 'Correções',
    passos: ['Receber o e-mail de correções da validação.', 'Mostrar o que precisa corrigir em cada obra.', 'Responder por aqui depois de corrigir.'],
  },
  nomeacao: {
    titulo: 'Nomeação dos arquivos',
    passos: ['Você joga vários arquivos (ou uma pasta).', 'Recebe um ZIP com tudo renomeado no padrão.'],
  },
  aro: {
    titulo: 'ARO',
    passos: [
      'Preencher o Atestado de Recebimento de Obras sozinho: os dados da obra pela OT, e km de rede, postes, transformadores e medidores pelo CAD.',
      'Mostrar tudo para você conferir e trocar o que precisar.',
      'Baixar o ARO pronto, que vai em toda obra fechada como final.',
    ],
  },
}

/**
 * Fechamento Ceará: menu lateral com as ferramentas. Pronta só a Leitura do CAD: lê o DXF do
 * asbuilt, conta estruturas e materiais pelas etiquetas dos postes e pelos vãos e baixa o Excel
 * da Solicitação de acréscimos (abas de estrutura e material). Com um orçamento feito à mão,
 * mostra o que bateu. Com a lista de mão de obra, o bloco Mão de obra (MaoDeObra.tsx) conta as
 * vozes pelo mesmo desenho e o Excel ganha as abas MÃO DE OBRA ADIÇÃO e DEVOLUÇÃO; sem ela, só
 * um aviso e o resto igual. As outras (sucata, correções, nomeação e ARO) estão em teste: abrem
 * uma página curta com o que vão fazer.
 * A base da Enel (material e kits de estrutura) e a lista de mão de obra chegam prontas, baixadas depois do login.
 */
export function Ceara({ base, maoDeObra, onVoltar }: { base: BaseEnel; maoDeObra: BaseMaoDeObra | null; onVoltar: () => void }) {
  const [nomeDxf, setNomeDxf] = useState('')
  const [resultado, setResultado] = useState<ResultadoCeara | null>(null)
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null)
  const [nomeOrc, setNomeOrc] = useState('')
  const [lendo, setLendo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ot, setOt] = useState('')
  const [area, setArea] = useState<Area>('SUL')
  const [baixado, setBaixado] = useState('')
  const [ferramenta, setFerramenta] = useState<Ferramenta>('cad')
  // estratificação: ajuste do material por estrutura (chave sem _S) e a estrutura aberta
  const [ajustes, setAjustes] = useState<Ajustes>({})
  const [aberta, setAberta] = useState<string | null>(null)
  // estruturas mexidas nesta obra: decide o que apagar da sugestão ao baixar
  const [tocadas, setTocadas] = useState<Set<string>>(() => new Set())
  const [sugestoes, setSugestoes] = useState<Record<string, SugestaoGuardada>>({})
  const [recusadas, setRecusadas] = useState<Set<string>>(() => new Set())
  const [avisoSugestao, setAvisoSugestao] = useState('')
  const inDxf = useRef<HTMLInputElement>(null)
  const inOrc = useRef<HTMLInputElement>(null)
  const idArea = useId()
  const mo = useMaoDeObra(resultado, maoDeObra, area, ot)
  // mudança na mão de obra: o Excel baixado ficou velho
  const estadoMO = {
    ...mo,
    mudar: (f: (r: RespostasMO) => RespostasMO) => {
      mo.mudar(f)
      setBaixado('')
    },
  }

  // sugestões do último ajuste, guardadas só neste navegador
  useEffect(() => {
    let vivo = true
    lerSugestoes().then((s) => vivo && setSugestoes(s))
    return () => {
      vivo = false
    }
  }, [])

  const ir = (f: Ferramenta) => {
    setFerramenta(f)
    window.scrollTo(0, 0)
  }

  const abrirDxf = async (f: File | undefined) => {
    if (!f) return
    setErro(null)
    setBaixado('')
    if (!/\.dxf$/i.test(f.name)) return setErro(/\.dwg$/i.test(f.name) ? 'O site lê DXF. No ZWCAD ou AutoCAD: Salvar como > DXF, e suba o arquivo .dxf.' : 'Escolha o arquivo .dxf do desenho.')
    setLendo(true)
    try {
      // dá tempo de a tela mostrar "lendo" antes do trabalho pesado
      await new Promise((ok) => setTimeout(ok, 30))
      const r = contarObra(lerDxf(new Uint8Array(await f.arrayBuffer())), base)
      setResultado(r)
      setAvisoSugestao('')
      // mesma obra: fica o ajuste das estruturas que continuam; outra obra: começa do zero
      if (mesmaObra(nomeDxf, f.name)) {
        setAjustes((a) => ajustesValidos(a, r.adicaoEstrutura))
        // estrutura que sumiu do desenho sai das tocadas: o próximo download não apaga a sugestão dela
        const chaves = new Set(r.adicaoEstrutura.map((l) => chaveKit(l.codigo)))
        setTocadas((t) => new Set([...t].filter((c) => chaves.has(c))))
        setAberta((ch) => (ch && r.adicaoEstrutura.some((l) => chaveKit(l.codigo) === ch) ? ch : null))
      } else {
        setAjustes({})
        setTocadas(new Set())
        setRecusadas(new Set())
        setAberta(null)
      }
      setNomeDxf(f.name)
      setOt(otDoNome(f.name))
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

  const baixar = async () => {
    if (!resultado) return
    const nome = nomeDoExcel(ot)
    const data = new Date()
    const bytes = await gerarExcelCeara(resultado, { ot: ot.trim(), area, data }, { base, ajustes }, mo.linhas ?? undefined)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    a.download = nome
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    // o ajuste baixado vira a sugestão da próxima obra (só neste navegador)
    const { gravar, apagar } = sugestoesAoBaixar(ajustes, tocadas, data)
    // sem IndexedDB nada foi gravado: a memória também não muda (a sugestão não pode aparecer)
    if ((gravar.length || apagar.length) && (await gravarSugestoes(gravar, apagar))) {
      setSugestoes((s) => {
        const n = { ...s }
        for (const c of apagar) delete n[c]
        for (const g of gravar) n[g.estrutura] = g
        return n
      })
    }
    setBaixado(nome)
  }

  const tocar = (chave: string) => setTocadas((t) => new Set(t).add(chave))
  const mudarAjuste = (chave: string, a: Ajuste | undefined) => {
    setAjustes((todos) => {
      const n = { ...todos }
      if (a) n[chave] = a
      else delete n[chave]
      return n
    })
    tocar(chave)
    // o Excel baixado ficou velho
    setBaixado('')
  }
  const usarSugestao = (chave: string) => {
    const s = sugestoes[chave]
    if (!s) return
    const { ajuste, ignorados } = aplicarSugestao(s.ajuste, base, chave)
    mudarAjuste(chave, ajuste)
    setAvisoSugestao(ignorados.length ? `Não existe mais na base: ${ignorados.join(', ')}. O resto do ajuste foi usado.` : '')
  }
  const estrat = (obra: Linha[]): Estratificar => ({
    base,
    obra,
    ajustes,
    aberta,
    onAbrir: setAberta,
    onMudar: mudarAjuste,
    sugestoes,
    tocadas,
    recusadas,
    onUsarSugestao: usarSugestao,
    onRecusar: (chave) => setRecusadas((r) => new Set(r).add(chave)),
    avisoSugestao,
  })

  const cmp = resultado && orcamento ? comparar(resultado, orcamento) : null
  const total = cmp ? BLOCOS.flatMap((b) => cmp[b.id]) : []
  const iguais = total.filter((l) => l.situacao === 'igual').length
  const comEstrat = !!resultado && estruturasAjustadas(resultado.adicaoEstrutura, ajustes).length > 0
  // com ajuste, a Adição de material do Excel soma o a mais e os novos; o fora do catálogo sai em vermelho
  const adicaoFinal = resultado && comEstrat ? somarNaAdicao(resultado, base, ajustes).adicaoMaterial : resultado?.adicaoMaterial ?? []
  // a mão de obra sai em vermelho sem número ou com pergunta sem resposta (como em gerarExcelCeara)
  const vermelhasMO = (mo.linhas ?? []).filter((l) => !l.numero || l.falta).length
  const vermelhas = (resultado ? BLOCOS.flatMap((b) => (b.id === 'adicaoMaterial' ? adicaoFinal : resultado[b.id])).filter((l) => l.semCodigo || l.foraDaBase).length : 0) + vermelhasMO
  const otValida = /^\d{7}$|^\d{11}$/.test(ot.trim())

  const ferramentas: ItemMenu<Ferramenta>[] = [
    { id: 'cad', rotulo: 'Leitura do CAD', grupo: 'Pronto', estado: resultado ? 'feito' : 'vazio', marca: 'lido' },
    { id: 'sucata', rotulo: EM_TESTE.sucata.titulo, grupo: 'Em teste', estado: 'vazio' },
    { id: 'correcoes', rotulo: EM_TESTE.correcoes.titulo, grupo: 'Em teste', estado: 'vazio' },
    { id: 'nomeacao', rotulo: EM_TESTE.nomeacao.titulo, grupo: 'Em teste', estado: 'vazio' },
    { id: 'aro', rotulo: EM_TESTE.aro.titulo, grupo: 'Em teste', estado: 'vazio' },
  ]

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-20 h-[72px] border-b border-line bg-bg/95 backdrop-blur">
        <div className="h-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-10 flex items-center gap-3 sm:gap-5">
          <div className="shrink-0">
            <Marca altura={36} />
          </div>
          <Selo tom="destaque">Ceará</Selo>
          {/* OT e área aparecem depois que o desenho é lido */}
          {resultado && (
            <dl className="hidden md:flex items-center gap-8 min-w-0 border-l border-line pl-6">
              <div className="min-w-0">
                <dt className="text-xs text-muted">OT</dt>
                <dd className="num text-lg leading-tight font-semibold tracking-[-0.02em]">{ot || '-'}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted">Área</dt>
                <dd className="text-lg leading-tight font-semibold tracking-[-0.02em] whitespace-nowrap">{area}</dd>
              </div>
            </dl>
          )}
          <Botao
            variante="fantasma"
            className="ml-auto"
            onClick={() => {
              // sai do endereço #ceara-teste (atalho antigo) sem criar outra entrada no histórico
              if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search)
              onVoltar()
            }}
            aria-label="Regiões"
          >
            <span aria-hidden="true">←</span> <span className="hidden sm:inline">Regiões</span>
          </Botao>
        </div>
      </header>

      <div className="max-w-[1680px] mx-auto md:grid md:grid-cols-[260px_minmax(0,1fr)] md:gap-10 px-4 sm:px-6 lg:px-10">
        <MenuLateral itens={ferramentas} atual={ferramenta} onIr={ir} icones={ICONES} rotulo="Ferramentas do Ceará" />

        {ferramenta !== 'cad' ? (
          <main className="py-6 md:py-8 min-w-0" key={ferramenta}>
            <EmTeste {...EM_TESTE[ferramenta]} />
          </main>
        ) : (
          <main className="py-6 md:py-8 grid gap-6 content-start min-w-0 [&>*]:min-w-0">
            <Titulo
              titulo="Leitura do CAD"
              sub="Anexe o DXF do asbuilt (no ZWCAD ou AutoCAD: Salvar como > DXF). O site lê a etiqueta de cada poste e os vãos, conta estrutura e material e monta o Excel da Solicitação de acréscimos."
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Envio
                titulo={nomeDxf || 'Anexar o desenho (.dxf)'}
                texto={nomeDxf ? 'Clique para trocar o desenho' : 'Obrigatório. Asbuilt salvo em DXF.'}
                icone={<UploadSimple size={28} />}
                feito={!!nomeDxf}
                carregando={lendo}
                onClick={() => inDxf.current?.click()}
              />
              <Envio
                titulo={nomeOrc || 'Orçamento feito à mão (.xlsx)'}
                texto={nomeOrc ? 'Clique para trocar o orçamento' : 'Opcional. Para conferir a contagem com uma feita à mão.'}
                icone={<FileXls size={28} />}
                feito={!!nomeOrc}
                onClick={() => inOrc.current?.click()}
              />
              <input ref={inDxf} type="file" accept=".dxf" className="hidden" onChange={(e) => abrirDxf(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
              <input ref={inOrc} type="file" accept=".xlsx" className="hidden" onChange={(e) => abrirOrc(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
            </div>

            {erro && (
              <p role="alert" className="flex gap-2.5 rounded-panel border border-danger bg-danger-soft px-4 py-3.5 text-sm text-danger">
                <WarningCircle size={20} weight="bold" className="shrink-0 mt-0.5" /> {erro}
              </p>
            )}

            {!resultado && !lendo && !erro && (
              <Painel className="px-6 py-10 text-center">
                <p className="text-lg font-semibold tracking-[-0.02em]">Nenhum desenho ainda</p>
                <p className="mt-1 text-sm text-muted">Clique em "Anexar o desenho" para ver as contagens.</p>
              </Painel>
            )}

            {resultado && (
              <>
                <Painel className="p-4 md:p-5">
                  <h2 className="text-xl font-semibold tracking-[-0.02em]">Excel da obra</h2>
                  <p className="mt-1 text-sm text-muted">
                    {mo.linhas
                      ? comEstrat
                        ? '7 abas: adição e devolução de estrutura e de material, no modelo da Solicitação de acréscimos da Enel, MÃO DE OBRA ADIÇÃO e DEVOLUÇÃO e a ESTRATIFICAÇÃO. O material a mais e os códigos novos somam na Adição de material. Data de hoje e empresa COSAMPA.'
                        : '6 abas: adição e devolução de estrutura e de material, no modelo da Solicitação de acréscimos da Enel, e MÃO DE OBRA ADIÇÃO e DEVOLUÇÃO. Data de hoje e empresa COSAMPA.'
                      : comEstrat
                        ? '5 abas: adição e devolução de estrutura e de material, no modelo da Solicitação de acréscimos da Enel, e a ESTRATIFICAÇÃO. O material a mais e os códigos novos somam na Adição de material. Data de hoje e empresa COSAMPA.'
                        : '4 abas: adição e devolução de estrutura e de material, no modelo da Solicitação de acréscimos da Enel. Data de hoje e empresa COSAMPA.'}
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,220px)_auto] lg:grid-cols-[minmax(0,220px)_auto_minmax(0,1fr)] sm:items-start">
                    <Campo
                      rotulo="OT"
                      inputMode="numeric"
                      value={ot}
                      onChange={(e) => setOt(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      ajuda={ot && !otValida ? 'A OT tem 7 dígitos (ou 11, começando com 1722).' : 'Tirada do nome do arquivo. Confira.'}
                    />
                    <div role="group" aria-labelledby={idArea} className="grid gap-1.5">
                      <span id={idArea} className="text-xs font-medium text-muted">
                        Área
                      </span>
                      <div className="flex gap-1.5">
                        {AREAS.map((a) => (
                          <button
                            key={a}
                            type="button"
                            aria-pressed={area === a}
                            onClick={() => setArea(a)}
                            className={`press h-12 flex-1 sm:flex-none px-2 sm:px-4 rounded-ctl border text-sm font-semibold tracking-[0.02em] whitespace-nowrap ${
                              area === a ? 'bg-text text-accent-ink border-text' : 'bg-surface text-muted border-line-strong hover:text-text hover:border-text'
                            }`}
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Botao variante="primario" className="sm:mt-[22px] sm:justify-self-start" onClick={baixar} disabled={!otValida}>
                      <DownloadSimple size={20} weight="bold" /> Baixar Excel
                    </Botao>
                  </div>
                  {vermelhas > 0 && (
                    <p className="mt-3 text-sm text-text">
                      <span className="num font-semibold">{vermelhas}</span> {vermelhas === 1 ? 'linha sai' : 'linhas saem'} em vermelho no Excel ({vermelhasMO > 0 ? 'sem código, fora da base da Enel, fora do catálogo ou mão de obra sem número ou sem resposta' : 'sem código, fora da base da Enel ou fora do catálogo'}): preencha ou corrija à mão.
                    </p>
                  )}
                  {baixado && (
                    <p role="status" className="mt-3 flex items-center gap-2 text-sm text-ok">
                      <CheckCircle size={18} weight="fill" /> Baixado: {baixado}
                    </p>
                  )}
                </Painel>

                <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
                  <Numero rotulo="Postes instalados" valor={postesInstalados(resultado)} />
                  <Numero rotulo="Cabo de MT instalado (m)" valor={metros(resultado, 1, /^P\d/)} />
                  <Numero rotulo="Cabo de BT instalado (m)" valor={metros(resultado, 1, /^AM/)} />
                  {cmp ? <Numero rotulo="Linhas iguais ao orçamento" valor={`${iguais} de ${total.length}`} /> : <Numero rotulo="Itens não reconhecidos" valor={resultado.naoReconhecidos.length} />}
                </dl>

                {resultado.avisos.length > 0 && (
                  <ul className="grid gap-2">
                    {resultado.avisos.map((a, i) => (
                      <li key={i} className="flex gap-2.5 rounded-panel border border-line-strong bg-surface px-4 py-3.5 text-sm text-text">
                        <Info size={20} weight="bold" className="shrink-0 mt-0.5 text-muted" /> {a}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="grid gap-6 2xl:grid-cols-2 min-w-0 [&>*]:min-w-0">
                  {BLOCOS.map((b) => (
                    <TabelaBloco
                      key={b.id}
                      titulo={b.titulo}
                      linhas={cmp ? cmp[b.id] : resultado[b.id].map(semComparar)}
                      comparando={!!cmp}
                      bloco={b.id}
                      // com um ajuste aberto a Adição de estrutura ocupa a linha inteira (o ajuste não cabe em meia tela)
                      className={b.id === 'adicaoEstrutura' && aberta ? '2xl:col-span-2' : ''}
                      estrat={b.id === 'adicaoEstrutura' ? estrat(resultado.adicaoEstrutura) : undefined}
                    />
                  ))}
                </div>

                <MaoDeObra base={maoDeObra} area={area} estado={estadoMO} />

                {resultado.naoReconhecidos.length > 0 && (
                  <ListaPedacos
                    titulo="Itens que o site não reconheceu"
                    texto="Têm prefixo (1) ou (3), mas o site ainda não sabe o que são. Não entraram na contagem."
                    itens={resultado.naoReconhecidos}
                  />
                )}
                {resultado.ignorados.length > 0 && (
                  <ListaPedacos
                    titulo="Fora da contagem de propósito"
                    texto={
                      maoDeObra
                        ? 'A CAVA KLC não é material: só marca que teve cava na rocha no poste e entra no bloco Mão de obra.'
                        : 'A CAVA KLC só marca que teve cava no poste: entra na mão de obra, não no material.'
                    }
                    itens={resultado.ignorados}
                  />
                )}

                <Painel className="overflow-clip">
                  <h2 className="px-4 md:px-5 py-4 text-xl font-semibold tracking-[-0.02em] border-b border-line">
                    Etiquetas lidas (<span className="num">{resultado.etiquetas.length}</span>)
                  </h2>
                  <ul className="divide-y divide-line max-h-[520px] overflow-y-auto" tabIndex={0} aria-label="Etiquetas lidas">
                    {[...resultado.etiquetas]
                      .sort((a, b) => (Number(a.poste) || 999) - (Number(b.poste) || 999))
                      .map((e, i) => (
                        <li key={i} className="grid gap-1 px-4 md:px-5 py-2.5 sm:grid-cols-[72px_minmax(0,1fr)]">
                          <span className="num font-semibold">{e.poste ? 'P' + e.poste : 'sem nº'}</span>
                          <span className="text-sm break-words">{e.linhas.filter((l) => !/^\(?\d{5,}/.test(l) && l !== e.poste).join(' · ')}</span>
                        </li>
                      ))}
                  </ul>
                </Painel>
              </>
            )}
          </main>
        )}
      </div>
    </div>
  )
}

/** Página curta de uma ferramenta que ainda não funciona. */
function EmTeste({ titulo, passos }: { titulo: string; passos: string[] }) {
  return (
    <>
      <Titulo titulo={titulo} />
      <Painel className="p-5 md:p-6 max-w-[760px]">
        <Selo tom="aviso">Em teste</Selo>
        <h2 className="mt-3.5 text-xl font-semibold tracking-[-0.02em]">O que esta área vai fazer</h2>
        <ol className="mt-3 grid gap-1.5 list-decimal pl-5 text-muted">
          {passos.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
        <p className="mt-5 border-t border-line pt-3.5 text-sm text-muted">Ainda não funciona. Quando ficar pronta, sai do grupo "Em teste" e passa para "Pronto".</p>
      </Painel>
    </>
  )
}

/** Postes com prefixo (1) nas etiquetas: os novos, instalados na obra. */
function postesInstalados(r: ResultadoCeara): number {
  return r.etiquetas.flatMap((e) => e.itens).filter((i) => i.tipo === 'poste' && i.situacao === 1).reduce((s, i) => s + i.quantidade, 0)
}

function metros(r: ResultadoCeara, sit: 1 | 3, cabo: RegExp): number {
  return r.vaos.filter((v) => v.situacao === sit && cabo.test(v.cabo)).reduce((s, v) => s + v.metros, 0)
}

function semComparar(l: Linha): LinhaTela {
  return { codigo: l.codigo, descricao: l.descricao, desenho: l.quantidade, orcamento: null, situacao: 'so-desenho', origem: l.origem, palpite: !!l.palpite, semCodigo: l.semCodigo, foraDaBase: l.foraDaBase, conta: l.conta }
}

function Envio({ titulo, texto, icone, feito, carregando = false, onClick }: { titulo: string; texto: string; icone: ReactNode; feito: boolean; carregando?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={carregando}
      className={`press flex items-center gap-4 rounded-panel border p-5 text-left min-h-24 ${feito ? 'border-ok bg-surface hover:bg-surface-2' : 'border-dashed border-line-strong bg-surface hover:bg-surface-2 hover:border-accent'}`}
    >
      <span className={feito ? 'text-ok' : 'text-accent'}>{feito ? <CheckCircle size={28} weight="fill" /> : icone}</span>
      <span className="min-w-0">
        <span className="block text-lg font-semibold leading-snug tracking-[-0.02em] break-words">{carregando ? 'Lendo o desenho…' : titulo}</span>
        <span className="mt-0.5 block text-sm text-muted">{texto}</span>
      </span>
    </button>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor: number | string }) {
  return (
    <div className="flex flex-col-reverse justify-end border-t border-line-strong pt-4">
      <dt className="mt-2 text-sm text-muted">{rotulo}</dt>
      <dd className="num text-titulo font-semibold leading-none tracking-[-0.03em]">{typeof valor === 'number' ? formatarQtd(valor) : valor}</dd>
    </div>
  )
}

function ListaPedacos({ titulo, texto, itens }: { titulo: string; texto: string; itens: { poste: string; texto: string }[] }) {
  return (
    <Painel className="p-4 md:p-5">
      <h2 className="text-xl font-semibold tracking-[-0.02em]">
        {titulo} (<span className="num">{itens.length}</span>)
      </h2>
      <p className="mt-1 text-sm text-muted">{texto}</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {itens.map((n, i) => (
          <li key={i} className="rounded-md bg-surface-2 px-2 py-1 text-sm">
            <span className="text-muted">{n.poste}</span> <span className="num font-medium">{n.texto}</span>
          </li>
        ))}
      </ul>
    </Painel>
  )
}
