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
    return NextResponse.json({ error: 'Acesso negado aos templates de células.' }, { status: 403 });
  }

  try {
    const service = new CelulasService(admin);
    const templates = await service.listarTemplates(ministryId);

    return NextResponse.json({ data: templates });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao listar templates' }, { status: 500 });
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

  if (!temAcessoEscrita(nivel, 'celulas') && !temAcessoEscrita(nivel, 'secretaria')) {
    return NextResponse.json({ error: 'Permissão de escrita negada para templates de mensagens.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const service = new CelulasService(admin);
    const salvo = await service.salvarTemplate(ministryId, body);

    return NextResponse.json({ data: salvo });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao salvar template' }, { status: 400 });
  }
}
