// O crachá 3D só aparece no computador que aguenta e quando a pessoa não pediu menos movimento.
// Nos outros casos (celular, toque, "reduzir movimento", economia de dados, pouca memória
// ou sem WebGL) entra o crachá parado, com a mesma arte.
interface NavegadorComExtras {
  connection?: { saveData?: boolean }
  deviceMemory?: number
}

export function podeCracha3D(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  const consulta = (q: string) => window.matchMedia(q).matches
  if (consulta('(max-width: 820px)')) return false
  if (consulta('(pointer: coarse)')) return false
  if (consulta('(prefers-reduced-motion: reduce)')) return false
  const nav = navigator as Navigator & NavegadorComExtras
  if (nav.connection?.saveData) return false
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2) return false
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}
