/**
 * GET /api/v1/mobile/financeiro/extrato
 *
 * Retorna o extrato de contribuições (dízimos, ofertas, campanhas) registradas
 * na Tesouraria para o membro autenticado.
 *
 * SEGURANÇA:
 * - Autenticação obrigatória via Bearer JWT do membro (resolveMobileMember).
 * - Identidade e ministry_id derivados exclusivamente do token.
 * - Filtra estritamente: ministry_id = ctx.ministryId AND member_id = ctx.memberId.
 * - Paginação segura (range).
 * - Não expõe criado_por ou dados internos contábeis da equipe.
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

    const urlObj = new URL(request.url);
    const page = Math.max(1, parseInt(urlObj.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(urlObj.searchParams.get('pageSize') || '20', 10)));
    const tipo = urlObj.searchParams.get('tipo') || '';

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = admin
      .from('tesouraria_lancamentos')
      .select(`
        id,
        tipo_recebimento,
        valor,
        data_lancamento,
        descricao,
        forma_pagamento,
        referencia
      `, { count: 'exact' })
      .eq('ministry_id', ctx.ministryId)
      .eq('member_id', ctx.memberId)
      .eq('tipo_movimento', 'entrada');

    if (tipo) {
      query = query.eq('tipo_recebimento', tipo);
    }

    query = query
      .order('data_lancamento', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data: lancamentos, error, count } = await query;

    if (error) {
      console.error('[mobile/financeiro/extrato] erro na consulta:', error.code);
      return NextResponse.json({ error: 'Erro ao carregar extrato de contribuições.' }, { status: 500 });
    }

    const formatted = (lancamentos ?? []).map((l) => ({
      id: l.id,
      tipo_recebimento: l.tipo_recebimento,
      valor: Number(l.valor),
      data_lancamento: l.data_lancamento,
      descricao: l.descricao,
      forma_pagamento: l.forma_pagamento,
      referencia: l.referencia,
    }));

    const totalCount = count ?? 0;

    return NextResponse.json({
      data: formatted,
      meta: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    });
  } catch (err) {
    const errRes = mobileMemberErrorResponse(err);
    if (errRes) return errRes;
    console.error('[mobile/financeiro/extrato] erro não tratado:', err);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
