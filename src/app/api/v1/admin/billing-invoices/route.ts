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
          name,
          phone
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

export async function PATCH(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredModule: 'pagamentos' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase, user } = result.ctx

    const body = await request.json()
    const { invoice_id, action, cancel_reason } = body

    if (!invoice_id) {
      return NextResponse.json({ error: 'ID da fatura é obrigatório' }, { status: 400 })
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from('platform_billing_invoices')
      .select('*')
      .eq('id', invoice_id)
      .maybeSingle()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 })
    }

    let newStatus = invoice.status
    if (action === 'cancel') {
      if (!cancel_reason || !cancel_reason.trim()) {
        return NextResponse.json({ error: 'O motivo do cancelamento é obrigatório.' }, { status: 400 })
      }
      newStatus = 'canceled'
    } else if (action === 'reopen') {
      newStatus = 'pending'
    } else {
      return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('platform_billing_invoices')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', invoice_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    // Auditoria
    try {
      await supabase.from('admin_audit_logs').insert([
        {
          action: action === 'cancel' ? 'cancel_billing_invoice' : 'reopen_billing_invoice',
          entity_type: 'platform_billing_invoices',
          entity_id: invoice_id,
          changes: {
            previous_status: invoice.status,
            new_status: newStatus,
            cancel_reason: cancel_reason || null,
            by_admin: user.email,
            timestamp: new Date().toISOString(),
          },
          status: 'success',
        },
      ])
    } catch {
      // Ignora se tabela de auditoria não existir
    }

    return NextResponse.json({ success: true, status: newStatus })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredModule: 'pagamentos' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase, user } = result.ctx

    // Exclusividade Super Admin (role === 'admin')
    const { data: adminProfile } = await supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    const isSuperAdmin = adminProfile?.role === 'admin' || user.email === 'admin@gestaoeklesia.com.br'
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas o Super Admin possui permissão para exclusão permanente de cobranças.' },
        { status: 403 },
      )
    }

    const invoiceId = request.nextUrl.searchParams.get('id')
    if (!invoiceId) {
      return NextResponse.json({ error: 'ID da cobrança é obrigatório' }, { status: 400 })
    }

    const { data: invoice } = await supabase
      .from('platform_billing_invoices')
      .select('*')
      .eq('id', invoiceId)
      .maybeSingle()

    if (!invoice) {
      return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 })
    }

    const { error: deleteError } = await supabase
      .from('platform_billing_invoices')
      .delete()
      .eq('id', invoiceId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    // Auditoria
    try {
      await supabase.from('admin_audit_logs').insert([
        {
          action: 'delete_billing_invoice',
          entity_type: 'platform_billing_invoices',
          entity_id: invoiceId,
          changes: {
            deleted_invoice: invoice,
            by_admin: user.email,
            timestamp: new Date().toISOString(),
          },
          status: 'success',
        },
      ])
    } catch {
      // Ignora erro se auditoria indisponível
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno do servidor' }, { status: 500 })
  }
}
