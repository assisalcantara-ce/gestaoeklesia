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
    const redeId = searchParams.get('rede_id');
    const status = searchParams.get('status');
    const busca = searchParams.get('busca');

    // Se o operador for de nível local, força restrição pela congregação vinculada
    let filterCongregacaoId = searchParams.get('congregacao_id');
    if (congregacaoId) {
      filterCongregacaoId = congregacaoId;
    }

    const service = new CelulasService(admin);
    const celulas = await service.listarCelulas(ministryId, {
      congregacao_id: filterCongregacaoId,
      rede_id: redeId,
      status: status,
      busca: busca,
    });

    return NextResponse.json({ success: true, data: celulas });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao carregar células.' }, { status: 500 });
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
    return NextResponse.json({ error: 'Você não tem permissão para cadastrar células.' }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  // Operador local não pode vincular células a outras congregações
  if (congregacaoId && body.congregacao_id && body.congregacao_id !== congregacaoId) {
    return NextResponse.json({ error: 'Operador local só pode cadastrar células da sua congregação.' }, { status: 403 });
  }

  try {
    const service = new CelulasService(admin);
    const celula = await service.salvarCelula(ministryId, {
      ...body,
      congregacao_id: congregacaoId || body.congregacao_id,
    });

    return NextResponse.json({ success: true, data: celula }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao salvar célula.' }, { status: 400 });
  }
}
