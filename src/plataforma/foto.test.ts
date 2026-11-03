import { afterEach, describe, expect, it, vi } from 'vitest'
import { reduzirFoto } from './foto'

afterEach(() => {
  vi.unstubAllGlobals()
})

// No Node não há canvas nem FileReader: um canvas falso que anota cada chamada, na ordem
function canvasFalso() {
  const chamadas: string[] = []
  const ctx = {
    set fillStyle(v: string) {
      chamadas.push(`fillStyle ${v}`)
    },
    fillRect: () => chamadas.push('fillRect'),
    drawImage: () => chamadas.push('drawImage'),
  }
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      getContext() {
        return ctx
      }
      convertToBlob() {
        return Promise.resolve(new Blob(['x'], { type: 'image/jpeg' }))
      }
    },
  )
  vi.stubGlobal(
    'FileReader',
    class {
      result: string | null = null
      onload: (() => void) | null = null
      readAsDataURL() {
        this.result = 'data:image/jpeg;base64,eA=='
        queueMicrotask(() => this.onload?.())
      }
    },
  )
  return chamadas
}

const bitmap = () => ({ width: 960, height: 640, close: () => {} })
const arquivo = () => new File(['foto'], 'foto.png', { type: 'image/png' })

describe('reduzirFoto', () => {
  it('arquivo que não decodifica como imagem rejeita com foto-invalida', async () => {
    // no Node não existe createImageBitmap de verdade: simula o navegador recusando o arquivo
    vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('não decodifica')))
    const texto = new File(['isto não é uma imagem'], 'nota.txt', { type: 'text/plain' })
    await expect(reduzirFoto(texto)).rejects.toThrow('foto-invalida')
  })

  it('navegador que não conhece imageOrientation (TypeError) tenta de novo sem a opção', async () => {
    canvasFalso()
    const cib = vi.fn((_: Blob, opcoes?: ImageBitmapOptions) => (opcoes ? Promise.reject(new TypeError('opção desconhecida')) : Promise.resolve(bitmap())))
    vi.stubGlobal('createImageBitmap', cib)
    await expect(reduzirFoto(arquivo())).resolves.toMatch(/^data:image\/jpeg/)
    expect(cib).toHaveBeenCalledTimes(2)
    expect(cib.mock.calls[1]).toHaveLength(1)
  })

  it('TypeError e de novo falha sem a opção: rejeita com foto-invalida', async () => {
    const cib = vi.fn(() => Promise.reject(new TypeError('não dá')))
    vi.stubGlobal('createImageBitmap', cib)
    await expect(reduzirFoto(arquivo())).rejects.toThrow('foto-invalida')
    expect(cib).toHaveBeenCalledTimes(2)
  })

  it('outro erro (arquivo ruim) não tenta de novo', async () => {
    const cib = vi.fn(() => Promise.reject(new DOMException('ruim', 'InvalidStateError')))
    vi.stubGlobal('createImageBitmap', cib)
    await expect(reduzirFoto(arquivo())).rejects.toThrow('foto-invalida')
    expect(cib).toHaveBeenCalledTimes(1)
  })

  it('pinta o fundo de branco antes de desenhar (PNG transparente não fica preto)', async () => {
    const chamadas = canvasFalso()
    vi.stubGlobal('createImageBitmap', () => Promise.resolve(bitmap()))
    await reduzirFoto(arquivo())
    expect(chamadas).toEqual(['fillStyle #ffffff', 'fillRect', 'drawImage'])
  })
})
