import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdminM2M, logAdminM2MAudit } from '@/lib/hub-m2m-admin-guard'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

/**
 * Mascara documento CPF ou CNPJ mantendo apenas início e fim para conferência corporativa segura
 */
function maskDocument(doc?: string | null): string | null {
  if (!doc) return null
  const cleaned = doc.replace(/\D/g, '')
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}.***.***-${cleaned.slice(-2)}`
  }
  if (cleaned.length === 14) {
    return `${cleaned.slice(0, 2)}.***.***/${cleaned.slice(8, 12)}-${cleaned.slice(-2)}`
  }
  return cleaned.length > 4 ? `${cleaned.slice(0, 2)}***${cleaned.slice(-2)}` : '***'
}

/**
 * Sanitiza URL de cobrança Asaas removendo tokens ou parâmetros sensíveis de query
 */
function sanitizeInvoiceUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null
  try {
    const parsed = new URL(rawUrl)
    // Mantém apenas o host e pathname de visualização do boleto/fatura (ex: https://asaas.com/i/123456)
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // 1. Autenticação estrita M2M Administrativa alinhada ao AdminM2MClient do Hub
  const auth = await authenticateAdminM2M(request)
  if (!auth.ok) {
    return auth.response
  }

  const { correlationId, operatorEmail, operatorRole, canonicalPath } = auth.ctx
  const { id } = await context.params

  if (!id) {
    await logAdminM2MAudit('GET_CLIENT_DETAILS_MISSING_ID', {
      keyId: auth.ctx.keyId,
      correlationId,
      operatorEmail,
      operatorRole,
      path: canonicalPath,
      statusCode: 400,
    })

    return NextResponse.json(
      {
        error: 'MISSING_CLIENT_ID',
        message: 'O parâmetro ID do cliente é obrigatório.',
        correlation_id: correlationId,
      },
      { status: 400 }
    )
  }

  try {
    const supabase = createServerClient()

    // 2. Consulta paralela às informações corporativas do tenant
    const [ministryRes, invoicesRes, contractRes] = await Promise.all([
      supabase
        .from('ministries')
        .select(
          `
          id,
          name,
          slug,
          cnpj_cpf,
          email_admin,
          phone,
          whatsapp,
          website,
          logo_url,
          description,
          responsible_name,
          address_city,
          address_state,
          quantity_temples,
          quantity_members,
          max_users,
          max_storage_bytes,
          timezone,
          plan,
          subscription_plan_id,
          subscription_status,
          subscription_start_date,
          subscription_end_date,
          auto_renew,
          is_active,
          created_at,
          updated_at,
          subscription_plans:subscription_plan_id (
            id,
            name,
            slug,
            price_monthly,
            max_members
          )
        `
        )
        .eq('id', id)
        .single(),

      supabase
        .from('platform_billing_invoices')
        .select(
          `
          id,
          status,
          amount,
          due_date,
          paid_at,
          payment_method,
          asaas_invoice_url,
          created_at
        `
        )
        .eq('ministry_id', id)
        .order('due_date', { ascending: false })
        .limit(24),

      supabase
        .from('juridico_contratos')
        .select('id, numero_contrato, status, assinado_em, vigencia_fim, created_at')
        .eq('ministry_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (ministryRes.error || !ministryRes.data) {
      await logAdminM2MAudit('GET_CLIENT_DETAILS_NOT_FOUND', {
        keyId: auth.ctx.keyId,
        correlationId,
        operatorEmail,
        operatorRole,
        path: canonicalPath,
        statusCode: 404,
        details: { requested_id: id },
      })

      return NextResponse.json(
        {
          error: 'CLIENT_NOT_FOUND',
          message: 'Igreja / Ministério não localizado no sistema.',
          correlation_id: correlationId,
        },
        { status: 404 }
      )
    }

    const m: any = ministryRes.data
    const invoices: any[] = invoicesRes.data || []
    const contract: any = contractRes.data || null

    const todayStr = new Date().toISOString().split('T')[0]

    // Consolidação financeira segura
    let totalPaid = 0
    let totalPending = 0
    let totalOverdue = 0
    let overdueCount = 0

    for (const inv of invoices) {
      const amount = Number(inv.amount) || 0
      if (inv.status === 'paid') {
        totalPaid += amount
      } else if (inv.status === 'pending') {
        if (inv.due_date && inv.due_date < todayStr) {
          totalOverdue += amount
          overdueCount++
        } else {
          totalPending += amount
        }
      }
    }

    const isTrial = m.subscription_status === 'trial'
    let trialDaysRemaining: number | null = null
    if (isTrial && m.subscription_end_date) {
      const endMs = new Date(m.subscription_end_date).getTime()
      const diffMs = endMs - Date.now()
      trialDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
    }

    const responsePayload = {
      client: {
        id: m.id,
        name: m.name,
        slug: m.slug,
        cnpj_cpf_masked: maskDocument(m.cnpj_cpf),
        email_admin: m.email_admin,
        phone: m.phone,
        whatsapp: m.whatsapp,
        website: m.website,
        logo_url: m.logo_url,
        description: m.description,
        responsible_name: m.responsible_name,
        address: {
          city: m.address_city,
          state: m.address_state,
        },
        capacity: {
          quantity_temples: m.quantity_temples || 1,
          quantity_members: m.quantity_members || 0,
          max_users: m.max_users || 10,
          max_storage_bytes: m.max_storage_bytes || 5368709120,
          timezone: m.timezone || 'America/Sao_Paulo',
        },
        created_at: m.created_at,
        updated_at: m.updated_at,
      },
      plan: {
        slug: m.plan || 'starter',
        plan_id: m.subscription_plan_id || null,
        name: m.subscription_plans?.name || null,
        price_monthly: m.subscription_plans?.price_monthly
          ? Number(m.subscription_plans.price_monthly)
          : null,
        limits: {
          max_members: m.subscription_plans?.max_members ?? null,
          max_temples: m.quantity_temples ?? null,
        },
      },
      subscription: {
        status: m.subscription_status || 'unknown',
        is_active: Boolean(m.is_active),
        start_date: m.subscription_start_date || null,
        end_date: m.subscription_end_date || null,
        auto_renew: Boolean(m.auto_renew),
        is_trial: isTrial,
        trial_days_remaining: trialDaysRemaining,
      },
      financial_overview: {
        status: overdueCount > 0 ? 'delinquent' : 'up_to_date',
        total_paid: Number(totalPaid.toFixed(2)),
        total_pending: Number(totalPending.toFixed(2)),
        total_overdue: Number(totalOverdue.toFixed(2)),
        overdue_invoices_count: overdueCount,
        recent_invoices: invoices.map((inv) => ({
          id: inv.id,
          amount: Number(inv.amount) || 0,
          status: inv.status,
          due_date: inv.due_date,
          paid_at: inv.paid_at,
          payment_method: inv.payment_method,
          invoice_url: sanitizeInvoiceUrl(inv.asaas_invoice_url),
        })),
      },
      contract: contract
        ? {
            id: contract.id,
            contract_number: contract.numero_contrato,
            status: contract.status,
            signed_at: contract.assinado_em,
            expires_at: contract.vigencia_fim,
          }
        : null,
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
    }

    // Auditoria sanitizada persistida e estruturada
    await logAdminM2MAudit('GET_CLIENT_DETAILS', {
      keyId: auth.ctx.keyId,
      correlationId,
      operatorEmail,
      operatorRole,
      path: canonicalPath,
      statusCode: 200,
      details: { client_id: id, client_name: m.name },
    })

    return NextResponse.json(responsePayload, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Correlation-Id': correlationId,
      },
    })
  } catch (err: any) {
    await logAdminM2MAudit('GET_CLIENT_DETAILS_INTERNAL_ERROR', {
      keyId: auth.ctx.keyId,
      correlationId,
      operatorEmail,
      operatorRole,
      path: canonicalPath,
      statusCode: 500,
      details: { error: err?.message || String(err) },
    })

    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: err?.message || 'Falha ao buscar detalhes corporativos do cliente.',
        correlation_id: correlationId,
      },
      { status: 500 }
    )
  }
}
