import { NextRequest, NextResponse } from 'next/server';
import { resolveMobileMember, mobileMemberErrorResponse } from '@/lib/mobile-member-auth';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/mobile/ebd/frequencia
 * Retorna o histórico e estatísticas de frequência do aluno autenticado:
 * - Totais gerais (aulas, presenças, faltas, percentual)
 * - Agrupamento por ano e trimestre
 * - Histórico detalhado aula a aula
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();

    // 1. Localizar aluno
    const { data: aluno, error: alunoErr } = await admin
      .from('ebd_alunos')
      .select('id, ministry_id, member_id, nome')
      .eq('ministry_id', ctx.ministryId)
      .eq('member_id', ctx.memberId)
      .maybeSingle();

    if (alunoErr || !aluno) {
      return NextResponse.json(
        {
          resumo: { total_aulas: 0, presencas: 0, faltas: 0, percentual: 0 },
          historico: [],
          por_trimestre: [],
        },
        { status: 200 }
      );
    }

    // 2. Parâmetros opcionais
    const searchParams = request.nextUrl.searchParams;
    const paramAno = searchParams.get('ano');
    const paramTrimestre = searchParams.get('trimestre');

    // 3. Buscar frequências do aluno com dados da aula
    const { data: frequencias, error: freqErr } = await admin
      .from('ebd_frequencias')
      .select(`
        id,
        presente,
        observacoes,
        created_at,
        ebd_aulas (
          id,
          turma_id,
          data_aula,
          trimestre,
          ano,
          licao_numero,
          tema,
          status,
          ebd_turmas ( id, nome )
        )
      `)
      .eq('aluno_id', aluno.id)
      .eq('ministry_id', ctx.ministryId);

    if (freqErr) {
      return NextResponse.json(
        { error: 'Erro ao consultar frequências.', detail: freqErr.message },
        { status: 500 }
      );
    }

    // 4. Mapear e filtrar registros válidos
    let registros = (frequencias || [])
      .filter((f) => f.ebd_aulas != null)
      .map((f) => {
        const aula = f.ebd_aulas as any;
        return {
          id: f.id,
          presente: !!f.presente,
          observacoes: f.observacoes,
          data_aula: aula.data_aula,
          licao_numero: aula.licao_numero,
          tema: aula.tema || `Lição ${aula.licao_numero ?? ''}`,
          ano: aula.ano,
          trimestre: aula.trimestre,
          turma_id: aula.turma_id,
          turma_nome: aula.ebd_turmas?.nome || 'Turma EBD',
        };
      });

    if (paramAno) {
      const anoNum = parseInt(paramAno, 10);
      registros = registros.filter((r) => r.ano === anoNum);
    }

    if (paramTrimestre) {
      const trimNum = parseInt(paramTrimestre, 10);
      registros = registros.filter((r) => r.trimestre === trimNum);
    }

    // Ordenar do mais recente para o mais antigo
    registros.sort((a, b) => (a.data_aula > b.data_aula ? -1 : 1));

    // 5. Calcular totais
    const totalAulas = registros.length;
    const presencas = registros.filter((r) => r.presente).length;
    const faltas = totalAulas - presencas;
    const percentual = totalAulas > 0 ? Math.round((presencas / totalAulas) * 100) : 0;

    // 6. Agrupar por trimestre
    const mapaTrimestres: Record<string, { ano: number; trimestre: number; total: number; presencas: number; faltas: number }> = {};

    for (const r of registros) {
      const chave = `${r.ano}-T${r.trimestre ?? 'X'}`;
      if (!mapaTrimestres[chave]) {
        mapaTrimestres[chave] = {
          ano: r.ano,
          trimestre: r.trimestre ?? 0,
          total: 0,
          presencas: 0,
          faltas: 0,
        };
      }
      mapaTrimestres[chave].total += 1;
      if (r.presente) {
        mapaTrimestres[chave].presencas += 1;
      } else {
        mapaTrimestres[chave].faltas += 1;
      }
    }

    const porTrimestre = Object.entries(mapaTrimestres).map(([chave, val]) => ({
      chave,
      ano: val.ano,
      trimestre: val.trimestre,
      total: val.total,
      presencas: val.presencas,
      faltas: val.faltas,
      percentual: val.total > 0 ? Math.round((val.presencas / val.total) * 100) : 0,
    }));

    return NextResponse.json({
      aluno_id: aluno.id,
      aluno_nome: aluno.nome,
      resumo: {
        total_aulas: totalAulas,
        presencas: presencas,
        faltas: faltas,
        percentual: percentual,
      },
      por_trimestre: porTrimestre,
      historico: registros,
    });
  } catch (error) {
    const authResp = mobileMemberErrorResponse(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: 'Erro interno ao consultar frequência.', detail: String(error) },
      { status: 500 }
    );
  }
}
