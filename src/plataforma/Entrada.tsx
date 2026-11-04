// Entrada da plataforma (rascunho B · Grafite): foto da linha viva ao fundo, "Fechamento" gigante
// com a linha verde que liga, e o formulário com os dados do crachá. Tudo fica só neste navegador.
// A foto escolhida passa pelo ajuste (AjusteFoto): o que vai para o crachá é o recorte quadrado.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { Camera } from '@phosphor-icons/react'
import { Marca } from '../components/Logo'
import { gravarPessoa, type Pessoa } from './pessoa'
import { abrirFoto, recortarFoto } from './foto'
import { ajusteInicial, retanguloOrigem, type Ajuste } from './recorte'
import { AjusteFoto } from './AjusteFoto'
import './plataforma.css'

const FOTO_FUNDO = `${import.meta.env.BASE_URL}plataforma/entrada.webp`
const ERRO_FOTO = 'Não consegui abrir essa foto. Use JPG ou PNG.'
const FOTO_NAO_COUBE = 'A foto não coube neste navegador; o crachá fica com as iniciais.'

// a foto aberta (já reduzida) e o enquadramento; `nova` = ainda não confirmada com "Usar foto"
type Original = { imagem: ImageBitmap; ajuste: Ajuste }
type Edicao = Original & { nova: boolean; id: number }

export function Entrada({ onEntrar }: { onEntrar: (p: Pessoa, guardou: boolean) => void }) {
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
  // depois de fechar o ajuste, o foco volta para "Ajustar" (com foto) ou para o botão de escolher
  const [devolverFoco, setDevolverFoco] = useState(0)

  useEffect(() => {
    // no celular o foco automático abriria o teclado por cima da foto
    if (window.matchMedia?.('(pointer: fine)').matches) refNome.current?.focus()
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
    const { gravouFoto, guardou } = gravarPessoa(p)
    // navegador que não guarda nada: entra com a foto mesmo (fica só nesta aba) e o painel avisa
    if (guardou && !gravouFoto && p.foto !== null) {
      // fica nesta tela para a pessoa ler o aviso; o próximo "Entrar" segue sem a foto
      pedido.current++
      esquecerConfirmada()
      setFoto(null)
      setNaoCoube(true)
      return
    }
    onEntrar(p, guardou)
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
                  ref={refArquivo}
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
      {edicao && <AjusteFoto key={edicao.id} imagem={edicao.imagem} inicial={edicao.ajuste} onUsar={(a) => void usarFoto(a)} onCancelar={cancelarAjuste} />}
    </main>
  )
}
