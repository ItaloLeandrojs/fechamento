// Arte do crachá da Cosampa desenhada em canvas: frente, verso e cordão.
// O modelo em branco (curva preta, anéis, grade de pontos, círculo da foto, logo e meia-lua)
// é redesenhado aqui; os dados da pessoa vão por cima, nas posições de LAYOUT.
// Roda só no navegador (usa document e canvas). A fonte Poppins vem do @fontsource (main.tsx).
import { LOGO_ALTURA, LOGO_D, LOGO_LARGURA } from '../../components/logoPath'
import { iniciais, type Pessoa } from '../pessoa'

// Posições em pixels do modelo (649 x 1039), as mesmas do pacote cracha-3d.
export const LAYOUT = {
  largura: 649,
  altura: 1039,
  foto: { cx: 464.5, cy: 377.5, r: 226 },
  iniciais: { x: 440, base: 430, tam: 150 },
  apelido: { x: 319, base: 762, tam: 48, max: 560 },
  cargo: { x: 324.5, base: 806, tam: 34, max: 612 }, // conferido com o crachá real: peso 400, menor e mais alto que no pacote
  valores: { x: 51, tam: 32, max: 585, nome: 372, setor: 437, matricula: 523, empresa: 605 },
  rotulos: { nome: 337, setor: 404, matricula: 485, empresa: 565 },
  logoNoModelo: { x: 130, y: 856, w: 400, h: 86 }, // onde fica o logotipo na frente
} as const

// Valores fixos do verso
export const SETOR = 'FECHAMENTO'
export const EMPRESA = 'GRUPO COSAMPA'
export const AVISO = ['Este crachá é de uso pessoal e', 'intransferível. Uso obrigatório durante', 'a permanência na empresa.']

const K = 2 // desenha em 2x o tamanho do modelo para o texto ficar nítido
const W = LAYOUT.largura * K
const H = LAYOUT.altura * K
const F = "'Poppins', 'Segoe UI', sans-serif"
const TINTA = '#0B1011'
const FUNDO = '#D1D3D4'
const PRETO = '#090F10'
const ANEL = '#BDBFC1'
const SEM_FOTO = '#E4E5E6'
const BRANCO = '#FFFFFF'

type G = CanvasRenderingContext2D

async function fontes(): Promise<void> {
  // A folha de estilo da Poppins já está na página (main.tsx); aqui só espera os pesos usados.
  try {
    const f = typeof document !== 'undefined' ? document.fonts : undefined
    if (!f?.load) return
    await Promise.all(['300 30px Poppins', '400 30px Poppins', '600 30px Poppins', '700 30px Poppins'].map((x) => f.load(x, 'AÁÚÇ')))
  } catch {
    // sem a fonte, o desenho sai com a reserva (Segoe UI)
  }
}

async function imagem(url: string): Promise<HTMLImageElement> {
  const i = new Image()
  i.src = url
  await i.decode()
  return i
}

function tela(w = W, h = H): [HTMLCanvasElement, G] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (!g) throw new Error('Canvas 2D indisponível')
  g.imageSmoothingQuality = 'high'
  return [c, g]
}

interface OpcoesTexto { peso?: number; tam: number; max?: number; alinhar?: CanvasTextAlign; cor?: string }

// Escreve o texto sem passar da largura máxima (diminui a fonte se precisar). Medidas em pixels do modelo.
function texto(g: G, txt: string, x: number, base: number, { peso = 400, tam, max = 590, alinhar = 'left', cor = TINTA }: OpcoesTexto) {
  if (!txt) return
  let t = tam * K
  g.font = `${peso} ${t}px ${F}`
  while (g.measureText(txt).width > max * K && t > 10) {
    t -= 1
    g.font = `${peso} ${t}px ${F}`
  }
  g.fillStyle = cor
  g.textAlign = alinhar
  g.textBaseline = 'alphabetic'
  g.fillText(txt, x * K, base * K)
}

function circulo(g: G, cx: number, cy: number, r: number, cor: string) {
  g.fillStyle = cor
  g.beginPath()
  g.arc(cx * K, cy * K, r * K, 0, Math.PI * 2)
  g.fill()
}

function anel(g: G, cx: number, cy: number, r: number, espessura: number, cor: string) {
  g.strokeStyle = cor
  g.lineWidth = espessura * K
  g.beginPath()
  g.arc(cx * K, cy * K, r * K, 0, Math.PI * 2)
  g.stroke()
}

// Grade de 5 x 3 pontos, a partir do primeiro ponto (x, y)
function pontos(g: G, x: number, y: number) {
  for (let l = 0; l < 3; l++) for (let c = 0; c < 5; c++) circulo(g, x + c * 29.8, y + l * 23, 5.5, ANEL)
}

