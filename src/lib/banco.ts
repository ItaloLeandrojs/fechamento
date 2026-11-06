// Banco do navegador (IndexedDB) deste computador: técnicos, bases baixadas e sugestões de ajuste.
// Versão 1 só tinha 'tecnicos'; a 2 acrescenta 'bases'; a 3 acrescenta 'ajustes'; a 4 acrescenta 'maoDeObra' (respostas por OT). Nenhuma mexe nas lojas antigas.
import type { Ajuste } from '../ceara/estratificacao'
import type { RespostasMO } from '../ceara/maoDeObra'

const DB = 'fechamento'
const VERSAO = 4
export const LOJA_TECNICOS = 'tecnicos'
export const LOJA_BASES = 'bases'
export const LOJA_AJUSTES = 'ajustes'
export const LOJA_MAO_DE_OBRA = 'maoDeObra' // keyPath 'ot'

/** Último ajuste feito numa estrutura (chave sem _S), guardado só neste navegador. */
export interface SugestaoGuardada { estrutura: string; ajuste: Ajuste; data: string }

export type NomeBase = 'enel' | 'edp' | 'mao-de-obra'

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
      if (!db.objectStoreNames.contains(LOJA_AJUSTES)) db.createObjectStore(LOJA_AJUSTES, { keyPath: 'estrutura' })
      if (!db.objectStoreNames.contains(LOJA_MAO_DE_OBRA)) db.createObjectStore(LOJA_MAO_DE_OBRA, { keyPath: 'ot' })
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

export async function lerSugestoes(): Promise<Record<string, SugestaoGuardada>> {
  try {
    return await comBanco<Record<string, SugestaoGuardada>>((db) => new Promise((ok, erro) => {
      const req = db.transaction(LOJA_AJUSTES).objectStore(LOJA_AJUSTES).getAll()
      req.onsuccess = () => {
        const r: Record<string, SugestaoGuardada> = {}
        for (const s of req.result as SugestaoGuardada[]) r[s.estrutura] = s
        ok(r)
      }
      req.onerror = () => erro(req.error)
    }))
  } catch {
    return {} // navegador sem IndexedDB: não há sugestão guardada
  }
}

/** Grava e apaga numa transação só, para a sugestão nunca ficar pela metade. true só se gravou. */
export async function gravarSugestoes(gravar: SugestaoGuardada[], apagar: string[]): Promise<boolean> {
  try {
    await comBanco((db) => new Promise<void>((ok, erro) => {
      const tx = db.transaction(LOJA_AJUSTES, 'readwrite')
      const loja = tx.objectStore(LOJA_AJUSTES)
      for (const s of gravar) loja.put(s)
      for (const e of apagar) loja.delete(e)
      tx.oncomplete = () => ok()
      tx.onerror = () => erro(tx.error)
      tx.onabort = () => erro(tx.error)
    }))
    return true
  } catch {
    // sem IndexedDB: segue sem guardar a sugestão
    return false
  }
}

export async function lerRespostasMO(ot: string): Promise<RespostasMO | null> {
  try {
    return await comBanco<RespostasMO | null>((db) => new Promise((ok, erro) => {
      const req = db.transaction(LOJA_MAO_DE_OBRA).objectStore(LOJA_MAO_DE_OBRA).get(ot)
      req.onsuccess = () => ok((req.result as RespostasMO | undefined) ?? null)
      req.onerror = () => erro(req.error)
    }))
  } catch {
    return null // navegador sem IndexedDB: não há resposta guardada
  }
}

/** true só se gravou. */
export async function gravarRespostasMO(r: RespostasMO): Promise<boolean> {
  try {
    await comBanco((db) => new Promise<void>((ok, erro) => {
      const tx = db.transaction(LOJA_MAO_DE_OBRA, 'readwrite')
      tx.objectStore(LOJA_MAO_DE_OBRA).put(r)
      tx.oncomplete = () => ok()
      tx.onerror = () => erro(tx.error)
      tx.onabort = () => erro(tx.error)
    }))
    return true
  } catch {
    // sem IndexedDB: segue sem guardar as respostas
    return false
  }
}
