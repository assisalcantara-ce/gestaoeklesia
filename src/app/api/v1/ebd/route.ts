import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isFeatureAllowedForTenant } from '@/lib/plan-permissions';

export const dynamic = 'force-dynamic';

const EBD_RESTRICTED_RESPONSE = {
  error: 'A Escola Bíblica Dominical está disponível a partir do Plano Starter.',
  code: 'PLAN_RESTRICTED',
  required_plan: 'starter',
} as const;

// ─── GET /api/v1/ebd — Lista turmas EBD do ministério ─────────────────────────
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

    // Filtro opcional por congregação
    const searchParams = request.nextUrl.searchParams;
    const churchIdParam = searchParams.get('church_id') || ctx.congregacaoId;

    let query = ctx.admin
      .from('ebd_turmas')
      .select(`
        id,
        ministry_id,
        church_id,
        classe_id,
        nome,
        professor_titular_id,
        sala,
        capacidade_max,
        ativo,
        created_at,
        ebd_classes ( id, nome, cor, faixa_etaria_min, faixa_etaria_max ),
        ebd_professores ( id, nome, telefone, email ),
        congregacoes ( id, nome )
      `)
      .eq('ministry_id', ctx.ministryId);

    if (churchIdParam) {
      query = query.eq('church_id', churchIdParam);
    }

    const { data: turmas, error } = await query.order('nome', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Erro ao carregar turmas EBD.', detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: turmas ?? [] });
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Não autorizado. Faça login novamente.', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    if (err?.message === 'NO_MINISTRY') {
      return NextResponse.json({ error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' }, { status: 403 });
    }
    return NextResponse.json({ error: err?.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}

// ─── POST /api/v1/ebd — Criar turma EBD ───────────────────────────────────────
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

    const {
      nome,
      church_id,
      classe_id,
      professor_titular_id,
      sala,
      capacidade_max,
      ativo = true,
    } = body || {};

    if (!nome || typeof nome !== 'string' || !nome.trim()) {
      return NextResponse.json({ error: 'O nome da turma é obrigatório.' }, { status: 400 });
    }

    const targetChurchId = church_id || ctx.congregacaoId;
    if (!targetChurchId) {
      return NextResponse.json({ error: 'A congregação (church_id) é obrigatória.' }, { status: 400 });
    }

    const payload = {
      ministry_id: ctx.ministryId,
      church_id: targetChurchId,
      classe_id: classe_id || null,
      nome: nome.trim(),
      professor_titular_id: professor_titular_id || null,
      sala: sala || null,
      capacidade_max: capacidade_max ? parseInt(String(capacidade_max), 10) : null,
      ativo: Boolean(ativo),
    };

    const { data: novaTurma, error } = await ctx.admin
      .from('ebd_turmas')
      .insert([payload])
      .select(`
        id,
        ministry_id,
        church_id,
        classe_id,
        nome,
        professor_titular_id,
        sala,
        capacidade_max,
        ativo,
        created_at,
        ebd_classes ( id, nome, cor ),
        ebd_professores ( id, nome ),
        congregacoes ( id, nome )
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Erro ao criar turma EBD.', detail: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: novaTurma }, { status: 201 });
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Não autorizado. Faça login novamente.', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    if (err?.message === 'NO_MINISTRY') {
      return NextResponse.json({ error: 'Usuário sem ministério associado.', code: 'NO_MINISTRY' }, { status: 403 });
    }
    return NextResponse.json({ error: err?.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
