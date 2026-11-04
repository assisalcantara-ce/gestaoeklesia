import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { temAcesso } from '@/lib/access-control';
import { DiscipuladoService } from '@/services/discipulado-service';

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

  // Validação de acesso ao módulo (Acolhimento ou Secretaria)
  if (!temAcesso(nivel, 'secretaria') && !temAcesso(nivel, 'secretaria_local') && !temAcesso(nivel, 'acolhimento')) {
    return NextResponse.json({ error: 'Acesso negado ao módulo de Acolhimento e Discipulado.' }, { status: 403 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const telefone = searchParams.get('telefone');

    if (!telefone) {
      return NextResponse.json(
        { error: 'Parâmetro telefone é obrigatório para busca.' },
        { status: 400 }
      );
    }

    const visitantes = await DiscipuladoService.buscarVisitantesPorTelefone(
      admin,
      ministryId,
      telefone
    );

    return NextResponse.json({ visitantes });
  } catch (err: any) {
    console.error('[GET /api/v1/discipulado/visitantes]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao buscar visitante por telefone.' },
      { status: 500 }
    );
  }
}
