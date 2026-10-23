import { useRef, useState } from 'react'
import { FileXls, UploadSimple, WarningCircle } from '@phosphor-icons/react'
import { Marca } from './Logo'

export function Inicio({ onArquivo, carregando, erro }: { onArquivo: (f: File) => void; carregando: boolean; erro: string | null }) {
  const input = useRef<HTMLInputElement>(null)
  const [arrastando, setArrastando] = useState(false)

  return (
    <div className="min-h-[100dvh] grid grid-rows-[auto_1fr]">
      <header className="h-16 px-5 md:px-8 flex items-center border-b border-line bg-surface">
        <Marca />
      </header>
      <main className="w-full max-w-5xl mx-auto px-5 md:px-8 py-10 md:py-16 grid md:grid-cols-[1.1fr_1fr] gap-10 items-start">
        <div className="entra">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">Feche a obra sem decorar código.</h1>
          <p className="mt-4 text-muted text-base leading-relaxed max-w-[52ch]">
            Suba o inventário que veio da EDP. Você lança as estruturas, materiais e mão de obra pelo nome, anexa as fotos e escolhe o técnico. O site devolve a planilha preenchida.
          </p>
          <ol className="mt-8 grid gap-3 text-sm">
            {[
              ['Inventário', 'o arquivo .xlsx da obra, do jeito que chegou'],
              ['Lançamentos', 'estruturas, materiais avulsos e mão de obra'],
              ['Fichas', 'fotos do aterramento, equipamento e DP'],
              ['Carimbo', 'técnico, matrícula e data em todas as folhas'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3 items-baseline">
                <span className="num text-xs text-muted w-4">{i + 1}</span>
                <span>
                  <span className="font-medium">{t}</span>
                  <span className="text-muted">: {d}</span>
                </span>
              </li>
            ))}
          </ol>
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
            className={`press w-full rounded-panel border-2 border-dashed px-6 py-12 grid place-items-center gap-3 text-center ${
              arrastando ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface hover:bg-surface-2'
            }`}
          >
            {carregando ? (
              <>
                <FileXls size={40} className="text-muted animate-pulse" />
                <span className="font-medium">Lendo o inventário…</span>
                <span className="text-sm text-muted">O cadastro de materiais tem uns 40 mil itens, leva alguns segundos.</span>
              </>
            ) : (
              <>
                <UploadSimple size={40} className="text-muted" />
                <span className="font-medium">Arraste o inventário aqui</span>
                <span className="text-sm text-muted">ou clique para escolher o arquivo .xlsx</span>
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
            <p role="alert" className="mt-4 flex gap-2 items-start text-sm text-danger bg-danger-soft rounded-ctl p-3">
              <WarningCircle size={18} className="shrink-0 mt-0.5" />
              {erro}
            </p>
          )}
          <p className="mt-4 text-xs text-muted leading-relaxed">
            O arquivo é lido aqui mesmo, no seu navegador. Nada é enviado para servidor. O original não é alterado: o site gera uma cópia.
          </p>
        </div>
      </main>
    </div>
  )
}
