import { NextRequest, NextResponse } from 'next/server';
import { resolveMobileMember, mobileMemberErrorResponse } from '@/lib/mobile-member-auth';
import { createServerClient } from '@/lib/supabase-server';
import { CATEGORIAS_MIDIA_VIDEO, CategoriaVideo } from '@/lib/midia-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/mobile/midia/videos
 *
 * Retorna o catálogo de vídeos publicados para o membro:
 * - Filtros: categoria, busca (q), destaque
 * - Paginação server-side (page, limit protegido max 50)
 * - Isolamento multi-tenant (ministry_id) e congregacional
 * - Nunca expõe created_by, ministry_id ou dados administrativos
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

    // 2. Parâmetros de query
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    const categoriaParam = searchParams.get('categoria')?.toLowerCase();
    const buscaParam = searchParams.get('q')?.trim();
    const destaqueParam = searchParams.get('destaque');

    // Validação de Categoria se informada
    if (categoriaParam && !CATEGORIAS_MIDIA_VIDEO.includes(categoriaParam as CategoriaVideo)) {
      return NextResponse.json(
        {
          error: `Categoria inválida. Categorias permitidas: ${CATEGORIAS_MIDIA_VIDEO.join(', ')}`,
          code: 'INVALID_CATEGORY',
        },
        { status: 400 }
      );
    }

    // 3. Montar query
    let query = admin
      .from('midia_videos')
      .select(
        `
        id,
        titulo,
        descricao,
        url_video,
        youtube_id,
        thumbnail_url,
        categoria,
        autor_pregador,
        data_evento,
        duracao_segundos,
        destaque,
        congregacao_id,
        created_at
      `,
        { count: 'exact' }
      )
      .eq('ministry_id', ctx.ministryId)
      .eq('ativo', true);

    // Filtro congregacional
    if (memberCongregacaoId) {
      query = query.or(`congregacao_id.is.null,congregacao_id.eq.${memberCongregacaoId}`);
    } else {
      query = query.is('congregacao_id', null);
    }

    // Filtro por categoria
    if (categoriaParam) {
      query = query.eq('categoria', categoriaParam);
    }

    // Filtro por destaque
    if (destaqueParam === 'true') {
      query = query.eq('destaque', true);
    }

    // Filtro por busca de texto
    if (buscaParam) {
      query = query.or(`titulo.ilike.%${buscaParam}%,autor_pregador.ilike.%${buscaParam}%,descricao.ilike.%${buscaParam}%`);
    }

    // Ordenação e Paginação
    const { data: videosRaw, count, error: queryErr } = await query
      .order('destaque', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (queryErr) {
      return NextResponse.json(
        { error: 'Erro ao consultar catálogo de vídeos.' },
        { status: 500 }
      );
    }

    const videos = (videosRaw || []).map((v: any) => ({
      id: v.id,
      titulo: v.titulo,
      descricao: v.descricao,
      url_video: v.url_video,
      youtube_id: v.youtube_id,
      thumbnail_url: v.thumbnail_url,
      categoria: v.categoria,
      autor_pregador: v.autor_pregador,
      data_evento: v.data_evento,
      duracao_segundos: v.duracao_segundos,
      destaque: v.destaque,
      escopo: v.congregacao_id ? 'congregacao' : 'geral',
      created_at: v.created_at,
    }));

    return NextResponse.json({
      videos,
      total: count || 0,
      page,
      limit,
      total_paginas: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    const authResp = mobileMemberErrorResponse(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: 'Erro interno ao consultar vídeos.' },
      { status: 500 }
    );
  }
}
