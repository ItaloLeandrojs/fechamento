import { useRef, useState } from 'react'
import { FileXls, LockKey, UploadSimple, UsersThree, WarningCircle } from '@phosphor-icons/react'
import { Marca } from './Logo'

export function Inicio({ onArquivo, carregando, erro, tecnicos = 0 }: { onArquivo: (f: File) => void; carregando: boolean; erro: string | null; tecnicos?: number }) {
  const input = useRef<HTMLInputElement>(null)
  const [arrastando, setArrastando] = useState(false)

  return (
    <div className="min-h-[100dvh] grid grid-rows-[auto_1fr]">
      <header className="h-[72px] border-b border-line bg-surface">
        <div className="h-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-10 flex items-center">
          <Marca altura={36} />
        </div>
      </header>
      <main className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-10 py-8 md:py-12 grid content-center gap-8">
        <div className="entra">
          <h1 className="text-[1.75rem] md:text-[2rem] leading-tight font-semibold tracking-tight">Fechamento de obra</h1>
          <p className="mt-2 text-base text-muted max-w-[70ch]">Escolha o inventário da obra. Você lança o que foi feito e o site devolve a ADS preenchida, com as fichas e o carimbo.</p>
        </div>

        <div className="entra" style={{ animationDelay: '60ms' }}>
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setArrastando(true)
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault()
              setArrastando(false)
              const f = e.dataTransfer.files[0]
              if (f) onArquivo(f)
            }}
            disabled={carregando}
            className={`press w-full min-h-[280px] md:min-h-[320px] rounded-panel border-2 border-dashed px-6 py-12 grid place-content-center justify-items-center gap-3 text-center ${
              arrastando ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface hover:bg-surface-2'
            }`}
          >
            {carregando ? (
              <>
                <FileXls size={56} className="text-muted animate-pulse" />
                <span className="text-xl font-semibold">Lendo o inventário…</span>
                <span className="text-base text-muted">O cadastro de materiais tem uns 40 mil itens, leva alguns segundos.</span>
              </>
            ) : (
              <>
                <UploadSimple size={56} className="text-muted" />
                <span className="text-xl font-semibold">Arraste o inventário aqui</span>
                <span className="text-base text-muted">ou clique para escolher o arquivo .xlsx</span>
              </>
            )}
          </button>
          <input
            ref={input}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onArquivo(f)
              e.target.value = ''
            }}
          />
          {erro && (
            <p role="alert" className="mt-4 flex gap-2.5 items-start text-base text-danger bg-danger-soft rounded-ctl p-4">
              <WarningCircle size={22} className="shrink-0 mt-0.5" />
              {erro}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-base text-muted">
            <p className="flex items-start gap-2.5 max-w-[70ch]">
              <LockKey size={22} className="shrink-0 mt-0.5" />
              <span>Nada sai do seu computador: o arquivo é lido aqui mesmo, no navegador, e o original não é alterado.</span>
            </p>
            {tecnicos > 0 && (
              <p className="flex items-center gap-2.5">
                <UsersThree size={22} className="shrink-0" />
                <span>
                  <span className="num font-semibold text-text">{tecnicos}</span> {tecnicos === 1 ? 'técnico' : 'técnicos'} neste computador
                </span>
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
