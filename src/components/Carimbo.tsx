import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CheckCircle, DownloadSimple, IdentificationCard, Info, Trash, UploadSimple, UserPlus, Warning } from '@phosphor-icons/react'
import { exportarTecnicos, lerArquivoTecnicos, listarTecnicos, removerTecnico, salvarTecnicos, type TecnicoSalvo } from '../lib/tecnicos'
import { prepararCarimbo } from '../lib/imagem'
import { Botao, Campo, Painel, Titulo, Vazio } from './ui'

interface Props {
  selecionado: number | null
  onSelecionar: (registro: number | null) => void
  tecnicos: TecnicoSalvo[]
  onTecnicos: (t: TecnicoSalvo[]) => void
}

/** URL de prévia do carimbo, liberada quando a lista muda. */
function useUrls(lista: TecnicoSalvo[]) {
  const urls = useMemo(() => new Map(lista.map((t) => [t.registro, URL.createObjectURL(new Blob([t.carimbo.png as BlobPart], { type: 'image/png' }))])), [lista])
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls])
  return urls
}

export function Carimbo({ selecionado, onSelecionar, tecnicos, onTecnicos }: Props) {
  const arquivo = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [novo, setNovo] = useState(false)
  const urls = useUrls(tecnicos)
  const hoje = new Date().toLocaleDateString('pt-BR')

  const importar = async (f?: File) => {
    if (!f) return
    setErro(null)
    try {
      const lista = await lerArquivoTecnicos(f)
      await salvarTecnicos(lista)
      onTecnicos(await listarTecnicos())
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  const baixarLista = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(exportarTecnicos(tecnicos))
    a.download = 'tecnicos-fechamento.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <div>
      <Titulo
        titulo="Carimbo"
        sub={`O técnico escolhido entra com nome, matrícula e carimbo em todas as folhas com assinatura, com a data de hoje (${hoje}).`}
        acao={
          <div className="flex flex-wrap gap-2">
            <Botao variante="primario" onClick={() => setNovo((v) => !v)} aria-expanded={novo}>
              <UserPlus size={18} weight="bold" /> Cadastrar técnico
            </Botao>
            <Botao onClick={() => arquivo.current?.click()}>
              <UploadSimple size={18} /> Carregar lista
            </Botao>
            {tecnicos.length > 0 && (
              <Botao variante="fantasma" className="border border-line-strong" onClick={baixarLista} title="Baixar a lista para usar em outro computador">
                <DownloadSimple size={18} /> Baixar lista
              </Botao>
            )}
          </div>
        }
      />
      <input ref={arquivo} type="file" accept=".json,application/json" className="hidden" onChange={(e) => importar(e.target.files?.[0]).finally(() => (e.target.value = ''))} />

      <p className="flex items-start gap-3 mb-5 max-w-[84ch] rounded-ctl bg-surface-2 px-4 py-3 text-sm">
        <Info size={20} className="shrink-0 mt-0.5 text-muted" aria-hidden="true" />
        <span>O carimbo antigo que vier no inventário é retirado. A lista de técnicos fica guardada só neste navegador e não vai para a internet.</span>
      </p>

      {erro && (
        <p role="alert" className="flex items-start gap-3 mb-5 rounded-ctl bg-danger-soft text-danger px-4 py-3 text-sm font-medium">
          <Warning size={20} weight="bold" className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{erro}</span>
        </p>
      )}
      {novo && (
        <NovoTecnico
          tecnicos={tecnicos}
          onCancelar={() => setNovo(false)}
          onSalvo={async () => {
            onTecnicos(await listarTecnicos())
            setNovo(false)
          }}
        />
      )}

      {!tecnicos.length ? (
        <Painel>
          <Vazio
            icone={<IdentificationCard size={32} />}
            titulo="Nenhum técnico neste computador"
            texto="Carregue o arquivo tecnicos-fechamento.json (fica na pasta AUTOMACAO KIT MATERIAL) ou cadastre um técnico. A lista fica guardada só neste navegador e não vai para a internet."
          />
        </Painel>
      ) : (
        <div role="radiogroup" aria-label="Técnico do carimbo" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {tecnicos.map((t) => {
            const ativo = selecionado === t.registro
            return (
              <div
                key={t.registro}
                className={`entra press relative rounded-panel border p-4 grid gap-4 content-start bg-surface ${ativo ? 'border-text ring-2 ring-accent' : 'border-line hover:border-line-strong'}`}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => onSelecionar(ativo ? null : t.registro)}
                  className="absolute inset-0 rounded-panel"
                  aria-label={`${t.nome}, matrícula ${t.registro}`}
                />
                {/* o carimbo é um PNG transparente: sempre sobre fundo branco, nos dois temas */}
                <div className="h-[140px] rounded-ctl bg-white border border-line grid place-items-center overflow-hidden">
                  <img src={urls.get(t.registro)} alt="" className="max-h-[124px] max-w-[92%] object-contain" />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold leading-snug break-words">{t.nome}</p>
                    <p className="text-[0.875rem] leading-5 text-muted mt-0.5">
                      Matrícula <span className="num">{t.registro}</span>
                    </p>
                  </div>
                  <Botao
                    variante="perigo"
                    icone
                    className="relative z-10 shrink-0 border border-line-strong"
                    aria-label={`Apagar ${t.nome} deste computador`}
                    title="Apagar deste computador"
                    onClick={async () => {
                      if (!confirm(`Apagar ${t.nome} da lista deste computador?`)) return
                      setErro(null)
                      try {
                        await removerTecnico(t.registro)
                        if (ativo) onSelecionar(null)
                        onTecnicos(await listarTecnicos())
                      } catch (e) {
                        setErro((e as Error).message)
                      }
                    }}
                  >
                    <Trash size={18} />
                  </Botao>
                </div>
                <p className={`flex items-center gap-2 text-sm min-h-6 ${ativo ? 'font-semibold' : 'text-muted'}`}>
                  {ativo ? (
                    <>
                      <CheckCircle size={20} weight="fill" className="shrink-0 text-ok" aria-hidden="true" /> Usado nas folhas
                    </>
                  ) : (
                    'Escolher este técnico'
                  )}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NovoTecnico({ tecnicos, onSalvo, onCancelar }: { tecnicos: TecnicoSalvo[]; onSalvo: () => void; onCancelar: () => void }) {
  const idImg = useId()
  const [nome, setNome] = useState('')
  const [registro, setRegistro] = useState('')
  const [img, setImg] = useState<Awaited<ReturnType<typeof prepararCarimbo>> | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)
  const ok = nome.trim() && /^\d+$/.test(registro.trim()) && img

  return (
    <Painel className="entra p-4 md:p-6 mb-5">
      <h2 className="text-lg font-semibold mb-4">Cadastrar técnico</h2>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_12rem] xl:grid-cols-[minmax(0,1fr)_12rem_minmax(0,24rem)] gap-x-4 gap-y-4 items-start">
        <Campo rotulo="Nome completo" value={nome} onChange={(e) => setNome(e.target.value.toUpperCase())} placeholder="NOME COMO NO CARIMBO" />
        <Campo rotulo="Matrícula" inputMode="numeric" value={registro} onChange={(e) => setRegistro(e.target.value.replace(/\D/g, ''))} placeholder="1234" />
        <div className="grid gap-1.5 md:col-span-2 xl:col-span-1">
          <label htmlFor={idImg} className="text-xs font-medium text-muted">
            Imagem do carimbo
          </label>
          <input
            id={idImg}
            type="file"
            accept="image/*"
            className="min-w-0 text-sm file:mr-3 file:h-12 file:md:h-11 file:rounded-ctl file:border file:border-line-strong file:bg-surface file:px-4 file:text-base file:text-text hover:file:bg-surface-2"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              try {
                setErro(null)
                setImg(await prepararCarimbo(f))
              } catch (er) {
                setErro((er as Error).message)
              }
            }}
          />
          {erro && <p className="text-xs text-danger">{erro}</p>}
        </div>
      </div>
      {img && (
        <div className="mt-4 grid gap-1.5">
          <span className="text-xs font-medium text-muted">Prévia do carimbo, com o fundo branco retirado</span>
          <div className="h-[140px] max-w-sm rounded-ctl bg-white border border-line grid place-items-center overflow-hidden">
            <img src={img.url} alt="Prévia do carimbo" className="max-h-[124px] max-w-[92%] object-contain" />
          </div>
        </div>
      )}
      {erroSalvar && (
        <p role="alert" className="flex items-start gap-3 mt-4 rounded-ctl bg-danger-soft text-danger px-4 py-3 text-sm font-medium">
          <Warning size={20} weight="bold" className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{erroSalvar}</span>
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Botao variante="fantasma" onClick={onCancelar}>
          Cancelar
        </Botao>
        <Botao
          variante="primario"
          disabled={!ok}
          onClick={async () => {
            setErroSalvar(null)
            // a matrícula é a chave: repetir uma matrícula troca o nome e o carimbo de quem já estava na lista
            const existente = tecnicos.find((t) => t.registro === Number(registro))
            if (existente && !confirm(`A matrícula ${registro} já é de ${existente.nome}. Salvar vai trocar o nome e o carimbo dessa pessoa por estes. Continuar?`)) return
            try {
              await salvarTecnicos([{ nome: nome.trim(), registro: Number(registro), carimbo: { png: img!.png, width: img!.width, height: img!.height } }])
              onSalvo()
            } catch (e) {
              setErroSalvar((e as Error).message)
            }
          }}
        >
          Salvar técnico
        </Botao>
      </div>
    </Painel>
  )
}
