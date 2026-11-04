import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { abrirBanco, gravarBase, lerBase } from './banco'
import { listarTecnicos } from './tecnicos'

beforeEach(() => {
  // banco novo e vazio em cada teste
  globalThis.indexedDB = new IDBFactory()
})

describe('banco do navegador', () => {
  it('migra da versão 1 sem perder técnicos', async () => {
    const v1 = await new Promise<IDBDatabase>((ok, erro) => {
      const req = indexedDB.open('fechamento', 1)
      req.onupgradeneeded = () => req.result.createObjectStore('tecnicos', { keyPath: 'registro' })
      req.onsuccess = () => ok(req.result)
      req.onerror = () => erro(req.error)
    })
    await new Promise<void>((ok, erro) => {
      const tx = v1.transaction('tecnicos', 'readwrite')
      tx.objectStore('tecnicos').put({ nome: 'Fulano', registro: 7, carimbo: { png: new Uint8Array([1]), width: 1, height: 1 } })
      tx.oncomplete = () => ok()
      tx.onerror = () => erro(tx.error)
    })
    v1.close()

    const db = await abrirBanco()
    expect(db.version).toBe(2)
    const tecnicos = await listarTecnicos()
    expect(tecnicos).toHaveLength(1)
    expect(tecnicos[0].registro).toBe(7)
    expect(await lerBase('enel')).toBeNull()
  })

  it('grava e lê uma base', async () => {
    await gravarBase({ nome: 'enel', versao: 'abc', dados: { x: 1 } })
    expect(await lerBase('enel')).toEqual({ nome: 'enel', versao: 'abc', dados: { x: 1 } })
    expect(await lerBase('edp')).toBeNull()
  })

  it('gravar de novo substitui', async () => {
    await gravarBase({ nome: 'enel', versao: 'abc', dados: { x: 1 } })
    await gravarBase({ nome: 'enel', versao: 'def', dados: { x: 2 } })
    const base = await lerBase<{ x: number }>('enel')
    expect(base?.versao).toBe('def')
    expect(base?.dados).toEqual({ x: 2 })
  })

  it('sem IndexedDB: lê null e gravar não faz nada', async () => {
    // @ts-expect-error simula navegador sem IndexedDB
    globalThis.indexedDB = undefined
    expect(await lerBase('enel')).toBeNull()
    await expect(gravarBase({ nome: 'enel', versao: 'a', dados: 1 })).resolves.toBeUndefined()
  })
})
