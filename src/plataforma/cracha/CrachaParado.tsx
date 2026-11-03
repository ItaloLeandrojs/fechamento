// Crachá parado: a mesma arte do 3D como imagem. Clique, toque ou Enter vira para o verso.
// Vale para celular, "reduzir movimento", aparelho fraco, economia de dados, sem WebGL
// e como reserva enquanto o 3D carrega ou se ele falhar.
import { useEffect, useState } from 'react'
import type { Pessoa } from '../pessoa'
import { frente, verso } from './arte'

export function CrachaParado({ pessoa }: { pessoa: Pessoa }) {
  const [arte, setArte] = useState<{ f: string; v: string } | null>(null)
  const [virado, setVirado] = useState(false)

  useEffect(() => {
    let vivo = true
    Promise.all([frente(pessoa), verso(pessoa)])
      .then(([f, v]) => { if (vivo) setArte({ f, v }) })
      .catch(() => { /* sem canvas: fica o espaço reservado */ })
    return () => { vivo = false }
  }, [pessoa])

  const descricao = `Crachá de ${pessoa.nome}, ${pessoa.cargo}`
  return (
    <button
      type="button"
      onClick={() => setVirado((v) => !v)}
      className="block w-full max-w-[320px] cursor-pointer rounded-[14px]"
    >
      {arte ? (
        <img
          src={virado ? arte.v : arte.f}
          alt={virado ? `Verso do crachá de ${pessoa.nome}` : descricao}
          width={649}
          height={1039}
          className="block h-auto w-full rounded-[14px] shadow-[var(--shadow)]"
        />
      ) : (
        <span role="img" aria-label={descricao} className="block aspect-[649/1039] w-full rounded-[14px] bg-[var(--surface-2)]" />
      )}
      <span className="sr-only">{virado ? 'Virar para a frente.' : 'Virar para o verso.'}</span>
    </button>
  )
}
