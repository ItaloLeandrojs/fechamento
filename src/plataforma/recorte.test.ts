import { describe, expect, it } from 'vitest'
import { ajusteInicial, arrastar, ladoDoRecorte, limitarZoom, mudarZoom, retanguloDaPrevia, retanguloOrigem, ZOOM_MAX, ZOOM_MIN, type Ajuste, type Retangulo } from './recorte'

// o quadrado tem que caber inteiro na foto (senão sobra borda vazia no círculo)
function dentro(r: Retangulo, largura: number, altura: number) {
  expect(r.x).toBeGreaterThanOrEqual(0)
  expect(r.y).toBeGreaterThanOrEqual(0)
  expect(r.x + r.lado).toBeLessThanOrEqual(largura + 1e-9)
  expect(r.y + r.lado).toBeLessThanOrEqual(altura + 1e-9)
}

describe('recorte: centro', () => {
  it('foto quadrada com zoom 1: o recorte é a foto inteira', () => {
    expect(retanguloOrigem(600, 600, ajusteInicial(600, 600))).toEqual({ x: 0, y: 0, lado: 600 })
  })

  it('paisagem: começa no meio, na altura toda (cover)', () => {
    expect(retanguloOrigem(1600, 900, ajusteInicial(1600, 900))).toEqual({ x: 350, y: 0, lado: 900 })
  })

  it('retrato de celular: largura toda e levemente para cima (o rosto fica no terço de cima)', () => {
    const r = retanguloOrigem(900, 1600, ajusteInicial(900, 1600))
    expect(r.lado).toBe(900)
    expect(r.x).toBe(0)
    // centro a 40% da altura: 640 - 450 = 190 (no meio exato seria 350)
    expect(r.y).toBe(190)
    expect(r.y).toBeLessThan((1600 - 900) / 2)
  })

  it('retrato pouco mais alto que largo: o "para cima" para no topo da foto', () => {
    const r = retanguloOrigem(1000, 1100, ajusteInicial(1000, 1100))
    expect(r).toEqual({ x: 0, y: 0, lado: 1000 })
  })

  it('começa com zoom 1', () => {
    expect(ajusteInicial(800, 1200).zoom).toBe(ZOOM_MIN)
  })
})

describe('recorte: limites (nunca sobra borda vazia)', () => {
  it('arrastar muito para a direita e para baixo para no canto de cima à esquerda da foto', () => {
    const a = arrastar(1600, 900, ajusteInicial(1600, 900), 5000, 5000, 280)
    expect(retanguloOrigem(1600, 900, a)).toEqual({ x: 0, y: 0, lado: 900 })
  })

  it('arrastar muito para a esquerda e para cima para no canto de baixo à direita', () => {
    const a = arrastar(1600, 900, mudarZoom(1600, 900, ajusteInicial(1600, 900), 2), -5000, -5000, 280)
    expect(retanguloOrigem(1600, 900, a)).toEqual({ x: 1150, y: 450, lado: 450 })
  })

  it('a foto acompanha o dedo: arrastar 28 px num círculo de 280 px move 1/10 do recorte', () => {
    const inicio = { zoom: 2, centro: { x: 800, y: 450 } }
    const a = arrastar(1600, 900, inicio, 28, -14, 280)
    // lado 450: 28 px de tela = 45 px de foto; a foto vai para a direita, então o recorte vai para a esquerda
    expect(a.centro).toEqual({ x: 755, y: 472.5 })
  })

  it('centro fora da foto (dado guardado errado) volta para dentro', () => {
    dentro(retanguloOrigem(640, 480, { zoom: 1.5, centro: { x: -999, y: 99999 } }), 640, 480)
  })

  it('várias combinações de arrastar e zoom ficam sempre dentro da foto', () => {
    for (const [w, h] of [[1200, 1600], [1600, 1200], [500, 500], [3000, 1000], [37, 91]]) {
      let a = ajusteInicial(w, h)
      for (const [dx, dy, z] of [[300, -40, 2.7], [-900, 900, 1], [12, 3, 3], [-50, -60, 1.3], [1e6, -1e6, 3]]) {
        a = mudarZoom(w, h, arrastar(w, h, a, dx, dy, 240), z)
        dentro(retanguloOrigem(w, h, a), w, h)
      }
    }
  })
})

