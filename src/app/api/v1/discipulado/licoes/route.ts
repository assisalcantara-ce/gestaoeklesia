import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { temAcesso } from '@/lib/access-control';
import { DiscipuladoPedagogicoService } from '@/services/discipulado-pedagogico-service';

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

  const { admin, nivel } = ctx;

  if (!temAcesso(nivel, 'secretaria') && !temAcesso(nivel, 'secretaria_local') && !temAcesso(nivel, 'acolhimento')) {
    return NextResponse.json({ error: 'Acesso negado ao catálogo de lições.' }, { status: 403 });
  }

  try {
    const licoes = await DiscipuladoPedagogicoService.listarCatalogoLicoes(admin);
    return NextResponse.json({ licoes });
  } catch (err: any) {
    console.error('[GET /api/v1/discipulado/licoes]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao consultar catálogo de lições.' },
      { status: 500 }
    );
  }
}
