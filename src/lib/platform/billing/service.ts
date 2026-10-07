import { SupabaseClient } from '@supabase/supabase-js'
import { ensureAsaasCustomer, createAsaasPayment, getAsaasPayment, deleteAsaasPayment } from '@/lib/asaas'
import { Invoice, CreateInvoiceInput, GenerateInvoiceInput, GenerateInvoiceResult } from './types'
import { INVOICE_DUE_DAYS } from './constants'

export const NON_CANCELABLE_ASAAS_STATUSES = [
  'RECEIVED',
  'CONFIRMED',
  'RECEIVED_IN_CASH',
  'REFUNDED',
  'REFUND_REQUESTED',
  'CHARGEBACK_REQUESTED',
  'CHARGEBACK_DISPUTE',
  'AWAITING_CHARGEBACK_REVERSAL',
  'DUNNING_REQUESTED',
  'DUNNING_RECEIVED',
  'AWAITING_RISK_ANALYSIS',
] as const

export interface CancelInvoiceResult {
  success: boolean
  invoiceId: string
  asaasPaymentId: string | null
  asaasAction: 'deleted' | 'already_canceled' | 'not_linked' | 'failed' | 'blocked'
  localAction: 'canceled' | 'already_canceled' | 'unmodified'
  error?: string
  asaasStatus?: string
}

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

  /**
   * Cancela ou exclui com segurança uma fatura da plataforma,
   * sincronizando com o Asaas antes de atualizar o status local para 'canceled'.
   * 
   * NUNCA executa DELETE físico na tabela platform_billing_invoices.
   * NUNCA cancela cobranças que já foram pagas ou que estão em disputa/estorno.
   */
  async cancelOrDeleteInvoiceSynchronized(
    supabaseAdmin: SupabaseClient,
    invoice: {
      id: string
      ministry_id?: string
      status: string
      asaas_payment_id?: string | null
    },
    options?: {
      reason?: string
      adminEmail?: string
    }
  ): Promise<CancelInvoiceResult> {
    const invoiceId = invoice.id
    const asaasPaymentId = invoice.asaas_payment_id || null

    if (process.env.NODE_ENV !== 'production' && options?.reason) {
      console.log(`[BillingService] Cancelando fatura ${invoiceId} - Motivo: ${options.reason}`);
    }

    // 1. Verificação local prévia
    const currentLocalStatus = String(invoice.status || '').toLowerCase()
    if (['paid', 'pago', 'paga'].includes(currentLocalStatus)) {
      return {
        success: false,
        invoiceId,
        asaasPaymentId,
        asaasAction: 'blocked',
        localAction: 'unmodified',
        error: 'Cobrança já consta como paga localmente e não pode ser cancelada.',
      }
    }

    let asaasAction: CancelInvoiceResult['asaasAction'] = 'not_linked'
    let asaasStatusFound: string | undefined

    // 2. Se houver vínculo com Asaas, consultar estado atual no gateway
    if (asaasPaymentId) {
      try {
        const asaasPayment = await getAsaasPayment(asaasPaymentId)
        asaasStatusFound = asaasPayment?.status ? String(asaasPayment.status).toUpperCase() : undefined
        const isDeletedOnAsaas = Boolean(asaasPayment?.deleted)

        // Validar se o status do Asaas é proibido para exclusão
        if (asaasStatusFound && (NON_CANCELABLE_ASAAS_STATUSES as readonly string[]).includes(asaasStatusFound)) {
          return {
            success: false,
            invoiceId,
            asaasPaymentId,
            asaasAction: 'blocked',
            localAction: 'unmodified',
            asaasStatus: asaasStatusFound,
            error: `Cobrança possui status irreversível no ASAAS (${asaasStatusFound}) e não pode ser cancelada.`,
          }
        }

        // Se já constar como deleted no ASAAS, é idempotente
        if (isDeletedOnAsaas) {
          asaasAction = 'already_canceled'
        } else {
          // Tentar exclusão / cancelamento no ASAAS
          try {
            await deleteAsaasPayment(asaasPaymentId)
            asaasAction = 'deleted'
          } catch (delError: any) {
            const errorMsg = delError?.message || 'Erro ao cancelar cobrança no ASAAS'
            return {
              success: false,
              invoiceId,
              asaasPaymentId,
              asaasAction: 'failed',
              localAction: 'unmodified',
              asaasStatus: asaasStatusFound,
              error: `Falha ao remover cobrança no ASAAS: ${errorMsg}`,
            }
          }
        }
      } catch (getErr: any) {
        // Se a cobrança não foi encontrada no ASAAS (404), trata com segurança idempotente
        const errorMsg = getErr?.message || ''
        if (errorMsg.includes('não encontrada') || errorMsg.includes('not found') || errorMsg.includes('404')) {
          asaasAction = 'already_canceled'
        } else {
          return {
            success: false,
            invoiceId,
            asaasPaymentId,
            asaasAction: 'failed',
            localAction: 'unmodified',
            error: `Falha ao consultar estado da cobrança no ASAAS: ${errorMsg}`,
          }
        }
      }
    }

    // 3. Atualização local: Somente se o ASAAS confirmou sucesso (ou já estava cancelado / sem vínculo)
    // Preserva rigorosamente o registro local mudando apenas status para 'canceled' (soft delete)
    if (currentLocalStatus === 'canceled' || currentLocalStatus === 'cancelada') {
      return {
        success: true,
        invoiceId,
        asaasPaymentId,
        asaasAction,
        localAction: 'already_canceled',
        asaasStatus: asaasStatusFound,
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('platform_billing_invoices')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)

    if (updateError) {
      return {
        success: false,
        invoiceId,
        asaasPaymentId,
        asaasAction,
        localAction: 'unmodified',
        asaasStatus: asaasStatusFound,
        error: `ASAAS processado (${asaasAction}), mas ocorreu erro ao atualizar status local: ${updateError.message}`,
      }
    }

    return {
      success: true,
      invoiceId,
      asaasPaymentId,
      asaasAction,
      localAction: 'canceled',
      asaasStatus: asaasStatusFound,
    }
  }
}

