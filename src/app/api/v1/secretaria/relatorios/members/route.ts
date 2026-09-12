/**
 * API ROUTE: Consulta Paginada de Membros para a Central de Relatórios
 * GET /api/v1/secretaria/relatorios/members
 *
 * Multi-tenancy & Segurança:
 * - O `ministry_id` é resolvido no servidor via resolveTenantAuth (ministry_users ou owner).
 * - Usuários locais têm restrição estrita de congregacao_id.
 * - Suporta busca, filtros múltiplos e paginação server-side.
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

  // ── 2. Parâmetros de busca e filtros ─────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || undefined;
  const status = searchParams.get('status') || undefined;
  const tipo_cadastro = searchParams.get('tipo_cadastro') || undefined;
  const requestedCongregacaoId = searchParams.get('congregacao_id');
  const sexo = searchParams.get('sexo') || undefined;
  const estado_civil = searchParams.get('estado_civil') || undefined;
  const cargo_ministerial = searchParams.get('cargo_ministerial') || undefined;
  const tem_funcao_igreja = searchParams.get('tem_funcao_igreja') !== null && searchParams.get('tem_funcao_igreja') !== 'todos'
    ? searchParams.get('tem_funcao_igreja') === 'true'
    : undefined;
  const batizado_aguas = searchParams.get('batizado_aguas') !== null && searchParams.get('batizado_aguas') !== 'todos'
    ? searchParams.get('batizado_aguas') === 'true'
    : undefined;
  const batizado_espirito_santo = searchParams.get('batizado_espirito_santo') !== null && searchParams.get('batizado_espirito_santo') !== 'todos'
    ? searchParams.get('batizado_espirito_santo') === 'true'
    : undefined;
  const tem_curso_teologico = searchParams.get('tem_curso_teologico') !== null && searchParams.get('tem_curso_teologico') !== 'todos'
    ? searchParams.get('tem_curso_teologico') === 'true'
    : undefined;
  const procedencia = searchParams.get('procedencia') || undefined;
  const qualidade_cadastral = searchParams.get('qualidade_cadastral') as any;
  const faixa_etaria = searchParams.get('faixa_etaria') as any;
  const sortBy = searchParams.get('sortBy') || undefined;
  const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || undefined;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '25', 10);
  const exportAll = searchParams.get('export') === 'true';

  let effectiveCongregacaoId: string | undefined = undefined;

  if (isLocalNivel(nivel)) {
    effectiveCongregacaoId = userCongregacaoId || undefined;
  } else if (requestedCongregacaoId && requestedCongregacaoId !== 'todas') {
    effectiveCongregacaoId = requestedCongregacaoId;
  }

  // ── 3. Execução no Service ───────────────────────────────────────────────
  try {
    const service = new SecretaryReportsService(admin);

    const result = await service.queryCustomMembersList(ministryId, {
      search,
      status: status !== 'todos' ? status : undefined,
      tipo_cadastro: tipo_cadastro !== 'todos' ? tipo_cadastro : undefined,
      congregacao_id: effectiveCongregacaoId,
      sexo: sexo !== 'todos' ? sexo : undefined,
      estado_civil: estado_civil !== 'todos' ? estado_civil : undefined,
      cargo_ministerial: cargo_ministerial !== 'todos' ? cargo_ministerial : undefined,
      tem_funcao_igreja,
      batizado_aguas,
      batizado_espirito_santo,
      tem_curso_teologico,
      procedencia,
      qualidade_cadastral: qualidade_cadastral !== 'todos' ? qualidade_cadastral : undefined,
      faixa_etaria: faixa_etaria !== 'todos' ? faixa_etaria : undefined,
      sortBy,
      sortOrder,
      page: exportAll ? 1 : page,
      limit: exportAll ? 5000 : limit,
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
        error: error.message || 'Erro ao consultar relação de membros.',
      },
      { status: 500 }
    );
  }
}
