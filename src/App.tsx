import { useEffect, useMemo, useState } from 'react'
import { ArrowsClockwise, DownloadSimple, FileText, IdentificationCard, Lightning, Package, Shovel, Stack, Wrench } from '@phosphor-icons/react'
import { lerInventario, type ItemCatalogo, type ResumoInventario } from './core/inventario'
import { gerarFechamento } from './core/build'
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
import { Botao } from './components/ui'
import { IconeTransformador } from './components/IconeTransformador'

type Secao = 'estruturas' | 'materiais' | 'servicos' | 'aterramento' | 'equipamentos' | 'dp' | 'carimbo' | 'revisao'

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

  const gerar = async () => {
    if (!obra) return
    setGerando(true)
    setErroGerar(null)
    setResultado(null)
    try {
      const tec = tecnicos.find((t) => t.registro === estado.tecnico)
      const res = await gerarFechamento(obra.bytes, {
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
      })
      const nome = `${obra.resumo.nota} - ADS.xlsx`
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([res.arquivo as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      a.download = nome
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
      setResultado(`Baixado: ${nome}. ${res.ads.linhasNovas.length} linha(s) nova(s); carimbo em ${res.abasComCarimbo.length} aba(s).`)
    } catch (e) {
      setErroGerar((e as Error).message || 'Falha ao gerar a planilha.')
    } finally {
      setGerando(false)
    }
  }

  if (!obra) return <Inicio onArquivo={abrir} carregando={carregando} erro={erroInicio} />

  const nEstr = estado.estruturas.reduce((s, e) => s + e.qtd, 0)
  const nMat = estado.itens.filter((i) => i.tipo === 'material').length
  const nSrv = estado.itens.filter((i) => i.tipo === 'servico').length
  const menu: { id: Secao; rotulo: string; icone: React.ReactNode; n?: number; grupo: string }[] = [
    { id: 'estruturas', rotulo: 'Estruturas', icone: <Stack size={18} />, n: nEstr, grupo: 'Lançamentos' },
    { id: 'materiais', rotulo: 'Materiais', icone: <Package size={18} />, n: nMat, grupo: 'Lançamentos' },
    { id: 'servicos', rotulo: 'Mão de obra', icone: <Wrench size={18} />, n: nSrv, grupo: 'Lançamentos' },
    { id: 'aterramento', rotulo: 'Aterramento', icone: <Shovel size={18} />, n: estado.aterramento.length, grupo: 'Fichas' },
    { id: 'equipamentos', rotulo: 'Equipamento', icone: <IconeTransformador size={18} />, n: estado.equipamentos.length, grupo: 'Fichas' },
    { id: 'dp', rotulo: 'Desligamento', icone: <FileText size={18} />, n: estado.temDP ? 1 : 0, grupo: 'Fichas' },
    { id: 'carimbo', rotulo: 'Carimbo', icone: <IdentificationCard size={18} />, grupo: 'Fechar' },
    { id: 'revisao', rotulo: 'Revisar e baixar', icone: <DownloadSimple size={18} />, grupo: 'Fechar' },
  ]
  const tecnicoAtual = tecnicos.find((t) => t.registro === estado.tecnico)
  const set = (patch: Partial<Estado>) => setEstado((e) => ({ ...e, ...patch }))

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-20 h-16 border-b border-line bg-surface/95 backdrop-blur">
        <div className="h-full max-w-[1500px] mx-auto px-4 md:px-6 flex items-center gap-4">
          <Marca altura={28} />
          <div className="hidden md:flex items-center gap-5 text-sm min-w-0 border-l border-line pl-4">
            <div className="min-w-0">
              <p className="text-xs text-muted">Nota</p>
              <p className="num font-medium">{obra.resumo.nota}</p>
            </div>
            <div className="min-w-0 hidden lg:block">
              <p className="text-xs text-muted">Tipo de obra</p>
              <p className="font-medium truncate max-w-[220px]">{obra.resumo.tipoObra || '-'}</p>
            </div>
            <div className="min-w-0 hidden xl:block">
              <p className="text-xs text-muted">Ordens</p>
              <p className="num font-medium">{obra.resumo.ordens.join(' / ') || '-'}</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Botao
              variante="fantasma"
              aria-label="Trocar inventário"
              onClick={() => {
                if (temTrabalho && !confirm('Trocar de inventário apaga o que foi lançado nesta obra. Continuar?')) return
                setObra(null)
              }}
            >
              <ArrowsClockwise size={16} /> <span className="hidden sm:inline">Trocar inventário</span>
            </Botao>
            <Botao variante="primario" onClick={() => setSecao('revisao')} className="hidden sm:inline-flex">
              <DownloadSimple size={16} weight="bold" /> Revisar e baixar
            </Botao>
          </div>
        </div>
      </header>

      <div className="max-w-[1500px] mx-auto md:grid md:grid-cols-[220px_minmax(0,1fr)] gap-6 px-4 md:px-6">
        <nav aria-label="Etapas" className="md:sticky md:top-16 md:self-start md:py-6 -mx-4 md:mx-0 px-4 md:px-0 border-b md:border-0 border-line bg-bg">
          <ul className="flex md:grid gap-1 overflow-x-auto py-2 md:py-0">
            {menu.map((m, i) => (
              <li key={m.id} className="shrink-0">
                {(i === 0 || menu[i - 1].grupo !== m.grupo) && <p className="hidden md:block text-[11px] font-medium text-muted px-2.5 mt-4 first:mt-0 mb-1">{m.grupo}</p>}
                <button
                  type="button"
                  onClick={() => setSecao(m.id)}
                  aria-current={secao === m.id ? 'page' : undefined}
                  className={`press w-full flex items-center gap-2.5 h-10 px-2.5 rounded-ctl text-sm ${secao === m.id ? 'bg-surface text-text font-medium shadow-panel border border-line' : 'text-muted hover:text-text hover:bg-surface-2 border border-transparent'}`}
                >
                  <span className={secao === m.id ? 'text-accent-text' : ''}>{m.icone}</span>
                  {m.rotulo}
                  {m.n ? <span className="ml-auto num text-xs bg-surface-2 rounded-md px-1.5 py-0.5">{m.n}</span> : null}
                  {m.id === 'carimbo' && <span className={`ml-auto text-xs ${tecnicoAtual ? 'text-ok' : 'text-danger'}`}>{tecnicoAtual ? 'ok' : 'falta'}</span>}
                </button>
              </li>
            ))}
          </ul>
          <p className="hidden md:block mt-6 text-xs text-muted px-2.5 leading-relaxed break-words">
            <Lightning size={14} className="inline -mt-0.5 mr-1" />
            {obra.nomeArquivo}
          </p>
        </nav>

        <main className="py-6 min-w-0" key={secao}>
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
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
