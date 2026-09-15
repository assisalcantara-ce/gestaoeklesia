import { NextRequest, NextResponse } from 'next/server';
import { resolveMobileMember, mobileMemberErrorResponse } from '@/lib/mobile-member-auth';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/mobile/ebd/licoes
 * Retorna o cronograma e conteúdo das lições/aulas da turma do aluno:
 * - Lista de aulas/lições ordenadas
 * - Tema, número da lição, data, observações
 * - Professor responsável pela lição
 * - Status de presença do aluno autenticado
 * - Dados da revista do trimestre (se cadastrada)
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();

    // 1. Localizar aluno
    const { data: aluno, error: alunoErr } = await admin
      .from('ebd_alunos')
      .select('id, ministry_id, church_id, member_id, nome, ativo')
      .eq('ministry_id', ctx.ministryId)
      .eq('member_id', ctx.memberId)
      .maybeSingle();

    if (alunoErr || !aluno) {
      return NextResponse.json(
        { error: 'Aluno não encontrado ou não cadastrado na EBD.', code: 'STUDENT_NOT_FOUND', licoes: [] },
        { status: 404 }
      );
    }

    // 2. Localizar matrícula ativa
    const { data: matriculas } = await admin
      .from('ebd_matriculas')
      .select('id, ministry_id, aluno_id, turma_id, data_inicio, data_fim')
      .eq('ministry_id', ctx.ministryId)
      .eq('aluno_id', aluno.id)
      .order('data_inicio', { ascending: false });

    const matriculaAtiva = (matriculas || []).find((m) => !m.data_fim);

    if (!matriculaAtiva) {
      return NextResponse.json(
        { error: 'Aluno sem matrícula ativa na EBD.', code: 'NOT_ENROLLED', licoes: [] },
        { status: 404 }
      );
    }

    // 3. Buscar turma para saber a classe_id
    const { data: turma } = await admin
      .from('ebd_turmas')
      .select('id, nome, classe_id')
      .eq('id', matriculaAtiva.turma_id)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    // 4. Parâmetros opcionais de filtro
    const searchParams = request.nextUrl.searchParams;
    const paramAno = searchParams.get('ano');
    const paramTrimestre = searchParams.get('trimestre');

    let aulasQuery = admin
      .from('ebd_aulas')
      .select(`
        id,
        turma_id,
        data_aula,
        trimestre,
        ano,
        licao_numero,
        tema,
        status,
        observacoes,
        professor_id,
        ebd_professores ( id, nome )
      `)
      .eq('turma_id', matriculaAtiva.turma_id)
      .eq('ministry_id', ctx.ministryId);

    if (paramAno) {
      aulasQuery = aulasQuery.eq('ano', parseInt(paramAno, 10));
    }
    if (paramTrimestre) {
      aulasQuery = aulasQuery.eq('trimestre', parseInt(paramTrimestre, 10));
    }

    aulasQuery = aulasQuery.order('data_aula', { ascending: true });

    const { data: aulas, error: aulasErr } = await aulasQuery;

    if (aulasErr) {
      return NextResponse.json(
        { error: 'Erro ao consultar lições.', detail: aulasErr.message },
        { status: 500 }
      );
    }

    // 5. Buscar presenças do aluno nas aulas da turma
    const aulaIds = (aulas || []).map((a) => a.id);
    let frequenciasMap = new Map<string, { presente: boolean; observacoes?: string | null }>();

    if (aulaIds.length > 0) {
      const { data: freqs } = await admin
        .from('ebd_frequencias')
        .select('aula_id, presente, observacoes')
        .eq('aluno_id', aluno.id)
        .eq('ministry_id', ctx.ministryId)
        .in('aula_id', aulaIds);

      if (freqs) {
        for (const f of freqs) {
          frequenciasMap.set(f.aula_id, {
            presente: !!f.presente,
            observacoes: f.observacoes,
          });
        }
      }
    }

    // 6. Buscar revista correspondente se houver classe_id
    let revistaInfo = null;
    if (turma?.classe_id) {
      const anoAtual = paramAno ? parseInt(paramAno, 10) : new Date().getFullYear();
      const trimAtual = paramTrimestre
        ? parseInt(paramTrimestre, 10)
        : Math.ceil((new Date().getMonth() + 1) / 3);

      const { data: revista } = await admin
        .from('ebd_revistas')
        .select('id, titulo, editora, trimestre, ano, capa_url')
        .eq('classe_id', turma.classe_id)
        .eq('ministry_id', ctx.ministryId)
        .eq('ano', anoAtual)
        .eq('trimestre', trimAtual)
        .eq('ativo', true)
        .maybeSingle();

      if (revista) {
        revistaInfo = revista;
      }
    }

    const licoesFormatadas = (aulas || []).map((aulaItem) => {
      const freq = frequenciasMap.get(aulaItem.id);
      return {
        id: aulaItem.id,
        data_aula: aulaItem.data_aula,
        licao_numero: aulaItem.licao_numero,
        tema: aulaItem.tema || `Lição ${aulaItem.licao_numero ?? ''}`,
        status: aulaItem.status,
        observacoes: aulaItem.observacoes,
        trimestre: aulaItem.trimestre,
        ano: aulaItem.ano,
        professor: (aulaItem.ebd_professores as any)?.nome || null,
        frequencia: freq ? { presente: freq.presente, observacoes: freq.observacoes } : null,
      };
    });

    return NextResponse.json({
      turma_id: matriculaAtiva.turma_id,
      turma_nome: turma?.nome || null,
      revista: revistaInfo,
      total_licoes: licoesFormatadas.length,
      licoes: licoesFormatadas,
    });
  } catch (error) {
    const authResp = mobileMemberErrorResponse(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: 'Erro interno ao consultar lições.', detail: String(error) },
      { status: 500 }
    );
  }
}