describe('recorte: zoom', () => {
  it('zoom 2 corta o lado pela metade, zoom 3 por três', () => {
    expect(ladoDoRecorte(900, 1600, 2)).toBe(450)
    expect(ladoDoRecorte(900, 1600, 3)).toBe(300)
  })

  it('o zoom fica entre 1 e 3 (e um valor inválido vira 1)', () => {
    expect(limitarZoom(0.2)).toBe(ZOOM_MIN)
    expect(limitarZoom(9)).toBe(ZOOM_MAX)
    expect(limitarZoom(Number.NaN)).toBe(ZOOM_MIN)
    expect(retanguloOrigem(900, 900, { zoom: 10, centro: { x: 450, y: 450 } }).lado).toBe(300)
  })

  it('dar zoom mantém o centro', () => {
    const a = mudarZoom(1600, 900, { zoom: 1, centro: { x: 800, y: 450 } }, 2.5)
    expect(a).toEqual({ zoom: 2.5, centro: { x: 800, y: 450 } })
    expect(retanguloOrigem(1600, 900, a)).toEqual({ x: 620, y: 270, lado: 360 })
  })

  it('tirar zoom perto da borda puxa o centro para dentro (sem borda vazia)', () => {
    // com zoom 3 no canto de cima à esquerda; voltando ao zoom 1 o recorte encosta no canto
    const canto = arrastar(1600, 900, mudarZoom(1600, 900, ajusteInicial(1600, 900), 3), 1e6, 1e6, 280)
    expect(retanguloOrigem(1600, 900, canto)).toEqual({ x: 0, y: 0, lado: 300 })
    expect(retanguloOrigem(1600, 900, mudarZoom(1600, 900, canto, 1))).toEqual({ x: 0, y: 0, lado: 900 })
  })
})

describe('recorte: a prévia mostra o mesmo que o recorte grava', () => {
  // ponto da tela (dentro do quadro da prévia) -> ponto da foto
  const naFoto = (p: ReturnType<typeof retanguloDaPrevia>, largura: number, sx: number, sy: number) => {
    const k = p.largura / largura
    return { x: (sx - p.x) / k, y: (sy - p.y) / k }
  }
  // ponto do JPEG gravado (lado x lado) -> ponto da foto
  const doJpeg = (r: Retangulo, lado: number, jx: number, jy: number) => ({ x: r.x + (jx / lado) * r.lado, y: r.y + (jy / lado) * r.lado })

  const casos: [number, number, Ajuste][] = []
  for (const [w, h] of [[240, 120], [900, 1600], [1600, 900], [500, 500], [37, 91]]) {
    const ini = ajusteInicial(w, h)
    casos.push([w, h, ini])
    for (const z of [1, 1.37, 2, 3]) {
      // no centro, deslocado sem chegar no limite e preso no limite
      const comZoom = mudarZoom(w, h, ini, z)
      casos.push([w, h, comZoom])
      casos.push([w, h, arrastar(w, h, comZoom, 13, -7, 320)])
      casos.push([w, h, arrastar(w, h, comZoom, 1e6, 1e6, 320)])
    }
  }

  it.each(casos)('foto %ix%i, ajuste %o: o quadrado do círculo é o quadrado do recorte', (w, h, a) => {
    for (const [quadro, proporcao] of [[392, 0.8], [254.4, 0.8], [300, 1]]) {
      const p = retanguloDaPrevia(w, h, a, quadro, proporcao)
      const r = retanguloOrigem(w, h, a)
      const { cx, cy, diametro } = p.circulo
      // cantos do quadrado que contém o círculo
      const a1 = naFoto(p, w, cx - diametro / 2, cy - diametro / 2)
      const a2 = naFoto(p, w, cx + diametro / 2, cy + diametro / 2)
      expect(a1.x).toBeCloseTo(r.x, 6)
      expect(a1.y).toBeCloseTo(r.y, 6)
      expect(a2.x).toBeCloseTo(r.x + r.lado, 6)
      expect(a2.y).toBeCloseTo(r.y + r.lado, 6)
      // a foto não é esticada: mesma escala nos dois eixos
      expect(p.altura / h).toBeCloseTo(p.largura / w, 9)
      // pontos dentro do círculo (centro e fora do centro) caem no mesmo ponto da foto que no JPEG de 480 px
      for (const [u, v] of [[0.5, 0.5], [0.5, 0.12], [0.12, 0.5], [0.88, 0.5], [0.5, 0.88], [0.25, 0.25], [0.75, 0.7]]) {
        const tela = naFoto(p, w, cx + (u - 0.5) * diametro, cy + (v - 0.5) * diametro)
        const jpeg = doJpeg(r, 480, u * 480, v * 480)
        expect(tela.x).toBeCloseTo(jpeg.x, 6)
        expect(tela.y).toBeCloseTo(jpeg.y, 6)
      }
    }
  })

  it('o círculo fica no meio do quadro, com a proporção pedida', () => {
    expect(retanguloDaPrevia(240, 120, ajusteInicial(240, 120), 400, 0.8).circulo).toEqual({ cx: 200, cy: 200, diametro: 320 })
  })

  it('exemplo à mão: foto 240x120, zoom 2, centro (100, 50), quadro 400 e círculo 320', () => {
    // recorte: lado 60, de (70, 20) a (130, 80); escala 320/60; a foto começa em 200 - 100 * 320/60
    const p = retanguloDaPrevia(240, 120, { zoom: 2, centro: { x: 100, y: 50 } }, 400, 0.8)
    expect(p.x).toBeCloseTo(200 - (100 * 320) / 60, 9)
    expect(p.y).toBeCloseTo(200 - (50 * 320) / 60, 9)
    expect(p.largura).toBeCloseTo((240 * 320) / 60, 9)
    expect(p.altura).toBeCloseTo((120 * 320) / 60, 9)
  })
})
