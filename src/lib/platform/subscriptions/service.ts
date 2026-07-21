import { SupabaseClient } from '@supabase/supabase-js'
import { SubscriptionPlan, PreRegistrationData, ActivateFromPreRegResult } from './types'

const upperText = (v?: string | null) => (v ? v.trim().toUpperCase() : null)
const lowerText = (v?: string | null) => (v ? v.trim().toLowerCase() : null)
const onlyDigits = (v?: string | null) => (v ? v.replace(/\D/g, '') : null)

const buildSlug = (name: string) =>
  String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80) || `ministerio-${Date.now()}`

export class SubscriptionService {
  async getPlanBySlug(supabaseAdmin: SupabaseClient, slug: string): Promise<SubscriptionPlan | null> {
    const { data } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
    return data
  }

  async activateSubscription(
    supabaseAdmin: SupabaseClient,
    ministryId: string,
    planSlug: string,
    validityMonths: number
  ): Promise<{
    success: boolean
    updatedMinistry: any
    hasPreRegUpdated: boolean
    statusAnterior: string | null
    planAnterior: string | null
    endDateAnterior: string | null
  } | null> {
    // 1. Buscar ministério atual para auditoria
    const ministry = await this.fetchMinistry(supabaseAdmin, ministryId)
    
    // 2. Resolver o ID do plano cadastrado
    const planRow = await this.resolvePlan(supabaseAdmin, planSlug)

    // 3. Calcular o período de vigência
    const { startDate, endDate } = this.calculateSubscriptionPeriod(validityMonths)

    // 4. Salvar atualização da licença comercial no banco
    const updatedMinistry = await this.updateMinistrySubscription(
      supabaseAdmin,
      ministryId,
      planSlug,
      planRow?.id || null,
      startDate,
      endDate
    )

    // 5. Efetivar cadastro na tabela pre_registrations
    const hasPreRegUpdated = await this.markPreRegistrationAsConverted(
      supabaseAdmin,
      ministryId,
      ministry.user_id
    )

    // 6. Montar dados consolidados
    return this.buildSubscriptionData(
      updatedMinistry,
      hasPreRegUpdated,
      ministry
    )
  }

  /**
   * Ativa uma assinatura a partir de um pré-cadastro (fluxo Trial via pagamento).
   * Cria o ministério se ainda não existir, vincula o usuário e efetiva o pre_registration.
   * Usado exclusivamente pelo webhook de pagamento do fluxo Trial.
   */
  async activateFromPreRegistration(
    supabaseAdmin: SupabaseClient,
    preReg: PreRegistrationData,
    validityDays: number = 30
  ): Promise<ActivateFromPreRegResult> {
    const planSlug = String(preReg.plan || 'basic').toLowerCase()
    const planRow = await this.resolvePlan(supabaseAdmin, planSlug)
    const planFinal = planRow?.slug || planSlug || 'basic'

    const now = new Date()
    const subEndDate = new Date()
    subEndDate.setDate(subEndDate.getDate() + validityDays)

    // 1. Verificar se o ministério já existe para este usuário
    const { ministryId, wasCreated } = await this.upsertMinistryForPreReg(
      supabaseAdmin,
      preReg,
      planFinal,
      planRow?.id || null,
      now,
      subEndDate
    )

    // 2. Vincular usuário ao ministério como admin (idempotente)
    const linkedMinistryUser = await this.ensureMinistryUserLink(
      supabaseAdmin,
      ministryId,
      preReg.user_id!
    )

    // 3. Efetivar pre_registration
    let hasPreRegUpdated = false
    if (preReg.status !== 'efetivado') {
      const { error } = await supabaseAdmin
        .from('pre_registrations')
        .update({ status: 'efetivado' })
        .eq('id', preReg.id)
      hasPreRegUpdated = !error
    }

    return { success: true, ministryId, wasCreated, hasPreRegUpdated, linkedMinistryUser }
  }

  // --- MÉTODOS DE APOIO / RESPONSABILIDADES PRIVADAS ---

  private async fetchMinistry(supabaseAdmin: SupabaseClient, ministryId: string): Promise<any> {
    const { data: ministry, error } = await supabaseAdmin
      .from('ministries')
      .select('*')
      .eq('id', ministryId)
      .single()

    if (error || !ministry) {
      throw new Error('Ministério não encontrado')
    }
    return ministry
  }

  private async resolvePlan(supabaseAdmin: SupabaseClient, planSlug: string): Promise<{ id: string; slug?: string } | null> {
    const { data } = await supabaseAdmin
      .from('subscription_plans')
      .select('id, slug')
      .eq('slug', planSlug)
      .maybeSingle()
    return data
  }

