// Estado do bloco "Mão de obra" da Leitura do CAD: as respostas da obra, guardadas por OT neste
// computador (IndexedDB, com uma cópia no localStorage ao fechar a página), a contagem do desenho e as
// linhas finais. Separado da tela para ir depois para a aba "Mão de obra" do visual novo sem reescrever nada.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ResultadoCeara } from '../../ceara/contagem'
import { contarDesenhoMO, desdobrar, estruturaMT, type DesenhoMO, type Pergunta } from '../../ceara/contagemMO'
import type { Area } from '../../ceara/excel'
import { limparRespostas, montarLinhas, respostasVazias, type BaseMaoDeObra, type LinhaMO, type RespostasMO } from '../../ceara/maoDeObra'
import { gravarRespostasMO, guardarPendenteMO, lerPendenteMO, lerRespostasMO, tirarPendenteMO } from '../../lib/banco'

/** A mesma regra da OT do Excel (Ceara.tsx). */
const OT_VALIDA = /^\d{7}$|^\d{11}$/
/** Cada mudança espera este tempo antes de gravar (várias seguidas viram uma gravação só). */
const ATRASO = 400

export type PerguntaPoste = Extract<Pergunta, { tipo: 'poste' }>

const mesmas = (a: RespostasMO, b: RespostasMO) =>
  JSON.stringify([a.tensionar, a.fases, a.linhaViva, a.posteMT ?? {}, a.mudancas]) === JSON.stringify([b.tensionar, b.fases, b.linhaViva, b.posteMT ?? {}, b.mudancas])

/** Alguma coisa foi respondida ou mudada. */
const temConteudo = (r: RespostasMO) =>
  r.cidade !== null ||
  r.desligamento !== null ||
  r.equipamentos !== 1 ||
  r.somadas.length > 0 ||
  [r.tensionar, r.fases, r.linhaViva, r.posteMT ?? {}, r.mudancas].some((o) => Object.keys(o).length > 0)

const numeroDoPoste = (origem: string) => (/^P\d+$/.test(origem) ? Number(origem.slice(1)) : Infinity)

/**
 * `resp.ot` diz de qual OT são as respostas na tela ('' = sem OT). Regras:
 * - OT válida: lê o que está guardado (a cópia de quando a página fechou vale mais que o banco).
 *   Sem nada guardado, as respostas que nasceram sem OT passam para ela como "emprestadas"
 *   (`provisorio`): só viram registro dessa OT quando a pessoa mexe em algo ou a página fecha.
 *   As de outra OT nunca passam.
 * - Sair de uma OT (OT inválida ou outra OT): grava a anterior se a pessoa mudou algo nela e limpa
 *   a tela; as emprestadas voltam a ser sem OT, sem gravar (digitar uma OT de 11 dígitos passa por
 *   uma de 7 e não deixa registro nela).
 * - `obra` muda quando o DXF lido é de outra obra (Ceara.tsx, `mesmaObra`): as respostas sem OT ou
 *   emprestadas são daquela obra e saem (sem isso, duas obras sem OT no nome dividiriam as respostas).
 *   Um DXF corrigido da mesma obra não muda `obra` e as respostas ficam.
 * - `versao` sobe a cada mudança; `gravada` é a última versão confirmada no banco: a mudança só
 *   conta como gravada quando o banco confirma. Gravação que falhou fica pendente (e com a cópia no
 *   localStorage) e é tentada de novo na próxima mudança.
 */
