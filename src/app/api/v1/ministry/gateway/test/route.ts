/**
 * API ROUTE: Teste de Conexão de Gateway de Pagamento
 *
 * POST /api/v1/ministry/gateway/test
 *
 * Testa as credenciais do gateway informado sem criar cobranças, clientes
 * ou qualquer efeito colateral financeiro.
 *
 * Gateways suportados:
 *   - ASAAS: GET /api/v3/myAccount — apenas leitura, sem side effects
 *   - EFI:   placeholder seguro (ainda não implementado para teste real)
 *
 * Segurança:
 *   - Requer permissão ADMINISTRADOR
 *   - Credenciais descriptografadas apenas em memória durante a chamada
 *   - Jamais retorna credenciais ao cliente
 *   - Valida que o gateway pertence ao ministry_id do usuário autenticado
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveTenantAuth } from '@/lib/tenant-auth'
import { decryptCredentials } from '@/lib/ministry-credentials'

type Gateway = 'asaas' | 'efi'
const VALID_GATEWAYS: Gateway[] = ['asaas', 'efi']

const ASAAS_URLS: Record<string, string> = {
  sandbox:    'https://sandbox.asaas.com/api/v3/myAccount',
  production: 'https://www.asaas.com/api/v3/myAccount',
}

// ─── POST /api/v1/ministry/gateway/test ───────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── 1. Autenticação e autorização ────────────────────────────────────────
    const ctx = await resolveTenantAuth(request)

    if (!ctx.ministryId) {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' },
        { status: 403 }
      )
    }

    const isAdmin =
      ctx.isOwner ||
      (Array.isArray(ctx.permissions) && ctx.permissions.includes('ADMINISTRADOR'))

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Acesso negado. Requer permissão ADMINISTRADOR.', code: 'FORBIDDEN' },
        { status: 403 }
      )
    }

    // ── 2. Validar body ───────────────────────────────────────────────────────
    let body: { gateway?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Corpo da requisição inválido.', code: 'BAD_REQUEST' },
        { status: 400 }
      )
    }

    const { gateway } = body
    if (!gateway || !VALID_GATEWAYS.includes(gateway as Gateway)) {
      return NextResponse.json(
        { error: `Gateway inválido. Valores aceitos: ${VALID_GATEWAYS.join(', ')}`, code: 'INVALID_GATEWAY' },
        { status: 400 }
      )
    }

    // ── 3. Buscar registro — verificar ownership pelo ministry_id ─────────────
    const { data: gwRow, error: fetchErr } = await ctx.admin
      .from('ministry_payment_gateways')
      .select('id, environment, encrypted_credentials, status')
      .eq('ministry_id', ctx.ministryId)
      .eq('gateway', gateway)
      .maybeSingle()

    if (fetchErr) {
      console.error('[gateway test] fetch error:', fetchErr)
      return NextResponse.json({ error: 'Erro ao consultar gateway.', code: 'DB_ERROR' }, { status: 500 })
    }

    if (!gwRow) {
      return NextResponse.json(
        { error: 'Gateway não encontrado para este ministério.', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (!gwRow.encrypted_credentials) {
      return NextResponse.json(
        { error: 'Credenciais não configuradas. Configure antes de testar.', code: 'NO_CREDENTIALS' },
        { status: 422 }
      )
    }

    // ── 4. Descriptografar credenciais (apenas em memória) ───────────────────
    let credentials: Record<string, string>
    try {
      credentials = decryptCredentials(gwRow.encrypted_credentials)
    } catch (decryptErr) {
      console.error('[gateway test] decrypt error:', decryptErr)
      return NextResponse.json(
        { error: 'Erro ao descriptografar credenciais. Verifique a chave de criptografia do servidor.', code: 'DECRYPT_ERROR' },
        { status: 500 }
      )
    }

    // ── 5. Executar teste por gateway ─────────────────────────────────────────
    const startedAt = Date.now()
    let testOk = false
    let lastError: string | null = null
    let newStatus: string = gwRow.status ?? 'configured'

    if (gateway === 'asaas') {
      const result = await testAsaas(credentials, gwRow.environment ?? 'sandbox')
      testOk    = result.ok
      lastError = result.error ?? null
      newStatus = result.ok ? 'connected' : 'error'
    } else if (gateway === 'efi') {
      // EFI: placeholder seguro — não marca como "connected" falsamente
      testOk    = false
      lastError = 'Teste de conexão EFI ainda não implementado. As credenciais foram salvas mas não foram verificadas contra a API.'
      newStatus = gwRow.status ?? 'configured' // Não altera o status atual
    }

    const latencyMs = Date.now() - startedAt
    const testedAt  = new Date().toISOString()

    // ── 6. Persistir resultado (sem retornar credenciais) ────────────────────
    const updatePayload: Record<string, unknown> = {
      last_test_at:          testedAt,
      last_test_ok:          testOk,
      connection_latency_ms: latencyMs,
      last_error:            lastError,
      updated_at:            testedAt,
    }

    // Status só é atualizado para ASAAS (EFI preserva o status existente)
    if (gateway === 'asaas') {
      updatePayload.status = newStatus
    }

    const { error: updateErr } = await ctx.admin
      .from('ministry_payment_gateways')
      .update(updatePayload)
      .eq('id', gwRow.id)
      .eq('ministry_id', ctx.ministryId) // double-check ownership

    if (updateErr) {
      console.error('[gateway test] update error:', updateErr)
      // Não falha o request — o teste já foi executado, apenas log
    }

    // ── 7. Responder sem credenciais ─────────────────────────────────────────
    return NextResponse.json({
      ok:          testOk,
      gateway,
      latency_ms:  latencyMs,
      tested_at:   testedAt,
      status:      newStatus,
      message:     testOk
        ? `Conexão com ${gateway.toUpperCase()} estabelecida com sucesso (${latencyMs}ms).`
        : lastError ?? 'Falha na conexão.',
      // Nunca inclui credenciais aqui
    })
  } catch (err: any) {
    if (err?.message?.includes('Não autenticado') || err?.code === 'PGRST301') {
      return NextResponse.json({ error: 'Não autenticado.', code: 'UNAUTHORIZED' }, { status: 401 })
    }
    if (err?.message?.includes('CREDENTIALS_ENCRYPTION_KEY')) {
      return NextResponse.json(
        { error: 'Configuração de segurança ausente no servidor.', code: 'SERVER_CONFIG_ERROR' },
        { status: 500 }
      )
    }
    console.error('[gateway test] Unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.', code: 'INTERNAL' }, { status: 500 })
  }
}

// ─── Teste ASAAS ──────────────────────────────────────────────────────────────

async function testAsaas(
  credentials: Record<string, string>,
  environment: string
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = credentials.api_key
  if (!apiKey) {
    return { ok: false, error: 'API Key ASAAS não encontrada nas credenciais armazenadas.' }
  }

  const url = ASAAS_URLS[environment] ?? ASAAS_URLS.sandbox

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json',
        'User-Agent':   'GestaoEklesia/1.0',
      },
      // Timeout via AbortController — ASAAS deve responder em < 10s
      signal: AbortSignal.timeout(10_000),
    })

    if (response.ok) {
      return { ok: true }
    }

    if (response.status === 401) {
      return { ok: false, error: 'API Key inválida ou sem permissão. Verifique as credenciais no painel ASAAS.' }
    }
    if (response.status === 403) {
      return { ok: false, error: 'Acesso negado pela API ASAAS. Verifique as permissões da chave.' }
    }

    const body = await response.text().catch(() => '')
    return {
      ok:    false,
      error: `ASAAS retornou HTTP ${response.status}${body ? ': ' + body.slice(0, 200) : ''}`,
    }
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      return { ok: false, error: 'Timeout: a API ASAAS não respondeu em 10 segundos. Verifique sua conexão.' }
    }
    return { ok: false, error: `Erro de rede ao conectar ao ASAAS: ${err?.message ?? 'desconhecido'}` }
  }
}
