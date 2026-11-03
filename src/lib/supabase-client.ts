/**
 * CLIENTE SUPABASE PARA FRONTEND (anon key)
 * Acesso controlado por RLS
 * 
 * Arquivo: src/lib/supabase-client.ts
 * Uso: Operações de leitura/escrita no front-end
 */

import { createBrowserClient } from '@supabase/ssr'

let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (browserClient) return browserClient
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (url, options = {}) => {
          // Timeout de 15 segundos para evitar travamento indefinido na UI
          if (!options.signal && typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
            return fetch(url, {
              ...options,
              signal: AbortSignal.timeout(15000),
            })
          }
          return fetch(url, options)
        },
      },
      auth: {
        lock: typeof window !== 'undefined'
          ? async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => fn()
          : undefined,
      },
    }
  )
  return browserClient
}
