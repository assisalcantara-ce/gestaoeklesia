import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

type GatewaySettingsResponse = {
  provider: 'asaas'
  apiUrl: string
  hasApiKey: boolean
  hasWebhookToken: boolean
  apiKeyMasked: string | null
  webhookTokenMasked: string | null
}

function maskSecret(value?: string | null) {
  if (!value) return null
  const normalized = String(value)
  if (normalized.length <= 8) return '********'
  return `${normalized.slice(0, 4)}********${normalized.slice(-4)}`
}

function normalizeApiKey(value?: string | null) {
  if (!value) return ''
  return String(value).replace(/^\\/, '').trim()
}

export async function GET(request: NextRequest) {
  const result = await requireAdmin(request, { requiredRole: 'admin' })
  if (!result.ok) return result.response

  const rawApiKey = normalizeApiKey(process.env.ASAAS_API_KEY)
  const rawWebhookToken = (process.env.ASAAS_WEBHOOK_TOKEN || '').trim()

  const payload: GatewaySettingsResponse = {
    provider: 'asaas',
    apiUrl: process.env.ASAAS_API_URL || 'https://api.asaas.com/v3',
    hasApiKey: rawApiKey.length > 0,
    hasWebhookToken: rawWebhookToken.length > 0,
    apiKeyMasked: maskSecret(rawApiKey),
    webhookTokenMasked: maskSecret(rawWebhookToken),
  }

  return NextResponse.json(payload)
}

export async function POST(request: NextRequest) {
  const result = await requireAdmin(request, { requiredRole: 'admin' })
  if (!result.ok) return result.response

  try {
    const body = await request.json()
    const apiUrl = String(body?.apiUrl || process.env.ASAAS_API_URL || 'https://api.asaas.com/v3').trim().replace(/\/$/, '')
    const apiKey = normalizeApiKey(body?.apiKey || process.env.ASAAS_API_KEY)

    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'ASAAS_API_KEY não configurada.' }, { status: 400 })
    }

    const response = await fetch(`${apiUrl}/payments?limit=1&offset=0`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        access_token: apiKey,
      },
      cache: 'no-store',
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: payload?.errors?.[0]?.description || payload?.errors?.[0]?.detail || payload?.message || 'Falha ao conectar no ASAAS.',
          status: response.status,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: 'Conexão com ASAAS validada com sucesso.',
      status: response.status,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Erro inesperado ao testar conexão.' }, { status: 500 })
  }
}
