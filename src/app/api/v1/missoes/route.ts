import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';

export const dynamic = 'force-dynamic';

const MISSIONS_RESTRICTED_RESPONSE = {
  error: 'A funcionalidade de Missões está disponível a partir do Plano Starter.',
  code: 'PLAN_RESTRICTED',
  required_plan: 'starter',
} as const;

// ─── GET /api/v1/missoes — Lista projetos missionários e estatísticas ─────────────
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json({ error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' }, { status: 403 });
    }

    // Validação da Feature Flag do Módulo Missões
    const isAllowed = await isFeatureAllowedForTenant(ctx.admin, ctx.ministryId, 'missions_module');
    if (!isAllowed) {
      return NextResponse.json(MISSIONS_RESTRICTED_RESPONSE, { status: 403 });
    }

    const { data: projetos, error } = await ctx.admin
      .from('missoes_projetos')
      .select('*')
      .eq('ministry_id', ctx.ministryId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Erro ao carregar projetos de missões.', detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: projetos ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}

// ─── POST /api/v1/missoes — Criar projeto missionário ─────────────────────────
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json({ error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' }, { status: 403 });
    }

    // Validação da Feature Flag do Módulo Missões
    const isAllowed = await isFeatureAllowedForTenant(ctx.admin, ctx.ministryId, 'missions_module');
    if (!isAllowed) {
      return NextResponse.json(MISSIONS_RESTRICTED_RESPONSE, { status: 403 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 });
    }

    const { nome, descricao, pais_regiao, status, meta_arrecadacao } = body || {};

    if (!nome) {
      return NextResponse.json({ error: 'Nome do projeto é obrigatório.' }, { status: 400 });
    }

    const payload = {
      ministry_id: ctx.ministryId,
      nome,
      descricao: descricao || null,
      pais_regiao: pais_regiao || null,
      status: status || 'planejado',
      meta_arrecadacao: meta_arrecadacao ? Number(meta_arrecadacao) : null,
      created_by: ctx.userId || null,
      created_at: new Date().toISOString(),
    };

    const { data: novoProjeto, error } = await ctx.admin
      .from('missoes_projetos')
      .insert([payload])
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Erro ao criar projeto de missões.', detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: novoProjeto }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
