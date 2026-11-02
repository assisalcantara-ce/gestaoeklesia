import { createServerClient } from '@/lib/supabase-server'

export interface CheckIdempotencyResult {
  isDuplicate: boolean
  cachedResponse?: {
    statusCode: number
    body: any
  }
}

/**
 * Registra ou verifica atomicamente se uma chave de idempotência já foi processada com sucesso.
 * Utiliza a tabela 'hub_m2m_nonces' com prefixo 'idemp:' para persistência transacional sem risco de race condition.
 */
export async function checkAndRegisterIdempotency(
  idempotencyKey: string,
  operation: string,
  correlationId: string,
  keyId: string
): Promise<{ success: boolean; isDuplicate: boolean; error?: string }> {
  const nonceKey = `idemp:${operation}:${idempotencyKey}`
  const now = Date.now()
  const TTL_MS = 24 * 60 * 60 * 1000 // 24 horas

  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('hub_m2m_nonces').insert([
      {
        nonce: nonceKey,
        key_id: keyId,
        correlation_id: correlationId,
        created_at: new Date().toISOString(),
        expires_at: new Date(now + TTL_MS).toISOString(),
      },
    ])

    if (error) {
      // 23505 = Unique violation -> Chave de idempotência já executada
      if (error.code === '23505') {
        return { success: true, isDuplicate: true }
      }
      return { success: false, isDuplicate: false, error: error.message }
    }

    return { success: true, isDuplicate: false }
  } catch (err: any) {
    return { success: false, isDuplicate: false, error: err?.message || String(err) }
  }
}

/**
 * Remove o registro de idempotência caso a operação sofra falha técnica ou erro de validação.
 * Garante que operações com falha NÃO sejam marcadas como concluídas, permitindo retentativa legítima.
 */
export async function releaseIdempotencyKey(
  idempotencyKey: string,
  operation: string
): Promise<void> {
  const nonceKey = `idemp:${operation}:${idempotencyKey}`
  try {
    const supabase = createServerClient()
    await supabase.from('hub_m2m_nonces').delete().eq('nonce', nonceKey)
  } catch (err: any) {
    console.error('[M2M_IDEMPOTENCY_RELEASE_ERROR] Falha ao liberar chave de idempotência após erro:', err?.message || err)
  }
}

