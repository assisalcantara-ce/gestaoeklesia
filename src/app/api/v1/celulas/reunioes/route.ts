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
    const dataInicio = searchParams.get('data_inicio');
    const dataFim = searchParams.get('data_fim');
    const status = searchParams.get('status');

    let filterCongregacaoId = searchParams.get('congregacao_id');
    if (congregacaoId) {
      filterCongregacaoId = congregacaoId;
    }

    const service = new CelulasService(admin);
    const reunioes = await service.listarReunioes(ministryId, {
      celula_id: celulaId,
      congregacao_id: filterCongregacaoId,
      data_inicio: dataInicio,
      data_fim: dataFim,
      status,
    });

    return NextResponse.json({ data: reunioes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao listar reuniões' }, { status: 500 });
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

  const { admin, ministryId, nivel, userId, congregacaoId } = ctx;

  if (!temAcessoEscrita(nivel, 'celulas') && !temAcessoEscrita(nivel, 'secretaria') && !temAcessoEscrita(nivel, 'secretaria_local')) {
    return NextResponse.json({ error: 'Acesso negado para registrar reuniões de células.' }, { status: 403 });
  }

  try {
    const body = await request.json();

    if (congregacaoId && body.congregacao_id && body.congregacao_id !== congregacaoId) {
      return NextResponse.json({ error: 'Você não tem permissão para registrar reuniões em outra congregação.' }, { status: 403 });
    }

    const service = new CelulasService(admin);
    const reuniao = await service.salvarReuniao(ministryId, body, userId);

    return NextResponse.json({ data: reuniao });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao salvar reunião' }, { status: 400 });
  }
}
