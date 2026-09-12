import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredModule: 'pagamentos' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase } = result.ctx

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query = supabase
      .from('platform_expenses')
      .select('*, platform_financial_categories(name, type)')
      .order('due_date', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    if (startDate) {
      query = query.gte('reference_date', startDate)
    }
    if (endDate) {
      query = query.lte('reference_date', endDate)
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
    const result = await requireAdmin(request, { requiredModule: 'pagamentos' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase, user } = result.ctx

    const body = await request.json()
    const {
      category_id,
      description,
      amount,
      reference_date,
      due_date,
      paid_at,
      status,
      payment_method,
      is_recurring,
      recipient_name,
      receipt_url,
      notes,
    } = body

    if (!description || !amount || Number(amount) <= 0 || !due_date || !reference_date) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: description, amount (maior que zero), reference_date, due_date' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('platform_expenses')
      .insert([
        {
          category_id: category_id || null,
          description: String(description).trim(),
          amount: Number(amount),
          reference_date,
          due_date,
          paid_at: status === 'paid' ? (paid_at || new Date().toISOString()) : null,
          status: status || 'pending',
          payment_method: payment_method || null,
          is_recurring: Boolean(is_recurring),
          recipient_name: recipient_name ? String(recipient_name).trim() : null,
          receipt_url: receipt_url ? String(receipt_url).trim() : null,
          notes: notes ? String(notes).trim() : null,
          created_by: user.id,
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
