/**
 * GET /api/v1/eventos/pagamento/[id]/status
 *
 * Retorna o status atual de um pagamento de evento.
 * Se pendente e expirado, marca automaticamente como expirado.
 *
 * Resposta pública (sem auth) — o `id` do pagamento já é UUID opaco.
 * Polling seguro: não expõe dados sensíveis do ministério.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
  }

  const admin = createServerClient();

  const { data: pag, error } = await admin
    .from('eventos_pagamentos')
    .select('id, status, valor, pix_payload, pix_qrcode, invoice_url, expires_at, paid_at, inscricao_id')
    .eq('id', id)
    .maybeSingle();

  if (error || !pag) {
    return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 });
  }

  // Auto-expirar se pendente e prazo vencido
  if (pag.status === 'pendente' && pag.expires_at && new Date(pag.expires_at) < new Date()) {
    await admin
      .from('eventos_pagamentos')
      .update({ status: 'expirado', updated_at: new Date().toISOString() })
      .eq('id', id);

    await admin
      .from('eventos_inscricoes')
      .update({ status: 'expirado', updated_at: new Date().toISOString() })
      .eq('id', pag.inscricao_id);

    return NextResponse.json({
      id: pag.id,
      status: 'expirado',
      valor: pag.valor,
      expires_at: pag.expires_at,
      pix: null,
    });
  }

  return NextResponse.json({
    id: pag.id,
    status: pag.status,
    valor: pag.valor,
    expires_at: pag.expires_at,
    paid_at: pag.paid_at ?? null,
    pix: pag.status === 'pendente' ? {
      payload:       pag.pix_payload ?? null,
      qrcode_base64: pag.pix_qrcode ?? null,
      invoice_url:   pag.invoice_url ?? null,
    } : null,
  });
}
