import { describe, expect, it } from 'vitest'
import {
  apagarPessoa, esquecerPessoaAntiga, fotoAntiga, gravarFoto, gravarPessoa, iniciais, lerFoto, lerPessoa,
  marcarPulouFoto, pessoaDoPerfil, primeiroNome, pulouFoto, saudacao, type Pessoa,
} from './pessoa'
import type { Perfil } from '../nuvem/sessao'

// Storage falso em memória, no mesmo formato do localStorage
function storageFalso(sobrescrever: Partial<Storage> = {}): Storage {
  const dados = new Map<string, string>()
  return {
    get length() { return dados.size },
    clear: () => dados.clear(),
    getItem: (k: string) => dados.get(k) ?? null,
    key: (i: number) => [...dados.keys()][i] ?? null,
    removeItem: (k: string) => { dados.delete(k) },
    setItem: (k: string, v: string) => { dados.set(k, String(v)) },
    ...sobrescrever,
  }
}

const maria: Pessoa = { nome: 'Maria Souza', cargo: 'Técnica de campo', matricula: '0000', foto: 'data:image/jpeg;base64,AAAA' }

describe('texto da pessoa', () => {
  it('iniciais pegam a primeira letra de até duas palavras, em maiúscula', () => {
    expect(iniciais('Maria Souza')).toBe('MS')
    expect(iniciais('  maria  ')).toBe('M')
  })

  it('primeiroNome ignora espaços nas pontas', () => {
    expect(primeiroNome(' Maria Souza ')).toBe('Maria')
  })

  it('saudação muda conforme a hora', () => {
    expect(saudacao(9)).toBe('Bom dia')
    expect(saudacao(12)).toBe('Boa tarde')
    expect(saudacao(18)).toBe('Boa noite')
  })
})

describe('guardar a pessoa no storage', () => {
  it('gravar e ler devolve o mesmo objeto', () => {
    const s = storageFalso()
    expect(gravarPessoa(maria, s)).toEqual({ gravouFoto: true, guardou: true })
    expect(lerPessoa(s)).toEqual(maria)
  })

  it('usa a chave fechamento-pessoa', () => {
    const s = storageFalso()
    gravarPessoa(maria, s)
    expect(JSON.parse(s.getItem('fechamento-pessoa') as string)).toEqual(maria)
  })

  it('sem nada guardado, lê null', () => {
    expect(lerPessoa(storageFalso())).toBeNull()
  })

  it('JSON quebrado dá null', () => {
    const s = storageFalso()
    s.setItem('fechamento-pessoa', '{nome:')
    expect(lerPessoa(s)).toBeNull()
  })

  it('storage que lança: lê null e nada lança', () => {
    const quebrado = storageFalso({
      getItem: () => { throw new Error('bloqueado') },
      setItem: () => { throw new Error('bloqueado') },
      removeItem: () => { throw new Error('bloqueado') },
    })
    expect(lerPessoa(quebrado)).toBeNull()
    expect(gravarPessoa(maria, quebrado)).toEqual({ gravouFoto: false, guardou: false })
    expect(() => apagarPessoa(quebrado)).not.toThrow()
  })

  it('sem foto e gravando bem, não acusa foto perdida', () => {
    expect(gravarPessoa({ ...maria, foto: null }, storageFalso())).toEqual({ gravouFoto: true, guardou: true })
  })

  it('cota estourada com foto: regrava sem a foto e avisa', () => {
    const dados = new Map<string, string>()
    const s = storageFalso({
      getItem: (k: string) => dados.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (JSON.parse(v).foto) throw new DOMException('cheio', 'QuotaExceededError')
        dados.set(k, v)
      },
    })
    expect(gravarPessoa(maria, s)).toEqual({ gravouFoto: false, guardou: true })
    const lida = lerPessoa(s)
    expect(lida?.foto).toBeNull()
    expect(lida?.nome).toBe('Maria Souza')
  })

  it('apagar remove o que foi guardado', () => {
    const s = storageFalso()
    gravarPessoa(maria, s)
    apagarPessoa(s)
    expect(lerPessoa(s)).toBeNull()
  })
})

