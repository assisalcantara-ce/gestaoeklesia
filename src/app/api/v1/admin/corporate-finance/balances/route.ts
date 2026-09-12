import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredModule: 'pagamentos' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase } = result.ctx

    const searchParams = request.nextUrl.searchParams
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()

    const { data, error } = await supabase
      .from('platform_financial_balances')
      .select('*')
      .eq('reference_year', year)
      .order('reference_month', { ascending: true })

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
    const { supabaseAdmin: supabase, user } = result.ctx

    const body = await request.json()
    const {
      account_name,
      reference_year,
      reference_month,
      initial_balance,
      notes,
    } = body

    if (!reference_year || !reference_month) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: reference_year, reference_month' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('platform_financial_balances')
      .upsert(
        {
          account_name: account_name || 'Conta Principal Gestão Eklésia',
          reference_year: Number(reference_year),
          reference_month: Number(reference_month),
          initial_balance: Number(initial_balance || 0),
          notes: notes ? String(notes).trim() : null,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_name,reference_year,reference_month' }
      )
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
