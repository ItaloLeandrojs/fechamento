// Onde a sessão fica guardada. Separado do supabase.ts para os testes não dependerem de import.meta.env.
import type { SupportedStorage } from '@supabase/supabase-js'

function emMemoria(): SupportedStorage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  }
}

function padrao(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null // alguns navegadores lançam só de tocar no localStorage
  }
}

/** Usa o localStorage quando ele grava e lê de volta; senão guarda só em memória (soNestaAba). */
export function armazenamentoDaSessao(storage: Storage | null = padrao()): { storage: SupportedStorage; soNestaAba: boolean } {
  if (storage) {
    try {
      const chave = '__teste_armazenamento__'
      storage.setItem(chave, '1')
      const leu = storage.getItem(chave) === '1'
      storage.removeItem(chave)
      if (leu) return { storage, soNestaAba: false }
    } catch {
      // cai para a memória
    }
  }
  return { storage: emMemoria(), soNestaAba: true }
}
