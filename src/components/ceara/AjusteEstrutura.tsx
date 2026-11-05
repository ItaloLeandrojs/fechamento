import { useId, useMemo, useState, type FormEvent } from 'react'
import { ArrowCounterClockwise, MagnifyingGlass, PencilSimple } from '@phosphor-icons/react'
import { Botao, Campo, Quantidade, Selo } from '../ui'
import { casa, formatarQtd, normalizar } from '../../lib/busca'
import { ehQuilo } from '../../state'
import type { BaseEnel, Linha } from '../../ceara/contagem'
import { adicionarNovo, arred, chaveKit, kitDe, limpar, linhasDoKit, type Ajuste, type LinhaEstrat, type MaterialNovo, type Unidade } from '../../ceara/estratificacao'

const UNIDADES: Unidade[] = ['UN', 'M', 'KG']
const MAX_RESULTADOS = 20

const nome = (l: { descricao: string; codigo: string }) => l.descricao || l.codigo
const qtdUn = (n: number, un: string) => `${formatarQtd(n)} ${ehQuilo(un) ? 'kg' : un}`.trim()

/**
 * Material dentro de uma estrutura da Adição de estrutura: deixa o kit da Enel igual ao que saiu
 * do almoxarifado. Tira o que não foi usado, muda a quantidade (por estrutura) e adiciona o código
 * usado no lugar. O que sobra fica na estrutura; o a mais e o novo vão em Adição de material.
 */
