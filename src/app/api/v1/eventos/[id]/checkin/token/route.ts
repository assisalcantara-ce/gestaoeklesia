import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';
import { gerarTokenCheckinEvento, hashTokenCheckinEvento, isEventoElegivelCheckin } from '@/lib/eventos-checkin-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/eventos/[id]/checkin/token
 * Retorna o token de check-in ativo para o evento selecionado, ou cria um novo caso não exista.
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventoId } = await props.params;
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' },
        { status: 403 }
      );
    }

    const isAllowed = await isFeatureAllowedForTenant(ctx.admin, ctx.ministryId, 'events_module');
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Módulo de Eventos indisponível neste ministério.', code: 'FEATURE_DISABLED' },
        { status: 403 }
      );
    }

    if (!eventoId) {
      return NextResponse.json({ error: 'ID do evento é obrigatório.' }, { status: 400 });
    }

    // 1. Validar existência e elegibilidade do evento
    const { data: evento, error: evErr } = await ctx.admin
      .from('eventos')
      .select('id, titulo, data_inicio, data_fim, status, ministry_id')
      .eq('id', eventoId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (evErr || !evento) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    const elegibilidade = isEventoElegivelCheckin(evento);
    if (!elegibilidade.elegivel) {
      return NextResponse.json(
        { error: elegibilidade.motivo || 'Evento não elegível para check-in.', code: 'EVENTO_INATIVO' },
        { status: 400 }
      );
    }

    // Calcular data de expiração: data_fim + 48h ou data_inicio + 7 dias
    const dataRef = evento.data_fim ? new Date(evento.data_fim) : new Date(evento.data_inicio);
    const expiraDate = new Date(Math.max(dataRef.getTime() + 48 * 60 * 60 * 1000, Date.now() + 7 * 24 * 60 * 60 * 1000));
    const expiraEm = expiraDate.toISOString();

    const rawToken = gerarTokenCheckinEvento(evento.id, expiraDate.getTime());
    const tokenHash = hashTokenCheckinEvento(rawToken);

    // Tentar persistir na tabela de auditoria se ela existir (não bloqueia se não existir)
    try {
      await ctx.admin
        .from('eventos_checkin_tokens')
        .insert({
          ministry_id: ctx.ministryId,
          evento_id: eventoId,
          token_hash: tokenHash,
          status: 'ativo',
          expira_em: expiraEm,
        });
    } catch {
      // safe fallback
    }

    const url = new URL(request.url);
    const origin = url.origin;
    const linkPublico = `${origin}/eventos/check-in/${rawToken}`;

    return NextResponse.json({
      token: rawToken,
      url: linkPublico,
      expira_em: expiraEm,
      status: 'ativo',
      evento: {
        id: evento.id,
        titulo: evento.titulo,
        data_inicio: evento.data_inicio,
        status: evento.status,
      },
    });
  } catch (err: any) {
    console.error('[EventosCheckin] Erro na rota de token:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao processar token de check-in.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/eventos/[id]/checkin/token
 * Ações: 'gerar' ou 'revogar'
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventoId } = await props.params;
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json(
        { error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action || 'gerar';
    const agoraIso = new Date().toISOString();

    if (action === 'revogar') {
      try {
        await ctx.admin
          .from('eventos_checkin_tokens')
          .update({ status: 'revogado', revogado_em: agoraIso, revogado_por: ctx.userId })
          .eq('evento_id', eventoId)
          .eq('ministry_id', ctx.ministryId)
          .eq('status', 'ativo');
      } catch {
        // safe fallback
      }

      return NextResponse.json({ status: 'revogado', mensagem: 'Links públicos de check-in revogados com sucesso.' });
    }

    const { data: evento } = await ctx.admin
      .from('eventos')
      .select('id, titulo, data_inicio, data_fim, status, ministry_id')
      .eq('id', eventoId)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (!evento) {
      return NextResponse.json({ error: 'Evento não encontrado.' }, { status: 404 });
    }

    const dataRef = evento.data_fim ? new Date(evento.data_fim) : new Date(evento.data_inicio);
    const expiraDate = new Date(Math.max(dataRef.getTime() + 48 * 60 * 60 * 1000, Date.now() + 7 * 24 * 60 * 60 * 1000));
    const expiraEm = expiraDate.toISOString();

    const rawToken = gerarTokenCheckinEvento(evento.id, expiraDate.getTime());
    const tokenHash = hashTokenCheckinEvento(rawToken);

    try {
      await ctx.admin
        .from('eventos_checkin_tokens')
        .update({ status: 'revogado', revogado_em: agoraIso, revogado_por: ctx.userId })
        .eq('evento_id', eventoId)
        .eq('ministry_id', ctx.ministryId)
        .eq('status', 'ativo');

      await ctx.admin.from('eventos_checkin_tokens').insert({
        ministry_id: ctx.ministryId,
        evento_id: eventoId,
        token_hash: tokenHash,
        status: 'ativo',
        expira_em: expiraEm,
      });
    } catch {
      // safe fallback
    }

    const url = new URL(request.url);
    const origin = url.origin;
    const linkPublico = `${origin}/eventos/check-in/${rawToken}`;

    return NextResponse.json({
      token: rawToken,
      url: linkPublico,
      expira_em: expiraEm,
      status: 'ativo',
      evento: {
        id: evento.id,
        titulo: evento.titulo,
        data_inicio: evento.data_inicio,
        status: evento.status,
      },
    });
  } catch (err: any) {
    console.error('[EventosCheckin] Erro na geração do token:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao processar ação de token.' },
      { status: 500 }
    );
  }
}
