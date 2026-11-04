// Gera public/og.png (1200x630): a imagem que aparece quando o link do site é
// enviado no WhatsApp, LinkedIn etc. Visual B (grafite): logo do Grupo Cosampa em branco,
// "Fechamento" grande em Sora e a linha verde. O logo vem de src/components/logoPath.ts.
// Uso: node scripts/gerar-og.mjs
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const PROJ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// Playwright já instalado em outro projeto (nada entra neste)
const { chromium } = createRequire('C:/Users/italo.silva/Desktop/CURSO CLAUDE/AULA 4/site-v2/package.json')('playwright')

const fonteTs = fs.readFileSync(path.join(PROJ, 'src', 'components', 'logoPath.ts'), 'utf8')
const logoD = /LOGO_D =\s*'([^']+)'/.exec(fonteTs)?.[1]
const viewBox = /LOGO_VIEWBOX = '([^']+)'/.exec(fonteTs)?.[1]
if (!logoD || !viewBox) throw new Error('não achei LOGO_D e LOGO_VIEWBOX em logoPath.ts')
const [, , vw, vh] = viewBox.split(' ').map(Number)
const LARGURA_LOGO = 440
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${LARGURA_LOGO}" height="${Math.round((LARGURA_LOGO * vh) / vw)}"><path d="${logoD}" fill-rule="evenodd" fill="#FFFFFF"/></svg>`

// a fonte vai embutida: a página é montada sem endereço e não pode ler arquivo local
const fonte = fs.readFileSync(path.join(PROJ, 'node_modules', '@fontsource-variable', 'sora', 'files', 'sora-latin-wght-normal.woff2')).toString('base64')

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Sora; src: url(data:font/woff2;base64,${fonte}) format('woff2'); font-weight: 100 800; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; font-family: Sora, sans-serif; color: #F4F4F5; overflow: hidden; background: #131315; position: relative; }
.logo { position: absolute; left: 88px; top: 72px; }
.bloco { position: absolute; left: 88px; right: 88px; bottom: 84px; }
h1 { font-size: 168px; font-weight: 600; letter-spacing: -0.05em; line-height: 0.9; }
.linha { display: block; height: 6px; width: 760px; margin-top: 34px; background: #5abd79; }
p { margin-top: 30px; font-size: 28px; color: #A1A1AA; line-height: 1.4; }
</style></head><body>
<div class="logo">${logo}</div>
<div class="bloco">
  <h1>Fechamento</h1>
  <span class="linha"></span>
  <p>As ferramentas da equipe de fechamento: Ceará, Sergipe e EDP.</p>
</div>
</body></html>`

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html, { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
const destino = path.join(PROJ, 'public', 'og.png')
await page.screenshot({ path: destino })
await browser.close()
console.log('gerado', destino, fs.statSync(destino).size, 'bytes')
