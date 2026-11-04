// Teste de ponta a ponta do site montado (dist/), sem internet, no Edge.
// Faz uma obra inteira com dados reais (pasta e2e/dados, fora do git):
// sobe o inventário, lança estruturas, material, aterramento com fotos, DP,
// técnico, revisa e baixa. Em cada tela roda o axe (acessibilidade) no tema
// escuro (o único do site), em 1366 e 390 px (e 1920 px), confere que não há
// rolagem lateral e tira prints para olhar.
// Uso: npm run build && node e2e/fluxo.mjs
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

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

// Entrada da plataforma: preenche o crachá com dados fictícios, entra e abre a EDP no painel
async function entrar(page) {
  await page.getByLabel('Nome', { exact: true }).fill('Maria Souza')
  await page.getByLabel('Cargo', { exact: true }).fill('Técnica de campo')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.getByRole('heading', { level: 1, name: /Maria\./ }).waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: 'EDP', exact: true }).click()
  await page.getByText('Arraste o inventário aqui').waitFor({ timeout: 10000 })
}

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

async function rodada({ largura, altura, tema, boletim, movel }) {
  const ctx = await browser.newContext({ viewport: { width: largura, height: altura }, colorScheme: tema, isMobile: !!movel, hasTouch: !!movel, acceptDownloads: true })
  await ctx.route('**/*', (r) => (/^(http:\/\/localhost|data:|blob:)/.test(r.request().url()) ? r.continue() : r.abort()))
  const page = await ctx.newPage()
  const erros = []
  page.on('pageerror', (e) => erros.push(e.message))
  page.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
  page.on('requestfailed', (r) => erros.push(`pedido falhou: ${r.url().slice(0, 120)} (${r.failure()?.errorText})`))
  const tag = `${largura}-${tema}-${boletim.toLowerCase()}`
  const foto = async (nome) => {
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    if (sw > largura + 1) falhas.push(`[${tag} ${nome}] página mais larga que a tela (${sw}px): rolagem lateral`)
    await page.screenshot({ path: path.join(PRINTS, `${tag}-${nome}.png`), fullPage: true })
    placar.telas++
  }

  await page.goto(URL_SITE)
  await entrar(page)
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
  const pergunta = page.getByRole('region', { name: 'Este fechamento é parcial ou final?' })
  if (!(await pergunta.count())) falhas.push(`[${tag}] a pergunta Parcial ou Final não apareceu ao abrir o inventário`)
  await axe(page, `${tag} pergunta do boletim`)
  await foto('01b-boletim')
  await pergunta.getByRole('radio', { name: new RegExp('^' + boletim) }).click()
  if (await pergunta.count()) falhas.push(`[${tag}] a pergunta do boletim não sumiu depois de escolher`)
  const seletor = page.getByRole('radiogroup', { name: 'Boletim' }).filter({ visible: true })
  if ((await seletor.getByRole('radio', { name: boletim, checked: true }).count()) !== 1) falhas.push(`[${tag}] o seletor do boletim não mostra ${boletim}`)

  // estruturas
  // estrutura é só instalação: nenhuma operação de sucata (ODD) na lista
  if (await page.getByRole('radiogroup', { name: 'Operação' }).getByRole('radio', { name: /sucata/ }).count()) falhas.push(`[${tag}] estruturas mostra operação de sucata`)
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
  // materiais mostram também as operações de sucata da obra (2030 e 2040 neste inventário)
  if ((await page.getByRole('radiogroup', { name: 'Operação' }).getByRole('radio', { name: /sucata/ }).count()) !== 2) falhas.push(`[${tag}] materiais devia mostrar as 2 operações de sucata`)
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
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, colorScheme: 'dark' })
  await ctx.route('**/*', (r) => (/^(http:\/\/localhost|data:|blob:)/.test(r.request().url()) ? r.continue() : r.abort()))
  const page = await ctx.newPage()
  await page.goto(URL_SITE)
  await entrar(page)
  await page.setInputFiles('input[type=file]', arq)
  await page.waitForSelector('nav[aria-label=Etapas]', { timeout: 20000 })
  const aviso = page.getByRole('region', { name: 'Este inventário é de um modelo diferente dos já testados' })
  if (!(await aviso.count())) falhas.push('[modelo diferente] o aviso não apareceu')
  else {
    const t = await aviso.innerText()
    for (const esperado of ['coluna M devia ser "Valor Serviço"', 'não tem o rodapé']) if (!t.includes(esperado)) falhas.push(`[modelo diferente] o aviso não fala de: ${esperado}`)
  }
  await axe(page, 'modelo diferente')
  await page.screenshot({ path: path.join(PRINTS, '1366-dark-08-modelo-diferente.png') })
  placar.telas++
  await ctx.close()
}

