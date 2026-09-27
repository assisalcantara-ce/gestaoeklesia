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
 * POST /api/v1/reunioes/[id]/encerrar
 * Executa transacionalmente o encerramento da reunião ministerial via RPC PostgreSQL.
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reuniaoId } = await props.params;
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

    if (!reuniaoId || typeof reuniaoId !== 'string') {
      return NextResponse.json({ error: 'ID da reunião é obrigatório.' }, { status: 400 });
    }

    // 1. Validar que a reunião pertence ao tenant autenticado
    const { data: reuniao, error: rErr } = await ctx.admin
      .from('reunioes')
      .select('id, ministry_id, titulo, status')
      .eq('id', reuniaoId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (rErr || !reuniao) {
      return NextResponse.json(
        { error: 'Reunião ministerial não encontrada no ministério autenticado.' },
        { status: 404 }
      );
    }

    if (reuniao.status === 'encerrada') {
      return NextResponse.json(
        { error: 'Esta reunião já se encontra encerrada.', code: 'JA_ENCERRADA' },
        { status: 400 }
      );
    }

    if (reuniao.status === 'cancelada') {
      return NextResponse.json(
        { error: 'Não é possível encerrar uma reunião cancelada.', code: 'REUNIAO_CANCELADA' },
        { status: 400 }
      );
    }

    // 2. Chamar a RPC PostgreSQL de encerramento transacional
    const { data: rpcResult, error: rpcErr } = await ctx.admin.rpc(
      'encerrar_reuniao_ministerial',
      {
        p_reuniao_id: reuniaoId,
        p_user_id: ctx.userId || null,
      }
    );

    if (rpcErr) {
      return NextResponse.json(
        { error: 'Erro ao executar encerramento da reunião.', detail: rpcErr.message },
        { status: 500 }
      );
    }

    if (!rpcResult || rpcResult.success === false) {
      return NextResponse.json(
        { error: rpcResult?.message || 'Falha ao encerrar reunião.', code: 'RPC_FAILED' },
        { status: 400 }
      );
    }

    // 3. Buscar dados atualizados da reunião encerrada
    const { data: reuniaoAtualizada } = await ctx.admin
      .from('reunioes')
      .select(`
        id,
        titulo,
        status,
        encerrada_em,
        total_esperados,
        total_presentes,
        total_ausentes,
        total_justificados
      `)
      .eq('id', reuniaoId)
      .single();

    return NextResponse.json({
      success: true,
      message: 'Reunião ministerial encerrada com sucesso.',
      reuniao: reuniaoAtualizada,
      resumo: {
        total_esperados: rpcResult.total_esperados,
        total_presentes: rpcResult.total_presentes,
        total_ausentes: rpcResult.total_ausentes,
        total_justificados: rpcResult.total_justificados,
        encerrada_em: reuniaoAtualizada?.encerrada_em,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro interno ao processar encerramento.', detail: err?.message },
      { status: 500 }
    );
  }
}
