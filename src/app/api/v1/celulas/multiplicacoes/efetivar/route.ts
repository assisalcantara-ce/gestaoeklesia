import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { temAcessoEscrita } from '@/lib/access-control';
import { CelulasService } from '@/services/celulas-service';

export const dynamic = 'force-dynamic';

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

  const { admin, ministryId, nivel, userId } = ctx;

  if (!temAcessoEscrita(nivel, 'celulas') && !temAcessoEscrita(nivel, 'secretaria')) {
    return NextResponse.json({ error: 'Permissão negada para efetivar multiplicação.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const service = new CelulasService(admin);
    const resultado = await service.efetivarMultiplicacao(ministryId, body, userId);

    return NextResponse.json({ data: resultado });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao efetivar multiplicação' }, { status: 400 });
  }
}
