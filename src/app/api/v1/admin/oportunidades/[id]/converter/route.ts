import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { SubscriptionService, CrmService, BillingService } from '@/lib/platform'

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

    // 1. CRM: Resolver contexto da oportunidade (validação de oportunidade, ministério e plano)
    const crmService = new CrmService()
    const { oportunidade, ministry, planRow } = await crmService.resolveOpportunityContext(
      supabaseAdmin,
      id,
      plano_slug
    )

    const ministryId = oportunidade.ministry_id

    if (forma_ativacao === 'direto') {
      // --- FLUXO ATIVAÇÃO DIRETA ---

      // 2a. Subscriptions: Ativar assinatura via serviço de domínio
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

      // 2b. CRM: Converter oportunidade para "Convertido"
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

      // 2a. Billing: Gerar cobrança no gateway e persistir fatura local
      const billingService = new BillingService()
      const invoiceResult = await billingService.generateInvoice(supabaseAdmin, {
        ministry: {
          id: ministry.id,
          name: ministry.name,
          cnpj_cpf: ministry.cnpj_cpf,
          phone: ministry.phone,
          email_admin: ministry.email_admin,
          asaas_customer_id: ministry.asaas_customer_id
        },
        plan: {
          id: planRow.id,
          slug: plano_slug,
          name: planRow.name,
          price_monthly: Number(planRow.price_monthly || 0)
        },
        validityMonths: limitMonths,
        externalReference: id
      })

      // 2b. CRM: Converter oportunidade para "Aguardando Pagamento"
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
          invoice_url: invoiceResult.invoiceUrl,
          bank_slip_url: invoiceResult.bankSlipUrl
        }
      })
    }

    return NextResponse.json({ error: 'Forma de ativação inválida' }, { status: 400 })
  } catch (err: any) {
    console.error('[CONVERTER] Erro:', err)
    return NextResponse.json({ error: err?.message || 'Erro ao converter cliente' }, { status: 500 })
  }
}
