/**
 * asaas-webhook-manager.ts
 *
 * Registro automático de webhooks na conta ASAAS do ministério via API Key do cliente.
 *
 * Fluxo:
 *   1. GET /v3/webhooks → verifica se já existe webhook com a URL do ministério
 *   2a. Existe → PUT /v3/webhooks/{id} (atualiza eventos/URL)
 *   2b. Não existe → POST /v3/webhooks (cria novo)
 *
 * Segurança:
 *   ⚠️  SERVER-SIDE ONLY — nunca importe em componentes 'use client'.
 *   ⚠️  apiKey é a chave do CLIENTE — NUNCA logar o valor.
 *   ⚠️  authToken reusa o webhook_token UUID (36 chars ≥ mínimo de 32 exigido pelo ASAAS).
 *       O ASAAS envia esse token no header `asaas-access-token` a cada callback,
 *       e o handler de webhook já valida esse header.
 */

// URLs base por ambiente
const ASAAS_BASE: Record<'sandbox' | 'production', string> = {
  sandbox:    'https://api-sandbox.asaas.com/v3',
  production: 'https://api.asaas.com/v3',
}

// Eventos financeiros relevantes para o Gestão Eklésia
const WEBHOOK_EVENTS = [
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE',
  'PAYMENT_REFUNDED',
  'PAYMENT_DELETED',
  'PAYMENT_UPDATED',
] as const

export interface EnsureWebhookParams {
  /** API Key do ministério (cliente ASAAS). Nunca logar. */
  apiKey:       string
  environment:  'sandbox' | 'production'
  /** UUID armazenado em ministry_payment_gateways.webhook_token */
  webhookToken: string
  /** Nome do ministério para label legível no painel ASAAS */
  ministryName: string
}

export interface EnsureWebhookResult {
  success:   boolean
  webhookId: string | null
  error:     string | null
}

/**
 * Garante que o webhook esteja registrado/atualizado na conta ASAAS do ministério.
 * Idempotente: verifica duplicidade antes de criar.
 * Retorna sempre — nunca lança exceção.
 */
export async function ensureAsaasWebhook(
  params: EnsureWebhookParams
): Promise<EnsureWebhookResult> {
  const { apiKey, environment, webhookToken, ministryName } = params

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    return {
      success: false,
      webhookId: null,
      error: 'NEXT_PUBLIC_APP_URL não configurada — impossível determinar URL de webhook.',
    }
  }

  const webhookUrl = `${appUrl}/api/v1/ministry-webhook/asaas/${webhookToken}`
  const baseUrl    = ASAAS_BASE[environment]

  // Headers usados em todas as chamadas. apiKey nunca é logada além desse header.
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'access_token': apiKey,
    'User-Agent':   'GestaoEklesia/1.0',
  }

  // ─── 1. Listar webhooks existentes ──────────────────────────────────────────
  let existingId: string | null = null
  try {
    const listRes = await fetch(`${baseUrl}/webhooks?limit=100`, {
      method: 'GET',
      headers,
    })

    if (!listRes.ok) {
      const errData = await listRes.json().catch(() => ({})) as Record<string, any>
      const errMsg =
        errData?.errors?.[0]?.description ||
        errData?.errors?.[0]?.detail ||
        errData?.message ||
        `HTTP ${listRes.status}`
      return { success: false, webhookId: null, error: `Erro ao listar webhooks ASAAS: ${errMsg}` }
    }

    const listData = await listRes.json() as { data?: Array<{ id: string; url: string }> }
    const found = (listData.data ?? []).find(wh => wh.url === webhookUrl)
    if (found) existingId = found.id
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'timeout'
    return { success: false, webhookId: null, error: `Rede ao listar webhooks: ${msg}` }
  }

  // ─── 2. Criar ou atualizar ───────────────────────────────────────────────────
  let syncedId: string | null = existingId

  try {
    let res: Response

    if (existingId) {
      // PUT — atualiza o webhook existente (mantém mesmo ID)
      res = await fetch(`${baseUrl}/webhooks/${existingId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name:      `Gestão Eklésia — ${ministryName}`,
          url:       webhookUrl,
          sendType:  'NON_SEQUENTIALLY',
          enabled:   true,
          interrupted: false,
          authToken: webhookToken,
          events:    WEBHOOK_EVENTS,
        }),
      })
    } else {
      // POST — cria novo webhook
      res = await fetch(`${baseUrl}/webhooks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name:        `Gestão Eklésia — ${ministryName}`,
          url:         webhookUrl,
          email:       'notificacoes@gestaoeklesia.com.br',
          enabled:     true,
          interrupted: false,
          apiVersion:  3,
          authToken:   webhookToken,
          sendType:    'NON_SEQUENTIALLY',
          events:      WEBHOOK_EVENTS,
        }),
      })
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({})) as Record<string, any>
      const errMsg =
        errData?.errors?.[0]?.description ||
        errData?.errors?.[0]?.detail ||
        errData?.message ||
        `HTTP ${res.status}`
      return { success: false, webhookId: null, error: errMsg }
    }

    const data = await res.json() as { id?: string }
    syncedId = data.id ?? syncedId

    return { success: true, webhookId: syncedId, error: null }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'timeout'
    return { success: false, webhookId: null, error: `Rede ao registrar webhook: ${msg}` }
  }
}
