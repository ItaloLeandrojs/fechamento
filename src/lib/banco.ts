// Banco do navegador (IndexedDB) deste computador: técnicos e bases baixadas.
// Versão 1 só tinha 'tecnicos'; a versão 2 acrescenta 'bases' sem mexer nos técnicos.

const DB = 'fechamento'
const VERSAO = 2
export const LOJA_TECNICOS = 'tecnicos'
export const LOJA_BASES = 'bases'

export type NomeBase = 'enel' | 'edp'

/** Base baixada do servidor e guardada aqui; 'versao' é o carimbo que diz se mudou. */
export interface BaseGuardada<T = unknown> {
  nome: NomeBase
  versao: string
  dados: T
}

// Pedido de abertura travado por outra aba. Enquanto ele não se resolve, o navegador
// enfileira qualquer novo pedido atrás dele, então os próximos chamadores recebem a mesma recusa.
let travado: { fabrica: IDBFactory; recusa: Promise<never> } | null = null

export function abrirBanco(): Promise<IDBDatabase> {
  if (travado && travado.fabrica === indexedDB) return travado.recusa
  const fabrica = indexedDB
  return new Promise((ok, erro) => {
    const req = fabrica.open(DB, VERSAO)
    let desistiu = false
    const livrar = () => {
      if (travado?.fabrica === fabrica) travado = null
    }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(LOJA_TECNICOS)) db.createObjectStore(LOJA_TECNICOS, { keyPath: 'registro' })
      if (!db.objectStoreNames.contains(LOJA_BASES)) db.createObjectStore(LOJA_BASES, { keyPath: 'nome' })
    }
    req.onblocked = () => {
      // outra aba ainda tem a versão antiga aberta: não espera para sempre
      desistiu = true
      const recusa = Promise.reject<never>(new Error('Banco bloqueado por outra aba aberta.'))
      recusa.catch(() => {}) // evita aviso de rejeição sem tratamento
      travado = { fabrica, recusa }
      erro(new Error('Banco bloqueado por outra aba aberta.'))
    }
    req.onsuccess = () => {
      const db = req.result
      db.onversionchange = () => db.close() // não trava uma futura atualização do banco
      livrar()
      if (desistiu) db.close() // abriu tarde demais, ninguém mais espera por ele
      else ok(db)
    }
    req.onerror = () => {
      livrar()
      erro(req.error)
    }
  })
}

/** Abre o banco, roda a operação e sempre fecha a conexão no fim. */
export async function comBanco<T>(fazer: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await abrirBanco()
  try {
    return await fazer(db)
  } finally {
    db.close() // o fechamento espera as transações em andamento terminarem
  }
}

export async function lerBase<T>(nome: NomeBase): Promise<BaseGuardada<T> | null> {
  try {
    return await comBanco<BaseGuardada<T> | null>((db) => new Promise((ok, erro) => {
      const req = db.transaction(LOJA_BASES).objectStore(LOJA_BASES).get(nome)
      req.onsuccess = () => ok((req.result as BaseGuardada<T> | undefined) ?? null)
      req.onerror = () => erro(req.error)
    }))
  } catch {
    return null // navegador sem IndexedDB (janela anônima, por exemplo)
  }
}

export async function gravarBase(registro: BaseGuardada): Promise<void> {
  try {
    await comBanco((db) => new Promise<void>((ok, erro) => {
      const tx = db.transaction(LOJA_BASES, 'readwrite')
      tx.objectStore(LOJA_BASES).put(registro)
      tx.oncomplete = () => ok()
      tx.onerror = () => erro(tx.error)
      tx.onabort = () => erro(tx.error)
    }))
  } catch {
    // sem IndexedDB: segue sem guardar, a base é baixada de novo na próxima vez
  }
}
