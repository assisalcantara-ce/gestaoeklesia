import { checkRateLimit } from '@/lib/rate-limit'
import { createServerClient } from '@/lib/supabase-server'

type RateLimitResult =
  | {
      allowed: true
      remaining: number
      resetAt: number
      source: 'db' | 'memory'
    }
  | {
      allowed: false
      remaining: 0
      resetAt: number
      retryAfterSeconds: number
      source: 'db' | 'memory'
    }

function parseResetAt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const t = Date.parse(value)
    if (!Number.isNaN(t)) return t
  }
  return Date.now()
}

export async function consumeRateLimit(params: {
  bucketKey: string
  limit: number
  windowMs: number
  now?: number
}): Promise<RateLimitResult> {
  const now = params.now ?? Date.now()
  const supabase = createServerClient()

  const windowSeconds = Math.max(Math.floor(params.windowMs / 1000), 1)

  const { data, error } = await supabase.rpc('consume_rate_limit', {
    bucket_key: params.bucketKey,
    p_limit: params.limit,
    p_window_seconds: windowSeconds,
  } as any)

  if (error) {
    const fallback = checkRateLimit({ key: params.bucketKey, limit: params.limit, windowMs: params.windowMs, now })
    if (fallback.allowed) {
      return { ...fallback, source: 'memory' }
    }
    return { ...fallback, source: 'memory' }
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    const fallback = checkRateLimit({ key: params.bucketKey, limit: params.limit, windowMs: params.windowMs, now })
    if (fallback.allowed) {
      return { ...fallback, source: 'memory' }
    }
    return { ...fallback, source: 'memory' }
  }

  const allowed = Boolean((row as any).allowed)
  const remaining = Number((row as any).remaining || 0)
  const resetAt = parseResetAt((row as any).reset_at)
  const retryAfterSeconds = Number((row as any).retry_after_seconds || 0)

  if (!allowed) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfterSeconds: Math.max(retryAfterSeconds, 1),
      source: 'db',
    }
  }

  return {
    allowed: true,
    remaining,
    resetAt,
    source: 'db',
  }
}
