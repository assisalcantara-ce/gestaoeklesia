import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';

export const dynamic = 'force-dynamic';

// ─── GET /api/v1/agenda — Lista eventos e planejamentos da agenda ─────────────
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json({ error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' }, { status: 403 });
    }

    // Validação da Feature Flag do Módulo Agenda
    const isAllowed = await isFeatureAllowedForTenant(ctx.admin, ctx.ministryId, 'agenda_module');
    if (!isAllowed) {
      return NextResponse.json(
        {
          error: 'A funcionalidade Agenda do Ministério está disponível a partir do Plano Starter.',
          code: 'PLAN_RESTRICTED',
          required_plan: 'starter',
        },
        { status: 403 }
      );
    }

    const { data: eventos, error } = await ctx.admin
      .from('agenda_eventos')
      .select('*, agenda_tipos(*), agenda_planejamentos(*)')
      .eq('ministry_id', ctx.ministryId)
      .order('data_inicio', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Erro ao carregar eventos da agenda.', detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: eventos });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}

// ─── POST /api/v1/agenda — Criar evento na agenda ─────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json({ error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' }, { status: 403 });
    }

    // Validação da Feature Flag do Módulo Agenda
    const isAllowed = await isFeatureAllowedForTenant(ctx.admin, ctx.ministryId, 'agenda_module');
    if (!isAllowed) {
      return NextResponse.json(
        {
          error: 'A funcionalidade Agenda do Ministério está disponível a partir do Plano Starter.',
          code: 'PLAN_RESTRICTED',
          required_plan: 'starter',
        },
        { status: 403 }
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 });
    }

    const { titulo, data_inicio, data_fim, tipo_id, descricao, congregacao_id } = body || {};

    if (!titulo || !data_inicio) {
      return NextResponse.json({ error: 'Título e Data de Início são obrigatórios.' }, { status: 400 });
    }

    const payload = {
      ministry_id: ctx.ministryId,
      titulo,
      data_inicio,
      data_fim: data_fim || data_inicio,
      tipo_id: tipo_id || null,
      descricao: descricao || null,
      congregacao_id: congregacao_id || null,
      status: 'agendado',
      created_by: ctx.userId || null,
      created_at: new Date().toISOString(),
    };

    const { data: novoEvento, error } = await ctx.admin
      .from('agenda_eventos')
      .insert([payload])
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Erro ao criar evento na agenda.', detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: novoEvento }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
