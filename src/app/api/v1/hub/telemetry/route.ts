import { NextRequest, NextResponse } from 'next/server'
import { verifyM2MSignature } from '@/lib/hub-m2m-security'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// Cache em memória de nonces recentes para garantia de anti-replay estrito dentro da janela de 5 minutos
const seenNonces = new Map<string, number>()
const NONCE_TTL_MS = 300 * 1000 // 5 minutos

function isNonceReplayed(nonce: string): boolean {
  const now = Date.now()
  // Limpeza de nonces expirados
  for (const [key, timestamp] of seenNonces.entries()) {
    if (now - timestamp > NONCE_TTL_MS) {
      seenNonces.delete(key)
    }
  }

  if (seenNonces.has(nonce)) {
    return true
  }

  seenNonces.set(nonce, now)
  return false
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  // 1. Extração dos headers M2M
  const keyId = request.headers.get('x-hub-key-id') || request.headers.get('X-Hub-Key-Id')
  const timestamp = request.headers.get('x-hub-timestamp') || request.headers.get('X-Hub-Timestamp')
  const nonce = request.headers.get('x-hub-nonce') || request.headers.get('X-Hub-Nonce')
  const signature = request.headers.get('x-hub-signature') || request.headers.get('X-Hub-Signature')

  if (!keyId || !timestamp || !nonce || !signature) {
    return NextResponse.json(
      {
        error: 'UNAUTHORIZED_M2M_HEADERS_MISSING',
        message: 'Headers obrigatórios de autenticação M2M ausentes (X-Hub-Key-Id, X-Hub-Timestamp, X-Hub-Nonce, X-Hub-Signature).',
      },
      { status: 401 }
    )
  }

  // 2. Chaves autorizadas configuradas no ambiente
  const expectedKeyId = process.env.HUB_M2M_KEY_ID || process.env.ALCANTARA_HUB_KEY_ID || 'hub_key_eklesia_v1'
  const expectedSecretKey = process.env.HUB_M2M_SECRET_KEY || process.env.ALCANTARA_HUB_SECRET_KEY

  if (!expectedSecretKey) {
    return NextResponse.json(
      {
        error: 'CONNECTOR_UNCONFIGURED',
        message: 'Chave secreta M2M (HUB_M2M_SECRET_KEY) não configurada no servidor.',
      },
      { status: 500 }
    )
  }

  if (keyId !== expectedKeyId) {
    return NextResponse.json(
      {
        error: 'INVALID_KEY_ID',
        message: 'Key-Id M2M desconhecido ou não autorizado.',
      },
      { status: 401 }
    )
  }

  // 3. Verificação de replay attack por Nonce
  if (isNonceReplayed(nonce)) {
    return NextResponse.json(
      {
        error: 'REPLAY_ATTACK_DETECTED',
        message: 'Nonce já utilizado recentemente. Requisição rejeitada.',
      },
      { status: 401 }
    )
  }

  // 4. Validação da Assinatura HMAC-SHA256
  // Path inclui pathname e search (ex: '/api/v1/hub/telemetry?reference_date=2026-10-31')
  const path = request.nextUrl.pathname + request.nextUrl.search

  const verification = verifyM2MSignature(
    keyId,
    expectedSecretKey,
    'GET',
    path,
    signature,
    timestamp,
    nonce,
    300 // Janela de 5 minutos
  )

  if (!verification.valid) {
    return NextResponse.json(
      {
        error: 'INVALID_SIGNATURE',
        reason: verification.reason,
        message: 'Assinatura HMAC-SHA256 inválida ou expirada.',
      },
      { status: 401 }
    )
  }

  // 5. Parâmetro de data de referência (YYYY-MM-DD)
  const searchParams = request.nextUrl.searchParams
  const referenceDate = searchParams.get('reference_date') || new Date().toISOString().split('T')[0]

  try {
    const supabase = createServerClient()

    // 6. Consultas às fontes reais corporativas
    // Ministries e seus planos contratados
    const [ministriesRes, plansRes, invoicesRes, membersCountRes, congregacoesCountRes] = await Promise.all([
      supabase
        .from('ministries')
        .select('id, name, is_active, plan, subscription_plan_id, subscription_status, subscription_start_date, subscription_end_date, created_at'),
      supabase
        .from('subscription_plans')
        .select('id, slug, name, price_monthly'),
      supabase
        .from('platform_billing_invoices')
        .select('id, ministry_id, subscription_plan_id, plano_slug, status, amount, due_date, paid_at, created_at'),
      supabase
        .from('members')
        .select('ministry_id'),
      supabase
        .from('congregacoes')
        .select('ministry_id'),
    ])

    if (ministriesRes.error) {
      throw new Error(`Erro ao consultar ministries: ${ministriesRes.error.message}`)
    }

    const ministries = ministriesRes.data || []
    const plans = plansRes.data || []
    const invoices = invoicesRes.data || []
    const membersData = membersCountRes.data || []
    const congregacoesData = congregacoesCountRes.data || []

    // Mapeamento de planos para cálculo de MRR contratado
    const planPriceMap = new Map<string, number>()
    for (const p of plans) {
      if (p.id) planPriceMap.set(p.id, Number(p.price_monthly) || 0)
      if (p.slug) planPriceMap.set(p.slug.toLowerCase(), Number(p.price_monthly) || 0)
    }

    // Contadores de membros e congregações por ministry_id (exclusivamente quantitativos agregados)
    const membersByMinistry = new Map<string, number>()
    for (const m of membersData) {
      if (m.ministry_id) {
        membersByMinistry.set(m.ministry_id, (membersByMinistry.get(m.ministry_id) || 0) + 1)
      }
    }

    const congregacoesByMinistry = new Map<string, number>()
    for (const c of congregacoesData) {
      if (c.ministry_id) {
        congregacoesByMinistry.set(c.ministry_id, (congregacoesByMinistry.get(c.ministry_id) || 0) + 1)
      }
    }

    // Faturas da plataforma agrupadas por ministry_id
    interface MinistryFinancialAgg {
      billedPeriod: number
      receivedPeriod: number
      overdueBalance: number
    }
    const financialByMinistry = new Map<string, MinistryFinancialAgg>()

    // Determina início e fim do mês da reference_date
    const refYearMonth = referenceDate.slice(0, 7) // 'YYYY-MM'
    const todayStr = new Date().toISOString().split('T')[0]

    for (const inv of invoices) {
      const minId = inv.ministry_id
      if (!minId) continue

      if (!financialByMinistry.has(minId)) {
        financialByMinistry.set(minId, {
          billedPeriod: 0,
          receivedPeriod: 0,
          overdueBalance: 0,
        })
      }

      const agg = financialByMinistry.get(minId)!
      const amount = Number(inv.amount) || 0
      const invMonth = (inv.due_date || inv.created_at || '').slice(0, 7)
      const isPeriodMatch = invMonth === refYearMonth

      if (isPeriodMatch) {
        agg.billedPeriod += amount
        if (inv.status === 'paid') {
          agg.receivedPeriod += amount
        }
      }

      // Inadimplência acumulada: faturas pendentes cujo vencimento seja anterior à data atual
      if (inv.status === 'pending' && inv.due_date && inv.due_date < todayStr) {
        agg.overdueBalance += amount
      }
    }

    // 7. Construção do array de tenants (exclusivamente métricas corporativas, zero PII, zero dízimos)
    const tenantsData = ministries.map((m) => {
      // Cálculo do MRR contratado do tenant: valor mensal do plano se a assinatura estiver ativa
      const planPriceById = m.subscription_plan_id ? planPriceMap.get(m.subscription_plan_id) : undefined
      const planPriceBySlug = m.plan ? planPriceMap.get(String(m.plan).toLowerCase()) : undefined
      const resolvedPlanPrice = planPriceById ?? planPriceBySlug ?? 0
      const isSubscriptionActive = m.is_active && m.subscription_status === 'active'
      const mrrCurrent = isSubscriptionActive ? resolvedPlanPrice : 0

      const fin = financialByMinistry.get(m.id) || {
        billedPeriod: 0,
        receivedPeriod: 0,
        overdueBalance: 0,
      }

      return {
        external_tenant_id: m.id,
        financial: {
          mrr_current: Number(mrrCurrent.toFixed(2)),
          billed_period: Number(fin.billedPeriod.toFixed(2)),
          received_period: Number(fin.receivedPeriod.toFixed(2)),
          overdue_balance: Number(fin.overdueBalance.toFixed(2)),
        },
        usage_aggregated: {
          active_members_count: membersByMinistry.get(m.id) || 0,
          congregations_count: congregacoesByMinistry.get(m.id) || 0,
          subscription_status: m.subscription_status || 'unknown',
          plan_slug: m.plan || 'unknown',
          is_active: Boolean(m.is_active),
        },
        ai_telemetry: null, // Gestão Eklésia atualmente não consome tokens LLM faturáveis por tenant
      }
    })

    // 8. Resposta no contrato homologado M2M do Alcântara Hub
    const payload = {
      product_slug: 'gestaoeklesia',
      reference_date: referenceDate,
      generated_at: new Date().toISOString(),
      system_status: {
        health: 'operational',
        version: process.env.npm_package_version || '2.4.0',
        uptime_pct_last_30d: null, // Métrica não monitorada por APM externo no Gestão Eklésia (usar null ao invés de fixo)
        database_connected: true,
        latency_ms: Date.now() - startTime,
      },
      summary: {
        total_tenants_count: ministries.length,
        active_tenants_count: ministries.filter((m) => m.is_active && m.subscription_status === 'active').length,
        trial_tenants_count: ministries.filter((m) => m.subscription_status === 'trial').length,
        total_mrr: Number(
          tenantsData.reduce((acc, t) => acc + t.financial.mrr_current, 0).toFixed(2)
        ),
        total_overdue: Number(
          tenantsData.reduce((acc, t) => acc + t.financial.overdue_balance, 0).toFixed(2)
        ),
      },
      tenants_data: tenantsData,
    }

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (err: any) {
    console.error('[HUB_TELEMETRY] Erro interno:', err)
    return NextResponse.json(
      {
        error: 'INTERNAL_TELEMETRY_ERROR',
        message: err?.message || 'Falha ao consolidar telemetria corporativa.',
      },
      { status: 500 }
    )
  }
}
