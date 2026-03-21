/**
 * CLIENTE SUPABASE PARA SERVIDOR (service_role key)
 * Acesso TOTAL ao banco de dados (ignora RLS)
 * 
 * Arquivo: src/lib/supabase-server.ts
 * Uso: API routes, funções administrativas
 * ⚠️  NUNCA exponha este cliente ao frontend!
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient(
    supabaseUrl!,
    serviceRoleKey!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

export function createServerClientFromRequest(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')

  return createClient(
    supabaseUrl!,
    anonKey!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey || '',
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  )
}
