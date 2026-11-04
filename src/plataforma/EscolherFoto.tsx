// Foto do crachá (opcional): na primeira entrada neste navegador e pelo "Trocar foto" do painel.
// A foto escolhida passa pelo ajuste (AjusteFoto): o que vai para o crachá é o recorte quadrado.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Camera } from '@phosphor-icons/react'
import { abrirFoto, recortarFoto } from './foto'
import { ajusteInicial, retanguloOrigem, type Ajuste } from './recorte'
import { AjusteFoto } from './AjusteFoto'
import { MolduraEntrada } from './Entrada'
import { esquecerPessoaAntiga } from './pessoa'

const ERRO_FOTO = 'Não consegui abrir essa foto. Use JPG ou PNG.'
const FOTO_NAO_COUBE = 'A foto não coube neste navegador; o crachá fica com as iniciais.'

// a foto aberta (já reduzida) e o enquadramento; `nova` = ainda não confirmada com "Usar foto"
type Original = { imagem: ImageBitmap; ajuste: Ajuste }
type Edicao = Original & { nova: boolean; id: number }

/**
 * `sugerida` é a foto do registro de antes do login, oferecida uma vez só.
 * `onPronto` devolve `false` quando a foto não coube no navegador: a tela avisa e fica,
 * e o próximo "Continuar" segue sem foto.
 */