let caminhoLogo: Path2D | null = null

// Logo "GRUPO COSAMPA" com a largura w (a altura segue a proporção do desenho)
function logo(g: G, x: number, y: number, w: number, cor: string, k = K) {
  caminhoLogo ??= new Path2D(LOGO_D)
  const s = (w * k) / LOGO_LARGURA
  g.save()
  g.translate(x * k, y * k)
  g.scale(s, s)
  g.fillStyle = cor
  g.fill(caminhoLogo, 'evenodd')
  g.restore()
}

const LOGO_W = 384 // largura do logo no modelo; a altura fica 384 x 1310 / 6813 = 74

// Frente em branco: curva preta, anéis, pontos, círculo da foto, logo e meia-lua
function modeloCosampaFrente(g: G) {
  g.fillStyle = FUNDO
  g.fillRect(0, 0, W, H)
  // curva preta do topo: um círculo enorme, com o centro acima e à direita do crachá
  circulo(g, 700, -700, 1040, PRETO)
  // anel grande à esquerda, cortado pela borda
  anel(g, -38, 373, 178, 44, ANEL)
  pontos(g, 69, 582)
  // anel fino em volta da foto e o círculo da foto
  const { cx, cy, r } = LAYOUT.foto
  anel(g, cx, cy, r + 30, 7, ANEL)
  circulo(g, cx, cy, r, SEM_FOTO)
  logo(g, 135, 862, LOGO_W, TINTA)
  // meia-lua preta embaixo
  circulo(g, 498, 1037, 55, PRETO)
}

// Verso em branco: curva preta com o logo branco, rótulos, aviso e pontos. Sem número de emergência.
function modeloCosampaVerso(g: G) {
  g.fillStyle = FUNDO
  g.fillRect(0, 0, W, H)
  g.fillStyle = PRETO
  g.beginPath()
  g.moveTo(0, 0)
  g.lineTo(W, 0)
  g.lineTo(W, 265 * K)
  g.bezierCurveTo(400 * K, 270 * K, 150 * K, 190 * K, 0, 65 * K)
  g.closePath()
  g.fill()
  logo(g, 135, 97, LOGO_W, BRANCO)
  const R = LAYOUT.rotulos
  const rotulos: [string, number][] = [['Nome:', R.nome], ['Setor:', R.setor], ['Matrícula:', R.matricula], ['Empresa:', R.empresa]]
  for (const [rotulo, base] of rotulos) texto(g, rotulo, 51, base, { peso: 700, tam: 24 })
  AVISO.forEach((l, i) => texto(g, l, 53, 686 + i * 27.5, { peso: 300, tam: 26 }))
  pontos(g, 479, 885)
}

/** Frente do crachá (data URL PNG, 1298 x 2078). Sem foto, as iniciais entram no círculo. */
export async function frente(p: Pessoa): Promise<string> {
  await fontes()
  const [c, g] = tela()
  modeloCosampaFrente(g)

  const { cx, cy, r } = LAYOUT.foto
  if (p.foto) {
    const foto = await imagem(p.foto)
    const s = Math.max((2 * r * K) / foto.width, (2 * r * K) / foto.height)
    g.save()
    g.beginPath()
    g.arc(cx * K, cy * K, r * K, 0, Math.PI * 2)
    g.clip()
    g.drawImage(foto, cx * K - (foto.width * s) / 2, cy * K - (foto.height * s) / 2, foto.width * s, foto.height * s)
    g.restore()
  } else {
    const I = LAYOUT.iniciais
    texto(g, iniciais(p.nome), I.x, I.base, { peso: 700, tam: I.tam, max: 330, alinhar: 'center', cor: '#2A2F31' })
  }
  const A = LAYOUT.apelido
  texto(g, p.nome.trim().toUpperCase(), A.x, A.base, { peso: 700, tam: A.tam, max: A.max, alinhar: 'center' })
  desenharCargo(g, p.cargo.trim().toUpperCase())
  return c.toDataURL('image/png')
}

const CARGO_MIN = 26 // menor que isso, numa linha só, fica difícil de ler: o cargo vai para 2 linhas
const CARGO_2_LINHAS = { tam: 28, bases: [796, 828] } // entre o apelido e o logotipo

