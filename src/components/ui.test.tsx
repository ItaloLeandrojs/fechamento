import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EscolhaOper } from './ui'

const operacoes = [
  { oper: '2000', nome: 'Poste existente', grupo: 'instalacao' as const },
  { oper: '2010', nome: 'Transformador novo', grupo: 'instalacao' as const },
  { oper: '2070', nome: 'Sucata de material', grupo: 'retirada' as const },
]

function ocorrencias(texto: string, trecho: string): number {
  return texto.split(trecho).length - 1
}

describe('EscolhaOper', () => {
  it('mantém os botões compactos e mostra apenas o nome da operação selecionada', () => {
    const html = renderToStaticMarkup(<EscolhaOper compacto valor="2010" onChange={() => undefined} operacoes={operacoes} />)

    expect(ocorrencias(html, 'Poste existente')).toBe(1)
    expect(ocorrencias(html, 'Transformador novo')).toBe(2)
    expect(ocorrencias(html, 'Sucata de material')).toBe(1)
  })
})
