import { describe, expect, it } from 'vitest'
import { ajusteInicial, arrastar, ladoDoRecorte, limitarZoom, mudarZoom, retanguloOrigem, ZOOM_MAX, ZOOM_MIN, type Retangulo } from './recorte'

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
