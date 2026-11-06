// Ajuda dos testes do Ceará: monta um DXF de mentira com MTEXTs (e TEXTs) escritos na hora.
import type { Dxf, TextoDxf } from './dxf'

export const mtext = (bruto: string): TextoDxf => ({ tipo: 'MTEXT', bruto, camada: 'DESCRICAOPROJETADA', x: 0, y: 0, altura: 2.5 })
export const mtextEm = (bruto: string, x: number, y: number): TextoDxf => ({ tipo: 'MTEXT', bruto, camada: 'DESCRICAOPROJETADA', x, y, altura: 2 })
export const dxfDe = (textos: (string | TextoDxf)[], cotas: Dxf['cotas'] = []): Dxf => ({ versao: 'AC1024', textos: textos.map((t) => (typeof t === 'string' ? mtext(t) : t)), cotas })
