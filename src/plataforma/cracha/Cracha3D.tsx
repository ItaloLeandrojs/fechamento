// Crachá 3D pendurado no cordão (dá para puxar com o mouse), com frente, verso e cordão desenhados pela arte.ts.
// Carregado sob demanda (lazy) pelo Cracha.tsx: three, drei e rapier ficam fora do pacote inicial.
import { useEffect, useState } from 'react'
import type { Pessoa } from '../pessoa'
import { arteGuardada, cordaoGuardado } from './arte'
import Lanyard from './Lanyard'

export default function Cracha3D({ pessoa, altura = 640 }: { pessoa: Pessoa; altura?: number }) {
  const [arte, setArte] = useState<{ f: string; v: string; c: string } | null>(null)
  const [erro, setErro] = useState<unknown>(null)

  useEffect(() => {
    let vivo = true
    // arte guardada: se o parado de reserva já desenhou esta pessoa, aqui não desenha de novo
    Promise.all([arteGuardada(pessoa), cordaoGuardado()])
      .then(([{ f, v }, c]) => { if (vivo) setArte({ f, v, c }) })
      .catch((e) => { if (vivo) setErro(e ?? new Error('Falha ao desenhar o crachá')) })
    return () => { vivo = false }
  }, [pessoa])

  // sem a arte não há crachá: a proteção do Cracha.tsx troca pelo parado
  if (erro) throw erro

  return (
    <div
      style={{ position: 'relative', height: altura }}
      role="img"
      aria-label={`Crachá de ${pessoa.nome}, ${pessoa.cargo}. Dá para puxar com o mouse.`}
    >
      {arte && <Lanyard position={[0, 0, 13]} gravity={[0, -40, 0]} frontImage={arte.f} backImage={arte.v} lanyardImage={arte.c} lanyardWidth={1} />}
    </div>
  )
}
