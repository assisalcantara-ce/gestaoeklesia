import { SupabaseClient } from '@supabase/supabase-js'
import { getAsaasPayment } from '@/lib/asaas'
import { TrialStatusResponse, ActivateTrialResult, PrepareCheckoutInput, PrepareCheckoutResult, ApproveTrialInput, ApproveTrialResult } from './types'

export class TrialService {
  /**
   * Prepara o contexto de checkout de um lead experimental (Trial).
   * Valida elegibilidade do lead, localiza o plano comercial ativo e verifica se já existe uma cobrança no Asaas.
   */
  async prepareCheckout(
    supabaseAdmin: SupabaseClient,
    input: PrepareCheckoutInput
  ): Promise<PrepareCheckoutResult> {
    const { userId, planId, planSlug } = input

    if (!planId && !planSlug) {
      throw new TrialError('Plano obrigatorio', 400)
    }

    // 1. Carregar pré-cadastro por user_id
    const preReg = await this.findPreRegistrationByUserFull(supabaseAdmin, userId)
    if (!preReg) {
      throw new TrialError('Pre-cadastro nao encontrado', 404)
    }

    // 2. Validar situação do trial (se já está efetivado, rejeita)
    if (preReg.status === 'efetivado') {
      throw new TrialError('Assinatura ja efetivada para este cadastro', 409)
    }

    // 3. Localizar plano comercial solicitado
    const planRow = await this.findActivePlan(supabaseAdmin, planId, planSlug)
    if (!planRow?.id) {
      throw new TrialError('Plano nao encontrado', 404)
    }

    const planPrice = Number(planRow.price_monthly || 0)
    if (!Number.isFinite(planPrice) || planPrice <= 0) {
      throw new TrialError('Plano sem valor mensal valido', 400)
    }

    // 4. Se já existir um pagamento registrado, tentar sincronizá-lo e devolvê-lo
    if (preReg.asaas_payment_id) {
      try {
        const payment = await getAsaasPayment(preReg.asaas_payment_id)
        const nextStatus = String(payment.status || '').trim()

        await supabaseAdmin
          .from('pre_registrations')
          .update({
            asaas_status: nextStatus || preReg.asaas_status,
            asaas_invoice_url: payment.invoiceUrl || preReg.asaas_invoice_url,
            asaas_bank_slip_url: payment.bankSlipUrl || preReg.asaas_bank_slip_url,
            payment_amount: payment.value ?? preReg.payment_amount,
            payment_due_date: payment.dueDate || preReg.payment_due_date,
          })
          .eq('id', preReg.id)

        return {
          preReg,
          planRow,
          planPrice,
          existingPayment: {
            status: nextStatus,
            invoice_url: payment.invoiceUrl || null,
            bank_slip_url: payment.bankSlipUrl || null,
            due_date: payment.dueDate || null,
            amount: payment.value || planPrice,
          }
        }
      } catch {
        // Se falhar na busca (ex: expirou ou erro), continua para gerar novo boleto
      }
    }

    return { preReg, planRow, planPrice, existingPayment: null }
  }

