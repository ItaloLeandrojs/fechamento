// Ajuste da foto do crachá antes de entrar: a foto aparece atrás de um círculo do mesmo formato
// do círculo do crachá; arrastar (mouse ou dedo), pinçar, roda do mouse, controle de zoom e teclado.
// O que está dentro do círculo é exatamente o recorte que vai para o crachá (as contas ficam em recorte.ts).
// É um <dialog> modal: o resto da página fica inerte, o foco fica preso dentro e Esc cancela.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { MagnifyingGlassMinus, MagnifyingGlassPlus } from '@phosphor-icons/react'
import { arrastar, mudarZoom, retanguloDaPrevia, ZOOM_MAX, ZOOM_MIN, type Ajuste } from './recorte'

// o círculo ocupa 80% do quadro: a sobra em volta mostra, apagado, o que fica de fora
const CIRCULO = 0.8
const PASSO_TECLA = 10 // px de tela por seta (com Shift, 4x)
const PASSO_ZOOM = 0.1
const FUNDO = '#131315' // --bg
const VERDE = '#5abd79' // --accent

const vezes = (z: number) => `${z.toFixed(1).replace('.', ',')}×`

export function AjusteFoto({ imagem, inicial, onUsar, onCancelar }: { imagem: ImageBitmap; inicial: Ajuste; onUsar: (a: Ajuste) => void; onCancelar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const tela = useRef<HTMLCanvasElement>(null)
  const [ajuste, setAjuste] = useState(inicial)
  const { width: w, height: h } = imagem

  // ponteiros na área (1 = arrastar, 2 = pinçar)
  const ponteiros = useRef(new Map<number, { x: number; y: number }>())
  const diametro = () => (area.current?.clientWidth ?? 1) * CIRCULO

  useEffect(() => {
    const d = dialogo.current
    if (d && !d.open) d.showModal()
    area.current?.focus()
  }, [])

  const desenhar = useCallback(() => {
    const c = tela.current
    const g = c?.getContext('2d')
    if (!c || !g) return
    const f = c.clientWidth
    if (!f) return
    const dpr = window.devicePixelRatio || 1
    const px = Math.round(f * dpr)
    if (c.width !== px || c.height !== px) {
      c.width = px
      c.height = px
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    // a conta fica em recorte.ts (testada): o círculo mostra o mesmo quadrado que o recorte grava
    const p = retanguloDaPrevia(w, h, ajuste, f, CIRCULO)
    const d = p.circulo.diametro
    const meio = p.circulo.cx

    g.fillStyle = FUNDO
    g.fillRect(0, 0, f, f)
    // o recorte vai com fundo branco (PNG transparente): a prévia também
    g.beginPath()
    g.arc(meio, meio, d / 2, 0, Math.PI * 2)
    g.fillStyle = '#ffffff'
    g.fill()
    g.imageSmoothingQuality = 'high'
    g.drawImage(imagem, p.x, p.y, p.largura, p.altura)
    // fora do círculo fica apagado: é o que não vai para o crachá
    g.beginPath()
    g.rect(0, 0, f, f)
    g.arc(meio, meio, d / 2, 0, Math.PI * 2)
    g.fillStyle = 'rgb(19 19 21 / 0.74)'
    g.fill('evenodd')
    g.beginPath()
    g.arc(meio, meio, d / 2, 0, Math.PI * 2)
    g.lineWidth = 2
    g.strokeStyle = VERDE
    g.stroke()
  }, [ajuste, imagem, w, h])

  useLayoutEffect(desenhar, [desenhar])

  // a área muda de tamanho (girar o celular, janela): redesenha na nova medida.
  // Um observador só, criado uma vez; ele chama o desenho mais recente pelo ref
  // e só redesenha se o tamanho mudou de fato (o aviso inicial não desenha de novo).
  const desenharAgora = useRef(desenhar)
  useLayoutEffect(() => {
    desenharAgora.current = desenhar
  }, [desenhar])
  useEffect(() => {
    const el = tela.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (el.width !== Math.round(el.clientWidth * (window.devicePixelRatio || 1))) desenharAgora.current()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // roda do mouse: precisa de ouvinte não passivo para a página não rolar junto
  useEffect(() => {
    const el = area.current
    if (!el) return
    const roda = (e: WheelEvent) => {
      e.preventDefault()
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      setAjuste((a) => mudarZoom(w, h, a, a.zoom * Math.exp(-dy * 0.0015)))
    }
    el.addEventListener('wheel', roda, { passive: false })
    return () => el.removeEventListener('wheel', roda)
  }, [w, h])

  const apertar = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }

  const mover = (e: PointerEvent<HTMLDivElement>) => {
    const mapa = ponteiros.current
    const antes = mapa.get(e.pointerId)
    if (!antes) return
    const outros = [...mapa.entries()].filter(([id]) => id !== e.pointerId).map(([, p]) => p)
    const agora = { x: e.clientX, y: e.clientY }
    mapa.set(e.pointerId, agora)
    if (outros.length === 0) {
      const dia = diametro()
      setAjuste((a) => arrastar(w, h, a, agora.x - antes.x, agora.y - antes.y, dia))
      return
    }
    // dois dedos: a distância entre eles muda o zoom; o meio dos dois arrasta (metade do movimento de um dedo)
    const outro = outros[0]
    const dAntes = Math.hypot(antes.x - outro.x, antes.y - outro.y)
    const dAgora = Math.hypot(agora.x - outro.x, agora.y - outro.y)
    const dia = diametro()
    setAjuste((a) => {
      const comZoom = dAntes > 0 ? mudarZoom(w, h, a, (a.zoom * dAgora) / dAntes) : a
      return arrastar(w, h, comZoom, (agora.x - antes.x) / 2, (agora.y - antes.y) / 2, dia)
    })
  }

  const soltar = (e: PointerEvent<HTMLDivElement>) => {
    ponteiros.current.delete(e.pointerId)
  }

  const tecla = (e: KeyboardEvent<HTMLDivElement>) => {
    const passo = e.shiftKey ? PASSO_TECLA * 4 : PASSO_TECLA
    const dia = diametro()
    const mov: Record<string, [number, number]> = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }
    if (mov[e.key]) {
      const [dx, dy] = mov[e.key]
      setAjuste((a) => arrastar(w, h, a, dx, dy, dia))
    } else if (e.key === '+' || e.key === '=' || e.key === 'Add') {
      setAjuste((a) => mudarZoom(w, h, a, a.zoom + PASSO_ZOOM))
    } else if (e.key === '-' || e.key === '_' || e.key === 'Subtract') {
      setAjuste((a) => mudarZoom(w, h, a, a.zoom - PASSO_ZOOM))
    } else return
    e.preventDefault()
  }

  return (
    <dialog
      ref={dialogo}
      className="pl-ajuste"
      aria-labelledby="ajuste-titulo"
      aria-describedby="ajuste-dica"
      // Esc fecha o diálogo (padrão do navegador); fechar sem "Usar foto" é cancelar
      onClose={onCancelar}
    >
      <h2 id="ajuste-titulo">Ajustar a foto</h2>
      <p id="ajuste-dica" className="pl-ajuste-dica">
        Arraste para enquadrar o rosto e use o zoom para aproximar. O que fica dentro do círculo vai para o crachá.
      </p>
      <div
        ref={area}
        className="pl-ajuste-area"
        role="application"
        tabIndex={0}
        aria-label="Posição da foto"
        aria-describedby="ajuste-teclas"
        onPointerDown={apertar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onLostPointerCapture={soltar}
        onKeyDown={tecla}
      >
        <canvas ref={tela} aria-hidden="true" />
      </div>
      <p id="ajuste-teclas" className="pl-ajuste-teclas">
        Teclado: as setas movem a foto, + e - mudam o zoom.
      </p>
      <div className="pl-ajuste-zoom">
        <label htmlFor="ajuste-zoom">Zoom</label>
        <MagnifyingGlassMinus size={18} aria-hidden="true" />
        <input
          id="ajuste-zoom"
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={0.01}
          value={ajuste.zoom}
          aria-valuetext={vezes(ajuste.zoom)}
          onChange={(e) => {
            const z = Number(e.target.value)
            setAjuste((a) => mudarZoom(w, h, a, z))
          }}
        />
        <MagnifyingGlassPlus size={18} aria-hidden="true" />
        <output htmlFor="ajuste-zoom" aria-hidden="true">
          {vezes(ajuste.zoom)}
        </output>
      </div>
      <div className="pl-ajuste-botoes">
        <button type="button" className="pl-ajuste-cancelar" onClick={() => dialogo.current?.close()}>
          Cancelar
        </button>
        <button type="button" className="pl-botao pl-ajuste-usar" onClick={() => onUsar(ajuste)}>
          Usar foto
        </button>
      </div>
    </dialog>
  )
}
