import { FlagCheckered, HourglassMedium } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import type { TipoBoletim } from '../core/boletim'

const OPCOES: { tipo: TipoBoletim; nome: string; texto: string; icone: ReactNode }[] = [
  { tipo: 'parcial', nome: 'Parcial', texto: 'A Check-list sai com o X em PARCIAL, nas caixas ao lado do cabeçalho.', icone: <HourglassMedium size={24} /> },
  { tipo: 'final', nome: 'Final', texto: 'Obra concluída: as caixas Final e Parcial não aparecem na Check-list.', icone: <FlagCheckered size={24} /> },
]

/** Pergunta obrigatória, no topo da tela, até a pessoa escolher. */
export function PerguntaBoletim({ onEscolher }: { onEscolher: (t: TipoBoletim) => void }) {
  return (
    <section aria-labelledby="pergunta-boletim" className="entra mb-6 rounded-panel border-2 border-accent bg-accent-soft/40 p-4 md:p-5">
      <h2 id="pergunta-boletim" className="text-lg font-semibold">
        Este fechamento é parcial ou final?
      </h2>
      <p className="mt-1 text-sm text-muted">Obrigatório para baixar. Dá para trocar depois na barra de cima.</p>
      <div role="radiogroup" aria-labelledby="pergunta-boletim" className="mt-4 grid gap-3 sm:grid-cols-2">
        {OPCOES.map((o) => (
          <button
            key={o.tipo}
            type="button"
            role="radio"
            aria-checked={false}
            onClick={() => onEscolher(o.tipo)}
            className="press flex items-start gap-3 rounded-ctl border border-line-strong bg-surface p-4 text-left hover:border-text"
          >
            <span className="mt-0.5 text-accent-text">{o.icone}</span>
            <span>
              <span className="block text-base font-semibold">{o.nome}</span>
              <span className="block text-sm text-muted">{o.texto}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

/** Troca rápida, na barra de cima, depois de escolhido. */
export function SeletorBoletim({ valor, onEscolher, compacto = false }: { valor: TipoBoletim | null; onEscolher: (t: TipoBoletim) => void; compacto?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Boletim" className="inline-flex rounded-ctl border border-line-strong p-0.5">
      {OPCOES.map((o) => {
        const ativo = o.tipo === valor
        return (
          <button
            key={o.tipo}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onEscolher(o.tipo)}
            className={`press ${compacto ? 'h-7 px-2.5' : 'h-10 px-3'} rounded-[calc(var(--radius-ctl)-2px)] text-sm font-semibold ${ativo ? 'bg-text text-bg' : 'text-muted hover:text-text'}`}
          >
            {o.nome}
          </button>
        )
      })}
    </div>
  )
}
