// Depois do login: confere a versão das bases e baixa a que mudou (garantirBases).
// Se não der e não houver cópia guardada, mostra o erro com "Tentar de novo".
import { useEffect, useRef, useState } from 'react'
import { garantirBases, type FonteBases } from '../nuvem/bases'
import { mensagemDeErro } from '../nuvem/sessao'
import { MolduraEntrada } from './Entrada'

export type Bases = Awaited<ReturnType<typeof garantirBases>>

export function Preparando({ fonte, onPronto, onSair }: { fonte: FonteBases; onPronto: (b: Bases) => void; onSair: () => void }) {
  const [tentativa, setTentativa] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const refTentar = useRef<HTMLButtonElement>(null)
  const refTitulo = useRef<HTMLHeadingElement>(null)
  const aoPronto = useRef(onPronto)
  useEffect(() => {
    aoPronto.current = onPronto
  }, [onPronto])

  useEffect(() => {
    let viva = true
    setErro(null)
    garantirBases(fonte)
      .then((b) => viva && aoPronto.current(b))
      .catch((e) => viva && setErro(mensagemDeErro(e)))
    return () => {
      viva = false
    }
  }, [fonte, tentativa])

  // a tela chega no lugar do botão que sumiu: o foco vai para o título; com erro, para "Tentar de novo"
  useEffect(() => {
    ;(erro ? refTentar : refTitulo).current?.focus()
  }, [erro])

  return (
    <MolduraEntrada>
      <div className="pl-form" aria-labelledby="preparando-titulo" aria-busy={!erro || undefined} role="group">
        <h2 id="preparando-titulo" ref={refTitulo} tabIndex={-1}>
          {erro ? 'Não deu para preparar as bases' : 'Preparando as bases...'}
        </h2>
        {!erro && <p className="pl-form-dica">Na primeira vez pode levar alguns segundos.</p>}
        {erro && (
          <>
            <p className="pl-erro" role="alert">
              {erro}
            </p>
            <button ref={refTentar} type="button" className="pl-botao" onClick={() => setTentativa((n) => n + 1)}>
              Tentar de novo <span aria-hidden="true">→</span>
            </button>
            <button type="button" className="pl-secundario" onClick={onSair}>
              Sair
            </button>
          </>
        )}
      </div>
    </MolduraEntrada>
  )
}
