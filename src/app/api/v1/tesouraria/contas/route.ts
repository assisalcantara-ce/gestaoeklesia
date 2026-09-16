import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';

export const dynamic = 'force-dynamic';

function sanitizeUuid(val: any): string | null {
  if (!val || typeof val !== 'string' || !val.trim()) return null;
  return val.trim();
}

// GET /api/v1/tesouraria/contas - Lista contas/caixas do ministério
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
    .from('fin_contas')
    .select('*')
    .eq('ministry_id', ministryId)
    .eq('is_ativa', true)
    .order('nome');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}

// POST /api/v1/tesouraria/contas - Cria nova conta/caixa
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

  const {
    nome,
    tipo,
    banco,
    agencia,
    conta,
    chave_pix,
    saldo_inicial,
    is_padrao,
    is_ativa,
    congregacao_id,
    departamento_id,
  } = body;

  if (!nome || typeof nome !== 'string' || !nome.trim()) {
    return NextResponse.json({ error: 'Nome da conta é obrigatório.' }, { status: 400 });
  }

  const tipoConta = tipo && typeof tipo === 'string' && tipo.trim() ? tipo.trim() : 'conta_corrente';
  const saldoIniNum = typeof saldo_inicial === 'string'
    ? parseFloat(saldo_inicial.replace(',', '.')) || 0
    : (typeof saldo_inicial === 'number' ? saldo_inicial : 0);

  // Se marcada como padrão, desmarcar outras contas do ministério
  if (is_padrao) {
    await admin
      .from('fin_contas')
      .update({ is_padrao: false, updated_at: new Date().toISOString() })
      .eq('ministry_id', ministryId);
  }

  const { data, error } = await admin
    .from('fin_contas')
    .insert({
      ministry_id: ministryId,
      nome: nome.trim(),
      tipo: tipoConta,
      banco: banco && typeof banco === 'string' && banco.trim() ? banco.trim() : null,
      agencia: agencia && typeof agencia === 'string' && agencia.trim() ? agencia.trim() : null,
      conta: conta && typeof conta === 'string' && conta.trim() ? conta.trim() : null,
      chave_pix: chave_pix && typeof chave_pix === 'string' && chave_pix.trim() ? chave_pix.trim() : null,
      saldo_inicial: saldoIniNum,
      is_padrao: !!is_padrao,
      is_ativa: is_ativa !== undefined ? !!is_ativa : true,
      congregacao_id: sanitizeUuid(congregacao_id),
      departamento_id: sanitizeUuid(departamento_id),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}

// PUT /api/v1/tesouraria/contas?id=... - Atualiza conta existente
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
    return NextResponse.json({ error: 'ID da conta não informado.' }, { status: 400 });
  }

  // 1. Verificar se a conta existe e pertence ao tenant
  const { data: existingConta, error: fetchErr } = await admin
    .from('fin_contas')
    .select('id, ministry_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!existingConta || existingConta.ministry_id !== ministryId) {
    return NextResponse.json(
      { error: 'Conta não encontrada ou sem permissão para alterá-la.' },
      { status: 403 }
    );
  }

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido.' }, { status: 400 });
  }

  const {
    nome,
    tipo,
    banco,
    agencia,
    conta,
    chave_pix,
    saldo_inicial,
    is_padrao,
    is_ativa,
    congregacao_id,
    departamento_id,
  } = body;

  if (!nome || typeof nome !== 'string' || !nome.trim()) {
    return NextResponse.json({ error: 'Nome da conta é obrigatório.' }, { status: 400 });
  }

  const tipoConta = tipo && typeof tipo === 'string' && tipo.trim() ? tipo.trim() : 'conta_corrente';
  const saldoIniNum = typeof saldo_inicial === 'string'
    ? parseFloat(saldo_inicial.replace(',', '.')) || 0
    : (typeof saldo_inicial === 'number' ? saldo_inicial : 0);

  // Se marcada como padrão, desmarcar outras contas do ministério
  if (is_padrao) {
    await admin
      .from('fin_contas')
      .update({ is_padrao: false, updated_at: new Date().toISOString() })
      .eq('ministry_id', ministryId);
  }

  const { data, error } = await admin
    .from('fin_contas')
    .update({
      nome: nome.trim(),
      tipo: tipoConta,
      banco: banco && typeof banco === 'string' && banco.trim() ? banco.trim() : null,
      agencia: agencia && typeof agencia === 'string' && agencia.trim() ? agencia.trim() : null,
      conta: conta && typeof conta === 'string' && conta.trim() ? conta.trim() : null,
      chave_pix: chave_pix && typeof chave_pix === 'string' && chave_pix.trim() ? chave_pix.trim() : null,
      saldo_inicial: saldoIniNum,
      is_padrao: !!is_padrao,
      is_ativa: is_ativa !== undefined ? !!is_ativa : true,
      congregacao_id: sanitizeUuid(congregacao_id),
      departamento_id: sanitizeUuid(departamento_id),
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

// DELETE /api/v1/tesouraria/contas?id=... - Exclui ou desativa conta
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
    return NextResponse.json({ error: 'ID da conta não informado.' }, { status: 400 });
  }

  // 1. Verificar se a conta existe e pertence ao tenant
  const { data: existingConta, error: fetchErr } = await admin
    .from('fin_contas')
    .select('id, nome, ministry_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!existingConta || existingConta.ministry_id !== ministryId) {
    return NextResponse.json(
      { error: 'Conta não encontrada ou sem permissão para excluí-la.' },
      { status: 403 }
    );
  }

  // 2. Proteção de integridade: verificar se há lançamentos vinculados
  const { count: lancCount, error: countErr } = await admin
    .from('tesouraria_lancamentos')
    .select('id', { count: 'exact', head: true })
    .eq('conta_id', id)
    .eq('ministry_id', ministryId);

  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }

  if (lancCount && lancCount > 0) {
    return NextResponse.json(
      {
        error: `Não é possível excluir a conta "${existingConta.nome}" pois existem ${lancCount} lançamento(s) financeiro(s) vinculado(s) a ela. Para manter o histórico contábil, desative a conta na edição.`,
      },
      { status: 400 }
    );
  }

  // 3. Excluir conta
  const { error } = await admin
    .from('fin_contas')
    .delete()
    .eq('id', id)
    .eq('ministry_id', ministryId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
