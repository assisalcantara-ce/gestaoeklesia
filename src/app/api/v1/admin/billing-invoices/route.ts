import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request)
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase } = result.ctx

    const status = request.nextUrl.searchParams.get('status')

    let query = supabase
      .from('platform_billing_invoices')
      .select(`
        id,
        ministry_id,
        subscription_plan_id,
        plano_slug,
        status,
        amount,
        due_date,
        period_start,
        period_end,
        asaas_customer_id,
        asaas_payment_id,
        asaas_invoice_url,
        created_at,
        updated_at,
        ministries (
          name
        )
      `)
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
