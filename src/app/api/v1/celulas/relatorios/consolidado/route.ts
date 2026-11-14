import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { temAcesso } from '@/lib/access-control';
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
    let filterCongregacaoId = searchParams.get('congregacao_id');

    if (congregacaoId) {
      filterCongregacaoId = congregacaoId;
    }

    const service = new CelulasService(admin);
    const consolidado = await service.obterRelatorioConsolidado(ministryId, filterCongregacaoId);

    return NextResponse.json({ data: consolidado });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao obter relatório consolidado' }, { status: 500 });
  }
}
