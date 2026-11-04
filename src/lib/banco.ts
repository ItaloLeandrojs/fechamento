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

export function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((ok, erro) => {
    const req = indexedDB.open(DB, VERSAO)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(LOJA_TECNICOS)) db.createObjectStore(LOJA_TECNICOS, { keyPath: 'registro' })
      if (!db.objectStoreNames.contains(LOJA_BASES)) db.createObjectStore(LOJA_BASES, { keyPath: 'nome' })
    }
    req.onsuccess = () => {
      const db = req.result
      db.onversionchange = () => db.close() // não trava uma futura atualização do banco
      ok(db)
    }
    req.onerror = () => erro(req.error)
  })
}

export async function lerBase<T>(nome: NomeBase): Promise<BaseGuardada<T> | null> {
  try {
    const db = await abrirBanco()
    return await new Promise((ok, erro) => {
      const req = db.transaction(LOJA_BASES).objectStore(LOJA_BASES).get(nome)
      req.onsuccess = () => ok((req.result as BaseGuardada<T> | undefined) ?? null)
      req.onerror = () => erro(req.error)
    })
  } catch {
    return null // navegador sem IndexedDB (janela anônima, por exemplo)
  }
}

export async function gravarBase(registro: BaseGuardada): Promise<void> {
  try {
    const db = await abrirBanco()
    await new Promise<void>((ok, erro) => {
      const tx = db.transaction(LOJA_BASES, 'readwrite')
      tx.objectStore(LOJA_BASES).put(registro)
      tx.oncomplete = () => ok()
      tx.onerror = () => erro(tx.error)
      tx.onabort = () => erro(tx.error)
    })
  } catch {
    // sem IndexedDB: segue sem guardar, a base é baixada de novo na próxima vez
  }
}
