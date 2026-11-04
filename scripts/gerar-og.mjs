// Gera public/og.png (1200x630): a imagem que aparece quando o link do site é
// enviado no WhatsApp, LinkedIn etc. Visual B (grafite): a logo COSAMPA / FECHAMENTO em branco
// com o A verde, a linha verde e a frase. A logo vem de src/components/logoLetras.ts (a mesma <Marca> do site).
// Uso: node scripts/gerar-og.mjs
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const PROJ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// Playwright já instalado em outro projeto (nada entra neste)
const { chromium } = createRequire('C:/Users/italo.silva/Desktop/CURSO CLAUDE/AULA 4/site-v2/package.json')('playwright')

const fonteTs = fs.readFileSync(path.join(PROJ, 'src', 'components', 'logoLetras.ts'), 'utf8')
const viewBox = /LOGO_VIEWBOX = '([^']+)'/.exec(fonteTs)?.[1]
// cada lista é uma linha de JSON depois do "=" (assim o gerar-logo.py escreve)
const lista = (nome) => JSON.parse(fonteTs.split(/\r?\n/).find((l) => l.startsWith(`export const ${nome}:`))?.replace(/^[^=]+=\s*/, '') ?? 'null')
const letras = lista('LOGO_LETRAS')
const cosampa = lista('LOGO_COSAMPA')
if (!viewBox || !letras || !cosampa) throw new Error('não achei LOGO_VIEWBOX, LOGO_LETRAS e LOGO_COSAMPA em logoLetras.ts')
const [, , vw, vh] = viewBox.split(' ').map(Number)
const BRANCO = '#F4F4F5'
const VERDE = '#5abd79' // --accent do site
const caminho = (l, cor) => `<path d="${l.d}"${l.t ? ` transform="${l.t}"` : ''} fill-rule="evenodd" fill="${cor}"/>`
const LARGURA_LOGO = 900
const logo =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${LARGURA_LOGO}" height="${Math.round((LARGURA_LOGO * vh) / vw)}">` +
  cosampa.map((l) => caminho(l, BRANCO)).join('') +
  letras.map((l) => caminho(l, l.a ? VERDE : BRANCO)).join('') +
  '</svg>'

// a fonte vai embutida: a página é montada sem endereço e não pode ler arquivo local
const fonte = fs.readFileSync(path.join(PROJ, 'node_modules', '@fontsource-variable', 'sora', 'files', 'sora-latin-wght-normal.woff2')).toString('base64')

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Sora; src: url(data:font/woff2;base64,${fonte}) format('woff2'); font-weight: 100 800; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; font-family: Sora, sans-serif; color: #F4F4F5; overflow: hidden; background: #131315; position: relative; }
.logo { position: absolute; left: 88px; top: 156px; }
.bloco { position: absolute; left: 88px; right: 88px; top: 360px; }
.linha { display: block; height: 6px; width: 760px; background: #5abd79; }
p { margin-top: 34px; font-size: 30px; color: #A1A1AA; line-height: 1.4; }
</style></head><body>
<div class="logo">${logo}</div>
<div class="bloco">
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
