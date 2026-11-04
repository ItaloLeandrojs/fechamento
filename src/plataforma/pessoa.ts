// Pessoa que entrou no site. Os dados vêm do perfil (Supabase); aqui fica só a foto do crachá,
// guardada por pessoa no localStorage deste navegador.
// Todo acesso ao storage é protegido: se estiver bloqueado, cheio ou quebrado,
// o site continua funcionando na sessão, só não lembra da pessoa.
import type { Perfil } from '../nuvem/sessao'

export interface Pessoa {
  nome: string
  cargo: string
  matricula: string
  foto: string | null
}

const CHAVE = 'fechamento-pessoa' // registro antigo, de antes do login
const CHAVE_FOTO = 'fechamento-foto:'
const CHAVE_PULOU = 'fechamento-foto-pulou:'

// localStorage pode lançar só de ser acessado (modo privado, política do navegador)
function storagePadrao(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

// lerPessoa, gravarPessoa e apagarPessoa saem na Tarefa 7
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

// guardou diz se a pessoa ficou guardada no navegador (false: storage bloqueado, segue só nesta aba).
// gravouFoto diz se a foto ficou guardada (true também quando não havia foto).
// Se a foto não couber (cota), grava de novo sem ela e devolve gravouFoto: false.
export function gravarPessoa(p: Pessoa, storage: Storage | null = storagePadrao()): { gravouFoto: boolean; guardou: boolean } {
  const semFoto = p.foto === null
  if (!storage) return { gravouFoto: semFoto, guardou: false }
  try {
    storage.setItem(CHAVE, JSON.stringify(p))
    return { gravouFoto: true, guardou: true }
  } catch {
    try {
      storage.setItem(CHAVE, JSON.stringify({ ...p, foto: null }))
      return { gravouFoto: semFoto, guardou: true }
    } catch {
      // nem sem a foto coube: segue só na sessão
      return { gravouFoto: semFoto, guardou: false }
    }
  }
}

export function apagarPessoa(storage: Storage | null = storagePadrao()): void {
  try {
    storage?.removeItem(CHAVE)
  } catch {
    // sem storage, não há o que apagar
  }
}

export function pessoaDoPerfil(p: Perfil, foto: string | null): Pessoa {
  return { nome: p.nome, cargo: p.cargo, matricula: p.matricula, foto }
}

export function lerFoto(id: string, storage: Storage | null = storagePadrao()): string | null {
  try {
    return storage?.getItem(CHAVE_FOTO + id) ?? null
  } catch {
    return null
  }
}

// gravou diz se a foto ficou guardada (false: storage bloqueado ou cheio, a foto vale só nesta sessão).
// null apaga a foto.
export function gravarFoto(id: string, foto: string | null, storage: Storage | null = storagePadrao()): { gravou: boolean } {
  if (!storage) return { gravou: false }
  try {
    if (foto === null) storage.removeItem(CHAVE_FOTO + id)
    else storage.setItem(CHAVE_FOTO + id, foto)
    return { gravou: true }
  } catch {
    return { gravou: false }
  }
}

// Marca de quem preferiu não pôr foto agora, para não perguntar de novo a cada entrada
export function pulouFoto(id: string, storage: Storage | null = storagePadrao()): boolean {
  try {
    return storage?.getItem(CHAVE_PULOU + id) === '1'
  } catch {
    return false
  }
}

export function marcarPulouFoto(id: string, storage: Storage | null = storagePadrao()): void {
  try {
    storage?.setItem(CHAVE_PULOU + id, '1')
  } catch {
    // sem storage, pergunta de novo na próxima entrada
  }
}

// Foto do registro de antes do login, para a pessoa aproveitar na primeira entrada
export function fotoAntiga(storage: Storage | null = storagePadrao()): string | null {
  try {
    const bruto = storage?.getItem(CHAVE)
    if (!bruto) return null
    const o = JSON.parse(bruto)
    return o && typeof o === 'object' && typeof o.foto === 'string' ? o.foto : null
  } catch {
    return null
  }
}

export function esquecerPessoaAntiga(storage: Storage | null = storagePadrao()): void {
  try {
    storage?.removeItem(CHAVE)
  } catch {
    // sem storage, não há o que esquecer
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