  /**
   * Retorna o status atual do trial de um usuário.
   * Verifica pre_registration + edge case de ativação manual pelo admin.
   * Marca automaticamente como 'encerrado' se a data de expiração foi ultrapassada.
   */
  async getTrialStatus(
    supabaseAdmin: SupabaseClient,
    userId: string
  ): Promise<TrialStatusResponse> {
    // 1. Localizar pre_registration do usuário
    const preReg = await this.findPreRegistrationByUser(supabaseAdmin, userId)

    // 2. Sem pre_registration: nunca expirou (pode ser usuário sem trial)
    if (!preReg) {
      return { expired: false, status: null, trial_expires_at: null, trial_days: null }
    }

    // 3. Pagamento confirmado (efetivado): nunca expirado
    if (preReg.status === 'efetivado') {
      return {
        expired: false,
        status: preReg.status,
        trial_expires_at: preReg.trial_expires_at,
        trial_days: preReg.trial_days ?? null,
      }
    }

    // 4. Edge case: ativação manual pelo admin — ministério com subscription_status=active
    const isActiveByMinistry = await this.checkMinistryActiveStatus(supabaseAdmin, userId)
    if (isActiveByMinistry) {
      return {
        expired: false,
        status: 'active',
        trial_expires_at: preReg.trial_expires_at,
        trial_days: preReg.trial_days ?? null,
      }
    }

    // 5. Calcular expiração pela data
    const { isExpired } = this.calculateExpiration(preReg.trial_expires_at, preReg.status)

    // 6. Marcar automaticamente como encerrado se necessário
    if (isExpired && preReg.status !== 'encerrado') {
      await this.markAsExpired(supabaseAdmin, preReg.id)
    }

    return {
      expired: isExpired,
      status: preReg.status,
      trial_expires_at: preReg.trial_expires_at,
      trial_days: preReg.trial_days ?? null,
    }
  }

  /**
   * Valida o link de ativação de trial (lead_id + token).
   * Verifica elegibilidade e retorna dados seguros para pré-preenchimento do formulário.
   * Nunca expõe token ou dados sensíveis de autenticação.
   */
  async activateTrial(
    supabaseAdmin: SupabaseClient,
    leadId: string,
    token: string
  ): Promise<ActivateTrialResult> {
    // 1. Localizar pre_registration pelo lead_id
    const lead = await this.findLeadById(supabaseAdmin, leadId)

    if (!lead) {
      throw new TrialError('Link inválido ou expirado.', 404)
    }

    // 2. Validar token (comparação direta — token já é aleatório e seguro no banco)
    if (!lead.trial_activation_token || lead.trial_activation_token !== token) {
      throw new TrialError('Token inválido ou expirado.', 403)
    }

    // 3. Verificar elegibilidade — só aceita status trial, pending ou new
    const eligibleStatuses = ['trial', 'pending', 'new']
    if (lead.status && !eligibleStatuses.includes(lead.status)) {
      throw new TrialError('Esta conta já foi ativada. Faça login para acessar o sistema.', 409)
    }

    // 4. Retornar dados seguros para pré-preenchimento do formulário
    return {
      success: true,
      lead: {
        ministry_name:    lead.ministry_name || '',
        responsible_name: lead.responsible_name || lead.pastor_name || '',
        cpf_cnpj:         lead.cpf_cnpj || '',
        whatsapp:         lead.whatsapp || '',
        email:            lead.email || '',
        phone:            lead.phone || '',
        website:          lead.website || '',
        plan:             lead.plan || 'starter',
      },
    }
  }

  // --- MÉTODOS PRIVADOS DE APOIO ---

  private async findPreRegistrationByUser(
    supabaseAdmin: SupabaseClient,
    userId: string
  ): Promise<{
    id: string
    trial_expires_at: string | null
    trial_days: number | null
    status: string | null
  } | null> {
    const { data, error } = await supabaseAdmin
      .from('pre_registrations')
      .select('id, trial_expires_at, trial_days, status')
      .eq('user_id', userId)
      .maybeSingle()

    if (error || !data) return null
    return data
  }

  private async checkMinistryActiveStatus(
    supabaseAdmin: SupabaseClient,
    userId: string
  ): Promise<boolean> {
    const { data } = await supabaseAdmin
      .from('ministries')
      .select('subscription_status')
      .eq('user_id', userId)
      .maybeSingle()

    return data?.subscription_status === 'active'
  }

  private calculateExpiration(
    trialExpiresAt: string | null,
    status: string | null
  ): { isExpired: boolean } {
    const expiresAt = trialExpiresAt ? new Date(trialExpiresAt) : null
    const isExpired = status === 'encerrado' || (!!expiresAt && expiresAt.getTime() <= Date.now())
    return { isExpired }
  }

