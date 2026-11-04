import type { Retangulo } from './recorte'

// Reduz a foto escolhida para caber no localStorage: no máximo `lado` px no lado
// maior, em JPEG 0.85. Arquivo que o navegador não decodifica (texto, HEIC)
// rejeita com Error('foto-invalida').
export async function reduzirFoto(arquivo: File, lado = 480): Promise<string> {
  const imagem = await decodificar(arquivo)
  try {
    const escala = Math.min(1, lado / Math.max(imagem.width, imagem.height))
    const largura = Math.max(1, Math.round(imagem.width * escala))
    const altura = Math.max(1, Math.round(imagem.height * escala))
    return await paraJpeg(largura, altura, (ctx) => ctx.drawImage(imagem, 0, 0, largura, altura))
  } finally {
    imagem.close()
  }
}

// Abre a foto escolhida para o ajuste (arrastar e zoom). Foto de celular (12 MP ou mais) fica
// com no máximo `ladoMax` px no lado maior: dá nitidez para o zoom 3 num recorte de 480 px
// sem segurar dezenas de MB na memória. Quem chama fecha (close) a imagem quando não precisar mais.
// Arquivo que não decodifica rejeita com Error('foto-invalida').
export async function abrirFoto(arquivo: File, ladoMax = 1600): Promise<ImageBitmap> {
  const imagem = await decodificar(arquivo)
  const escala = ladoMax / Math.max(imagem.width, imagem.height)
  if (escala >= 1) return imagem
  try {
    const menor = await createImageBitmap(imagem, {
      resizeWidth: Math.max(1, Math.round(imagem.width * escala)),
      resizeHeight: Math.max(1, Math.round(imagem.height * escala)),
      resizeQuality: 'high',
    })
    imagem.close()
    return menor
  } catch {
    // navegador que não reduz o bitmap: segue com a foto inteira (só gasta mais memória)
    return imagem
  }
}

// O quadrado `r` da foto (em pixels da foto) vira a foto do crachá: `lado` x `lado`, JPEG 0.85.
export async function recortarFoto(imagem: ImageBitmap, r: Retangulo, lado = 480): Promise<string> {
  return paraJpeg(lado, lado, (ctx) => ctx.drawImage(imagem, r.x, r.y, r.lado, r.lado, 0, 0, lado, lado))
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

type Ctx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D

async function paraJpeg(largura: number, altura: number, pintar: (ctx: Ctx) => void): Promise<string> {
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const tela = new OffscreenCanvas(largura, altura)
      const ctx = tela.getContext('2d')
      if (!ctx) throw new Error('foto-invalida')
      fundoBranco(ctx, largura, altura)
      pintar(ctx)
      const blob = await tela.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
      return await blobParaDataUrl(blob)
    }

    const tela = document.createElement('canvas')
    tela.width = largura
    tela.height = altura
    const ctx = tela.getContext('2d')
    if (!ctx) throw new Error('foto-invalida')
    fundoBranco(ctx, largura, altura)
    pintar(ctx)
    return tela.toDataURL('image/jpeg', 0.85)
  } catch {
    throw new Error('foto-invalida')
  }
}

// JPEG não tem transparência: sem o fundo branco, o PNG transparente vira fundo preto
function fundoBranco(ctx: Ctx, largura: number, altura: number) {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, largura, altura)
}

function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(String(leitor.result))
    leitor.onerror = () => reject(new Error('foto-invalida'))
    leitor.readAsDataURL(blob)
  })
}
