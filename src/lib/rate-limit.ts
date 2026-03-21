type RateLimitResult =
  | {
      allowed: true
      remaining: number
      resetAt: number
    }
  | {
      allowed: false
      remaining: 0
      resetAt: number
      retryAfterSeconds: number
    }

type Bucket = {
  count: number
  resetAt: number
}

function getStore(): Map<string, Bucket> {
  const g = globalThis as unknown as { __gestaoeclesialRateLimitStore?: Map<string, Bucket> }
  if (!g.__gestaoeclesialRateLimitStore) g.__gestaoeclesialRateLimitStore = new Map()
  return g.__gestaoeclesialRateLimitStore
}

export function checkRateLimit(params: {
  key: string
  limit: number
  windowMs: number
  now?: number
}): RateLimitResult {
  const now = params.now ?? Date.now()
  const store = getStore()

  const existing = store.get(params.key)
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + params.windowMs
    store.set(params.key, { count: 1, resetAt })
    return {
      allowed: true,
      remaining: Math.max(params.limit - 1, 0),
      resetAt,
    }
  }

  if (existing.count >= params.limit) {
    const retryAfterSeconds = Math.max(Math.ceil((existing.resetAt - now) / 1000), 1)
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds,
    }
  }

  existing.count += 1
  store.set(params.key, existing)

  return {
    allowed: true,
    remaining: Math.max(params.limit - existing.count, 0),
    resetAt: existing.resetAt,
  }
}
