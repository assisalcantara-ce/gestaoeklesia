import { NextRequest, NextResponse } from 'next/server'
import { getAsaasPayment } from '@/lib/asaas'
import { authTenantErrorResponse, getErrorMessage } from '@/lib/api-errors'
import { resolveTenantAuth } from '@/lib/tenant-auth'

export async function listTenantPayments(request: NextRequest) {
  try {
    const { supabase, ministryId } = await resolveTenantAuth(request)

    const { data: payments, error } = await supabase
      .from('payments')
      .select('*')
      .eq('ministry_id', ministryId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Payments API] Erro ao buscar pagamentos:', error)
      return NextResponse.json(
        { error: 'Failed to fetch payments', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ payments: payments || [] })
  } catch (error) {
    const authResponse = authTenantErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[Payments API] Erro geral:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: getErrorMessage(error) },
      { status: 500 }
    )
  }
}

export async function getTenantPaymentBoleto(request: NextRequest) {
  try {
    const { supabase, ministryId } = await resolveTenantAuth(request)
    const paymentId = request.nextUrl.searchParams.get('id')

    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID required' }, { status: 400 })
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, asaas_payment_id, amount, due_date, description, payment_method, status')
      .eq('id', paymentId)
      .eq('ministry_id', ministryId)
      .maybeSingle()

    if (paymentError || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    const asaasPaymentId = (payment as any).asaas_payment_id

    if (!asaasPaymentId) {
      return NextResponse.json({
        invoiceUrl: null,
        bankSlipUrl: null,
        payment: {
          id: (payment as any).id,
          amount: (payment as any).amount,
          due_date: (payment as any).due_date,
          description: (payment as any).description,
          payment_method: (payment as any).payment_method,
          status: (payment as any).status,
        },
      })
    }

    const asaasData = await getAsaasPayment(asaasPaymentId)

    return NextResponse.json({
      invoiceUrl: asaasData.invoiceUrl ?? null,
      bankSlipUrl: asaasData.bankSlipUrl ?? null,
      pixQrCodeUrl: asaasData.pixQrCodeUrl ?? null,
      payment: {
        id: (payment as any).id,
        amount: (payment as any).amount,
        due_date: (payment as any).due_date,
        description: (payment as any).description,
        payment_method: (payment as any).payment_method,
        status: (payment as any).status,
      },
    })
  } catch (error) {
    const authResponse = authTenantErrorResponse(error)
    if (authResponse) return authResponse
    console.error('[payments-boleto] Erro geral:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: getErrorMessage(error) },
      { status: 500 }
    )
  }
}
