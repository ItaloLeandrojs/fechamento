import { FileText, Plus, Shovel, Trash } from '@phosphor-icons/react'
import { IconeTransformador } from './IconeTransformador'
import { novoEquip, novoPonto, type Atualiza, type EquipUI, type PontoUI } from '../state'
import type { Foto } from '../lib/imagem'
import { FotoSlot } from './FotoSlot'
import { Botao, Campo, Painel, Titulo, Vazio } from './ui'

export const LIMITE_PONTOS = 8

// ---------------- aterramento ----------------

export function Aterramento({ pontos, onChange }: { pontos: PontoUI[]; onChange: Atualiza<PontoUI[]> }) {
  const muda = (id: string, patch: Partial<PontoUI>) => onChange((lista) => lista.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const passou = pontos.length > LIMITE_PONTOS
  return (
    <div>
      <Titulo
        titulo="Medição de aterramento"
        sub="Cada ponto ocupa uma linha da tabela da ficha e um bloco com duas fotos: a vala aberta à esquerda e a medição à direita."
        acao={
          <Botao variante="primario" onClick={() => onChange((l) => [...l, novoPonto()])}>
            <Plus size={16} weight="bold" /> Ponto
          </Botao>
        }
      />
      {passou && (
        <p role="alert" className="mb-4 text-sm bg-danger-soft text-danger rounded-ctl p-3">
          A ficha do inventário tem lugar para {LIMITE_PONTOS} pontos. Por enquanto o site não cria blocos extras: tire {pontos.length - LIMITE_PONTOS} ponto(s) ou complete no Excel.
        </p>
      )}
      {!pontos.length ? (
        <Painel>
          <Vazio icone={<Shovel size={28} />} titulo="Nenhum ponto de aterramento" texto="Se a obra não tem aterramento, deixe assim: a ficha fica como veio. Se tem, clique em Ponto." />
        </Painel>
      ) : (
        <div className="grid gap-4">
          {pontos.map((p, i) => (
            <Painel key={p.id} className="entra p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">
                  Ponto <span className="num">{i + 1}</span>
                  {p.ponto && <span className="text-muted font-normal"> · {p.ponto}</span>}
                </h2>
                <Botao variante="perigo" onClick={() => onChange((l) => l.filter((x) => x.id !== p.id))}>
                  <Trash size={16} /> Remover
                </Botao>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
                  <Campo rotulo="Nº do ponto (projeto)" value={p.ponto} onChange={(e) => muda(p.id, { ponto: e.target.value.toUpperCase() })} placeholder="P1-12" />
                  <Campo rotulo="Rua / avenida / estrada" value={p.rua} onChange={(e) => muda(p.id, { rua: e.target.value.toUpperCase() })} placeholder="RUA DIVINO" />
                  <div className="grid gap-1.5">
                    <span className="text-xs font-medium text-muted">Tipo do poste</span>
                    <div role="radiogroup" aria-label="Tipo do poste" className="flex gap-1.5">
                      {(['CONC', 'MAD'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          role="radio"
                          aria-checked={p.tipoPoste === t}
                          onClick={() => muda(p.id, { tipoPoste: p.tipoPoste === t ? '' : t })}
                          className={`press flex-1 h-10 rounded-ctl border text-sm ${p.tipoPoste === t ? 'border-text bg-text text-bg' : 'border-line-strong hover:bg-surface-2'}`}
                        >
                          {t === 'CONC' ? 'Concreto' : 'Madeira'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo rotulo="Medição final (Ω)" inputMode="decimal" value={p.ohms} onChange={(e) => muda(p.id, { ohms: e.target.value })} placeholder="19,10" />
                    <Campo rotulo="Qt. hastes" inputMode="numeric" value={p.hastes} onChange={(e) => muda(p.id, { hastes: e.target.value })} placeholder="3" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
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
  ['ano', 'Fabricação (mês/ano)'],
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
            <Plus size={16} weight="bold" /> Equipamento
          </Botao>
        }
      />
      {!equips.length ? (
        <Painel>
          <Vazio icone={<IconeTransformador size={28} />} titulo="Nenhum equipamento" texto="Se a obra não teve equipamento, deixe assim. A ficha fica como veio no inventário." />
        </Painel>
      ) : (
        <div className="grid gap-4">
          {equips.map((e, i) => (
            <Painel key={e.id} className="entra p-4 md:p-5">
              <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                <div className="flex items-end gap-3">
                  <h2 className="font-semibold pb-2">
                    Equipamento <span className="num">{i + 1}</span>
                  </h2>
                  <Campo rotulo="Ponto" value={e.ponto} onChange={(ev) => muda(e.id, (x) => ({ ...x, ponto: ev.target.value.toUpperCase() }))} placeholder="P1-12" className="w-32" />
                </div>
                <Botao variante="perigo" onClick={() => onChange((l) => l.filter((x) => x.id !== e.id))}>
                  <Trash size={16} /> Remover
                </Botao>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-5">
                <div className="grid gap-5">
                  <fieldset>
                    <legend className="text-sm font-medium mb-2">Instalado</legend>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {CAMPOS_INST.map(([k, r, ph]) => (
                        <Campo key={k} rotulo={r} placeholder={ph} value={e.instalado[k]} onChange={(ev) => muda(e.id, (x) => ({ ...x, instalado: { ...x.instalado, [k]: ev.target.value } }))} />
                      ))}
                    </div>
                    <p className="text-xs font-medium text-muted mt-3 mb-1.5">Tensões (V)</p>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                      {(Object.keys(e.tensoes) as (keyof EquipUI['tensoes'])[]).map((k) => (
                        <Campo key={k} rotulo={k} inputMode="numeric" value={e.tensoes[k]} onChange={(ev) => muda(e.id, (x) => ({ ...x, tensoes: { ...x.tensoes, [k]: ev.target.value } }))} />
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="text-sm font-medium mb-2">Retirado</legend>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {CAMPOS_RET.map(([k, r, ph]) => (
                        <Campo key={k} rotulo={r} placeholder={ph} value={e.retirado[k]} onChange={(ev) => muda(e.id, (x) => ({ ...x, retirado: { ...x.retirado, [k]: ev.target.value } }))} />
                      ))}
                    </div>
                  </fieldset>
                </div>
                <div className="grid grid-cols-2 gap-3 content-start">
                  {[0, 1].map((k) => (
                    <FotoSlot
                      key={k}
                      rotulo={`Foto ${k + 1}`}
                      foto={e.fotos[k]}
                      alto
                      onChange={(f?: Foto) =>
                        muda(e.id, (x) => {
                          const fotos = [...x.fotos]
                          if (f) fotos[k] = f
                          else fotos.splice(k, 1)
                          return { ...x, fotos: fotos.filter(Boolean) }
                        })
                      }
                    />
                  ))}
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
      <Painel className="p-4 md:p-5 max-w-3xl">
        <div role="radiogroup" aria-label="Teve desligamento?" className="flex gap-2 mb-5">
          {[
            [false, 'Sem desligamento'],
            [true, 'Teve desligamento'],
          ].map(([v, r]) => (
            <button
              key={String(v)}
              type="button"
              role="radio"
              aria-checked={tem === v}
              onClick={() => onChange(v as boolean, v ? foto : undefined)}
              className={`press h-10 px-4 rounded-ctl border text-sm ${tem === v ? 'border-text bg-text text-bg' : 'border-line-strong hover:bg-surface-2'}`}
            >
              {r as string}
            </button>
          ))}
        </div>
        {tem ? (
          <div className="max-w-sm">
            <FotoSlot rotulo="Foto do documento de desligamento" foto={foto} onChange={(f) => onChange(true, f)} alto />
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm text-muted">
            <FileText size={22} /> O quadro fica LIVRE, como veio no inventário.
          </div>
        )}
      </Painel>
    </div>
  )
}
