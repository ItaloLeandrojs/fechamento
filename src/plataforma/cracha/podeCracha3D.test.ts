import { afterEach, describe, expect, it, vi } from 'vitest'
import { podeCracha3D } from './podeCracha3D'

// Ambiente falso: consultas de mídia que "batem", extras do navigator e se há WebGL
function ambiente({ bate = [] as string[], nav = {} as Record<string, unknown>, webgl = true } = {}) {
  vi.stubGlobal('window', { matchMedia: (q: string) => ({ matches: bate.includes(q) }) })
  vi.stubGlobal('navigator', nav)
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => (webgl ? {} : null) }) })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('podeCracha3D', () => {
  it('computador com WebGL e sem restrições mostra o 3D', () => {
    ambiente()
    expect(podeCracha3D()).toBe(true)
  })

  it.each(['(max-width: 820px)', '(pointer: coarse)', '(prefers-reduced-motion: reduce)'])('com %s fica parado', (q) => {
    ambiente({ bate: [q] })
    expect(podeCracha3D()).toBe(false)
  })

  it('economia de dados, pouca memória ou sem WebGL fica parado', () => {
    ambiente({ nav: { connection: { saveData: true } } })
    expect(podeCracha3D()).toBe(false)
    ambiente({ nav: { deviceMemory: 2 } })
    expect(podeCracha3D()).toBe(false)
    ambiente({ webgl: false })
    expect(podeCracha3D()).toBe(false)
  })
})
