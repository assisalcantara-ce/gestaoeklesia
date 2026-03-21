/**
 * API ROUTE: Payments Management (Admin + ASAAS Integration)
 * Gerenciar pagamentos de assinatura com integração ASAAS
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

const ASAAS_API_KEY = process.env.ASAAS_API_KEY
const ASAAS_API_URL = 'https://api.asaas.com/v3'

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response
    const { supabaseAdmin } = result.ctx
    const searchParams = request.nextUrl.searchParams
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const ministry_id = searchParams.get('ministry_id')

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

    if (ministry_id) {
      query = query.eq('ministry_id', ministry_id)
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

    // Criar pagamento no Supabase
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert([{
        ministry_id: body.ministry_id,
        subscription_plan_id: body.subscription_plan_id,
        amount: body.amount,
        description: body.description || `Assinatura - ${ministry.name}`,
        due_date: body.due_date,
        status: 'pending',
        payment_method: body.payment_method,
        period_start: body.period_start,
        period_end: body.period_end,
      }])
      .select()
      .single()

    if (paymentError) {
      return NextResponse.json({ error: paymentError.message }, { status: 400 })
    }

    // Se houver integração ASAAS configurada, criar cobro lá também
    if (ASAAS_API_KEY && body.create_asaas !== false) {
      const asaasPayment = await createAsaasPayment(ministry, payment)
      
      if (asaasPayment.success) {
        // Atualizar com ID do ASAAS
        await supabase
          .from('payments')
          .update({
            asaas_payment_id: asaasPayment.id,
            asaas_response: asaasPayment.response,
          })
          .eq('id', payment.id)
      }
    }

    // Log auditoria
    await logAuditAction(supabase, adminUser.id, 'CREATE_PAYMENT', 'payments', payment.id, {})

    return NextResponse.json(payment, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * Criar cobro no ASAAS
 */
async function createAsaasPayment(ministry: any, payment: any) {
  try {
    if (!ASAAS_API_KEY) {
      return { success: false, error: 'ASAAS não configurado' }
    }

    const response = await fetch(`${ASAAS_API_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY,
      },
      body: JSON.stringify({
        customer: ministry.email_admin, // ou customer_id se já tiver
        value: payment.amount,
        dueDate: payment.due_date,
        description: payment.description,
        billingType: payment.payment_method || 'PIX', // PIX, BOLETO, CREDIT_CARD, DEBIT_CARD
        remoteId: payment.id, // ID do pagamento nosso
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Erro ASAAS:', data)
      return { success: false, error: data.errors?.[0]?.detail }
    }

    return {
      success: true,
      id: data.id,
      response: data,
    }
  } catch (err: any) {
    console.error('Erro ao criar pagamento ASAAS:', err)
    return { success: false, error: err.message }
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
