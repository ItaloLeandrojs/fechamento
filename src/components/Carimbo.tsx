import { useEffect, useMemo, useRef, useState } from 'react'
import { DownloadSimple, IdentificationCard, Trash, UploadSimple, UserPlus } from '@phosphor-icons/react'
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
        sub={`O técnico escolhido entra com nome, matrícula e carimbo em todas as folhas com assinatura. O carimbo antigo que vier no inventário é retirado. Data: ${hoje}.`}
        acao={
          <div className="flex flex-wrap gap-2">
            <Botao onClick={() => setNovo((v) => !v)}>
              <UserPlus size={16} /> Cadastrar técnico
            </Botao>
            <Botao onClick={() => arquivo.current?.click()}>
              <UploadSimple size={16} /> Carregar lista
            </Botao>
            {tecnicos.length > 0 && (
              <Botao variante="fantasma" onClick={baixarLista} title="Baixar a lista para usar em outro computador">
                <DownloadSimple size={16} /> Baixar lista
              </Botao>
            )}
          </div>
        }
      />
      <input ref={arquivo} type="file" accept=".json,application/json" className="hidden" onChange={(e) => importar(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
      {erro && (
        <p role="alert" className="mb-4 text-sm bg-danger-soft text-danger rounded-ctl p-3">
          {erro}
        </p>
      )}
      {novo && <NovoTecnico onSalvo={async () => { onTecnicos(await listarTecnicos()); setNovo(false) }} />}

      {!tecnicos.length ? (
        <Painel>
          <Vazio
            icone={<IdentificationCard size={28} />}
            titulo="Nenhum técnico neste computador"
            texto="Carregue o arquivo tecnicos-fechamento.json (fica na pasta AUTOMACAO KIT MATERIAL). Ele fica guardado só neste navegador e não vai para a internet."
          />
        </Painel>
      ) : (
        <div role="radiogroup" aria-label="Técnico do carimbo" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {tecnicos.map((t) => {
            const ativo = selecionado === t.registro
            return (
              <div
                key={t.registro}
                className={`press relative rounded-panel border p-3 text-left grid gap-3 ${ativo ? 'border-text bg-surface ring-2 ring-accent' : 'border-line bg-surface hover:border-line-strong'}`}
              >
                <button type="button" role="radio" aria-checked={ativo} onClick={() => onSelecionar(ativo ? null : t.registro)} className="absolute inset-0 rounded-panel" aria-label={`${t.nome}, matrícula ${t.registro}`} />
                <div className="h-24 rounded-ctl bg-white grid place-items-center overflow-hidden">
                  <img src={urls.get(t.registro)} alt="" className="max-h-20 max-w-[90%] object-contain" />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">{t.nome}</p>
                    <p className="text-xs text-muted">
                      Matrícula <span className="num">{t.registro}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="press relative z-10 grid place-items-center w-8 h-8 rounded-ctl text-muted hover:text-danger hover:bg-danger-soft"
                    aria-label={`Apagar ${t.nome} deste computador`}
                    onClick={async () => {
                      if (!confirm(`Apagar ${t.nome} da lista deste computador?`)) return
                      await removerTecnico(t.registro)
                      if (ativo) onSelecionar(null)
                      onTecnicos(await listarTecnicos())
                    }}
                  >
                    <Trash size={16} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NovoTecnico({ onSalvo }: { onSalvo: () => void }) {
  const [nome, setNome] = useState('')
  const [registro, setRegistro] = useState('')
  const [img, setImg] = useState<Awaited<ReturnType<typeof prepararCarimbo>> | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const ok = nome.trim() && /^\d+$/.test(registro.trim()) && img

  return (
    <Painel className="entra p-4 md:p-5 mb-5">
      <h2 className="font-semibold mb-3">Cadastrar técnico</h2>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_1fr] gap-3 items-start">
        <Campo rotulo="Nome completo" value={nome} onChange={(e) => setNome(e.target.value.toUpperCase())} placeholder="NOME COMO NO CARIMBO" />
        <Campo rotulo="Matrícula" inputMode="numeric" value={registro} onChange={(e) => setRegistro(e.target.value.replace(/\D/g, ''))} placeholder="4876" />
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-muted">Imagem do carimbo</span>
          <input
            type="file"
            accept="image/*"
            className="text-sm file:mr-3 file:h-10 file:rounded-ctl file:border file:border-line-strong file:bg-surface file:px-3 file:text-text"
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
          {img && <img src={img.url} alt="Prévia do carimbo" className="h-16 object-contain bg-white rounded-ctl p-1" />}
          {erro && <p className="text-xs text-danger">{erro}</p>}
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Botao
          variante="primario"
          disabled={!ok}
          onClick={async () => {
            await salvarTecnicos([{ nome: nome.trim(), registro: Number(registro), carimbo: { png: img!.png, width: img!.width, height: img!.height } }])
            onSalvo()
          }}
        >
          Salvar técnico
        </Botao>
      </div>
    </Painel>
  )
}
