/** Logo do Grupo Cosampa (mesmo desenho de public/plataforma/logo-cosampa.svg), preenchido com a cor do texto. */
import { LOGO_D, LOGO_VIEWBOX } from './logoPath'

export function Marca({ altura = 30 }: { altura?: number }) {
  const [, , w, h] = LOGO_VIEWBOX.split(' ').map(Number)
  return (
    <svg role="img" aria-label="Grupo Cosampa" viewBox={LOGO_VIEWBOX} height={altura} width={(altura * w) / h} className="block">
      <path d={LOGO_D} fillRule="evenodd" fill="var(--text)" />
    </svg>
  )
}
