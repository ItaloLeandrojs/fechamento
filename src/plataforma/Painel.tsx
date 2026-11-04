// Painel da plataforma (rascunho B · Grafite): o crachá à esquerda, a saudação e a lista
// numerada de regiões. Região "em breve" não navega: mostra o aviso por 2,6 s.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Marca } from '../components/Logo'
import { Cracha } from './cracha/Cracha'
import { primeiroNome, saudacao, type Pessoa } from './pessoa'
import { REGIOES, type RegiaoId } from './regioes'
import './plataforma.css'

// Sergipe vai sem artigo ("Sergipe ainda está em construção.")
const ARTIGO: Record<RegiaoId, string> = { edp: 'A ', ceara: 'O ', sergipe: '' }
const TEMPO_AVISO = 2600
const SEM_GUARDAR = 'Este navegador não guarda seus dados; na próxima vez você terá de preencher de novo.'

export function Painel({
  pessoa,
  semGuardar = false,
  onAbrir,
  onTrocar,
}: {
  pessoa: Pessoa
  /** o navegador não deixou guardar a pessoa */
  semGuardar?: boolean
  onAbrir: (id: RegiaoId) => void
  onTrocar: () => void
}) {
  // a arte do crachá é redesenhada quando o objeto muda: só muda se algum dado mudar
  const { nome, cargo, matricula, foto } = pessoa
  const dados = useMemo(() => ({ nome, cargo, matricula, foto }), [nome, cargo, matricula, foto])

  const titulo = useRef<HTMLHeadingElement>(null)
  useEffect(() => titulo.current?.focus(), [])

  const [aviso, setAviso] = useState('')
  const [visivel, setVisivel] = useState(false)
  const timers = useRef<number[]>([])
  const limpar = () => {
    timers.current.forEach((t) => clearTimeout(t))
    timers.current = []
  }
  useEffect(() => limpar, [])

  const emBreve = (id: RegiaoId, nomeRegiao: string) => {
    limpar()
    setAviso(`${ARTIGO[id]}${nomeRegiao} ainda está em construção.`)
    setVisivel(true)
    // some depois de 2,6 s; o texto sai quando a transição termina (não fica lido escondido)
    timers.current.push(window.setTimeout(() => setVisivel(false), TEMPO_AVISO))
    timers.current.push(window.setTimeout(() => setAviso(''), TEMPO_AVISO + 320))
  }

  return (
    <main className="pl pl-painel">
      <header className="pl-topo">
        <Marca altura={34} />
        <button type="button" className="pl-link" onClick={onTrocar}>
          Trocar pessoa
        </button>
      </header>

      <div className="pl-suporte">
        <Cracha pessoa={dados} />
      </div>

      <section className="pl-conteudo" aria-labelledby="painel-titulo">
        <h1 id="painel-titulo" ref={titulo} tabIndex={-1}>
          {saudacao(new Date().getHours())}, {primeiroNome(nome)}.
        </h1>
        <p>Escolha a região que você vai fechar hoje.</p>
        {semGuardar && <p className="pl-aviso-foto">{SEM_GUARDAR}</p>}
        <ul className="pl-regioes">
          {REGIOES.map((r) => {
            const pronto = r.estado === 'pronto'
            return (
              <li key={r.id} className={`pl-regiao ${pronto ? 'ativa' : 'em-breve'}`}>
                <span className="pl-num" aria-hidden="true">
                  {r.numero}
                </span>
                <div>
                  <h2>
                    <button
                      type="button"
                      aria-disabled={pronto ? undefined : true}
                      aria-describedby={`regiao-${r.id}-estado regiao-${r.id}-descricao`}
                      onClick={() => (pronto ? onAbrir(r.id) : emBreve(r.id, r.nome))}
                    >
                      {r.nome}
                    </button>
                  </h2>
                  <p id={`regiao-${r.id}-descricao`}>{r.descricao}</p>
                </div>
                <span className="pl-estado" id={`regiao-${r.id}-estado`}>
                  {pronto ? (
                    <>
                      Abrir <span aria-hidden="true">→</span>
                    </>
                  ) : (
                    'Em breve'
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <div className={`pl-aviso${visivel ? ' visivel' : ''}`} role="status">
        {aviso}
      </div>
    </main>
  )
}
