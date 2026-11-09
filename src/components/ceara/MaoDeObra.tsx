import { Fragment, useId, useRef, useState, type ReactNode } from 'react'
import { Info, MagnifyingGlass, Minus, Plus } from '@phosphor-icons/react'
import { Botao, Campo, Painel, Quantidade, Selo } from '../ui'
import { formatarQtd, normalizar } from '../../lib/busca'
import { lerCabo } from '../../ceara/contagem'
import { arred } from '../../ceara/estratificacao'
import type { Area } from '../../ceara/excel'
import type { DesenhoMO } from '../../ceara/contagemMO'
import { buscarVozes, CIDADES_A, letraDaCidade, OUTRA_CIDADE, type Aba, type BaseMaoDeObra, type Letra, type LinhaMO, type RespostasMO } from '../../ceara/maoDeObra'
import type { PerguntaPoste, useMaoDeObra } from './useMaoDeObra'

type Estado = ReturnType<typeof useMaoDeObra>
type Mudar = Estado['mudar']

const ABAS: { aba: Aba; titulo: string; vazio: string; nome: string }[] = [
  { aba: 'adicao', titulo: 'Instalação', vazio: 'Nada na instalação.', nome: 'na Instalação' },
  { aba: 'devolucao', titulo: 'Retirada', vazio: 'Nada na retirada.', nome: 'na Retirada' },
]

// botão de escolha (cidade, desligamento, poste MT): marcado em claro, como o da Área
const escolha = (marcado: boolean) =>
  `press h-12 md:h-11 px-3 sm:px-4 rounded-ctl border text-sm font-semibold whitespace-nowrap ${
    marcado ? 'bg-text text-accent-ink border-text' : 'bg-surface text-muted border-line-strong hover:text-text hover:border-text'
  }`
// ação pequena dentro da linha da tabela (alvo de 32 px)
const ACAO = 'press inline-flex items-center min-h-8 px-1 -mx-1 rounded-md text-xs text-muted underline underline-offset-2 hover:text-text'

const vozNaTela = (voz: string, letra: Letra | null) => (letra ? `${voz}_${letra}` : voz)

// o que falta numa linha (textos de `falta`, separados por "; "): as perguntas sem resposta viram
// "falta responder: ..."; o resto ("voz fora da lista") vira "confira: ..."
const PERGUNTA_DA_FALTA: Record<string, string> = {
  'responda se a MT passa no poste': 'a MT passa no poste?',
  'falta o número de fases': 'fases do cabo',
  'responda se teve desligamento': 'teve desligamento?',
  'escolha a cidade da obra': 'cidade da obra',
}
function textosDaFalta(falta: string): string[] {
  const partes = falta.split('; ')
  const perguntas = partes.filter((p) => p in PERGUNTA_DA_FALTA).map((p) => PERGUNTA_DA_FALTA[p])
  const outras = partes.filter((p) => !(p in PERGUNTA_DA_FALTA))
  return [...(perguntas.length ? [`falta responder: ${perguntas.join(', ')}`] : []), ...(outras.length ? [`confira: ${outras.join(', ')}`] : [])]
}
const origens = (o: string[]) => o.slice(0, 12).join(', ') + (o.length > 12 ? ` e mais ${o.length - 12}` : '')

/**
 * Bloco "Mão de obra" da Leitura do CAD: as perguntas da obra (cidade e desligamento), a linha viva
 * por poste, as tabelas Instalação e Retirada com as perguntas de cada uma, a busca "+ Voz" e a nota
 * do que foi conferido. Sem a lista de vozes, só um aviso: o resto da tela fica igual.
 */
