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
import { ensureAsaasWebhook } from '@/lib/asaas-webhook-manager'
import { ensureEfiWebhook } from '@/lib/efi-webhook-manager'

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

    const { data, error } = await ctx.admin
      .from('ministry_payment_gateways')
      .select(
        'id, ministry_id, gateway, environment, display_name, is_active, status, encrypted_credentials, webhook_token, webhook_url_hint, last_test_at, last_test_ok, last_error, connection_latency_ms, configured_by, created_at, updated_at, asaas_webhook_status, asaas_webhook_registered_at'
      )
      .eq('ministry_id', ctx.ministryId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[gateway GET] query error:', error)
      return NextResponse.json({ error: 'Erro ao consultar gateways.', code: 'DB_ERROR' }, { status: 500 })
    }

    // Para cada gateway com credenciais, incluir versão mascarada (sem expor o valor criptografado)
    const enriched = (data ?? []).map((row: any) => {
      const has_credentials = !!row.encrypted_credentials
      let masked_credentials: Record<string, string | null> | null = null

      if (has_credentials) {
        try {
          const plain = decryptCredentials(row.encrypted_credentials)
          masked_credentials = maskGatewayCredentials(row.gateway as Gateway, plain)
        } catch {
          masked_credentials = null
        }
      }

      return {
        id:                         row.id,
        gateway:                    row.gateway,
        environment:                row.environment,
        display_name:               row.display_name,
        is_active:                  row.is_active,
        status:                     row.status,
        has_credentials,
        masked_credentials,
        webhook_token:              row.webhook_token,
        webhook_url_hint:           row.webhook_url_hint,
        last_test_at:               row.last_test_at,
        last_test_ok:               row.last_test_ok,
        last_error:                 row.last_error,
        connection_latency_ms:      row.connection_latency_ms,
        asaas_webhook_status:       row.asaas_webhook_status ?? null,
        asaas_webhook_registered_at: row.asaas_webhook_registered_at ?? null,
        created_at:                 row.created_at,
        updated_at:                 row.updated_at,
      }
    })

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
      .select('id, encrypted_credentials, webhook_token')
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

    // Quando novas credenciais ASAAS são fornecidas, resetar status para 'pending'
    if (gateway === 'asaas' && encrypted) {
      upsertPayload.asaas_webhook_status = 'pending'
      upsertPayload.asaas_webhook_id = null
      upsertPayload.asaas_webhook_registered_at = null
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

    // ─── Registro automático de webhook ASAAS ────────────────────────────────
    // Não-bloqueante: erros aqui não afetam a resposta de sucesso do save.
    if (gateway === 'asaas') {
      const hasCredentials = !!(encrypted || existing?.encrypted_credentials)
      if (hasCredentials) {
        try {
          // Buscar webhook_token e credenciais do row salvo (garante valor correto pós-insert)
          const { data: savedRow } = await ctx.admin
            .from('ministry_payment_gateways')
            .select('webhook_token, encrypted_credentials')
            .eq('id', savedId)
            .single()

          if (savedRow?.webhook_token && savedRow?.encrypted_credentials) {
            // Buscar nome do ministério para label legível no painel ASAAS
            const { data: ministry } = await ctx.admin
              .from('ministries')
              .select('name')
              .eq('id', ctx.ministryId)
              .single()

            const creds = decryptCredentials(savedRow.encrypted_credentials)
            const apiKey = creds.api_key

            if (apiKey) {
              const webhookResult = await ensureAsaasWebhook({
                apiKey,
                environment: environment as 'sandbox' | 'production',
                webhookToken: String(savedRow.webhook_token),
                ministryName: ministry?.name ?? 'Ministério',
              })

              // Atualizar status no banco (não falha o request se der erro aqui)
              await ctx.admin
                .from('ministry_payment_gateways')
                .update({
                  asaas_webhook_status:       webhookResult.success ? 'registered' : 'failed',
                  asaas_webhook_id:           webhookResult.webhookId ?? null,
                  asaas_webhook_registered_at: webhookResult.success ? new Date().toISOString() : null,
                })
                .eq('id', savedId)

              if (!webhookResult.success) {
                // Log sem expor apiKey
                console.warn('[gateway POST] Registro de webhook ASAAS falhou (não-bloqueante):', webhookResult.error)
              }
            }
          }
        } catch (webhookErr: unknown) {
          // Qualquer erro no fluxo de webhook é não-bloqueante
          const msg = webhookErr instanceof Error ? webhookErr.message : 'erro desconhecido'
          console.warn('[gateway POST] Fluxo de webhook ASAAS abortou (não-bloqueante):', msg)
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ─── Registro automático de webhook EFI ──────────────────────────────────
    // Não-bloqueante: a pix_key pode ser fornecida depois; erros não bloqueiam o save.
    if (gateway === 'efi') {
      const hasCredentials = !!(encrypted || existing?.encrypted_credentials)
      if (hasCredentials) {
        try {
          const { data: savedRow } = await ctx.admin
            .from('ministry_payment_gateways')
            .select('webhook_token, encrypted_credentials')
            .eq('id', savedId)
            .single()

          if (savedRow?.webhook_token && savedRow?.encrypted_credentials) {
            const { data: ministry } = await ctx.admin
              .from('ministries')
              .select('name')
              .eq('id', ctx.ministryId)
              .single()

            const creds = decryptCredentials(savedRow.encrypted_credentials)

            if (creds.client_id && creds.client_secret && creds.pix_key) {
              const webhookResult = await ensureEfiWebhook({
                credentials:  creds,
                environment,
                webhookToken: String(savedRow.webhook_token),
                ministryName: ministry?.name ?? 'Ministério',
              })

              if (!webhookResult.success) {
                console.warn('[gateway POST] Registro de webhook EFI falhou (não-bloqueante):', webhookResult.error)
              }
            }
          }
        } catch (webhookErr: unknown) {
          const msg = webhookErr instanceof Error ? webhookErr.message : 'erro desconhecido'
          console.warn('[gateway POST] Fluxo de webhook EFI abortou (não-bloqueante):', msg)
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

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
