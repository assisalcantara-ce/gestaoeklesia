import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdminM2M, logAdminM2MAudit } from '@/lib/hub-m2m-admin-guard'
import { checkAndRegisterIdempotency, releaseIdempotencyKey } from '@/lib/hub-m2m-idempotency'
import { createServerClient } from '@/lib/supabase-server'
import { SubscriptionService } from '@/lib/platform'
import { PlanResolutionService } from '@/lib/platform/billing/PlanResolutionService'

export const dynamic = 'force-dynamic'

const ALLOWED_OPERATOR_ROLES = ['admin', 'super_admin', 'operador', 'suporte', 'diretoria']

/**
 * POST /api/v1/hub/admin/ministries/[id]/activate
 * Ativação administrativa de ministério pelo Hub da Alcântara Sistemas.
 * Reutiliza estritamente SubscriptionService.activateSubscription do domínio.
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
    await logAdminM2MAudit('ACTIVATE_CLIENT_UNAUTHORIZED_OPERATOR', {
      keyId,
      correlationId,
      operatorEmail,
      operatorRole,
      path: canonicalPath,
      statusCode: 403,
      details: { reason: 'Operador sem permissão corporativa para ativar clientes' },
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

  const supabase = createServerClient()

  // 4. Buscar ministério e validar existência (retorna 404 CLIENT_NOT_FOUND se não existir)
  const { data: existingMinistry, error: minErr } = await supabase
    .from('ministries')
    .select('id, name, slug, plan, subscription_plan_id, subscription_status, subscription_start_date, subscription_end_date, is_active')
    .eq('id', id)
    .single()

  if (minErr || !existingMinistry) {
    await logAdminM2MAudit('ACTIVATE_CLIENT_NOT_FOUND', {
      keyId,
      correlationId,
      operatorEmail,
      operatorRole,
      path: canonicalPath,
      statusCode: 404,
      details: { ministryId: id, error: minErr?.message },
    })

    return NextResponse.json(
      {
        error: 'CLIENT_NOT_FOUND',
        message: 'Ministério não encontrado para o ID fornecido.',
        correlation_id: correlationId,
      },
      { status: 404 }
    )
  }

  const planSlug = String(body?.plan_slug || body?.plano_slug || '').toLowerCase().trim()
  const validityMonths = Number(body?.validity_months || body?.validade_meses || 12)

  if (!planSlug) {
    return NextResponse.json(
      {
        error: 'MISSING_PLAN_SLUG',
        message: 'O campo plan_slug é obrigatório.',
        correlation_id: correlationId,
      },
      { status: 400 }
    )
  }

  if (isNaN(validityMonths) || validityMonths <= 0 || validityMonths > 120) {
    return NextResponse.json(
      {
        error: 'INVALID_VALIDITY_MONTHS',
        message: 'A validade em meses deve ser um número positivo entre 1 e 120.',
        correlation_id: correlationId,
      },
      { status: 400 }
    )
  }

  // 5. Validação de Plano Oficial Comercial (reutilizando PlanResolutionService)
  const resolvedPlan = await PlanResolutionService.resolveBySlug(supabase, planSlug)
  if (!resolvedPlan) {
    await logAdminM2MAudit('ACTIVATE_CLIENT_INVALID_PLAN', {
      keyId,
      correlationId,
      operatorEmail,
      operatorRole,
      path: canonicalPath,
      statusCode: 422,
      details: { planSlug, reason: 'Plano não reconhecido ou slug não-comercial' },
    })

    return NextResponse.json(
      {
        error: 'INVALID_COMMERCIAL_PLAN',
        message: `O plano '${planSlug}' não é um plano comercial ativo oficial.`,
        correlation_id: correlationId,
      },
      { status: 422 }
    )
  }

  // 6. Garantia de Idempotência Distribuída
  if (idempotencyKey) {
    const idempCheck = await checkAndRegisterIdempotency(
      idempotencyKey,
      `activate:${id}`,
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
      // Retorna sucesso idempotente sem duplicar ativações
      const { data: currentMinistry } = await supabase
        .from('ministries')
        .select('id, name, plan, subscription_status, subscription_start_date, subscription_end_date, is_active')
        .eq('id', id)
        .single()

      return NextResponse.json(
        {
          success: true,
          idempotent_replay: true,
          message: 'Operação já processada anteriormente (idempotência garantida).',
          client: currentMinistry || existingMinistry,
          correlation_id: correlationId,
        },
        { status: 200 }
      )
    }
  }

  // 7. Execução via Serviço de Domínio Existente
  try {
    const subscriptionService = new SubscriptionService()
    const activationResult = await subscriptionService.activateSubscription(
      supabase,
      id,
      resolvedPlan.slug,
      validityMonths
    )

    if (!activationResult || !activationResult.success) {
      // Liberar chave de idempotência em caso de falha de domínio para permitir retentativa legítima
      if (idempotencyKey) {
        await releaseIdempotencyKey(idempotencyKey, `activate:${id}`)
      }

      await logAdminM2MAudit('ACTIVATE_CLIENT_DOMAIN_FAILURE', {
        keyId,
        correlationId,
        operatorEmail,
        operatorRole,
        path: canonicalPath,
        statusCode: 422,
        details: { ministryId: id, planSlug: resolvedPlan.slug },
      })

      return NextResponse.json(
        {
          error: 'ACTIVATION_PROCESSING_FAILED',
          message: 'Falha ao processar ativação de assinatura via camada de domínio.',
          correlation_id: correlationId,
        },
        { status: 422 }
      )
    }

    const { updatedMinistry, statusAnterior, planAnterior, endDateAnterior } = activationResult

    // 8. Auditoria Sanitizada Obrigatória
    await logAdminM2MAudit('M2M_ACTIVATE_MINISTRY', {
      keyId,
      correlationId,
      operatorEmail,
      operatorRole,
      path: canonicalPath,
      statusCode: 200,
      details: {
        ministry_id: id,
        ministry_name: updatedMinistry.name,
        previous_status: statusAnterior,
        previous_plan: planAnterior,
        previous_end_date: endDateAnterior,
        new_plan: resolvedPlan.slug,
        new_validity_months: validityMonths,
        new_end_date: updatedMinistry.subscription_end_date,
        operation_note: body?.reason || body?.observacao || 'Ativação corporativa via Alcântara Hub',
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Ministério ativado e licenciado com sucesso via Hub.',
        client: {
          id: updatedMinistry.id,
          name: updatedMinistry.name,
          slug: updatedMinistry.slug,
          plan: updatedMinistry.plan,
          subscription_plan_id: updatedMinistry.subscription_plan_id,
          subscription_status: updatedMinistry.subscription_status,
          subscription_start_date: updatedMinistry.subscription_start_date,
          subscription_end_date: updatedMinistry.subscription_end_date,
          is_active: updatedMinistry.is_active,
        },
        activation_details: {
          previous_status: statusAnterior,
          previous_plan: planAnterior,
          validity_months: validityMonths,
        },
        correlation_id: correlationId,
      },
      { status: 200 }
    )
  } catch (err: any) {
    // Liberar chave de idempotência em caso de exceção para permitir retentativa legítima
    if (idempotencyKey) {
      await releaseIdempotencyKey(idempotencyKey, `activate:${id}`)
    }

    await logAdminM2MAudit('ACTIVATE_CLIENT_EXCEPTION', {
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
        error: 'ACTIVATE_CLIENT_INTERNAL_ERROR',
        message: err?.message || 'Erro interno ao ativar cliente.',
        correlation_id: correlationId,
      },
      { status: 500 }
    )
  }
}

