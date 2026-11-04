// Entrada da plataforma (rascunho B · Grafite): foto da linha viva ao fundo, "Fechamento" gigante
// com a linha verde que liga, e o formulário com os dados do crachá. Tudo fica só neste navegador.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { Camera } from '@phosphor-icons/react'
import { Marca } from '../components/Logo'
import { gravarPessoa, type Pessoa } from './pessoa'
import { reduzirFoto } from './foto'
import './plataforma.css'

const FOTO_FUNDO = `${import.meta.env.BASE_URL}plataforma/entrada.webp`
const ERRO_FOTO = 'Não consegui abrir essa foto. Use JPG ou PNG.'
const FOTO_NAO_COUBE = 'A foto não coube neste navegador; o crachá fica com as iniciais.'

export function Entrada({ onEntrar }: { onEntrar: (p: Pessoa) => void }) {
  const [nome, setNome] = useState('')
  const [cargo, setCargo] = useState('')
  const [matricula, setMatricula] = useState('')
  const [foto, setFoto] = useState<string | null>(null)
  const [preparando, setPreparando] = useState(false)
  const [erroFoto, setErroFoto] = useState(false)
  const [naoCoube, setNaoCoube] = useState(false)
  const [invalido, setInvalido] = useState<'nome' | 'cargo' | null>(null)
  const refNome = useRef<HTMLInputElement>(null)
  const refCargo = useRef<HTMLInputElement>(null)
  // só a última foto escolhida vale (se a pessoa trocar antes da anterior terminar)
  const pedido = useRef(0)

  useEffect(() => {
    // no celular o foco automático abriria o teclado por cima da foto
    if (window.matchMedia?.('(pointer: fine)').matches) refNome.current?.focus()
  }, [])

  const escolherFoto = async (arquivo: File | undefined) => {
    setErroFoto(false)
    setNaoCoube(false)
    if (!arquivo) return
    const meu = ++pedido.current
    setPreparando(true)
    try {
      const reduzida = await reduzirFoto(arquivo, 480)
      if (meu === pedido.current) setFoto(reduzida)
    } catch {
      if (meu === pedido.current) {
        setFoto(null)
        setErroFoto(true)
      }
    } finally {
      if (meu === pedido.current) setPreparando(false)
    }
  }

  const entrar = (e: FormEvent) => {
    e.preventDefault()
    if (preparando) return
    const p: Pessoa = { nome: nome.trim(), cargo: cargo.trim(), matricula: matricula.trim(), foto }
    // só espaços não vale: o foco vai para o primeiro campo vazio, já com o erro na tela
    // (flushSync desenha o erro antes do foco, para o leitor de tela ler o campo com a descrição)
    if (!p.nome) {
      flushSync(() => setInvalido('nome'))
      refNome.current?.focus()
      return
    }
    if (!p.cargo) {
      flushSync(() => setInvalido('cargo'))
      refCargo.current?.focus()
      return
    }
    const { gravouFoto } = gravarPessoa(p)
    if (!gravouFoto && p.foto !== null) {
      // fica nesta tela para a pessoa ler o aviso; o próximo "Entrar" segue sem a foto
      pedido.current++
      setFoto(null)
      setNaoCoube(true)
      return
    }
    onEntrar(p)
  }

  return (
    <main className="pl pl-entrada">
      <img className="pl-foto" src={FOTO_FUNDO} alt="" width={1920} height={1080} decoding="async" fetchPriority="high" />
      <div className="pl-logo">
        <Marca altura={40} />
      </div>
      <span className="pl-selo">Foto provisória</span>
      <div className="pl-bloco">
        <div>
          <h1>Fecha&shy;mento</h1>
          <span className="pl-energia" aria-hidden="true" />
          <p>As ferramentas da equipe de fechamento num lugar só: Ceará, Sergipe e EDP.</p>
        </div>
        <form className="pl-form" onSubmit={entrar} noValidate>
          <label>
            Nome
            <input
              ref={refNome}
              name="nome"
              maxLength={60}
              autoComplete="name"
              required
              aria-invalid={invalido === 'nome' || undefined}
              aria-describedby={invalido === 'nome' ? 'entrada-nome-erro' : undefined}
              placeholder="Ex.: Maria Souza"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value)
                if (invalido === 'nome') setInvalido(null)
              }}
            />
          </label>
          {invalido === 'nome' && (
            <p id="entrada-nome-erro" className="pl-erro pl-erro-campo">
              Preencha o nome.
            </p>
          )}
          <label>
            Cargo
            <input
              ref={refCargo}
              name="cargo"
              maxLength={60}
              autoComplete="organization-title"
              required
              aria-invalid={invalido === 'cargo' || undefined}
              aria-describedby={invalido === 'cargo' ? 'entrada-cargo-erro' : undefined}
              placeholder="Ex.: Analista de fechamento"
              value={cargo}
              onChange={(e) => {
                setCargo(e.target.value)
                if (invalido === 'cargo') setInvalido(null)
              }}
            />
          </label>
          {invalido === 'cargo' && (
            <p id="entrada-cargo-erro" className="pl-erro pl-erro-campo">
              Preencha o cargo.
            </p>
          )}
          <label>
            <span>
              Matrícula <small>(opcional)</small>
            </span>
            <input name="matricula" maxLength={20} autoComplete="off" placeholder="Ex.: 0000" value={matricula} onChange={(e) => setMatricula(e.target.value)} />
          </label>
          <div className="pl-campo-foto">
            <span id="entrada-foto-rotulo">
              Foto <small>(opcional)</small>
            </span>
            <div className="pl-foto-linha">
              <span className={`pl-miniatura${foto ? ' tem' : ''}`}>{foto ? <img src={foto} alt="" /> : <Camera size={22} aria-hidden="true" />}</span>
              <label className="pl-escolher">
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  aria-labelledby="entrada-foto-rotulo entrada-foto-acao"
                  aria-describedby={erroFoto ? 'entrada-foto-erro' : undefined}
                  onChange={(e) => {
                    void escolherFoto(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
                <span id="entrada-foto-acao">{preparando ? 'Preparando a foto…' : foto ? 'Trocar foto' : 'Escolher foto'}</span>
              </label>
              {foto && !preparando && (
                <button
                  type="button"
                  className="pl-tirar"
                  onClick={() => {
                    pedido.current++
                    setFoto(null)
                  }}
                >
                  Remover
                </button>
              )}
            </div>
            {erroFoto && (
              <p id="entrada-foto-erro" className="pl-erro" role="alert">
                {ERRO_FOTO}
              </p>
            )}
          </div>
          <button className="pl-botao" type="submit" aria-disabled={preparando || undefined}>
            Entrar <span aria-hidden="true">→</span>
          </button>
          {/* a região viva fica sempre na página; só o texto entra e sai (assim o leitor de tela anuncia) */}
          <div role="status">{naoCoube && <p className="pl-aviso-foto">{FOTO_NAO_COUBE}</p>}</div>
          <p className="pl-nota">Seus dados ficam guardados só neste navegador.</p>
        </form>
      </div>
    </main>
  )
}
