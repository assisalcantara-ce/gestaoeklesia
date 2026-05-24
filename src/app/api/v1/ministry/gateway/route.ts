/**
 * API ROUTE: Configuração de Gateways de Pagamento por Ministério
 *
 * GET    /api/v1/ministry/gateway          — lista gateways (sem credenciais)
 * POST   /api/v1/ministry/gateway          — cria ou atualiza gateway (upsert por ministry_id+gateway)
 * DELETE /api/v1/ministry/gateway?gateway= — desativa um gateway (soft delete)
 *
 * Segurança:
 * - GET: requer permissão ADMINISTRADOR ou FINANCEIRO
 * - POST/DELETE: requer permissão ADMINISTRADOR (ou owner do ministério)
 * - encrypted_credentials NUNCA é retornada ao cliente
 * - Credenciais são mascaradas antes de incluir na resposta
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantAuth } from '@/lib/tenant-auth'
import {
  encryptCredentials,
  decryptCredentials,
  maskGatewayCredentials,
} from '@/lib/ministry-credentials'

type Gateway = 'asaas' | 'efi'
const VALID_GATEWAYS: Gateway[] = ['asaas', 'efi']

function isValidGateway(value: string): value is Gateway {
  return VALID_GATEWAYS.includes(value as Gateway)
}

// ─── GET /api/v1/ministry/gateway ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request)
    if (!ctx.ministryId) {
      return NextResponse.json({ error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' }, { status: 403 })
    }

    const hasAccess =
      ctx.isOwner ||
      ctx.nivel === 'administrador' ||
      ctx.nivel === 'financeiro'

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Acesso negado. Requer permissão ADMINISTRADOR ou FINANCEIRO.', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const { data, error } = await ctx.admin.rpc('get_ministry_gateways', {
      p_ministry_id: ctx.ministryId,
    })

    if (error) {
      console.error('[gateway GET] RPC error:', error)
      return NextResponse.json({ error: 'Erro ao consultar gateways.', code: 'DB_ERROR' }, { status: 500 })
    }

    // Para cada gateway com credenciais, incluir versão mascarada
    const result = (data ?? []).map((row: any) => {
      let masked_credentials: Record<string, string | null> | null = null

      if (row.has_credentials) {
        try {
          // Buscamos as credenciais reais para mascarar (não para expor)
          // Fazemos uma query separada com service_role para obter o campo criptografado
          // O mascaramento é feito aqui no servidor e só o resultado mascarado vai ao cliente
          masked_credentials = {} // preenchido abaixo de forma síncrona
        } catch {
          masked_credentials = null
        }
      }

      return {
        id:                    row.id,
        gateway:               row.gateway,
        environment:           row.environment,
        display_name:          row.display_name,
        is_active:             row.is_active,
        status:                row.status,
        has_credentials:       row.has_credentials,
        masked_credentials,
        webhook_token:         row.webhook_token,
        webhook_url_hint:      row.webhook_url_hint,
        last_test_at:          row.last_test_at,
        last_test_ok:          row.last_test_ok,
        last_error:            row.last_error,
        connection_latency_ms: row.connection_latency_ms,
        created_at:            row.created_at,
        updated_at:            row.updated_at,
      }
    })

    // Enriquece masked_credentials buscando as credenciais reais via admin client
    const enriched = await Promise.all(
      result.map(async (row: any) => {
        if (!row.has_credentials) return row

        const { data: raw } = await ctx.admin
          .from('ministry_payment_gateways')
          .select('encrypted_credentials')
          .eq('ministry_id', ctx.ministryId!)
          .eq('gateway', row.gateway)
          .maybeSingle()

        if (raw?.encrypted_credentials) {
          try {
            const plain = decryptCredentials(raw.encrypted_credentials)
            row.masked_credentials = maskGatewayCredentials(row.gateway as Gateway, plain)
          } catch {
            row.masked_credentials = null
          }
        }

        return row
      })
    )

    return NextResponse.json({ data: enriched })
  } catch (err: any) {
    if (err?.message?.includes('Não autenticado') || err?.code === 'PGRST301') {
      return NextResponse.json({ error: 'Não autenticado.', code: 'UNAUTHORIZED' }, { status: 401 })
    }
    console.error('[gateway GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.', code: 'INTERNAL' }, { status: 500 })
  }
}

// ─── POST /api/v1/ministry/gateway ────────────────────────────────────────────

interface GatewayPostBody {
  gateway: string
  environment?: 'sandbox' | 'production'
  display_name?: string
  credentials?: Record<string, string>
  is_active?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request)
    if (!ctx.ministryId) {
      return NextResponse.json({ error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' }, { status: 403 })
    }

    const isAdmin =
      ctx.isOwner ||
      ctx.nivel === 'administrador'

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Acesso negado. Requer permissão ADMINISTRADOR.', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    let body: GatewayPostBody
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Corpo da requisição inválido.', code: 'BAD_REQUEST' }, { status: 400 })
    }

    const { gateway, environment = 'sandbox', display_name, credentials, is_active } = body

    if (!gateway || !isValidGateway(gateway)) {
      return NextResponse.json(
        { error: `Gateway inválido. Valores aceitos: ${VALID_GATEWAYS.join(', ')}`, code: 'INVALID_GATEWAY' },
        { status: 400 }
      )
    }

    // Validação mínima das credenciais por gateway
    if (credentials) {
      if (gateway === 'asaas' && !credentials.api_key) {
        return NextResponse.json(
          { error: 'ASAAS requer o campo credentials.api_key.', code: 'MISSING_CREDENTIAL' },
          { status: 400 }
        )
      }
      if (gateway === 'efi' && (!credentials.client_id || !credentials.client_secret)) {
        return NextResponse.json(
          { error: 'EFI requer credentials.client_id e credentials.client_secret.', code: 'MISSING_CREDENTIAL' },
          { status: 400 }
        )
      }
    }

    // Buscar registro existente para saber se há credenciais salvas
    const { data: existing } = await ctx.admin
      .from('ministry_payment_gateways')
      .select('id, encrypted_credentials')
      .eq('ministry_id', ctx.ministryId)
      .eq('gateway', gateway)
      .maybeSingle()

    // Criptografar novas credenciais se enviadas, senão manter as existentes
    let encrypted: string | undefined
    if (credentials && Object.keys(credentials).length > 0) {
      encrypted = encryptCredentials(credentials)
    }

    const webhookUrlHint = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/ministry-webhook/${gateway}/{webhook_token}`
      : null

    const upsertPayload: Record<string, any> = {
      ministry_id:         ctx.ministryId,
      gateway,
      environment,
      display_name:        display_name ?? `${gateway.toUpperCase()} ${environment}`,
      status:              encrypted || existing?.encrypted_credentials ? 'configured' : 'not_configured',
      configured_by:       ctx.userId,
      updated_at:          new Date().toISOString(),
      // is_active: só inclui se explicitamente fornecido no body.
      // Em UPDATE sem is_active no body → preserva valor atual.
      // Em INSERT sem is_active no body → padrão false (gateway inativo até ser ativado manualmente).
      ...(is_active !== undefined ? { is_active } : (!existing ? { is_active: false } : {})),
      ...(webhookUrlHint ? { webhook_url_hint: webhookUrlHint } : {}),
      ...(encrypted ? { encrypted_credentials: encrypted } : {}),
    }

    let savedId: string
    if (existing) {
      const { error: updErr } = await ctx.admin
        .from('ministry_payment_gateways')
        .update(upsertPayload)
        .eq('id', existing.id)

      if (updErr) {
        console.error('[gateway POST] update error:', updErr)
        return NextResponse.json({ error: 'Erro ao atualizar gateway.', code: 'DB_ERROR' }, { status: 500 })
      }
      savedId = existing.id
    } else {
      const { data: inserted, error: insErr } = await ctx.admin
        .from('ministry_payment_gateways')
        .insert(upsertPayload)
        .select('id')
        .single()

      if (insErr || !inserted) {
        console.error('[gateway POST] insert error:', insErr)
        return NextResponse.json({ error: 'Erro ao criar gateway.', code: 'DB_ERROR' }, { status: 500 })
      }
      savedId = inserted.id
    }

    return NextResponse.json({
      success: true,
      id: savedId,
      message: `Gateway ${gateway.toUpperCase()} salvo com sucesso.`,
    })
  } catch (err: any) {
    if (err?.message?.includes('Não autenticado') || err?.code === 'PGRST301') {
      return NextResponse.json({ error: 'Não autenticado.', code: 'UNAUTHORIZED' }, { status: 401 })
    }
    // Detecta erro de criptografia (chave não configurada)
    if (err?.message?.includes('CREDENTIALS_ENCRYPTION_KEY')) {
      return NextResponse.json(
        { error: 'Configuração de segurança ausente no servidor.', code: 'SERVER_CONFIG_ERROR' },
        { status: 500 }
      )
    }
    console.error('[gateway POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.', code: 'INTERNAL' }, { status: 500 })
  }
}

// ─── DELETE /api/v1/ministry/gateway?gateway= ─────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request)
    if (!ctx.ministryId) {
      return NextResponse.json({ error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' }, { status: 403 })
    }

    const isAdmin =
      ctx.isOwner ||
      ctx.nivel === 'administrador'

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Acesso negado. Requer permissão ADMINISTRADOR.', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    const gateway = request.nextUrl.searchParams.get('gateway')
    if (!gateway || !isValidGateway(gateway)) {
      return NextResponse.json(
        { error: `Parâmetro gateway inválido. Valores aceitos: ${VALID_GATEWAYS.join(', ')}`, code: 'INVALID_GATEWAY' },
        { status: 400 }
      )
    }

    const { error } = await ctx.admin
      .from('ministry_payment_gateways')
      .update({
        is_active:             false,
        status:                'not_configured',
        encrypted_credentials: null,
        updated_at:            new Date().toISOString(),
      })
      .eq('ministry_id', ctx.ministryId)
      .eq('gateway', gateway)

    if (error) {
      console.error('[gateway DELETE] error:', error)
      return NextResponse.json({ error: 'Erro ao desativar gateway.', code: 'DB_ERROR' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Gateway ${gateway.toUpperCase()} desativado e credenciais removidas.`,
    })
  } catch (err: any) {
    if (err?.message?.includes('Não autenticado') || err?.code === 'PGRST301') {
      return NextResponse.json({ error: 'Não autenticado.', code: 'UNAUTHORIZED' }, { status: 401 })
    }
    console.error('[gateway DELETE] Unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.', code: 'INTERNAL' }, { status: 500 })
  }
}
