import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { SubscriptionService } from '@/lib/platform'

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

    if (invoiceError || !invoice) {
      if (webhookEventId) {
        await supabase
          .from('asaas_webhook_events')
          .update({
            process_status: 'error',
            process_error: 'Invoice not found for asaas_payment_id',
            processed_at: new Date().toISOString(),
          })
          .eq('id', webhookEventId)
      }
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Se já estiver no status final idêntico, finalizar sem reprocessar
    if (invoice.status === newStatus) {
      if (webhookEventId) {
        await supabase
          .from('asaas_webhook_events')
          .update({
            process_status: 'processed',
            processed_at: new Date().toISOString(),
          })
          .eq('id', webhookEventId)
      }
      return NextResponse.json({ skipped: true, message: `Invoice already in status ${newStatus}` })
    }

    // 4. Montar o payload de atualização garantindo isolamento por ministry_id
    const nowIso = new Date().toISOString()
    const updateData: Record<string, any> = {
      status: newStatus,
      updated_at: nowIso,
    }

    if (newStatus === 'paid') {
      updateData.paid_at = nowIso
    }

    let updateErrorObj = null
    try {
      const { error } = await supabase
        .from('platform_billing_invoices')
        .update(updateData as any)
        .eq('id', invoice.id)
        .eq('ministry_id', invoice.ministry_id)

      if (error) {
        // Fallback: se a coluna paid_at ainda não tiver sido adicionada via migration, tenta sem paid_at
        if (error.message?.includes('paid_at') || error.code === '42703') {
          delete updateData.paid_at
          const { error: fallbackError } = await supabase
            .from('platform_billing_invoices')
            .update(updateData)
            .eq('id', invoice.id)
            .eq('ministry_id', invoice.ministry_id)
          updateErrorObj = fallbackError
        } else {
          updateErrorObj = error
        }
      }
    } catch (e: any) {
      updateErrorObj = e
    }

    if (updateErrorObj) {
      if (webhookEventId) {
        await supabase
          .from('asaas_webhook_events')
          .update({
            process_status: 'error',
            process_error: updateErrorObj.message,
            processed_at: new Date().toISOString(),
          })
          .eq('id', webhookEventId)
      }
      return NextResponse.json({ error: `Erro ao atualizar fatura: ${updateErrorObj.message}` }, { status: 400 })
    }

    // 5. Se o pagamento foi confirmado/recebido, acionar ativacao de assinatura
    if (newStatus === 'paid') {
      const subscriptionService = new SubscriptionService()
      const activationResult = await subscriptionService.activateSubscription(
        supabase,
        invoice.ministry_id,
        invoice.plano_slug,
        12 // Vigência padrão de 12 meses
      )

      if (!activationResult || !activationResult.success) {
        if (webhookEventId) {
          await supabase
            .from('asaas_webhook_events')
            .update({
              process_status: 'error',
              process_error: 'Erro ao processar ativação de assinatura via domínio',
              processed_at: new Date().toISOString(),
            })
            .eq('id', webhookEventId)
        }
        return NextResponse.json({ error: 'Erro ao processar ativação de assinatura via domínio no webhook' }, { status: 400 })
      }

      // Atualizar oportunidade comercial para "Convertido" se aplicável
      try {
        const { data: opt } = await supabase
          .from('oportunidades_comerciais')
          .select('id, status')
          .eq('ministry_id', invoice.ministry_id)
          .maybeSingle()

        if (opt && opt.status !== 'Convertido') {
          const statusAnterior = opt.status || 'Novo'
          const obs = 'Conversão comercial concluída automaticamente após confirmação do pagamento ASAAS.'
          
          await supabase
            .from('oportunidades_comerciais')
            .update({
              status: 'Convertido',
              observacao_interna: obs,
              updated_at: new Date().toISOString(),
              updated_by: 'Asaas Webhook'
            })
            .eq('id', opt.id)

          await supabase
            .from('oportunidades_comerciais_historico')
            .insert([{
              oportunidade_id: opt.id,
              status_anterior: statusAnterior,
              status_novo: 'Convertido',
              usuario: 'Asaas Webhook',
              observacao: obs,
              created_at: new Date().toISOString()
            }])
        }
      } catch (err) {
        console.warn('Erro ao atualizar oportunidade/ticket no webhook Asaas:', err)
      }
    }

    // 6. Atualizar status do webhook_event para 'processed'
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

    // 7. Auditoria em admin_audit_logs se a tabela existir
    try {
      await supabase
        .from('admin_audit_logs')
        .insert([{
          action: `payment_${newStatus}_webhook`,
          entity_type: 'platform_billing_invoices',
          entity_id: invoice.id,
          changes: {
            status: newStatus,
            payment_id: asaasPaymentId,
            ministry_id: invoice.ministry_id,
          },
          status: 'success',
        }])
    } catch {
      // Ignora silenciosamente se a tabela não existir
    }

    return NextResponse.json({ success: true, status: newStatus })
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

