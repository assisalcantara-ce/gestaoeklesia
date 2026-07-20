import { SupabaseClient } from '@supabase/supabase-js'
import { SubscriptionPlan } from './types'

export class SubscriptionService {
  async getPlanBySlug(_slug: string): Promise<SubscriptionPlan | null> {
    // Esqueleto inicial para consulta futura
    return null
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
    const { data: ministry, error: fetchError } = await supabaseAdmin
      .from('ministries')
      .select('*')
      .eq('id', ministryId)
      .single()

    if (fetchError || !ministry) {
      throw new Error('Ministério não encontrado')
    }

    // 2. Buscar plano correspondente para associar subscription_plan_id
    const { data: planRow } = await supabaseAdmin
      .from('subscription_plans')
      .select('id')
      .eq('slug', planSlug)
      .maybeSingle()

    // Calcular datas
    const startDate = new Date()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + validityMonths)

    // Atualizar ministério
    const { data: updatedMinistry, error: updateError } = await supabaseAdmin
      .from('ministries')
      .update({
        subscription_status: 'active',
        plan: planSlug,
        subscription_plan_id: planRow?.id || null,
        subscription_start_date: startDate.toISOString(),
        subscription_end_date: endDate.toISOString(),
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', ministryId)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Erro ao atualizar ministério: ${updateError.message}`)
    }

    // 3. Buscar e atualizar pre_registrations usando robustez (ministry_id com fallback para user_id)
    let preRegData = null
    try {
      const { data } = await supabaseAdmin
        .from('pre_registrations')
        .select('id, user_id')
        .eq('ministry_id', ministryId)
        .maybeSingle()
      preRegData = data
    } catch {
      // Ignorar erro se coluna ministry_id não existir
    }

    if (!preRegData && ministry.user_id) {
      const { data } = await supabaseAdmin
        .from('pre_registrations')
        .select('id, user_id')
        .eq('user_id', ministry.user_id)
        .maybeSingle()
      preRegData = data
    }

    let hasPreRegUpdated = false
    if (preRegData?.id) {
      const { error: preRegUpdateError } = await supabaseAdmin
        .from('pre_registrations')
        .update({ status: 'efetivado' })
        .eq('id', preRegData.id)
      if (!preRegUpdateError) {
        hasPreRegUpdated = true
      }
    }

    return {
      success: true,
      updatedMinistry,
      hasPreRegUpdated,
      statusAnterior: ministry.subscription_status,
      planAnterior: ministry.plan,
      endDateAnterior: ministry.subscription_end_date
    }
  }
}
