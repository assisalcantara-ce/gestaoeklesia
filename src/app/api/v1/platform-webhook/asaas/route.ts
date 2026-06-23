import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Validar token
    const receivedToken = request.headers.get('asaas-access-token') || request.nextUrl.searchParams.get('token')
    const expectedToken = process.env.PLATFORM_ASAAS_WEBHOOK_TOKEN || process.env.ASAAS_WEBHOOK_TOKEN

    if (!expectedToken || receivedToken !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { event, payment } = body

    if (!event || !payment?.id) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // Apenas eventos de confirmação/recebimento de pagamento
    if (event !== 'PAYMENT_CONFIRMED' && event !== 'PAYMENT_RECEIVED') {
      return NextResponse.json({ skipped: true, reason: `Ignored event: ${event}` })
    }

    const supabase = createServerClient()

    // 1. Localizar platform_billing_invoices por asaas_payment_id
    const { data: invoice, error: invoiceError } = await supabase
      .from('platform_billing_invoices')
      .select('*')
      .eq('asaas_payment_id', payment.id)
      .maybeSingle()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // 2. Se já estiver paid, retornar skipped
    if (invoice.status === 'paid') {
      return NextResponse.json({ skipped: true, message: 'Invoice already marked as paid' })
    }

    // 3. Atualizar invoice (status='paid' e paid_at=now() se o campo existir)
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
        // Fallback: se a coluna paid_at não existir, atualizar apenas status e updated_at
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

    // 4. Ativar ministry
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

    // 6. Registrar admin_audit_logs se existir
    try {
      await supabase
        .from('admin_audit_logs')
        .insert([{
          action: 'payment_received_webhook',
          entity_type: 'platform_billing_invoices',
          entity_id: invoice.id,
          changes: {
            status: 'paid',
            payment_id: payment.id,
            ministry_id: invoice.ministry_id,
          },
          status: 'success',
        }])
    } catch {
      // Ignora silenciosamente se a tabela não existir
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 505 })
  }
}
