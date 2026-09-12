/**
 * API ROUTE: Consulta Paginada de Cadastros Incompletos para Auditoria da Secretaria
 * GET /api/v1/secretaria/relatorios/incomplete-profiles
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { isLocalNivel } from '@/lib/access-control';
import { SecretaryReportsService } from '@/services/secretary-reports-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // ── 1. Autenticação e contexto multi-tenant ──────────────────────────────
  let context: Awaited<ReturnType<typeof resolveTenantAuth>>;
  try {
    context = await resolveTenantAuth(request);
  } catch (err: any) {
    const isUnauth = err?.message === 'UNAUTHORIZED';
    return NextResponse.json(
      { error: isUnauth ? 'Não autenticado.' : 'Acesso negado: sem ministério associado.' },
      { status: isUnauth ? 401 : 403 }
    );
  }

  const { admin, ministryId, nivel, congregacaoId: userCongregacaoId } = context;

  // ── 2. Parâmetros ────────────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const pendencia = searchParams.get('pendencia') as any;
  const requestedCongregacaoId = searchParams.get('congregacao_id');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '25', 10);
  const exportAll = searchParams.get('export') === 'true';

  let effectiveCongregacaoId: string | null = null;

  if (isLocalNivel(nivel)) {
    effectiveCongregacaoId = userCongregacaoId;
  } else if (requestedCongregacaoId && requestedCongregacaoId !== 'todas') {
    effectiveCongregacaoId = requestedCongregacaoId;
  }

  // ── 3. Execução no Service ───────────────────────────────────────────────
  try {
    const service = new SecretaryReportsService(admin);

    const result = await service.getIncompleteProfiles(ministryId, {
      congregacaoId: effectiveCongregacaoId,
      pendencia: pendencia || 'qualquer',
      page: exportAll ? 1 : page,
      limit: exportAll ? 2000 : limit,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao consultar auditoria de cadastros incompletos.',
      },
      { status: 500 }
    );
  }
}
