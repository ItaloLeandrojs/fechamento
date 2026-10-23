// Transformador de distribuição preso no poste: tanque, tampa, duas buchas com
// isoladores e as cintas no poste. O Phosphor não tem esse ícone; o traço
// segue o peso "regular" dele.
export function IconeTransformador({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {/* poste e cintas */}
      <path d="M3.5 2.5v19M3.5 11h3M3.5 17.5h3" />
      {/* tanque com tampa */}
      <path d="M6.5 9.5h13" />
      <path d="M7.5 9.5v9.75a1.25 1.25 0 0 0 1.25 1.25h8.5a1.25 1.25 0 0 0 1.25-1.25V9.5" />
      <path d="M10 13.5v3.5M13 13.5v3.5M16 13.5v3.5" />
      {/* buchas com isoladores */}
      <path d="M11 9.5V4M16 9.5V4" />
      <path d="M9.75 5.25h2.5M9.75 7.25h2.5M14.75 5.25h2.5M14.75 7.25h2.5" />
    </svg>
  )
}
