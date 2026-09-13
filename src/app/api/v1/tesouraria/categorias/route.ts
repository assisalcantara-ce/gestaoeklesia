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

function sanitizeUuid(val: any): string | null {
  if (!val || typeof val !== 'string' || !val.trim()) return null;
  return val.trim();
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
      codigo: codigo && typeof codigo === 'string' && codigo.trim() ? codigo.trim() : null,
      cor: cor && typeof cor === 'string' && cor.trim() ? cor.trim() : null,
      icone: icone && typeof icone === 'string' && icone.trim() ? icone.trim() : null,
      categoria_pai_id: sanitizeUuid(categoria_pai_id),
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

  // 1. Verificar se a categoria existe e pertence ao tenant
  const { data: existingCat, error: fetchErr } = await admin
    .from('fin_categorias')
    .select('id, ministry_id, is_sistema')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!existingCat) {
    return NextResponse.json({ error: 'Categoria não encontrada.' }, { status: 404 });
  }

  if (existingCat.ministry_id !== ministryId || existingCat.is_sistema) {
    return NextResponse.json(
      { error: 'Você não tem permissão para alterar esta categoria.' },
      { status: 403 }
    );
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
      codigo: codigo && typeof codigo === 'string' && codigo.trim() ? codigo.trim() : null,
      cor: cor && typeof cor === 'string' && cor.trim() ? cor.trim() : null,
      icone: icone && typeof icone === 'string' && icone.trim() ? icone.trim() : null,
      categoria_pai_id: sanitizeUuid(categoria_pai_id),
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

  // 1. Verificar se a categoria existe e pertence ao tenant
  const { data: existingCat, error: fetchErr } = await admin
    .from('fin_categorias')
    .select('id, nome, ministry_id, is_sistema')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!existingCat) {
    return NextResponse.json({ error: 'Categoria não encontrada.' }, { status: 404 });
  }

  if (existingCat.ministry_id !== ministryId || existingCat.is_sistema) {
    return NextResponse.json(
      { error: 'Não é permitido excluir categorias protegidas pelo sistema ou de outros ministérios.' },
      { status: 403 }
    );
  }

  // 2. Proteção de integridade: verificar se há lançamentos vinculados
  const { count: lancCount, error: countErr } = await admin
    .from('tesouraria_lancamentos')
    .select('id', { count: 'exact', head: true })
    .eq('categoria_id', id)
    .eq('ministry_id', ministryId);

  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }

  if (lancCount && lancCount > 0) {
    return NextResponse.json(
      {
        error: `Não é possível excluir a categoria "${existingCat.nome}" pois existem ${lancCount} lançamento(s) financeiro(s) vinculado(s) a ela. Para manter a integridade contábil, desative-a ou altere os lançamentos associados.`,
      },
      { status: 400 }
    );
  }

  // 3. Proteção de integridade: verificar se há subcategorias vinculadas
  const { count: childCount, error: childErr } = await admin
    .from('fin_categorias')
    .select('id', { count: 'exact', head: true })
    .eq('categoria_pai_id', id)
    .eq('is_ativa', true);

  if (childErr) {
    return NextResponse.json({ error: childErr.message }, { status: 500 });
  }

  if (childCount && childCount > 0) {
    return NextResponse.json(
      {
        error: `Não é possível excluir a categoria "${existingCat.nome}" pois existem ${childCount} subcategoria(s) ativa(s) vinculada(s) como filhas. Remova ou altere as subcategorias primeiro.`,
      },
      { status: 400 }
    );
  }

  // 4. Soft-delete (desativa) para preservar integridade
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
