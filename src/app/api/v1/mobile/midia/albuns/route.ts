import { NextRequest, NextResponse } from 'next/server';
import { resolveMobileMember, mobileMemberErrorResponse } from '@/lib/mobile-member-auth';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/mobile/midia/albuns
 *
 * Retorna os álbuns de fotos publicados para o membro:
 * - Paginação server-side (page, limit protegido max 50)
 * - Contagem eficiente de fotos por álbum
 * - Isolamento multi-tenant e congregacional
 * - Apenas ativo = true e publicado_em <= NOW()
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();

    // 1. Obter congregação oficial do membro
    const { data: member, error: memberErr } = await admin
      .from('members')
      .select('id, congregacao_id')
      .eq('id', ctx.memberId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (memberErr || !member) {
      return NextResponse.json(
        { error: 'Membro não encontrado.', code: 'MEMBER_NOT_FOUND' },
        { status: 404 }
      );
    }

    const memberCongregacaoId = member.congregacao_id;
    const agora = new Date().toISOString();

    // 2. Parâmetros de paginação
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    // 3. Montar query
    let query = admin
      .from('midia_albuns')
      .select(
        `
        id,
        titulo,
        descricao,
        capa_url,
        data_evento,
        publicado_em,
        congregacao_id,
        congregacoes (
          id,
          nome
        ),
        created_at
      `,
        { count: 'exact' }
      )
      .eq('ministry_id', ctx.ministryId)
      .eq('ativo', true)
      .not('publicado_em', 'is', null)
      .lte('publicado_em', agora);

    if (memberCongregacaoId) {
      query = query.or(`congregacao_id.is.null,congregacao_id.eq.${memberCongregacaoId}`);
    } else {
      query = query.is('congregacao_id', null);
    }

    const { data: albunsRaw, count, error: queryErr } = await query
      .order('publicado_em', { ascending: false })
      .range(offset, offset + limit - 1);

    if (queryErr) {
      return NextResponse.json(
        { error: 'Erro ao consultar álbuns de fotos.' },
        { status: 500 }
      );
    }

    // 4. Buscar contagens de fotos para os álbuns da página atual (evita N+1)
    const albumIds = (albunsRaw || []).map((a: any) => a.id);
    const photoCounts: Record<string, number> = {};

    if (albumIds.length > 0) {
      const { data: fotosData } = await admin
        .from('midia_fotos')
        .select('album_id')
        .eq('ministry_id', ctx.ministryId)
        .in('album_id', albumIds);

      if (fotosData) {
        for (const f of fotosData) {
          photoCounts[f.album_id] = (photoCounts[f.album_id] || 0) + 1;
        }
      }
    }

    const albuns = (albunsRaw || []).map((a: any) => ({
      id: a.id,
      titulo: a.titulo,
      descricao: a.descricao,
      capa_url: a.capa_url,
      data_evento: a.data_evento,
      publicado_em: a.publicado_em,
      total_fotos: photoCounts[a.id] || 0,
      escopo: a.congregacao_id ? 'congregacao' : 'geral',
      congregacao_nome: a.congregacoes?.nome || null,
      created_at: a.created_at,
    }));

    return NextResponse.json({
      albuns,
      total: count || 0,
      page,
      limit,
      total_paginas: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    const authResp = mobileMemberErrorResponse(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: 'Erro interno ao consultar álbuns.' },
      { status: 500 }
    );
  }
}
