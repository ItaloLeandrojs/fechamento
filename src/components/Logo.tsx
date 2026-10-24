import { LOGO_COSAMPA, LOGO_LETRAS, LOGO_VIEWBOX } from './logoLetras'

/** Logo "COSAMPA / FECHAMENTO" no desenho da marca Cosampa, com o A em amarelo. */
export function Marca({ altura = 30 }: { altura?: number }) {
  const [, , w, h] = LOGO_VIEWBOX.split(' ').map(Number)
  return (
    <svg role="img" aria-label="Cosampa Fechamento" viewBox={LOGO_VIEWBOX} height={altura} width={(altura * w) / h} className="block">
      {LOGO_COSAMPA.map((l, i) => (
        <path key={`c${i}`} d={l.d} transform={l.t} fillRule="evenodd" fill="var(--text)" />
      ))}
      {LOGO_LETRAS.map((l, i) => (
        <path key={i} d={l.d} transform={l.t} fillRule="evenodd" fill={l.a ? 'var(--accent)' : 'var(--text)'} />
      ))}
    </svg>
  )
}
