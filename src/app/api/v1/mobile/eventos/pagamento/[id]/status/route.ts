/**
 * GET /api/v1/mobile/eventos/pagamento/[id]/status
 *
 * Consulta o status atual de um pagamento de evento do membro autenticado.
 *
 * SEGURANÇA E REGRAS:
 * - Autenticação obrigatória via Bearer JWT do membro (resolveMobileMember).
 * - Identidade e ministry_id derivados exclusivamente do token.
 * - Anti-IDOR Estrito: Garante que o pagamento pertence à inscrição do próprio membro autenticado.
 * - Se expirado e pendente, atualiza automaticamente o status para 'expirado'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import {
  resolveMobileMember,
  mobileMemberErrorResponse,
} from '@/lib/mobile-member-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await resolveMobileMember(request);
    const { id } = await context.params;

    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 });
    }

    const admin = createServerClient();

    // 1. Buscar pagamento pertencente ao tenant
    const { data: pag, error: pagErr } = await admin
      .from('eventos_pagamentos')
      .select('id, status, valor, pix_payload, pix_qrcode, invoice_url, expires_at, paid_at, inscricao_id, ministry_id')
      .eq('id', id)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (pagErr || !pag) {
      return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 });
    }

    // 2. Anti-IDOR: Garantir que a inscrição pertence ao membro autenticado
    const { data: inscricao, error: insErr } = await admin
      .from('eventos_inscricoes')
      .select('id, member_id, status')
      .eq('id', pag.inscricao_id)
      .eq('ministry_id', ctx.ministryId)
      .eq('member_id', ctx.memberId)
      .maybeSingle();

    if (insErr || !inscricao) {
      return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 });
    }

    // 3. Auto-expirar se pendente e prazo vencido
    if (pag.status === 'pendente' && pag.expires_at && new Date(pag.expires_at) < new Date()) {
      const nowStr = new Date().toISOString();
      await admin
        .from('eventos_pagamentos')
        .update({ status: 'expirado', updated_at: nowStr })
        .eq('id', id);

      await admin
        .from('eventos_inscricoes')
        .update({ status: 'expirado', updated_at: nowStr })
        .eq('id', pag.inscricao_id);

      return NextResponse.json({
        id: pag.id,
        status: 'expirado',
        valor: Number(pag.valor),
        expires_at: pag.expires_at,
        paid_at: null,
        pix: null,
      });
    }

    return NextResponse.json({
      id: pag.id,
      status: pag.status,
      valor: Number(pag.valor),
      expires_at: pag.expires_at,
      paid_at: pag.paid_at || null,
      pix: pag.status === 'pendente' ? {
        payload:       pag.pix_payload || null,
        qrcode_base64: pag.pix_qrcode || null,
        invoice_url:   pag.invoice_url || null,
      } : null,
    });
  } catch (err) {
    const errRes = mobileMemberErrorResponse(err);
    if (errRes) return errRes;
    console.error('[mobile/eventos/pagamento/[id]/status GET] erro não tratado:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
