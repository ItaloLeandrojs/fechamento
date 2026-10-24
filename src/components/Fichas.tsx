import type { ReactNode } from 'react'
import { FileText, Info, Plus, Shovel, Trash, Warning } from '@phosphor-icons/react'
import { IconeTransformador } from './IconeTransformador'
import { novoEquip, novoPonto, type Atualiza, type EquipUI, type PontoUI } from '../state'
import type { Foto } from '../lib/imagem'
import { FotoSlot } from './FotoSlot'
import { Botao, Campo, Painel, Titulo, Vazio } from './ui'

export const LIMITE_PONTOS = 8

/** Cabeçalho de um cartão (ponto ou equipamento): título à esquerda, Remover à direita. */
function CabecaCartao({ titulo, extra, remover, rotuloRemover }: { titulo: ReactNode; extra?: ReactNode; remover: () => void; rotuloRemover: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-5">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3 min-w-0">
        <h2 className="text-lg font-semibold break-words min-w-0 pb-2.5">{titulo}</h2>
        {extra}
      </div>
      <Botao variante="perigo" className="border border-line-strong" aria-label={rotuloRemover} onClick={remover}>
        <Trash size={18} /> Remover
      </Botao>
    </div>
  )
}

// ---------------- aterramento ----------------

export function Aterramento({ pontos, onChange }: { pontos: PontoUI[]; onChange: Atualiza<PontoUI[]> }) {
  const muda = (id: string, patch: Partial<PontoUI>) => onChange((lista) => lista.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const passou = pontos.length > LIMITE_PONTOS
  return (
    <div>
      <Titulo
        titulo="Medição de aterramento"
        sub="Cada ponto ocupa uma linha da tabela da ficha e um bloco com duas fotos: a vala aberta e a medição."
        acao={
          <Botao variante="primario" onClick={() => onChange((l) => [...l, novoPonto()])}>
            <Plus size={18} weight="bold" /> Ponto
          </Botao>
        }
      />
      <p className="flex items-start gap-3 mb-5 max-w-[84ch] rounded-ctl bg-surface-2 px-4 py-3 text-sm">
        <Info size={20} className="shrink-0 mt-0.5 text-muted" aria-hidden="true" />
        <span>
          Com pelo menos um ponto, as linhas da tabela e os blocos de fotos que sobrarem, sem ponto seu, saem da ficha ao baixar, para não ficarem vazios. Sem nenhum ponto, a ficha fica como veio.
        </span>
      </p>
      {passou && (
        <p role="alert" className="flex items-start gap-3 mb-5 rounded-ctl bg-danger-soft text-danger px-4 py-3 text-sm font-medium">
          <Warning size={20} weight="bold" className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            A ficha do inventário tem lugar para {LIMITE_PONTOS} pontos. Por enquanto o site não cria blocos extras: tire {pontos.length - LIMITE_PONTOS} ponto(s) ou complete no Excel.
          </span>
        </p>
      )}
      {!pontos.length ? (
        <Painel>
          <Vazio icone={<Shovel size={32} />} titulo="Nenhum ponto de aterramento" texto="Se a obra não tem aterramento, deixe assim: a ficha fica como veio, nada é apagado. Se tem, clique em Ponto." />
        </Painel>
      ) : (
        <div className="grid gap-5">
          {pontos.map((p, i) => (
            <Painel key={p.id} className="entra p-4 md:p-6">
              <CabecaCartao
                titulo={
                  <>
                    Ponto <span className="num">{i + 1}</span>
                    {p.ponto && <span className="text-muted font-normal"> · {p.ponto}</span>}
                  </>
                }
                rotuloRemover={`Remover ponto ${i + 1}`}
                remover={() => onChange((l) => l.filter((x) => x.id !== p.id))}
              />
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] gap-6 xl:gap-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 content-start">
                  <Campo rotulo="Nº do ponto (projeto)" value={p.ponto} onChange={(e) => muda(p.id, { ponto: e.target.value.toUpperCase() })} placeholder="P1-12" />
                  <Campo rotulo="Rua / avenida / estrada" value={p.rua} onChange={(e) => muda(p.id, { rua: e.target.value.toUpperCase() })} placeholder="RUA DIVINO" />
                  <Campo rotulo="Medição final (Ω)" inputMode="decimal" value={p.ohms} onChange={(e) => muda(p.id, { ohms: e.target.value })} placeholder="19,10" />
                  <Campo rotulo="Qt. hastes" inputMode="numeric" value={p.hastes} onChange={(e) => muda(p.id, { hastes: e.target.value })} placeholder="3" />
                  <div className="grid gap-1.5 sm:col-span-2">
                    <span className="text-xs font-medium text-muted">Tipo do poste</span>
                    <div role="radiogroup" aria-label="Tipo do poste" className="grid grid-cols-2 gap-2 sm:max-w-md">
                      {(['CONC', 'MAD'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          role="radio"
                          aria-checked={p.tipoPoste === t}
                          onClick={() => muda(p.id, { tipoPoste: p.tipoPoste === t ? '' : t })}
                          className={`press h-12 rounded-ctl border text-base ${p.tipoPoste === t ? 'border-text bg-text text-bg font-medium' : 'border-line-strong bg-surface hover:bg-surface-2'}`}
                        >
                          {t === 'CONC' ? 'Concreto' : 'Madeira'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 content-start max-w-[30rem]">
                  <FotoSlot rotulo="Vala aberta" foto={p.fotoVala} onChange={(f) => muda(p.id, { fotoVala: f })} alto />
                  <FotoSlot rotulo="Medição" foto={p.fotoMedicao} onChange={(f) => muda(p.id, { fotoMedicao: f })} alto />
                </div>
              </div>
            </Painel>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------- equipamento ----------------

const CAMPOS_INST: [keyof EquipUI['instalado'], string, string?][] = [
  ['potencia', 'Potência (kVA)', '30'],
  ['patrimonio', 'Patrimônio'],
  ['fase', 'Fase instalação', 'ABC'],
  ['serie', 'Série'],
  ['marca', 'Marca'],
  ['ano', 'Fabricação (mês/ano)', '03/2025'],
  ['nInstalacao', 'Nº da instalação', 'ET 689448'],
]
const CAMPOS_RET: [keyof EquipUI['retirado'], string, string?][] = [
  ['potencia', 'Potência (kVA)'],
  ['patrimonio', 'Patrimônio'],
  ['serie', 'Série'],
  ['marca', 'Marca'],
  ['ano', 'Fabricação (mês/ano)', '03/2025'],
  ['nInstalacao', 'Nº da instalação'],
]

export function Equipamentos({ equips, onChange }: { equips: EquipUI[]; onChange: Atualiza<EquipUI[]> }) {
  const muda = (id: string, fn: (e: EquipUI) => EquipUI) => onChange((l) => l.map((e) => (e.id === id ? fn(e) : e)))
  return (
    <div>
      <Titulo
        titulo="Ficha de equipamento"
        sub="Transformador (ou RE, RV, BC) instalado e retirado, com até duas fotos por equipamento."
        acao={
          <Botao variante="primario" onClick={() => onChange((l) => [...l, novoEquip()])}>
            <Plus size={18} weight="bold" /> Equipamento
          </Botao>
        }
      />
      <p className="flex items-start gap-3 mb-5 max-w-[84ch] rounded-ctl bg-surface-2 px-4 py-3 text-sm">
        <Info size={20} className="shrink-0 mt-0.5 text-muted" aria-hidden="true" />
        <span>Em Fabricação, escreva mês/ano (03/2025) ou só o ano (2025). Na ficha, o valor entra como data do Excel.</span>
      </p>
      {!equips.length ? (
        <Painel>
          <Vazio icone={<IconeTransformador size={32} />} titulo="Nenhum equipamento" texto="Se a obra não teve equipamento, deixe assim. A ficha fica como veio no inventário." />
        </Painel>
      ) : (
        <div className="grid gap-5">
          {equips.map((e, i) => (
            <Painel key={e.id} className="entra p-4 md:p-6">
              <CabecaCartao
                titulo={
                  <>
                    Equipamento <span className="num">{i + 1}</span>
                  </>
                }
                extra={<Campo rotulo="Ponto" value={e.ponto} onChange={(ev) => muda(e.id, (x) => ({ ...x, ponto: ev.target.value.toUpperCase() }))} placeholder="P1-12" className="w-40" />}
                rotuloRemover={`Remover equipamento ${i + 1}`}
                remover={() => onChange((l) => l.filter((x) => x.id !== e.id))}
              />
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] gap-6 xl:gap-8">
                <div className="grid gap-5 content-start">
                  <fieldset className="rounded-ctl border border-line p-4">
                    <legend className="px-1.5 -ml-1.5 text-base font-semibold">Instalado</legend>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3 gap-x-4 gap-y-4 items-end">
                      {CAMPOS_INST.map(([k, r, ph]) => (
                        <Campo key={k} rotulo={r} placeholder={ph} value={e.instalado[k]} onChange={(ev) => muda(e.id, (x) => ({ ...x, instalado: { ...x.instalado, [k]: ev.target.value } }))} />
                      ))}
                    </div>
                    <p className="text-xs font-medium text-muted mt-5 mb-1.5">Tensões (V)</p>
                    <div className="grid grid-cols-3 md:grid-cols-6 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
                      {(Object.keys(e.tensoes) as (keyof EquipUI['tensoes'])[]).map((k) => (
                        <Campo key={k} rotulo={k} inputMode="numeric" value={e.tensoes[k]} onChange={(ev) => muda(e.id, (x) => ({ ...x, tensoes: { ...x.tensoes, [k]: ev.target.value } }))} />
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="rounded-ctl border border-line p-4">
                    <legend className="px-1.5 -ml-1.5 text-base font-semibold">Retirado</legend>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3 gap-x-4 gap-y-4 items-end">
                      {CAMPOS_RET.map(([k, r, ph]) => (
                        <Campo key={k} rotulo={r} placeholder={ph} value={e.retirado[k]} onChange={(ev) => muda(e.id, (x) => ({ ...x, retirado: { ...x.retirado, [k]: ev.target.value } }))} />
                      ))}
                    </div>
                  </fieldset>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 content-start max-w-[28rem]">
                  {[0, 1].map((k) => {
                    const anterior = e.fotos[k]
                    return (
                      <FotoSlot
                        key={k}
                        rotulo={`Foto ${k + 1}`}
                        foto={anterior}
                        alto
                        // a foto é achada pelo endereço (url), não pela posição: duas fotos escolhidas ao mesmo tempo
                        // chegam em qualquer ordem e nenhuma pode sobrescrever a outra
                        onChange={(f?: Foto) =>
                          muda(e.id, (x) => {
                            if (!anterior) return f ? { ...x, fotos: [...x.fotos, f].slice(0, 2) } : x
                            const fotos = f ? x.fotos.map((o) => (o.url === anterior.url ? f : o)) : x.fotos.filter((o) => o.url !== anterior.url)
                            return { ...x, fotos }
                          })
                        }
                      />
                    )
                  })}
                </div>
              </div>
            </Painel>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------- desligamento programado ----------------

export function DP({ tem, foto, onChange }: { tem: boolean; foto?: Foto; onChange: (tem: boolean, foto?: Foto) => void }) {
  return (
    <div>
      <Titulo titulo="Desligamento programado" sub="Sem desligamento, o quadro da aba DP continua escrito LIVRE. Com desligamento, a foto do documento entra inteira no quadro." />
      <Painel className="entra p-4 md:p-6">
        <div className={tem ? 'grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] gap-6 lg:gap-8' : ''}>
          <div className="grid gap-5 content-start">
            <div className="grid gap-2">
              <span className="text-xs font-medium text-muted">A obra teve desligamento?</span>
              <div role="radiogroup" aria-label="Teve desligamento?" className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:max-w-xl">
                {[
                  [false, 'Sem desligamento'],
                  [true, 'Teve desligamento'],
                ].map(([v, r]) => (
                  <button
                    key={String(v)}
                    type="button"
                    role="radio"
                    aria-checked={tem === v}
                    onClick={() => {
                      if (!v && foto) URL.revokeObjectURL(foto.url)
                      onChange(v as boolean, v ? foto : undefined)
                    }}
                    className={`press h-12 px-4 rounded-ctl border text-base ${tem === v ? 'border-text bg-text text-bg font-medium' : 'border-line-strong bg-surface hover:bg-surface-2'}`}
                  >
                    {r as string}
                  </button>
                ))}
              </div>
            </div>
            {tem ? (
              <p className="flex items-start gap-3 text-sm text-muted max-w-[60ch]">
                <FileText size={22} className="shrink-0" aria-hidden="true" />
                Escolha a foto do documento de desligamento. Ela entra inteira no quadro da aba DP, sem cortar.
              </p>
            ) : (
              <p className="flex items-center gap-3 text-sm text-muted">
                <FileText size={22} className="shrink-0" aria-hidden="true" /> O quadro fica LIVRE, como veio no inventário.
              </p>
            )}
          </div>
          {tem && (
            <div className="max-w-[20rem]">
              <FotoSlot rotulo="Foto do documento de desligamento" foto={foto} onChange={(f) => onChange(true, f)} alto />
            </div>
          )}
        </div>
      </Painel>
    </div>
  )
}
