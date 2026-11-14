import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { temAcesso, temAcessoEscrita } from '@/lib/access-control';
import { CelulasService } from '@/services/celulas-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { admin, ministryId, nivel, congregacaoId } = ctx;

  if (!temAcesso(nivel, 'celulas') && !temAcesso(nivel, 'secretaria') && !temAcesso(nivel, 'secretaria_local')) {
    return NextResponse.json({ error: 'Acesso negado ao módulo de Células.' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const service = new CelulasService(admin);
    const celula = await service.obterCelulaPorId(id, ministryId);

    if (!celula) {
      return NextResponse.json({ error: 'Célula não encontrada.' }, { status: 404 });
    }

    if (congregacaoId && celula.congregacao_id && celula.congregacao_id !== congregacaoId) {
      return NextResponse.json({ error: 'Acesso negado: célula fora da sua congregação.' }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: celula });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao carregar célula.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { admin, ministryId, nivel, congregacaoId } = ctx;

  if (!temAcessoEscrita(nivel, 'celulas') && !temAcessoEscrita(nivel, 'secretaria') && !temAcessoEscrita(nivel, 'secretaria_local')) {
    return NextResponse.json({ error: 'Você não tem permissão para editar células.' }, { status: 403 });
  }

  const { id } = await params;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  const service = new CelulasService(admin);
  const existente = await service.obterCelulaPorId(id, ministryId);
  if (!existente) {
    return NextResponse.json({ error: 'Célula não encontrada.' }, { status: 404 });
  }

  if (congregacaoId && existente.congregacao_id && existente.congregacao_id !== congregacaoId) {
    return NextResponse.json({ error: 'Você não tem permissão para alterar células de outra congregação.' }, { status: 403 });
  }

  try {
    const celula = await service.salvarCelula(ministryId, {
      ...body,
      id,
      congregacao_id: congregacaoId || body.congregacao_id || existente.congregacao_id,
    });

    return NextResponse.json({ success: true, data: celula });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao atualizar célula.' }, { status: 400 });
  }
}
