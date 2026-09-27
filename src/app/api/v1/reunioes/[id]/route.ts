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
 * GET /api/v1/reunioes/[id]
 * Retorna os detalhes completos da reunião ministerial e o snapshot de participantes.
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
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

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ID da reunião é obrigatório.' }, { status: 400 });
    }

    // 1. Buscar dados da reunião com estrito isolamento por ministry_id
    const { data: reuniao, error: rErr } = await ctx.admin
      .from('reunioes')
      .select(`
        id,
        ministry_id,
        congregacao_id,
        titulo,
        pauta,
        local,
        data_reuniao,
        horario_inicio,
        horario_limite_entrada,
        limite_checkin_em,
        status,
        iniciada_em,
        encerrada_em,
        total_esperados,
        total_presentes,
        total_ausentes,
        total_justificados,
        created_at,
        updated_at,
        congregacoes ( id, nome )
      `)
      .eq('id', id)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (rErr || !reuniao) {
      return NextResponse.json(
        { error: 'Reunião ministerial não encontrada.' },
        { status: 404 }
      );
    }

    // 2. Buscar participantes do snapshot
    const { data: participantes, error: pErr } = await ctx.admin
      .from('reunioes_participantes')
      .select(`
        id,
        reuniao_id,
        member_id,
        nome_ministro_snapshot,
        cargo_snapshot,
        congregacao_id_snapshot,
        nome_congregacao_snapshot,
        area_snapshot,
        carteirinha_numero_snapshot,
        unique_id_snapshot,
        status_presenca,
        created_at
      `)
      .eq('reuniao_id', id)
      .eq('ministry_id', ctx.ministryId)
      .order('nome_ministro_snapshot', { ascending: true });

    if (pErr) {
      return NextResponse.json(
        { error: 'Erro ao carregar participantes da reunião.', detail: pErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reuniao,
      participantes: participantes || [],
      resumo: {
        total_esperados: reuniao.total_esperados,
        total_presentes: reuniao.total_presentes,
        total_ausentes: reuniao.total_ausentes,
        total_justificados: reuniao.total_justificados,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro interno ao consultar detalhes da reunião.', detail: err?.message },
      { status: 500 }
    );
  }
}
