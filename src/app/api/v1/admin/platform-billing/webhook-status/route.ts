import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

const getAsaasApiKey = () => {
  return process.env.ASAAS_API_KEY?.replace(/^\\/, '');
};

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const apiKey = getAsaasApiKey();
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'ASAAS_API_KEY não configurada' }, { status: 500 });
    }

    const res = await fetch(ASAAS_API_URL + '/webhooks', {
      headers: { 'access_token': apiKey },
    });

    const json = await res.json();
    return NextResponse.json({ success: true, data: json });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const apiKey = getAsaasApiKey();
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'ASAAS_API_KEY não configurada' }, { status: 500 });
    }

    // Listar webhooks para encontrar o webhook da plataforma
    const listRes = await fetch(ASAAS_API_URL + '/webhooks', {
      headers: { 'access_token': apiKey },
    });
    const listData = await listRes.json();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.gestaoeklesia.com.br';
    const targetUrl = appUrl + '/api/v1/platform-webhook/asaas';

    const platformWebhook = (listData?.data || []).find((wh: any) => wh.url === targetUrl || wh.name === 'gestaoeklesia');

    if (!platformWebhook) {
      return NextResponse.json({ success: false, error: 'Webhook da plataforma não localizado no Asaas' }, { status: 404 });
    }

    // Reativar / desbloquear webhook
    const putRes = await fetch(ASAAS_API_URL + '/webhooks/' + platformWebhook.id, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'access_token': apiKey,
      },
      body: JSON.stringify({
        name: platformWebhook.name,
        url: targetUrl,
        email: platformWebhook.email || 'notificacoes@gestaoeklesia.com.br',
        enabled: true,
        interrupted: false,
        apiVersion: 3,
        sendType: 'NON_SEQUENTIALLY',
        events: [
          'PAYMENT_UPDATED',
          'PAYMENT_OVERDUE',
          'PAYMENT_RECEIVED',
          'PAYMENT_REFUNDED',
          'PAYMENT_DELETED',
          'PAYMENT_CONFIRMED',
          'PAYMENT_CREATED',
        ],
      }),
    });

    const putData = await putRes.json();
    return NextResponse.json({ success: true, data: putData });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
