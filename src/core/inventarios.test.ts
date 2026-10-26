// Testes com inventários reais de outras obras (pasta ../inventarios-teste, fora do git:
// cada teste pula onde o arquivo não existe).
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { setXmlImpl, child } from './xml'
import { Workbook } from './workbook'
import { SheetEditor } from './sheet'
import { gerarFechamento, type DadosFechamento } from './build'
import { conferirArquivo } from './conferencia'
import { readAds } from './ads'

setXmlImpl(DOMParser as never, XMLSerializer as never)

const AMIGO = '../inventarios-teste/do-amigo/original.xlsx'

describe.skipIf(!existsSync(AMIGO))('inventário com fórmulas para a planilha externa da EDP (nota 4001933383)', () => {
  // material novo, material em kg novo e serviço novo (código 7…), nenhum previsto nesta obra
  const lancamentos = [
    { code: 30053440, oper: '2000', qty: 3 },
    { code: 30057582, oper: '2000', qty: 0.33 },
    { code: 71000919, oper: '2000', qty: 1 },
  ]

  async function gerar() {
    const res = await gerarFechamento(readFileSync(AMIGO), { lancamentos, aterramento: [], equipamentos: [], boletim: 'final' })
    const wb = await Workbook.open(res.arquivo)
    return { res, ed: new SheetEditor(await wb.sheetDoc('ADS'), wb.sharedStrings) }
  }

  it('linha nova com descrição e unidade da MaterialServico, já calculadas para o Modo Protegido', async () => {
    const { res, ed } = await gerar()
    expect(res.ads.linhasNovas).toHaveLength(3)
    const porCodigo = new Map(res.ads.linhasNovas.map((r) => [ed.value('E' + r), r]))
    const r1 = porCodigo.get(30053440)!
    const r2 = porCodigo.get(30057582)!
    const r3 = porCodigo.get(71000919)!
    expect(ed.value('F' + r1)).toBe('CON CUNHA RD CN5 AL PROT CORR GAL')
    expect(ed.value('G' + r1)).toBe('PEÇ')
    expect(ed.value('G' + r2)).toBe('KG')
    expect(ed.value('G' + r3)).toBe('SRV')
    for (const r of [r1, r2, r3]) {
      for (const col of ['F', 'G', 'M', 'Q', 'L']) {
        const f = child(ed.cell(col + r)!, 'f')?.textContent ?? ''
        expect(f, `${col}${r} não pode depender da planilha externa`).not.toMatch(/\[\d+\]/)
      }
      expect(child(ed.cell('F' + r)!, 'f')?.textContent).toBe(`TRIM(VLOOKUP(E${r},MaterialServico!C:D,2,0))`)
      expect(child(ed.cell('G' + r)!, 'f')?.textContent).toBe(`TRIM(VLOOKUP(E${r},MaterialServico!C:E,3,0))`)
    }
  })

  it('nenhuma célula da linha nova continua presa à planilha externa (sairia #N/D)', async () => {
    const { res, ed } = await gerar()
    for (const r of res.ads.linhasNovas) {
      for (const c of Array.from(ed.row(r)!.getElementsByTagName('c'))) {
        const f = child(c, 'f')?.textContent ?? ''
        expect(f, c.getAttribute('r')!).not.toMatch(/\[\d+\]/)
      }
    }
  })

  it('preço: serviço (7…) pelo contrato na coluna M, material pelo código na Q', async () => {
    const { res, ed } = await gerar()
    const r = res.ads.linhasNovas.find((x) => ed.value('E' + x) === 71000919)!
    expect(child(ed.cell('M' + r)!, 'f')?.textContent).toBe(`IFERROR(IF(LEFT(E${r},1)="7",VLOOKUP(E${r}&'Check-list'!$G$6,MaterialServico!A:F,6,0),0),"0")`)
    expect(child(ed.cell('Q' + r)!, 'f')?.textContent).toBe(`IFERROR(IF(LEFT(E${r},1)<>"7",VLOOKUP(E${r},MaterialServico!B:F,5,0),0),"0")`)
  })

  it('as linhas previstas continuam com as fórmulas da EDP, inclusive o código (o preço procura o código em texto)', async () => {
    const { ed } = await gerar()
    expect(ed.value('E2')).toBe('10050572')
    expect(child(ed.cell('E2')!, 'f')?.textContent).toMatch(/\[1\]Dados/)
    expect(child(ed.cell('F2')!, 'f')?.textContent).toMatch(/\[1\]Dados/)
    expect(ed.value('F2')).toMatch(/^CABO PROT XLPE/)
  })

  it('o lançamento de um item previsto cai na linha prevista (sem duplicar), mesmo com o código em texto', async () => {
    const res = await gerarFechamento(readFileSync(AMIGO), { lancamentos: [{ code: 10050572, oper: '2000', qty: 90 }], aterramento: [], equipamentos: [] })
    expect(res.ads.linhasNovas).toEqual([])
    expect(res.ads.destinos[0]).toMatchObject({ row: 2, motivo: 'prevista' })
  })
})

// ---------- todos os inventários reais da pasta de teste ----------

const PASTA = '../inventarios-teste/'
const TODOS = (existsSync(PASTA) ? [...readdirSync(PASTA).filter((f) => f.endsWith('.xlsx')).map((f) => PASTA + f), PASTA + 'do-amigo/original.xlsx'] : [])
  .concat('e2e/dados/inv.xlsx')
  .filter((f) => existsSync(f))

const foto = (f: string) => ({ data: new Uint8Array(readFileSync('e2e/dados/' + f)), width: 1200, height: 1600, ext: 'jpeg' as const })

