import { NextRequest, NextResponse } from 'next/server';
import { resolveMobileMember, mobileMemberErrorResponse } from '@/lib/mobile-member-auth';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/mobile/ebd/me
 * Retorna o resumo EBD do membro autenticado:
 * - Dados do aluno
 * - Matrícula ativa
 * - Turma atual
 * - Trimestre vigente
 * - Professores
 * - Resumo de frequência
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveMobileMember(request);
    const admin = createServerClient();

    // 1. Localizar aluno EBD vinculado ao membro autenticado
    const { data: aluno, error: alunoErr } = await admin
      .from('ebd_alunos')
      .select('id, ministry_id, church_id, member_id, nome, data_nascimento, sexo, responsavel_nome, responsavel_telefone, ativo')
      .eq('ministry_id', ctx.ministryId)
      .eq('member_id', ctx.memberId)
      .maybeSingle();

    if (alunoErr) {
      return NextResponse.json(
        { error: 'Erro ao consultar dados de aluno EBD.', detail: alunoErr.message },
        { status: 500 }
      );
    }

    if (!aluno) {
      return NextResponse.json({
        has_student: false,
        is_enrolled: false,
        aluno: null,
        matricula: null,
        turma: null,
        professores: [],
        trimestre_atual: null,
        frequencia_resumo: null,
        proxima_licao: null,
      });
    }

    // 2. Buscar matrícula ativa (data_fim IS NULL)
    const { data: matriculas, error: matErr } = await admin
      .from('ebd_matriculas')
      .select('id, ministry_id, aluno_id, turma_id, data_inicio, data_fim, motivo_saida')
      .eq('ministry_id', ctx.ministryId)
      .eq('aluno_id', aluno.id)
      .order('data_inicio', { ascending: false });

    if (matErr) {
      return NextResponse.json(
        { error: 'Erro ao consultar matrículas.', detail: matErr.message },
        { status: 500 }
      );
    }

    const matriculaAtiva = (matriculas || []).find((m) => !m.data_fim);
    const ultimaMatricula = matriculas && matriculas.length > 0 ? matriculas[0] : null;

    if (!matriculaAtiva) {
      return NextResponse.json({
        has_student: true,
        is_enrolled: false,
        aluno: {
          id: aluno.id,
          nome: aluno.nome,
          ativo: aluno.ativo,
        },
        matricula: null,
        matricula_anterior: ultimaMatricula,
        turma: null,
        professores: [],
        trimestre_atual: null,
        frequencia_resumo: null,
        proxima_licao: null,
      });
    }

    // 3. Buscar dados da turma
    const { data: turma, error: turmaErr } = await admin
      .from('ebd_turmas')
      .select(`
        id,
        nome,
        sala,
        capacidade_max,
        ativo,
        church_id,
        classe_id,
        professor_titular_id,
        ebd_classes ( id, nome, faixa_etaria_min, faixa_etaria_max, cor ),
        congregacoes ( id, nome )
      `)
      .eq('id', matriculaAtiva.turma_id)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (turmaErr) {
      return NextResponse.json(
        { error: 'Erro ao consultar turma.', detail: turmaErr.message },
        { status: 500 }
      );
    }

    // 4. Buscar professores da turma (titular + equipe de ebd_turma_professores)
    const professoresList: Array<{
      id: string;
      nome: string;
      telefone?: string | null;
      email?: string | null;
      funcao: string;
    }> = [];

    // Professor titular
    if (turma?.professor_titular_id) {
      const { data: profTitular } = await admin
        .from('ebd_professores')
        .select('id, nome, telefone, email')
        .eq('id', turma.professor_titular_id)
        .eq('ministry_id', ctx.ministryId)
        .maybeSingle();

      if (profTitular) {
        professoresList.push({
          id: profTitular.id,
          nome: profTitular.nome,
          telefone: profTitular.telefone,
          email: profTitular.email,
          funcao: 'titular',
        });
      }
    }

    // Professores associados (auxiliares / substitutos)
    const { data: turmaProfs } = await admin
      .from('ebd_turma_professores')
      .select(`
        id,
        funcao,
        professor_id,
        ebd_professores ( id, nome, telefone, email )
      `)
      .eq('turma_id', matriculaAtiva.turma_id)
      .eq('ministry_id', ctx.ministryId);

    if (turmaProfs) {
      for (const tp of turmaProfs) {
        const p = tp.ebd_professores as any;
        if (p && !professoresList.some((existing) => existing.id === p.id)) {
          professoresList.push({
            id: p.id,
            nome: p.nome,
            telefone: p.telefone,
            email: p.email,
            funcao: tp.funcao || 'auxiliar',
          });
        }
      }
    }

    // 5. Trimestre atual
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: trimestres } = await admin
      .from('ebd_trimestres')
      .select('id, numero, ano, descricao, data_inicio, data_fim, ativo')
      .eq('ministry_id', ctx.ministryId)
      .eq('ativo', true)
      .order('ano', { ascending: false })
      .order('numero', { ascending: false });

    let trimestreAtual = (trimestres || []).find(
      (t) => t.data_inicio <= hoje && t.data_fim >= hoje
    );
    if (!trimestreAtual && trimestres && trimestres.length > 0) {
      trimestreAtual = trimestres[0];
    }

    // 6. Próxima lição / última aula planejada/realizada
    const { data: proximaAula } = await admin
      .from('ebd_aulas')
      .select(`
        id,
        data_aula,
        licao_numero,
        tema,
        status,
        observacoes,
        ebd_professores ( id, nome )
      `)
      .eq('turma_id', matriculaAtiva.turma_id)
      .eq('ministry_id', ctx.ministryId)
      .gte('data_aula', hoje)
      .order('data_aula', { ascending: true })
      .limit(1)
      .maybeSingle();

    // 7. Resumo de frequência do aluno
    const { data: freqs } = await admin
      .from('ebd_frequencias')
      .select('id, presente, aula_id')
      .eq('aluno_id', aluno.id)
      .eq('ministry_id', ctx.ministryId);

    const totalAulasRegistradas = freqs?.length || 0;
    const totalPresencas = freqs?.filter((f) => f.presente).length || 0;
    const totalFaltas = totalAulasRegistradas - totalPresencas;
    const percentualPresenca =
      totalAulasRegistradas > 0
        ? Math.round((totalPresencas / totalAulasRegistradas) * 100)
        : 0;

    return NextResponse.json({
      has_student: true,
      is_enrolled: true,
      aluno: {
        id: aluno.id,
        nome: aluno.nome,
        ativo: aluno.ativo,
        sexo: aluno.sexo,
      },
      matricula: {
        id: matriculaAtiva.id,
        data_inicio: matriculaAtiva.data_inicio,
        turma_id: matriculaAtiva.turma_id,
      },
      turma: {
        id: turma?.id,
        nome: turma?.nome,
        sala: turma?.sala,
        capacidade_max: turma?.capacidade_max,
        ativo: turma?.ativo,
        classe: turma?.ebd_classes,
        congregacao: turma?.congregacoes,
      },
      professores: professoresList,
      trimestre_atual: trimestreAtual || null,
      proxima_licao: proximaAula
        ? {
            id: proximaAula.id,
            data_aula: proximaAula.data_aula,
            licao_numero: proximaAula.licao_numero,
            tema: proximaAula.tema,
            status: proximaAula.status,
            observacoes: proximaAula.observacoes,
            professor: (proximaAula.ebd_professores as any)?.nome || null,
          }
        : null,
      frequencia_resumo: {
        total_aulas: totalAulasRegistradas,
        presencas: totalPresencas,
        faltas: totalFaltas,
        percentual: percentualPresenca,
      },
    });
  } catch (error) {
    const authResp = mobileMemberErrorResponse(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: 'Erro interno ao processar dados de EBD.', detail: String(error) },
      { status: 500 }
    );
  }
}