describe('foto separada por pessoa', () => {
  it('cada pessoa tem a sua foto', () => {
    const s = storageFalso()
    expect(gravarFoto('a', 'data:A', s)).toEqual({ gravou: true })
    expect(gravarFoto('b', 'data:B', s)).toEqual({ gravou: true })
    expect(lerFoto('a', s)).toBe('data:A')
    expect(lerFoto('b', s)).toBe('data:B')
    expect(s.getItem('fechamento-foto:a')).toBe('data:A')
  })

  it('sem foto guardada, lê null', () => {
    expect(lerFoto('a', storageFalso())).toBeNull()
  })

  it('gravar null apaga a foto', () => {
    const s = storageFalso()
    gravarFoto('a', 'data:A', s)
    expect(gravarFoto('a', null, s)).toEqual({ gravou: true })
    expect(lerFoto('a', s)).toBeNull()
  })

  it('foto que não cabe: gravou false, sem lançar', () => {
    const s = storageFalso({ setItem: () => { throw new DOMException('cheio', 'QuotaExceededError') } })
    expect(gravarFoto('a', 'data:A', s)).toEqual({ gravou: false })
  })

  it('storage que lança: lê null e nada lança', () => {
    const quebrado = storageFalso({
      getItem: () => { throw new Error('bloqueado') },
      setItem: () => { throw new Error('bloqueado') },
      removeItem: () => { throw new Error('bloqueado') },
    })
    expect(lerFoto('a', quebrado)).toBeNull()
    expect(gravarFoto('a', 'data:A', quebrado)).toEqual({ gravou: false })
    expect(gravarFoto('a', null, quebrado)).toEqual({ gravou: false })
    expect(pulouFoto('a', quebrado)).toBe(false)
    expect(() => marcarPulouFoto('a', quebrado)).not.toThrow()
    expect(() => esquecerPessoaAntiga(quebrado)).not.toThrow()
    expect(fotoAntiga(quebrado)).toBeNull()
  })
})

describe('foto pulada', () => {
  it('marca por pessoa e lê de volta', () => {
    const s = storageFalso()
    expect(pulouFoto('a', s)).toBe(false)
    marcarPulouFoto('a', s)
    expect(pulouFoto('a', s)).toBe(true)
    expect(pulouFoto('b', s)).toBe(false)
    expect(s.getItem('fechamento-foto-pulou:a')).not.toBeNull()
  })
})

describe('foto do registro antigo', () => {
  it('é achada e depois esquecida', () => {
    const s = storageFalso()
    s.setItem('fechamento-pessoa', JSON.stringify({ nome: 'X', foto: 'data:F' }))
    expect(fotoAntiga(s)).toBe('data:F')
    esquecerPessoaAntiga(s)
    expect(fotoAntiga(s)).toBeNull()
    expect(s.getItem('fechamento-pessoa')).toBeNull()
  })

  it('sem registro, sem foto ou JSON quebrado: null', () => {
    const s = storageFalso()
    expect(fotoAntiga(s)).toBeNull()
    s.setItem('fechamento-pessoa', JSON.stringify({ nome: 'X', foto: null }))
    expect(fotoAntiga(s)).toBeNull()
    s.setItem('fechamento-pessoa', '{nome:')
    expect(fotoAntiga(s)).toBeNull()
  })
})

describe('pessoaDoPerfil', () => {
  it('junta perfil e foto', () => {
    const perfil: Perfil = { id: 'u1', nome: 'Maria Souza', cargo: 'Técnica de campo', matricula: '0000', senhaInicial: true }
    expect(pessoaDoPerfil(perfil, 'data:F')).toEqual({ nome: 'Maria Souza', cargo: 'Técnica de campo', matricula: '0000', foto: 'data:F' })
    expect(pessoaDoPerfil(perfil, null).foto).toBeNull()
  })
})
