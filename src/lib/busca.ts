/** Minúsculo, sem acento e sem espaços extras. */
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Todas as palavras da busca precisam aparecer no texto (em qualquer ordem). */
export function casa(textoNormalizado: string, busca: string): boolean {
  const termos = normalizar(busca).split(' ').filter(Boolean)
  return termos.every((t) => textoNormalizado.includes(t))
}

export function formatarQtd(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}
