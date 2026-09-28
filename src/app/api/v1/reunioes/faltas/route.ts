import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';

export const dynamic = 'force-dynamic';

const REUNIOES_RESTRICTED_RESPONSE = {
  error: 'O Módulo de Reuniões está disponível a partir do Plano Intermediário.',
  code: 'PLAN_RESTRICTED',
  required_plan: 'intermediate',
} as const;

/**
 * GET /api/v1/reunioes/faltas
 * Lista as faltas ministeriais registradas com filtros por reunião, situação, ministro, congregação e período.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' },
        { status: 403 }
      );
    }

    const isAllowed = await isFeatureAllowedForTenant(ctx.admin, ctx.ministryId, 'meetings_module');
    if (!isAllowed) {
      return NextResponse.json(REUNIOES_RESTRICTED_RESPONSE, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const reuniaoIdParam = searchParams.get('reuniao_id');
    const situacaoParam = searchParams.get('situacao');
    const memberIdParam = searchParams.get('member_id');
    const congregacaoIdParam = searchParams.get('congregacao_id');
    const dataInicioParam = searchParams.get('data_inicio');
    const dataFimParam = searchParams.get('data_fim');

    let query = ctx.admin
      .from('reunioes_faltas')
      .select(`
        id,
        reuniao_id,
        participante_id,
        member_id,
        ministry_id,
        data_geracao_falta,
        situacao,
        gerada_por,
        created_at,
        updated_at,
        reunioes ( id, titulo, data_reuniao, horario_inicio, local, congregacao_id ),
        members ( id, name, email ),
        reunioes_participantes (
          id,
          nome_ministro_snapshot,
          cargo_snapshot,
          nome_congregacao_snapshot,
          congregacao_id_snapshot,
          area_snapshot,
          status_presenca
        ),
        reunioes_justificativas (
          id,
          tipo_justificativa,
          motivo,
          anexo_documento_url,
          registrado_em,
          registrado_por
        ),
        reunioes_advertencias (
          id,
          numero_protocolo,
          status_envio,
          email_destinatario,
          erro_mensagem,
          enviada_em
        )
      `)
      .eq('ministry_id', ctx.ministryId);

    if (reuniaoIdParam) {
      query = query.eq('reuniao_id', reuniaoIdParam);
    }

    if (situacaoParam && ['registrada', 'justificada', 'abonada'].includes(situacaoParam)) {
      query = query.eq('situacao', situacaoParam);
    }

    if (memberIdParam) {
      query = query.eq('member_id', memberIdParam);
    }

    if (dataInicioParam && /^\d{4}-\d{2}-\d{2}$/.test(dataInicioParam)) {
      query = query.gte('data_geracao_falta', `${dataInicioParam}T00:00:00-03:00`);
    }

    if (dataFimParam && /^\d{4}-\d{2}-\d{2}$/.test(dataFimParam)) {
      query = query.lte('data_geracao_falta', `${dataFimParam}T23:59:59-03:00`);
    }

    const { data: faltas, error } = await query.order('data_geracao_falta', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao listar faltas ministeriais.', detail: error.message },
        { status: 500 }
      );
    }

    // Filtrar por congregação caso solicitada via snapshot
    let faltasFiltradas = faltas || [];
    if (congregacaoIdParam) {
      faltasFiltradas = faltasFiltradas.filter(
        (f: any) =>
          f.reunioes_participantes?.congregacao_id_snapshot === congregacaoIdParam ||
          f.reunioes?.congregacao_id === congregacaoIdParam
      );
    }

    return NextResponse.json({
      success: true,
      total: faltasFiltradas.length,
      faltas: faltasFiltradas,
    });
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { error: 'Não autorizado. Faça login novamente.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    if (err?.message === 'NO_MINISTRY') {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Erro interno ao consultar faltas.', detail: err?.message },
      { status: 500 }
    );
  }
}
