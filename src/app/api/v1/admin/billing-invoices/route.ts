import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredModule: 'pagamentos' })
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

export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredModule: 'pagamentos' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase, user } = result.ctx

    const body = await request.json()
    const { invoice_id } = body

    if (!invoice_id) {
      return NextResponse.json({ error: 'ID da fatura é obrigatório' }, { status: 400 })
    }

    // 1. Localizar invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('platform_billing_invoices')
      .select('*')
      .eq('id', invoice_id)
      .maybeSingle()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 })
    }

    // 2. Se já estiver pago, retornar sucesso
    if (invoice.status === 'paid') {
      return NextResponse.json({ success: true, message: 'Fatura já está paga' })
    }

    // 3. Atualizar platform_billing_invoices
    let updateErrorObj = null
    try {
      const { error } = await supabase
        .from('platform_billing_invoices')
        .update({
          status: 'paid',
          updated_at: new Date().toISOString(),
          paid_at: new Date().toISOString(),
        } as any)
        .eq('id', invoice.id)

      if (error) {
        if (error.message?.includes('paid_at') || error.code === '42703') {
          const { error: fallbackError } = await supabase
            .from('platform_billing_invoices')
            .update({
              status: 'paid',
              updated_at: new Date().toISOString(),
            })
            .eq('id', invoice.id)
          updateErrorObj = fallbackError
        } else {
          updateErrorObj = error
        }
      }
    } catch (e: any) {
      updateErrorObj = e
    }

    if (updateErrorObj) {
      return NextResponse.json({ error: `Erro ao atualizar fatura: ${updateErrorObj.message}` }, { status: 400 })
    }

    // 4. Ativar o ministério
    const { data: ministry } = await supabase
      .from('ministries')
      .select('user_id')
      .eq('id', invoice.ministry_id)
      .maybeSingle()

    if (ministry) {
      await supabase
        .from('ministries')
        .update({
          subscription_status: 'active',
          plan: invoice.plano_slug,
          subscription_plan_id: invoice.subscription_plan_id,
          subscription_start_date: new Date().toISOString(),
          subscription_end_date: invoice.period_end,
          is_active: true,
        })
        .eq('id', invoice.ministry_id)

      // 5. Atualizar pre_registrations se existir
      if (ministry.user_id) {
        const { data: preReg } = await supabase
          .from('pre_registrations')
          .select('id, status')
          .eq('user_id', ministry.user_id)
          .maybeSingle()

        if (preReg && preReg.status !== 'efetivado') {
          await supabase
            .from('pre_registrations')
            .update({ status: 'efetivado' })
            .eq('id', preReg.id)
        }
      }
    }

    // 6. Registrar logs de auditoria se existir
    try {
      await supabase
        .from('admin_audit_logs')
        .insert([{
          action: 'manual_mark_as_paid',
          entity_type: 'platform_billing_invoices',
          entity_id: invoice.id,
          changes: {
            status: 'paid',
            ministry_id: invoice.ministry_id,
            by_admin: user.email,
          },
          status: 'success',
        }])
    } catch {
      // Ignora se a tabela não existir
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno do servidor' }, { status: 500 })
  }
}
