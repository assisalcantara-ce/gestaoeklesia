import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredModule: 'pagamentos' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase, user } = result.ctx

    const body = await request.json()
    const {
      action,
      ministry_id,
      cancel_reason,
      new_due_day,
      pending_action,
      new_installments_count,
      amount_per_installment,
      plano_slug,
    } = body

    if (!ministry_id || !action) {
      return NextResponse.json({ error: 'Campos obrigatórios: ministry_id, action' }, { status: 400 })
    }

    // Buscar o ministério
    const { data: ministry, error: minErr } = await supabase
      .from('ministries')
      .select('id, name')
      .eq('id', ministry_id)
      .maybeSingle()

    if (minErr || !ministry) {
      return NextResponse.json({ error: 'Cliente/Ministério não encontrado' }, { status: 404 })
    }

    // 1. AÇÃO: Cancelar todas as pendentes
    if (action === 'cancel_all_pending') {
      if (!cancel_reason || !cancel_reason.trim()) {
        return NextResponse.json({ error: 'O motivo do cancelamento é obrigatório.' }, { status: 400 })
      }

      const { data: pendingInvoices } = await supabase
        .from('platform_billing_invoices')
        .select('id')
        .eq('ministry_id', ministry_id)
        .in('status', ['pending', 'PENDING', 'overdue', 'OVERDUE', 'vencido', 'pendente'])

      if (!pendingInvoices || pendingInvoices.length === 0) {
        return NextResponse.json({ message: 'Nenhuma cobrança pendente encontrada para cancelar.' })
      }

      const invoiceIds = pendingInvoices.map((i) => i.id)

      const { error: updateErr } = await supabase
        .from('platform_billing_invoices')
        .update({
          status: 'canceled',
          updated_at: new Date().toISOString(),
        } as any)
        .in('id', invoiceIds)

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 400 })
      }

      // Auditoria
      try {
        await supabase.from('admin_audit_logs').insert([
          {
            action: 'batch_cancel_invoices',
            entity_type: 'platform_billing_invoices',
            entity_id: ministry_id,
            changes: {
              ministry_name: ministry.name,
              canceled_count: invoiceIds.length,
              invoice_ids: invoiceIds,
              cancel_reason,
              by_admin: user.email,
              timestamp: new Date().toISOString(),
            },
            status: 'success',
          },
        ])
      } catch {
        // Ignora erro se auditoria indisponível
      }

      return NextResponse.json({ success: true, count: invoiceIds.length })
    }

    // 2. AÇÃO: Excluir todas as pendentes (Super Admin exclusivo)
    if (action === 'delete_all_pending') {
      const { data: adminProfile } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()

      const isSuperAdmin = adminProfile?.role === 'admin' || user.email === 'admin@gestaoeklesia.com.br'
      if (!isSuperAdmin) {
        return NextResponse.json(
          { error: 'Permissão negada. Apenas o Super Admin pode excluir cobranças pendentes em lote.' },
          { status: 403 },
        )
      }

      const { data: pendingInvoices } = await supabase
        .from('platform_billing_invoices')
        .select('id')
        .eq('ministry_id', ministry_id)
        .in('status', ['pending', 'PENDING', 'overdue', 'OVERDUE', 'vencido', 'pendente'])

      if (!pendingInvoices || pendingInvoices.length === 0) {
        return NextResponse.json({ message: 'Nenhuma cobrança pendente encontrada para excluir.' })
      }

      const invoiceIds = pendingInvoices.map((i) => i.id)

      const { error: delErr } = await supabase
        .from('platform_billing_invoices')
        .delete()
        .in('id', invoiceIds)

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 400 })
      }

      // Auditoria
      try {
        await supabase.from('admin_audit_logs').insert([
          {
            action: 'batch_delete_invoices',
            entity_type: 'platform_billing_invoices',
            entity_id: ministry_id,
            changes: {
              ministry_name: ministry.name,
              deleted_count: invoiceIds.length,
              invoice_ids: invoiceIds,
              by_admin: user.email,
              timestamp: new Date().toISOString(),
            },
            status: 'success',
          },
        ])
      } catch {
        // Ignora erro se auditoria indisponível
      }

      return NextResponse.json({ success: true, count: invoiceIds.length })
    }

    // 3. AÇÃO: Regenerar Cobranças
    if (action === 'regenerate') {
      if (!new_due_day || new_due_day < 1 || new_due_day > 31) {
        return NextResponse.json({ error: 'Dia de vencimento inválido (deve ser de 1 a 31).' }, { status: 400 })
      }

      const installmentCount = Math.max(1, Number(new_installments_count || 1))
      const amountVal = Number(amount_per_installment || 0)
      if (amountVal <= 0) {
        return NextResponse.json({ error: 'Valor da parcela deve ser maior que zero.' }, { status: 400 })
      }

      // 3.1 Tratar cobranças pendentes existentes (sem alterar nenhuma fatura paga)
      const { data: existingPending } = await supabase
        .from('platform_billing_invoices')
        .select('id')
        .eq('ministry_id', ministry_id)
        .in('status', ['pending', 'PENDING', 'overdue', 'OVERDUE', 'vencido', 'pendente'])

      const existingIds = existingPending ? existingPending.map((i) => i.id) : []

      if (existingIds.length > 0) {
        if (pending_action === 'delete') {
          await supabase.from('platform_billing_invoices').delete().in('id', existingIds)
        } else {
          await supabase
            .from('platform_billing_invoices')
            .update({
              status: 'canceled',
              updated_at: new Date().toISOString(),
            } as any)
            .in('id', existingIds)
        }
      }

      // 3.2 Gerar o novo cronograma de parcelas com o novo dia de vencimento
      const today = new Date()
      const newInvoicesToInsert = []

      for (let i = 0; i < installmentCount; i++) {
        const dueDateObj = new Date(today.getFullYear(), today.getMonth() + i, Number(new_due_day))
        const dueDateStr = dueDateObj.toISOString().split('T')[0]

        newInvoicesToInsert.push({
          ministry_id,
          plano_slug: plano_slug || 'avulsa',
          status: 'pending',
          amount: amountVal,
          due_date: dueDateStr,
          period_start: dueDateStr,
          period_end: dueDateStr,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }

      const { data: insertedData, error: insertErr } = await supabase
        .from('platform_billing_invoices')
        .insert(newInvoicesToInsert)
        .select()

      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 400 })
      }

      // Auditoria da operação de regeneração
      try {
        await supabase.from('admin_audit_logs').insert([
          {
            action: 'batch_regenerate_invoices',
            entity_type: 'platform_billing_invoices',
            entity_id: ministry_id,
            changes: {
              ministry_name: ministry.name,
              pending_action_taken: pending_action,
              treated_pending_count: existingIds.length,
              new_installments_generated: installmentCount,
              new_due_day,
              amount_per_installment: amountVal,
              by_admin: user.email,
              timestamp: new Date().toISOString(),
            },
            status: 'success',
          },
        ])
      } catch {
        // Ignora erro se auditoria indisponível
      }

      return NextResponse.json({
        success: true,
        treated_pending_count: existingIds.length,
        new_invoices_count: insertedData ? insertedData.length : 0,
      })
    }

    return NextResponse.json({ error: 'Ação não reconhecida.' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno do servidor' }, { status: 500 })
  }
}
