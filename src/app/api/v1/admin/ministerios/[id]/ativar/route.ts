import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { SubscriptionService } from '@/lib/platform'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await requireAdmin(request, { requiredCapability: 'can_manage_ministries' })
    if (!result.ok) return result.response
    const { supabaseAdmin, adminUser } = result.ctx

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID do ministério é obrigatório' }, { status: 400 })
    }

    const body = await request.json()
    const modo = body?.modo
    const planSlug = body?.plano_slug
    const validityMonths = Number(body?.validade_meses ?? 12)

    if (modo !== 'direto') {
      return NextResponse.json({ error: 'Apenas ativação direta é permitida nesta entrega' }, { status: 400 })
    }

    if (!planSlug || !['starter', 'intermediario', 'profissional'].includes(planSlug)) {
      return NextResponse.json({ error: 'Plano inválido selecionado' }, { status: 400 })
    }

    // 1. Invoca o serviço da camada de domínio da plataforma
    const subscriptionService = new SubscriptionService()
    const activationResult = await subscriptionService.activateSubscription(
      supabaseAdmin,
      id,
      planSlug,
      validityMonths
    )

    if (!activationResult || !activationResult.success) {
      return NextResponse.json({ error: 'Falha ao processar ativação de assinatura via domínio' }, { status: 400 })
    }

    const { updatedMinistry, hasPreRegUpdated, statusAnterior, planAnterior, endDateAnterior } = activationResult

    // 2. Registrar logs detalhados de auditoria administrativa
    const changesLog = {
      status_anterior: statusAnterior,
      plano_anterior: planAnterior,
      subscription_end_date_anterior: endDateAnterior,
      novo_plano: planSlug,
      nova_validade_meses: validityMonths,
      admin_responsavel: adminUser.email,
      modo: 'direto',
      observacao: body.observacao || '',
      pre_registration_vinculado_updated: hasPreRegUpdated
    }

    await supabaseAdmin
      .from('admin_audit_logs')
      .insert([{
        admin_user_id: adminUser.id,
        action: 'ACTIVATE_MINISTRY',
        entity_type: 'ministries',
        entity_id: id,
        changes: changesLog,
        status: 'success',
      }])

    return NextResponse.json({
      success: true,
      data: updatedMinistry,
      message: 'Ministério ativado com sucesso!'
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

