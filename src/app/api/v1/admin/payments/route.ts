/**
 * API ROUTE: Payments Management (Admin + ASAAS Integration)
 * Gerenciar pagamentos de assinatura com integração ASAAS
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { buildMonthlyInstallments, createAsaasPayment, ensureAsaasCustomer } from '@/lib/asaas'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response
    const { supabaseAdmin } = result.ctx
    const searchParams = request.nextUrl.searchParams
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const statusIn = searchParams.get('status_in')
    const ministry_id = searchParams.get('ministry_id')
    const dueFrom = searchParams.get('due_from')
    const dueTo = searchParams.get('due_to')
    const origin = searchParams.get('origin')

    const offset = (page - 1) * limit
    let query = supabaseAdmin
      .from('payments')
      .select(`
        *,
        ministries:ministry_id(name, email_admin),
        subscription_plans:subscription_plan_id(name, slug)
      `, { count: 'exact' })

    if (status) {
      query = query.eq('status', status)
    }

    if (statusIn) {
      const statuses = statusIn.split(',').map((item) => item.trim()).filter(Boolean)
      if (statuses.length > 0) {
        query = query.in('status', statuses)
      }
    }

    if (ministry_id) {
      query = query.eq('ministry_id', ministry_id)
    }

    if (dueFrom) {
      query = query.gte('due_date', dueFrom)
    }

    if (dueTo) {
      query = query.lte('due_date', dueTo)
    }

    if (origin === 'manual') {
      query = query.is('asaas_payment_id', null)
    }

    if (origin === 'asaas') {
      query = query.not('asaas_payment_id', 'is', null)
    }

    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('due_date', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      data,
      count,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase, adminUser } = result.ctx
    const body = await request.json()

    // Verificar permissões
    // (requireAdmin já validou)

    // Validar campos obrigatórios
    if (!body.ministry_id || !body.amount || !body.due_date) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: ministry_id, amount, due_date' },
        { status: 400 }
      )
    }

    // Buscar ministério para dados do pagamento
    const { data: ministry } = await supabase
      .from('ministries')
      .select('*')
      .eq('id', body.ministry_id)
      .single()

    if (!ministry) {
      return NextResponse.json({ error: 'Ministério não encontrado' }, { status: 404 })
    }

    const installments = Math.max(1, parseInt(body.installments || '1'))
    const amount = Number(body.amount)
    if (Number.isNaN(amount)) {
      return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
    }

    const descriptionBase = body.description || `Assinatura - ${ministry.name}`

    if (installments === 1) {
      const cutoff = new Date(Date.now() - 10 * 1000).toISOString()
      const { data: existing } = await supabase
        .from('payments')
        .select('*')
        .eq('ministry_id', body.ministry_id)
        .eq('amount', amount)
        .eq('due_date', body.due_date)
        .eq('payment_method', body.payment_method)
        .eq('description', descriptionBase)
        .eq('status', 'pending')
        .gte('created_at', cutoff)
        .limit(1)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ data: [existing], duplicated: true }, { status: 200 })
      }
    }

    const dueDates = buildMonthlyInstallments(body.due_date, installments)

    const rowsToInsert = dueDates.map((dueDate: string, index: number) => ({
      ministry_id: body.ministry_id,
      subscription_plan_id: body.subscription_plan_id,
      amount,
      description: installments > 1 ? `${descriptionBase} (${index + 1}/${installments})` : descriptionBase,
      due_date: dueDate,
      status: 'pending',
      payment_method: body.payment_method,
      period_start: body.period_start,
      period_end: body.period_end,
    }))

    const { data: payments, error: paymentError } = await supabase
      .from('payments')
      .insert(rowsToInsert)
      .select()

    if (paymentError || !payments) {
      return NextResponse.json({ error: paymentError?.message || 'Erro ao criar pagamentos' }, { status: 400 })
    }

    // Se houver integração ASAAS configurada, criar cobranças lá também
    if (body.create_asaas !== false) {
      const customerId = await ensureAsaasCustomer(supabase, ministry)

      for (const payment of payments) {
        try {
          const asaasPayment = await createAsaasPayment({
            customer: customerId,
            value: payment.amount,
            dueDate: payment.due_date,
            description: payment.description,
            billingType: (payment.payment_method || 'PIX').toUpperCase(),
            externalReference: payment.id,
          })

          await supabase
            .from('payments')
            .update({
              asaas_payment_id: asaasPayment.id,
              asaas_response: asaasPayment,
            })
            .eq('id', payment.id)
        } catch (err) {
          // Mantem pagamento local mesmo se ASAAS falhar
          await supabase
            .from('payments')
            .update({
              asaas_response: { error: (err as Error).message },
            })
            .eq('id', payment.id)
        }
      }
    }

    // Log auditoria
    await logAuditAction(supabase, adminUser.id, 'CREATE_PAYMENT', 'payments', payments[0].id, {})

    return NextResponse.json({ data: payments }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase, adminUser } = result.ctx

    const body = await request.json()
    const paymentId = body?.payment_id

    if (!paymentId) {
      return NextResponse.json({ error: 'payment_id é obrigatório' }, { status: 400 })
    }

    const manualNote = String(body?.manual_note || 'Baixa manual')
    const now = new Date().toISOString()

    const { data: updated, error } = await supabase
      .from('payments')
      .update({
        status: 'paid',
        payment_date: now,
        asaas_response: {
          manual_settlement: true,
          note: manualNote,
          settled_at: now,
        },
        updated_at: now,
      })
      .eq('id', paymentId)
      .select()
      .single()

    if (error || !updated) {
      return NextResponse.json(
        { error: error?.message || 'Falha ao dar baixa manual' },
        { status: 400 }
      )
    }

    await logAuditAction(supabase, adminUser.id, 'MANUAL_PAYMENT_SETTLEMENT', 'payments', updated.id, {
      note: manualNote,
    })

    return NextResponse.json({ data: updated }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function logAuditAction(
  supabase: any,
  adminUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  changes: any
) {
  try {
    await supabase
      .from('admin_audit_logs')
      .insert([{
        admin_user_id: adminUserId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        changes,
        status: 'success',
      }])
  } catch (err) {
    console.error('Erro ao fazer log de auditoria:', err)
  }
}