export function useMaoDeObra(resultado: ResultadoCeara | null, base: BaseMaoDeObra | null, area: Area, ot: string, obra: number) {
  const chaveOt = OT_VALIDA.test(ot.trim()) ? ot.trim() : ''
  const [resp, setResp] = useState<RespostasMO>(() => respostasVazias(''))
  // só um navegador sem IndexedDB não guarda; uma gravação que falhou não desliga a gravação
  const [semBanco] = useState(() => typeof indexedDB === 'undefined')
  // conta as leituras do banco: cada uma aplica a limpeza pelo desenho de novo
  const [lidas, setLidas] = useState(0)
  const versao = useRef(0)
  const gravada = useRef(0)
  const provisorio = useRef(false)
  const respRef = useRef(resp)
  const obraRef = useRef(obra)
  useEffect(() => {
    respRef.current = resp
  }, [resp])

  /** Grava o que está na tela, se mudou e tem OT. `fechando`: a página (ou a tela) vai embora: grava
   *  também as emprestadas e guarda a cópia síncrona. */
  const gravarAgora = useCallback((fechando = false) => {
    const r = respRef.current
    if (!r.ot || semBanco) return
    const emprestadas = fechando && provisorio.current && temConteudo(r)
    if (versao.current === gravada.current && !emprestadas) return
    if (emprestadas) provisorio.current = false
    if (fechando) guardarPendenteMO(r)
    const v = versao.current
    void gravarRespostasMO(r).then((ok) => {
      // falhou: a versão continua pendente e a cópia guarda a mais nova até a próxima tentativa
      if (!ok) return guardarPendenteMO(r)
      // a tela já está em outra OT: esta foi a última versão daquela OT
      if (respRef.current.ot !== r.ot) return tirarPendenteMO(r.ot)
      gravada.current = Math.max(gravada.current, v)
      if (gravada.current === versao.current) tirarPendenteMO(r.ot)
    })
  }, [semBanco])

  const mudar = useCallback((f: (r: RespostasMO) => RespostasMO) => {
    versao.current++
    provisorio.current = false
    setResp(f)
  }, [])

  // a cópia da última página fechada vai para o banco
  useEffect(() => {
    const p = lerPendenteMO()
    if (p) void gravarRespostasMO(p).then((ok) => ok && tirarPendenteMO(p.ot))
  }, [])

  // outra obra (declarado antes da troca de OT, que roda depois no mesmo DXF): as respostas sem OT
  // ou emprestadas eram da obra de antes e saem; as de uma OT de verdade saem pela troca de OT
  useEffect(() => {
    if (obra === obraRef.current) return
    obraRef.current = obra
    const r = respRef.current
    if (r.ot === '' || provisorio.current) {
      provisorio.current = false
      // emprestadas: a OT delas não tem nada guardado, então fica vazia e é dela
      setResp(respostasVazias(r.ot))
      gravada.current = ++versao.current
    }
  }, [obra])

  // troca de OT
  useEffect(() => {
    const atual = respRef.current.ot
    if (chaveOt === atual) return
    if (atual) {
      if (provisorio.current) {
        // emprestadas e sem mudança: voltam a ser sem OT, nada fica gravado na OT de antes
        setResp((r) => ({ ...r, ot: '' }))
      } else {
        gravarAgora() // só grava se a pessoa mudou algo nela
        setResp(respostasVazias(''))
      }
      provisorio.current = false
      gravada.current = ++versao.current
    }
    if (!chaveOt) return
    let vivo = true
    void lerRespostasMO(chaveOt).then((noBanco) => {
      if (!vivo) return
      // a cópia de quando a página fechou é mais nova que o banco: ainda precisa ir para ele
      const pendente = lerPendenteMO(chaveOt)
      const guardada = pendente ?? noBanco
      setResp((r) => {
        if (guardada) {
          provisorio.current = false
          return { ...respostasVazias(chaveOt), ...guardada, ot: chaveOt }
        }
        if (r.ot === '' && temConteudo(r)) {
          provisorio.current = true
          return { ...r, ot: chaveOt }
        }
        provisorio.current = false
        return respostasVazias(chaveOt)
      })
      gravada.current = ++versao.current
      if (pendente) versao.current++
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
      // registro da OT mudou: grava; emprestadas continuam só emprestadas
      if (r.ot && !provisorio.current) versao.current++
      return limpa
    })
    // a área não muda as chaves das linhas (a limpeza ao trocar de área não tira nada)
  }, [resultado, base, area, lidas])

  // gravação com atraso, só quando as respostas são da OT do campo e mudaram
  useEffect(() => {
    if (!resp.ot || resp.ot !== chaveOt || semBanco || versao.current === gravada.current) return
    const t = setTimeout(() => gravarAgora(), ATRASO)
    return () => clearTimeout(t)
  }, [resp, chaveOt, semBanco, gravarAgora])

  // fechar ou recarregar a página, esconder a aba e sair da tela gravam na hora (com a cópia síncrona)
  useEffect(() => {
    const fechando = () => gravarAgora(true)
    const escondeu = () => document.visibilityState === 'hidden' && fechando()
    window.addEventListener('pagehide', fechando)
    document.addEventListener('visibilitychange', escondeu)
    return () => {
      window.removeEventListener('pagehide', fechando)
      document.removeEventListener('visibilitychange', escondeu)
      fechando()
    }
  }, [gravarAgora])

  const desenho = useMemo<DesenhoMO | null>(() => (resultado && base ? contarDesenhoMO(resultado, base, resp) : null), [resultado, base, resp])
  const linhas = useMemo<LinhaMO[] | null>(() => (desenho && base ? montarLinhas(desenho, base, resp, area) : null), [desenho, base, resp, area])
  // todas as perguntas de poste MT ou BT, respondidas ou não
  const postes = useMemo<PerguntaPoste[]>(() => {
    if (!resultado || !base) return []
    return contarDesenhoMO(resultado, base, { ...resp, posteMT: {} }).perguntas.filter((p): p is PerguntaPoste => p.tipo === 'poste')
  }, [resultado, base, resp])
  // postes com estrutura de MT e sem linha viva: dá para pôr a linha viva à mão (o texto pode faltar no desenho)
  const postesSemLinhaViva = useMemo<string[]>(() => {
    if (!resultado || !desenho) return []
    const comLv = new Set(desenho.linhaViva.map((p) => p.poste))
    const out = new Set<string>()
    for (const e of resultado.etiquetas) {
      const origem = e.poste ? 'P' + e.poste : 'sem nº'
      if (!comLv.has(origem) && desdobrar(e).some((i) => estruturaMT(i))) out.add(origem)
    }
    return [...out].sort((a, b) => numeroDoPoste(a) - numeroDoPoste(b))
  }, [resultado, desenho])
  const guardando = !!chaveOt && !semBanco

  return { resp, mudar, desenho, linhas, guardando, postes, postesSemLinhaViva }
}