/** Cargo numa linha se couber num tamanho legível; senão em 2, quebrado no espaço que deixa as linhas mais parelhas. */
function desenharCargo(g: G, txt: string) {
  const C = LAYOUT.cargo
  const palavras = txt.split(/\s+/).filter(Boolean)
  g.font = `400 ${CARGO_MIN * K}px ${F}`
  if (palavras.length < 2 || g.measureText(txt).width <= C.max * K) {
    texto(g, txt, C.x, C.base, { peso: 400, tam: C.tam, max: C.max, alinhar: 'center' })
    return
  }
  let corte = 1
  let maisLarga = Infinity
  for (let i = 1; i < palavras.length; i++) {
    const w = Math.max(g.measureText(palavras.slice(0, i).join(' ')).width, g.measureText(palavras.slice(i).join(' ')).width)
    if (w < maisLarga) {
      maisLarga = w
      corte = i
    }
  }
  const linhas = [palavras.slice(0, corte).join(' '), palavras.slice(corte).join(' ')]
  linhas.forEach((l, i) => texto(g, l, C.x, CARGO_2_LINHAS.bases[i], { peso: 400, tam: CARGO_2_LINHAS.tam, max: C.max, alinhar: 'center' }))
}

/** Verso do crachá (data URL PNG). Setor e empresa são fixos; matrícula vazia fica em branco. */
export async function verso(p: Pessoa): Promise<string> {
  await fontes()
  const [c, g] = tela()
  modeloCosampaVerso(g)
  const V = LAYOUT.valores
  const valores: [string, number][] = [
    [p.nome.trim().toUpperCase(), V.nome],
    [SETOR, V.setor],
    [p.matricula.trim(), V.matricula],
    [EMPRESA, V.empresa],
  ]
  for (const [valor, base] of valores) texto(g, valor, V.x, base, { peso: 300, tam: V.tam, max: V.max })
  return c.toDataURL('image/png')
}

/** Cordão preto com o logo da Cosampa em branco (textura 1024 x 256 do Lanyard). */
export async function cordao(): Promise<string> {
  const [c, g] = tela(1024, 256)
  g.fillStyle = PRETO
  g.fillRect(0, 0, 1024, 256)
  const alt = 120
  const larg = (alt * LOGO_LARGURA) / LOGO_ALTURA
  logo(g, 60, (256 - alt) / 2, larg, 'rgba(255,255,255,0.92)', 1)
  g.fillStyle = 'rgba(255,255,255,0.9)'
  g.beginPath()
  g.arc(970, 128, 10, 0, Math.PI * 2)
  g.fill()
  return c.toDataURL('image/png')
}

// ---- arte já desenhada, guardada em memória --------------------------------------------------
// O painel pode pedir a mesma arte mais de uma vez (o parado de reserva enquanto o 3D carrega, e o 3D):
// a de uma pessoa é desenhada uma vez só. A chave é a lista nome, cargo, matrícula, resumo da foto.

/** Resumo curto de um texto (FNV-1a de 32 bits em hexadecimal): distingue fotos sem guardar a foto na chave. */
function resumo(txt: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < txt.length; i++) {
    h ^= txt.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return `${(h >>> 0).toString(16)}:${txt.length}`
}

/** Chave da arte de uma pessoa: o que for igual aqui desenha igual. */
export function chaveDaPessoa(p: Pessoa): string {
  // em JSON, e não juntando com "|": o nome "A|B" e o cargo "C" não podem dar a mesma chave que "A" e "B|C"
  return JSON.stringify([p.nome, p.cargo, p.matricula, p.foto ? resumo(p.foto) : ''])
}

const MAX_GUARDADAS = 4 // as últimas pessoas; mais que isso só gastaria memória (cada arte são alguns MB)
const guardadas = new Map<string, Promise<{ f: string; v: string }>>()
let cordaoPronto: Promise<string> | null = null

/** Frente e verso da pessoa, desenhados uma vez só enquanto os dados forem os mesmos. */
export function arteGuardada(p: Pessoa): Promise<{ f: string; v: string }> {
  const chave = chaveDaPessoa(p)
  const ja = guardadas.get(chave)
  if (ja) return ja
  const nova = Promise.all([frente(p), verso(p)]).then(([f, v]) => ({ f, v }))
  guardadas.set(chave, nova)
  // quem falhou não fica guardado (a próxima tentativa desenha de novo)
  nova.catch(() => {
    if (guardadas.get(chave) === nova) guardadas.delete(chave)
  })
  while (guardadas.size > MAX_GUARDADAS) guardadas.delete(guardadas.keys().next().value as string)
  return nova
}

/** Cordão (igual para todos), desenhado uma vez só. */
export function cordaoGuardado(): Promise<string> {
  if (cordaoPronto) return cordaoPronto
  const novo = cordao()
  cordaoPronto = novo
  novo.catch(() => {
    if (cordaoPronto === novo) cordaoPronto = null
  })
  return novo
}

/** Esvazia a memória da arte (para testes). */
export function esquecerArte(): void {
  guardadas.clear()
  cordaoPronto = null
}
