import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cordao, frente, LAYOUT, verso } from './arte'
import type { Pessoa } from '../pessoa'

// Os testes rodam em Node, sem canvas de verdade. O canvas falso grava cada fillText
// com a fonte do momento, e mede o texto como "número de caracteres x tamanho da fonte".
interface Escrita { texto: string; font: string; x: number; y: number }

function tamanhoDaFonte(font: string): number {
  const m = font.match(/(\d+(?:\.\d+)?)px/)
  return m ? Number(m[1]) : 0
}

let escritas: Escrita[] = []

function contextoFalso() {
  const ctx: Record<string, unknown> = {
    font: '10px sans-serif',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    textAlign: 'left',
    textBaseline: 'alphabetic',
    imageSmoothingQuality: 'low',
    globalAlpha: 1,
    fillText(texto: string, x: number, y: number) {
      escritas.push({ texto, font: ctx.font as string, x, y })
    },
    measureText(texto: string) {
      return { width: texto.length * tamanhoDaFonte(ctx.font as string) }
    },
  }
  // todo o resto (caminhos, preenchimentos, transformações) só não faz nada
  return new Proxy(ctx, {
    get: (alvo, chave: string) => (chave in alvo ? alvo[chave] : () => undefined),
    set: (alvo, chave: string, valor) => { alvo[chave] = valor; return true },
  })
}

beforeEach(() => {
  escritas = []
  vi.stubGlobal('document', {
    createElement: () => ({ width: 0, height: 0, getContext: () => contextoFalso(), toDataURL: () => 'data:image/png;base64,FALSO' }),
    fonts: { load: () => Promise.resolve([]) },
  })
  vi.stubGlobal('Path2D', class {})
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const maria: Pessoa = { nome: 'Maria Souza', cargo: 'Técnica de campo', matricula: '', foto: null }
const textos = () => escritas.map((e) => e.texto)

describe('frente do crachá', () => {
  it('escreve o nome e o cargo em maiúsculas e as iniciais no círculo', async () => {
    const url = await frente(maria)
    expect(url).toMatch(/^data:image\/png/)
    expect(textos()).toContain('MARIA SOUZA')
    expect(textos()).toContain('TÉCNICA DE CAMPO')
    expect(textos()).toContain('MS')
  })

  it('nome de 40 letras diminui a fonte até caber na largura do nome', async () => {
    const nome = 'Maria Aparecida Souza Lima de Albuquerque'.slice(0, 40)
    expect(nome).toHaveLength(40)
    await frente({ ...maria, nome })
    const e = escritas.find((x) => x.texto === nome.toUpperCase())
    expect(e).toBeDefined()
    const px = tamanhoDaFonte(e!.font)
    // o canvas é desenhado em 2x: o tamanho em pixels do modelo é a metade
    expect(px / 2).toBeLessThan(48)
    expect((nome.length * px) / 2).toBeLessThanOrEqual(LAYOUT.apelido.max)
  })
})

describe('verso do crachá', () => {
  it('escreve os rótulos, o setor, a empresa e o aviso de uso pessoal', async () => {
    const url = await verso({ ...maria, matricula: '0000' })
    expect(url).toMatch(/^data:image\/png/)
    for (const t of ['Nome:', 'Setor:', 'Matrícula:', 'Empresa:', 'MARIA SOUZA', 'FECHAMENTO', 'GRUPO COSAMPA', '0000']) {
      expect(textos()).toContain(t)
    }
    const tudo = textos().join(' ')
    expect(tudo).toContain('Este crachá é de uso pessoal e')
    expect(tudo).toContain('intransferível. Uso obrigatório durante')
    expect(tudo).toContain('a permanência na empresa.')
  })

  it('não escreve número de emergência nem telefone', async () => {
    await verso(maria)
    const tudo = textos().join(' ')
    expect(tudo).not.toMatch(/\(\d{2}\)/)
    expect(tudo.toUpperCase()).not.toContain('EMERGÊNCIA')
  })

  it('matrícula não informada fica em branco', async () => {
    await verso(maria)
    expect(textos().filter((t) => /\d/.test(t))).toEqual([])
  })
})

describe('cordão', () => {
  it('devolve uma imagem', async () => {
    expect(await cordao()).toMatch(/^data:image\/png/)
  })
})
