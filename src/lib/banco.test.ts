import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { abrirBanco, gravarBase, guardarPendenteMO, lerPendenteMO, tirarPendenteMO, gravarRespostasMO, gravarSugestoes, lerBase, lerRespostasMO, lerSugestoes } from './banco'
import { respostasVazias } from '../ceara/maoDeObra'
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
    expect(db.version).toBe(4)
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

  it('grava e lê por OT', async () => {
    const r = { ...respostasVazias('8000001'), cidade: 'OUTRA' }
    expect(await gravarRespostasMO(r)).toBe(true)
    expect(await lerRespostasMO('8000001')).toEqual(r)
    expect(await lerRespostasMO('8000002')).toBeNull()
  })

  it('migração 3 → 4 não perde nada', async () => {
    const ajuste = { estrutura: 'KITX1', ajuste: { qtd: { '900001': 1 }, novos: [] }, data: 'x' }
    const v3 = await new Promise<IDBDatabase>((ok, erro) => {
      const req = indexedDB.open('fechamento', 3)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('tecnicos', { keyPath: 'registro' })
        req.result.createObjectStore('bases', { keyPath: 'nome' })
        req.result.createObjectStore('ajustes', { keyPath: 'estrutura' })
      }
      req.onsuccess = () => ok(req.result)
      req.onerror = () => erro(req.error)
    })
    await new Promise<void>((ok, erro) => {
      const tx = v3.transaction(['tecnicos', 'bases', 'ajustes'], 'readwrite')
      tx.objectStore('tecnicos').put({ nome: 'Fulano', registro: 7, carimbo: { png: new Uint8Array([1]), width: 1, height: 1 } })
      tx.objectStore('bases').put({ nome: 'enel', versao: 'abc', dados: { x: 1 } })
      tx.objectStore('ajustes').put(ajuste)
      tx.oncomplete = () => ok()
      tx.onerror = () => erro(tx.error)
    })
    v3.close()

    const db = await abrirBanco()
    expect(db.objectStoreNames.contains('maoDeObra')).toBe(true)
    db.close()
    expect((await listarTecnicos())[0].registro).toBe(7)
    expect(await lerBase('enel')).toEqual({ nome: 'enel', versao: 'abc', dados: { x: 1 } })
    expect(await lerSugestoes()).toEqual({ KITX1: ajuste })
  })

  it('cópia ao fechar a página: guarda, lê pela OT e só tira a da mesma OT', () => {
    const memoria = new Map<string, string>()
    const antes = globalThis.localStorage
    globalThis.localStorage = {
      getItem: (k: string) => memoria.get(k) ?? null,
      setItem: (k: string, v: string) => void memoria.set(k, v),
      removeItem: (k: string) => void memoria.delete(k),
    } as Storage
    try {
      const r = { ...respostasVazias('8000001'), cidade: 'OUTRA' }
      expect(lerPendenteMO()).toBeNull()
      guardarPendenteMO(r)
      expect(lerPendenteMO('8000001')).toEqual(r)
      expect(lerPendenteMO()).toEqual(r)
      expect(lerPendenteMO('8000002')).toBeNull()
      // gravação de outra OT não tira a cópia; a da mesma OT tira
      tirarPendenteMO('8000002')
      expect(lerPendenteMO('8000001')).toEqual(r)
      tirarPendenteMO('8000001')
      expect(lerPendenteMO()).toBeNull()
    } finally {
      globalThis.localStorage = antes
    }
  })

  it('sem localStorage: a cópia não quebra nada', () => {
    const antes = globalThis.localStorage
    // @ts-expect-error simula navegador sem localStorage
    globalThis.localStorage = undefined
    try {
      expect(() => guardarPendenteMO(respostasVazias('8000001'))).not.toThrow()
      expect(lerPendenteMO('8000001')).toBeNull()
      expect(() => tirarPendenteMO('8000001')).not.toThrow()
    } finally {
      globalThis.localStorage = antes
    }
  })

  it('sem IndexedDB: respostas da mão de obra', async () => {
    // @ts-expect-error simula navegador sem IndexedDB
    globalThis.indexedDB = undefined
    expect(await lerRespostasMO('8000001')).toBeNull()
    expect(await gravarRespostasMO(respostasVazias('8000001'))).toBe(false)
  })
})
