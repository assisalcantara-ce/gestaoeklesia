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
  let session: any = null
  try {
    const result = await Promise.race([getSessionPromise, timeoutPromise]) as { data: { session: any } }
    session = result?.data?.session ?? null
  } catch (error: any) {
    // Mantem a chamada de API mesmo sem token para permitir respostas 401/403 controladas pelo backend.
    if (error?.message !== 'SESSION_TIMEOUT') {
      console.warn('[authenticatedFetch] Falha ao obter sessão:', error)
    }
  }
  
  const headers = new Headers(options.headers || {})
  
  // Impersonation 2.0B: Se existir um token de impersonação ativo no navegador, injetá-lo com prioridade.
  let impersonationToken: string | null = null;
  if (typeof window !== 'undefined') {
    impersonationToken =
      sessionStorage.getItem('eklesia_impersonation_token') ||
      localStorage.getItem('eklesia_impersonation_token');
  }

  if (impersonationToken) {
    headers.set('Authorization', `Bearer ${impersonationToken}`)
  } else if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }

  const requestInit: RequestInit = {
    ...options,
    headers,
    credentials: options.credentials ?? 'same-origin',
  }

  try {
    return await fetch(url, requestInit)
  } catch (error) {
    // Alguns navegadores podem falhar com URL relativa em cenários específicos (ex.: navegação/estado de sessão).
    if (typeof window !== 'undefined' && url.startsWith('/')) {
      const absoluteUrl = `${window.location.origin}${url}`
      try {
        return await fetch(absoluteUrl, requestInit)
      } catch {
        // Cai no erro amigável abaixo.
      }
    }

    throw new Error('Falha de rede ao comunicar com o servidor. Verifique conexão, login e se o app está em execução.')
  }
}
