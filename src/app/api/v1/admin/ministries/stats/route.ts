/**
 * API ROUTE: Ministry Stats (Admin)
 * Endpoint de estatísticas agregadas globais do módulo Tenant Management.
 * Reutiliza estritamente a função autoritativa getDetailedStatus() para classificação de status.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { getDetailedStatus } from '@/lib/admin/ministerios/status'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredModule: 'ministerios' })
    if (!result.ok) return result.response
    const { supabaseAdmin } = result.ctx

    // 1. Consultar todos os ministérios com campos de plano e status
    const { data: ministries, error: minError } = await supabaseAdmin
      .from('ministries')
      .select('id, is_active, subscription_status, subscription_end_date, plan, subscription_plan_id')

    if (minError) {
      return NextResponse.json({ error: minError.message }, { status: 400 })
    }

    // 2. Consultar planos de assinatura para cálculo do MRR
    const { data: plans } = await supabaseAdmin
      .from('subscription_plans')
      .select('id, slug, price_monthly, name')

    const planMap = new Map<string, number>()
    if (plans && Array.isArray(plans)) {
      plans.forEach((p: any) => {
        const preco = Number(p.price_monthly) || 0
        if (p.id) planMap.set(String(p.id).toLowerCase(), preco)
        if (p.slug) planMap.set(String(p.slug).toLowerCase(), preco)
      })
    }

    let ativos = 0
    let trials = 0
    let suspensos = 0
    let totalMrr = 0

    const list = ministries || []

    list.forEach((m: any) => {
      // Classificação via regra autoritativa getDetailedStatus
      const status = getDetailedStatus(m)

      if (status.type === 'ATIVO') {
        ativos++
        // Somar MRR do plano ativo do cliente
        const planKeyId = m.subscription_plan_id ? String(m.subscription_plan_id).toLowerCase() : ''
        const planKeySlug = m.plan ? String(m.plan).toLowerCase() : ''
        const precoPlano = planMap.get(planKeyId) ?? planMap.get(planKeySlug) ?? 0
        totalMrr += precoPlano
      } else if (status.type === 'TRIAL_ATIVO') {
        trials++
      } else if (status.type === 'SUSPENSO' || status.type === 'TRIAL_EXPIRADO' || status.type === 'CANCELADO') {
        suspensos++
      }
    })

    // 3. Consultar total de faturas pendentes/vencidas na tabela local platform_billing_invoices
    const { count: faturasPendentesCount } = await supabaseAdmin
      .from('platform_billing_invoices')
      .select('id', { count: 'exact', head: true })
      .in('status', ['PENDING', 'OVERDUE', 'pending', 'overdue'])

    // 4. Consultar Leads na tabela pre_registrations separando ativos, expirados e total
    const nowIso = new Date().toISOString()

    const { count: leadsAtivosCount } = await supabaseAdmin
      .from('pre_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'trial')
      .gte('trial_expires_at', nowIso)

    const { count: leadsTotalCount } = await supabaseAdmin
      .from('pre_registrations')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'efetivado')

    const leadsAtivos = leadsAtivosCount || 0
    const leadsTotal = leadsTotalCount || 0
    const leadsExpirados = Math.max(0, leadsTotal - leadsAtivos)

    const mrrFormatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(totalMrr)

    return NextResponse.json({
      data: {
        total: list.length,
        ativos,
        trials,
        suspensos,
        pendentes: faturasPendentesCount || 0,
        leads: leadsAtivos, // Métrica de Leads Ativos (trials vigentes) em perfeita sincronia com a aba
        leads_ativos: leadsAtivos,
        leads_expirados: leadsExpirados,
        leads_total: leadsTotal,
        mrr: mrrFormatted,
        mrr_raw: totalMrr,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
