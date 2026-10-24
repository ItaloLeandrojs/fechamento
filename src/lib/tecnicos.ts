// Técnicos (nome, matrícula e carimbo) ficam só no navegador deste computador,
// no IndexedDB. Os carimbos têm CPF e assinatura: nunca vão no site publicado.
import { base64ParaBytes, bytesParaBase64 } from './imagem'

export interface TecnicoSalvo {
  nome: string
  registro: number
  carimbo: { png: Uint8Array; width: number; height: number }
}

interface ArquivoTecnicos {
  tipo: 'fechamento-tecnicos'
  versao: 1
  tecnicos: { nome: string; registro: number; carimbo: { png: string; width: number; height: number } }[]
}

const DB = 'fechamento'
const STORE = 'tecnicos'

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, erro) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'registro' })
    req.onsuccess = () => ok(req.result)
    req.onerror = () => erro(req.error)
  })
}

export async function listarTecnicos(): Promise<TecnicoSalvo[]> {
  try {
    const db = await abrir()
    return await new Promise((ok, erro) => {
      const req = db.transaction(STORE).objectStore(STORE).getAll()
      req.onsuccess = () => ok((req.result as TecnicoSalvo[]).sort((a, b) => a.nome.localeCompare(b.nome)))
      req.onerror = () => erro(req.error)
    })
  } catch {
    return [] // navegador sem IndexedDB (janela anônima, por exemplo)
  }
}

const MSG_GUARDAR = 'Não foi possível guardar a lista de técnicos neste navegador. Isso acontece em janela anônima, com o armazenamento bloqueado ou sem espaço no disco. Tente de novo numa janela normal.'

/** Roda uma escrita no IndexedDB e devolve uma mensagem clara, em português, se qualquer passo falhar. */
async function escrever(fazer: (st: IDBObjectStore) => void): Promise<void> {
  try {
    const db = await abrir()
    await new Promise<void>((ok, erro) => {
      const tx = db.transaction(STORE, 'readwrite')
      fazer(tx.objectStore(STORE))
      tx.oncomplete = () => ok()
      tx.onerror = () => erro(tx.error)
      tx.onabort = () => erro(tx.error)
    })
  } catch {
    throw new Error(MSG_GUARDAR)
  }
}

export function salvarTecnicos(lista: TecnicoSalvo[]): Promise<void> {
  return escrever((st) => {
    for (const t of lista) st.put(t)
  })
}

export function removerTecnico(registro: number): Promise<void> {
  return escrever((st) => {
    st.delete(registro)
  })
}

/** Lê o arquivo tecnicos-fechamento.json e valida o formato. */
export async function lerArquivoTecnicos(file: File): Promise<TecnicoSalvo[]> {
  let json: ArquivoTecnicos
  try {
    json = JSON.parse(await file.text())
  } catch {
    throw new Error('Esse arquivo não é a lista de técnicos (JSON inválido).')
  }
  if (json?.tipo !== 'fechamento-tecnicos' || !Array.isArray(json.tecnicos)) throw new Error('Esse arquivo não é a lista de técnicos do Fechamento.')
  return json.tecnicos.map((t) => {
    if (typeof t.nome !== 'string' || !Number.isFinite(Number(t.registro)) || typeof t.carimbo?.png !== 'string') throw new Error('Lista de técnicos com dados incompletos.')
    return { nome: t.nome, registro: Number(t.registro), carimbo: { png: base64ParaBytes(t.carimbo.png), width: t.carimbo.width, height: t.carimbo.height } }
  })
}

/** Gera o arquivo para levar a lista para outro computador. */
export function exportarTecnicos(lista: TecnicoSalvo[]): Blob {
  const arq: ArquivoTecnicos = {
    tipo: 'fechamento-tecnicos',
    versao: 1,
    tecnicos: lista.map((t) => ({ nome: t.nome, registro: t.registro, carimbo: { png: bytesParaBase64(t.carimbo.png), width: t.carimbo.width, height: t.carimbo.height } })),
  }
  return new Blob([JSON.stringify(arq)], { type: 'application/json' })
}
