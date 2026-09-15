import { NextRequest, NextResponse } from 'next/server';
import { resolveMobileMember, mobileMemberErrorResponse } from '@/lib/mobile-member-auth';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/mobile/ebd/turma
 * Retorna os detalhes completos da turma do aluno autenticado:
 * - Turma, sala, capacidade
 * - Faixa etária e classe
 * - Congregação
 * - Professores e funções
 * - Trimestre atual
 * - Situação da matrícula
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

    if (alunoErr) {
      return NextResponse.json(
        { error: 'Erro ao consultar aluno.', detail: alunoErr.message },
        { status: 500 }
      );
    }

    if (!aluno) {
      return NextResponse.json(
        { error: 'Aluno EBD não encontrado para este membro.', code: 'STUDENT_NOT_FOUND', enrolled: false },
        { status: 404 }
      );
    }

    // 2. Localizar matrícula ativa
    const { data: matriculas, error: matErr } = await admin
      .from('ebd_matriculas')
      .select('id, ministry_id, aluno_id, turma_id, data_inicio, data_fim, motivo_saida')
      .eq('ministry_id', ctx.ministryId)
      .eq('aluno_id', aluno.id)
      .order('data_inicio', { ascending: false });

    if (matErr) {
      return NextResponse.json(
        { error: 'Erro ao consultar matrícula.', detail: matErr.message },
        { status: 500 }
      );
    }

    const matriculaAtiva = (matriculas || []).find((m) => !m.data_fim);

    if (!matriculaAtiva) {
      return NextResponse.json(
        { error: 'Aluno não possui matrícula ativa em nenhuma turma da EBD.', code: 'NOT_ENROLLED', enrolled: false },
        { status: 404 }
      );
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
        ebd_classes ( id, nome, faixa_etaria_min, faixa_etaria_max, descricao, cor ),
        congregacoes ( id, nome )
      `)
      .eq('id', matriculaAtiva.turma_id)
      .eq('ministry_id', ctx.ministryId)
      .maybeSingle();

    if (turmaErr || !turma) {
      return NextResponse.json(
        { error: 'Turma não encontrada.', detail: turmaErr?.message },
        { status: 404 }
      );
    }

    // 4. Buscar professores
    const professoresList: Array<{
      id: string;
      nome: string;
      telefone?: string | null;
      email?: string | null;
      funcao: string;
    }> = [];

    if (turma.professor_titular_id) {
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

    const { data: turmaProfs } = await admin
      .from('ebd_turma_professores')
      .select(`
        id,
        funcao,
        professor_id,
        ebd_professores ( id, nome, telefone, email )
      `)
      .eq('turma_id', turma.id)
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

    return NextResponse.json({
      enrolled: true,
      matricula: {
        id: matriculaAtiva.id,
        data_inicio: matriculaAtiva.data_inicio,
        ativo: true,
      },
      turma: {
        id: turma.id,
        nome: turma.nome,
        sala: turma.sala,
        capacidade_max: turma.capacidade_max,
        ativo: turma.ativo,
        classe: turma.ebd_classes,
        congregacao: turma.congregacoes,
      },
      professores: professoresList,
      trimestre_atual: trimestreAtual || null,
    });
  } catch (error) {
    const authResp = mobileMemberErrorResponse(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: 'Erro interno ao consultar turma.', detail: String(error) },
      { status: 500 }
    );
  }
}
