/**
 * API ROUTE: Cadastro de Lançamentos Financeiros da Tesouraria
 * GET /api/v1/tesouraria/lancamentos?action=proximo_codigo&data=YYYY-MM-DD
 * POST /api/v1/tesouraria/lancamentos
 * PUT /api/v1/tesouraria/lancamentos?id=...
 * DELETE /api/v1/tesouraria/lancamentos?id=...
 *
 * Multi-tenancy:
 * - O ministry_id é resolvido no servidor via resolveTenantAuth (ministry_users ou owner).
 * - Nunca confia em ministry_id vindo do cliente.
 *
 * Arquitetura:
 * - route.ts → TesourariaService → TesourariaRepository → tesouraria_lancamentos
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { TesourariaService } from '@/services/TesourariaService';

export const dynamic = 'force-dynamic';

// GET /api/v1/tesouraria/lancamentos?action=proximo_codigo&data=YYYY-MM-DD
export async function GET(request: NextRequest) {
  let context: Awaited<ReturnType<typeof resolveTenantAuth>>;
  try {
    context = await resolveTenantAuth(request);
  } catch (err: any) {
    const isUnauth = err?.message === 'UNAUTHORIZED';
    return NextResponse.json(
      { error: isUnauth ? 'Não autenticado.' : 'Acesso negado: sem ministério associado.' },
      { status: isUnauth ? 401 : 403 }
    );
  }

  const { admin, ministryId } = context;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'proximo_codigo') {
    try {
      const dataRef = searchParams.get('data') || undefined;
      const service = new TesourariaService(admin);
      const proximoCodigo = await service.obterProximoCodigo(ministryId, dataRef);
      return NextResponse.json({ codigo: proximoCodigo });
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || 'Erro ao gerar código' }, { status: 500 });
    }
  }

  if (action === 'verificar_codigo') {
    try {
      const codigo = searchParams.get('codigo') || '';
      const excludeId = searchParams.get('exclude_id') || undefined;
      const service = new TesourariaService(admin);
      const exists = await service.verificarCodigoExiste(ministryId, codigo, excludeId);
      return NextResponse.json({ exists, codigo });
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || 'Erro ao verificar código' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  // ── 1. Autenticação e resolução do contexto multi-tenant ────────────────
  let context: Awaited<ReturnType<typeof resolveTenantAuth>>;
  try {
    context = await resolveTenantAuth(request);
  } catch (err: any) {
    const isUnauth = err?.message === 'UNAUTHORIZED';
    return NextResponse.json(
      { error: isUnauth ? 'Não autenticado.' : 'Acesso negado: sem ministério associado.' },
      { status: isUnauth ? 401 : 403 }
    );
  }

  const { admin, ministryId } = context;

  // ── 2. Leitura e validação básica do body ────────────────────────────────
  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Body inválido. Envie um JSON bem formado.' },
      { status: 400 }
    );
  }

  // Campos obrigatórios verificados antes de passar ao service
  const { data_lancamento, tipo_movimento, tipo_recebimento, valor } = body;

  if (!data_lancamento || !tipo_movimento || !tipo_recebimento || valor === undefined) {
    return NextResponse.json(
      {
        error: 'Campos obrigatórios ausentes.',
        campos_obrigatorios: ['data_lancamento', 'tipo_movimento', 'tipo_recebimento', 'valor'],
      },
      { status: 400 }
    );
  }

  // ── 3. Delegar ao service de negócio ────────────────────────────────────
  try {
    const service = new TesourariaService(admin);

    const lancamento = await service.criarLancamento(ministryId, {
      data_lancamento:      String(data_lancamento),
      tipo_movimento:       tipo_movimento as 'entrada' | 'saida',
      tipo_recebimento:     String(tipo_recebimento),
      valor:                Number(valor),
      referencia:           body.referencia    ?? null,
      observacoes:          body.observacoes   ?? null,
      descricao:            body.descricao     ?? null,
      congregacao_id:       body.congregacao_id   ?? null,
      departamento_id:      body.departamento_id  ?? null,
      conta_id:             body.conta_id         ?? null,
      categoria_id:         body.categoria_id     ?? null,
      member_id:            body.member_id         ?? null,
      codigo_registro:      body.codigo_registro   ?? null,
      permitir_duplicidade: Boolean(body.permitir_duplicidade),
    });

    return NextResponse.json(
      { success: true, data: lancamento },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[POST /api/v1/tesouraria/lancamentos]', err);
    const isDuplicate = err?.message?.includes('Já existe um lançamento registrado com este Código/ID') ||
                        err?.code === '23505' ||
                        err?.message?.includes('idx_tesouraria_lancamentos_codigo_registro');
    if (isDuplicate) {
      return NextResponse.json(
        {
          error: 'DUPLICATE_CODIGO_REGISTRO',
          message: 'Já existe um lançamento registrado com este Código / ID nesta igreja/congregação.',
          codigo: body.codigo_registro,
          requires_confirmation: true,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: err?.message || 'Erro interno ao cadastrar lançamento.' },
      { status: 400 }
    );
  }
}

export async function PUT(request: NextRequest) {
  let context: Awaited<ReturnType<typeof resolveTenantAuth>>;
  try {
    context = await resolveTenantAuth(request);
  } catch (err: any) {
    const isUnauth = err?.message === 'UNAUTHORIZED';
    return NextResponse.json(
      { error: isUnauth ? 'Não autenticado.' : 'Acesso negado: sem ministério associado.' },
      { status: isUnauth ? 401 : 403 }
    );
  }

  const { admin, ministryId } = context;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { error: 'ID do lançamento não informado no parâmetro da URL.' },
      { status: 400 }
    );
  }

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Body inválido. Envie um JSON bem formado.' },
      { status: 400 }
    );
  }

  try {
    const service = new TesourariaService(admin);

    const lancamento = await service.atualizarLancamento(id, ministryId, {
      data_lancamento:      body.data_lancamento  ? String(body.data_lancamento) : undefined,
      tipo_movimento:       body.tipo_movimento   ? (body.tipo_movimento as 'entrada' | 'saida') : undefined,
      tipo_recebimento:     body.tipo_recebimento ? String(body.tipo_recebimento) : undefined,
      valor:                body.valor !== undefined ? Number(body.valor) : undefined,
      referencia:           body.referencia,
      observacoes:          body.observacoes,
      descricao:            body.descricao,
      congregacao_id:       body.congregacao_id,
      departamento_id:      body.departamento_id,
      conta_id:             body.conta_id,
      categoria_id:         body.categoria_id,
      member_id:            body.member_id,
      codigo_registro:      body.codigo_registro !== undefined ? body.codigo_registro : undefined,
      permitir_duplicidade: Boolean(body.permitir_duplicidade),
    });

    return NextResponse.json({ success: true, data: lancamento });
  } catch (err: any) {
    console.error('[PUT /api/v1/tesouraria/lancamentos]', err);
    const isDuplicate = err?.message?.includes('Já existe um lançamento registrado com este Código/ID') ||
                        err?.code === '23505' ||
                        err?.message?.includes('idx_tesouraria_lancamentos_codigo_registro');
    if (isDuplicate) {
      return NextResponse.json(
        {
          error: 'DUPLICATE_CODIGO_REGISTRO',
          message: 'Já existe um lançamento registrado com este Código / ID nesta igreja/congregação.',
          codigo: body.codigo_registro,
          requires_confirmation: true,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: err?.message || 'Erro interno ao atualizar lançamento.' },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  let context: Awaited<ReturnType<typeof resolveTenantAuth>>;
  try {
    context = await resolveTenantAuth(request);
  } catch (err: any) {
    const isUnauth = err?.message === 'UNAUTHORIZED';
    return NextResponse.json(
      { error: isUnauth ? 'Não autenticado.' : 'Acesso negado: sem ministério associado.' },
      { status: isUnauth ? 401 : 403 }
    );
  }

  const { admin, ministryId, userId } = context;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { error: 'ID do lançamento não informado no parâmetro da URL.' },
      { status: 400 }
    );
  }

  try {
    const service = new TesourariaService(admin);
    await service.deletarLancamento(id, ministryId, userId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[DELETE /api/v1/tesouraria/lancamentos]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao excluir lançamento.' },
      { status: 400 }
    );
  }
}
