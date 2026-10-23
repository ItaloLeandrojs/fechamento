import type { Imagem } from '../core/images'

export interface Foto {
  imagem: Imagem
  url: string // para mostrar na tela
  nome: string
}

/**
 * Lê a foto do celular, gira conforme o EXIF e reduz para no máximo
 * `maxLado` px (data, GPS e visor do medidor continuam legíveis).
 */
export async function lerFoto(file: File, maxLado = 1600): Promise<Foto> {
  if (!file.type.startsWith('image/')) throw new Error(`"${file.name}" não é uma imagem.`)
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const esc = Math.min(1, maxLado / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * esc)
  const h = Math.round(bmp.height * esc)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const blob = await new Promise<Blob>((ok, erro) => canvas.toBlob((b) => (b ? ok(b) : erro(new Error('Não foi possível ler a foto.'))), 'image/jpeg', 0.85))
  const data = new Uint8Array(await blob.arrayBuffer())
  return { imagem: { data, width: w, height: h, ext: 'jpeg' }, url: URL.createObjectURL(blob), nome: file.name }
}

export function base64ParaBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function bytesParaBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/**
 * Prepara a imagem de um carimbo cadastrado à mão: tira o fundo branco
 * (fica transparente) e corta as sobras. Assim ele não cobre as linhas da ficha.
 */
export async function prepararCarimbo(file: File): Promise<{ png: Uint8Array; width: number; height: number; url: string }> {
  const bmp = await createImageBitmap(file)
  const esc = Math.min(1, 700 / bmp.width)
  const w = Math.round(bmp.width * esc)
  const h = Math.round(bmp.height * esc)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  let x0 = w, y0 = h, x1 = 0, y1 = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const m = Math.min(d[i], d[i + 1], d[i + 2])
      if (m > 215) d[i + 3] = 0
      else if (m > 170) d[i + 3] = Math.round((d[i + 3] * (215 - m)) / 45)
      if (d[i + 3] > 20) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  ctx.putImageData(img, 0, 0)
  if (x1 < x0) throw new Error('A imagem do carimbo parece estar em branco.')
  const pad = 6
  const cx = Math.max(0, x0 - pad), cy = Math.max(0, y0 - pad)
  const cw = Math.min(w, x1 + pad) - cx, ch = Math.min(h, y1 + pad) - cy
  const out = document.createElement('canvas')
  out.width = cw
  out.height = ch
  out.getContext('2d')!.drawImage(c, cx, cy, cw, ch, 0, 0, cw, ch)
  const blob = await new Promise<Blob>((ok) => out.toBlob((b) => ok(b!), 'image/png'))
  return { png: new Uint8Array(await blob.arrayBuffer()), width: cw, height: ch, url: URL.createObjectURL(blob) }
}
