/**
 * POST /api/v1/ministry-webhook/asaas/[token]
 *
 * Webhook multi-tenant para pagamentos ASAAS.
 * Cada ministério tem um webhook_token único gerado em ministry_payment_gateways.
 * O ASAAS envia os eventos para esta URL configurada pelo próprio ministério.
 *
 * SEGURANÇA:
 * - O token identifica o ministério — nunca expor ministry_id na URL
 * - Processamento idempotente via gateway_charge_id
 * - Apenas eventos de pagamento confirmado disparam ações
 * - Lançamento no tesouraria usa service_role (sem RLS)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Status ASAAS que representam pagamento confirmado
const PAID_EVENTS = new Set([
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_RECEIVED_IN_CASH',
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  // Validação básica do token (UUID)
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const event        = String(payload?.event ?? '').toUpperCase();
  const payment      = payload?.payment as Record<string, unknown> | undefined;
  const chargeId     = String(payment?.id ?? '');
  const paymentDate  = (payment?.paymentDate ?? payment?.confirmedDate ?? null) as string | null;

  if (!chargeId) {
    return NextResponse.json({ received: true, skipped: 'no_payment_id' });
  }

  const admin = createServerClient();

  // Resolve ministério pelo webhook_token (só gateways ativos)
  const { data: gw } = await admin
    .from('ministry_payment_gateways')
    .select('ministry_id')
    .eq('webhook_token', token)
    .eq('gateway', 'asaas')
    .eq('is_active', true)
    .maybeSingle();

  if (!gw?.ministry_id) {
    // Responde 200 para não gerar reenvio — token inválido/inativo
    return NextResponse.json({ received: true, skipped: 'unknown_token' });
  }

  const ministryId = gw.ministry_id as string;

  // Busca o pagamento de evento pelo charge_id
  const { data: pag } = await admin
    .from('eventos_pagamentos')
    .select('id, status, inscricao_id, evento_id, valor, tesouraria_lancamento_id')
    .eq('gateway_charge_id', chargeId)
    .eq('ministry_id', ministryId)
    .maybeSingle();

  if (!pag) {
    // Pode ser um pagamento de outro módulo (planos, etc) — ignorar silenciosamente
    return NextResponse.json({ received: true, skipped: 'not_evento_payment' });
  }

  // Idempotência: já processado
  if (pag.status === 'pago') {
    return NextResponse.json({ received: true, skipped: 'already_paid' });
  }

  // ── Pagamento confirmado ───────────────────────────────────────────────────
  if (PAID_EVENTS.has(event)) {
    const now = new Date().toISOString();

    // 1. Atualizar pagamento
    await admin
      .from('eventos_pagamentos')
      .update({
        status:           'pago',
        paid_at:          paymentDate ?? now,
        gateway_response: payload,
        updated_at:       now,
      })
      .eq('id', pag.id);

    // 2. Confirmar inscrição
    await admin
      .from('eventos_inscricoes')
      .update({ status: 'confirmado', updated_at: now })
      .eq('id', pag.inscricao_id);

    // 3. Criar lançamento no tesouraria (idempotente)
    if (!pag.tesouraria_lancamento_id) {
      // Buscar congregacao_id do evento para o lançamento
      const { data: evento } = await admin
        .from('eventos')
        .select('titulo, congregacao_id')
        .eq('id', pag.evento_id)
        .maybeSingle();

      const { data: inscricao } = await admin
        .from('eventos_inscricoes')
        .select('nome_externo')
        .eq('id', pag.inscricao_id)
        .maybeSingle();

      const descricao = `Inscrição Evento: ${evento?.titulo ?? 'Evento'} — ${inscricao?.nome_externo ?? ''}`;

      const { data: lanc } = await admin
        .from('tesouraria_lancamentos')
        .insert({
          ministry_id:      ministryId,
          congregacao_id:   evento?.congregacao_id ?? null,
          tipo_movimento:   'entrada',
          tipo_recebimento: 'evento',
          valor:            Number(pag.valor),
          descricao:        descricao.slice(0, 300),
          data_lancamento:  (paymentDate ?? now).slice(0, 10),
          origem_modulo:    'evento',
          origem_id:        pag.id,
        })
        .select('id')
        .single();

      if (lanc?.id) {
        await admin
          .from('eventos_pagamentos')
          .update({ tesouraria_lancamento_id: lanc.id, updated_at: now })
          .eq('id', pag.id);
      }
    }

    return NextResponse.json({ received: true, processed: 'paid' });
  }

  // ── Pagamento cancelado/expirado ───────────────────────────────────────────
  const CANCELLED_EVENTS = new Set([
    'PAYMENT_DELETED',
    'PAYMENT_CANCELED',
    'PAYMENT_OVERDUE',
    'PAYMENT_REFUNDED',
  ]);

  if (CANCELLED_EVENTS.has(event) && pag.status === 'pendente') {
    const now = new Date().toISOString();
    const newStatus = event === 'PAYMENT_OVERDUE' ? 'expirado' : 'cancelado';
    const inscStatus = event === 'PAYMENT_OVERDUE' ? 'expirado' : 'cancelado';

    await admin
      .from('eventos_pagamentos')
      .update({ status: newStatus, gateway_response: payload, updated_at: now })
      .eq('id', pag.id);

    await admin
      .from('eventos_inscricoes')
      .update({ status: inscStatus, updated_at: now })
      .eq('id', pag.inscricao_id);

    return NextResponse.json({ received: true, processed: newStatus });
  }

  return NextResponse.json({ received: true, skipped: 'unhandled_event' });
}
