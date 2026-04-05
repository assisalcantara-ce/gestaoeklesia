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

    const updatePayload: Record<string, any> = {
      asaas_response: payload,
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
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