// inventário com operações 2000 a 2070 (fora do git): prints das listas de operação
async function operacoesDaObra() {
  const arq = path.join(DADOS, 'inv-sucata.xlsx')
  if (!fs.existsSync(arq)) return
  for (const [largura, altura, movel] of [[1366, 768, false], [390, 844, true]]) {
    const ctx = await browser.newContext({ viewport: { width: largura, height: altura }, colorScheme: 'dark', isMobile: movel, hasTouch: movel })
    await ctx.route('**/*', (r) => (/^(http:\/\/localhost|data:|blob:)/.test(r.request().url()) ? r.continue() : r.abort()))
    const page = await ctx.newPage()
    await page.goto(URL_SITE)
    await entrar(page)
    await page.setInputFiles('input[type=file]', arq)
    await page.waitForSelector('nav[aria-label=Etapas]', { timeout: 20000 })
    await page.getByRole('radio', { name: /^Parcial/ }).first().click()
    const grupo = page.getByRole('radiogroup', { name: 'Operação' })
    const nEstr = await grupo.getByRole('radio').count()
    if (nEstr !== 3) falhas.push(`[operações ${largura}] estruturas devia ter 3 operações (2000 a 2020), tem ${nEstr}`)
    await axe(page, `operações ${largura} estruturas`)
    await page.screenshot({ path: path.join(PRINTS, `${largura}-dark-09-operacoes-estruturas.png`) })
    await page.getByRole('navigation', { name: 'Etapas' }).getByRole('button', { name: /^Materiais/ }).click()
    const nMat = await page.getByRole('radiogroup', { name: 'Operação' }).getByRole('radio').count()
    if (nMat !== 8) falhas.push(`[operações ${largura}] materiais devia ter as 8 operações, tem ${nMat}`)
    // busca: na instalação, nada de sucata (9…); na sucata, os 9… vêm primeiro
    const codigosDaBusca = async () => (await page.locator('main ul li p.text-sm').allInnerTexts()).map((t) => t.trim().slice(0, 8)).filter((t) => /^\d{8}$/.test(t))
    await page.getByRole('radio', { name: /^2010 / }).click()
    await page.getByPlaceholder(/Ex.: isolador/).fill('cinta poste')
    const naInstalacao = await codigosDaBusca()
    if (!naInstalacao.length) falhas.push(`[operações ${largura}] a busca na instalação não trouxe nada (a conferência não valeria)`)
    if (naInstalacao.some((c) => c.startsWith('9'))) falhas.push(`[operações ${largura}] instalação mostrou sucata na busca`)
    await page.getByRole('radio', { name: /^2070 / }).click()
    const naSucata = await codigosDaBusca()
    if (!naSucata.length || !naSucata[0].startsWith('9')) falhas.push(`[operações ${largura}] na sucata os códigos 9… deviam vir primeiro (veio ${naSucata[0]})`)
    // material novo numa operação de sucata: entra, mas com aviso
    const cod3 = (await codigosDaBusca()).find((c) => c.startsWith('3'))
    if (!cod3) falhas.push(`[operações ${largura}] a busca na sucata não trouxe material novo (3…) para testar o aviso`)
    else {
      await page.getByPlaceholder(/Ex.: isolador/).fill(cod3)
      await page.locator('main button[aria-label^="Adicionar"]').first().click()
      if (!(await page.getByText('Material novo numa operação de sucata: confira').count())) falhas.push(`[operações ${largura}] faltou o aviso de material novo na sucata`)
    }
    await axe(page, `operações ${largura} materiais`)
    await page.screenshot({ path: path.join(PRINTS, `${largura}-dark-10-operacoes-materiais.png`) })
    placar.telas += 2
    await ctx.close()
  }
}

// inventário só de desativação (só ordem 19, fora do git): Estruturas avisa e não deixa adicionar
async function soDesativacao() {
  const arq = path.join(DADOS, 'inv-desativacao.xlsx')
  if (!fs.existsSync(arq)) return
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, colorScheme: 'dark' })
  await ctx.route('**/*', (r) => (/^(http:\/\/localhost|data:|blob:)/.test(r.request().url()) ? r.continue() : r.abort()))
  const page = await ctx.newPage()
  await page.goto(URL_SITE)
  await entrar(page)
  await page.setInputFiles('input[type=file]', arq)
  await page.waitForSelector('nav[aria-label=Etapas]', { timeout: 20000 })
  await page.getByRole('radio', { name: /^Parcial/ }).first().click()
  if (!(await page.getByRole('note').filter({ hasText: 'só de desativação' }).count())) falhas.push('[só desativação] faltou o aviso em Estruturas')
  const botoes = page.locator('main button[aria-label^="Adicionar"]')
  if ((await botoes.count()) && (await botoes.first().isEnabled())) falhas.push('[só desativação] o Adicionar devia estar desligado')
  await axe(page, 'só desativação')
  await page.screenshot({ path: path.join(PRINTS, '1366-dark-11-so-desativacao.png') })
  placar.telas++
  await ctx.close()
}

