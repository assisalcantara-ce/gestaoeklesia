/**
 * API ROUTE: Resumo da Central de Relatórios da Secretaria
 * GET /api/v1/secretaria/relatorios/summary
 *
 * Multi-tenancy:
 * - O `ministry_id` é resolvido no servidor via resolveTenantAuth (ministry_users ou owner).
 * - Restringe ao escopo de congregação do usuário caso seja admin_local ou financeiro_local.
 * - Suporta query param `congregacao_id` para administradores gerais que desejam filtrar uma unidade.
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

  // ── 2. Resolução de escopo de congregação ───────────────────────────────
  const { searchParams } = new URL(request.url);
  const requestedCongregacaoId = searchParams.get('congregacao_id');

  let effectiveCongregacaoId: string | null = null;

  if (isLocalNivel(nivel)) {
    // Se for usuário local, força estritamente a congregação a que ele pertence
    effectiveCongregacaoId = userCongregacaoId;
  } else if (requestedCongregacaoId && requestedCongregacaoId !== 'todas') {
    effectiveCongregacaoId = requestedCongregacaoId;
  }

  // ── 3. Execução centralizada pelo Service ────────────────────────────────
  try {
    const service = new SecretaryReportsService(admin);

    // Executar consultas gerenciais em paralelo
    const [
      executiveMetrics,
      demographics,
      growthTrends,
      lettersStats,
      baptismsAndActs,
      aniversariantesHoje,
      aniversariantesSemana,
      aniversariantesMes,
    ] = await Promise.all([
      service.getExecutiveMetrics(ministryId, effectiveCongregacaoId),
      service.getDemographicsSummary(ministryId, effectiveCongregacaoId),
      service.getGrowthTrends(ministryId, 12),
      service.getLettersStats(ministryId, effectiveCongregacaoId),
      service.getBaptismsAndActsStats(ministryId, { congregacaoId: effectiveCongregacaoId }),
      service.getBirthdays(ministryId, { tipo: 'hoje', congregacaoId: effectiveCongregacaoId }),
      service.getBirthdays(ministryId, { tipo: 'semana', congregacaoId: effectiveCongregacaoId }),
      service.getBirthdays(ministryId, { tipo: 'mes', congregacaoId: effectiveCongregacaoId }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ministryId,
        congregacaoId: effectiveCongregacaoId,
        executiveMetrics,
        demographics,
        growthTrends,
        lettersStats,
        baptismsAndActs,
        aniversariantes: {
          hoje: aniversariantesHoje,
          semana: aniversariantesSemana,
          mes: aniversariantesMes,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro ao gerar resumo da Central de Relatórios.',
      },
      { status: 500 }
    );
  }
}
