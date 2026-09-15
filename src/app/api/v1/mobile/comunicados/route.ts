import { NextRequest, NextResponse } from 'next/server';
import { resolveMobileMember, mobileMemberErrorResponse } from '@/lib/mobile-member-auth';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/mobile/comunicados
 *
 * Retorna os comunicados e avisos publicados destinados ao membro autenticado:
 * - Filtra por status ativo: ativo = true
 * - Filtra por vigência: publicado_em <= NOW() e (expira_em IS NULL ou expira_em >= NOW())
 * - Isola por tenant: ministry_id = ctx.ministryId
 * - Isola por congregação: congregacao_id IS NULL (geral) ou congregacao_id = member.congregacao_id
 * - Join seguro com departamentos (para obter nome e sigla do departamento emissor)
 * - Ordenação cronológica decrescente: publicado_em DESC
 * - Paginação server-side com limite máximo protegido (max 50)
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();

    // 1. Obter congregação oficial do membro no banco
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

    // 2. Parâmetros de paginação e filtros
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    const categoriaFiltro = searchParams.get('categoria'); // 'geral' | 'urgente' | 'departamento' | 'evento'

    const agora = new Date().toISOString();

    // 3. Montar query base
    let query = admin
      .from('secretaria_comunicados')
      .select(
        `
        id,
        titulo,
        conteudo,
        categoria,
        imagem_url,
        publicado_em,
        expira_em,
        congregacao_id,
        departamento_id,
        departamentos (
          id,
          nome,
          sigla,
          logo_url
        ),
        congregacoes (
          id,
          nome
        )
      `,
        { count: 'exact' }
      )
      .eq('ministry_id', ctx.ministryId)
      .eq('ativo', true)
      .not('publicado_em', 'is', null)
      .lte('publicado_em', agora);

    // Filtro de expiração: expira_em nulo OU maior/igual a agora
    query = query.or(`expira_em.is.null,expira_em.gte.${agora}`);

    // Filtro de congregação: geral (null) OU da congregação do membro
    if (memberCongregacaoId) {
      query = query.or(`congregacao_id.is.null,congregacao_id.eq.${memberCongregacaoId}`);
    } else {
      query = query.is('congregacao_id', null);
    }

    // Filtro opcional por categoria
    if (
      categoriaFiltro &&
      ['geral', 'urgente', 'departamento', 'evento'].includes(categoriaFiltro.toLowerCase())
    ) {
      query = query.eq('categoria', categoriaFiltro.toLowerCase());
    }

    // Ordenação e Paginação
    const { data: comunicados, count, error } = await query
      .order('publicado_em', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao carregar comunicados.' },
        { status: 500 }
      );
    }

    // 4. Formatação segura para entrega ao membro (sem dados internos de auditoria/ministry_id)
    const items = (comunicados || []).map((c: any) => ({
      id: c.id,
      titulo: c.titulo,
      conteudo: c.conteudo,
      categoria: c.categoria,
      imagem_url: c.imagem_url,
      publicado_em: c.publicado_em,
      expira_em: c.expira_em,
      escopo: c.congregacao_id ? 'congregacao' : 'geral',
      congregacao_nome: c.congregacoes?.nome || null,
      departamento: c.departamentos
        ? {
            id: c.departamentos.id,
            nome: c.departamentos.nome,
            sigla: c.departamentos.sigla,
            logo_url: c.departamentos.logo_url,
          }
        : null,
    }));

    return NextResponse.json({
      comunicados: items,
      total: count || 0,
      page,
      limit,
      total_paginas: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    const authResp = mobileMemberErrorResponse(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: 'Erro interno ao consultar comunicados.' },
      { status: 500 }
    );
  }
}
