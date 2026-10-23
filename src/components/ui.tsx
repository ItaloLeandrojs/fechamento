import { useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { Minus, Plus } from '@phosphor-icons/react'
import { OPERACOES } from '../state'

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo'

const estilos: Record<Variante, string> = {
  primario: 'bg-accent text-accent-ink hover:bg-accent-hover font-semibold',
  secundario: 'bg-surface text-text border border-line-strong hover:bg-surface-2',
  fantasma: 'text-muted hover:text-text hover:bg-surface-2',
  perigo: 'text-danger hover:bg-danger-soft',
}

export function Botao({ variante = 'secundario', className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      type="button"
      className={`press inline-flex items-center justify-center gap-2 rounded-ctl px-3.5 h-10 text-sm whitespace-nowrap disabled:opacity-45 disabled:pointer-events-none ${estilos[variante]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Campo({ rotulo, ajuda, className = '', ...rest }: InputHTMLAttributes<HTMLInputElement> & { rotulo: string; ajuda?: string }) {
  const id = useId()
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {rotulo}
      </label>
      <input
        id={id}
        className="h-10 w-full min-w-0 rounded-ctl border border-line-strong bg-surface px-3 text-sm text-text placeholder:text-muted/80 focus:border-text focus:outline-none"
        {...rest}
      />
      {ajuda && <p className="text-xs text-muted">{ajuda}</p>}
    </div>
  )
}

export function Painel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-panel border border-line bg-surface ${className}`}>{children}</section>
}

export function Titulo({ titulo, sub, acao }: { titulo: string; sub?: string; acao?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {sub && <p className="mt-1 text-sm text-muted max-w-[70ch]">{sub}</p>}
      </div>
      {acao}
    </header>
  )
}

export function Vazio({ icone, titulo, texto }: { icone: ReactNode; titulo: string; texto: string }) {
  return (
    <div className="grid place-items-center text-center gap-2 py-12 px-6">
      <div className="text-muted">{icone}</div>
      <p className="font-medium">{titulo}</p>
      <p className="text-sm text-muted max-w-[48ch]">{texto}</p>
    </div>
  )
}

/** Escolha da operação (2000, 2020, 2010, 2030, 2040). */
export function EscolhaOper({ valor, onChange, compacto = false }: { valor: string; onChange: (o: string) => void; compacto?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Operação" className="flex flex-wrap gap-1.5">
      {OPERACOES.map((o) => {
        const ativo = o.oper === valor
        return (
          <button
            key={o.oper}
            type="button"
            role="radio"
            aria-checked={ativo}
            aria-label={`${o.oper} ${o.nome}`}
            onClick={() => onChange(o.oper)}
            className={`press rounded-ctl border px-2.5 ${compacto ? 'h-8 text-xs' : 'h-10 text-sm'} text-left ${
              ativo ? 'border-text bg-text text-bg' : 'border-line-strong bg-surface text-text hover:bg-surface-2'
            }`}
          >
            <span className="num font-semibold">{o.oper}</span>
            <span className={`ml-1.5 ${ativo ? 'opacity-85' : 'text-muted'}`}>{o.nome}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Quantidade({ valor, onChange, rotulo = 'Quantidade', passo = 1 }: { valor: number; onChange: (n: number) => void; rotulo?: string; passo?: number }) {
  const fmt = (n: number) => String(n).replace('.', ',')
  const [texto, setTexto] = useState(fmt(valor))
  // acompanha mudanças vindas dos botões + e -
  useEffect(() => {
    setTexto((t) => (Number(t.replace(',', '.')) === valor ? t : fmt(valor)))
  }, [valor])
  return (
    <div className="inline-flex items-center rounded-ctl border border-line-strong bg-surface h-10" role="group" aria-label={rotulo}>
      <button type="button" aria-label="Diminuir" className="press grid place-items-center w-9 h-full text-muted hover:text-text" onClick={() => onChange(Math.max(0, +(valor - passo).toFixed(3)))}>
        <Minus size={16} weight="bold" />
      </button>
      <input
        aria-label={rotulo}
        inputMode="decimal"
        className="num w-16 h-full bg-transparent text-center text-sm focus:outline-none"
        value={texto}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d,.]/g, '')
          setTexto(t)
          const n = Number(t.replace(',', '.'))
          if (t !== '' && Number.isFinite(n) && n >= 0) onChange(n)
        }}
        onBlur={() => setTexto(fmt(valor))}
        onFocus={(e) => e.target.select()}
      />
      <button type="button" aria-label="Aumentar" className="press grid place-items-center w-9 h-full text-muted hover:text-text" onClick={() => onChange(+(valor + passo).toFixed(3))}>
        <Plus size={16} weight="bold" />
      </button>
    </div>
  )
}

export function Selo({ children, tom = 'neutro' }: { children: ReactNode; tom?: 'neutro' | 'destaque' | 'ok' | 'perigo' }) {
  const t = {
    neutro: 'bg-surface-2 text-muted',
    destaque: 'bg-accent-soft text-accent-text',
    ok: 'bg-ok-soft text-ok',
    perigo: 'bg-danger-soft text-danger',
  }[tom]
  return <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${t}`}>{children}</span>
}
