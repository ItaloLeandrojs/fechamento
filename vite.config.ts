import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Política de segurança só no site montado (no modo dev o Vite precisa de script inline).
// O site não fala com nenhum servidor: só carrega os próprios arquivos e as fotos/planilhas
// que a pessoa escolhe (blob:). Nada de fora pode ser carregado nem receber dados.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ') + ';' // termina com ';': o antivírus da empresa emenda texto no fim da política

function politicaDeSeguranca(): Plugin {
  return {
    name: 'politica-de-seguranca',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n    <meta http-equiv="Content-Security-Policy" content="${CSP}">\n    <meta name="referrer" content="no-referrer">`),
  }
}

export default defineConfig({
  // caminhos relativos: funciona no GitHub Pages em qualquer subpasta
  base: './',
  plugins: [react(), tailwindcss(), politicaDeSeguranca()],
  // os testes gravam planilhas e prints em e2e/; vigiar essa pasta derruba o servidor no Windows
  server: { watch: { ignored: ['**/e2e/**'] } },
})
