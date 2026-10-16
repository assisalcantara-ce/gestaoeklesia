/**
 * API ROUTE: Ministries Autocomplete Search (Admin Suporte / Admin)
 * Busca dinâmica de ministérios/tenants por nome para autocomplete administrativo.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredModule: 'suporte' })
    if (!result.ok) return result.response
    const { supabaseAdmin } = result.ctx

    const searchParams = request.nextUrl.searchParams
    const rawQuery = (searchParams.get('q') || '').trim()

    // Sanitizar entrada para prevenir quebra no padrão LIKE / ILIKE
    const sanitized = rawQuery.replace(/[%_]/g, '').trim()

    // Regra: Mínimo de 3 caracteres válidos para efetuar a busca
    if (!sanitized || sanitized.length < 3) {
      return NextResponse.json({
        data: [],
        message: 'Informe pelo menos 3 caracteres para buscar.',
      })
    }

    // Consulta somente colunas operacionais seguras (sem dados sensíveis, senhas ou credenciais)
    const { data, error } = await supabaseAdmin
      .from('ministries')
      .select('id, name, slug, cnpj_cpf, address_city, address_state, subscription_status, plan')
      .ilike('name', `%${sanitized}%`)
      .order('name', { ascending: true })
      .limit(20)

    if (error) {
      console.error('[MINISTRIES SEARCH GET] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      data: data || [],
    })
  } catch (err: any) {
    console.error('[MINISTRIES SEARCH GET] Server Error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno no servidor' }, { status: 500 })
  }
}
