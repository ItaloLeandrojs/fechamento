import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowsClockwise, DownloadSimple, Lightning, WarningCircle } from '@phosphor-icons/react'
import { lerInventario, type ItemCatalogo, type ResumoInventario } from './core/inventario'
import { gerarFechamento } from './core/build'
import { conferirArquivo } from './core/conferencia'
import { normalizar } from './lib/busca'
import { listarTecnicos, type TecnicoSalvo } from './lib/tecnicos'
import { estadoInicial, montarLancamentos, numero, type Estado, type Kit } from './state'
import { Inicio } from './components/Inicio'
import { Marca } from './components/Logo'
import { Estruturas, type KitIndexado } from './components/Estruturas'
import { Itens, type CatalogoIndexado, type Previsto } from './components/Itens'
import { Aterramento, DP, Equipamentos, LIMITE_PONTOS } from './components/Fichas'
import { Carimbo } from './components/Carimbo'
import { Revisao } from './components/Revisao'
import { Etapas } from './components/Etapas'
import { Botao } from './components/ui'
import { PerguntaBoletim, SeletorBoletim } from './components/Boletim'
import { montarEtapas, type Secao } from './etapas'

interface Obra {
  nomeArquivo: string
  bytes: Uint8Array
  resumo: ResumoInventario
  catalogo: CatalogoIndexado[]
  catalogoMap: Map<number, ItemCatalogo>
  previstos: Previsto[]
  codigosPrevistos: Set<number>
}

