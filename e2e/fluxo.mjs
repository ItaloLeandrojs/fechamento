// Teste de ponta a ponta do site montado (dist/), sem internet, no Edge.
// Faz uma obra inteira com dados reais (pasta e2e/dados, fora do git):
// sobe o inventário, lança estruturas, material, aterramento com fotos, DP,
// técnico, revisa e baixa. Em cada tela roda o axe (acessibilidade) no tema
// claro e no escuro, em 1366 e 390 px (e 1920 px no claro), confere que não há
// rolagem lateral e tira prints para olhar.
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

// Kit de nome comprido para o teste da quantidade "2,5": o de nome mais longo cujo primeiro material
// não aparece em nenhum outro lançamento do teste (assim o aplicado esperado é 2,5 x a quantidade do kit).
const KITS = JSON.parse(fs.readFileSync(path.join(PROJ, 'src', 'data', 'kits.json'), 'utf8'))
const kitDe = (nome) => KITS.find((k) => k.kit === nome)
const codigosUsados = new Set([...kitDe('KP-CE1-P23').itens, ...kitDe('KP-TRAFO 75KVA M').itens].map((i) => i.code))
const itemLivre = (k) => k.itens.find((i) => !codigosUsados.has(i.code) && !/^CINTA POSTE/.test(i.desc))
const kitLongo = [...KITS].sort((a, b) => b.kit.length - a.kit.length).find((k) => itemLivre(k))
const itemLongo = itemLivre(kitLongo)
const esperadoLongo = +(2.5 * itemLongo.qtd).toFixed(3)
const escapaRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const { criarServidor } = await import(pathToFileURL(path.join(PROJ, 'servir.mjs')).href)
const srv = criarServidor({ raiz: path.join(PROJ, 'dist'), porta: PORTA })
await new Promise((ok) => srv.listen(PORTA, '127.0.0.1', ok))
const URL_SITE = `http://localhost:${PORTA}/`

const falhas = []
const placar = { axe: 0, telas: 0 }
const browser = await chromium.launch({ channel: 'msedge' })

async function axe(page, rotulo) {
  // volta ao topo: com a página rolada, o cabeçalho preso cobre parte dos campos e o axe acusa alvo coberto (não é erro da tela)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(350) // espera a entrada suave das telas (opacidade) terminar
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
  placar.axe++
  const larg = page.viewportSize().width
  const sw = await page.evaluate(() => document.documentElement.scrollWidth)
  if (sw > larg + 1) falhas.push(`[${rotulo}] página mais larga que a tela (${sw}px de ${larg}px): rolagem lateral`)
  for (const v of r.violations) falhas.push(`axe [${rotulo}] ${v.id} (${v.impact}): ${v.nodes.length}x, ex.: ${v.nodes[0]?.target?.join(' ')}`)
}

// Soma o "Aplicado" de um código na revisão: linha da ADS (tabela ou cartão do celular) e linhas novas.
function aplicadoNaRevisao(page, code) {
  return page.evaluate((code) => {
    const visivel = (el) => el.getClientRects().length > 0
    const num = (t) => Number(t.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '') || 0)
    let achou = 0
    let soma = 0
    for (const tr of document.querySelectorAll('main tbody tr')) {
      const td = tr.querySelectorAll('td')
      if (visivel(tr) && td[1]?.textContent.trim() === String(code)) {
        achou++
        soma += num(td[4].textContent)
      }
    }
    for (const li of document.querySelectorAll('main ul li')) {
      if (!visivel(li)) continue
      const dd = li.querySelectorAll('dd')
      if (dd.length === 4) {
        if (new RegExp('código\\s*' + code + '(?!\\d)').test(li.textContent)) {
          achou++
          soma += num(dd[1].textContent)
        }
      } else if (li.children.length === 3 && li.children[0].textContent.trim() === String(code)) {
        achou++
        soma += num(li.children[2].textContent)
      }
    }
    return { achou, soma: +soma.toFixed(3) }
  }, code)
}

