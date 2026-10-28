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
const JSZip = createRequire(path.join(PROJ, 'package.json'))('jszip')

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

async function axe(page, rotulo, { topo = true } = {}) {
  // por padrão volta ao topo (análise estável); topo:false analisa a página como está, rolada (cabeçalho e barra de baixo sobre o conteúdo)
  if (topo) await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(350) // espera a entrada suave das telas (opacidade) terminar
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
  placar.axe++
  const larg = page.viewportSize().width
  const sw = await page.evaluate(() => document.documentElement.scrollWidth)
  if (sw > larg + 1) falhas.push(`[${rotulo}] página mais larga que a tela (${sw}px de ${larg}px): rolagem lateral`)
  for (const v of r.violations) falhas.push(`axe [${rotulo}] ${v.id} (${v.impact}): ${v.nodes.length}x, ex.: ${v.nodes[0]?.target?.join(' ')}`)
}

// Topo da barra fixa de baixo (celular e tela pequena na revisão), ou null.
const topoDaBarra = (page) =>
  page.evaluate(() => {
    const b = [...document.querySelectorAll('div')].find((d) => getComputedStyle(d).position === 'fixed')
    return b ? b.getBoundingClientRect().top : null
  })

// Foco não pode ficar escondido (WCAG 2.4.11): rola a página até o elemento ficar sob o cabeçalho preso (24 px do topo),
// foca e confere que o navegador o trouxe para baixo do cabeçalho e para cima da barra fixa de baixo.
async function focoLivre(page, loc, nome, tag) {
  const topoAntes = await loc.evaluate((e) => {
    window.scrollBy(0, e.getBoundingClientRect().top - 24)
    return e.getBoundingClientRect().top
  })
  if (topoAntes > 40) return falhas.push(`[${tag}] foco "${nome}": página curta demais para testar o cabeçalho (topo em ${Math.round(topoAntes)}px)`)
  await loc.evaluate((e) => e.blur()) // focar um campo que já tem o foco não rola nada
  await loc.focus()
  await page.waitForTimeout(250)
  const cab = await page.evaluate(() => document.querySelector('header').getBoundingClientRect().bottom)
  const box = await loc.boundingBox()
  if (!box) return falhas.push(`[${tag}] foco "${nome}": elemento sumiu`)
  if (box.y < cab - 0.5) falhas.push(`[${tag}] foco "${nome}" fica sob o cabeçalho (topo ${Math.round(box.y)}px, cabeçalho até ${Math.round(cab)}px)`)
  const barra = await topoDaBarra(page)
  if (barra !== null && box.y + box.height > barra + 0.5) falhas.push(`[${tag}] foco "${nome}" fica sob a barra de baixo (base ${Math.round(box.y + box.height)}px, barra em ${Math.round(barra)}px)`)
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
    else {
      // o rótulo e o valor logo abaixo precisam ficar acima da barra fixa de baixo e abaixo do cabeçalho
      const valor = await dev.evaluate((e) => {
        const r = e.nextElementSibling.getBoundingClientRect()
        return { y: r.y, bottom: r.bottom }
      })
      const barra = await topoDaBarra(page)
      const cab = await page.evaluate(() => document.querySelector('header').getBoundingClientRect().bottom)
      if (box.y < cab - 0.5) falhas.push(`[${tag}] "Dev." do cartão fica sob o cabeçalho`)
      if (barra === null) falhas.push(`[${tag}] barra fixa de baixo da revisão não encontrada no celular`)
      else if (Math.max(box.y + box.height, valor.bottom) > barra + 0.5) falhas.push(`[${tag}] "Dev." e o valor ficam sob a barra de baixo (base ${Math.round(Math.max(box.y + box.height, valor.bottom))}px, barra em ${Math.round(barra)}px)`)
    }
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

  // o inventário de teste já vem com Aplicado preenchido: o aviso de "já fechado" tem que aparecer
  if (!(await page.getByRole('note').filter({ hasText: 'já vem com Aplicado preenchido' }).count())) falhas.push(`[${tag}] faltou o aviso de inventário já fechado`)
  // parcial ou final: obrigatório; sem escolher, a revisão acusa a pendência
  const boletim = tema === 'light' ? 'Parcial' : 'Final'
  const pergunta = page.getByRole('region', { name: 'Este fechamento é parcial ou final?' })
  if (!(await pergunta.count())) falhas.push(`[${tag}] a pergunta Parcial ou Final não apareceu ao abrir o inventário`)
  await axe(page, `${tag} pergunta do boletim`)
  await foto('01b-boletim')
  await pergunta.getByRole('radio', { name: new RegExp('^' + boletim) }).click()
  if (await pergunta.count()) falhas.push(`[${tag}] a pergunta do boletim não sumiu depois de escolher`)
  const seletor = page.getByRole('radiogroup', { name: 'Boletim' }).filter({ visible: true })
  if ((await seletor.getByRole('radio', { name: boletim, checked: true }).count()) !== 1) falhas.push(`[${tag}] o seletor do boletim não mostra ${boletim}`)

  // estruturas
  await page.getByRole('radio', { name: /^2020 / }).click()
  await page.getByPlaceholder(/Ex.: CE3/).fill('KP-CE1-P23')
  const add = page.getByRole('button', { name: 'Adicionar KP-CE1-P23 na operação 2020' })
  await add.click()
  await add.click()
  await page.getByRole('radio', { name: /^2010 / }).click()
  await page.getByPlaceholder(/Ex.: CE3/).fill('trafo 75')
  await page.getByRole('button', { name: 'Adicionar KP-TRAFO 75KVA M na operação 2010' }).click()
  const qtdCE1 = await page.getByRole('textbox', { name: 'Quantidade de KP-CE1-P23' }).inputValue()
  if (qtdCE1 !== '2') falhas.push(`[${tag}] quantidade do KP-CE1-P23 deveria ser 2, veio ${qtdCE1}`)
  // ajuste dos materiais da estrutura: tirar um material da soma e mudar a quantidade de outro
  const lancadas = page.locator('#lancadas').locator('xpath=..')
  await lancadas.getByRole('button', { name: /^Ajustar materiais de / }).first().click()
  const caixasMat = lancadas.getByRole('checkbox')
  if ((await caixasMat.count()) < 2) falhas.push(`[${tag}] ajuste: a CE1 deveria mostrar os materiais com caixa de marcar`)
  await caixasMat.nth(0).uncheck()
  const qtdMat = lancadas.getByRole('textbox', { name: /por estrutura$/ }).first()
  await qtdMat.fill('5')
  await qtdMat.press('Tab')
  for (const selo of ['1 tirado', '1 alterado']) {
    if (!(await lancadas.getByText(selo, { exact: true }).count())) falhas.push(`[${tag}] ajuste: falta o aviso "${selo}"`)
  }
  await axe(page, `${tag} ajuste de materiais`, { topo: false })
  await lancadas.getByRole('button', { name: /^Ajustar materiais de / }).first().scrollIntoViewIfNeeded()
  await foto('02b-ajuste-materiais')
  await lancadas.getByRole('button', { name: /^Ajustar materiais de / }).first().click()
  // foco com a página rolada: busca e "Limpar busca" ficam sob o cabeçalho preso e o foco tem que trazê-los para baixo dele
  await page.getByPlaceholder(/Ex.: CE3/).fill('kp') // lista longa (60 kits)
  await focoLivre(page, page.getByPlaceholder(/Ex.: CE3/), 'Buscar estrutura', tag)
  await focoLivre(page, page.getByRole('button', { name: 'Limpar busca' }), 'Limpar busca', tag)
  await page.evaluate(() => window.scrollTo(0, 0))
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
  // serviço com unidade PEÇ (código 7…): tem que aparecer na mão de obra
  await page.getByPlaceholder(/Ex.: estr prim/).fill('banheiro quimico')
  const banheiro = page.locator('main button[aria-label^="Adicionar I - 100-BANHEIRO QUIMICO"]').first()
  if (!(await banheiro.count())) falhas.push(`[${tag}] o banheiro químico (71003305, PEÇ) não aparece na mão de obra`)
  else await banheiro.click()
  await axe(page, `${tag} mão de obra`)
  await foto('03b-mao-de-obra')

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
  // dois arquivos diferentes, escolhidos ao mesmo tempo
  await Promise.all([fotosEquip.nth(0).setInputFiles(path.join(DADOS, 'equip1.jpeg')), fotosEquip.nth(1).setInputFiles(path.join(DADOS, 'vala1.jpeg'))])
  await page.waitForFunction(() => document.querySelectorAll('main img').length === 2, null, { timeout: 10000 }).catch(() => falhas.push(`[${tag}] as duas fotos do equipamento não ficaram`))
  await page.waitForTimeout(300) // se uma sobrescrevesse a outra, apareceria aqui
  const srcsEquip = await page.evaluate(() => [...document.querySelectorAll('main img')].map((i) => i.src))
  if (srcsEquip.length !== 2 || new Set(srcsEquip).size !== 2) falhas.push(`[${tag}] fotos do equipamento: esperadas 2 diferentes, vieram ${srcsEquip.length} (${new Set(srcsEquip).size} diferentes)`)
  // cada foto no seu quadro: uma imagem em "Foto 1" e outra em "Foto 2", lado a lado (em coluna no celular)
  const caixas = []
  for (const q of ['Foto 1', 'Foto 2']) {
    const img = page.locator('main img[alt="' + q + '"]')
    if ((await img.count()) !== 1) falhas.push(`[${tag}] equipamento: o quadro "${q}" deveria ter 1 foto, tem ${await img.count()}`)
    else caixas.push(await img.boundingBox())
  }
  if (caixas.length === 2 && Math.abs(caixas[0].x - caixas[1].x) < 10 && Math.abs(caixas[0].y - caixas[1].y) < 10) falhas.push(`[${tag}] equipamento: as duas fotos estão no mesmo lugar`)
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
  // uma análise do axe com a página rolada (cabeçalho preso e, no celular, a barra fixa de baixo sobre o conteúdo)
  await page.evaluate(() => window.scrollTo(0, 1500))
  await axe(page, `${tag} revisão rolada`, { topo: false })
  await focoLivre(page, page.getByLabel('Só as que ficam diferentes do planejado'), 'filtro da revisão', tag)
  await conferirRevisao(page, largura, altura, tag)
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('button', { name: /Gerar e baixar/ }).click()])
  const destino = path.join(SAIDA, `${tag}-${dl.suggestedFilename()}`)
  await dl.saveAs(destino)
  const tam = fs.statSync(destino).size
  if (!/^\d+ - ADS\.xlsx$/.test(dl.suggestedFilename())) falhas.push(`[${tag}] nome do arquivo: ${dl.suggestedFilename()}`)
  if (tam < 1e6) falhas.push(`[${tag}] arquivo pequeno demais: ${tam} bytes`)
  // caixas FINAL/PARCIAL da Check-list: com X em PARCIAL no parcial, nada no final
  const zip = await JSZip.loadAsync(fs.readFileSync(destino))
  const check = await zip.file('xl/worksheets/sheet1.xml').async('string')
  const temTexto = (ref) => new RegExp(`<c r="${ref}"[^>]*(?:t="(?:s|inlineStr|str)")[^>]*>`).test(check)
  const marcado = ['W7', 'X5', 'X7'].map(temTexto)
  if (boletim === 'Parcial' && marcado.some((m) => !m)) falhas.push(`[${tag}] parcial: faltou X ou rótulo em W7/X5/X7 (${marcado})`)
  if (boletim === 'Final' && marcado.some(Boolean)) falhas.push(`[${tag}] final: as caixas FINAL/PARCIAL deviam sumir (${marcado})`)
  await page.waitForSelector('[role=status]')
  const status = await page.locator('[role=status]').innerText()
  if (!/Conferência do arquivo: \d+ itens, tudo certo/.test(status)) falhas.push(`[${tag}] a conferência automática não aprovou o arquivo: ${status}`)
  await foto('07-baixado')

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