  private async markAsExpired(
    supabaseAdmin: SupabaseClient,
    preRegId: string
  ): Promise<void> {
    await supabaseAdmin
      .from('pre_registrations')
      .update({ status: 'encerrado' })
      .eq('id', preRegId)
  }

  private async findLeadById(
    supabaseAdmin: SupabaseClient,
    leadId: string
  ): Promise<{
    id: string
    ministry_name: string | null
    pastor_name: string | null
    responsible_name: string | null
    cpf_cnpj: string | null
    whatsapp: string | null
    email: string | null
    phone: string | null
    website: string | null
    plan: string | null
    status: string | null
    trial_activation_token: string | null
  } | null> {
    const { data, error } = await supabaseAdmin
      .from('pre_registrations')
      .select(
        'id, ministry_name, pastor_name, responsible_name, cpf_cnpj, whatsapp, email, phone, website, plan, status, trial_activation_token'
      )
      .eq('id', leadId)
      .maybeSingle()

    if (error) {
      console.error('[TrialService.findLeadById] DB error:', error)
      throw new TrialError('Erro ao validar link.', 500)
    }

    return data
  }

  private async findPreRegistrationByUserFull(
    supabaseAdmin: SupabaseClient,
    userId: string
  ): Promise<any> {
    const { data } = await supabaseAdmin
      .from('pre_registrations')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    return data
  }

  /**
   * Executa a aprovação ou rejeição de um lead experimental (Trial).
   * Se rejeitado (approve = false), remove o pré-cadastro do banco.
   * Se aprovado, valida elegibilidade do lead e planeja o contexto para a ativação.
   */
  async approveTrial(
    supabaseAdmin: SupabaseClient,
    input: ApproveTrialInput
  ): Promise<ApproveTrialResult> {
    const { preRegistrationId, approve, planOverride } = input

    // 1. Carregar pré-cadastro
    const { data: preReg, error: fetchError } = await supabaseAdmin
      .from('pre_registrations')
      .select('*')
      .eq('id', preRegistrationId)
      .maybeSingle()

    if (fetchError || !preReg) {
      throw new TrialError('Pré-cadastro não encontrado', 404)
    }

    // 2. Fluxo de Rejeição (approve = false)
    if (!approve) {
      const { error: deleteError } = await supabaseAdmin
        .from('pre_registrations')
        .delete()
        .eq('id', preRegistrationId)

      if (deleteError) {
        throw new TrialError('Erro ao rejeitar pré-cadastro', 400)
      }

      return {
        success: true,
        action: 'rejected',
        message: 'Pré-cadastro rejeitado com sucesso'
      }
    }

    // 3. Fluxo de Aprovação: Valida usuário associado
    if (!preReg.user_id) {
      throw new TrialError('Pré-cadastro sem usuário associado. Gere credenciais antes de aprovar.', 400)
    }

    const planFinal = planOverride || preReg.plan || 'basic'
    const subEndDate = new Date()
    subEndDate.setFullYear(subEndDate.getFullYear() + 1) // vigência de 1 ano

    return {
      success: true,
      action: 'approved',
      message: 'Acesso liberado com sucesso! Usuário pode fazer login.',
      preReg,
      planFinal,
      subEndDate
    }
  }


  private async findActivePlan(
    supabaseAdmin: SupabaseClient,
    planId?: string,
    planSlug?: string
  ): Promise<any> {
    if (planId) {
      const { data } = await supabaseAdmin
        .from('subscription_plans')
        .select('id, name, slug, price_monthly')
        .eq('id', planId)
        .eq('is_active', true)
        .maybeSingle()
      return data
    }

    if (planSlug) {
      const { data } = await supabaseAdmin
        .from('subscription_plans')
        .select('id, name, slug, price_monthly')
        .eq('slug', planSlug)
        .eq('is_active', true)
        .maybeSingle()
      return data
    }

    return null
  }
}

/** Erro de domínio do Trial com código HTTP semântico */
export class TrialError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message)
    this.name = 'TrialError'
  }
}
