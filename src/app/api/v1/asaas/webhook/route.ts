import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;

const resolveToken = (request: NextRequest) => {
  const direct = request.headers.get('asaas-access-token') || request.headers.get('access_token');
  if (direct) return direct;

  const auth = request.headers.get('authorization');
  if (!auth) return null;
  return auth.replace('Bearer ', '');
};

export async function POST(request: NextRequest) {
  try {
    if (!ASAAS_WEBHOOK_TOKEN) {
      console.error('[ASAAS WEBHOOK] ASAAS_WEBHOOK_TOKEN não configurado — request rejeitado');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = resolveToken(request);
    if (!token || token !== ASAAS_WEBHOOK_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    const eventId = payload?.id ? String(payload.id) : null;
    const event = String(payload?.event || '').toUpperCase();
    const payment = payload?.payment;
    const asaasPaymentId = payment?.id;

    if (!asaasPaymentId) {
      return NextResponse.json({ error: 'Pagamento nao informado' }, { status: 400 });
    }

    const statusMap: Record<string, string> = {
      PAYMENT_CONFIRMED: 'paid',
      PAYMENT_RECEIVED: 'paid',
      PAYMENT_OVERDUE: 'overdue',
      PAYMENT_DELETED: 'cancelled',
      PAYMENT_CANCELED: 'cancelled',
      PAYMENT_REFUNDED: 'cancelled',
    };

    const nextStatus = statusMap[event];
    const paymentDate = payment?.paymentDate || payment?.confirmedDate || null;

    const supabase = createServerClient();

    if (eventId) {
      const { data: existingEvent } = await supabase
        .from('asaas_webhook_events')
        .select('id, process_status')
        .eq('event_id', eventId)
        .maybeSingle();

      if (existingEvent?.id && existingEvent.process_status === 'processed') {
        return NextResponse.json({ received: true, duplicated: true });
      }
    }

    const { data: webhookEvent } = await supabase
      .from('asaas_webhook_events')
      .upsert({
        event_id: eventId,
        asaas_payment_id: asaasPaymentId,
        event_type: event || 'UNKNOWN',
        payload,
        process_status: 'received',
        received_at: new Date().toISOString(),
      }, { onConflict: 'event_id' })
      .select('id')
      .maybeSingle();

    const updatePayload: Record<string, any> = {
      asaas_response: payload,
      asaas_status: payment?.status || nextStatus || null,
      asaas_invoice_url: payment?.invoiceUrl || null,
      asaas_bank_slip_url: payment?.bankSlipUrl || null,
      asaas_pix_qr_code: payment?.pixQrCodeUrl || null,
      asaas_last_event: event || null,
      asaas_last_event_at: new Date().toISOString(),
      asaas_last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (nextStatus) {
      updatePayload.status = nextStatus;
    }

    if (paymentDate) {
      updatePayload.payment_date = paymentDate;
    }

    const { error } = await supabase
      .from('payments')
      .update(updatePayload)
      .eq('asaas_payment_id', asaasPaymentId);

    if (error) {
      if (webhookEvent?.id) {
        await supabase
          .from('asaas_webhook_events')
          .update({
            process_status: 'error',
            process_error: error.message,
            processed_at: new Date().toISOString(),
          })
          .eq('id', webhookEvent.id);
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (webhookEvent?.id) {
      await supabase
        .from('asaas_webhook_events')
        .update({
          process_status: 'processed',
          process_error: null,
          processed_at: new Date().toISOString(),
        })
        .eq('id', webhookEvent.id);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