async function dadosCompletos(original: Uint8Array): Promise<DadosFechamento> {
  const wb = await Workbook.open(original)
  const previsto = readAds(new SheetEditor(await wb.sheetDoc('ADS'), wb.sharedStrings)).find((r) => r.code !== null)!
  const tec = JSON.parse(readFileSync('e2e/dados/tec.json', 'utf8')).tecnicos[0]
  return {
    // um previsto (a quantidade planejada) e três que não estão em nenhuma dessas obras: material, material em kg e serviço
    lancamentos: [
      { code: previsto.code!, oper: previsto.oper || '2000', qty: previsto.planejado || 1 },
      { code: 30053440, oper: '2000', qty: 3 },
      { code: 30057582, oper: '2000', qty: 0.33 },
      { code: 71000919, oper: '2000', qty: 1 },
    ],
    tecnico: { nome: 'TESTE DO SITE', registro: 1234, carimbo: { data: Uint8Array.from(Buffer.from(tec.carimbo.png, 'base64')), width: tec.carimbo.width, height: tec.carimbo.height, ext: 'png' } },
    aterramento: [
      { rua: 'RUA TESTE A', ponto: 'P1', tipoPoste: 'CONC', ohms: 12.5, hastes: 3, fotoVala: foto('vala1.jpeg'), fotoMedicao: foto('med1.jpeg') },
      { rua: 'RUA TESTE B', ponto: 'P2', tipoPoste: 'MAD', ohms: 9, hastes: 2, fotoVala: foto('vala1.jpeg'), fotoMedicao: foto('med1.jpeg') },
    ],
    equipamentos: [{ ponto: 'P1', instalado: { potencia: '75', patrimonio: '123456', fase: 'ABC', serie: 'S1', marca: 'MARCA', ano: '03/2025', nInstalacao: 'ET 1', tensoes: { NA: 127 } }, retirado: { potencia: '45', patrimonio: '654321', serie: 'S0', marca: 'VELHA', ano: '2019', nInstalacao: 'ET 2' }, fotos: [foto('equip1.jpeg')] }],
    fotoDP: foto('dp.jpeg'),
    boletim: 'parcial',
    hoje: new Date(2026, 9, 26),
  }
}

describe.skipIf(!TODOS.length)('todos os inventários reais: fechamento completo e conferência automática', () => {
  it.each(TODOS)('%s', async (arquivo) => {
    const original = new Uint8Array(readFileSync(arquivo))
    let dados = await dadosCompletos(original)
    let res
    try {
      res = await gerarFechamento(original, dados)
    } catch (e) {
      // inventário que já teve a ficha de aterramento preenchida: o site para e diz por quê
      expect((e as Error).message).toMatch(/aterramento.*inventário original/s)
      dados = { ...dados, aterramento: [] }
      res = await gerarFechamento(original, dados)
    }
    const conf = await conferirArquivo(res.arquivo, dados, res)
    expect(conf.problemas).toEqual([])
    expect(conf.conferidos).toBeGreaterThan(15)
    expect(res.ads.linhasNovas).toHaveLength(3)
  }, 120000)
})

describe.skipIf(!existsSync('e2e/dados/inv.xlsx'))('a conferência automática acusa o que não bate', () => {
  const INV = 'e2e/dados/inv.xlsx'

  it('aplicado diferente do lançado, foto que não entrou, parcial não marcado e código fora da MaterialServico', async () => {
    const original = new Uint8Array(readFileSync(INV))
    const dados = await dadosCompletos(original)
    // gera com um código que não existe na MaterialServico, sem a foto da DP e como final
    const gerado = await gerarFechamento(original, { ...dados, lancamentos: [...dados.lancamentos, { code: 12345678, oper: '2000', qty: 1 }], fotoDP: undefined, boletim: 'final' })
    // e confere como se tivesse lançado 99 no previsto, com foto da DP e parcial
    const destinos = gerado.ads.destinos.map((d, i) => (i === 0 ? { ...d, qty: 99 } : d))
    const conf = await conferirArquivo(gerado.arquivo, dados, { ...gerado, ads: { ...gerado.ads, destinos } })
    const texto = conf.problemas.join('\n')
    expect(texto).toMatch(/foi lançado 99 e o Aplicado ficou/)
    expect(texto).toMatch(/12345678 não está na aba MaterialServico/)
    expect(texto).toMatch(/DP: a foto/)
    expect(texto).toMatch(/caixa PARCIAL/)
  }, 120000)

  it('aba sem carimbo e total da Check-list que não cobre as linhas novas', async () => {
    const original = new Uint8Array(readFileSync(INV))
    const dados = await dadosCompletos(original)
    const gerado = await gerarFechamento(original, dados)
    // estraga o arquivo: tira o carimbo da DP e encurta a soma da Check-list
    const wb = await Workbook.open(gerado.arquivo)
    const ck = wb.sheetByPrefix('Check-list')!
    const doc = await wb.doc(ck.path)
    for (const f of Array.from(doc.getElementsByTagName('f'))) f.textContent = (f.textContent ?? '').replace(/:\$L\$(\d+)/g, (_m, n) => `:$L$${Number(n) - 3}`)
    wb.touch(ck.path)
    const conf = await conferirArquivo(await wb.save(), dados, { ...gerado, abasComCarimbo: gerado.abasComCarimbo.filter((a) => a !== 'DP') })
    const texto = conf.problemas.join('\n')
    expect(texto).toMatch(/"DP" ficou sem o carimbo/)
    expect(texto).toMatch(/soma a ADS só até a linha/)
  }, 120000)
})
