import { describe, expect, it } from 'vitest'
import { apagarPessoa, gravarPessoa, iniciais, lerPessoa, primeiroNome, saudacao, type Pessoa } from './pessoa'

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
