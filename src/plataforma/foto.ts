// Reduz a foto escolhida para caber no localStorage: no máximo `lado` px no lado
// maior, em JPEG 0.85. Arquivo que o navegador não decodifica (texto, HEIC)
// rejeita com Error('foto-invalida').
export async function reduzirFoto(arquivo: File, lado = 480): Promise<string> {
  let imagem: ImageBitmap
  try {
    // imageOrientation corrige a rotação gravada pela câmera do celular
    imagem = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('foto-invalida')
  }

  try {
    const escala = Math.min(1, lado / Math.max(imagem.width, imagem.height))
    const largura = Math.max(1, Math.round(imagem.width * escala))
    const altura = Math.max(1, Math.round(imagem.height * escala))

    if (typeof OffscreenCanvas !== 'undefined') {
      const tela = new OffscreenCanvas(largura, altura)
      const ctx = tela.getContext('2d')
      if (!ctx) throw new Error('foto-invalida')
      ctx.drawImage(imagem, 0, 0, largura, altura)
      const blob = await tela.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
      return await blobParaDataUrl(blob)
    }

    const tela = document.createElement('canvas')
    tela.width = largura
    tela.height = altura
    const ctx = tela.getContext('2d')
    if (!ctx) throw new Error('foto-invalida')
    ctx.drawImage(imagem, 0, 0, largura, altura)
    return tela.toDataURL('image/jpeg', 0.85)
  } catch {
    throw new Error('foto-invalida')
  } finally {
    imagem.close()
  }
}

function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(String(leitor.result))
    leitor.onerror = () => reject(new Error('foto-invalida'))
    leitor.readAsDataURL(blob)
  })
}
