/**
 * Extrai de forma segura o corpo JSON de uma Response HTTP.
 * Se a resposta não for JSON (por exemplo, página de erro HTML 500/502 do Next.js/Vercel
 * que começa com "An error occurred..."), captura o texto bruto e retorna
 * um objeto { error: string } estruturado, prevenindo a quebra
 * "Unexpected token 'A', 'An error o'... is not valid JSON".
 */
export async function safeResponseJson<T = any>(
  response: Response,
  fallbackErrorMessage = 'Resposta inválida do servidor.'
): Promise<{ ok: boolean; data?: T; error?: string; status: number; [key: string]: any }> {
  const status = response.status;
  const contentType = response.headers.get('content-type') || '';

  try {
    const rawText = await response.text();
    const trimmed = rawText.trim();

    if (!trimmed) {
      return {
        ok: response.ok,
        error: response.ok ? undefined : `${fallbackErrorMessage} (HTTP ${status})`,
        status,
      };
    }

    // Se o Content-Type indicar JSON ou se começar com { ou [
    if (
      contentType.includes('application/json') ||
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === 'object' && parsed !== null) {
          return {
            ok: response.ok,
            status,
            ...parsed,
          };
        }
        return {
          ok: response.ok,
          data: parsed,
          status,
        };
      } catch {
        // Fallback se JSON.parse falhar mesmo iniciando com {
      }
    }

    // Caso a resposta seja texto puro ou HTML (ex: "An error occurred on the server...")
    let cleanText = trimmed;
    // Remove tags HTML básicas se presentes
    if (cleanText.includes('<html') || cleanText.includes('<body') || cleanText.includes('<!DOCTYPE')) {
      const match = cleanText.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
                    cleanText.match(/<p[^>]*>([\s\S]*?)<\/p>/i) ||
                    cleanText.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      cleanText = match ? match[1].replace(/<[^>]+>/g, '').trim() : `Erro no servidor (HTTP ${status})`;
    } else if (cleanText.length > 200) {
      cleanText = cleanText.substring(0, 197) + '...';
    }

    return {
      ok: response.ok,
      error: cleanText || `${fallbackErrorMessage} (HTTP ${status})`,
      status,
      rawText: trimmed,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || `${fallbackErrorMessage} (HTTP ${status})`,
      status,
    };
  }
}


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
    // Mantém a chamada de API mesmo sem token para permitir respostas 401/403 controladas pelo backend.
    if (error?.message !== 'SESSION_TIMEOUT') {
      console.warn('[authenticatedFetch] Falha ao obter sessão:', error)
    }
  }
  
  const headers = new Headers(options.headers || {})

  if (session?.access_token) {
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
