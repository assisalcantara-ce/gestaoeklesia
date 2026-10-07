import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { BillingService } from '@/lib/platform/billing/service'

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
        .select('id, ministry_id, status, asaas_payment_id, amount, due_date')
        .eq('ministry_id', ministry_id)
        .in('status', ['pending', 'PENDING', 'overdue', 'OVERDUE', 'vencido', 'pendente'])

      if (!pendingInvoices || pendingInvoices.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'Nenhuma cobrança pendente encontrada para cancelar.',
          summary: {
            totalSelected: 0,
            canceledAsaas: 0,
            canceledLocally: 0,
            ignoredBlocked: 0,
            failed: 0,
            failures: [],
          },
        })
      }

      const billingService = new BillingService()
      const summary = {
        totalSelected: pendingInvoices.length,
        canceledAsaas: 0,
        canceledLocally: 0,
        ignoredBlocked: 0,
        failed: 0,
        failures: [] as Array<{ invoiceId: string; asaasPaymentId: string | null; reason: string }>,
      }

      for (const inv of pendingInvoices) {
        try {
          const res = await billingService.cancelOrDeleteInvoiceSynchronized(
            supabase,
            inv,
            {
              reason: cancel_reason,
              adminEmail: user.email,
            }
          )

          if (res.success) {
            if (res.asaasAction === 'deleted') summary.canceledAsaas++
            if (res.localAction === 'canceled') summary.canceledLocally++
          } else {
            if (res.asaasAction === 'blocked') {
              summary.ignoredBlocked++
            } else {
              summary.failed++
            }
            summary.failures.push({
              invoiceId: inv.id,
              asaasPaymentId: inv.asaas_payment_id || null,
              reason: res.error || 'Erro ao cancelar cobrança',
            })
          }
        } catch (itemErr: any) {
          summary.failed++
          summary.failures.push({
            invoiceId: inv.id,
            asaasPaymentId: inv.asaas_payment_id || null,
            reason: itemErr?.message || 'Exceção não tratada ao cancelar fatura',
          })
        }
      }

      // Auditoria
      try {
        await supabase.from('audit_logs').insert([
          {
            ministry_id,
            usuario_id: user.id,
            usuario_email: user.email,
            action: 'CANCEL',
            acao: 'deletar',
            resource_type: 'platform_billing_invoices',
            modulo: 'financeiro',
            area: 'pagamentos',
            tabela_afetada: 'platform_billing_invoices',
            resource_id: ministry_id,
            registro_id: ministry_id,
            descricao: `Cancelamento em lote de ${summary.canceledLocally} fatura(s) sincronizado com ASAAS para o cliente ${ministry.name}`,
            changes: {
              ministry_name: ministry.name,
              total_selected: summary.totalSelected,
              canceled_asaas: summary.canceledAsaas,
              canceled_locally: summary.canceledLocally,
              ignored_blocked: summary.ignoredBlocked,
              failed_count: summary.failed,
              failures: summary.failures,
              cancel_reason,
              by_admin: user.email,
            },
            status: summary.failed === 0 ? 'sucesso' : 'parcial',
            status_code: summary.failed === 0 ? 200 : 207,
            ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || '127.0.0.1',
            user_agent: request.headers.get('user-agent') || 'desconhecido',
          },
        ])
      } catch {
        // Ignora erro se auditoria indisponível
      }

      return NextResponse.json({
        success: summary.failed === 0,
        count: summary.canceledLocally,
        summary,
      })
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
        .select('id, ministry_id, status, asaas_payment_id, amount, due_date')
        .eq('ministry_id', ministry_id)
        .in('status', ['pending', 'PENDING', 'overdue', 'OVERDUE', 'vencido', 'pendente'])

      if (!pendingInvoices || pendingInvoices.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'Nenhuma cobrança pendente encontrada para excluir.',
          summary: {
            totalSelected: 0,
            canceledAsaas: 0,
            canceledLocally: 0,
            ignoredBlocked: 0,
            failed: 0,
            failures: [],
          },
        })
      }

      const billingService = new BillingService()
      const summary = {
        totalSelected: pendingInvoices.length,
        canceledAsaas: 0,
        canceledLocally: 0,
        ignoredBlocked: 0,
        failed: 0,
        failures: [] as Array<{ invoiceId: string; asaasPaymentId: string | null; reason: string }>,
      }

      const processedIds: string[] = []

      // Processar individualmente para não gerar falha em cascata
      for (const inv of pendingInvoices) {
        try {
          const res = await billingService.cancelOrDeleteInvoiceSynchronized(
            supabase,
            inv,
            {
              reason: 'Exclusão em lote de pendentes pelo Super Admin',
              adminEmail: user.email,
            }
          )

          if (res.success) {
            processedIds.push(inv.id)
            if (res.asaasAction === 'deleted') summary.canceledAsaas++
            if (res.localAction === 'canceled') summary.canceledLocally++
          } else {
            if (res.asaasAction === 'blocked') {
              summary.ignoredBlocked++
            } else {
              summary.failed++
            }
            summary.failures.push({
              invoiceId: inv.id,
              asaasPaymentId: inv.asaas_payment_id || null,
              reason: res.error || 'Erro desconhecido ao processar cobrança',
            })
          }
        } catch (itemErr: any) {
          summary.failed++
          summary.failures.push({
            invoiceId: inv.id,
            asaasPaymentId: inv.asaas_payment_id || null,
            reason: itemErr?.message || 'Exceção não tratada ao processar fatura',
          })
        }
      }

      // Auditoria com detalhes seguros da operação
      try {
        await supabase.from('audit_logs').insert([
          {
            ministry_id,
            usuario_id: user.id,
            usuario_email: user.email,
            action: 'DELETE',
            acao: 'deletar',
            resource_type: 'platform_billing_invoices',
            modulo: 'financeiro',
            area: 'pagamentos',
            tabela_afetada: 'platform_billing_invoices',
            resource_id: ministry_id,
            registro_id: ministry_id,
            descricao: `Exclusão em lote (soft delete) de ${summary.canceledLocally} fatura(s) sincronizada com ASAAS para o cliente ${ministry.name}`,
            changes: {
              ministry_name: ministry.name,
              total_selected: summary.totalSelected,
              canceled_asaas: summary.canceledAsaas,
              canceled_locally: summary.canceledLocally,
              ignored_blocked: summary.ignoredBlocked,
              failed_count: summary.failed,
              failures: summary.failures,
              by_admin: user.email,
            },
            status: summary.failed === 0 ? 'sucesso' : 'parcial',
            status_code: summary.failed === 0 ? 200 : 207,
            ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || '127.0.0.1',
            user_agent: request.headers.get('user-agent') || 'desconhecido',
          },
        ])
      } catch {
        // Ignora erro se auditoria indisponível
      }

      return NextResponse.json({
        success: summary.failed === 0,
        count: summary.canceledLocally,
        summary,
      })
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
        .select('id, ministry_id, status, asaas_payment_id')
        .eq('ministry_id', ministry_id)
        .in('status', ['pending', 'PENDING', 'overdue', 'OVERDUE', 'vencido', 'pendente'])

      const billingService = new BillingService()
      const existingInvoices = existingPending || []
      const existingIds = existingInvoices.map((i) => i.id)

      for (const inv of existingInvoices) {
        try {
          await billingService.cancelOrDeleteInvoiceSynchronized(supabase, inv, {
            reason: `Regeneração de cronograma (${pending_action || 'cancel'})`,
            adminEmail: user.email,
          })
        } catch {
          // Garante fallback local mantendo status canceled se a API externa oscilar
          await supabase
            .from('platform_billing_invoices')
            .update({
              status: 'canceled',
              updated_at: new Date().toISOString(),
            })
            .eq('id', inv.id)
        }
      }

      // 3.2 Gerar o novo cronograma de parcelas com o novo dia de vencimento
      const { PlanResolutionService } = await import('@/lib/platform/billing/PlanResolutionService')
      let planSlug = null
      let planId = null

      if (plano_slug) {
        const p = await PlanResolutionService.resolveBySlug(supabase, plano_slug)
        if (p) {
          planSlug = p.slug
          planId = p.id
        }
      }

      if (!planSlug) {
        const pMin = await PlanResolutionService.resolveMinistryPlan(supabase, ministry_id)
        if (pMin) {
          planSlug = pMin.slug
          planId = pMin.id
        }
      }

      const today = new Date()
      const newInvoicesToInsert = []

      for (let i = 0; i < installmentCount; i++) {
        const dueDateObj = new Date(today.getFullYear(), today.getMonth() + i, Number(new_due_day))
        const dueDateStr = dueDateObj.toISOString().split('T')[0]

        newInvoicesToInsert.push({
          ministry_id,
          subscription_plan_id: planId,
          plano_slug: planSlug,
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
        await supabase.from('audit_logs').insert([
          {
            ministry_id,
            usuario_id: user.id,
            usuario_email: user.email,
            action: 'UPDATE',
            acao: 'editar',
            resource_type: 'platform_billing_invoices',
            modulo: 'financeiro',
            area: 'pagamentos',
            tabela_afetada: 'platform_billing_invoices',
            resource_id: ministry_id,
            registro_id: ministry_id,
            descricao: `Regeneração de parcelas para o cliente ${ministry.name}: ${existingIds.length} pendência(s) tratada(s), ${installmentCount} nova(s) parcela(s) gerada(s)`,
            changes: {
              ministry_name: ministry.name,
              pending_action_taken: pending_action,
              treated_pending_count: existingIds.length,
              new_installments_generated: installmentCount,
              new_due_day,
              amount_per_installment: amountVal,
              by_admin: user.email,
            },
            status: 'sucesso',
            status_code: 200,
            ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || '127.0.0.1',
            user_agent: request.headers.get('user-agent') || 'desconhecido',
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
