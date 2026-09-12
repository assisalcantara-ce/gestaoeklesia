import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredModule: 'pagamentos' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase } = result.ctx

    const type = request.nextUrl.searchParams.get('type')
    let query = supabase.from('platform_financial_categories').select('*').order('name')

    if (type) {
      query = query.eq('type', type.toUpperCase())
    }

    const { data, error } = await query
    if (error && error.code !== '42P01') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase } = result.ctx

    const body = await request.json()
    const { name, type, description } = body

    if (!name || !type) {
      return NextResponse.json({ error: 'Nome e tipo (INCOME ou EXPENSE) são obrigatórios' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('platform_financial_categories')
      .insert([
        {
          name: String(name).trim(),
          type: String(type).trim().toUpperCase(),
          description: description ? String(description).trim() : null,
          is_active: true,
        },
      ])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno do servidor' }, { status: 500 })
  }
}
