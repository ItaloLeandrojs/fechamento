// Teste de ponta a ponta do site montado (dist/), sem internet, no Edge.
// Faz uma obra inteira com dados reais (pasta e2e/dados, fora do git):
// sobe o inventário, lança estruturas, material, aterramento com fotos, DP,
// técnico, revisa e baixa. Em cada tela roda o axe (acessibilidade) no tema
// claro e no escuro, em 1366 e 390 px, e tira prints para olhar.
// Uso: npm run build && node e2e/fluxo.mjs
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const PROJ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DADOS = path.join(PROJ, 'e2e', 'dados')
const SAIDA = path.join(PROJ, 'e2e', 'saida')
const PRINTS = path.join(PROJ, 'e2e', 'prints')
const PORTA = Number(process.env.E2E_PORTA) || 4411
// ferramentas de teste já instaladas em outros projetos (nada entra neste)
const reqPw = createRequire('C:/Users/italo.silva/Desktop/CURSO CLAUDE/AULA 4/site-v2/package.json')
const reqAxe = createRequire('C:/Users/italo.silva/Desktop/LINKEDIN/cosampa-site/package.json')
const { chromium } = reqPw('playwright')
const { AxeBuilder } = reqAxe('@axe-core/playwright')

for (const d of [SAIDA, PRINTS]) fs.mkdirSync(d, { recursive: true })
const { criarServidor } = await import(pathToFileURL(path.join(PROJ, 'servir.mjs')).href)
const srv = criarServidor({ raiz: path.join(PROJ, 'dist'), porta: PORTA })
await new Promise((ok) => srv.listen(PORTA, '127.0.0.1', ok))
const URL_SITE = `http://localhost:${PORTA}/`

const falhas = []
const placar = { axe: 0, telas: 0 }
const browser = await chromium.launch({ channel: 'msedge' })

async function axe(page, rotulo) {
  await page.waitForTimeout(350) // espera a entrada suave das telas (opacidade) terminar
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
  placar.axe++
  for (const v of r.violations) falhas.push(`axe [${rotulo}] ${v.id} (${v.impact}): ${v.nodes.length}x, ex.: ${v.nodes[0]?.target?.join(' ')}`)
}