// Fechamento Ceará (em teste): DXF + orçamento feito à mão (fora do git)
async function ceara() {
  const dxf = path.join(DADOS, 'ceara.dxf') // obra com MT e trafo (cópia de ceara-teste/mt-trafo)
  const orc = path.join(DADOS, 'ceara-orcamento.xlsx')
  if (!fs.existsSync(dxf)) return
  for (const [largura, altura, movel, tema] of [[1366, 768, false, 'dark'], [390, 844, true, 'dark']]) {
    const tag = `ceara ${largura}-${tema}`
    const ctx = await browser.newContext({ viewport: { width: largura, height: altura }, colorScheme: tema, isMobile: movel, hasTouch: movel })
    await ctx.route('**/*', (r) => (/^(http:\/\/localhost|data:|blob:)/.test(r.request().url()) ? r.continue() : r.abort()))
    const page = await ctx.newPage()
    const erros = []
    page.on('pageerror', (e) => erros.push(e.message))
    await page.goto(URL_SITE + '#ceara-teste')
    await axe(page, `${tag} início`)
    const t0 = Date.now()
    await page.locator('input[accept=".dxf"]').setInputFiles(dxf)
    await page.getByText('Etiquetas de poste lidas').waitFor({ timeout: 60000 })
    const segundos = ((Date.now() - t0) / 1000).toFixed(1)
    if (fs.existsSync(orc)) await page.locator('input[accept=".xlsx"]').setInputFiles(orc)
    await page.getByText('Linhas iguais ao orçamento').waitFor({ timeout: 20000 })
    const iguais = await page.getByText('Linhas iguais ao orçamento').locator('..').locator('dd').innerText()
    console.log(`[${tag}] DXF lido em ${segundos} s; linhas iguais ao orçamento: ${iguais}`)
    await axe(page, `${tag} resultado`)
    await page.screenshot({ path: path.join(PRINTS, `${largura}-${tema}-12-ceara.png`), fullPage: true })
    placar.telas++
    for (const e of erros) falhas.push(`[${tag}] erro: ${e}`)
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    if (sw > largura + 1) falhas.push(`[${tag}] página mais larga que a tela (${sw}px)`)
    await ctx.close()
  }
}

// PNG gerado aqui mesmo (duas faixas de cor, sem foto de ninguém), para o teste de foto da entrada:
// as colunas antes de `corte` ficam com a cor `a`, as outras com a cor `b`
function pngDuasCores(largura, altura, corte, a, b) {
  const bloco = (tipo, dados) => {
    const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados])
    const tam = Buffer.alloc(4)
    tam.writeUInt32BE(dados.length)
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(zlib.crc32(corpo) >>> 0)
    return Buffer.concat([tam, corpo, crc])
  }
  const cab = Buffer.alloc(13)
  cab.writeUInt32BE(largura, 0)
  cab.writeUInt32BE(altura, 4)
  cab[8] = 8 // 8 bits por canal
  cab[9] = 2 // RGB
  const linha = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: largura }, (_, x) => (x < corte ? a : b)).flat())])
  const cru = Buffer.concat(Array.from({ length: altura }, () => linha))
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), bloco('IHDR', cab), bloco('IDAT', zlib.deflateSync(cru)), bloco('IEND', Buffer.alloc(0))])
}

