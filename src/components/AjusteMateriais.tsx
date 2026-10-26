import { ArrowCounterClockwise } from '@phosphor-icons/react'
import { formatarQtd } from '../lib/busca'
import { ehQuilo, qtdNoKit, temAjuste, type EstruturaLanc, type Kit } from '../state'
import { Botao, Quantidade } from './ui'

interface Props {
  est: EstruturaLanc
  kit: Kit
  onChange: (ajuste: Record<number, number> | undefined) => void
}

/**
 * Materiais de uma estrutura lançada: desmarcar tira o material da soma, e a
 * quantidade (por estrutura) pode ser mudada. Ex.: na CE3, deixar só a alça do
 * condutor usado na obra.
 */
export function AjusteMateriais({ est, kit, onChange }: Props) {
  // grava só o que difere do kit; sem diferença, a linha volta a ser o kit puro
  const mudar = (code: number, qtd: number) => {
    const novo = { ...est.ajuste }
    const original = kit.itens.find((i) => i.code === code)?.qtd
    if (qtd === original) delete novo[code]
    else novo[code] = qtd
    onChange(Object.keys(novo).length ? novo : undefined)
  }
  const ajustada = temAjuste(est, kit)

  return (
    <div className="entra mt-2 rounded-ctl bg-surface-2 p-3">
      <p className="text-sm text-muted">Quantidade por estrutura. Desmarque o que não entra na soma.</p>
      <ul className="mt-2 divide-y divide-line">
        {kit.itens.map((i) => {
          const q = qtdNoKit(est, i)
          const dentro = q > 0
          const id = `${est.id}-${i.code}`
          return (
            <li key={i.code} className="py-2.5">
              <div className="flex items-start gap-3">
                <input
                  id={id}
                  type="checkbox"
                  checked={dentro}
                  onChange={(e) => mudar(i.code, e.target.checked ? i.qtd : 0)}
                  className="accent-[var(--accent)] size-5 shrink-0 mt-0.5"
                />
                <label htmlFor={id} className={`min-w-0 flex-1 text-sm ${dentro ? '' : 'text-muted'}`}>
                  <span className={dentro ? '' : 'line-through'}>{i.desc}</span>
                  <span className="num block text-xs text-muted">{i.code}</span>
                </label>
              </div>
              {dentro ? (
                <div className="mt-2 ml-8 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Quantidade valor={q} onChange={(n) => mudar(i.code, n)} rotulo={`Quantidade de ${i.desc} por estrutura`} emQuilo={ehQuilo(i.un)} passo={1} />
                  <span className="text-sm text-muted">
                    {!ehQuilo(i.un) && <>{i.un} </>}
                    {q !== i.qtd && <span className="text-accent-text font-medium">(kit: {formatarQtd(i.qtd)})</span>}
                  </span>
                  {est.qtd !== 1 && (
                    <span className="num text-sm font-medium ml-auto">
                      Total {formatarQtd(q * est.qtd)} {i.un}
                    </span>
                  )}
                </div>
              ) : (
                <p className="mt-1 ml-8 text-xs font-medium text-muted">Fora da soma</p>
              )}
            </li>
          )
        })}
      </ul>
      {ajustada && (
        <Botao variante="fantasma" className="mt-1 -ml-2 text-sm" onClick={() => onChange(undefined)}>
          <ArrowCounterClockwise size={18} /> Voltar ao kit completo
        </Botao>
      )}
    </div>
  )
}
