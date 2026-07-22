/**
 * API ROUTE: Ministry Stats (Admin)
 * Endpoint de estatísticas agregadas globais do módulo Tenant Management.
 * Reutiliza estritamente a função autoritativa getDetailedStatus() para classificação de status.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { getDetailedStatus } from '@/lib/admin/ministerios/status'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredModule: 'ministerios' })
    if (!result.ok) return result.response
    const { supabaseAdmin } = result.ctx

    // Select otimizado contendo os campos obrigatorios requeridos por getDetailedStatus()
    const { data: ministries, error } = await supabaseAdmin
      .from('ministries')
      .select('id, is_active, subscription_status, subscription_end_date, platform_billing_invoices(id, status)')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    let ativos = 0
    let trials = 0
    let suspensos = 0
    let pendentes = 0

    const list = ministries || []

    list.forEach((m: any) => {
      // 1. Classificação via regra autoritativa getDetailedStatus
      const status = getDetailedStatus(m)

      if (status.type === 'ATIVO') {
        ativos++
      } else if (status.type === 'TRIAL_ATIVO') {
        trials++
      } else if (status.type === 'SUSPENSO' || status.type === 'TRIAL_EXPIRADO' || status.type === 'CANCELADO') {
        suspensos++
      }

      // 2. Regra de cobranças pendentes no Asaas
      const faturas = m.platform_billing_invoices || []
      const temPendencia = faturas.some((f: any) => f.status !== 'RECEIVED' && f.status !== 'CONFIRMED')
      if (temPendencia) {
        pendentes++
      }
    })

    // Consultar Leads pendentes na tabela pre_registrations
    const { count: leadsCount } = await supabaseAdmin
      .from('pre_registrations')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'efetivado')

    return NextResponse.json({
      data: {
        total: list.length,
        ativos,
        trials,
        suspensos,
        pendentes,
        leads: leadsCount || 0,
        mrr: 'Em implantação',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
