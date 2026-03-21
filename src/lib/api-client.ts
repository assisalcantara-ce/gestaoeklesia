/**
 * API Client com autenticação Supabase
 * Injeta automaticamente o token Bearer nas requisições
 */

import { createClient } from '@/lib/supabase-client'

export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
) {
  const supabase = createClient()

  const getSessionPromise = supabase.auth.getSession()
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('SESSION_TIMEOUT')), 8000)
  })

  // Obter a sessão atual (com timeout para não travar a UI)
  const { data: { session } } = await Promise.race([getSessionPromise, timeoutPromise])
  
  const headers = new Headers(options.headers || {})
  
  // Adicionar token de autorização
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }

  return fetch(url, {
    ...options,
    headers,
  })
}
