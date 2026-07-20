import { SupabaseClient } from '@supabase/supabase-js'
import { ensureAsaasCustomer, createAsaasPayment } from '@/lib/asaas'
import { Invoice, CreateInvoiceInput, GenerateInvoiceInput, GenerateInvoiceResult } from './types'
import { INVOICE_DUE_DAYS } from './constants'

export class BillingService {
  async getInvoiceByPaymentId(
    supabaseAdmin: SupabaseClient,
    asaasPaymentId: string
  ): Promise<Invoice | null> {
    const { data } = await supabaseAdmin
      .from('platform_billing_invoices')
      .select('*')
      .eq('asaas_payment_id', asaasPaymentId)
      .maybeSingle()
    return data
  }

  /**
   * Gera uma cobrança completa no gateway Asaas e persiste a fatura local.
   * Encapsula: ensureAsaasCustomer, createAsaasPayment, cálculo de datas e persistência.
   */
  async generateInvoice(
    supabaseAdmin: SupabaseClient,
    input: GenerateInvoiceInput
  ): Promise<GenerateInvoiceResult> {
    const { ministry, plan, validityMonths, dueDays = INVOICE_DUE_DAYS, externalReference } = input

    // 1. Garantir que o cliente existe no Asaas (cria se necessário)
    const asaasCustomerId = await this.resolveAsaasCustomer(supabaseAdmin, ministry)

    // 2. Calcular datas
    const { startDate, endDate, dueDateStr } = this.calculateBillingDates(validityMonths, dueDays)

    // 3. Criar cobrança no gateway Asaas
    const paymentResult = await this.createGatewayPayment({
      customerId: asaasCustomerId,
      planName: plan.name,
      planPrice: plan.price_monthly,
      validityMonths,
      dueDateStr,
      externalReference
    })

    // 4. Persistir fatura localmente em platform_billing_invoices
    const invoiceId = await this.persistLocalInvoice(supabaseAdmin, {
      ministry_id: ministry.id,
      plano_slug: plan.slug,
      subscription_plan_id: plan.id,
      amount: plan.price_monthly,
      asaas_payment_id: paymentResult.id,
      asaas_invoice_url: paymentResult.invoiceUrl || null,
      period_start: startDate.toISOString(),
      period_end: endDate.toISOString(),
      due_date: dueDateStr
    })

    return {
      success: true,
      invoiceId,
      asaasPaymentId: paymentResult.id,
      invoiceUrl: paymentResult.invoiceUrl || null,
      bankSlipUrl: paymentResult.bankSlipUrl || null,
      dueDate: dueDateStr
    }
  }

  // --- MÉTODOS DE APOIO PRIVADOS ---

  private async resolveAsaasCustomer(
    supabaseAdmin: SupabaseClient,
    ministry: GenerateInvoiceInput['ministry']
  ): Promise<string> {
    const asaasCustomerId = await ensureAsaasCustomer(supabaseAdmin, {
      id: ministry.id,
      name: ministry.name,
      cnpj_cpf: ministry.cnpj_cpf,
      phone: ministry.phone,
      email_admin: ministry.email_admin,
      asaas_customer_id: ministry.asaas_customer_id
    })

    if (!asaasCustomerId) {
      throw new Error('Erro ao criar/identificar cliente Asaas')
    }

    // Sincroniza o customer_id se foi criado agora
    if (asaasCustomerId !== ministry.asaas_customer_id) {
      await supabaseAdmin
        .from('ministries')
        .update({ asaas_customer_id: asaasCustomerId })
        .eq('id', ministry.id)
    }

    return asaasCustomerId
  }

  private calculateBillingDates(
    validityMonths: number,
    dueDays: number
  ): { startDate: Date; endDate: Date; dueDate: Date; dueDateStr: string } {
    const startDate = new Date()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + validityMonths)

    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + dueDays)

    const dueDateStr = [
      dueDate.getFullYear(),
      String(dueDate.getMonth() + 1).padStart(2, '0'),
      String(dueDate.getDate()).padStart(2, '0')
    ].join('-')

    return { startDate, endDate, dueDate, dueDateStr }
  }

  private async createGatewayPayment(params: {
    customerId: string
    planName: string
    planPrice: number
    validityMonths: number
    dueDateStr: string
    externalReference?: string
  }): Promise<{ id: string; invoiceUrl?: string | null; bankSlipUrl?: string | null }> {
    const { customerId, planName, planPrice, validityMonths, dueDateStr, externalReference } = params

    if (!Number.isFinite(planPrice) || planPrice <= 0) {
      throw new Error('Plano selecionado não possui valor mensal configurado')
    }

    const paymentResult = await createAsaasPayment({
      customer: customerId,
      value: planPrice,
      dueDate: dueDateStr,
      description: `Assinatura Plano ${planName} - Vigência de ${validityMonths} meses`,
      billingType: 'BOLETO',
      externalReference
    })

    if (!paymentResult?.id) {
      throw new Error('Erro ao gerar pagamento Asaas')
    }

    return paymentResult
  }

  private async persistLocalInvoice(
    supabaseAdmin: SupabaseClient,
    invoice: Omit<CreateInvoiceInput, 'validity_months'> & {
      subscription_plan_id: string
      asaas_payment_id: string
      asaas_invoice_url: string | null
      period_start: string
      period_end: string
      due_date: string
    }
  ): Promise<string> {
    const now = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('platform_billing_invoices')
      .insert([{
        ...invoice,
        status: 'pending',
        created_at: now,
        updated_at: now
      }])
      .select('id')
      .single()

    if (error || !data?.id) {
      throw new Error(`Erro ao gerar fatura local: ${error?.message || 'Erro de persistência'}`)
    }

    return data.id
  }
}
