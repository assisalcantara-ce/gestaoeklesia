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
 * POST /api/v1/reunioes/faltas/[id]/abonar
 * Abona formalmente a falta de um ministro pela Secretaria Geral, mantendo histórico e auditoria.
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: faltaId } = await props.params;
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

    if (!faltaId || typeof faltaId !== 'string') {
      return NextResponse.json({ error: 'ID da falta é obrigatório.' }, { status: 400 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // payload opcional
    }

    const { motivo_abono } = body || {};

    // 1. Validar e Localizar a Falta no Tenant
    const { data: falta, error: fErr } = await ctx.admin
      .from('reunioes_faltas')
      .select(`
        id,
        reuniao_id,
        participante_id,
        member_id,
        ministry_id,
        situacao,
        reunioes_participantes ( id, nome_ministro_snapshot, cargo_snapshot )
      `)
      .eq('id', faltaId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (fErr || !falta) {
      return NextResponse.json(
        { error: 'Falta ministerial não encontrada neste ministério.' },
        { status: 404 }
      );
    }

    if (falta.situacao === 'abonada') {
      return NextResponse.json(
        { error: 'Esta falta já se encontra abonada.', code: 'JA_ABONADA' },
        { status: 400 }
      );
    }

    const situacaoAnterior = falta.situacao;

    // 2. Atualizar a Situação da Falta para 'abonada'
    await ctx.admin
      .from('reunioes_faltas')
      .update({
        situacao: 'abonada',
        updated_at: new Date().toISOString(),
      })
      .eq('id', falta.id);

    // 3. Gravar justificativa institucional do tipo 'outros' caso motivo seja informado
    if (motivo_abono && typeof motivo_abono === 'string' && motivo_abono.trim()) {
      await ctx.admin.from('reunioes_justificativas').insert({
        falta_id: falta.id,
        reuniao_id: falta.reuniao_id,
        member_id: falta.member_id,
        ministry_id: ctx.ministryId,
        tipo_justificativa: 'outros',
        motivo: `[ABONO DA SECRETARIA GERAL] ${motivo_abono.trim()}`,
        registrado_por: ctx.userId || null,
        aprovado_por: ctx.userId || null,
        registrado_em: new Date().toISOString(),
      });
    }

    // 4. Trilha de Auditoria
    await ctx.admin.from('reunioes_auditoria').insert({
      ministry_id: ctx.ministryId,
      reuniao_id: falta.reuniao_id,
      usuario_id: ctx.userId || null,
      acao: 'ABONAR_FALTA',
      tabela_afetada: 'reunioes_faltas',
      registro_id: falta.id,
      estado_anterior: {
        situacao: situacaoAnterior,
      },
      estado_novo: {
        situacao: 'abonada',
        motivo_abono: motivo_abono || 'Abonado pela Secretaria Geral',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Falta de ${(falta.reunioes_participantes as any)?.nome_ministro_snapshot || 'Ministro'} abonada com sucesso.`,
      falta: {
        id: falta.id,
        situacao: 'abonada',
      },
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
      { error: 'Erro interno ao abonar falta ministerial.', detail: err?.message },
      { status: 500 }
    );
  }
}
