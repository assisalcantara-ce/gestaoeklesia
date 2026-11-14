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
    return NextResponse.json({ error: 'Acesso negado ao módulo de células.' }, { status: 403 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const celulaId = searchParams.get('celula_id');
    const status = searchParams.get('status');
    const apenasApoio = searchParams.get('apenas_apoio') === 'true';

    let filterCongregacaoId = searchParams.get('congregacao_id');
    if (congregacaoId) {
      filterCongregacaoId = congregacaoId;
    }

    const service = new CelulasService(admin);
    const supervisoes = await service.listarSupervisoes(ministryId, {
      celulaId,
      congregacaoId: filterCongregacaoId,
      status,
      apenasComApoioSolicitado: apenasApoio,
    });

    return NextResponse.json({ data: supervisoes });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao listar supervisões pastorais' }, { status: 500 });
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

  const { admin, ministryId, nivel, congregacaoId, userId } = ctx;

  if (!temAcessoEscrita(nivel, 'celulas') && !temAcessoEscrita(nivel, 'secretaria') && !temAcessoEscrita(nivel, 'secretaria_local')) {
    return NextResponse.json({ error: 'Permissão de escrita negada para supervisão de células.' }, { status: 403 });
  }

  try {
    const body = await request.json();

    if (congregacaoId && body.congregacao_id && body.congregacao_id !== congregacaoId) {
      return NextResponse.json({ error: 'Acesso restrito à sua congregação local.' }, { status: 403 });
    }

    const service = new CelulasService(admin);
    const salvo = await service.salvarSupervisao(ministryId, body, userId);

    return NextResponse.json({ data: salvo });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao registrar supervisão pastoral' }, { status: 400 });
  }
}
