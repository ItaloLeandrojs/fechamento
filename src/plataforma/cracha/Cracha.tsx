// Escolhe o crachá: 3D no computador que aguenta (podeCracha3D), parado nos outros casos.
// O 3D vem num pedaço separado (lazy). Enquanto carrega, e se der qualquer erro
// (WebGL, física, modelo), aparece o crachá parado.
import { Component, lazy, Suspense, useState, type ReactNode } from 'react'
import type { Pessoa } from '../pessoa'
import { CrachaParado } from './CrachaParado'
import { podeCracha3D } from './podeCracha3D'

const Cracha3D = lazy(() => import('./Cracha3D'))

class Protecao extends Component<{ reserva: ReactNode; children: ReactNode }, { erro: boolean }> {
  state = { erro: false }
  static getDerivedStateFromError() {
    return { erro: true }
  }
  render() {
    return this.state.erro ? this.props.reserva : this.props.children
  }
}

// Mesma altura padrão do Cracha3D: enquanto o 3D carrega, o espaço já fica reservado (sem salto de layout)
const ALTURA_3D = 640

// `pessoa` precisa ser estável (mesma referência entre renders): a arte é redesenhada quando ela muda
export function Cracha({ pessoa, altura = ALTURA_3D }: { pessoa: Pessoa; altura?: number }) {
  const [tres] = useState(podeCracha3D)
  const parado = <CrachaParado pessoa={pessoa} />
  if (!tres) return parado
  return (
    <Protecao reserva={parado}>
      <Suspense fallback={<div style={{ height: altura, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{parado}</div>}>
        <Cracha3D pessoa={pessoa} altura={altura} />
      </Suspense>
    </Protecao>
  )
}
