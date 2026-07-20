import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { ensureAsaasCustomer, createAsaasPayment } from '@/lib/asaas'
import { SubscriptionService, CrmService } from '@/lib/platform'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await requireAdmin(request, { requiredCapability: 'can_manage_ministries' })
    if (!result.ok) return result.response
    const { supabaseAdmin, adminUser } = result.ctx

    const resolvedParams = await params
    const id = resolvedParams.id
    const { plano_slug, forma_ativacao, validade_meses } = await request.json()

    const adminEmail = adminUser?.email || 'admin@gestaoeklesia.com.br'
    const limitMonths = Number(validade_meses ?? 12)

    // 1. Resolver contexto da oportunidade (CRM: validação de oportunidade, ministério e plano)
    const crmService = new CrmService()
    const { oportunidade, ministry, planRow } = await crmService.resolveOpportunityContext(
      supabaseAdmin,
      id,
      plano_slug
    )

    const ministryId = oportunidade.ministry_id

    if (forma_ativacao === 'direto') {
      // --- FLUXO ATIVAÇÃO DIRETA ---

      // 2a. Ativar assinatura via serviço de domínio de subscriptions
      const subscriptionService = new SubscriptionService()
      const activationResult = await subscriptionService.activateSubscription(
        supabaseAdmin,
        ministryId,
        plano_slug,
        limitMonths
      )

      if (!activationResult?.success) {
        return NextResponse.json({ error: 'Erro ao ativar assinatura via domínio' }, { status: 400 })
      }

      // 2b. Converter oportunidade para "Convertido" (CRM: status + histórico)
      await crmService.convertOpportunity(supabaseAdmin, {
        oportunidadeId: id,
        novoStatus: 'Convertido',
        planName: planRow.name,
        adminEmail,
        adminUserId: adminUser?.id
      })

      return NextResponse.json({ success: true, mode: 'direto' })

    } else if (forma_ativacao === 'asaas') {
      // --- FLUXO COBRANÇA ASAAS ---
      // Geração de cobrança permanece na API até migração do domínio Billing

      const planPrice = Number(planRow.price_monthly || 0)
      if (!Number.isFinite(planPrice) || planPrice <= 0) {
        return NextResponse.json({ error: 'Plano selecionado não possui valor mensal configurado' }, { status: 400 })
      }

      // A. Assegurar que o cliente Asaas existe
      const asaasCustomerId = await ensureAsaasCustomer(supabaseAdmin, {
        id: ministry.id,
        name: ministry.name,
        cnpj_cpf: ministry.cnpj_cpf,
        phone: ministry.phone,
        email_admin: ministry.email_admin,
        asaas_customer_id: ministry.asaas_customer_id
      })

      if (!asaasCustomerId) {
        return NextResponse.json({ error: 'Erro ao criar/identificar cliente Asaas' }, { status: 500 })
      }

      if (asaasCustomerId !== ministry.asaas_customer_id) {
        await supabaseAdmin
          .from('ministries')
          .update({ asaas_customer_id: asaasCustomerId })
          .eq('id', ministryId)
      }

      // B. Criar pagamento no Asaas (boleto para vencer em 7 dias)
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 7)
      const dueDateStr = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`

      const startDate = new Date()
      const endDate = new Date()
      endDate.setMonth(endDate.getMonth() + limitMonths)

      const paymentResult = await createAsaasPayment({
        customer: asaasCustomerId,
        value: planPrice,
        dueDate: dueDateStr,
        description: `Assinatura Plano ${planRow.name} - Vigência de ${limitMonths} meses`,
        billingType: 'BOLETO',
        externalReference: id
      })

      if (!paymentResult?.id) {
        return NextResponse.json({ error: 'Erro ao gerar pagamento Asaas' }, { status: 500 })
      }

      // C. Criar fatura local (mantido na API até migração do domínio Billing)
      const { error: invoiceErr } = await supabaseAdmin
        .from('platform_billing_invoices')
        .insert([{
          ministry_id: ministryId,
          plano_slug,
          subscription_plan_id: planRow.id,
          amount: planPrice,
          status: 'pending',
          asaas_payment_id: paymentResult.id,
          asaas_invoice_url: paymentResult.invoiceUrl || null,
          period_start: startDate.toISOString(),
          period_end: endDate.toISOString(),
          due_date: dueDateStr,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])

      if (invoiceErr) {
        return NextResponse.json({ error: `Erro ao gerar fatura local: ${invoiceErr.message}` }, { status: 500 })
      }

      // D. Converter oportunidade para "Aguardando Pagamento" (CRM: status + histórico)
      await crmService.convertOpportunity(supabaseAdmin, {
        oportunidadeId: id,
        novoStatus: 'Aguardando Pagamento',
        planName: planRow.name,
        adminEmail,
        adminUserId: adminUser?.id
      })

      return NextResponse.json({
        success: true,
        mode: 'asaas',
        payment: {
          invoice_url: paymentResult.invoiceUrl,
          bank_slip_url: paymentResult.bankSlipUrl
        }
      })
    }

    return NextResponse.json({ error: 'Forma de ativação inválida' }, { status: 400 })
  } catch (err: any) {
    console.error('[CONVERTER] Erro:', err)
    return NextResponse.json({ error: err?.message || 'Erro ao converter cliente' }, { status: 500 })
  }
}
