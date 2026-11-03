import { useEffect, useRef, type ReactNode } from 'react'
import { DownloadSimple, FileText, IdentificationCard, Package, Shovel, Stack, Wrench } from '@phosphor-icons/react'
import type { Etapa, Secao } from '../etapas'
import { formatarQtd } from '../lib/busca'
import { IconeTransformador } from './IconeTransformador'

const TAM = 20
const icones: Record<Secao, ReactNode> = {
  estruturas: <Stack size={TAM} />,
  materiais: <Package size={TAM} />,
  servicos: <Wrench size={TAM} />,
  aterramento: <Shovel size={TAM} />,
  equipamentos: <IconeTransformador size={TAM} />,
  dp: <FileText size={TAM} />,
  carimbo: <IdentificationCard size={TAM} />,
  revisao: <DownloadSimple size={TAM} />,
}

/** Estado da etapa em palavras (a cor nunca fica sozinha). */
function Marcador({ etapa }: { etapa: Etapa }) {
  return (
    <span className="ml-auto flex items-center gap-1.5 pl-2">
      {etapa.n ? <span className="num text-xs font-semibold text-text min-w-7 text-right">{formatarQtd(etapa.n)}</span> : null}
      {etapa.restam ? (
        <span className="text-xs font-medium text-muted whitespace-nowrap">
          <span aria-hidden>{etapa.restam} pend.</span>
          <span className="sr-only">{etapa.restam} {etapa.restam === 1 ? 'pendência' : 'pendências'}</span>
        </span>
      ) : null}
      {etapa.estado === 'pendente' && <span className="text-xs font-medium text-danger">falta</span>}
      {etapa.estado === 'feito' && !etapa.n && <span className="text-xs font-medium text-ok">ok</span>}
    </span>
  )
}

/**
 * Caminho do trabalho: coluna de 260 px no computador (com grupos),
 * faixa rolável no topo no celular.
 */
export function Etapas({ etapas, atual, onIr, rodape }: { etapas: Etapa[]; atual: Secao; onIr: (s: Secao) => void; rodape?: ReactNode }) {
  const lista = useRef<HTMLUListElement>(null)
  // no celular, a etapa atual sempre aparece na faixa: rola só a própria lista
  // (scrollIntoView mexeria também na rolagem da página e no computador não há faixa)
  useEffect(() => {
    const ul = lista.current
    const el = ul?.querySelector<HTMLElement>('[aria-current=page]')
    if (!ul || !el || !window.matchMedia('(max-width: 767px)').matches) return
    const alvo = el.offsetLeft - (ul.clientWidth - el.offsetWidth) / 2
    ul.scrollTo({ left: Math.max(0, alvo), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [atual])

  return (
    <nav aria-label="Etapas" className="md:sticky md:top-[72px] md:self-start md:max-h-[calc(100dvh-72px)] md:overflow-y-auto md:py-8 -mx-4 sm:-mx-6 md:-mx-1 px-4 sm:px-6 md:px-1 border-b md:border-0 border-line bg-bg">
      <ul ref={lista} className="relative flex md:grid gap-1.5 md:gap-1 overflow-x-auto md:overflow-visible py-2 md:py-0">
        {etapas.map((m, i) => {
          const ativa = atual === m.id
          return (
            <li key={m.id} className="shrink-0">
              {(i === 0 || etapas[i - 1].grupo !== m.grupo) && (
                <p className={`hidden md:block text-xs font-semibold uppercase tracking-wider text-muted px-3 pb-2 mb-1 border-b border-line ${i === 0 ? '' : 'mt-7'}`}>{m.grupo}</p>
              )}
              <button
                type="button"
                onClick={() => onIr(m.id)}
                aria-current={ativa ? 'page' : undefined}
                className={`press relative w-full flex items-center gap-3 h-12 px-3 rounded-ctl text-sm border ${
                  ativa ? 'bg-surface text-text font-semibold border-line-strong' : 'text-muted hover:text-text hover:bg-surface-2 border-transparent'
                }`}
              >
                {/* a etapa aberta é marcada em branco: o verde fica para ação e para o que está feito */}
                {ativa && <span aria-hidden className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full bg-text" />}
                <span className={ativa ? 'text-text' : ''}>{icones[m.id]}</span>
                <span className="whitespace-nowrap">{m.rotulo}</span>
                <Marcador etapa={m} />
              </button>
            </li>
          )
        })}
      </ul>
      {rodape}
    </nav>
  )
}