export function MaoDeObra({ base, area, estado }: { base: BaseMaoDeObra | null; area: Area; estado: Estado }) {
  const id = useId()
  if (!base)
    return (
      <Painel className="p-4 md:p-5">
        <h2 className="text-xl font-semibold tracking-[-0.02em]">Mão de obra</h2>
        <p className="mt-1 text-sm text-muted">A lista de mão de obra ainda não chegou ao site. A contagem de estrutura e material continua normal.</p>
      </Painel>
    )
  const { resp, mudar, desenho, linhas, guardando, postes, postesSemLinhaViva } = estado
  if (!desenho || !linhas) return null
  const letra = letraDaCidade(area, resp.cidade)

  return (
    <section aria-labelledby={`${id}-t`} className="rounded-panel border border-line bg-surface min-w-0">
      <div className="px-4 md:px-5 py-4 border-b border-line">
        <h2 id={`${id}-t`} className="text-xl font-semibold tracking-[-0.02em]">
          Mão de obra
        </h2>
        <p className="mt-1 text-sm text-muted max-w-[80ch]">
          Contada pelos postes e vãos do desenho. Responda o que o desenho não diz: o que falta responder fica em vermelho e não soma. Qualquer quantidade pode ser mudada à mão.
        </p>
        {!guardando && (
          <p className="mt-3 flex gap-2 text-sm text-text">
            <Info size={18} weight="bold" className="shrink-0 mt-0.5 text-muted" /> {resp.ot ? 'Este navegador não deixa guardar: as respostas não ficam guardadas.' : 'Sem OT válida: as respostas não ficam guardadas.'}
          </p>
        )}
      </div>

      <PerguntasDaObra resp={resp} mudar={mudar} area={area} letra={letra} />
      <LinhaViva desenho={desenho} postesSem={postesSemLinhaViva} mudar={mudar} />

      {ABAS.map((a) => (
        <TabelaMO
          key={a.aba}
          {...a}
          linhas={linhas.filter((l) => l.aba === a.aba)}
          base={base}
          desenho={desenho}
          resp={resp}
          mudar={mudar}
          letra={letra}
          postes={postes.filter((p) => p.chave.endsWith(a.aba === 'adicao' ? '|1' : '|3'))}
        />
      ))}

      {(desenho.naoCobrado.length > 0 || desenho.semRegra.length > 0) && (
        <div className="grid gap-4 px-4 md:px-5 py-4 text-sm">
          {desenho.naoCobrado.length > 0 && (
            <div>
              <h3 className="font-semibold tracking-[-0.01em]">Conferido e não cobrado</h3>
              <ul className="mt-1 grid gap-1 text-muted">
                {desenho.naoCobrado.map((t) => (
                  <li key={t} className="break-words">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {desenho.semRegra.length > 0 && (
            <div>
              <h3 className="font-semibold tracking-[-0.01em]">
                Sem regra de mão de obra, confira (<span className="num">{desenho.semRegra.length}</span>)
              </h3>
              <p className="mt-1 text-muted">Não somam voz. Se precisar, some à mão pelo "+ Voz".</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {desenho.semRegra.map((s, i) => (
                  <li key={i} className="rounded-md bg-surface-2 px-2 py-1">
                    <span className="text-muted">{s.poste}</span> <span className="num font-medium">{s.texto}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function Grupo({ rotulo, marca, children }: { rotulo: string; marca?: ReactNode; children: ReactNode }) {
  const id = useId()
  return (
    <div role="group" aria-labelledby={id} className="grid gap-1.5 content-start min-w-0">
      <span className="flex flex-wrap items-center gap-2 min-h-6">
        <span id={id} className="text-xs font-medium text-muted">
          {rotulo}
        </span>
        {marca}
      </span>
      {children}
    </div>
  )
}

function PerguntasDaObra({ resp, mudar, area, letra }: { resp: RespostasMO; mudar: Mudar; area: Area; letra: Letra | null }) {
  const cidades = [...CIDADES_A[area].map((c) => ({ valor: c, nome: c })), { valor: OUTRA_CIDADE, nome: 'Outra cidade (B)' }]
  return (
    <div className="grid gap-5 px-4 md:px-5 py-4 border-b border-line lg:grid-cols-[minmax(0,1fr)_auto]">
      <Grupo rotulo="Cidade da obra" marca={letra ? <Selo>sufixo {letra}</Selo> : <Selo tom="perigo">escolha a cidade</Selo>}>
        <div className="flex flex-wrap gap-1.5">
          {cidades.map((c) => (
            <button key={c.valor} type="button" aria-pressed={resp.cidade === c.valor} className={escolha(resp.cidade === c.valor)} onClick={() => mudar((r) => ({ ...r, cidade: c.valor }))}>
              {c.nome}
            </button>
          ))}
        </div>
      </Grupo>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <Grupo rotulo="Teve desligamento?" marca={resp.desligamento === null ? <Selo tom="perigo">falta responder</Selo> : undefined}>
          <div className="flex gap-1.5">
            <button type="button" aria-pressed={resp.desligamento === true} className={escolha(resp.desligamento === true)} onClick={() => mudar((r) => ({ ...r, desligamento: true }))}>
              Sim
            </button>
            <button type="button" aria-pressed={resp.desligamento === false} className={escolha(resp.desligamento === false)} onClick={() => mudar((r) => ({ ...r, desligamento: false }))}>
              Não, foi TET
            </button>
          </div>
        </Grupo>
        {resp.desligamento === true && (
          <Grupo rotulo="Equipamentos operados">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center h-12 md:h-11 rounded-ctl border border-line-strong bg-surface">
                <button
                  type="button"
                  aria-label="Um equipamento a menos"
                  disabled={resp.equipamentos <= 1}
                  className="press grid place-items-center w-11 h-full text-muted hover:text-text disabled:opacity-45 disabled:pointer-events-none"
                  onClick={() => mudar((r) => ({ ...r, equipamentos: Math.max(1, r.equipamentos - 1) }))}
                >
                  <Minus size={18} weight="bold" />
                </button>
                <output className="num w-10 text-center text-base font-semibold">{resp.equipamentos}</output>
                <button type="button" aria-label="Um equipamento a mais" className="press grid place-items-center w-11 h-full text-muted hover:text-text" onClick={() => mudar((r) => ({ ...r, equipamentos: r.equipamentos + 1 }))}>
                  <Plus size={18} weight="bold" />
                </button>
              </span>
              <span className="text-sm text-muted">abrir e fechar = 2 cada</span>
            </div>
          </Grupo>
        )}
      </div>
    </div>
  )
}

/** Linha viva por poste: a do desenho, ligada ou desligada à mão, e a posta à mão em outro poste. */
function LinhaViva({ desenho, postesSem, mudar }: { desenho: DesenhoMO; postesSem: string[]; mudar: Mudar }) {
  const id = useId()
  const [escolhido, setEscolhido] = useState('')
  // uma linha por origem (vários "sem nº" dividem a mesma resposta)
  const postes = desenho.linhaViva.filter((p, i, todos) => todos.findIndex((x) => x.poste === p.poste) === i)
  const poste = postesSem.includes(escolhido) ? escolhido : (postesSem[0] ?? '')
  // igual ao desenho: a resposta sai (o poste sem o texto volta para a lista de "outro poste")
  const trocar = (p: { poste: string; doDesenho: boolean }, vale: boolean) =>
    mudar((r) => {
      const linhaViva = { ...r.linhaViva }
      if (vale === p.doDesenho) delete linhaViva[p.poste]
      else linhaViva[p.poste] = vale
      return { ...r, linhaViva }
    })

  return (
    <div className="px-4 md:px-5 py-4 border-b border-line">
      <h3 className="font-semibold tracking-[-0.01em]">Linha viva</h3>
      {postes.length ? (
        <ul className="mt-1 divide-y divide-line" aria-label="Postes com linha viva">
          {postes.map((p) => (
            <li key={p.poste} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
              <span className="num font-semibold min-w-14">{p.poste}</span>
              <Selo tom={p.vale ? 'aviso' : 'neutro'}>{p.vale ? 'com linha viva' : 'sem linha viva'}</Selo>
              {p.vale !== p.doDesenho && <span className="text-xs text-muted">mudado à mão</span>}
              <button type="button" className={ACAO} aria-label={`${p.vale ? 'Tirar a linha viva' : 'Pôr linha viva'} do ${p.poste}`} onClick={() => trocar(p, !p.vale)}>
                {p.vale ? 'Tirar a linha viva' : 'Pôr linha viva'}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted">Nenhum poste com o texto LINHA VIVA em cima da etiqueta.</p>
      )}
      {postesSem.length > 0 && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-poste`} className="text-xs font-medium text-muted">
              Pôr linha viva em outro poste
            </label>
            <select
              id={`${id}-poste`}
              value={poste}
              onChange={(e) => setEscolhido(e.target.value)}
              className="num h-12 md:h-11 min-w-28 rounded-ctl border border-line-strong bg-surface px-3 text-base text-text focus:border-text focus:outline-none"
            >
              {postesSem.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <Botao variante="secundario" className="text-sm" onClick={() => poste && trocar({ poste, doDesenho: false }, true)}>
            Pôr linha viva
          </Botao>
        </div>
      )}
    </div>
  )
}

/** Perguntas de sim ou não (poste MT), respondidas ou não, sempre no mesmo lugar (a resposta pode ser trocada). */
function PerguntasSimNao({ titulo, ajuda, perguntas, valor, responder }: {
  titulo: string
  ajuda: string
  perguntas: { chave: string; texto: string }[]
  valor: (chave: string) => boolean | undefined
  responder: (chave: string, v: boolean) => void
}) {
  const faltam = perguntas.filter((p) => typeof valor(p.chave) !== 'boolean').length
  return (
    <div className="grid gap-2 px-4 md:px-5 pb-3">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{titulo}</span>
        {faltam > 0 ? <Selo tom="perigo">falta responder {faltam}</Selo> : <Selo tom="ok">tudo respondido</Selo>}
      </p>
      <p className="text-xs text-muted">{ajuda}</p>
      <div className="rounded-ctl border border-line-strong bg-bg divide-y divide-line">
        {perguntas.map((p) => {
          const dada = valor(p.chave)
          return (
            <div key={p.chave} role="group" aria-label={p.texto} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5">
              <span className="text-sm min-w-0 flex-1 basis-56">{p.texto}</span>
              {typeof dada !== 'boolean' && <Selo tom="perigo">falta responder</Selo>}
              <span className="flex gap-1.5">
                {[true, false].map((v) => (
                  <button key={String(v)} type="button" aria-pressed={dada === v} className={escolha(dada === v)} onClick={() => responder(p.chave, v)}>
                    {v ? 'Sim' : 'Não'}
                  </button>
                ))}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Fases que valem nesta linha: as perguntas de fases do MT cujo cabo cai na regra por condutor desta voz. */
function fasesDaLinha(l: LinhaMO, base: BaseMaoDeObra, chaves: string[]): { chave: string; cabo: string }[] {
  const situacao = l.aba === 'adicao' ? 'novo' : 'retirado'
  return chaves
    .filter((c) => c.startsWith('fases|'))
    .map((chave) => ({ chave, cabo: chave.slice('fases|'.length) }))
    .filter(({ cabo }) => {
      const c = lerCabo(cabo)
      if (c.grupo !== 'mt') return false
      const regra = base.regrasCabo.find((g) => g.grupo === 'mt' && g.situacao === situacao && (!g.bitolas || g.bitolas.includes(c.bitola)))
      return regra?.voz === l.voz && regra.por === 'condutor'
    })
}

/** Vozes que o desenho conta nesta aba, mesmo as que estão escondidas por dar 0. */
function vozesAutomaticas(aba: Aba, base: BaseMaoDeObra, desenho: DesenhoMO, resp: RespostasMO): Set<string> {
  const vozes = new Set(desenho.contagens.filter((c) => c.aba === aba).map((c) => c.voz ?? (c.papel ? base.papeis[c.papel] : '')))
  // o desligamento entra na Instalação (com resposta Sim ou sem resposta)
  if (aba === 'adicao' && resp.desligamento !== false) vozes.add(base.papeis['operacao-equipamento'])
  return vozes
}

function TabelaMO({ aba, titulo, vazio, nome, linhas, base, desenho, resp, mudar, letra, postes }: {
  aba: Aba
  titulo: string
  vazio: string
  nome: string
  linhas: LinhaMO[]
  base: BaseMaoDeObra
  desenho: DesenhoMO
  resp: RespostasMO
  mudar: Mudar
  letra: Letra | null
  postes: PerguntaPoste[]
}) {
  const id = useId()
  const idVoz = `${id}-voz`

  const mudarQtd = (l: LinhaMO, n: number) => {
    const q = arred(n)
    if (l.somada) return mudar((r) => ({ ...r, somadas: r.somadas.map((s) => (s.aba === l.aba && s.voz === l.voz ? { ...s, quantidade: q } : s)) }))
    mudar((r) => {
      const mudancas = { ...r.mudancas }
      // voltou ao número do automático: deixa de ser mudança
      if (q === l.automatico) delete mudancas[l.chave]
      else mudancas[l.chave] = q
      return { ...r, mudancas }
    })
  }
  const voltar = (l: LinhaMO) =>
    mudar((r) => {
      const mudancas = { ...r.mudancas }
      delete mudancas[l.chave]
      return { ...r, mudancas }
    })
  const tirar = (l: LinhaMO) => {
    // a linha some: o foco vai para o "+ Voz" da mesma tabela
    document.getElementById(idVoz)?.focus()
    mudar((r) => ({ ...r, somadas: r.somadas.filter((s) => !(s.aba === l.aba && s.voz === l.voz)) }))
  }
  const setFases = (chave: string, n: number | null) =>
    mudar((r) => {
      const fases = { ...r.fases }
      if (n === null) delete fases[chave]
      else fases[chave] = n
      return { ...r, fases }
    })

  return (
    <div className="border-b border-line">
      <h3 id={`${id}-t`} className="px-4 md:px-5 pt-4 pb-2 text-lg font-semibold tracking-[-0.02em]">
        {titulo} <span className="num text-muted font-medium">({linhas.length})</span>
      </h3>
      {/* em cima da tabela: responder não muda o que fica acima das perguntas, os botões não saem do lugar */}
      {postes.length > 0 && (
        <PerguntasSimNao
          titulo="Poste: a rede de MT passa nele?"
          ajuda="A etiqueta destes postes não tem nada que diga a rede (nem estrutura de MT ou de BT, nem material de MT). Com MT, mesmo junto da BT, o poste é de MT."
          perguntas={postes}
          valor={(chave) => resp.posteMT?.[chave]}
          responder={(chave, v) => mudar((r) => ({ ...r, posteMT: { ...(r.posteMT ?? {}), [chave]: v } }))}
        />
      )}
      {aba === 'adicao' && desenho.tensionarConfira.length > 0 && (
        <p className="flex gap-2 px-4 md:px-5 pb-3 text-sm">
          <Info size={18} weight="bold" className="shrink-0 mt-0.5 text-muted" />
          <span>
            <span className="font-medium">Confira se teve tensionar:</span>{' '}
            {desenho.tensionarConfira.map((t) => `${t.poste} (${t.estruturas.join(', ')})`).join('; ')}. Estes postes têm estrutura nova que ancora cabo. O site não cobra o tensionar: se teve, ponha a voz pelo "+ Voz".
          </span>
        </p>
      )}
      {!linhas.length ? (
        <p className="px-4 md:px-5 pb-3 text-sm text-muted">{vazio}</p>
      ) : (
        <div className="@container overflow-x-auto" tabIndex={0} role="region" aria-labelledby={`${id}-t`}>
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-y border-line-strong text-left text-xs text-muted">
              <tr>
                <th className="pl-4 md:pl-5 pr-2 py-2 font-medium whitespace-nowrap">Nº do serviço</th>
                <th className="px-2 py-2 font-medium">Voz</th>
                <th className="px-2 py-2 font-medium">Unid.</th>
                <th className="px-2 py-2 font-medium">Quantidade</th>
                <th className="pl-2 pr-4 md:pr-5 py-2 font-medium">De onde veio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {linhas.map((l, i) => {
                const vermelha = !!l.falta || !l.numero
                const vt = vozNaTela(l.voz, letra)
                const fases = fasesDaLinha(l, base, desenho.chavesPerguntas)
                return (
                  <Fragment key={l.somada ? `${l.chave}|${i}` : l.chave}>
                    <tr data-chave={l.chave} className={l.falta ? 'bg-danger-soft/50' : ''}>
                      <td className="pl-4 md:pl-5 pr-2 py-2 align-top num font-semibold whitespace-nowrap">{l.numero ?? <span className="text-danger">sem número</span>}</td>
                      <td className="px-2 py-2 align-top min-w-[15rem]">
                        <span className={`num block font-semibold ${vermelha ? 'text-danger' : ''}`}>{vt}</span>
                        {l.descricao && <span className="block text-xs text-muted break-words">{l.descricao}</span>}
                        {l.falta &&
                          textosDaFalta(l.falta).map((t) => (
                            <span key={t} className="block text-xs font-medium text-danger">
                              {t}
                            </span>
                          ))}
                        {(l.confira || l.somada) && (
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            {l.confira && <Selo tom="aviso">confira</Selo>}
                            {l.somada && (
                              <>
                                <Selo>somada à mão</Selo>
                                <button type="button" className={ACAO} aria-label={`tirar ${vt}`} onClick={() => tirar(l)}>
                                  tirar
                                </button>
                              </>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 align-top whitespace-nowrap">{l.unidade || '-'}</td>
                      <td className="px-2 py-2 align-top">
                        <Quantidade valor={l.quantidade} onChange={(n) => mudarQtd(l, n)} rotulo={`Quantidade de ${vt}`} />
                        {l.mudada && (
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <Selo tom="aviso">mudado à mão</Selo>
                            <button type="button" className={ACAO} onClick={() => voltar(l)}>
                              voltar ao automático ({formatarQtd(l.automatico ?? 0)})
                            </button>
                          </span>
                        )}
                      </td>
                      <td className="pl-2 pr-4 md:pr-5 py-2 align-top text-xs text-muted">{origens(l.origem)}</td>
                    </tr>
                    {fases.length > 0 && (
                      <tr className={l.falta ? 'bg-danger-soft/50' : ''}>
                        <td colSpan={5} className="p-0">
                          {/* largura visível da tabela, presa à esquerda quando ela rola de lado */}
                          <div className="sticky left-0 w-[100cqw] grid gap-2 px-4 md:px-5 pb-3">
                            {fases.map((f) => (
                              <Fases key={f.chave} cabo={f.cabo} valor={resp.fases[f.chave]} onChange={(n) => setFases(f.chave, n)} />
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <MaisVoz
        aba={aba}
        nome={nome}
        base={base}
        letra={letra}
        naTabela={new Set(linhas.map((l) => l.voz))}
        doDesenho={vozesAutomaticas(aba, base, desenho, resp)}
        mudar={mudar}
        idBotao={idVoz}
      />
    </div>
  )
}

function Fases({ cabo, valor, onChange }: { cabo: string; valor: number | undefined; onChange: (n: number | null) => void }) {
  const id = useId()
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-ctl border border-line-strong bg-bg px-3 py-2">
      <label htmlFor={id} className="text-sm min-w-0">
        Fases do cabo <span className="num font-semibold">{cabo}</span>
      </label>
      <input
        id={id}
        inputMode="numeric"
        maxLength={1}
        aria-label={`Fases do cabo ${cabo}`}
        className="num h-12 md:h-11 w-14 rounded-ctl border border-line-strong bg-surface text-center text-base focus:border-text focus:outline-none"
        value={valor ?? ''}
        onChange={(e) => {
          const t = e.target.value.replace(/\D/g, '').slice(-1)
          if (!t) return onChange(null)
          const n = Number(t)
          if (n >= 1 && n <= 3) onChange(n)
        }}
      />
      <span className="text-xs text-muted">de 1 a 3</span>
    </div>
  )
}

function MaisVoz({ aba, nome, base, letra, naTabela, doDesenho, mudar, idBotao }: {
  aba: Aba
  nome: string
  base: BaseMaoDeObra
  letra: Letra | null
  naTabela: ReadonlySet<string>
  /** contadas pelo desenho nesta aba, mesmo escondidas por dar 0: somar criaria uma segunda linha da mesma voz */
  doDesenho: ReadonlySet<string>
  mudar: Mudar
  idBotao: string
}) {
  const id = useId()
  const [aberto, setAberto] = useState(false)
  const [termo, setTermo] = useState('')
  const [aviso, setAviso] = useState('')
  const campo = useRef<HTMLInputElement>(null)
  const achados = aberto ? buscarVozes(base, termo, letra) : []
  const buscou = normalizar(termo).length >= 2

  return (
    <div className="grid gap-2 px-4 md:px-5 py-3">
      <Botao
        id={idBotao}
        variante="secundario"
        className="justify-self-start text-sm"
        aria-label={`+ Voz ${nome}`}
        aria-expanded={aberto}
        aria-controls={aberto ? `${id}-busca` : undefined}
        onClick={() => setAberto((v) => !v)}
      >
        + Voz
      </Botao>
      {aberto && (
        <div id={`${id}-busca`} className="grid gap-2 max-w-[640px]">
          <Campo
            ref={campo}
            rotulo={`Buscar voz para somar ${nome}`}
            type="search"
            autoComplete="off"
            placeholder="Voz, descrição ou unidade"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            ajuda={letra ? `Só as vozes com sufixo ${letra}, pela cidade da obra.` : 'Sem cidade escolhida: aparecem as vozes A e B.'}
          />
          {buscou &&
            (achados.length ? (
              <ul className="divide-y divide-line rounded-ctl border border-line" aria-label="Vozes da lista">
                {achados.map((v, i) => {
                  const ja = naTabela.has(v.voz) ? 'já na tabela' : doDesenho.has(v.voz) ? 'contada pelo desenho' : ''
                  const vt = `${v.voz}_${v.letra}`
                  return (
                    <li key={`${vt}|${v.numero}|${i}`} className="flex items-center gap-3 px-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="num block font-semibold">
                          {vt} <span className="font-normal text-muted">{v.numero}</span>
                        </span>
                        <span className="block text-xs text-muted break-words">
                          {v.descricao} · {v.unidade}
                        </span>
                      </span>
                      {ja ? (
                        <Selo>{ja}</Selo>
                      ) : (
                        <Botao
                          variante="secundario"
                          className="text-sm shrink-0"
                          aria-label={`Somar ${vt} ${nome}`}
                          onClick={() => {
                            mudar((r) => (r.somadas.some((s) => s.aba === aba && s.voz === v.voz) ? r : { ...r, somadas: [...r.somadas, { aba, voz: v.voz, quantidade: 1 }] }))
                            setAviso(`${vt} somada ${nome} com 1. Mude a quantidade na linha dela.`)
                            setTermo('')
                            campo.current?.focus()
                          }}
                        >
                          Somar
                        </Botao>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted">
                <MagnifyingGlass size={16} /> Nada na lista com "{termo.trim()}".
              </p>
            ))}
        </div>
      )}
      <p role="status" className="text-sm text-muted empty:hidden">
        {aviso}
      </p>
    </div>
  )
}
