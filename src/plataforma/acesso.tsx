// Caminho do login até o painel, nesta ordem: confere a sessão guardada, entrada (e-mail e senha),
// senha nova obrigatória, foto na primeira vez neste navegador e as bases. Cuida também do
// "Sair", da sessão que vence no meio do trabalho e das telas de "Trocar senha" e "Trocar foto".
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { fonteSupabase, nuvem, sessaoSoNestaAba } from '../nuvem/supabase'
import { mensagemDeErro, perfilAtual, sair as sairDaNuvem, type Perfil } from '../nuvem/sessao'
import { Entrada } from './Entrada'
import { NovaSenha } from './NovaSenha'
import { EscolherFoto } from './EscolherFoto'
import { Preparando, type Bases } from './Preparando'
import { fotoAntiga, gravarFoto, lerFoto, marcarPulouFoto, pessoaDoPerfil, pulouFoto, type Pessoa } from './pessoa'

const fonte = nuvem ? fonteSupabase(nuvem) : null

const CONFIRMA_SAIR = 'Sair? O que foi lançado nesta obra será perdido.'
const CONFIRMA_VENCIDA = 'Sua sessão terminou. O que foi lançado nesta obra será perdido.'
const AVISO_VENCIDA = 'Sua sessão terminou. Entre de novo.'
const SENHA_TROCADA = 'Senha trocada.'

type Fase = 'conferindo' | 'entrada' | 'senha' | 'foto' | 'preparando' | 'pronto'

// depois da senha: foto na primeira vez neste navegador (sem foto guardada e sem ter pulado), senão as bases
function depoisDaSenha(p: Perfil, foto: string | null): Fase {
  return foto === null && !pulouFoto(p.id) ? 'foto' : 'preparando'
}

export interface Acesso {
  /** tela do caminho até o painel; null quando está tudo pronto */
  tela: ReactNode
  /** muda a cada troca de tela do caminho (para voltar ao topo) */
  etapa: string
  pessoa: Pessoa | null
  bases: Bases | null
  /** avisos para o painel: bases antigas, senha trocada */
  avisos: string[]
  semGuardar: boolean
  sair: () => void
  trocarFoto: () => void
  trocarSenha: () => void
}

/**
 * `temTrabalho` decide se o "Sair" (e a sessão vencida) pergunta antes; `aoSair` limpa a obra e
 * o resto do App (as bases ficam no navegador, a foto também).
 */