export function AjusteEstrutura({ linha, base, ajuste, onChange }: {
  linha: Linha
  base: BaseEnel
  ajuste: Ajuste | undefined
  onChange: (a: Ajuste | undefined) => void
}) {
  const chave = chaveKit(linha.codigo)
  const kit = useMemo(() => kitDe(base, chave) ?? [], [base, chave])
  const linhas = linhasDoKit(base, chave, ajuste)
  const id = useId()
  const [busca, setBusca] = useState('')
  const [aviso, setAviso] = useState('')
  const [maoAberta, setMaoAberta] = useState(false)
  const [mao, setMao] = useState<{ codigo: string; descricao: string; unidade: Unidade }>({ codigo: '', descricao: '', unidade: 'UN' })
  const [erroMao, setErroMao] = useState('')

  // catálogo normalizado uma vez por base
  const catalogo = useMemo(
    () => Object.entries(base.materiais).map(([codigo, [descricao, unidade]]) => ({ codigo, descricao, unidade, texto: normalizar(`${codigo} ${descricao}`) })),
    [base],
  )
  const achados = useMemo(() => {
    if (normalizar(busca).length < 2) return []
    const r: typeof catalogo = []
    for (const m of catalogo) {
      if (casa(m.texto, busca)) r.push(m)
      if (r.length >= MAX_RESULTADOS) break
    }
    return r
  }, [busca, catalogo])

  const mudar = (a: Ajuste) => onChange(limpar(a, kit))
  const atual = (): Ajuste => ({ qtd: { ...(ajuste?.qtd ?? {}) }, novos: [...(ajuste?.novos ?? [])] })

  const mudarQtd = (l: LinhaEstrat, n: number) => {
    const a = atual()
    if (l.situacao === 'novo') a.novos = a.novos.map((x) => (x.codigo === l.codigo ? { ...x, qtd: arred(n) } : x))
    else a.qtd[l.codigo] = arred(n)
    mudar(a)
  }
  const tirar = (codigo: string) => {
    const a = atual()
    a.novos = a.novos.filter((x) => x.codigo !== codigo)
    mudar(a)
  }

  // código que já é do kit: leva até a linha dele, onde se muda a quantidade
  const irParaKit = (codigo: string) => {
    const tr = document.getElementById(`${id}-${codigo}`)
    tr?.scrollIntoView({ block: 'center' })
    tr?.querySelector<HTMLInputElement>('input[inputmode="decimal"]')?.focus({ preventScroll: true })
    setAviso(`${codigo} já está no kit: mude a quantidade na linha dele.`)
  }
  const adicionar = (novo: MaterialNovo) => {
    const r = adicionarNovo(ajuste, kit, base, novo)
    if (r.noKit) return irParaKit(novo.codigo)
    onChange(r.ajuste)
    setAviso(`${novo.codigo} adicionado com 1 por estrutura.`)
    return true
  }

  const enviarMao = (e: FormEvent) => {
    e.preventDefault()
    const codigo = mao.codigo.trim()
    const descricao = mao.descricao.trim()
    if (!codigo || !descricao) return setErroMao('Preencha o código e a descrição.')
    setErroMao('')
    adicionar({ codigo, qtd: 1, foraDoCatalogo: { descricao, unidade: mao.unidade } })
    setMao({ codigo: '', descricao: '', unidade: 'UN' })
    setMaoAberta(false)
  }

  const saem = linhas.filter((l) => l.situacao === 'nao-usado' || l.situacao === 'diminuiu')
  const vao = linhas.filter((l) => l.situacao === 'a-mais' || l.situacao === 'novo')
  const postes = linha.origem.slice(0, 12).join(', ') + (linha.origem.length > 12 ? ` e mais ${linha.origem.length - 12}` : '')

  return (
    <section aria-labelledby={`${id}-t`} className="grid gap-4 px-4 md:px-5 py-4">
      <div className="flex flex-wrap items-start gap-x-5 gap-y-2">
        <div className="min-w-0">
          <h3 id={`${id}-t`} className="num text-lg font-semibold tracking-[-0.02em] break-words">
            Material de {linha.codigo}
          </h3>
          {base.estruturas[chave] && <p className="text-sm text-muted break-words">{base.estruturas[chave]}</p>}
          <p className="mt-1 text-sm text-muted">
            <span className="num font-semibold text-text">{formatarQtd(linha.quantidade)}</span> na obra{postes ? `: ${postes}` : ''}. Quantidades por estrutura.
          </p>
        </div>
        {ajuste && (
          <Botao variante="secundario" className="ml-auto text-sm" onClick={() => onChange(undefined)}>
            <ArrowCounterClockwise size={18} /> Voltar ao kit original
          </Botao>
        )}
      </div>

      <div className="overflow-x-auto rounded-ctl border border-line" tabIndex={0} role="region" aria-label={`Kit de ${linha.codigo}`}>
        <table className="w-full min-w-[500px] text-sm">
          <thead className="border-b border-line-strong text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium w-20">Entra</th>
              <th className="px-2 py-2 font-medium">Material</th>
              <th className="px-2 py-2 font-medium text-right">No kit</th>
              <th className="px-3 py-2 font-medium text-right">Usado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {linhas.map((l) => {
              const fora = l.situacao === 'nao-usado'
              return (
                <tr key={l.codigo} id={`${id}-${l.codigo}`}>
                  <td className="px-3 py-2.5 align-top">
                    {l.situacao === 'novo' ? (
                      <Botao variante="perigo" className="-ml-2 px-2 text-sm" aria-label={`Tirar ${nome(l)}`} onClick={() => tirar(l.codigo)}>
                        Tirar
                      </Botao>
                    ) : (
                      <input
                        type="checkbox"
                        checked={!fora}
                        aria-label={`Entra: ${nome(l)}`}
                        onChange={(e) => mudarQtd(l, e.target.checked ? l.noKit : 0)}
                        className="accent-[var(--accent)] size-5 mt-1"
                      />
                    )}
                  </td>
                  <td className="px-2 py-2.5 align-top">
                    <span className={`block break-words ${fora ? 'line-through text-muted' : ''}`}>{nome(l)}</span>
                    <span className="num block text-xs text-muted">
                      {l.codigo}
                      {l.unidade && ` · ${l.unidade}`}
                    </span>
                    <Situacao l={l} />
                  </td>
                  <td className="px-2 py-2.5 align-top text-right num">{l.situacao === 'novo' ? '-' : formatarQtd(l.noKit)}</td>
                  <td className="px-3 py-1.5 align-top text-right">
                    <Quantidade valor={l.usado} onChange={(n) => mudarQtd(l, n)} rotulo={`Quantidade usada de ${nome(l)} por estrutura`} emQuilo={ehQuilo(l.unidade)} passo={1} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {(saem.length > 0 || vao.length > 0) && (
        <div className="rounded-ctl border border-line px-4 py-3">
          <h4 className="font-semibold tracking-[-0.01em]">O que mudou em relação ao kit</h4>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {saem.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted">Sai da estrutura</p>
                <ul className="mt-1 grid gap-1">
                  {saem.map((l) => (
                    <li key={l.codigo} className="text-sm break-words">
                      {nome(l)}: <span className="num">retira {qtdUn(l.retirada, l.unidade)}</span>
                      {l.situacao === 'nao-usado' ? ' (não usado)' : ` (fica ${qtdUn(l.fica, l.unidade)})`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {vao.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted">Vai em Adição de material</p>
                <ul className="mt-1 grid gap-1">
                  {vao.map((l) => (
                    <li key={l.codigo} className="text-sm break-words">
                      {nome(l)}: <span className="num">+{qtdUn(l.aMais, l.unidade)} por estrutura</span>
                      {linha.quantidade !== 1 && <span className="num text-muted"> ({qtdUn(arred(l.aMais * linha.quantidade), l.unidade)} na obra)</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-2 max-w-[560px]">
        <Campo
          rotulo="Adicionar material do almoxarifado"
          type="search"
          autoComplete="off"
          placeholder="Código ou descrição do catálogo E4E"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {normalizar(busca).length >= 2 && (
          achados.length ? (
            <ul className="divide-y divide-line rounded-ctl border border-line" aria-label="Materiais do catálogo">
              {achados.map((m) => (
                <li key={m.codigo} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="num block font-semibold">{m.codigo}</span>
                    <span className="block text-xs text-muted break-words">
                      {m.descricao} · {m.unidade}
                    </span>
                  </span>
                  <Botao
                    variante="secundario"
                    className="text-sm shrink-0"
                    aria-label={`Adicionar ${m.codigo} ${m.descricao}`}
                    onClick={() => {
                      if (adicionar({ codigo: m.codigo, qtd: 1 })) setBusca('')
                    }}
                  >
                    Adicionar
                  </Botao>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted">
              <MagnifyingGlass size={16} /> Nada no catálogo com "{busca.trim()}".
            </p>
          )
        )}
        <p role="status" className="text-sm text-muted">
          {aviso}
        </p>
      </div>

      <div className="grid gap-3">
        <Botao
          variante="fantasma"
          className="justify-self-start -ml-2 px-2 text-sm"
          aria-expanded={maoAberta}
          aria-controls={maoAberta ? `${id}-mao` : undefined}
          onClick={() => setMaoAberta((v) => !v)}
        >
          <PencilSimple size={18} /> Não achei no catálogo: digitar à mão
        </Botao>
        {maoAberta && (
          <form id={`${id}-mao`} onSubmit={enviarMao} noValidate className="grid gap-3 sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)_minmax(0,110px)_auto] sm:items-end">
            <Campo rotulo="Código" required value={mao.codigo} onChange={(e) => setMao({ ...mao, codigo: e.target.value })} />
            <Campo rotulo="Descrição" required value={mao.descricao} onChange={(e) => setMao({ ...mao, descricao: e.target.value })} />
            <div className="grid gap-1.5">
              <label htmlFor={`${id}-un`} className="text-xs font-medium text-muted">
                Unidade
              </label>
              <select
                id={`${id}-un`}
                value={mao.unidade}
                onChange={(e) => setMao({ ...mao, unidade: e.target.value as Unidade })}
                className="h-12 w-full rounded-ctl border border-line-strong bg-surface px-3 text-base text-text focus:border-text focus:outline-none"
              >
                {UNIDADES.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </div>
            <Botao type="submit" variante="secundario" className="sm:h-12">
              Adicionar
            </Botao>
            {erroMao && (
              <p role="alert" className="text-sm text-danger sm:col-span-4">
                {erroMao}
              </p>
            )}
            <p className="text-xs text-muted sm:col-span-4">Entra como novo, fora do catálogo: a linha sai em vermelho no Excel para conferir.</p>
          </form>
        )}
      </div>
    </section>
  )
}

/** O que acontece na Enel com o material, sempre em palavra ao lado da cor. */
function Situacao({ l }: { l: LinhaEstrat }) {
  if (l.situacao === 'igual') return null
  const linha = 'mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs'
  if (l.situacao === 'nao-usado')
    return (
      <span className={linha}>
        <Selo tom="perigo">não usado</Selo>
      </span>
    )
  if (l.situacao === 'diminuiu')
    return (
      <span className={linha}>
        <Selo tom="aviso">diminuiu</Selo> <span className="num">retira {qtdUn(l.retirada, l.unidade)} da estrutura</span>
      </span>
    )
  if (l.situacao === 'a-mais')
    return (
      <span className={linha}>
        <Selo tom="aviso">a mais</Selo> <span className="num">estrutura fica igual, +{qtdUn(l.aMais, l.unidade)} em Adição de material</span>
      </span>
    )
  return (
    <span className={linha}>
      <Selo tom="ok">novo</Selo> <span>vai em Adição de material</span>
      {l.foraDoCatalogo && (
        <>
          <Selo tom="perigo">fora do catálogo</Selo> <span>conferir</span>
        </>
      )}
    </span>
  )
}
