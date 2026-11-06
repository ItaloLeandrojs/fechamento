// Estado do bloco "Mão de obra" da Leitura do CAD: as respostas da obra, guardadas por OT neste
// computador (IndexedDB, com uma cópia no localStorage ao fechar a página), a contagem do desenho e as linhas finais. Separado da tela para ir depois
// para a aba "Mão de obra" do visual novo sem reescrever nada.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ResultadoCeara } from '../../ceara/contagem'
import { contarDesenhoMO, type DesenhoMO } from '../../ceara/contagemMO'
import type { Area } from '../../ceara/excel'
import { limparRespostas, montarLinhas, respostasVazias, type BaseMaoDeObra, type LinhaMO, type RespostasMO } from '../../ceara/maoDeObra'
import { gravarRespostasMO, guardarPendenteMO, lerPendenteMO, lerRespostasMO, tirarPendenteMO } from '../../lib/banco'

/** A mesma regra da OT do Excel (Ceara.tsx). */
const OT_VALIDA = /^\d{7}$|^\d{11}$/
/** Cada mudança espera este tempo antes de gravar (várias seguidas viram uma gravação só). */
const ATRASO = 400

const mesmas = (a: RespostasMO, b: RespostasMO) =>
  JSON.stringify([a.tensionar, a.fases, a.linhaViva, a.mudancas]) === JSON.stringify([b.tensionar, b.fases, b.linhaViva, b.mudancas])

/**
 * `resp.ot` diz de qual OT são as respostas na tela ('' = feitas sem OT válida, ainda sem lugar no banco).
 * Com OT válida: lê o que está guardado; sem nada guardado, começa do zero, a não ser que as respostas
 * na tela ainda não tenham OT (aí passam a ser dessa OT, para não perder o que já foi respondido).
 */
export function useMaoDeObra(resultado: ResultadoCeara | null, base: BaseMaoDeObra | null, area: Area, ot: string) {
  const chaveOt = OT_VALIDA.test(ot.trim()) ? ot.trim() : ''
  const [resp, setResp] = useState<RespostasMO>(() => respostasVazias(''))
  const [semBanco, setSemBanco] = useState(() => typeof indexedDB === 'undefined')
  // conta as leituras do banco: cada uma aplica a limpeza pelo desenho de novo
  const [lidas, setLidas] = useState(0)
  const sujo = useRef(false)
  const respRef = useRef(resp)
  const semBancoRef = useRef(semBanco)
  useEffect(() => {
    respRef.current = resp
    semBancoRef.current = semBanco
  }, [resp, semBanco])

  /** Grava o que está na tela, se mudou e tem OT. `fechando`: a página vai embora, guarda também a cópia síncrona. */
  const gravarAgora = useCallback((fechando = false) => {
    const r = respRef.current
    if (!sujo.current || !r.ot || semBancoRef.current) return
    sujo.current = false
    if (fechando) guardarPendenteMO(r)
    void gravarRespostasMO(r).then((ok) => {
      if (ok) tirarPendenteMO(r)
      else setSemBanco(true)
    })
  }, [])

  const mudar = useCallback((f: (r: RespostasMO) => RespostasMO) => {
    sujo.current = true
    setResp(f)
  }, [])

  // a cópia da última página fechada vai para o banco
  useEffect(() => {
    const p = lerPendenteMO()
    if (p) void gravarRespostasMO(p).then((ok) => ok && tirarPendenteMO(p))
  }, [])

  // troca de OT: grava a anterior antes de ler a nova; OT inválida solta as respostas da OT de antes
  useEffect(() => {
    const atual = respRef.current.ot
    if (chaveOt === atual) return
    if (atual) gravarAgora()
    if (!chaveOt) {
      setResp((r) => ({ ...r, ot: '' }))
      return
    }
    let vivo = true
    void lerRespostasMO(chaveOt).then((noBanco) => {
      if (!vivo) return
      // a cópia de quando a página fechou é mais nova que o banco
      const guardada = lerPendenteMO(chaveOt) ?? noBanco
      setResp((r) => {
        if (guardada) {
          sujo.current = false
          return { ...respostasVazias(chaveOt), ...guardada, ot: chaveOt }
        }
        if (r.ot === '') {
          sujo.current = true // as respostas sem OT passam a ser desta: grava
          return { ...r, ot: chaveOt }
        }
        sujo.current = false
        return respostasVazias(chaveOt)
      })
      setLidas((n) => n + 1)
    })
    return () => {
      vivo = false
    }
  }, [chaveOt, gravarAgora])

  // a cada desenho lido (e depois de ler as respostas): sai o que não cabe mais no desenho
  useEffect(() => {
    if (!resultado || !base) return
    setResp((r) => {
      const d = contarDesenhoMO(resultado, base, r)
      const limpa = limparRespostas(r, d, montarLinhas(d, base, r, area))
      if (mesmas(limpa, r)) return r
      sujo.current = true
      return limpa
    })
    // a área não muda as chaves das linhas (a limpeza ao trocar de área não tira nada)
  }, [resultado, base, area, lidas])

  // gravação com atraso, só quando as respostas são da OT do campo
  useEffect(() => {
    if (!sujo.current || !resp.ot || resp.ot !== chaveOt || semBanco) return
    const t = setTimeout(() => gravarAgora(), ATRASO)
    return () => clearTimeout(t)
  }, [resp, chaveOt, semBanco, gravarAgora])

  // fechar ou recarregar a página e esconder a aba gravam na hora (com a cópia síncrona); sair da tela também
  useEffect(() => {
    const fechando = () => gravarAgora(true)
    const escondeu = () => document.visibilityState === 'hidden' && fechando()
    window.addEventListener('pagehide', fechando)
    document.addEventListener('visibilitychange', escondeu)
    return () => {
      window.removeEventListener('pagehide', fechando)
      document.removeEventListener('visibilitychange', escondeu)
      gravarAgora()
    }
  }, [gravarAgora])

  const desenho = useMemo<DesenhoMO | null>(() => (resultado && base ? contarDesenhoMO(resultado, base, resp) : null), [resultado, base, resp])
  const linhas = useMemo<LinhaMO[] | null>(() => (desenho && base ? montarLinhas(desenho, base, resp, area) : null), [desenho, base, resp, area])
  const guardando = !!chaveOt && !semBanco

  return { resp, mudar, desenho, linhas, guardando }
}
