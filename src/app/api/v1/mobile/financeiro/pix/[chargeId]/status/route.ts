/**
 * GET /api/v1/mobile/financeiro/pix/[chargeId]/status
 *
 * Consulta o status atual de uma cobrança PIX criada pelo membro autenticado.
 *
 * SEGURANÇA:
 * - Autenticação obrigatória via Bearer JWT do membro (resolveMobileMember).
 * - Identidade e ministry_id derivados exclusivamente do token.
 * - Filtra estritamente: id = chargeId, ministry_id = ctx.ministryId,
 *   e member_id = ctx.memberId.
 * - Se a cobrança não existir ou pertencer a outro membro/ministério,
 *   retorna HTTP 404 sem vazar informações.
 * - Nunca altera o status no banco (leitura estrita; status atualizado via webhook).
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
  context: { params: Promise<{ chargeId: string }> }
) {
  try {
    const ctx = await resolveMobileMember(request);
    const { chargeId } = await context.params;

    if (!chargeId || typeof chargeId !== 'string') {
      return NextResponse.json({ error: 'chargeId inválido.' }, { status: 400 });
    }

    const admin = createServerClient();

    // Consulta restrita ao membro autenticado e ao mesmo ministério
    const { data: charge, error } = await admin
      .from('fin_payment_charges')
      .select('id, status, valor_solicitado, valor_pago, paid_at, pix_payload')
      .eq('id', chargeId)
      .eq('ministry_id', ctx.ministryId)
      .eq('member_id', ctx.memberId)
      .maybeSingle();

    if (error || !charge) {
      return NextResponse.json({ error: 'Cobrança não encontrada.' }, { status: 404 });
    }

    return NextResponse.json({
      id: charge.id,
      status: charge.status,
      valor_solicitado: Number(charge.valor_solicitado),
      valor_pago: charge.valor_pago != null ? Number(charge.valor_pago) : null,
      paid_at: charge.paid_at,
      pix_payload: charge.pix_payload,
    });
  } catch (err) {
    const errRes = mobileMemberErrorResponse(err);
    if (errRes) return errRes;
    console.error('[mobile/financeiro/pix/status] erro não tratado:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
