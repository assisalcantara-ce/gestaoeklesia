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

  let impersonationToken: string | null = null;
  if (typeof window !== 'undefined') {
    impersonationToken =
      sessionStorage.getItem('eklesia_impersonation_token') ||
      localStorage.getItem('eklesia_impersonation_token');
  }

  const globalHeaders: Record<string, string> = {};
  if (impersonationToken) {
    globalHeaders['Authorization'] = `Bearer ${impersonationToken}`;
  }

  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: globalHeaders,
      },
    }
  )
  return browserClient
}