export function EscolherFoto({
  fotoAtual,
  sugerida,
  onPronto,
}: {
  fotoAtual: string | null
  sugerida: string | null
  onPronto: (foto: string | null) => boolean | void
}) {
  const [foto, setFoto] = useState<string | null>(fotoAtual)
  const [usouSugerida, setUsouSugerida] = useState(false)
  const [preparando, setPreparando] = useState(false)
  const [erroFoto, setErroFoto] = useState(false)
  const [naoCoube, setNaoCoube] = useState(false)
  // só a última foto escolhida vale (se a pessoa trocar antes da anterior terminar)
  const pedido = useRef(0)
  // a foto confirmada fica guardada inteira para o "Ajustar" reabrir com o mesmo enquadramento
  const [confirmada, setConfirmada] = useState<Original | null>(null)
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  // cópia das duas para soltar a memória ao sair da tela
  const abertas = useRef<{ confirmada: Original | null; edicao: Edicao | null }>({ confirmada: null, edicao: null })
  useEffect(() => {
    abertas.current = { confirmada, edicao }
  }, [confirmada, edicao])
  const refArquivo = useRef<HTMLInputElement>(null)
  const refAjustar = useRef<HTMLButtonElement>(null)
  const refTitulo = useRef<HTMLHeadingElement>(null)
  // depois de fechar o ajuste, o foco volta para "Ajustar" (com foto) ou para o botão de escolher
  const [devolverFoco, setDevolverFoco] = useState(0)

  useEffect(() => {
    // no celular o foco vai para o título, como nas outras telas do login
    ;(window.matchMedia?.('(pointer: fine)').matches ? refArquivo : refTitulo).current?.focus()
  }, [])

  // ao sair da tela, solta as fotos abertas da memória
  useEffect(
    () => () => {
      const { confirmada: c, edicao: e } = abertas.current
      c?.imagem.close()
      if (e?.nova) e.imagem.close()
    },
    [],
  )

  useEffect(() => {
    if (devolverFoco) (refAjustar.current ?? refArquivo.current)?.focus()
  }, [devolverFoco])

  const esquecerConfirmada = () => {
    confirmada?.imagem.close()
    setConfirmada(null)
  }

  const escolherFoto = async (arquivo: File | undefined) => {
    setErroFoto(false)
    setNaoCoube(false)
    if (!arquivo) return
    const meu = ++pedido.current
    setPreparando(true)
    try {
      const imagem = await abrirFoto(arquivo)
      if (meu !== pedido.current) {
        imagem.close()
        return
      }
      // abre o ajuste; a foto anterior (se houver) só sai quando a pessoa clicar em "Usar foto"
      setEdicao({ imagem, ajuste: ajusteInicial(imagem.width, imagem.height), nova: true, id: meu })
    } catch {
      if (meu === pedido.current) {
        esquecerConfirmada()
        setFoto(null)
        setErroFoto(true)
      }
    } finally {
      if (meu === pedido.current) setPreparando(false)
    }
  }

  const usarFoto = async (ajuste: Ajuste) => {
    const e = edicao
    if (!e) return
    setEdicao(null)
    const meu = ++pedido.current
    setPreparando(true)
    try {
      const recorte = await recortarFoto(e.imagem, retanguloOrigem(e.imagem.width, e.imagem.height, ajuste), 480)
      if (meu !== pedido.current) {
        if (e.nova) e.imagem.close()
        return
      }
      if (e.nova && confirmada && confirmada.imagem !== e.imagem) confirmada.imagem.close()
      setConfirmada({ imagem: e.imagem, ajuste })
      setFoto(recorte)
    } catch {
      if (e.nova) e.imagem.close()
      if (meu === pedido.current) setErroFoto(true)
    } finally {
      if (meu === pedido.current) setPreparando(false)
      setDevolverFoco((n) => n + 1)
    }
  }

  const cancelarAjuste = () => {
    if (edicao?.nova) edicao.imagem.close()
    setEdicao(null)
    setDevolverFoco((n) => n + 1)
  }

  const usarSugerida = () => {
    if (!sugerida) return
    pedido.current++
    esquecerConfirmada()
    setErroFoto(false)
    setNaoCoube(false)
    setFoto(sugerida)
    setUsouSugerida(true)
    setDevolverFoco((n) => n + 1)
  }

  const continuar = (e: FormEvent) => {
    e.preventDefault()
    if (preparando) return
    // o registro antigo é oferecido uma vez só: usado, trocado ou pulado, ele sai
    if (sugerida) esquecerPessoaAntiga()
    if (onPronto(foto) === false) {
      // fica nesta tela para a pessoa ler o aviso; o próximo "Continuar" segue sem a foto
      pedido.current++
      esquecerConfirmada()
      setFoto(null)
      setNaoCoube(true)
    }
  }

  const oferecer = !!sugerida && !usouSugerida && foto === null && !preparando

  return (
    <MolduraEntrada>
      <form className="pl-form" onSubmit={continuar} noValidate aria-labelledby="foto-titulo">
        <h2 id="foto-titulo" ref={refTitulo} tabIndex={-1}>Sua foto no crachá</h2>
        <p className="pl-form-dica">É opcional. A foto fica guardada só neste navegador.</p>
        <div className="pl-campo-foto">
          <span id="escolher-foto-rotulo">
            Foto <small>(opcional)</small>
          </span>
          <div className="pl-foto-linha">
            <span className={`pl-miniatura${foto ? ' tem' : ''}`}>{foto ? <img src={foto} alt="" /> : <Camera size={22} aria-hidden="true" />}</span>
            <label className="pl-escolher">
              <input
                ref={refArquivo}
                type="file"
                accept="image/jpeg,image/png"
                aria-labelledby="escolher-foto-rotulo escolher-foto-acao"
                aria-describedby={erroFoto ? 'escolher-foto-erro' : undefined}
                onChange={(e) => {
                  void escolherFoto(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
              <span id="escolher-foto-acao">{preparando ? 'Preparando a foto…' : foto ? 'Trocar foto' : 'Escolher foto'}</span>
            </label>
            {foto && !preparando && (
              <span className="pl-foto-acoes">
                {confirmada && (
                  <button ref={refAjustar} type="button" className="pl-tirar" onClick={() => setEdicao({ ...confirmada, nova: false, id: ++pedido.current })}>
                    Ajustar
                  </button>
                )}
                <button
                  type="button"
                  className="pl-tirar"
                  onClick={() => {
                    pedido.current++
                    esquecerConfirmada()
                    setFoto(null)
                    setDevolverFoco((n) => n + 1)
                  }}
                >
                  Remover
                </button>
              </span>
            )}
          </div>
          {oferecer && (
            <button type="button" className="pl-sugerida" onClick={usarSugerida}>
              <span className="pl-miniatura tem">
                <img src={sugerida} alt="" />
              </span>
              Usar a foto que já estava aqui
            </button>
          )}
          {erroFoto && (
            <p id="escolher-foto-erro" className="pl-erro" role="alert">
              {ERRO_FOTO}
            </p>
          )}
        </div>
        <button className="pl-botao" type="submit" aria-disabled={preparando || undefined}>
          {foto ? 'Continuar' : 'Continuar sem foto'} <span aria-hidden="true">→</span>
        </button>
        {/* a região viva fica sempre na página; só o texto entra e sai (assim o leitor de tela anuncia) */}
        <div role="status">{naoCoube && <p className="pl-aviso-foto">{FOTO_NAO_COUBE}</p>}</div>
      </form>
      {edicao && <AjusteFoto key={edicao.id} imagem={edicao.imagem} inicial={edicao.ajuste} onUsar={(a) => void usarFoto(a)} onCancelar={cancelarAjuste} />}
    </MolduraEntrada>
  )
}
