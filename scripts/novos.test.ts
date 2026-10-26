// Caixa de entrada de inventários: confere cada .xlsx de ../inventarios-teste/novos.
// Roda com `npm run novos` (fora disso, pula). Para cada arquivo: raio-x (diagnóstico),
// fechamento completo com dados de teste e conferência automática. Os arquivos gerados
// ficam em novos/gerados (para abrir no Excel com scripts/conferir-no-excel.ps1) e o
// relatório em novos/relatorio.txt. Nada disso vai para o git.
import { it } from 'vitest'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { setXmlImpl } from '../src/core/xml'
import { lerInventario } from '../src/core/inventario'
import { gerarFechamento, type DadosFechamento } from '../src/core/build'
import { conferirArquivo } from '../src/core/conferencia'

setXmlImpl(DOMParser as never, XMLSerializer as never)

const PASTA = '../inventarios-teste/novos/'
const foto = (f: string) => ({ data: new Uint8Array(readFileSync('e2e/dados/' + f)), width: 1200, height: 1600, ext: 'jpeg' as const })

it.skipIf(!process.env.NOVOS)('confere os inventários novos', async () => {
  const arquivos = existsSync(PASTA) ? readdirSync(PASTA).filter((f) => f.toLowerCase().endsWith('.xlsx')) : []
  mkdirSync(PASTA + 'gerados', { recursive: true })
  const tec = JSON.parse(readFileSync('e2e/dados/tec.json', 'utf8')).tecnicos[0]
  const relatorio: string[] = [`Conferência de ${arquivos.length} inventário(s) novos, ${new Date().toLocaleString('pt-BR')}`, '']
  for (const nome of arquivos) {
    const linhas = [`### ${nome}`]
    try {
      const original = new Uint8Array(readFileSync(PASTA + nome))
      const resumo = await lerInventario(original)
      linhas.push(`nota ${resumo.nota} · ${resumo.tipoObra} · modelo da ADS: ${resumo.diagnostico.modelo}`)
      linhas.push(resumo.diagnostico.diferencas.length ? 'DIFERENTE dos já testados:\n- ' + resumo.diagnostico.diferencas.join('\n- ') : 'Modelo conhecido.')
      if (resumo.avisoJaFechado) linhas.push('Aviso: ' + resumo.avisoJaFechado)
      const previsto = resumo.ads.find((r) => r.code !== null)!
      const dados: DadosFechamento = {
        lancamentos: [
          { code: previsto.code!, oper: previsto.oper || '2000', qty: previsto.planejado || 1 },
          { code: 30053440, oper: '2000', qty: 3 },
          { code: 30057582, oper: '2000', qty: 0.33 },
          { code: 71000919, oper: '2000', qty: 1 },
        ],
        tecnico: { nome: 'TESTE DO SITE', registro: 1234, carimbo: { data: Uint8Array.from(Buffer.from(tec.carimbo.png, 'base64')), width: tec.carimbo.width, height: tec.carimbo.height, ext: 'png' } },
        aterramento: [{ rua: 'RUA TESTE', ponto: 'P1', tipoPoste: 'CONC', ohms: 10, hastes: 3, fotoVala: foto('vala1.jpeg'), fotoMedicao: foto('med1.jpeg') }],
        equipamentos: [{ ponto: 'P1', instalado: { potencia: '75', patrimonio: '1', fase: 'ABC', serie: 'S1', marca: 'M', ano: '2025', nInstalacao: 'ET 1' }, retirado: { potencia: '', patrimonio: '', serie: '', marca: '', ano: '', nInstalacao: '' }, fotos: [foto('equip1.jpeg')] }],
        fotoDP: foto('dp.jpeg'),
        boletim: 'parcial',
        hoje: new Date(),
      }
      let res
      try {
        res = await gerarFechamento(original, dados)
      } catch (e) {
        linhas.push('Fechamento completo PAROU: ' + (e as Error).message)
        dados.aterramento = []
        dados.equipamentos = []
        res = await gerarFechamento(original, dados)
        linhas.push('(gerado de novo sem aterramento e equipamento)')
      }
      const conf = await conferirArquivo(res.arquivo, dados, res)
      linhas.push(conf.problemas.length ? `Conferência automática: ${conf.problemas.length} problema(s):\n- ` + conf.problemas.join('\n- ') : `Conferência automática: ${conf.conferidos} itens, tudo certo.`)
      writeFileSync(`${PASTA}gerados/${nome.replace(/\.xlsx$/i, '')} - gerado.xlsx`, res.arquivo)
    } catch (e) {
      linhas.push('ERRO ao abrir ou gerar: ' + (e as Error).message)
    }
    relatorio.push(linhas.join('\n'), '')
    console.log(linhas.join('\n') + '\n')
  }
  writeFileSync(PASTA + 'relatorio.txt', relatorio.join('\n'))
}, 1800000)
