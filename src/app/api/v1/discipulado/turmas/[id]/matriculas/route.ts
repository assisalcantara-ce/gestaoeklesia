import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { temAcesso } from '@/lib/access-control';
import { DiscipuladoPedagogicoService } from '@/services/discipulado-pedagogico-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    return NextResponse.json({ error: 'Acesso negado aos alunos da turma.' }, { status: 403 });
  }

  try {
    const { id: turmaId } = await params;
    const { data: matriculas, error } = await admin
      .from('discipulado_turma_alunos')
      .select(`
        id, ministry_id, turma_id, jornada_id, member_id, data_matricula, status, motivo_desligamento,
        member:members!discipulado_turma_alunos_member_id_fkey ( id, name, phone, celular, foto_url ),
        jornada:discipulado_jornadas!discipulado_turma_alunos_jornada_id_fkey ( id, fase, status, licoes_concluidas, congregacao_id )
      `)
      .eq('turma_id', turmaId)
      .eq('ministry_id', ministryId)
      .order('data_matricula', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar matrículas: ${error.message}`);
    }

    return NextResponse.json({ matriculas: matriculas || [] });
  } catch (err: any) {
    console.error('[GET /api/v1/discipulado/turmas/[id]/matriculas]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao consultar matrículas da turma.' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    return NextResponse.json({ error: 'Permissão insuficiente para matricular alunos.' }, { status: 403 });
  }

  try {
    const { id: turmaId } = await params;
    const body = await request.json();
    const { jornadaId, acao, novaTurmaId, motivo, matriculaId } = body;

    // Ação de transferência de turma
    if (acao === 'transferir') {
      if (!matriculaId || !novaTurmaId) {
        return NextResponse.json(
          { error: 'Para transferência, matriculaId e novaTurmaId são obrigatórios.' },
          { status: 400 }
        );
      }
      const transfResult = await DiscipuladoPedagogicoService.transferirTurma(
        admin,
        ministryId,
        matriculaId,
        novaTurmaId,
        motivo || 'Transferência solicitada pelo discípulo/liderança'
      );
      return NextResponse.json(transfResult);
    }

    // Matrícula regular
    if (!jornadaId) {
      return NextResponse.json(
        { error: 'Identificador da jornada (jornadaId) é obrigatório.' },
        { status: 400 }
      );
    }

    const matResult = await DiscipuladoPedagogicoService.matricularAluno(
      admin,
      ministryId,
      turmaId,
      jornadaId
    );

    return NextResponse.json(matResult, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/v1/discipulado/turmas/[id]/matriculas]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro ao processar matrícula.' },
      { status: 400 }
    );
  }
}
