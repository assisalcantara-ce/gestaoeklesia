import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';

export const dynamic = 'force-dynamic';

// GET /api/v1/tesouraria/categorias - Lista categorias financeiras do ministério (e do sistema)
export async function GET(request: NextRequest) {
  let ctx: Awaited<ReturnType<typeof resolveTenantAuth>>;
  try {
    ctx = await resolveTenantAuth(request);
  } catch (err: any) {
    const isUnauth = err?.message === 'UNAUTHORIZED';
    return NextResponse.json(
      { error: isUnauth ? 'Não autenticado.' : 'Acesso negado: sem ministério associado.' },
      { status: isUnauth ? 401 : 403 }
    );
  }

  const { admin, ministryId } = ctx;

  const { data, error } = await admin
    .from('fin_categorias')
    .select('*')
    .or(`ministry_id.is.null,ministry_id.eq.${ministryId}`)
    .eq('is_ativa', true)
    .order('nome');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}

// POST /api/v1/tesouraria/categorias - Cria nova categoria financeira customizada
export async function POST(request: NextRequest) {
  let ctx: Awaited<ReturnType<typeof resolveTenantAuth>>;
  try {
    ctx = await resolveTenantAuth(request);
  } catch (err: any) {
    const isUnauth = err?.message === 'UNAUTHORIZED';
    return NextResponse.json(
      { error: isUnauth ? 'Não autenticado.' : 'Acesso negado: sem ministério associado.' },
      { status: isUnauth ? 401 : 403 }
    );
  }

  const { admin, ministryId } = ctx;

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido.' }, { status: 400 });
  }

  const { nome, tipo_movimento, codigo, cor, icone, categoria_pai_id } = body;

  if (!nome || typeof nome !== 'string' || !nome.trim()) {
    return NextResponse.json({ error: 'Nome da categoria é obrigatório.' }, { status: 400 });
  }

  const tipo = ['entrada', 'saida', 'ambos'].includes(tipo_movimento) ? tipo_movimento : 'entrada';

  const { data, error } = await admin
    .from('fin_categorias')
    .insert({
      ministry_id: ministryId,
      nome: nome.trim(),
      tipo_movimento: tipo,
      codigo: codigo ? String(codigo).trim() : null,
      cor: cor ? String(cor).trim() : null,
      icone: icone ? String(icone).trim() : null,
      categoria_pai_id: categoria_pai_id ?? null,
      is_sistema: false,
      is_ativa: true,
      modulo_origem: 'tesouraria',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}

// PUT /api/v1/tesouraria/categorias?id=... - Atualiza categoria existente
export async function PUT(request: NextRequest) {
  let ctx: Awaited<ReturnType<typeof resolveTenantAuth>>;
  try {
    ctx = await resolveTenantAuth(request);
  } catch (err: any) {
    const isUnauth = err?.message === 'UNAUTHORIZED';
    return NextResponse.json(
      { error: isUnauth ? 'Não autenticado.' : 'Acesso negado: sem ministério associado.' },
      { status: isUnauth ? 401 : 403 }
    );
  }

  const { admin, ministryId } = ctx;
  const id = request.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID da categoria não informado.' }, { status: 400 });
  }

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido.' }, { status: 400 });
  }

  const { nome, tipo_movimento, codigo, cor, icone, categoria_pai_id } = body;

  if (!nome || typeof nome !== 'string' || !nome.trim()) {
    return NextResponse.json({ error: 'Nome da categoria é obrigatório.' }, { status: 400 });
  }

  const tipo = ['entrada', 'saida', 'ambos'].includes(tipo_movimento) ? tipo_movimento : 'entrada';

  const { data, error } = await admin
    .from('fin_categorias')
    .update({
      nome: nome.trim(),
      tipo_movimento: tipo,
      codigo: codigo ? String(codigo).trim() : null,
      cor: cor ? String(cor).trim() : null,
      icone: icone ? String(icone).trim() : null,
      categoria_pai_id: categoria_pai_id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('ministry_id', ministryId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}

// DELETE /api/v1/tesouraria/categorias?id=... - Exclui (ou desativa) categoria do ministério
export async function DELETE(request: NextRequest) {
  let ctx: Awaited<ReturnType<typeof resolveTenantAuth>>;
  try {
    ctx = await resolveTenantAuth(request);
  } catch (err: any) {
    const isUnauth = err?.message === 'UNAUTHORIZED';
    return NextResponse.json(
      { error: isUnauth ? 'Não autenticado.' : 'Acesso negado: sem ministério associado.' },
      { status: isUnauth ? 401 : 403 }
    );
  }

  const { admin, ministryId } = ctx;
  const id = request.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID da categoria não informado.' }, { status: 400 });
  }

  // Soft-delete (desativa) para preservar histórico
  const { error } = await admin
    .from('fin_categorias')
    .update({ is_ativa: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('ministry_id', ministryId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
