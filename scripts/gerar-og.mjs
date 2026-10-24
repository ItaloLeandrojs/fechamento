// Gera public/og.png (1200x630): a imagem que aparece quando o link do site é
// enviado no WhatsApp, LinkedIn etc. Usa a logo de public/logo-fechamento.svg.
// Uso: node scripts/gerar-og.mjs
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const PROJ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// Playwright já instalado em outro projeto (nada entra neste)
const { chromium } = createRequire('C:/Users/italo.silva/Desktop/CURSO CLAUDE/AULA 4/site-v2/package.json')('playwright')

// logo em versão para fundo escuro: letras claras e o A amarelo do site
const logo = fs
  .readFileSync(path.join(PROJ, 'public', 'logo-fechamento.svg'), 'utf8')
  .replaceAll('#282829', '#EEF0F2')
  .replaceAll('#E8A400', '#F2B705')
  .replace('<svg ', '<svg width="760" ')

// a fonte vai embutida: a página é montada sem endereço e não pode ler arquivo local
const fonte = fs.readFileSync(path.join(PROJ, 'node_modules', '@fontsource-variable', 'sora', 'files', 'sora-latin-wght-normal.woff2')).toString('base64')

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Sora; src: url(data:font/woff2;base64,${fonte}) format('woff2'); font-weight: 100 800; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; font-family: Sora, sans-serif; color: #EEF0F2; overflow: hidden;
  background: #15181B; position: relative; }
/* quadriculado de prancha técnica, bem discreto */
.grade { position: absolute; inset: 0;
  background-image: linear-gradient(rgb(255 255 255 / .045) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / .045) 1px, transparent 1px);
  background-size: 40px 40px; }
.brilho { position: absolute; width: 720px; height: 720px; right: -220px; top: -260px; border-radius: 50%;
  background: radial-gradient(circle, rgb(242 183 5 / .16), transparent 65%); }
.faixa { position: absolute; left: 0; top: 0; bottom: 0; width: 14px; background: #F2B705; }
.conteudo { position: absolute; left: 96px; top: 150px; right: 96px; }
h1 { margin-top: 58px; font-size: 46px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.15; }
p { margin-top: 18px; font-size: 24px; color: #AEB6BE; line-height: 1.4; max-width: 1010px; }
.selo { position: absolute; left: 96px; bottom: 64px; display: flex; gap: 14px; }
.selo span { border: 1.5px solid rgb(255 255 255 / .18); border-radius: 999px; padding: 10px 20px; font-size: 20px; color: #D5DADF; }
.selo span b { color: #F2B705; font-weight: 600; }
</style></head><body>
<div class="grade"></div><div class="brilho"></div><div class="faixa"></div>
<div class="conteudo">${logo}
  <h1>Fechamento de obras da EDP</h1>
  <p>Inventário, ADS, fichas com fotos e carimbo do técnico, prontos para enviar.</p>
</div>
<div class="selo"><span><b>ADS</b> preenchida</span><span><b>Fichas</b> com fotos</span><span><b>Carimbo</b> do técnico</span></div>
</body></html>`

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html, { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
const destino = path.join(PROJ, 'public', 'og.png')
await page.screenshot({ path: destino })
await browser.close()
console.log('gerado', destino, fs.statSync(destino).size, 'bytes')
