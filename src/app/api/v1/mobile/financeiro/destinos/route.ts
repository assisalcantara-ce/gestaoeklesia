/**
 * GET /api/v1/mobile/financeiro/destinos
 *
 * Retorna a lista de destinos de arrecadação digital (PIX) ativos e disponíveis
 * para o membro autenticado, respeitando congregação e data de validade.
 *
 * SEGURANÇA:
 * - Autenticação obrigatória via Bearer JWT do membro (resolveMobileMember).
 * - Identidade e ministry_id derivados exclusivamente do token.
 * - Filtra estritamente: is_ativo = true, ministry_id = ctx.ministryId,
 *   expires_at no futuro ou nulo, e congregacao_id nulo (Geral) OU igual ao do membro.
 * - Nunca expõe credenciais ou tokens internos do gateway.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import {
  resolveMobileMember,
  mobileMemberErrorResponse,
} from '@/lib/mobile-member-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();

    // 1. Obter congregação do membro
    const { data: member } = await admin
      .from('members')
      .select('congregacao_id')
      .eq('id', ctx.memberId)
      .maybeSingle();

    const memberCongregacaoId = member?.congregacao_id ?? null;

    // 2. Buscar destinos ativos do ministério
    const now = new Date().toISOString();
    let query = admin
      .from('fin_payment_destinations')
      .select(`
        id,
        label,
        descricao,
        cor,
        icone,
        tipo_recebimento,
        valor_fixo,
        pix_payload,
        congregacao_id,
        expires_at
      `)
      .eq('ministry_id', ctx.ministryId)
      .eq('is_ativo', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false });

    // Filtrar congregação: geral (null) OU específica do membro
    if (memberCongregacaoId) {
      query = query.or(`congregacao_id.is.null,congregacao_id.eq.${memberCongregacaoId}`);
    } else {
      query = query.is('congregacao_id', null);
    }

    const { data: destinos, error } = await query;

    if (error) {
      console.error('[mobile/financeiro/destinos] erro na consulta:', error.code);
      return NextResponse.json({ error: 'Erro ao buscar destinos de contribuição.' }, { status: 500 });
    }

    const sanitized = (destinos ?? []).map((d) => ({
      id: d.id,
      label: d.label,
      descricao: d.descricao,
      cor: d.cor,
      icone: d.icone,
      tipo_recebimento: d.tipo_recebimento,
      valor_fixo: d.valor_fixo != null ? Number(d.valor_fixo) : null,
      pix_payload: d.pix_payload || null,
      congregacao_id: d.congregacao_id,
    }));

    return NextResponse.json({ data: sanitized });
  } catch (err) {
    const errRes = mobileMemberErrorResponse(err);
    if (errRes) return errRes;
    console.error('[mobile/financeiro/destinos] erro não tratado:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
