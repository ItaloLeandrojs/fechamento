import { describe, it, expect } from 'vitest'
import { gzipSync } from 'node:zlib'
import { abrirGz, garantirBases, conferirBaseEnel, conferirKitsEdp, conferirBaseMaoDeObra, type FonteBases, type GuardaBases } from './bases'
import { PRIMEIRA_VEZ_SEM_INTERNET } from './mensagens'
import type { BaseGuardada, NomeBase } from '../lib/banco'
import { PAPEIS, type BaseMaoDeObra } from '../ceara/maoDeObra'

const ENEL = { materiais: { '1': ['Cabo', 'M'] }, estruturas: { N1: 'Estrutura N1' }, kits: { N1: [['1', 2]] } }
const EDP = [{ kit: 'K1', descricao: 'Kit 1', itens: [] }]
const voz = (v: string, letra: 'A' | 'B', numero: string) => ({ voz: v, letra, numero, descricao: `Serviço ${v}`, unidade: 'UN', variante: false })
const MO: BaseMaoDeObra = {
  lista: [voz('XX110', 'A', '9000000001'), voz('XX110', 'B', '9000000002'), voz('XX212', 'A', '9000000003'), voz('XX212', 'B', '9000000004')],
  papeis: Object.fromEntries(PAPEIS.map((p) => [p, p === 'tensionar' ? 'XX212' : 'XX110'])) as BaseMaoDeObra['papeis'],
  regrasCabo: [{ grupo: 'bt-multi', situacao: 'novo', voz: 'XX110', por: 'metro' }],
  tensionar: [{ rede: 'mt', exige: ['^KT3'], qtd: 1 }],
}

// o aviso da lista de mão de obra (ausente nestes cenários) não conta nos testes de enel/edp
const semAvisoDaLista = (avisos: string[]) => avisos.filter((a) => !a.includes('mão de obra'))

const gz = (x: unknown) => new Blob([gzipSync(JSON.stringify(x))])

function montar(opcoes: {
  versoes?: (Record<'enel' | 'edp', string> & Partial<Record<'mao-de-obra', string>>) | Error
  guardado?: Partial<Record<NomeBase, string>>
  falhaBaixar?: boolean
  conteudo?: Partial<Record<NomeBase, unknown>>
}) {
  const guardado = new Map<NomeBase, BaseGuardada>()
  for (const [nome, versao] of Object.entries(opcoes.guardado ?? {}) as [NomeBase, string][]) {
    guardado.set(nome, { nome, versao, dados: nome === 'enel' ? ENEL : nome === 'edp' ? EDP : MO })
  }
  const baixadas: string[] = []
  const conteudo: Record<string, unknown> = { enel: ENEL, edp: EDP, 'mao-de-obra': MO, ...opcoes.conteudo }
  const fonte: FonteBases = {
    async versoes() {
      const v = opcoes.versoes ?? { enel: 'v1', edp: 'v1' }
      if (v instanceof Error) throw v
      return {
        enel: { versao: v.enel, arquivo: 'enel.gz' },
        edp: { versao: v.edp, arquivo: 'edp.gz' },
        ...(v['mao-de-obra'] ? { 'mao-de-obra': { versao: v['mao-de-obra'], arquivo: 'mo.gz' } } : {}),
      }
    },
    async baixar(arquivo) {
      baixadas.push(arquivo)
      if (opcoes.falhaBaixar) throw new Error('caiu')
      return gz(arquivo === 'enel.gz' ? conteudo.enel : arquivo === 'mo.gz' ? conteudo['mao-de-obra'] : conteudo.edp)
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
    expect(semAvisoDaLista(r.avisos)).toEqual([])
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
    expect(semAvisoDaLista(r.avisos)).toHaveLength(1)
  })

  it('base que falha sem cópia guardada lança a mensagem da primeira vez', async () => {
    const { fonte, guarda } = montar({ falhaBaixar: true })
    await expect(garantirBases(fonte, guarda)).rejects.toThrow(PRIMEIRA_VEZ_SEM_INTERNET)
  })
})

