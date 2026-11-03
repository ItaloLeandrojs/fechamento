// Reduz a foto escolhida para caber no localStorage: no máximo `lado` px no lado
// maior, em JPEG 0.85. Arquivo que o navegador não decodifica (texto, HEIC)
// rejeita com Error('foto-invalida').
export async function reduzirFoto(arquivo: File, lado = 480): Promise<string> {
  const imagem = await decodificar(arquivo)

  try {
    const escala = Math.min(1, lado / Math.max(imagem.width, imagem.height))
    const largura = Math.max(1, Math.round(imagem.width * escala))
    const altura = Math.max(1, Math.round(imagem.height * escala))

    if (typeof OffscreenCanvas !== 'undefined') {
      const tela = new OffscreenCanvas(largura, altura)
      const ctx = tela.getContext('2d')
      if (!ctx) throw new Error('foto-invalida')
      desenhar(ctx, imagem, largura, altura)
      const blob = await tela.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
      return await blobParaDataUrl(blob)
    }

    const tela = document.createElement('canvas')
    tela.width = largura
    tela.height = altura
    const ctx = tela.getContext('2d')
    if (!ctx) throw new Error('foto-invalida')
    desenhar(ctx, imagem, largura, altura)
    return tela.toDataURL('image/jpeg', 0.85)
  } catch {
    throw new Error('foto-invalida')
  } finally {
    imagem.close()
  }
}

async function decodificar(arquivo: File): Promise<ImageBitmap> {
  try {
    // imageOrientation corrige a rotação gravada pela câmera do celular
    return await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
  } catch (e) {
    // navegador antigo que não conhece a opção lança TypeError: tenta de novo sem ela
    if (e instanceof TypeError) {
      try {
        return await createImageBitmap(arquivo)
      } catch {
        // cai no erro abaixo
      }
    }
    throw new Error('foto-invalida')
  }
}

// JPEG não tem transparência: sem o fundo branco, o PNG transparente vira fundo preto
function desenhar(ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D, imagem: ImageBitmap, largura: number, altura: number) {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, largura, altura)
  ctx.drawImage(imagem, 0, 0, largura, altura)
}

function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(String(leitor.result))
    leitor.onerror = () => reject(new Error('foto-invalida'))
    leitor.readAsDataURL(blob)
  })
}
