import { useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { Minus, Plus } from '@phosphor-icons/react'
import { formatarQtd } from '../lib/busca'
import { ehQuilo, nomeOperacao } from '../state'
import type { Operacao } from '../core/inventario'

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo'

const estilos: Record<Variante, string> = {
  // primário 48 px; os demais 44 px no computador e 48 px no celular (alvo de toque)
  primario: 'h-12 bg-accent text-accent-ink hover:bg-accent-hover font-semibold',
  secundario: 'h-12 md:h-11 bg-surface text-text border border-line-strong hover:bg-surface-2',
  fantasma: 'h-12 md:h-11 text-muted hover:text-text hover:bg-surface-2',
  perigo: 'h-12 md:h-11 text-danger hover:bg-danger-soft',
}

/** `icone`: botão quadrado só com ícone (alvo de 44 px, 48 px no celular). */
export function Botao({ variante = 'secundario', icone = false, className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; icone?: boolean }) {
  return (
    <button
      type="button"
      className={`press inline-flex items-center justify-center gap-2 [&>svg]:shrink-0 rounded-ctl ${icone ? 'px-0 w-12 md:w-11' : 'px-4'} text-base whitespace-nowrap disabled:opacity-45 disabled:pointer-events-none ${estilos[variante]} ${className}`}
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
        className="h-12 w-full min-w-0 rounded-ctl border border-line-strong bg-surface px-3.5 text-base text-text placeholder:text-muted/80 focus:border-text focus:outline-none"
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
    <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-titulo font-semibold tracking-tight">{titulo}</h1>
        {sub && <p className="mt-1.5 text-base text-muted max-w-[70ch]">{sub}</p>}
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
      <p className="text-base text-muted max-w-[48ch]">{texto}</p>
    </div>
  )
}

/** Operações da ADS desta obra; as de retirada (ODD) levam a marca "sucata". */
export function EscolhaOper({ operacoes, valor, onChange, compacto = false }: { operacoes: Operacao[]; valor: string; onChange: (o: string) => void; compacto?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Operação" className="flex gap-1.5 py-1 -my-1 overflow-x-auto snap-x max-sm:-mx-4 max-sm:px-4 sm:flex-wrap sm:overflow-visible">
      {operacoes.map((o) => {
        const ativo = o.oper === valor
        const nome = nomeOperacao(o)
        return (
          <button
            key={o.oper}
            type="button"
            role="radio"
            aria-checked={ativo}
            aria-label={`${o.oper} ${nome}${o.tipo === 'retirada' ? ' (sucata)' : ''}`}
            title={o.descricao}
            onClick={() => onChange(o.oper)}
            className={`press shrink-0 snap-start whitespace-nowrap rounded-ctl border h-12 md:h-11 ${compacto ? 'px-2 text-sm' : 'px-3 text-base'} text-left ${
              ativo ? 'border-text bg-text text-bg' : 'border-line-strong bg-surface text-text hover:bg-surface-2'
            }`}
          >
            <span className="num font-semibold">{o.oper}</span>
            <span className={`ml-1.5 ${ativo ? 'opacity-85' : 'text-muted'}`}>{nome}</span>
            {o.tipo === 'retirada' && <span className={`ml-1.5 text-xs font-medium ${ativo ? 'opacity-85' : 'text-danger'}`}>sucata</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Unidade de um item; em quilo fica destacada, porque o lançamento é o peso (não o metro). */
export function Unidade({ un }: { un: string }) {
  return ehQuilo(un) ? <span className="font-semibold text-accent-text">KG, lance em quilo</span> : <>{un}</>
}

export function Quantidade({
  valor,
  onChange,
  rotulo = 'Quantidade',
  passo = 1,
  grande = false,
  emQuilo = false,
}: {
  valor: number
  onChange: (n: number) => void
  rotulo?: string
  passo?: number
  grande?: boolean
  /** Mostra "kg" colado ao número: cabo e cordoalha são lançados já em quilo. */
  emQuilo?: boolean
}) {
  const fmt = (n: number) => String(n).replace('.', ',')
  const [texto, setTexto] = useState(fmt(valor))
  // acompanha mudanças vindas dos botões + e -
  useEffect(() => {
    setTexto((t) => (Number(t.replace(',', '.')) === valor ? t : fmt(valor)))
  }, [valor])
  return (
    <div className={`inline-flex items-center rounded-ctl border border-line-strong bg-surface ${grande ? 'h-12' : 'h-12 md:h-11'}`} role="group" aria-label={rotulo}>
      <button type="button" aria-label="Diminuir" className="press grid place-items-center w-11 h-full text-muted hover:text-text" onClick={() => onChange(Math.max(0, +(valor - passo).toFixed(3)))}>
        <Minus size={18} weight="bold" />
      </button>
      <input
        aria-label={emQuilo ? `${rotulo}, em quilos` : rotulo}
        inputMode="decimal"
        className={`num h-full bg-transparent text-center focus:outline-none ${grande ? 'w-24 text-xl font-semibold' : 'w-20 text-base font-medium'} ${emQuilo ? 'text-right pr-1' : ''}`}
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
      {emQuilo && (
        <span aria-hidden="true" className="rounded-md bg-accent-soft px-1.5 py-0.5 text-sm font-bold text-accent-text">
          kg
        </span>
      )}
      <button type="button" aria-label="Aumentar" className="press grid place-items-center w-11 h-full text-muted hover:text-text" onClick={() => onChange(+(valor + passo).toFixed(3))}>
        <Plus size={18} weight="bold" />
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
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${t}`}>{children}</span>
}

/** Selo verde "N lançado(s)", único para todas as larguras (a lista de busca dá retorno do que já entrou). */
export function SeloLancado({ qtd, singular, plural }: { qtd: number; singular: string; plural: string }) {
  return (
    <Selo tom="ok">
      {formatarQtd(qtd)} {qtd === 1 ? singular : plural}
    </Selo>
  )
}
