import { SupabaseClient } from '@supabase/supabase-js'
import { TrialStatusResponse, ActivateTrialResult } from './types'

export class TrialService {
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
