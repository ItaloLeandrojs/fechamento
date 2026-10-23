// Prova do núcleo: gera um inventário preenchido a partir do arquivo original.
// Uso: npx tsx scripts/prova.ts <inventario.xlsx> <pasta-das-imagens> <saida.xlsx>
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { setXmlImpl } from '../src/core/xml'
import { Workbook } from '../src/core/workbook'
import { SheetEditor } from '../src/core/sheet'
import { readAds, type Lancamento } from '../src/core/ads'
import { gerarFechamento } from '../src/core/build'
import type { Imagem } from '../src/core/images'

setXmlImpl(DOMParser as never, XMLSerializer as never)

const [inv, pastaImg, saida] = process.argv.slice(2)
const original = readFileSync(inv)
const idx = JSON.parse(readFileSync(join(pastaImg, 'index.json'), 'utf8')) as Record<string, { file: string; w: number; h: number; ext: 'jpeg' | 'png' }>
const img = (k: string): Imagem => ({ data: readFileSync(join(pastaImg, '..', idx[k].file)), width: idx[k].w, height: idx[k].h, ext: idx[k].ext })

// escolhe códigos reais do inventário para cobrir cada regra
const wb0 = await Workbook.open(original)
const rows = readAds(new SheetEditor(await wb0.sheetDoc('ADS'), wb0.sharedStrings))
const comCodigo = rows.filter((r) => r.code !== null)
const opsPorCodigo = new Map<number, Set<string>>()
for (const r of comCodigo) opsPorCodigo.set(r.code!, new Set([...(opsPorCodigo.get(r.code!) ?? []), r.oper]))
const so = (ops: string[]) => [...opsPorCodigo].find(([, s]) => s.size === ops.length && ops.every((o) => s.has(o)))?.[0]

const lanc: Lancamento[] = []
const caso = (desc: string, code: number | undefined, oper: string, qty: number) => {
  if (code === undefined) return console.log('  (sem código para o caso:', desc + ')')
  lanc.push({ code, oper, qty })
  console.log(`  ${desc}: ${code} lançado em ${oper} x${qty}`)
}
console.log('Casos de teste:')
caso('previsto na própria operação', so(['2000']), '2000', 3)
caso('2000 e 2020 previstos, lançado 2020', so(['2000', '2020']), '2020', 7)
caso('só 2000 previsto, lançado 2020 → cai na 2000', [...opsPorCodigo].find(([c, s]) => s.size === 1 && s.has('2000') && c !== so(['2000']))?.[0], '2020', 5)
caso('só 2030 previsto, lançado 2040 → cai na 2030', so(['2030']), '2040', 2)
caso('só 2000 previsto, lançado 2030 → linha nova (retirada não vai p/ instalação)', so(['2000']), '2030', 1)
caso('não previsto → linha nova', 30050159, '2000', 15)
caso('não previsto → linha nova', 30052558, '2020', 1)
caso('não previsto → linha nova', 30053437, '2010', 6)
caso('serviço não previsto → linha nova', 71000971, '2000', 2)

const t0 = Date.now()
const res = await gerarFechamento(original, {
  lancamentos: lanc,
  tecnico: { nome: 'José Daniel de Castro Clementino', registro: 1979, carimbo: img('carimbo') },
  aterramento: [
    { rua: 'RUA DIVINO', ponto: 'P1-12', tipoPoste: 'CONC', ohms: 19.1, hastes: 3, fotoVala: img('vala1'), fotoMedicao: img('med1') },
    { rua: 'RUA DIVINO', ponto: 'P5-13', tipoPoste: 'MAD', ohms: 13.7, hastes: 3, fotoVala: img('vala2'), fotoMedicao: img('med2') },
  ],
  equipamentos: [
    {
      ponto: 'P1-12',
      instalado: { potencia: '30', patrimonio: '4019221', fase: 'ABC', serie: '1109955774', marca: 'WEG', ano: '2025', nInstalacao: 'ET 689448', tensoes: { NA: 121, NB: 124, NC: 127, AB: 221, AC: 224, BC: 227 } },
      retirado: { potencia: '15', patrimonio: '123456', serie: '998877', marca: 'ITAIPU', ano: '2009', nInstalacao: 'ET 111222' },
      fotos: [img('equip1'), img('equip2')],
    },
  ],
  fotoDP: img('dp'),
})
writeFileSync(saida, res.arquivo)
console.log(`\nGerado em ${Date.now() - t0} ms → ${saida} (${(res.arquivo.length / 1e6).toFixed(1)} MB)`)
console.log('Destinos:')
for (const d of res.ads.destinos) console.log(`  ${d.code} ${d.oper} x${d.qty} → linha ${d.row} (${d.motivo}${d.operUsada ? ', op ' + d.operUsada : ''})`)
console.log('Linhas novas:', res.ads.linhasNovas.join(', '), '| zeradas:', res.ads.zeradas, '| já tinham valor e mudaram:', res.ads.mudaramDeValor)
console.log('Carimbo em:', res.abasComCarimbo.join(', '))
