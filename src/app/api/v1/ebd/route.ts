import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';

export const dynamic = 'force-dynamic';

const EBD_RESTRICTED_RESPONSE = {
  error: 'A Escola Bíblica Dominical está disponível a partir do Plano Starter.',
  code: 'PLAN_RESTRICTED',
  required_plan: 'starter',
} as const;

// ─── GET /api/v1/ebd — Lista resumo de dados EBD do ministério ────────────────
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json({ error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' }, { status: 403 });
    }

    // Validação da Feature Flag do Módulo EBD
    const isAllowed = await isFeatureAllowedForTenant(ctx.admin, ctx.ministryId, 'ebd_module');
    if (!isAllowed) {
      return NextResponse.json(EBD_RESTRICTED_RESPONSE, { status: 403 });
    }

    // Busca resumo das turmas EBD do ministério
    const { data: turmas, error } = await ctx.admin
      .from('ebd_turmas')
      .select('id, nome, total_alunos, ativa')
      .eq('ministry_id', ctx.ministryId)
      .order('nome', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Erro ao carregar turmas EBD.', detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: turmas ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}

// ─── POST /api/v1/ebd — Criar recurso EBD ────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveTenantAuth(request);

    if (!ctx.ministryId) {
      return NextResponse.json({ error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' }, { status: 403 });
    }

    // Validação da Feature Flag do Módulo EBD
    const isAllowed = await isFeatureAllowedForTenant(ctx.admin, ctx.ministryId, 'ebd_module');
    if (!isAllowed) {
      return NextResponse.json(EBD_RESTRICTED_RESPONSE, { status: 403 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 });
    }

    const { nome, descricao } = body || {};

    if (!nome) {
      return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 });
    }

    const payload = {
      ministry_id: ctx.ministryId,
      nome,
      descricao: descricao || null,
      ativa: true,
      created_by: ctx.userId || null,
      created_at: new Date().toISOString(),
    };

    const { data: novaTurma, error } = await ctx.admin
      .from('ebd_turmas')
      .insert([payload])
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Erro ao criar turma EBD.', detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: novaTurma }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
