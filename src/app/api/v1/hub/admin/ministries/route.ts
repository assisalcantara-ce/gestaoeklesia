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
    // CPF: 123.***.***-99
    return `${cleaned.slice(0, 3)}.***.***-${cleaned.slice(-2)}`
  }
  if (cleaned.length === 14) {
    // CNPJ: 12.***.***/0001-99
    return `${cleaned.slice(0, 2)}.***.***/${cleaned.slice(8, 12)}-${cleaned.slice(-2)}`
  }
  return cleaned.length > 4 ? `${cleaned.slice(0, 2)}***${cleaned.slice(-2)}` : '***'
}

/**
 * Sanitiza objeto de ministério removendo qualquer senha, segredo ou dado não corporativo
 */
function sanitizeMinistrySummary(m: any) {
  return {
    id: m.id,
    name: m.name,
    slug: m.slug,
    cnpj_cpf_masked: maskDocument(m.cnpj_cpf),
    email_admin: m.email_admin,
    phone: m.phone,
    whatsapp: m.whatsapp,
    website: m.website,
    logo_url: m.logo_url,
    responsible_name: m.responsible_name,
    address: {
      city: m.address_city,
      state: m.address_state,
    },
    plan: {
      slug: m.plan || 'starter',
      plan_id: m.subscription_plan_id || null,
      name: m.subscription_plans?.name || null,
      price_monthly: m.subscription_plans?.price_monthly ? Number(m.subscription_plans.price_monthly) : null,
    },
    subscription: {
      status: m.subscription_status || 'unknown',
      start_date: m.subscription_start_date || null,
      end_date: m.subscription_end_date || null,
      auto_renew: Boolean(m.auto_renew),
      is_active: Boolean(m.is_active),
    },
    capacity: {
      quantity_temples: m.quantity_temples || 1,
      quantity_members: m.quantity_members || 0,
      max_users: m.max_users || 10,
    },
    invoices_summary: {
      total_invoices: Array.isArray(m.platform_billing_invoices) ? m.platform_billing_invoices.length : 0,
      has_overdue: Array.isArray(m.platform_billing_invoices)
        ? m.platform_billing_invoices.some(
            (inv: any) =>
              inv.status === 'pending' &&
              inv.due_date &&
              inv.due_date < new Date().toISOString().split('T')[0]
          )
        : false,
    },
    created_at: m.created_at,
    updated_at: m.updated_at,
  }
}

export async function GET(request: NextRequest) {
  // 1. Autenticação estrita M2M Administrativa alinhada ao AdminM2MClient do Hub
  const auth = await authenticateAdminM2M(request)
  if (!auth.ok) {
    return auth.response
  }

  const { correlationId, operatorEmail, operatorRole, canonicalPath } = auth.ctx
  const searchParams = request.nextUrl.searchParams

  // 2. Paginação e limites de segurança (clamp min 1, max 100)
  const rawPage = parseInt(searchParams.get('page') || '1', 10)
  const rawLimit = parseInt(searchParams.get('limit') || searchParams.get('per_page') || '10', 10)
  const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage
  const limit = isNaN(rawLimit) || rawLimit < 1 ? 10 : Math.min(rawLimit, 100)
  const offset = (page - 1) * limit

  // Filtros validados contra a query string
  const search = searchParams.get('search')?.trim()
  const status = searchParams.get('status')?.trim()
  const plan = searchParams.get('plan')?.trim()

  try {
    const supabase = createServerClient()

    let query = supabase
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
        responsible_name,
        address_city,
        address_state,
        quantity_temples,
        quantity_members,
        max_users,
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
          price_monthly
        ),
        platform_billing_invoices (
          id,
          status,
          amount,
          due_date
        )
      `,
        { count: 'exact' }
      )

    if (search) {
      query = query.or(`name.ilike.%${search}%,email_admin.ilike.%${search}%,responsible_name.ilike.%${search}%`)
    }

    if (status) {
      query = query.eq('subscription_status', status)
    }

    if (plan) {
      query = query.eq('plan', plan)
    }

    const { data, count, error } = await query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    if (error) {
      await logAdminM2MAudit('LIST_MINISTRIES_DB_ERROR', {
        keyId: auth.ctx.keyId,
        correlationId,
        operatorEmail,
        operatorRole,
        path: canonicalPath,
        statusCode: 500,
        details: { db_error: error.message },
      })

      return NextResponse.json(
        {
          error: 'DATABASE_QUERY_ERROR',
          message: error.message,
          correlation_id: correlationId,
        },
        { status: 500 }
      )
    }

    const items = (data || []).map(sanitizeMinistrySummary)
    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / limit)

    // Auditoria sanitizada persistida e estruturada
    await logAdminM2MAudit('LIST_MINISTRIES', {
      keyId: auth.ctx.keyId,
      correlationId,
      operatorEmail,
      operatorRole,
      path: canonicalPath,
      statusCode: 200,
      details: { count: items.length, total: totalCount, page, limit },
    })

    return NextResponse.json(
      {
        data: items,
        pagination: {
          page,
          limit,
          total: totalCount,
          total_pages: totalPages,
          has_more: page < totalPages,
        },
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Correlation-Id': correlationId,
        },
      }
    )
  } catch (err: any) {
    await logAdminM2MAudit('LIST_MINISTRIES_INTERNAL_ERROR', {
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
        message: err?.message || 'Falha ao consultar listagem de clientes.',
        correlation_id: correlationId,
      },
      { status: 500 }
    )
  }
}
