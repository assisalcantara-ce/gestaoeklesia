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
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return browserClient
}
