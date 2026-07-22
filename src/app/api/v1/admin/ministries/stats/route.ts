/**
 * API ROUTE: Ministry Stats (Admin)
 * Endpoint de estatísticas agregadas globais do módulo Tenant Management
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredModule: 'ministerios' })
    if (!result.ok) return result.response
    const { supabaseAdmin } = result.ctx

    // Buscar a coleção global de ministérios com suas cobranças
    const { data: ministries, error } = await supabaseAdmin
      .from('ministries')
      .select('id, subscription_status, trial_ends_at, subscription_end_date, platform_billing_invoices(id, status)')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const now = new Date()
    let ativos = 0
    let trials = 0
    let suspensos = 0
    let pendentes = 0

    const list = ministries || []

    list.forEach((m: any) => {
      // Regra de calculo de status alinhada com helpers.ts
      const statusRaw = m.subscription_status
      const trialEnds = m.trial_ends_at ? new Date(m.trial_ends_at) : null
      const subEnds = m.subscription_end_date ? new Date(m.subscription_end_date) : null

      const isTrial = statusRaw === 'trial' || statusRaw === 'trialing' || statusRaw === 'precadastro' || (trialEnds && trialEnds > now)
      const isExpiredTrial = (statusRaw === 'trial' || statusRaw === 'trialing' || statusRaw === 'precadastro') && trialEnds && trialEnds <= now

      if (statusRaw === 'active' || statusRaw === 'ativo' || (subEnds && subEnds > now && !isTrial)) {
        ativos++
      } else if (isTrial && !isExpiredTrial) {
        trials++
      } else if (statusRaw === 'suspended' || statusRaw === 'suspenso' || isExpiredTrial) {
        suspensos++
      } else {
        // Fallback default
        ativos++
      }

      // Regra de cobrancas pendentes no Asaas
      const faturas = m.platform_billing_invoices || []
      const temPendencia = faturas.some((f: any) => f.status !== 'RECEIVED' && f.status !== 'CONFIRMED')
      if (temPendencia) {
        pendentes++
      }
    })

    return NextResponse.json({
      data: {
        total: list.length,
        ativos,
        trials,
        suspensos,
        pendentes,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