describe('lista de mão de obra (base opcional)', () => {
  it('sem lista de mão de obra no servidor, segue sem ela', async () => {
    const { fonte, guarda } = montar({})
    const r = await garantirBases(fonte, guarda)
    expect(r.maoDeObra).toBeNull()
    expect(r.enel.kits.N1).toEqual([['1', 2]])
    expect(r.edp[0].kit).toBe('K1')
    expect(r.avisos.some((a) => a.includes('ainda não está no servidor'))).toBe(true)
  })

  it('sem linha no servidor e com cópia, usa a cópia sem aviso', async () => {
    const { fonte, guarda } = montar({ guardado: { enel: 'v1', edp: 'v1', 'mao-de-obra': 'v1' } })
    const r = await garantirBases(fonte, guarda)
    expect(r.maoDeObra?.lista.length).toBe(MO.lista.length)
    expect(r.avisos).toEqual([])
  })

  it('com lista no servidor, baixa e guarda', async () => {
    const { fonte, guarda, guardado } = montar({ versoes: { enel: 'v1', edp: 'v1', 'mao-de-obra': 'm7' } })
    const r = await garantirBases(fonte, guarda)
    expect(r.maoDeObra?.lista.length).toBe(MO.lista.length)
    expect(guardado.get('mao-de-obra')?.versao).toBe('m7')
    expect(r.avisos).toEqual([])
  })

  it('download da lista falhou: com cópia, usa a cópia e avisa', async () => {
    const { fonte, guarda, guardado } = montar({
      versoes: { enel: 'v1', edp: 'v1', 'mao-de-obra': 'm2' },
      guardado: { enel: 'v1', edp: 'v1', 'mao-de-obra': 'm1' },
      falhaBaixar: true,
    })
    const r = await garantirBases(fonte, guarda)
    expect(r.maoDeObra?.lista.length).toBe(MO.lista.length)
    expect(guardado.get('mao-de-obra')?.versao).toBe('m1')
    expect(r.avisos.some((a) => a.includes('Não deu para atualizar a lista'))).toBe(true)
  })

  it('download da lista falhou: sem cópia, segue sem ela e não lança', async () => {
    const { fonte, guarda } = montar({
      versoes: { enel: 'v1', edp: 'v1', 'mao-de-obra': 'm2' },
      guardado: { enel: 'v1', edp: 'v1' },
      falhaBaixar: true,
    })
    const r = await garantirBases(fonte, guarda)
    expect(r.maoDeObra).toBeNull()
    expect(r.avisos.some((a) => a.includes('ainda não está no servidor'))).toBe(true)
  })

  it('lista com formato errado no servidor não é guardada', async () => {
    const { fonte, guarda, guardado } = montar({
      versoes: { enel: 'v1', edp: 'v1', 'mao-de-obra': 'm2' },
      guardado: { enel: 'v1', edp: 'v1' },
      conteudo: { 'mao-de-obra': {} },
    })
    const r = await garantirBases(fonte, guarda)
    expect(r.maoDeObra).toBeNull()
    expect(guardado.has('mao-de-obra')).toBe(false)
  })

  it('sem internet e sem cópia da lista: não lança por causa dela', async () => {
    const { fonte, guarda } = montar({ versoes: new Error('offline'), guardado: { enel: 'v1', edp: 'v1' } })
    const r = await garantirBases(fonte, guarda)
    expect(r.maoDeObra).toBeNull()
  })
})

describe('conferir lista de mão de obra', () => {
  it('recusa formatos errados e aceita a lista certa', () => {
    expect(() => conferirBaseMaoDeObra({})).toThrow()
    expect(() => conferirBaseMaoDeObra({ ...MO, lista: [] })).toThrow()
    expect(() => conferirBaseMaoDeObra({ ...MO, lista: [{ ...MO.lista[0], numero: '123' }, ...MO.lista.slice(1)] })).toThrow()
    expect(() => conferirBaseMaoDeObra({ ...MO, lista: [{ ...MO.lista[0], letra: 'C' }, ...MO.lista.slice(1)] })).toThrow()
    const faltando: Record<string, string> = { ...MO.papeis }
    delete faltando['trafo']
    expect(() => conferirBaseMaoDeObra({ ...MO, papeis: faltando })).toThrow()
    expect(() => conferirBaseMaoDeObra({ ...MO, papeis: { ...MO.papeis, trafo: 'XX999' } })).toThrow()
    expect(() => conferirBaseMaoDeObra({ ...MO, regrasCabo: [{ ...MO.regrasCabo[0], por: 'km' }] })).toThrow()
    expect(() => conferirBaseMaoDeObra({ ...MO, tensionar: [{ rede: 'mt', exige: ['('], qtd: 1 }] })).toThrow()
    expect(() => conferirBaseMaoDeObra({ ...MO, tensionar: [{ rede: 'mt', exige: [], qtd: 1 }] })).toThrow()
    expect(() => conferirBaseMaoDeObra({ ...MO, tensionar: [{ rede: 'mt', exige: ['^A', '^B'], qtd: 1 }] })).toThrow()
    expect(() => conferirBaseMaoDeObra({ ...MO, tensionar: [{ rede: 'mt', exige: ['^A'], qtd: 0 }] })).toThrow()
    expect(conferirBaseMaoDeObra(MO)).toBe(MO)
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