export default function App() {
  const [obra, setObra] = useState<Obra | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erroInicio, setErroInicio] = useState<string | null>(null)
  const [estado, setEstado] = useState<Estado>(estadoInicial)
  const [secao, setSecao] = useState<Secao>('estruturas')
  const [kits, setKits] = useState<KitIndexado[]>([])
  const [tecnicos, setTecnicos] = useState<TecnicoSalvo[]>([])
  const [gerando, setGerando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)
  const [erroGerar, setErroGerar] = useState<string | null>(null)
  // arquivo gerado que a conferência reprovou: só baixa se a pessoa pedir
  const [reprovado, setReprovado] = useState<{ arquivo: Uint8Array; nome: string; problemas: string[] } | null>(null)

  // kits (carregados à parte para a tela inicial abrir rápido) e técnicos guardados
  useEffect(() => {
    import('./data/kits.json').then((m) => setKits((m.default as Kit[]).map((k) => ({ ...k, norm: normalizar(`${k.kit} ${k.descricao}`) }))))
    listarTecnicos().then((t) => {
      setTecnicos(t)
      if (t.length === 1) setEstado((e) => ({ ...e, tecnico: t[0].registro }))
    })
  }, [])

  const temTrabalho = estado.estruturas.length + estado.itens.length + estado.aterramento.length + estado.equipamentos.length > 0
  useEffect(() => {
    if (!temTrabalho) return
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [temTrabalho])

  const abrir = async (f: File) => {
    setErroInicio(null)
    if (!/\.xlsx$/i.test(f.name)) return setErroInicio('Escolha o arquivo do inventário em formato .xlsx.')
    setCarregando(true)
    try {
      const bytes = new Uint8Array(await f.arrayBuffer())
      const resumo = await lerInventario(bytes)
      const previstosMap = new Map<number, Previsto>()
      const catalogoMap = new Map(resumo.catalogo.map((c) => [c.code, c]))
      for (const r of resumo.ads) {
        if (r.code === null) continue
        const cat = catalogoMap.get(r.code)
        const p = previstosMap.get(r.code) ?? { code: r.code, desc: r.descricao || cat?.desc || '', un: r.unidade || cat?.un || '', opers: [] }
        p.opers.push({ oper: r.oper || '?', planejado: r.planejado })
        previstosMap.set(r.code, p)
      }
      setObra({
        nomeArquivo: f.name,
        bytes,
        resumo,
        catalogo: resumo.catalogo.map((c) => ({ ...c, norm: normalizar(`${c.code} ${c.desc}`) })),
        catalogoMap,
        previstos: [...previstosMap.values()],
        codigosPrevistos: new Set(previstosMap.keys()),
      })
      setEstado((e) => ({ ...estadoInicial, tecnico: e.tecnico }))
      setSecao('estruturas')
      setResultado(null)
    } catch (e) {
      setErroInicio((e as Error).message || 'Não foi possível ler esse arquivo.')
    } finally {
      setCarregando(false)
    }
  }

  const kitsMap = useMemo(() => new Map(kits.map((k) => [k.kit, k])), [kits])
  const { lancamentos, avisos } = useMemo(() => montarLancamentos(estado, kitsMap), [estado, kitsMap])

  const pendencias = useMemo(() => {
    const p: string[] = []
    if (estado.boletim === null) p.push('Escolha se o fechamento é parcial ou final.')
    if (estado.tecnico === null) p.push('Escolha o técnico do carimbo.')
    if (estado.aterramento.length > LIMITE_PONTOS) p.push(`A ficha de aterramento aceita até ${LIMITE_PONTOS} pontos.`)
    estado.aterramento.forEach((pt, i) => !pt.ponto.trim() && p.push(`Aterramento: o ponto ${i + 1} está sem número.`))
    estado.equipamentos.forEach((eq, i) => !eq.ponto.trim() && p.push(`Equipamento ${i + 1} está sem o ponto.`))
    if (estado.temDP && !estado.fotoDP) p.push('Desligamento programado marcado, mas sem a foto do documento.')
    return p
  }, [estado])

  const avisosTodos = useMemo(() => {
    const a = [...avisos]
    estado.aterramento.forEach((pt) => (!pt.fotoVala || !pt.fotoMedicao) && a.push(`Ponto ${pt.ponto || '?'}: falta foto da ${!pt.fotoVala ? 'vala' : 'medição'}.`))
    if (!lancamentos.length) a.push('Nada foi lançado: todas as linhas da ADS ficarão com Aplicado 0.')
    return a
  }, [avisos, estado.aterramento, lancamentos.length])

  // o que foi lançado (ou o técnico) mudou: a conferência de um arquivo anterior não vale mais,
  // e um arquivo que ainda estava sendo gerado com os dados antigos é descartado
  const versao = useRef(0)
  useEffect(() => {
    versao.current += 1
    setReprovado(null)
  }, [estado, tecnicos])

  const baixar = (arquivo: Uint8Array, nome: string) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([arquivo as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    a.download = nome
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  const gerar = async () => {
    if (!obra) return
    setGerando(true)
    setErroGerar(null)
    setResultado(null)
    setReprovado(null)
    const versaoAoGerar = versao.current
    try {
      const tec = tecnicos.find((t) => t.registro === estado.tecnico)
      const dados: Parameters<typeof gerarFechamento>[1] = {
        lancamentos,
        tecnico: tec && { nome: tec.nome, registro: tec.registro, carimbo: { data: tec.carimbo.png, width: tec.carimbo.width, height: tec.carimbo.height, ext: 'png' } },
        aterramento: estado.aterramento.map((p) => ({
          rua: p.rua.trim(),
          ponto: p.ponto.trim(),
          tipoPoste: p.tipoPoste,
          ohms: numero(p.ohms),
          hastes: numero(p.hastes),
          fotoVala: p.fotoVala?.imagem,
          fotoMedicao: p.fotoMedicao?.imagem,
        })),
        equipamentos: estado.equipamentos.map((e) => ({
          ponto: e.ponto.trim(),
          instalado: { ...e.instalado, tensoes: Object.fromEntries(Object.entries(e.tensoes).map(([k, v]) => [k, numero(v) ?? undefined]).filter(([, v]) => v !== undefined)) },
          retirado: e.retirado,
          fotos: e.fotos.map((f) => f.imagem),
        })),
        fotoDP: estado.temDP ? estado.fotoDP?.imagem : undefined,
        boletim: estado.boletim ?? undefined,
        // a mesma data na gravação e na conferência (gerado perto da meia-noite não dá alarme falso)
        hoje: new Date(),
      }
      const res = await gerarFechamento(obra.bytes, dados)
      const nome = `${obra.resumo.nota} - ADS.xlsx`
      // abre o arquivo gerado e confere se ficou o que foi lançado, antes de baixar
      const conf = await conferirArquivo(res.arquivo, dados, res)
      if (versao.current !== versaoAoGerar) {
        setErroGerar('Algo foi alterado enquanto o arquivo era gerado. Gere de novo para baixar a versão atual.')
        return
      }
      if (conf.problemas.length) {
        setReprovado({ arquivo: res.arquivo, nome, problemas: conf.problemas })
        return
      }
      baixar(res.arquivo, nome)
      setResultado(`Baixado: ${nome}. Conferência do arquivo: ${conf.conferidos} itens, tudo certo. ${res.ads.linhasNovas.length} linha(s) nova(s); carimbo em ${res.abasComCarimbo.length} aba(s).`)
    } catch (e) {
      setErroGerar((e as Error).message || 'Falha ao gerar a planilha.')
    } finally {
      setGerando(false)
    }
  }

  if (!obra) return <Inicio onArquivo={abrir} carregando={carregando} erro={erroInicio} tecnicos={tecnicos.length} />

  const etapas = montarEtapas(estado, pendencias)
  const set = (patch: Partial<Estado>) => setEstado((e) => ({ ...e, ...patch }))

  const trocar = () => {
    if (temTrabalho && !confirm('Trocar de inventário apaga o que foi lançado nesta obra. Continuar?')) return
    setObra(null)
  }

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-20 h-[72px] border-b border-line bg-surface/95 backdrop-blur">
        <div className="h-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-10 flex items-center gap-5">
          <div className="shrink-0">
            <Marca altura={36} />
          </div>
          <dl className="hidden md:flex items-center gap-8 min-w-0 border-l border-line pl-6">
            <div className="min-w-0">
              <dt className="text-xs text-muted">Nota</dt>
              <dd className="num text-base font-semibold">{obra.resumo.nota}</dd>
            </div>
            <div className="min-w-0 hidden lg:block">
              <dt className="text-xs text-muted">Tipo de obra</dt>
              <dd className="text-base font-semibold truncate max-w-[320px]">{obra.resumo.tipoObra || '-'}</dd>
            </div>
            {estado.boletim && (
              <div className="shrink-0">
                <dt className="text-xs text-muted">Boletim</dt>
                <dd>
                  <SeletorBoletim valor={estado.boletim} onEscolher={(boletim) => set({ boletim })} compacto />
                </dd>
              </div>
            )}
            <div className="min-w-0 hidden 2xl:block">
              <dt className="text-xs text-muted">Ordens</dt>
              <dd className="num text-base font-semibold truncate max-w-[320px]">{obra.resumo.ordens.join(' / ') || '-'}</dd>
            </div>
          </dl>
          <div className="ml-auto flex items-center gap-2">
            <Botao variante="fantasma" aria-label="Trocar inventário" onClick={trocar}>
              <ArrowsClockwise size={20} /> <span className="hidden sm:inline">Trocar inventário</span>
            </Botao>
            <Botao variante="primario" onClick={() => setSecao('revisao')} className="max-sm:hidden">
              <DownloadSimple size={20} weight="bold" /> Revisar e baixar
            </Botao>
          </div>
        </div>
      </header>

      <div className="max-w-[1680px] mx-auto md:grid md:grid-cols-[260px_minmax(0,1fr)] md:gap-10 px-4 sm:px-6 lg:px-10">
        <Etapas
          etapas={etapas}
          atual={secao}
          onIr={setSecao}
          rodape={
            <p className="hidden md:block mt-8 text-xs text-muted px-3 leading-relaxed break-words">
              <Lightning size={14} className="inline -mt-0.5 mr-1" />
              {obra.nomeArquivo}
            </p>
          }
        />

        <main className="py-6 md:py-8 min-w-0" key={secao}>
          <div className="md:hidden mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <p className="text-sm text-muted">
              Nota <span className="num font-semibold text-text">{obra.resumo.nota}</span>
              {obra.resumo.tipoObra ? <> · {obra.resumo.tipoObra}</> : null}
            </p>
            {estado.boletim && <SeletorBoletim valor={estado.boletim} onEscolher={(boletim) => set({ boletim })} />}
          </div>
          {obra.resumo.avisoJaFechado && (
            <p role="note" className="mb-6 flex gap-2.5 rounded-panel border border-accent bg-accent-soft p-4 text-sm text-text">
              <WarningCircle size={22} weight="bold" className="shrink-0 text-accent-text" aria-hidden="true" />
              <span className="min-w-0 break-words">
                <span className="font-semibold">Atenção: </span>
                {obra.resumo.avisoJaFechado}
              </span>
            </p>
          )}
          {obra.resumo.diagnostico.diferencas.length > 0 && (
            <section aria-labelledby="modelo-diferente" className="mb-6 rounded-panel border border-accent bg-accent-soft p-4 text-sm text-text">
              <h2 id="modelo-diferente" className="flex gap-2.5 font-semibold">
                <WarningCircle size={22} weight="bold" className="shrink-0 text-accent-text" aria-hidden="true" />
                Este inventário é de um modelo diferente dos já testados
              </h2>
              <ul className="mt-2 ml-8 grid gap-1 list-disc pl-4">
                {obra.resumo.diagnostico.diferencas.map((d, i) => (
                  <li key={i} className="break-words">
                    {d}
                  </li>
                ))}
              </ul>
              <p className="mt-2 ml-8">Pode continuar: gere, confira no Excel antes de enviar e mande este inventário para o Italo, para ele ser testado.</p>
            </section>
          )}
          {estado.boletim === null && <PerguntaBoletim onEscolher={(boletim) => set({ boletim })} />}
          <div className="entra">
            {secao === 'estruturas' && <Estruturas kits={kits} previstos={obra.codigosPrevistos} estruturas={estado.estruturas} onChange={(fn) => setEstado((e) => ({ ...e, estruturas: fn(e.estruturas) }))} />}
            {secao === 'materiais' && <Itens tipo="material" catalogo={obra.catalogo} previstos={obra.previstos} itens={estado.itens} onChange={(fn) => setEstado((e) => ({ ...e, itens: fn(e.itens) }))} />}
            {secao === 'servicos' && <Itens tipo="servico" catalogo={obra.catalogo} previstos={obra.previstos} itens={estado.itens} onChange={(fn) => setEstado((e) => ({ ...e, itens: fn(e.itens) }))} />}
            {secao === 'aterramento' && <Aterramento pontos={estado.aterramento} onChange={(fn) => setEstado((e) => ({ ...e, aterramento: fn(e.aterramento) }))} />}
            {secao === 'equipamentos' && <Equipamentos equips={estado.equipamentos} onChange={(fn) => setEstado((e) => ({ ...e, equipamentos: fn(e.equipamentos) }))} />}
            {secao === 'dp' && <DP tem={estado.temDP} foto={estado.fotoDP} onChange={(temDP, fotoDP) => set({ temDP, fotoDP })} />}
            {secao === 'carimbo' && <Carimbo selecionado={estado.tecnico} onSelecionar={(tecnico) => set({ tecnico })} tecnicos={tecnicos} onTecnicos={setTecnicos} />}
            {secao === 'revisao' && (
              <Revisao
                ads={obra.resumo.ads}
                catalogo={obra.catalogoMap}
                lancamentos={lancamentos}
                avisos={avisosTodos}
                pendencias={pendencias}
                gerando={gerando}
                resultado={resultado}
                erro={erroGerar}
                onGerar={gerar}
                problemasArquivo={reprovado?.problemas ?? null}
                onBaixarMesmoAssim={() => {
                  if (!reprovado) return
                  baixar(reprovado.arquivo, reprovado.nome)
                  setResultado(`Baixado: ${reprovado.nome}, com ${reprovado.problemas.length} problema(s) da conferência. Confira no Excel antes de enviar.`)
                  setReprovado(null)
                }}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
