import { afterEach, describe, expect, it, vi } from 'vitest'
import { reduzirFoto } from './foto'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('reduzirFoto', () => {
  it('arquivo que não decodifica como imagem rejeita com foto-invalida', async () => {
    // no Node não existe createImageBitmap de verdade: simula o navegador recusando o arquivo
    vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('não decodifica')))
    const texto = new File(['isto não é uma imagem'], 'nota.txt', { type: 'text/plain' })
    await expect(reduzirFoto(texto)).rejects.toThrow('foto-invalida')
  })
})
