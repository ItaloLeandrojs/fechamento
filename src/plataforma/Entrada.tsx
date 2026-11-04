// Entrada da plataforma (rascunho B · Grafite): foto da linha viva ao fundo, "Fechamento" gigante
// com a linha verde que liga, e o formulário de e-mail e senha. As telas seguintes do login
// (senha nova, foto e bases) usam a mesma moldura, com o cartão no lugar do formulário.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { Marca } from '../components/Logo'
import { nuvem } from '../nuvem/supabase'
import { entrar, mensagemDeErro, type Perfil } from '../nuvem/sessao'
import './plataforma.css'

const FOTO_FUNDO = `${import.meta.env.BASE_URL}plataforma/entrada.webp`
const SEM_CONFIGURACAO = 'Site sem configuração do servidor.'

// a linha verde liga uma vez só: nas telas seguintes do login ela já aparece acesa
let linhaLigou = false

/** Fundo, logo, título e linha verde da entrada; `children` é o cartão da direita. */
export function MolduraEntrada({ children }: { children: ReactNode }) {
  const [ligada] = useState(() => linhaLigou)
  useEffect(() => {
    linhaLigou = true
  }, [])
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
          <span className={`pl-energia${ligada ? ' ligada' : ''}`} aria-hidden="true" />
          <p>As ferramentas da equipe de fechamento num lugar só: Ceará, Sergipe e EDP.</p>
        </div>
        {children}
      </div>
    </main>
  )
}

/** Em `onEntrou` vai também a senha digitada: a troca obrigatória confere se a nova é diferente dela. */
export function Entrada({ onEntrou, aviso }: { onEntrou: (p: Perfil, senha: string) => void; aviso?: string }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [invalido, setInvalido] = useState<'email' | 'senha' | null>(null)
  const refEmail = useRef<HTMLInputElement>(null)
  const refSenha = useRef<HTMLInputElement>(null)
  const semServidor = nuvem === null

  useEffect(() => {
    // no celular o foco automático abriria o teclado por cima da foto
    if (window.matchMedia?.('(pointer: fine)').matches) refEmail.current?.focus()
  }, [])

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (enviando || !nuvem) return
    setErro(null)
    // campo vazio: o foco vai para ele, já com o erro na tela
    // (flushSync desenha o erro antes do foco, para o leitor de tela ler o campo com a descrição)
    if (!email.trim()) {
      flushSync(() => setInvalido('email'))
      refEmail.current?.focus()
      return
    }
    if (!senha) {
      flushSync(() => setInvalido('senha'))
      refSenha.current?.focus()
      return
    }
    setEnviando(true)
    try {
      const perfil = await entrar(nuvem, email, senha)
      onEntrou(perfil, senha)
    } catch (e) {
      setErro(mensagemDeErro(e))
      setEnviando(false)
    }
  }

  return (
    <MolduraEntrada>
      <form className="pl-form" onSubmit={enviar} noValidate aria-label="Entrar">
        {(semServidor || aviso) && <p className="pl-aviso-foto">{semServidor ? SEM_CONFIGURACAO : aviso}</p>}
        <label>
          E-mail
          <input
            ref={refEmail}
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={120}
            required
            aria-invalid={invalido === 'email' || undefined}
            aria-describedby={invalido === 'email' ? 'entrada-email-erro' : undefined}
            placeholder="nome@empresa.com.br"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (invalido === 'email') setInvalido(null)
            }}
          />
        </label>
        {invalido === 'email' && (
          <p id="entrada-email-erro" className="pl-erro pl-erro-campo">
            Preencha o e-mail.
          </p>
        )}
        <label>
          Senha
          <input
            ref={refSenha}
            type="password"
            name="senha"
            autoComplete="current-password"
            required
            aria-invalid={invalido === 'senha' || undefined}
            aria-describedby={invalido === 'senha' ? 'entrada-senha-erro' : undefined}
            value={senha}
            onChange={(e) => {
              setSenha(e.target.value)
              if (invalido === 'senha') setInvalido(null)
            }}
          />
        </label>
        {invalido === 'senha' && (
          <p id="entrada-senha-erro" className="pl-erro pl-erro-campo">
            Preencha a senha.
          </p>
        )}
        {erro && (
          <p className="pl-erro" role="alert">
            {erro}
          </p>
        )}
        <button className="pl-botao" type="submit" disabled={semServidor} aria-disabled={enviando || undefined}>
          {enviando ? 'Entrando...' : 'Entrar'} <span aria-hidden="true">→</span>
        </button>
        <p className="pl-nota">Esqueceu a senha? Avise o Italo.</p>
      </form>
    </MolduraEntrada>
  )
}
