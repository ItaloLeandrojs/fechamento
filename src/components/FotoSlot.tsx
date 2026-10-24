import { useRef, useState } from 'react'
import { Camera, X } from '@phosphor-icons/react'
import { lerFoto, type Foto } from '../lib/imagem'

/** Quadro para soltar ou escolher uma foto. Mostra a prévia já reduzida. */
export function FotoSlot({ rotulo, foto, onChange, alto = false }: { rotulo: string; foto?: Foto; onChange: (f?: Foto) => void; alto?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [lendo, setLendo] = useState(false)
  const [arrastando, setArrastando] = useState(false)

  const receber = async (file?: File) => {
    if (!file) return
    setErro(null)
    setLendo(true)
    try {
      const f = await lerFoto(file)
      if (foto) URL.revokeObjectURL(foto.url)
      onChange(f)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLendo(false)
    }
  }

  return (
    <div className="grid gap-1.5 min-w-0">
      <span className="text-xs font-medium text-muted">{rotulo}</span>
      <div
        className={`relative rounded-ctl border overflow-hidden ${alto ? 'aspect-[3/4]' : 'aspect-[4/3]'} ${
          arrastando ? 'border-accent bg-accent-soft' : foto ? 'border-line' : 'border-dashed border-line-strong bg-surface-2'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastando(false)
          receber(e.dataTransfer.files[0])
        }}
      >
        {foto ? (
          <>
            <img src={foto.url} alt={rotulo} className="absolute inset-0 w-full h-full object-contain bg-surface-2" />
            <button
              type="button"
              aria-label={`Tirar ${rotulo.toLowerCase()}`}
              onClick={() => {
                URL.revokeObjectURL(foto.url)
                onChange(undefined)
              }}
              className="press absolute top-2 right-2 grid place-items-center size-11 rounded-full bg-surface/90 text-text border border-line hover:bg-surface"
            >
              <X size={18} weight="bold" />
            </button>
            <button type="button" onClick={() => input.current?.click()} className="press absolute inset-x-0 bottom-0 h-12 md:h-11 text-sm font-medium bg-surface/90 text-text hover:bg-surface">
              Trocar foto<span className="sr-only">: {rotulo}</span>
            </button>
          </>
        ) : (
          <button type="button" onClick={() => input.current?.click()} disabled={lendo} className="press absolute inset-0 grid place-items-center content-center gap-2 px-3 text-center text-muted hover:text-text">
            <Camera size={36} />
            <span className="text-sm">
              {lendo ? 'Preparando…' : 'Soltar ou escolher'}
              <span className="sr-only">: {rotulo}</span>
            </span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => receber(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
      {erro && (
        <p role="alert" className="text-xs text-danger">
          {erro}
        </p>
      )}
    </div>
  )
}
