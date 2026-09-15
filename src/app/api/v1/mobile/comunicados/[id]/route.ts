import { NextRequest, NextResponse } from 'next/server';
import { resolveMobileMember, mobileMemberErrorResponse } from '@/lib/mobile-member-auth';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/mobile/comunicados/[id]
 *
 * Retorna os detalhes de um comunicado específico:
 * - Validação anti-IDOR estrita por tenant, vigência, status e congregação
 * - Retorna 404 seguro para comunicados que não existem ou que o membro não tem autorização para ver
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    if (!id) {
      return NextResponse.json(
        { error: 'ID do comunicado não fornecido.', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();

    // 1. Obter congregação oficial do membro
    const { data: member } = await admin
      .from('members')
      .select('id, congregacao_id')
      .eq('id', ctx.memberId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    const memberCongregacaoId = member?.congregacao_id;

    // 2. Buscar comunicado garantindo isolamento por ministério
    const { data: com, error } = await admin
      .from('secretaria_comunicados')
      .select(
        `
        id,
        ministry_id,
        congregacao_id,
        departamento_id,
        titulo,
        conteudo,
        categoria,
        imagem_url,
        publicado_em,
        expira_em,
        ativo,
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
      `
      )
      .eq('id', id)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (error || !com) {
      return NextResponse.json(
        { error: 'Comunicado não encontrado.', code: 'COMUNICADO_NOT_FOUND' },
        { status: 404 }
      );
    }

    // 3. Validação de status e vigência
    const agora = new Date();

    if (!com.ativo || !com.publicado_em) {
      return NextResponse.json(
        { error: 'Comunicado não encontrado.', code: 'COMUNICADO_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (new Date(com.publicado_em) > agora) {
      return NextResponse.json(
        { error: 'Comunicado não encontrado.', code: 'COMUNICADO_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (com.expira_em && new Date(com.expira_em) < agora) {
      return NextResponse.json(
        { error: 'Comunicado não encontrado.', code: 'COMUNICADO_NOT_FOUND' },
        { status: 404 }
      );
    }

    // 4. Validação de Escopo Congregacional
    if (com.congregacao_id !== null && com.congregacao_id !== memberCongregacaoId) {
      return NextResponse.json(
        { error: 'Comunicado não encontrado.', code: 'COMUNICADO_NOT_FOUND' },
        { status: 404 }
      );
    }

    // 5. Retorno seguro sem campos de auditoria interna
    return NextResponse.json({
      id: com.id,
      titulo: com.titulo,
      conteudo: com.conteudo,
      categoria: com.categoria,
      imagem_url: com.imagem_url,
      publicado_em: com.publicado_em,
      expira_em: com.expira_em,
      escopo: com.congregacao_id ? 'congregacao' : 'geral',
      congregacao_nome: (com as any).congregacoes?.nome || null,
      departamento: (com as any).departamentos
        ? {
            id: (com as any).departamentos.id,
            nome: (com as any).departamentos.nome,
            sigla: (com as any).departamentos.sigla,
            logo_url: (com as any).departamentos.logo_url,
          }
        : null,
    });
  } catch (error) {
    const authResp = mobileMemberErrorResponse(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: 'Erro interno ao consultar comunicado.' },
      { status: 500 }
    );
  }
}
