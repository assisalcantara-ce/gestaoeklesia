import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { temAcesso, temAcessoEscrita } from '@/lib/access-control';
import { CelulasService } from '@/services/celulas-service';

export const dynamic = 'force-dynamic';

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

  const { admin, ministryId, nivel, congregacaoId } = ctx;

  if (!temAcesso(nivel, 'celulas') && !temAcesso(nivel, 'secretaria') && !temAcesso(nivel, 'secretaria_local')) {
    return NextResponse.json({ error: 'Acesso negado ao módulo de Células.' }, { status: 403 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const celulaId = searchParams.get('celula_id');
    const status = searchParams.get('status');
    const busca = searchParams.get('busca');

    let filterCongregacaoId = searchParams.get('congregacao_id');
    if (congregacaoId) {
      filterCongregacaoId = congregacaoId;
    }

    const service = new CelulasService(admin);
    const participantes = await service.listarParticipantes(ministryId, {
      celula_id: celulaId,
      congregacao_id: filterCongregacaoId,
      status,
      busca,
    });

    return NextResponse.json({ data: participantes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao listar participantes' }, { status: 500 });
  }
}

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

  const { admin, ministryId, nivel, congregacaoId } = ctx;

  if (!temAcessoEscrita(nivel, 'celulas') && !temAcessoEscrita(nivel, 'secretaria') && !temAcessoEscrita(nivel, 'secretaria_local')) {
    return NextResponse.json({ error: 'Acesso negado para gerenciar participantes de células.' }, { status: 403 });
  }

  try {
    const body = await request.json();

    if (congregacaoId && body.congregacao_id && body.congregacao_id !== congregacaoId) {
      return NextResponse.json({ error: 'Você não tem permissão para vincular participantes em outra congregação.' }, { status: 403 });
    }

    const service = new CelulasService(admin);
    const participante = await service.salvarParticipante(ministryId, body);

    return NextResponse.json({ data: participante });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao salvar participante' }, { status: 400 });
  }
}

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

  const { admin, ministryId, nivel } = ctx;

  if (!temAcessoEscrita(nivel, 'celulas') && !temAcessoEscrita(nivel, 'secretaria') && !temAcessoEscrita(nivel, 'secretaria_local')) {
    return NextResponse.json({ error: 'Acesso negado para remover participante de célula.' }, { status: 403 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID do participante é obrigatório.' }, { status: 400 });
    }

    const { error } = await admin
      .from('celulas_participantes')
      .delete()
      .eq('id', id)
      .eq('ministry_id', ministryId);

    if (error) {
      throw new Error(`Erro ao excluir participante: ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao remover participante' }, { status: 400 });
  }
}
