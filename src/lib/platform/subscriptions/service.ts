import { SupabaseClient } from '@supabase/supabase-js'
import { SubscriptionPlan } from './types'

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

  private async resolvePlan(supabaseAdmin: SupabaseClient, planSlug: string): Promise<{ id: string } | null> {
    const { data } = await supabaseAdmin
      .from('subscription_plans')
      .select('id')
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
}
