import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { getClientIp, getUserAgent, normalizeEmail, sha256Hex } from '@/lib/public-request'

type EventType = 'rate_limited' | 'request_ok' | 'request_error'

let supabaseAdmin: ReturnType<typeof createClient> | null = null

function getAdminClient() {
  if (supabaseAdmin) return supabaseAdmin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  supabaseAdmin = createClient(url, key)
  return supabaseAdmin
}

export async function logPublicApiEvent(params: {
  request: NextRequest
  route: 'v1/signup' | 'v1/contact'
  type: EventType
  email?: string | null
  meta?: Record<string, any>
}) {
  try {
    const supabase = getAdminClient()
    if (!supabase) return

    const ip = getClientIp(params.request)
    const userAgent = getUserAgent(params.request)

    const emailHash = params.email ? sha256Hex(normalizeEmail(params.email)) : null

    // Tabela pode não existir ainda; não quebrar o fluxo.
    await (supabase as any).from('public_api_events').insert({
      route: params.route,
      event_type: params.type,
      ip_address: ip,
      user_agent: userAgent,
      email_hash: emailHash,
      meta: params.meta ?? null,
      created_at: new Date().toISOString(),
    })
  } catch {
    // Intencionalmente silencioso (não impactar request público)
  }
}