  private calculateSubscriptionPeriod(validityMonths: number): { startDate: Date; endDate: Date } {
    const startDate = new Date()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + validityMonths)
    return { startDate, endDate }
  }

  private async updateMinistrySubscription(
    supabaseAdmin: SupabaseClient,
    ministryId: string,
    planSlug: string,
    planId: string | null,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const { data: updatedMinistry, error } = await supabaseAdmin
      .from('ministries')
      .update({
        subscription_status: 'active',
        plan: planSlug,
        subscription_plan_id: planId,
        subscription_start_date: startDate.toISOString(),
        subscription_end_date: endDate.toISOString(),
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', ministryId)
      .select()
      .single()

    if (error || !updatedMinistry) {
      throw new Error(`Erro ao atualizar ministério: ${error?.message || 'Erro de persistência'}`)
    }

    return updatedMinistry
  }

  private async markPreRegistrationAsConverted(
    supabaseAdmin: SupabaseClient,
    ministryId: string,
    userId: string | null
  ): Promise<boolean> {
    let preRegData = null
    try {
      const { data } = await supabaseAdmin
        .from('pre_registrations')
        .select('id, user_id')
        .eq('ministry_id', ministryId)
        .maybeSingle()
      preRegData = data
    } catch {
      // Ignora erro se coluna ministry_id não existir
    }

    if (!preRegData && userId) {
      const { data } = await supabaseAdmin
        .from('pre_registrations')
        .select('id, user_id')
        .eq('user_id', userId)
        .maybeSingle()
      preRegData = data
    }

    let hasPreRegUpdated = false
    if (preRegData?.id) {
      const { error } = await supabaseAdmin
        .from('pre_registrations')
        .update({ status: 'efetivado' })
        .eq('id', preRegData.id)
      if (!error) {
        hasPreRegUpdated = true
      }
    }

    return hasPreRegUpdated
  }

  private buildSubscriptionData(
    updatedMinistry: any,
    hasPreRegUpdated: boolean,
    previousMinistryData: any
  ): {
    success: boolean
    updatedMinistry: any
    hasPreRegUpdated: boolean
    statusAnterior: string | null
    planAnterior: string | null
    endDateAnterior: string | null
  } {
    return {
      success: true,
      updatedMinistry,
      hasPreRegUpdated,
      statusAnterior: previousMinistryData.subscription_status,
      planAnterior: previousMinistryData.plan,
      endDateAnterior: previousMinistryData.subscription_end_date
    }
  }

  private async upsertMinistryForPreReg(
    supabaseAdmin: SupabaseClient,
    preReg: PreRegistrationData,
    planFinal: string,
    planId: string | null,
    now: Date,
    subEndDate: Date
  ): Promise<{ ministryId: string; wasCreated: boolean }> {
    const { data: existingMinistry } = await supabaseAdmin
      .from('ministries')
      .select('id')
      .eq('user_id', preReg.user_id!)
      .maybeSingle()

    if (existingMinistry?.id) {
      await supabaseAdmin
        .from('ministries')
        .update({
          plan: planFinal,
          subscription_plan_id: planId,
          subscription_status: 'active',
          subscription_start_date: now.toISOString(),
          subscription_end_date: subEndDate.toISOString(),
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingMinistry.id)

      return { ministryId: existingMinistry.id, wasCreated: false }
    }

    const { data: created, error } = await supabaseAdmin
      .from('ministries')
      .insert({
        user_id: preReg.user_id,
        name: upperText(preReg.ministry_name) || 'MINISTERIO',
        slug: buildSlug(preReg.ministry_name || 'ministerio'),
        email_admin: lowerText(preReg.email),
        cnpj_cpf: onlyDigits(preReg.cpf_cnpj),
        phone: onlyDigits(preReg.phone),
        whatsapp: onlyDigits(preReg.whatsapp),
        website: lowerText(preReg.website),
        description: upperText(preReg.description),
        plan: planFinal,
        subscription_plan_id: planId,
        subscription_status: 'active',
        subscription_start_date: now.toISOString(),
        subscription_end_date: subEndDate.toISOString(),
        is_active: true,
        address_street: upperText(preReg.address_street),
        address_number: upperText(preReg.address_number),
        address_complement: upperText(preReg.address_complement),
        address_city: upperText(preReg.address_city),
        address_state: upperText(preReg.address_state),
        address_zip: onlyDigits(preReg.address_zip),
        asaas_customer_id: preReg.asaas_customer_id || null,
      })
      .select('id')
      .single()

    if (error || !created?.id) {
      throw new Error(`Erro ao criar ministério: ${error?.message || 'Erro de persistência'}`)
    }

    return { ministryId: created.id, wasCreated: true }
  }

  private async ensureMinistryUserLink(
    supabaseAdmin: SupabaseClient,
    ministryId: string,
    userId: string
  ): Promise<boolean> {
    const { data: existingLink } = await supabaseAdmin
      .from('ministry_users')
      .select('id')
      .eq('ministry_id', ministryId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existingLink?.id) return false

    const { error } = await supabaseAdmin
      .from('ministry_users')
      .insert({
        ministry_id: ministryId,
        user_id: userId,
        role: 'admin',
        is_active: true,
      })

    return !error
  }
}


