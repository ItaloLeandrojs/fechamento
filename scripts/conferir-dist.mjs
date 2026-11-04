// `node scripts/conferir-dist.mjs`: confere que nenhuma base privada foi parar dentro do site montado (dist/).
// Tira 20 descrições da base da Enel (../bases/enel.json) e 20 dos kits da EDP (../bases/kits-edp.json),
// as 3 mais compridas de cada uma e o resto ao acaso (semente fixa: sempre as mesmas), e procura cada uma
// em todos os arquivos de dist/ (os .gz e .br são abertos antes). As frases vêm das bases na hora: nunca
// ficam escritas aqui. Sai com código 1 e lista o que achou, ou imprime "dist limpo: nenhuma base dentro".
// Uso: node scripts/conferir-dist.mjs [pasta]   (sem pasta, confere a dist/)
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const PROJ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASES = path.join(PROJ, '..', 'bases')
const PASTA = path.resolve(process.argv[2] ?? path.join(PROJ, 'dist'))
const POR_BASE = 20
const COMPRIDAS = 3
// frases curtas demais ("CABO 10MM") podem aparecer no site por acaso
const MINIMO = 12
const SEMENTE = 20261104

function sair(msg) {
  console.error(msg)
  process.exit(2)
}

// sorteio com semente (mulberry32): a mesma amostra a cada vez
function sorteador(semente) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function lerBase(nome) {
  const arq = path.join(BASES, nome)
  if (!fs.existsSync(arq)) sair(`Falta a base local ${arq}: sem ela não dá para conferir.`)
  return JSON.parse(fs.readFileSync(arq, 'utf8'))
}

// as mais compridas primeiro (são as que mais denunciam a base inteira), depois o sorteio
function amostra(frases, sorteio) {
  const unicas = [...new Set(frases.map((f) => f.trim()).filter((f) => f.length >= MINIMO))].sort()
  if (unicas.length < POR_BASE) sair(`A base tem só ${unicas.length} descrições com ${MINIMO} letras ou mais.`)
  const escolhidas = [...unicas].sort((a, b) => b.length - a.length || (a < b ? -1 : 1)).slice(0, COMPRIDAS)
  const resto = unicas.filter((f) => !escolhidas.includes(f))
  while (escolhidas.length < POR_BASE) escolhidas.push(resto.splice(Math.floor(sorteio() * resto.length), 1)[0])
  return escolhidas
}

const enel = lerBase('enel.json')
const edp = lerBase('kits-edp.json')
const sorteio = sorteador(SEMENTE)
const procuradas = [
  // Enel: descrição dos materiais (texto mais comprido de cada linha) e das estruturas
  ...amostra([...Object.values(enel.materiais ?? {}).map((m) => [].concat(m).sort((a, b) => String(b).length - String(a).length)[0]), ...Object.values(enel.estruturas ?? {})].map(String), sorteio).map((frase) => ({ base: 'Enel', frase })),
  // EDP: descrição dos kits e dos materiais de cada kit
  ...amostra(edp.flatMap((k) => [k.descricao, ...(k.itens ?? []).map((i) => i.desc)]).filter((f) => typeof f === 'string'), sorteio).map((frase) => ({ base: 'EDP', frase })),
]

// a mesma frase como ela pode aparecer num arquivo: crua, escapada em JSON e com \uXXXX no lugar dos acentos
function formas(frase) {
  const json = JSON.stringify(frase).slice(1, -1)
  const ascii = json.replace(/[^\x20-\x7e]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
  return [...new Set([frase, json, ascii])].map((f) => Buffer.from(f, 'utf8'))
}

function arquivos(pasta) {
  return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? arquivos(path.join(pasta, e.name)) : [path.join(pasta, e.name)]))
}

function conteudo(arq) {
  const bruto = fs.readFileSync(arq)
  try {
    if (arq.endsWith('.gz')) return zlib.gunzipSync(bruto)
    if (arq.endsWith('.br')) return zlib.brotliDecompressSync(bruto)
  } catch {
    // não abriu: procura no arquivo como está
  }
  return bruto
}

if (!fs.existsSync(PASTA)) sair(`Não achei a pasta ${PASTA}. Rode "npm run build" antes.`)
const lista = arquivos(PASTA)
const achados = []
for (const arq of lista) {
  const dados = conteudo(arq)
  procuradas.forEach(({ base, frase }, i) => {
    if (formas(frase).some((f) => dados.includes(f))) achados.push({ arq: path.relative(PASTA, arq), base, n: i + 1, inicio: frase.slice(0, 24) })
  })
}

console.log(`${procuradas.length} descrições procuradas (${POR_BASE} da Enel, ${POR_BASE} da EDP) em ${lista.length} arquivos de ${PASTA.startsWith(PROJ + path.sep) ? path.relative(PROJ, PASTA) : PASTA}.`)
if (achados.length) {
  console.log(`\nBASE DENTRO DO SITE: ${achados.length} achado(s):`)
  for (const a of achados) console.log(`- ${a.arq}: descrição ${a.n} da ${a.base} ("${a.inicio}...")`)
  process.exit(1)
}
console.log('dist limpo: nenhuma base dentro')
