/**
 * GET  /api/v1/ministry/payment-destinations/[id]
 * PUT  /api/v1/ministry/payment-destinations/[id]
 * DELETE /api/v1/ministry/payment-destinations/[id]
 *
 * Permissões:
 *   GET:    administrador | financeiro | financeiro_local
 *   PUT:    administrador | financeiro
 *   DELETE: administrador  (soft-delete via is_ativo = false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest, context: Ctx) {
  const { id } = await context.params;
  const ctx = await resolveTenantAuth(request);

  if (!ctx.ministryId) {
    return NextResponse.json({ error: 'Sem ministério.' }, { status: 403 });
  }

  const { data, error } = await ctx.admin
    .from('fin_payment_destinations')
    .select('*, congregacoes(nome)')
    .eq('id', id)
    .eq('ministry_id', ctx.ministryId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'Destino não encontrado.' }, { status: 404 });
  }

  return NextResponse.json({ data });
}

// ─── PUT ──────────────────────────────────────────────────────────────────────
export async function PUT(request: NextRequest, context: Ctx) {
  const { id } = await context.params;
  const ctx = await resolveTenantAuth(request);

  if (!ctx.ministryId) {
    return NextResponse.json({ error: 'Sem ministério.' }, { status: 403 });
  }

  const canEdit =
    ctx.isOwner ||
    ctx.nivel === 'administrador' ||
    ctx.nivel === 'financeiro';

  if (!canEdit) {
    return NextResponse.json({ error: 'Sem permissão para editar destinos.' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const ALLOWED = [
    'label',
    'descricao',
    'tipo_recebimento',
    'congregacao_id',
    'conta_id',
    'categoria_id',
    'valor_fixo',
    'is_ativo',
    'expires_at',
    'cor',
    'icone',
  ] as const;

  const TIPOS_VALIDOS = ['dizimo', 'oferta', 'missoes', 'doacao', 'campanha_local', 'evento_local'];

  if ('tipo_recebimento' in body && !TIPOS_VALIDOS.includes(String(body.tipo_recebimento))) {
    return NextResponse.json({ error: 'Tipo de recebimento inválido.' }, { status: 400 });
  }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of ALLOWED) {
    if (field in body) {
      payload[field] = body[field] === '' ? null : body[field];
    }
  }

  const { data, error } = await ctx.admin
    .from('fin_payment_destinations')
    .update(payload)
    .eq('id', id)
    .eq('ministry_id', ctx.ministryId)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Erro ao atualizar destino.', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// ─── DELETE — soft delete ─────────────────────────────────────────────────────
export async function DELETE(request: NextRequest, context: Ctx) {
  const { id } = await context.params;
  const ctx = await resolveTenantAuth(request);

  if (!ctx.ministryId) {
    return NextResponse.json({ error: 'Sem ministério.' }, { status: 403 });
  }

  const canDelete = ctx.isOwner || ctx.nivel === 'administrador';
  if (!canDelete) {
    return NextResponse.json(
      { error: 'Somente ADMINISTRADOR pode desativar destinos permanentemente.' },
      { status: 403 }
    );
  }

  const { error } = await ctx.admin
    .from('fin_payment_destinations')
    .update({ is_ativo: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('ministry_id', ctx.ministryId);

  if (error) {
    return NextResponse.json({ error: 'Erro ao desativar destino.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