// Plataforma: entrada (crachá), painel, avisos "em construção", recarregar, trocar pessoa, crachá parado/3D
// e a volta às regiões com lançamento (confirmação). Dados fictícios; arquivos de foto gerados em e2e/saida.
async function plataforma() {
  const fotoOk = path.join(SAIDA, 'plataforma-foto.png')
  const fotoRuim = path.join(SAIDA, 'plataforma-nao-e-foto.txt')
  // 240 x 120: as 96 colunas da esquerda em magenta (cor que não existe na arte do crachá), o resto em ciano.
  // O ajuste começa no meio (ciano no centro do círculo); arrastando para a direita e com zoom 2, o recorte fica todo magenta.
  fs.writeFileSync(fotoOk, pngDuasCores(240, 120, 96, [255, 0, 255], [0, 255, 255]))
  fs.writeFileSync(fotoRuim, 'isto é um texto, não uma imagem\n')
  const NOME = 'Maria Souza'
  const CARGO = 'Técnica de campo'
  const CONFIRMA = 'Voltar às regiões? O que foi lançado nesta obra será perdido.'

  for (const [largura, altura, movel] of [[1366, 768, false], [390, 844, true]]) {
    const tag = `plataforma ${largura}`
    const arq = (n) => path.join(PRINTS, `plataforma-${largura}-${n}.png`)
    const ctx = await browser.newContext({ viewport: { width: largura, height: altura }, colorScheme: 'dark', isMobile: movel, hasTouch: movel })
    await ctx.route('**/*', (r) => (/^(http:\/\/localhost|data:|blob:)/.test(r.request().url()) ? r.continue() : r.abort()))
    const page = await ctx.newPage()
    const erros = []
    const pedidos = []
    page.on('pageerror', (e) => erros.push(e.message))
    page.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
    page.on('requestfailed', (r) => erros.push(`pedido falhou: ${r.url().slice(0, 120)} (${r.failure()?.errorText})`))
    page.on('request', (r) => pedidos.push(r.url()))
    const tira = async (n) => {
      await page.screenshot({ path: arq(n), fullPage: true })
      placar.telas++
    }
    const pessoaGuardada = () => page.evaluate(() => localStorage.getItem('fechamento-pessoa'))
    const saudacao = page.getByRole('heading', { level: 1, name: /Maria\./ })
    const noPainel = async (rotulo) => {
      try {
        await saudacao.waitFor({ timeout: 10000 })
      } catch {
        falhas.push(`[${tag}] ${rotulo}: não apareceu o painel com a saudação`)
      }
    }

    // ---- entrada
    await page.goto(URL_SITE)
    const entrada = page.getByRole('heading', { level: 1, name: /Fecha.?mento/ })
    await entrada.waitFor({ timeout: 10000 })
    for (const rotulo of ['Nome', 'Cargo', 'Matrícula (opcional)', 'Foto (opcional)']) {
      if (!(await page.getByLabel(rotulo, { exact: rotulo === 'Nome' || rotulo === 'Cargo' }).count())) falhas.push(`[${tag}] entrada: falta o campo "${rotulo}"`)
    }
    if (!(await page.getByRole('button', { name: 'Entrar' }).count())) falhas.push(`[${tag}] entrada: falta o botão Entrar`)
    if (!(await page.getByText('Seus dados ficam guardados só neste navegador.', { exact: true }).count())) falhas.push(`[${tag}] entrada: falta a nota "Seus dados ficam guardados só neste navegador."`)
    await axe(page, `${tag} entrada`)
    await tira('01-entrada')

    // nome vazio não entra (e só espaços também não); o erro aparece e o foco vai para o campo
    const botaoEntrar = page.getByRole('button', { name: 'Entrar' })
    await botaoEntrar.click()
    if (!(await page.getByText('Preencha o nome.', { exact: true }).count())) falhas.push(`[${tag}] nome vazio: faltou "Preencha o nome."`)
    if ((await page.evaluate(() => document.activeElement?.getAttribute('name'))) !== 'nome') falhas.push(`[${tag}] nome vazio: o foco devia ir para o campo Nome`)
    await axe(page, `${tag} erro de nome`)
    await tira('02-erro-nome')
    await page.getByLabel('Nome', { exact: true }).fill('   ')
    await botaoEntrar.click()
    if (!(await page.getByText('Preencha o nome.', { exact: true }).count())) falhas.push(`[${tag}] nome só com espaços: faltou "Preencha o nome."`)
    await page.getByLabel('Nome', { exact: true }).fill(NOME)
    if (await page.getByText('Preencha o nome.', { exact: true }).count()) falhas.push(`[${tag}] o erro do nome devia sumir ao digitar`)
    await botaoEntrar.click()
    if (!(await page.getByText('Preencha o cargo.', { exact: true }).count())) falhas.push(`[${tag}] cargo vazio: faltou "Preencha o cargo."`)
    if ((await page.evaluate(() => document.activeElement?.getAttribute('name'))) !== 'cargo') falhas.push(`[${tag}] cargo vazio: o foco devia ir para o campo Cargo`)
    if (await saudacao.count()) falhas.push(`[${tag}] entrou sem o cargo`)
    if ((await pessoaGuardada()) !== null) falhas.push(`[${tag}] guardou a pessoa sem passar na validação`)
    await axe(page, `${tag} erro de cargo`)
    await tira('03-erro-cargo')

    // foto inválida (um .txt): a mensagem aparece e nenhuma foto fica escolhida
    const arquivoFoto = page.locator('input[type=file]')
    await arquivoFoto.setInputFiles(fotoRuim)
    const msgFoto = page.getByText('Não consegui abrir essa foto. Use JPG ou PNG.', { exact: true })
    try {
      await msgFoto.waitFor({ timeout: 10000 })
    } catch {
      falhas.push(`[${tag}] foto inválida: faltou "Não consegui abrir essa foto. Use JPG ou PNG."`)
    }
    if (await page.locator('.pl-miniatura img').count()) falhas.push(`[${tag}] foto inválida: apareceu miniatura`)
    await axe(page, `${tag} foto inválida`)
    await tira('04-foto-invalida')

    // foto válida (PNG gerado aqui): abre o ajuste (círculo de prévia), a mensagem some
    await arquivoFoto.setInputFiles(fotoOk)
    const ajuste = page.getByRole('dialog', { name: 'Ajustar a foto' })
    try {
      await ajuste.waitFor({ timeout: 10000 })
    } catch {
      falhas.push(`[${tag}] foto válida: o ajuste da foto não abriu`)
    }
    if (await msgFoto.count()) falhas.push(`[${tag}] foto válida: a mensagem de erro devia sumir`)
    if (await page.locator('.pl-miniatura img').count()) falhas.push(`[${tag}] ajuste aberto: a miniatura só pode aparecer depois de "Usar foto"`)
    const areaAjuste = ajuste.getByRole('application', { name: 'Posição da foto' })
    const zoomAjuste = ajuste.getByRole('slider', { name: 'Zoom' })
    if ((await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) !== 'Posição da foto') falhas.push(`[${tag}] ajuste: o foco devia começar na área da foto`)
    // cor no centro do círculo de prévia (o canvas do ajuste)
    const corNoCentro = () =>
      page.evaluate(() => {
        const c = document.querySelector('.pl-ajuste-area canvas')
        const [r, g, b] = c.getContext('2d').getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data
        return r > 200 && g < 70 && b > 200 ? 'magenta' : r < 70 && g > 200 && b > 200 ? 'ciano' : `rgb(${r},${g},${b})`
      })
    const zoomAgora = async () => Number(await zoomAjuste.inputValue())
    await page.waitForTimeout(200)
    if ((await corNoCentro()) !== 'ciano') falhas.push(`[${tag}] ajuste: devia começar no meio da foto (ciano no centro), veio ${await corNoCentro()}`)
    if ((await zoomAgora()) !== 1) falhas.push(`[${tag}] ajuste: o zoom devia começar em 1 (veio ${await zoomAgora()})`)
    await axe(page, `${tag} ajuste da foto`, { topo: false })
    await tira('05a-ajuste-foto')
    // arrastar para a direita: no computador com o mouse, no celular com o dedo (toque de verdade, pelo protocolo do navegador)
    const caixa = await areaAjuste.boundingBox()
    const meioX = caixa.x + caixa.width / 2
    const meioY = caixa.y + caixa.height / 2
    if (movel) {
      const cdp = await ctx.newCDPSession(page)
      const toque = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: meioY, id: 1 }] })
      await toque('touchStart', meioX - 100)
      for (let i = 1; i <= 8; i++) await toque('touchMove', meioX - 100 + i * 25)
      await toque('touchEnd')
      await cdp.detach()
    } else {
      await page.mouse.move(meioX - 100, meioY)
      await page.mouse.down()
      await page.mouse.move(meioX + 100, meioY, { steps: 8 })
      await page.mouse.up()
    }
    await page.waitForTimeout(150)
    if ((await corNoCentro()) !== 'magenta') falhas.push(`[${tag}] ajuste: arrastar para a direita devia trazer o magenta para o centro (veio ${await corNoCentro()})`)
    // zoom: roda do mouse no computador, controle deslizante no celular; depois o teclado (+, - e setas) nos dois
    if (movel) await zoomAjuste.fill('2')
    else {
      await page.mouse.move(meioX, meioY)
      for (let i = 0; i < 6 && (await zoomAgora()) < 1.9; i++) {
        await page.mouse.wheel(0, -120)
        await page.waitForTimeout(80)
      }
    }
    const zoomDepois = await zoomAgora()
    if (!(zoomDepois >= 1.5 && zoomDepois <= 2.9)) falhas.push(`[${tag}] ajuste: o zoom (${movel ? 'controle' : 'roda do mouse'}) devia ir para perto de 2 (veio ${zoomDepois})`)
    await areaAjuste.focus()
    await page.keyboard.press('+')
    if (!((await zoomAgora()) > zoomDepois)) falhas.push(`[${tag}] ajuste: a tecla + devia aumentar o zoom (${zoomDepois} -> ${await zoomAgora()})`)
    await page.keyboard.press('-')
    if (Math.abs((await zoomAgora()) - zoomDepois) > 0.001) falhas.push(`[${tag}] ajuste: + e depois - deviam voltar ao mesmo zoom (${zoomDepois} -> ${await zoomAgora()})`)
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowRight')
    if ((await corNoCentro()) !== 'magenta') falhas.push(`[${tag}] ajuste: depois do zoom e das setas o centro devia continuar magenta (veio ${await corNoCentro()})`)
    await tira('05b-ajuste-mexido')
    await ajuste.getByRole('button', { name: 'Usar foto' }).click()
    try {
      await page.locator('.pl-miniatura img').waitFor({ timeout: 10000 })
    } catch {
      falhas.push(`[${tag}] "Usar foto": a miniatura não apareceu`)
    }
    if (await ajuste.count()) falhas.push(`[${tag}] "Usar foto": o ajuste devia fechar`)
    // a miniatura é o recorte: quadrado de 480 px, todo magenta (sem o ciano da direita da foto original)
    const recorte = () =>
      page.evaluate(async () => {
        const img = document.querySelector('.pl-miniatura img')
        if (!img) return null
        await img.decode()
        const c = document.createElement('canvas')
        c.width = img.naturalWidth
        c.height = img.naturalHeight
        const g = c.getContext('2d')
        g.drawImage(img, 0, 0)
        const d = g.getImageData(0, 0, c.width, c.height).data
        let magenta = 0
        for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 70 && d[i + 2] > 200) magenta++
        return { largura: c.width, altura: c.height, magenta: magenta / (c.width * c.height), src: img.src }
      })
    const r1 = await recorte()
    if (!r1 || r1.largura !== 480 || r1.altura !== 480) falhas.push(`[${tag}] o recorte devia ser um quadrado de 480 px (veio ${r1 && `${r1.largura}x${r1.altura}`})`)
    else if (r1.magenta < 0.98) falhas.push(`[${tag}] o recorte não seguiu o ajuste: só ${(r1.magenta * 100).toFixed(1)}% magenta`)
    else console.log(`[${tag}] recorte da foto: 480x480, ${(r1.magenta * 100).toFixed(1)}% magenta`)
    if ((await page.evaluate(() => document.activeElement?.textContent)) !== 'Ajustar') falhas.push(`[${tag}] depois de "Usar foto" o foco devia ir para "Ajustar"`)
    // "Ajustar" reabre com o mesmo enquadramento; Esc cancela e a foto continua a mesma
    await page.getByRole('button', { name: 'Ajustar', exact: true }).click()
    try {
      await ajuste.waitFor({ timeout: 5000 })
    } catch {
      falhas.push(`[${tag}] "Ajustar" não reabriu o ajuste`)
    }
    if (Math.abs((await zoomAgora()) - zoomDepois) > 0.001) falhas.push(`[${tag}] "Ajustar" devia reabrir com o zoom que foi usado (${zoomDepois}, veio ${await zoomAgora()})`)
    if ((await corNoCentro()) !== 'magenta') falhas.push(`[${tag}] "Ajustar" devia reabrir com o mesmo enquadramento (centro magenta, veio ${await corNoCentro()})`)
    await page.keyboard.press('Escape')
    try {
      await ajuste.waitFor({ state: 'detached', timeout: 5000 })
    } catch {
      falhas.push(`[${tag}] Esc não fechou o ajuste`)
    }
    if ((await recorte())?.src !== r1?.src) falhas.push(`[${tag}] Esc no ajuste devia manter a foto como estava`)
    await page.getByLabel('Cargo', { exact: true }).fill(CARGO)
    await page.getByLabel('Matrícula (opcional)').fill('12345')
    await axe(page, `${tag} entrada preenchida`)
    await tira('05-entrada-preenchida')

    // ---- painel
    await botaoEntrar.click()
    await noPainel('depois de Entrar')
    const guardada = JSON.parse((await pessoaGuardada()) || 'null')
    if (!guardada || guardada.nome !== NOME || guardada.cargo !== CARGO || guardada.matricula !== '12345') falhas.push(`[${tag}] a pessoa não ficou guardada certa: ${JSON.stringify(guardada && { ...guardada, foto: undefined })}`)
    else if (!/^data:image\/jpeg;base64,/.test(guardada.foto || '')) falhas.push(`[${tag}] a foto não ficou guardada (JPEG reduzido)`)
    if ((await page.evaluate(() => document.activeElement?.tagName)) !== 'H1') falhas.push(`[${tag}] painel: o foco devia estar na saudação`)
    if (!(await page.getByText('Escolha a região que você vai fechar hoje.', { exact: true }).count())) falhas.push(`[${tag}] painel: falta "Escolha a região que você vai fechar hoje."`)
    for (const rotulo of ['Trocar pessoa', 'EDP', 'Ceará', 'Sergipe']) {
      if (!(await page.getByRole('button', { name: rotulo, exact: true }).count())) falhas.push(`[${tag}] painel: falta o botão "${rotulo}"`)
    }

    // crachá: 390 px = parado (sem .glb nem pedaço do 3D); 1366 px = 3D se o navegador tiver WebGL
    const parado = page.getByRole('img', { name: `Crachá de ${NOME}, ${CARGO}` })
    const fotoNoCracha = () =>
      page.evaluate(async () => {
        const img = [...document.querySelectorAll('img')].find((i) => /^Crachá de /.test(i.alt))
        if (!img) return -1
        await img.decode()
        const c = document.createElement('canvas')
        c.width = Math.round(img.naturalWidth / 4)
        c.height = Math.round(img.naturalHeight / 4)
        const g = c.getContext('2d')
        g.drawImage(img, 0, 0, c.width, c.height)
        const d = g.getImageData(0, 0, c.width, c.height).data
        let n = 0
        for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 70 && d[i + 2] > 200) n++
        return n
      })
    const pediu = (re) => pedidos.some((u) => re.test(u.split('?')[0]))
    const tem3D = () => pediu(/\.glb$/) || pediu(/Cracha3D/)
    if (movel) {
      try {
        await parado.waitFor({ timeout: 10000 })
      } catch {
        falhas.push(`[${tag}] crachá parado não apareceu (img com alt "Crachá de ${NOME}, ${CARGO}")`)
      }
      await page.waitForTimeout(1500) // tempo para qualquer pedido do 3D aparecer, se houvesse
      if (tem3D()) falhas.push(`[${tag}] no celular pediu o 3D: ${pedidos.filter((u) => /\.glb|Cracha3D/.test(u)).join(', ')}`)
      const magenta = await fotoNoCracha()
      if (magenta < 5000) falhas.push(`[${tag}] a foto escolhida não aparece no crachá parado (${magenta} pixels da cor da foto)`)
      else console.log(`[${tag}] foto no crachá parado: ${magenta} pixels da cor da foto (reduzido 4x)`)
    } else {
      await page.waitForTimeout(6000) // o 3D carrega à parte (pedaço Cracha3D, modelo .glb e física)
      const webgl = await page.evaluate(() => {
        const c = document.createElement('canvas')
        return !!(c.getContext('webgl2') || c.getContext('webgl'))
      })
      const canvas3D = await page.locator('main canvas').count()
      if (tem3D() && pediu(/\.glb$/)) console.log(`[${tag}] WebGL no Edge headless: ${webgl ? 'sim' : 'não'}; pediu o .glb e o Cracha3D (canvas na tela: ${canvas3D})`)
      else {
        console.log(`AVISO [${tag}] o 3D não ligou (WebGL no Edge headless: ${webgl ? 'sim' : 'não'}; pediu .glb: ${pediu(/\.glb$/)}; pediu Cracha3D: ${pediu(/Cracha3D/)}); o crachá parado fica no lugar`)
        if (webgl) falhas.push(`[${tag}] o navegador tem WebGL mas o crachá 3D não ligou no computador`)
      }
      // com o 3D ligado não há crachá parado na tela; se houver (3D caiu na reserva), a foto tem que estar nele
      if (await page.locator('img[alt^="Crachá de"]').count()) {
        const magenta = await fotoNoCracha()
        if (magenta < 5000) falhas.push(`[${tag}] a foto escolhida não aparece no crachá parado (${magenta} pixels da cor da foto)`)
      }
    }
    await axe(page, `${tag} painel`)
    await tira('06-painel')

    // região "em breve" não navega: mostra o aviso e ele some sozinho
    for (const [nomeRegiao, texto] of [['Ceará', 'O Ceará ainda está em construção.'], ['Sergipe', 'Sergipe ainda está em construção.']]) {
      // force: o botão usa aria-disabled="true" (não navega, só avisa) e o Playwright o trata como desabilitado
      await page.getByRole('button', { name: nomeRegiao, exact: true }).click({ force: true })
      try {
        await page.locator('.pl-aviso.visivel').getByText(texto, { exact: true }).waitFor({ timeout: 3000 })
      } catch {
        falhas.push(`[${tag}] ${nomeRegiao}: faltou o aviso "${texto}"`)
      }
      if (!(await saudacao.count())) falhas.push(`[${tag}] ${nomeRegiao}: saiu do painel (devia só avisar)`)
      if (nomeRegiao === 'Ceará') {
        await axe(page, `${tag} aviso em construção`)
        await tira('07-aviso-ceara')
      }
    }
    await page.waitForFunction(() => !document.querySelector('.pl-aviso.visivel') && !document.querySelector('.pl-aviso')?.textContent, null, { timeout: 5000 }).catch(() => falhas.push(`[${tag}] o aviso "em construção" não sumiu sozinho`))

    // recarregar abre direto no painel (a pessoa fica guardada)
    await page.reload()
    await noPainel('depois de recarregar')
    if (await page.getByRole('button', { name: 'Entrar' }).count()) falhas.push(`[${tag}] recarregar voltou para a entrada`)
    await tira('08-recarregado')

    // ---- EDP dentro da plataforma: "← Regiões" com lançamento pede confirmação
    await page.getByRole('button', { name: 'EDP', exact: true }).click()
    await page.setInputFiles('input[type=file]', path.join(DADOS, 'inv.xlsx'))
    await page.waitForSelector('nav[aria-label=Etapas]', { timeout: 20000 })
    await page.getByRole('region', { name: 'Este fechamento é parcial ou final?' }).getByRole('radio', { name: /^Parcial/ }).click()
    await page.getByRole('radio', { name: /^2020 / }).click()
    await page.getByPlaceholder(/Ex.: CE3/).fill('KP-CE1-P23')
    await page.getByRole('button', { name: 'Adicionar KP-CE1-P23 na operação 2020' }).click()
    await axe(page, `${tag} EDP com lançamento`)
    await tira('09-edp-lancada')
    const voltar = page.getByRole('button', { name: 'Regiões', exact: true })
    // 1) recusar: continua na obra, com o lançamento
    let msg = null
    page.once('dialog', async (d) => {
      msg = d.message()
      await d.dismiss()
    })
    await voltar.click()
    await page.waitForTimeout(300)
    if (msg !== CONFIRMA) falhas.push(`[${tag}] ← Regiões (recusar): texto da confirmação "${msg}"`)
    if (!(await page.getByRole('textbox', { name: 'Quantidade de KP-CE1-P23' }).count())) falhas.push(`[${tag}] ← Regiões (recusar): o lançamento sumiu ou saiu da obra`)
    if (await saudacao.count()) falhas.push(`[${tag}] ← Regiões (recusar): voltou ao painel mesmo recusando`)
    // 2) aceitar: volta ao painel e a obra é descartada
    msg = null
    page.once('dialog', async (d) => {
      msg = d.message()
      await d.accept()
    })
    await voltar.click()
    await noPainel('depois de aceitar a confirmação')
    if (msg !== CONFIRMA) falhas.push(`[${tag}] ← Regiões (aceitar): texto da confirmação "${msg}"`)
    await page.getByRole('button', { name: 'EDP', exact: true }).click()
    try {
      await page.getByText('Arraste o inventário aqui').waitFor({ timeout: 10000 })
    } catch {
      falhas.push(`[${tag}] depois de aceitar, a EDP devia pedir o inventário de novo`)
    }
    if (await page.locator('nav[aria-label=Etapas]').count()) falhas.push(`[${tag}] depois de aceitar, a obra anterior continuou aberta`)
    // sem obra aberta, "← Regiões" volta sem perguntar nada
    let perguntou = false
    page.once('dialog', async (d) => {
      perguntou = true
      await d.dismiss()
    })
    await page.getByRole('button', { name: /Regiões/ }).first().click()
    await noPainel('voltando da EDP sem obra')
    if (perguntou) falhas.push(`[${tag}] ← Regiões sem obra aberta não devia perguntar nada`)

    // ---- o técnico do carimbo não passa de uma pessoa para a outra
    // (a lista de técnicos tem vários: ao trocar de pessoa nada vem marcado e a revisão pede o técnico)
    const PENDENCIA_TECNICO = 'Escolha o técnico do carimbo.'
    const etapa = (nome) => page.getByRole('navigation', { name: 'Etapas' }).getByRole('button', { name: new RegExp('^' + nome) })
    const abrirEdpComInventario = async () => {
      await page.getByRole('button', { name: 'EDP', exact: true }).click()
      await page.setInputFiles('input[type=file]', path.join(DADOS, 'inv.xlsx'))
      await page.waitForSelector('nav[aria-label=Etapas]', { timeout: 20000 })
      await page.getByRole('region', { name: 'Este fechamento é parcial ou final?' }).getByRole('radio', { name: /^Parcial/ }).click()
    }
    await abrirEdpComInventario()
    await etapa('Carimbo').click()
    const radiosTecnico = page.getByRole('radiogroup', { name: 'Técnico do carimbo' }).getByRole('radio')
    await page.locator('main input[accept^=".json"]').setInputFiles(path.join(DADOS, 'tec.json'))
    await radiosTecnico.first().waitFor({ timeout: 10000 })
    if ((await radiosTecnico.count()) < 2) falhas.push(`[${tag}] técnico: o teste precisa de mais de um técnico na lista`)
    await radiosTecnico.first().click()
    if (!(await radiosTecnico.first().isChecked())) falhas.push(`[${tag}] técnico: não ficou marcado`)
    await etapa('Revisar e baixar').click()
    if (await page.getByText(PENDENCIA_TECNICO, { exact: true }).count()) falhas.push(`[${tag}] técnico marcado: a pendência "${PENDENCIA_TECNICO}" não devia aparecer`)
    await page.getByRole('button', { name: /Regiões/ }).first().click()
    await noPainel('voltando da EDP com técnico marcado')
    await page.getByRole('button', { name: 'Trocar pessoa' }).click()
    await entrada.waitFor({ timeout: 10000 })
    await page.getByLabel('Nome', { exact: true }).fill(NOME)
    await page.getByLabel('Cargo', { exact: true }).fill(CARGO)
    await botaoEntrar.click()
    await noPainel('segunda pessoa')
    await abrirEdpComInventario()
    await etapa('Carimbo').click()
    if ((await radiosTecnico.count()) < 2) falhas.push(`[${tag}] técnico (segunda pessoa): a lista de técnicos sumiu`)
    for (let i = 0; i < (await radiosTecnico.count()); i++) {
      if (await radiosTecnico.nth(i).isChecked()) falhas.push(`[${tag}] o técnico da pessoa anterior continuou marcado para a seguinte`)
    }
    await etapa('Revisar e baixar').click()
    if (!(await page.getByText(PENDENCIA_TECNICO, { exact: true }).count())) falhas.push(`[${tag}] segunda pessoa: faltou a pendência "${PENDENCIA_TECNICO}"`)
    await page.getByRole('button', { name: /Regiões/ }).first().click()
    await noPainel('voltando da EDP da segunda pessoa')

    // ---- trocar pessoa: volta à entrada, esquece a pessoa e o recarregar não reabre o painel
    await page.getByRole('button', { name: 'Trocar pessoa' }).click()
    try {
      await entrada.waitFor({ timeout: 10000 })
    } catch {
      falhas.push(`[${tag}] Trocar pessoa não voltou à entrada`)
    }
    if ((await pessoaGuardada()) !== null) falhas.push(`[${tag}] Trocar pessoa não apagou a pessoa guardada`)
    if ((await page.getByLabel('Nome', { exact: true }).inputValue()) !== '') falhas.push(`[${tag}] Trocar pessoa: o campo Nome devia vir vazio`)
    await axe(page, `${tag} depois de trocar pessoa`)
    await tira('10-trocar-pessoa')
    await page.reload()
    await entrada.waitFor({ timeout: 10000 })
    if (await saudacao.count()) falhas.push(`[${tag}] depois de trocar pessoa, recarregar abriu o painel`)

    // ruído conhecido: o antivírus Kaspersky injeta um script externo (bloqueado aqui); só então o ERR_FAILED sem endereço vale como ruído
    const kaspersky = erros.some((e) => e.includes('kaspersky-labs.com'))
    for (const e of erros) {
      if (e.includes('kaspersky-labs.com') || (kaspersky && e === 'Failed to load resource: net::ERR_FAILED')) continue
      falhas.push(`[${tag}] erro no console: ${e}`)
    }
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    if (sw > largura + 1) falhas.push(`[${tag}] página mais larga que a tela (${sw}px)`)
    await ctx.close()
  }
}

const gerados = []
try {
  await ceara()
  await plataforma()
  await modeloDiferente()
  await operacoesDaObra()
  await soDesativacao()
  // o site não tem mais tema claro: as rodadas que eram claras (que escolhiam Parcial) continuam,
  // agora no escuro, com o boletim dito de forma explícita para manter a mesma cobertura
  gerados.push(await rodada({ largura: 1366, altura: 768, tema: 'dark', boletim: 'Parcial' }))
  gerados.push(await rodada({ largura: 1366, altura: 768, tema: 'dark', boletim: 'Final' }))
  gerados.push(await rodada({ largura: 1920, altura: 1080, tema: 'dark', boletim: 'Parcial' }))
  gerados.push(await rodada({ largura: 390, altura: 844, tema: 'dark', boletim: 'Parcial', movel: true }))
  gerados.push(await rodada({ largura: 390, altura: 844, tema: 'dark', boletim: 'Final', movel: true }))
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