export function useAcesso({ temTrabalho, aoSair }: { temTrabalho: boolean; aoSair: () => void }): Acesso {
  const [fase, setFase] = useState<Fase>(nuvem ? 'conferindo' : 'entrada')
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [foto, setFoto] = useState<string | null>(null)
  const [sugerida, setSugerida] = useState<string | null>(null)
  // a senha digitada na entrada, só enquanto a troca obrigatória não termina
  const [senhaDaEntrada, setSenhaDaEntrada] = useState<string | undefined>(undefined)
  const [aviso, setAviso] = useState<string | undefined>(undefined)
  const [bases, setBases] = useState<Bases | null>(null)
  const [extra, setExtra] = useState<'senha' | 'foto' | null>(null)
  const [senhaTrocada, setSenhaTrocada] = useState(false)
  const [vencida, setVencida] = useState(false)

  const aoSairAtual = useRef(aoSair)
  useEffect(() => {
    aoSairAtual.current = aoSair
  }, [aoSair])
  // o "Sair" do painel também dispara SIGNED_OUT: esse não é sessão vencida
  const saindo = useRef(false)
  const perguntou = useRef(false)

  const seguir = useCallback((p: Perfil) => {
    const f = lerFoto(p.id)
    setPerfil(p)
    setFoto(f)
    if (p.senhaInicial) return setFase('senha')
    const proxima = depoisDaSenha(p, f)
    if (proxima === 'foto') setSugerida(fotoAntiga())
    setFase(proxima)
  }, [])

  const encerrar = useCallback((avisoNovo?: string) => {
    aoSairAtual.current()
    setPerfil(null)
    setFoto(null)
    setSugerida(null)
    setSenhaDaEntrada(undefined)
    setBases(null)
    setExtra(null)
    setSenhaTrocada(false)
    setVencida(false)
    perguntou.current = false
    setAviso(avisoNovo)
    setFase('entrada')
  }, [])

  // 1. sessão guardada: enquanto responde, tela vazia (a entrada não pisca)
  useEffect(() => {
    if (!nuvem) return
    let viva = true
    perfilAtual(nuvem)
      .then((p) => {
        if (!viva) return
        if (p) seguir(p)
        else setFase('entrada')
      })
      .catch((e) => {
        if (!viva) return
        setAviso(mensagemDeErro(e))
        setFase('entrada')
      })
    return () => {
      viva = false
    }
  }, [seguir])

  // sessão que venceu (ou saiu em outra aba): volta para a entrada
  useEffect(() => {
    if (!nuvem) return
    const { data } = nuvem.auth.onAuthStateChange((evento) => {
      if (evento !== 'SIGNED_OUT' || saindo.current) return
      // fora do aviso do Supabase: ele não deve esperar o confirm
      setTimeout(() => setVencida(true), 0)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!vencida) return
    // ainda na entrada: não havia sessão de verdade, nada a fazer
    if (!perfil) return setVencida(false)
    if (temTrabalho) {
      // pergunta uma vez; quem cancela continua a obra e sai quando ela terminar
      if (perguntou.current) return
      perguntou.current = true
      if (!confirm(CONFIRMA_VENCIDA)) return
    }
    encerrar(AVISO_VENCIDA)
  }, [vencida, perfil, temTrabalho, encerrar])

  const sair = async () => {
    if (temTrabalho && !confirm(CONFIRMA_SAIR)) return
    saindo.current = true
    try {
      if (nuvem) await sairDaNuvem(nuvem)
    } catch {
      // sem internet a sessão local sai do mesmo jeito
    } finally {
      saindo.current = false
    }
    encerrar()
  }

  // grava a foto da pessoa; false = não coube (a tela da foto avisa e fica)
  const guardarFoto = (f: string | null): boolean => {
    if (!perfil) return true
    const { gravou } = gravarFoto(perfil.id, f)
    // navegador que não guarda nada: a foto vale só nesta aba (o painel já avisa)
    if (!gravou && f !== null && !sessaoSoNestaAba) return false
    if (f === null) marcarPulouFoto(perfil.id)
    setFoto(f)
    return true
  }

  let tela: ReactNode = null
  if (fase === 'conferindo') tela = <main className="pl pl-vazio" aria-busy="true" />
  else if (fase === 'entrada')
    tela = (
      <Entrada
        aviso={aviso}
        onEntrou={(p, senha) => {
          setAviso(undefined)
          setSenhaDaEntrada(senha)
          seguir(p)
        }}
      />
    )
  else if (fase === 'senha' && perfil)
    tela = (
      <NovaSenha
        obrigatoria
        senhaAtual={senhaDaEntrada}
        onSair={() => void sair()}
        onPronto={() => {
          const p = { ...perfil, senhaInicial: false }
          setPerfil(p)
          setSenhaDaEntrada(undefined)
          const proxima = depoisDaSenha(p, foto)
          if (proxima === 'foto') setSugerida(fotoAntiga())
          setFase(proxima)
        }}
      />
    )
  else if (fase === 'foto')
    tela = (
      <EscolherFoto
        fotoAtual={foto}
        sugerida={sugerida}
        onPronto={(f) => {
          if (!guardarFoto(f)) return false
          setSugerida(null)
          setFase('preparando')
        }}
      />
    )
  else if (fase === 'preparando' && fonte)
    tela = (
      <Preparando
        fonte={fonte}
        onPronto={(b) => {
          setBases(b)
          setFase('pronto')
        }}
        onSair={() => void sair()}
      />
    )
  else if (extra === 'senha')
    tela = (
      <NovaSenha
        obrigatoria={false}
        onPronto={() => {
          setSenhaTrocada(true)
          setExtra(null)
        }}
        onCancelar={() => setExtra(null)}
      />
    )
  else if (extra === 'foto')
    tela = (
      <EscolherFoto
        fotoAtual={foto}
        sugerida={sugerida}
        onPronto={(f) => {
          if (!guardarFoto(f)) return false
          setSugerida(null)
          setExtra(null)
        }}
      />
    )

  const pronto = fase === 'pronto' && tela === null
  return {
    tela,
    etapa: `${fase}:${extra ?? ''}`,
    pessoa: pronto && perfil ? pessoaDoPerfil(perfil, foto) : null,
    bases: pronto ? bases : null,
    avisos: [...(bases?.avisos ?? []), ...(senhaTrocada ? [SENHA_TROCADA] : [])],
    semGuardar: sessaoSoNestaAba,
    sair: () => void sair(),
    trocarFoto: () => {
      setSenhaTrocada(false)
      setSugerida(fotoAntiga())
      setExtra('foto')
    },
    trocarSenha: () => {
      setSenhaTrocada(false)
      setExtra('senha')
    },
  }
}
