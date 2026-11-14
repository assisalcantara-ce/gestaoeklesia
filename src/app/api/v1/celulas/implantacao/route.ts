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

  const { admin, ministryId, nivel } = ctx;

  // Verificação RBAC: Somente administradores ou liderança pastoral
  if (!temAcesso(nivel, 'celulas') && !temAcesso(nivel, 'secretaria')) {
    return NextResponse.json({ error: 'Acesso negado ao assistente de implantação.' }, { status: 403 });
  }

  try {
    const service = new CelulasService(admin);
    const status = await service.obterStatusImplantacao(ministryId);
    return NextResponse.json({ success: true, data: status });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro ao consultar status de implantação.' },
      { status: 500 }
    );
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

  const { admin, ministryId, nivel } = ctx;

  // Apenas perfis globais autorizados podem ativar/desativar o módulo
  if (!temAcessoEscrita(nivel, 'celulas') && !temAcessoEscrita(nivel, 'secretaria')) {
    return NextResponse.json({ error: 'Permissão negada para alterar ativação do módulo.' }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  const ativar = typeof body?.ativar === 'boolean' ? body.ativar : true;

  try {
    const service = new CelulasService(admin);
    const configAtualizada = await service.alternarAtivacaoModulo(ministryId, ativar);
    return NextResponse.json({ success: true, data: configAtualizada });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro ao atualizar ativação do módulo.' },
      { status: 400 }
    );
  }
}
