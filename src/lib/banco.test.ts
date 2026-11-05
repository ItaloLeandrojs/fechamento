import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { abrirBanco, gravarBase, gravarSugestoes, lerBase, lerSugestoes } from './banco'
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
    expect(db.version).toBe(3)
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
    expect(await lerSugestoes()).toEqual({})
    await expect(gravarSugestoes([{ estrutura: 'KITX1', ajuste: { qtd: {}, novos: [] }, data: 'x' }], ['KITX2'])).resolves.toBe(false)
  })

  it('migra da versão 2 sem perder técnicos e bases', async () => {
    const v2 = await new Promise<IDBDatabase>((ok, erro) => {
      const req = indexedDB.open('fechamento', 2)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('tecnicos', { keyPath: 'registro' })
        req.result.createObjectStore('bases', { keyPath: 'nome' })
      }
      req.onsuccess = () => ok(req.result)
      req.onerror = () => erro(req.error)
    })
    await new Promise<void>((ok, erro) => {
      const tx = v2.transaction(['tecnicos', 'bases'], 'readwrite')
      tx.objectStore('tecnicos').put({ nome: 'Fulano', registro: 7, carimbo: { png: new Uint8Array([1]), width: 1, height: 1 } })
      tx.objectStore('bases').put({ nome: 'enel', versao: 'abc', dados: { x: 1 } })
      tx.oncomplete = () => ok()
      tx.onerror = () => erro(tx.error)
    })
    v2.close()

    expect((await listarTecnicos())[0].registro).toBe(7)
    expect(await lerBase('enel')).toEqual({ nome: 'enel', versao: 'abc', dados: { x: 1 } })
    expect(await lerSugestoes()).toEqual({})
  })

  it('grava, lê e apaga sugestões', async () => {
    const a = { qtd: { '900001': 1.5 }, novos: [] }
    const b = { qtd: { '900002': 3 }, novos: [] }
    expect(await gravarSugestoes([
      { estrutura: 'KITX1', ajuste: a, data: '2026-11-05T12:00:00.000Z' },
      { estrutura: 'KITX2', ajuste: b, data: '2026-11-05T12:00:00.000Z' },
    ], [])).toBe(true)
    expect(Object.keys(await lerSugestoes()).sort()).toEqual(['KITX1', 'KITX2'])
    await gravarSugestoes([], ['KITX1'])
    expect(await lerSugestoes()).toEqual({ KITX2: { estrutura: 'KITX2', ajuste: b, data: '2026-11-05T12:00:00.000Z' } })
  })

  it('aba antiga com a versão 1 aberta: não fica pendente', async () => {
    const v1 = await new Promise<IDBDatabase>((ok, erro) => {
      const req = indexedDB.open('fechamento', 1)
      req.onupgradeneeded = () => req.result.createObjectStore('tecnicos', { keyPath: 'registro' })
      req.onsuccess = () => ok(req.result)
      req.onerror = () => erro(req.error)
    })
    // v1 fica aberta de propósito, sem fechar
    expect(await lerBase('enel')).toBeNull()
    await expect(gravarBase({ nome: 'enel', versao: 'a', dados: 1 })).resolves.toBeUndefined()
    expect(await listarTecnicos()).toEqual([])
    v1.close()
  })
})
