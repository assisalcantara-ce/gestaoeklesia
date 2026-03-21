/**
 * CLIENTE SUPABASE COM RLS SEGURO
 * Usa token JWT do usuário logado
 * Acesso controlado por RLS policies
 * 
 * Arquivo: src/lib/supabase-rls.ts
 * Uso: Operações que precisam isolamento por ministry_id
 */

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

export function createRLSClient(accessToken: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  )
}

/**
 * Exemplo de uso em API route:
 * 
 * import { createServerClient } from '@/lib/supabase-server'
 * 
 * export async function POST(request: Request) {
 *   const supabase = createServerClient()
 *   
 *   // Inserir com isolamento automático por RLS
 *   const { data, error } = await supabase
 *     .from('members')
 *     .insert([...])
 * }
 */