// Revisão: coluna Devolvido (Dev. no celular) dentro da tela e do painel, e as quantidades do kit comprido com "2,5".
async function conferirRevisao(page, largura, altura, tag) {
  if (largura >= 1024) {
    const th = page.getByRole('columnheader', { name: 'Devolvido' })
    await th.scrollIntoViewIfNeeded()
    const box = await th.boundingBox()
    const painel = await th.evaluate((el) => el.closest('table').parentElement.getBoundingClientRect().right)
    if (!box) falhas.push(`[${tag}] coluna Devolvido da revisão não está visível`)
    else {
      if (box.x < 0 || box.x + box.width > largura + 1 || box.y < 0 || box.y + box.height > altura + 1) falhas.push(`[${tag}] coluna Devolvido fora da tela (x ${Math.round(box.x)} a ${Math.round(box.x + box.width)} de ${largura})`)
      if (box.x + box.width > painel + 1) falhas.push(`[${tag}] coluna Devolvido cortada pelo painel da revisão`)
    }
  } else {
    const dev = page.getByText('Dev.', { exact: true }).first()
    await dev.scrollIntoViewIfNeeded()
    const box = await dev.boundingBox()
    if (!box || box.x < 0 || box.x + box.width > largura + 1) falhas.push(`[${tag}] "Dev." do cartão da revisão fora da tela`)
  }
  // com o filtro desmarcado nenhuma linha fica escondida
  const filtro = page.getByLabel('Só as que ficam diferentes do planejado')
  await filtro.uncheck()
  const r = await aplicadoNaRevisao(page, itemLongo.code)
  if (!r.achou) falhas.push(`[${tag}] revisão: o material ${itemLongo.code} do kit comprido não apareceu`)
  else if (r.soma !== esperadoLongo) falhas.push(`[${tag}] revisão: aplicado do ${itemLongo.code} deveria ser ${esperadoLongo} (2,5 x ${itemLongo.qtd}), veio ${r.soma}`)
  else console.log(`[${tag}] kit ${kitLongo.kit}: material ${itemLongo.code} aplicado ${r.soma} (2,5 x ${itemLongo.qtd}), ${r.achou} linha(s)`)
  await filtro.check()
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
  // kit de nome comprido com quantidade decimal "2,5": a tela não pode quebrar nem perder o valor
  await page.getByPlaceholder(/Ex.: CE3/).fill(kitLongo.kit)
  await page.getByRole('button', { name: new RegExp('^Adicionar ' + escapaRe(kitLongo.kit) + ' na operação') }).click()
  const campoLongo = page.getByRole('textbox', { name: 'Quantidade de ' + kitLongo.kit, exact: true })
  await campoLongo.fill('2,5')
  await campoLongo.press('Tab')
  const qtdLongo = await campoLongo.inputValue()
  if (qtdLongo !== '2,5') falhas.push(`[${tag}] quantidade do kit comprido deveria ficar 2,5, veio ${qtdLongo}`)
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
  // equipamento com o ponto preenchido (sem ele a revisão bloqueia) e as duas fotos escolhidas ao mesmo tempo
  await page.locator('main').getByRole('button', { name: 'Equipamento', exact: true }).click()
  await page.getByLabel('Ponto', { exact: true }).fill('P1-12')
  // campos com valores de teste (inventados), para conferir no Excel que chegam à ficha
  const inst = page.getByRole('group', { name: 'Instalado', exact: true })
  const ret = page.getByRole('group', { name: 'Retirado', exact: true })
  for (const [rotulo, v] of [['Potência (kVA)', '75'], ['Patrimônio', '123456'], ['Fase instalação', 'ABC'], ['Série', 'SER-T1'], ['Marca', 'MARCA TESTE'], ['Fabricação (mês/ano)', '03/2025'], ['Nº da instalação', 'ET 111111'], ['NA', '127'], ['NB', '127'], ['NC', '127'], ['AB', '220'], ['AC', '220'], ['BC', '220']]) await inst.getByLabel(rotulo, { exact: true }).fill(v)
  for (const [rotulo, v] of [['Potência (kVA)', '45'], ['Patrimônio', '654321'], ['Série', 'SER-T0'], ['Marca', 'MARCA VELHA'], ['Fabricação (mês/ano)', '2019'], ['Nº da instalação', 'ET 222222']]) await ret.getByLabel(rotulo, { exact: true }).fill(v)
  const fotosEquip = page.locator('main input[type=file]')
  await Promise.all([fotosEquip.nth(0).setInputFiles(path.join(DADOS, 'equip1.jpeg')), fotosEquip.nth(1).setInputFiles(path.join(DADOS, 'equip1.jpeg'))])
  await page.waitForFunction(() => document.querySelectorAll('main img').length === 2, null, { timeout: 10000 }).catch(() => falhas.push(`[${tag}] as duas fotos do equipamento não ficaram`))
  await page.waitForTimeout(300) // se uma sobrescrevesse a outra, apareceria aqui
  const srcsEquip = await page.evaluate(() => [...document.querySelectorAll('main img')].map((i) => i.src))
  if (srcsEquip.length !== 2 || new Set(srcsEquip).size !== 2) falhas.push(`[${tag}] fotos do equipamento: esperadas 2 diferentes, vieram ${srcsEquip.length} (${new Set(srcsEquip).size} diferentes)`)
  await axe(page, `${tag} equipamento`)
  await foto('04b-equipamento')

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
  await conferirRevisao(page, largura, altura, tag)
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
  gerados.push(await rodada({ largura: 1920, altura: 1080, tema: 'light' }))
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
