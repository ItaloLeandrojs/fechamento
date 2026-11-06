// Supabase de mentira para o teste de ponta a ponta: rotas do Playwright no lugar do servidor.
// Responde o login (token falso), o perfil, a tabela "bases" e os arquivos do balde "bases",
// feitos na hora com gzip das bases locais (../bases, fora do git). Nada sai para a internet.
// O objeto devolvido conta as descargas e deixa a cena mudar o que o falso responde.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

/** Lê a URL do Supabase do .env.local (a mesma que o build pôs no site). */
export function urlDoSupabase(pastaDoSite) {
  const arq = path.join(pastaDoSite, '.env.local')
  const texto = fs.existsSync(arq) ? fs.readFileSync(arq, 'utf8') : ''
  const achado = /^\s*VITE_SUPABASE_URL\s*=\s*["']?([^"'\s]+)/m.exec(texto)
  if (!achado) throw new Error('Falta VITE_SUPABASE_URL no .env.local: o site e o teste precisam dela.')
  return achado[1].replace(/\/+$/, '')
}

// as bases têm alguns MB: comprime uma vez só por arquivo
const comprimidas = new Map()
function gz(arquivo) {
  if (!comprimidas.has(arquivo)) comprimidas.set(arquivo, zlib.gzipSync(fs.readFileSync(arquivo)))
  return comprimidas.get(arquivo)
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')

/**
 * `enel` e `edp`: caminhos dos JSON locais; `maoDeObra` (opcional): caminho do JSON da lista de mão de obra
 * (com ele a tabela "bases" tem a 3ª linha e o balde serve mao-de-obra.json.gz). `perfil`: muda a linha de "perfis" (id, nome, cargo, matrícula).
 * Devolve o estado do falso; a cena pode mudar estes campos no meio:
 * - `senhaErrada`: o login responde 400 invalid_credentials;
 * - `negarToken`: /auth/v1/user responde 401 e a renovação do token responde 400 (sessão vencida);
 * - `abortarBases`: o pedido à tabela "bases" cai como se não houvesse internet;
 * e lê: `descargas` (arquivos baixados do balde), `senhaTrocada` (rpc chamado) e `naoSimuladas`.
 */
export async function simularSupabase(page, { url, enel, edp, maoDeObra, senhaInicial = false, perfil = {} }) {
  const linha = { id: 'maria-teste', nome: 'Maria Souza', cargo: 'Técnica de campo', matricula: '1234', ...perfil }
  const arquivos = { 'enel.json.gz': enel, 'kits-edp.json.gz': edp, ...(maoDeObra ? { 'mao-de-obra.json.gz': maoDeObra } : {}) }
  const estado = { senhaInicial, senhaErrada: false, negarToken: false, abortarBases: false, descargas: 0, senhaTrocada: false, naoSimuladas: [] }
  const usuario = { id: linha.id, aud: 'authenticated', role: 'authenticated', email: 'maria.souza@exemplo.com.br', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-11-04T00:00:00Z' }
  let n = 0
  const sessao = () => {
    const agora = Math.floor(Date.now() / 1000)
    n++
    const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: linha.id, exp: agora + 3600, role: 'authenticated', aud: 'authenticated' })}.assinatura-falsa`
    return { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: agora + 3600, refresh_token: `renova-${n}`, user: usuario }
  }
  const cors = { 'access-control-allow-origin': '*' }
  const json = (route, corpo, status = 200) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(corpo) })
  // resposta sem dados: o servidor de verdade manda 204, mas o Playwright conta resposta de corpo vazio como pedido
  // abortado (requestfailed ERR_ABORTED), então o falso manda 200 com "null"
  const semDados = (route) => json(route, null)
  const naoSimulada = (route) => {
    estado.naoSimuladas.push(`${route.request().method()} ${route.request().url()}`)
    return json(route, { message: 'rota não simulada' }, 404)
  }

  await page.route(`${url}/auth/v1/**`, (route) => {
    const u = new URL(route.request().url())
    if (u.pathname.endsWith('/token')) {
      const tipo = u.searchParams.get('grant_type')
      if (tipo === 'password') {
        if (estado.senhaErrada) return json(route, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400)
        return json(route, sessao())
      }
      if (tipo === 'refresh_token') {
        if (estado.negarToken) return json(route, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' }, 400)
        return json(route, sessao())
      }
    }
    if (u.pathname.endsWith('/user')) {
      if (estado.negarToken) return json(route, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' }, 401)
      // troca de senha (PUT) e leitura do usuário (GET) devolvem o mesmo usuário
      return json(route, usuario)
    }
    if (u.pathname.endsWith('/logout')) return semDados(route)
    return naoSimulada(route)
  })

  await page.route(`${url}/rest/v1/**`, (route) => {
    const u = new URL(route.request().url())
    if (u.pathname.endsWith('/rest/v1/perfis')) return json(route, { id: linha.id, nome: linha.nome, cargo: linha.cargo, matricula: linha.matricula, senha_inicial: estado.senhaInicial })
    if (u.pathname.endsWith('/rest/v1/rpc/marcar_senha_trocada')) {
      estado.senhaInicial = false
      estado.senhaTrocada = true
      return semDados(route)
    }
    if (u.pathname.endsWith('/rest/v1/bases')) {
      if (estado.abortarBases) return route.abort('internetdisconnected')
      return json(route, Object.keys(arquivos).map((arquivo) => ({ nome: arquivo.startsWith('enel') ? 'enel' : arquivo.startsWith('mao-de-obra') ? 'mao-de-obra' : 'edp', versao: 'teste-1', arquivo })))
    }
    return naoSimulada(route)
  })

  // download do balde privado: /storage/v1/object/bases/<arquivo> (ou .../authenticated/bases/<arquivo>)
  await page.route(`${url}/storage/v1/**`, (route) => {
    const nome = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop())
    if (!/\/storage\/v1\/object\/(authenticated\/)?bases\//.test(route.request().url()) || !arquivos[nome]) return naoSimulada(route)
    estado.descargas++
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/gzip', body: gz(arquivos[nome]) })
  })

  return estado
}
