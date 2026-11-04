// Contas do ajuste da foto do crachá, sem tela nem navegador (testadas no Vitest).
//
// O recorte é um quadrado da foto original (em pixels da foto) que vai inteiro para o círculo.
// Com zoom 1 o quadrado tem o lado menor da foto (a foto "cobre" o círculo, como object-fit: cover);
// com zoom 3 tem um terço disso. O centro do quadrado é o que a pessoa move ao arrastar.
// O quadrado nunca sai da foto: assim nunca sobra borda vazia dentro do círculo.

export const ZOOM_MIN = 1
export const ZOOM_MAX = 3

export type Ponto = { x: number; y: number }
/** Quadrado de origem, em pixels da foto: canto de cima à esquerda e lado. */
export type Retangulo = { x: number; y: number; lado: number }
export type Ajuste = { zoom: number; centro: Ponto }

const entre = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export function limitarZoom(zoom: number): number {
  return Number.isFinite(zoom) ? entre(zoom, ZOOM_MIN, ZOOM_MAX) : ZOOM_MIN
}

/** Lado do quadrado de origem para esse zoom. */
export function ladoDoRecorte(largura: number, altura: number, zoom: number): number {
  return Math.min(largura, altura) / limitarZoom(zoom)
}

/** Centro que deixa o quadrado inteiro dentro da foto. */
export function limitarCentro(largura: number, altura: number, zoom: number, centro: Ponto): Ponto {
  const meio = ladoDoRecorte(largura, altura, zoom) / 2
  return { x: entre(centro.x, meio, largura - meio), y: entre(centro.y, meio, altura - meio) }
}

/** O quadrado de origem (o que vai para o círculo do crachá), já dentro dos limites da foto. */
export function retanguloOrigem(largura: number, altura: number, ajuste: Ajuste): Retangulo {
  const lado = ladoDoRecorte(largura, altura, ajuste.zoom)
  const c = limitarCentro(largura, altura, ajuste.zoom, ajuste.centro)
  return { x: c.x - lado / 2, y: c.y - lado / 2, lado }
}

/** Onde a foto inteira é desenhada no quadro da prévia (em pixels de tela) e o círculo dentro dele. */
export type Previa = { x: number; y: number; largura: number; altura: number; circulo: { cx: number; cy: number; diametro: number } }

/**
 * Conta da prévia do ajuste: o quadro quadrado tem `quadro` px e o círculo, no meio, ocupa
 * `proporcao` do quadro. A foto é desenhada inteira de modo que o círculo mostre exatamente
 * o mesmo quadrado de retanguloOrigem: é isso que garante "o que se vê é o que vai para o crachá".
 */
export function retanguloDaPrevia(largura: number, altura: number, ajuste: Ajuste, quadro: number, proporcao: number): Previa {
  const diametro = quadro * proporcao
  const meio = quadro / 2
  const r = retanguloOrigem(largura, altura, ajuste)
  const k = diametro / r.lado // pixels de tela por pixel da foto
  return {
    x: meio - (r.x + r.lado / 2) * k,
    y: meio - (r.y + r.lado / 2) * k,
    largura: largura * k,
    altura: altura * k,
    circulo: { cx: meio, cy: meio, diametro },
  }
}

// Num retrato o rosto costuma ficar no terço de cima: o centro começa a 40% da altura (e não a 50%)
const ALTURA_DO_ROSTO = 0.4

/** Ponto de partida: zoom 1 (foto cobrindo o círculo), centralizado e levemente para cima. */
export function ajusteInicial(largura: number, altura: number): Ajuste {
  const centro = limitarCentro(largura, altura, ZOOM_MIN, { x: largura / 2, y: altura * ALTURA_DO_ROSTO })
  return { zoom: ZOOM_MIN, centro }
}

/**
 * Arrastar: a foto acompanha o dedo. `dx` e `dy` em pixels da tela; `diametro` é o tamanho
 * do círculo na tela. Arrastar para a direita mostra o que está à esquerda da foto.
 */
export function arrastar(largura: number, altura: number, ajuste: Ajuste, dx: number, dy: number, diametro: number): Ajuste {
  const porPixel = ladoDoRecorte(largura, altura, ajuste.zoom) / diametro
  const centro = { x: ajuste.centro.x - dx * porPixel, y: ajuste.centro.y - dy * porPixel }
  return { zoom: ajuste.zoom, centro: limitarCentro(largura, altura, ajuste.zoom, centro) }
}

/** Novo zoom (limitado de 1 a 3) com o mesmo centro; perto da borda o centro é puxado para dentro. */
export function mudarZoom(largura: number, altura: number, ajuste: Ajuste, zoom: number): Ajuste {
  const z = limitarZoom(zoom)
  // o centro guardado é sempre o que se vê: sem isso, ao tirar zoom perto da borda e pôr de novo, a foto "pularia"
  const visto = limitarCentro(largura, altura, ajuste.zoom, ajuste.centro)
  return { zoom: z, centro: limitarCentro(largura, altura, z, visto) }
}
