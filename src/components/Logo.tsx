import { LOGO_LETRAS, LOGO_VIEWBOX } from './logoLetras'

/** Logo "COSAMPA / FECHAMENTO" no desenho da marca Cosampa, com o A em amarelo. */
export function Marca({ altura = 30 }: { altura?: number }) {
  const [, , w, h] = LOGO_VIEWBOX.split(' ').map(Number)
  return (
    <svg role="img" aria-label="Cosampa Fechamento" viewBox={LOGO_VIEWBOX} height={altura} width={(altura * w) / h} className="block">
      <text x="10" y="250" fontStyle="italic" fontSize="300" letterSpacing="18" fill="var(--text)" style={{ fontFamily: 'var(--font-sans)' }}>
        COSAMPA
      </text>
      {LOGO_LETRAS.map((l, i) => (
        <path key={i} d={l.d} transform={l.t} fillRule="evenodd" fill={l.a ? 'var(--accent)' : 'var(--text)'} />
      ))}
    </svg>
  )
}
