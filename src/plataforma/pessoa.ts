// Pessoa que entrou no site. Fica só no localStorage deste navegador.
// Todo acesso ao storage é protegido: se estiver bloqueado, cheio ou quebrado,
// o site continua funcionando na sessão, só não lembra da pessoa.
export interface Pessoa {
  nome: string
  cargo: string
  matricula: string
  foto: string | null
}

const CHAVE = 'fechamento-pessoa'

// localStorage pode lançar só de ser acessado (modo privado, política do navegador)
function storagePadrao(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function lerPessoa(storage: Storage | null = storagePadrao()): Pessoa | null {
  try {
    const bruto = storage?.getItem(CHAVE)
    if (!bruto) return null
    const o = JSON.parse(bruto)
    if (!o || typeof o !== 'object' || typeof o.nome !== 'string') return null
    return {
      nome: o.nome,
      cargo: typeof o.cargo === 'string' ? o.cargo : '',
      matricula: typeof o.matricula === 'string' ? o.matricula : '',
      foto: typeof o.foto === 'string' ? o.foto : null,
    }
  } catch {
    return null
  }
}

// gravouFoto diz se a foto ficou guardada (true também quando não havia foto).
// Se a foto não couber (cota), grava de novo sem ela e devolve gravouFoto: false.
export function gravarPessoa(p: Pessoa, storage: Storage | null = storagePadrao()): { gravouFoto: boolean } {
  const semFoto = p.foto === null
  if (!storage) return { gravouFoto: semFoto }
  try {
    storage.setItem(CHAVE, JSON.stringify(p))
    return { gravouFoto: true }
  } catch {
    try {
      storage.setItem(CHAVE, JSON.stringify({ ...p, foto: null }))
    } catch {
      // nem sem a foto coube: segue só na sessão
    }
    return { gravouFoto: semFoto }
  }
}

export function apagarPessoa(storage: Storage | null = storagePadrao()): void {
  try {
    storage?.removeItem(CHAVE)
  } catch {
    // sem storage, não há o que apagar
  }
}

function palavras(nome: string): string[] {
  return nome.trim().split(/\s+/).filter(Boolean)
}

// Primeira letra das duas primeiras palavras, em maiúscula
export function iniciais(nome: string): string {
  return palavras(nome)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

export function primeiroNome(nome: string): string {
  return palavras(nome)[0] ?? ''
}

export function saudacao(hora: number): 'Bom dia' | 'Boa tarde' | 'Boa noite' {
  if (hora < 12) return 'Bom dia'
  if (hora < 18) return 'Boa tarde'
  return 'Boa noite'
}
