import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdminM2M, logAdminM2MAudit } from '@/lib/hub-m2m-admin-guard'
import { checkAndRegisterIdempotency, releaseIdempotencyKey } from '@/lib/hub-m2m-idempotency'
import { createServerClient } from '@/lib/supabase-server'
import { PlanResolutionService } from '@/lib/platform/billing/PlanResolutionService'

export const dynamic = 'force-dynamic'

const ALLOWED_OPERATOR_ROLES = ['admin', 'super_admin', 'operador', 'suporte', 'diretoria']

/**
 * POST /api/v1/hub/admin/ministries/[id]/change-plan
 * Alteração administrativa do plano comercial de um ministério pelo Hub.
 * Reutiliza estritamente PlanResolutionService e atualiza a licença sem tocar em cobranças Asaas.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let body: any
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  // 1. Autenticação HMAC-SHA256 M2M Administrativa Estendida
  const auth = await authenticateAdminM2M(request, body)
  if (!auth.ok) {
    return auth.response
  }

  const { keyId, correlationId, idempotencyKey, operatorEmail, operatorRole, canonicalPath } = auth.ctx
  const { id } = await context.params

  // 2. Validação de Autorização por Operação e Operador
  const normalizedRole = (operatorRole || '').toLowerCase().trim()
  if (!operatorEmail || !ALLOWED_OPERATOR_ROLES.includes(normalizedRole)) {
    await logAdminM2MAudit('CHANGE_PLAN_UNAUTHORIZED_OPERATOR', {
      keyId,
      correlationId,
      operatorEmail,
      operatorRole,
      path: canonicalPath,
      statusCode: 403,
      details: { reason: 'Operador sem permissão corporativa para alterar planos' },
    })

    return NextResponse.json(
      {
        error: 'FORBIDDEN_OPERATOR_ROLE',
        message: 'O operador informado no cabeçalho não possui permissão para executar esta operação.',
        correlation_id: correlationId,
      },
      { status: 403 }
    )
  }

  // 3. Validação de Parâmetros
  if (!id) {
    return NextResponse.json(
      {
        error: 'MISSING_CLIENT_ID',
        message: 'O parâmetro ID do ministério é obrigatório.',
        correlation_id: correlationId,
      },
      { status: 400 }
    )
  }

  const newPlanSlug = String(body?.new_plan_slug || body?.novo_plano_slug || body?.plan_slug || '').toLowerCase().trim()
  if (!newPlanSlug) {
    return NextResponse.json(
      {
        error: 'MISSING_PLAN_SLUG',
        message: 'O campo new_plan_slug é obrigatório.',
        correlation_id: correlationId,
      },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  // 4. Buscar ministério e validar existência
  const { data: ministry, error: minErr } = await supabase
    .from('ministries')
    .select('id, name, slug, plan, subscription_plan_id, subscription_status, subscription_start_date, subscription_end_date, is_active')
    .eq('id', id)
    .single()

  if (minErr || !ministry) {
    return NextResponse.json(
      {
        error: 'CLIENT_NOT_FOUND',
        message: 'Ministério não encontrado para o ID fornecido.',
        correlation_id: correlationId,
      },
      { status: 404 }
    )
  }

  // 5. Validação de Plano Oficial Comercial
  const resolvedPlan = await PlanResolutionService.resolveBySlug(supabase, newPlanSlug)
  if (!resolvedPlan) {
    await logAdminM2MAudit('CHANGE_PLAN_INVALID_SLUG', {
      keyId,
      correlationId,
      operatorEmail,
      operatorRole,
      path: canonicalPath,
      statusCode: 422,
      details: { newPlanSlug, reason: 'Plano não reconhecido ou slug não-comercial' },
    })

    return NextResponse.json(
      {
        error: 'INVALID_COMMERCIAL_PLAN',
        message: `O plano '${newPlanSlug}' não é um plano comercial ativo oficial.`,
        correlation_id: correlationId,
      },
      { status: 422 }
    )
  }

  // 6. Garantia de Idempotência Distribuída
  if (idempotencyKey) {
    const idempCheck = await checkAndRegisterIdempotency(
      idempotencyKey,
      `change-plan:${id}`,
      correlationId,
      keyId
    )

    if (!idempCheck.success) {
      return NextResponse.json(
        {
          error: 'IDEMPOTENCY_STORAGE_ERROR',
          message: 'Falha no serviço compartilhado de idempotência.',
          correlation_id: correlationId,
        },
        { status: 503 }
      )
    }

    if (idempCheck.isDuplicate) {
      return NextResponse.json(
        {
          success: true,
          idempotent_replay: true,
          message: 'Alteração de plano já processada anteriormente (idempotência garantida).',
          client: ministry,
          correlation_id: correlationId,
        },
        { status: 200 }
      )
    }
  }

  // 7. Atualização Segura do Plano
  try {
    const previousPlan = ministry.plan
    const previousPlanId = ministry.subscription_plan_id

    const { data: updatedMinistry, error: updateErr } = await supabase
      .from('ministries')
      .update({
        plan: resolvedPlan.slug,
        subscription_plan_id: resolvedPlan.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, name, slug, plan, subscription_plan_id, subscription_status, subscription_start_date, subscription_end_date, is_active')
      .single()

    if (updateErr || !updatedMinistry) {
      throw new Error(`Erro ao atualizar plano no banco: ${updateErr?.message || 'Falha de persistência'}`)
    }

    // Atualização de contrato no Módulo Jurídico se houver
    try {
      const { ContratosService } = await import('@/services/ContratosService')
      const contratosService = new ContratosService(supabase)
      await contratosService.criarContratoAoConverter({
        ministry_id: id,
        plano_contratado: resolvedPlan.slug,
      })
    } catch (contractErr: any) {
      console.warn('[ChangePlan] Aviso ao sincronizar contrato jurídico:', contractErr?.message || contractErr)
    }

    // 8. Auditoria Sanitizada Obrigatória
    await logAdminM2MAudit('M2M_CHANGE_MINISTRY_PLAN', {
      keyId,
      correlationId,
      operatorEmail,
      operatorRole,
      path: canonicalPath,
      statusCode: 200,
      details: {
        ministry_id: id,
        ministry_name: updatedMinistry.name,
        previous_plan: previousPlan,
        previous_plan_id: previousPlanId,
        new_plan: resolvedPlan.slug,
        new_plan_id: resolvedPlan.id,
        reason: body?.reason || body?.motivo || 'Upgrade/Downgrade de plano via Alcântara Hub',
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: `Plano do cliente alterado com sucesso para '${resolvedPlan.name}'.`,
        client: updatedMinistry,
        transition: {
          previous_plan: previousPlan,
          new_plan: resolvedPlan.slug,
          plan_name: resolvedPlan.name,
        },
        correlation_id: correlationId,
      },
      { status: 200 }
    )
  } catch (err: any) {
    if (idempotencyKey) {
      await releaseIdempotencyKey(idempotencyKey, `change-plan:${id}`)
    }

    await logAdminM2MAudit('CHANGE_PLAN_EXCEPTION', {
      keyId,
      correlationId,
      operatorEmail,
      operatorRole,
      path: canonicalPath,
      statusCode: 500,
      details: { error: err?.message || String(err) },
    })

    return NextResponse.json(
      {
        error: 'CHANGE_PLAN_INTERNAL_ERROR',
        message: err?.message || 'Erro interno ao alterar plano do cliente.',
        correlation_id: correlationId,
      },
      { status: 500 }
    )
  }
}
