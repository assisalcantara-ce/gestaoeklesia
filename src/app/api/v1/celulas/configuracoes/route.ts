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

  if (!temAcesso(nivel, 'celulas') && !temAcesso(nivel, 'secretaria') && !temAcesso(nivel, 'secretaria_local')) {
    return NextResponse.json({ error: 'Acesso negado ao módulo de Células.' }, { status: 403 });
  }

  try {
    const service = new CelulasService(admin);
    const config = await service.obterConfiguracao(ministryId);
    return NextResponse.json({ success: true, data: config });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao carregar configurações de células.' }, { status: 500 });
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

  // Apenas perfis globais de escrita podem alterar a metodologia ou configurações gerais
  if (!temAcessoEscrita(nivel, 'celulas') && !temAcessoEscrita(nivel, 'secretaria')) {
    return NextResponse.json({ error: 'Você não tem permissão para alterar as configurações gerais do módulo.' }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
  }

  try {
    const service = new CelulasService(admin);
    const config = await service.salvarConfiguracao(ministryId, body);
    return NextResponse.json({ success: true, data: config });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao salvar configurações.' }, { status: 400 });
  }
}
