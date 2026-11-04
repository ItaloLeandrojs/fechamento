import { describe, it, expect } from 'vitest'
import { gzipSync } from 'node:zlib'
import { abrirGz, garantirBases, conferirBaseEnel, conferirKitsEdp, type FonteBases, type GuardaBases } from './bases'
import { PRIMEIRA_VEZ_SEM_INTERNET } from './mensagens'
import type { BaseGuardada, NomeBase } from '../lib/banco'

const ENEL = { materiais: { '1': ['Cabo', 'M'] }, estruturas: { N1: 'Estrutura N1' }, kits: { N1: [['1', 2]] } }
const EDP = [{ kit: 'K1', descricao: 'Kit 1', itens: [] }]

const gz = (x: unknown) => new Blob([gzipSync(JSON.stringify(x))])

function montar(opcoes: {
  versoes?: Record<NomeBase, string> | Error
  guardado?: Partial<Record<NomeBase, string>>
  falhaBaixar?: boolean
  conteudo?: Partial<Record<NomeBase, unknown>>
}) {
  const guardado = new Map<NomeBase, BaseGuardada>()
  for (const [nome, versao] of Object.entries(opcoes.guardado ?? {}) as [NomeBase, string][]) {
    guardado.set(nome, { nome, versao, dados: nome === 'enel' ? ENEL : EDP })
  }
  const baixadas: string[] = []
  const conteudo = { enel: ENEL, edp: EDP, ...opcoes.conteudo }
  const fonte: FonteBases = {
    async versoes() {
      const v = opcoes.versoes ?? { enel: 'v1', edp: 'v1' }
      if (v instanceof Error) throw v
      return { enel: { versao: v.enel, arquivo: 'enel.gz' }, edp: { versao: v.edp, arquivo: 'edp.gz' } }
    },
    async baixar(arquivo) {
      baixadas.push(arquivo)
      if (opcoes.falhaBaixar) throw new Error('caiu')
      return gz(arquivo === 'enel.gz' ? conteudo.enel : conteudo.edp)
    },
  }
  const guarda: GuardaBases = {
    ler: (async (nome: NomeBase) => guardado.get(nome) ?? null) as GuardaBases['ler'],
    gravar: async (r) => { guardado.set(r.nome, r) },
  }
  return { fonte, guarda, guardado, baixadas }
}

describe('garantirBases', () => {
  it('sem nada guardado baixa as duas e guarda', async () => {
    const { fonte, guarda, guardado, baixadas } = montar({})
    const r = await garantirBases(fonte, guarda)
    expect(baixadas).toHaveLength(2)
    expect(guardado.get('enel')?.versao).toBe('v1')
    expect(guardado.get('edp')?.versao).toBe('v1')
    expect(r.enel.kits.N1).toEqual([['1', 2]])
    expect(r.edp[0].kit).toBe('K1')
    expect(r.avisos).toEqual([])
  })

  it('mesma versão não baixa', async () => {
    const { fonte, guarda, baixadas } = montar({ guardado: { enel: 'v1', edp: 'v1' } })
    const r = await garantirBases(fonte, guarda)
    expect(baixadas).toHaveLength(0)
    expect(r.enel.estruturas.N1).toBe('Estrutura N1')
  })

  it('versão nova baixa só a que mudou', async () => {
    const { fonte, guarda, guardado, baixadas } = montar({
      versoes: { enel: 'v2', edp: 'v1' },
      guardado: { enel: 'v1', edp: 'v1' },
    })
    await garantirBases(fonte, guarda)
    expect(baixadas).toEqual(['enel.gz'])
    expect(guardado.get('enel')?.versao).toBe('v2')
    expect(guardado.get('edp')?.versao).toBe('v1')
  })

  it('sem internet usa a guardada', async () => {
    const { fonte, guarda } = montar({ versoes: new Error('offline'), guardado: { enel: 'v1', edp: 'v1' } })
    const r = await garantirBases(fonte, guarda)
    expect(r.enel.materiais['1']).toEqual(['Cabo', 'M'])
    expect(r.avisos.some((a) => a.toLowerCase().includes('sem conexão'))).toBe(true)
  })

  it('sem internet e sem guardada', async () => {
    const { fonte, guarda } = montar({ versoes: new Error('offline') })
    await expect(garantirBases(fonte, guarda)).rejects.toThrow(PRIMEIRA_VEZ_SEM_INTERNET)
  })

  it('sem internet e só uma guardada também falha', async () => {
    const { fonte, guarda } = montar({ versoes: new Error('offline'), guardado: { enel: 'v1' } })
    await expect(garantirBases(fonte, guarda)).rejects.toThrow(PRIMEIRA_VEZ_SEM_INTERNET)
  })

  it('descarga que falha não estraga a guardada', async () => {
    const { fonte, guarda, guardado } = montar({
      versoes: { enel: 'v2', edp: 'v2' },
      guardado: { enel: 'v1', edp: 'v1' },
      falhaBaixar: true,
    })
    const r = await garantirBases(fonte, guarda)
    expect(guardado.get('enel')?.versao).toBe('v1')
    expect(guardado.get('edp')?.versao).toBe('v1')
    expect(r.enel.kits.N1).toBeDefined()
    expect(r.avisos.length).toBeGreaterThan(0)
  })

  it('arquivo com formato errado não é guardado', async () => {
    const { fonte, guarda, guardado } = montar({
      versoes: { enel: 'v2', edp: 'v1' },
      guardado: { enel: 'v1', edp: 'v1' },
      conteudo: { enel: {} },
    })
    const r = await garantirBases(fonte, guarda)
    expect(guardado.get('enel')?.versao).toBe('v1')
    expect(r.avisos.length).toBeGreaterThan(0)
  })

  it('uma base falha e a outra vem nova', async () => {
    const { fonte, guarda, guardado } = montar({
      versoes: { enel: 'v2', edp: 'v2' },
      guardado: { enel: 'v1' },
      conteudo: { enel: {} },
    })
    const r = await garantirBases(fonte, guarda)
    expect(guardado.get('enel')?.versao).toBe('v1')
    expect(guardado.get('edp')?.versao).toBe('v2')
    expect(r.avisos).toHaveLength(1)
  })

  it('base que falha sem cópia guardada lança a mensagem da primeira vez', async () => {
    const { fonte, guarda } = montar({ falhaBaixar: true })
    await expect(garantirBases(fonte, guarda)).rejects.toThrow(PRIMEIRA_VEZ_SEM_INTERNET)
  })
})

describe('abrirGz', () => {
  it('lê o que o gzip do Node gravou', async () => {
    expect(await abrirGz(gz({ a: 1 }))).toEqual({ a: 1 })
  })
})

describe('conferir', () => {
  it('conferirBaseEnel recusa objeto sem partes ou com parte vazia', () => {
    expect(() => conferirBaseEnel({})).toThrow()
    expect(() => conferirBaseEnel({ ...ENEL, kits: {} })).toThrow()
    expect(() => conferirBaseEnel(null)).toThrow()
    expect(conferirBaseEnel(ENEL)).toBe(ENEL)
  })
  it('conferirKitsEdp recusa lista vazia ou item sem kit/itens', () => {
    expect(() => conferirKitsEdp([])).toThrow()
    expect(() => conferirKitsEdp({})).toThrow()
    expect(() => conferirKitsEdp([{ kit: 1, itens: [] }])).toThrow()
    expect(() => conferirKitsEdp([{ kit: 'a' }])).toThrow()
    expect(conferirKitsEdp(EDP)).toBe(EDP)
  })
})
