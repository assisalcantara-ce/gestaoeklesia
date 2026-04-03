import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ASAAS_API_URL = 'https://api.asaas.com/v3';

const getAsaasApiKey = () => {
  return process.env.ASAAS_API_KEY?.replace(/^\\/, '');
};

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Autenticação
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Obter ministry_id do usuário
    const muResult = await supabase
      .from('ministry_users')
      .select('ministry_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let ministryId = (muResult.data as any)?.ministry_id as string | undefined;

    if (!ministryId) {
      const mResult = await supabase
        .from('ministries')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      ministryId = (mResult.data as any)?.id as string | undefined;
    }

    if (!ministryId) {
      return NextResponse.json({ error: 'Ministry not found' }, { status: 404 });
    }

    // paymentId da query string
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('id');

    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID required' }, { status: 400 });
    }

    // Buscar payment validando que pertence ao ministério
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, asaas_payment_id, amount, due_date, description, payment_method, status')
      .eq('id', paymentId)
      .eq('ministry_id', ministryId)
      .maybeSingle();

    if (paymentError || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const asaasPaymentId = (payment as any).asaas_payment_id;

    // Se não há ID ASAAS, retornar dados básicos para geração local
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
      });
    }

    // Buscar dados do pagamento no ASAAS
    const apiKey = getAsaasApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'ASAAS não configurado' }, { status: 500 });
    }

    const asaasResponse = await fetch(`${ASAAS_API_URL}/payments/${asaasPaymentId}`, {
      headers: {
        'Content-Type': 'application/json',
        access_token: apiKey,
      },
    });

    if (!asaasResponse.ok) {
      const errData = await asaasResponse.json().catch(() => ({}));
      console.error('[payments-boleto] Erro ASAAS:', errData);
      return NextResponse.json({ error: 'Erro ao buscar boleto no ASAAS' }, { status: 502 });
    }

    const asaasData = await asaasResponse.json();

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
    });
  } catch (error: any) {
    console.error('[payments-boleto] Erro geral:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
