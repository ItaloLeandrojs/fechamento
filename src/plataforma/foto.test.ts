import { afterEach, describe, expect, it, vi } from 'vitest'
import { abrirFoto, recortarFoto, reduzirFoto } from './foto'

afterEach(() => {
  vi.unstubAllGlobals()
})

// No Node não há canvas nem FileReader: um canvas falso que anota cada chamada, na ordem
// (e os argumentos de cada drawImage, em `desenhos`)
const desenhos: unknown[][] = []
let tamanhoDaTela: number[] = []
function canvasFalso() {
  const chamadas: string[] = []
  desenhos.length = 0
  const ctx = {
    set fillStyle(v: string) {
      chamadas.push(`fillStyle ${v}`)
    },
    fillRect: () => chamadas.push('fillRect'),
    drawImage: (...a: unknown[]) => {
      chamadas.push('drawImage')
      desenhos.push(a)
    },
  }
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      constructor(largura: number, altura: number) {
        tamanhoDaTela = [largura, altura]
      }
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

describe('recortarFoto', () => {
  it('desenha só o quadrado escolhido, em 480 x 480, sobre fundo branco', async () => {
    const chamadas = canvasFalso()
    const imagem = bitmap() as unknown as ImageBitmap
    await expect(recortarFoto(imagem, { x: 100, y: 40, lado: 300 })).resolves.toMatch(/^data:image\/jpeg/)
    expect(tamanhoDaTela).toEqual([480, 480])
    expect(chamadas).toEqual(['fillStyle #ffffff', 'fillRect', 'drawImage'])
    expect(desenhos[0]).toEqual([imagem, 100, 40, 300, 300, 0, 0, 480, 480])
  })

  it('canvas que falha rejeita com foto-invalida', async () => {
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        getContext() {
          return null
        }
      },
    )
    await expect(recortarFoto(bitmap() as unknown as ImageBitmap, { x: 0, y: 0, lado: 10 })).rejects.toThrow('foto-invalida')
  })
})

describe('abrirFoto', () => {
  it('foto grande de celular é reduzida para 1600 px no lado maior (e a original é fechada)', async () => {
    const fechou = vi.fn()
    const grande = { width: 3000, height: 4000, close: fechou }
    const menor = { width: 1200, height: 1600, close: () => {} }
    const cib = vi.fn((fonte: unknown) => Promise.resolve(fonte === grande ? menor : grande))
    vi.stubGlobal('createImageBitmap', cib)
    await expect(abrirFoto(arquivo())).resolves.toBe(menor)
    expect(cib.mock.calls[1][1]).toMatchObject({ resizeWidth: 1200, resizeHeight: 1600 })
    expect(fechou).toHaveBeenCalled()
  })

  it('foto pequena fica como está', async () => {
    const b = bitmap()
    const cib = vi.fn(() => Promise.resolve(b))
    vi.stubGlobal('createImageBitmap', cib)
    await expect(abrirFoto(arquivo())).resolves.toBe(b)
    expect(cib).toHaveBeenCalledTimes(1)
  })

  it('arquivo que não é imagem rejeita com foto-invalida', async () => {
    vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('não decodifica')))
    await expect(abrirFoto(arquivo())).rejects.toThrow('foto-invalida')
  })
})
