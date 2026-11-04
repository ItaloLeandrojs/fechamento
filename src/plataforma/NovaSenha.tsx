// Senha nova: obrigatória depois de entrar com a senha inicial, ou pedida pelo painel ("Trocar senha").
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { nuvem } from '../nuvem/supabase'
import { mensagemDeErro, trocarSenha } from '../nuvem/sessao'
import { MolduraEntrada } from './Entrada'

export function NovaSenha({
  obrigatoria,
  senhaAtual,
  onPronto,
  onCancelar,
}: {
  obrigatoria: boolean
  /** a senha usada para entrar: a nova não pode ser igual a ela */
  senhaAtual?: string
  onPronto: () => void
  onCancelar?: () => void
}) {
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const refNova = useRef<HTMLInputElement>(null)
  const refTitulo = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    // no celular o foco vai para o título (o teclado não abre sozinho por cima da tela)
    ;(window.matchMedia?.('(pointer: fine)').matches ? refNova : refTitulo).current?.focus()
  }, [])

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (enviando || !nuvem) return
    setErro(null)
    setEnviando(true)
    try {
      await trocarSenha(nuvem, nova, confirma, senhaAtual)
      onPronto()
    } catch (e) {
      flushSync(() => {
        setErro(mensagemDeErro(e))
        setEnviando(false)
      })
      refNova.current?.focus()
    }
  }

  const salvar = (
    <button className="pl-botao" type="submit" aria-disabled={enviando || undefined}>
      {enviando ? 'Salvando...' : 'Salvar senha'} <span aria-hidden="true">→</span>
    </button>
  )

  return (
    <MolduraEntrada>
      <form className="pl-form" onSubmit={enviar} noValidate aria-labelledby="senha-titulo">
        <h2 id="senha-titulo" ref={refTitulo} tabIndex={-1}>{obrigatoria ? 'Crie a sua senha' : 'Trocar senha'}</h2>
        <p className="pl-form-dica">
          {obrigatoria ? 'Antes de continuar, troque a senha inicial por uma só sua.' : 'Escolha a senha nova.'} Use pelo menos 8 caracteres.
        </p>
        <label>
          Senha nova
          <input
            ref={refNova}
            type="password"
            name="nova"
            autoComplete="new-password"
            required
            minLength={8}
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? 'senha-erro' : undefined}
            value={nova}
            onChange={(e) => setNova(e.target.value)}
          />
        </label>
        <label>
          Repita a senha nova
          <input
            type="password"
            name="confirma"
            autoComplete="new-password"
            required
            minLength={8}
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? 'senha-erro' : undefined}
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
          />
        </label>
        {erro && (
          <p id="senha-erro" className="pl-erro" role="alert">
            {erro}
          </p>
        )}
        {onCancelar && !obrigatoria ? (
          <div className="pl-botoes">
            <button type="button" className="pl-secundario" onClick={onCancelar}>
              Cancelar
            </button>
            {salvar}
          </div>
        ) : (
          salvar
        )}
      </form>
    </MolduraEntrada>
  )
}
