/**
 * POST /api/v1/ministry-webhook/efi/[token]
 *
 * Webhook multi-tenant para pagamentos EFI Pay (PIX).
 * Cada ministério tem um webhook_token único em ministry_payment_gateways.
 *
 * O EFI envia o payload quando um PIX é recebido na chave registrada.
 *
 * SEGURANÇA:
 * - O token identifica o ministério sem expor ministry_id na URL
 * - Processamento idempotente via txid (gateway_charge_id)
 * - service_role para lançamentos no tesouraria (sem RLS)
 *
 * PAYLOAD EFI (exemplo):
 * {
 *   "pix": [
 *     {
 *       "endToEndId": "E...",
 *       "txid":       "abc123...",
 *       "valor":      "10.00",
 *       "horario":    "2024-01-01T12:00:00.000Z",
 *       "pagador":    { "cpf": "...", "nome": "..." },
 *       "infoPagador": "..."
 *     }
 *   ]
 * }
 *
 * Nota: EFI não envia eventos explícitos de cancelamento/expiração via webhook.
 * Apenas pagamentos recebidos (pix[]) são notificados.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// ─── Mapeamento de tipos de recebimento → tesouraria ──────────────────────────
const TIPO_MAP: Record<string, string> = {
  dizimo:         'dizimo',
  oferta:         'oferta',
  missoes:        'missoes',
  doacao:         'contribuicao',
  campanha_local: 'campanha',
  evento_local:   'evento',
};

// ─── Handler principal ─────────────────────────────────────────────────────────

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

  // EFI envia array de pix recebidos
  const pixArr = Array.isArray(payload?.pix)
    ? (payload.pix as Record<string, unknown>[])
    : [];

  if (pixArr.length === 0) {
    // Pode ser um ping/teste do EFI — responde 200 sem processar
    return NextResponse.json({ received: true, skipped: 'no_pix_events' });
  }

  const admin = createServerClient();

  // Resolve ministério pelo webhook_token (só gateways EFI ativos)
  const { data: gw } = await admin
    .from('ministry_payment_gateways')
    .select('ministry_id')
    .eq('webhook_token', token)
    .eq('gateway', 'efi')
    .eq('is_active', true)
    .maybeSingle();

  if (!gw?.ministry_id) {
    // Responde 200 para não gerar reenvio — token inválido/inativo
    return NextResponse.json({ received: true, skipped: 'unknown_token' });
  }

  const ministryId = gw.ministry_id as string;
  const results: string[] = [];

  // Processa cada PIX recebido no batch
  for (const pix of pixArr) {
    const txid        = String(pix?.txid ?? '');
    const valor       = Number(pix?.valor ?? 0);
    const horario     = String(pix?.horario ?? '') || null;
    const endToEndId  = String(pix?.endToEndId ?? '');

    if (!txid) continue;

    const result = await _processSinglePix({
      admin,
      ministryId,
      txid,
      valor,
      horario,
      endToEndId,
      rawPayload: pix,
    });

    results.push(`${txid}:${result}`);
  }

  return NextResponse.json({ received: true, processed: results });
}

// ─── Processamento de um PIX individual ───────────────────────────────────────

interface ProcessPixParams {
  admin: ReturnType<typeof createServerClient>;
  ministryId: string;
  txid: string;
  valor: number;
  horario: string | null;
  endToEndId: string;
  rawPayload: Record<string, unknown>;
}

async function _processSinglePix(p: ProcessPixParams): Promise<string> {
  const { admin, ministryId, txid, valor, horario, endToEndId, rawPayload } = p;
  const now              = new Date().toISOString();
  const gatewayEventId   = endToEndId || `pix_${txid}`;

  // ── Log idempotente de evento ─────────────────────────────────────────────
  await admin
    .from('fin_webhook_events')
    .upsert(
      {
        ministry_id:      ministryId,
        gateway:          'efi',
        event_type:       'PIX_RECEBIDO',
        gateway_event_id: gatewayEventId,
        charge_id:        txid,
        external_ref:     txid,
        payload:          rawPayload,
        processed:        false,
        received_at:      now,
      },
      { onConflict: 'gateway,gateway_event_id', ignoreDuplicates: true }
    );

  // ── Fase A: Arrecadação Digital — fin_payment_charges ────────────────────
  const { data: digitalCharge } = await admin
    .from('fin_payment_charges')
    .select('id, status, destination_id, valor_solicitado, tesouraria_lancamento_id')
    .eq('gateway_charge_id', txid)
    .eq('ministry_id', ministryId)
    .maybeSingle();

  if (digitalCharge) {
    // Idempotência: já pago com lançamento criado
    if (digitalCharge.status === 'pago' && digitalCharge.tesouraria_lancamento_id) {
      return 'digital_already_paid';
    }

    const valorPago = valor || Number(digitalCharge.valor_solicitado ?? 0);
    const paidAt    = horario ?? now;

    // 1. Atualiza cobrança
    await admin
      .from('fin_payment_charges')
      .update({
        status:           'pago',
        valor_pago:        valorPago,
        paid_at:           paidAt,
        gateway_response:  rawPayload,
        updated_at:        now,
      })
      .eq('id', digitalCharge.id);

    // 2. Cria lançamento no tesouraria
    let lancamentoId: string | null = digitalCharge.tesouraria_lancamento_id ?? null;

    if (!lancamentoId) {
      const { data: dest } = await admin
        .from('fin_payment_destinations')
        .select('congregacao_id, conta_id, categoria_id, tipo_recebimento, label')
        .eq('id', digitalCharge.destination_id)
        .single();

      if (dest) {
        const { data: lanc } = await admin
          .from('tesouraria_lancamentos')
          .insert({
            ministry_id:      ministryId,
            congregacao_id:   dest.congregacao_id ?? null,
            conta_id:         dest.conta_id ?? null,
            categoria_id:     dest.categoria_id ?? null,
            tipo_movimento:   'entrada',
            tipo_recebimento: TIPO_MAP[dest.tipo_recebimento] ?? 'contribuicao',
            forma_pagamento:  'pix',
            valor:            valorPago,
            descricao:        `PIX EFI — ${dest.label}`,
            data_lancamento:  paidAt.slice(0, 10),
            origem_modulo:    'gateway',
            origem_id:        digitalCharge.id,
          })
          .select('id')
          .single();

        if (lanc?.id) {
          lancamentoId = lanc.id;
          await admin
            .from('fin_payment_charges')
            .update({ tesouraria_lancamento_id: lanc.id, updated_at: now })
            .eq('id', digitalCharge.id);
        }
      }
    }

    // 3. Marca evento como processado
    await admin
      .from('fin_webhook_events')
      .update({ processed: true, processed_at: now, lancamento_id: lancamentoId, destination_id: digitalCharge.destination_id })
      .eq('gateway', 'efi')
      .eq('gateway_event_id', gatewayEventId);

    return 'digital_paid';
  }

  // ── Fase B: Eventos Pagos — eventos_pagamentos ────────────────────────────
  const { data: pag } = await admin
    .from('eventos_pagamentos')
    .select('id, status, inscricao_id, evento_id, valor, tesouraria_lancamento_id')
    .eq('gateway_charge_id', txid)
    .eq('ministry_id', ministryId)
    .maybeSingle();

  if (!pag) {
    return 'not_found';
  }

  // Idempotência
  if (pag.status === 'pago') {
    return 'evento_already_paid';
  }

  const valorPago = valor || Number(pag.valor ?? 0);
  const paidAt    = horario ?? now;

  // 1. Atualizar pagamento
  await admin
    .from('eventos_pagamentos')
    .update({
      status:           'pago',
      paid_at:          paidAt,
      gateway_response: rawPayload,
      updated_at:       now,
    })
    .eq('id', pag.id);

  // 2. Confirmar inscrição
  await admin
    .from('eventos_inscricoes')
    .update({ status: 'confirmado', updated_at: now })
    .eq('id', pag.inscricao_id);

  // 3. Criar lançamento no tesouraria
  if (!pag.tesouraria_lancamento_id) {
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
        forma_pagamento:  'pix',
        valor:            valorPago,
        descricao:        descricao.slice(0, 300),
        data_lancamento:  paidAt.slice(0, 10),
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

  // 4. Marca evento como processado
  await admin
    .from('fin_webhook_events')
    .update({ processed: true, processed_at: now })
    .eq('gateway', 'efi')
    .eq('gateway_event_id', gatewayEventId);

  return 'evento_paid';
}