async function rodada({ largura, altura, tema, movel }) {
  const ctx = await browser.newContext({ viewport: { width: largura, height: altura }, colorScheme: tema, isMobile: !!movel, hasTouch: !!movel, acceptDownloads: true })
  await ctx.route('**/*', (r) => (/^(http:\/\/localhost|data:|blob:)/.test(r.request().url()) ? r.continue() : r.abort()))
  const page = await ctx.newPage()
  const erros = []
  page.on('pageerror', (e) => erros.push(e.message))
  page.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
  page.on('requestfailed', (r) => erros.push(`pedido falhou: ${r.url().slice(0, 120)} (${r.failure()?.errorText})`))
  const tag = `${largura}-${tema}`
  const foto = async (nome) => {
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    if (sw > largura + 1) falhas.push(`[${tag} ${nome}] página mais larga que a tela (${sw}px): rolagem lateral`)
    await page.screenshot({ path: path.join(PRINTS, `${tag}-${nome}.png`), fullPage: true })
    placar.telas++
  }

  await page.goto(URL_SITE)
  await axe(page, `${tag} início`)
  await foto('01-inicio')

  await page.setInputFiles('input[type=file]', path.join(DADOS, 'inv.xlsx'))
  await page.waitForSelector('nav[aria-label=Etapas]', { timeout: 20000 })
  const irPara = async (nome) => {
    await page.getByRole('navigation', { name: 'Etapas' }).getByRole('button', { name: new RegExp('^' + nome) }).click()
    await page.waitForTimeout(150)
  }

  // estruturas
  await page.getByRole('radio', { name: '2020 Poste novo' }).click()
  await page.getByPlaceholder(/Ex.: CE3/).fill('KP-CE1-P23')
  const add = page.getByRole('button', { name: 'Adicionar KP-CE1-P23 na operação 2020' })
  await add.click()
  await add.click()
  await page.getByRole('radio', { name: '2010 Transformador' }).click()
  await page.getByPlaceholder(/Ex.: CE3/).fill('trafo 75')
  await page.getByRole('button', { name: 'Adicionar KP-TRAFO 75KVA M na operação 2010' }).click()
  const qtdCE1 = await page.getByRole('textbox', { name: 'Quantidade de KP-CE1-P23' }).inputValue()
  if (qtdCE1 !== '2') falhas.push(`[${tag}] quantidade do KP-CE1-P23 deveria ser 2, veio ${qtdCE1}`)
  await axe(page, `${tag} estruturas`)
  await foto('02-estruturas')

  // material avulso
  await irPara('Materiais')
  await page.getByPlaceholder(/Ex.: isolador/).fill('cinta poste 200')
  await page.locator('main button[aria-label^="Adicionar CINTA POSTE"]').first().click()
  await axe(page, `${tag} materiais`)
  await foto('03-materiais')

  await irPara('Mão de obra')
  await axe(page, `${tag} mão de obra`)

  // aterramento: as duas fotos ao mesmo tempo (já perdeu foto assim)
  await irPara('Aterramento')
  await page.getByRole('button', { name: /Ponto/ }).first().click()
  await page.getByLabel('Nº do ponto (projeto)').fill('P1-12')
  await page.getByLabel('Rua / avenida / estrada').fill('Rua Divino')
  await page.getByRole('radio', { name: 'Concreto' }).click()
  await page.getByLabel('Medição final (Ω)').fill('19,10')
  await page.getByLabel('Qt. hastes').fill('3')
  const arquivos = page.locator('main input[type=file]')
  await Promise.all([arquivos.nth(0).setInputFiles(path.join(DADOS, 'vala1.jpeg')), arquivos.nth(1).setInputFiles(path.join(DADOS, 'med1.jpeg'))])
  await page.waitForFunction(() => document.querySelectorAll('main img').length === 2, null, { timeout: 10000 }).catch(() => falhas.push(`[${tag}] as duas fotos do ponto não ficaram`))
  await axe(page, `${tag} aterramento`)
  await foto('04-aterramento')

  await irPara('Equipamento')
  await axe(page, `${tag} equipamento vazio`)

  await irPara('Desligamento')
  await page.getByRole('radio', { name: 'Teve desligamento' }).click()
  await page.locator('main input[type=file]').setInputFiles(path.join(DADOS, 'dp.jpeg'))
  await page.waitForSelector('main img')
  await axe(page, `${tag} DP`)

  await irPara('Carimbo')
  const tecnicos = page.getByRole('radiogroup', { name: 'Técnico do carimbo' }).getByRole('radio')
  if (!(await tecnicos.count())) await page.locator('main input[accept^=".json"]').setInputFiles(path.join(DADOS, 'tec.json'))
  await tecnicos.first().click()
  await axe(page, `${tag} carimbo`)
  await foto('05-carimbo')

  await irPara('Revisar e baixar')
  await axe(page, `${tag} revisão`)
  await foto('06-revisao')
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('button', { name: /Gerar e baixar/ }).click()])
  const destino = path.join(SAIDA, `${tag}-${dl.suggestedFilename()}`)
  await dl.saveAs(destino)
  const tam = fs.statSync(destino).size
  if (dl.suggestedFilename() !== '16646602 - ADS.xlsx') falhas.push(`[${tag}] nome do arquivo: ${dl.suggestedFilename()}`)
  if (tam < 1e6) falhas.push(`[${tag}] arquivo pequeno demais: ${tam} bytes`)
  await page.waitForSelector('[role=status]')

  const barrados = []
  // ruído conhecido: o antivírus Kaspersky injeta um script externo, que o teste bloqueia
  const kaspersky = erros.some((e) => e.includes('kaspersky-labs.com'))
  for (const e of erros) {
    if (e.includes('kaspersky-labs.com') || (kaspersky && e === 'Failed to load resource: net::ERR_FAILED')) continue
    falhas.push(`[${tag}] erro no console: ${e}`)
  }
  if (barrados.length) falhas.push(`[${tag}] pedidos para fora: ${barrados.join(', ')}`)
  const larguraPagina = await page.evaluate(() => document.documentElement.scrollWidth)
  if (larguraPagina > largura + 1) falhas.push(`[${tag}] página mais larga que a tela (${larguraPagina}px), rolagem lateral`)
  await ctx.close()
  return destino
}

const gerados = []
try {
  gerados.push(await rodada({ largura: 1366, altura: 768, tema: 'light' }))
  gerados.push(await rodada({ largura: 1366, altura: 768, tema: 'dark' }))
  gerados.push(await rodada({ largura: 390, altura: 844, tema: 'light', movel: true }))
  gerados.push(await rodada({ largura: 390, altura: 844, tema: 'dark', movel: true }))
} catch (e) {
  falhas.push('FALHOU NO MEIO: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | '))
} finally {
  await browser.close()
  srv.close()
}

console.log(`axe: ${placar.axe} telas analisadas | prints: ${placar.telas} | arquivos gerados: ${gerados.length}`)
console.log(gerados.join('\n'))
if (falhas.length) {
  console.log(`\n${falhas.length} falha(s):\n- ` + [...new Set(falhas)].join('\n- '))
  process.exit(1)
}
console.log('Tudo passou.')
