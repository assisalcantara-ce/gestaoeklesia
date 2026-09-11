import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { PlatformBillingReconciliationService } from '@/lib/platform'

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = createServerClient()
  let webhookEventId: string | null = null

  try {
    // 1. Validar autenticidade do webhook por token
    const receivedToken = request.headers.get('asaas-access-token') || request.nextUrl.searchParams.get('token')
    const expectedToken = process.env.PLATFORM_ASAAS_WEBHOOK_TOKEN || process.env.ASAAS_WEBHOOK_TOKEN

    if (!expectedToken || receivedToken !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { event, payment, id: eventIdFromPayload } = body
    const eventId = eventIdFromPayload ? String(eventIdFromPayload) : null

    if (!event || !payment?.id) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const eventName = String(event).toUpperCase()
    const asaasPaymentId = String(payment.id)

    // Map dos eventos suportados
    const statusMap: Record<string, string> = {
      PAYMENT_CONFIRMED: 'paid',
      PAYMENT_RECEIVED: 'paid',
      PAYMENT_OVERDUE: 'overdue',
      PAYMENT_DELETED: 'canceled',
      PAYMENT_CANCELED: 'canceled',
      PAYMENT_REFUNDED: 'refunded',
    }

    const newStatus = statusMap[eventName]

    // Ignorar eventos não gerenciados por esta rota
    if (!newStatus) {
      return NextResponse.json({ skipped: true, reason: `Ignored event: ${eventName}` })
    }

    // 2. Idempotência via asaas_webhook_events
    if (eventId) {
      const { data: existingEvent } = await supabase
        .from('asaas_webhook_events')
        .select('id, process_status')
        .eq('event_id', eventId)
        .maybeSingle()

      if (existingEvent?.id && existingEvent.process_status === 'processed') {
        return NextResponse.json({ received: true, duplicated: true })
      }
    }

    // Registrar o evento como recebido na tabela asaas_webhook_events
    if (eventId) {
      const { data: insertedEvent } = await supabase
        .from('asaas_webhook_events')
        .upsert({
          event_id: eventId,
          asaas_payment_id: asaasPaymentId,
          event_type: eventName,
          payload: body,
          process_status: 'received',
          received_at: new Date().toISOString(),
        }, { onConflict: 'event_id' })
        .select('id')
        .maybeSingle()

      if (insertedEvent?.id) {
        webhookEventId = insertedEvent.id
      }
    }

    // 3. Localizar platform_billing_invoices exclusivamente por asaas_payment_id
    const { data: invoice, error: invoiceError } = await supabase
      .from('platform_billing_invoices')
      .select('*')
      .eq('asaas_payment_id', asaasPaymentId)
      .maybeSingle()

    // Se o pagamento não for uma fatura de platform_billing_invoices (ex: outro módulo ou evento desconhecido),
    // responder HTTP 200 com skipped para JAMAIS bloquear ou penalizar a fila do Asaas.
    if (invoiceError || !invoice) {
      if (webhookEventId) {
        await supabase
          .from('asaas_webhook_events')
          .update({
            process_status: 'skipped',
            process_error: 'Payment not found in platform_billing_invoices',
            processed_at: new Date().toISOString(),
          })
          .eq('id', webhookEventId)
      }
      return NextResponse.json({
        received: true,
        skipped: true,
        reason: 'payment_not_found',
        asaas_payment_id: asaasPaymentId,
      })
    }

    // 4. Processar o pagamento através do serviço oficial unificado de reconciliação/baixa
    const result = await PlatformBillingReconciliationService.processInvoicePayment({
      supabaseAdmin: supabase,
      invoice,
      asaasPayment: payment,
      eventId,
      origin: 'webhook',
    })

    // 5. Atualizar status do webhook_event para 'processed'
    if (webhookEventId) {
      await supabase
        .from('asaas_webhook_events')
        .update({
          process_status: 'processed',
          process_error: null,
          processed_at: new Date().toISOString(),
        })
        .eq('id', webhookEventId)
    }

    return NextResponse.json({
      received: true,
      success: result.success,
      status: result.status,
      already_synced: result.alreadySynced || false,
    })
  } catch (err: any) {
    if (webhookEventId) {
      try {
        await supabase
          .from('asaas_webhook_events')
          .update({
            process_status: 'error',
            process_error: err.message || 'Internal Server Error',
            processed_at: new Date().toISOString(),
          })
          .eq('id', webhookEventId)
      } catch {
        // Ignora falha de gravação de erro no webhook_events em exceção fatal
      }
    }
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}