// inventário de modelo diferente (gerado à parte, fora do git): o aviso aparece ao abrir, e dá para continuar
async function modeloDiferente() {
  const arq = path.join(DADOS, 'inv-diferente.xlsx')
  if (!fs.existsSync(arq)) return
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, colorScheme: 'light' })
  await ctx.route('**/*', (r) => (/^(http:\/\/localhost|data:|blob:)/.test(r.request().url()) ? r.continue() : r.abort()))
  const page = await ctx.newPage()
  await page.goto(URL_SITE)
  await page.setInputFiles('input[type=file]', arq)
  await page.waitForSelector('nav[aria-label=Etapas]', { timeout: 20000 })
  const aviso = page.getByRole('region', { name: 'Este inventário é de um modelo diferente dos já testados' })
  if (!(await aviso.count())) falhas.push('[modelo diferente] o aviso não apareceu')
  else {
    const t = await aviso.innerText()
    for (const esperado of ['coluna M devia ser "Valor Serviço"', 'não tem o rodapé']) if (!t.includes(esperado)) falhas.push(`[modelo diferente] o aviso não fala de: ${esperado}`)
  }
  await axe(page, 'modelo diferente')
  await page.screenshot({ path: path.join(PRINTS, '1366-light-08-modelo-diferente.png') })
  placar.telas++
  await ctx.close()
}

const gerados = []
try {
  await modeloDiferente()
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
