import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { temAcesso } from '@/lib/access-control';

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

  if (!temAcesso(nivel, 'secretaria') && !temAcesso(nivel, 'secretaria_local') && !temAcesso(nivel, 'acolhimento')) {
    return NextResponse.json({ error: 'Acesso negado aos relatórios do Discipulado.' }, { status: 403 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const congregacaoId = searchParams.get('congregacaoId');
    const turmaId = searchParams.get('turmaId');

    // 1. Estatísticas de Jornadas
    let queryJornadas = admin
      .from('discipulado_jornadas')
      .select('id, fase, status, congregacao_id, licoes_concluidas, data_inicio, data_decisao, created_at')
      .eq('ministry_id', ministryId);

    if (congregacaoId && congregacaoId !== 'todas') {
      queryJornadas = queryJornadas.eq('congregacao_id', congregacaoId);
    }

    const { data: jornadas, error: errJornadas } = await queryJornadas;
    if (errJornadas) throw errJornadas;

    const listaJornadas = jornadas || [];
    const totalJornadas = listaJornadas.length;
    const ativas = listaJornadas.filter((j) => j.status === 'ativo').length;
    const concluidas = listaJornadas.filter((j) => j.status === 'concluido').length;
    const formacaoCompleta = listaJornadas.filter((j) => (j.licoes_concluidas || 0) >= 26).length;
    const primeirosPassos = listaJornadas.filter((j) => j.fase === 'primeiros_passos').length;
    const fundamentos = listaJornadas.filter((j) => j.fase === 'fundamentos').length;
    const batismo = listaJornadas.filter((j) => j.fase === 'preparacao_batismo').length;

    // 2. Estatísticas de Turmas
    let queryTurmas = admin
      .from('discipulado_turmas')
      .select('id, nome, status, capacidade, congregacao_id, is_intercongregacional')
      .eq('ministry_id', ministryId);

    if (congregacaoId && congregacaoId !== 'todas') {
      queryTurmas = queryTurmas.or(`congregacao_id.eq.${congregacaoId},is_intercongregacional.eq.true`);
    }

    const { data: turmas, error: errTurmas } = await queryTurmas;
    if (errTurmas) throw errTurmas;

    // 3. Frequência / Chamadas Agregadas
    let queryChamadas = admin
      .from('discipulado_turma_chamadas')
      .select('id, status_presenca, turma_id, created_at')
      .eq('ministry_id', ministryId);

    if (turmaId && turmaId !== 'todas') {
      queryChamadas = queryChamadas.eq('turma_id', turmaId);
    }

    const { data: chamadas, error: errChamadas } = await queryChamadas;
    if (errChamadas) throw errChamadas;

    const listaChamadas = chamadas || [];
    const totalChamadas = listaChamadas.length;
    const presentes = listaChamadas.filter((c) => c.status_presenca === 'presente').length;
    const ausentes = listaChamadas.filter((c) => c.status_presenca === 'ausente').length;
    const justificadas = listaChamadas.filter((c) => c.status_presenca === 'falta_justificada').length;
    const taxaPresenca = totalChamadas > 0 ? Math.round((presentes / totalChamadas) * 100) : 100;

    // 4. Equipe Ativa
    const { count: totalEquipe } = await admin
      .from('discipulado_equipe')
      .select('id', { count: 'exact', head: true })
      .eq('ministry_id', ministryId)
      .eq('ativo', true);

    return NextResponse.json({
      resumo: {
        totalJornadas,
        ativas,
        concluidas,
        formacaoCompleta,
        taxaPresenca,
        totalEquipe: totalEquipe || 0,
        totalTurmas: (turmas || []).length,
      },
      distribuicaoFases: {
        primeirosPassos,
        fundamentos,
        batismo,
      },
      frequencia: {
        totalChamadas,
        presentes,
        ausentes,
        justificadas,
        taxaPresenca,
      },
      turmas: turmas || [],
    });
  } catch (err: any) {
    console.error('[GET /api/v1/discipulado/relatorios]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao compilar relatórios do discipulado.' },
      { status: 500 }
    );
  }
}
