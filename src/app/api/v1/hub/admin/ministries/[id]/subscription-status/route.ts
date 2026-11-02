import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdminM2M, logAdminM2MAudit } from '@/lib/hub-m2m-admin-guard'
import { checkAndRegisterIdempotency, releaseIdempotencyKey } from '@/lib/hub-m2m-idempotency'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const ALLOWED_OPERATOR_ROLES = ['admin', 'super_admin', 'operador', 'suporte', 'diretoria']
const VALID_SUBSCRIPTION_STATUSES = ['active', 'trial', 'cancelled', 'suspended', 'past_due']

/**
 * POST /api/v1/hub/admin/ministries/[id]/subscription-status
 * Gestão de ciclo de vida / status da assinatura do ministério executada pelo Hub.
 * Controla status corporativo (active, suspended, cancelled, etc.) e flag is_active.
 * Não altera registros financeiros ou cobranças Asaas.
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
    await logAdminM2MAudit('SUBSCRIPTION_STATUS_UNAUTHORIZED_OPERATOR', {
      keyId,
      correlationId,
      operatorEmail,
      operatorRole,
      path: canonicalPath,
      statusCode: 403,
      details: { reason: 'Operador sem permissão corporativa para alterar status de assinatura' },
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

  const newStatus = String(body?.status || body?.subscription_status || '').toLowerCase().trim()
  if (!newStatus || !VALID_SUBSCRIPTION_STATUSES.includes(newStatus)) {
    return NextResponse.json(
      {
        error: 'INVALID_SUBSCRIPTION_STATUS',
        message: `Status de assinatura inválido. Valores aceitos: ${VALID_SUBSCRIPTION_STATUSES.join(', ')}.`,
        correlation_id: correlationId,
      },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  // 4. Buscar ministério e validar existência
  const { data: ministry, error: minErr } = await supabase
    .from('ministries')
    .select('id, name, slug, plan, subscription_status, subscription_start_date, subscription_end_date, is_active')
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

  // 5. Garantia de Idempotência Distribuída
  if (idempotencyKey) {
    const idempCheck = await checkAndRegisterIdempotency(
      idempotencyKey,
      `subscription-status:${id}:${newStatus}`,
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
          message: 'Atualização de status já processada anteriormente (idempotência garantida).',
          client: ministry,
          correlation_id: correlationId,
        },
        { status: 200 }
      )
    }
  }

  // 6. Transição de Status Segura
  try {
    const previousStatus = ministry.subscription_status
    const previousIsActive = ministry.is_active

    // Determinar is_active derivado do status se não fornecido explicitamente
    let newIsActive = ministry.is_active
    if (body?.is_active !== undefined) {
      newIsActive = Boolean(body.is_active)
    } else if (newStatus === 'active') {
      newIsActive = true
    } else if (['cancelled', 'suspended'].includes(newStatus)) {
      newIsActive = false
    }

    const updatePayload: Record<string, any> = {
      subscription_status: newStatus,
      is_active: newIsActive,
      updated_at: new Date().toISOString(),
    }

    // Se fornecida nova data de término (ex: prorrogação de validade)
    if (body?.subscription_end_date) {
      const parsedDate = new Date(body.subscription_end_date)
      if (!isNaN(parsedDate.getTime())) {
        updatePayload.subscription_end_date = parsedDate.toISOString()
      }
    }

    const { data: updatedMinistry, error: updateErr } = await supabase
      .from('ministries')
      .update(updatePayload)
      .eq('id', id)
      .select('id, name, slug, plan, subscription_plan_id, subscription_status, subscription_start_date, subscription_end_date, is_active')
      .single()

    if (updateErr || !updatedMinistry) {
      throw new Error(`Erro ao atualizar status no banco: ${updateErr?.message || 'Falha de persistência'}`)
    }

    // 7. Auditoria Sanitizada Obrigatória
    await logAdminM2MAudit('M2M_UPDATE_SUBSCRIPTION_STATUS', {
      keyId,
      correlationId,
      operatorEmail,
      operatorRole,
      path: canonicalPath,
      statusCode: 200,
      details: {
        ministry_id: id,
        ministry_name: updatedMinistry.name,
        previous_status: previousStatus,
        previous_is_active: previousIsActive,
        new_status: newStatus,
        new_is_active: newIsActive,
        reason: body?.reason || body?.motivo || 'Gestão de assinatura via Alcântara Hub',
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: `Status da assinatura atualizado para '${newStatus}'.`,
        client: updatedMinistry,
        transition: {
          previous_status: previousStatus,
          new_status: newStatus,
          is_active: updatedMinistry.is_active,
        },
        correlation_id: correlationId,
      },
      { status: 200 }
    )
  } catch (err: any) {
    if (idempotencyKey) {
      await releaseIdempotencyKey(idempotencyKey, `subscription-status:${id}`)
    }

    await logAdminM2MAudit('SUBSCRIPTION_STATUS_EXCEPTION', {
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
        error: 'SUBSCRIPTION_STATUS_INTERNAL_ERROR',
        message: err?.message || 'Erro interno ao atualizar status da assinatura.',
        correlation_id: correlationId,
      },
      { status: 500 }
    )
  }
}
