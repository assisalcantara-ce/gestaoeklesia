import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { temAcesso } from '@/lib/access-control';

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
    return NextResponse.json({ error: 'Acesso negado ao histórico de transferências.' }, { status: 403 });
  }

  try {
    const { id: turmaId } = await params;

    // Busca o histórico de movimentações vinculadas à turma (origem ou destino)
    const { data: historico, error } = await admin
      .from('discipulado_turma_historico')
      .select(`
        id, ministry_id, matricula_id, tipo_evento, motivo, created_at,
        turma_origem:discipulado_turmas!discipulado_turma_historico_turma_origem_id_fkey ( id, nome ),
        turma_destino:discipulado_turmas!discipulado_turma_historico_turma_destino_id_fkey ( id, nome ),
        registrado_por:members!discipulado_turma_historico_registrado_por_id_fkey ( id, name ),
        matricula:discipulado_turma_alunos (
          id, member_id,
          member:members ( id, name )
        )
      `)
      .eq('ministry_id', ministryId)
      .or(`turma_origem_id.eq.${turmaId},turma_destino_id.eq.${turmaId}`)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar histórico: ${error.message}`);
    }

    return NextResponse.json({ historico: historico || [] });
  } catch (err: any) {
    console.error('[GET /api/v1/discipulado/turmas/[id]/historico]', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao consultar histórico de transferências.' },
      { status: 500 }
    );
  }
}
