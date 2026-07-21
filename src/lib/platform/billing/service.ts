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
   * Gera uma cobrança completa no gateway Asaas e persiste a fatura local (se persistLocal for true).
   * Encapsula: ensureAsaasCustomer, createAsaasPayment, cálculo de datas e persistência.
   */
  async generateInvoice(
    supabaseAdmin: SupabaseClient,
    input: GenerateInvoiceInput
  ): Promise<GenerateInvoiceResult> {
    const { 
      ministry, 
      plan, 
      validityMonths, 
      dueDays = INVOICE_DUE_DAYS, 
      externalReference, 
      persistLocal = true, 
      customAmount, 
      customDueDate, 
      customDescription 
    } = input

    // 1. Garantir que o cliente existe no Asaas (cria se necessário)
    const asaasCustomerId = await this.resolveAsaasCustomer(supabaseAdmin, ministry, persistLocal)

    // 2. Calcular datas
    const { startDate, endDate, dueDateStr: calculatedDueDate } = this.calculateBillingDates(validityMonths, dueDays)
    const finalDueDate = customDueDate || calculatedDueDate

    // 3. Criar cobrança no gateway Asaas
    const paymentResult = await this.createGatewayPayment({
      customerId: asaasCustomerId,
      planName: plan.name,
      planPrice: customAmount !== undefined ? customAmount : plan.price_monthly,
      validityMonths,
      dueDateStr: finalDueDate,
      externalReference,
      customDescription
    })

    let invoiceId: string | null = null

    // 4. Persistir fatura localmente apenas se persistLocal for true
    if (persistLocal) {
      invoiceId = await this.persistLocalInvoice(supabaseAdmin, {
        ministry_id: ministry.id,
        plano_slug: plan.slug,
        subscription_plan_id: plan.id,
        amount: customAmount !== undefined ? customAmount : plan.price_monthly,
        asaas_payment_id: paymentResult.id,
        asaas_invoice_url: paymentResult.invoiceUrl || null,
        period_start: startDate.toISOString(),
        period_end: endDate.toISOString(),
        due_date: finalDueDate
      })
    }

    return {
      success: true,
      invoiceId,
      asaasPaymentId: paymentResult.id,
      invoiceUrl: paymentResult.invoiceUrl || null,
      bankSlipUrl: paymentResult.bankSlipUrl || null,
      dueDate: finalDueDate
    }
  }

  // --- MÉTODOS DE APOIO PRIVADOS ---

  private async resolveAsaasCustomer(
    supabaseAdmin: SupabaseClient,
    ministry: GenerateInvoiceInput['ministry'],
    persistLocal: boolean
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

    // Sincroniza o customer_id localmente apenas se não for checkout provisório
    if (persistLocal && asaasCustomerId !== ministry.asaas_customer_id) {
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
    customDescription?: string
  }): Promise<{ id: string; invoiceUrl?: string | null; bankSlipUrl?: string | null }> {
    const { customerId, planName, planPrice, validityMonths, dueDateStr, externalReference, customDescription } = params

    if (!Number.isFinite(planPrice) || planPrice < 0) {
      throw new Error('Plano selecionado não possui valor mensal configurado')
    }

    const description = customDescription || `Assinatura Plano ${planName} - Vigência de ${validityMonths} meses`

    const paymentResult = await createAsaasPayment({
      customer: customerId,
      value: planPrice,
      dueDate: dueDateStr,
      description,
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
