import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Política de segurança só no site montado (no modo dev o Vite precisa de script inline).
// O site só fala com o próprio Supabase (login, perfil e bases) e carrega os próprios arquivos
// e as fotos/planilhas que a pessoa escolhe (blob:). Nada mais de fora pode ser carregado nem receber dados.
function criarPolitica(urlSupabase: string): string {
  return [
    "default-src 'self'",
    // 'wasm-unsafe-eval': a física do crachá 3D (Rapier) roda em WebAssembly embutido no próprio script.
    // Libera só compilar WebAssembly; eval de texto continua proibido e nada de fora entra.
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self' blob: data: ${urlSupabase}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ') + ';' // termina com ';': o antivírus da empresa emenda texto no fim da política
}

function politicaDeSeguranca(csp: string): Plugin {
  return {
    name: 'politica-de-seguranca',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n    <meta http-equiv="Content-Security-Policy" content="${csp}">\n    <meta name="referrer" content="no-referrer">`),
  }
}

export default defineConfig(({ command, mode }) => {
  const urlSupabase = loadEnv(mode, '.', 'VITE_').VITE_SUPABASE_URL ?? ''
  if (command === 'build' && !urlSupabase) {
    throw new Error('Falta VITE_SUPABASE_URL no .env.local (veja docs/supabase-passo-a-passo.md)')
  }
  return {
    // caminhos relativos: funciona no GitHub Pages em qualquer subpasta
    base: './',
    plugins: [react(), tailwindcss(), politicaDeSeguranca(criarPolitica(urlSupabase))],
    // os testes gravam planilhas e prints em e2e/; vigiar essa pasta derruba o servidor no Windows
    server: { watch: { ignored: ['**/e2e/**'] } },
  }
})
