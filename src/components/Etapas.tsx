import { useEffect, useRef, type ReactNode } from 'react'
import { DownloadSimple, FileText, IdentificationCard, Package, Shovel, Stack, Wrench } from '@phosphor-icons/react'
import type { Etapa, Secao } from '../etapas'
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
      {etapa.n ? <span className="num text-xs font-medium bg-surface-2 text-text rounded-md px-2 py-0.5 min-w-7 text-center">{etapa.n}</span> : null}
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
  // no celular, a etapa atual sempre aparece na faixa
  useEffect(() => {
    const el = lista.current?.querySelector<HTMLElement>('[aria-current=page]')
    el?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [atual])

  return (
    <nav aria-label="Etapas" className="md:sticky md:top-[72px] md:self-start md:py-8 -mx-4 sm:-mx-6 md:mx-0 px-4 sm:px-6 md:px-0 border-b md:border-0 border-line bg-bg">
      <ul ref={lista} className="flex md:grid gap-1.5 md:gap-1 overflow-x-auto md:overflow-visible py-2 md:py-0">
        {etapas.map((m, i) => {
          const ativa = atual === m.id
          return (
            <li key={m.id} className="shrink-0">
              {(i === 0 || etapas[i - 1].grupo !== m.grupo) && <p className={`hidden md:block text-xs font-semibold uppercase tracking-wider text-muted px-3 mb-1.5 ${i === 0 ? '' : 'mt-6'}`}>{m.grupo}</p>}
              <button
                type="button"
                onClick={() => onIr(m.id)}
                aria-current={ativa ? 'page' : undefined}
                className={`press relative w-full flex items-center gap-3 h-12 px-3 rounded-ctl text-sm border ${
                  ativa ? 'bg-surface text-text font-semibold shadow-panel border-line-strong' : 'text-muted hover:text-text hover:bg-surface-2 border-transparent'
                }`}
              >
                {ativa && <span aria-hidden className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-accent" />}
                <span className={ativa ? 'text-accent-text' : ''}>{icones[m.id]}</span>
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
