import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';

export const dynamic = 'force-dynamic';

const REUNIOES_RESTRICTED_RESPONSE = {
  error: 'O Módulo de Reuniões está disponível a partir do Plano Intermediário.',
  code: 'PLAN_RESTRICTED',
  required_plan: 'intermediate',
} as const;

const TIPOS_JUSTIFICATIVA_VALIDOS = [
  'antecipada',
  'no_checkin',
  'manuscrita_secretaria',
  'atestado_medico',
  'trabalho',
  'viagem',
  'outros',
];

/**
 * POST /api/v1/reunioes/faltas/[id]/justificar
 * Registra a justificativa de uma falta ministerial, atualiza a situação e mantém histórico completo.
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

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Payload JSON inválido.' }, { status: 400 });
    }

    const {
      tipo_justificativa = 'outros',
      motivo,
      anexo_documento_url,
      aprovado_por,
    } = body || {};

    if (!motivo || typeof motivo !== 'string' || !motivo.trim()) {
      return NextResponse.json({ error: 'O motivo da justificativa é obrigatório.' }, { status: 400 });
    }

    const tipoFinal = TIPOS_JUSTIFICATIVA_VALIDOS.includes(tipo_justificativa)
      ? tipo_justificativa
      : 'outros';

    // ─── 1. Validar e Localizar a Falta no Tenant ─────────────────────────────
    const { data: falta, error: fErr } = await ctx.admin
      .from('reunioes_faltas')
      .select(`
        id,
        reuniao_id,
        participante_id,
        member_id,
        ministry_id,
        situacao,
        reunioes ( id, titulo, total_justificados ),
        reunioes_participantes ( id, nome_ministro_snapshot, cargo_snapshot, status_presenca )
      `)
      .eq('id', faltaId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (fErr || !falta) {
      return NextResponse.json(
        { error: 'Registro de falta ministerial não encontrado neste ministério.' },
        { status: 404 }
      );
    }

    if (falta.situacao === 'abonada') {
      return NextResponse.json(
        { error: 'Esta falta já se encontra com situação ABONADA pela Secretaria Geral.', code: 'FALTA_ABONADA' },
        { status: 400 }
      );
    }

    // ─── 2. Inserir Registro de Justificativa ─────────────────────────────────
    const { data: novaJustificativa, error: justErr } = await ctx.admin
      .from('reunioes_justificativas')
      .insert({
        falta_id: falta.id,
        reuniao_id: falta.reuniao_id,
        member_id: falta.member_id,
        ministry_id: ctx.ministryId,
        tipo_justificativa: tipoFinal,
        motivo: motivo.trim(),
        anexo_documento_url: anexo_documento_url ? String(anexo_documento_url).trim() : null,
        registrado_por: ctx.userId || null,
        aprovado_por: aprovado_por || null,
        registrado_em: new Date().toISOString(),
      })
      .select()
      .single();

    if (justErr) {
      return NextResponse.json(
        { error: 'Erro ao gravar justificativa ministerial.', detail: justErr.message },
        { status: 500 }
      );
    }

    // ─── 3. Atualizar Situação da Falta e do Participante ─────────────────────
    const situacaoAnterior = falta.situacao;

    await ctx.admin
      .from('reunioes_faltas')
      .update({
        situacao: 'justificada',
        updated_at: new Date().toISOString(),
      })
      .eq('id', falta.id);

    await ctx.admin
      .from('reunioes_participantes')
      .update({ status_presenca: 'falta_justificada' })
      .eq('id', falta.participante_id);

    // ─── 4. Recalcular Contadores de Justificados na Reunião ───────────────────
    const { count: countJustificados } = await ctx.admin
      .from('reunioes_participantes')
      .select('*', { count: 'exact', head: true })
      .eq('reuniao_id', falta.reuniao_id)
      .eq('status_presenca', 'falta_justificada');

    await ctx.admin
      .from('reunioes')
      .update({
        total_justificados: countJustificados || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', falta.reuniao_id);

    // ─── 5. Gravar Trilha de Auditoria ────────────────────────────────────────
    await ctx.admin.from('reunioes_auditoria').insert({
      ministry_id: ctx.ministryId,
      reuniao_id: falta.reuniao_id,
      usuario_id: ctx.userId || null,
      acao: 'JUSTIFICAR_FALTA',
      tabela_afetada: 'reunioes_faltas',
      registro_id: falta.id,
      estado_anterior: {
        situacao: situacaoAnterior,
        falta_id: falta.id,
      },
      estado_novo: {
        situacao: 'justificada',
        justificativa_id: novaJustificativa.id,
        tipo: tipoFinal,
        motivo: motivo.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Falta de ${(falta.reunioes_participantes as any)?.nome_ministro_snapshot || 'Ministro'} justificada com sucesso.`,
      justificativa: novaJustificativa,
      falta: {
        id: falta.id,
        situacao: 'justificada',
      },
      total_justificados: countJustificados || 0,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro interno ao processar justificativa.', detail: err?.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/reunioes/faltas/[id]/justificar
 * Consulta o histórico completo de justificativas e detalhes de uma falta específica.
 */
export async function GET(
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

    const { data: falta, error: fErr } = await ctx.admin
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
        reunioes ( id, titulo, data_reuniao, horario_inicio, local ),
        reunioes_participantes (
          id,
          nome_ministro_snapshot,
          cargo_snapshot,
          nome_congregacao_snapshot,
          area_snapshot,
          carteirinha_numero_snapshot,
          status_presenca
        ),
        reunioes_justificativas (
          id,
          tipo_justificativa,
          motivo,
          anexo_documento_url,
          registrado_em,
          registrado_por,
          aprovado_por
        ),
        reunioes_advertencias (
          id,
          numero_protocolo,
          status_envio,
          enviada_em,
          pdf_url
        )
      `)
      .eq('id', faltaId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (fErr || !falta) {
      return NextResponse.json(
        { error: 'Falta ministerial não encontrada.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      falta,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Erro interno ao consultar falta ministerial.', detail: err?.message },
      { status: 500 }
    );
  }
}
